'use client';

import { useState, useEffect, useCallback } from 'react';
import { getManagerNote, saveManagerNote } from '@/lib/storage';

interface ManagerNoteProps {
  weekId: string;
  isAdmin: boolean;
}

export default function ManagerNote({ weekId, isAdmin }: ManagerNoteProps) {
  const [note, setNote] = useState('');

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

  if (!isAdmin && !note) return null;

  return (
    <div className="bg-slate-800 rounded-2xl p-4 mb-4">
      <h3 className="text-sm font-bold text-slate-400 mb-2">הודעה לצוות</h3>
      {isAdmin ? (
        <textarea
          value={note}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="כתוב הודעה לצוות..."
          rows={3}
          className="w-full bg-slate-700 text-white rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 min-h-[44px]"
        />
      ) : (
        <p className="text-white whitespace-pre-wrap">{note}</p>
      )}
    </div>
  );
}
