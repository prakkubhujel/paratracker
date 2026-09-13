import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import WindThresholdSettings from './WindThresholdSettings';

export default function WeatherPanel() {
  const [weather, setWeather] = useState(null);
  const [windAlert, setWindAlert] = useState(null);
  const [isManager, setIsManager] = useState(false);

  const loadLatest = async () => {
    const { data } = await supabase.rpc('get_latest_weather');
    setWeather(data?.[0] ?? null);
  };

  useEffect(() => {
    loadLatest();
    supabase.rpc('is_manager').then(({ data }) => setIsManager(!!data));

    const channel = supabase.channel('weather-alerts', { config: { private: true } });
    channel
      .on('broadcast', { event: 'weather-emergency' }, ({ payload }) => {
        setWindAlert(payload);
        loadLatest();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Live conditions — {weather?.station_name ?? '—'}</h3>

      {windAlert && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-md px-3 py-2">
          Wind at {windAlert.station_name} hit {windAlert.wind_speed_kmh} km/h
          (threshold {windAlert.threshold_kmh} km/h).
        </div>
      )}

      {!weather ? (
        <p className="text-gray-400 text-sm">No readings yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Air density" value={`${weather.air_density_kgm3} kg/m³`} />
          <Metric label="Cloud cover" value={weather.cloud_cover_pct != null ? `${weather.cloud_cover_pct}%` : '—'} />
          <Metric label="Wind speed" value={weather.wind_speed_kmh != null ? `${weather.wind_speed_kmh} km/h` : '—'} />
          <Metric label="Temperature" value={`${weather.temperature_c}°C`} />
        </div>
      )}
      {isManager && <WindThresholdSettings />}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{value}</p>
    </div>
  );
}
