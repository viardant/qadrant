import type { TimeEntry } from './time-entry';

export interface Combo {
  id: string;
  space: string;
  specialization: string;
  name: string;
  category: string;
  useCount: number;
  lastUsed: string;
}

const DEV_TOKENS = ['dev', 'frontend', 'backend', 'infra', 'engineering', 'qadrant'];
const WORK_TOKENS = ['work', 'meeting', 'admin', 'review', 'planning'];
const PERSONAL_TOKENS = ['personal', 'life', 'health'];

export function classifyCategory(space: string, specialization: string): string {
  const haystack = `${space} ${specialization}`.toLowerCase();
  if (DEV_TOKENS.some((t) => haystack.includes(t))) return 'DEV';
  if (WORK_TOKENS.some((t) => haystack.includes(t))) return 'WORK';
  if (PERSONAL_TOKENS.some((t) => haystack.includes(t))) return 'PERSONAL';
  return 'GENERAL';
}

export function comboDisplayName(space: string, specialization: string): string {
  if (!specialization) return space || 'Untitled';
  if (!space) return specialization;
  return `${space} / ${specialization}`;
}

function groupKey(space: string, specialization: string): string {
  return `${space.trim().toLowerCase()}|||${specialization.trim().toLowerCase()}`;
}

export function deriveTopCombos(
  entries: TimeEntry[],
  limit = 6,
): Combo[] {
  const map = new Map<string, Combo>();
  for (const e of entries) {
    const key = groupKey(e.space, e.specialization);
    const existing = map.get(key);
    if (existing) {
      existing.useCount += 1;
      if (new Date(e.start_date).getTime() > new Date(existing.lastUsed).getTime()) {
        existing.lastUsed = e.start_date;
      }
    } else {
      map.set(key, {
        id: key,
        space: e.space,
        specialization: e.specialization,
        name: comboDisplayName(e.space, e.specialization),
        category: classifyCategory(e.space, e.specialization),
        useCount: 1,
        lastUsed: e.start_date,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.useCount - a.useCount || new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
    .slice(0, limit);
}

export function filterCombos(combos: Combo[], query: string): Combo[] {
  const q = query.trim().toLowerCase();
  if (!q) return combos;
  return combos.filter((c) =>
    [c.name, c.space, c.specialization, c.category]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}
