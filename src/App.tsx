import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Cloud, Database, LogOut, Plus, RefreshCw, ShieldCheck, Sparkles, User } from 'lucide-react';
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
import {
  isDateOlderThanMonth,
  normalizeMonthKey,
  formatMonthKeyToLabel,
  getMonthSortKey,
} from './utils/monthUtils';
import { OverviewSlide } from './components/slides/OverviewSlide';
import { AnalyticsSlide } from './components/slides/AnalyticsSlide';
import { CategorySlide } from './components/slides/CategorySlide';
import { OthersSlide } from './components/slides/OthersSlide';
import { UniversitySlide } from './components/slides/UniversitySlide';
import { AddExpenseModal } from './components/AddExpenseModal';
import { IncomeModal } from './components/IncomeModal';
import { BudgetLimitsModal } from './components/BudgetLimitsModal';
import { ArchiveFolderModal } from './components/ArchiveFolderModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { AuthModal } from './components/AuthModal';
import { LoginScreen } from './components/LoginScreen';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { supabaseService } from './services/supabaseService';
import {
  clearUserVault,
  getActiveLocalSession,
  loadUserVaultItem,
  saveUserVaultItem,
  setActiveLocalSession,
} from './utils/cryptoVault';

const SLIDES = [
  { id: 'overview', label: '01. Overview', shortLabel: 'Overview' },
  { id: 'analytics', label: '02. Analytics', shortLabel: 'Analytics' },
  { id: 'groceries', label: '03. Groceries', shortLabel: 'Groceries' },
  { id: 'travel', label: '04. Travel', shortLabel: 'Travel' },
  { id: 'university', label: '05. University', shortLabel: 'University' },
  { id: 'others', label: '06. Others', shortLabel: 'Others' },
] as const;

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(() => getActiveLocalSession());
  const isVaultReady = useRef(false);

  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    // If an active session exists, start clean until vault decrypts
    if (getActiveLocalSession()) return [];
    return INITIAL_EXPENSES;
  });

  const [incomes, setIncomes] = useState<IncomeItem[]>(() => {
    if (getActiveLocalSession()) return [];
    return INITIAL_INCOMES;
  });

  const [supermarkets, setSupermarkets] = useState<string[]>(DEFAULT_SUPERMARKETS);

  const [archives, setArchives] = useState<ArchivedMonth[]>(() => {
    if (getActiveLocalSession()) return [];
    return INITIAL_ARCHIVES;
  });

  const sortedArchives = useMemo(() => {
    return [...archives].sort((a, b) => {
      const aOrder = getMonthSortKey(a.monthLabel, a.expenses?.[0]?.date || a.archivedAt);
      const bOrder = getMonthSortKey(b.monthLabel, b.expenses?.[0]?.date || b.archivedAt);
      return bOrder - aOrder;
    });
  }, [archives]);

  const [config, setConfig] = useState<BudgetConfig>(() => {
    const cachedFx = getCachedFxRate(DEFAULT_BUDGET_CONFIG.gbpToInrRate);
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
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const sliderRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScroll = useRef(false);

  const loadCloudData = useCallback(async (userId: string) => {
    setIsCloudSyncing(true);
    try {
      const cloud = await supabaseService.fetchUserData(userId);
      if (cloud) {
        if (cloud.expenses && cloud.expenses.length > 0) setExpenses(cloud.expenses);
        if (cloud.incomes && cloud.incomes.length > 0) setIncomes(cloud.incomes);
        if (cloud.config) setConfig(cloud.config);
        if (cloud.archives && cloud.archives.length > 0) setArchives(cloud.archives);
        if (cloud.supermarkets && cloud.supermarkets.length > 0) {
          setSupermarkets((prev) => Array.from(new Set([...prev, ...cloud.supermarkets])));
        }
      }
    } finally {
      setIsCloudSyncing(false);
    }
  }, []);

  const switchUserVault = useCallback(async (user: any) => {
    isVaultReady.current = false;
    setCurrentUser(user);
    if (!user) {
      // Clean wipe of sensitive financial records upon logout
      setExpenses([]);
      setIncomes([]);
      setArchives([]);
      setConfig(DEFAULT_BUDGET_CONFIG);
      setSupermarkets(DEFAULT_SUPERMARKETS);
      isVaultReady.current = true;
      return;
    }

    // Load from user's isolated AES-GCM encrypted local vault
    const [vExpenses, vIncomes, vArchives, vConfig, vSupermarkets] = await Promise.all([
      loadUserVaultItem<ExpenseItem[]>(user.id, 'expenses', []),
      loadUserVaultItem<IncomeItem[]>(user.id, 'incomes', []),
      loadUserVaultItem<ArchivedMonth[]>(user.id, 'archives', []),
      loadUserVaultItem<BudgetConfig>(user.id, 'config', DEFAULT_BUDGET_CONFIG),
      loadUserVaultItem<string[]>(user.id, 'supermarkets', DEFAULT_SUPERMARKETS),
    ]);

    setExpenses(vExpenses);
    setIncomes(vIncomes);
    setArchives(vArchives);
    setConfig(vConfig);
    setSupermarkets(vSupermarkets);

    // If Supabase cloud is configured, pull cloud state and merge
    if (isSupabaseConfigured()) {
      setIsCloudSyncing(true);
      try {
        const cloud = await supabaseService.fetchUserData(user.id);
        if (cloud) {
          if (cloud.expenses && cloud.expenses.length > 0) setExpenses(cloud.expenses);
          if (cloud.incomes && cloud.incomes.length > 0) setIncomes(cloud.incomes);
          if (cloud.archives && cloud.archives.length > 0) setArchives(cloud.archives);
          if (cloud.config) setConfig(cloud.config);
          if (cloud.supermarkets && cloud.supermarkets.length > 0) {
            setSupermarkets((prev) => Array.from(new Set([...prev, ...cloud.supermarkets])));
          }
        }
      } catch (err) {
        console.warn('Cloud sync on switchUserVault:', err);
      } finally {
        setIsCloudSyncing(false);
      }
    }
    isVaultReady.current = true;
  }, []);

  // Initialize active session on mount
  useEffect(() => {
    let isMounted = true;
    const initSession = async () => {
      const activeLocal = getActiveLocalSession();
      if (activeLocal) {
        await switchUserVault(activeLocal);
      } else if (isSupabaseConfigured() && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await switchUserVault(session.user);
        } else {
          isVaultReady.current = true;
        }
      } else {
        isVaultReady.current = true;
      }
      if (isMounted) {
        isVaultReady.current = true;
      }
    };
    initSession();
    return () => {
      isMounted = false;
    };
  }, [switchUserVault]);

  // Listen to Supabase auth changes
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured()) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        switchUserVault(session.user);
      } else if (event === 'SIGNED_OUT') {
        switchUserVault(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [switchUserVault]);

  // Persist into user-scoped AES-256 encrypted vault (only when vault is unlocked and ready)
  useEffect(() => {
    if (!isVaultReady.current) return;
    const targetUserId = currentUser?.id || 'guest_user';
    saveUserVaultItem(targetUserId, 'expenses', expenses);
  }, [expenses, currentUser?.id]);

  useEffect(() => {
    if (!isVaultReady.current) return;
    const targetUserId = currentUser?.id || 'guest_user';
    saveUserVaultItem(targetUserId, 'incomes', incomes);
  }, [incomes, currentUser?.id]);

  useEffect(() => {
    if (!isVaultReady.current) return;
    const targetUserId = currentUser?.id || 'guest_user';
    saveUserVaultItem(targetUserId, 'supermarkets', supermarkets);
  }, [supermarkets, currentUser?.id]);

  useEffect(() => {
    if (!isVaultReady.current) return;
    const targetUserId = currentUser?.id || 'guest_user';
    saveUserVaultItem(targetUserId, 'archives', archives);
  }, [archives, currentUser?.id]);

  useEffect(() => {
    if (!isVaultReady.current) return;
    const targetUserId = currentUser?.id || 'guest_user';
    saveUserVaultItem(targetUserId, 'config', config);
  }, [config, currentUser?.id]);

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

  // Automatically bundle any past-month expenses into monthly archive folders
  useEffect(() => {
    const activeKey = normalizeMonthKey(config.monthLabel);
    if (!activeKey) return;
    const olderExpenses = expenses.filter((e) => e.date && isDateOlderThanMonth(e.date, config.monthLabel));
    if (olderExpenses.length === 0) return;

    const groupedByMonth: Record<string, ExpenseItem[]> = {};
    olderExpenses.forEach((e) => {
      const key = normalizeMonthKey(e.date);
      if (!groupedByMonth[key]) groupedByMonth[key] = [];
      groupedByMonth[key].push(e);
    });

    setArchives((prevArchives) => {
      let updatedArchives = [...prevArchives];
      Object.entries(groupedByMonth).forEach(([key, items]) => {
        const monthLabel = formatMonthKeyToLabel(key);
        const existingIdx = updatedArchives.findIndex(
          (a) => normalizeMonthKey(a.monthLabel) === key
        );
        if (existingIdx !== -1) {
          const existing = updatedArchives[existingIdx];
          const existingIds = new Set(existing.expenses.map((x) => x.id));
          const newItems = items.filter((x) => !existingIds.has(x.id));
          if (newItems.length > 0) {
            const updated = {
              ...existing,
              expenses: [...existing.expenses, ...newItems],
            };
            updatedArchives[existingIdx] = updated;
            if (currentUser) supabaseService.saveArchive(currentUser.id, updated);
          }
        } else {
          const newFolder: ArchivedMonth = {
            id: `arch-${key}-${Date.now()}`,
            monthLabel,
            archivedAt: new Date().toISOString().slice(0, 10),
            config: { ...config, monthLabel },
            expenses: items,
            incomes: [],
          };
          updatedArchives = [newFolder, ...updatedArchives];
          if (currentUser) supabaseService.saveArchive(currentUser.id, newFolder);
        }
      });
      return updatedArchives;
    });

    setExpenses((prev) => prev.filter((e) => !e.date || !isDateOlderThanMonth(e.date, config.monthLabel)));
  }, [config, expenses, currentUser]);

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
      clearUserVault(currentUser.id);
    }
  };

  // Require authentication first: If no user is logged in, show the Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={switchUserVault} />;
  }

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
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              title={`Active Vault: @${currentUser.user_metadata?.username || currentUser.username || currentUser.email}`}
            >
              <ShieldCheck
                className={`h-3.5 w-3.5 text-emerald-400 ${isCloudSyncing ? 'animate-pulse' : ''}`}
              />
              <span className="hidden sm:inline">
                @{currentUser.user_metadata?.username || currentUser.username || currentUser.email?.split('@')[0]}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => switchUserVault(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition"
              title="Sign Out & Lock Vault"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign Out</span>
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
              Archives ({sortedArchives.length})
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
              lastMonthArchive={sortedArchives[0]}
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

          {/* Slide 2: Analytics */}
          <div className="w-full shrink-0 snap-start">
            <AnalyticsSlide
              expenses={expenses}
              incomes={incomes}
              archives={sortedArchives}
              config={config}
              showInr={showInr}
              onJumpToSlide={jumpToSlide}
            />
          </div>

          {/* Slide 3: Groceries */}
          <div className="w-full shrink-0 snap-start">
            <CategorySlide
              category="groceries"
              sectionIndex="Slide 03 of 06 · Groceries"
              title="Groceries"
              subtitle="Add any supermarket you shop at, filter your receipts, and track your monthly cap."
              imageSrc={SLIDE_IMAGES.groceries}
              imageAlt="Fresh British groceries and spices in a woven tote bag"
              expenses={expenses}
              archives={sortedArchives}
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

          {/* Slide 4: Travel */}
          <div className="w-full shrink-0 snap-start">
            <CategorySlide
              category="travel"
              sectionIndex="Slide 04 of 06 · Travel"
              title="Travel"
              subtitle="Daily Oyster/contactless caps, rail tickets, coaches, and rides."
              imageSrc={SLIDE_IMAGES.travel}
              imageAlt="London Underground train arriving at platform at dusk"
              expenses={expenses}
              archives={sortedArchives}
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

          {/* Slide 5: University */}
          <div className="w-full shrink-0 snap-start">
            <UniversitySlide
              expenses={expenses}
              archives={sortedArchives}
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

          {/* Slide 6: Others */}
          <div className="w-full shrink-0 snap-start">
            <OthersSlide
              expenses={expenses}
              archives={sortedArchives}
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
        archives={sortedArchives}
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
        onUserChange={switchUserVault}
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
