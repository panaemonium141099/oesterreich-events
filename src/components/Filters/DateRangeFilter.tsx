'use client';

interface DateRangeFilterProps {
  dateFrom: string | undefined;
  dateTo: string | undefined;
  onChange: (dateFrom: string | undefined, dateTo: string | undefined) => void;
  eveningMode?: boolean;
}

export function DateRangeFilter({ dateFrom, dateTo, onChange, eveningMode }: DateRangeFilterProps) {
  const inputClass = `text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 cursor-pointer transition-all duration-200 ${
    eveningMode
      ? 'border-gray-700 bg-gray-800/50 text-gray-300 focus:ring-gray-600'
      : 'border-slate-200 bg-white text-slate-600 focus:ring-slate-400'
  }`;

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={dateFrom || ''}
        onChange={e => onChange(e.target.value || undefined, dateTo)}
        className={inputClass}
        style={eveningMode ? { colorScheme: 'dark' } : undefined}
        title="Von Datum"
      />
      <span className={`text-xs ${eveningMode ? 'text-gray-600' : 'text-slate-300'}`}>–</span>
      <input
        type="date"
        value={dateTo || ''}
        onChange={e => onChange(dateFrom, e.target.value || undefined)}
        className={inputClass}
        style={eveningMode ? { colorScheme: 'dark' } : undefined}
        title="Bis Datum"
      />
    </div>
  );
}
