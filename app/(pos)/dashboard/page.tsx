'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import ActivityGrid from '@/components/pos/ActivityGrid';
import DailySummary from '@/components/pos/DailySummary';
import PaymentConfirmation from '@/components/pos/PaymentConfirmation';
import PricingToggle from '@/components/pos/PricingToggle';
import TicketPreview, { type PrintedTicket } from '@/components/pos/TicketPreview';
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
  code?: string;
};

type PrintAttemptResult = {
  success: boolean;
  tokenNumber?: string;
  error?: string;
  code?: string;
};

type CartItem = {
  activity: Activity;
  quantity: number;
  priceType: 'local' | 'foreign';
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

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
    createBulkTransactions,
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [previewTickets, setPreviewTickets] = useState<PrintedTicket[]>([]);
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

  const cartSummary = useMemo(() => {
    return cartItems.reduce(
      (acc, item) => {
        const unitPrice = item.priceType === 'local' ? item.activity.local_price : item.activity.foreign_price;
        const quantity = Math.max(1, item.quantity);

        return {
          uniqueActivities: acc.uniqueActivities + 1,
          totalTickets: acc.totalTickets + quantity,
          totalAmount: acc.totalAmount + unitPrice * quantity,
        };
      },
      {
        uniqueActivities: 0,
        totalTickets: 0,
        totalAmount: 0,
      }
    );
  }, [cartItems]);

  async function printTransaction(transactionId: string): Promise<PrintAttemptResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const printResponse = await fetch('/api/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction_id: transactionId }),
        signal: controller.signal,
      });

      const printPayload = (await printResponse.json().catch(() => ({}))) as PrintResponse;

      if (!printResponse.ok) {
        return {
          success: false,
          error: printPayload.error ?? 'Ticket could not be printed automatically.',
          code: printPayload.code,
        };
      }

      return {
        success: true,
        tokenNumber: printPayload.data?.token_number,
      };
    } catch {
      return {
        success: false,
        error: 'Printer request timed out or failed. Ticket saved for later print.',
        code: 'PRINTER_OFFLINE',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function addActivityToCart(activity: Activity) {
    setCartItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.activity.id === activity.id && item.priceType === priceType
      );

      if (existingIndex === -1) {
        return [...current, { activity, quantity: 1, priceType }];
      }

      return current.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      );
    });
  }

  function updateCartQuantity(activityId: string, pType: 'local' | 'foreign', quantity: number) {
    setCartItems((current) =>
      current.map((item) =>
        item.activity.id === activityId && item.priceType === pType
          ? {
              ...item,
              quantity: Math.max(1, Math.floor(quantity || 1)),
            }
          : item
      )
    );
  }

  function removeFromCart(activityId: string, pType: 'local' | 'foreign') {
    setCartItems((current) => current.filter((item) => !(item.activity.id === activityId && item.priceType === pType)));
  }

  function clearCart() {
    setCartItems([]);
  }

  async function printTicketsInBackground(
    transactions: Array<{ id: string; token_number?: string | null }>,
  ) {
    let printedCount = 0;
    let pendingPrintCount = 0;
    let firstTokenNumber: string | undefined;
    let stopPrintingForSession = false;

    for (const txn of transactions) {
      if (stopPrintingForSession) {
        pendingPrintCount += 1;
        continue;
      }

      const printResult = await printTransaction(txn.id);

      if (printResult.success) {
        printedCount += 1;
        if (!firstTokenNumber && printResult.tokenNumber) {
          firstTokenNumber = printResult.tokenNumber;
        }
        continue;
      }

      pendingPrintCount += 1;

      if (printResult.code === 'PRINTER_OFFLINE' || printResult.code === 'SERVICE_UNAVAILABLE') {
        stopPrintingForSession = true;
      }
    }

    const totalCreated = transactions.length;

    if (pendingPrintCount > 0) {
      pushNotification({
        type: 'warning',
        title: 'Print pending',
        message:
          pendingPrintCount === totalCreated
            ? `Printer unavailable. ${totalCreated} ticket(s) saved for later print.`
            : `${printedCount} printed, ${pendingPrintCount} pending print.`,
      });
    } else if (printedCount > 0) {
      pushNotification({
        type: 'success',
        title: 'Tickets printed',
        message:
          printedCount === 1 && firstTokenNumber
            ? `Token ${firstTokenNumber} printed successfully.`
            : `${printedCount} ticket(s) printed successfully.`,
      });
    }
  }

  async function handleConfirmPayment() {
    if (cartItems.length === 0) {
      return;
    }

    setPaymentError(null);
    setIsConfirmingPayment(true);

    try {
      // Build the items array for the bulk API
      const bulkItems = cartItems.map((item) => ({
        activity_id: item.activity.id,
        quantity: Math.max(1, item.quantity),
        price_type: item.priceType,
      }));

      const sharedGroupId = summary.currentGroupId ?? undefined;

      // Single atomic API call to create all transactions
      const bulkResult = await createBulkTransactions(
        bulkItems,
        sharedGroupId
      );

      if (!bulkResult.success || !bulkResult.data) {
        setPaymentError(bulkResult.error ?? 'Unable to create transactions.');
        setIsConfirmingPayment(false);
        return;
      }

      const createdTransactions = bulkResult.data.transactions;
      const totalCreated = createdTransactions.length;

      // === Close the dialog and clear cart IMMEDIATELY ===
      clearCart();
      setPaymentError(null);
      setIsConfirmingPayment(false);
      setIsPaymentOpen(false);

      pushNotification({
        type: 'success',
        title: 'Payment complete',
        message: `${totalCreated} ticket(s) created successfully. Showing preview...`,
      });

      // Refresh transaction list right away
      void refetchTransactions();

      // === Show generated tickets preview in the browser (temp) ===
      const ticketsToPreview: PrintedTicket[] = createdTransactions.map((t) => {
        const matchingCartItem = cartItems.find((c) => c.activity.id === t.activity_id && c.priceType === t.price_type);
        const fallbackName = activities.find((a) => a.id === t.activity_id)?.name ?? 'Unknown Activity';
        
        return {
          id: t.id,
          token_number: t.token_number,
          token_index: t.token_index,
          token_total: t.token_total,
          price_type: t.price_type,
          amount: t.amount,
          activityName: matchingCartItem?.activity.name ?? fallbackName,
          created_at: t.created_at,
          txn_reference: t.txn_reference,
        };
      });
      setPreviewTickets(ticketsToPreview);

      // (Disabled physical printing)
      // void printTicketsInBackground(createdTransactions);
    } catch {
      setPaymentError('Unexpected error while processing payment. Please try again.');
      setIsConfirmingPayment(false);
    }
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
    <>
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
                Select multiple activities, adjust quantities, then confirm payment once.
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
              onRetry={refetchActivities}
              onActivitySelect={(activity) => {
                addActivityToCart(activity);
                setPaymentError(null);
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Selected Activities</h2>
                <p className="text-xs text-slate-500">
                  {cartSummary.uniqueActivities} activities, {cartSummary.totalTickets} tickets
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                disabled={cartItems.length === 0 || isConfirmingPayment || isTransactionsMutating}
                onClick={clearCart}
              >
                Clear
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {cartItems.map((item) => (
                <div key={`${item.activity.id}-${item.priceType}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{item.activity.name}</p>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {item.priceType}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-white"
                        disabled={isConfirmingPayment || isTransactionsMutating}
                        onClick={() => updateCartQuantity(item.activity.id, item.priceType, item.quantity - 1)}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantity}
                        inputMode="numeric"
                        className="h-8 w-16 rounded-md border border-slate-300 px-2 text-center text-sm"
                        disabled={isConfirmingPayment || isTransactionsMutating}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          updateCartQuantity(item.activity.id, item.priceType, Number.isFinite(parsed) ? parsed : 1);
                        }}
                      />
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-white"
                        disabled={isConfirmingPayment || isTransactionsMutating}
                        onClick={() => updateCartQuantity(item.activity.id, item.priceType, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        {formatCurrency(
                          item.priceType === 'local'
                            ? item.activity.local_price
                            : item.activity.foreign_price
                        )}
                      </p>
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium text-rose-700 hover:text-rose-800"
                        disabled={isConfirmingPayment || isTransactionsMutating}
                        onClick={() => removeFromCart(item.activity.id, item.priceType)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {cartItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                  No activities selected yet.
                </p>
              ) : null}
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(cartSummary.totalAmount)}
              </p>
              <p className="text-xs text-slate-500">{cartSummary.totalTickets} ticket(s)</p>
            </div>

            <Button
              type="button"
              className="mt-3 w-full"
              disabled={cartItems.length === 0 || isConfirmingPayment || isTransactionsMutating}
              onClick={() => {
                setPaymentError(null);
                setIsPaymentOpen(true);
              }}
            >
              Review & Confirm
            </Button>
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
          onReprintTransaction={(transactionId) => {
            void printTicketsInBackground([{ id: transactionId }]);
          }}
          onReprintGroup={(groupId) => {
            const groupTxns = transactions.filter(t => t.transaction_group_id === groupId && !t.cancelled_at);
            if (groupTxns.length > 0) {
              void printTicketsInBackground(groupTxns.map(t => ({ id: t.id })));
            }
          }}
        />
      </div>

      <PaymentConfirmation
        open={isPaymentOpen}
        items={cartItems}
        error={paymentError}
        isSubmitting={isConfirmingPayment || isTransactionsMutating}
        onQuantityChange={updateCartQuantity}
        onRemoveItem={removeFromCart}
        onCancel={() => {
          if (isConfirmingPayment) {
            return;
          }

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

      <TicketPreview
        open={previewTickets.length > 0}
        tickets={previewTickets}
        onClose={() => {
          void printTicketsInBackground(previewTickets);
          setPreviewTickets([]);
        }}
      />
    </>
  );
}
