import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';

export interface NewComboData {
  space: string;
  specialization: string;
  name: string;
  start: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewComboData) => void;
}

export function NewComboSheet({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [space, setSpace] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [start, setStart] = useState(true);

  useEffect(() => {
    if (!open) {
      setName('');
      setSpace('');
      setSpecialization('');
      setStart(true);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!space.trim() && !specialization.trim()) return;
    onSubmit({ name: name.trim(), space: space.trim(), specialization: specialization.trim(), start });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="▸&nbsp;&nbsp;NEW_COMBINATION_PROTOCOL"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            CANCEL
          </button>
          <button
            type="submit"
            form="new-combo-form"
            className="btn btn--filled"
            disabled={!space.trim() && !specialization.trim()}
          >
            {start ? '>>> START' : '>>> SEED_COMBO'}
          </button>
        </>
      }
    >
      <form id="new-combo-form" onSubmit={submit} className="section" style={{ gap: 'var(--space-4)' }}>
        <label className="section" style={{ gap: 'var(--space-2)' }}>
          <span className="eyebrow">NAME&nbsp;(OPTIONAL)</span>
          <input
            type="text"
            className="input input--inline"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="QUIZAPP, VESPA, ..."
            maxLength={48}
          />
        </label>
        <label className="section" style={{ gap: 'var(--space-2)' }}>
          <span className="eyebrow">SPACE</span>
          <input
            type="text"
            className="input input--inline"
            value={space}
            onChange={(e) => setSpace(e.target.value)}
            placeholder="DEV, WORK, ..."
            required
            maxLength={48}
          />
        </label>
        <label className="section" style={{ gap: 'var(--space-2)' }}>
          <span className="eyebrow">SPECIALIZATION</span>
          <input
            type="text"
            className="input input--inline"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="FRONTEND, MEETING, ..."
            maxLength={48}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input
            type="checkbox"
            checked={start}
            onChange={(e) => setStart(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
            aria-label="Start session on save"
          />
          <span className="type-tech-mono">START_SESSION_ON_SAVE</span>
        </label>
        <p className="type-tech-mono-sm" style={{ color: 'var(--fg-subtle)' }}>
          {start
            ? 'SAVING STARTS A LIVE TIMER // SPACE+SPECIALIZATION ADDED TO REPLAY'
            : 'SAVING CREATES A 0-DURATION ENTRY TO SEED THE REPLAY LIST'}
        </p>
      </form>
    </Modal>
  );
}
