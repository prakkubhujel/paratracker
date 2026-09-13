import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Flags telemetry that's gone quiet without formally triggering a
// rescue incident yet (that threshold is 6h) — an early warning that
// a device stopped reporting, a permission got revoked mid-flight,
// etc. (spec §49).
const STALE_AFTER_MINUTES = 15;

export default function DiagnosticsPanel() {
  const [stalePilots, setStalePilots] = useState([]);

  const scan = async () => {
    const { data } = await supabase
      .from('live_positions')
      .select('pilot_id, status, last_ping_at, profiles(name)')
      .eq('status', 'airborne');

    const now = Date.now();
    const stale = (data || []).filter(
      (p) => now - new Date(p.last_ping_at).getTime() > STALE_AFTER_MINUTES * 60_000
    );
    setStalePilots(stale);
  };

  useEffect(() => {
    scan();
    const interval = setInterval(scan, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (stalePilots.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
      <p className="text-sm font-medium text-amber-800 mb-1">Telemetry gaps</p>
      <ul className="text-sm text-amber-700 space-y-1">
        {stalePilots.map((p) => {
          const minutesSince = Math.round((Date.now() - new Date(p.last_ping_at).getTime()) / 60000);
          return (
            <li key={p.pilot_id}>
              {p.profiles?.name ?? 'Unknown pilot'} — no update in {minutesSince} min
              (marked airborne, not yet a rescue incident)
            </li>
          );
        })}
      </ul>
    </div>
  );
}
