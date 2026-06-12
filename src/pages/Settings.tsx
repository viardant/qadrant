import { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { TimeEntry } from '../components/logger/TaskLogger';
import { Loader2, Clipboard, Check, LogOut } from 'lucide-react';

const DEFAULT_COLORS = [
  '#35675d', // forest green
  '#56877d', // lighter forest green
  '#7ba89e', // tertiary teal
  '#1c1b1c', // charcoal
  '#ba1a1a', // crimson red
  '#994e4e', // light crimson
  '#bfa37a', // warm gold/sand
  '#8f7a5c', // dark gold/sand
  '#4a5568', // steel blue
  '#718096', // light steel blue
];

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [spaceColors, setSpaceColors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchSettingsData() {
      if (!pb.authStore.isValid) {
        setLoading(false);
        return;
      }
      try {
        // Fetch user preferences
        const user = await pb.collection('users').getOne(pb.authStore.model?.id || '');
        const currentColors = user.space_colors || {};
        setSpaceColors(currentColors);

        // Fetch completed and active entries to find all unique spaces
        const entries = await pb.collection('time_entries').getFullList<TimeEntry>({
          filter: `user = "${pb.authStore.model?.id}"`,
        });
        const uniqueSpaces = Array.from(new Set(entries.map((e) => e.space).filter(Boolean))) as string[];
        setSpaces(uniqueSpaces);
      } catch (err) {
        console.error('Failed to load user preferences:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSettingsData();
  }, []);

  const handleColorChange = async (space: string, color: string) => {
    if (!pb.authStore.model?.id) return;

    const oldColors = { ...spaceColors };
    const newMap = { ...spaceColors, [space]: color };
    setSpaceColors(newMap);

    try {
      const updatedUser = await pb.collection('users').update(pb.authStore.model.id, {
        space_colors: newMap,
      });
      pb.authStore.save(pb.authStore.token, updatedUser);
    } catch (err) {
      console.error('Failed to update space color preference:', err);
      setSpaceColors(oldColors);
      alert('Failed to save color preference.');
    }
  };


  const handleCopyToken = async () => {
    const token = pb.authStore.token;
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    // Expire auth cookie
    document.cookie = 'pb_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="loader-container">
        <Loader2 className="spinner" size={32} />
        <span className="font-mono text-sm text-on-surface/60">SYNCHRONIZING_PREFERENCES...</span>
      </div>
    );
  }

  // Get color for a space, fallback to index-based default palette
  const getSpaceColor = (space: string, index: number) => {
    return spaceColors[space] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  return (
    <div className="settings-page-container flex flex-col gap-6" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div>
        <h1 className="text-3xl font-bold font-mono" style={{ marginBottom: '0.25rem' }}>SETTINGS_PROTOCOL</h1>
        <p className="font-mono text-sm text-on-surface/60" style={{ marginBottom: 0 }}>Configure workspace mappings, preferences, and API credentials.</p>
      </div>

      {/* Space Colors Configuration */}
      <section className="settings-section">
        <h2 className="settings-section-title font-mono text-lg">SPACE_THEME_MAPPINGS</h2>
        <p className="text-sm text-on-surface/70">
          Assign specific visual markers for each space detected in your tracking history.
        </p>

        {spaces.length === 0 ? (
          <div className="font-mono text-sm text-on-surface/40 py-4 text-center border border-dashed border-outline rounded">
            NO_ACTIVE_SPACES_DETECTED_IN_HISTORY
          </div>
        ) : (
          <div className="color-picker-grid">
            {spaces.map((space, idx) => (
              <div key={space} className="color-picker-row">
                <label htmlFor={`color-${space}`}>{space}</label>
                <div className="color-input-wrapper">
                  <input
                    id={`color-${space}`}
                    type="color"
                    value={getSpaceColor(space, idx)}
                    onChange={(e) => handleColorChange(space, e.target.value)}
                    aria-label={`Color for ${space}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CLI & AI Agent Access Section */}
      <section className="settings-section">
        <h2 className="settings-section-title font-mono text-lg">CLI_AND_AI_AGENT_ACCESS</h2>
        <p className="text-sm text-on-surface/70">
          Authenticate external sessions or automated code agents using this local token. Keep it private.
        </p>

        <div className="token-copy-box">
          <div className="token-row">
            <div className="token-input" title={pb.authStore.token}>
              {pb.authStore.token || 'NO_ACTIVE_AUTH_TOKEN'}
            </div>
            <button
              onClick={handleCopyToken}
              className="flex items-center gap-1.5"
              style={{ flexShrink: 0 }}
              aria-label="Copy Token"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>COPIED</span>
                </>
              ) : (
                <>
                  <Clipboard size={16} />
                  <span>COPY</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs text-on-surface/60 uppercase">Terminal Setup Protocol</span>
          <div className="terminal-block">
            <code className="terminal-prompt">npm install -g qadrant-cli</code>
            <code className="terminal-prompt">qadrant login {copied ? '<copied-token>' : '...' }</code>
          </div>
        </div>
      </section>

      {/* Logout / Session Expiration Section */}
      <section className="settings-section">
        <h2 className="settings-section-title font-mono text-lg">TERMINATE_SESSION</h2>
        <p className="text-sm text-on-surface/70">
          Sign out of the current device. This expires cookie tokens and invalidates the browser state.
        </p>
        <div className="logout-btn-container">
          <button onClick={handleLogout} className="btn-logout flex items-center gap-2" aria-label="Logout">
            <LogOut size={16} />
            <span>LOGOUT_PROTOCOL</span>
          </button>
        </div>
      </section>
    </div>
  );
}
