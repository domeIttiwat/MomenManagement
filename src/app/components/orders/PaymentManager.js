import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, CreditCard, Banknote, Landmark } from 'lucide-react';
import NumericInput from '../products/NumericInput';

const PaymentManager = ({ payments = [], onChange, grandTotal }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newPay, setNewPay] = useState({ 
    amount: 0, 
    date: new Date().toISOString().split('T')[0], 
    type: 'deposit',
    method: 'Transfer', // Transfer, Cash, CreditCard
    chargePercent: 0,
    chargeAmount: 0
  });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = grandTotal - totalPaid;
  const isPaidFull = Math.round(remaining * 100) <= 0;

  const handleOpenAdd = () => {
    setNewPay({ 
      amount: Math.max(0, remaining),
      date: new Date().toISOString().split('T')[0], 
      type: 'deposit',
      method: 'Transfer',
      chargePercent: 0,
      chargeAmount: 0
    });
    setIsAdding(true);
  };

  const handleMethodChange = (method) => {
    setNewPay(prev => ({ 
      ...prev, 
      method, 
      // Reset charge if not credit card
      chargePercent: method === 'CreditCard' ? prev.chargePercent : 0,
      chargeAmount: method === 'CreditCard' ? prev.chargeAmount : 0
    }));
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

  const addPayment = () => {
    if (newPay.amount <= 0) return;
    
    // บันทึกข้อมูล (รวมข้อมูลชาร์จบัตรไปด้วย)
    onChange([...payments, { 
      ...newPay, 
      id: Date.now(),
      // เก็บค่าธรรมเนียมแยกไว้ด้วยเพื่อดูย้อนหลัง
      fee_percent: newPay.chargePercent,
      fee_amount: newPay.chargeAmount
    }]);
    setIsAdding(false);
  };

  const removePayment = (id) => onChange(payments.filter(p => p.id !== id));

  // Helper Icon
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
          <div key={i} className="bg-white border border-gray-100 p-3 rounded-lg text-sm shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${p.type === 'deposit' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {p.type === 'deposit' ? 'มัดจำ' : 'ชำระ'}
                </span>
                <span className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-xs">
                   {getMethodIcon(p.method)} {p.method === 'Transfer' ? 'โอนเงิน' : p.method === 'Cash' ? 'เงินสด' : 'บัตรเครดิต'}
                </span>
                <span className="text-gray-500 text-xs">{p.date}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">฿{Number(p.amount).toLocaleString()}</span>
                <button onClick={() => removePayment(p.id)} type="button" className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
              </div>
            </div>
            
            {/* Show Charge Detail if any */}
            {p.method === 'CreditCard' && p.fee_amount > 0 && (
               <div className="flex justify-between text-xs text-gray-400 border-t border-dashed border-gray-100 pt-1 mt-1">
                 <span>ชาร์จบัตร {p.fee_percent}% (+{Number(p.fee_amount).toLocaleString()})</span>
                 <span className="text-purple-600 font-medium">รูดจริง: {(Number(p.amount) + Number(p.fee_amount)).toLocaleString()}</span>
               </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Form */}
      {isAdding ? (
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 space-y-3">
          {/* Row 1: Type & Date */}
          <div className="flex gap-2">
            <select 
              className="bg-white border border-indigo-200 rounded-lg px-2 py-2 text-sm outline-none flex-1"
              value={newPay.type} 
              onChange={e => setNewPay({...newPay, type: e.target.value})}
            >
              <option value="deposit">มัดจำ</option>
              <option value="full">จ่ายส่วนที่เหลือ / เต็มจำนวน</option>
            </select>
            <input 
              type="date" className="border border-indigo-200 rounded-lg px-2 py-2 text-sm outline-none bg-white" 
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

          {/* Row 3: Amount & Charge */}
          <div className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
               <div className="relative">
                 <NumericInput 
                   className="w-full border border-indigo-200 rounded-lg pl-3 pr-3 py-2 text-sm outline-none font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500/20" 
                   placeholder="ระบุยอดเงิน"
                   value={newPay.amount}
                   onChange={handleAmountChange}
                 />
                 <span className="absolute right-3 top-2 text-xs text-gray-400">บาท</span>
               </div>
               
               {/* Credit Card Charge Option */}
               {newPay.method === 'CreditCard' && (
                 <div className="bg-white p-2 rounded-lg border border-purple-100 flex items-center gap-2 text-xs">
                    <span className="text-purple-700 font-medium whitespace-nowrap">ชาร์จบัตร:</span>
                    <div className="flex items-center bg-gray-50 rounded px-1">
                      <input 
                        type="number" 
                        className="w-8 bg-transparent text-center outline-none border-b border-gray-300 focus:border-purple-500" 
                        value={newPay.chargePercent}
                        onChange={e => handleChargeChange(e.target.value)}
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                    <span className="text-gray-400">=</span>
                    <span className="text-red-500 font-bold">+{newPay.chargeAmount.toLocaleString()}</span>
                 </div>
               )}
            </div>
            <div className="flex flex-col gap-1">
              <button type="button" onClick={addPayment} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm h-full">บันทึก</button>
              <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500 text-xs text-center py-1">ยกเลิก</button>
            </div>
          </div>
          
          {/* Total Swipe Preview */}
          {newPay.method === 'CreditCard' && newPay.chargeAmount > 0 && (
             <div className="text-right text-xs bg-purple-50 p-1.5 rounded text-purple-800">
               ยอดรูดบัตรสุทธิ: <b>{(newPay.amount + newPay.chargeAmount).toLocaleString()}</b> บาท
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
    </div>
  );
};
export default PaymentManager;