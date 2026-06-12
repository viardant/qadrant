import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TaskLogger } from './TaskLogger';

// Mock PocketBase client
vi.mock('../../lib/pocketbase', () => {
  return {
    pb: {
      collection: vi.fn().mockReturnValue({
        create: vi.fn(),
        update: vi.fn(),
      }),
      authStore: {
        model: { id: 'test_user_id' }
      }
    },
  };
});

describe('TaskLogger', () => {
  const mockOnStart = vi.fn();
  const mockOnStop = vi.fn();
  const spaces = ['Design', 'Development', 'DevOps'];
  const specializations = ['qadrant', 'infra', 'ui'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('renders inputs in idle state', () => {
    render(
      <TaskLogger
        onStart={mockOnStart}
        onStop={mockOnStop}
        activeSession={null}
        spaces={spaces}
        specializations={specializations}
      />
    );

    expect(screen.getByPlaceholderText('Task name...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Space...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Specialization...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'START' })).toBeInTheDocument();
  });

  test('clicking start calls onStart with task, space, and specialization', () => {
    render(
      <TaskLogger
        onStart={mockOnStart}
        onStop={mockOnStop}
        activeSession={null}
        spaces={spaces}
        specializations={specializations}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Task name...'), { target: { value: 'Code Logger' } });
    fireEvent.change(screen.getByPlaceholderText('Space...'), { target: { value: 'Development' } });
    fireEvent.change(screen.getByPlaceholderText('Specialization...'), { target: { value: 'qadrant' } });

    fireEvent.click(screen.getByRole('button', { name: 'START' }));

    expect(mockOnStart).toHaveBeenCalledWith('Code Logger', 'Development', 'qadrant');
  });

  test('renders ticking timer in active session state', () => {
    vi.useFakeTimers();
    const mockStartDate = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
    const activeSession = {
      id: 'session_123',
      task: 'Ticking Task',
      space: 'Design',
      specialization: 'ui',
      start_date: mockStartDate,
      completed: false,
      completion_time: null,
      user: 'test_user_id'
    };

    render(
      <TaskLogger
        onStart={mockOnStart}
        onStop={mockOnStop}
        activeSession={activeSession}
        spaces={spaces}
        specializations={specializations}
      />
    );

    // Verify task and tag labels are present
    expect(screen.getByText('Ticking Task')).toBeInTheDocument();
    expect(screen.getByText('[Design] ui')).toBeInTheDocument();

    // Check initial ticking duration
    expect(screen.getByText('00:00:05')).toBeInTheDocument();

    // Advance time by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('00:00:07')).toBeInTheDocument();

    vi.useRealTimers();
  });

  test('clicking stop calls onStop', () => {
    const activeSession = {
      id: 'session_123',
      task: 'Ticking Task',
      space: 'Design',
      specialization: 'ui',
      start_date: new Date().toISOString(),
      completed: false,
      completion_time: null,
      user: 'test_user_id'
    };

    render(
      <TaskLogger
        onStart={mockOnStart}
        onStop={mockOnStop}
        activeSession={activeSession}
        spaces={spaces}
        specializations={specializations}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'STOP_SESSION' }));
    expect(mockOnStop).toHaveBeenCalledTimes(1);
  });

  test('shows autocomplete suggestions when inputs are focused and filters them', () => {
    render(
      <TaskLogger
        onStart={mockOnStart}
        onStop={mockOnStop}
        activeSession={null}
        spaces={spaces}
        specializations={specializations}
      />
    );

    const spaceInput = screen.getByPlaceholderText('Space...');
    fireEvent.focus(spaceInput);

    // Expect default space suggestions
    expect(screen.getByText('Design')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('DevOps')).toBeInTheDocument();

    // Filter by typing
    fireEvent.change(spaceInput, { target: { value: 'Dev' } });
    expect(screen.queryByText('Design')).not.toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('DevOps')).toBeInTheDocument();

    // Selecting option sets input value
    fireEvent.click(screen.getByText('Development'));
    expect(spaceInput).toHaveValue('Development');
  });

  test('pressing Enter when suggestions are open but none is highlighted closes suggestions and does not submit', () => {
    render(
      <TaskLogger
        onStart={mockOnStart}
        onStop={mockOnStop}
        activeSession={null}
        spaces={spaces}
        specializations={specializations}
      />
    );

    const spaceInput = screen.getByPlaceholderText('Space...');
    fireEvent.focus(spaceInput);

    // Open suggestions
    expect(screen.getByText('Development')).toBeInTheDocument();

    // Hit enter
    fireEvent.keyDown(spaceInput, { key: 'Enter', code: 'Enter' });

    // Expect suggestions to be closed and onStart not called
    expect(screen.queryByText('Development')).not.toBeInTheDocument();
    expect(mockOnStart).not.toHaveBeenCalled();
  });

  test('blurring the input closes suggestions after timeout', async () => {
    vi.useFakeTimers();
    render(
      <TaskLogger
        onStart={mockOnStart}
        onStop={mockOnStop}
        activeSession={null}
        spaces={spaces}
        specializations={specializations}
      />
    );

    const spaceInput = screen.getByPlaceholderText('Space...');
    fireEvent.focus(spaceInput);

    expect(screen.getByText('Development')).toBeInTheDocument();

    fireEvent.blur(spaceInput);

    // Suggestions should still be visible before the timeout
    expect(screen.getByText('Development')).toBeInTheDocument();

    // Fast-forward timeout
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText('Development')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
