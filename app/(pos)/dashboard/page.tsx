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
import { useAuth } from '@/hooks/useAuth';
import { useTransactions } from '@/hooks/useTransactions';
import { useNotificationsStore } from '@/stores/notifications';
import { usePriceModeStore } from '@/stores/priceMode';
import type { Activity } from '@/types/activity';

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
  const { user } = useAuth();

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
          cashierName: user?.display_name ?? 'Staff',
          created_at: t.created_at,
          txn_reference: t.txn_reference,
        };
      });
      
      setPreviewTickets(ticketsToPreview);
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
      <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Phase 6
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            POS Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Select activities, adjust quantities, then confirm payment
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/logout"
            className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-slate-400 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Sign out
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        <section className="rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PricingToggle
              value={priceType}
              onChange={setPriceType}
              disabled={isTransactionsMutating}
            />

            <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
              <button
                type="button"
                className={`rounded-lg border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors shrink-0 ${
                  selectedCategoryId === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setSelectedCategoryId('all')}
              >
                All
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors shrink-0 ${
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

          <div className="mt-5">
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

        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:h-fit">
          <div className="rounded-2xl border-3 border-emerald-400 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Shopping Cart</h2>
                <p className="text-xs text-slate-600">
                  {cartSummary.uniqueActivities} item(s) • {cartSummary.totalTickets} ticket(s)
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-red-400 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                disabled={cartItems.length === 0 || isConfirmingPayment || isTransactionsMutating}
                onClick={clearCart}
              >
                Clear
              </button>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl bg-white p-3 border-2 border-slate-300">
              {cartItems.map((item) => {
                const unitPrice = item.priceType === 'local' ? item.activity.local_price : item.activity.foreign_price;
                
                return (
                  <div key={`${item.activity.id}-${item.priceType}`} className="rounded-lg border-2 border-slate-300 bg-gradient-to-r from-slate-50 to-white p-3 hover:from-blue-50 transition-colors">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 line-clamp-2">{item.activity.name}</p>
                        <span className="mt-1 inline-block rounded-lg bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700 border border-slate-300">
                          {item.priceType}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md border-2 border-red-400 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100"
                        disabled={isConfirmingPayment || isTransactionsMutating}
                        onClick={() => removeFromCart(item.activity.id, item.priceType)}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-sm font-bold text-slate-700 hover:bg-white"
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
                          className="h-7 w-12 rounded border border-slate-300 px-1.5 text-center text-sm font-bold"
                          disabled={isConfirmingPayment || isTransactionsMutating}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10);
                            updateCartQuantity(item.activity.id, item.priceType, Number.isFinite(parsed) ? parsed : 1);
                          }}
                        />
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-sm font-bold text-slate-700 hover:bg-white"
                          disabled={isConfirmingPayment || isTransactionsMutating}
                          onClick={() => updateCartQuantity(item.activity.id, item.priceType, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-600">{formatCurrency(unitPrice)}</p>
                        <p className="font-bold text-slate-900">{formatCurrency(unitPrice * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {cartItems.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                  <p className="text-3xl mb-2">🛒</p>
                  <p className="text-sm font-semibold text-slate-600">No items yet</p>
                  <p className="text-xs text-slate-500 mt-1">Select activities to add</p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border-3 border-yellow-400 bg-slate-900 p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-yellow-300">Cart Total</p>
              <p className="mt-2 text-3xl font-bold text-yellow-400">{formatCurrency(cartSummary.totalAmount)}</p>
              <p className="mt-1 text-xs text-slate-300">{cartSummary.totalTickets} ticket(s)</p>
            </div>

            {paymentError ? (
              <p className="mt-3 rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {paymentError}
              </p>
            ) : null}

            <Button
              type="button"
              className="mt-4 w-full h-14 rounded-xl border-2 border-green-600 bg-green-600 text-lg font-bold text-white hover:bg-green-700"
              disabled={cartItems.length === 0 || isConfirmingPayment || isTransactionsMutating}
              onClick={() => {
                setPaymentError(null);
                setIsPaymentOpen(true);
              }}
            >
              {isConfirmingPayment ? 'Processing...' : 'Checkout'}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={!summary.currentGroupId || isTransactionsMutating}
              onClick={handleEndCustomer}
              className="mt-2 w-full h-11 rounded-xl border-2 border-slate-400 font-semibold text-slate-700 hover:bg-slate-100"
            >
              End Customer
            </Button>
          </div>

          <DailySummary
            transactions={transactions}
            activeGroupId={summary.currentGroupId}
            activeGroupCount={summary.transactionCount}
            activeGroupAmount={summary.groupTotalAmount}
          />
        </div>
      </div>

      <div className="mt-6">
        <TransactionHistory
          transactions={transactions}
          activitiesById={activityById}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          isLoading={isTransactionsLoading}
          cancellingTransactionId={cancellingTransactionId}
          onCancelTransaction={handleCancelTransaction}
          onReprintTransaction={(transactionId) => {
            const t = transactions.find((txn) => txn.id === transactionId);
            if (t) {
              const fallbackName = activities.find((a) => a.id === t.activity_id)?.name ?? 'Unknown Activity';
              setPreviewTickets([{
                id: t.id,
                token_number: t.token_number,
                token_index: t.token_index,
                token_total: t.token_total,
                price_type: t.price_type,
                amount: t.amount,
                activityName: fallbackName,
                cashierName: user?.display_name ?? 'Staff',
                created_at: t.created_at,
                txn_reference: t.txn_reference,
              }]);
            }
          }}
          onReprintGroup={(groupId) => {
            const groupTxns = transactions.filter(t => t.transaction_group_id === groupId && !t.cancelled_at);
            if (groupTxns.length > 0) {
              setPreviewTickets(groupTxns.map((t) => {
                const fallbackName = activities.find((a) => a.id === t.activity_id)?.name ?? 'Unknown Activity';
                return {
                  id: t.id,
                  token_number: t.token_number,
                  token_index: t.token_index,
                  token_total: t.token_total,
                  price_type: t.price_type,
                  amount: t.amount,
                  activityName: fallbackName,
                  cashierName: user?.display_name ?? 'Staff',
                  created_at: t.created_at,
                  txn_reference: t.txn_reference,
                };
              }));
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
          setPreviewTickets([]);
        }}
      />
    </>
  );
}
