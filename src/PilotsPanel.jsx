import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { BadgeAwardPanel } from './Milestones';

export default function PilotsPanel() {
  const [pilots, setPilots] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, status, role')
      .eq('status', 'approved')
      .order('name')
      .then(({ data }) => setPilots(data || []));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-3">Pilots</h2>
      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
        {pilots.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <button
              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              className="w-full flex justify-between items-center text-left"
            >
              <span className="font-medium text-gray-900">
                {p.name} {p.role === 'manager' && <span className="text-xs text-brand-600">(manager)</span>}
              </span>
              <span className="text-gray-400 text-sm">{expandedId === p.id ? '▲' : '▼'}</span>
            </button>
            {expandedId === p.id && (
              <div className="mt-3 space-y-3">
                <BadgeAwardPanel pilotId={p.id} pilotName={p.name} />
                <BoundaryEventLog pilotId={p.id} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoundaryEventLog({ pilotId }) {
  const [events, setEvents] = useState(null); // null = loading

  useEffect(() => {
    supabase
      .rpc('get_boundary_events', { p_pilot_id: pilotId, p_limit: 10 })
      .then(({ data }) => setEvents(data || []));
  }, [pilotId]);

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-2">Out-of-bounds history</p>
      {events === null ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-gray-400">No out-of-bounds events recorded.</p>
      ) : (
        <ul className="text-xs text-gray-600 space-y-1">
          {events.map((e, i) => (
            <li key={i}>
              {new Date(e.occurred_at).toLocaleString()} — {e.lat.toFixed(5)}, {e.lng.toFixed(5)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
