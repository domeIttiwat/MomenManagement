// ===== Design Tokens ของ Dashboard =====
// มี 2 ธีมเก็บไว้: 'ios' (ต้นฉบับตาม Apple HIG) และ 'pastel' (สกินพาสเทลบนโครง iOS เดิม)
// สลับธีมทั้งหน้าได้ที่บรรทัด ACTIVE_THEME ด้านล่างบรรทัดเดียว — ไม่ต้องแก้ component ใด ๆ

const IOS_CLASSIC = {
  font: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Noto Sans Thai', sans-serif`,
  bgGrouped: '#F2F2F7',                    // systemGroupedBackground
  navBg: 'rgba(242,242,247,0.86)',
  card: '#FFFFFF',
  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.60)',
  tertiaryLabel: 'rgba(60,60,67,0.30)',
  separator: 'rgba(60,60,67,0.29)',
  fill: 'rgba(120,120,128,0.20)',
  blue: '#007AFF', green: '#34C759', red: '#FF3B30', orange: '#FF9500', teal: '#30B0C7', indigo: '#5856D6',
  segTrack: 'rgba(118,118,128,0.12)',
  segShadow: '0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)',
  cardRadius: 10,
  popRadius: 13,
  popShadow: '0 10px 40px rgba(0,0,0,0.18), 0 2px 10px rgba(0,0,0,0.08)',
};

const PASTEL = {
  ...IOS_CLASSIC,
  bgGrouped: '#F5F3FA',                    // ลาเวนเดอร์อ่อน
  navBg: 'rgba(245,243,250,0.86)',
  card: '#FFFFFF',
  label: '#2B2640',                        // ม่วงเข้มนุ่มแทนดำสนิท
  secondaryLabel: 'rgba(84,76,120,0.60)',
  tertiaryLabel: 'rgba(84,76,120,0.32)',
  separator: 'rgba(84,76,120,0.22)',
  fill: 'rgba(139,124,246,0.14)',
  blue: '#8B9DF9',                         // ออเดอร์ — ฟ้าม่วงพาสเทล
  green: '#5FD4A2',                        // งานซ่อม — มินต์
  red: '#F79CA6', orange: '#F9B36B', teal: '#7CD4E0', indigo: '#A78BFA',
  segTrack: 'rgba(139,124,246,0.12)',
  segShadow: '0 3px 8px rgba(103,80,200,0.16), 0 3px 1px rgba(103,80,200,0.05)',
  popShadow: '0 10px 40px rgba(103,80,200,0.20), 0 2px 10px rgba(103,80,200,0.08)',
};

const THEMES = { ios: IOS_CLASSIC, pastel: PASTEL };

// ── สลับธีมตรงนี้: 'pastel' | 'ios' ──
const ACTIVE_THEME = 'pastel';

export const IOS = THEMES[ACTIVE_THEME];

// ===== PT: ธีมพาสเทลโมเดิร์น (เลย์เอาต์ใหม่ ไม่อิง iOS) — ธีมที่ใช้อยู่ปัจจุบัน =====
// IOS (ด้านบน) เก็บไว้เป็นธีมสำรอง สลับกลับได้ตามที่ Ittiwat ขอ
export const PT = {
  font: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Noto Sans Thai', sans-serif`,
  bg: '#F4F5FA',                           // พื้นโทนเย็น สะอาด
  ink: '#252A41',                          // น้ำเงินเข้มนุ่ม อ่านง่าย
  muted: '#7C82A1',
  faint: '#B9BFD6',
  card: '#FFFFFF',
  cardShadow: '0 6px 18px rgba(60,70,130,0.08)',
  cardShadowHover: '0 12px 28px rgba(60,70,130,0.13)',
  radius: 24,
  radiusSm: 16,
  // ชุดสีข้อมูล — พาสเทลโทนเย็น คุมโทนเดียวกัน ไม่แย่งกันเอง
  periwinkle: '#6D7DF5', periwinkleTint: '#EDEFFE',   // ออเดอร์ — อินดิโก้นุ่ม
  mint: '#2CC1A8', mintTint: '#E3F7F3',               // งานซ่อมบำรุง — เขียวทีล
  peach: '#F2A25C', peachTint: '#FDF1E4',             // โฆษณา/การตลาด — แอมเบอร์อุ่น
  lilac: '#8B7CF6', lilacTint: '#F0EDFE',
  pink: '#EC6BAE', pinkTint: '#FCE9F3',
  sky: '#45BEEA', skyTint: '#E6F6FD',
  grad: 'linear-gradient(135deg, #6D7DF5 0%, #8B7CF6 100%)', // gradient หลัก 2 สีพอ
  gridLine: 'rgba(124,130,161,0.15)',
  popShadow: '0 14px 40px rgba(46,54,105,0.16), 0 3px 10px rgba(46,54,105,0.07)',
  // สำหรับรายการ "จัดสเปคแล้วยังไม่ซื้อ" (โทนเทา)
  ghost: '#9AA0B8', ghostTint: '#EFF0F5',
};

// hex → rgba พร้อม alpha (ใช้ทำสีเข้ม/จางตามค่าข้อมูล เช่น เส้นวันซื้อโฆษณา)
export const withAlpha = (hex, a) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
export const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

export const thShortDate = (d) => {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getDate()} ${THAI_MONTHS_SHORT[x.getMonth()]} ${(x.getFullYear() + 543)}`;
};
