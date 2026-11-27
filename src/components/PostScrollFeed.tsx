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
  FolderArchive,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { ArchivedMonth, ExpenseItem, WeekNumber } from '../types/expense';
import {
  OTHER_SUBCATEGORIES,
  UNIVERSITY_SUBCATEGORIES,
} from '../data/initialData';
import { formatGBP, formatINR, formatShortDate } from '../utils/formatters';
import { organizeExpensesByMonth } from '../utils/monthUtils';

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
  currentMonthLabel?: string;
  archives?: ArchivedMonth[];
  category?: ExpenseItem['category'];
  onOpenArchiveModal?: () => void;
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
  currentMonthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date()),
  archives = [],
  category,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());

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

  // Split into active month vs previous month folders
  const { activeMonthExpenses, previousMonthFolders } = useMemo(() => {
    return organizeExpensesByMonth(expenses, currentMonthLabel, archives, category);
  }, [expenses, currentMonthLabel, archives, category]);

  // Filter helper for search query and week number
  const filterList = (list: ExpenseItem[]) => {
    return list
      .filter((item) => {
        if (selectedWeek !== 'all' && item.week !== selectedWeek) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.merchant && item.merchant.toLowerCase().includes(q)) ||
            (item.location && item.location.toLowerCase().includes(q)) ||
            (item.notes && item.notes.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const filteredActiveExpenses = useMemo(
    () => filterList(activeMonthExpenses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMonthExpenses, selectedWeek, searchQuery]
  );

  const activeTotal = filteredActiveExpenses.reduce((s, e) => s + e.amountGBP, 0);

  // Filtered previous month folders
  const filteredFolders = useMemo(() => {
    return previousMonthFolders.map((folder) => {
      const filtered = filterList(folder.expenses);
      const total = filtered.reduce((s, e) => s + e.amountGBP, 0);
      return {
        ...folder,
        filteredExpenses: filtered,
        filteredTotal: total,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousMonthFolders, selectedWeek, searchQuery]);

  const toggleFolder = (folderId: string) => {
    setOpenFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const getCategoryIcon = (cat: ExpenseItem['category']) => {
    switch (cat) {
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
    if (item.category === 'university') return 'University';
    return 'Others';
  };

  const renderExpenseItem = (item: ExpenseItem, isArchived = false) => {
    const effectiveRate =
      item.rateAtEntry && item.rateAtEntry > 0 ? item.rateAtEntry : gbpToInrRate;
    return (
      <article
        key={item.id}
        className={`group flex flex-col gap-3 p-4 sm:p-5 transition-colors sm:flex-row sm:items-start sm:justify-between ${
          isArchived ? 'bg-slate-50/40 hover:bg-slate-50/80' : 'hover:bg-slate-50/70'
        }`}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200/60">
            {getCategoryIcon(item.category)}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{getCategoryName(item)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatShortDate(item.date)}</span>
              {isArchived && (
                <span className="rounded-md bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 text-[10px] font-semibold text-amber-700">
                  Archived
                </span>
              )}
            </div>

            {item.category === 'travel' ? (
              <div className="space-y-0.5">
                <h4 className="font-display text-sm font-semibold text-slate-900 sm:text-[15px]">
                  {item.title}
                </h4>
                <div className="text-xs text-slate-500 font-medium pt-0.5">
                  <span>{item.merchant}</span>
                </div>
              </div>
            ) : (
              <>
                <h4 className="font-display text-sm font-semibold text-slate-900 sm:text-[15px]">
                  {item.title || item.merchant}
                </h4>

                {item.notes && (
                  <p className="text-xs leading-relaxed text-slate-600 max-w-2xl">{item.notes}</p>
                )}

                {(item.location || (item.title && item.title !== item.merchant)) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {item.merchant}
                        {item.location ? ` · ${item.location}` : ''}
                      </span>
                    </span>
                  </div>
                )}
              </>
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDeleteExpense(item.id)}
              title="Remove entry"
              aria-label={`Remove ${item.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Active Month Section (Primary Clean List) */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Month · {currentMonthLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {subtitle} · <strong className="text-slate-700 font-mono-num">{filteredActiveExpenses.length}</strong> {filteredActiveExpenses.length === 1 ? 'entry' : 'entries'} ·{' '}
              <strong className="text-slate-900 font-mono-num">{formatGBP(activeTotal)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search place, item, notes..."
                aria-label="Search active and archived expenses"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Active Month Expenses List */}
        {filteredActiveExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
              <Calendar className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-800">{emptyMessage}</p>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              No entries logged for <strong>{currentMonthLabel}</strong> yet. Use{' '}
              <span className="font-semibold text-slate-700">Log Expense</span> above to add your first transaction.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredActiveExpenses.map((item) => renderExpenseItem(item, false))}
          </div>
        )}
      </section>

      {/* 2. Monthly Archive Folders Section (Previous Months) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 border border-amber-200/80 text-amber-700">
              <FolderArchive className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Monthly Archive Folders
                </h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {previousMonthFolders.length} {previousMonthFolders.length === 1 ? 'Month Folder' : 'Month Folders'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                All previous months are organized into monthly folders. Click any folder to review or manage.
              </p>
            </div>
          </div>
        </div>

        {/* Folders Accordion List */}
        {filteredFolders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <Folder className="mx-auto h-7 w-7 text-slate-300 stroke-[1.5]" />
            <p className="mt-2 text-xs font-medium text-slate-600">No previous month folders yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-md mx-auto">
              Any expenses from earlier months or closed cycles will automatically be combined into clean monthly folders here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFolders.map((folder) => {
              const isOpen = openFolderIds.has(folder.id);
              const count = folder.filteredExpenses.length;
              return (
                <div
                  key={folder.id}
                  className="rounded-xl border border-slate-200 overflow-hidden transition-all duration-200 bg-white"
                >
                  {/* Folder Bar */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 transition-colors text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700">
                        {isOpen ? <FolderOpen className="h-4.5 w-4.5" /> : <Folder className="h-4.5 w-4.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold text-slate-900">
                            {folder.monthLabel}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            ({count} {count === 1 ? 'expense' : 'expenses'})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Archived Monthly Folder · Click to {isOpen ? 'collapse' : 'open'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pl-2">
                      <div className="text-right">
                        <span className="font-mono-num text-sm font-bold text-slate-900">
                          {formatGBP(folder.filteredTotal)}
                        </span>
                        {showInr && gbpToInrRate > 0 && (
                          <p className="font-mono-num text-[11px] text-slate-500">
                            {formatINR(folder.filteredTotal, gbpToInrRate)}
                          </p>
                        )}
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Folder Contents */}
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/40 divide-y divide-slate-100">
                      <div className="px-5 py-2.5 bg-amber-50/50 flex items-center justify-between text-[11px] text-amber-900">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Sparkles className="h-3 w-3 text-amber-600" />
                          <span>
                            Folder view: <strong>{folder.monthLabel}</strong>
                          </span>
                        </div>
                        <span className="font-mono-num font-semibold">
                          {formatGBP(folder.filteredTotal)} total
                        </span>
                      </div>

                      {folder.filteredExpenses.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-400">
                          No matching expenses found in this folder.
                        </p>
                      ) : (
                        folder.filteredExpenses.map((item) => renderExpenseItem(item, true))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
