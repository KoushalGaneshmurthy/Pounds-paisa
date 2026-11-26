import React, { useMemo, useState } from 'react';
import {
  Search,
  Trash2,
  Pencil,
  MapPin,
  ShoppingBag,
  Train,
  Home,
  GraduationCap,
} from 'lucide-react';
import { ExpenseItem, WeekNumber } from '../types/expense';
import {
  OTHER_SUBCATEGORIES,
  UNIVERSITY_SUBCATEGORIES,
} from '../data/initialData';
import { formatGBP, formatINR, formatShortDate } from '../utils/formatters';

interface PostScrollFeedProps {
  title: string;
  subtitle: string;
  expenses: ExpenseItem[];
  selectedWeek?: WeekNumber | 'all';
  onEditExpense?: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
  showInr: boolean;
  gbpToInrRate: number;
  emptyMessage: string;
}

export const PostScrollFeed: React.FC<PostScrollFeedProps> = ({
  title,
  subtitle,
  expenses,
  selectedWeek = 'all',
  onEditExpense,
  onDeleteExpense,
  showInr,
  gbpToInrRate,
  emptyMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const subCategoryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    OTHER_SUBCATEGORIES.forEach((s) => {
      map[s.id] = s.label;
    });
    UNIVERSITY_SUBCATEGORIES.forEach((u) => {
      map[u.id] = u.label;
    });
    return map;
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((item) => {
        if (selectedWeek !== 'all' && item.week !== selectedWeek) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.title.toLowerCase().includes(q) ||
            item.merchant.toLowerCase().includes(q) ||
            item.location.toLowerCase().includes(q) ||
            (item.notes && item.notes.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedWeek, searchQuery]);

  const filteredTotal = filteredExpenses.reduce((s, e) => s + e.amountGBP, 0);

  const getCategoryIcon = (category: ExpenseItem['category']) => {
    switch (category) {
      case 'groceries':
        return <ShoppingBag className="h-4 w-4 text-emerald-700" />;
      case 'travel':
        return <Train className="h-4 w-4 text-sky-700" />;
      case 'university':
        return <GraduationCap className="h-4 w-4 text-indigo-700" />;
      default:
        return <Home className="h-4 w-4 text-amber-700" />;
    }
  };

  const getCategoryName = (item: ExpenseItem) => {
    if (item.category === 'groceries') return 'Groceries';
    if (item.category === 'travel') return 'Travel';
    if (item.category === 'university') {
      return 'University';
    }
    return item.subCategory ? subCategoryLabelMap[item.subCategory] || 'Others' : 'Others';
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h3 className="font-display text-base font-semibold text-slate-900">
              {title}
            </h3>
            <span className="font-mono-num text-xs text-slate-500">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'post' : 'posts'} ·{' '}
              {formatGBP(filteredTotal)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search place or item..."
              aria-label="Search place or item"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none sm:w-52"
            />
          </div>
        </div>
      </div>

      {filteredExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">{emptyMessage}</p>
          <p className="mt-1 text-xs text-slate-500">
            Clear active filters or use Log Expense at the top to add an entry.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredExpenses.map((item) => {
            const effectiveRate =
              item.rateAtEntry && item.rateAtEntry > 0 ? item.rateAtEntry : gbpToInrRate;
            return (
              <article
                key={item.id}
                className="group flex flex-col gap-3 p-5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-start sm:justify-between sm:px-6"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200/60">
                    {getCategoryIcon(item.category)}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {getCategoryName(item)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatShortDate(item.date)}</span>
                    </div>

                    <h4 className="font-display text-sm font-semibold text-slate-900 sm:text-[15px]">
                      {item.title || item.merchant}
                    </h4>

                    {item.notes && (
                      <p className="text-xs leading-relaxed text-slate-600 max-w-2xl">
                        {item.notes}
                      </p>
                    )}

                    {(item.location || (item.title && item.title !== item.merchant)) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {item.merchant}
                            {item.location ? ` · ${item.location}` : ''}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pl-12 sm:pl-0 sm:justify-end sm:text-right shrink-0">
                  <div>
                    <p className="font-mono-num text-base font-semibold text-slate-900">
                      {formatGBP(item.amountGBP)}
                    </p>
                    {showInr && effectiveRate > 0 && (
                      <p
                        className="font-mono-num text-xs text-slate-500"
                        title={`Converted at £1 = ₹${effectiveRate.toFixed(2)} on ${item.date}`}
                      >
                        {formatINR(item.amountGBP, effectiveRate)}
                        <span className="text-[10px] text-slate-400 ml-1">
                          (@{effectiveRate.toFixed(1)})
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onEditExpense && (
                      <button
                        type="button"
                        onClick={() => onEditExpense(item)}
                        title="Edit expense"
                        aria-label={`Edit ${item.title}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(item.id)}
                      title="Remove entry"
                      aria-label={`Remove ${item.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
