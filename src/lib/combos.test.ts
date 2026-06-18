import { describe, it, expect } from 'vitest';
import type { TimeEntry } from './time-entry';
import { classifyCategory, comboDisplayName, deriveTopCombos, filterCombos } from './combos';

const base = (overrides: Partial<TimeEntry>): TimeEntry => ({
  id: Math.random().toString(),
  space: 'Work',
  specialization: 'qadrant',
  start_date: '2026-06-18T10:00:00.000Z',
  completion_time: '2026-06-18T11:00:00.000Z',
  user: 'u',
  ...overrides,
});

describe('combos.classifyCategory', () => {
  it('classifies dev-flavoured spaces', () => {
    expect(classifyCategory('Dev', 'frontend')).toBe('DEV');
    expect(classifyCategory('qadrant', '')).toBe('DEV');
  });
  it('classifies work-flavoured spaces', () => {
    expect(classifyCategory('Work', 'meeting')).toBe('WORK');
  });
  it('classifies personal', () => {
    expect(classifyCategory('Personal', '')).toBe('PERSONAL');
  });
  it('falls back to GENERAL', () => {
    expect(classifyCategory('Piano', 'scales')).toBe('GENERAL');
  });
});

describe('combos.comboDisplayName', () => {
  it('joins space and specialization', () => {
    expect(comboDisplayName('Dev', 'frontend')).toBe('Dev / frontend');
  });
  it('handles empty specialization', () => {
    expect(comboDisplayName('Dev', '')).toBe('Dev');
  });
  it('handles empty space', () => {
    expect(comboDisplayName('', 'frontend')).toBe('frontend');
  });
});

describe('combos.deriveTopCombos', () => {
  it('returns top N combos ranked by useCount', () => {
    const entries: TimeEntry[] = [
      base({ space: 'Dev', specialization: 'frontend', start_date: '2026-06-18T10:00:00.000Z' }),
      base({ space: 'Dev', specialization: 'frontend', start_date: '2026-06-17T10:00:00.000Z' }),
      base({ space: 'Dev', specialization: 'frontend', start_date: '2026-06-16T10:00:00.000Z' }),
      base({ space: 'Work', specialization: 'meeting', start_date: '2026-06-15T10:00:00.000Z' }),
      base({ space: 'Piano', specialization: 'scales', start_date: '2026-06-14T10:00:00.000Z' }),
    ];
    const top = deriveTopCombos(entries, 3);
    expect(top).toHaveLength(3);
    expect(top[0].name).toBe('Dev / frontend');
    expect(top[0].useCount).toBe(3);
    expect(top[0].category).toBe('DEV');
  });

  it('returns empty array on empty input', () => {
    expect(deriveTopCombos([])).toEqual([]);
  });
});

describe('combos.filterCombos', () => {
  const combos = deriveTopCombos([
    base({ space: 'Dev', specialization: 'frontend' }),
    base({ space: 'Work', specialization: 'meeting' }),
    base({ space: 'Piano', specialization: 'scales' }),
  ]);

  it('returns all on empty query', () => {
    expect(filterCombos(combos, '')).toHaveLength(3);
  });

  it('matches by category', () => {
    const dev = filterCombos(combos, 'dev');
    expect(dev.length).toBe(1);
    expect(dev[0].category).toBe('DEV');
  });

  it('matches by specialization', () => {
    const matched = filterCombos(combos, 'scales');
    expect(matched).toHaveLength(1);
  });
});
