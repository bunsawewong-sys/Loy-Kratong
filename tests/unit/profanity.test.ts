import { describe, expect, it } from 'vitest';
import { containsProfanity, maskProfanity } from '../../src/profanity';

describe('containsProfanity', () => {
  it.each(['ขอให้รวยๆ', 'ขอให้สุขภาพแข็งแรง', 'ได้หีบสมบัติ', 'สัดส่วนกำไรดี', 'ขอให้ได้ห่านทองคำ', 'Happy Loy Krathong', 'สัปดาห์หน้าได้โบนัส'])(
    'allows clean text: %s',
    (text) => {
      expect(containsProfanity(text)).toBe(false);
    },
  );

  it.each(['ไอ้เหี้ย', 'ค ว ย', 'มึงอ่ะ', 'fuck this', 'F.U.C.K', 'shit happens', 'อีควาย'])('flags %s', (text) => {
    expect(containsProfanity(text)).toBe(true);
  });

  it('matches English words as whole words only', () => {
    expect(containsProfanity('Scunthorpe classic assessment')).toBe(false);
  });
});

describe('maskProfanity', () => {
  it('leaves clean text unchanged', () => {
    expect(maskProfanity('ขอให้มีความสุข')).toBe('ขอให้มีความสุข');
  });

  it('masks bad words', () => {
    expect(maskProfanity('shit happens')).toBe('**** happens');
    expect(maskProfanity('ไอ้เหี้ย')).not.toContain('เหี้ย');
  });
});
