import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  ArchivedMonth,
  BudgetConfig,
  ExpenseItem,
  IncomeItem,
} from '../types/expense';

export interface UserCloudData {
  expenses: ExpenseItem[];
  incomes: IncomeItem[];
  config: BudgetConfig | null;
  archives: ArchivedMonth[];
  supermarkets: string[];
}

export const supabaseService = {
  async fetchUserData(userId: string): Promise<UserCloudData | null> {
    if (!supabase || !isSupabaseConfigured()) return null;

    try {
      const [
        { data: expensesData, error: expErr },
        { data: incomesData, error: incErr },
        { data: configData, error: cfgErr },
        { data: archivesData, error: arcErr },
        { data: supermarketsData, error: supErr },
      ] = await Promise.all([
        supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('incomes').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('budget_configs').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1),
        supabase.from('archived_months').select('*').eq('user_id', userId).order('archived_at', { ascending: false }),
        supabase.from('supermarkets').select('name').eq('user_id', userId).order('name', { ascending: true }),
      ]);

      if (expErr) console.warn('Supabase fetch expenses error:', expErr.message);
      if (incErr) console.warn('Supabase fetch incomes error:', incErr.message);
      if (cfgErr) console.warn('Supabase fetch config error:', cfgErr.message);
      if (arcErr) console.warn('Supabase fetch archives error:', arcErr.message);
      if (supErr) console.warn('Supabase fetch supermarkets error:', supErr.message);

      const expenses: ExpenseItem[] = (expensesData || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        merchant: row.merchant,
        location: row.location || '',
        category: row.category,
        subCategory: row.sub_category || undefined,
        universityScope: row.university_scope || undefined,
        universitySubCategory: row.university_sub_category || undefined,
        amountGBP: Number(row.amount_gbp),
        paymentMethod: row.payment_method,
        week: Number(row.week) as 1 | 2 | 3 | 4,
        date: row.date,
        notes: row.notes || undefined,
        rateAtEntry: row.rate_at_entry ? Number(row.rate_at_entry) : undefined,
      }));

      const incomes: IncomeItem[] = (incomesData || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        source: row.source,
        amountGBP: Number(row.amount_gbp),
        date: row.date,
        rateAtEntry: row.rate_at_entry ? Number(row.rate_at_entry) : undefined,
      }));

      let config: BudgetConfig | null = null;
      if (configData && configData.length > 0) {
        const c = configData[0];
        config = {
          monthLabel: c.month_label,
          monthlyAllowanceGBP: Number(c.monthly_allowance_gbp),
          savingsGoalGBP: Number(c.savings_goal_gbp),
          groceriesCapGBP: Number(c.groceries_cap_gbp),
          travelCapGBP: Number(c.travel_cap_gbp),
          othersCapGBP: Number(c.others_cap_gbp),
          universityCapGBP: Number(c.university_cap_gbp),
          gbpToInrRate: Number(c.gbp_to_inr_rate),
        };
      }

      const archives: ArchivedMonth[] = (archivesData || []).map((row: any) => ({
        id: row.id,
        monthLabel: row.month_label,
        archivedAt: row.archived_at,
        config: row.config,
        expenses: row.expenses,
        incomes: row.incomes,
      }));

      const supermarkets: string[] = (supermarketsData || []).map((row: any) => row.name);

      return {
        expenses,
        incomes,
        config,
        archives,
        supermarkets,
      };
    } catch (err) {
      console.error('Failed to load user data from Supabase:', err);
      return null;
    }
  },

  async upsertExpense(userId: string, expense: ExpenseItem): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    const { error } = await supabase.from('expenses').upsert({
      id: expense.id,
      user_id: userId,
      title: expense.title,
      merchant: expense.merchant,
      location: expense.location || '',
      category: expense.category,
      sub_category: expense.subCategory || null,
      university_scope: expense.universityScope || null,
      university_sub_category: expense.universitySubCategory || null,
      amount_gbp: expense.amountGBP,
      payment_method: expense.paymentMethod,
      week: expense.week,
      date: expense.date,
      notes: expense.notes || null,
      rate_at_entry: expense.rateAtEntry || null,
    });
    if (error) console.error('Supabase upsertExpense error:', error);
    return !error;
  },

  async deleteExpense(userId: string, expenseId: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('user_id', userId);
    if (error) console.error('Supabase deleteExpense error:', error);
    return !error;
  },

  async upsertIncome(userId: string, income: IncomeItem): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    const { error } = await supabase.from('incomes').upsert({
      id: income.id,
      user_id: userId,
      title: income.title,
      source: income.source,
      amount_gbp: income.amountGBP,
      date: income.date,
      rate_at_entry: income.rateAtEntry || null,
    });
    if (error) console.error('Supabase upsertIncome error:', error);
    return !error;
  },

  async deleteIncome(userId: string, incomeId: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    const { error } = await supabase
      .from('incomes')
      .delete()
      .eq('id', incomeId)
      .eq('user_id', userId);
    if (error) console.error('Supabase deleteIncome error:', error);
    return !error;
  },

  async saveBudgetConfig(userId: string, config: BudgetConfig): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    const { error } = await supabase.from('budget_configs').upsert(
      {
        user_id: userId,
        month_label: config.monthLabel,
        monthly_allowance_gbp: config.monthlyAllowanceGBP,
        savings_goal_gbp: config.savingsGoalGBP,
        groceries_cap_gbp: config.groceriesCapGBP,
        travel_cap_gbp: config.travelCapGBP,
        others_cap_gbp: config.othersCapGBP,
        university_cap_gbp: config.universityCapGBP,
        gbp_to_inr_rate: config.gbpToInrRate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,month_label' }
    );
    if (error) console.error('Supabase saveBudgetConfig error:', error);
    return !error;
  },

  async saveArchive(userId: string, archive: ArchivedMonth): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    const { error } = await supabase.from('archived_months').upsert({
      id: archive.id,
      user_id: userId,
      month_label: archive.monthLabel,
      archived_at: archive.archivedAt,
      config: archive.config,
      expenses: archive.expenses,
      incomes: archive.incomes,
    });
    if (error) console.error('Supabase saveArchive error:', error);
    return !error;
  },

  async deleteArchive(userId: string, archiveId: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    const { error } = await supabase
      .from('archived_months')
      .delete()
      .eq('id', archiveId)
      .eq('user_id', userId);
    if (error) console.error('Supabase deleteArchive error:', error);
    return !error;
  },

  async addSupermarket(userId: string, name: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    const { error } = await supabase.from('supermarkets').upsert(
      {
        user_id: userId,
        name: name.trim(),
      },
      { onConflict: 'user_id,name' }
    );
    if (error) console.error('Supabase addSupermarket error:', error);
    return !error;
  },

  async migrateLocalData(
    userId: string,
    data: {
      expenses: ExpenseItem[];
      incomes: IncomeItem[];
      config: BudgetConfig;
      archives: ArchivedMonth[];
      supermarkets: string[];
    }
  ): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;

    try {
      // 1. Config
      await this.saveBudgetConfig(userId, data.config);

      // 2. Expenses
      for (const exp of data.expenses) {
        await this.upsertExpense(userId, exp);
      }

      // 3. Incomes
      for (const inc of data.incomes) {
        await this.upsertIncome(userId, inc);
      }

      // 4. Archives
      for (const arc of data.archives) {
        await this.saveArchive(userId, arc);
      }

      // 5. Supermarkets
      for (const sm of data.supermarkets) {
        await this.addSupermarket(userId, sm);
      }

      return true;
    } catch (err) {
      console.error('Migration error:', err);
      return false;
    }
  },

  async clearAllUserData(userId: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured()) return false;
    try {
      await Promise.all([
        supabase.from('expenses').delete().eq('user_id', userId),
        supabase.from('incomes').delete().eq('user_id', userId),
        supabase.from('budget_configs').delete().eq('user_id', userId),
        supabase.from('archived_months').delete().eq('user_id', userId),
        supabase.from('supermarkets').delete().eq('user_id', userId),
      ]);
      return true;
    } catch (err) {
      console.error('Error clearing cloud data:', err);
      return false;
    }
  },
};
