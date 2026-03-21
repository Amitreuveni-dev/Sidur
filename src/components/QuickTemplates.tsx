'use client';

interface QuickTemplatesProps {
  onSelect: (startTime: string, endTime: string) => void;
}

export default function QuickTemplates({ onSelect }: QuickTemplatesProps) {
  const templates = [
    { label: 'בוקר 11:00\u201317:30', start: '11:00', end: '17:30' },
    { label: 'ערב 17:30\u201323:00', start: '17:30', end: '23:00' },
  ] as const;

  return (
    <div className="flex gap-2">
      {templates.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onSelect(t.start, t.end)}
          className="flex-1 bg-warm-200 dark:bg-slate-600 text-slate-900 dark:text-white text-sm rounded-xl p-3 min-h-[44px] hover:bg-warm-300 dark:hover:bg-slate-500 active:bg-warm-400 dark:active:bg-slate-400 active:scale-[0.97] font-bold transition-all duration-150"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
