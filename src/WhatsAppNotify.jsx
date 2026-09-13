// Composes a wa.me deep link with a pre-filled message. WhatsApp
// deep links don't support sending automatically — the user still
// taps "send" on their end — this just builds the safe, correctly
// encoded URL (spec §12).
export function buildWhatsAppLink(phoneE164, message) {
  const digitsOnly = phoneE164.replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digitsOnly}?text=${encoded}`;
}

export function WhatsAppNotifyButton({ phoneE164, pilotName, lastKnownLocationUrl }) {
  const message = lastKnownLocationUrl
    ? `${pilotName}, please check in — last known location: ${lastKnownLocationUrl}`
    : `${pilotName}, please check in with base as soon as possible.`;

  if (!phoneE164) return null;

  return (
    <a
      href={buildWhatsAppLink(phoneE164, message)}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-emerald-700 underline"
    >
      Message on WhatsApp
    </a>
  );
}
