import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function Logbook() {
  const [entries, setEntries] = useState([]);
  const [pilotFilter, setPilotFilter] = useState('');
  const [pilots, setPilots] = useState([]);
  const [summary, setSummary] = useState({ total_minutes: 0, flight_count: 0 });

  const loadEntries = () => {
    let query = supabase
      .from('logbooks')
      .select('id, date, flying_person_name, guest_name, country, age, weight, weather_condition, flight_duration_minutes, remarks, pilot_id, takeoff_time, landing_time, distance_km, is_no_fly')
      .order('date', { ascending: false });
    if (pilotFilter) query = query.eq('pilot_id', pilotFilter);
    query.then(({ data }) => setEntries(data || []));

    supabase
      .rpc('get_flight_summary', { p_pilot_id: pilotFilter || null })
      .then(({ data }) => setSummary(data?.[0] ?? { total_minutes: 0, flight_count: 0 }));
  };

  useEffect(() => {
    supabase.from('profiles').select('id, name').eq('status', 'approved').order('name').then(({ data }) => setPilots(data || []));
  }, []);

  useEffect(() => { loadEntries(); }, [pilotFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this logbook entry? This cannot be undone.')) return;
    await supabase.from('logbooks').delete().eq('id', id);
    loadEntries();
  };

  const timeStr = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Flight logbook</h2>
        <select
          value={pilotFilter}
          onChange={(e) => setPilotFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1"
        >
          <option value="">All pilots</option>
          {pilots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 max-w-sm">
        <div className="bg-brand-50 rounded-xl p-3">
          <p className="text-xl font-semibold text-brand-800">{summary.flight_count}</p>
          <p className="text-xs text-brand-700">Total flights (excludes no-fly)</p>
        </div>
        <div className="bg-brand-50 rounded-xl p-3">
          <p className="text-xl font-semibold text-brand-800">{(summary.total_minutes / 60).toFixed(1)}h</p>
          <p className="text-xs text-brand-700">Total sky time</p>
        </div>
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
                <th className="py-2 pr-4">Takeoff</th>
                <th className="py-2 pr-4">Landing</th>
                <th className="py-2 pr-4">Distance</th>
                <th className="py-2 pr-4">Guest</th>
                <th className="py-2 pr-4">Country</th>
                <th className="py-2 pr-4">Weather</th>
                <th className="py-2 pr-4">On-sky (min)</th>
                <th className="py-2 pr-4">Remarks</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={`border-b border-gray-100 ${e.is_no_fly ? 'opacity-50' : ''}`}>
                  <td className="py-2 pr-4">{e.date}</td>
                  <td className="py-2 pr-4">{e.flying_person_name}</td>
                  <td className="py-2 pr-4">{timeStr(e.takeoff_time)}</td>
                  <td className="py-2 pr-4">{timeStr(e.landing_time)}</td>
                  <td className="py-2 pr-4">{e.distance_km != null ? `${e.distance_km} km` : '—'}</td>
                  <td className="py-2 pr-4">{e.guest_name ?? '—'}</td>
                  <td className="py-2 pr-4">{e.country ?? '—'}</td>
                  <td className="py-2 pr-4">{e.weather_condition ?? '—'}</td>
                  <td className="py-2 pr-4 font-medium text-brand-700">
                    {e.is_no_fly ? (
                      <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">No-fly</span>
                    ) : (
                      e.flight_duration_minutes
                    )}
                  </td>
                  <td className="py-2 pr-4 max-w-xs truncate" title={e.remarks}>{e.remarks ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <button onClick={() => handleDelete(e.id)} className="text-xs text-red-600 hover:underline">Delete</button>
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
