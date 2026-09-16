import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function LiveStatusBoard() {
  const [pilots, setPilots] = useState([]);
  const [online, setOnline] = useState([]);

  const load = async () => {
    const { data } = await supabase
      .from('live_positions')
      .select('pilot_id, status, last_ping_at, altitude_m, speed_kmh, profiles(name)')
      .order('last_ping_at', { ascending: false });
    setPilots(data || []);
  };

  const loadOnline = async () => {
    const { data } = await supabase.rpc('get_online_pilots');
    setOnline(data || []);
  };

  useEffect(() => {
    load();
    loadOnline();
    const sub = supabase
      .channel('live_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_positions' }, load)
      .subscribe();
    // Presence doesn't push live updates — poll every 30s, cheap and
    // matches the 15-minute "online" window's own granularity.
    const interval = setInterval(loadOnline, 30_000);
    return () => {
      supabase.removeChannel(sub);
      clearInterval(interval);
    };
  }, []);

  const airborne = pilots.filter((p) => p.status === 'airborne');
  const grounded = pilots.filter((p) => p.status === 'grounded');
  const flyingIds = new Set(pilots.map((p) => p.pilot_id));
  const onlineNotFlying = online.filter((o) => !flyingIds.has(o.pilot_id));

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Live status</h2>

      <div className="grid grid-cols-2 gap-4">
        <StatusColumn title="Airborne" tone="emerald" pilots={airborne} showTelemetry />
        <StatusColumn title="Grounded" tone="gray" pilots={grounded} />
      </div>

      {onlineNotFlying.length > 0 && (
        <div className="border border-brand-100 bg-brand-50 rounded-lg p-3">
          <p className="text-sm font-medium text-brand-800 mb-2">
            Online in app now, not flying ({onlineNotFlying.length})
          </p>
          <ul className="space-y-1">
            {onlineNotFlying.map((o) => (
              <li key={o.pilot_id} className="text-sm text-brand-900 flex justify-between">
                <span>{o.name}</span>
                <span className="text-xs text-brand-600">{new Date(o.last_login_at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TONE_CLASSES = {
  emerald: { wrap: 'border-emerald-200 bg-emerald-50', label: 'text-emerald-800' },
  gray: { wrap: 'border-gray-200 bg-gray-50', label: 'text-gray-800' },
};

function StatusColumn({ title, tone, pilots, showTelemetry }) {
  const { wrap, label } = TONE_CLASSES[tone];
  return (
    <div className={`border rounded-lg p-3 ${wrap}`}>
      <p className={`text-sm font-medium mb-2 ${label}`}>
        {title} ({pilots.length})
      </p>
      {pilots.length === 0 ? (
        <p className="text-xs text-gray-400">None</p>
      ) : (
        <ul className="space-y-2">
          {pilots.map((p) => (
            <li key={p.pilot_id} className="text-sm text-gray-700">
              <div className="flex justify-between">
                <span className="font-medium">{p.profiles?.name ?? 'Unknown'}</span>
                <span className="text-xs text-gray-400">{new Date(p.last_ping_at).toLocaleTimeString()}</span>
              </div>
              {showTelemetry && (p.altitude_m != null || p.speed_kmh != null) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {p.altitude_m != null ? `${Math.round(p.altitude_m)}m alt` : ''}
                  {p.altitude_m != null && p.speed_kmh != null ? ' · ' : ''}
                  {p.speed_kmh != null ? `${p.speed_kmh} km/h` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
