import React, { useEffect, useState } from 'react';
import { X, Plus, Camera } from 'lucide-react';
import {
  ExpenseCategory,
  ExpenseItem,
  OtherSubCategory,
  UniversityScope,
  UniversitySubCategory,
  WeekNumber,
} from '../types/expense';
import {
  OTHER_SUBCATEGORIES,
  UNIVERSITY_SUBCATEGORIES,
} from '../data/initialData';
import { formatINR } from '../utils/formatters';
import { fetchDailyGbpToInrRate } from '../utils/fxRate';

interface AddExpenseModalProps {
  isOpen: boolean;
  defaultCategory: ExpenseCategory;
  defaultSupermarket?: string;
  editingExpense?: ExpenseItem | null;
  supermarkets: string[];
  currentRate: number;
  onAddSupermarket: (name: string) => void;
  onSwitchToScanner?: () => void;
  onClose: () => void;
  onSave: (expense: Omit<ExpenseItem, 'id'>, existingId?: string) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  defaultCategory,
  defaultSupermarket,
  editingExpense,
  supermarkets,
  currentRate,
  onAddSupermarket,
  onSwitchToScanner,
  onClose,
  onSave,
}) => {
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(defaultCategory);
  const [subCategory, setSubCategory] = useState<OtherSubCategory>('dining_coffee');
  const [universityScope, setUniversityScope] = useState<UniversityScope>('monthly');
  const [universitySubCategory, setUniversitySubCategory] =
    useState<UniversitySubCategory>('books_printing');
  const [amountGBP, setAmountGBP] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [dayRate, setDayRate] = useState(currentRate);
  const [newSupermarketName, setNewSupermarketName] = useState('');
  const [showNewSupermarket, setShowNewSupermarket] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setShowNewSupermarket(false);
    setNewSupermarketName('');

    if (editingExpense) {
      setMerchant(editingExpense.merchant);
      setCategory(editingExpense.category);
      setSubCategory(editingExpense.subCategory ?? 'dining_coffee');
      setUniversityScope(editingExpense.universityScope ?? 'monthly');
      setUniversitySubCategory(editingExpense.universitySubCategory ?? 'books_printing');
      setAmountGBP(String(editingExpense.amountGBP));
      setDate(editingExpense.date);
      setNotes(editingExpense.notes ?? '');
      setDayRate(editingExpense.rateAtEntry ?? currentRate);
    } else {
      setCategory(defaultCategory);
      setMerchant(
        defaultCategory === 'groceries'
          ? defaultSupermarket || supermarkets[0] || 'Aldi'
          : ''
      );
      setSubCategory('dining_coffee');
      setUniversityScope('monthly');
      setUniversitySubCategory('books_printing');
      setAmountGBP('');
      const todayIso = new Date().toISOString().slice(0, 10);
      setDate(todayIso);
      setNotes('');
      setDayRate(currentRate);
    }
  }, [isOpen, editingExpense, defaultCategory, defaultSupermarket, supermarkets, currentRate]);

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

  const handleCreateSupermarket = () => {
    const clean = newSupermarketName.trim();
    if (!clean) return;
    onAddSupermarket(clean);
    setMerchant(clean);
    setNewSupermarketName('');
    setShowNewSupermarket(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant.trim()) {
      setError('Please enter or choose where you spent.');
      return;
    }
    if (parsedAmount <= 0) {
      setError('Please enter a valid pound amount greater than £0.');
      return;
    }

    const dayNum = date ? new Date(date).getDate() : new Date().getDate();
    const computedWeek: WeekNumber =
      dayNum <= 7 ? 1 : dayNum <= 14 ? 2 : dayNum <= 21 ? 3 : 4;

    onSave(
      {
        title: merchant.trim(),
        merchant: merchant.trim(),
        location: '',
        category,
        subCategory: category === 'others' ? subCategory : undefined,
        universityScope: category === 'university' ? universityScope : undefined,
        universitySubCategory:
          category === 'university' ? universitySubCategory : undefined,
        amountGBP: Math.round(parsedAmount * 100) / 100,
        paymentMethod: editingExpense?.paymentMethod || 'Monzo Debit',
        week: editingExpense?.week || computedWeek,
        date,
        notes: notes.trim() || undefined,
        rateAtEntry: dayRate > 0 ? dayRate : undefined,
      },
      editingExpense?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-expense-title"
    >
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 id="add-expense-title" className="font-display text-lg font-bold text-slate-900">
              {editingExpense ? 'Edit Expense' : 'Log Expense'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose where this expense goes{dayRate > 0 ? ` · £1 = ₹${dayRate.toFixed(2)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!editingExpense && onSwitchToScanner && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToScanner();
            }}
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-teal-700/25 bg-teal-50/70 px-4 py-2.5 text-left text-xs font-medium text-teal-950 hover:bg-teal-50 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <Camera className="h-4 w-4 text-teal-700 shrink-0" />
              <span>Have a receipt photo? Scan Tesco, Aldi, or any UK receipt</span>
            </span>
            <span className="font-semibold text-teal-800 shrink-0">Scan →</span>
          </button>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Where does it go? 4-way Destination Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Where should this expense go?
            </label>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
              {(
                [
                  { id: 'groceries', label: 'Groceries' },
                  { id: 'travel', label: 'Travel' },
                  { id: 'university', label: 'University' },
                  { id: 'others', label: 'Others' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    if (cat.id === 'groceries' && !supermarkets.includes(merchant)) {
                      setMerchant(supermarkets[0] || 'Aldi');
                    }
                  }}
                  className={`rounded-lg py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    category === cat.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {category === 'others' && (
            <div>
              <label htmlFor="sub-cat" className="block text-xs font-medium text-slate-700 mb-1.5">
                Other Bucket
              </label>
              <select
                id="sub-cat"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value as OtherSubCategory)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                {OTHER_SUBCATEGORIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'university' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="uni-sub-cat" className="block text-xs font-medium text-slate-700 mb-1.5">
                  University Category
                </label>
                <select
                  id="uni-sub-cat"
                  value={universitySubCategory}
                  onChange={(e) =>
                    setUniversitySubCategory(e.target.value as UniversitySubCategory)
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                >
                  {UNIVERSITY_SUBCATEGORIES.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Budget Scope
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setUniversityScope('monthly')}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      universityScope === 'monthly'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setUniversityScope('separate')}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      universityScope === 'separate'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Separate / One-Off
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label htmlFor="exp-amount" className="block text-xs font-medium text-slate-700 mb-1.5">
              How Much (£)
            </label>
            <input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amountGBP}
              onChange={(e) => setAmountGBP(e.target.value)}
              placeholder="e.g. 24.50"
              className="font-mono-num h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              required
            />
            {parsedAmount > 0 && dayRate > 0 && (
              <p className="font-mono-num mt-1 text-[11px] text-slate-500">
                {formatINR(parsedAmount, dayRate)}
              </p>
            )}
          </div>

          {category === 'groceries' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="exp-supermarket" className="block text-xs font-medium text-slate-700">
                  Supermarket
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewSupermarket((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
                >
                  <Plus className="h-3 w-3" />
                  Add New Supermarket
                </button>
              </div>

              {showNewSupermarket && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSupermarketName}
                    onChange={(e) => setNewSupermarketName(e.target.value)}
                    placeholder="e.g. Waitrose, Morrisons, Iceland"
                    className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSupermarket}
                    className="rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    Save Store
                  </button>
                </div>
              )}

              <select
                id="exp-supermarket"
                value={supermarkets.includes(merchant) ? merchant : '__custom__'}
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    setMerchant(e.target.value);
                  }
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              >
                {supermarkets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {!supermarkets.includes(merchant) && merchant && (
                  <option value="__custom__">{merchant}</option>
                )}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="exp-merchant" className="block text-xs font-medium text-slate-700 mb-1.5">
                Where (Place / Portal)
              </label>
              <input
                id="exp-merchant"
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder={
                  category === 'travel'
                    ? 'e.g. TfL Tube, Uber'
                    : category === 'university'
                      ? 'e.g. University Portal, Library'
                      : 'e.g. Lebara, Pret'
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="exp-date" className="block text-xs font-medium text-slate-700 mb-1.5">
              Date
            </label>
            <input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="exp-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
              Items bought / note (optional)
            </label>
            <input
              id="exp-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Milk, basmati rice, or module handbook"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
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
              {editingExpense ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
