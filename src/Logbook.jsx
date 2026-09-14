import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Manager-side view of every pilot's flight logbook. Pilots can only
// insert/read their own entries (see sql/020's RLS) — managers can
// also update/delete, for corrections, which is why this view offers
// a delete action that mobile-LogbookForm.jsx deliberately doesn't.
export default function Logbook() {
  const [entries, setEntries] = useState([]);
  const [pilotFilter, setPilotFilter] = useState('');
  const [pilots, setPilots] = useState([]);

  const loadEntries = () => {
    let query = supabase
      .from('logbooks')
      .select('id, date, flying_person_name, guest_name, country, age, weight, weather_condition, flight_duration_minutes, remarks, pilot_id')
      .order('date', { ascending: false });
    if (pilotFilter) query = query.eq('pilot_id', pilotFilter);
    query.then(({ data }) => setEntries(data || []));
  };

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name')
      .eq('status', 'approved')
      .order('name')
      .then(({ data }) => setPilots(data || []));
  }, []);

  useEffect(() => {
    loadEntries();
  }, [pilotFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this logbook entry? This cannot be undone.')) return;
    await supabase.from('logbooks').delete().eq('id', id);
    loadEntries();
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Flight logbook</h2>
        <select
          value={pilotFilter}
          onChange={(e) => setPilotFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1"
        >
          <option value="">All pilots</option>
          {pilots.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No flights logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Pilot</th>
                <th className="py-2 pr-4">Guest</th>
                <th className="py-2 pr-4">Country</th>
                <th className="py-2 pr-4">Age</th>
                <th className="py-2 pr-4">Weight</th>
                <th className="py-2 pr-4">Weather</th>
                <th className="py-2 pr-4">On-sky (min)</th>
                <th className="py-2 pr-4">Remarks</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{e.date}</td>
                  <td className="py-2 pr-4">{e.flying_person_name}</td>
                  <td className="py-2 pr-4">{e.guest_name ?? '—'}</td>
                  <td className="py-2 pr-4">{e.country ?? '—'}</td>
                  <td className="py-2 pr-4">{e.age ?? '—'}</td>
                  <td className="py-2 pr-4">{e.weight ?? '—'}</td>
                  <td className="py-2 pr-4">{e.weather_condition ?? '—'}</td>
                  <td className="py-2 pr-4 font-medium text-brand-700">{e.flight_duration_minutes}</td>
                  <td className="py-2 pr-4 max-w-xs truncate" title={e.remarks}>{e.remarks ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
