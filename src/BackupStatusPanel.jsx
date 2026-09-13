import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const STATUS_STYLES = {
  ok: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
};

export default function BackupStatusPanel() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    supabase
      .from('backup_logs')
      .select('id, status, detail, checked_at')
      .order('checked_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setLogs(data || []));
  }, []);

  const latest = logs[0];

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Backup status</h3>

      {!latest ? (
        <p className="text-sm text-gray-400">
          No backup checks recorded yet — deploy and schedule
          record-backup-status.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[latest.status]}`}>
              {latest.status.toUpperCase()}
            </span>
            <span className="text-xs text-gray-400">
              Last checked {new Date(latest.checked_at).toLocaleString()}
            </span>
          </div>
          <ul className="text-xs text-gray-500 space-y-1 max-h-40 overflow-auto">
            {logs.map((l) => (
              <li key={l.id}>
                {new Date(l.checked_at).toLocaleString()} — {l.status}
                {l.detail ? ` (${l.detail.slice(0, 80)})` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
