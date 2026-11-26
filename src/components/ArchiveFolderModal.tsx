import React, { useMemo, useState } from 'react';
import { X, Folder, Search, Archive, MapPin, ChevronRight } from 'lucide-react';
import { ArchivedMonth } from '../types/expense';
import { formatGBP, formatINR, formatShortDate } from '../utils/formatters';

interface ArchiveFolderModalProps {
  isOpen: boolean;
  archives: ArchivedMonth[];
  currentMonthLabel: string;
  showInr: boolean;
  currentRate: number;
  onClose: () => void;
  onArchiveCurrentMonth: (nextMonthLabel: string) => void;
}

function getNextMonthLabel(currentLabel: string): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const parts = currentLabel.trim().split(/\s+/);
  const idx = months.findIndex((m) => m.toLowerCase() === parts[0]?.toLowerCase());
  const year = parseInt(parts[1] || '2026', 10) || 2026;
  if (idx === -1) return 'Next Month';
  const nextIdx = (idx + 1) % 12;
  const nextYear = nextIdx === 0 ? year + 1 : year;
  return `${months[nextIdx]} ${nextYear}`;
}

export const ArchiveFolderModal: React.FC<ArchiveFolderModalProps> = ({
  isOpen,
  archives,
  currentMonthLabel,
  showInr,
  currentRate,
  onClose,
  onArchiveCurrentMonth,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    archives[0]?.id || ''
  );
  const [archiveSearch, setArchiveSearch] = useState('');
  const [confirmingRollover, setConfirmingRollover] = useState(false);

  const nextMonthSuggestion = useMemo(
    () => getNextMonthLabel(currentMonthLabel),
    [currentMonthLabel]
  );

  const selectedFolder = useMemo(
    () => archives.find((a) => a.id === selectedFolderId) || archives[0] || null,
    [archives, selectedFolderId]
  );

  // Global search across ALL archived months (previous month + older folders)
  const searchResults = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return [];
    const hits: {
      monthLabel: string;
      monthId: string;
      expense: ArchivedMonth['expenses'][number];
      rate: number;
    }[] = [];

    archives.forEach((folder) => {
      folder.expenses.forEach((exp) => {
        const match =
          exp.title.toLowerCase().includes(q) ||
          exp.merchant.toLowerCase().includes(q) ||
          exp.location.toLowerCase().includes(q) ||
          (exp.notes && exp.notes.toLowerCase().includes(q));
        if (match) {
          const fallbackRate =
            folder.config.gbpToInrRate > 0 ? folder.config.gbpToInrRate : currentRate;
          hits.push({
            monthLabel: folder.monthLabel,
            monthId: folder.id,
            expense: exp,
            rate: exp.rateAtEntry && exp.rateAtEntry > 0 ? exp.rateAtEntry : fallbackRate,
          });
        }
      });
    });
    return hits.sort((a, b) => b.expense.date.localeCompare(a.expense.date));
  }, [archiveSearch, archives, currentRate]);

  if (!isOpen) return null;

  const folderTotals = selectedFolder
    ? (() => {
        const spent = selectedFolder.expenses.reduce((s, e) => s + e.amountGBP, 0);
        const salary = selectedFolder.incomes.reduce((s, i) => s + i.amountGBP, 0);
        const totalFunds = selectedFolder.config.monthlyAllowanceGBP + salary;
        const saved = Math.max(0, totalFunds - spent);
        const groceries = selectedFolder.expenses
          .filter((e) => e.category === 'groceries')
          .reduce((s, e) => s + e.amountGBP, 0);
        const travel = selectedFolder.expenses
          .filter((e) => e.category === 'travel')
          .reduce((s, e) => s + e.amountGBP, 0);
        const others = selectedFolder.expenses
          .filter((e) => e.category === 'others')
          .reduce((s, e) => s + e.amountGBP, 0);
        return { spent, salary, totalFunds, saved, groceries, travel, others };
      })()
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
    >
      <div className="w-full max-w-3xl rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="archive-modal-title" className="font-display text-lg font-bold text-slate-900">
              Monthly Archive Folders
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Older months are stored cleanly here—your active screen only shows {currentMonthLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close archive folder"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Across All Archived Months */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={archiveSearch}
              onChange={(e) => setArchiveSearch(e.target.value)}
              placeholder="Search last month or older archives (e.g. Lidl, Oyster, Rent)..."
              aria-label="Search archived months"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            />
          </div>

          {!confirmingRollover ? (
            <button
              type="button"
              onClick={() => setConfirmingRollover(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive {currentMonthLabel}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5">
              <span className="text-xs font-medium text-amber-900">
                Move to Archive & open {nextMonthSuggestion}?
              </span>
              <button
                type="button"
                onClick={() => {
                  onArchiveCurrentMonth(nextMonthSuggestion);
                  setConfirmingRollover(false);
                  onClose();
                }}
                className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRollover(false)}
                className="text-xs text-slate-600 hover:text-slate-900 px-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Search Results Mode */}
        {archiveSearch.trim() ? (
          <div className="mt-5">
            <p className="text-xs font-medium text-slate-500 mb-3">
              Archive search results ({searchResults.length})
            </p>
            {searchResults.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                No archived expenses matched “{archiveSearch}”.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {searchResults.map(({ monthLabel, expense, rate }) => (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-teal-800">{monthLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatShortDate(expense.date)}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {expense.title}
                      </p>
                      <p className="text-xs text-slate-600">
                        {expense.merchant}
                        {expense.notes ? ` · ${expense.notes}` : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="font-mono-num text-sm font-semibold text-slate-900">
                        {formatGBP(expense.amountGBP)}
                      </p>
                      {showInr && rate > 0 && (
                        <p className="font-mono-num text-xs text-slate-500">
                          {formatINR(expense.amountGBP, rate)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : archives.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            No archived months yet. Once a month finishes, click “Archive {currentMonthLabel}” above.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-12">
            {/* Folder List */}
            <div className="md:col-span-4 space-y-2">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Saved Month Folders ({archives.length})
              </p>
              {archives.map((folder, index) => {
                const isSelected = selectedFolder?.id === folder.id;
                const folderSpent = folder.expenses.reduce((s, e) => s + e.amountGBP, 0);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {folder.monthLabel}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {index === 0 ? 'Last month · ' : ''}
                          {formatGBP(folderSpent)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Selected Folder Overview & Feed */}
            {selectedFolder && folderTotals && (
              <div className="md:col-span-8 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      {selectedFolder.monthLabel} Overview
                    </h3>
                    <span className="text-xs text-slate-500">
                      Archived {selectedFolder.archivedAt}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] text-slate-500">Total Funds</p>
                      <p className="font-mono-num text-sm font-semibold text-slate-900">
                        {formatGBP(folderTotals.totalFunds)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Total Spent</p>
                      <p className="font-mono-num text-sm font-semibold text-slate-900">
                        {formatGBP(folderTotals.spent)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Part-Time Earned</p>
                      <p className="font-mono-num text-sm font-semibold text-teal-800">
                        {formatGBP(folderTotals.salary)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Saved</p>
                      <p className="font-mono-num text-sm font-semibold text-emerald-700">
                        {formatGBP(folderTotals.saved)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200/80 pt-2.5 text-xs text-slate-600">
                    <span>Groceries: {formatGBP(folderTotals.groceries)}</span>
                    <span>·</span>
                    <span>Travel: {formatGBP(folderTotals.travel)}</span>
                    <span>·</span>
                    <span>Others: {formatGBP(folderTotals.others)}</span>
                  </div>
                </div>

                {/* Archived Entries inside Selected Folder */}
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {selectedFolder.expenses.map((exp) => {
                    const fallbackRate =
                      selectedFolder.config.gbpToInrRate > 0
                        ? selectedFolder.config.gbpToInrRate
                        : currentRate;
                    const rate =
                      exp.rateAtEntry && exp.rateAtEntry > 0 ? exp.rateAtEntry : fallbackRate;
                    return (
                      <div
                        key={exp.id}
                        className="flex flex-col gap-1.5 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="capitalize font-medium text-slate-700">
                              {exp.category}
                            </span>
                            <span>·</span>
                            <span>{formatShortDate(exp.date)}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-900">{exp.title}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {exp.merchant}
                            </span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <p className="font-mono-num text-sm font-semibold text-slate-900">
                            {formatGBP(exp.amountGBP)}
                          </p>
                          {showInr && rate > 0 && (
                            <p className="font-mono-num text-[11px] text-slate-500">
                              {formatINR(exp.amountGBP, rate)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
