'use client';

import { useEffect } from 'react';

interface RootErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function RootError({ error, unstable_retry }: RootErrorProps) {
  useEffect(() => {
    console.error('Unhandled route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The POS app hit an unexpected issue while rendering this screen.
        </p>
        <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">
          Error digest: {error.digest ?? 'not-available'}
        </p>
        <button
          type="button"
          className="mt-6 inline-flex min-h-touch items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          onClick={() => unstable_retry()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
