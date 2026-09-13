// Client-side PDF export for ad-hoc "download now" use from the
// dashboard. Requires: npm install jspdf jspdf-autotable
//
// For the *scheduled, server-delivered* version of this report (spec
// §22's "automated server-level transport scheduler"), see
// edge-functions/generate-monthly-report — that one runs on a cron
// and stores the PDF in Supabase Storage rather than downloading
// immediately in-browser.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportFlightHistoryToPdf({ rows, title = 'Flight Operational History', preparedBy }) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title, 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);

  autoTable(doc, {
    startY: 32,
    head: [['Date', 'Pilot', 'Weather', 'Duration (min)']],
    body: rows.map((r) => [r.date, r.flying_person_name, r.weather_condition ?? '—', r.flight_duration_minutes]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  const finalY = doc.lastAutoTable.finalY || 40;

  // Required verification note per spec §22.
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('Verification', 14, finalY + 14);
  doc.setDrawColor(180);
  doc.line(14, finalY + 30, 90, finalY + 30);
  doc.setFontSize(9);
  doc.text(`Prepared by: ${preparedBy ?? '_____________________'}`, 14, finalY + 36);
  doc.text('Signature: _____________________', 14, finalY + 44);

  doc.save('flight-operational-history.pdf');
}
