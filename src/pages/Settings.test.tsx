/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';
import { pb } from '../lib/pocketbase';

const mockSendBatch = vi.fn().mockResolvedValue([]);
const mockBatchUpdate = vi.fn();
const mockBatchCollection = vi.fn().mockReturnValue({
  update: mockBatchUpdate,
});
const mockCreateBatch = vi.fn().mockReturnValue({
  collection: mockBatchCollection,
  send: mockSendBatch,
});

vi.mock('../lib/pocketbase', () => {
  return {
    pb: {
      collection: vi.fn(),
      createBatch: () => mockCreateBatch(),
      authStore: {
        isValid: true,
        model: { id: 'user_123' },
        token: 'mock_token',
        save: vi.fn(),
      },
    },
  };
});

const PURGE_CONFIRM_PHRASE = 'DELETE ALL';

describe('Settings — PURGE_DATA', () => {
  const originalLocation = window.location;
  const reloadSpy = vi.fn();

  const mockGetOneUser = vi.fn();
  const mockGetFullListEntries = vi.fn();
  const mockDeleteEntry = vi.fn();
  const mockUpdateUser = vi.fn();

  beforeEach(() => {
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: '',
      reload: reloadSpy,
    } as any;

    vi.mocked(pb.collection).mockImplementation((collectionName: string) => {
      if (collectionName === 'users') {
        return {
          getOne: mockGetOneUser,
          update: mockUpdateUser,
        } as any;
      }
      if (collectionName === 'time_entries') {
        return {
          getFullList: mockGetFullListEntries,
          delete: mockDeleteEntry,
        } as any;
      }
      return {} as any;
    });

    mockGetOneUser.mockResolvedValue({ id: 'user_123', space_colors: {} });
    mockGetFullListEntries.mockResolvedValue([]);
    mockUpdateUser.mockResolvedValue({ id: 'user_123', space_colors: {} });
    mockDeleteEntry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  test('renders the PURGE_DATA section with eyebrow, title, body, and trigger button', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PURGE_DATA')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Permanently delete every time entry/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Purge all data/i }),
    ).toBeInTheDocument();
  });

  test('clicking the trigger button opens the confirmation modal', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PURGE_DATA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Purge all data/i }));

    expect(
      screen.getByRole('dialog', { name: /PURGE_DATA_PROTOCOL/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^✕\s+PURGE$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /CANCEL/i })).toBeInTheDocument();
  });

  test('PURGE button stays disabled until the confirmation phrase matches', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PURGE_DATA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Purge all data/i }));

    const confirmInput = screen.getByLabelText(
      `Type ${PURGE_CONFIRM_PHRASE} to confirm`,
    ) as HTMLInputElement;
    const purgeButton = screen.getByRole('button', { name: /^✕\s+PURGE$/i });

    expect(purgeButton).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: 'delete' } });
    expect(purgeButton).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: 'DELETE' } });
    expect(purgeButton).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: PURGE_CONFIRM_PHRASE } });
    expect(purgeButton).not.toBeDisabled();
  });

  test('CANCEL closes the modal without deleting anything', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PURGE_DATA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Purge all data/i }));
    expect(
      screen.getByRole('dialog', { name: /PURGE_DATA_PROTOCOL/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /CANCEL/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /PURGE_DATA_PROTOCOL/i }),
      ).not.toBeInTheDocument();
    });
    expect(mockDeleteEntry).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test('confirming with the phrase deletes every entry, resets space_colors, and reloads', async () => {
    const entries = Array.from({ length: 3 }, (_, i) => ({
      id: `entry_${i + 1}`,
      space: 'Dev',
      specialization: '',
      start_date: '2026-06-12T10:00:00.000Z',
      completion_time: '2026-06-12T11:00:00.000Z',
      user: 'user_123',
    }));
    mockGetFullListEntries.mockResolvedValue(entries);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PURGE_DATA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Purge all data/i }));
    const confirmInput = screen.getByLabelText(
      `Type ${PURGE_CONFIRM_PHRASE} to confirm`,
    ) as HTMLInputElement;
    fireEvent.change(confirmInput, { target: { value: PURGE_CONFIRM_PHRASE } });
    fireEvent.click(screen.getByRole('button', { name: /^✕\s+PURGE$/i }));

    await waitFor(() => {
      expect(mockGetFullListEntries).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.stringContaining('user_123') }),
      );
    });
    await waitFor(() => {
      expect(mockDeleteEntry).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('user_123', { space_colors: {} });
    });
    await waitFor(() => {
      expect(pb.authStore.save).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  test('handles empty entry list by skipping the delete loop but still resetting space_colors', async () => {
    mockGetFullListEntries.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PURGE_DATA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Purge all data/i }));
    fireEvent.change(
      screen.getByLabelText(`Type ${PURGE_CONFIRM_PHRASE} to confirm`),
      { target: { value: PURGE_CONFIRM_PHRASE } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^✕\s+PURGE$/i }));

    await waitFor(() => {
      expect(mockDeleteEntry).not.toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('user_123', { space_colors: {} });
    });
    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  test('surfaces an error and keeps the modal open when a delete fails', async () => {
    const entries = [
      {
        id: 'entry_1',
        space: 'Dev',
        specialization: '',
        start_date: '2026-06-12T10:00:00.000Z',
        completion_time: '2026-06-12T11:00:00.000Z',
        user: 'user_123',
      },
    ];
    mockGetFullListEntries.mockResolvedValue(entries);
    mockDeleteEntry.mockRejectedValueOnce(new Error('network down'));

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PURGE_DATA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Purge all data/i }));
    fireEvent.change(
      screen.getByLabelText(`Type ${PURGE_CONFIRM_PHRASE} to confirm`),
      { target: { value: PURGE_CONFIRM_PHRASE } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^✕\s+PURGE$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Purge failed\. Your data has not been changed\./i),
      ).toBeInTheDocument();
    });
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: /PURGE_DATA_PROTOCOL/i }),
    ).toBeInTheDocument();
  });

  test('reopening the modal resets the phrase and any previous error', async () => {
    const entries = [
      {
        id: 'entry_1',
        space: 'Dev',
        specialization: '',
        start_date: '2026-06-12T10:00:00.000Z',
        completion_time: '2026-06-12T11:00:00.000Z',
        user: 'user_123',
      },
    ];
    mockGetFullListEntries
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(entries);
    mockDeleteEntry.mockRejectedValueOnce(new Error('boom'));

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PURGE_DATA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Purge all data/i }));
    fireEvent.change(
      screen.getByLabelText(`Type ${PURGE_CONFIRM_PHRASE} to confirm`),
      { target: { value: PURGE_CONFIRM_PHRASE } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^✕\s+PURGE$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Purge failed\. Your data has not been changed\./i),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /CANCEL/i }));
    expect(
      screen.queryByRole('dialog', { name: /PURGE_DATA_PROTOCOL/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Purge all data/i }));
    const reopenedInput = screen.getByLabelText(
      `Type ${PURGE_CONFIRM_PHRASE} to confirm`,
    ) as HTMLInputElement;
    expect(reopenedInput.value).toBe('');
    expect(
      screen.queryByText(/Purge failed\. Your data has not been changed\./i),
    ).not.toBeInTheDocument();
  });
});

describe('Settings — Spaces and Specializations', () => {
  const mockGetOneUser = vi.fn();
  const mockGetFullListEntries = vi.fn();

  beforeEach(() => {
    vi.mocked(pb.collection).mockImplementation((collectionName: string) => {
      if (collectionName === 'users') {
        return {
          getOne: mockGetOneUser,
        } as any;
      }
      if (collectionName === 'time_entries') {
        return {
          getFullList: mockGetFullListEntries,
        } as any;
      }
      return {} as any;
    });

    mockGetOneUser.mockResolvedValue({ id: 'user_123', space_colors: { 'Design': '#ff0000' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  test('renders spaces and their specializations with rename buttons', async () => {
    mockGetFullListEntries.mockResolvedValue([
      {
        id: 'entry_1',
        space: 'Design',
        specialization: 'Figma',
        user: 'user_123',
      },
      {
        id: 'entry_2',
        space: 'Design',
        specialization: 'Illustrator',
        user: 'user_123',
      },
      {
        id: 'entry_3',
        space: 'Engineering',
        specialization: 'React',
        user: 'user_123',
      },
    ]);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Figma')).toBeInTheDocument();
    expect(screen.getByText('Illustrator')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();

    const renameButtons = screen.getAllByRole('button', { name: /\[RENAME\]/i });
    expect(renameButtons.length).toBe(5);
  });
});

