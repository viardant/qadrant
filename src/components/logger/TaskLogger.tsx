import React, { useState, useEffect, useRef } from 'react';

export interface TimeEntry {
  id: string;
  space: string;
  specialization: string;
  start_date: string;
  completion_time: string | null;
  user: string;
}

export interface ActiveTimerCardProps {
  session: TimeEntry;
  onStop: (id: string) => void;
}

function formatDuration(ms: number): string {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
}

export function ActiveTimerCard({ session, onStop }: ActiveTimerCardProps) {
  const [activeDuration, setActiveDuration] = useState('00:00:00');

  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(session.start_date).getTime();
      const diff = Date.now() - start;
      setActiveDuration(formatDuration(diff));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session.start_date]);

  return (
    <div className="active-timer-card">
      <div className="flex flex-col gap-2 w-full md:w-auto">
        <div className="text-sm font-mono text-primary font-bold uppercase tracking-wider">
          ACTIVE_SESSION_PROTOCOL
        </div>
        <h2 className="text-2xl font-mono font-bold" style={{ marginBottom: 0 }}>
          {session.space}
          {session.specialization && (
            <span className="text-lg font-normal text-on-surface/60" style={{ marginLeft: '0.5rem' }}>
              {` // ${session.specialization}`}
            </span>
          )}
        </h2>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto justify-end">
        <div className="text-4xl font-mono font-bold tracking-widest text-primary tabular-nums" style={{ fontSize: '2.5rem' }}>
          {activeDuration}
        </div>
        <button
          onClick={() => onStop(session.id)}
          type="button"
          className="w-full md:w-auto px-6 py-3 bg-error text-white font-mono uppercase font-bold border border-error shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000]"
        >
          STOP_SESSION
        </button>
      </div>
    </div>
  );
}

interface TaskLoggerProps {
  onStart: (space: string, specialization: string) => void;
  onStop: (id: string) => void;
  activeSessions: TimeEntry[];
  spaces: string[];
  specializations: string[];
}

export function TaskLogger({ onStart, onStop, activeSessions = [], spaces, specializations }: TaskLoggerProps) {
  const [space, setSpace] = useState('');
  const [specialization, setSpecialization] = useState('');

  // Autocomplete suggestions state
  const [showSpaceSuggestions, setShowSpaceSuggestions] = useState(false);
  const [showSpecSuggestions, setShowSpecSuggestions] = useState(false);
  const [spaceIndex, setSpaceIndex] = useState(-1);
  const [specIndex, setSpecIndex] = useState(-1);

  const spaceRef = useRef<HTMLDivElement>(null);
  const specRef = useRef<HTMLDivElement>(null);

  // Click outside to close suggestion dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (spaceRef.current && !spaceRef.current.contains(e.target as Node)) {
        setShowSpaceSuggestions(false);
      }
      if (specRef.current && !specRef.current.contains(e.target as Node)) {
        setShowSpecSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!space.trim()) return;
    onStart(space.trim(), specialization.trim());
    setSpace('');
    setSpecialization('');
    setShowSpaceSuggestions(false);
    setShowSpecSuggestions(false);
  };

  const filteredSpaces = spaces.filter((s) =>
    s.toLowerCase().includes(space.toLowerCase())
  );

  const filteredSpecs = specializations.filter((s) =>
    s.toLowerCase().includes(specialization.toLowerCase())
  );

  // Keyboard navigation for Space input
  const handleSpaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSpaceSuggestions || filteredSpaces.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSpaceIndex((prev) => (prev + 1) % filteredSpaces.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSpaceIndex((prev) => (prev - 1 + filteredSpaces.length) % filteredSpaces.length);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // Always prevent form submission if suggestions are open
      if (spaceIndex >= 0 && spaceIndex < filteredSpaces.length) {
        setSpace(filteredSpaces[spaceIndex]);
      }
      setShowSpaceSuggestions(false);
      setSpaceIndex(-1);
    } else if (e.key === 'Escape') {
      setShowSpaceSuggestions(false);
      setSpaceIndex(-1);
    }
  };

  // Keyboard navigation for Specialization input
  const handleSpecKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSpecSuggestions || filteredSpecs.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSpecIndex((prev) => (prev + 1) % filteredSpecs.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSpecIndex((prev) => (prev - 1 + filteredSpecs.length) % filteredSpecs.length);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // Always prevent form submission if suggestions are open
      if (specIndex >= 0 && specIndex < filteredSpecs.length) {
        setSpecialization(filteredSpecs[specIndex]);
      }
      setShowSpecSuggestions(false);
      setSpecIndex(-1);
    } else if (e.key === 'Escape') {
      setShowSpecSuggestions(false);
      setSpecIndex(-1);
    }
  };

  const sortedSessions = [...activeSessions].sort((a, b) => {
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      <form onSubmit={handleStart} className="task-logger-form">
        <div className="text-sm font-mono text-on-surface font-bold uppercase tracking-wider">
          NEW_SESSION_PROTOCOL
        </div>
        <div className="form-grid">

          {/* Space Autocomplete */}
          <div ref={spaceRef} className="input-group relative">
            <label>Space *</label>
            <input
              type="text"
              placeholder="Space name..."
              required
              value={space}
              onChange={(e) => {
                setSpace(e.target.value);
                setShowSpaceSuggestions(true);
                setSpaceIndex(-1);
              }}
              onFocus={() => {
                setShowSpaceSuggestions(true);
                setSpaceIndex(-1);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowSpaceSuggestions(false);
                  setSpaceIndex(-1);
                }, 200);
              }}
              onKeyDown={handleSpaceKeyDown}
              className="w-full font-mono"
              role="combobox"
              aria-expanded={showSpaceSuggestions && filteredSpaces.length > 0}
              aria-autocomplete="list"
              aria-controls="space-suggestions-list"
            />
            {showSpaceSuggestions && filteredSpaces.length > 0 && (
              <ul id="space-suggestions-list" className="suggestions-list" role="listbox">
                {filteredSpaces.map((s, idx) => (
                  <li
                    key={s}
                    onClick={() => {
                      setSpace(s);
                      setShowSpaceSuggestions(false);
                    }}
                    className={`suggestions-item ${idx === spaceIndex ? 'active' : ''}`}
                    role="option"
                    aria-selected={idx === spaceIndex}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Specialization Autocomplete */}
          <div ref={specRef} className="input-group relative">
            <label>Specialization</label>
            <input
              type="text"
              placeholder="Specialization..."
              value={specialization}
              onChange={(e) => {
                setSpecialization(e.target.value);
                setShowSpecSuggestions(true);
                setSpecIndex(-1);
              }}
              onFocus={() => {
                setShowSpecSuggestions(true);
                setSpecIndex(-1);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowSpecSuggestions(false);
                  setSpecIndex(-1);
                }, 200);
              }}
              onKeyDown={handleSpecKeyDown}
              className="w-full font-mono"
              role="combobox"
              aria-expanded={showSpecSuggestions && filteredSpecs.length > 0}
              aria-autocomplete="list"
              aria-controls="spec-suggestions-list"
            />
            {showSpecSuggestions && filteredSpecs.length > 0 && (
              <ul id="spec-suggestions-list" className="suggestions-list" role="listbox">
                {filteredSpecs.map((s, idx) => (
                  <li
                    key={s}
                    onClick={() => {
                      setSpecialization(s);
                      setShowSpecSuggestions(false);
                    }}
                    className={`suggestions-item ${idx === specIndex ? 'active' : ''}`}
                    role="option"
                    aria-selected={idx === specIndex}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="mt-2 w-full py-3 bg-primary text-white font-mono uppercase font-bold border border-primary shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000]"
        >
          START
        </button>
      </form>

      {sortedSessions.map((session) => (
        <ActiveTimerCard
          key={session.id}
          session={session}
          onStop={onStop}
        />
      ))}
    </div>
  );
}
