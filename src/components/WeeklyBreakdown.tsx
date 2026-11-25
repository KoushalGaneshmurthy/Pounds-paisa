import React from 'react';
import { ExpenseItem, WeekNumber } from '../types/expense';
import { formatGBP, formatINR } from '../utils/formatters';

interface WeeklyBreakdownProps {
  expenses: ExpenseItem[];
  weeklyTargetGBP?: number;
  selectedWeek: WeekNumber | 'all';
  onSelectWeek: (week: WeekNumber | 'all') => void;
  showInr: boolean;
  gbpToInrRate: number;
  mode: 'stacked' | 'single';
  accentColorClass?: string;
}

const WEEKS: { num: WeekNumber; label: string; dates: string }[] = [
  { num: 1, label: 'Week 1', dates: 'Days 1–7' },
  { num: 2, label: 'Week 2', dates: 'Days 8–14' },
  { num: 3, label: 'Week 3', dates: 'Days 15–21' },
  { num: 4, label: 'Week 4', dates: 'Days 22–End' },
];

export const WeeklyBreakdown: React.FC<WeeklyBreakdownProps> = ({
  expenses,
  weeklyTargetGBP,
  selectedWeek,
  onSelectWeek,
  showInr,
  gbpToInrRate,
  mode,
  accentColorClass = 'bg-teal-700',
}) => {
  const weekTotals = WEEKS.map((w) => {
    const items = expenses.filter((e) => e.week === w.num);
    const total = items.reduce((sum, item) => sum + item.amountGBP, 0);
    const groceries = items
      .filter((e) => e.category === 'groceries')
      .reduce((sum, item) => sum + item.amountGBP, 0);
    const travel = items
      .filter((e) => e.category === 'travel')
      .reduce((sum, item) => sum + item.amountGBP, 0);
    const others = items
      .filter((e) => e.category === 'others')
      .reduce((sum, item) => sum + item.amountGBP, 0);
    const university = items
      .filter((e) => e.category === 'university')
      .reduce((sum, item) => sum + item.amountGBP, 0);
    return {
      ...w,
      count: items.length,
      total,
      groceries,
      travel,
      others,
      university,
    };
  });

  const maxWeekTotal = Math.max(
    ...weekTotals.map((w) => w.total),
    weeklyTargetGBP ?? 0,
    1
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Weekly Pound Expenditure
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any week to filter the feed below
            {weeklyTargetGBP && weeklyTargetGBP > 0 ? ` · Weekly guideline ${formatGBP(weeklyTargetGBP)}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          {mode === 'stacked' && (
            <div className="hidden sm:flex items-center gap-3.5">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                Groceries
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" />
                Travel
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-600" />
                Others
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />
                University
              </span>
            </div>
          )}
          {selectedWeek !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectWeek('all')}
              className="text-xs font-medium text-teal-700 hover:text-teal-900 underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Show all 4 weeks
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {weekTotals.map((w) => {
          const isSelected = selectedWeek === w.num;
          const hasTarget = Boolean(weeklyTargetGBP && weeklyTargetGBP > 0);
          const overTarget = hasTarget && weeklyTargetGBP ? w.total > weeklyTargetGBP : false;
          const totalPct = Math.min(100, (w.total / maxWeekTotal) * 100);

          return (
            <button
              key={w.num}
              type="button"
              onClick={() => onSelectWeek(isSelected ? 'all' : w.num)}
              className={`group text-left rounded-xl p-3.5 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                isSelected
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  {w.label}
                </span>
                <span className="text-[11px] text-slate-500">{w.dates}</span>
              </div>

              <div className="mt-2">
                <p className="font-mono-num text-lg font-semibold text-slate-900">
                  {formatGBP(w.total)}
                </p>
                {showInr && gbpToInrRate > 0 && (
                  <p className="font-mono-num text-[11px] text-slate-500">
                    {formatINR(w.total, gbpToInrRate)}
                  </p>
                )}
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 flex">
                {mode === 'stacked' ? (
                  <>
                    <div
                      style={{ width: `${(w.groceries / maxWeekTotal) * 100}%` }}
                      className="h-full bg-emerald-600 transition-all duration-200"
                    />
                    <div
                      style={{ width: `${(w.travel / maxWeekTotal) * 100}%` }}
                      className="h-full bg-sky-600 transition-all duration-200"
                    />
                    <div
                      style={{ width: `${(w.others / maxWeekTotal) * 100}%` }}
                      className="h-full bg-amber-600 transition-all duration-200"
                    />
                    <div
                      style={{ width: `${(w.university / maxWeekTotal) * 100}%` }}
                      className="h-full bg-indigo-600 transition-all duration-200"
                    />
                  </>
                ) : (
                  <div
                    style={{ width: `${totalPct}%` }}
                    className={`h-full transition-all duration-200 ${
                      overTarget ? 'bg-rose-600' : accentColorClass
                    }`}
                  />
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {w.count} {w.count === 1 ? 'entry' : 'entries'}
                </span>
                {hasTarget ? (
                  <span className={overTarget ? 'text-rose-700 font-medium' : 'text-slate-500'}>
                    {overTarget ? 'Over weekly cap' : 'Within cap'}
                  </span>
                ) : (
                  <span className="text-slate-500">
                    {isSelected ? 'Filtered' : 'Filter'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
