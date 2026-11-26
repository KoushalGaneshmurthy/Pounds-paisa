import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Cloud, Database, Plus, RefreshCw, Sparkles } from 'lucide-react';
import {
  ArchivedMonth,
  BudgetConfig,
  ExpenseCategory,
  ExpenseItem,
  IncomeItem,
} from './types/expense';
import {
  DEFAULT_BUDGET_CONFIG,
  DEFAULT_SUPERMARKETS,
  INITIAL_ARCHIVES,
  INITIAL_EXPENSES,
  INITIAL_INCOMES,
  SLIDE_IMAGES,
} from './data/initialData';
import { fetchDailyGbpToInrRate, getCachedFxRate } from './utils/fxRate';
import { OverviewSlide } from './components/slides/OverviewSlide';
import { CategorySlide } from './components/slides/CategorySlide';
import { OthersSlide } from './components/slides/OthersSlide';
import { UniversitySlide } from './components/slides/UniversitySlide';
import { AddExpenseModal } from './components/AddExpenseModal';
import { IncomeModal } from './components/IncomeModal';
import { BudgetLimitsModal } from './components/BudgetLimitsModal';
import { ArchiveFolderModal } from './components/ArchiveFolderModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { AuthModal } from './components/AuthModal';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { supabaseService } from './services/supabaseService';

const STORAGE_EXPENSES_KEY = 'poundwise_uk_expenses_v4';
const STORAGE_INCOMES_KEY = 'poundwise_uk_incomes_v4';
const STORAGE_SUPERMARKETS_KEY = 'poundwise_uk_supermarkets_v4';
const STORAGE_ARCHIVES_KEY = 'poundwise_uk_archives_v4';
const STORAGE_CONFIG_KEY = 'poundwise_uk_config_v4';

const SLIDES = [
  { id: 'overview', label: '01. Overview', shortLabel: 'Overview' },
  { id: 'groceries', label: '02. Groceries', shortLabel: 'Groceries' },
  { id: 'travel', label: '03. Travel', shortLabel: 'Travel' },
  { id: 'university', label: '04. University', shortLabel: 'University' },
  { id: 'others', label: '05. Others', shortLabel: 'Others' },
] as const;

export default function App() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_EXPENSES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_EXPENSES;
  });

  const [incomes, setIncomes] = useState<IncomeItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_INCOMES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_INCOMES;
  });

  const [supermarkets, setSupermarkets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SUPERMARKETS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_SUPERMARKETS;
  });

  const [archives, setArchives] = useState<ArchivedMonth[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ARCHIVES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_ARCHIVES;
  });

  const [config, setConfig] = useState<BudgetConfig>(() => {
    const cachedFx = getCachedFxRate(DEFAULT_BUDGET_CONFIG.gbpToInrRate);
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.monthlyAllowanceGBP === 'number') {
          return {
            ...DEFAULT_BUDGET_CONFIG,
            ...parsed,
            gbpToInrRate: cachedFx.rate || parsed.gbpToInrRate || 0,
          };
        }
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_BUDGET_CONFIG, gbpToInrRate: cachedFx.rate };
  });

  const [fxMeta, setFxMeta] = useState<{ date: string; isLive: boolean }>(() => {
    const cached = getCachedFxRate(DEFAULT_BUDGET_CONFIG.gbpToInrRate);
    return { date: cached.date, isLive: cached.isLive };
  });
  const [fxLoading, setFxLoading] = useState(false);

  const [activeSlide, setActiveSlide] = useState(0);
  const [showInr, setShowInr] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addDefaultCategory, setAddDefaultCategory] = useState<ExpenseCategory>('groceries');
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeItem | null>(null);

  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const sliderRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScroll = useRef(false);

  const loadCloudData = useCallback(async (userId: string) => {
    setIsCloudSyncing(true);
    try {
      const cloud = await supabaseService.fetchUserData(userId);
      if (cloud) {
        if (cloud.expenses.length > 0) setExpenses(cloud.expenses);
        if (cloud.incomes.length > 0) setIncomes(cloud.incomes);
        if (cloud.config) setConfig(cloud.config);
        if (cloud.archives.length > 0) setArchives(cloud.archives);
        if (cloud.supermarkets.length > 0) {
          setSupermarkets((prev) => Array.from(new Set([...prev, ...cloud.supermarkets])));
        }
      }
    } finally {
      setIsCloudSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured()) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) loadCloudData(user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) loadCloudData(user.id);
    });

    return () => subscription.unsubscribe();
  }, [loadCloudData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(expenses));
    } catch {
      // ignore
    }
  }, [expenses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_INCOMES_KEY, JSON.stringify(incomes));
    } catch {
      // ignore
    }
  }, [incomes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SUPERMARKETS_KEY, JSON.stringify(supermarkets));
    } catch {
      // ignore
    }
  }, [supermarkets]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ARCHIVES_KEY, JSON.stringify(archives));
    } catch {
      // ignore
    }
  }, [archives]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  const refreshTodayFxRate = useCallback(async () => {
    setFxLoading(true);
    const live = await fetchDailyGbpToInrRate();
    if (live) {
      setConfig((prev) => ({ ...prev, gbpToInrRate: live.rate }));
      setFxMeta({ date: live.date, isLive: live.isLive });
    }
    setFxLoading(false);
  }, []);

  useEffect(() => {
    refreshTodayFxRate();
  }, [refreshTodayFxRate]);

  const jumpToSlide = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, index));
    setActiveSlide(clamped);
    const container = sliderRef.current;
    if (!container) return;

    isProgrammaticScroll.current = true;
    container.scrollTo({
      left: clamped * container.clientWidth,
      behavior: 'smooth',
    });

    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 450);
  }, []);

  const handleSliderScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;
    const container = sliderRef.current;
    if (!container || container.clientWidth === 0) return;

    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== activeSlide && index >= 0 && index < SLIDES.length) {
      setActiveSlide(index);
    }
  }, [activeSlide]);

  useEffect(() => {
    const onResize = () => {
      const container = sliderRef.current;
      if (!container) return;
      container.scrollTo({
        left: activeSlide * container.clientWidth,
        behavior: 'auto',
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeSlide]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        isAddModalOpen ||
        isIncomeModalOpen ||
        isLimitsModalOpen ||
        isArchiveModalOpen ||
        isScannerModalOpen ||
        isAuthModalOpen
      ) {
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowRight') {
        jumpToSlide(activeSlide + 1);
      } else if (e.key === 'ArrowLeft') {
        jumpToSlide(activeSlide - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeSlide,
    isAddModalOpen,
    isIncomeModalOpen,
    isLimitsModalOpen,
    isArchiveModalOpen,
    isScannerModalOpen,
    jumpToSlide,
  ]);

  const handleOpenAddModal = () => {
    const fallback: ExpenseCategory =
      activeSlide === 1
        ? 'groceries'
        : activeSlide === 2
          ? 'travel'
          : activeSlide === 3
            ? 'university'
            : activeSlide === 4
              ? 'others'
              : 'groceries';
    setEditingExpense(null);
    setAddDefaultCategory(fallback);
    setIsAddModalOpen(true);
  };

  const handleEditExpense = (expense: ExpenseItem) => {
    setEditingExpense(expense);
    setAddDefaultCategory(expense.category);
    setIsAddModalOpen(true);
  };

  const handleSaveExpense = (data: Omit<ExpenseItem, 'id'>, existingId?: string) => {
    const targetId = existingId || `exp-${Date.now()}`;
    const item: ExpenseItem = { ...data, id: targetId };
    if (existingId) {
      setExpenses((prev) =>
        prev.map((i) => (i.id === existingId ? item : i))
      );
    } else {
      setExpenses((prev) => [item, ...prev]);
    }
    if (currentUser) {
      supabaseService.upsertExpense(currentUser.id, item);
    }
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((item) => item.id !== id));
    if (currentUser) {
      supabaseService.deleteExpense(currentUser.id, id);
    }
  };

  const handleAddSupermarket = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setSupermarkets((prev) => {
      if (prev.some((s) => s.toLowerCase() === clean.toLowerCase())) return prev;
      return [...prev, clean];
    });
    if (currentUser) {
      supabaseService.addSupermarket(currentUser.id, clean);
    }
  };

  const handleOpenIncomeModal = (income?: IncomeItem) => {
    setEditingIncome(income ?? null);
    setIsIncomeModalOpen(true);
  };

  const handleSaveIncome = (data: Omit<IncomeItem, 'id'>, existingId?: string) => {
    const targetId = existingId || `inc-${Date.now()}`;
    const item: IncomeItem = { ...data, id: targetId };
    if (existingId) {
      setIncomes((prev) =>
        prev.map((i) => (i.id === existingId ? item : i))
      );
    } else {
      setIncomes((prev) => [item, ...prev]);
    }
    if (currentUser) {
      supabaseService.upsertIncome(currentUser.id, item);
    }
  };

  const handleDeleteIncome = (id: string) => {
    setIncomes((prev) => prev.filter((item) => item.id !== id));
    if (currentUser) {
      supabaseService.deleteIncome(currentUser.id, id);
    }
  };

  const handleArchiveCurrentMonth = (nextMonthLabel: string) => {
    const newFolder: ArchivedMonth = {
      id: `arch-${Date.now()}`,
      monthLabel: config.monthLabel,
      archivedAt: new Date().toISOString().slice(0, 10),
      config: { ...config },
      expenses: [...expenses],
      incomes: [...incomes],
    };
    setArchives((prev) => [newFolder, ...prev]);
    setExpenses([]);
    setIncomes([]);
    const updatedConfig = { ...config, monthLabel: nextMonthLabel };
    setConfig(updatedConfig);

    if (currentUser) {
      supabaseService.saveArchive(currentUser.id, newFolder);
      supabaseService.saveBudgetConfig(currentUser.id, updatedConfig);
      expenses.forEach((e) => supabaseService.deleteExpense(currentUser.id, e.id));
      incomes.forEach((i) => supabaseService.deleteIncome(currentUser.id, i.id));
    }
  };

  const handleResetDemo = () => {
    setExpenses(INITIAL_EXPENSES);
    setIncomes(INITIAL_INCOMES);
    setSupermarkets(DEFAULT_SUPERMARKETS);
    setArchives(INITIAL_ARCHIVES);
    setConfig(DEFAULT_BUDGET_CONFIG);
    refreshTodayFxRate();
    if (currentUser) {
      supabaseService.clearAllUserData(currentUser.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C232D] text-slate-900 flex flex-col relative">
      {/* Rich Deep Oxford Teal-Navy Atmospheric Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(24,84,104,0.55)_0%,_rgba(12,35,45,0.92)_55%,_rgba(8,24,32,1)_100%)]"
      />

      {/* Strict 3-Zone Top Bar — Single Source of Section Navigation & Single Log Expense CTA */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#091B23]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              jumpToSlide(0);
            }}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Pounds &amp; Paisa
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            {SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => jumpToSlide(idx)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeSlide === idx
                    ? 'border-teal-400 text-white font-semibold'
                    : 'border-transparent hover:text-white'
                }`}
              >
                {slide.shortLabel}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition border ${
                currentUser
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : isSupabaseConfigured()
                  ? 'border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
              title={
                currentUser
                  ? `Logged in: ${currentUser.email}`
                  : isSupabaseConfigured()
                  ? 'Sign in to sync with Supabase'
                  : 'Supabase setup / local mode'
              }
            >
              <Cloud
                className={`h-3.5 w-3.5 ${
                  currentUser ? 'text-emerald-400' : 'text-teal-400'
                } ${isCloudSyncing ? 'animate-pulse' : ''}`}
              />
              <span className="hidden sm:inline">
                {currentUser ? 'Cloud Synced' : isSupabaseConfigured() ? 'Cloud Sync' : 'Local Mode'}
              </span>
              {currentUser && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Expense
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        {/* Compact Utility & Instagram Slide Controls Strip (No Duplicate Section Tabs!) */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-2.5 text-white sm:px-5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => jumpToSlide(activeSlide - 1)}
              disabled={activeSlide === 0}
              aria-label="Previous slide"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 px-1" role="tablist" aria-label="Slider pages">
              {SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={activeSlide === idx}
                  aria-label={`Go to ${slide.shortLabel}`}
                  onClick={() => jumpToSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    activeSlide === idx
                      ? 'w-5 bg-teal-400'
                      : 'w-2 bg-white/35 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => jumpToSlide(activeSlide + 1)}
              disabled={activeSlide === SLIDES.length - 1}
              aria-label="Next slide"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <span className="ml-1 text-xs font-medium text-slate-200">
              {SLIDES[activeSlide].label}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowInr((v) => !v)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  showInr
                    ? 'border-teal-400/50 bg-teal-400/15 text-teal-200'
                    : 'border-white/20 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
                title={fxMeta.date ? `Exchange rate date: ${fxMeta.date}` : 'Live GBP to INR rate'}
              >
                {showInr
                  ? config.gbpToInrRate > 0
                    ? `£1 = ₹${config.gbpToInrRate.toFixed(2)}${fxMeta.isLive ? ' · Live' : ''}`
                    : '₹ INR Pending'
                  : '£ GBP Only'}
              </button>
              <button
                type="button"
                onClick={refreshTodayFxRate}
                disabled={fxLoading}
                aria-label="Refresh today's GBP to INR exchange rate"
                title="Refresh today's GBP to INR rate"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-slate-200 hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fxLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(true)}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              Archives ({archives.length})
            </button>
          </div>
        </div>

        {/* Horizontal Instagram-Style 5-Slide Snap Slider */}
        <div
          ref={sliderRef}
          onScroll={handleSliderScroll}
          className="flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar items-start"
          aria-live="polite"
        >
          {/* Slide 1: Overview */}
          <div className="w-full shrink-0 snap-start">
            <OverviewSlide
              expenses={expenses}
              incomes={incomes}
              lastMonthArchive={archives[0]}
              config={config}
              showInr={showInr}
              onEditExpense={handleEditExpense}
              onDeleteExpense={handleDeleteExpense}
              onOpenIncomeModal={handleOpenIncomeModal}
              onDeleteIncome={handleDeleteIncome}
              onOpenLimitsModal={() => setIsLimitsModalOpen(true)}
              onOpenArchiveModal={() => setIsArchiveModalOpen(true)}
              onJumpToSlide={jumpToSlide}
            />
          </div>

          {/* Slide 2: Groceries */}
          <div className="w-full shrink-0 snap-start">
            <CategorySlide
              category="groceries"
              sectionIndex="Slide 02 of 05 · Groceries"
              title="Groceries"
              subtitle="Add any supermarket you shop at, filter your receipts, and track your monthly cap."
              imageSrc={SLIDE_IMAGES.groceries}
              imageAlt="Fresh British groceries and spices in a woven tote bag"
              expenses={expenses}
              capGBP={config.groceriesCapGBP}
              config={config}
              showInr={showInr}
              supermarkets={supermarkets}
              onAddSupermarket={handleAddSupermarket}
              onUpdateCap={(cap) => {
                setConfig((prev) => {
                  const updated = { ...prev, groceriesCapGBP: cap };
                  if (currentUser) supabaseService.saveBudgetConfig(currentUser.id, updated);
                  return updated;
                });
              }}
              onEditExpense={handleEditExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          </div>

          {/* Slide 3: Travel */}
          <div className="w-full shrink-0 snap-start">
            <CategorySlide
              category="travel"
              sectionIndex="Slide 03 of 05 · Travel"
              title="Travel"
              subtitle="Daily Oyster/contactless caps, rail tickets, coaches, and rides."
              imageSrc={SLIDE_IMAGES.travel}
              imageAlt="London Underground train arriving at platform at dusk"
              expenses={expenses}
              capGBP={config.travelCapGBP}
              config={config}
              showInr={showInr}
              onUpdateCap={(cap) => {
                setConfig((prev) => {
                  const updated = { ...prev, travelCapGBP: cap };
                  if (currentUser) supabaseService.saveBudgetConfig(currentUser.id, updated);
                  return updated;
                });
              }}
              onEditExpense={handleEditExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          </div>

          {/* Slide 4: University */}
          <div className="w-full shrink-0 snap-start">
            <UniversitySlide
              expenses={expenses}
              config={config}
              showInr={showInr}
              onUpdateCap={(cap) => {
                setConfig((prev) => {
                  const updated = { ...prev, universityCapGBP: cap };
                  if (currentUser) supabaseService.saveBudgetConfig(currentUser.id, updated);
                  return updated;
                });
              }}
              onEditExpense={handleEditExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          </div>

          {/* Slide 5: Others */}
          <div className="w-full shrink-0 snap-start">
            <OthersSlide
              expenses={expenses}
              config={config}
              showInr={showInr}
              onUpdateCap={(cap) => {
                setConfig((prev) => {
                  const updated = { ...prev, othersCapGBP: cap };
                  if (currentUser) supabaseService.saveBudgetConfig(currentUser.id, updated);
                  return updated;
                });
              }}
              onEditExpense={handleEditExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          </div>
        </div>
      </main>

      {/* Footer: Copyright */}
      <footer className="relative z-10 border-t border-white/10 bg-[#091B23]/80 mt-10 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-300">
            <div>
              <div className="flex items-center gap-2 font-medium text-slate-200">
                <span>Pounds &amp; Paisa</span>
                <span className="text-slate-500">·</span>
                <span>Active Month: {config.monthLabel}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-200 font-medium">
                  <svg className="w-2.5 h-2.5 fill-current text-white shrink-0" viewBox="0 0 1155 1000">
                    <path d="m577.3 0 577.4 1000H0z" />
                  </svg>
                  Hosted on Vercel
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                  <Database className="w-3 h-3 text-emerald-400 shrink-0" />
                  Supabase PostgreSQL
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 font-medium">
                  <Sparkles className="w-3 h-3 text-teal-400 shrink-0" />
                  Gemini Vision OCR
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="text-xs text-teal-400 hover:text-teal-300 underline underline-offset-4"
              >
                Cloud Sync &amp; Auth
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={() => setIsLimitsModalOpen(true)}
                className="text-xs text-slate-300 hover:text-white underline underline-offset-4"
              >
                Budget &amp; Savings Limit
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4 text-center text-[11px] text-slate-500">
            &copy; {new Date().getFullYear()} Koushal Ganeshmurthy. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddModalOpen}
        defaultCategory={addDefaultCategory}
        editingExpense={editingExpense}
        supermarkets={supermarkets}
        currentRate={config.gbpToInrRate}
        onAddSupermarket={handleAddSupermarket}
        onSwitchToScanner={() => setIsScannerModalOpen(true)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
      />

      <ReceiptScannerModal
        isOpen={isScannerModalOpen}
        supermarkets={supermarkets}
        currentRate={config.gbpToInrRate}
        onAddSupermarket={handleAddSupermarket}
        onSaveExpense={(data) => handleSaveExpense(data)}
        onClose={() => setIsScannerModalOpen(false)}
      />

      <IncomeModal
        isOpen={isIncomeModalOpen}
        editingIncome={editingIncome}
        currentRate={config.gbpToInrRate}
        onClose={() => {
          setIsIncomeModalOpen(false);
          setEditingIncome(null);
        }}
        onSave={handleSaveIncome}
      />

      <BudgetLimitsModal
        isOpen={isLimitsModalOpen}
        config={config}
        onClose={() => setIsLimitsModalOpen(false)}
        onSave={(newConfig) => {
          setConfig(newConfig);
          if (currentUser) {
            supabaseService.saveBudgetConfig(currentUser.id, newConfig);
          }
        }}
        onResetDemo={handleResetDemo}
      />

      <ArchiveFolderModal
        isOpen={isArchiveModalOpen}
        archives={archives}
        currentMonthLabel={config.monthLabel}
        showInr={showInr}
        currentRate={config.gbpToInrRate}
        onClose={() => setIsArchiveModalOpen(false)}
        onArchiveCurrentMonth={handleArchiveCurrentMonth}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChange={(user) => {
          setCurrentUser(user);
          if (user) {
            loadCloudData(user.id);
          }
        }}
        onSyncPush={
          currentUser
            ? async () => {
                await supabaseService.migrateLocalData(currentUser.id, {
                  expenses,
                  incomes,
                  config,
                  archives,
                  supermarkets,
                });
              }
            : undefined
        }
        onSyncPull={
          currentUser
            ? async () => {
                await loadCloudData(currentUser.id);
              }
            : undefined
        }
        hasLocalData={expenses.length > 0 || incomes.length > 0}
      />
    </div>
  );
}
