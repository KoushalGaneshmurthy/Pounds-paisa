import { ArchivedMonth, ExpenseItem } from '../types/expense';

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

/**
 * Returns a numeric chronological sort key: YYYYMM (e.g. 202611 for Nov 2026, 202607 for Jul 2026).
 * Handles: "July 2026", "July", "2026-07-15", "Sep 2026", "07/2026", etc.
 */
export function getMonthSortKey(labelOrDate: string, fallbackSampleDate?: string): number {
  if (!labelOrDate) labelOrDate = '';
  const trimmed = labelOrDate.trim();

  // Try matching YYYY-MM or YYYY-MM-DD
  const isoMatch = trimmed.match(/(\d{4})-(\d{2})/);
  if (isoMatch) {
    return parseInt(isoMatch[1], 10) * 100 + parseInt(isoMatch[2], 10);
  }

  // Look for 4-digit year in string
  const yearMatch = trimmed.match(/\b(20\d{2})\b/);
  let year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // Look for 2-digit year (e.g. "July 26")
  if (!year) {
    const shortYearMatch = trimmed.match(/\b(\d{2})\b/);
    if (shortYearMatch) {
      const num = parseInt(shortYearMatch[1], 10);
      if (num >= 20 && num <= 40) {
        year = 2000 + num;
      }
    }
  }

  // Try fallbackSampleDate if year still missing
  if (!year && fallbackSampleDate) {
    const sampleYearMatch = fallbackSampleDate.match(/\b(20\d{2})\b/);
    if (sampleYearMatch) {
      year = parseInt(sampleYearMatch[1], 10);
    }
  }

  // Default year to current year if not found
  if (!year) {
    year = new Date().getFullYear();
  }

  // Match month name
  let month = 1;
  const lower = trimmed.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const full = MONTH_NAMES[i];
    const short = full.slice(0, 3);
    const regex = new RegExp(`\\b${short}`, 'i');
    if (regex.test(lower)) {
      month = i + 1;
      break;
    }
  }

  return year * 100 + month;
}

/**
 * Normalizes a date string (YYYY-MM-DD) or a month label ("November 2026", "Nov 2026", "July")
 * into a standardized year-month key: "YYYY-MM" (e.g. "2026-11").
 */
export function normalizeMonthKey(labelOrDate: string, fallbackSampleDate?: string): string {
  const sortKey = getMonthSortKey(labelOrDate, fallbackSampleDate);
  const year = Math.floor(sortKey / 100);
  const month = sortKey % 100;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Formats a "YYYY-MM" key into a readable label like "November 2026".
 */
export function formatMonthKeyToLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
      const d = new Date(year, month - 1, 1);
      return new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
      }).format(d);
    }
  }
  return monthKey;
}

/**
 * Returns true if the ISO date string belongs to the target month label.
 */
export function isDateInMonth(isoDate: string, targetMonthLabel: string): boolean {
  if (!isoDate || !targetMonthLabel) return true;
  return normalizeMonthKey(isoDate) === normalizeMonthKey(targetMonthLabel);
}

/**
 * Returns true if the ISO date string is strictly from an older month than targetMonthLabel.
 */
export function isDateOlderThanMonth(isoDate: string, targetMonthLabel: string): boolean {
  if (!isoDate || !targetMonthLabel) return false;
  const itemSort = getMonthSortKey(isoDate);
  const targetSort = getMonthSortKey(targetMonthLabel);
  return itemSort < targetSort;
}

export interface MonthFolderData {
  id: string;
  monthKey: string;
  monthLabel: string;
  sortOrder: number;
  expenses: ExpenseItem[];
  totalGBP: number;
  count: number;
}

/**
 * Organizes expenses into an active month list and an array of previous month folders,
 * sorted strictly by reverse chronological order (newest previous month first).
 */
export function organizeExpensesByMonth(
  expenses: ExpenseItem[],
  currentMonthLabel: string,
  archives: ArchivedMonth[] = [],
  categoryFilter?: ExpenseItem['category']
): {
  activeMonthExpenses: ExpenseItem[];
  previousMonthFolders: MonthFolderData[];
} {
  const activeSortKey = getMonthSortKey(currentMonthLabel);
  const activeKey = normalizeMonthKey(currentMonthLabel);

  // Active month expenses from current expenses
  const activeMonthExpenses = expenses.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (!e.date) return true;
    return normalizeMonthKey(e.date) === activeKey;
  });

  // Group previous expenses by month key
  const folderMap: Record<
    string,
    { label: string; sortOrder: number; expenses: ExpenseItem[] }
  > = {};

  // 1. Any older expenses directly in expenses array
  expenses.forEach((e) => {
    if (categoryFilter && e.category !== categoryFilter) return;
    if (!e.date) return;
    const sortOrder = getMonthSortKey(e.date);
    if (sortOrder < activeSortKey) {
      const key = normalizeMonthKey(e.date);
      if (!folderMap[key]) {
        folderMap[key] = {
          label: formatMonthKeyToLabel(key),
          sortOrder,
          expenses: [],
        };
      }
      folderMap[key].expenses.push(e);
    }
  });

  // 2. Older months from archives
  archives.forEach((arc) => {
    const sampleDate = arc.expenses?.[0]?.date || arc.archivedAt;
    const sortOrder = getMonthSortKey(arc.monthLabel || arc.archivedAt, sampleDate);
    const key = normalizeMonthKey(arc.monthLabel || arc.archivedAt, sampleDate);

    // Only include if it is not the active month
    if (sortOrder < activeSortKey) {
      if (!folderMap[key]) {
        folderMap[key] = {
          label: arc.monthLabel || formatMonthKeyToLabel(key),
          sortOrder,
          expenses: [],
        };
      }
      const matchingArcExpenses = (arc.expenses || []).filter(
        (e) => !categoryFilter || e.category === categoryFilter
      );
      // Avoid duplicate IDs
      const existingIds = new Set(folderMap[key].expenses.map((e) => e.id));
      matchingArcExpenses.forEach((e) => {
        if (!existingIds.has(e.id)) {
          folderMap[key].expenses.push(e);
          existingIds.add(e.id);
        }
      });
    }
  });

  // Transform into sorted folder list (newest previous month first: Oct > Sep > Aug > Jul)
  const previousMonthFolders: MonthFolderData[] = Object.entries(folderMap)
    .map(([key, data]) => {
      const sortedExpenses = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date));
      const totalGBP = sortedExpenses.reduce((sum, e) => sum + e.amountGBP, 0);
      return {
        id: `folder-${key}`,
        monthKey: key,
        monthLabel: data.label,
        sortOrder: data.sortOrder,
        expenses: sortedExpenses,
        totalGBP,
        count: sortedExpenses.length,
      };
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.sortOrder - a.sortOrder);

  return {
    activeMonthExpenses,
    previousMonthFolders,
  };
}
