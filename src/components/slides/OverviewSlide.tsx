import React, { useMemo } from 'react';
import {
  ArrowRight,
  SlidersHorizontal,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import {
  ArchivedMonth,
  BudgetConfig,
  ExpenseItem,
  IncomeItem,
} from '../../types/expense';
import { SLIDE_IMAGES } from '../../data/initialData';
import { formatGBP } from '../../utils/formatters';
import { BannerCard } from '../BannerCard';

interface OverviewSlideProps {
  expenses: ExpenseItem[];
  incomes?: IncomeItem[];
  lastMonthArchive?: ArchivedMonth;
  config: BudgetConfig;
  showInr: boolean;
  onEditExpense?: (expense: ExpenseItem) => void;
  onDeleteExpense?: (id: string) => void;
  onOpenIncomeModal?: (income?: IncomeItem) => void;
  onDeleteIncome?: (id: string) => void;
  onOpenLimitsModal: () => void;
  onOpenArchiveModal?: () => void;
  onJumpToSlide: (index: number) => void;
}

export const OverviewSlide: React.FC<OverviewSlideProps> = ({
  expenses,
  incomes = [],
  config,
  showInr,
  onOpenLimitsModal,
  onJumpToSlide,
}) => {
  const totals = useMemo(() => {
    const totalSpent = expenses.reduce((sum, e) => sum + e.amountGBP, 0);
    const totalSalary = incomes.reduce((sum, i) => sum + i.amountGBP, 0);
    const totalMonthlyFunds = config.monthlyAllowanceGBP + totalSalary;

    const groceries = expenses
      .filter((e) => e.category === 'groceries')
      .reduce((sum, e) => sum + e.amountGBP, 0);
    const travel = expenses
      .filter((e) => e.category === 'travel')
      .reduce((sum, e) => sum + e.amountGBP, 0);
    const others = expenses
      .filter((e) => e.category === 'others')
      .reduce((sum, e) => sum + e.amountGBP, 0);
    const universityMonthly = expenses
      .filter((e) => e.category === 'university')
      .reduce((sum, e) => sum + e.amountGBP, 0);

    const spendableCeiling = Math.max(0, totalMonthlyFunds - config.savingsGoalGBP);
    const safeRemaining = spendableCeiling - totalSpent;
    const totalRemainingWithSavings = totalMonthlyFunds - totalSpent;

    return {
      totalSpent,
      totalSalary,
      totalMonthlyFunds,
      groceries,
      travel,
      others,
      universityMonthly,
      spendableCeiling,
      safeRemaining,
      totalRemainingWithSavings,
    };
  }, [expenses, incomes, config]);

  const statusInfo = useMemo(() => {
    if (
      config.monthlyAllowanceGBP === 0 &&
      totals.totalSalary === 0 &&
      config.savingsGoalGBP === 0 &&
      totals.totalSpent === 0
    ) {
      return {
        tone: 'good' as const,
        bannerText: 'Blank ledger · Use Adjust Limits to set budget & savings',
        label: 'Ready to Configure',
      };
    }
    if (totals.safeRemaining < 0) {
      return {
        tone: 'alert' as const,
        bannerText: `Over Savings Floor · Dipping ${formatGBP(Math.abs(totals.safeRemaining))} into savings`,
        label: 'Savings Floor Breached',
      };
    }
    if (totals.safeRemaining < totals.spendableCeiling * 0.15) {
      return {
        tone: 'warn' as const,
        bannerText: `Tight Buffer · ${formatGBP(totals.safeRemaining)} left before £${config.savingsGoalGBP} savings limit`,
        label: 'Approaching Savings Limit',
      };
    }
    return {
      tone: 'good' as const,
      bannerText: `On Track · ${formatGBP(totals.safeRemaining)} safe buffer above £${config.savingsGoalGBP} savings`,
      label: 'Savings Protected',
    };
  }, [totals, config.monthlyAllowanceGBP, config.savingsGoalGBP]);

  const spentPctOfFunds = Math.min(
    100,
    totals.totalMonthlyFunds > 0
      ? (totals.totalSpent / totals.totalMonthlyFunds) * 100
      : 0
  );
  const savingsPctOfFunds = Math.min(
    100,
    totals.totalMonthlyFunds > 0
      ? (config.savingsGoalGBP / totals.totalMonthlyFunds) * 100
      : 0
  );

  const buckets = [
    {
      slideIndex: 2,
      name: 'Groceries',
      spent: totals.groceries,
      cap: config.groceriesCapGBP,
      barClass: 'bg-emerald-600',
    },
    {
      slideIndex: 3,
      name: 'Travel',
      spent: totals.travel,
      cap: config.travelCapGBP,
      barClass: 'bg-sky-600',
    },
    {
      slideIndex: 4,
      name: 'University',
      spent: totals.universityMonthly,
      cap: config.universityCapGBP,
      barClass: 'bg-indigo-600',
    },
    {
      slideIndex: 5,
      name: 'Others',
      spent: totals.others,
      cap: config.othersCapGBP,
      barClass: 'bg-amber-600',
    },
  ];

  return (
    <div className="space-y-5">
      <BannerCard
        imageSrc={SLIDE_IMAGES.overview}
        imageAlt="Historic London university street in morning mist"
        sectionIndex="Slide 01 of 06 · Overview"
        title={`${config.monthLabel} Budget`}
        subtitle="Active month living spend & macro overview."
        primaryLabel="Monthly Spent"
        primaryAmountGBP={totals.totalSpent}
        secondaryLabel="Total Funds"
        secondaryAmountGBP={totals.totalMonthlyFunds}
        limitLabel="Savings Protected"
        limitAmountGBP={Math.max(0, Math.min(config.savingsGoalGBP, totals.totalRemainingWithSavings))}
        statusText={statusInfo.bannerText}
        statusTone={statusInfo.tone}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        actionButton={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJumpToSlide(1)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500/25 border border-teal-300/40 backdrop-blur-md px-3.5 py-2.5 text-xs font-semibold text-teal-100 hover:bg-teal-500/40 transition-colors whitespace-nowrap shrink-0"
            >
              <BarChart3 className="h-3.5 w-3.5 text-teal-300" />
              Analytics
            </button>
            <button
              type="button"
              onClick={onOpenLimitsModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 px-3.5 py-2.5 text-xs font-medium text-white hover:bg-white/25 transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Adjust Limits
            </button>
          </div>
        }
      />

      {/* Savings Guardrail + 4 Section Quick-Jumps */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            {statusInfo.tone === 'good' ? (
              <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Monthly Savings Guardrail
                </h3>
                <span className="text-xs font-medium text-slate-500">
                  · {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Base {formatGBP(config.monthlyAllowanceGBP)} + Salary {formatGBP(totals.totalSalary)} ={' '}
                <span className="font-mono-num font-semibold text-slate-900">
                  {formatGBP(totals.totalMonthlyFunds)}
                </span>{' '}
                total funds ·{' '}
                <span className="font-mono-num font-semibold text-emerald-700">
                  {formatGBP(config.savingsGoalGBP)}
                </span>{' '}
                savings limit
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-500">Safe to Spend Left</span>
            <p
              className={`font-mono-num text-lg font-bold ${
                totals.safeRemaining < 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {formatGBP(totals.safeRemaining)}
            </p>
          </div>
        </div>

        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            style={{ width: `${spentPctOfFunds}%` }}
            className={`h-full transition-all duration-300 ${
              totals.safeRemaining < 0 ? 'bg-rose-600' : 'bg-slate-900'
            }`}
          />
          <div
            style={{ width: `${savingsPctOfFunds}%` }}
            title={`Protected savings zone: ${formatGBP(config.savingsGoalGBP)}`}
            className="absolute right-0 top-0 h-full bg-emerald-600/35 border-l-2 border-emerald-700"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          {buckets.map((b) => {
            const pct = b.cap > 0 ? Math.min(100, (b.spent / b.cap) * 100) : 0;
            const overCap = b.cap > 0 && b.spent > b.cap;
            return (
              <button
                key={b.name}
                type="button"
                onClick={() => onJumpToSlide(b.slideIndex)}
                className="group text-left rounded-xl border border-slate-200/80 p-4 hover:border-slate-400 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">{b.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-800 transition-colors" />
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono-num text-lg font-bold text-slate-900">
                    {formatGBP(b.spent)}
                  </span>
                  <span className="font-mono-num text-xs text-slate-500">
                    {b.cap > 0 ? `of ${formatGBP(b.cap)}` : 'No cap'}
                  </span>
                </div>

                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full transition-all duration-300 ${
                      overCap ? 'bg-rose-600' : b.barClass
                    }`}
                  />
                </div>

                <p className="mt-2 text-[11px] text-slate-500">
                  {b.cap <= 0
                    ? `No cap set · Slide ${b.slideIndex + 1}`
                    : overCap
                      ? `Over cap by ${formatGBP(b.spent - b.cap)}`
                      : `${formatGBP(b.cap - b.spent)} left · Slide ${b.slideIndex + 1}`}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
