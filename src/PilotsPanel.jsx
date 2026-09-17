import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { BadgeAwardPanel } from './Milestones';
import AnalyticsDashboard from './AnalyticsDashboard';

export default function PilotsPanel() {
  const [pilots, setPilots] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadPilots = () => {
    supabase
      .from('profiles')
      .select('id, name, status, role')
      .in('status', ['approved', 'suspended'])
      .order('name')
      .then(({ data }) => setPilots(data || []));
  };

  useEffect(() => {
    loadPilots();
  }, []);

  const handleSuspend = async (id) => {
    setBusyId(id);
    await supabase.rpc('suspend_pilot', { p_pilot_id: id });
    loadPilots();
    setBusyId(null);
  };

  const handleReactivate = async (id) => {
    setBusyId(id);
    await supabase.rpc('reactivate_pilot', { p_pilot_id: id });
    loadPilots();
    setBusyId(null);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete ${name}'s account? This cannot be undone.`)) return;
    setBusyId(id);
    await supabase.rpc('delete_pilot', { p_pilot_id: id });
    loadPilots();
    setBusyId(null);
  };

  const handleSetInstructor = async (id) => {
    setBusyId(id);
    await supabase.rpc('set_instructor_role', { p_pilot_id: id });
    loadPilots();
    setBusyId(null);
  };

  const handleRevokeInstructor = async (id) => {
    setBusyId(id);
    await supabase.rpc('revoke_instructor_role', { p_pilot_id: id });
    loadPilots();
    setBusyId(null);
  };

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
              <span className="font-medium text-gray-900 flex items-center gap-2">
                {p.name}
                {p.role === 'manager' && <span className="text-xs text-brand-600">(manager)</span>}
                {p.role === 'instructor' && <span className="text-xs text-purple-600">(instructor)</span>}
                {p.status === 'suspended' && (
                  <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">Suspended</span>
                )}
              </span>
              <span className="text-gray-400 text-sm">{expandedId === p.id ? '▲' : '▼'}</span>
            </button>
            {expandedId === p.id && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  {p.status === 'suspended' ? (
                    <button
                      disabled={busyId === p.id}
                      onClick={() => handleReactivate(p.id)}
                      className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-md disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      disabled={busyId === p.id}
                      onClick={() => handleSuspend(p.id)}
                      className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-md disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    disabled={busyId === p.id}
                    onClick={() => handleDelete(p.id, p.name)}
                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md disabled:opacity-50"
                  >
                    Delete account
                  </button>
                  {p.role === 'instructor' ? (
                    <button
                      disabled={busyId === p.id}
                      onClick={() => handleRevokeInstructor(p.id)}
                      className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-md disabled:opacity-50"
                    >
                      Revoke instructor
                    </button>
                  ) : (
                    p.role !== 'manager' && (
                      <button
                        disabled={busyId === p.id}
                        onClick={() => handleSetInstructor(p.id)}
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-md disabled:opacity-50"
                      >
                        Make instructor
                      </button>
                    )
                  )}
                </div>

                <DirectMessage pilotId={p.id} pilotName={p.name} />
                <PilotNotes pilotId={p.id} />
                <BadgeAwardPanel pilotId={p.id} pilotName={p.name} />
                <BoundaryEventLog pilotId={p.id} />
                <PilotLogbook pilotId={p.id} />
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <p className="text-sm font-medium text-gray-700 p-3 pb-0">Analytics — {p.name}</p>
                  <AnalyticsDashboard pilotId={p.id} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DirectMessage({ pilotId, pilotName }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    await supabase.channel('flight-alerts', { config: { private: true } }).send({
      type: 'broadcast',
      event: 'direct-message',
      payload: { target_pilot_id: pilotId, title: 'Message from ops', body: message.trim() },
    });
    setSending(false);
    setSent(true);
    setMessage('');
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-2">Message {pilotName} directly</p>
      {sent && <p className="text-xs text-emerald-600 mb-2">Sent.</p>}
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setSent(false);
          }}
          placeholder="Only reaches them if the app is open"
          className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1"
        />
        <button
          onClick={send}
          disabled={sending || !message.trim()}
          className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function PilotNotes({ pilotId }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadNotes = () => {
    supabase
      .from('pilot_notes')
      .select('id, note, created_at')
      .eq('pilot_id', pilotId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotes(data || []));
  };

  useEffect(() => {
    loadNotes();
  }, [pilotId]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    await supabase.rpc('add_pilot_note', { p_pilot_id: pilotId, p_note: newNote.trim() });
    setNewNote('');
    loadNotes();
    setSaving(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-2">Manager notes (private)</p>
      <ul className="text-xs text-gray-600 space-y-1 mb-2 max-h-32 overflow-auto">
        {notes.map((n) => (
          <li key={n.id}>
            <span className="text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span> — {n.note}
          </li>
        ))}
        {notes.length === 0 && <li className="text-gray-400">No notes yet.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note"
          className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1"
        />
        <button
          onClick={addNote}
          disabled={saving || !newNote.trim()}
          className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function PilotLogbook({ pilotId }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    supabase
      .from('logbooks')
      .select('date, guest_name, country, weather_condition, flight_duration_minutes, remarks')
      .eq('pilot_id', pilotId)
      .order('date', { ascending: false })
      .then(({ data }) => setEntries(data || []));
  }, [pilotId]);

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-2">Flight logbook</p>
      {entries === null ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400">No flights logged yet.</p>
      ) : (
        <ul className="text-xs text-gray-600 space-y-2 max-h-56 overflow-auto">
          {entries.map((e, i) => (
            <li key={i} className="border-b border-gray-100 pb-1.5">
              <span className="font-medium text-gray-900">{e.date}</span> —{' '}
              <span className="text-brand-700 font-medium">{e.flight_duration_minutes} min</span>
              {e.guest_name && <span> · Guest: {e.guest_name} ({e.country})</span>}
              {e.weather_condition && <span> · {e.weather_condition}</span>}
              {e.remarks && <div className="italic text-gray-500 mt-0.5">{e.remarks}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BoundaryEventLog({ pilotId }) {
  const [events, setEvents] = useState(null);

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
