/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';
import { pb } from '../lib/pocketbase';

vi.mock('../lib/pocketbase', () => {
  return {
    pb: {
      collection: vi.fn(),
      authStore: {
        isValid: true,
        model: { id: 'user_123' },
        token: 'mock_token',
        save: vi.fn(),
      },
      filter: (raw: string, params: Record<string, string>) => {
        let result = raw;
        for (const [key, value] of Object.entries(params || {})) {
          result = result.replace(`{:${key}}`, `"${value}"`);
        }
        return result;
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
  const originalLocation = window.location;
  const reloadSpy = vi.fn();
  const mockGetOneUser = vi.fn();
  const mockGetFullListEntries = vi.fn();
  const mockUpdateUser = vi.fn();
  const mockUpdateEntry = vi.fn();

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
          update: mockUpdateEntry,
        } as any;
      }
      return {} as any;
    });

    mockGetOneUser.mockResolvedValue({ id: 'user_123', space_colors: { 'Design': '#ff0000' } });
    mockUpdateUser.mockResolvedValue({ id: 'user_123', space_colors: {} });
    mockUpdateEntry.mockResolvedValue({});
  });

  afterEach(() => {
    (window as any).location = originalLocation;
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

  test('renders spaces and their specializations sorted alphabetically', async () => {
    mockGetFullListEntries.mockResolvedValue([
      {
        id: 'entry_1',
        space: 'Engineering',
        specialization: 'React',
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
        space: 'Design',
        specialization: 'Figma',
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
    
    // Check that Design comes before Engineering in the DOM
    const designEl = screen.getByText('Design');
    const engineeringEl = screen.getByText('Engineering');
    expect(designEl.compareDocumentPosition(engineeringEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    
    // Check that Figma comes before Illustrator in the DOM
    const figmaEl = screen.getByText('Figma');
    const illustratorEl = screen.getByText('Illustrator');
    expect(figmaEl.compareDocumentPosition(illustratorEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('clicking space [RENAME] button opens rename space modal', async () => {
    mockGetFullListEntries.mockResolvedValue([
      {
        id: 'entry_1',
        space: 'WORK',
        specialization: 'Figma',
        user: 'user_123',
      },
    ]);
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('WORK')).toBeInTheDocument();
    });
    const renameBtns = screen.getAllByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtns[0]); // Click first rename button (space level)
    expect(screen.getByText('NEW SPACE NAME')).toBeInTheDocument();
  });

  test('clicking specialization [RENAME] button opens rename spec modal', async () => {
    mockGetFullListEntries.mockResolvedValue([
      {
        id: 'entry_1',
        space: 'WORK',
        specialization: 'Figma',
        user: 'user_123',
      },
    ]);
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('WORK')).toBeInTheDocument();
    });
    const renameBtns = screen.getAllByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtns[1]); // Click second rename button (spec level)
    expect(screen.getByText('NEW SPECIALIZATION NAME')).toBeInTheDocument();
  });

  test('Success path for Space rename', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
      { id: 'entry_2', space: 'Design', specialization: 'Illustrator', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);
    mockUpdateUser.mockResolvedValue({ id: 'user_123', space_colors: { 'Creatives': '#ff0000' } });

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    const designContainer = screen.getByText('Design').parentElement!;
    const renameBtn = within(designContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtn);

    expect(screen.getByText('NEW SPACE NAME')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Creatives' } });

    const submitBtn = screen.getByRole('button', { name: />>> EXECUTE_RENAME/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockGetFullListEntries).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter: 'user = "user_123" && space = "Design"' }),
      );
    });

    await waitFor(() => {
      expect(mockUpdateEntry).toHaveBeenCalledWith('entry_1', { space: 'Creatives' });
      expect(mockUpdateEntry).toHaveBeenCalledWith('entry_2', { space: 'Creatives' });
    });

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('user_123', {
        space_colors: { Creatives: '#ff0000' },
      });
      expect(pb.authStore.save).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  test('Success path for Specialization rename', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Figma')).toBeInTheDocument();
    });

    const figmaContainer = screen.getByText('Figma').parentElement!;
    const renameBtn = within(figmaContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtn);

    expect(screen.getByText('NEW SPECIALIZATION NAME')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'UI/UX' } });

    const submitBtn = screen.getByRole('button', { name: />>> EXECUTE_RENAME/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockGetFullListEntries).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter: 'user = "user_123" && space = "Design" && specialization = "Figma"' }),
      );
    });

    await waitFor(() => {
      expect(mockUpdateEntry).toHaveBeenCalledWith('entry_1', { specialization: 'UI/UX' });
    });

    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  test('Cancel buttons close the rename modals', async () => {
    mockGetFullListEntries.mockResolvedValue([
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
    ]);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    // Space Rename Modal Cancel
    const designContainer = screen.getByText('Design').parentElement!;
    const spaceRenameBtn = within(designContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(spaceRenameBtn);
    expect(screen.getByText('NEW SPACE NAME')).toBeInTheDocument();

    const spaceCancelBtn = screen.getByRole('button', { name: /CANCEL/i });
    fireEvent.click(spaceCancelBtn);
    await waitFor(() => {
      expect(screen.queryByText('NEW SPACE NAME')).not.toBeInTheDocument();
    });

    // Spec Rename Modal Cancel
    const figmaContainer = screen.getByText('Figma').parentElement!;
    const specRenameBtn = within(figmaContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(specRenameBtn);
    expect(screen.getByText('NEW SPECIALIZATION NAME')).toBeInTheDocument();

    const specCancelBtn = screen.getByRole('button', { name: /CANCEL/i });
    fireEvent.click(specCancelBtn);
    await waitFor(() => {
      expect(screen.queryByText('NEW SPECIALIZATION NAME')).not.toBeInTheDocument();
    });
  });

  test('Disabled states for submit buttons in rename modals', async () => {
    mockGetFullListEntries.mockResolvedValue([
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
    ]);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    // Space modal disabled states
    const designContainer = screen.getByText('Design').parentElement!;
    const spaceRenameBtn = within(designContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(spaceRenameBtn);

    const spaceInput = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    const spaceSubmitBtn = screen.getByRole('button', { name: />>> EXECUTE_RENAME/i });

    // Disabled initially (matches current name 'Design')
    expect(spaceSubmitBtn).toBeDisabled();

    // Disabled when empty
    fireEvent.change(spaceInput, { target: { value: '' } });
    expect(spaceSubmitBtn).toBeDisabled();

    fireEvent.change(spaceInput, { target: { value: '   ' } });
    expect(spaceSubmitBtn).toBeDisabled();

    // Enabled with a new name
    fireEvent.change(spaceInput, { target: { value: 'Development' } });
    expect(spaceSubmitBtn).not.toBeDisabled();

    // Close space modal
    fireEvent.click(screen.getByRole('button', { name: /CANCEL/i }));

    // Spec modal disabled states
    const figmaContainer = screen.getByText('Figma').parentElement!;
    const specRenameBtn = within(figmaContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(specRenameBtn);

    const specInput = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    const specSubmitBtn = screen.getByRole('button', { name: />>> EXECUTE_RENAME/i });

    // Disabled initially (matches current name 'Figma')
    expect(specSubmitBtn).toBeDisabled();

    // Disabled when empty
    fireEvent.change(specInput, { target: { value: '' } });
    expect(specSubmitBtn).toBeDisabled();

    // Enabled with a new name
    fireEvent.change(specInput, { target: { value: 'Sketch' } });
    expect(specSubmitBtn).not.toBeDisabled();
  });

  test('Allows case-only renaming for Space and Specialization', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'WORK', specialization: 'FIGMA', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);
    mockUpdateUser.mockResolvedValue({ id: 'user_123', space_colors: { 'Work': '#ff0000' } });

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('WORK')).toBeInTheDocument();
    });

    // Rename Space WORK -> Work
    const workContainer = screen.getByText('WORK').parentElement!;
    const spaceRenameBtn = within(workContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(spaceRenameBtn);

    const spaceDialog = screen.getByRole('dialog', { name: /RENAME_SPACE_PROTOCOL/i });
    const spaceInput = within(spaceDialog).getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(spaceInput, { target: { value: 'Work' } });

    const spaceSubmitBtn = within(spaceDialog).getByRole('button', { name: />>> EXECUTE_RENAME/i });
    expect(spaceSubmitBtn).not.toBeDisabled();
    fireEvent.click(spaceSubmitBtn);

    await waitFor(() => {
      expect(mockUpdateEntry).toHaveBeenCalledWith('entry_1', { space: 'Work' });
    });
  });

  test('Allows case-only renaming for Specialization', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'WORK', specialization: 'FIGMA', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('FIGMA')).toBeInTheDocument();
    });

    // Rename Specialization FIGMA -> Figma
    const figmaContainer = screen.getByText('FIGMA').parentElement!;
    const specRenameBtn = within(figmaContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(specRenameBtn);

    const specDialog = screen.getByRole('dialog', { name: /RENAME_SPECIALIZATION_PROTOCOL/i });
    const specInput = within(specDialog).getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(specInput, { target: { value: 'Figma' } });

    const specSubmitBtn = within(specDialog).getByRole('button', { name: />>> EXECUTE_RENAME/i });
    expect(specSubmitBtn).not.toBeDisabled();
    fireEvent.click(specSubmitBtn);

    await waitFor(() => {
      expect(mockUpdateEntry).toHaveBeenCalledWith('entry_1', { specialization: 'Figma' });
    });
  });

  test('Displays duplicate space error', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
      { id: 'entry_2', space: 'Engineering', specialization: 'React', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    const designContainer = screen.getByText('Design').parentElement!;
    const spaceRenameBtn = within(designContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(spaceRenameBtn);

    const spaceInput = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(spaceInput, { target: { value: 'Engineering' } });

    const spaceSubmitBtn = screen.getByRole('button', { name: />>> EXECUTE_RENAME/i });
    fireEvent.click(spaceSubmitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('A space with this name already exists.');
    });
    expect(mockUpdateEntry).not.toHaveBeenCalled();
  });

  test('Displays duplicate specialization error', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
      { id: 'entry_2', space: 'Design', specialization: 'Sketch', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Figma')).toBeInTheDocument();
    });

    const figmaContainer = screen.getByText('Figma').parentElement!;
    const specRenameBtn = within(figmaContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(specRenameBtn);

    const specInput = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(specInput, { target: { value: 'Sketch' } });

    const specSubmitBtn = screen.getByRole('button', { name: />>> EXECUTE_RENAME/i });
    fireEvent.click(specSubmitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('A specialization with this name already exists in this space.');
    });
    expect(mockUpdateEntry).not.toHaveBeenCalled();
  });

  test('Displays error message when space rename fails', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);
    mockUpdateEntry.mockRejectedValueOnce(new Error('Update failed'));

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    const designContainer = screen.getByText('Design').parentElement!;
    const renameBtn = within(designContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtn);

    const input = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Creatives' } });

    const submitBtn = screen.getByRole('button', { name: />>> EXECUTE_RENAME/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Rename failed. Please retry.');
    });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test('Displays error message when specialization rename fails', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);
    mockUpdateEntry.mockRejectedValueOnce(new Error('Update failed'));

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Figma')).toBeInTheDocument();
    });

    const figmaContainer = screen.getByText('Figma').parentElement!;
    const renameBtn = within(figmaContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtn);

    const input = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'UI/UX' } });

    const submitBtn = screen.getByRole('button', { name: />>> EXECUTE_RENAME/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Rename failed. Please retry.');
    });
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});


