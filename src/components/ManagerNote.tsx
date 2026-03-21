'use client';

import { useState, useEffect, useCallback } from 'react';
import { getManagerNote, saveManagerNote } from '@/lib/storage';

interface ManagerNoteProps {
  weekId: string;
  isAdmin: boolean;
}

export default function ManagerNote({ weekId, isAdmin }: ManagerNoteProps) {
  const [note, setNote] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setNote(getManagerNote(weekId));
  }, [weekId]);

  const handleChange = useCallback(
    (value: string) => {
      setNote(value);
      saveManagerNote(weekId, value);
    },
    [weekId]
  );

  const handleSave = useCallback(() => {
    saveManagerNote(weekId, note);
    setIsFocused(false);
    // Blur the textarea to dismiss the keyboard
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [weekId, note]);

  if (!isAdmin && !note) return null;

  return (
    <div className="bg-warm-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 shadow-sm dark:shadow-none">
      <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">הודעה לצוות</h3>
      {isAdmin ? (
        <>
          <textarea
            value={note}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              // Keep focused state if the blur target is our save button
              if (e.relatedTarget?.getAttribute('data-manager-save') === 'true') return;
              setIsFocused(false);
            }}
            placeholder="כתוב הודעה לצוות..."
            rows={3}
            enterKeyHint="done"
            className="w-full bg-warm-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[44px]"
          />
          {isFocused && (
            <button
              type="button"
              data-manager-save="true"
              onClick={handleSave}
              className="w-full mt-2 bg-blue-500 text-white font-bold rounded-xl p-3 min-h-[44px] hover:bg-blue-600 active:bg-blue-700 active:scale-[0.97] transition-all duration-150"
            >
              שמור
            </button>
          )}
        </>
      ) : (
        <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{note}</p>
      )}
    </div>
  );
}
