// Word lists for the automatic filter. Thai has no spaces between words, so Thai entries
// match anywhere inside the text; SAFE_TH lists ordinary words that contain a blocked
// substring and must not be flagged. English entries match whole words only.
const BAD_TH = [
  'เหี้ย', 'เหี้ยะ', 'เหียก', 'สัส', 'สัด', 'ควย', 'เย็ด', 'เยด', 'หี', 'แตด', 'ระยำ',
  'ชาติหมา', 'ไอ้สัตว์', 'อีสัตว์', 'ส้นตีน', 'ตีนตบ', 'ดอกทอง', 'กะหรี่', 'อีดอก', 'ไอ้ดอก',
  'มึง', 'กู', 'แม่ง', 'พ่อง', 'โคตรพ่อ', 'โคตรแม่', 'จัญไร', 'อัปรีย์', 'เสือก', 'ห่า',
  'ไอ้บ้า', 'ไอ้โง่', 'อีโง่', 'ไอ้ควาย', 'อีควาย', 'เงี่ยน', 'ร่าน', 'ชิบหาย', 'ฉิบหาย',
];

const SAFE_TH = [
  'หีบ', 'สัดส่วน', 'สัดๆ', 'สัปดาห์', 'สัญญา', 'กูเกิล', 'กุ้ง', 'กูรู', 'ห่าง', 'ห่าน',
  'ห่วง', 'ห่อ', 'ห่ม', 'แม่งาน', 'แม่ง่าย', 'พ่องาน', 'กูด', 'ลูกู', 'สัดสา',
];

const BAD_EN = [
  'fuck', 'fucking', 'fucker', 'fck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt',
  'pussy', 'slut', 'whore', 'motherfucker', 'wtf', 'stfu', 'retard', 'nigger', 'nigga',
  'faggot', 'porn', 'sex', 'cock', 'bullshit',
];

const enPattern = new RegExp(`\\b(${BAD_EN.join('|')})\\b`, 'gi');

// Strip spacing and filler characters people insert to dodge filters ("ค ว ย", "f.u.c.k").
function squash(text: string): string {
  return text.toLowerCase().replace(/[\s._\-*+~!@#$%^&()[\]{}|\\/'"`,:;?<>]+/g, '');
}

function thaiHits(text: string): string[] {
  let scrubbed = squash(text);
  for (const safe of SAFE_TH) scrubbed = scrubbed.split(safe).join('·');
  return BAD_TH.filter((word) => scrubbed.includes(word));
}

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  enPattern.lastIndex = 0;
  if (enPattern.test(text)) return true;
  enPattern.lastIndex = 0;
  if (enPattern.test(squash(text).replace(/[^a-z]/g, ' '))) return true;
  return thaiHits(text).length > 0;
}

/** Replaces blocked words with asterisks (used as a safety net when displaying). */
export function maskProfanity(text: string): string {
  if (!containsProfanity(text)) return text;
  let out = text.replace(enPattern, (m) => '*'.repeat(m.length));
  for (const word of thaiHits(text)) {
    out = out.split(word).join('*'.repeat(word.length));
  }
  return containsProfanity(out) ? '*'.repeat(Math.min(out.length, 12)) : out;
}
