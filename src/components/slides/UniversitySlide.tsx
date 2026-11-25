import React, { useMemo, useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import {
  BudgetConfig,
  ExpenseItem,
  UniversityScope,
  UniversitySubCategory,
  WeekNumber,
} from '../../types/expense';
import { SLIDE_IMAGES, UNIVERSITY_SUBCATEGORIES } from '../../data/initialData';
import { formatGBP, formatINR } from '../../utils/formatters';
import { BannerCard } from '../BannerCard';
import { WeeklyBreakdown } from '../WeeklyBreakdown';
import { PostScrollFeed } from '../PostScrollFeed';

interface UniversitySlideProps {
  expenses: ExpenseItem[];
  config: BudgetConfig;
  showInr: boolean;
  onUpdateCap: (newCap: number) => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
}

export const UniversitySlide: React.FC<UniversitySlideProps> = ({
  expenses,
  config,
  showInr,
  onUpdateCap,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<WeekNumber | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState<UniversityScope | 'all'>('all');
  const [subCatFilter, setSubCatFilter] = useState<UniversitySubCategory | 'all'>('all');
  const [isEditingCap, setIsEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState(String(config.universityCapGBP));

  const universityExpenses = useMemo(
    () => expenses.filter((e) => e.category === 'university'),
    [expenses]
  );

  const monthlyUniSpent = useMemo(
    () =>
      universityExpenses
        .filter((e) => e.universityScope !== 'separate')
        .reduce((s, e) => s + e.amountGBP, 0),
    [universityExpenses]
  );

  const separateUniSpent = useMemo(
    () =>
      universityExpenses
        .filter((e) => e.universityScope === 'separate')
        .reduce((s, e) => s + e.amountGBP, 0),
    [universityExpenses]
  );

  const visibleExpenses = useMemo(() => {
    return universityExpenses.filter((e) => {
      if (scopeFilter === 'monthly' && e.universityScope === 'separate') return false;
      if (scopeFilter === 'separate' && e.universityScope !== 'separate') return false;
      if (subCatFilter !== 'all' && e.universitySubCategory !== subCatFilter) return false;
      return true;
    });
  }, [universityExpenses, scopeFilter, subCatFilter]);

  const remaining = config.universityCapGBP - monthlyUniSpent;
  const statusTone =
    config.universityCapGBP <= 0
      ? 'good'
      : remaining < 0
        ? 'alert'
        : remaining < config.universityCapGBP * 0.15
          ? 'warn'
          : 'good';

  const statusText =
    config.universityCapGBP <= 0
      ? 'No monthly cap set · Use Edit Cap to set a limit'
      : remaining < 0
        ? `Over Monthly Study Cap · ${formatGBP(Math.abs(remaining))} above cap`
        : `Within Monthly Study Cap · ${formatGBP(remaining)} left`;

  const subCatTotals = useMemo(() => {
    return UNIVERSITY_SUBCATEGORIES.map((meta) => {
      const items = universityExpenses.filter((e) => e.universitySubCategory === meta.id);
      const amount = items.reduce((s, e) => s + e.amountGBP, 0);
      return {
        ...meta,
        amount,
        count: items.length,
      };
    });
  }, [universityExpenses]);

  const handleSaveCap = () => {
    const parsed = parseFloat(capDraft);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onUpdateCap(Math.round(parsed * 100) / 100);
    }
    setIsEditingCap(false);
  };

  return (
    <div className="space-y-5">
      <BannerCard
        imageSrc={SLIDE_IMAGES.university}
        imageAlt="Historic British university library reading room with oak desks and warm study lamps"
        sectionIndex="Slide 04 of 05 · University"
        title="University"
        subtitle="Track both monthly study expenses and separate one-off costs like tuition, visa, or lab gear."
        primaryLabel="Monthly Study"
        primaryAmountGBP={monthlyUniSpent}
        secondaryLabel="Separate / One-Off"
        secondaryAmountGBP={separateUniSpent}
        limitLabel="Monthly Cap"
        limitAmountGBP={config.universityCapGBP}
        statusText={statusText}
        statusTone={statusTone}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        actionButton={
          <button
            type="button"
            onClick={() => {
              setCapDraft(String(config.universityCapGBP));
              setIsEditingCap((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 px-3.5 py-2.5 text-xs font-medium text-white hover:bg-white/25 transition-colors whitespace-nowrap shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Cap
          </button>
        }
      />

      {isEditingCap && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-3.5">
          <span className="text-xs font-medium text-slate-700">
            Update Monthly University Study Cap (£)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="5"
              value={capDraft}
              onChange={(e) => setCapDraft(e.target.value)}
              className="font-mono-num h-9 w-28 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveCap}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      )}

      {/* Scope Toggle + 6 University Category Tiles */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: 'all', label: 'All University' },
                { id: 'monthly', label: 'Monthly Budget' },
                { id: 'separate', label: 'Separate / One-Off' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScopeFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  scopeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {subCatFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSubCatFilter('all')}
              className="text-xs font-medium text-teal-700 hover:text-teal-900 underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Show all categories
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {subCatTotals.map((sub) => {
            const active = subCatFilter === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSubCatFilter(active ? 'all' : sub.id)}
                className={`text-left rounded-xl border p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
                  active
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {sub.label}
                </p>
                <p className="font-mono-num mt-1.5 text-base font-bold text-slate-900">
                  {formatGBP(sub.amount)}
                </p>
                {showInr && config.gbpToInrRate > 0 && (
                  <p className="font-mono-num mt-0.5 text-[11px] text-slate-500">
                    {formatINR(sub.amount, config.gbpToInrRate)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <WeeklyBreakdown
        expenses={visibleExpenses}
        selectedWeek={selectedWeek}
        onSelectWeek={setSelectedWeek}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        mode="single"
        accentColorClass="bg-indigo-600"
      />

      <PostScrollFeed
        title="University Ledger"
        subtitle="Monthly study spend and separate tuition, visa, or equipment entries"
        expenses={visibleExpenses}
        selectedWeek={selectedWeek}
        onEditExpense={onEditExpense}
        onDeleteExpense={onDeleteExpense}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        emptyMessage="No university expenses for this filter yet."
      />
    </div>
  );
};
