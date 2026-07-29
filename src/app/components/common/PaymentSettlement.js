import React, { useState } from 'react';
import { X, Hourglass, CheckCircle2, Loader2, Landmark, RotateCcw } from 'lucide-react';
import NumericInput from '../products/NumericInput';
import { confirmSettlement, revertSettlement, isSettleOverdue } from '@/lib/paymentSave';

const thDate = (d) => d ? new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-';
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Chip สถานะเงินเข้าบัญชีของรายการชำระ (ใช้ทั้งหน้าออเดอร์/งานซ่อม/การเงิน)
export const SettlementChip = ({ payment }) => {
  const status = payment.settlement_status || 'settled';
  if (status === 'pending') {
    const overdue = isSettleOverdue(payment);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${overdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
        <Hourglass size={10} /> รอเงินเข้า{payment.expected_settle_date ? ` · คาด ${thDate(payment.expected_settle_date)}` : ''}{overdue ? ' (เลยกำหนด)' : ''}
      </span>
    );
  }
  // แสดง "เงินเข้าแล้ว" เฉพาะรายการบัตร (โอน/สดถือว่าเข้าทันที ไม่ต้องรก UI)
  const isCard = (payment.payment_method || payment.method) === 'CreditCard';
  if (isCard && payment.settled_at) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
        <CheckCircle2 size={10} /> เงินเข้าแล้ว {thDate(payment.settled_at)}
      </span>
    );
  }
  return null;
};

// Modal ยืนยันเงินเข้าบัญชี: ระบุวันเงินเข้า + ยอดเข้าจริง (ส่วนต่าง = ค่าธรรมเนียมบัตร ลงรายจ่ายอัตโนมัติ)
// props: payment (ต้องมี id, amount), table ('order_payments'|'service_payments'), byRef, onClose, onDone
export const ConfirmSettleModal = ({ payment, table, byRef, onClose, onDone }) => {
  const isSettled = (payment.settlement_status || 'settled') === 'settled';
  const [date, setDate] = useState(payment.settled_at ? String(payment.settled_at).slice(0, 10) : todayStr());
  const [actual, setActual] = useState(payment.settled_amount != null ? Number(payment.settled_amount) : Number(payment.amount));
  const [saving, setSaving] = useState(false);
  const mdr = Math.max(0, Number(payment.amount) - Number(actual || 0));

  const submit = async () => {
    if (!date) return alert('กรุณาระบุวันที่เงินเข้า');
    if (Number(actual) <= 0) return alert('กรุณาระบุยอดเงินที่เข้าจริง');
    if (Number(actual) > Number(payment.amount)) return alert('ยอดเข้าจริงมากกว่ายอดชำระ — ตรวจสอบตัวเลขอีกครั้ง');
    setSaving(true);
    try {
      await confirmSettlement({ table, paymentId: payment.id, settledDate: new Date(date + 'T12:00:00').toISOString(), settledAmount: actual, amount: payment.amount, byRef });
      onDone?.();
      onClose();
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const revert = async () => {
    if (!confirm('ยกเลิกการยืนยัน — รายการนี้จะกลับเป็น "รอเงินเข้า" และรายรับในหน้าการเงินจะถูกถอนออก ยืนยัน?')) return;
    setSaving(true);
    try {
      await revertSettlement({ table, paymentId: payment.id });
      onDone?.();
      onClose();
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Landmark size={18} className="text-indigo-500" /> {isSettled ? 'แก้ไขการยืนยันเงินเข้า' : 'ยืนยันเงินเข้าบัญชี'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm flex justify-between items-center">
          <span className="text-gray-500">ยอดชำระ{payment._doc_label ? ` · ${payment._doc_label}` : ''}</span>
          <span className="font-bold text-gray-900">฿{Number(payment.amount).toLocaleString()}</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">วันที่เงินเข้าบัญชี</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 rounded-xl outline-none border border-gray-200 focus:border-indigo-500 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">ยอดที่เข้าจริง (หลังหักค่าธรรมเนียม)</label>
            <NumericInput value={actual} onChange={v => setActual(parseFloat(v) || 0)}
              className="w-full px-3 py-2 bg-gray-50 rounded-xl outline-none border border-gray-200 focus:border-indigo-500 text-sm font-bold text-gray-900" />
          </div>
          {mdr > 0 && (
            <div className="text-xs bg-purple-50 border border-purple-100 rounded-xl p-2.5 text-purple-800 flex justify-between">
              <span>ส่วนต่างลงเป็นรายจ่าย &quot;ค่าธรรมเนียมบัตร&quot;</span>
              <b>฿{mdr.toLocaleString()}</b>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          {isSettled && (
            <button onClick={revert} disabled={saving} className="px-3 py-2.5 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 border border-red-100 flex items-center gap-1">
              <RotateCcw size={14} /> ยกเลิกยืนยัน
            </button>
          )}
          <button onClick={submit} disabled={saving} className="flex-1 bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} บันทึก
          </button>
        </div>
      </div>
    </div>
  );
};

// แถบสรุป ชำระแล้ว / ค้างจ่าย / รอเงินเข้า (ใช้ในหน้า detail)
export const PaymentSummaryBar = ({ payments = [], grandTotal = 0 }) => {
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = payments.filter(p => (p.settlement_status || 'settled') === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstanding = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-center">
        <p className="text-[10px] text-emerald-600 font-bold">ชำระแล้ว</p>
        <p className="text-sm font-black text-emerald-700">฿{paid.toLocaleString()}</p>
      </div>
      <div className={`rounded-xl p-2.5 text-center border ${outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
        <p className={`text-[10px] font-bold ${outstanding > 0 ? 'text-red-500' : 'text-gray-400'}`}>ค้างจ่าย</p>
        <p className={`text-sm font-black ${outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>฿{outstanding.toLocaleString()}</p>
      </div>
      <div className={`rounded-xl p-2.5 text-center border ${pending > 0 ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100'}`}>
        <p className={`text-[10px] font-bold ${pending > 0 ? 'text-purple-600' : 'text-gray-400'}`}>รอเงินเข้า</p>
        <p className={`text-sm font-black ${pending > 0 ? 'text-purple-700' : 'text-gray-400'}`}>฿{pending.toLocaleString()}</p>
      </div>
    </div>
  );
};
