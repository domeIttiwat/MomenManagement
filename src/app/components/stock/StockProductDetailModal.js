'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Package, MapPin, Warehouse, Layers,
  PackageCheck, PackageMinus, Sliders, User, Calendar, Clock,
  ImageOff, ChevronLeft, ChevronRight, ArrowRightLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

const fmt = (iso) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
    time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
  };
};

const TABS = [
  { id: 'location', label: 'ที่เก็บ',  icon: Warehouse    },
  { id: 'in',       label: 'รับเข้า',  icon: PackageCheck },
  { id: 'out',      label: 'เบิกออก',  icon: PackageMinus },
];

const StockProductDetailModal = ({ product, onClose, onStockIn, onStockOut, onAdjust }) => {
  const { can, profile } = useAuth();

  const [tab, setTab]           = useState('location');
  const [imgIndex, setImgIndex] = useState(0);
  const [stockItems, setStockItems] = useState([]);
  const [txIn, setTxIn]         = useState([]);
  const [txOut, setTxOut]       = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [mounted, setMounted]   = useState(false);

  // Transfer state
  const [transferForm, setTransferForm] = useState(null); // { itemId, variantId, sourceLocId, sourceLocCode, sourceStoreId, sourceQty }
  const [transferDest, setTransferDest] = useState('');
  const [transferQty, setTransferQty]   = useState(1);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchAll = useCallback(async () => {
    if (!product?.id) return;
    setLoading(true);
    const [itemsRes, txRes, locRes, storeRes, variantRes] = await Promise.all([
      supabase.from('stock_items').select('id, quantity, min_quantity, variant_id, location_id').eq('product_id', product.id),
      supabase
        .from('stock_transactions')
        .select('id, transaction_type, quantity, created_at, note, location_id, variant_id, creator:created_by(first_name, last_name)')
        .eq('product_id', product.id)
        .in('transaction_type', ['stock_in', 'stock_out'])
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.from('storage_locations').select('id, code, name, store_id'),
      supabase.from('stores').select('id, name'),
      supabase.from('product_variants').select('id, name').eq('product_id', product.id),
    ]);

    // Build manual lookup maps
    const sm = {};
    (storeRes.data || []).forEach(s => { sm[s.id] = s; });
    const lm = {};
    (locRes.data || []).forEach(l => { lm[l.id] = { ...l, store: sm[l.store_id] || null }; });
    const vm = {};
    (variantRes.data || []).forEach(v => { vm[v.id] = v; });

    setStockItems((itemsRes.data || []).map(item => ({
      ...item,
      location: item.location_id ? lm[item.location_id] || null : null,
      variant: item.variant_id ? vm[item.variant_id] || null : null,
    })));

    const txAll = (txRes.data || []).map(tx => ({
      ...tx,
      location: tx.location_id ? lm[tx.location_id] || null : null,
      variant: tx.variant_id ? vm[tx.variant_id] || null : null,
    }));
    setTxIn(txAll.filter(t => t.transaction_type === 'stock_in'));
    setTxOut(txAll.filter(t => t.transaction_type === 'stock_out'));
    setLoading(false);
  }, [product?.id]);

  const loadLocations = useCallback(async () => {
    const [{ data: locs }, { data: strs }] = await Promise.all([
      supabase.from('storage_locations').select('id, code, name, store_id').order('code'),
      supabase.from('stores').select('id, name'),
    ]);
    const sm = {};
    (strs || []).forEach(s => { sm[s.id] = s; });
    setAllLocations((locs || []).map(l => ({ ...l, store: sm[l.store_id] || null })));
  }, []);

  useEffect(() => {
    setImgIndex(0);
    setTransferForm(null);
    fetchAll();
  }, [fetchAll]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  if (!mounted) return null;

  // ── Transfer ──
  const doTransfer = async () => {
    if (!transferDest || transferQty <= 0 || !transferForm || transferring) return;
    setTransferring(true);
    try {
      const qty = Number(transferQty);

      // 1. Decrease source
      await supabase.from('stock_items')
        .update({ quantity: transferForm.sourceQty - qty })
        .eq('id', transferForm.itemId);

      // 2. Find or create destination stock_item
      let q = supabase.from('stock_items').select('id, quantity')
        .eq('product_id', product.id)
        .eq('location_id', transferDest);
      if (transferForm.variantId) q = q.eq('variant_id', transferForm.variantId);
      else                        q = q.is('variant_id', null);
      const { data: destItem } = await q.maybeSingle();

      if (destItem) {
        await supabase.from('stock_items')
          .update({ quantity: destItem.quantity + qty })
          .eq('id', destItem.id);
      } else {
        await supabase.from('stock_items').insert({
          product_id: product.id,
          variant_id: transferForm.variantId || null,
          location_id: transferDest,
          quantity: qty,
          created_by: profile?.id,
        });
      }

      // 3. Log transactions
      const destLoc = allLocations.find(l => l.id === transferDest);
      const note    = `ย้ายจาก ${transferForm.sourceLocCode} ไป ${destLoc?.code || '—'}`;
      const txBase  = {
        product_id:     product.id,
        variant_id:     transferForm.variantId || null,
        quantity:       qty,
        created_by:     profile?.id,
        note,
        reference_type: 'manual',
      };
      await supabase.from('stock_transactions').insert([
        { ...txBase, transaction_type: 'stock_out', location_id: transferForm.sourceLocId, store_id: transferForm.sourceStoreId || null },
        { ...txBase, transaction_type: 'stock_in',  location_id: transferDest,             store_id: destLoc?.store?.id || null },
      ]);

      setTransferForm(null);
      await fetchAll();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setTransferring(false);
    }
  };

  // ── Cancel storage ──
  const doCancelStorage = async (item) => {
    if (item.quantity > 0) {
      alert(`ยังมีสินค้า ${item.quantity} ชิ้นอยู่ กรุณาย้ายออกก่อนยกเลิก`);
      return;
    }
    const locLabel = item.location?.code || 'ไม่ระบุที่เก็บ';
    if (!confirm(`ยืนยันยกเลิกการจัดเก็บที่ "${locLabel}"?\nสินค้านี้จะไม่ถูกติดตามที่ตำแหน่งนี้อีกต่อไป`)) return;
    await supabase.from('stock_items').delete().eq('id', item.id);
    await fetchAll();
  };

  // ── Derived ──
  const images   = Array.isArray(product.images) ? product.images.filter(i => i?.url) : [];
  const totalQty = stockItems.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const catNames = (product.product_categories || []).map(pc => pc.category?.name).filter(Boolean).join(', ');

  const TxRow = ({ tx }) => {
    const { date, time } = fmt(tx.created_at);
    const creator   = tx.creator ? `${tx.creator.first_name} ${tx.creator.last_name}` : '—';
    const isIn      = tx.transaction_type === 'stock_in';
    const storeName = tx.location?.store?.name;
    const locLabel  = tx.location ? `${tx.location.code}${tx.location.name ? ` · ${tx.location.name}` : ''}` : null;
    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {isIn ? <PackageCheck size={14} /> : <PackageMinus size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-base ${isIn ? 'text-green-700' : 'text-red-600'}`}>
              {isIn ? '+' : '−'}{tx.quantity}
            </span>
            {tx.variant?.name && (
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{tx.variant.name}</span>
            )}
            {storeName && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5"><Warehouse size={10} />{storeName}</span>
            )}
            {locLabel && (
              <span className="font-mono text-xs bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">{locLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Calendar size={10} />{date}</span>
            <span className="flex items-center gap-1"><Clock size={10} />{time}</span>
            <span className="flex items-center gap-1"><User size={10} />{creator}</span>
            {tx.note && <span className="text-gray-500 italic">"{tx.note}"</span>}
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-4 text-white flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-base leading-tight truncate">{product.name}</h3>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {product.sku && <span className="text-white/75 text-xs font-mono">{product.sku}</span>}
              {catNames    && <span className="text-white/65 text-xs">{catNames}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0 ml-3">
            <X size={22} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Main image */}
          {images.length > 0 ? (
            <div className="relative bg-gray-100">
              <img src={images[imgIndex].url} alt={product.name} className="w-full h-52 object-contain" />
              {images.length > 1 && (
                <>
                  <button onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => setImgIndex(i => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors">
                    <ChevronRight size={18} />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <button key={i} onClick={() => setImgIndex(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/40'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-32 bg-gray-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-1.5 text-gray-300">
                <ImageOff size={28} /><span className="text-xs">ไม่มีรูปภาพ</span>
              </div>
            </div>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-gray-50 border-b border-gray-100">
              {images.map((img, i) => (
                <button key={i} onClick={() => setImgIndex(i)}
                  className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${i === imgIndex ? 'border-teal-500' : 'border-transparent opacity-60 hover:opacity-90'}`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="px-5 py-3 border-b border-gray-100 bg-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">รายละเอียด</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {/* ── Tabs (sticky) ── */}
          <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
            {TABS.map(t => {
              const Icon  = t.icon;
              const count = t.id === 'location' ? stockItems.length : t.id === 'in' ? txIn.length : txOut.length;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors border-b-2 ${
                    tab === t.id
                      ? t.id === 'in'  ? 'border-green-500 text-green-700'
                      : t.id === 'out' ? 'border-red-500 text-red-600'
                                       : 'border-teal-500 text-teal-700'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                  {!loading && count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      tab === t.id
                        ? t.id === 'in'  ? 'bg-green-100 text-green-700'
                        : t.id === 'out' ? 'bg-red-100 text-red-600'
                                         : 'bg-teal-100 text-teal-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Action bar (stock in / out / adjust) ── */}
        {(onStockIn || onStockOut || onAdjust) && (
          <div className="flex gap-2 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
            {onStockIn && (
              <button
                onClick={onStockIn}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <PackageCheck size={15} /> รับเข้า
              </button>
            )}
            {onStockOut && (
              <button
                onClick={onStockOut}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <PackageMinus size={15} /> เบิกออก
              </button>
            )}
            {onAdjust && (
              <button
                onClick={onAdjust}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <Sliders size={15} /> ปรับสต๊อก
              </button>
            )}
          </div>
        )}

        {/* ── Tab body ── */}
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>

          ) : tab === 'location' ? (
            stockItems.length === 0 ? (
              <div className="py-14 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลสต๊อก</div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {stockItems.map(item => {
                    const isActive = transferForm?.itemId === item.id;
                    const dests    = allLocations.filter(l => l.id !== item.location_id);
                    return (
                      <div key={item.id}>
                        {/* Row */}
                        <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50/30 transition-colors">
                          {/* Location info */}
                          <div className="flex-1 min-w-0">
                            {item.location ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-xs">
                                  {item.location.code}
                                </span>
                                {item.location.name && (
                                  <span className="text-gray-700 text-xs">{item.location.name}</span>
                                )}
                                {item.location.store?.name && (
                                  <span className="text-gray-400 text-xs flex items-center gap-0.5">
                                    <Warehouse size={10} />{item.location.store.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs flex items-center gap-1">
                                <MapPin size={11} /> ไม่ระบุที่เก็บ
                              </span>
                            )}
                            {item.variant?.name && (
                              <span className="mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full inline-block">
                                {item.variant.name}
                              </span>
                            )}
                          </div>

                          {/* Qty + Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`font-bold px-3 py-1 rounded-lg text-sm ${
                              item.quantity === 0
                                ? 'bg-gray-100 text-gray-400'
                                : item.quantity <= (item.min_quantity || 0)
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-teal-50 text-teal-700'
                            }`}>
                              {item.quantity} ชิ้น
                            </span>

                            {/* ย้าย (qty > 0 + has location + can edit) */}
                            {item.quantity > 0 && item.location_id && can('stock', 'edit') && (
                              <button
                                onClick={() => {
                                  if (isActive) {
                                    setTransferForm(null);
                                  } else {
                                    setTransferForm({
                                      itemId:        item.id,
                                      variantId:     item.variant_id,
                                      sourceLocId:   item.location_id,
                                      sourceLocCode: item.location.code,
                                      sourceStoreId: item.location.store?.id || null,
                                      sourceQty:     item.quantity,
                                    });
                                    setTransferDest('');
                                    setTransferQty(Math.min(1, item.quantity));
                                  }
                                }}
                                title="ย้ายไปที่เก็บอื่น"
                                className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                            )}

                            {/* ยกเลิกที่เก็บ (qty = 0 + can delete) */}
                            {item.quantity === 0 && can('stock', 'delete') && (
                              <button
                                onClick={() => doCancelStorage(item)}
                                className="text-xs font-medium px-2 py-1 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap"
                              >
                                ยกเลิกที่เก็บ
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline transfer form */}
                        {isActive && (
                          <div className="px-4 pb-3 pt-2 bg-blue-50/70 border-t border-blue-100">
                            <p className="text-xs text-blue-600 font-semibold mb-2 flex items-center gap-1">
                              <ArrowRightLeft size={12} />
                              ย้ายจาก
                              <span className="font-mono bg-white border border-blue-200 px-1.5 py-0.5 rounded ml-1">
                                {transferForm.sourceLocCode}
                              </span>
                            </p>
                            <div className="flex items-end gap-2 flex-wrap">
                              <div className="flex-1 min-w-[160px]">
                                <label className="text-xs text-gray-500 block mb-1">ปลายทาง</label>
                                <select
                                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                                  value={transferDest}
                                  onChange={e => setTransferDest(e.target.value)}
                                >
                                  <option value="">เลือกที่เก็บ...</option>
                                  {dests.length === 0 ? (
                                    <option disabled>ไม่มีที่เก็บอื่น</option>
                                  ) : dests.map(l => (
                                    <option key={l.id} value={l.id}>
                                      {l.store?.name ? `[${l.store.name}] ` : ''}{l.code}{l.name ? ` · ${l.name}` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="w-20">
                                <label className="text-xs text-gray-500 block mb-1">จำนวน</label>
                                <input
                                  type="number" min={1} max={transferForm.sourceQty}
                                  value={transferQty}
                                  onChange={e => setTransferQty(Math.max(1, Math.min(Number(e.target.value), transferForm.sourceQty)))}
                                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-center"
                                />
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={doTransfer}
                                  disabled={!transferDest || transferQty <= 0 || transferring}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors"
                                >
                                  {transferring ? '...' : 'ยืนยัน'}
                                </button>
                                <button
                                  onClick={() => setTransferForm(null)}
                                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-3 flex items-center justify-between bg-gray-50/50 border-t border-gray-100">
                  <span className="text-sm text-gray-500">สต๊อกรวมทั้งหมด</span>
                  <span className="font-bold text-teal-700 text-lg">{totalQty} <span className="text-sm font-normal text-gray-400">ชิ้น</span></span>
                </div>
              </>
            )

          ) : tab === 'in' ? (
            txIn.length === 0 ? (
              <div className="py-14 text-center text-gray-400 text-sm">ยังไม่มีประวัติรับเข้า</div>
            ) : (
              <>
                <div className="px-4 py-2">{txIn.map(tx => <TxRow key={tx.id} tx={tx} />)}</div>
                <div className="px-5 py-3 flex items-center justify-between bg-gray-50/50 border-t border-gray-100">
                  <span className="text-sm text-gray-500">รับเข้าทั้งหมด</span>
                  <span className="font-bold text-green-700">{txIn.reduce((s, t) => s + t.quantity, 0)} ชิ้น · {txIn.length} ครั้ง</span>
                </div>
              </>
            )

          ) : (
            txOut.length === 0 ? (
              <div className="py-14 text-center text-gray-400 text-sm">ยังไม่มีประวัติเบิกออก</div>
            ) : (
              <>
                <div className="px-4 py-2">{txOut.map(tx => <TxRow key={tx.id} tx={tx} />)}</div>
                <div className="px-5 py-3 flex items-center justify-between bg-gray-50/50 border-t border-gray-100">
                  <span className="text-sm text-gray-500">เบิกออกทั้งหมด</span>
                  <span className="font-bold text-red-600">{txOut.reduce((s, t) => s + t.quantity, 0)} ชิ้น · {txOut.length} ครั้ง</span>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StockProductDetailModal;
