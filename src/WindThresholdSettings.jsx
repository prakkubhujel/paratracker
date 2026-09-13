import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function WindThresholdSettings() {
  const [value, setValue] = useState('');
  const [savedValue, setSavedValue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('wind_thresholds')
      .select('max_wind_speed_kmh, updated_at')
      .eq('id', 1)
      .single();
    if (error) setError(error.message);
    else {
      setValue(String(data.max_wind_speed_kmh));
      setSavedValue(data);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const numeric = Number(value);
    if (!numeric || numeric <= 0) {
      setError('Enter a wind speed greater than 0.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);

    const { error } = await supabase
      .from('wind_thresholds')
      .update({ max_wind_speed_kmh: numeric, updated_by: (await supabase.auth.getUser()).data.user?.id })
      .eq('id', 1);

    if (error) setError(error.message);
    else {
      setSaved(true);
      await load();
    }
    setBusy(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 max-w-sm">
      <h3 className="text-sm font-medium text-gray-700 mb-1">Wind restriction threshold</h3>
      <p className="text-xs text-gray-500 mb-3">
        Triggers a weather-emergency alert when a reading exceeds this speed.
      </p>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {saved && <p className="text-sm text-emerald-600 mb-2">Saved.</p>}

      <div className="flex gap-2 items-center">
        <input
          type="number"
          min="1"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          className="w-28 border border-gray-300 rounded-md px-2 py-1 text-sm"
        />
        <span className="text-sm text-gray-500">km/h</span>
        <button
          onClick={save}
          disabled={busy}
          className="ml-auto px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50"
        >
          Save
        </button>
      </div>

      {savedValue?.updated_at && (
        <p className="text-xs text-gray-400 mt-2">
          Last updated {new Date(savedValue.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
