'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Check, Plus, Trash2, Loader2, Clock, Flag, Link2, Package, Send, Image as ImageIcon, Pencil, Hand, ShoppingCart, ThumbsUp, CornerDownRight, Eye, CheckCircle2, Phone, UserRound, Bike, StickyNote, Undo2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import AuditLogPanel from '@/app/components/common/AuditLogPanel';
import { createStockLot, allocateFifoStockOut } from '@/lib/stockLots';
import { notifyUsers, cardPeople } from './workNotify';

const dt = (v) => (v ? new Date(v).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// ที่มาของของ — ระบบเดียวกับหน้าเตรียมของ (OrderPrep/ServicePrep)
const SOURCE_LABEL = { stock: 'ดึงจากสต๊อก', buy: 'สั่งซื้อเพิ่ม' };
const SOURCE_ORDER = [null, 'buy', 'stock'];
const nextSource = (s) => SOURCE_ORDER[(SOURCE_ORDER.indexOf(s ?? null) + 1) % SOURCE_ORDER.length];
const ageText = (from) => {
  const days = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86400000));
  if (days < 1) return 'สร้างวันนี้';
  if (days < 30) return `ค้างมา ${days} วัน`;
  const m = Math.floor(days / 30);
  if (m < 12) return `ค้างมา ${m} เดือน ${days % 30} วัน`;
  return `ค้างมา ${Math.floor(m / 12)} ปี ${m % 12} เดือน`;
};
// ทำลิงก์ในข้อความให้กดได้
const linkify = (text) => String(text || '').split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
  /^https?:\/\//.test(part)
    ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-indigo-600 underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>
    : part
);

const WorkCardDetail = ({ card: initialCard, onClose, onChanged, onEdit }) => {
  const { profile, role, can, isImpersonating } = useAuth();
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);
  const isBoss = ['Supervisor', 'Admin'].includes(role?.name);
  // โหมดจำลองมุมมอง: ตัดสิทธิ์ "คนสร้างการ์ด" ออกด้วย — ให้เห็นเหมือนตำแหน่งที่จำลองจริงๆ
  const isCreator = !isImpersonating && initialCard?.created_by?.id === profile?.id;

  const [card, setCard] = useState(initialCard);
  const [items, setItems] = useState([]);
  const [comments, setComments] = useState([]);
  const [prepSummary, setPrepSummary] = useState(null); // { total, ready, assembled, list }
  const [refInfo, setRefInfo] = useState(null); // ข้อมูลลูกค้า/รุ่นรถ/หมายเหตุ จากออเดอร์หรืองานซ่อมที่ผูก
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  // เพิ่มเช็คลิสต์ / ขอของ
  const [newTask, setNewTask] = useState('');
  const [newMat, setNewMat] = useState('');

  // คอมเมนต์
  const [commentBody, setCommentBody] = useState('');
  const [commentFiles, setCommentFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // คอมเมนต์แม่ที่กำลังตอบกลับ
  const [detailTab, setDetailTab] = useState('work'); // work | parts — แท็บในการ์ด
  const fileRef = useRef(null);
  const seenMarked = useRef(false);
  const syncingRef = useRef(false); // กันดึงของพร้อมเข้าการ์ดซ้ำตอน effect รันแข่งกัน

  const prepItemTable = card.ref_type === 'service' ? 'service_prep_items' : 'order_prep_items';

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: its }, { data: cms }] = await Promise.all([
      supabase.from('work_cards').select('*').eq('id', card.id).single(),
      supabase.from('work_card_items').select('*').eq('card_id', card.id).order('sort_order').order('created_at'),
      supabase.from('work_card_comments').select('*').eq('card_id', card.id).order('created_at'),
    ]);
    if (c) setCard(c);
    setItems(its || []);
    setComments(cms || []);
    setLoading(false);
  }, [card.id]);

  useEffect(() => { load(); }, [load]);

  // สรุปสถานะของ (เตรียม/ประกอบ) ของงานที่ผูก — เรียกซ้ำได้หลังอัปเดตเตรียมของ
  const loadPrepInfo = useCallback(async () => {
    if (!card.ref_type || !card.ref_id) return;
    const prepTable = card.ref_type === 'service' ? 'service_preps' : 'order_preps';
    const refCol = card.ref_type === 'service' ? 'service_id' : 'order_id';
    const { data: p } = await supabase.from(prepTable).select('id').eq(refCol, card.ref_id).maybeSingle();
    if (!p) return;
    const { data: its } = await supabase.from(prepItemTable)
      .select('id, title, status, kind, parent_item_id, assembled_at, source, stock_product_id, stock_deducted, stock_deducted_qty, stock_pick, qty, unit_price, no_assemble')
      .eq('prep_id', p.id).order('sort_order');
    const all = its || [];
    const hasChild = (xid) => all.some((y) => y.parent_item_id === xid);
    const leaves = all.filter((x) => (x.kind !== 'product' || !hasChild(x.id)) && x.status !== 'skipped');
    // ชื่อสินค้าที่ผูกไว้ (โชว์บนปุ่มเลือกสินค้า)
    try {
      const pids = [...new Set(leaves.map((x) => x.stock_product_id).filter(Boolean))];
      if (pids.length) {
        const { data: prods } = await supabase.from('products').select('id, name').in('id', pids);
        const nameById = {}; (prods || []).forEach((pr) => { nameById[pr.id] = pr.name; });
        leaves.forEach((x) => { x._productName = x.stock_product_id ? nameById[x.stock_product_id] || null : null; });
      }
    } catch { /* ignore */ }
    setPrepSummary({
      total: leaves.length,
      ready: leaves.filter((x) => x.status === 'done').length,
      assembled: leaves.filter((x) => x.assembled_at).length,
      assembleTotal: leaves.filter((x) => !x.no_assemble).length, // ฐานนับประกอบ: ไม่รวมของเตรียมให้เฉยๆ
      notReady: leaves.filter((x) => x.status !== 'done').map((x) => x.title),
      list: leaves, // รายการเต็ม ให้ทีมช่างกดดูได้ว่าชิ้นไหนเตรียมแล้ว/ยังไม่พร้อม/ประกอบแล้ว
    });

    // ของที่เตรียมเสร็จแล้ว (ยังไม่ประกอบ ยังไม่อยู่ในการ์ดไหนเลย ไม่ใช่ของเตรียมให้เฉยๆ) → ขึ้นเป็นงานประกอบอัตโนมัติ
    // กันซ้ำ 2 ชั้น: syncingRef กันรันแข่งกัน + DB unique constraint กันซ้ำถาวร (upsert ignoreDuplicates)
    try {
      if (!card.archived_at && card.status !== 'done' && !syncingRef.current) {
        syncingRef.current = true;
        const readyLeaves = leaves.filter((x) => x.status === 'done' && !x.assembled_at && !x.no_assemble);
        if (readyLeaves.length) {
          const ids = readyLeaves.map((x) => x.id);
          const { data: linked } = await supabase.from('work_card_items').select('prep_item_id').in('prep_item_id', ids);
          const used = new Set((linked || []).map((r) => r.prep_item_id));
          const fresh = readyLeaves.filter((x) => !used.has(x.id));
          if (fresh.length) {
            await supabase.from('work_card_items').upsert(fresh.map((x, i) => ({
              card_id: card.id, title: x.title, kind: 'part', prep_item_id: x.id, sort_order: 250 + i,
              added_by: { name: 'อัตโนมัติ — ของพร้อมแล้ว' },
            })), { onConflict: 'prep_item_id', ignoreDuplicates: true });
            // ดึงรายการจริงจาก DB มาแสดง (ไม่ต่อท้ายเอง กันโชว์ซ้ำ)
            const { data: its2 } = await supabase.from('work_card_items').select('*')
              .eq('card_id', card.id).order('sort_order').order('created_at');
            if (its2) setItems(its2);
          }
        }
        syncingRef.current = false;
      }
    } catch { syncingRef.current = false; /* ไม่ให้กระทบการแสดงผลหลัก */ }
  }, [card.ref_type, card.ref_id, card.status, card.archived_at, card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadPrepInfo(); }, [loadPrepInfo, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ข้อมูลเพิ่มเติมของงานที่ผูก: ลูกค้า + รุ่นรถ/อาการ + หมายเหตุตอนซื้อ
  useEffect(() => {
    if (!card.ref_type || !card.ref_id) { setRefInfo(null); return; }
    (async () => {
      try {
        const toUrls = (arr) => (arr || []).map((v) => (typeof v === 'string' ? v : v?.url)).filter(Boolean);
        if (card.ref_type === 'service') {
          const { data } = await supabase.from('services')
            .select('customer_cache, notes, images, service_items(description)').eq('id', card.ref_id).maybeSingle();
          if (data) setRefInfo({ type: 'service', customer: data.customer_cache, notes: data.notes, images: toUrls(data.images), items: (data.service_items || []).map((x) => x.description).filter(Boolean) });
        } else {
          const { data } = await supabase.from('orders')
            .select('customer_cache, notes, images, order_items(product_name, quantity)').eq('id', card.ref_id).maybeSingle();
          if (data) setRefInfo({ type: 'order', customer: data.customer_cache, notes: data.notes, images: toUrls(data.images), items: (data.order_items || []).map((x) => `${x.product_name}${x.quantity > 1 ? ` ×${x.quantity}` : ''}`).filter(Boolean) });
        }
      } catch { /* ignore */ }
    })();
  }, [card.ref_type, card.ref_id]);

  // เปิดการ์ดแล้ว = เห็นแล้ว (บันทึกครั้งเดียวต่อการเปิด)
  useEffect(() => {
    if (loading || seenMarked.current || !profile?.id) return;
    seenMarked.current = true;
    const me = meRef();
    const next = { ...(card.seen_by || {}), [profile.id]: { name: me?.name || '-', at: new Date().toISOString() } };
    setCard((prev) => ({ ...prev, seen_by: next }));
    supabase.from('work_cards').update({ seen_by: next }).eq('id', card.id).then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const notifyPeople = (title, body = null) =>
    notifyUsers({ userIds: cardPeople(card), title, body, linkId: card.id, actorId: profile?.id });

  // เก็บ Log ทุกการกระทำในการ์ด — โชว์ในส่วน "ประวัติการทำงาน" ท้ายการ์ด
  const logCard = (action, label) =>
    logAction({ resource_type: 'assembly', resource_id: card.id, action, resource_label: label, created_by: meRef() });

  // เช็คว่าชิ้นส่วนทั้งหมดของงานที่ผูก (ทุกรอบรวมกัน) ประกอบครบหรือยัง
  const checkAllAssembled = async () => {
    if (!card.ref_type || !card.ref_id) return false;
    try {
      const prepTable = card.ref_type === 'service' ? 'service_preps' : 'order_preps';
      const refCol = card.ref_type === 'service' ? 'service_id' : 'order_id';
      const { data: p } = await supabase.from(prepTable).select('id').eq(refCol, card.ref_id).maybeSingle();
      if (!p) return false;
      const { data: its } = await supabase.from(prepItemTable)
        .select('id, kind, status, parent_item_id, assembled_at, no_assemble').eq('prep_id', p.id);
      const all = its || [];
      const hasChild = (xid) => all.some((y) => y.parent_item_id === xid);
      const leaves = all.filter((x) => (x.kind !== 'product' || !hasChild(x.id)) && x.status !== 'skipped');
      // ของเตรียมให้เฉยๆ (no_assemble) ไม่ต้องรอติ๊กประกอบ — ถือว่าครบถ้าเหลือแค่พวกนั้น
      return leaves.length > 0 && leaves.every((x) => x.assembled_at || x.no_assemble);
    } catch { return false; }
  };

  // ── อัปเดตสถานะเตรียมของจากการ์ดนี้ได้เลย (เฉพาะคนมีสิทธิ์เตรียมของ) ──
  // ข้อมูลชุดเดียวกับหน้าออเดอร์/งานซ่อม อัปเดตที่ไหนก็เห็นเหมือนกันทั้งสองที่
  const canPrep = can('assembly', 'prepare');
  const [prepBusy, setPrepBusy] = useState(null);
  const [prepEditMode, setPrepEditMode] = useState(false); // เริ่มดูอย่างเดียว — กด "แก้ไข" ค่อยโชว์เมนูอัปเดต
  const refType_ = card.ref_type === 'service' ? 'service_prep' : 'order_prep';

  // เลือกสินค้าจากสต๊อก + เปลี่ยนที่หยิบ (เหมือนหน้าเตรียมของ)
  const [prepPickerFor, setPrepPickerFor] = useState(null);
  const [prepSearch, setPrepSearch] = useState('');
  const [prepResults, setPrepResults] = useState([]);
  const [prepRepickFor, setPrepRepickFor] = useState(null);
  const [prepRepickOptions, setPrepRepickOptions] = useState([]);

  // ค้นหาสินค้า พร้อมบอกยอดคงเหลือ + เก็บอยู่ที่ไหนบ้าง
  useEffect(() => {
    if (!prepPickerFor) return;
    const t = setTimeout(async () => {
      let q = supabase.from('products').select('id, name, sku, cost_price').limit(12);
      q = prepSearch.trim() ? q.ilike('name', `%${prepSearch}%`) : q.order('created_at', { ascending: false });
      const { data } = await q;
      const products = data || [];
      try {
        const ids = products.map((p) => p.id);
        if (ids.length) {
          const [{ data: st }, { data: locs }, { data: strs }] = await Promise.all([
            supabase.from('stock_items').select('product_id, quantity, location_id').in('product_id', ids).gt('quantity', 0),
            supabase.from('storage_locations').select('id, code, store_id'),
            supabase.from('stores').select('id, name'),
          ]);
          const storeById = {}; (strs || []).forEach((s) => { storeById[s.id] = s.name; });
          const locById = {}; (locs || []).forEach((l) => { locById[l.id] = `${storeById[l.store_id] || ''} ${l.code}`.trim(); });
          const by = {};
          (st || []).forEach((r) => {
            const cur = (by[r.product_id] = by[r.product_id] || { total: 0, places: {} });
            const qy = Number(r.quantity) || 0; cur.total += qy;
            const label = r.location_id ? (locById[r.location_id] || 'ไม่ทราบที่เก็บ') : 'รอจัดเก็บ';
            cur.places[label] = (cur.places[label] || 0) + qy;
          });
          products.forEach((p) => { p._stock = by[p.id] || null; });
        }
      } catch { /* ignore */ }
      setPrepResults(products);
    }, 250);
    return () => clearTimeout(t);
  }, [prepSearch, prepPickerFor]);

  const patchPrepItem = async (id, patch) => {
    await supabase.from(prepItemTable).update(patch).eq('id', id);
    await loadPrepInfo();
  };

  // วนที่มา: — เลือกที่มา — → สั่งซื้อเพิ่ม → ดึงจากสต๊อก (เข้าสต๊อกแล้วเปิดหน้าค้นสินค้าให้เลย)
  const cyclePrepSource = async (it) => {
    const ns = nextSource(it.source);
    const patch = ns === 'stock' ? { source: 'stock' } : { source: ns, stock_product_id: null };
    if (it.stock_deducted && it.stock_product_id && ns !== 'stock') {
      try { await prepReturn(it); patch.stock_deducted = false; patch.stock_deducted_qty = null; patch.stock_pick = null; }
      catch (err) { alert('คืนสต๊อกไม่สำเร็จ: ' + err.message); }
    }
    await patchPrepItem(it.id, patch);
    if (ns === 'stock') { setPrepPickerFor(it.id); setPrepSearch(''); setPrepResults([]); }
  };

  // ผูกสินค้าจากสต๊อก — ถ้ารายการติ๊กเตรียมแล้วอยู่ก่อน ตัดสต๊อกทันที
  const selectPrepStock = async (product) => {
    const it = (prepSummary?.list || []).find((x) => x.id === prepPickerFor);
    setPrepPickerFor(null); setPrepSearch(''); setPrepResults([]);
    if (!it) return;
    const patch = { source: 'stock', stock_product_id: product.id, unit_price: Number(product.cost_price) || 0 };
    if (it.status === 'done') {
      try {
        if (it.stock_deducted && it.stock_product_id && it.stock_product_id !== product.id) await prepReturn(it);
        if (!it.stock_deducted || it.stock_product_id !== product.id) {
          const { qty, pickText } = await prepDeduct({ ...it, ...patch });
          patch.stock_deducted = true; patch.stock_deducted_qty = qty; patch.stock_pick = pickText;
          if (pickText) alert(`ตัดสต๊อกแล้ว — ไปหยิบที่: ${pickText}`);
        }
      } catch (err) { alert('ตัดสต๊อกไม่สำเร็จ: ' + err.message); }
    }
    await patchPrepItem(it.id, patch);
    logCard('item_change', `ผูกสินค้า: ${it.title} ← ${product.name}`);
  };

  // เปลี่ยนที่หยิบเอง: คืนของที่ตัดไว้ แล้วตัดใหม่เฉพาะที่เก็บที่เลือก
  const openPrepRepick = async (it) => {
    setPrepRepickFor(it.id); setPrepRepickOptions([]);
    try {
      const { data } = await supabase.from('stock_items')
        .select('quantity, location_id').eq('product_id', it.stock_product_id).gt('quantity', 0);
      const locIds = [...new Set((data || []).map((r) => r.location_id).filter(Boolean))];
      const [{ data: locs }, { data: strs }] = await Promise.all([
        locIds.length ? supabase.from('storage_locations').select('id, code, store_id').in('id', locIds) : Promise.resolve({ data: [] }),
        supabase.from('stores').select('id, name'),
      ]);
      const storeById = {}; (strs || []).forEach((st) => { storeById[st.id] = st.name; });
      setPrepRepickOptions((data || []).map((r) => {
        const l = (locs || []).find((x) => x.id === r.location_id);
        return {
          locationId: r.location_id, qty: r.quantity,
          label: r.location_id ? (l ? `${storeById[l.store_id] || ''} ${l.code}`.trim() : 'ไม่ทราบที่เก็บ') : 'รอจัดเก็บ',
        };
      }));
    } catch { /* โหลดตัวเลือกไม่ได้ */ }
  };
  // ย้อนชิ้นที่ "ประกอบแล้ว" กลับเป็นรอประกอบ (เช่น ติ๊กเทสต์/ติ๊กผิด) — งานจะเด้งกลับเข้าเช็คลิสต์ช่างเอง
  const revertAssembled = async (x) => {
    if (!confirm(`ย้อน "${x.title}" กลับเป็นรอประกอบ? งานนี้จะกลับเข้าเช็คลิสต์ช่างอีกครั้ง`)) return;
    await supabase.from(prepItemTable).update({ assembled_at: null, assembled_by: null }).eq('id', x.id);
    await supabase.from('work_card_items').update({ done: false, done_by: null, done_at: null }).eq('prep_item_id', x.id);
    await refreshCardItems();
    logCard('item_change', `ย้อนเป็นรอประกอบ: ${x.title}`);
    await loadPrepInfo();
  };

  const prepRepickFrom = async (it, locationId) => {
    setPrepRepickFor(null);
    try {
      await prepReturn(it); // คืนของที่ตัดไว้ก่อน
      const { qty, pickText } = await prepDeduct(it, locationId);
      await patchPrepItem(it.id, { stock_deducted: true, stock_deducted_qty: qty, stock_pick: pickText });
      if (pickText) alert(`เปลี่ยนที่หยิบแล้ว — ไปหยิบที่: ${pickText}`);
    } catch (err) { alert('เปลี่ยนที่หยิบไม่สำเร็จ: ' + err.message); }
  };

  const prepDeduct = async (it, locationId = undefined) => {
    const qty = Math.max(1, Math.trunc(Number(it.qty) || 1));
    const { data: tx } = await supabase.from('stock_transactions').insert([{
      product_id: it.stock_product_id, transaction_type: 'stock_out', quantity: qty,
      note: `เบิกเตรียมของ: ${it.title} (${card.ref_label || ''})`, reference_type: refType_, created_by: profile?.id || null,
    }]).select('id').single();
    const result = await allocateFifoStockOut({
      productId: it.stock_product_id, quantity: qty, referenceType: refType_,
      ...(locationId !== undefined ? { locationId } : {}), // เลือกที่หยิบเอง = ตัดเฉพาะจุดนั้น
      stockTransactionId: tx?.id || null, profileId: profile?.id || null, syncSummary: true,
    });
    if (tx?.id && result?.totalCost > 0) {
      await supabase.from('stock_transactions').update({ unit_cost_thb: result.weightedUnitCost, total_cost_thb: result.totalCost }).eq('id', tx.id);
    }
    if (result?.missingQty > 0) alert(`หมายเหตุ: สต๊อกมีไม่พอ ตัดได้ ${qty - result.missingQty} จาก ${qty} ชิ้น`);
    // ใบสั่งหยิบ: บอกว่าระบบตัดจากที่เก็บ/ล็อตไหน
    let pickText = null;
    try {
      const allocs = result?.allocations || [];
      if (allocs.length) {
        const lotIds = [...new Set(allocs.map((a) => a.stock_lot_id).filter(Boolean))];
        const locIds = [...new Set(allocs.map((a) => a.location_id).filter(Boolean))];
        const [{ data: lots }, { data: locs }, { data: strs }] = await Promise.all([
          lotIds.length ? supabase.from('stock_lots').select('id, lot_code').in('id', lotIds) : Promise.resolve({ data: [] }),
          locIds.length ? supabase.from('storage_locations').select('id, code, store_id').in('id', locIds) : Promise.resolve({ data: [] }),
          supabase.from('stores').select('id, name'),
        ]);
        const lotById = {}; (lots || []).forEach((l) => { lotById[l.id] = l.lot_code; });
        const storeById = {}; (strs || []).forEach((st) => { storeById[st.id] = st.name; });
        const locById = {}; (locs || []).forEach((l) => { locById[l.id] = `${storeById[l.store_id] || ''} ${l.code}`.trim(); });
        pickText = allocs.map((a) =>
          `${a.location_id ? (locById[a.location_id] || 'ไม่ทราบที่เก็บ') : 'รอจัดเก็บ'} ×${a.quantity}${lotById[a.stock_lot_id] ? ` · ล็อต ${lotById[a.stock_lot_id]}` : ''}`
        ).join(', ');
      }
    } catch { /* สร้างใบสั่งหยิบไม่ได้ก็ตัดปกติ */ }
    return { qty, pickText };
  };

  const prepReturn = async (it) => {
    const backQty = Math.max(1, Math.trunc(Number(it.stock_deducted_qty ?? it.qty) || 1));
    await createStockLot({
      productId: it.stock_product_id, quantity: backQty, unitCostThb: Number(it.unit_price) || 0,
      sourceType: 'return', note: `คืนของจากเตรียมของ: ${it.title} (${card.ref_label || ''})`,
      profileId: profile?.id || null, syncSummary: true,
    });
    await supabase.from('stock_transactions').insert([{
      product_id: it.stock_product_id, transaction_type: 'stock_in', quantity: backQty,
      note: `คืนของจากเตรียมของ: ${it.title} (${card.ref_label || ''})`, reference_type: refType_, created_by: profile?.id || null,
    }]);
  };

  const refreshCardItems = async () => {
    const { data: its2 } = await supabase.from('work_card_items').select('*').eq('card_id', card.id).order('sort_order').order('created_at');
    if (its2) setItems(its2);
  };

  // ติ๊กเตรียมแล้ว / ย้อนกลับ — ตัด/คืนสต๊อกอัตโนมัติเหมือนหน้าเตรียมของทุกอย่าง
  const prepToggle = async (it) => {
    if (prepBusy) return;
    setPrepBusy(it.id);
    try {
      const linked = it.source === 'stock' && it.stock_product_id;
      if (it.status !== 'done') {
        const patch = { status: 'done', prepared_by: meRef(), prepared_at: new Date().toISOString() };
        if (linked && !it.stock_deducted) {
          try {
            const { qty, pickText } = await prepDeduct(it);
            patch.stock_deducted = true; patch.stock_deducted_qty = qty; patch.stock_pick = pickText;
            if (pickText) alert(`ตัดสต๊อกแล้ว — ไปหยิบที่: ${pickText}`);
          } catch (err) { alert('ตัดสต๊อกไม่สำเร็จ: ' + err.message); }
        }
        await supabase.from(prepItemTable).update(patch).eq('id', it.id);
        logCard('item_change', `เตรียมของแล้ว: ${it.title}`);
      } else {
        if (it.assembled_at) { alert('ชิ้นนี้ถูกติ๊กประกอบไปแล้ว — ยกเลิกติ๊กประกอบก่อนถึงจะย้อนได้'); return; }
        const patch = { status: 'pending', prepared_by: null, prepared_at: null };
        if (linked && it.stock_deducted) {
          try { await prepReturn(it); patch.stock_deducted = false; patch.stock_deducted_qty = null; patch.stock_pick = null; }
          catch (err) { alert('คืนสต๊อกไม่สำเร็จ: ' + err.message); }
        }
        await supabase.from(prepItemTable).update(patch).eq('id', it.id);
        // ของไม่พร้อมแล้ว → เอาออกจากเช็คลิสต์ประกอบ (เฉพาะที่ยังไม่ถูกติ๊ก)
        await supabase.from('work_card_items').delete().eq('prep_item_id', it.id).eq('done', false);
        await refreshCardItems();
        logCard('item_change', `ย้อนเตรียมของ: ${it.title}`);
      }
    } finally {
      setPrepBusy(null);
      await loadPrepInfo();
    }
  };

  // ของที่ต้องเตรียมแต่ไม่ต้องติ๊กประกอบ (เช่น ลูกปืนทยอยใส่หลายจุด)
  const toggleNoAssemble = async (it) => {
    const next = !it.no_assemble;
    await supabase.from(prepItemTable).update({ no_assemble: next }).eq('id', it.id);
    if (next) {
      await supabase.from('work_card_items').delete().eq('prep_item_id', it.id).eq('done', false);
      await refreshCardItems();
    }
    logCard('item_change', next ? `ตั้งเป็นของเตรียมให้ ไม่ต้องติ๊กประกอบ: ${it.title}` : `กลับมาให้ติ๊กประกอบ: ${it.title}`);
    await loadPrepInfo();
  };

  // ── สถานะการ์ด ──
  // opts.polish: true = ขอเก็บงานเพิ่ม (นับรอบเก็บงาน+แจ้งช่าง), false = แค่ย้อนคืนติ๊กผิด
  const setStatus = async (s, opts = {}) => {
    const wasDone = card.status === 'done';
    const isPolish = wasDone && s !== 'done' && Boolean(opts.polish ?? (profile?.id !== card.done_by?.id));
    const patch = { status: s, updated_at: new Date().toISOString() };
    if (s === 'done') { patch.done_at = new Date().toISOString(); patch.done_by = meRef(); }
    else { patch.done_at = null; patch.done_by = null; }
    if (isPolish) patch.rework_count = (card.rework_count || 0) + 1;
    setCard((prev) => ({ ...prev, ...patch }));
    await supabase.from('work_cards').update(patch).eq('id', card.id);
    logCard('stage_change', s === 'done' ? `ปิดงาน: ${card.title}` : isPolish ? `ขอเก็บรายละเอียดเพิ่ม: ${card.title}` : `ย้อนกลับมาทำต่อ: ${card.title}`);
    if (s === 'done') {
      await notifyPeople(`งานเสร็จแล้ว: ${card.title}`, `ปิดงานโดย ${meRef()?.name || ''}`);
      // ปิดรอบนี้แล้วชิ้นส่วนของออเดอร์/งานซ่อมประกอบครบทุกชิ้น → แจ้งทีมให้ไปอัปเดตสถานะงานหลักต่อ
      if (await checkAllAssembled()) {
        await notifyPeople(`🎉 ${card.ref_label || 'งานที่ผูก'} ประกอบครบทุกชิ้นแล้ว`, 'ทุกชิ้นส่วนในเช็คลิสต์ถูกประกอบครบ — ไปตรวจงานและอัปเดตสถานะออเดอร์/งานซ่อมได้เลย');
      }
    } else if (isPolish) {
      // สื่อสารเชิงบวก: ใกล้เสร็จแล้ว เหลือเก็บรายละเอียดอีกนิด
      await notifyPeople(`✨ ใกล้เสร็จแล้ว! ขอเก็บรายละเอียดเพิ่มอีกนิด: ${card.title}`, `จาก ${meRef()?.name || ''} — เปิดการ์ดดูคอมเมนต์ว่ามีจุดไหนให้เก็บเพิ่ม`);
    }
    onChanged();
    // ปิดการ์ดให้เห็นเลยว่าบอร์ดเปลี่ยน (ยกเว้นย้อนคืนติ๊กผิด — ทำงานต่อในการ์ดได้เลย)
    if (s === 'done' || isPolish) onClose();
  };

  // ── เช็คลิสต์ ──
  const toggleItem = async (it) => {
    const done = !it.done;
    const patch = { done, done_by: done ? meRef() : null, done_at: done ? new Date().toISOString() : null };
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    await supabase.from('work_card_items').update(patch).eq('id', it.id);
    logCard(done ? 'check' : 'uncheck', it.title); // สีเขียว/แดงแยกกันใน Log
    // ชิ้นส่วนรถ → บันทึก "ประกอบแล้ว" ลงตัวชิ้นในออเดอร์/งานซ่อมด้วย
    if (it.kind === 'part' && it.prep_item_id) {
      await supabase.from(prepItemTable)
        .update({ assembled_at: done ? new Date().toISOString() : null, assembled_by: done ? meRef() : null })
        .eq('id', it.prep_item_id);
    }
    // เช็คลิสต์งาน (ไม่นับของที่ขอ) ครบ 100% → แจ้งคนสร้าง
    if (done) {
      const rest = items.filter((x) => x.kind !== 'material' && x.id !== it.id);
      if (rest.length > 0 && rest.every((x) => x.done)) {
        await notifyUsers({ userIds: [card.created_by?.id], title: `เช็คลิสต์ครบแล้ว: ${card.title}`, linkId: card.id, actorId: profile?.id });
      }
    }
  };

  const addItem = async (kind, title, extra = {}) => {
    if (!title.trim()) return;
    const { data, error } = await supabase.from('work_card_items').insert({
      card_id: card.id, title: title.trim(), kind, added_by: meRef(), sort_order: 500, ...extra,
    }).select().single();
    if (!error && data) setItems((prev) => [...prev, data]);
    return data;
  };

  const addTask = async () => {
    if (newTask.trim()) logCard('item_change', `เพิ่มงาน: ${newTask.trim()}`);
    await addItem('task', newTask); setNewTask('');
  };

  const addMaterial = async () => {
    if (!newMat.trim()) return;
    logCard('material_request', newMat.trim());
    await addItem('material', newMat);
    await notifyUsers({ userIds: cardPeople(card), title: `ขอของเพิ่ม: ${newMat.trim()} (${card.title})`, linkId: card.id, actorId: profile?.id });
    setNewMat('');
  };

  // ลบรายการ: ถามยืนยันก่อน + กู้คืนได้ด้วยปุ่ม "เลิกทำ" (กันเผลอกดแล้วหายถาวร)
  const [undoDel, setUndoDel] = useState(null); // รายการล่าสุดที่เพิ่งลบ
  const deleteItem = async (it) => {
    if (!confirm(`ลบ "${it.title}" ออกจากการ์ด?`)) return;
    setItems((prev) => prev.filter((x) => x.id !== it.id));
    await supabase.from('work_card_items').delete().eq('id', it.id);
    logCard('item_change', `ลบรายการ: ${it.title}`);
    setUndoDel(it);
  };
  const undoDelete = async () => {
    const it = undoDel;
    if (!it) return;
    setUndoDel(null);
    const { error } = await supabase.from('work_card_items').insert(it); // id เดิม กลับมาครบทุกอย่าง
    if (error) { alert('กู้คืนไม่สำเร็จ: ' + error.message); return; }
    await refreshCardItems();
    logCard('item_change', `กู้คืนรายการ: ${it.title}`);
  };

  // จัดของให้ (คนมอบหมายเป็นคนติ๊ก — จะไปเบิกสต๊อกหรือซื้อมาก็จัดการนอกระบบได้เลย)
  const fulfillMaterial = async (it) => {
    const patch = { done: true, done_by: meRef(), done_at: new Date().toISOString() };
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    await supabase.from('work_card_items').update(patch).eq('id', it.id);
    logCard('material_fulfill', `${it.title}${it.qty > 1 ? ` ×${it.qty}` : ''} — ขอโดย ${it.added_by?.name || '-'}`);
    await notifyUsers({ userIds: cardPeople(card), title: `จัดของให้แล้ว: ${it.title} (${card.title})`, linkId: card.id, actorId: profile?.id });
  };

  // ติ๊กผิด → ย้อนกลับเป็น "รอจัดให้" (ไม่ส่งแจ้งเตือน — แค่แก้สถานะเงียบๆ แต่ลง Log ไว้)
  const unfulfillMaterial = async (it) => {
    const patch = { done: false, done_by: null, done_at: null };
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    await supabase.from('work_card_items').update(patch).eq('id', it.id);
    logCard('material_undo', `${it.title} — ขอโดย ${it.added_by?.name || '-'}`);
  };

  // ── รับงานกลาง ──
  const takeCard = async () => {
    const me = meRef(); if (!me) return;
    const next = [...(card.assignees || []), me];
    setCard((prev) => ({ ...prev, assignees: next }));
    await supabase.from('work_cards').update({ assignees: next, updated_at: new Date().toISOString() }).eq('id', card.id);
    logCard('update', `รับงานเข้าตัวเอง: ${card.title}`);
    await notifyUsers({ userIds: [card.created_by?.id], title: `${me.name} รับงาน: ${card.title}`, linkId: card.id, actorId: profile?.id });
    onChanged();
  };

  // ── คอมเมนต์ (ตอบกลับได้ + ไลค์ได้ เหมือนเฟซบุ๊ก) ──
  const postComment = async () => {
    if (!commentBody.trim() && commentFiles.length === 0) return;
    setPosting(true);
    try {
      const urls = [];
      for (const file of commentFiles) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `card/${card.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await supabase.storage.from('assembly').upload(path, file);
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from('assembly').getPublicUrl(path);
          urls.push(publicUrl);
        }
      }
      const { data, error } = await supabase.from('work_card_comments').insert({
        card_id: card.id, body: commentBody.trim() || null, images: urls,
        created_by: meRef(), parent_id: replyTo?.id || null,
      }).select().single();
      if (error) throw error;
      setComments((prev) => [...prev, data]);
      logCard('update', `${replyTo ? 'ตอบกลับ' : 'คอมเมนต์'}: ${(commentBody.trim() || 'แนบรูปภาพ').slice(0, 60)}`);
      setCommentBody(''); setCommentFiles([]);
      const commenterIds = comments.map((c) => c.created_by?.id);
      await notifyUsers({
        userIds: [...cardPeople(card), ...commenterIds, replyTo?.created_by?.id].filter(Boolean),
        title: replyTo ? `ตอบกลับคอมเมนต์ใน: ${card.title}` : `คอมเมนต์ใหม่ใน: ${card.title}`,
        body: commentBody.trim().slice(0, 80) || 'แนบรูปภาพ',
        linkId: card.id, actorId: profile?.id,
      });
      setReplyTo(null);
    } catch (err) { alert('โพสไม่สำเร็จ: ' + err.message); }
    finally { setPosting(false); }
  };

  // กดไลค์ / เอาไลค์ออก
  const toggleLike = async (cm) => {
    const me = meRef(); if (!me) return;
    const likes = Array.isArray(cm.likes) ? cm.likes : [];
    const liked = likes.some((l) => l.id === me.id);
    const next = liked ? likes.filter((l) => l.id !== me.id) : [...likes, me];
    setComments((prev) => prev.map((x) => (x.id === cm.id ? { ...x, likes: next } : x)));
    await supabase.from('work_card_comments').update({ likes: next }).eq('id', cm.id);
    if (!liked && cm.created_by?.id && cm.created_by.id !== me.id) {
      notifyUsers({ userIds: [cm.created_by.id], title: `👍 ${me.name} ถูกใจคอมเมนต์ของคุณ (${card.title})`, linkId: card.id, actorId: profile?.id });
    }
  };

  // ลบการ์ด: ยืนยันจริงจัง — ต้องพิมพ์คำว่า "ลบ" ก่อน
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const deleteCard = () => { setDelOpen(true); setDelText(''); };
  const confirmDeleteCard = async () => {
    if (delText.trim() !== 'ลบ') return;
    setDelOpen(false);
    // คืนสถานะ "ประกอบแล้ว" ของชิ้นส่วนในการ์ดนี้กลับเป็นรอประกอบ — ลบการ์ดเทสต์แล้วงานไม่หายจากลิสต์ช่าง
    try {
      const donePartIds = items.filter((x) => x.kind === 'part' && x.prep_item_id && x.done).map((x) => x.prep_item_id);
      if (donePartIds.length) {
        await supabase.from(prepItemTable).update({ assembled_at: null, assembled_by: null }).in('id', donePartIds);
      }
    } catch { /* ล้างไม่ได้ก็ลบการ์ดต่อ */ }
    await logAction({ resource_type: 'assembly', resource_id: card.id, action: 'delete', resource_label: card.title, created_by: meRef() });
    await supabase.from('work_cards').delete().eq('id', card.id);
    onChanged(); onClose();
  };

  const workItems = items.filter((x) => x.kind !== 'material');
  const materials = items.filter((x) => x.kind === 'material');
  const workDone = workItems.filter((x) => x.done).length;
  const matPending = materials.filter((x) => !x.done).length;
  const canManage = isBoss || isCreator;
  // คนสร้าง/หัวหน้า กดสลับไปดูมุมมองแบบคนรับงานได้ (เช็คว่าลูกทีมเห็นอะไร)
  // ⚠️ กฎสำคัญ: โหมดนี้ต้องเหมือนที่ช่าง (ไม่มีสิทธิ์จัดการ/เตรียมของ) เห็นจริงทุกอย่าง —
  //    เพิ่มปุ่ม/เมนูใหม่ที่ gate ด้วยสิทธิ์เมื่อไหร่ ต้องซ่อนในโหมดนี้ด้วยเสมอ
  const [viewAsWorker, setViewAsWorker] = useState(false);
  const manage = canManage && !viewAsWorker;
  const prepAllowed = canPrep && !viewAsWorker; // แก้ไขเตรียมของ — ตั้งค่าได้ที่ User Management → งานประกอบ → เตรียมของ

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
      {lightbox && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-full max-h-[92vh] rounded-xl object-contain" />
        </div>
      )}

      {/* ยืนยันลบการ์ด — ต้องพิมพ์ "ลบ" */}
      {delOpen && (
        <div className="fixed inset-0 z-[118] bg-black/70 flex items-center justify-center p-4" onClick={() => setDelOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3"><Trash2 size={22} className="text-red-500" /></div>
            <h3 className="font-bold text-gray-900 text-lg">ลบการ์ดงานนี้ถาวร?</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              "{card.title}"<br />
              เช็คลิสต์ คอมเมนต์ และรูปในการ์ดจะหายทั้งหมด <b className="text-red-500">กู้คืนไม่ได้</b>
              {card.ref_label ? <span className="block text-xs text-gray-400 mt-1">(ข้อมูลออเดอร์ {card.ref_label} และเช็คลิสต์เตรียมของไม่ถูกลบ)</span> : null}
            </p>
            <input autoFocus value={delText} onChange={(e) => setDelText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmDeleteCard(); }}
              placeholder='พิมพ์คำว่า "ลบ" เพื่อยืนยัน'
              className="w-full mt-3 px-4 py-3 bg-gray-50 border-2 border-gray-200 focus:border-red-400 rounded-xl outline-none text-sm text-center font-bold" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setDelOpen(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm">ยกเลิก</button>
              <button onClick={confirmDeleteCard} disabled={delText.trim() !== 'ลบ'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed">
                ลบถาวร
              </button>
            </div>
          </div>
        </div>
      )}

      {/* เลือกสินค้าจากสต๊อก — บอกยอดคงเหลือ + เก็บอยู่ที่ไหนบ้าง */}
      {prepPickerFor && (
        <div className="fixed inset-0 z-[115] bg-black/60 flex items-center justify-center p-4" onClick={() => setPrepPickerFor(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b flex items-center gap-2">
              <Package size={16} className="text-gray-400" />
              <input autoFocus value={prepSearch} onChange={(e) => setPrepSearch(e.target.value)} placeholder="ค้นหาสินค้าในสต๊อก..." className="flex-1 text-sm outline-none" />
              <button onClick={() => setPrepPickerFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {prepResults.map((p) => (
                <button key={p.id} onClick={() => selectPrepStock(p)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100">
                  <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                  <p className="text-[10px]">
                    <span className="text-gray-400 font-mono">{p.sku}</span>
                    {p._stock
                      ? <><span className="ml-2 font-bold text-emerald-600">เหลือ {p._stock.total} ชิ้น</span><span className="text-gray-400"> · {Object.entries(p._stock.places).map(([place, qty]) => `${place} ×${qty}`).join(', ')}</span></>
                      : <span className="ml-2 font-bold text-red-400">ไม่มีของในสต๊อก</span>}
                  </p>
                </button>
              ))}
              {prepResults.length === 0 && <p className="text-xs text-gray-400 text-center py-4">— พิมพ์ชื่อสินค้าเพื่อค้นหา —</p>}
            </div>
          </div>
        </div>
      )}
      <div className="bg-white w-full max-w-2xl lg:max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b bg-gray-50 rounded-t-3xl">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {card.priority === 'urgent' && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1"><Flag size={10} /> ด่วน</span>}
                {card.ref_label && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Link2 size={10} /> {card.ref_label}</span>}
                {card.rework_count > 0 && card.status === 'done' && <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">✨ เก็บงานแล้ว รอตรวจอีกครั้ง</span>}
                <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10} /> {card.status === 'done' ? `เสร็จ ${dt(card.done_at)}` : ageText(card.created_at)}</span>
                {card.due_date && card.status !== 'done' && <span className="text-[10px] text-gray-500">กำหนด {new Date(card.due_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</span>}
              </div>
              <h3 className="font-bold text-lg text-gray-900 mt-1 leading-snug">{card.title}</h3>
              {card.detail && <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-line">{linkify(card.detail)}</p>}
              {(card.images || []).length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {card.images.map((img, i) => (
                    <img key={i} src={img} onClick={() => setLightbox(img)}
                      className="w-16 h-16 rounded-xl object-cover border border-gray-200 cursor-zoom-in hover:opacity-90" />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* ตัวเลขใหญ่: งานนี้เข้ามาในระบบกี่วันแล้ว */}
              {(() => {
                const from = card.focus_date ? new Date(card.focus_date) : new Date(card.created_at);
                const days = Math.max(0, Math.floor((Date.now() - from.getTime()) / 86400000));
                const num = days < 31 ? days : days < 365 ? Math.floor(days / 30) : Math.floor(days / 365);
                const unit = days < 31 ? 'วัน' : days < 365 ? 'เดือน' : 'ปี';
                const tone = days >= 7 ? 'bg-red-50 text-red-600 border-red-200' : days >= 3 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200';
                return (
                  <span title={`${card.focus_date ? 'เข้าโฟกัสเมื่อ' : 'สร้างเมื่อ'} ${from.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} · ${days} วันแล้ว`}
                    className={`flex flex-col items-center justify-center leading-none rounded-2xl border px-3.5 py-2 mr-1.5 ${tone}`}>
                    <span className="text-2xl font-black">{days === 0 ? '•' : num}</span>
                    <span className="text-[10px] font-bold mt-0.5">{days === 0 ? 'วันนี้' : `${unit}แล้ว`}</span>
                  </span>
                );
              })()}
              {canManage && (
                <button onClick={() => { setViewAsWorker((v) => !v); setPrepEditMode(false); }}
                  className={`p-2 rounded-full transition-all ${viewAsWorker ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-200 text-gray-400'}`}
                  title={viewAsWorker ? 'กลับมุมมองคนมอบหมาย' : 'ดูแบบคนรับงาน (เช็คว่าลูกทีมเห็นอะไร)'}>
                  <Eye size={16} />
                </button>
              )}
              {manage && <button onClick={() => onEdit(card)} className="p-2 rounded-full hover:bg-gray-200 text-gray-400" title="แก้ไข"><Pencil size={16} /></button>}
              {manage && <button onClick={deleteCard} className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500" title="ลบ"><Trash2 size={16} /></button>}
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-400"><X size={20} /></button>
            </div>
          </div>

          {viewAsWorker && (
            <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
              <Eye size={13} /> กำลังดูแบบคนรับงาน — ปุ่มจัดการถูกซ่อนเหมือนที่ลูกทีมเห็น
              <button onClick={() => setViewAsWorker(false)} className="ml-auto underline shrink-0">กลับมุมมองปกติ</button>
            </div>
          )}

          {/* ผู้รับผิดชอบ / รับงาน */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {(card.assignees || []).map((a, i) => (
              <span key={i} className="text-xs font-semibold bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700">{a.name}</span>
            ))}
            {(card.assignees || []).length === 0 && <span className="text-xs text-gray-400">งานกลาง — ใครว่างรับได้เลย</span>}
            {!(card.assignees || []).some((a) => a.id === profile?.id) && card.status !== 'done' && (
              <button onClick={takeCard} className="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-full px-3 py-1 flex items-center gap-1">
                <Hand size={12} /> รับงานนี้
              </button>
            )}
          </div>

          {/* ติ๊กเสร็จอันเดียว ง่ายๆ */}
          <div className="mt-3">
            {card.status === 'done' ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold text-center shadow flex items-center justify-center gap-1.5">
                  <Check size={16} strokeWidth={3} /> งานเสร็จแล้ว {card.done_by?.name ? `· โดย ${card.done_by.name.split(' ')[0]}` : ''}
                </span>
                {card.done_by?.id === profile?.id && (
                  <button onClick={() => setStatus('todo', { polish: false })}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-3 py-2.5 rounded-xl shrink-0">
                    ติ๊กผิด? ย้อนคืน
                  </button>
                )}
                <button onClick={() => setStatus('todo', { polish: true })}
                  title="คอมเมนต์บอกจุดที่อยากให้เก็บเพิ่มก่อน แล้วค่อยกดนะ"
                  className="text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-2.5 rounded-xl shrink-0 active:scale-95">
                  ✨ ขอเก็บงานเพิ่ม
                </button>
              </div>
            ) : null}
            {/* จบงานจริง: ตรวจแล้ว ยกออกจากบอร์ด (เข้าประวัติ) — กดจากในการ์ดได้เลย */}
            {card.status === 'done' && !card.archived_at && manage ? (
              <button onClick={async () => {
                if (!confirm(`ตรวจงาน "${card.title}" เรียบร้อยแล้ว ยกออกจากบอร์ดเข้าประวัติ?`)) return;
                const patch = { archived_at: new Date().toISOString(), archived_by: meRef() };
                await supabase.from('work_cards').update(patch).eq('id', card.id);
                logCard('stage_change', `ตรวจแล้ว ยกออก: ${card.title}`);
                onChanged(); onClose();
              }}
                className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98]">
                ✓ ตรวจแล้ว — จบงาน ยกออกจากบอร์ด
              </button>
            ) : null}
            {card.status !== 'done' ? (
              <button onClick={() => setStatus('done')}
                className="w-full py-3 rounded-xl border-2 border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                <span className="w-5 h-5 rounded-md border-2 border-emerald-400 bg-white flex items-center justify-center" />
                ทำเสร็จแล้ว — ติ๊กปิดงานตรงนี้
              </button>
            ) : null}
            {/* งานรอบเก็บรายละเอียด — โชว์ชัดว่าเป็นงานเดิมที่กลับมาเก็บเพิ่ม */}
            {card.rework_count > 0 && card.status !== 'done' && (
              <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                ✨ รอบเก็บรายละเอียด #{card.rework_count} — เปิดดูคอมเมนต์ล่าสุดว่ามีจุดไหนให้เก็บเพิ่ม
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <p className="text-center text-gray-400 py-8"><Loader2 size={18} className="animate-spin inline mr-2" /> กำลังโหลด...</p>
          ) : (
            <>
            {/* แถบกู้คืนรายการที่เพิ่งลบ */}
            {undoDel && (
              <div className="flex items-center gap-2 bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm shadow-lg">
                <Trash2 size={14} className="text-gray-400 shrink-0" />
                <span className="flex-1 truncate">ลบ "{undoDel.title}" แล้ว</span>
                <button onClick={undoDelete} className="font-bold text-amber-300 hover:text-amber-200 underline shrink-0">เลิกทำ — เอาคืนมา</button>
                <button onClick={() => setUndoDel(null)} className="text-gray-400 hover:text-white shrink-0"><X size={14} /></button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* ── คอลัมน์ซ้าย: เช็คลิสต์งาน / ของสำหรับงานนี้ ── */}
              <div className="space-y-3">
              {/* แท็บ: งานที่ต้องทำ | ของสำหรับงานนี้ (เฉพาะการ์ดที่ผูกออเดอร์/งานซ่อม) */}
              {prepSummary && (
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 sticky top-0 z-10">
                  <button onClick={() => setDetailTab('work')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${detailTab === 'work' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    งานที่ต้องทำ ({workDone}/{workItems.length})
                  </button>
                  <button onClick={() => setDetailTab('parts')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${detailTab === 'parts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    <Package size={13} className={detailTab === 'parts' ? 'text-indigo-500' : ''} /> ของสำหรับงานนี้ ({prepSummary.ready}/{prepSummary.total})
                  </button>
                </div>
              )}

              {prepSummary && detailTab === 'parts' ? (
                /* ── แท็บของสำหรับงานนี้ — แยกโซนชัดเจน: เตรียมแล้ว | ยังไม่เตรียม | ประกอบแล้ว ── */
                <div className="space-y-3">
                  {/* เริ่มต้นดูอย่างเดียว — คนมีสิทธิ์เตรียมของกด "แก้ไข" ค่อยขึ้นเมนูอัปเดต */}
                  {prepAllowed && (
                    <div className="flex justify-end">
                      <button onClick={() => setPrepEditMode((v) => !v)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all active:scale-95 ${prepEditMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'}`}>
                        <Pencil size={12} /> {prepEditMode ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไข / อัปเดตการเตรียมของ'}
                      </button>
                    </div>
                  )}
                  {(() => {
                    const list = prepSummary.list || [];
                    const readyList = list.filter((x) => x.status === 'done' && !x.assembled_at);
                    const notReadyList = list.filter((x) => x.status !== 'done' && !x.assembled_at);
                    const assembledList = list.filter((x) => x.assembled_at);
                    const renderZone = (title, zi, tone) => {
                      const t = {
                        ready: { box: 'bg-emerald-50/60 border-emerald-200', head: 'text-emerald-700', dot: 'bg-emerald-500', row: 'bg-white border-emerald-100' },
                        wait: { box: 'bg-amber-50/60 border-amber-200', head: 'text-amber-700', dot: 'bg-amber-400', row: 'bg-white border-amber-100' },
                        done: { box: 'bg-indigo-50/50 border-indigo-100', head: 'text-indigo-600', dot: 'bg-indigo-400', row: 'bg-white/70 border-indigo-100' },
                      }[tone];
                      if (!zi.length) return null;
                      return (
                        <div className={`rounded-2xl border p-3 ${t.box}`}>
                          <p className={`text-xs font-bold flex items-center gap-1.5 mb-2 ${t.head}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} /> {title} ({zi.length})
                          </p>
                          <div className="space-y-1.5">
                            {zi.map((x) => {
                              const linked = x.source === 'stock' && x.stock_product_id;
                              return (
                                <div key={x.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${t.row}`}>
                                  {tone === 'wait'
                                    ? <span className="w-4 h-4 rounded-full border-2 border-amber-300 shrink-0" />
                                    : <CheckCircle2 size={16} className={`${tone === 'done' ? 'text-indigo-500' : 'text-emerald-500'} shrink-0`} />}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm ${tone === 'done' ? 'text-gray-400' : 'text-gray-800'}`}>
                                      {x.title}
                                      {x.no_assemble && <span className="ml-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full">เตรียมให้ ไม่ต้องติ๊กประกอบ</span>}
                                      {tone === 'ready' && x.source && <span className="ml-1.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{SOURCE_LABEL[x.source]}</span>}
                                    </p>
                                    {x.stock_pick && tone === 'ready' && (
                                      <p className="text-[10px] text-indigo-500 mt-0.5">
                                        หยิบที่: {x.stock_pick}
                                        {prepAllowed && prepEditMode && (
                                          <button onClick={() => (prepRepickFor === x.id ? setPrepRepickFor(null) : openPrepRepick(x))}
                                            className="ml-1.5 underline text-gray-400 hover:text-indigo-600">เปลี่ยนที่หยิบ</button>
                                        )}
                                      </p>
                                    )}
                                    {prepRepickFor === x.id && (
                                      <div className="mt-1.5 bg-white border border-indigo-100 rounded-lg p-1.5 space-y-0.5">
                                        <button onClick={() => prepRepickFrom(x, undefined)} className="w-full text-left text-[10px] font-bold px-2 py-1 rounded hover:bg-indigo-50 text-gray-600">อัตโนมัติ (FIFO ล็อตเก่าก่อน)</button>
                                        {prepRepickOptions.map((o, i) => (
                                          <button key={i} onClick={() => prepRepickFrom(x, o.locationId)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-indigo-50 text-gray-600">{o.label} · เหลือ {o.qty} ชิ้น</button>
                                        ))}
                                        {prepRepickOptions.length === 0 && <p className="text-[10px] text-gray-400 px-2 py-1">กำลังโหลดที่เก็บ...</p>}
                                      </div>
                                    )}
                                    {/* เลือกที่มาของของ + ผูกสินค้าในสต๊อก — เหมือนหน้าเตรียมของ */}
                                    {prepAllowed && prepEditMode && tone === 'wait' && (
                                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        <button onClick={() => cyclePrepSource(x)}
                                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${x.source ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-gray-400 bg-white border-gray-200 hover:bg-gray-50'}`}>
                                          {x.source ? SOURCE_LABEL[x.source] : '— เลือกที่มา —'}
                                        </button>
                                        {x.source === 'stock' && (
                                          <button onClick={() => { setPrepPickerFor(x.id); setPrepSearch(''); setPrepResults([]); }}
                                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border max-w-[150px] truncate ${x.stock_product_id ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
                                            {x.stock_product_id ? (x._productName || 'ผูกสินค้าแล้ว') : 'เลือกสินค้าในสต๊อก'}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {/* โซนประกอบแล้ว: ย้อนกลับเป็นรอประกอบได้ (แก้เคสติ๊กเทสต์/ติ๊กผิด) */}
                                  {prepAllowed && prepEditMode && tone === 'done' && (
                                    <button onClick={() => revertAssembled(x)}
                                      className="text-[11px] font-semibold text-gray-400 hover:text-indigo-600 hover:bg-gray-100 px-2 py-1.5 rounded-lg shrink-0">
                                      ย้อนเป็นรอประกอบ
                                    </button>
                                  )}
                                  {/* คนมีสิทธิ์เตรียมของ อัปเดตจากตรงนี้ได้เลย — ช่างคนอื่นเห็นสถานะอย่างเดียว */}
                                  {prepAllowed && prepEditMode && tone !== 'done' && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      {tone === 'wait' ? (
                                        <button disabled={prepBusy === x.id} onClick={() => prepToggle(x)}
                                          className="text-[11px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1.5 rounded-lg active:scale-95 disabled:opacity-50">
                                          {prepBusy === x.id ? '...' : linked ? '✓ เตรียม (ตัดสต๊อก)' : '✓ เตรียมแล้ว'}
                                        </button>
                                      ) : (
                                        <button disabled={prepBusy === x.id} onClick={() => prepToggle(x)}
                                          className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-2 py-1.5 rounded-lg disabled:opacity-50">
                                          ย้อน
                                        </button>
                                      )}
                                      <button onClick={() => toggleNoAssemble(x)}
                                        title={x.no_assemble ? 'กลับมาให้ช่างติ๊กประกอบตามปกติ' : 'ของเตรียมให้เฉยๆ ไม่ต้องให้ช่างติ๊กประกอบ (เช่น ลูกปืนที่ทยอยใส่หลายจุด)'}
                                        className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all ${x.no_assemble ? 'text-slate-600 bg-slate-200 border-slate-300' : 'text-gray-400 bg-white border-gray-200 hover:bg-gray-50'}`}>
                                        {x.no_assemble ? 'ให้ติ๊ก' : 'ไม่ติ๊ก'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    };
                    return (
                      <>
                        {renderZone('เตรียมแล้ว — ประกอบได้เลย', readyList, 'ready')}
                        {renderZone('ยังไม่เตรียม / รอของ', notReadyList, 'wait')}
                        {renderZone('ประกอบเสร็จแล้ว', assembledList, 'done')}
                        {list.length === 0 && <p className="text-xs text-gray-400 text-center py-6">งานนี้ยังไม่มีเช็คลิสต์เตรียมของ</p>}
                      </>
                    );
                  })()}
                  <p className="text-[10px] text-gray-400 text-center">ของที่เตรียมเสร็จจะขึ้นเป็นงานประกอบในแท็บ "งานที่ต้องทำ" ให้อัตโนมัติ</p>
                </div>
              ) : (
              <>
              {/* เช็คลิสต์งาน */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-gray-800 text-sm">เช็คลิสต์งาน</h4>
                  {workItems.length > 0 && <span className="text-xs font-bold text-gray-400">{workDone}/{workItems.length}</span>}
                </div>
                {workItems.length > 0 && (
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${workItems.length ? Math.round((workDone / workItems.length) * 100) : 0}%` }} />
                  </div>
                )}
                <div className="space-y-1.5">
                  {(() => {
                    // แบ่งกลุ่มสี: ชิ้นส่วนจากระบบของรถคันนี้ (ม่วง) | งานเพิ่มเติมของคันนี้ (ฟ้าอมเขียว)
                    const partItems = workItems.filter((x) => x.kind === 'part');
                    const taskItems = workItems.filter((x) => x.kind !== 'part');
                    // ฟังก์ชัน render ตรงๆ (ไม่ใช่คอมโพเนนต์) — กัน React รื้อ DOM ใหม่แล้วจอเด้งขึ้นบนตอนติ๊ก
                    const renderItem = (it, isPart) => (
                      <div key={it.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${it.done ? 'bg-emerald-50/50 border-emerald-100' : isPart ? 'bg-indigo-50/40 border-indigo-100' : 'bg-teal-50/30 border-teal-100'}`}>
                        <button onClick={() => toggleItem(it)}
                          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all active:scale-90 ${it.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white hover:border-emerald-400'}`}>
                          {it.done && <Check size={17} className="text-white" strokeWidth={3} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${it.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{it.title}</p>
                          {it.done && it.done_by
                            ? <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">✓ ติ๊กโดย {it.done_by.name} · {dt(it.done_at)}</p>
                            : it.added_by?.name && <p className="text-[10px] text-gray-400 mt-0.5">เพิ่มโดย {it.added_by.name}</p>}
                        </div>
                        {manage && !it.done && <button onClick={() => deleteItem(it)} className="text-gray-200 hover:text-red-400 p-1 shrink-0"><Trash2 size={13} /></button>}
                      </div>
                    );
                    return (
                      <>
                        {partItems.length > 0 && (
                          <>
                            <p className="text-[11px] font-bold text-indigo-600 flex items-center gap-1.5 pt-1 pb-0.5 ml-1">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" /> จากระบบของรถคันนี้ ({partItems.filter((x) => x.done).length}/{partItems.length})
                            </p>
                            {partItems.map((it) => renderItem(it, true))}
                          </>
                        )}
                        {taskItems.length > 0 && (
                          <>
                            <p className="text-[11px] font-bold text-teal-600 flex items-center gap-1.5 pt-2 pb-0.5 ml-1">
                              <span className="w-2 h-2 rounded-full bg-teal-500" /> งานเพิ่มเติมของคันนี้ ({taskItems.filter((x) => x.done).length}/{taskItems.length})
                            </p>
                            {taskItems.map((it) => renderItem(it, false))}
                          </>
                        )}
                      </>
                    );
                  })()}
                  <div className="flex gap-2">
                    <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                      placeholder="เพิ่มงานหน้างาน..." className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none border border-transparent focus:border-indigo-400 focus:bg-white" />
                    <button onClick={addTask} className="bg-gray-900 text-white px-3.5 rounded-xl shrink-0"><Plus size={16} /></button>
                  </div>
                </div>
              </div>
              </>
              )}
              </div>

              {/* ── คอลัมน์ขวา: ข้อมูลงาน + ของที่ต้องใช้เพิ่ม + พูดคุย + ประวัติ ── */}
              <div className="space-y-4">
              {/* ข้อมูลลูกค้า + รุ่นรถ/อาการ + หมายเหตุตอนซื้อ */}
              {refInfo && (() => {
                const cc = refInfo.customer || {};
                const rawImg = cc.images?.[0];
                const custImg = typeof rawImg === 'string' ? rawImg : rawImg?.url || null;
                const custName = `${cc.first_name || ''} ${cc.last_name || ''}`.trim() || '-';
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                    {/* ลูกค้า */}
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                        {custImg
                          ? <img src={custImg} onClick={() => setLightbox(custImg)} className="w-full h-full object-cover cursor-zoom-in" />
                          : <UserRound size={22} className="text-gray-300" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 truncate">{custName}{cc.nickname ? <span className="font-normal text-gray-500"> ({cc.nickname})</span> : null}</p>
                        {cc.phone && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={11} /> {cc.phone}</p>}
                      </div>
                      {card.ref_label && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-1 rounded-full shrink-0">{card.ref_label}</span>}
                    </div>
                    {/* รุ่นรถที่ซื้อ / อาการที่แจ้ง */}
                    {refInfo.items.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5 mb-1.5">
                          <Bike size={13} className="text-indigo-500" /> {refInfo.type === 'service' ? 'อาการ / งานที่แจ้งไว้' : 'รุ่นรถ / สินค้าที่ซื้อ'}
                        </p>
                        <div className="space-y-1">
                          {refInfo.items.map((t, i) => <p key={i} className="text-sm text-gray-800 leading-snug">• {t}</p>)}
                        </div>
                      </div>
                    )}
                    {/* หมายเหตุตอนลูกค้าซื้อ/แจ้งงาน */}
                    {refInfo.notes && (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5 mb-1"><StickyNote size={13} /> หมายเหตุจากตอน{refInfo.type === 'service' ? 'รับงาน' : 'ซื้อ'}</p>
                        <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{refInfo.notes}</p>
                      </div>
                    )}
                    {/* รูปที่แนบในออเดอร์/ใบงานซ่อม — กดขยายดูได้ */}
                    {(refInfo.images || []).length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5 mb-1.5">
                          <ImageIcon size={13} className="text-indigo-500" /> รูปจาก{refInfo.type === 'service' ? 'ใบงานซ่อม' : 'ออเดอร์'} ({refInfo.images.length})
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {refInfo.images.map((img, i) => (
                            <img key={i} src={img} onClick={() => setLightbox(img)}
                              className="w-full aspect-square rounded-xl object-cover border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ของที่ต้องใช้เพิ่ม */}
              <div className={`rounded-2xl p-3.5 ${matPending > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 mb-2">
                  <ShoppingCart size={15} className={matPending > 0 ? 'text-amber-600' : 'text-gray-400'} />
                  ของที่ต้องใช้เพิ่ม {matPending > 0 && <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">รอจัด {matPending}</span>}
                </h4>
                <div className="space-y-1.5">
                  {materials.map((it) => (
                    <div key={it.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${it.done ? 'bg-emerald-50/60 border-emerald-100' : 'bg-white border-amber-200'}`}>
                      {it.done && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${it.done ? 'text-gray-600' : 'text-gray-800'}`}>{it.title}{it.qty > 1 ? ` ×${it.qty}` : ''}</p>
                        <p className={`text-[10px] ${it.done ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                          {it.done
                            ? `✓ ${it.stock_pick || 'จัดให้แล้ว'} · ${it.done_by?.name || ''} · ${dt(it.done_at)}`
                            : `ขอโดย ${it.added_by?.name?.split(' ')[0] || '-'}`}
                        </p>
                      </div>
                      {/* คนมอบหมายเท่านั้นที่จัดการ — คนทำงานเห็นสถานะเฉยๆ */}
                      {!it.done && (manage ? (
                        <button onClick={() => fulfillMaterial(it)}
                          className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg shrink-0 active:scale-95">
                          จัดให้แล้ว
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full shrink-0">รอจัดให้</span>
                      ))}
                      {/* ติ๊กผิด → ย้อนกลับเป็นรอจัดให้ได้ (เฉพาะคนมีสิทธิ์จัดการ) */}
                      {manage && it.done && (
                        <button onClick={() => unfulfillMaterial(it)} title="ติ๊กผิด — ย้อนกลับเป็นรอจัดให้"
                          className="text-gray-300 hover:text-amber-600 p-1 shrink-0 active:scale-95">
                          <Undo2 size={14} />
                        </button>
                      )}
                      {manage && <button onClick={() => deleteItem(it)} title="ลบรายการนี้" className="text-gray-200 hover:text-red-400 p-1 shrink-0"><Trash2 size={13} /></button>}
                    </div>
                  ))}
                  {/* ขาดอะไรพิมพ์ขอมาได้เลย */}
                  <div className="flex gap-2 items-center">
                    <input value={newMat} onChange={(e) => setNewMat(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMaterial(); } }}
                      placeholder="ขาดอะไร พิมพ์ขอมาได้เลย เช่น น็อต M8 ×4..." className="flex-1 px-3 py-2.5 bg-white rounded-xl text-sm outline-none border border-gray-200 focus:border-amber-400" />
                    <button onClick={addMaterial} className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2.5 rounded-xl shrink-0"><Plus size={16} /></button>
                  </div>
                </div>
              </div>

              {/* คอมเมนต์ — ไลค์ได้ ตอบกลับได้ เหมือนเฟซบุ๊ก */}
              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h4 className="font-bold text-gray-800 text-sm">พูดคุย / อัปเดตงาน</h4>
                  {Object.keys(card.seen_by || {}).length > 0 && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 truncate" title={Object.values(card.seen_by || {}).map((s) => `${s.name} · ${dt(s.at)}`).join('\n')}>
                      <Eye size={11} /> เห็นแล้ว {Object.values(card.seen_by || {}).map((s) => s.name?.split(' ')[0]).join(', ')}
                    </span>
                  )}
                </div>
                <div className="space-y-2.5">
                  {comments.filter((c) => !c.parent_id).map((cm) => {
                    const replies = comments.filter((r) => r.parent_id === cm.id);
                    const renderComment = (c, isReply) => {
                      const likes = Array.isArray(c.likes) ? c.likes : [];
                      const iLiked = likes.some((l) => l.id === profile?.id);
                      const imgs = c.images || [];
                      return (
                        <div key={c.id} className={`${isReply ? 'bg-white border border-gray-100' : 'bg-gray-50'} rounded-2xl p-3`}>
                          <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {c.created_by?.name?.[0] || '?'}
                            </span>
                            <span className="font-bold text-gray-600">{c.created_by?.name || '-'}</span>
                            <span>{dt(c.created_at)}</span>
                          </div>
                          {c.body && <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{linkify(c.body)}</p>}
                          {imgs.length === 1 && (
                            <img src={imgs[0]} onClick={() => setLightbox(imgs[0])}
                              className="mt-2 rounded-xl max-h-56 w-auto max-w-full object-cover border border-gray-200 cursor-zoom-in hover:opacity-95" />
                          )}
                          {imgs.length > 1 && (
                            <div className="flex gap-2 flex-wrap mt-2">
                              {imgs.map((img, i) => (
                                <img key={i} src={img} onClick={() => setLightbox(img)}
                                  className="w-24 h-24 rounded-xl object-cover border border-gray-200 cursor-zoom-in hover:opacity-90" />
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <button onClick={() => toggleLike(c)}
                              className={`text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg transition-all active:scale-95 ${iLiked ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-500 hover:bg-gray-100'}`}>
                              <ThumbsUp size={12} className={iLiked ? 'fill-indigo-600' : ''} /> ถูกใจ{likes.length > 0 ? ` ${likes.length}` : ''}
                            </button>
                            {!isReply && (
                              <button onClick={() => setReplyTo(c)}
                                className="text-[11px] font-bold text-gray-400 hover:text-indigo-500 hover:bg-gray-100 flex items-center gap-1 px-2 py-1 rounded-lg">
                                <CornerDownRight size={12} /> ตอบกลับ
                              </button>
                            )}
                            {likes.length > 0 && (
                              <span className="text-[10px] text-gray-400 truncate">👍 {likes.map((l) => l.name?.split(' ')[0]).join(', ')}</span>
                            )}
                          </div>
                        </div>
                      );
                    };
                    return (
                      <div key={cm.id}>
                        {renderComment(cm, false)}
                        {replies.length > 0 && (
                          <div className="ml-8 mt-1.5 space-y-1.5 border-l-2 border-gray-100 pl-3">
                            {replies.map((r) => renderComment(r, true))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {comments.length === 0 && <p className="text-xs text-gray-400 text-center py-2">ยังไม่มีการพูดคุย</p>}
                </div>

                {/* กล่องพิมพ์คอมเมนต์ — อยู่ติดกับส่วนพูดคุย */}
                <div className="mt-2.5 bg-gray-50 border border-gray-100 rounded-2xl p-2.5">
                  {replyTo && (
                    <div className="flex items-center gap-2 mb-2 text-[11px] bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5">
                      <CornerDownRight size={12} className="text-indigo-500 shrink-0" />
                      <span className="text-indigo-700 font-semibold truncate">กำลังตอบกลับ {replyTo.created_by?.name || '-'}: {String(replyTo.body || 'รูปภาพ').slice(0, 40)}</span>
                      <button onClick={() => setReplyTo(null)} className="ml-auto text-indigo-400 hover:text-indigo-600 shrink-0"><X size={13} /></button>
                    </div>
                  )}
                  {commentFiles.length > 0 && (
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {commentFiles.map((f, i) => (
                        <span key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                          <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                          <button onClick={() => setCommentFiles((prev) => prev.filter((_, j) => j !== i))}
                            className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <label className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 cursor-pointer shrink-0">
                      <ImageIcon size={18} />
                      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) setCommentFiles((prev) => [...prev, ...fs]); e.target.value = ''; }} />
                    </label>
                    <textarea rows={1} value={commentBody} onChange={(e) => { setCommentBody(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      placeholder="พิมพ์คุยกัน แนบรูป แปะลิงก์ได้..." className="flex-1 px-3.5 py-2.5 bg-white rounded-xl text-sm outline-none border border-gray-200 focus:border-indigo-400 resize-none max-h-28" />
                    <button onClick={postComment} disabled={posting || (!commentBody.trim() && commentFiles.length === 0)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shrink-0 disabled:opacity-40 active:scale-95">
                      {posting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ประวัติการทำงาน — Log ทุกการกระทำในการ์ดนี้ (ส่วนสุดท้าย) */}
              <AuditLogPanel resourceType="assembly" resourceId={card.id} title="ประวัติการทำงาน" compact />
              </div>
            </div>
            </>
          )}
        </div>

      </div>

    </div>
  );
};

export default WorkCardDetail;
