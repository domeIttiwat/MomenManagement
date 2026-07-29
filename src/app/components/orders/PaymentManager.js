import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, CreditCard, Banknote, Landmark, Hourglass, Pencil } from 'lucide-react';
import NumericInput from '../products/NumericInput';
import { supabase } from '@/lib/supabase';
import { nowLocalInput, dtLocalDisplay } from '@/lib/datetime';
import { isSettleOverdue } from '@/lib/paymentSave';
import { useAuth } from '@/app/context/AuthContext';
import { ConfirmSettleModal } from '@/app/components/common/PaymentSettlement';

const PaymentManager = ({ payments = [], onChange, grandTotal }) => {
  const { can, profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  // สิทธิ์แก้ไข/ลบรายการชำระที่บันทึกแล้ว (finance → payment_manage) — รายการที่เพิ่งเพิ่มยังไม่เซฟ ใครก็แก้/ลบได้
  const canManage = can('finance', 'payment_manage');
  // สิทธิ์ยืนยันเงินเข้า (เหมือนหน้ารายละเอียด/หน้าการเงิน)
  const canSettle = can('finance', 'edit') || can('finance', 'create');

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null); // id ของรายการที่กำลังแก้ไข (null = เพิ่มใหม่)
  const [showCharge, setShowCharge] = useState(false); // ชาร์จบัตรเก็บเพิ่มจากลูกค้า — ซ่อนไว้ กดเพิ่มเมื่อต้องใช้
  const [settlePay, setSettlePay] = useState(null); // รายการที่กำลังยืนยันเงินเข้า (เฉพาะแถวที่บันทึกลง DB แล้ว)

  // หลังยืนยันเงินเข้า → ดึงข้อมูล settlement ล่าสุดจาก DB มาอัปเดตแถวในฟอร์ม
  // สำคัญ: ถ้าไม่อัปเดต state ในฟอร์ม แล้วผู้ใช้กดแก้ไขแถวนี้ต่อ ข้อมูลเงินเข้าจะถูกเขียนทับตอนเซฟ
  const refreshRowFromDb = async (p) => {
    const table = p.order_id != null ? 'order_payments' : 'service_payments';
    const { data } = await supabase.from(table).select('settlement_status, expected_settle_date, settled_at, settled_amount, settled_by').eq('id', p.id).single();
    if (data) onChange(payments.map(x => x.id === p.id ? { ...x, ...data } : x));
  };

  // รายการที่บันทึกลง DB แล้ว (โหลดกลับมาจะมี order_id/service_id ติดมา)
  const isSaved = (p) => p.order_id != null || p.service_id != null;

  // ตรวจสอบว่ามีมัดจำไปแล้วหรือยัง (ไม่นับแถวที่กำลังแก้ไขอยู่)
  const hasDeposit = payments.some(p => p.type === 'deposit' && p.id !== editingId);

  const [newPay, setNewPay] = useState({
    amount: 0,
    date: nowLocalInput(),
    type: 'deposit',
    method: 'Transfer',
    chargePercent: 0,
    chargeAmount: 0,
    expected_settle_date: '' // บัตรเครดิต: วันคาดว่าเงินเข้าบัญชี (ผู้ใช้ระบุเอง)
  });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = grandTotal - totalPaid;
  const isPaidFull = Math.round(remaining * 100) <= 0;

  const editingRow = editingId != null ? payments.find(p => p.id === editingId) : null;
  // แถวบัตรที่ยืนยันเงินเข้าแล้ว — แก้ได้แต่ไม่บังคับวันคาด (เงินเข้าแล้ว)
  const editingSettledCard = editingRow && editingRow.method === 'CreditCard' && (editingRow.settlement_status || 'settled') === 'settled' && editingRow.settled_at;

  const handleOpenAdd = () => {
    const currentHasDeposit = payments.some(p => p.type === 'deposit');
    setNewPay({
      amount: Math.max(0, remaining),
      date: nowLocalInput(),
      type: currentHasDeposit ? 'full' : 'deposit',
      method: 'Transfer',
      chargePercent: 0,
      chargeAmount: 0,
      expected_settle_date: ''
    });
    setEditingId(null);
    setShowCharge(false);
    setIsAdding(true);
  };

  const handleOpenEdit = (p) => {
    setNewPay({
      amount: Number(p.amount) || 0,
      date: p.date || nowLocalInput(),
      type: p.type || 'full',
      method: p.method || 'Transfer',
      chargePercent: Number(p.fee_percent) || 0,
      chargeAmount: Number(p.fee_amount) || 0,
      expected_settle_date: p.expected_settle_date || ''
    });
    setEditingId(p.id);
    setShowCharge((Number(p.fee_amount) || 0) > 0);
    setIsAdding(true);
  };

  const closeForm = () => { setIsAdding(false); setEditingId(null); };

  const handleMethodChange = (method) => {
    setNewPay(prev => ({
      ...prev,
      method,
      chargePercent: method === 'CreditCard' ? prev.chargePercent : 0,
      chargeAmount: method === 'CreditCard' ? prev.chargeAmount : 0
    }));
    if (method !== 'CreditCard') setShowCharge(false);
  };

  const handleChargeChange = (percent) => {
    const p = parseFloat(percent) || 0;
    const charge = (newPay.amount * p) / 100;
    setNewPay(prev => ({ ...prev, chargePercent: p, chargeAmount: charge }));
  };

  const handleAmountChange = (val) => {
    const amt = parseFloat(val) || 0;
    const charge = (amt * newPay.chargePercent) / 100;
    setNewPay(prev => ({ ...prev, amount: amt, chargeAmount: charge }));
  };

  const savePayment = () => {
    if (newPay.amount <= 0) return;
    // บัตรเครดิต = เงินยังไม่เข้าบัญชี ต้องระบุวันคาดว่าเงินเข้าเสมอ (ยกเว้นแถวที่ยืนยันเงินเข้าไปแล้ว)
    if (newPay.method === 'CreditCard' && !newPay.expected_settle_date && !editingSettledCard) {
      alert('กรุณาระบุวันคาดว่าเงินเข้าบัญชี (จ่ายด้วยบัตรเครดิต)');
      return;
    }

    if (editingId != null && editingRow) {
      // แก้ไขแถวเดิม — คำนวณสถานะเงินเข้าตามการเปลี่ยนวิธีจ่าย
      const wasSettledCard = editingSettledCard;
      const isCard = newPay.method === 'CreditCard';
      const settlement = isCard
        ? (wasSettledCard
            ? { settlement_status: 'settled', expected_settle_date: newPay.expected_settle_date || editingRow.expected_settle_date || null } // เงินเข้าแล้ว คงข้อมูลไว้
            : { settlement_status: 'pending', expected_settle_date: newPay.expected_settle_date || null, settled_at: null, settled_amount: null, settled_by: null })
        : { settlement_status: 'settled', expected_settle_date: null, settled_at: null, settled_amount: null, settled_by: null }; // โอน/สด = เข้าทันที ณ วันจ่าย
      onChange(payments.map(p => p.id !== editingId ? p : ({
        ...p,
        amount: newPay.amount,
        date: newPay.date,
        type: newPay.type,
        method: newPay.method,
        fee_percent: newPay.chargePercent,
        fee_amount: newPay.chargeAmount,
        ...settlement,
        _edited: isSaved(p) ? true : p._edited // ให้ savePaymentsDiff รู้ว่าต้อง update แถวนี้
      })));
    } else {
      onChange([...payments, {
        ...newPay,
        id: Date.now(),
        fee_percent: newPay.chargePercent,
        fee_amount: newPay.chargeAmount,
        expected_settle_date: newPay.method === 'CreditCard' ? newPay.expected_settle_date : null,
        settlement_status: newPay.method === 'CreditCard' ? 'pending' : 'settled'
      }]);
    }
    closeForm();
  };

  const removePayment = (id) => onChange(payments.filter(p => p.id !== id));

  const getMethodIcon = (m) => {
    switch(m) {
      case 'Cash': return <Banknote size={14} className="text-green-600"/>;
      case 'CreditCard': return <CreditCard size={14} className="text-purple-600"/>;
      default: return <Landmark size={14} className="text-blue-600"/>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className={`flex justify-between items-center p-3 rounded-xl border ${isPaidFull ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        <div>
          <p className="text-xs text-gray-500">ชำระแล้ว</p>
          <p className={`font-bold text-lg ${isPaidFull ? 'text-green-700' : 'text-gray-900'}`}>฿{totalPaid.toLocaleString()}</p>
        </div>
        <div className="text-right">
          {isPaidFull ? (
            <div className="flex items-center gap-1 text-green-600 font-bold bg-white px-3 py-1 rounded-lg border border-green-200 shadow-sm">
              <CheckCircle2 size={18} /> ชำระครบถ้วน
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">คงเหลือ</p>
              <p className="text-xl font-bold text-red-600">฿{remaining.toLocaleString()}</p>
            </>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="space-y-2">
        {payments.map((p, i) => (
          <div key={i} className={`bg-white border p-3 rounded-lg text-sm shadow-sm flex flex-col gap-2 ${p.id === editingId ? 'border-indigo-300 ring-2 ring-indigo-500/10' : 'border-gray-100'}`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${p.type === 'deposit' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {p.type === 'deposit' ? 'มัดจำ' : 'ชำระ'}
                </span>
                <span className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-xs">
                   {getMethodIcon(p.method)} {p.method === 'Transfer' ? 'โอนเงิน' : p.method === 'Cash' ? 'เงินสด' : 'บัตรเครดิต'}
                </span>
                <span className="text-gray-500 text-xs">{dtLocalDisplay(p.date)}</span>
                {(p.settlement_status || 'settled') === 'pending' && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${isSettleOverdue(p) ? 'bg-red-50 text-red-600 border-red-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                    <Hourglass size={10}/> รอเงินเข้า{p.expected_settle_date ? ` · คาด ${new Date(p.expected_settle_date + 'T00:00:00').toLocaleDateString('th-TH', {day: 'numeric', month: 'short'})}` : ''}{isSettleOverdue(p) ? ' (เลยกำหนด)' : ''}
                  </span>
                )}
                {(p.settlement_status || 'settled') === 'pending' && isSaved(p) && canSettle && (
                  <button type="button" onClick={() => setSettlePay(p)}
                    className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <CheckCircle2 size={11}/> ยืนยันเงินเข้า
                  </button>
                )}
                {p.method === 'CreditCard' && (p.settlement_status || 'settled') === 'settled' && p.settled_at && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle2 size={10}/> เงินเข้าแล้ว {new Date(p.settled_at).toLocaleDateString('th-TH', {day: 'numeric', month: 'short'})}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold">฿{Number(p.amount).toLocaleString()}</span>
                {(!isSaved(p) || canManage) && (
                  <button onClick={() => handleOpenEdit(p)} type="button" title="แก้ไขรายการ" className="text-gray-300 hover:text-indigo-500 transition-colors"><Pencil size={14}/></button>
                )}
                {(!isSaved(p) || canManage) && (
                  <button onClick={() => removePayment(p.id)} type="button" title="ลบรายการ" className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                )}
              </div>
            </div>

            {p.method === 'CreditCard' && p.fee_amount > 0 && (
               <div className="flex justify-between text-xs text-gray-400 border-t border-dashed border-gray-100 pt-1 mt-1">
                 <span>ชาร์จบัตร {p.fee_percent}% (+{Number(p.fee_amount).toLocaleString()})</span>
                 <span className="text-purple-600 font-medium">รูดจริง: {(Number(p.amount) + Number(p.fee_amount)).toLocaleString()}</span>
               </div>
            )}
            {(p.settlement_status || 'settled') === 'settled' && p.settled_amount != null && Number(p.settled_amount) < Number(p.amount) && (
               <div className="text-[10px] text-purple-500 border-t border-dashed border-gray-100 pt-1 mt-1">
                 เข้าจริง ฿{Number(p.settled_amount).toLocaleString()} (ค่าธรรมเนียม ฿{(Number(p.amount) - Number(p.settled_amount)).toLocaleString()})
               </div>
            )}
          </div>
        ))}
      </div>

      {/* Add / Edit Form */}
      {isAdding ? (
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 space-y-3">
          {editingId != null && (
            <p className="text-xs font-bold text-indigo-700 flex items-center gap-1"><Pencil size={12}/> กำลังแก้ไขรายการชำระ</p>
          )}

          {/* Row 1: Type & Date */}
          <div className="flex gap-2">
            <select
              className="bg-white border border-indigo-200 rounded-lg px-2 py-2 text-sm outline-none flex-1"
              value={newPay.type}
              onChange={e => setNewPay({...newPay, type: e.target.value})}
            >
              {/* แสดงตัวเลือก "มัดจำ" เฉพาะตอนที่ยังไม่มีมัดจำ หรือกำลังแก้ไขรายการที่เป็นมัดจำ */}
              {(!hasDeposit || newPay.type === 'deposit') && <option value="deposit">มัดจำ</option>}
              <option value="full">{hasDeposit ? 'ชำระส่วนที่เหลือ / เพิ่มเติม' : 'ชำระเต็มจำนวน'}</option>
            </select>
            <input
              type="datetime-local" className="border border-indigo-200 rounded-lg px-2 py-2 text-sm outline-none bg-white"
              value={newPay.date}
              onChange={e => setNewPay({...newPay, date: e.target.value})}
            />
          </div>

          {/* Row 2: Method Selector */}
          <div className="flex gap-2">
             <button type="button" onClick={() => handleMethodChange('Transfer')} className={`flex-1 py-1.5 text-xs rounded-lg border flex items-center justify-center gap-1 ${newPay.method === 'Transfer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}>
               <Landmark size={14}/> โอนเงิน
             </button>
             <button type="button" onClick={() => handleMethodChange('Cash')} className={`flex-1 py-1.5 text-xs rounded-lg border flex items-center justify-center gap-1 ${newPay.method === 'Cash' ? 'bg-green-600 text-white border-green-600' : 'bg-white border-gray-200 text-gray-600'}`}>
               <Banknote size={14}/> เงินสด
             </button>
             <button type="button" onClick={() => handleMethodChange('CreditCard')} className={`flex-1 py-1.5 text-xs rounded-lg border flex items-center justify-center gap-1 ${newPay.method === 'CreditCard' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-200 text-gray-600'}`}>
               <CreditCard size={14}/> บัตรเครดิต
             </button>
          </div>

          {/* Row 3: Amount + Save/Cancel */}
          <div className="flex gap-2 items-start">
            <div className="flex-1 relative">
              <NumericInput
                className="w-full border border-indigo-200 rounded-lg pl-3 pr-10 py-2 text-sm outline-none font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="ระบุยอดเงิน"
                value={newPay.amount}
                onChange={handleAmountChange}
              />
              <span className="absolute right-3 top-2 text-xs text-gray-400">บาท</span>
            </div>
            <button type="button" onClick={savePayment} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm">บันทึก</button>
            <button type="button" onClick={closeForm} className="text-gray-400 hover:text-red-500 text-xs py-2.5 px-1">ยกเลิก</button>
          </div>

          {/* Card extras — เต็มความกว้าง ไม่เบียดกับช่องยอดเงิน */}
          {newPay.method === 'CreditCard' && (
            <div className="bg-white p-3 rounded-lg border border-purple-100 space-y-2">
              {editingSettledCard ? (
                <p className="text-xs text-green-700 flex items-center gap-1.5">
                  <CheckCircle2 size={13}/> รายการนี้ยืนยันเงินเข้าบัญชีแล้ว ({new Date(editingRow.settled_at).toLocaleDateString('th-TH', {day: 'numeric', month: 'short'})})
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-purple-700 font-medium whitespace-nowrap">คาดว่าเงินเข้า:</span>
                    <input
                      type="date"
                      className="bg-gray-50 rounded-lg px-2.5 py-1.5 text-sm outline-none border border-gray-200 focus:border-purple-500 text-gray-700"
                      value={newPay.expected_settle_date}
                      onChange={e => setNewPay(prev => ({ ...prev, expected_settle_date: e.target.value }))}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    เงินบัตรจะขึ้นเป็น &quot;รอเงินเข้า&quot; จนกว่าจะกดยืนยันว่าเข้าบัญชีแล้ว — ค่าธรรมเนียมที่โดนหักจริงไปกรอกตอนยืนยันเงินเข้า
                  </p>
                </>
              )}

              {!showCharge ? (
                <button type="button" onClick={() => setShowCharge(true)} className="text-[11px] text-purple-500 hover:text-purple-700 underline underline-offset-2">
                  + เก็บชาร์จบัตรเพิ่มจากลูกค้า
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs flex-wrap border-t border-dashed border-purple-100 pt-2">
                  <span className="text-purple-700 font-medium whitespace-nowrap">ชาร์จบัตร (เก็บจากลูกค้า):</span>
                  <div className="flex items-center bg-gray-50 rounded px-1.5 py-1">
                    <input
                      type="number"
                      className="w-10 bg-transparent text-center outline-none border-b border-gray-300 focus:border-purple-500"
                      value={newPay.chargePercent}
                      onChange={e => handleChargeChange(e.target.value)}
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                  <span className="text-gray-400">=</span>
                  <span className="text-red-500 font-bold">+{newPay.chargeAmount.toLocaleString()}</span>
                  {newPay.chargeAmount > 0 && (
                    <span className="ml-auto text-purple-800 bg-purple-50 px-2 py-1 rounded">รูดจริง: <b>{(newPay.amount + newPay.chargeAmount).toLocaleString()}</b> บาท</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        !isPaidFull && (
          <button type="button" onClick={handleOpenAdd} className="w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 flex items-center justify-center gap-2 font-medium transition-all group">
            <Plus size={18} className="group-hover:scale-110 transition-transform"/> เพิ่มรายการชำระเงิน
          </button>
        )
      )}

      {settlePay && (
        <ConfirmSettleModal
          payment={settlePay}
          table={settlePay.order_id != null ? 'order_payments' : 'service_payments'}
          byRef={meRef()}
          onClose={() => setSettlePay(null)}
          onDone={() => refreshRowFromDb(settlePay)}
        />
      )}
    </div>
  );
};
export default PaymentManager;
