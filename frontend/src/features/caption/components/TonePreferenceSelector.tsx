import type { Tone } from '../../../types';

type ToneOption = {
  tone: Tone;
  icon: string;
  label: string;
  description: string;
};

const TONE_OPTIONS: ToneOption[] = [
  {
    tone: 'FORMAL',
    icon: '🎓',
    label: 'Formal',
    description: 'Professional, polished, and suitable for brand-safe communication.',
  },
  {
    tone: 'ENERGETIC',
    icon: '⚡',
    label: 'Energetic',
    description: 'Upbeat and lively, ideal for campaigns that need momentum.',
  },
  {
    tone: 'CELEBRATORY',
    icon: '🎉',
    label: 'Celebratory',
    description: 'Warm and joyful for milestones, wins, and community moments.',
  },
  {
    tone: 'URGENT',
    icon: '🚨',
    label: 'Urgent',
    description: 'Direct and action-oriented when the message needs immediate attention.',
  },
];

type TonePreferenceSelectorProps = {
  value: Tone;
  onChange: (tone: Tone) => void;
  disabled?: boolean;
};

export default function TonePreferenceSelector({ value, onChange, disabled = false }: TonePreferenceSelectorProps) {
  return (
    <>
      <div className="tps-grid">
        {TONE_OPTIONS.map(option => {
          const isSelected = value === option.tone;

          return (
            <button
              key={option.tone}
              type="button"
              onClick={() => onChange(option.tone)}
              disabled={disabled}
              className={`tps-card ${isSelected ? 'tps-card-active' : ''} ${disabled ? 'tps-card-disabled' : ''}`}
            >
              {/* Active indicator */}
              {isSelected && <div className="tps-active-bar"></div>}

              <div className="tps-card-inner">
                <div className={`tps-icon-box ${isSelected ? 'tps-icon-box-active' : ''}`}>
                  <span className="tps-icon">{option.icon}</span>
                </div>
                <div className="tps-card-text">
                  <div className="tps-card-label-row">
                    <span className={`tps-card-label ${isSelected ? 'tps-card-label-active' : ''}`}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <svg className="tps-check" width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="tps-card-desc">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        .tps-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr 1fr;
        }
        .tps-card {
          position: relative;
          text-align: left;
          padding: 18px 18px 18px 22px;
          border-radius: 14px;
          border: 2px solid #e2e8f0;
          background: #ffffff;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          font-family: inherit;
          overflow: hidden;
        }
        .tps-card:hover:not(.tps-card-disabled) {
          border-color: #cbd5e1;
          background: #fafbfc;
        }
        .tps-card-active {
          border-color: #0C447C !important;
          background: rgba(12,68,124,0.02) !important;
          box-shadow: 0 0 0 4px rgba(12,68,124,0.06);
        }
        .tps-card-disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .tps-active-bar {
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 3px;
          background: linear-gradient(180deg, #3b82f6, #0C447C);
          border-radius: 0 3px 3px 0;
        }
        .tps-card-inner {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .tps-icon-box {
          width: 40px; height: 40px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .tps-icon-box-active {
          background: rgba(12,68,124,0.06);
          border-color: rgba(12,68,124,0.15);
        }
        .tps-icon { font-size: 18px; line-height: 1; }
        .tps-card-text { flex: 1; min-width: 0; }
        .tps-card-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .tps-card-label {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }
        .tps-card-label-active {
          color: #0C447C;
        }
        .tps-check {
          color: #0C447C;
          flex-shrink: 0;
        }
        .tps-card-desc {
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 640px) {
          .tps-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}