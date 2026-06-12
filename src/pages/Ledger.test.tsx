/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Ledger from './Ledger';
import { pb } from '../lib/pocketbase';

// Mock PocketBase client
vi.mock('../lib/pocketbase', () => {
  return {
    pb: {
      collection: vi.fn(),
      authStore: {
        isValid: true,
        model: { id: 'user_123' },
      },
    },
  };
});

describe('Ledger Component', () => {
  const mockGetList = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    vi.mocked(pb.collection).mockImplementation((collectionName: string) => {
      if (collectionName === 'time_entries') {
        return {
          getList: mockGetList,
          update: mockUpdate,
          delete: mockDelete,
        } as any;
      }
      return {} as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  test('renders historical records cleanly in a table with computed duration', async () => {
    mockGetList.mockResolvedValue({
      page: 1,
      perPage: 20,
      totalItems: 2,
      totalPages: 1,
      items: [
        {
          id: 'entry_1',
          task: 'Implement Authentication',
          space: 'Dev',
          specialization: 'Frontend',
          start_date: '2026-06-12T10:00:00.000Z',
          completion_time: '2026-06-12T12:30:00.000Z',
          completed: true,
          user: 'user_123',
        },
        {
          id: 'entry_2',
          task: 'Database Migration',
          space: 'Ops',
          specialization: 'Backend',
          start_date: '2026-06-12T14:00:00.000Z',
          completion_time: '2026-06-12T15:15:00.000Z',
          completed: true,
          user: 'user_123',
        },
      ],
    });

    render(
      <MemoryRouter>
        <Ledger />
      </MemoryRouter>
    );

    // Verify loading state or directly table content
    await waitFor(() => {
      expect(screen.getByText('Implement Authentication')).toBeInTheDocument();
    });

    expect(screen.getByText('Database Migration')).toBeInTheDocument();
    expect(screen.getByText('Dev')).toBeInTheDocument();
    expect(screen.getByText('Ops')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();

    // Check durations: 2.50h and 1.25h
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('1.25')).toBeInTheDocument();
  });

  test('prev/next pagination buttons trigger page changes', async () => {
    mockGetList.mockImplementation(async (pageParam: number) => {
      if (pageParam === 1) {
        return {
          page: 1,
          perPage: 20,
          totalItems: 25,
          totalPages: 2,
          items: Array.from({ length: 20 }, (_, i) => ({
            id: `entry_${i}`,
            task: `Task ${i}`,
            space: 'Dev',
            specialization: 'Frontend',
            start_date: '2026-06-12T10:00:00.000Z',
            completion_time: '2026-06-12T11:00:00.000Z',
            completed: true,
            user: 'user_123',
          })),
        };
      } else {
        return {
          page: 2,
          perPage: 20,
          totalItems: 25,
          totalPages: 2,
          items: Array.from({ length: 5 }, (_, i) => ({
            id: `entry_${i + 20}`,
            task: `Task ${i + 20}`,
            space: 'Dev',
            specialization: 'Frontend',
            start_date: '2026-06-12T10:00:00.000Z',
            completion_time: '2026-06-12T11:00:00.000Z',
            completed: true,
            user: 'user_123',
          })),
        };
      }
    });


    render(
      <MemoryRouter>
        <Ledger />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Task 0')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Task 20')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /prev/i });
    expect(prevButton).not.toBeDisabled();

    fireEvent.click(prevButton);

    await waitFor(() => {
      expect(screen.getByText('Task 0')).toBeInTheDocument();
    });
  });

  test('clicking edit opens modal, allows editing, and saves', async () => {
    mockGetList.mockResolvedValue({
      page: 1,
      perPage: 20,
      totalItems: 1,
      totalPages: 1,
      items: [
        {
          id: 'entry_1',
          task: 'Original Task',
          space: 'Dev',
          specialization: 'Frontend',
          start_date: '2026-06-12T10:00:00.000Z',
          completion_time: '2026-06-12T11:00:00.000Z',
          completed: true,
          user: 'user_123',
        },
      ],
    });

    render(
      <MemoryRouter>
        <Ledger />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Original Task')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Verify modal is open
    expect(screen.getByLabelText(/task/i)).toHaveValue('Original Task');

    // Edit the task field
    fireEvent.change(screen.getByLabelText(/task/i), { target: { value: 'Updated Task' } });
    
    // Save the changes
    mockUpdate.mockResolvedValue({ id: 'entry_1', task: 'Updated Task' });
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('entry_1', expect.objectContaining({
        task: 'Updated Task',
      }));
    });
  });

  test('clicking delete calls delete on PocketBase after confirm', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    mockGetList.mockResolvedValue({
      page: 1,
      perPage: 20,
      totalItems: 1,
      totalPages: 1,
      items: [
        {
          id: 'entry_1',
          task: 'Task to Delete',
          space: 'Dev',
          specialization: 'Frontend',
          start_date: '2026-06-12T10:00:00.000Z',
          completion_time: '2026-06-12T11:00:00.000Z',
          completed: true,
          user: 'user_123',
        },
      ],
    });

    render(
      <MemoryRouter>
        <Ledger />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Task to Delete')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('delete'));
    
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('entry_1');
    });
  });

  test('blocks saving and shows alert if stop time is before start time or task is empty', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    mockGetList.mockResolvedValue({
      page: 1,
      perPage: 20,
      totalItems: 1,
      totalPages: 1,
      items: [
        {
          id: 'entry_1',
          task: 'Original Task',
          space: 'Dev',
          specialization: 'Frontend',
          start_date: '2026-06-12T10:00:00.000Z',
          completion_time: '2026-06-12T11:00:00.000Z',
          completed: true,
          user: 'user_123',
        },
      ],
    });

    render(
      <MemoryRouter>
        <Ledger />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Original Task')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Test case 1: empty task name
    fireEvent.change(screen.getByLabelText(/task/i), { target: { value: '   ' } });
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Task name cannot be empty'));
    expect(mockUpdate).not.toHaveBeenCalled();

    // Test case 2: invalid chronological order
    fireEvent.change(screen.getByLabelText(/task/i), { target: { value: 'Valid Task Name' } });
    // Date/time inputs
    fireEvent.change(screen.getByLabelText(/start date & time/i), { target: { value: '2026-06-12T12:00' } });
    fireEvent.change(screen.getByLabelText(/stop date & time/i), { target: { value: '2026-06-12T10:00' } });
    
    fireEvent.click(saveButton);

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Stop date and time must be chronologically after'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
