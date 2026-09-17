import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// No email service is wired into this project, so "sent to managers"
// means "ready and visible the instant they're in the dashboard," via
// the realtime broadcast below — not an email inbox. A real email
// digest would need a separate provider (Resend, etc.) and API key,
// not assumed here.
export default function WeeklySummary() {
  const [summaries, setSummaries] = useState([]);
  const [justArrived, setJustArrived] = useState(null);

  const load = () => {
    supabase
      .from('weekly_summaries')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(12)
      .then(({ data }) => setSummaries(data || []));
  };

  useEffect(() => {
    load();
    const channel = supabase.channel('flight-alerts', { config: { private: true } });
    channel
      .on('broadcast', { event: 'weekly-summary-ready' }, ({ payload }) => {
        setJustArrived(payload);
        load();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-1">Weekly summary</h2>
      <p className="text-sm text-gray-500 mb-4">
        Auto-generated every Monday for the week that just ended (once the scheduled job in
        sql/023 is enabled).
      </p>

      {justArrived && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-2 mb-4 text-sm text-brand-800">
          New summary just generated for the week of {justArrived.week_start}.
        </div>
      )}

      {summaries.length === 0 ? (
        <p className="text-sm text-gray-400">No summaries generated yet.</p>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => (
            <div key={s.id} className="border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-gray-900 mb-2">Week of {s.week_start}</p>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold text-brand-700">{s.total_flights}</p>
                  <p className="text-xs text-gray-500">Flights</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-brand-700">{(s.total_minutes / 60).toFixed(1)}h</p>
                  <p className="text-xs text-gray-500">Total airtime</p>
                </div>
                <div>
                  <p className={`text-lg font-semibold ${s.sos_count > 0 ? 'text-red-600' : 'text-gray-900'}`}>{s.sos_count}</p>
                  <p className="text-xs text-gray-500">SOS alerts</p>
                </div>
                <div>
                  <p className={`text-lg font-semibold ${s.rescue_count > 0 ? 'text-red-600' : 'text-gray-900'}`}>{s.rescue_count}</p>
                  <p className="text-xs text-gray-500">Rescue events</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
