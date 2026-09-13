import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { WhatsAppNotifyButton } from './WhatsAppNotify';

// Builds a Google Maps satellite-view link centered on the pilot's
// last known coordinates, for handing directly to a search crew.
const satelliteLink = (lat, lng) =>
  `https://www.google.com/maps/@${lat},${lng},1000m/data=!3m1!1e3`;

const initials = (name) =>
  (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

function overdueBy(openedAt) {
  const ms = Date.now() - new Date(openedAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export default function RescueRegistry() {
  const [incidents, setIncidents] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [, forceTick] = useState(0);

  const loadIncidents = async () => {
    const { data } = await supabase
      .from('rescue_incidents')
      .select('id, pilot_id, last_known_lat, last_known_lng, opened_at, profiles(name, phone_e164)')
      .eq('resolved', false)
      .order('opened_at', { ascending: true });
    setIncidents(data || []);
  };

  useEffect(() => {
    loadIncidents();

    const alertChannel = supabase
      .channel('flight-alerts', { config: { private: true } })
      .on('broadcast', { event: 'rescue-alert' }, loadIncidents)
      .subscribe();

    const dbChannel = supabase
      .channel('rescue_incidents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rescue_incidents' }, loadIncidents)
      .subscribe();

    // Overdue duration ("6h 12m") is computed client-side from opened_at,
    // so it needs its own tick to stay live rather than freezing at
    // whatever it read on load.
    const tick = setInterval(() => forceTick((n) => n + 1), 60_000);

    return () => {
      supabase.removeChannel(alertChannel);
      supabase.removeChannel(dbChannel);
      clearInterval(tick);
    };
  }, []);

  const resolve = async (id) => {
    setBusyId(id);
    await supabase.rpc('resolve_rescue_incident', { p_incident_id: id });
    setBusyId(null);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.3 3.9L2 20h20L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Rescue registry</h2>
      </div>

      {incidents.length === 0 ? (
        <div className="bg-brand-50 rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-brand-800">All clear</p>
          <p className="text-xs text-brand-700 mt-0.5">No overdue pilots — everyone's checked in.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {incidents.map((i) => (
            <li
              key={i.id}
              className="bg-white border border-gray-200 rounded-2xl p-4 border-l-4 border-l-red-500"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-sm font-medium text-red-700">
                  {initials(i.profiles?.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">{i.profiles?.name ?? 'Unknown pilot'}</p>
                    <span className="text-xs font-medium text-red-700 bg-red-50 rounded-full px-2 py-0.5 whitespace-nowrap">
                      {overdueBy(i.opened_at)} overdue
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Airborne, last check-in {new Date(i.opened_at).toLocaleString()}
                  </p>

                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={satelliteLink(i.last_known_lat, i.last_known_lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-brand-700 font-medium hover:underline"
                    >
                      Satellite view
                    </a>
                    <WhatsAppNotifyButton
                      phoneE164={i.profiles?.phone_e164}
                      pilotName={i.profiles?.name ?? 'Pilot'}
                      lastKnownLocationUrl={satelliteLink(i.last_known_lat, i.last_known_lng)}
                    />
                  </div>
                  {!i.profiles?.phone_e164 && (
                    <p className="text-xs text-gray-400 mt-1">No phone number on file for this pilot.</p>
                  )}

                  <button
                    disabled={busyId === i.id}
                    onClick={() => resolve(i.id)}
                    className="mt-3 w-full px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    Mark resolved
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
