import React, { useState, useEffect, useCallback } from 'react';
import { Hourglass, Users, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ConfirmSettleModal } from '@/app/components/common/PaymentSettlement';

const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
const thDate = (d) => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-';
const custName = (c) => c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.nickname || '-' : '-';
// รูปลูกค้าจาก customer_cache (เก็บได้ทั้ง string และ {url})
const custImgUrl = (c) => {
  const img = c?.images?.[0];
  return typeof img === 'string' ? img : img?.url || null;
};
const Avatar = ({ cache, size = 'w-8 h-8' }) => {
  const url = custImgUrl(cache);
  return (
    <div className={`${size} rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 overflow-hidden shrink-0`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <User size={14} />}
    </div>
  );
};
const daysSince = (d) => {
  if (!d) return 0;
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((b - a) / 86400000));
};
const isOverdue = (d) => {
  if (!d) return false;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return new Date(d + 'T00:00:00') < t;
};

// การ์ด "รอเงินเข้า (บัตร)" + "ลูกหนี้ค้างชำระ" ในหน้าการเงิน
// ดึงจาก view v_pending_settlements / v_receivables (security_invoker → เคารพ RLS)
const SettlementReceivables = ({ canEdit, byRef, onChanged }) => {
  const [pendings, setPendings] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [openPending, setOpenPending] = useState(false);
  const [openRecv, setOpenRecv] = useState(false);
  const [settlePay, setSettlePay] = useState(null); // { payment, table }

  const fetchData = useCallback(async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('v_pending_settlements').select('*').order('expected_settle_date', { ascending: true, nullsFirst: false }),
      supabase.from('v_receivables').select('*').order('doc_date', { ascending: true }),
    ]);
    setPendings(p || []);
    setReceivables(r || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pendingTotal = pendings.reduce((s, p) => s + Number(p.amount || 0), 0);
  const overdueCount = pendings.filter(p => isOverdue(p.expected_settle_date)).length;
  const recvTotal = receivables.reduce((s, r) => s + Number(r.outstanding || 0), 0);

  // รวมลูกหนี้ต่อลูกค้า เรียงยอดมาก → น้อย
  const byCustomer = Object.values(receivables.reduce((m, r) => {
    const key = r.customer_id || custName(r.customer_cache);
    if (!m[key]) m[key] = { name: custName(r.customer_cache), cache: r.customer_cache, total: 0, docs: [] };
    m[key].total += Number(r.outstanding || 0);
    m[key].docs.push(r);
    return m;
  }, {})).sort((a, b) => b.total - a.total);

  if (pendings.length === 0 && receivables.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* รอเงินเข้า (บัตร) */}
      <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
        <button type="button" onClick={() => setOpenPending(v => !v)} className="w-full p-5 flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Hourglass size={18} /></div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-2">
                รอเงินเข้า (บัตร)
                {overdueCount > 0 && <span className="text-[10px] normal-case tracking-normal font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={9} /> เลยกำหนด {overdueCount}</span>}
              </p>
              <p className="text-2xl font-black text-purple-700">{baht(pendingTotal)}</p>
              <p className="text-[11px] text-gray-400">{pendings.length} รายการ — ลูกค้าจ่ายแล้ว รอเงินเข้าบัญชี (ยังไม่นับเป็นรายรับ)</p>
            </div>
          </div>
          {pendings.length > 0 && (openPending ? <ChevronUp size={18} className="text-gray-300 shrink-0" /> : <ChevronDown size={18} className="text-gray-300 shrink-0" />)}
        </button>
        {openPending && pendings.length > 0 && (
          <div className="border-t border-stone-100 divide-y divide-stone-50 max-h-80 overflow-y-auto">
            {pendings.map(p => {
              const overdue = isOverdue(p.expected_settle_date);
              return (
                <div key={`${p.ref_type}-${p.payment_id}`} className={`px-5 py-3 flex items-center gap-3 ${overdue ? 'bg-red-50/40' : ''}`}>
                  <Avatar cache={p.customer_cache} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{custName(p.customer_cache)} <span className="font-normal text-gray-500">· {p.doc_number}</span></p>
                    <p className={`text-[11px] ${overdue ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                      จ่าย {thDate(p.payment_date)} · คาดเข้า {thDate(p.expected_settle_date)}{overdue ? ' — เลยกำหนดแล้ว' : ''}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900 text-sm whitespace-nowrap">{baht(p.amount)}</span>
                  {canEdit && (
                    <button
                      onClick={() => setSettlePay({
                        payment: { id: p.payment_id, amount: p.amount, settlement_status: 'pending', _doc_label: p.doc_number },
                        table: p.ref_type === 'service' ? 'service_payments' : 'order_payments',
                      })}
                      className="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1">
                      <CheckCircle2 size={12} /> ยืนยันเงินเข้า
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ลูกหนี้ค้างชำระ */}
      <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
        <button type="button" onClick={() => setOpenRecv(v => !v)} className="w-full p-5 flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shrink-0"><Users size={18} /></div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-red-500">ลูกหนี้ค้างชำระ</p>
              <p className="text-2xl font-black text-red-600">{baht(recvTotal)}</p>
              <p className="text-[11px] text-gray-400">{byCustomer.length} ลูกค้า · {receivables.length} ใบ — ยอดที่ลูกค้ายังจ่ายไม่ครบ</p>
            </div>
          </div>
          {receivables.length > 0 && (openRecv ? <ChevronUp size={18} className="text-gray-300 shrink-0" /> : <ChevronDown size={18} className="text-gray-300 shrink-0" />)}
        </button>
        {openRecv && byCustomer.length > 0 && (
          <div className="border-t border-stone-100 divide-y divide-stone-50 max-h-80 overflow-y-auto">
            {byCustomer.map((c, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar cache={c.cache} />
                  <p className="text-sm font-semibold text-gray-800 truncate flex-1">{c.name}</p>
                  <span className="font-bold text-red-600 text-sm whitespace-nowrap">{baht(c.total)}</span>
                </div>
                <div className="mt-1 space-y-0.5 pl-[42px]">
                  {c.docs.map(d => (
                    <p key={`${d.ref_type}-${d.ref_id}`} className="text-[11px] text-gray-400 flex justify-between gap-2">
                      <span className="truncate">{d.doc_number} · {d.ref_type === 'service' ? 'งานซ่อม' : 'ออเดอร์'} · ค้างมา {daysSince(d.doc_date)} วัน</span>
                      <span className="whitespace-nowrap">ค้าง {baht(d.outstanding)} / {baht(d.grand_total)}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {settlePay && (
        <ConfirmSettleModal
          payment={settlePay.payment}
          table={settlePay.table}
          byRef={byRef}
          onClose={() => setSettlePay(null)}
          onDone={() => { fetchData(); onChanged?.(); }}
        />
      )}
    </div>
  );
};

export default SettlementReceivables;
