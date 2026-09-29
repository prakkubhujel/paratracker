import { useEffect, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, LayersControl, CircleMarker, Circle,
  Popup, Tooltip, FeatureGroup, Polyline, useMap,
} from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { supabase } from './supabaseClient';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const DEFAULT_CENTER = [28.2485, 83.945]; // Sarangkot/Toripani, Pokhara
const DEFAULT_ZOOM = 13;

// Gives GeofenceMap a way to command the Leaflet map instance (for
// "click the SOS alert, center on it") — react-leaflet v4 doesn't
// expose the map instance via a plain ref on MapContainer the way
// earlier versions did; a child using useMap() is the supported path.
function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

// A CircleMarker whose radius pulses — used for an active SOS, so it's
// visually distinct from every other marker on the map at a glance,
// not just a color difference.
function PulsingMarker({ center, color }) {
  const [radius, setRadius] = useState(10);
  useEffect(() => {
    let growing = true;
    const interval = setInterval(() => {
      setRadius((r) => {
        if (r >= 22) growing = false;
        if (r <= 10) growing = true;
        return growing ? r + 1.5 : r - 1.5;
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);
  return (
    <CircleMarker
      center={center}
      radius={radius}
      pathOptions={{ color, weight: 3, fillOpacity: 0.15, opacity: 0.7 - (radius - 10) / 24 }}
    />
  );
}

export default function GeofenceMap() {
  const [geofences, setGeofences] = useState([]);
  const [launchSites, setLaunchSites] = useState([]);
  const [pilots, setPilots] = useState({});
  const [trails, setTrails] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]); // active SOS pins, separate from the toast list
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const channelRef = useRef(null);
  const featureGroupRef = useRef(null);
  const mapRef = useRef(null);

  const loadGeofences = async () => {
    const { data } = await supabase.rpc('get_geofences_geojson');
    if (data) setGeofences(data);
  };

  // Was built (registration UI, mobile lookup RPC) but never actually
  // rendered on this map — a real gap, not a design choice. Reads the
  // table directly since RLS already allows any authenticated read.
  const loadLaunchSites = async () => {
    const { data } = await supabase.from('launch_sites').select('*');
    if (data) setLaunchSites(data);
  };

  const loadPositions = async () => {
    const { data } = await supabase.rpc('get_live_positions');
    if (data) {
      const asMap = {};
      for (const p of data) {
        asMap[p.pilot_id] = {
          lat: p.lat, lng: p.lng, status: p.status, name: p.name,
          altitude: p.altitude_m, speed: p.speed_kmh, lastPing: p.last_ping_at,
        };
      }
      setPilots(asMap);

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

  const loadActiveSos = async () => {
    const { data } = await supabase.from('sos_alerts').select('*, profiles(name)').eq('resolved', false);
    setSosAlerts(data || []);
  };

  useEffect(() => {
    loadGeofences();
    loadLaunchSites();
    loadPositions();
    loadActiveSos();
  }, []);

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
    await supabase.rpc('save_geofence_from_geojson', { p_name: name, p_geojson: geojson.geometry });
    featureGroupRef.current?.removeLayer(e.layer);
    loadGeofences();
  };

  const handleEdited = async (e) => {
    const updates = [];
    e.layers.eachLayer((layer) => {
      if (layer.geofenceId != null) {
        updates.push(supabase.rpc('update_geofence_boundary', { p_id: layer.geofenceId, p_geojson: layer.toGeoJSON().geometry }));
      }
    });
    await Promise.all(updates);
    loadGeofences();
  };

  const handleDeleted = async (e) => {
    const deletions = [];
    e.layers.eachLayer((layer) => {
      if (layer.geofenceId != null) deletions.push(supabase.rpc('delete_geofence', { p_id: layer.geofenceId }));
    });
    await Promise.all(deletions);
    loadGeofences();
  };

  useEffect(() => {
    const posSub = supabase
      .channel('live_positions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_positions' }, () => loadPositions())
      .subscribe();

    const alertChannel = supabase.channel('flight-alerts', { config: { private: true } });
    alertChannel
      .on('broadcast', { event: 'out-of-bounds' }, ({ payload }) => {
        setAlerts((prev) => [{ id: Date.now(), type: 'out-of-bounds', ...payload }, ...prev].slice(0, 20));
      })
      // Real-time SOS: previously only landed in the Rescue registry
      // with no indication on the map itself unless a manager happened
      // to already be on that tab. Now shows a sticky banner here too,
      // plus a pulsing marker at the pilot's location.
      .on('broadcast', { event: 'sos-alert' }, ({ payload }) => {
        setAlerts((prev) => [{ id: Date.now(), type: 'sos-alert', ...payload }, ...prev].slice(0, 20));
        loadActiveSos();
      })
      .subscribe();

    channelRef.current = alertChannel;

    return () => {
      supabase.removeChannel(posSub);
      supabase.removeChannel(alertChannel);
    };
  }, []);

  const dismissAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const centerOn = (lat, lng) => {
    mapRef.current?.flyTo([lat, lng], 15, { duration: 1 });
  };

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
              onClick={() => a.lat != null && centerOn(a.lat, a.lng)}
              className={`text-white rounded-lg shadow-lg px-4 py-3 flex justify-between items-start cursor-pointer ${
                a.type === 'sos-alert' ? 'bg-red-700 border-2 border-red-300 animate-pulse' : 'bg-red-600'
              }`}
            >
              <div>
                <p className="font-semibold">{a.type === 'sos-alert' ? '🆘 SOS ALERT' : 'Out of bounds'}</p>
                <p className="text-sm opacity-90">
                  {a.pilot_name ?? 'Pilot'} {a.type === 'sos-alert' ? 'needs help — tap to locate' : 'left the geofence'}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismissAlert(a.id); }}
                className="ml-3 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="w-full h-full">
        <MapController mapRef={mapRef} />

        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="Standard">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            {/* Esri World Imagery — free, no API key. Not Google Maps:
                Google's satellite tiles can't be pulled into a generic
                map library like Leaflet under their terms (same reason
                real Google Maps was flagged earlier as a separate,
                bigger integration). Esri's terms permit this kind of
                use without a key. Markers/overlays render in Leaflet's
                own marker pane above every base layer's tile pane by
                default — switching base layers here doesn't hide them,
                by design of how LayersControl.BaseLayer works, unlike
                manually swapping a single TileLayer's url. */}
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <FeatureGroup ref={featureGroupRef}>
          <EditControl
            position="topright"
            draw={{ rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false }}
            onCreated={handleCreated}
            onEdited={handleEdited}
            onDeleted={handleDeleted}
          />
        </FeatureGroup>

        {launchSites.map((s) => (
          <div key={`site-${s.id}`}>
            <Circle
              center={[s.lat, s.lng]}
              radius={s.radius_m}
              pathOptions={{ color: '#7c3aed', weight: 1, fillOpacity: 0.05, dashArray: '3 5' }}
            />
            <CircleMarker
              center={[s.lat, s.lng]}
              radius={7}
              pathOptions={{ color: '#7c3aed', fillOpacity: 1, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -6]}>🚀 {s.name}</Tooltip>
              <Popup>
                <strong>{s.name}</strong>
                <br />
                Launch site — {s.elevation_m}m elevation
                <br />
                {s.radius_m}m detection radius
              </Popup>
            </CircleMarker>
          </div>
        ))}

        {sosAlerts.map((s) => (
          <PulsingMarker key={`sos-${s.id}`} center={[s.lat, s.lng]} color="#dc2626" />
        ))}

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
            pathOptions={{ color: p.status === 'airborne' ? '#16a34a' : '#6b7280', fillOpacity: 0.9 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]} className="pilot-label">
              {p.name}
            </Tooltip>
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.status}
              <br />
              Last seen {new Date(p.lastPing).toLocaleTimeString()}
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
