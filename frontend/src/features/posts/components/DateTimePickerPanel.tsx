import { useState } from 'react';
import DatePicker from 'react-datepicker';

import 'react-datepicker/dist/react-datepicker.css';

export interface DateTimePickerPanelProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  suggestedValue: Date;
  /** Earliest selectable day. */
  minDate?: Date;
  /** id for the date input, so a <label htmlFor> can point at it. */
  inputId?: string;
  invalid?: boolean;
  describedBy?: string;
}

const formatSuggested = (value: Date) =>
  value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/*
 * The suggested time is a fixed default (tomorrow, 7:00 PM), not a model prediction, so it is labelled
 * "Suggested time" rather than "AI-suggested".
 */
export default function DateTimePickerPanel({
  value,
  onChange,
  suggestedValue,
  minDate,
  inputId,
  invalid = false,
  describedBy,
}: DateTimePickerPanelProps) {
  const [useSuggestedTime, setUseSuggestedTime] = useState(false);

  /* Toggle handler — directly applies or clears the suggested time.
     No useEffect needed, which avoids stale-closure re-fire issues
     that were overriding manual time selections. */
  const handleToggle = () => {
    const next = !useSuggestedTime;
    setUseSuggestedTime(next);
    if (next) {
      onChange(suggestedValue);
    }
  };

  return (
    <div className="upe-datetime-panel">
      <DatePicker
        id={inputId}
        selected={value}
        onChange={(date: Date | null) => {
          setUseSuggestedTime(false);
          onChange(date);
        }}
        showTimeSelect
        timeIntervals={15}
        minDate={minDate}
        dateFormat="MMM d, yyyy h:mm aa"
        placeholderText="Select date and time"
        className={`upe-datepicker${invalid ? ' is-invalid' : ''}`}
        wrapperClassName="upe-datepicker-wrapper"
        portalId="datepicker-portal"
        ariaInvalid={invalid ? 'true' : undefined}
        ariaDescribedBy={describedBy}
      />
      <div className="upe-datetime-suggest">
        <span className="upe-datetime-hint">
          Suggested time: {formatSuggested(suggestedValue)}
        </span>
        <button
          type="button"
          className={`upe-suggested-toggle ${useSuggestedTime ? 'is-active' : ''}`}
          onClick={handleToggle}
          aria-pressed={useSuggestedTime}
        >
          {useSuggestedTime ? '✓ Using suggested time' : 'Use suggested time'}
        </button>
      </div>
    </div>
  );
}
