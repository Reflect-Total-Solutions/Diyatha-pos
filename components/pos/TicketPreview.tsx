'use client';

import Image from 'next/image';

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
  cashierName: string;
  created_at: string;
  txn_reference: string;
};

type TicketPreviewProps = {
  open: boolean;
  tickets: PrintedTicket[];
  onClose: () => void;
};

export default function TicketPreview({ open, tickets, onClose }: TicketPreviewProps) {
  if (!open || tickets.length === 0) {
    return null;
  }

  return (
    <div id="ticket-preview-portal" className="preview-modal-overlay fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto bg-slate-950/80 px-4 py-8 sm:py-12">
      <div className="mb-6 flex w-full max-w-4xl items-center justify-between no-print">
        <h2 className="text-2xl font-bold text-white">Visual Receipt Preview ({tickets.length})</h2>
        <div className="flex">
        <Button 
          onClick={() => {
            window.print();
            onClose();
          }} 
          className="shadow-sm font-bold bg-blue-600 hover:bg-blue-700 text-white mr-4 h-12 px-6"
        >
          Print Now
        </Button>
        <Button onClick={onClose} variant="secondary" className="shadow-sm font-semibold text-slate-900 h-12 px-6">
          Close Preview
        </Button>
        </div>
      </div>

      <div id="printable-tickets" className="flex w-full max-w-4xl flex-wrap justify-center gap-6 pb-20">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="ticket-print-container flex flex-col items-center bg-white fill-white shadow-2xl relative"
            style={{ width: '80mm', fontFamily: 'monospace', paddingBottom: '15mm', pageBreakAfter: 'always', breakAfter: 'page' }}
          >
            <div className="w-full flex flex-col items-center p-4 pb-8 text-black relative z-10" style={{ maxWidth: '80mm' }}>
              {/* Logo */}
              <div className="mb-4 mt-8 flex w-full flex-col items-center justify-center">
                <Image
                  src="/logo/ticket-logo.png"
                  alt="City of Wonder - Port City Colombo"
                  width={220}
                  height={100}
                  className="h-auto w-full max-w-[220px] object-contain grayscale"
                />
              </div>

              {/* Dashed Separator */}
              <div className="w-full border-b-[2px] border-dashed border-black mb-4"></div>

              {/* Title Section */}
              <div className="text-center font-bold tracking-widest text-[16px] uppercase leading-tight w-full truncate">
                {ticket.activityName} TOKEN
              </div>
              <div className="text-center font-bold text-[14px] mt-1 tracking-widest">
                {ticket.token_number || 'N/A'}
              </div>

              <div className="w-full border-b-[2px] border-dashed border-black my-4"></div>

              {/* Details Details */}
              <div className="w-full text-left text-[14px] font-semibold leading-[1.6] px-1">
                <div className="flex w-full whitespace-nowrap">
                  <span className="w-16">Date</span>
                  <span className="mr-2">:</span>
                  <span className="truncate">
                    {new Date(ticket.created_at).toLocaleDateString('en-GB').replace(/\//g, '-')}
                  </span>
                </div>
                <div className="flex w-full whitespace-nowrap">
                  <span className="w-16">Time</span>
                  <span className="mr-2">:</span>
                  <span className="truncate">
                    {new Date(ticket.created_at).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                    })}
                  </span>
                </div>
                <div className="flex w-full whitespace-nowrap">
                  <span className="w-16">Token</span>
                  <span className="mr-2">:</span>
                  <span>{ticket.token_index || 1} of {ticket.token_total || 1}</span>
                </div>
                <div className="flex w-full whitespace-nowrap">
                  <span className="w-16">Cashier</span>
                  <span className="mr-2">:</span>
                  <span className="truncate">{ticket.cashierName}</span>
                </div>
              </div>

              {/* Value Line */}
              <div className="w-full flex items-center justify-start mt-6 mb-2 px-1">
                <span className="text-[24px] font-bold tracking-tight">Value</span>
                <span className="mx-2 text-[20px] font-bold">:</span>
                <span className="text-[22px] font-bold tracking-tight">Rs. {ticket.amount.toFixed(2)}</span>
              </div>

              {/* Txn No */}
              <div className="w-full text-left text-[10px] font-bold mt-1 px-1 tracking-tight truncate">
                Txn No : {ticket.txn_reference}
              </div>

              <div className="w-full border-b-[2px] border-dashed border-black mt-2 mb-4"></div>

              {/* Footer Text */}
              <div className="text-center text-[10px] font-bold leading-[1.4] mt-2 mb-6 px-2 tracking-tight">
                Please surrender this token<br />
                at the activity point.<br />
                Cannot be reused. No cash refund.
              </div>
            </div>
            
            {/* Ragged bottom paper effect wrapper */}
          </div>
        ))}
      </div>
    </div>
  );
}
