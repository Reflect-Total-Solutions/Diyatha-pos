import type { HealthCheckResponse } from '@/types/api';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function checkDatabase() {
  const startedAt = Date.now();
  const { error } = await supabaseServer.from('users').select('id').limit(1);

  return {
    connected: !error,
    latency_ms: Date.now() - startedAt,
  };
}

async function checkPrinter() {
  const printerIp = process.env.PRINTER_IP ?? '192.168.1.100';
  const printerPort = Number.parseInt(process.env.PRINTER_PORT ?? '9100', 10);

  const { data, error } = await supabaseServer
    .from('printer_status_cache')
    .select('*')
    .eq('printer_ip', printerIp)
    .order('last_checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      discovered: false,
      online: false,
      ip: printerIp,
      port: printerPort,
      last_checked: null,
      error: error.message,
    };
  }

  const printerRecord = data as unknown as {
    is_online: boolean;
    printer_ip: string;
    port: number;
    last_checked_at: string;
    error_message: string | null;
  } | null;

  return {
    discovered: Boolean(printerRecord),
    online: printerRecord?.is_online ?? false,
    ip: printerRecord?.printer_ip ?? printerIp,
    port: printerRecord?.port ?? printerPort,
    last_checked: printerRecord?.last_checked_at ?? null,
    error: printerRecord?.error_message ?? null,
  };
}

function resolveStatus(databaseConnected: boolean, printerOnline: boolean): HealthCheckResponse['status'] {
  if (databaseConnected && printerOnline) {
    return 'healthy';
  }

  if (databaseConnected) {
    return 'degraded';
  }

  return 'unhealthy';
}

export async function GET() {
  try {
    const [database, printer] = await Promise.all([checkDatabase(), checkPrinter()]);

    const body: HealthCheckResponse = {
      status: resolveStatus(database.connected, printer.online),
      database,
      printer: {
        discovered: printer.discovered,
        online: printer.online,
        ip: printer.ip,
        port: printer.port,
        last_checked: printer.last_checked ?? undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return Response.json(body, {
      status: body.status === 'unhealthy' ? 503 : 200,
    });
  } catch (error) {
    return Response.json(
      {
        status: 'unhealthy',
        database: {
          connected: false,
        },
        printer: {
          discovered: false,
          online: false,
        },
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown health check error',
      },
      { status: 503 }
    );
  }
}
