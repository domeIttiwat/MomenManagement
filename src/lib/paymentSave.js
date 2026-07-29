import { supabase } from '@/lib/supabase';

// ฟิลด์ settlement สำหรับรายการชำระที่สร้างใหม่
// - บัตรเครดิต: เงินยังไม่เข้าบัญชี → pending + วันคาดว่าเงินเข้า (ผู้ใช้ระบุเอง)
// - โอน/เงินสด: ถือว่าเงินเข้าแล้วทันที ณ วันจ่าย
export const settlementFieldsFor = (p, isoDate) => {
  const isCard = (p.method || '') === 'CreditCard';
  if (isCard) {
    return {
      settlement_status: 'pending',
      expected_settle_date: p.expected_settle_date || null,
      settled_at: null,
      settled_amount: null,
      settled_by: null,
    };
  }
  return {
    settlement_status: 'settled',
    expected_settle_date: null,
    settled_at: isoDate,
    settled_amount: null,
    settled_by: null,
  };
};

// ฟิลด์ settlement ตอน "แก้ไข" รายการชำระเดิม — ใช้ค่าที่ PaymentManager คำนวณติดมากับแถวแล้ว
// (แถวบัตรที่ยืนยันเงินเข้าแล้ว: คง settled_at/settled_amount เดิม, เปลี่ยนวิธีจ่ายจะ reset ให้ถูกต้อง)
export const paymentUpdateFor = (p, isoDate) => {
  const isCard = (p.method || '') === 'CreditCard';
  if (isCard && (p.settlement_status || 'settled') === 'settled' && p.settled_at) {
    // บัตรที่เงินเข้าแล้ว — ไม่แตะข้อมูลเงินเข้า
    return { expected_settle_date: p.expected_settle_date || null };
  }
  if (isCard) {
    return {
      settlement_status: 'pending',
      expected_settle_date: p.expected_settle_date || null,
      settled_at: null,
      settled_amount: null,
      settled_by: null,
    };
  }
  return {
    settlement_status: 'settled',
    expected_settle_date: null,
    settled_at: isoDate,
    settled_amount: null,
    settled_by: null,
  };
};

// บันทึกรายการชำระแบบ diff — ห้ามใช้ delete ทั้งชุดแล้ว insert ใหม่
// เพราะจะทำให้ข้อมูล settlement (วันเงินเข้าจริง/ยอดเข้าจริง/คนยืนยัน) หายทุกครั้งที่เซฟ
// แถวเดิมจาก DB มี p[refCol] ติดมาอยู่แล้ว → คงไว้ (update เฉพาะแถวที่ถูกแก้ _edited),
// แถวที่ผู้ใช้ลบ → delete เฉพาะแถว, แถวใหม่ → insert
export const savePaymentsDiff = async ({ table, refCol, refId, payments, toRow, toUpdateRow }) => {
  const { data: existing, error } = await supabase.from(table).select('id').eq(refCol, refId);
  if (error) throw error;
  const existingIds = new Set((existing || []).map(r => r.id));
  const keptIds = new Set(
    payments.filter(p => p[refCol] === refId && existingIds.has(p.id)).map(p => p.id)
  );
  const toDelete = [...existingIds].filter(id => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from(table).delete().in('id', toDelete);
    if (delErr) throw delErr;
  }
  if (toUpdateRow) {
    const editedRows = payments.filter(p => keptIds.has(p.id) && p._edited);
    for (const p of editedRows) {
      const { error: upErr } = await supabase.from(table).update(toUpdateRow(p)).eq('id', p.id);
      if (upErr) throw upErr;
    }
  }
  const newRows = payments.filter(p => !keptIds.has(p.id)).map(toRow);
  if (newRows.length > 0) {
    const { error: insErr } = await supabase.from(table).insert(newRows);
    if (insErr) throw insErr;
  }
};

// ---- ตัวช่วยคำนวณฝั่งแสดงผล (ใช้ร่วมกันทั้งลิสต์/หน้า detail/หน้าลูกค้า) ----

// รวมยอดจากรายการชำระ + ยอดค้าง + ยอดรอเงินเข้า
export const paymentTotals = (payments = [], grandTotal = 0) => {
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = payments
    .filter(p => (p.settlement_status || 'settled') === 'pending')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstanding = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
  return { paid, pending, outstanding };
};

// เลยกำหนดวันคาดว่าเงินเข้าหรือยัง
export const isSettleOverdue = (p) => {
  if ((p.settlement_status || 'settled') !== 'pending' || !p.expected_settle_date) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(p.expected_settle_date + 'T00:00:00') < today;
};

// ยืนยันเงินเข้าบัญชี (ใช้ทั้งจากหน้าออเดอร์/งานซ่อม/การเงิน)
// table: 'order_payments' | 'service_payments'
export const confirmSettlement = async ({ table, paymentId, settledDate, settledAmount, amount, byRef }) => {
  const { error } = await supabase.from(table).update({
    settlement_status: 'settled',
    settled_at: settledDate,
    settled_amount: settledAmount != null && settledAmount !== '' ? Number(settledAmount) : Number(amount),
    settled_by: byRef || null,
  }).eq('id', paymentId);
  if (error) throw error;
};

// แก้ไข/ยกเลิกการยืนยัน (กลับเป็นรอเงินเข้า)
export const revertSettlement = async ({ table, paymentId }) => {
  const { error } = await supabase.from(table).update({
    settlement_status: 'pending',
    settled_at: null,
    settled_amount: null,
    settled_by: null,
  }).eq('id', paymentId);
  if (error) throw error;
};
