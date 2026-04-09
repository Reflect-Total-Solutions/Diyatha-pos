'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import ActivityGrid from '@/components/pos/ActivityGrid';
import DailySummary from '@/components/pos/DailySummary';
import PaymentConfirmation from '@/components/pos/PaymentConfirmation';
import PricingToggle from '@/components/pos/PricingToggle';
import TransactionHistory from '@/components/pos/TransactionHistory';
import { Button } from '@/components/ui/button';
import { useActivities } from '@/hooks/useActivities';
import { useTransactions } from '@/hooks/useTransactions';
import { useNotificationsStore } from '@/stores/notifications';
import { usePriceModeStore } from '@/stores/priceMode';
import type { Activity } from '@/types/activity';

type PrintResponse = {
  data?: {
    success?: boolean;
    token_number?: string;
  };
  error?: string;
};

export default function DashboardPage() {
  const {
    activities,
    categories,
    isLoading: isActivitiesLoading,
    error: activitiesError,
    refetch: refetchActivities,
  } = useActivities({
    limit: 100,
  });

  const {
    transactions,
    summary,
    isLoading: isTransactionsLoading,
    isMutating: isTransactionsMutating,
    error: transactionsError,
    refetch: refetchTransactions,
    createTransaction,
    cancelTransaction,
    searchTransactions,
    endCurrentGroup,
  } = useTransactions({
    limit: 100,
  });

  const priceType = usePriceModeStore((state) => state.priceType);
  const setPriceType = usePriceModeStore((state) => state.setPriceType);

  const notifications = useNotificationsStore((state) => state.items);
  const pushNotification = useNotificationsStore((state) => state.push);
  const removeNotification = useNotificationsStore((state) => state.remove);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingTransactionId, setCancellingTransactionId] = useState<string | null>(null);

  useEffect(() => {
    const timers = notifications
      .filter((item) => item.durationMs !== 0)
      .map((item) => {
        const timeoutMs = item.durationMs ?? 4000;
        return setTimeout(() => {
          removeNotification(item.id);
        }, timeoutMs);
      });

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [notifications, removeNotification]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    const debounceId = setTimeout(() => {
      if (trimmed.length >= 2) {
        void searchTransactions({
          q: trimmed,
          limit: 100,
        });
      } else {
        void refetchTransactions();
      }
    }, 350);

    return () => clearTimeout(debounceId);
  }, [refetchTransactions, searchQuery, searchTransactions]);

  const filteredActivities = useMemo(() => {
    const sorted = [...activities].sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }

      return a.name.localeCompare(b.name);
    });

    if (selectedCategoryId === 'all') {
      return sorted;
    }

    return sorted.filter((activity) => activity.category_id === selectedCategoryId);
  }, [activities, selectedCategoryId]);

  const activityById = useMemo(() => {
    return new Map(activities.map((activity) => [activity.id, activity] as const));
  }, [activities]);

  async function handleConfirmPayment() {
    if (!selectedActivity) {
      return;
    }

    setPaymentError(null);
    setIsConfirmingPayment(true);

    const transactionResult = await createTransaction({
      activity_id: selectedActivity.id,
      price_type: priceType,
    });

    if (!transactionResult.success || !transactionResult.data) {
      setPaymentError(transactionResult.error ?? 'Unable to create transaction.');
      setIsConfirmingPayment(false);
      return;
    }

    const transactionId = transactionResult.data.id;

    const printResponse = await fetch('/api/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction_id: transactionId }),
    });

    const printPayload = (await printResponse.json().catch(() => ({}))) as PrintResponse;

    if (!printResponse.ok) {
      pushNotification({
        type: 'warning',
        title: 'Transaction created, print pending',
        message: printPayload.error ?? 'Ticket could not be printed automatically.',
      });
    } else {
      pushNotification({
        type: 'success',
        title: 'Payment complete',
        message: printPayload.data?.token_number
          ? `Token ${printPayload.data.token_number} printed successfully.`
          : 'Ticket printed successfully.',
      });
    }

    setSelectedActivity(null);
    setIsPaymentOpen(false);
    setIsConfirmingPayment(false);
  }

  async function handleCancelTransaction(transactionId: string) {
    setCancellingTransactionId(transactionId);

    const reason = window.prompt('Cancellation reason (optional):', '') ?? undefined;
    const result = await cancelTransaction(transactionId, reason);

    if (!result.success) {
      pushNotification({
        type: 'error',
        title: 'Unable to cancel transaction',
        message: result.error,
      });
    } else {
      pushNotification({
        type: 'info',
        title: 'Transaction cancelled',
        message: 'Transaction was marked as cancelled.',
      });
    }

    setCancellingTransactionId(null);
  }

  async function handleEndCustomer() {
    const result = await endCurrentGroup();

    if (!result.success) {
      pushNotification({
        type: 'error',
        title: 'Unable to end customer session',
        message: result.error,
      });
      return;
    }

    pushNotification({
      type: 'success',
      title: 'Customer session completed',
      message: 'Transaction group was finalized successfully.',
    });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Phase 6
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
                POS Dashboard
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                One activity equals one bill. Select an activity and confirm payment to print tickets.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!summary.currentGroupId || isTransactionsMutating}
                onClick={handleEndCustomer}
              >
                End Customer
              </Button>
              <Link
                href="/logout"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Sign out
              </Link>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PricingToggle
              value={priceType}
              onChange={setPriceType}
              disabled={isTransactionsMutating}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedCategoryId === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setSelectedCategoryId('all')}
              >
                All Categories
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategoryId === category.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <ActivityGrid
              activities={filteredActivities}
              isLoading={isActivitiesLoading}
              error={activitiesError}
              selectedActivityId={selectedActivity?.id}
              onRetry={refetchActivities}
              onActivitySelect={(activity) => {
                setSelectedActivity(activity);
                setPaymentError(null);
                setIsPaymentOpen(true);
              }}
            />
          </div>
        </section>

        <div className="space-y-4">
          <DailySummary
            transactions={transactions}
            activeGroupId={summary.currentGroupId}
            activeGroupCount={summary.transactionCount}
            activeGroupAmount={summary.groupTotalAmount}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Current Group</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Group ID</p>
                <p className="mt-1 font-medium text-slate-900">
                  {summary.currentGroupId ? `${summary.currentGroupId.slice(0, 8)}...` : 'Not started'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
                <p className="mt-1 font-medium text-slate-900">{summary.transactionCount}</p>
              </div>
            </div>
            {transactionsError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {transactionsError}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <TransactionHistory
          transactions={transactions}
          activitiesById={activityById}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          isLoading={isTransactionsLoading}
          cancellingTransactionId={cancellingTransactionId}
          onCancelTransaction={handleCancelTransaction}
        />
      </div>

      <PaymentConfirmation
        open={isPaymentOpen}
        activity={selectedActivity}
        priceType={priceType}
        error={paymentError}
        isSubmitting={isConfirmingPayment || isTransactionsMutating}
        onCancel={() => {
          if (isConfirmingPayment) {
            return;
          }

          setSelectedActivity(null);
          setIsPaymentOpen(false);
          setPaymentError(null);
        }}
        onConfirm={handleConfirmPayment}
      />

      <div className="pointer-events-none fixed right-4 top-4 z-[60] w-full max-w-sm space-y-2">
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-lg border px-3 py-2 shadow-md ${
              item.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : item.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : item.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                {item.message ? <p className="text-xs opacity-90">{item.message}</p> : null}
              </div>
              <button
                type="button"
                className="text-xs font-medium opacity-70 hover:opacity-100"
                onClick={() => removeNotification(item.id)}
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
