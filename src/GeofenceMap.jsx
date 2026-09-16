import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, FeatureGroup, Polyline } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { supabase } from './supabaseClient';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Default geofence center per project spec §4:
// Sarangkot and Toripani, Pokhara, Nepal
const DEFAULT_CENTER = [28.2485, 83.945];
const DEFAULT_ZOOM = 13;

export default function GeofenceMap() {
  const [geofences, setGeofences] = useState([]);
  const [pilots, setPilots] = useState({}); // pilot_id -> { lat, lng, name, status }
  const [trails, setTrails] = useState({}); // pilot_id -> [[lat,lng], ...]
  const [alerts, setAlerts] = useState([]);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const channelRef = useRef(null);
  const featureGroupRef = useRef(null);

  const loadGeofences = async () => {
    const { data } = await supabase.rpc('get_geofences_geojson');
    if (data) setGeofences(data);
  };

  const loadPositions = async () => {
    const { data } = await supabase.rpc('get_live_positions');
    if (data) {
      const asMap = {};
      for (const p of data) {
        asMap[p.pilot_id] = {
          lat: p.lat, lng: p.lng, status: p.status, name: p.name,
          altitude: p.altitude_m, speed: p.speed_kmh,
        };
      }
      setPilots(asMap);

      // Breadcrumb trail — last 15 minutes, airborne pilots only (a
      // grounded pilot's trail isn't operationally useful and would
      // just clutter the map).
      const trailEntries = await Promise.all(
        data
          .filter((p) => p.status === 'airborne')
          .map(async (p) => {
            const { data: trail } = await supabase.rpc('get_recent_trail', {
              p_pilot_id: p.pilot_id,
              p_minutes: 15,
            });
            return [p.pilot_id, (trail || []).map((t) => [t.lat, t.lng])];
          })
      );
      setTrails(Object.fromEntries(trailEntries));
    }
  };

  useEffect(() => {
    loadGeofences();
    loadPositions();
  }, []);

  // Editing/deleting geofences was never actually wired up before —
  // only creation was. Leaflet's edit/delete toolbar only recognizes
  // shapes that live inside the FeatureGroup layer group IT manages,
  // not arbitrary shapes rendered elsewhere on the map — so loaded
  // geofences have to be added into that same group as raw Leaflet
  // layers (imperatively, via the Leaflet API directly) rather than
  // as separate <Polygon> React components, or the edit toolbar has
  // nothing to act on.
  useEffect(() => {
    const group = featureGroupRef.current;
    if (!group) return;

    group.clearLayers();
    for (const g of geofences) {
      const layer = L.geoJSON(g.boundary).getLayers()[0];
      if (!layer) continue;
      layer.geofenceId = g.id;
      layer.geofenceName = g.name;
      layer.setStyle?.({ color: '#0F6E56', weight: 2, fillOpacity: 0.08 });
      layer.bindPopup(g.name);
      group.addLayer(layer);
    }
  }, [geofences]);

  const handleCreated = async (e) => {
    const geojson = e.layer.toGeoJSON();
    const name = window.prompt('Name this geofence:', 'New boundary') || 'Untitled';
    await supabase.rpc('save_geofence_from_geojson', {
      p_name: name,
      p_geojson: geojson.geometry,
    });
    // The newly-drawn layer was added directly to the FeatureGroup by
    // leaflet-draw itself — remove it and reload from the database
    // instead, so it carries the same geofenceId/edit wiring as every
    // other geofence rather than being a one-off untracked layer.
    featureGroupRef.current?.removeLayer(e.layer);
    loadGeofences();
  };

  const handleEdited = async (e) => {
    const updates = [];
    e.layers.eachLayer((layer) => {
      if (layer.geofenceId != null) {
        updates.push(
          supabase.rpc('update_geofence_boundary', {
            p_id: layer.geofenceId,
            p_geojson: layer.toGeoJSON().geometry,
          })
        );
      }
    });
    await Promise.all(updates);
    loadGeofences();
  };

  const handleDeleted = async (e) => {
    const deletions = [];
    e.layers.eachLayer((layer) => {
      if (layer.geofenceId != null) {
        deletions.push(supabase.rpc('delete_geofence', { p_id: layer.geofenceId }));
      }
    });
    await Promise.all(deletions);
    loadGeofences();
  };

  // Realtime: postgres_changes payloads have the same raw-geometry
  // encoding problem as a direct fetch does, so rather than parsing
  // the change payload directly, use it purely as a signal to re-fetch
  // clean data via the RPCs above.
  useEffect(() => {
    const posSub = supabase
      .channel('live_positions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_positions' },
        () => loadPositions()
      )
      .subscribe();

    const alertChannel = supabase.channel('flight-alerts', { config: { private: true } });
    alertChannel
      .on('broadcast', { event: 'out-of-bounds' }, ({ payload }) => {
        setAlerts((prev) => [{ id: Date.now(), ...payload }, ...prev].slice(0, 20));
      })
      .subscribe();

    channelRef.current = alertChannel;

    return () => {
      supabase.removeChannel(posSub);
      supabase.removeChannel(alertChannel);
    };
  }, []);

  const dismissAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const unlockAudio = () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
    setAudioUnlocked(true);
  };

  const pilotList = Object.values(pilots);
  const airborneCount = pilotList.filter((p) => p.status === 'airborne').length;
  const groundedCount = pilotList.length - airborneCount;

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 left-4 z-[1000] flex gap-2">
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <p className="text-lg font-semibold text-brand-700 leading-none">{airborneCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Airborne</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <p className="text-lg font-semibold text-gray-900 leading-none">{groundedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Grounded</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <p className="text-lg font-semibold text-gray-900 leading-none">{geofences.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Geofences</p>
        </div>
        <button
          onClick={unlockAudio}
          className={`text-xs font-medium rounded-xl px-3 py-2 shadow-sm ${
            audioUnlocked ? 'bg-white/95 text-brand-700 border border-gray-200' : 'bg-brand-600 text-white'
          }`}
        >
          {audioUnlocked ? '🔊 Sound enabled — test' : '🔊 Enable alert sounds'}
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 w-80">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="bg-red-600 text-white rounded-lg shadow-lg px-4 py-3 flex justify-between items-start"
            >
              <div>
                <p className="font-semibold">Out of bounds</p>
                <p className="text-sm opacity-90">
                  {a.pilot_name ?? 'Pilot'} left the geofence
                </p>
              </div>
              <button
                onClick={() => dismissAlert(a.id)}
                className="ml-3 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="w-full h-full">
        <TileLayer
          // CARTO Voyager — free, no API key required, closer visually
          // to Google Maps' clean style than default OpenStreetMap tiles
          // (subtler colors, clearer labels). Real Google Maps tiles are
          // a separate, bigger decision: they require a Google Cloud
          // API key with billing enabled (there's a monthly free credit,
          // but it's not free the way this is), and Google's terms
          // don't allow pulling their tiles into a generic map library
          // like Leaflet — you'd need Google's own Maps JavaScript API
          // (@react-google-maps/api or similar), which is a different
          // integration, not a one-line tile URL swap. Worth doing if
          // the exact Google look/behavior matters enough to justify
          // that setup and ongoing cost; this is the free equivalent.
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <FeatureGroup ref={featureGroupRef}>
          <EditControl
            position="topright"
            draw={{ rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false }}
            onCreated={handleCreated}
            onEdited={handleEdited}
            onDeleted={handleDeleted}
          />
        </FeatureGroup>

        {Object.entries(trails).map(([id, points]) =>
          points.length > 1 ? (
            <Polyline
              key={`trail-${id}`}
              positions={points}
              pathOptions={{ color: '#16a34a', weight: 3, opacity: 0.5, dashArray: '4 6' }}
            />
          ) : null
        )}

        {Object.entries(pilots).map(([id, p]) => (
          <CircleMarker
            key={id}
            center={[p.lat, p.lng]}
            radius={8}
            pathOptions={{
              color: p.status === 'airborne' ? '#16a34a' : '#6b7280',
              fillOpacity: 0.9,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]} className="pilot-label">
              {p.name}
            </Tooltip>
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.status}
              {(p.altitude != null || p.speed != null) && (
                <>
                  <br />
                  {p.altitude != null ? `${Math.round(p.altitude)}m alt` : ''}
                  {p.altitude != null && p.speed != null ? ' · ' : ''}
                  {p.speed != null ? `${p.speed} km/h` : ''}
                </>
              )}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
