'use client';

import ActivityButton from '@/components/pos/ActivityButton';
import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/activity';

type ActivityGridProps = {
  activities: Activity[];
  isLoading?: boolean;
  error?: string | null;
  selectedActivityId?: string;
  onActivitySelect?: (activity: Activity) => void;
  onRetry?: () => void;
};

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 auto-rows-fr">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={`activity-skeleton-${index}`}
          className="h-40 animate-pulse rounded-2xl border-2 border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function ActivityGrid({
  activities,
  isLoading = false,
  error = null,
  selectedActivityId,
  onActivitySelect,
  onRetry,
}: ActivityGridProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={onRetry}
          >
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-slate-700">No activities found</p>
        <p className="mt-1 text-xs text-slate-500">
          Add activities in the admin panel or adjust filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 auto-rows-fr">
      {activities.map((activity) => {
        const isSelected = selectedActivityId === activity.id;

        return (
          <div
            key={activity.id}
            className={isSelected ? 'rounded-2xl ring-3 ring-blue-500 ring-offset-2' : undefined}
          >
            <ActivityButton
              activity={activity}
              onSelect={onActivitySelect}
            />
          </div>
        );
      })}
    </div>
  );
}
