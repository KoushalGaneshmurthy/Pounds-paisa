export interface FxRateResult {
  rate: number;
  date: string;
  isLive: boolean;
}

const FX_CACHE_KEY = 'poundwise_fx_rate_cache_v1';

export function getCachedFxRate(fallbackRate = 0): FxRateResult {
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.rate === 'number' && parsed.rate > 10) {
        return {
          rate: parsed.rate,
          date: parsed.date || 'Cached rate',
          isLive: Boolean(parsed.isLive),
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { rate: fallbackRate, date: '', isLive: false };
}

export async function fetchDailyGbpToInrRate(dateIso?: string): Promise<FxRateResult | null> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    // Frankfurter only serves historical dates <= today; future/demo dates use latest live rate
    const useLatest = !dateIso || dateIso >= todayStr;
    const endpoint = useLatest
      ? 'https://api.frankfurter.app/latest?from=GBP&to=INR'
      : `https://api.frankfurter.app/${dateIso}?from=GBP&to=INR`;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);

    const res = await fetch(endpoint, { signal: controller.signal });
    window.clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    const inr = data?.rates?.INR;
    if (typeof inr === 'number' && inr > 10) {
      const result: FxRateResult = {
        rate: Math.round(inr * 100) / 100,
        date: data.date || todayStr,
        isLive: true,
      };
      if (useLatest) {
        try {
          localStorage.setItem(FX_CACHE_KEY, JSON.stringify(result));
        } catch {
          // ignore
        }
      }
      return result;
    }
  } catch {
    // Offline or blocked; fallback gracefully
  }
  return null;
}
