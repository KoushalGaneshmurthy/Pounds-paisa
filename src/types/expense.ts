export type ExpenseCategory = 'groceries' | 'travel' | 'others' | 'university';

export type OtherSubCategory =
  | 'rent'
  | 'utilities_sim'
  | 'dining_coffee'
  | 'laundry_care'
  | 'subscriptions_forex';

export type UniversityScope = 'monthly' | 'separate';

export type UniversitySubCategory =
  | 'tuition_fees'
  | 'books_printing'
  | 'visa_ihs'
  | 'software_tech'
  | 'societies_events'
  | 'exams_grad';

export type PaymentMethod =
  | 'Monzo Debit'
  | 'Revolut Card'
  | 'Niyo Forex (INR→GBP)'
  | 'Oyster / Contactless'
  | 'Cash GBP';

export type WeekNumber = 1 | 2 | 3 | 4;

export interface ExpenseItem {
  id: string;
  title: string;
  merchant: string;
  location: string;
  category: ExpenseCategory;
  subCategory?: OtherSubCategory;
  universityScope?: UniversityScope;
  universitySubCategory?: UniversitySubCategory;
  amountGBP: number;
  paymentMethod: PaymentMethod;
  week: WeekNumber;
  date: string; // YYYY-MM-DD
  notes?: string;
  rateAtEntry?: number;
}

export interface IncomeItem {
  id: string;
  title: string;
  source: string;
  amountGBP: number;
  date: string; // YYYY-MM-DD
  rateAtEntry?: number;
}

export interface BudgetConfig {
  monthLabel: string;
  monthlyAllowanceGBP: number;
  savingsGoalGBP: number;
  groceriesCapGBP: number;
  travelCapGBP: number;
  othersCapGBP: number;
  universityCapGBP: number;
  gbpToInrRate: number;
}

export interface ArchivedMonth {
  id: string;
  monthLabel: string;
  archivedAt: string;
  config: BudgetConfig;
  expenses: ExpenseItem[];
  incomes: IncomeItem[];
}
