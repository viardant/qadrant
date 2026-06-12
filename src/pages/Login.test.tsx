/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';
import { pb } from '../lib/pocketbase';

// Mock PocketBase client
vi.mock('../lib/pocketbase', () => {
  return {
    pb: {
      collection: vi.fn(),
      authStore: {
        exportToCookie: vi.fn(),
      },
    },
  };
});

describe('Login OAuth Flow', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location in jsdom
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: '',
      origin: 'http://localhost:3000',
      search: '',
    } as any;

    sessionStorage.clear();
    document.cookie = '';

    // Re-initialize default mocks
    vi.mocked(pb.collection).mockReturnValue({
      listAuthMethods: vi.fn(),
      authWithOAuth2Code: vi.fn(),
    } as any);
    vi.mocked(pb.authStore.exportToCookie).mockReturnValue('pb_auth=mocked_cookie_value; Path=/');
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    vi.resetAllMocks();
  });

  test('initiates OAuth redirect when clicking login button with URL-encoded redirect URI', async () => {
    const mockListAuthMethods = vi.fn().mockResolvedValue({
      authProviders: [
        {
          name: 'google',
          displayName: 'Google',
          state: 'mock_state_123',
          authUrl: 'https://accounts.google.com/o/oauth2/auth?client_id=123&',
          codeVerifier: 'mock_verifier_123',
          codeChallenge: 'mock_challenge_123',
          codeChallengeMethod: 'S256',
        },
      ],
    });

    vi.mocked(pb.collection).mockReturnValue({
      listAuthMethods: mockListAuthMethods,
    } as any);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: 'CONNECT_GOOGLE_ACCOUNT' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockListAuthMethods).toHaveBeenCalled();
    });

    // Verify sessionStorage parameters are stored
    expect(sessionStorage.getItem('oauth_provider')).toBe('google');
    expect(sessionStorage.getItem('oauth_verifier')).toBe('mock_verifier_123');
    expect(sessionStorage.getItem('oauth_state')).toBe('mock_state_123');

    // Verify redirection URL is correct and URL-encoded
    expect(window.location.href).toBe(
      'https://accounts.google.com/o/oauth2/auth?client_id=123&http%3A%2F%2Flocalhost%3A3000%2Flogin'
    );
  });

  test('completes OAuth code exchange when redirected back with code and state, clearing storage immediately', async () => {
    // Set up sessionStorage as if login was initiated
    sessionStorage.setItem('oauth_provider', 'google');
    sessionStorage.setItem('oauth_verifier', 'mock_verifier_123');
    sessionStorage.setItem('oauth_state', 'mock_state_123');

    // Set window.location search parameter to simulate callback params
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: 'http://localhost:3000/login?code=auth_code_999&state=mock_state_123',
      origin: 'http://localhost:3000',
      search: '?code=auth_code_999&state=mock_state_123',
    } as any;

    const mockAuthWithOAuth2Code = vi.fn().mockResolvedValue({
      token: 'session_token_xyz',
      record: { id: 'user_id_abc', email: 'test@example.com' },
    });

    vi.mocked(pb.collection).mockReturnValue({
      authWithOAuth2Code: mockAuthWithOAuth2Code,
    } as any);

    render(
      <MemoryRouter initialEntries={['/login?code=auth_code_999&state=mock_state_123']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Verify terminal-styled callback spinner is displayed
    expect(screen.getByText('COMPLETING_SIGN_IN_PROTOCOL...')).toBeInTheDocument();

    // Verify sessionStorage parameters are cleared immediately
    expect(sessionStorage.getItem('oauth_provider')).toBeNull();
    expect(sessionStorage.getItem('oauth_verifier')).toBeNull();
    expect(sessionStorage.getItem('oauth_state')).toBeNull();

    await waitFor(() => {
      // Verify authWithOAuth2Code was called with correct parameters
      expect(mockAuthWithOAuth2Code).toHaveBeenCalledWith(
        'google',
        'auth_code_999',
        'mock_verifier_123',
        'http://localhost:3000/login'
      );
    });

    // Verify cookie was written
    expect(document.cookie).toContain('pb_auth=mocked_cookie_value');

    // Verify redirected back to home
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
