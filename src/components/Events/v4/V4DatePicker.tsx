'use client';

interface V4DatePickerProps {
  value: string;          // ISO YYYY-MM-DD
  onChange: (next: string) => void;
  label: string;
  min?: string;
  max?: string;
}

export function V4DatePicker({ value, onChange, label, min, max }: V4DatePickerProps) {
  const id = `v4-date-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] focus:outline-none focus:border-[var(--v4-hairline-3)]"
      />
    </div>
  );
}
