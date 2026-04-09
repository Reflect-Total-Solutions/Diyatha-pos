'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/activity';

export type PricingActivityRow = Activity & {
  category_name?: string;
};

type EditableRow = {
  local_price: string;
  foreign_price: string;
  is_active: boolean;
};

type PricingTableProps = {
  rows: PricingActivityRow[];
  isSaving?: boolean;
  onSave: (
    activityId: string,
    payload: {
      local_price: number;
      foreign_price: number;
      is_active: boolean;
    }
  ) => Promise<{ success: boolean; error?: string }>;
};

function toEditable(activity: PricingActivityRow): EditableRow {
  return {
    local_price: String(activity.local_price),
    foreign_price: String(activity.foreign_price),
    is_active: activity.is_active,
  };
}

export default function PricingTable({ rows, isSaving = false, onSave }: PricingTableProps) {
  const [edited, setEdited] = useState<Record<string, EditableRow>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [successById, setSuccessById] = useState<Record<string, string>>({});

  const rowById = useMemo(() => {
    return new Map(rows.map((row) => [row.id, row] as const));
  }, [rows]);

  async function handleSave(activityId: string) {
    const sourceRow = rowById.get(activityId);
    const values = edited[activityId] ?? (sourceRow ? toEditable(sourceRow) : undefined);

    if (!values) {
      return;
    }

    const local = Number(values.local_price);
    const foreign = Number(values.foreign_price);

    if (!Number.isFinite(local) || local < 0 || !Number.isFinite(foreign) || foreign < 0) {
      setErrorById((current) => ({
        ...current,
        [activityId]: 'Prices must be valid non-negative numbers.',
      }));
      return;
    }

    setSavingId(activityId);
    setErrorById((current) => ({
      ...current,
      [activityId]: '',
    }));

    const result = await onSave(activityId, {
      local_price: local,
      foreign_price: foreign,
      is_active: values.is_active,
    });

    if (!result.success) {
      setErrorById((current) => ({
        ...current,
        [activityId]: result.error ?? 'Failed to update pricing.',
      }));
    } else {
      setSuccessById((current) => ({
        ...current,
        [activityId]: 'Saved',
      }));
      setTimeout(() => {
        setSuccessById((current) => ({
          ...current,
          [activityId]: '',
        }));
      }, 1800);
    }

    setSavingId(null);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Activity</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Category</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Local Price</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Foreign Price</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Active</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const values = edited[row.id] ?? toEditable(row);
            const rowSaving = savingId === row.id || isSaving;

            return (
              <tr key={row.id}>
                <td className="px-3 py-2 text-slate-800">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-slate-500">Display order: {row.display_order}</p>
                </td>
                <td className="px-3 py-2 text-slate-700">{row.category_name ?? '-'}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={values.local_price}
                    onChange={(event) =>
                      setEdited((current) => ({
                        ...current,
                        [row.id]: {
                          ...values,
                          local_price: event.target.value,
                        },
                      }))
                    }
                    className="h-8 w-28 rounded-md border border-slate-300 px-2 text-right text-sm"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={values.foreign_price}
                    onChange={(event) =>
                      setEdited((current) => ({
                        ...current,
                        [row.id]: {
                          ...values,
                          foreign_price: event.target.value,
                        },
                      }))
                    }
                    className="h-8 w-28 rounded-md border border-slate-300 px-2 text-right text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={values.is_active}
                      onChange={(event) =>
                        setEdited((current) => ({
                          ...current,
                          [row.id]: {
                            ...values,
                            is_active: event.target.checked,
                          },
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {values.is_active ? 'Yes' : 'No'}
                  </label>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={rowSaving}
                      onClick={() => void handleSave(row.id)}
                    >
                      {rowSaving ? 'Saving...' : 'Save'}
                    </Button>
                    {errorById[row.id] ? (
                      <span className="text-xs text-red-600">{errorById[row.id]}</span>
                    ) : null}
                    {successById[row.id] ? (
                      <span className="text-xs text-emerald-600">{successById[row.id]}</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}

          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                No activities available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
