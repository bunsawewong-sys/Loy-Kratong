function cell(value: unknown): string {
  const s = String(value ?? '');
  // Neutralise spreadsheet formulas and quote anything with separators.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV with a UTF-8 BOM so Excel shows Thai text correctly. */
export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T & string)[]): string {
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))];
  return '﻿' + lines.join('\r\n');
}
