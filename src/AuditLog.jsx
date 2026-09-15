import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

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
      <p className="text-sm text-gray-500 mb-4">
        Who did what, and when — approvals, suspensions, deletions. Last 100 actions.
      </p>

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
