import React, { useEffect, useState } from 'react';
import { X, Plus, Camera } from 'lucide-react';
import {
  ExpenseCategory,
  ExpenseItem,
  OtherSubCategory,
  WeekNumber,
} from '../types/expense';
import { OTHER_SUBCATEGORIES, TRANSPORT_TYPES } from '../data/initialData';
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
  const [subCategory, setSubCategory] = useState<OtherSubCategory | undefined>(undefined);
  const [transportType, setTransportType] = useState<string>('Tube / Underground');
  const [travelFrom, setTravelFrom] = useState('');
  const [travelTo, setTravelTo] = useState('');
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
      setSubCategory(editingExpense.subCategory);
      setAmountGBP(String(editingExpense.amountGBP));
      setDate(editingExpense.date);
      setNotes(editingExpense.notes ?? '');
      setDayRate(editingExpense.rateAtEntry ?? currentRate);
      if (editingExpense.category === 'travel') {
        const parts = editingExpense.title.split('→').map((s) => s.trim());
        if (parts.length === 2) {
          setTravelFrom(parts[0]);
          setTravelTo(parts[1]);
        } else {
          setTravelFrom(editingExpense.location || '');
          setTravelTo('');
        }
        setTransportType(editingExpense.merchant || 'Tube / Underground');
      } else {
        setTravelFrom('');
        setTravelTo('');
        setTransportType('Tube / Underground');
      }
    } else {
      setCategory(defaultCategory);
      setMerchant(defaultSupermarket || '');
      setSubCategory(undefined);
      setTransportType('Tube / Underground');
      setTravelFrom('');
      setTravelTo('');
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

    let finalTitle = merchant.trim();
    let finalMerchant = merchant.trim();
    let finalLocation = '';
    let finalNotes: string | undefined = notes.trim() || undefined;

    if (category === 'travel') {
      const cleanFrom = travelFrom.trim();
      const cleanTo = travelTo.trim();
      if (!cleanFrom || !cleanTo) {
        setError('Please enter both From and To locations.');
        return;
      }
      const route = `${cleanFrom} → ${cleanTo}`;
      finalTitle = route;
      finalMerchant = transportType;
      finalLocation = route;
      finalNotes = `${transportType}: ${route}`;
    } else if (category === 'university' || category === 'others') {
      if (!finalMerchant) {
        setError('Please enter the expense name.');
        return;
      }
    } else {
      if (!finalMerchant) {
        setError('Please enter or choose where you spent.');
        return;
      }
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
        title: finalTitle,
        merchant: finalMerchant,
        location: finalLocation,
        category,
        subCategory: undefined,
        amountGBP: Math.round(parsedAmount * 100) / 100,
        paymentMethod: editingExpense?.paymentMethod || 'Monzo Debit',
        week: editingExpense?.week || computedWeek,
        date,
        notes: finalNotes,
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
              <span>Have a receipt photo? Scan receipt</span>
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
                      setMerchant(defaultSupermarket || '');
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

          {/* Groceries: Supermarket & Items Bought */}
          {category === 'groceries' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="exp-supermarket" className="block text-xs font-medium text-slate-700">
                    Supermarket
                  </label>
                  {supermarkets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewSupermarket((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
                    >
                      <Plus className="h-3 w-3" />
                      Add New Supermarket
                    </button>
                  )}
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

                {supermarkets.length > 0 ? (
                  <select
                    id="exp-supermarket"
                    value={merchant || ''}
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setMerchant(e.target.value);
                      }
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      Select a supermarket
                    </option>
                    {supermarkets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {!supermarkets.includes(merchant) && merchant && (
                      <option value={merchant}>{merchant}</option>
                    )}
                  </select>
                ) : (
                  <input
                    id="exp-supermarket"
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. Store or supermarket name"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                    required
                  />
                )}
              </div>

              <div>
                <label htmlFor="exp-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Items Bought
                </label>
                <input
                  id="exp-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Bread, milk, eggs, bananas, vegetables"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Travel: Transportation Type, From, To */}
          {category === 'travel' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="exp-transport-type" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Transportation Type
                </label>
                <select
                  id="exp-transport-type"
                  value={transportType}
                  onChange={(e) => setTransportType(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                >
                  {TRANSPORT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="exp-travel-from" className="block text-xs font-medium text-slate-700 mb-1.5">
                    From
                  </label>
                  <input
                    id="exp-travel-from"
                    type="text"
                    value={travelFrom}
                    onChange={(e) => setTravelFrom(e.target.value)}
                    placeholder="e.g. Stratford, Campus, Home"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="exp-travel-to" className="block text-xs font-medium text-slate-700 mb-1.5">
                    To
                  </label>
                  <input
                    id="exp-travel-to"
                    type="text"
                    value={travelTo}
                    onChange={(e) => setTravelTo(e.target.value)}
                    placeholder="e.g. Central London, Kings Cross, Airport"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* University & Others: Clean Expense Name */}
          {(category === 'university' || category === 'others') && (
            <div>
              <label htmlFor="exp-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                Expense Name
              </label>
              <input
                id="exp-name"
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder={
                  category === 'university'
                    ? 'e.g. Tuition fee, Library printing, Textbooks, Student visa'
                    : 'e.g. Room rent, SIM card, Gym membership, Coffee'
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                required
              />
            </div>
          )}

          {/* Amount and Date row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
