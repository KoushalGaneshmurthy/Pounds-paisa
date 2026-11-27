import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Check } from 'lucide-react';
import { BudgetConfig, ExpenseItem } from '../../types/expense';
import { formatGBP, formatINR } from '../../utils/formatters';
import { BannerCard } from '../BannerCard';
import { PostScrollFeed } from '../PostScrollFeed';

interface CategorySlideProps {
  category: 'groceries' | 'travel';
  sectionIndex: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  expenses: ExpenseItem[];
  capGBP: number;
  config: BudgetConfig;
  showInr: boolean;
  supermarkets?: string[];
  onAddSupermarket?: (name: string) => void;
  onUpdateCap?: (newCap: number) => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
}

export const CategorySlide: React.FC<CategorySlideProps> = ({
  category,
  sectionIndex,
  title,
  subtitle,
  imageSrc,
  imageAlt,
  expenses,
  capGBP,
  config,
  showInr,
  supermarkets = [],
  onAddSupermarket,
  onUpdateCap,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [selectedSupermarket, setSelectedSupermarket] = useState<string | 'all'>('all');
  const [newStoreInput, setNewStoreInput] = useState('');
  const [isEditingCap, setIsEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState(String(capGBP));

  const categoryExpenses = useMemo(
    () => expenses.filter((e) => e.category === category),
    [expenses, category]
  );

  const visibleExpenses = useMemo(() => {
    if (category !== 'groceries' || selectedSupermarket === 'all') {
      return categoryExpenses;
    }
    return categoryExpenses.filter(
      (e) => e.merchant.toLowerCase() === selectedSupermarket.toLowerCase()
    );
  }, [categoryExpenses, category, selectedSupermarket]);

  const totalSpent = useMemo(
    () => categoryExpenses.reduce((s, e) => s + e.amountGBP, 0),
    [categoryExpenses]
  );

  const weeklyAvg = totalSpent / 4;
  const remaining = capGBP - totalSpent;

  const statusTone =
    capGBP <= 0
      ? 'good'
      : remaining < 0
        ? 'alert'
        : remaining < capGBP * 0.15
          ? 'warn'
          : 'good';

  const statusText =
    capGBP <= 0
      ? 'No monthly cap set · Use Edit Cap to set a limit'
      : remaining < 0
        ? `Over Cap · ${formatGBP(Math.abs(remaining))} above monthly cap`
        : `Within Cap · ${formatGBP(remaining)} remaining`;

  const supermarketTotals = useMemo(() => {
    if (category !== 'groceries') return [];
    const allNames = new Set(supermarkets);
    categoryExpenses.forEach((e) => allNames.add(e.merchant));
    return Array.from(allNames).map((name) => {
      const amt = categoryExpenses
        .filter((e) => e.merchant.toLowerCase() === name.toLowerCase())
        .reduce((s, e) => s + e.amountGBP, 0);
      return { name, amount: amt };
    });
  }, [category, supermarkets, categoryExpenses]);

  const merchantBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    categoryExpenses.forEach((e) => {
      map.set(e.merchant, (map.get(e.merchant) || 0) + e.amountGBP);
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [categoryExpenses]);

  const accentBarClass = category === 'groceries' ? 'bg-emerald-600' : 'bg-sky-600';

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newStoreInput.trim();
    if (!clean || !onAddSupermarket) return;
    onAddSupermarket(clean);
    setNewStoreInput('');
  };

  const handleSaveCap = () => {
    const parsed = parseFloat(capDraft);
    if (!Number.isNaN(parsed) && parsed >= 0 && onUpdateCap) {
      onUpdateCap(Math.round(parsed * 100) / 100);
    }
    setIsEditingCap(false);
  };

  return (
    <div className="space-y-5">
      <BannerCard
        imageSrc={imageSrc}
        imageAlt={imageAlt}
        sectionIndex={sectionIndex}
        title={title}
        subtitle={subtitle}
        primaryLabel="Monthly Spent"
        primaryAmountGBP={totalSpent}
        secondaryLabel="Weekly Avg"
        secondaryAmountGBP={weeklyAvg}
        limitLabel="Monthly Cap"
        limitAmountGBP={capGBP}
        statusText={statusText}
        statusTone={statusTone}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        actionButton={
          onUpdateCap ? (
            <button
              type="button"
              onClick={() => {
                setCapDraft(String(capGBP));
                setIsEditingCap((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 px-3.5 py-2.5 text-xs font-medium text-white hover:bg-white/25 transition-colors whitespace-nowrap shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Cap
            </button>
          ) : undefined
        }
      />

      {isEditingCap && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-3.5">
          <span className="text-xs font-medium text-slate-700">
            Update Monthly {category === 'groceries' ? 'Grocery' : 'Travel'} Cap (£)
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

      {category === 'groceries' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                My Supermarkets
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click a supermarket to filter or add any new store you shop at
              </p>
            </div>

            <form onSubmit={handleCreateStore} className="flex items-center gap-2">
              <input
                type="text"
                value={newStoreInput}
                onChange={(e) => setNewStoreInput(e.target.value)}
                placeholder="Add store name"
                aria-label="Add new supermarket"
                className="h-9 w-44 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Store
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {supermarketTotals.length === 0 ? (
              <p className="col-span-full py-2 text-xs text-slate-400">
                No stores added yet. Add a store above or log an expense.
              </p>
            ) : (
              supermarketTotals.map((store) => {
                const active =
                  selectedSupermarket.toLowerCase() === store.name.toLowerCase();
                return (
                  <button
                    key={store.name}
                    type="button"
                    onClick={() =>
                      setSelectedSupermarket(active ? 'all' : store.name)
                    }
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {store.name}
                    </p>
                    <p className="font-mono-num mt-1 text-sm font-bold text-slate-900">
                      {formatGBP(store.amount)}
                    </p>
                    {showInr && config.gbpToInrRate > 0 && (
                      <p className="font-mono-num text-[11px] text-slate-500">
                        {formatINR(store.amount, config.gbpToInrRate)}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {selectedSupermarket !== 'all' && (
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-slate-600">
                Showing entries from <strong className="text-slate-900">{selectedSupermarket}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedSupermarket('all')}
                className="font-medium text-teal-700 hover:text-teal-900 underline underline-offset-4"
              >
                Show all supermarkets
              </button>
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Where You Spent
          </h3>
          <div className="mt-4 space-y-3">
            {merchantBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No merchants logged yet.</p>
            ) : (
              merchantBreakdown.map((m) => {
                const share = totalSpent > 0 ? (m.amount / totalSpent) * 100 : 0;
                return (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-800 truncate">{m.name}</span>
                      <span className="font-mono-num text-slate-900 font-semibold shrink-0">
                        {formatGBP(m.amount)}
                        {showInr && config.gbpToInrRate > 0
                          ? ` · ${formatINR(m.amount, config.gbpToInrRate)}`
                          : ''}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${share}%` }}
                        className={`h-full ${accentBarClass}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <PostScrollFeed
        title={`${title} Feed`}
        subtitle={`${config.monthLabel} · Edit or remove entries anytime`}
        expenses={visibleExpenses}
        onEditExpense={onEditExpense}
        onDeleteExpense={onDeleteExpense}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        emptyMessage={`No ${category} entries for this filter yet.`}
      />
    </div>
  );
};
