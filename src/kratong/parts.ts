import type { Lang } from '../i18n';
import type { KratongParts } from '../types';

export interface PartOption {
  th: string;
  en: string;
}

export interface ColorOption extends PartOption {
  petal: string;
  dark: string;
}

export const BASES: PartOption[] = [
  { th: 'ใบตอง', en: 'Banana leaf' },
  { th: 'ขนมปัง', en: 'Bread' },
  { th: 'กลีบบัว', en: 'Lotus petals' },
  { th: 'กาบมะพร้าว', en: 'Coconut shell' },
  { th: 'หยวกกล้วย', en: 'Banana trunk' },
];

export const FLOWERS: PartOption[] = [
  { th: 'ดาวเรือง', en: 'Marigold' },
  { th: 'ดอกบัว', en: 'Lotus' },
  { th: 'กุหลาบ', en: 'Rose' },
  { th: 'กล้วยไม้', en: 'Orchid' },
  { th: 'มะลิ', en: 'Jasmine' },
];

export const CANDLES: PartOption[] = [
  { th: 'เทียน + ธูป', en: 'Candle + incense' },
  { th: 'เทียนเล่มเดียว', en: 'Single candle' },
  { th: 'เทียนคู่', en: 'Twin candles' },
  { th: 'ประทีป', en: 'Oil lamp' },
];

export const COLORS: ColorOption[] = [
  { th: 'ชมพู', en: 'Pink', petal: '#ff8fb8', dark: '#e0588c' },
  { th: 'ส้ม', en: 'Orange', petal: '#ffae42', dark: '#e98316' },
  { th: 'ม่วง', en: 'Purple', petal: '#c39bff', dark: '#9466e0' },
  { th: 'เหลือง', en: 'Yellow', petal: '#ffe066', dark: '#f2b705' },
  { th: 'ฟ้า', en: 'Sky blue', petal: '#8fd3ff', dark: '#4aa8e8' },
  { th: 'แดง', en: 'Red', petal: '#ff6b6b', dark: '#d63c3c' },
];

export const PART_GROUPS = {
  base: BASES,
  flower: FLOWERS,
  candle: CANDLES,
  color: COLORS,
} as const;

export type PartKey = keyof typeof PART_GROUPS;

export function partLabel(key: PartKey, index: number, lang: Lang): string {
  return PART_GROUPS[key][index]?.[lang] ?? '';
}

export function randomParts(): KratongParts {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    base: pick(BASES.length),
    flower: pick(FLOWERS.length),
    candle: pick(CANDLES.length),
    color: pick(COLORS.length),
  };
}

/** Clamps values coming from the database so a malformed record still renders. */
export function safeParts(p: Partial<KratongParts> | undefined): KratongParts {
  const clamp = (v: unknown, n: number) =>
    typeof v === 'number' && v >= 0 && v < n ? Math.floor(v) : 0;
  return {
    base: clamp(p?.base, BASES.length),
    flower: clamp(p?.flower, FLOWERS.length),
    candle: clamp(p?.candle, CANDLES.length),
    color: clamp(p?.color, COLORS.length),
  };
}
