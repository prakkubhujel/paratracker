import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function WeightLimitSettings() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('weight_limit_config').select('max_guest_weight_kg').eq('id', 1).single();
    if (data) setValue(String(data.max_guest_weight_kg));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const numeric = Number(value);
    if (!numeric || numeric <= 0) return;
    setBusy(true);
    await supabase
      .from('weight_limit_config')
      .update({ max_guest_weight_kg: numeric, updated_by: (await supabase.auth.getUser()).data.user?.id })
      .eq('id', 1);
    setBusy(false);
    setSaved(true);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 max-w-sm">
      <h3 className="text-sm font-medium text-gray-700 mb-1">Guest weight limit</h3>
      <p className="text-xs text-gray-500 mb-3">
        Pilots see a warning in the logbook form if a guest's recorded weight exceeds this —
        informational only, since it's checked after the flight already happened.
      </p>
      {saved && <p className="text-sm text-emerald-600 mb-2">Saved.</p>}
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm"
        />
        <span className="text-sm text-gray-500">kg</span>
        <button onClick={save} disabled={busy} className="ml-auto px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
          Save
        </button>
      </div>
    </div>
  );
}
