import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function LiveStatusBoard() {
  const [pilots, setPilots] = useState([]);

  const load = async () => {
    const { data } = await supabase
      .from('live_positions')
      .select('pilot_id, status, last_ping_at, profiles(name)')
      .order('last_ping_at', { ascending: false });
    setPilots(data || []);
  };

  useEffect(() => {
    load();
    const sub = supabase
      .channel('live_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_positions' }, load)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const airborne = pilots.filter((p) => p.status === 'airborne');
  const grounded = pilots.filter((p) => p.status === 'grounded');

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-3">Live status</h2>
      <div className="grid grid-cols-2 gap-4">
        <StatusColumn title="Airborne" tone="emerald" pilots={airborne} />
        <StatusColumn title="Grounded" tone="gray" pilots={grounded} />
      </div>
    </div>
  );
}

// Tailwind's JIT scanner needs literal class names, so the two tones
// are spelled out rather than built with a template string.
const TONE_CLASSES = {
  emerald: { wrap: 'border-emerald-200 bg-emerald-50', label: 'text-emerald-800' },
  gray: { wrap: 'border-gray-200 bg-gray-50', label: 'text-gray-800' },
};

function StatusColumn({ title, tone, pilots }) {
  const { wrap, label } = TONE_CLASSES[tone];
  return (
    <div className={`border rounded-lg p-3 ${wrap}`}>
      <p className={`text-sm font-medium mb-2 ${label}`}>
        {title} ({pilots.length})
      </p>
      {pilots.length === 0 ? (
        <p className="text-xs text-gray-400">None</p>
      ) : (
        <ul className="space-y-1">
          {pilots.map((p) => (
            <li key={p.pilot_id} className="text-sm text-gray-700 flex justify-between">
              <span>{p.profiles?.name ?? 'Unknown'}</span>
              <span className="text-xs text-gray-400">
                {new Date(p.last_ping_at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
