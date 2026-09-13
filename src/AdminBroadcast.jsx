import { useState } from 'react';
import { supabase } from './supabaseClient';

// Sends on the same 'flight-alerts' topic everything else already
// uses — the RLS policy on realtime.messages (sql/015) authorizes
// authenticated senders on that topic already, so no new policy is
// needed here. Every logged-in pilot's app is already subscribed to
// this topic (see mobile-App.jsx) and shows an Alert + vibration on
// the 'admin-message' event specifically.
export default function AdminBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    setSent(false);

    await supabase.channel('flight-alerts', { config: { private: true } }).send({
      type: 'broadcast',
      event: 'admin-message',
      payload: { title: title.trim() || 'Message from ops', body: body.trim() },
    });

    setSending(false);
    setSent(true);
    setTitle('');
    setBody('');
  };

  return (
    <div className="p-4 max-w-lg">
      <h2 className="text-lg font-semibold mb-1">Broadcast to all pilots</h2>
      <p className="text-sm text-gray-500 mb-4">
        Delivers instantly to every currently logged-in pilot's app as an alert with vibration.
        Only reaches pilots with the app open and connected — not a substitute for a push
        notification to a closed app.
      </p>

      {sent && (
        <p className="text-sm text-emerald-600 mb-3">Sent.</p>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional — defaults to 'Message from ops')"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message"
        rows={4}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
      />
      <button
        onClick={send}
        disabled={sending || !body.trim()}
        className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send to all pilots'}
      </button>
    </div>
  );
}
