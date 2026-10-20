export type Lang = 'th' | 'en';

const dict = {
  appTitle: { th: 'ลอยกระทงออนไลน์', en: 'Online Loy Krathong' },
  start: { th: 'เริ่มทำกระทง', en: 'Make a krathong' },
  yourName: { th: 'ชื่อของคุณ', en: 'Your name' },
  dept: { th: 'แผนก (ไม่บังคับ)', en: 'Department (optional)' },
  next: { th: 'ถัดไป', en: 'Next' },
  back: { th: 'ย้อนกลับ', en: 'Back' },
  decorate: { th: 'ตกแต่งกระทง', en: 'Decorate your krathong' },
  base: { th: 'ฐาน', en: 'Base' },
  flower: { th: 'ดอกไม้', en: 'Flowers' },
  candle: { th: 'เทียน/ธูป', en: 'Candle' },
  color: { th: 'สี', en: 'Color' },
  wish: { th: 'คำอธิษฐาน', en: 'Your wish' },
  wishPlaceholder: { th: 'ขอให้...', en: 'I wish...' },
  launch: { th: 'ลอยกระทง', en: 'Float it!' },
  launching: { th: 'กำลังลอย...', en: 'Floating...' },
  launched: { th: 'ลอยแล้ว! ดูกระทงของคุณบนจอใหญ่ได้เลย', en: 'Floated! Look for it on the big screen' },
  again: { th: 'ทำกระทงอีกอัน', en: 'Make another' },
  navMake: { th: 'ทำกระทง', en: 'Make' },
  river: { th: 'แม่น้ำ', en: 'River' },
  myKratongs: { th: 'กระทงของฉัน', en: 'My krathongs' },
  save: { th: 'บันทึกรูป', en: 'Save image' },
  cooldown: { th: 'ลอยได้อีกครั้งใน', en: 'Next float in' },
  closed: { th: 'ยังไม่เปิดให้ลอยกระทง รอสักครู่นะ', en: 'Floating is not open yet. Please wait.' },
  badWords: { th: 'มีคำไม่เหมาะสม กรุณาแก้ไขก่อนลอย', en: 'Please remove inappropriate words before floating' },
  nameRequired: { th: 'กรุณาใส่ชื่อ', en: 'Please enter your name' },
  error: { th: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', en: 'Something went wrong. Please try again.' },
  tapKratong: { th: 'แตะกระทงเพื่ออ่านคำอธิษฐานและส่งกำลังใจ', en: 'Tap a krathong to read its wish and react' },
  sendHeart: { th: 'ส่งหัวใจ', en: 'Send heart' },
  sendFlower: { th: 'ส่งดอกไม้', en: 'Send flowers' },
  reacted: { th: 'ส่งแล้ว', en: 'Sent' },
  close: { th: 'ปิด', en: 'Close' },
  sound: { th: 'เสียง', en: 'Sound' },
  received: { th: 'ได้รับ', en: 'Received' },
  noKratong: { th: 'ยังไม่มีกระทง', en: 'No krathong yet' },
  scanToJoin: { th: 'สแกนเพื่อร่วมลอยกระทง', en: 'Scan to float a krathong' },
  totalKratongs: { th: 'กระทงทั้งหมด', en: 'Krathongs floated' },
  tapToStart: { th: 'แตะเพื่อเริ่ม (เปิดเสียง)', en: 'Click to start (enables sound)' },
  seconds: { th: 'วินาที', en: 's' },
} satisfies Record<string, Record<Lang, string>>;

export type TextKey = keyof typeof dict;

const STORAGE_KEY = 'lk.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language.toLowerCase().startsWith('th') ? 'th' : 'en';
}

let lang: Lang = detect();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn: () => void): void {
  listeners.add(fn);
}

export function t(key: TextKey, l: Lang = lang): string {
  return dict[key][l];
}

/** Fills every element carrying data-i18n / data-i18n-placeholder with the current language. */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as TextKey);
  });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder as TextKey);
  });
}
