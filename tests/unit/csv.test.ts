import { describe, expect, it } from 'vitest';
import { toCsv } from '../../src/admin/csv';

describe('toCsv', () => {
  it('adds a BOM, quotes separators and neutralises formulas', () => {
    const csv = toCsv([{ a: 'สวัสดี, ครับ', b: '=SUM(A1)', c: 'say "hi"' }], ['a', 'b', 'c']);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿a,b,c\r\n"สวัสดี, ครับ",\'=SUM(A1),"say ""hi"""');
  });
});
