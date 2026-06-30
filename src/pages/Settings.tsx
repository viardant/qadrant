import { useState, useEffect, useRef } from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { pb } from '../lib/pocketbase';
import type { TimeEntry } from '../lib/time-entry';
import { TopBar } from '../components/ui/TopBar';
import { BeatIndicator } from '../components/ui/BeatIndicator';
import { Eyebrow } from '../components/ui/Eyebrow';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

const PURGE_CONFIRM_PHRASE = 'DELETE ALL';
const PURGE_BATCH_SIZE = 10;
const RENAME_BATCH_SIZE = 100;

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

interface SpaceDetail {
  name: string;
  specializations: string[];
}

async function runWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    console.warn(`Request failed. Retrying in ${delayMs}ms...`, err);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return runWithRetry(fn, retries - 1, delayMs * 2 + Math.floor(Math.random() * (delayMs * 0.1)));
  }
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [spaceDetails, setSpaceDetails] = useState<SpaceDetail[]>([]);
  const [spaceColors, setSpaceColors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [beatIdx, setBeatIdx] = useState(0);
  const { isMobile, isDesktop } = useBreakpoint();

  const [renameTargetSpace, setRenameTargetSpace] = useState<string | null>(null);
  const [renameTargetSpec, setRenameTargetSpec] = useState<{ space: string; spec: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [renameInProgress, setRenameInProgress] = useState(false);
  const [renameProgressText, setRenameProgressText] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const [manageSpecsTarget, setManageSpecsTarget] = useState<SpaceDetail | null>(null);
  const [specSearchQuery, setSpecSearchQuery] = useState('');

  const handleOpenManageSpecs = (spaceDetail: SpaceDetail) => {
    setManageSpecsTarget(spaceDetail);
    setSpecSearchQuery('');
  };

  const handleCloseManageSpecs = () => {
    setManageSpecsTarget(null);
    setSpecSearchQuery('');
  };

  const handleOpenRenameSpace = (spaceName: string) => {
    setRenameTargetSpace(spaceName);
    setNewName(spaceName);
    setRenameError(null);
  };

  const handleOpenRenameSpec = (spaceName: string, specName: string) => {
    setRenameTargetSpec({ space: spaceName, spec: specName });
    setNewName(specName);
    setRenameError(null);
  };

  const handleCloseRename = () => {
    if (renameInProgress) return;
    setRenameTargetSpace(null);
    setRenameTargetSpec(null);
    setNewName('');
    setRenameError(null);
  };

  const executeRenameSpace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pb.authStore.model?.id || !renameTargetSpace) return;
    const targetNew = newName.trim();
    if (!targetNew || targetNew === renameTargetSpace) return;

    setRenameInProgress(true);
    setRenameError(null);
    setRenameProgressText('FETCHING_RECORDS…');

    let updatedSome = false;
    try {
      const entries = await pb.collection('time_entries').getFullList<TimeEntry>({
        filter: pb.filter('user = {:userId} && space = {:space}', {
          userId: pb.authStore.model.id,
          space: renameTargetSpace,
        }),
      });

      const totalSteps = Math.ceil(entries.length / RENAME_BATCH_SIZE);

      for (let i = 0; i < entries.length; i += RENAME_BATCH_SIZE) {
        const batchItems = entries.slice(i, i + RENAME_BATCH_SIZE);
        const currentStep = Math.floor(i / RENAME_BATCH_SIZE) + 1;
        setRenameProgressText(`MIGRATING_RECORDS // STEP ${currentStep} OF ${totalSteps || 1}…`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batch = (pb as any).createBatch();
        for (const entry of batchItems) {
          batch.collection('time_entries').update(entry.id, { space: targetNew });
        }

        await runWithRetry(() => batch.send());
        updatedSome = true;
      }

      // Update color settings if they exist
      setRenameProgressText('UPDATING_PREFERENCES…');
      const updatedColors = { ...spaceColors };
      if (updatedColors[renameTargetSpace]) {
        // If target space doesn't have a color, migrate the old one
        if (!updatedColors[targetNew]) {
          updatedColors[targetNew] = updatedColors[renameTargetSpace];
        }
        delete updatedColors[renameTargetSpace];
        const updatedUser = await pb.collection('users').update(pb.authStore.model.id, {
          space_colors: updatedColors,
        });
        pb.authStore.save(pb.authStore.token, updatedUser);
        setSpaceColors(updatedColors);
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setRenameError('Rename failed. Please retry.');
      setRenameInProgress(false);
      if (updatedSome) {
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  };

  const executeRenameSpec = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pb.authStore.model?.id || !renameTargetSpec) return;
    const targetNew = newName.trim();
    const { space, spec: oldSpec } = renameTargetSpec;
    if (!targetNew || targetNew === oldSpec) return;

    setRenameInProgress(true);
    setRenameError(null);
    setRenameProgressText('FETCHING_RECORDS…');

    let updatedSome = false;
    try {
      const entries = await pb.collection('time_entries').getFullList<TimeEntry>({
        filter: pb.filter('user = {:userId} && space = {:space} && specialization = {:spec}', {
          userId: pb.authStore.model.id,
          space: space,
          spec: oldSpec,
        }),
      });

      const totalSteps = Math.ceil(entries.length / RENAME_BATCH_SIZE);

      for (let i = 0; i < entries.length; i += RENAME_BATCH_SIZE) {
        const batchItems = entries.slice(i, i + RENAME_BATCH_SIZE);
        const currentStep = Math.floor(i / RENAME_BATCH_SIZE) + 1;
        setRenameProgressText(`MIGRATING_RECORDS // STEP ${currentStep} OF ${totalSteps || 1}…`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batch = (pb as any).createBatch();
        for (const entry of batchItems) {
          batch.collection('time_entries').update(entry.id, { specialization: targetNew });
        }

        await runWithRetry(() => batch.send());
        updatedSome = true;
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setRenameError('Rename failed. Please retry.');
      setRenameInProgress(false);
      if (updatedSome) {
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  };

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgePhrase, setPurgePhrase] = useState('');
  const [purgeInProgress, setPurgeInProgress] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const purgeInputRef = useRef<HTMLInputElement | null>(null);

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
        
        const spaceSpecMap = new Map<string, Set<string>>();

        for (const entry of entries) {
          if (entry.space) {
            if (!spaceSpecMap.has(entry.space)) {
              spaceSpecMap.set(entry.space, new Set());
            }
            if (entry.specialization) {
              spaceSpecMap.get(entry.space)!.add(entry.specialization);
            }
          }
        }

        const detailsList: SpaceDetail[] = Array.from(spaceSpecMap.keys())
          .sort((a, b) => a.localeCompare(b))
          .map((spaceName) => ({
            name: spaceName,
            specializations: Array.from(spaceSpecMap.get(spaceName) || []).sort((a, b) => a.localeCompare(b)),
          }));

        setSpaceDetails(detailsList);
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

  const openPurge = () => {
    setPurgePhrase('');
    setPurgeError(null);
    setPurgeOpen(true);
  };

  const closePurge = () => {
    if (purgeInProgress) return;
    setPurgeOpen(false);
    setPurgePhrase('');
    setPurgeError(null);
  };

  const handlePurge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purgeInProgress) return;
    if (purgePhrase !== PURGE_CONFIRM_PHRASE) {
      setPurgeError(`Type ${PURGE_CONFIRM_PHRASE} to confirm.`);
      return;
    }
    const userId = pb.authStore.model?.id;
    if (!userId) {
      setPurgeError('Not authenticated.');
      return;
    }
    setPurgeInProgress(true);
    setPurgeError(null);
    try {
      const entries = await pb.collection('time_entries').getFullList<TimeEntry>({
        filter: `user = "${userId}"`,
      });
      for (let i = 0; i < entries.length; i += PURGE_BATCH_SIZE) {
        const batch = entries.slice(i, i + PURGE_BATCH_SIZE);
        await Promise.all(
          batch.map((entry) => pb.collection('time_entries').delete(entry.id)),
        );
      }
      const updatedUser = await pb.collection('users').update(userId, {
        space_colors: {},
      });
      pb.authStore.save(pb.authStore.token, updatedUser);
      window.location.reload();
    } catch (err) {
      console.error('Failed to purge user data:', err);
      setPurgeInProgress(false);
      setPurgeError('Purge failed. Your data has not been changed. Please retry.');
    }
  };

  const getSpaceColor = (space: string, index: number) => {
    return spaceColors[space] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  const isSpaceMerge =
    renameTargetSpace !== null &&
    spaceDetails.some(
      (space) =>
        space.name.toLowerCase() === newName.trim().toLowerCase() &&
        space.name.toLowerCase() !== renameTargetSpace.toLowerCase()
    );

  const currentSpaceDetail = renameTargetSpec
    ? spaceDetails.find((s) => s.name === renameTargetSpec.space)
    : null;
  const isSpecMerge =
    renameTargetSpec !== null &&
    !!currentSpaceDetail &&
    currentSpaceDetail.specializations.some(
      (spec) =>
        spec.toLowerCase() === newName.trim().toLowerCase() &&
        spec.toLowerCase() !== renameTargetSpec.spec.toLowerCase()
    );

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
          <section className="settings-section" style={{ padding: isMobile ? '16px' : '32px', gap: isMobile ? '12px' : '16px' }}>
            <Eyebrow>▸&nbsp;&nbsp;SPACE_THEME_MAPPINGS</Eyebrow>
            <h2 className="settings-section__title">SPACE_THEME_MAPPINGS</h2>
            <p className="settings-section__body">
              Assign a marker for each space detected in your tracking history. The accent
              teal is reserved for active state.
            </p>
            {spaceDetails.length === 0 ? (
              <EmptyState
                title="NO_ACTIVE_SPACES"
                message="NO_SPACES_DETECTED_IN_HISTORY"
              />
            ) : (
              <div className="color-grid" style={{ gridTemplateColumns: isMobile ? '1fr' : isDesktop ? 'repeat(4, minmax(220px, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {spaceDetails.map((detail, idx) => (
                  <div key={detail.name} className="color-row" style={{ padding: isMobile ? '12px' : undefined, flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className="color-row__label">{detail.name}</span>
                        <button
                          type="button"
                          className="btn btn--link"
                          style={{ fontSize: '11px' }}
                          onClick={() => handleOpenRenameSpace(detail.name)}
                        >
                          [RENAME]
                        </button>
                      </div>
                      <label
                        className="color-row__swatch"
                        style={{ background: getSpaceColor(detail.name, idx), ...(isMobile ? { width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' } : {}) }}
                        aria-label={`Color for ${detail.name}`}
                      >
                        <input
                          type="color"
                          value={getSpaceColor(detail.name, idx)}
                          onChange={(e) => handleColorChange(detail.name, e.target.value)}
                        />
                      </label>
                    </div>

                    {detail.specializations.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--border-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="type-tech-mono" style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
                            {detail.specializations.length} {detail.specializations.length === 1 ? 'SPECIALIZATION' : 'SPECIALIZATIONS'}
                          </span>
                          <button
                            type="button"
                            className="btn btn--link"
                            style={{ fontSize: '11px', textTransform: 'uppercase' }}
                            onClick={() => handleOpenManageSpecs(detail)}
                          >
                            {">>> MANAGE"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="settings-section" style={{ padding: isMobile ? '16px' : '32px', gap: isMobile ? '12px' : '16px' }}>
            <Eyebrow>▸&nbsp;&nbsp;CLI_AND_AI_AGENT_ACCESS</Eyebrow>
            <h2 className="settings-section__title">CLI_AND_AI_AGENT_ACCESS</h2>
            <p className="settings-section__body">
              Authenticate external sessions or automated code agents with this token. Keep it
              private.
            </p>
            <div className="token-row" style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
              <div className="token-row__value" title={pb.authStore.token} style={isMobile ? { width: '100%', fontSize: '13px', wordBreak: 'break-all' } : undefined}>
                {pb.authStore.token || 'NO_ACTIVE_AUTH_TOKEN'}
              </div>
              <button
                type="button"
                className="btn"
                onClick={handleCopyToken}
                aria-label="Copy token"
                style={isMobile ? { width: '100%', minHeight: '44px', justifyContent: 'center' } : undefined}
              >
                {copied ? '✓ COPIED' : 'COPY'}
              </button>
            </div>
            <Eyebrow muted>TERMINAL_SETUP</Eyebrow>
            <pre className="terminal-block" style={{ padding: isMobile ? '12px 16px' : undefined, fontSize: isMobile ? '12px' : undefined }}>
              <span className="terminal-block__prompt">npm install -g @viardant/qadrant-cli</span>
              {'\n'}
              <span className="terminal-block__prompt">
                qadrant login {copied ? '<copied-token>' : '...'}
              </span>
            </pre>
          </section>

          <section className="settings-section" style={{ padding: isMobile ? '16px' : '32px', gap: isMobile ? '12px' : '16px' }}>
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

          <section className="settings-section" style={{ padding: isMobile ? '16px' : '32px', gap: isMobile ? '12px' : '16px' }}>
            <Eyebrow>▸&nbsp;&nbsp;PURGE_DATA</Eyebrow>
            <h2 className="settings-section__title">PURGE_DATA</h2>
            <p className="settings-section__body">
              Permanently delete every time entry in your account and reset your space color
              preferences. The account itself is preserved. This cannot be undone.
            </p>
            <div>
              <button
                type="button"
                className="btn btn--danger"
                onClick={openPurge}
                aria-label="Purge all data"
              >
                ✕&nbsp;&nbsp;PURGE_ALL_DATA
              </button>
            </div>
          </section>
        </>
      )}

      <Modal
        open={purgeOpen}
        onClose={closePurge}
        title="▸&nbsp;&nbsp;PURGE_DATA_PROTOCOL"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closePurge}
              disabled={purgeInProgress}
            >
              CANCEL
            </button>
            <button
              type="submit"
              form="purge-form"
              className="btn btn--danger"
              disabled={purgeInProgress || purgePhrase !== PURGE_CONFIRM_PHRASE}
            >
              {purgeInProgress ? 'PURGING…' : '✕ PURGE'}
            </button>
          </>
        }
      >
        <form
          id="purge-form"
          onSubmit={handlePurge}
          className="section"
          style={{ gap: 'var(--space-4)' }}
        >
          <p className="settings-section__body" style={{ color: 'var(--fg)', margin: 0 }}>
            Every time entry — active and archived — will be removed. Your space color
            preferences will be reset. The CLI token and login remain valid.
          </p>
          <label className="section" style={{ gap: 'var(--space-2)' }}>
            <span className="eyebrow">TYPE&nbsp;&nbsp;{PURGE_CONFIRM_PHRASE}&nbsp;&nbsp;TO_CONFIRM</span>
            <input
              ref={purgeInputRef}
              type="text"
              className="input input--inline"
              value={purgePhrase}
              onChange={(e) => setPurgePhrase(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={purgeInProgress}
              aria-label={`Type ${PURGE_CONFIRM_PHRASE} to confirm`}
            />
          </label>
          {purgeError && (
            <p
              className="settings-section__body"
              style={{ color: 'var(--error)', margin: 0 }}
              role="alert"
            >
              ⚠&nbsp;&nbsp;{purgeError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={manageSpecsTarget !== null}
        onClose={handleCloseManageSpecs}
        title={`▸  MANAGE_SPECIALIZATIONS_PROTOCOL // ${manageSpecsTarget?.name || ''}`}
        footer={
          <button type="button" className="btn btn--ghost" onClick={handleCloseManageSpecs}>
            CLOSE
          </button>
        }
      >
        <div className="section" style={{ gap: 'var(--space-4)' }}>
          {manageSpecsTarget && (
            <div className="section" style={{ gap: 'var(--space-3)' }}>
              <input
                type="text"
                className="input input--inline"
                value={specSearchQuery}
                onChange={(e) => setSpecSearchQuery(e.target.value)}
                placeholder="SEARCH_SPECIALIZATIONS…"
                aria-label="Search specializations"
              />
              <div
                className="section"
                style={{
                  maxHeight: '350px',
                  overflowY: 'auto',
                  gap: 'var(--space-2)',
                  border: '1px solid var(--border-muted)',
                  padding: 'var(--space-2)',
                  backgroundColor: 'var(--bg)',
                }}
              >
                {manageSpecsTarget.specializations
                  .filter((spec) =>
                    spec.toLowerCase().includes(specSearchQuery.toLowerCase())
                  )
                  .map((spec) => (
                    <div
                      key={spec}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-2) var(--space-3)',
                        borderBottom: '1px solid var(--border-muted)',
                      }}
                    >
                      <span className="type-tech-mono" style={{ fontSize: '13px' }}>
                        {spec}
                      </span>
                      <button
                        type="button"
                        className="btn btn--link"
                        style={{ fontSize: '11px' }}
                        onClick={() => {
                          const spaceName = manageSpecsTarget.name;
                          handleCloseManageSpecs();
                          handleOpenRenameSpec(spaceName, spec);
                        }}
                      >
                        [RENAME]
                      </button>
                    </div>
                  ))}
                {manageSpecsTarget.specializations.filter((spec) =>
                  spec.toLowerCase().includes(specSearchQuery.toLowerCase())
                ).length === 0 && (
                  <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--fg-muted)' }}>
                    NO_MATCHING_SPECIALIZATIONS
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={renameTargetSpace !== null}
        onClose={handleCloseRename}
        title="▸&nbsp;&nbsp;RENAME_SPACE_PROTOCOL"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={handleCloseRename} disabled={renameInProgress}>
              CANCEL
            </button>
            <button
              type="submit"
              form="rename-space-form"
              className="btn btn--filled"
              disabled={renameInProgress || !newName.trim() || newName.trim() === renameTargetSpace}
            >
              {renameInProgress ? 'EXECUTING...' : isSpaceMerge ? '>>> CONFIRM_MERGE' : '>>> EXECUTE_RENAME'}
            </button>
          </>
        }
      >
        <form id="rename-space-form" onSubmit={executeRenameSpace} className="section" style={{ gap: 'var(--space-4)' }}>
          <p className="settings-section__body">
            Renaming space <strong>{renameTargetSpace}</strong> will update all associated historical time entries.
          </p>
          {isSpaceMerge && (
            <div className="alert-warning" role="alert">
              [WARNING] A space with this name already exists. Executing this rename will merge all entries into it.
            </div>
          )}
          <label className="section" style={{ gap: 'var(--space-2)' }}>
            <span className="eyebrow">NEW SPACE NAME</span>
            <input
              autoFocus
              type="text"
              className="input input--inline"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="NEW_NAME..."
              maxLength={48}
              disabled={renameInProgress}
            />
          </label>
          {renameInProgress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <BeatIndicator activeIndex={beatIdx} label="Renaming" />
              <span className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>{renameProgressText}</span>
            </div>
          )}
          {renameError && (
            <span className="type-tech-mono" style={{ color: 'var(--error)' }} role="alert">
              {renameError}
            </span>
          )}
        </form>
      </Modal>

      <Modal
        open={renameTargetSpec !== null}
        onClose={handleCloseRename}
        title="▸&nbsp;&nbsp;RENAME_SPECIALIZATION_PROTOCOL"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={handleCloseRename} disabled={renameInProgress}>
              CANCEL
            </button>
            <button
              type="submit"
              form="rename-spec-form"
              className="btn btn--filled"
              disabled={renameInProgress || !newName.trim() || newName.trim() === renameTargetSpec?.spec}
            >
              {renameInProgress ? 'EXECUTING...' : isSpecMerge ? '>>> CONFIRM_MERGE' : '>>> EXECUTE_RENAME'}
            </button>
          </>
        }
      >
        <form id="rename-spec-form" onSubmit={executeRenameSpec} className="section" style={{ gap: 'var(--space-4)' }}>
          <p className="settings-section__body">
            Renaming specialization <strong>{renameTargetSpec?.spec}</strong> inside space <strong>{renameTargetSpec?.space}</strong> will update all matching historical entries.
          </p>
          {isSpecMerge && (
            <div className="alert-warning" role="alert">
              [WARNING] A specialization with this name already exists in this space. Executing this rename will merge all entries into it.
            </div>
          )}
          <label className="section" style={{ gap: 'var(--space-2)' }}>
            <span className="eyebrow">NEW SPECIALIZATION NAME</span>
            <input
              autoFocus
              type="text"
              className="input input--inline"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="NEW_NAME..."
              maxLength={48}
              disabled={renameInProgress}
            />
          </label>
          {renameInProgress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <BeatIndicator activeIndex={beatIdx} label="Renaming" />
              <span className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>{renameProgressText}</span>
            </div>
          )}
          {renameError && (
            <span className="type-tech-mono" style={{ color: 'var(--error)' }} role="alert">
              {renameError}
            </span>
          )}
        </form>
      </Modal>
    </>
  );
}
