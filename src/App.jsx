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
import Logbook from './Logbook';
import AuditLog from './AuditLog';
import LaunchSites from './LaunchSites';
import WeeklySummary from './WeeklySummary';
import DiagnosticsPanel from './DiagnosticsPanel';
import { MilestoneBanner } from './Milestones';
import { useAudioAlertManager } from './useAudioAlertManager';

// minRole: undefined = any approved logged-in user; 'instructor' =
// instructor or manager; 'manager' = manager only. This is a UI-level
// convenience, not the actual security boundary — every sensitive
// action (suspend/delete/approve/broadcast/etc.) is independently
// enforced by RLS and is_manager() checks inside the RPCs themselves,
// regardless of what this list shows. A gap worth knowing: PilotsPanel's
// suspend/delete buttons aren't individually hidden from an instructor
// viewing that tab — clicking one would just get rejected by the
// database rather than being invisible, which is safe but not polished.
const TABS = [
  { id: 'map', label: 'Live map', component: GeofenceMap },
  { id: 'status', label: 'Status board', component: LiveStatusBoard },
  { id: 'analytics', label: 'Analytics', component: AnalyticsDashboard },
  { id: 'logbook', label: 'Logbook', component: Logbook },
  { id: 'weather', label: 'Weather', component: WeatherPanel },
  { id: 'rescue', label: 'Rescue registry', component: RescueRegistry },
  { id: 'summary', label: 'Weekly summary', component: WeeklySummary },
  { id: 'pilots', label: 'Pilots', component: PilotsPanel, minRole: 'instructor' },
  { id: 'sites', label: 'Launch sites', component: LaunchSites, minRole: 'manager' },
  { id: 'broadcast', label: 'Broadcast', component: AdminBroadcast, minRole: 'manager' },
  { id: 'approvals', label: 'Approvals', component: ApprovalQueue, minRole: 'manager' },
  { id: 'audit', label: 'Audit log', component: AuditLog, minRole: 'manager' },
  { id: 'system', label: 'System', component: SystemPanel, minRole: 'manager' },
];

function tabVisible(tab, role) {
  if (!tab.minRole) return true;
  if (tab.minRole === 'instructor') return role === 'instructor' || role === 'manager';
  if (tab.minRole === 'manager') return role === 'manager';
  return true;
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  useAudioAlertManager();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.rpc('get_my_role').then(({ data }) => setRole(data?.[0]?.role ?? 'pilot'));
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <AuthScreen />;

  const visibleTabs = TABS.filter((t) => tabVisible(t, role));
  const ActivePanel = visibleTabs.find((t) => t.id === activeTab)?.component ?? GeofenceMap;

  return (
    <div className="h-screen flex flex-col">
      <header className="relative bg-brand-600 px-4 pt-3 pb-2 space-y-2 overflow-hidden">
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
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-brand-100 hover:text-white">
            Log out
          </button>
        </div>
        <div className="relative">
          <MilestoneBanner />
          <DiagnosticsPanel />
        </div>
        <nav className="relative flex gap-1 flex-wrap">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm rounded-md ${
                activeTab === tab.id ? 'bg-white text-brand-800' : 'text-brand-100 hover:bg-brand-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-auto">
        <ActivePanel />
      </main>
    </div>
  );
}
