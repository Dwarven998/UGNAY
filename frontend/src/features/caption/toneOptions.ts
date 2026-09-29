import type { Tone } from '../../types';

export type ToneOption = {
  tone: Tone;
  icon: string;
  label: string;
  description: string;
};

/** The brand tones the caption endpoints accept. Shared by Caption Studio and the post composer. */
export const TONE_OPTIONS: ToneOption[] = [
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

export function isTone(value: unknown): value is Tone {
  return TONE_OPTIONS.some(option => option.tone === value);
}
