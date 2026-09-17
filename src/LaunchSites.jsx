import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Managers pre-register known takeoff points with surveyed elevation
// here — this is what lets the mobile app's height-above-ground
// calculation use a real reference instead of a single noisy GPS
// altitude reading at the moment "Start flight" was pressed.
export default function LaunchSites() {
  const [sites, setSites] = useState([]);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [elevation, setElevation] = useState('');
  const [radius, setRadius] = useState('500');
  const [saving, setSaving] = useState(false);

  const load = () => {
    supabase.from('launch_sites').select('*').order('name').then(({ data }) => setSites(data || []));
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name || !lat || !lng || !elevation) return;
    setSaving(true);
    await supabase.from('launch_sites').insert({
      name, lat: Number(lat), lng: Number(lng), elevation_m: Number(elevation), radius_m: Number(radius) || 500,
    });
    setName(''); setLat(''); setLng(''); setElevation(''); setRadius('500');
    load();
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this launch site?')) return;
    await supabase.from('launch_sites').delete().eq('id', id);
    load();
  };

  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(String(pos.coords.latitude.toFixed(6)));
      setLng(String(pos.coords.longitude.toFixed(6)));
    });
  };

  return (
    <div className="p-4 max-w-2xl">
      <h2 className="text-lg font-semibold mb-1">Launch sites</h2>
      <p className="text-sm text-gray-500 mb-4">
        Registering a known site's real elevation improves the accuracy of every pilot's
        height-based airborne detection when they take off within its radius.
      </p>

      <div className="border border-gray-200 rounded-lg p-4 mb-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Site name" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          <input value={elevation} onChange={(e) => setElevation(e.target.value)} placeholder="Elevation (m)" type="number" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" type="number" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude" type="number" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          <input value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="Radius (m)" type="number" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          <button onClick={useCurrentLocation} className="text-sm text-brand-700 border border-brand-200 rounded-md px-2 py-1.5">
            Use my current location
          </button>
        </div>
        <button onClick={add} disabled={saving} className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium disabled:opacity-50">
          Add site
        </button>
      </div>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
        {sites.map((s) => (
          <li key={s.id} className="px-4 py-3 flex justify-between items-center text-sm">
            <div>
              <p className="font-medium text-gray-900">{s.name}</p>
              <p className="text-xs text-gray-500">
                {s.lat.toFixed(5)}, {s.lng.toFixed(5)} · {s.elevation_m}m elevation · {s.radius_m}m radius
              </p>
            </div>
            <button onClick={() => remove(s.id)} className="text-xs text-red-600 hover:underline">Delete</button>
          </li>
        ))}
        {sites.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">No launch sites registered yet.</li>}
      </ul>
    </div>
  );
}
