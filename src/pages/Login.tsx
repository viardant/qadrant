import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pb } from '../lib/pocketbase';

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      const provider = sessionStorage.getItem('oauth_provider');
      const verifier = sessionStorage.getItem('oauth_verifier');
      const storedState = sessionStorage.getItem('oauth_state');

      // Clear sessionStorage parameters immediately to prevent stale state buildup
      sessionStorage.removeItem('oauth_provider');
      sessionStorage.removeItem('oauth_verifier');
      sessionStorage.removeItem('oauth_state');

      if (!provider || !verifier || !storedState) {
        setError('Missing OAuth session storage parameters.');
        return;
      }

      if (state !== storedState) {
        setError('OAuth state mismatch.');
        return;
      }

      setLoading(true);
      const redirectUrl = window.location.origin + '/login';

      pb.collection('users')
        .authWithOAuth2Code(provider, code, verifier, redirectUrl)
        .then(() => {
          // Write the pb_auth cookie with explicit security attributes
          const isSecure = window.location.protocol === 'https:';
          document.cookie = pb.authStore.exportToCookie({
            path: '/',
            secure: isSecure,
            sameSite: 'Lax',
            httpOnly: false,
          });
          // Navigate to dashboard/home
          navigate('/');
        })
        .catch((err: unknown) => {
          setError((err as Error).message || 'OAuth code exchange failed.');
          setLoading(false);
        });
    }
  }, [searchParams, navigate]);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const authMethods = await pb.collection('users').listAuthMethods();
      const googleProvider = authMethods.authProviders.find(
        (p) => p.name === 'google'
      );

      if (!googleProvider) {
        setError('Google authentication is not configured.');
        return;
      }

      sessionStorage.setItem('oauth_provider', googleProvider.name);
      sessionStorage.setItem('oauth_verifier', googleProvider.codeVerifier);
      sessionStorage.setItem('oauth_state', googleProvider.state);

      const redirectUrl = window.location.origin + '/login';
      const authUrl = googleProvider.authUrl + encodeURIComponent(redirectUrl);

      window.location.href = authUrl;
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to list auth methods.');
    }
  };

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (loading || (code && state && !error)) {
    return (
      <div className="login-callback-container">
        <div className="login-callback-text">
          COMPLETING_SIGN_IN_PROTOCOL...
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h1>Login to Apok</h1>
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      <button onClick={handleGoogleLogin}>CONNECT_GOOGLE_ACCOUNT</button>
    </div>
  );
}
