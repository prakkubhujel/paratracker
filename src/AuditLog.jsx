import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { exportToCsv } from './exportToCsv';

const ACTION_LABELS = {
  approve_pilot: 'Approved pilot',
  reject_pilot: 'Rejected pilot',
  suspend_pilot: 'Suspended pilot',
  reactivate_pilot: 'Reactivated pilot',
  delete_pilot: 'Deleted pilot account',
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, action, details, created_at, actor:actor_id(name), target:target_pilot_id(name)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setEntries(data || []));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-1">Admin action log</h2>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Who did what, and when — approvals, suspensions, deletions. Last 100 actions.
        </p>
        <button
          onClick={() =>
            exportToCsv(
              'audit-log',
              entries.map((e) => ({
                action: e.action,
                target: e.target?.name ?? '',
                actor: e.actor?.name ?? '',
                reason: e.details?.reason ?? '',
                created_at: e.created_at,
              }))
            )
          }
          disabled={entries.length === 0}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No admin actions recorded yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">
                  {ACTION_LABELS[e.action] ?? e.action}
                  {e.target?.name && <span className="text-gray-500"> — {e.target.name}</span>}
                </span>
                <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                By {e.actor?.name ?? 'Unknown'}
                {e.details?.reason && ` — reason: ${e.details.reason}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
