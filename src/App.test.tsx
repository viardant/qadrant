import { vi, expect, test, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock PocketBase client to prevent real network/server contact
vi.mock('./lib/pocketbase', () => {
  return {
    pb: {
      authStore: {
        isValid: false,
      },
    },
  };
});

afterEach(() => {
  vi.resetAllMocks();
});

test('redirects to login by default', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText(/CONNECT_GOOGLE_ACCOUNT/i)).toBeInTheDocument();
});
