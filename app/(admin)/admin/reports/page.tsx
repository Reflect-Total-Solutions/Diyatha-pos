import Link from 'next/link';

const cards = [
  {
    href: '/admin/reports/daily',
    title: 'Daily Report',
    description: 'Daily totals by cashier with activity-level breakdown.',
  },
  {
    href: '/admin/reports/activity',
    title: 'Activity Report',
    description: 'Performance by activity across local and foreign pricing.',
  },
  {
    href: '/admin/reports/cashier',
    title: 'Cashier Report',
    description: 'Cashier-level productivity and revenue summary.',
  },
  {
    href: '/admin/reports/transactions',
    title: 'Transactions Report',
    description: 'Detailed transaction listing with filters and pagination.',
  },
];

export default function ReportsOverviewPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Reporting Dashboard</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose a report type, apply date filters, and export to XLSX or PDF.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100"
          >
            <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
