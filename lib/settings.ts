import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { setHistoryCap } from './history';

export type Settings = {
  haptics: boolean;
  sound: boolean;
  saveScans: boolean;
  continuousScan: boolean;
  onboarded: boolean;
  historyCap: number;
  /** Personal allergen keywords to flag on product sheets (lowercase). */
  allergenWatch: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  sound: false,
  saveScans: true,
  continuousScan: false,
  onboarded: false,
  historyCap: 300,
  allergenWatch: [],
};

export const ALLERGEN_PRESETS = [
  'milk',
  'eggs',
  'peanuts',
  'nuts',
  'soy',
  'gluten',
  'wheat',
  'fish',
  'shellfish',
  'sesame',
  'celery',
  'mustard',
  'lupin',
  'sulphites',
  'sulfites',
] as const;

const KEY = 'ceres.settings.v1';

function coerce(raw: unknown): Settings {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const cap = typeof parsed.historyCap === 'number' ? parsed.historyCap : DEFAULT_SETTINGS.historyCap;
  const watch = Array.isArray(parsed.allergenWatch)
    ? parsed.allergenWatch
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 24)
    : [];
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    historyCap: Math.max(50, Math.min(2000, Math.floor(cap) || 300)),
    allergenWatch: watch,
  };
}

type Ctx = {
  settings: Settings;
  ready: boolean;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  toggleAllergen: (name: string) => void;
};

const SettingsContext = createContext<Ctx>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  update: () => {},
  toggleAllergen: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const next = raw ? coerce(JSON.parse(raw)) : DEFAULT_SETTINGS;
        setHistoryCap(next.historyCap);
        setSettings(next);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = (next: Settings) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  const update: Ctx['update'] = (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'historyCap') setHistoryCap(next.historyCap);
      persist(next);
      return next;
    });
  };

  const toggleAllergen = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key) return;
    setSettings((prev) => {
      const has = prev.allergenWatch.includes(key);
      const allergenWatch = has
        ? prev.allergenWatch.filter((a) => a !== key)
        : [...prev.allergenWatch, key].slice(0, 24);
      const next = { ...prev, allergenWatch };
      persist(next);
      return next;
    });
  };

  const ctx = useMemo(
    () => ({ settings, ready, update, toggleAllergen }),
    [settings, ready]
  );
  return React.createElement(SettingsContext.Provider, { value: ctx }, children);
}

export function useSettings() {
  return useContext(SettingsContext);
}

/** Match product allergens / ingredients against the user's watch list. */
export function matchWatchedAllergens(
  watch: string[],
  allergens: string[],
  ingredients: string | null
): string[] {
  if (!watch.length) return [];
  const hay = `${allergens.join(' ')} ${ingredients ?? ''}`.toLowerCase();
  return watch.filter((w) => hay.includes(w));
}
