import net from 'node:net';

import type { DiscoveredPrinter, PrinterDiscoveryResult } from '@/types/printer';
import { config } from '@/lib/config';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

type Candidate = {
  ip: string;
  port: number;
};

function asPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildSubnetCandidates(ip: string, ports: number[]): Candidate[] {
  const octets = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
    return [];
  }

  const maxHosts = Math.min(254, asPositiveInteger(process.env.PRINTER_DISCOVERY_MAX_HOSTS, 254));
  const prefix = `${octets[0]}.${octets[1]}.${octets[2]}`;
  const candidates: Candidate[] = [];

  for (let host = 1; host <= maxHosts; host += 1) {
    for (const port of ports) {
      candidates.push({
        ip: `${prefix}.${host}`,
        port,
      });
    }
  }

  return candidates;
}

async function checkPrinterCandidate(candidate: Candidate): Promise<DiscoveredPrinter | null> {
  const timeoutMs = config.printer.discoveryTimeoutMs;

  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startedAt = Date.now();
    let resolved = false;

    const finish = (result: DiscoveredPrinter | null) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      finish({
        ip: candidate.ip,
        port: candidate.port,
        model: 'XP-80T',
        responseTime: Date.now() - startedAt,
      });
    });

    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));

    socket.connect(candidate.port, candidate.ip);
  });
}

async function scanCandidates(candidates: Candidate[]): Promise<DiscoveredPrinter[]> {
  const results: DiscoveredPrinter[] = [];
  const concurrency = Math.min(50, asPositiveInteger(process.env.PRINTER_DISCOVERY_CONCURRENCY, 30));
  let index = 0;

  async function worker() {
    while (index < candidates.length) {
      const current = candidates[index];
      index += 1;

      const discovered = await checkPrinterCandidate(current);
      if (discovered) {
        results.push(discovered);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker());
  await Promise.all(workers);

  return results.sort((a, b) => (a.responseTime ?? 99999) - (b.responseTime ?? 99999));
}

async function upsertPrinterStatus(input: {
  ip: string;
  port: number;
  isOnline: boolean;
  errorMessage?: string;
}) {
  await supabaseServer
    .from('printer_status_cache')
    .upsert(
      {
        printer_ip: input.ip,
        port: input.port,
        is_online: input.isOnline,
        last_checked_at: new Date().toISOString(),
        error_message: input.errorMessage ?? null,
        updated_at: new Date().toISOString(),
      } as never,
      {
        onConflict: 'printer_ip,port',
      }
    );
}

export async function discoverPrinters(): Promise<PrinterDiscoveryResult> {
  const configuredCandidates: Candidate[] = [
    {
      ip: config.printer.ip,
      port: config.printer.port,
    },
    ...config.printer.discoveryPorts
      .filter((port) => port !== config.printer.port)
      .map((port) => ({ ip: config.printer.ip, port })),
  ];

  const configuredMatches = await scanCandidates(configuredCandidates);
  if (configuredMatches.length > 0) {
    await upsertPrinterStatus({
      ip: configuredMatches[0].ip,
      port: configuredMatches[0].port,
      isOnline: true,
    });

    return {
      printers: configuredMatches,
      primary: configuredMatches[0],
    };
  }

  if (!config.printer.discoveryEnabled) {
    await upsertPrinterStatus({
      ip: config.printer.ip,
      port: config.printer.port,
      isOnline: false,
      errorMessage: 'Discovery disabled and configured printer did not respond',
    });

    return { printers: [] };
  }

  const subnetCandidates = buildSubnetCandidates(config.printer.ip, config.printer.discoveryPorts);
  const scanned = await scanCandidates(subnetCandidates);

  if (scanned.length > 0) {
    await upsertPrinterStatus({
      ip: scanned[0].ip,
      port: scanned[0].port,
      isOnline: true,
    });
  } else {
    await upsertPrinterStatus({
      ip: config.printer.ip,
      port: config.printer.port,
      isOnline: false,
      errorMessage: 'No printer discovered on LAN',
    });
  }

  return {
    printers: scanned,
    primary: scanned[0],
  };
}

export async function resolvePrinterTarget(): Promise<DiscoveredPrinter | null> {
  const recentOnlineCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: cachedOnline } = await supabaseServer
    .from('printer_status_cache')
    .select('*')
    .eq('is_online', true)
    .gte('last_checked_at', recentOnlineCutoff)
    .order('last_checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const cachedOnlineRecord = (cachedOnline ?? null) as Record<string, unknown> | null;

  if (cachedOnlineRecord) {
    const cachedCheck = await checkPrinterCandidate({
      ip: String(cachedOnlineRecord.printer_ip ?? config.printer.ip),
      port: Number(cachedOnlineRecord.port ?? config.printer.port),
    });

    if (cachedCheck) {
      return cachedCheck;
    }
  }

  const discovered = await discoverPrinters();

  if (!discovered.primary) {
    logger.warn('No printer discovered on network', {
      configuredIp: config.printer.ip,
      configuredPort: config.printer.port,
    });
  }

  return discovered.primary ?? null;
}
