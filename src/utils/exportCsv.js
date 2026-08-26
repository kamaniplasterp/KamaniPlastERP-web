/**
 * Helper utility to convert JSON array to CSV and trigger browser download.
 * @param {string} filename - Name of the exported file (e.g. 'Job_Work_Ledger.csv')
 * @param {Array<Object>} rows - Array of data objects
 */
export function exportToCsv(filename, rows) {
  if (!rows || !rows.length) {
    alert('No data available to export.');
    return;
  }

  // Extract keys for header row
  const headers = Object.keys(rows[0]);

  // Construct CSV lines
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(row =>
      headers
        .map(header => {
          let val = row[header];
          if (val === null || val === undefined) val = '';
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    )
  ].join('\r\n');

  // Create Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
