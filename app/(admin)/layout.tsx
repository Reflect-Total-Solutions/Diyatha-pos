import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[16rem_1fr]">
          <AdminSidebar />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </main>
  );
}
