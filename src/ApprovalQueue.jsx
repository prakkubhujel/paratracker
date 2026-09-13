import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { buildWhatsAppLink } from './WhatsAppNotify';
import { diagnoseError } from './errorDiagnostics';

export default function ApprovalQueue() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const loadPending = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('pending_pilots').select('*');
    if (error) setError(diagnoseError(error).userMessage);
    else setPending(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadPending();

    // Live-update the queue as new signups land or get resolved elsewhere.
    const sub = supabase
      .channel('profiles_pending_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadPending)
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, []);

  const handleDecision = async (pilotId, decision) => {
    setBusyId(pilotId);
    setError(null);
    const rpc = decision === 'approve' ? 'approve_pilot' : 'reject_pilot';
    const { error } = await supabase.rpc(rpc, { p_pilot_id: pilotId });

    if (error) {
      setError(diagnoseError(error).userMessage);
    } else {
      if (decision === 'approve') {
        const pilot = pending.find((p) => p.id === pilotId);
        if (pilot?.phone_e164) {
          // Auto-fire the onboarding message immediately following
          // approval (spec §25). WhatsApp's API doesn't allow a true
          // silent server-side send from a personal number — this opens
          // the pre-filled chat so the manager just taps send, which is
          // as automatic as WhatsApp deep links get without the
          // separate WhatsApp Business Platform.
          //
          // Caveat: because this fires after an `await`, some browsers'
          // popup blockers may treat it as not user-triggered and block
          // it. If that happens in practice, the fallback is the manual
          // WhatsAppNotifyButton already used elsewhere (e.g. RescueRegistry).
          const message = `Welcome to Cloudbase, ${pilot.name}! You're approved and can now log flights and appear on the live map.`;
          window.open(buildWhatsAppLink(pilot.phone_e164, message), '_blank');
        }
      }
      setPending((prev) => prev.filter((p) => p.id !== pilotId));
    }
    setBusyId(null);
  };

  if (loading) return <p className="text-gray-500 p-4">Loading pending pilots…</p>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-3">Pending pilot approvals</h2>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2 mb-3">{error}</div>
      )}

      {pending.length === 0 ? (
        <p className="text-gray-500 text-sm">No pilots waiting on approval.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{p.name}</p>
                <p className="text-sm text-gray-500">
                  {p.age ? `Age ${p.age}` : 'Age not set'}
                  {p.weight ? ` · ${p.weight} kg` : ''}
                </p>
                {!p.phone_e164 && (
                  <p className="text-xs text-gray-400">
                    No phone on file — onboarding message won't auto-send.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busyId === p.id}
                  onClick={() => handleDecision(p.id, 'approve')}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busyId === p.id}
                  onClick={() => handleDecision(p.id, 'reject')}
                  className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-800 text-sm font-medium disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
