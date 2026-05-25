import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';

import 'react-datepicker/dist/react-datepicker.css';

export interface DateTimePickerPanelProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  suggestedValue: Date;
}

export default function DateTimePickerPanel({ value, onChange, suggestedValue }: DateTimePickerPanelProps) {
  const [useSuggestedTime, setUseSuggestedTime] = useState(false);

  useEffect(() => {
    if (useSuggestedTime) {
      onChange(suggestedValue);
    }
  }, [onChange, suggestedValue, useSuggestedTime]);

  return (
    <div className="upe-datetime-panel">
      <button
        type="button"
        className={`upe-suggested-toggle ${useSuggestedTime ? 'is-active' : ''}`}
        onClick={() => setUseSuggestedTime(current => !current)}
      >
        Use AI-Suggested Time
      </button>
      <DatePicker
        selected={value}
        onChange={(date: Date | null) => {
          setUseSuggestedTime(false);
          onChange(date);
        }}
        showTimeSelect
        timeIntervals={15}
        dateFormat="MMM d, yyyy h:mm aa"
        placeholderText="Select date and time"
        className="upe-datepicker"
        wrapperClassName="upe-datepicker-wrapper"
      />
      <div className="upe-datetime-hint">
        Suggested time: {suggestedValue.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
      </div>
    </div>
  );
}