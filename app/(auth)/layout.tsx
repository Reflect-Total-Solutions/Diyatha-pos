export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
