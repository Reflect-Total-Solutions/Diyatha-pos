import { create } from 'zustand';

import type { HealthCheckResponse } from '@/types/api';

interface PrinterStatusState {
  isOnline: boolean;
  ip: string;
  port: number;
  lastCheckedAt: string | null;
  error: string | null;
  setOnline: (ip: string, port: number, checkedAt?: string) => void;
  setOffline: (reason: string) => void;
  checkStatus: () => Promise<void>;
}

const DEFAULT_PRINTER_IP = '192.168.1.100';
const DEFAULT_PRINTER_PORT = 9100;

export const usePrinterStatusStore = create<PrinterStatusState>((set) => ({
  isOnline: false,
  ip: DEFAULT_PRINTER_IP,
  port: DEFAULT_PRINTER_PORT,
  lastCheckedAt: null,
  error: null,
  setOnline: (ip, port, checkedAt) =>
    set({
      isOnline: true,
      ip,
      port,
      lastCheckedAt: checkedAt ?? new Date().toISOString(),
      error: null,
    }),
  setOffline: (reason) =>
    set({
      isOnline: false,
      lastCheckedAt: new Date().toISOString(),
      error: reason,
    }),
  checkStatus: async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        set({
          isOnline: false,
          lastCheckedAt: new Date().toISOString(),
          error: `Health endpoint returned ${response.status}`,
        });
        return;
      }

      const payload = (await response.json()) as HealthCheckResponse;
      set({
        isOnline: payload.printer.online,
        ip: payload.printer.ip ?? DEFAULT_PRINTER_IP,
        port: payload.printer.port ?? DEFAULT_PRINTER_PORT,
        lastCheckedAt: payload.printer.last_checked ?? new Date().toISOString(),
        error: payload.printer.online ? null : 'Printer is offline',
      });
    } catch (error) {
      set({
        isOnline: false,
        lastCheckedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unable to check printer status',
      });
    }
  },
}));
