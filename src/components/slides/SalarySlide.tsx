import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  HelpCircle,
  PiggyBank,
  Plus,
  Scale,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { BudgetConfig, ExpenseItem, IncomeItem } from '../../types/expense';
import { SLIDE_IMAGES } from '../../data/initialData';
import { formatGBP, formatINR, formatShortDate } from '../../utils/formatters';
import { BannerCard } from '../BannerCard';

interface SalarySlideProps {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  config: BudgetConfig;
  showInr: boolean;
  onSaveSalary: (data: Omit<IncomeItem, 'id'>, existingId?: string) => void;
  onDeleteSalary: (id: string) => void;
  onJumpToSlide: (index: number) => void;
}

export const SalarySlide: React.FC<SalarySlideProps> = ({
  incomes,
  expenses,
  config,
  showInr,
  onSaveSalary,
  onDeleteSalary,
  onJumpToSlide,
}) => {
  // Input states for the 2 primary fields: Hours & Total Pay
  const [hours, setHours] = useState('');
  const [totalPay, setTotalPay] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Computations
  const parsedHours = parseFloat(hours) || 0;
  const parsedPay = parseFloat(totalPay) || 0;
  const calculatedHourlyRate = parsedHours > 0 ? parsedPay / parsedHours : 0;

  // Aggregate metrics
  const totalEarnedGBP = useMemo(() => {
    return incomes.reduce((acc, inc) => acc + (inc.amountGBP || 0), 0);
  }, [incomes]);

  const totalHoursWorked = useMemo(() => {
    return incomes.reduce((acc, inc) => acc + (inc.hours || 0), 0);
  }, [incomes]);

  const overallHourlyRate = useMemo(() => {
    return totalHoursWorked > 0 ? totalEarnedGBP / totalHoursWorked : 0;
  }, [totalEarnedGBP, totalHoursWorked]);

  const totalSpentGBP = useMemo(() => {
    return expenses.reduce((acc, exp) => acc + (exp.amountGBP || 0), 0);
  }, [expenses]);

  // UK National Minimum/Living Wage baseline (as of 2024-2026: £11.44/hr for 21+)
  const UK_MINIMUM_WAGE = 11.44;

  // Student Visa weekly hour limit (20 hrs/week)
  const estimatedWeeklyHours = totalHoursWorked > 0 ? totalHoursWorked / 4 : 0;
  const visaWeeklyLimitPct = Math.min(100, (estimatedWeeklyHours / 20) * 100);

  // Spend coverage percentage
  const spendCoveragePct =
    totalSpentGBP > 0 ? Math.round((totalEarnedGBP / totalSpentGBP) * 100) : totalEarnedGBP > 0 ? 100 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (parsedHours <= 0) {
      setErrorMsg('Please enter hours worked (greater than 0).');
      return;
    }
    if (parsedPay <= 0) {
      setErrorMsg('Please enter total pay amount (greater than £0).');
      return;
    }

    onSaveSalary(
      {
        title: `Work Shift (${parsedHours}h)`,
        source: 'Salary / Part-Time',
        amountGBP: Math.round(parsedPay * 100) / 100,
        hours: Math.round(parsedHours * 10) / 10,
        date: date || new Date().toISOString().slice(0, 10),
        rateAtEntry: config.gbpToInrRate,
      },
      editingId || undefined
    );

    // Reset inputs
    setHours('');
    setTotalPay('');
    setEditingId(null);
  };

  const startEdit = (item: IncomeItem) => {
    setEditingId(item.id);
    setHours(String(item.hours || ''));
    setTotalPay(String(item.amountGBP));
    setDate(item.date || new Date().toISOString().slice(0, 10));
    setErrorMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHours('');
    setTotalPay('');
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6">
      {/* Slide Top Banner Card */}
      <BannerCard
        imageSrc={SLIDE_IMAGES.salary}
        imageAlt="Student working desk and salary management"
        sectionIndex="Slide 03 of 07 · Salary"
        title="Salary & Shifts"
        subtitle="Track hourly shifts, earnings & student work hours"
        primaryLabel="Total Earned"
        primaryAmountGBP={totalEarnedGBP}
        secondaryLabel="Total Hours"
        secondaryValueText={`${totalHoursWorked} hrs`}
        secondarySubtext={totalHoursWorked > 0 ? `${estimatedWeeklyHours.toFixed(1)} hrs/wk avg` : undefined}
        limitLabel="Avg Hourly Rate"
        limitAmountGBP={overallHourlyRate}
        statusText={
          overallHourlyRate >= UK_MINIMUM_WAGE
            ? `£${overallHourlyRate.toFixed(2)}/hr · At or Above UK Minimum Wage`
            : totalEarnedGBP > 0
            ? `£${overallHourlyRate.toFixed(2)}/hr · Logged Earnings`
            : 'Enter hours and total pay below'
        }
        statusTone={overallHourlyRate >= UK_MINIMUM_WAGE ? 'good' : 'warn'}
        showInr={showInr}
        gbpToInrRate={config.gbpToInrRate}
        actionButton={
          <button
            type="button"
            onClick={() => onJumpToSlide(1)}
            className="flex items-center gap-1.5 rounded-lg border border-teal-400/40 bg-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-500/30 transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Full Analytics</span>
          </button>
        }
      />

      {/* Main Content Grid: 2-Field Entry Form + Real-Time Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 2-Field Salary Entry Box */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {editingId ? 'Edit Salary Shift' : 'Log Salary Shift'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enter your shift hours and total pay
                  </p>
                </div>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Cancel
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Hours */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Hours Worked
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="e.g. 16 or 20"
                    className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-semibold text-slate-400">
                    hrs
                  </span>
                </div>
              </div>

              {/* Field 2: Total Pay */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Total Pay (£)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">
                    £
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={totalPay}
                    onChange={(e) => setTotalPay(e.target.value)}
                    placeholder="e.g. 184.00"
                    className="w-full pl-8 pr-12 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-semibold text-slate-400">
                    GBP
                  </span>
                </div>
                {showInr && parsedPay > 0 && config.gbpToInrRate > 0 && (
                  <p className="mt-1 text-right text-xs font-medium text-emerald-600">
                    ≈ {formatINR(parsedPay, config.gbpToInrRate)}
                  </p>
                )}
              </div>

              {/* Live Hourly Rate Indicator Box */}
              {calculatedHourlyRate > 0 && (
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-between text-xs animate-fade-in">
                  <span className="text-teal-800 font-semibold flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-teal-600" />
                    Calculated Hourly Rate:
                  </span>
                  <span className="text-sm font-bold text-teal-900">
                    £{calculatedHourlyRate.toFixed(2)} / hr
                  </span>
                </div>
              )}

              {/* Optional Date Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Shift Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-md shadow-teal-500/20 transition flex items-center justify-center gap-2 mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>{editingId ? 'Update Salary Entry' : 'Log Salary Entry'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Salary Analytics & Visa Guardrail */}
        <div className="lg:col-span-7 space-y-4">
          {/* Key Analytics Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Metric 1: Average Wage */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Avg Hourly Wage
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {overallHourlyRate > 0 ? `£${overallHourlyRate.toFixed(2)}` : '£0.00'}
                <span className="text-xs font-normal text-slate-500"> / hr</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span className="text-emerald-600 font-semibold">UK Min: £11.44</span>
              </p>
            </div>

            {/* Metric 2: Visa Limit Tracker */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Visa Limit (20h/wk)
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {estimatedWeeklyHours.toFixed(1)}
                <span className="text-xs font-normal text-slate-500"> hrs/wk avg</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    visaWeeklyLimitPct > 100 ? 'bg-rose-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, visaWeeklyLimitPct)}%` }}
                />
              </div>
            </div>

            {/* Metric 3: Spending Coverage */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Expense Coverage
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {spendCoveragePct}%
                <span className="text-xs font-normal text-slate-500"> covered</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                {totalEarnedGBP >= totalSpentGBP ? 'Surplus funds' : 'Partially covered'}
              </p>
            </div>
          </div>

          {/* Shift Entries History List */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-teal-600" />
                Logged Shifts &amp; Salary History ({incomes.length})
              </h4>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {formatGBP(totalEarnedGBP)}
              </span>
            </div>

            {incomes.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-medium text-slate-600">No salary entries logged yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Enter your hours and total pay in the form on the left to begin tracking.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                {incomes.map((item) => {
                  const shiftRate = item.hours && item.hours > 0 ? item.amountGBP / item.hours : 0;
                  return (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {item.hours ? `${item.hours} hrs worked` : item.title}
                          </span>
                          {shiftRate > 0 && (
                            <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                              £{shiftRate.toFixed(2)}/hr
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {formatShortDate(item.date)} · {item.source || 'Salary'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-900 block">
                            {formatGBP(item.amountGBP)}
                          </span>
                          {showInr && config.gbpToInrRate > 0 && (
                            <span className="text-[11px] font-medium text-slate-500 block">
                              {formatINR(item.amountGBP, item.rateAtEntry || config.gbpToInrRate)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition"
                            title="Edit entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSalary(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
