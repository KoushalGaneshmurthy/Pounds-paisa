import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  ShoppingBag,
  Train,
  GraduationCap,
  Layers,
  ArrowUpRight,
  Receipt,
  Wallet,
  Clock,
} from 'lucide-react';
import {
  ArchivedMonth,
  BudgetConfig,
  ExpenseCategory,
  ExpenseItem,
  IncomeItem,
} from '../../types/expense';
import { SLIDE_IMAGES } from '../../data/initialData';
import { formatGBP, formatINR, formatShortDate } from '../../utils/formatters';
import { BannerCard } from '../BannerCard';

interface AnalyticsSlideProps {
  expenses: ExpenseItem[];
  incomes?: IncomeItem[];
  archives?: ArchivedMonth[];
  config: BudgetConfig;
  showInr: boolean;
  onJumpToSlide: (index: number) => void;
}

type TimeScope = 'month' | 'last30' | 'all';

interface CategoryMetric {
  id: ExpenseCategory;
  label: string;
  amount: number;
  pct: number;
  color: string;
  bgColor: string;
  textColor: string;
  icon: React.ComponentType<{ className?: string }>;
  slideIndex: number;
  cap: number;
  count: number;
}

export const AnalyticsSlide: React.FC<AnalyticsSlideProps> = ({
  expenses,
  incomes = [],
  archives = [],
  config,
  showInr,
  onJumpToSlide,
}) => {
  const [timeScope, setTimeScope] = useState<TimeScope>('month');
  const [hoveredDay, setHoveredDay] = useState<{ date: string; amount: number; count: number } | null>(null);

  // Determine active dataset based on time scope
  const scopedExpenses = useMemo(() => {
    if (timeScope === 'all') {
      const archivedExpenses = archives.flatMap((a) => a.expenses);
      return [...expenses, ...archivedExpenses];
    }
    if (timeScope === 'last30') {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return expenses.filter((e) => {
        const d = new Date(`${e.date}T00:00:00`);
        return !Number.isNaN(d.getTime()) && d >= cutoff;
      });
    }
    return expenses;
  }, [expenses, archives, timeScope]);

  // Financial totals
  const metrics = useMemo(() => {
    const totalSpent = scopedExpenses.reduce((sum, e) => sum + e.amountGBP, 0);
    const totalSalary = incomes.reduce((sum, i) => sum + i.amountGBP, 0);
    const totalFunds = config.monthlyAllowanceGBP + totalSalary;
    const spendableCeiling = Math.max(0, totalFunds - config.savingsGoalGBP);
    const safeRemaining = spendableCeiling - totalSpent;

    // Daily burn calculations
    const today = new Date();
    const currentDayOfMonth = Math.max(1, today.getDate());
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(0, daysInCurrentMonth - currentDayOfMonth);

    const activeDaysCount = timeScope === 'month' ? currentDayOfMonth : 30;
    const dailyAverage = activeDaysCount > 0 ? totalSpent / activeDaysCount : 0;
    const projectedMonthEnd =
      timeScope === 'month'
        ? totalSpent + dailyAverage * daysRemaining
        : totalSpent;

    // Category grouping
    const catMap: Record<ExpenseCategory, number> = {
      groceries: 0,
      travel: 0,
      university: 0,
      others: 0,
    };
    const catCountMap: Record<ExpenseCategory, number> = {
      groceries: 0,
      travel: 0,
      university: 0,
      others: 0,
    };

    scopedExpenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amountGBP;
      catCountMap[e.category] = (catCountMap[e.category] || 0) + 1;
    });

    const categories: CategoryMetric[] = [
      {
        id: 'groceries',
        label: 'Groceries',
        amount: catMap.groceries,
        pct: totalSpent > 0 ? Math.round((catMap.groceries / totalSpent) * 100) : 0,
        color: '#059669', // emerald-600
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        icon: ShoppingBag,
        slideIndex: 3,
        cap: config.groceriesCapGBP,
        count: catCountMap.groceries,
      },
      {
        id: 'travel',
        label: 'Travel',
        amount: catMap.travel,
        pct: totalSpent > 0 ? Math.round((catMap.travel / totalSpent) * 100) : 0,
        color: '#0284c7', // sky-600
        bgColor: 'bg-sky-50',
        textColor: 'text-sky-700',
        icon: Train,
        slideIndex: 4,
        cap: config.travelCapGBP,
        count: catCountMap.travel,
      },
      {
        id: 'university',
        label: 'University',
        amount: catMap.university,
        pct: totalSpent > 0 ? Math.round((catMap.university / totalSpent) * 100) : 0,
        color: '#4f46e5', // indigo-600
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-700',
        icon: GraduationCap,
        slideIndex: 5,
        cap: config.universityCapGBP,
        count: catCountMap.university,
      },
      {
        id: 'others',
        label: 'Others',
        amount: catMap.others,
        pct: totalSpent > 0 ? Math.round((catMap.others / totalSpent) * 100) : 0,
        color: '#d97706', // amber-600
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        icon: Layers,
        slideIndex: 6,
        cap: config.othersCapGBP,
        count: catCountMap.others,
      },
    ];

    // Find top category
    const topCategory = [...categories].sort((a, b) => b.amount - a.amount)[0];

    // Status tone
    const statusTone: 'good' | 'warn' | 'alert' =
      safeRemaining < 0
        ? 'alert'
        : safeRemaining < spendableCeiling * 0.15
          ? 'warn'
          : 'good';

    const statusText =
      safeRemaining < 0
        ? `Over Spendable Ceiling · Projected £${Math.round(projectedMonthEnd)} by month-end`
        : safeRemaining < spendableCeiling * 0.15
          ? `Tight Pacing · Burn rate £${dailyAverage.toFixed(1)}/day · £${Math.round(safeRemaining)} safe buffer`
          : `Healthy Velocity · Burn rate £${dailyAverage.toFixed(1)}/day · Savings floor secure`;

    return {
      totalSpent,
      totalFunds,
      spendableCeiling,
      safeRemaining,
      dailyAverage,
      projectedMonthEnd,
      daysRemaining,
      currentDayOfMonth,
      daysInCurrentMonth,
      categories,
      topCategory,
      statusTone,
      statusText,
      txCount: scopedExpenses.length,
      avgTx: scopedExpenses.length > 0 ? totalSpent / scopedExpenses.length : 0,
    };
  }, [scopedExpenses, incomes, config, timeScope]);

  // Daily spend distribution for charts
  const dailyDistribution = useMemo(() => {
    const dayMap: Record<string, { amount: number; count: number; date: string }> = {};
    scopedExpenses.forEach((e) => {
      if (!e.date) return;
      if (!dayMap[e.date]) {
        dayMap[e.date] = { amount: 0, count: 0, date: e.date };
      }
      dayMap[e.date].amount += e.amountGBP;
      dayMap[e.date].count += 1;
    });

    const entries = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
    const maxAmount = entries.reduce((max, d) => Math.max(max, d.amount), 0);
    const peakDay = entries.reduce<{ date: string; amount: number } | null>(
      (acc, d) => (!acc || d.amount > acc.amount ? { date: d.date, amount: d.amount } : acc),
      null
    );

    // Weekday vs Weekend breakdown
    let weekdaySum = 0;
    let weekendSum = 0;
    scopedExpenses.forEach((e) => {
      const d = new Date(`${e.date}T00:00:00`);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendSum += e.amountGBP;
      } else {
        weekdaySum += e.amountGBP;
      }
    });
    const totalDaySum = weekdaySum + weekendSum;

    return {
      entries,
      maxAmount: Math.max(maxAmount, 10),
      peakDay,
      weekdayPct: totalDaySum > 0 ? Math.round((weekdaySum / totalDaySum) * 100) : 0,
      weekendPct: totalDaySum > 0 ? Math.round((weekendSum / totalDaySum) * 100) : 0,
    };
  }, [scopedExpenses]);

  // Store ranking for Groceries
  const groceryStores = useMemo(() => {
    const map: Record<string, number> = {};
    scopedExpenses
      .filter((e) => e.category === 'groceries')
      .forEach((e) => {
        const store = e.merchant?.trim() || 'Other Stores';
        map[store] = (map[store] || 0) + e.amountGBP;
      });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedExpenses]);

  // Travel transportation types breakdown
  const travelModes = useMemo(() => {
    const map: Record<string, number> = {};
    scopedExpenses
      .filter((e) => e.category === 'travel')
      .forEach((e) => {
        const mode = e.merchant?.trim() || 'Transit';
        map[mode] = (map[mode] || 0) + e.amountGBP;
      });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedExpenses]);

  // Top 5 Largest Transactions
  const topTransactions = useMemo(() => {
    return [...scopedExpenses]
      .sort((a, b) => b.amountGBP - a.amountGBP)
      .slice(0, 5);
  }, [scopedExpenses]);

  // Donut SVG parameters
  const donutData = useMemo(() => {
    const total = metrics.totalSpent;
    if (total <= 0) return [];
    let cumulativeAngle = 0;
    return metrics.categories
      .filter((c) => c.amount > 0)
      .map((c) => {
        const sliceAngle = (c.amount / total) * 360;
        const startAngle = cumulativeAngle;
        cumulativeAngle += sliceAngle;
        return {
          ...c,
          startAngle,
          endAngle: cumulativeAngle,
          sliceAngle,
        };
      });
  }, [metrics]);

  return (
    <div className="space-y-5">
      {/* Hero Banner */}
      <BannerCard
        imageSrc={SLIDE_IMAGES.overview}
        imageAlt="Modern city financial analytics skyline"
        sectionIndex="Slide 02 of 07 · Analytics"
        title="Spend Analytics & Intelligence"
        subtitle="Holistic spending velocity, category distribution, merchant metrics, and dual-currency intelligence."
        primaryLabel="Analyzed Spend"
        primaryAmountGBP={metrics.totalSpent}
        secondaryLabel="Daily Burn Rate"
        secondaryAmountGBP={metrics.dailyAverage}
        limitLabel="Month-End Forecast"
        limitAmountGBP={metrics.projectedMonthEnd}
        statusText={metrics.statusText}
        statusTone={metrics.statusTone}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        actionButton={
          <div className="flex items-center gap-1 rounded-xl bg-white/15 p-1 border border-white/20 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setTimeScope('month')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                timeScope === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-white hover:text-teal-200'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setTimeScope('last30')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                timeScope === 'last30' ? 'bg-white text-slate-900 shadow-sm' : 'text-white hover:text-teal-200'
              }`}
            >
              Last 30 Days
            </button>
            {archives.length > 0 && (
              <button
                type="button"
                onClick={() => setTimeScope('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  timeScope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-white hover:text-teal-200'
                }`}
              >
                All Time
              </button>
            )}
          </div>
        }
      />

      {/* KPI Scorecard Strip (4 Cards) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Spending Pace */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Monthly Fund Usage</span>
            <TrendingUp className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono-num text-2xl font-bold text-slate-900">
              {formatGBP(metrics.totalSpent)}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {metrics.totalFunds > 0
                ? `${Math.round((metrics.totalSpent / metrics.totalFunds) * 100)}% used`
                : 'of £0'}
            </span>
          </div>
          {showInr && config.gbpToInrRate > 0 && (
            <p className="font-mono-num mt-1 text-xs text-slate-500">
              {formatINR(metrics.totalSpent, config.gbpToInrRate)}
            </p>
          )}
          <p className="mt-2.5 text-[11px] text-slate-600">
            {metrics.safeRemaining >= 0
              ? `${formatGBP(metrics.safeRemaining)} remaining before savings limit`
              : `Breached savings zone by ${formatGBP(Math.abs(metrics.safeRemaining))}`}
          </p>
        </div>

        {/* Metric 2: Daily Burn Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Daily Burn Velocity</span>
            <Clock className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono-num text-2xl font-bold text-slate-900">
              {formatGBP(metrics.dailyAverage)}
            </span>
            <span className="text-xs font-semibold text-slate-500">/ day</span>
          </div>
          {showInr && config.gbpToInrRate > 0 && (
            <p className="font-mono-num mt-1 text-xs text-slate-500">
              ~{formatINR(metrics.dailyAverage, config.gbpToInrRate)} / day
            </p>
          )}
          <p className="mt-2.5 text-[11px] text-slate-600">
            {metrics.daysRemaining > 0
              ? `${metrics.daysRemaining} days left in month · Forecast ${formatGBP(metrics.projectedMonthEnd)}`
              : 'End of active cycle'}
          </p>
        </div>

        {/* Metric 3: Top Outlay Category */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Primary Expense Category</span>
            <PieIcon className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono-num text-2xl font-bold text-slate-900">
              {metrics.topCategory?.amount > 0 ? metrics.topCategory.label : 'None'}
            </span>
            {metrics.topCategory?.amount > 0 && (
              <span className="text-xs font-semibold text-indigo-600">
                {metrics.topCategory.pct}%
              </span>
            )}
          </div>
          <p className="font-mono-num mt-1 text-xs text-slate-500">
            {formatGBP(metrics.topCategory?.amount || 0)} total logged
          </p>
          <button
            type="button"
            onClick={() => onJumpToSlide(metrics.topCategory?.slideIndex || 1)}
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
          >
            Inspect category <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Metric 4: Transaction Velocity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Transaction Velocity</span>
            <Receipt className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono-num text-2xl font-bold text-slate-900">
              {metrics.txCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">entries</span>
          </div>
          <p className="font-mono-num mt-1 text-xs text-slate-500">
            Avg {formatGBP(metrics.avgTx)} per transaction
          </p>
          <p className="mt-2.5 text-[11px] text-slate-600">
            {dailyDistribution.weekdayPct}% Weekday · {dailyDistribution.weekendPct}% Weekend
          </p>
        </div>
      </div>

      {/* Main Visuals Grid: Category Distribution Donut + Daily Velocity Histogram */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Category Distribution & Visual Donut Chart */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Category Distribution
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Relative share of living expenditure
              </p>
            </div>
            <span className="font-mono-num text-xs font-bold text-slate-700 bg-slate-100 rounded-lg px-2.5 py-1">
              {formatGBP(metrics.totalSpent)}
            </span>
          </div>

          {metrics.totalSpent === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <PieIcon className="h-10 w-10 text-slate-300 stroke-[1.5]" />
              <p className="mt-2.5 text-xs text-slate-500 font-medium">No expenses logged yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Log expenses across Groceries, Travel, University or Others to see analytics.
              </p>
            </div>
          ) : (
            <>
              {/* Custom SVG Donut */}
              <div className="relative flex items-center justify-center py-2">
                <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90 transform">
                  {donutData.map((slice) => {
                    const radius = 62;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDasharray = `${(slice.sliceAngle / 360) * circumference} ${circumference}`;
                    const strokeDashoffset = -((slice.startAngle / 360) * circumference);
                    return (
                      <circle
                        key={slice.id}
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="20"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500 hover:opacity-85"
                      />
                    );
                  })}
                </svg>
                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    Total Spend
                  </span>
                  <span className="font-mono-num text-base font-bold text-slate-900 mt-0.5">
                    {formatGBP(metrics.totalSpent)}
                  </span>
                  {showInr && config.gbpToInrRate > 0 && (
                    <span className="font-mono-num text-[11px] text-slate-500">
                      {formatINR(metrics.totalSpent, config.gbpToInrRate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Category Breakdown Cards */}
              <div className="space-y-2.5 pt-1">
                {metrics.categories.map((cat) => {
                  const Icon = cat.icon;
                  const capUsedPct = cat.cap > 0 ? Math.round((cat.amount / cat.cap) * 100) : 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onJumpToSlide(cat.slideIndex)}
                      className="group w-full flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:border-slate-300 hover:bg-slate-50/70 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-900">
                              {cat.label}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              ({cat.count} {cat.count === 1 ? 'tx' : 'txs'})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                style={{ width: `${Math.min(100, cat.pct)}%`, backgroundColor: cat.color }}
                                className="h-full rounded-full"
                              />
                            </div>
                            <span className="text-[11px] font-medium text-slate-500">
                              {cat.pct}% of spend
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono-num text-sm font-bold text-slate-900">
                          {formatGBP(cat.amount)}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {cat.cap > 0 ? `${capUsedPct}% of cap` : 'No cap'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Right: Daily Spending Velocity & Activity Histogram */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Spending Velocity Timeline
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily expenditure patterns &amp; peak spending days
                </p>
              </div>

              {dailyDistribution.peakDay && (
                <div className="text-right">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                    Peak Spend Day
                  </span>
                  <p className="font-mono-num text-xs font-bold text-slate-900">
                    {formatShortDate(dailyDistribution.peakDay.date)} · {formatGBP(dailyDistribution.peakDay.amount)}
                  </p>
                </div>
              )}
            </div>

            {/* Daily Histogram */}
            {dailyDistribution.entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                <p className="mt-2.5 text-xs text-slate-500 font-medium">No activity in this time window</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Add transactions to reveal your daily expenditure rhythm.
                </p>
              </div>
            ) : (
              <div className="pt-5 space-y-4">
                {/* SVG Bar Chart */}
                <div className="relative h-44 w-full flex items-end gap-1.5 sm:gap-2 px-1">
                  {dailyDistribution.entries.map((day) => {
                    const heightPct = Math.max(8, Math.min(100, (day.amount / dailyDistribution.maxAmount) * 100));
                    const isPeak = dailyDistribution.peakDay?.date === day.date;
                    const isHovered = hoveredDay?.date === day.date;
                    return (
                      <div
                        key={day.date}
                        className="group relative flex-1 flex flex-col items-center h-full justify-end"
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 cursor-pointer ${
                            isPeak
                              ? 'bg-teal-600 group-hover:bg-teal-500'
                              : isHovered
                                ? 'bg-slate-800'
                                : 'bg-slate-200 group-hover:bg-slate-400'
                          }`}
                        />
                        <span className="mt-2 text-[10px] text-slate-400 font-mono-num truncate w-full text-center">
                          {day.date.split('-')[2]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Hover / Active Day Detail Tooltip */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 min-h-[50px] flex items-center justify-between">
                  {hoveredDay ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-teal-700 shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-slate-900">
                            {formatShortDate(hoveredDay.date)}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">
                            ({hoveredDay.count} {hoveredDay.count === 1 ? 'transaction' : 'transactions'})
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono-num text-sm font-bold text-slate-900">
                          {formatGBP(hoveredDay.amount)}
                        </span>
                        {showInr && config.gbpToInrRate > 0 && (
                          <span className="font-mono-num ml-2 text-xs text-slate-500">
                            {formatINR(hoveredDay.amount, config.gbpToInrRate)}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                      <span>Hover or tap any day column above to inspect exact spend &amp; transaction count.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Weekday vs Weekend Comparison Strip */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
              <span>Weekday Spend: <strong>{dailyDistribution.weekdayPct}%</strong></span>
              <span>Weekend Spend: <strong>{dailyDistribution.weekendPct}%</strong></span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 flex">
              <div
                style={{ width: `${dailyDistribution.weekdayPct}%` }}
                className="h-full bg-teal-600"
                title={`Weekday spend: ${dailyDistribution.weekdayPct}%`}
              />
              <div
                style={{ width: `${dailyDistribution.weekendPct}%` }}
                className="h-full bg-sky-500"
                title={`Weekend spend: ${dailyDistribution.weekendPct}%`}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Category Deep Dives (Groceries Stores & Travel Modes) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Groceries Store Spend Breakdown */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Groceries Spend by Store
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToSlide(2)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-0.5"
            >
              Open Groceries <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {groceryStores.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              No grocery expenses logged yet.
            </p>
          ) : (
            <div className="space-y-3">
              {groceryStores.slice(0, 5).map((store) => {
                const totalGroc = metrics.categories.find((c) => c.id === 'groceries')?.amount || 1;
                const share = Math.round((store.amount / totalGroc) * 100);
                return (
                  <div key={store.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{store.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-bold text-slate-900">
                          {formatGBP(store.amount)}
                        </span>
                        <span className="text-[11px] text-slate-400">({share}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${share}%` }}
                        className="h-full rounded-full bg-emerald-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Travel Transportation Mode Breakdown */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Train className="h-4 w-4 text-sky-600" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Travel Spend by Transport Mode
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToSlide(3)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-0.5"
            >
              Open Travel <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {travelModes.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              No travel expenses logged yet.
            </p>
          ) : (
            <div className="space-y-3">
              {travelModes.slice(0, 5).map((mode) => {
                const totalTravel = metrics.categories.find((c) => c.id === 'travel')?.amount || 1;
                const share = Math.round((mode.amount / totalTravel) * 100);
                return (
                  <div key={mode.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{mode.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-bold text-slate-900">
                          {formatGBP(mode.amount)}
                        </span>
                        <span className="text-[11px] text-slate-400">({share}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${share}%` }}
                        className="h-full rounded-full bg-sky-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Top 5 Biggest Single Outlays */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Top 5 Largest Outlays
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Single largest expenditures logged in this scope
            </p>
          </div>
          <Wallet className="h-4 w-4 text-slate-400" />
        </div>

        {topTransactions.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No expenditures available to rank.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {topTransactions.map((tx, idx) => {
              const catMeta = metrics.categories.find((c) => c.id === tx.category);
              return (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 font-mono-num shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {tx.title || tx.merchant || 'Expense'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${catMeta?.color}15`,
                            color: catMeta?.color,
                          }}
                        >
                          {catMeta?.label}
                        </span>
                        <span>· {formatShortDate(tx.date)}</span>
                        {tx.location && <span className="truncate">· {tx.location}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <p className="font-mono-num text-sm font-bold text-slate-900">
                      {formatGBP(tx.amountGBP)}
                    </p>
                    {showInr && config.gbpToInrRate > 0 && (
                      <p className="font-mono-num text-[11px] text-slate-500">
                        {formatINR(tx.amountGBP, config.gbpToInrRate)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Automated Financial Intelligence & Diagnostics */}
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-[#0A222E] p-5 sm:p-6 text-white space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-400" />
          <h3 className="font-display text-base font-semibold text-white">
            Smart Budget Diagnostics
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Savings Shield</span>
            </div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              Target savings is{' '}
              <strong className="text-white">{formatGBP(config.savingsGoalGBP)}</strong>. Currently{' '}
              {metrics.safeRemaining >= 0 ? (
                <span className="text-emerald-300 font-semibold">100% protected</span>
              ) : (
                <span className="text-rose-300 font-semibold">
                  dipping {formatGBP(Math.abs(metrics.safeRemaining))} into savings
                </span>
              )}.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
              <Clock className="h-3.5 w-3.5" />
              <span>Pacing &amp; Burn Rate</span>
            </div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              At your current burn rate of{' '}
              <strong className="text-white">{formatGBP(metrics.dailyAverage)}/day</strong>, month-end spend is estimated at{' '}
              <strong className="text-white">{formatGBP(metrics.projectedMonthEnd)}</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Currency Valuation</span>
            </div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              Live conversion rate is{' '}
              <strong className="text-white">₹{config.gbpToInrRate.toFixed(2)}/£</strong>. Total spend translates to{' '}
              <strong className="text-white">
                {formatINR(metrics.totalSpent, config.gbpToInrRate)}
              </strong>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
