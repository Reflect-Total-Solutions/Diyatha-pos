'use client';

import { Button } from '@/components/ui/button';
import type { PriceType } from '@/types/transaction';

export type PrintedTicket = {
  id: string;
  token_number?: string | null;
  token_index?: number | null;
  token_total?: number | null;
  price_type: PriceType;
  amount: number;
  activityName: string;
};

type TicketPreviewProps = {
  open: boolean;
  tickets: PrintedTicket[];
  onClose: () => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function TicketPreview({ open, tickets, onClose }: TicketPreviewProps) {
  if (!open || tickets.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 py-8 sm:py-12">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-50 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Virtual Printer: Tickets Created</h2>
            <p className="mt-1 text-sm text-slate-500">
              Previewing {tickets.length} ticket(s) generated successfully.
            </p>
          </div>
          <Button onClick={onClose} variant="default" className="shadow-sm">
            Close Preview
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-dashed border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Admission Ticket
                  </p>
                  {ticket.token_index && ticket.token_total && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {ticket.token_index}/{ticket.token_total}
                    </span>
                  )}
                </div>
                
                <h3 className="mt-3 text-lg font-bold text-slate-900">{ticket.activityName}</h3>
                
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Price ({ticket.price_type})</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(ticket.amount)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Token Number</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-slate-900">
                  {ticket.token_number || 'N/A'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
