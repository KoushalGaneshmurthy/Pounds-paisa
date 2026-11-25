import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IncomeItem } from '../types/expense';
import { formatINR } from '../utils/formatters';
import { fetchDailyGbpToInrRate } from '../utils/fxRate';

interface IncomeModalProps {
  isOpen: boolean;
  editingIncome?: IncomeItem | null;
  currentRate: number;
  onClose: () => void;
  onSave: (income: Omit<IncomeItem, 'id'>, existingId?: string) => void;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({
  isOpen,
  editingIncome,
  currentRate,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [amountGBP, setAmountGBP] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayRate, setDayRate] = useState(currentRate);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingIncome) {
      setTitle(editingIncome.title);
      setSource(editingIncome.source);
      setAmountGBP(String(editingIncome.amountGBP));
      setDate(editingIncome.date);
      setDayRate(editingIncome.rateAtEntry ?? currentRate);
    } else {
      setTitle('');
      setSource('');
      setAmountGBP('');
      setDate(new Date().toISOString().slice(0, 10));
      setDayRate(currentRate);
    }
  }, [isOpen, editingIncome, currentRate]);

  useEffect(() => {
    if (!isOpen || !date) return;
    let cancelled = false;
    fetchDailyGbpToInrRate(date).then((res) => {
      if (!cancelled && res) {
        setDayRate(res.rate);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, date]);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amountGBP) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title (e.g., Part-Time Café Shift).');
      return;
    }
    if (parsedAmount <= 0) {
      setError('Please enter an amount greater than £0.');
      return;
    }

    onSave(
      {
        title: title.trim(),
        source: source.trim() || 'Part-Time Work / Transfer',
        amountGBP: Math.round(parsedAmount * 100) / 100,
        date,
        rateAtEntry: dayRate > 0 ? dayRate : undefined,
      },
      editingIncome?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="income-modal-title"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 id="income-modal-title" className="font-display text-lg font-bold text-slate-900">
              {editingIncome ? 'Edit Salary / Income' : 'Add Part-Time Salary or Income'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adds directly to your available monthly pounds
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close salary modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="inc-title" className="block text-xs font-medium text-slate-700 mb-1.5">
              Salary / Earning Title
            </label>
            <input
              id="inc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Part-Time Café Shift"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="inc-source" className="block text-xs font-medium text-slate-700 mb-1.5">
              Employer / Source & Hours (optional)
            </label>
            <input
              id="inc-source"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Pret A Manger · 14 hrs"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="inc-amount" className="block text-xs font-medium text-slate-700 mb-1.5">
                Amount Earned (£)
              </label>
              <input
                id="inc-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amountGBP}
                onChange={(e) => setAmountGBP(e.target.value)}
                placeholder="e.g. 165.00"
                className="font-mono-num h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                required
              />
              {parsedAmount > 0 && dayRate > 0 && (
                <p className="font-mono-num mt-1 text-[11px] text-slate-500">
                  {formatINR(parsedAmount, dayRate)} (@ ₹{dayRate.toFixed(2)})
                </p>
              )}
            </div>

            <div>
              <label htmlFor="inc-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                Date Received
              </label>
              <input
                id="inc-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              {editingIncome ? 'Update Income' : 'Save Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
