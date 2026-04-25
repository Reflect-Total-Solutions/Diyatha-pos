import { redirect } from 'next/navigation';
import { requireRequestUser } from '@/lib/request-user';
import { supabaseServer } from '@/lib/supabase-server';
import type { Activity } from '@/types/activity';

export default async function VendorDashboardPage() {
  const user = await requireRequestUser();
  if (user.role !== 'vendor') {
    redirect('/admin');
  }

  // Fetch activities assigned to the vendor
  const { data: activities } = await supabaseServer
    .from('activities')
    .select('*')
    .eq('vendor_id', user.id);
  const vendorActivities = (activities ?? []) as Activity[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1280px] p-4 text-slate-800 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vendor Dashboard</h1>
          <p className="text-sm text-slate-500">Welcome, {user.displayName}. Manage your activities and view reports here.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-1">Your Activities</div>
          <div className="text-3xl font-bold text-slate-900">{vendorActivities.length}</div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Assigned Activities</h2>
        </div>
        <div className="p-0">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Local Price</th>
                <th className="px-6 py-3 font-semibold">Foreign Price</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorActivities.length > 0 ? (
                vendorActivities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-900">{activity.name}</td>
                    <td className="px-6 py-4">LKR {activity.local_price}</td>
                    <td className="px-6 py-4">${activity.foreign_price}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${activity.is_active ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' : 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/10'}`}>
                        {activity.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No activities assigned to you yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
