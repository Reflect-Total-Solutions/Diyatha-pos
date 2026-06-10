import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "City of Wonder POS",
    template: "%s | City of Wonder POS",
  },
  description:
    "Point-of-sale system for Port City Carnival activities, tickets, and reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-slate-50 text-slate-900 flex flex-col">
        {children}
      </body>
    </html>
  );
}
