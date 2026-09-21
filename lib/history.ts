import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isVerdict, type NutriGrade, type Verdict } from './food';

export type HistoryItem = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  verdict: Verdict;
  rating?: number | null;
  nutriscore: NutriGrade | null;
  nova: 1 | 2 | 3 | 4 | null;
  imageUrl: string | null;
  createdAt: number;
  favorite?: boolean;
  scanCount?: number;
  note?: string;
};

const KEY = 'ceres.history.v1';
const DEFAULT_CAP = 300;

let historyCap = DEFAULT_CAP;

export function setHistoryCap(n: number) {
  historyCap = Math.max(50, Math.min(2000, Math.floor(n) || DEFAULT_CAP));
}

export function getHistoryCap() {
  return historyCap;
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type Listener = (items: HistoryItem[]) => void;
const listeners = new Set<Listener>();

function emit(items: HistoryItem[]) {
  listeners.forEach((fn) => fn(items));
}

export function subscribeHistory(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function persist(items: HistoryItem[]): Promise<HistoryItem[]> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  emit(items);
  return items;
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceItem).filter((x): x is HistoryItem => !!x);
  } catch {
    return [];
  }
}

export type AddedHistoryItem = HistoryItem & {
  previousScanAt?: number;
};

export async function addHistory(
  item: Omit<HistoryItem, 'id' | 'createdAt'>
): Promise<AddedHistoryItem> {
  const entry: AddedHistoryItem = { ...item, id: uid(), createdAt: Date.now() };
  const list = await getHistory();
  const prior = list.find((h) => h.barcode === entry.barcode);
  if (prior) {
    if (prior.favorite) entry.favorite = true;
    if (prior.note && !entry.note) entry.note = prior.note;
    entry.scanCount = (prior.scanCount ?? 1) + 1;
    entry.previousScanAt = prior.createdAt;
  } else {
    entry.scanCount = 1;
  }
  const filtered = list.filter((h) => h.barcode !== entry.barcode);
  const { previousScanAt: _omit, ...stored } = entry;
  const next = [stored, ...filtered].slice(0, historyCap);
  await persist(next);
  return entry;
}

export async function removeHistory(id: string): Promise<void> {
  const list = await getHistory();
  await persist(list.filter((h) => h.id !== id));
}

export async function toggleFavorite(id: string): Promise<void> {
  const list = await getHistory();
  await persist(list.map((h) => (h.id === id ? { ...h, favorite: !h.favorite } : h)));
}

export async function updateHistory(
  id: string,
  patch: Partial<Pick<HistoryItem, 'note' | 'favorite' | 'name'>>
): Promise<void> {
  const list = await getHistory();
  await persist(
    list.map((h) => {
      if (h.id !== id) return h;
      const next = { ...h, ...patch };
      if (patch.note !== undefined) {
        next.note = patch.note.trim() ? patch.note.trim().slice(0, 280) : undefined;
      }
      return next;
    })
  );
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
  emit([]);
}

export function serializeLibrary(items: HistoryItem[]): string {
  return JSON.stringify({ app: 'ceres', version: 1, exportedAt: Date.now(), items }, null, 2);
}

export async function exportHistory(): Promise<string> {
  return serializeLibrary(await getHistory());
}

function coerceItem(raw: unknown): HistoryItem | null {
  const it = raw as Partial<HistoryItem>;
  if (!it || typeof it.barcode !== 'string' || typeof it.name !== 'string') return null;
  const verdict = isVerdict(it.verdict) ? it.verdict : 'unknown';
  const nutriscore =
    it.nutriscore === 'a' ||
    it.nutriscore === 'b' ||
    it.nutriscore === 'c' ||
    it.nutriscore === 'd' ||
    it.nutriscore === 'e'
      ? it.nutriscore
      : null;
  const nova =
    it.nova === 1 || it.nova === 2 || it.nova === 3 || it.nova === 4 ? it.nova : null;
  return {
    id: typeof it.id === 'string' ? it.id : uid(),
    barcode: it.barcode,
    name: it.name,
    brand: typeof it.brand === 'string' ? it.brand : null,
    verdict,
    rating: typeof it.rating === 'number' ? it.rating : null,
    nutriscore,
    nova,
    imageUrl: typeof it.imageUrl === 'string' ? it.imageUrl : null,
    createdAt: typeof it.createdAt === 'number' ? it.createdAt : Date.now(),
    favorite: !!it.favorite,
    scanCount: typeof it.scanCount === 'number' ? it.scanCount : undefined,
    note: typeof it.note === 'string' && it.note.trim() ? it.note.trim().slice(0, 280) : undefined,
  };
}

export async function importHistory(raw: string): Promise<number> {
  const parsed = JSON.parse(raw);
  const incoming: unknown[] = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(incoming)) throw new Error('Not a Ceres library export');

  const existing = await getHistory();
  const seen = new Set(existing.map((h) => h.barcode));
  const seenIds = new Set(existing.map((h) => h.id));
  const merged = [...existing];
  let added = 0;

  for (const row of incoming) {
    const it = coerceItem(row);
    if (!it || seen.has(it.barcode)) continue;
    seen.add(it.barcode);
    if (seenIds.has(it.id)) it.id = uid();
    seenIds.add(it.id);
    merged.push(it);
    added++;
  }

  merged.sort((a, b) => b.createdAt - a.createdAt);
  await persist(merged.slice(0, historyCap));
  return added;
}

type HistoryCtx = {
  items: HistoryItem[];
  ready: boolean;
  add: typeof addHistory;
  remove: typeof removeHistory;
  toggleFavorite: typeof toggleFavorite;
  update: typeof updateHistory;
  clear: typeof clearHistory;
  importJson: typeof importHistory;
  exportJson: typeof exportHistory;
};

const HistoryContext = createContext<HistoryCtx | null>(null);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getHistory()
      .then((list) => setItems(list))
      .catch(() => {})
      .finally(() => setReady(true));
    return subscribeHistory(setItems);
  }, []);

  const ctx = useMemo<HistoryCtx>(
    () => ({
      items,
      ready,
      add: addHistory,
      remove: removeHistory,
      toggleFavorite,
      update: updateHistory,
      clear: clearHistory,
      importJson: importHistory,
      exportJson: exportHistory,
    }),
    [items, ready]
  );

  return React.createElement(HistoryContext.Provider, { value: ctx }, children);
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used within HistoryProvider');
  return ctx;
}
