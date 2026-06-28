'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, PackageMinus, PackagePlus, Plus, Search, Undo2, Warehouse, Clock, User, Loader2, X, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { allocateFifoStockOut, createStockLot, getCurrentProductPrices } from '@/lib/stockLots';

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};

/**
 * จัดเตรียมของ / เบิกวัสดุจากคลัง (เพิ่มเอง) — ใช้ stock_transactions (reference_type/id) เป็นแหล่งบันทึก
 * props: referenceType ('service' | 'assembly' ...), referenceId, noteLabel (เลขงาน/ชื่อ), customerName
 */
const MaterialPrepPanel = ({ referenceType, referenceId, noteLabel = '', customerName = null }) => {
  const { can, profile } = useAuth();

  const [withdrawals, setWithdrawals] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // product picker
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null);
  const [variants, setVariants] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState(1);

  // return
  const [returningTxId, setReturningTxId] = useState(null);
  const [returnNote, setReturnNote] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    if (!referenceId) return;
    const { data } = await supabase.from('stock_transactions')
      .select('id, transaction_type, quantity, unit_cost_thb, total_cost_thb, created_at, note, product_id, variant_id, location_id, store_id, product:product_id(name, sku), variant:variant_id(name), location:location_id(code, name, store:store_id(id, name)), creator:created_by(first_name, last_name)')
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: true });
    setWithdrawals(data || []);
  }, [referenceType, referenceId]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const loadStockItems = async (p, v) => {
    if (!p?.id) { setStockItems([]); return; }
    setStockLoading(true);
    let q = supabase.from('stock_items')
      .select('id, quantity, location_id, location:location_id(id, code, name, store:store_id(id, name))')
      .eq('product_id', p.id).gt('quantity', 0);
    if (v?.id) q = q.eq('variant_id', v.id); else q = q.is('variant_id', null);
    const { data } = await q;
    const items = data || [];
    setStockItems(items);
    setSelectedItemId(items[0]?.id || '');
    setQty(1);
    setStockLoading(false);
  };

  const resetForm = () => {
    setProduct(null); setSearch(''); setVariant(null); setVariants([]);
    setStockItems([]); setSelectedItemId(''); setQty(1); setFormOpen(false);
  };

  const autoNote = (prefix) => `${prefix} งานบริการ "${noteLabel}"${customerName ? ` / ลูกค้า: ${customerName}` : ''}`;

  const submitWithdrawal = async () => {
    const item = stockItems.find(i => i.id === selectedItemId);
    if (!product || !item || qty < 1) return alert('กรุณาเลือกสินค้าและที่เก็บ');
    if (qty > item.quantity) return alert(`สต๊อกไม่พอ — มีแค่ ${item.quantity} ชิ้น`);
    setSaving(true);
    try {
      const { data: txRow, error: txError } = await supabase.from('stock_transactions').insert([{
        product_id: product.id, variant_id: variant?.id || null,
        transaction_type: 'stock_out', quantity: qty,
        store_id: item.location?.store?.id || null, location_id: item.location_id || null,
        note: autoNote('เบิกใช้งาน'), reference_type: referenceType, reference_id: referenceId, created_by: profile?.id,
      }]).select('id').single();
      if (txError) throw txError;
      const lotResult = await allocateFifoStockOut({
        productId: product.id, variantId: variant?.id || null, locationId: item.location_id || null,
        quantity: qty, referenceType, referenceId, stockTransactionId: txRow?.id, profileId: profile?.id, syncSummary: true,
      });
      await supabase.from('stock_transactions').update({ unit_cost_thb: lotResult.weightedUnitCost, total_cost_thb: lotResult.totalCost }).eq('id', txRow.id);
      resetForm();
      fetchWithdrawals();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitReturn = async (tx) => {
    if (!returnNote.trim()) return alert('กรุณาระบุหมายเหตุการคืน');
    setReturnSaving(true);
    try {
      const prices = await getCurrentProductPrices(tx.product_id, tx.variant_id || null);
      const unit = tx.unit_cost_thb || prices.cost_price || 0;
      const note = `คืนคลัง: ${returnNote.trim()} / ${autoNote('').trim()}`;
      await supabase.from('stock_transactions').insert([{
        product_id: tx.product_id, variant_id: tx.variant_id || null,
        transaction_type: 'stock_in', quantity: tx.quantity,
        store_id: tx.store_id || null, location_id: tx.location_id || null,
        note, reference_type: referenceType, reference_id: referenceId, created_by: profile?.id,
        unit_cost_thb: unit, total_cost_thb: unit * tx.quantity,
      }]);
      await createStockLot({
        productId: tx.product_id, variantId: tx.variant_id || null, locationId: tx.location_id || null,
        quantity: tx.quantity, unitCostThb: unit, sourceType: 'return', note, profileId: profile?.id, syncSummary: true,
      });
      setReturningTxId(null); setReturnNote('');
      fetchWithdrawals();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setReturnSaving(false);
    }
  };

  // หา stock_out ที่ยังไม่ถูกคืน
  const activeWithdrawals = (() => {
    const outs = withdrawals.filter(t => t.transaction_type === 'stock_out');
    const returns = withdrawals.filter(t => t.transaction_type === 'stock_in');
    const matched = new Set();
    returns.forEach(ret => {
      const m = outs.find(w => !matched.has(w.id) && w.product_id === ret.product_id
        && (w.variant_id || null) === (ret.variant_id || null)
        && (w.location_id || null) === (ret.location_id || null) && w.quantity === ret.quantity);
      if (m) matched.add(m.id);
    });
    return outs.filter(w => !matched.has(w.id));
  })();
  const returnsList = withdrawals.filter(t => t.transaction_type === 'stock_in');

  if (!can('stock', 'stock_out')) return null;

  const selItem = stockItems.find(i => i.id === selectedItemId);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={17} className="text-amber-500" />
          <h3 className="font-bold text-gray-800">จัดเตรียมของ / เบิกวัสดุ</h3>
          {activeWithdrawals.length > 0 && (
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">เบิกอยู่ {activeWithdrawals.length} รายการ</span>
          )}
        </div>
        {!formOpen && (
          <button onClick={() => setFormOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl">
            <Plus size={13} /> เบิกเพิ่ม
          </button>
        )}
      </div>

      {/* Active withdrawals */}
      {activeWithdrawals.length > 0 && (
        <div className="divide-y divide-gray-50">
          {activeWithdrawals.map(tx => {
            const creator = tx.creator ? `${tx.creator.first_name || ''} ${tx.creator.last_name || ''}`.trim() : '—';
            const isReturning = returningTxId === tx.id;
            return (
              <div key={tx.id} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0 mt-0.5"><PackageMinus size={14} className="text-green-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{tx.product?.name}</span>
                      {tx.variant?.name && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{tx.variant.name}</span>}
                      <span className="text-sm font-bold text-green-600">×{tx.quantity}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      {tx.location && <span className="flex items-center gap-1"><Warehouse size={10} />{tx.location.store?.name && `${tx.location.store.name} · `}{tx.location.code}</span>}
                      <span className="flex items-center gap-1"><Clock size={10} />{fmtTime(tx.created_at)}</span>
                      <span className="flex items-center gap-1"><User size={10} />{creator}</span>
                    </div>
                  </div>
                  {can('stock', 'stock_in') && (
                    <button onClick={() => { setReturningTxId(isReturning ? null : tx.id); setReturnNote(''); }}
                      className="shrink-0 flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-gray-200 px-2.5 py-1.5 rounded-xl mt-0.5">
                      <Undo2 size={12} /> คืนคลัง
                    </button>
                  )}
                </div>
                {isReturning && (
                  <div className="mt-3 ml-11 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-red-600">ระบุหมายเหตุการคืน <span className="text-red-500">*</span></p>
                    <input className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400"
                      placeholder="เหตุผลที่คืน เช่น เหลือจากงาน, ไม่ได้ใช้..." value={returnNote} onChange={e => setReturnNote(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') submitReturn(tx); }} />
                    <div className="flex gap-2">
                      <button onClick={() => { setReturningTxId(null); setReturnNote(''); }} className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium">ยกเลิก</button>
                      <button onClick={() => submitReturn(tx)} disabled={returnSaving || !returnNote.trim()} className="flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40">
                        {returnSaving ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} ยืนยันคืน {tx.quantity} ชิ้น
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Returns history */}
      {returnsList.length > 0 && (
        <>
          <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
            <Undo2 size={12} className="text-red-500" /><span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">คืนคลังแล้ว</span>
          </div>
          <div className="divide-y divide-gray-50">
            {returnsList.map(tx => {
              const creator = tx.creator ? `${tx.creator.first_name || ''} ${tx.creator.last_name || ''}`.trim() : '—';
              return (
                <div key={tx.id} className="flex items-start gap-3 px-5 py-3 bg-red-50/40">
                  <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0 mt-0.5"><PackagePlus size={14} className="text-red-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{tx.product?.name}</span>
                      {tx.variant?.name && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{tx.variant.name}</span>}
                      <span className="text-sm font-bold text-red-500">×{tx.quantity}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={10} />{fmtTime(tx.created_at)}</span>
                      <span className="flex items-center gap-1"><User size={10} />{creator}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeWithdrawals.length === 0 && returnsList.length === 0 && !formOpen && (
        <p className="px-6 py-8 text-center text-gray-400 text-sm">ยังไม่มีการเบิกวัสดุ — กด "เบิกเพิ่ม" เพื่อจัดเตรียมของให้ช่าง</p>
      )}

      {/* Withdraw form */}
      {formOpen && (
        <div className="p-5 border-t border-gray-100 space-y-4 bg-gray-50/40">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">สินค้าที่จะเบิก</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="w-full pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                placeholder="ค้นหาสินค้าหรือ SKU..." value={search}
                onChange={async e => {
                  setSearch(e.target.value); setShowDrop(true);
                  if (!e.target.value.trim()) { setResults([]); return; }
                  const { data } = await supabase.from('products').select('id, name, sku, has_variants').or(`name.ilike.%${e.target.value}%,sku.ilike.%${e.target.value}%`).limit(8);
                  setResults(data || []);
                }}
                onFocus={() => setShowDrop(true)} onBlur={() => setTimeout(() => setShowDrop(false), 150)} />
              {showDrop && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                  {results.map(p => (
                    <button key={p.id} type="button" onMouseDown={async () => {
                      setProduct(p); setSearch(p.name); setShowDrop(false); setVariant(null);
                      if (p.has_variants) { const { data } = await supabase.from('product_variants').select('*').eq('product_id', p.id); setVariants(data || []); setStockItems([]); }
                      else { setVariants([]); loadStockItems(p, null); }
                    }} className="w-full text-left px-4 py-2.5 hover:bg-amber-50 text-sm border-b border-gray-50 last:border-0">
                      <span className="text-gray-800 font-medium">{p.name}</span><span className="ml-2 text-xs text-gray-400 font-mono">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {product && (
              <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                <span className="text-sm font-semibold text-amber-700">{product.name}</span>
                <button onClick={() => { setProduct(null); setSearch(''); setVariant(null); setVariants([]); setStockItems([]); setSelectedItemId(''); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
              </div>
            )}
          </div>

          {product?.has_variants && variants.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ตัวเลือก (Variant)</p>
              <div className="relative">
                <select className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 appearance-none pr-8"
                  value={variant?.id || ''} onChange={e => { const v = variants.find(x => x.id === e.target.value) || null; setVariant(v); loadStockItems(product, v); }}>
                  <option value="">-- เลือก Variant --</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {product && (!product.has_variants || variant) && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">เบิกจากที่เก็บ</p>
              {stockLoading ? <p className="text-sm text-gray-400 text-center py-3"><Loader2 size={14} className="animate-spin inline mr-1" />กำลังโหลด...</p>
                : stockItems.length === 0 ? <p className="text-sm text-gray-400 text-center py-3">ไม่มีสต๊อกสินค้านี้ในคลังใด</p>
                : (
                  <div className="space-y-2">
                    {stockItems.map(item => {
                      const sel = selectedItemId === item.id;
                      return (
                        <div key={item.id} onClick={() => { setSelectedItemId(item.id); setQty(q => Math.min(q, item.quantity)); }}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${sel ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${sel ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>{sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}</div>
                          <div className="flex-1 min-w-0">
                            {item.location ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-xs">{item.location.code}</span>
                                {item.location.name && <span className="text-xs text-gray-600">{item.location.name}</span>}
                                {item.location.store?.name && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Warehouse size={9} />{item.location.store.name}</span>}
                              </div>
                            ) : <span className="text-xs text-amber-600 font-semibold">ไม่ระบุคลัง</span>}
                          </div>
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg shrink-0">มี {item.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          )}

          {selectedItemId && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">จำนวนที่เบิก</p>
              <input type="number" min={1} max={selItem?.quantity || 1} value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-32 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 text-center font-bold" />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium">ยกเลิก</button>
            <button onClick={submitWithdrawal} disabled={saving || !selectedItemId} className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <PackageMinus size={14} />} เบิกออกจากคลัง
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialPrepPanel;
