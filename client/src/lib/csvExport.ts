/**
 * Convert array of objects to CSV string and trigger download.
 * Escapes quotes and wraps fields containing commas.
 */
export function exportToCsv<T>(
  data: T[],
  columns: { key: keyof T; header: string; format?: (val: unknown) => string }[],
  filename: string
): void {
  const escape = (val: unknown): string => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = columns.map((c) => escape(c.header)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = (row as Record<string, unknown>)[col.key as string];
        return escape(col.format ? col.format(val) : val);
      })
      .join(',')
  );

  const csv = [headerRow, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
