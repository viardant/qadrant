import { Play } from 'lucide-react';

interface QuickStartCardsProps {
  recentCombos: Array<{ space: string; specialization: string }>;
  onStart: (task: string, space: string, specialization: string) => void;
}

export function QuickStartCards({ recentCombos, onStart }: QuickStartCardsProps) {
  if (recentCombos.length === 0) return null;

  return (
    <div className="quick-start-section">
      <h3 className="text-sm font-mono font-bold uppercase text-on-surface/60 tracking-wider">
        QUICK_START_SHORTCUTS
      </h3>
      <div className="quick-start-grid">
        {recentCombos.map((combo, idx) => (
          <button
            key={`${combo.space}-${combo.specialization}-${idx}`}
            onClick={() => onStart('Quick Start', combo.space, combo.specialization)}
            className="quick-start-card"
          >
            <div className="quick-start-info">
              <span className="quick-start-space">
                {combo.space || 'No Space'}
              </span>
              <span className="quick-start-spec">
                {combo.specialization || 'general'}
              </span>
            </div>
            <Play size={16} className="quick-start-play" />
          </button>
        ))}
      </div>
    </div>
  );
}
