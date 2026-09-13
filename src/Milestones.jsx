import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function MilestoneBanner() {
  const [milestone, setMilestone] = useState(null);

  useEffect(() => {
    const channel = supabase.channel('flight-alerts', { config: { private: true } });
    channel
      .on('broadcast', { event: 'milestone-unlocked' }, ({ payload }) => setMilestone(payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  if (!milestone) return null;

  return (
    <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg px-4 py-3 flex justify-between items-center">
      <p className="font-semibold">
        🎉 {milestone.pilot_name} cleared their {Math.round(milestone.target_minutes / 60)}-hour
        monthly target ({milestone.logged_minutes} min logged)
      </p>
      <button onClick={() => setMilestone(null)} className="text-white/80 hover:text-white">
        ✕
      </button>
    </div>
  );
}

export function BadgeAwardPanel({ pilotId, pilotName }) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [badges, setBadges] = useState([]);

  const loadBadges = async () => {
    const { data } = await supabase
      .from('badges')
      .select('id, label, awarded_at')
      .eq('pilot_id', pilotId)
      .order('awarded_at', { ascending: false });
    setBadges(data || []);
  };

  useEffect(() => {
    loadBadges();
  }, [pilotId]);

  const award = async () => {
    if (!label.trim()) return;
    setBusy(true);
    await supabase.rpc('award_badge', { p_pilot_id: pilotId, p_label: label.trim() });
    setLabel('');
    await loadBadges();
    setBusy(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-700 mb-2">Badges — {pilotName}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {badges.map((b) => (
          <span key={b.id} className="text-xs bg-brand-100 text-brand-800 rounded-full px-2 py-0.5">
            {b.label}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Badge label, e.g. 'Cross-country 50k'"
          className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1"
        />
        <button
          onClick={award}
          disabled={busy || !label.trim()}
          className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50"
        >
          Award
        </button>
      </div>
    </div>
  );
}
