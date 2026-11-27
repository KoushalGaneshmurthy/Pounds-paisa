import React, { useMemo, useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { BudgetConfig, ExpenseItem } from '../../types/expense';
import { SLIDE_IMAGES } from '../../data/initialData';
import { formatGBP } from '../../utils/formatters';
import { BannerCard } from '../BannerCard';
import { PostScrollFeed } from '../PostScrollFeed';

interface OthersSlideProps {
  expenses: ExpenseItem[];
  config: BudgetConfig;
  showInr: boolean;
  onUpdateCap: (newCap: number) => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
}

export const OthersSlide: React.FC<OthersSlideProps> = ({
  expenses,
  config,
  showInr,
  onUpdateCap,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [isEditingCap, setIsEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState(String(config.othersCapGBP));

  const othersExpenses = useMemo(
    () => expenses.filter((e) => e.category === 'others'),
    [expenses]
  );

  const totalSpent = useMemo(
    () => othersExpenses.reduce((s, e) => s + e.amountGBP, 0),
    [othersExpenses]
  );

  const remaining = config.othersCapGBP - totalSpent;
  const statusTone =
    config.othersCapGBP <= 0
      ? 'good'
      : remaining < 0
        ? 'alert'
        : remaining < config.othersCapGBP * 0.12
          ? 'warn'
          : 'good';

  const statusText =
    config.othersCapGBP <= 0
      ? 'No monthly cap set · Use Edit Cap to set a limit'
      : remaining < 0
        ? `Over Cap · ${formatGBP(Math.abs(remaining))} above monthly cap`
        : `Within Cap · ${formatGBP(remaining)} remaining`;

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
        imageSrc={SLIDE_IMAGES.others}
        imageAlt="Tidy UK student study desk overlooking misty British rooftops"
        sectionIndex="Slide 05 of 05 · Others"
        title="Others"
        subtitle="Rent, SIM & bills, dining out, laundry, and other miscellaneous expenses."
        primaryLabel="Total Others"
        primaryAmountGBP={totalSpent}
        limitLabel="Monthly Cap"
        limitAmountGBP={config.othersCapGBP}
        statusText={statusText}
        statusTone={statusTone}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        actionButton={
          <button
            type="button"
            onClick={() => {
              setCapDraft(String(config.othersCapGBP));
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
            Update Monthly Others Cap (£)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="10"
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

      <PostScrollFeed
        title="Others Feed"
        subtitle={`${config.monthLabel} · All other expenses`}
        expenses={othersExpenses}
        onEditExpense={onEditExpense}
        onDeleteExpense={onDeleteExpense}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        emptyMessage="No entries in this category yet."
      />
    </div>
  );
};
