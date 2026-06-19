import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Timer from './Timer';
import { ActiveTimer } from '../components/timer/ActiveTimer';
import { NewComboSheet } from '../components/timer/NewComboSheet';
import type { TimeEntry } from '../lib/time-entry';

vi.mock('../lib/pocketbase', () => {
  return {
    pb: {
      authStore: { isValid: true, model: { id: 'u1' } },
      collection: vi.fn(() => ({
        getList: vi.fn(),
        getFullList: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      })),
    },
  };
});

import { pb } from '../lib/pocketbase';

const baseEntry = (overrides: Partial<TimeEntry>): TimeEntry => ({
  id: Math.random().toString(),
  space: 'Work',
  specialization: 'qadrant',
  start_date: '2026-06-18T10:00:00.000Z',
  completion_time: '2026-06-18T11:00:00.000Z',
  user: 'u1',
  ...overrides,
});

function renderTimer() {
  return render(
    <MemoryRouter>
      <Timer />
    </MemoryRouter>,
  );
}

describe('Timer page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('shows the top bar with the TIMER section', async () => {
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: [] }),
    }));
    renderTimer();
    expect(screen.getAllByText(/QADRANT\s*\/\/\s*TIMER/i).length).toBeGreaterThan(0);
  });

  test('renders stats strip with TODAY / STREAK / SESSIONS', async () => {
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: [] }),
    }));
    renderTimer();
    expect(screen.getByText('TODAY')).toBeInTheDocument();
    expect(screen.getByText('STREAK')).toBeInTheDocument();
    expect(screen.getByText('SESSIONS')).toBeInTheDocument();
  });

  test('renders search input with REPLAY_EXISTING_COMBO eyebrow and FAB', async () => {
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: [] }),
    }));
    renderTimer();
    expect(screen.getByText(/REPLAY_EXISTING_COMBO/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Search existing combos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New combination/i })).toBeInTheDocument();
  });

  test('shows empty state when there are no combos and opens sheet on FAB click', async () => {
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: [] }),
      create: vi.fn().mockResolvedValue({}),
    }));
    renderTimer();
    expect(await screen.findByText('ARCHIVE_EMPTY')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New combination/i }));
    expect(await screen.findByText(/NEW_COMBINATION_PROTOCOL/i)).toBeInTheDocument();
  });

  test('derives top combos from history and shows them in the list', async () => {
    const entries = [
      baseEntry({ id: '1', space: 'Dev', specialization: 'frontend' }),
      baseEntry({ id: '2', space: 'Dev', specialization: 'frontend' }),
      baseEntry({ id: '3', space: 'Dev', specialization: 'frontend' }),
      baseEntry({ id: '4', space: 'Work', specialization: 'meeting' }),
    ];
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: entries }),
      create: vi.fn().mockResolvedValue({}),
    }));
    renderTimer();
    const devFrontend = await screen.findAllByText('Dev / frontend');
    expect(devFrontend.length).toBeGreaterThan(0);
    expect(screen.getByText('03 USES')).toBeInTheDocument();
  });

  test('filters the combo list when typing in the search input', async () => {
    const entries = [
      baseEntry({ id: '1', space: 'Dev', specialization: 'frontend' }),
      baseEntry({ id: '2', space: 'Work', specialization: 'meeting' }),
    ];
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: entries }),
    }));
    renderTimer();
    const quickReplay = screen.getByLabelText('Quick replay');
    await within(quickReplay).findByText('Dev / frontend');
    const input = screen.getByLabelText('Search existing combos');
    fireEvent.change(input, { target: { value: 'meeting' } });
    expect(within(quickReplay).queryByText('Dev / frontend')).not.toBeInTheDocument();
    expect(within(quickReplay).getByText('Work / meeting')).toBeInTheDocument();
  });

  test('Cmd+K (and Ctrl+K) focuses the search input', async () => {
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: [] }),
    }));
    renderTimer();
    const input = await screen.findByLabelText('Search existing combos');
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(input);

    // Reset focus and try Ctrl+K
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  test('Cmd+K selects existing text in the search input', async () => {
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: [] }),
    }));
    renderTimer();
    const input = await screen.findByLabelText('Search existing combos') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'partial' } });
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  test('shows active timer when a session is running, and STOP fires onStop', async () => {
    const start = new Date(Date.now() - 5_000).toISOString();
    const entries = [
      baseEntry({
        id: 'active-1',
        space: 'Dev',
        specialization: 'frontend',
        start_date: start,
        completion_time: null,
      }),
    ];
    const update = vi.fn().mockResolvedValue({});
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: entries }),
      update,
    }));
    renderTimer();
    expect(await screen.findByText('00:00:05')).toBeInTheDocument();
    const stopBtn = screen.getByRole('button', { name: /Stop session/i });
    await act(async () => {
      fireEvent.click(stopBtn);
    });
    expect(update).toHaveBeenCalled();
  });

  test('tapping a QUICK_REPLAY card while a different timer is running starts an additional timer', async () => {
    const start = new Date(Date.now() - 5_000).toISOString();
    const entries = [
      baseEntry({
        id: 'active-1',
        space: 'Dev',
        specialization: 'frontend',
        start_date: start,
        completion_time: null,
      }),
      baseEntry({ id: 'h-1', space: 'Work', specialization: 'meeting' }),
    ];
    const create = vi.fn().mockResolvedValue({});
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: entries }),
      create,
    }));
    const { unmount } = renderTimer();
    await screen.findByText('00:00:05');
    const quickReplay = screen.getByLabelText('Quick replay');
    const card = await within(quickReplay).findByText('Work / meeting');
    const cardButton = card.closest('button');
    expect(cardButton).not.toBeNull();
    await act(async () => {
      fireEvent.click(cardButton as HTMLElement);
    });
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ space: 'Work', specialization: 'meeting' }),
      );
    });
    unmount();
  });

  test('tapping a QUICK_REPLAY card whose combo is already running shows SAME_PROTOCOLS_SKIP and does not create', async () => {
    const start = new Date(Date.now() - 5_000).toISOString();
    const entries = [
      baseEntry({
        id: 'active-1',
        space: 'Dev',
        specialization: 'frontend',
        start_date: start,
        completion_time: null,
      }),
    ];
    const create = vi.fn().mockResolvedValue({});
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: entries }),
      create,
    }));
    const { unmount } = renderTimer();
    await screen.findByText('00:00:05');
    const quickReplay = screen.getByLabelText('Quick replay');
    const card = await within(quickReplay).findByText('Dev / frontend');
    const cardButton = card.closest('button');
    expect(cardButton).not.toBeNull();
    await act(async () => {
      fireEvent.click(cardButton as HTMLElement);
    });
    await waitFor(() => {
      expect(screen.getByText(/SAME_PROTOCOLS_SKIP/i)).toBeInTheDocument();
    });
    expect(create).not.toHaveBeenCalled();
    unmount();
  });
});

describe('ActiveTimer', () => {
  test('renders the elapsed time for an active session', () => {
    const start = new Date(Date.now() - 5_000).toISOString();
    const session = baseEntry({
      id: 's',
      start_date: start,
      completion_time: null,
    });
    render(<ActiveTimer session={session} onStop={() => {}} />);
    expect(screen.getByText('00:00:05')).toBeInTheDocument();
  });

  test('STOP button triggers onStop with the session id', () => {
    const onStop = vi.fn();
    const session = baseEntry({
      id: 'session-42',
      start_date: new Date().toISOString(),
      completion_time: null,
    });
    render(<ActiveTimer session={session} onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: /Stop session/i }));
    expect(onStop).toHaveBeenCalledWith('session-42');
  });
});

describe('NewComboSheet', () => {
  test('disables submit when space and specialization are both empty', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<NewComboSheet open onClose={onClose} onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: /START|SEED/i });
    expect(submit).toBeDisabled();
  });

  test('submits the form with entered values', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<NewComboSheet open onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/QUIZAPP/i), { target: { value: 'QuizApp' } });
    fireEvent.change(screen.getByPlaceholderText(/^DEV/i), { target: { value: 'Dev' } });
    fireEvent.change(screen.getByPlaceholderText(/FRONTEND/i), { target: { value: 'frontend' } });
    const form = document.getElementById('new-combo-form') as HTMLFormElement;
    fireEvent.submit(form, { preventDefault: () => {} });
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'QuizApp',
      space: 'Dev',
      specialization: 'frontend',
      start: true,
    });
  });

  test('CANCEL button closes the sheet', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<NewComboSheet open onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /CANCEL/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test('renders inside a dialog with title', () => {
    render(<NewComboSheet open onClose={() => {}} onSubmit={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/NEW_COMBINATION_PROTOCOL/i)).toBeInTheDocument();
  });
});
