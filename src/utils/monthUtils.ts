import { ArchivedMonth, BudgetConfig, ExpenseItem } from '../types/expense';

/**
 * Normalizes a date string (YYYY-MM-DD) or a month label ("November 2026", "Nov 2026")
 * into a standardized year-month key: "YYYY-MM" (e.g. "2026-11").
 */
export function normalizeMonthKey(labelOrDate: string): string {
  if (!labelOrDate) return '';
  const trimmed = labelOrDate.trim();

  // Match YYYY-MM or YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  // Match "Month YYYY" or "Mon YYYY" (e.g. "November 2026" or "Nov 2026")
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const monthStr = parts[0].toLowerCase().slice(0, 3);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const idx = months.indexOf(monthStr);
    const year = parts[1];
    if (idx !== -1 && year && /^\d{4}$/.test(year)) {
      return `${year}-${String(idx + 1).padStart(2, '0')}`;
    }
  }

  return trimmed.toLowerCase();
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
  const itemKey = normalizeMonthKey(isoDate);
  const targetKey = normalizeMonthKey(targetMonthLabel);
  return itemKey < targetKey;
}

export interface MonthFolderData {
  id: string;
  monthKey: string;
  monthLabel: string;
  expenses: ExpenseItem[];
  totalGBP: number;
  count: number;
}

/**
 * Organizes expenses into an active month list and an array of previous month folders.
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
  const activeKey = normalizeMonthKey(currentMonthLabel);

  // Active month expenses from current expenses
  const activeMonthExpenses = expenses.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (!e.date) return true;
    return normalizeMonthKey(e.date) === activeKey;
  });

  // Group previous expenses by month key
  const folderMap: Record<string, { label: string; expenses: ExpenseItem[] }> = {};

  // 1. Any older expenses directly in expenses array
  expenses.forEach((e) => {
    if (categoryFilter && e.category !== categoryFilter) return;
    if (!e.date) return;
    const key = normalizeMonthKey(e.date);
    if (key < activeKey) {
      if (!folderMap[key]) {
        folderMap[key] = {
          label: formatMonthKeyToLabel(key),
          expenses: [],
        };
      }
      folderMap[key].expenses.push(e);
    }
  });

  // 2. Older months from archives
  archives.forEach((arc) => {
    const key = normalizeMonthKey(arc.monthLabel || arc.archivedAt);
    if (!folderMap[key]) {
      folderMap[key] = {
        label: arc.monthLabel || formatMonthKeyToLabel(key),
        expenses: [],
      };
    }
    const matchingArcExpenses = (arc.expenses || []).filter(
      (e) => !categoryFilter || e.category === categoryFilter
    );
    // Avoid duplicate IDs if already present
    const existingIds = new Set(folderMap[key].expenses.map((e) => e.id));
    matchingArcExpenses.forEach((e) => {
      if (!existingIds.has(e.id)) {
        folderMap[key].expenses.push(e);
        existingIds.add(e.id);
      }
    });
  });

  // Transform into sorted folder list (newest previous month first)
  const previousMonthFolders: MonthFolderData[] = Object.entries(folderMap)
    .map(([key, data]) => {
      const sortedExpenses = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date));
      const totalGBP = sortedExpenses.reduce((sum, e) => sum + e.amountGBP, 0);
      return {
        id: `folder-${key}`,
        monthKey: key,
        monthLabel: data.label,
        expenses: sortedExpenses,
        totalGBP,
        count: sortedExpenses.length,
      };
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  return {
    activeMonthExpenses,
    previousMonthFolders,
  };
}
