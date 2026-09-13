// Converts an array of row objects into a downloadable CSV file,
// entirely client-side (no server round trip, no dependency) — spec
// §11 calls for a client-side URI/Blob-based approach.

export function exportToCsv(filename, rows) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const str = value == null ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Example usage against the logbooks table:
//
//   const { data } = await supabase
//     .from('logbooks')
//     .select('date, flying_person_name, weather_condition, flight_duration_minutes');
//   exportToCsv('flight-log.csv', data);
