import React, { useState, useEffect, useRef } from 'react';

export interface TimeEntry {
  id: string;
  task: string;
  space: string;
  specialization: string;
  start_date: string;
  completed: boolean;
  completion_time: string | null;
  user: string;
}

interface TaskLoggerProps {
  onStart: (task: string, space: string, specialization: string) => void;
  onStop: () => void;
  activeSession: TimeEntry | null;
  spaces: string[];
  specializations: string[];
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
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

export function TaskLogger({ onStart, onStop, activeSession, spaces, specializations }: TaskLoggerProps) {
  const [task, setTask] = useState('');
  const [space, setSpace] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [activeDuration, setActiveDuration] = useState('00:00:00');

  // Autocomplete suggestions state
  const [showSpaceSuggestions, setShowSpaceSuggestions] = useState(false);
  const [showSpecSuggestions, setShowSpecSuggestions] = useState(false);
  const [spaceIndex, setSpaceIndex] = useState(-1);
  const [specIndex, setSpecIndex] = useState(-1);

  const spaceRef = useRef<HTMLDivElement>(null);
  const specRef = useRef<HTMLDivElement>(null);

  // Active session timer effect
  useEffect(() => {
    if (!activeSession) return;

    const updateTimer = () => {
      const start = new Date(activeSession.start_date).getTime();
      const diff = Date.now() - start;
      setActiveDuration(formatDuration(diff));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

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
    if (!task.trim()) return;
    onStart(task.trim(), space.trim(), specialization.trim());
    setTask('');
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

  if (activeSession) {
    const spaceDisplay = activeSession.space || 'No Space';
    const specDisplay = activeSession.specialization ? ` ${activeSession.specialization}` : '';
    return (
      <div className="active-timer-card">
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <div className="text-sm font-mono text-primary font-bold uppercase tracking-wider">
            ACTIVE_SESSION_PROTOCOL
          </div>
          <h2 className="text-2xl font-mono font-bold" style={{ marginBottom: 0 }}>{activeSession.task}</h2>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-outline-light font-mono text-xs rounded border border-outline">
              {`[${spaceDisplay}]${specDisplay}`}
            </span>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto justify-end">
          <div className="text-4xl font-mono font-bold tracking-widest text-primary tabular-nums" style={{ fontSize: '2.5rem' }}>
            {activeDuration}
          </div>
          <button
            onClick={onStop}
            className="w-full md:w-auto px-6 py-3 bg-error text-white font-mono uppercase font-bold border border-error shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000]"
          >
            STOP_SESSION
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleStart} className="task-logger-form">
      <div className="text-sm font-mono text-on-surface font-bold uppercase tracking-wider">
        NEW_SESSION_PROTOCOL
      </div>
      <div className="form-grid">
        {/* Task Name */}
        <div className="input-group">
          <label>Task</label>
          <input
            type="text"
            placeholder="Task name..."
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="w-full font-mono"
            required
          />
        </div>

        {/* Space Autocomplete */}
        <div ref={spaceRef} className="input-group relative">
          <label>Space</label>
          <input
            type="text"
            placeholder="Space..."
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
  );
}
