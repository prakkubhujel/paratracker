import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import AuthScreen from './AuthScreen';
import GeofenceMap from './GeofenceMap';
import ApprovalQueue from './ApprovalQueue';
import AnalyticsDashboard from './AnalyticsDashboard';
import WeatherPanel from './WeatherPanel';
import RescueRegistry from './RescueRegistry';
import LiveStatusBoard from './LiveStatusBoard';
import PilotsPanel from './PilotsPanel';
import SystemPanel from './SystemPanel';
import AdminBroadcast from './AdminBroadcast';
import DiagnosticsPanel from './DiagnosticsPanel';
import { MilestoneBanner } from './Milestones';
import { useAudioAlertManager } from './useAudioAlertManager';

const TABS = [
  { id: 'map', label: 'Live map', component: GeofenceMap },
  { id: 'status', label: 'Status board', component: LiveStatusBoard },
  { id: 'analytics', label: 'Analytics', component: AnalyticsDashboard },
  { id: 'weather', label: 'Weather', component: WeatherPanel },
  { id: 'rescue', label: 'Rescue registry', component: RescueRegistry },
  { id: 'pilots', label: 'Pilots', component: PilotsPanel },
  { id: 'broadcast', label: 'Broadcast', component: AdminBroadcast },
  { id: 'approvals', label: 'Approvals', component: ApprovalQueue },
  { id: 'system', label: 'System', component: SystemPanel },
];

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [activeTab, setActiveTab] = useState('map');
  useAudioAlertManager();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // avoid a login-screen flash while checking
  if (!session) return <AuthScreen />;

  const ActivePanel = TABS.find((t) => t.id === activeTab)?.component ?? GeofenceMap;

  return (
    <div className="h-screen flex flex-col">
      <header className="relative bg-brand-600 px-4 pt-3 pb-2 space-y-2 overflow-hidden">
        {/* Mountain silhouette motif — flat shapes only, matches the
            design direction's brand touch on the map's empty state too. */}
        <svg
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-10 pointer-events-none"
          aria-hidden="true"
        >
          <polygon points="0,40 50,10 110,40" fill="rgba(255,255,255,0.12)" />
          <polygon points="90,40 170,4 230,40" fill="rgba(255,255,255,0.18)" />
          <polygon points="200,40 280,14 400,40" fill="rgba(255,255,255,0.12)" />
        </svg>

        <div className="relative flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Cloudbase — Pokhara Ops</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-brand-100 hover:text-white"
          >
            Log out
          </button>
        </div>
        <div className="relative">
          <MilestoneBanner />
          <DiagnosticsPanel />
        </div>
        <nav className="relative flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm rounded-md ${
                activeTab === tab.id
                  ? 'bg-white text-brand-800'
                  : 'text-brand-100 hover:bg-brand-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Each panel is a separate, independently-loaded container per
          spec §53 — switching tabs unmounts the previous panel rather
          than layering everything into one script. */}
      <main className="flex-1 overflow-auto">
        <ActivePanel />
      </main>
    </div>
  );
}
