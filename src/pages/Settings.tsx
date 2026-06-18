import { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import type { TimeEntry } from '../lib/time-entry';
import { TopBar } from '../components/ui/TopBar';
import { BeatIndicator } from '../components/ui/BeatIndicator';
import { Eyebrow } from '../components/ui/Eyebrow';
import { EmptyState } from '../components/ui/EmptyState';

const DEFAULT_COLORS = [
  '#35675d', // forest green (accent)
  '#56877d',
  '#7ba89e',
  '#1a1a1a',
  '#b58a2b', // warn
  '#8b2e2a', // error
  '#bfa37a',
  '#8f7a5c',
  '#5a5852',
  '#8a8780',
];

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [spaceColors, setSpaceColors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [beatIdx, setBeatIdx] = useState(0);

  useEffect(() => {
    async function fetchSettingsData() {
      if (!pb.authStore.isValid) {
        setLoading(false);
        return;
      }
      try {
        const user = await pb.collection('users').getOne(pb.authStore.model?.id || '');
        const currentColors = user.space_colors || {};
        setSpaceColors(currentColors);

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

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setBeatIdx((i) => (i + 1) % 4), 200);
    return () => clearInterval(interval);
  }, [loading]);

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
    document.cookie = 'pb_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.reload();
  };

  const getSpaceColor = (space: string, index: number) => {
    return spaceColors[space] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  return (
    <>
      <TopBar section="SETTINGS" timestamp={loading ? null : 'VERIFIED_V0.1'} />
      {loading ? (
        <div
          className="section"
          style={{ alignItems: 'center', padding: 'var(--space-12) 0', gap: 'var(--space-4)' }}
        >
          <BeatIndicator activeIndex={beatIdx} label="Synchronizing" />
          <span className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
            SYNCHRONIZING_PREFERENCES…
          </span>
        </div>
      ) : (
        <>
          <section className="settings-section">
            <Eyebrow>▸&nbsp;&nbsp;SPACE_THEME_MAPPINGS</Eyebrow>
            <h2 className="settings-section__title">SPACE_THEME_MAPPINGS</h2>
            <p className="settings-section__body">
              Assign a marker for each space detected in your tracking history. The accent
              teal is reserved for active state.
            </p>
            {spaces.length === 0 ? (
              <EmptyState
                title="NO_ACTIVE_SPACES"
                message="NO_SPACES_DETECTED_IN_HISTORY"
              />
            ) : (
              <div className="color-grid">
                {spaces.map((space, idx) => (
                  <div key={space} className="color-row">
                    <span className="color-row__label">{space}</span>
                    <label
                      className="color-row__swatch"
                      style={{ background: getSpaceColor(space, idx) }}
                      aria-label={`Color for ${space}`}
                    >
                      <input
                        type="color"
                        value={getSpaceColor(space, idx)}
                        onChange={(e) => handleColorChange(space, e.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="settings-section">
            <Eyebrow>▸&nbsp;&nbsp;CLI_AND_AI_AGENT_ACCESS</Eyebrow>
            <h2 className="settings-section__title">CLI_AND_AI_AGENT_ACCESS</h2>
            <p className="settings-section__body">
              Authenticate external sessions or automated code agents with this token. Keep it
              private.
            </p>
            <div className="token-row">
              <div className="token-row__value" title={pb.authStore.token}>
                {pb.authStore.token || 'NO_ACTIVE_AUTH_TOKEN'}
              </div>
              <button
                type="button"
                className="btn"
                onClick={handleCopyToken}
                aria-label="Copy token"
              >
                {copied ? '✓ COPIED' : 'COPY'}
              </button>
            </div>
            <Eyebrow muted>TERMINAL_SETUP</Eyebrow>
            <pre className="terminal-block">
              <span className="terminal-block__prompt">npm install -g qadrant-cli</span>
              {'\n'}
              <span className="terminal-block__prompt">
                qadrant login {copied ? '<copied-token>' : '...'}
              </span>
            </pre>
          </section>

          <section className="settings-section">
            <Eyebrow>▸&nbsp;&nbsp;TERMINATE_SESSION</Eyebrow>
            <h2 className="settings-section__title">TERMINATE_SESSION</h2>
            <p className="settings-section__body">
              Sign out of the current device. This expires cookie tokens and invalidates the
              browser state.
            </p>
            <div>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleLogout}
                aria-label="Logout"
              >
                ✕&nbsp;&nbsp;LOGOUT_PROTOCOL
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
