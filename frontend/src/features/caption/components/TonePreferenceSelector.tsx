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
    <div className="grid gap-3 sm:grid-cols-2">
      {TONE_OPTIONS.map(option => {
        const isSelected = value === option.tone;

        return (
          <button
            key={option.tone}
            type="button"
            onClick={() => onChange(option.tone)}
            disabled={disabled}
            className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isSelected
                ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none">{option.icon}</span>
              <div className="space-y-1">
                <div className="font-semibold">{option.label}</div>
                <p className="text-sm text-gray-600">{option.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}