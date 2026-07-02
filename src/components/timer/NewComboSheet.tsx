import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';

export interface NewComboData {
  space: string;
  specialization: string;
  start: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewComboData) => void;
}

export function NewComboSheet({ open, onClose, onSubmit }: Props) {
  const [space, setSpace] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [start, setStart] = useState(true);

  useEffect(() => {
    if (!open) {
      setSpace('');
      setSpecialization('');
      setStart(true);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!space.trim() && !specialization.trim()) return;
    onSubmit({
      space: space.toUpperCase().trim(),
      specialization: specialization.toUpperCase().trim(),
      start
    });
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
      <form id="new-combo-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span className="eyebrow">SPACE</span>
          <input
            type="text"
            className="input input--inline input-uppercase"
            value={space}
            onChange={(e) => setSpace(e.target.value)}
            onBlur={(e) => setSpace(e.target.value.toUpperCase())}
            placeholder="DEV, WORK, ..."
            required
            maxLength={48}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span className="eyebrow">SPECIALIZATION</span>
          <input
            type="text"
            className="input input--inline input-uppercase"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            onBlur={(e) => setSpecialization(e.target.value.toUpperCase())}
            placeholder="FRONTEND, MEETING, ..."
            maxLength={48}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={start}
              onChange={(e) => setStart(e.target.checked)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              aria-label="Start session on save"
            />
            <span className="type-tech-mono" style={{ userSelect: 'none' }}>START_SESSION_ON_SAVE</span>
          </label>
          <p className="type-tech-mono-sm" style={{ color: 'var(--fg-subtle)', margin: 0, paddingLeft: '28px', lineHeight: 1.4 }}>
            {start
              ? 'SAVING STARTS A LIVE TIMER // SPACE+SPECIALIZATION ADDED TO REPLAY'
              : 'SAVING CREATES A 0-DURATION ENTRY TO SEED THE REPLAY LIST'}
          </p>
        </div>
      </form>
    </Modal>
  );
}
