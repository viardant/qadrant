import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { BeatIndicator } from '../components/ui/BeatIndicator';

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beatIdx, setBeatIdx] = useState(0);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      const provider = sessionStorage.getItem('oauth_provider');
      const verifier = sessionStorage.getItem('oauth_verifier');
      const storedState = sessionStorage.getItem('oauth_state');

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
          const isSecure = window.location.protocol === 'https:';
          document.cookie = pb.authStore.exportToCookie({
            path: '/',
            secure: isSecure,
            sameSite: 'Lax',
            httpOnly: false,
          });
          navigate('/');
        })
        .catch((err: unknown) => {
          setError((err as Error).message || 'OAuth code exchange failed.');
          setLoading(false);
        });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setBeatIdx((i) => (i + 1) % 4), 200);
    return () => clearInterval(interval);
  }, [loading]);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const authMethods = await pb.collection('users').listAuthMethods();
      const googleProvider = authMethods.authProviders.find((p) => p.name === 'google');
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
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__wordmark login-card__wordmark--accent">
            QADRANT&nbsp;//&nbsp;SIGN_IN
          </div>
          <div className="login-card__rule" />
          <div className="login-card__callback">
            <BeatIndicator activeIndex={beatIdx} label="Completing sign in" />
            COMPLETING_SIGN_IN_PROTOCOL…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__wordmark login-card__wordmark--accent">
          QADRANT&nbsp;//&nbsp;SIGN_IN_PROTOCOL
        </div>
        <div className="login-card__rule" />
        <h1 className="login-card__title">SIGN_IN</h1>
        <p className="login-card__caption">
          AUTHENTICATE TO RESUME YOUR TRACKING ARCHIVE.
          <br />
          OAUTH-ONLY // NO PASSWORD STORED.
        </p>
        {error && <div className="login-card__error">WARN&nbsp;//&nbsp;{error}</div>}
        <button
          type="button"
          className="login-card__cta"
          onClick={handleGoogleLogin}
          aria-label="Connect Google account"
        >
          <span className="login-card__cta-caret" aria-hidden />
          ▸&nbsp;CONNECT_GOOGLE_ACCOUNT
        </button>
        <div className="login-card__footer">VERIFIED_V0.1 // QADRANT_TRACKER</div>
      </div>
    </div>
  );
}
