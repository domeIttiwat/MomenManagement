// datetime.js — มาตรฐานการจัดการวันที่-เวลาทั้งระบบ
// กฎ (ดู GOTCHAS.md #27): ทุก field เวลาต้องเก็บ "วันที่ + เวลา", ดีฟอลต์ = เวลาปัจจุบัน, แก้ไขได้,
// บันทึกลง DB เป็น ISO (UTC) เสมอ และตอนหาว่าตกวันไหนให้คิดเป็นเวลาไทย (Asia/Bangkok)
// เพื่อไม่ให้ตกวันเพี้ยน (off-by-one) เหมือนตอนเก็บวันที่อย่างเดียว.

const pad2 = (n) => String(n).padStart(2, '0');

// ค่าปัจจุบันสำหรับ <input type="datetime-local"> (อิงเวลาเครื่องผู้ใช้)
export const nowLocalInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// แปลงค่า ISO/timestamp ที่เก็บไว้ -> ค่าสำหรับ <input type="datetime-local">
export const dtLocalInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// แปลงค่าจาก datetime-local (เวลาเครื่องผู้ใช้) -> ISO (UTC) สำหรับบันทึกลง DB
// สำคัญ: อย่าส่ง string datetime-local ดิบเข้า timestamptz เพราะ Postgres จะตีความเป็น UTC (เพี้ยน)
export const localToISO = (v) => (v ? new Date(v).toISOString() : null);

// แสดงผลสั้น ๆ "YYYY-MM-DD HH:mm" (อิงเวลาเครื่องผู้ใช้)
export const dtLocalDisplay = (v) => dtLocalInput(v).replace('T', ' ');
