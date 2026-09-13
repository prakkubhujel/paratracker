import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import SvgBarChart from './SvgBarChart';
import { exportToCsv } from './exportToCsv';
import { exportFlightHistoryToPdf } from './exportFlightHistoryToPdf';

// pilotId: pass a specific pilot's id to scope the view, or leave
// undefined for "everything RLS lets the current caller see" —
// a pilot's own logs, or all logs if the caller is a manager.
export default function AnalyticsDashboard({ pilotId }) {
  const [monthly, setMonthly] = useState([]);
  const [yearly, setYearly] = useState([]);
  const [summary, setSummary] = useState({ total_minutes: 0, flight_count: 0 });
  const [weatherOptions, setWeatherOptions] = useState([]);
  const [weatherFilter, setWeatherFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [rangeBounds, setRangeBounds] = useState(null);
  const [densityRange, setDensityRange] = useState(null); // [min, max] or null until bounds load
  const [cloudRange, setCloudRange] = useState(null);
  const [rangeFiltered, setRangeFiltered] = useState([]);
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [rawRows, setRawRows] = useState([]);

  useEffect(() => {
    supabase.rpc('get_logged_weather_conditions').then(({ data }) => {
      setWeatherOptions((data || []).map((r) => r.weather_condition));
    });
    supabase.rpc('get_weather_range_bounds').then(({ data }) => {
      const bounds = data?.[0];
      if (bounds && bounds.min_density != null) {
        setRangeBounds(bounds);
        setDensityRange([bounds.min_density, bounds.max_density]);
        setCloudRange([bounds.min_cloud_pct ?? 0, bounds.max_cloud_pct ?? 100]);
      }
    });
  }, []);

  useEffect(() => {
    if (!rangeEnabled || !densityRange || !cloudRange) return;
    supabase
      .rpc('get_monthly_totals_by_weather_range', {
        p_pilot_id: pilotId ?? null,
        p_months: 12,
        p_min_density: densityRange[0],
        p_max_density: densityRange[1],
        p_min_cloud_pct: cloudRange[0],
        p_max_cloud_pct: cloudRange[1],
      })
      .then(({ data }) => setRangeFiltered(data || []));
  }, [rangeEnabled, densityRange, cloudRange, pilotId]);

  useEffect(() => {
    setLoading(true);
    const weatherArg = weatherFilter || null;

    let rawQuery = supabase
      .from('logbooks')
      .select('date, flying_person_name, weather_condition, flight_duration_minutes')
      .order('date', { ascending: false });
    if (pilotId) rawQuery = rawQuery.eq('pilot_id', pilotId);
    if (weatherArg) rawQuery = rawQuery.eq('weather_condition', weatherArg);

    Promise.all([
      supabase.rpc('get_monthly_flight_totals', {
        p_pilot_id: pilotId ?? null,
        p_months: 12,
        p_weather_condition: weatherArg,
      }),
      supabase.rpc('get_yearly_flight_totals', {
        p_pilot_id: pilotId ?? null,
        p_weather_condition: weatherArg,
      }),
      supabase.rpc('get_flight_summary', {
        p_pilot_id: pilotId ?? null,
        p_weather_condition: weatherArg,
      }),
      rawQuery,
    ]).then(([monthlyRes, yearlyRes, summaryRes, rawRes]) => {
      setMonthly(monthlyRes.data || []);
      setYearly(yearlyRes.data || []);
      setSummary(summaryRes.data?.[0] || { total_minutes: 0, flight_count: 0 });
      setRawRows(rawRes.data || []);
      setLoading(false);
    });
  }, [pilotId, weatherFilter]);

  const hours = (summary.total_minutes / 60).toFixed(1);
  const avgFlightMin =
    summary.flight_count > 0 ? Math.round(summary.total_minutes / summary.flight_count) : 0;

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2">
              <path d="M3 3v18h18M7 15l4-6 4 3 5-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Flight analytics</h2>
        </div>
        <select
          value={weatherFilter}
          onChange={(e) => setWeatherFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1"
        >
          <option value="">All weather conditions</option>
          {weatherOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      {/* Metric cards — same tinted-card treatment as the mobile Flight
          screen's stat row, for a consistent brand language across
          platforms rather than the previous plain white/gray cards. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-brand-50 rounded-2xl p-4">
          <p className="text-xs text-brand-700 font-medium">Total sky duration</p>
          <p className="text-2xl font-semibold text-brand-800 mt-1">{hours}h</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs text-gray-500 font-medium">Flights logged</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{summary.flight_count}</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs text-gray-500 font-medium">Avg. flight</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{avgFlightMin}m</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => exportToCsv('flight-log', rawRows)}
          disabled={rawRows.length === 0}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:border-brand-400 hover:text-brand-700 disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-700"
        >
          Export CSV
        </button>
        <button
          onClick={() => exportFlightHistoryToPdf({ rows: rawRows })}
          disabled={rawRows.length === 0}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:border-brand-400 hover:text-brand-700 disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-700"
        >
          Export PDF
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading charts…</p>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <SvgBarChart
              title="Monthly airtime (minutes) — last 12 months"
              data={monthly}
              labelKey="month_label"
              valueKey="total_minutes"
            />
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <SvgBarChart
              title="Yearly airtime (minutes)"
              data={yearly}
              labelKey="year_label"
              valueKey="total_minutes"
            />
          </div>
        </>
      )}

      {/* Coral framing marks this as the "dig deeper" tool, distinct
          from the primary charts above — same coral-as-attention-accent
          language used in WeatherPanel and the mobile weather strip. */}
      {rangeBounds && (
        <div className="bg-coral-50 border border-coral-100 rounded-2xl p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-coral-800">
            <input
              type="checkbox"
              checked={rangeEnabled}
              onChange={(e) => setRangeEnabled(e.target.checked)}
            />
            Cross-filter by air density / cloud cover
          </label>

          {rangeEnabled && densityRange && cloudRange && (
            <div className="grid grid-cols-2 gap-6">
              <RangeSliderPair
                label="Air density (kg/m³)"
                min={rangeBounds.min_density}
                max={rangeBounds.max_density}
                step={0.01}
                value={densityRange}
                onChange={setDensityRange}
              />
              <RangeSliderPair
                label="Cloud cover (%)"
                min={rangeBounds.min_cloud_pct ?? 0}
                max={rangeBounds.max_cloud_pct ?? 100}
                step={1}
                value={cloudRange}
                onChange={setCloudRange}
              />
            </div>
          )}
        </div>
      )}

      {rangeEnabled && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <SvgBarChart
            title="Monthly airtime within selected weather range"
            data={rangeFiltered}
            labelKey="month_label"
            valueKey="total_minutes"
          />
          {rangeFiltered.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              No days in range have both flights and a weather reading —
              this needs weather_readings populated (see ingest-weather).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Two-thumb range control built from two plain <input type="range">
// elements layered together — no extra dependency for something this
// simple, and it's kept honest with numeric readouts since overlapping
// native sliders can be fiddly to grab precisely.
function RangeSliderPair({ label, min, max, step, value, onChange }) {
  const [lo, hi] = value;

  return (
    <div>
      <p className="text-xs text-coral-700 mb-1">
        {label}: {lo} – {hi}
      </p>
      <div className="relative h-6">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          className="absolute w-full appearance-none bg-transparent pointer-events-none
                     [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-coral-600 [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:pointer-events-auto"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
          className="absolute w-full appearance-none bg-transparent pointer-events-none
                     [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-coral-800 [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:pointer-events-auto"
        />
      </div>
    </div>
  );
}
