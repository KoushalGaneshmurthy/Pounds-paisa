import React, { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { BudgetConfig } from '../types/expense';
import { formatGBP, formatINR } from '../utils/formatters';

interface BudgetLimitsModalProps {
  isOpen: boolean;
  config: BudgetConfig;
  onClose: () => void;
  onSave: (newConfig: BudgetConfig) => void;
  onResetDemo: () => void;
}

export const BudgetLimitsModal: React.FC<BudgetLimitsModalProps> = ({
  isOpen,
  config,
  onClose,
  onSave,
  onResetDemo,
}) => {
  const [draft, setDraft] = useState<BudgetConfig>(config);

  useEffect(() => {
    if (isOpen) {
      setDraft(config);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const spendableCeiling = Math.max(0, draft.monthlyAllowanceGBP - draft.savingsGoalGBP);
  const categorySum =
    draft.groceriesCapGBP +
    draft.travelCapGBP +
    draft.othersCapGBP +
    draft.universityCapGBP;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-limits-title"
    >
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 id="budget-limits-title" className="font-display text-lg font-bold text-slate-900">
              Monthly Budget & Savings Limit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set your protected monthly savings floor and section caps
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close limits modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cfg-allowance" className="block text-xs font-medium text-slate-700 mb-1.5">
                Base Monthly Allowance (£ GBP)
              </label>
              <input
                id="cfg-allowance"
                type="number"
                min="0"
                step="10"
                value={draft.monthlyAllowanceGBP}
                onChange={(e) =>
                  setDraft({ ...draft, monthlyAllowanceGBP: Math.max(0, Number(e.target.value)) })
                }
                className="font-mono-num h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
              {draft.gbpToInrRate > 0 && (
                <p className="font-mono-num mt-1 text-[11px] text-slate-500">
                  {formatINR(draft.monthlyAllowanceGBP, draft.gbpToInrRate)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="cfg-savings" className="block text-xs font-medium text-slate-700 mb-1.5">
                Protected Savings Limit (£ GBP)
              </label>
              <input
                id="cfg-savings"
                type="number"
                min="0"
                step="10"
                value={draft.savingsGoalGBP}
                onChange={(e) =>
                  setDraft({ ...draft, savingsGoalGBP: Math.max(0, Number(e.target.value)) })
                }
                className="font-mono-num h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
              <p className="font-mono-num mt-1 text-[11px] text-emerald-700">
                Base spendable ceiling: {formatGBP(spendableCeiling)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">Section Caps</span>
              <span
                className={`font-mono-num ${
                  categorySum > spendableCeiling ? 'text-amber-700 font-medium' : 'text-slate-600'
                }`}
              >
                Allocated {formatGBP(categorySum)} / {formatGBP(spendableCeiling)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label htmlFor="cap-groceries" className="block text-xs text-slate-600 mb-1">
                  Groceries (£)
                </label>
                <input
                  id="cap-groceries"
                  type="number"
                  min="0"
                  step="10"
                  value={draft.groceriesCapGBP}
                  onChange={(e) =>
                    setDraft({ ...draft, groceriesCapGBP: Math.max(0, Number(e.target.value)) })
                  }
                  className="font-mono-num h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cap-travel" className="block text-xs text-slate-600 mb-1">
                  Travel (£)
                </label>
                <input
                  id="cap-travel"
                  type="number"
                  min="0"
                  step="10"
                  value={draft.travelCapGBP}
                  onChange={(e) =>
                    setDraft({ ...draft, travelCapGBP: Math.max(0, Number(e.target.value)) })
                  }
                  className="font-mono-num h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cap-others" className="block text-xs text-slate-600 mb-1">
                  Others (£)
                </label>
                <input
                  id="cap-others"
                  type="number"
                  min="0"
                  step="10"
                  value={draft.othersCapGBP}
                  onChange={(e) =>
                    setDraft({ ...draft, othersCapGBP: Math.max(0, Number(e.target.value)) })
                  }
                  className="font-mono-num h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cap-university" className="block text-xs text-slate-600 mb-1">
                  University (£)
                </label>
                <input
                  id="cap-university"
                  type="number"
                  min="0"
                  step="10"
                  value={draft.universityCapGBP}
                  onChange={(e) =>
                    setDraft({ ...draft, universityCapGBP: Math.max(0, Number(e.target.value)) })
                  }
                  className="font-mono-num h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="cfg-rate" className="block text-xs font-medium text-slate-700 mb-1.5">
              INR Exchange Rate (1 GBP = ₹ INR)
            </label>
            <input
              id="cfg-rate"
              type="number"
              min="50"
              step="0.5"
              value={draft.gbpToInrRate}
              onChange={(e) =>
                setDraft({ ...draft, gbpToInrRate: Math.max(1, Number(e.target.value)) })
              }
              className="font-mono-num h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onResetDemo();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear All Data
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Apply Limits
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
