import {
  ArchivedMonth,
  BudgetConfig,
  ExpenseItem,
  IncomeItem,
  OtherSubCategory,
  PaymentMethod,
  UniversitySubCategory,
} from '../types/expense';

const currentMonthLabel = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
}).format(new Date());

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  monthLabel: currentMonthLabel,
  monthlyAllowanceGBP: 0,
  savingsGoalGBP: 0,
  groceriesCapGBP: 0,
  travelCapGBP: 0,
  othersCapGBP: 0,
  universityCapGBP: 0,
  gbpToInrRate: 0,
};

export const DEFAULT_SUPERMARKETS: string[] = [];

export const TRANSPORT_TYPES = [
  'Tube / Underground',
  'Bus',
  'Train / National Rail',
  'Uber / Taxi / Bolt',
  'Coach (National Express / Megabus)',
  'Tram / DLR',
  'Cycle / Other',
] as const;

export type TransportType = (typeof TRANSPORT_TYPES)[number];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Monzo Debit',
  'Revolut Card',
  'Niyo Forex (INR→GBP)',
  'Oyster / Contactless',
  'Cash GBP',
];

export interface SubCategoryMeta {
  id: OtherSubCategory;
  label: string;
}

export const OTHER_SUBCATEGORIES: SubCategoryMeta[] = [
  { id: 'rent', label: 'Rent & Room' },
  { id: 'utilities_sim', label: 'SIM & Bills' },
  { id: 'dining_coffee', label: 'Dining & Coffee' },
  { id: 'laundry_care', label: 'Laundry & Care' },
  { id: 'subscriptions_forex', label: 'Gym & Apps' },
];

export interface UniversitySubCategoryMeta {
  id: UniversitySubCategory;
  label: string;
}

export const UNIVERSITY_SUBCATEGORIES: UniversitySubCategoryMeta[] = [
  { id: 'tuition_fees', label: 'Tuition & Fees' },
  { id: 'books_printing', label: 'Books & Printing' },
  { id: 'visa_ihs', label: 'Visa & IHS' },
  { id: 'software_tech', label: 'Tech & Software' },
  { id: 'societies_events', label: 'Societies & Trips' },
  { id: 'exams_grad', label: 'Exams & Admin' },
];

export const INITIAL_INCOMES: IncomeItem[] = [];

export const INITIAL_EXPENSES: ExpenseItem[] = [];

export const INITIAL_ARCHIVES: ArchivedMonth[] = [];

export const SLIDE_IMAGES = {
  overview: '/src/assets/images/uk_student_skyline_backdrop_1795398730998.jpg',
  groceries: '/src/assets/images/uk_groceries_market_banner_1795398730266.jpg',
  travel: '/src/assets/images/uk_travel_tube_banner_1795398730761.jpg',
  others: '/src/assets/images/uk_others_student_desk_banner_1795398730481.jpg',
  university: '/src/assets/images/uk_university_library_banner_1795400426681.jpg',
};
