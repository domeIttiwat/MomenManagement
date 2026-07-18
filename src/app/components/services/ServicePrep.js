import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ListChecks, Plus, Trash2, RotateCcw, Package, Box, Loader2, X, StickyNote, Search, Link2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';

const STATUS = {
  pending:     { label: 'ยังไม่เตรียม',   chip: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-300' },
  in_progress: { label: 'กำลังดำเนินการ', chip: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  done:        { label: 'เตรียมแล้ว',     chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};
const SOURCE_LABEL = { stock: 'ดึงจากสต๊อก', buy: 'สั่งซื้อเพิ่ม' };
const STATUS_ORDER = ['pending', 'in_progress', 'done'];
const SOURCE_ORDER = [null, 'buy', 'stock'];
const nextStatus = (s) => STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
const nextSource = (s) => SOURCE_ORDER[(SOURCE_ORDER.indexOf(s ?? null) + 1) % SOURCE_ORDER.length];

// การจัดเตรียมของสำหรับงานบริการ — ระบบเดียวกับฝั่งออเดอร์ (OrderPrep) ใช้ตาราง service_preps/service_prep_items
const ServicePrep = ({ service, onItemsChange, openSignal }) => {
  const { can, profile } = useAuth();
  const canEdit = can('assembly', 'prepare');
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);

  const [prep, setPrep] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [pickerFor, setPickerFor] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [linkedNames, setLinkedNames] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: p } = await supabase.from('service_preps').select('*').eq('service_id', service.id).maybeSingle();
    setPrep(p || null);
    if (p) {
      const { data: its } = await supabase.from('service_prep_items').select('*').eq('prep_id', p.id).order('sort_order').order('created_at');
      setItems(its || []);
      const linkIds = [...new Set((its || []).map((x) => x.stock_product_id).filter(Boolean))];
      if (linkIds.length) {
        const { data: prods } = await supabase.from('products').select('id, name').in('id', linkIds);
        const map = {}; (prods || []).forEach((pr) => { map[pr.id] = pr.name; });
        setLinkedNames(map);
      }
    } else { setItems([]); }
    setLoading(false);
  }, [service.id]);

  useEffect(() => { load(); }, [load]);

  // ส่งรายการล่าสุดให้ parent (ใช้โชว์ chip สถานะบนอะไหล่ในรายการซ่อม)
  useEffect(() => { onItemsChange?.(items); }, [items, onItemsChange]);

  // ปุ่ม "เช็คลิสต์เตรียมอะไหล่" บนหัวข้อรายการซ่อม → ยังไม่เริ่มก็เริ่มให้เลย, เริ่มแล้วเปิดป๊อปอัพอัปเดต
  const handledSignal = useRef(0);
  useEffect(() => {
    if (!openSignal || openSignal === handledSignal.current || loading || busy) return;
    handledSignal.current = openSignal;
    if (prep) setEditing(true);
    else if (canEdit) startPrep();
  }, [openSignal, loading, busy, prep, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pickerFor) return;
    const t = setTimeout(async () => {
      let q = supabase.from('products').select('id, name, sku, cost_price').limit(20);
      q = search.trim() ? q.ilike('name', `%${search}%`) : q.order('created_at', { ascending: false });
      const { data } = await q;
      const products = data || [];
      // แนบข้อมูลสต๊อก: เหลือกี่ชิ้น เก็บอยู่ที่ไหนบ้าง
      const stockByProduct = {};
      try {
        const ids = products.map((p) => p.id);
        if (ids.length) {
          const [{ data: items }, { data: locs }, { data: strs }] = await Promise.all([
            supabase.from('stock_items').select('product_id, quantity, location_id').in('product_id', ids).gt('quantity', 0),
            supabase.from('storage_locations').select('id, code, store_id'),
            supabase.from('stores').select('id, name'),
          ]);
          const storeById = {}; (strs || []).forEach((s) => { storeById[s.id] = s.name; });
          const locById = {}; (locs || []).forEach((l) => { locById[l.id] = `${storeById[l.store_id] || ''} ${l.code}`.trim(); });
          (items || []).forEach((it) => {
            const cur = (stockByProduct[it.product_id] = stockByProduct[it.product_id] || { total: 0, places: {} });
            const qty = Number(it.quantity) || 0;
            cur.total += qty;
            const label = it.location_id ? (locById[it.location_id] || 'ไม่ทราบที่เก็บ') : 'รอจัดเก็บ';
            cur.places[label] = (cur.places[label] || 0) + qty;
          });
        }
      } catch { /* โชว์สต๊อกไม่ได้ก็ไม่เป็นไร */ }
      setResults(products.map((p) => ({ ...p, _stock: stockByProduct[p.id] || null })));
    }, 250);
    return () => clearTimeout(t);
  }, [search, pickerFor]);

  // ---------- start: สร้างรายการจาก service_items + sub_items (ไม่มีก็เริ่มว่าง แล้วเพิ่มเอง) ----------
  const startPrep = async () => {
    if (!canEdit) return;
    setBusy(true);
    try {
      const sItems = service.service_items || [];
      const { data: prepRow, error: pErr } = await supabase.from('service_preps')
        .insert({ service_id: service.id, status: 'in_progress', created_by: meRef() }).select().single();
      if (pErr) throw pErr;

      for (let i = 0; i < sItems.length; i++) {
        const si = sItems[i];
        const node = {
          prep_id: prepRow.id, parent_item_id: null, kind: 'product',
          title: si.description || si.name || '(รายการ)', qty: si.quantity || si.qty || 1, status: 'pending', sort_order: i,
        };
        const { data: nodeRow, error: nErr } = await supabase.from('service_prep_items').insert(node).select().single();
        if (nErr) throw nErr;
        const subs = si.sub_items || [];
        if (subs.length) {
          await supabase.from('service_prep_items').insert(subs.map((sub, idx) => ({
            prep_id: prepRow.id, parent_item_id: nodeRow.id, kind: 'component',
            title: sub.description || sub.name || '(ชิ้นส่วน)', qty: (sub.qty || sub.quantity || 1),
            unit_price: null, source: null, status: 'pending', note: sub.note || null, sort_order: idx,
          })));
        }
      }
      await logAction({ resource_type: 'service', resource_id: service.id, action: 'prep_start', resource_label: service.service_number, created_by: meRef() });
      await load(); setEditing(true);
    } catch (err) { alert('เริ่มจัดเตรียมไม่สำเร็จ: ' + err.message); }
    finally { setBusy(false); }
  };

  const patchItem = async (id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    await supabase.from('service_prep_items').update(patch).eq('id', id);
    refreshPrepStatus();
  };
  const refreshPrepStatus = async () => {
    if (!prep) return;
    const { data: its } = await supabase.from('service_prep_items').select('id,kind,parent_item_id,status').eq('prep_id', prep.id);
    const all = its || [];
    const hasChild = (id) => all.some((x) => x.parent_item_id === id);
    const lv = all.filter((x) => x.kind !== 'product' || !hasChild(x.id));
    let st = 'in_progress';
    if (lv.length) { const done = lv.filter((x) => x.status === 'done').length; st = done === lv.length ? 'done' : 'in_progress'; }
    await supabase.from('service_preps').update({ status: st, updated_at: new Date().toISOString() }).eq('id', prep.id);
    setPrep((p) => (p ? { ...p, status: st } : p));
  };
  const deleteItem = async (id) => { setItems((prev) => prev.filter((it) => it.id !== id)); await supabase.from('service_prep_items').delete().eq('id', id); };

  const addManual = async () => {
    if (!manualTitle.trim() || !prep) return;
    const { data, error } = await supabase.from('service_prep_items').insert({
      prep_id: prep.id, parent_item_id: null, kind: 'manual', title: manualTitle.trim(), qty: Number(manualQty) || 1, status: 'pending', sort_order: 999,
    }).select().single();
    if (!error && data) { setItems((prev) => [...prev, data]); setManualTitle(''); setManualQty(1); }
  };

  const cycleSource = (it) => {
    const ns = nextSource(it.source);
    patchItem(it.id, ns === 'stock' ? { source: 'stock' } : { source: ns, stock_product_id: null });
  };

  const selectStock = async (product) => {
    if (!pickerFor) return;
    setLinkedNames((m) => ({ ...m, [product.id]: product.name }));
    await patchItem(pickerFor, { source: 'stock', stock_product_id: product.id, unit_price: Number(product.cost_price) || 0 });
    setPickerFor(null); setSearch(''); setResults([]);
  };

  const doReset = async () => {
    if (!prep) return; setBusy(true);
    await supabase.from('service_prep_items').update({ status: 'pending', source: null, unit_price: null, stock_product_id: null }).eq('prep_id', prep.id);
    await supabase.from('service_preps').update({ status: 'in_progress' }).eq('id', prep.id);
    setConfirm(null); setConfirmText(''); setBusy(false); await load();
  };
  const doCancel = async () => {
    if (!prep) return; setBusy(true);
    await supabase.from('service_preps').delete().eq('id', prep.id);
    await logAction({ resource_type: 'service', resource_id: service.id, action: 'prep_cancel', resource_label: service.service_number, created_by: meRef() });
    setConfirm(null); setConfirmText(''); setEditing(false); setBusy(false); await load();
  };

  // ---------- derived ----------
  const childrenOf = (id) => items.filter((it) => it.parent_item_id === id);
  const isLeaf = (it) => it.kind !== 'product' || childrenOf(it.id).length === 0;
  const productNodes = items.filter((it) => it.kind === 'product');
  const manualItems = items.filter((it) => it.kind === 'manual');
  const leaves = items.filter(isLeaf);
  const doneCount = leaves.filter((it) => it.status === 'done').length;
  const progress = leaves.length ? Math.round((doneCount / leaves.length) * 100) : 0;
  const totalCost = leaves.reduce((s, it) => s + ((Number(it.unit_price) || 0) * (Number(it.qty) || 1)), 0);

  const card = 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden';

  if (loading) return <div className={`${card} p-8 flex items-center gap-2 text-gray-400`}><Loader2 size={18} className="animate-spin" /> กำลังโหลดการจัดเตรียม...</div>;

  if (!prep) {
    return (
      <div className={`${card} px-8 py-6 flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <ListChecks size={22} className="text-indigo-500" />
          <div>
            <h3 className="font-bold text-gray-800">การจัดเตรียมของ</h3>
            <p className="text-sm text-gray-400">ยังไม่เริ่มเตรียม — ระบบจะดึงรายการจากงานบริการให้ แล้วเพิ่ม/เลือกจากสต๊อกได้</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={startPrep} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all shrink-0">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ListChecks size={16} />} เริ่มจัดเตรียมของ
          </button>
        )}
      </div>
    );
  }

  const RoRow = ({ it, indent }) => (
    <div className={`flex flex-wrap items-center gap-2 py-1.5 ${indent ? 'pl-7' : 'pl-3'} pr-3`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS[it.status]?.dot}`} />
      <span className="text-sm text-gray-800 flex-1 min-w-[120px]">{it.title}</span>
      {it.source && <span className="text-[10px] text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">{SOURCE_LABEL[it.source]}</span>}
      <span className="flex items-baseline gap-1 bg-gray-100 rounded-md px-2 py-0.5 shrink-0"><span className="text-[10px] text-gray-400">จำนวน</span><span className="text-sm font-bold text-gray-800">{it.qty}</span></span>
      {Number(it.unit_price) > 0 && <span className="text-xs text-amber-600 font-medium w-20 text-right">฿{Number(it.unit_price).toLocaleString()}</span>}
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS[it.status]?.chip}`}>{STATUS[it.status]?.label}</span>
    </div>
  );

  return (
    <>
      <div className={card}>
        <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ListChecks size={20} className="text-indigo-500" />
              <h3 className="font-bold text-gray-800">การจัดเตรียมของ</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${prep.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {prep.status === 'done' ? 'เตรียมครบ' : 'กำลังเตรียม'}
              </span>
            </div>
            {canEdit && (
              <button onClick={() => setEditing(true)} className="bg-gray-900 hover:bg-black text-white text-sm px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 active:scale-95 transition-all">
                <Pencil size={14} /> อัปเดตการจัดเตรียม
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-bold text-gray-700">{progress}%</span>
            <span className="text-xs text-gray-400">({doneCount}/{leaves.length})</span>
            <span className="text-sm font-bold text-amber-600 ml-2">฿{totalCost.toLocaleString()}</span>
          </div>
        </div>

        <div className="p-4 space-y-2.5">
          {productNodes.map((node) => {
            const kids = childrenOf(node.id);
            return (
              <div key={node.id} className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50/40">
                  <Package size={15} className="text-indigo-500" />
                  <span className="font-bold text-sm text-gray-800 flex-1">{node.title}</span>
                  <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded px-2 py-0.5">x{node.qty}</span>
                  {kids.length === 0 && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS[node.status]?.chip}`}>{STATUS[node.status]?.label}</span>}
                </div>
                {kids.length > 0 && <div className="divide-y divide-gray-50">{kids.map((k) => <RoRow key={k.id} it={k} indent />)}</div>}
              </div>
            );
          })}
          {manualItems.length > 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-600">รายการเพิ่มเติม</div>
              <div className="divide-y divide-gray-50">{manualItems.map((m) => <RoRow key={m.id} it={m} />)}</div>
            </div>
          )}
          {productNodes.length === 0 && manualItems.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">ยังไม่มีรายการ — กด "อัปเดตการจัดเตรียม" เพื่อเพิ่มของที่ต้องเตรียม</p>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <ListChecks size={20} className="text-indigo-500" />
                <h3 className="font-bold text-gray-800">อัปเดตการจัดเตรียม</h3>
                <span className="text-xs text-gray-400">{progress}% · ฿{totalCost.toLocaleString()}</span>
              </div>
              <button onClick={() => setEditing(false)}><X size={22} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
              {productNodes.map((node) => {
                const kids = childrenOf(node.id);
                return (
                  <div key={node.id} className="rounded-2xl border border-gray-100 bg-white">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50/50 rounded-t-2xl">
                      <Package size={16} className="text-indigo-500" />
                      <span className="font-bold text-sm text-gray-800 flex-1">{node.title}</span>
                      <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded px-2 py-0.5">x{node.qty}</span>
                    </div>
                    <div className="px-2">
                      {kids.length ? kids.map(renderEditRow)
                        : <div className="px-2">{renderEditRow({ ...node, _whole: true })}</div>}
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-dashed border-gray-200 bg-white">
                <div className="px-4 py-2.5 bg-gray-50 rounded-t-2xl text-sm font-bold text-gray-600">รายการเพิ่มเติม (เฉพาะงานนี้)</div>
                <div className="px-2">{manualItems.map(renderEditRow)}</div>
                <div className="flex items-center gap-2 p-3">
                  <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } }}
                    placeholder="พิมพ์ชื่อรายการที่ต้องเตรียมเพิ่ม..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400" />
                  <input type="number" min="1" value={manualQty} onChange={(e) => setManualQty(parseInt(e.target.value) || 1)} className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm text-center outline-none" />
                  <button onClick={addManual} className="bg-gray-800 hover:bg-black text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 shrink-0"><Plus size={14} /> เพิ่ม</button>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={() => { setConfirm('reset'); setConfirmText(''); }} className="text-xs text-gray-500 hover:bg-gray-100 px-3 py-2 rounded-lg flex items-center gap-1 font-semibold"><RotateCcw size={13} /> ล้างค่า</button>
                <button onClick={() => { setConfirm('cancel'); setConfirmText(''); }} className="text-xs text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-1 font-semibold"><Trash2 size={13} /> ยกเลิกการจัดเตรียม</button>
              </div>
              <button onClick={() => setEditing(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold">เสร็จสิ้น</button>
            </div>
          </div>
        </div>
      )}

      {pickerFor && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Search size={18} /> เลือกสินค้าในสต๊อก (ดึงราคา)</h3>
              <button onClick={() => { setPickerFor(null); setSearch(''); }}><X size={20} /></button>
            </div>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสินค้า..." className="w-full pl-10 pr-3 py-2 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {results.length ? results.map((p) => (
                <button key={p.id} onClick={() => selectStock(p)} className="w-full flex items-center justify-between gap-2 p-3 hover:bg-gray-50 rounded-xl text-left border border-transparent hover:border-gray-200">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{p.sku}</p>
                    {p._stock ? (
                      <p className="text-[10px] mt-0.5 truncate">
                        <span className="font-bold text-emerald-600">เหลือ {p._stock.total} ชิ้น</span>
                        <span className="text-gray-400"> · {Object.entries(p._stock.places).map(([place, qty]) => `${place} ×${qty}`).join(', ')}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] mt-0.5 text-red-400">ไม่มีของในสต๊อก</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-amber-600 shrink-0">฿{(p.cost_price || 0).toLocaleString()}</span>
                </button>
              )) : <p className="text-center text-gray-400 text-sm py-6">— ไม่พบสินค้า —</p>}
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                {confirm === 'cancel' ? <><Trash2 size={18} className="text-red-500" /> ยกเลิกการจัดเตรียม</> : <><RotateCcw size={18} className="text-gray-500" /> ล้างค่าการจัดเตรียม</>}
              </h3>
              <button onClick={() => { setConfirm(null); setConfirmText(''); }}><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {confirm === 'cancel'
                ? <>ลบการจัดเตรียมทั้งหมดของงานนี้ (กู้คืนไม่ได้) — พิมพ์ <b>Cancel</b> เพื่อยืนยัน</>
                : <>รีเซ็ตสถานะ/ที่มา/ราคาทุกรายการกลับเป็นเริ่มต้น (ยังเก็บรายการไว้) — พิมพ์ <b>Reset</b> เพื่อยืนยัน</>}
            </p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={confirm === 'cancel' ? 'พิมพ์ Cancel' : 'พิมพ์ Reset'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400 mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirm(null); setConfirmText(''); }} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">ปิด</button>
              {confirm === 'cancel'
                ? <button onClick={doCancel} disabled={confirmText !== 'Cancel' || busy} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40">ยกเลิกทั้งหมด</button>
                : <button onClick={doReset} disabled={confirmText !== 'Reset' || busy} className="px-4 py-2 text-sm font-bold text-white bg-gray-800 rounded-lg hover:bg-black disabled:opacity-40">ล้างค่า</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );

  function renderEditRow(it) {
    return (
      <div key={it.id} className="flex flex-wrap items-center gap-2 py-2.5 px-2 border-b border-gray-50 last:border-0">
        <Box size={13} className="text-gray-300 shrink-0" />
        <span className="text-sm text-gray-800 flex-1 min-w-[110px]">{it.title}{it._whole && <span className="text-[10px] text-gray-400"> (ทั้งชิ้น)</span>}</span>

        <span className="flex items-baseline gap-1 bg-gray-900 text-white rounded-lg px-2.5 py-1 shrink-0">
          <span className="text-[10px] opacity-60">จำนวน</span><span className="text-base font-black leading-none">{it.qty}</span>
        </span>

        <button type="button" disabled={!canEdit} onClick={() => cycleSource(it)} title="คลิกเพื่อเปลี่ยนที่มา"
          className={`text-xs rounded-lg px-2.5 py-1.5 font-semibold border transition-colors w-28 text-center whitespace-nowrap shrink-0 ${it.source ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-gray-400 border-gray-200'} disabled:opacity-60`}>
          {it.source ? SOURCE_LABEL[it.source] : '— เลือกที่มา —'}
        </button>
        {it.source === 'stock' && (it.stock_product_id
          ? <button disabled={!canEdit} onClick={() => setPickerFor(it.id)} title="เปลี่ยนสินค้า" className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 flex items-center gap-1 max-w-[130px] disabled:opacity-60"><Link2 size={11} className="shrink-0" /><span className="truncate">{linkedNames[it.stock_product_id] || `#${it.stock_product_id}`}</span></button>
          : canEdit && <button onClick={() => setPickerFor(it.id)} className="text-[11px] text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1 flex items-center gap-1"><Search size={11} /> เลือก</button>)}

        <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-1.5 py-1 bg-white">
          <span className="text-[10px] text-gray-400">฿</span>
          <input type="number" min="0" disabled={!canEdit} value={it.unit_price ?? ''} placeholder="0"
            onChange={(e) => patchItem(it.id, { unit_price: e.target.value === '' ? null : Number(e.target.value) })}
            className="w-14 text-right text-xs outline-none bg-transparent disabled:opacity-60" />
        </div>

        <button type="button" disabled={!canEdit} onClick={() => patchItem(it.id, { status: nextStatus(it.status) })} title="คลิกเพื่อเปลี่ยนสถานะ"
          className={`text-xs rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${STATUS[it.status]?.chip} disabled:opacity-60`}>
          {STATUS[it.status]?.label}
        </button>

        {it.note != null
          ? <input disabled={!canEdit} value={it.note} placeholder="พิมพ์หมายเหตุ..." autoFocus={it.note === ''}
              onChange={(e) => patchItem(it.id, { note: e.target.value })}
              onBlur={(e) => { if (e.target.value.trim() === '') patchItem(it.id, { note: null }); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-yellow-50/50 w-28 outline-none disabled:opacity-60" />
          : canEdit && <button onClick={() => patchItem(it.id, { note: '' })} className="text-gray-300 hover:text-amber-500 p-1" title="เพิ่มหมายเหตุ"><StickyNote size={13} /></button>}

        {canEdit && it.kind === 'manual' && <button onClick={() => deleteItem(it.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>}
      </div>
    );
  }
};

export default ServicePrep;
