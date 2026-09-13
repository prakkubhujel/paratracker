import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function InfraHealthPanel() {
  const [health, setHealth] = useState(null);
  const [warning, setWarning] = useState(null);

  const refresh = async () => {
    const { data } = await supabase.rpc('get_db_health');
    setHealth(data?.[0] ?? null);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000); // client-side poll as a backup to the broadcast

    const channel = supabase.channel('flight-alerts', { config: { private: true } });
    channel.on('broadcast', { event: 'infra-warning' }, ({ payload }) => setWarning(payload)).subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  if (!health) return null;

  const isHot = health.connection_pct > 80;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Database health</h3>

      {warning && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm rounded-md px-3 py-2 mb-3">
          Connection pool hit {warning.connection_pct}% ({warning.active_connections}/
          {warning.max_connections})
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Connections</p>
          <p className={`font-semibold ${isHot ? 'text-red-600' : 'text-gray-900'}`}>
            {health.active_connections} / {health.max_connections} ({health.connection_pct}%)
          </p>
        </div>
        <div>
          <p className="text-gray-500">Longest active query</p>
          <p className="font-semibold text-gray-900">{health.longest_query_seconds}s</p>
        </div>
      </div>
    </div>
  );
}
