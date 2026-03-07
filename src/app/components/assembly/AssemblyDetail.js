import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Edit, Trash2, CheckCircle, XCircle, RotateCcw, X,
  ChevronRight, Loader2, Send, User, Clock, MessageCircle,
  Phone, MapPin, Image as ImageIcon, ZoomIn, UserCheck, Search, Eye,
  Package, Warehouse, Plus, PackageMinus, ChevronDown, PackagePlus, Undo2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

const STAGES = ['preparing', 'in_progress', 'qc', 'completed'];

const STAGE_CONFIG = {
  preparing:   { label: 'เตรียมของ',  bg: 'bg-amber-500',   badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',     btnCls: 'bg-amber-500 hover:bg-amber-400' },
  in_progress: { label: 'กำลังทำ',    bg: 'bg-blue-500',    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',         btnCls: 'bg-blue-500 hover:bg-blue-400' },
  qc:          { label: 'QC / ทดสอบ', bg: 'bg-purple-500',  badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',   btnCls: 'bg-purple-500 hover:bg-purple-400' },
  completed:   { label: 'เสร็จสิ้น',  bg: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',btnCls: 'bg-emerald-500 hover:bg-emerald-400' },
  cancelled:   { label: 'ยกเลิก',     bg: 'bg-slate-600',   badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',     btnCls: 'bg-slate-600' },
};

const SOCIAL_ICON = { Facebook: '📘', Line: '💬', Instagram: '📷', WhatsApp: '📱' };

const fmtTime = (iso) => !iso ? null
  : new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const fmtDate = (iso) => !iso ? null
  : new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

const cardCls = 'bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden';

const TL_EVT = {
  prepare:  { dot: 'bg-amber-500',   label: 'เตรียมของ' },
  skip:     { dot: 'bg-slate-600',   label: 'ข้ามการเตรียม' },
  start:    { dot: 'bg-slate-500',   label: 'เริ่มทำ' },
  assemble: { dot: 'bg-blue-500',    label: 'ทำเสร็จ' },
  reject:   { dot: 'bg-red-500',     label: 'ตีกลับ QC' },
  rework:   { dot: 'bg-orange-500',  label: 'แก้ไข' },
  qc_pass:  { dot: 'bg-emerald-500', label: 'QC ผ่าน' },
  stock_withdraw: { dot: 'bg-green-500', label: 'เบิกวัสดุ' },
  stock_return:   { dot: 'bg-red-400',   label: 'คืนวัสดุ' },
};

const TimelineEvent = ({ ev }) => {
  const conf = TL_EVT[ev.type] || {};
  return (
    <div className="relative">
      <div className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full ${conf.dot} ring-2 ring-slate-900`} />
      <p className="text-[11px] font-semibold text-slate-300 leading-tight truncate">
        {conf.label}: <span className="text-slate-400 font-normal">{ev.name}</span>
        {ev.type === 'reject' && <span className="text-red-400 ml-1">(ครั้งที่ {ev.round})</span>}
        {ev.type === 'rework' && <span className="text-orange-400 ml-1">(รอบ {ev.round})</span>}
      </p>
      {ev.reason && <p className="text-[10px] text-slate-500 mt-0.5 truncate">"{ev.reason}"</p>}
      <p className="text-[10px] text-slate-600 mt-0.5">
        {ev.at ? fmtTime(ev.at) : '—'}{ev.by ? ` · ${ev.by}` : ''}
      </p>
    </div>
  );
};

const TimelineWidget = ({ events }) => (
  <div className={`${cardCls} p-4`}>
    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Timeline งาน</h4>
    <div className="relative">
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-800" />
      <div className="space-y-3 pl-5">
        {events.map((ev, i) => <TimelineEvent key={i} ev={ev} />)}
      </div>
    </div>
  </div>
);

const AssemblyDetail = ({ job: initialJob, onBack, onEdit, onDelete }) => {
  const { profile, can } = useAuth();
  const [job, setJob]       = useState(initialJob);
  const [saving, setSaving] = useState(false);
  const [rejectInputs, setRejectInputs] = useState({});
  const [itemAssigneePicker, setItemAssigneePicker] = useState(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [comments, setComments]   = useState(initialJob?.comments || []);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [timelineImages, setTimelineImages] = useState([]);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [previewUser, setPreviewUser] = useState(null);
  const [showPreviewPicker, setShowPreviewPicker] = useState(false);
  const [assembleModal, setAssembleModal]   = useState(null); // null | { itemId, itemName }
  const [assembleImages, setAssembleImages] = useState([]);   // [{ url, file }]
  const [uploadingImages, setUploadingImages] = useState(false);

  // ── Stock Withdrawal ──
  const [stockWithdrawals, setStockWithdrawals] = useState([]);
  const [withdrawFormOpen, setWithdrawFormOpen] = useState(false);
  const [withdrawSaving, setWithdrawSaving] = useState(false);
  const [wProductSearch, setWProductSearch] = useState('');
  const [wProductResults, setWProductResults] = useState([]);
  const [wShowDropdown, setWShowDropdown] = useState(false);
  const [wProduct, setWProduct] = useState(null);
  const [wVariant, setWVariant] = useState(null);
  const [wVariants, setWVariants] = useState([]);
  const [wStockItems, setWStockItems] = useState([]);
  const [wStockLoading, setWStockLoading] = useState(false);
  const [wSelectedItemId, setWSelectedItemId] = useState('');
  const [wQty, setWQty] = useState(1);

  // ── Stock Return ──
  const [returningTxId, setReturningTxId] = useState(null);
  const [returnNote, setReturnNote] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);

  useEffect(() => {
    setJob(initialJob);
    setComments(initialJob?.comments || []);
  }, [initialJob]);

  // โหลด all active users สำหรับ per-item assignment
  useEffect(() => {
    supabase.from('profiles').select('id, first_name, last_name, avatar_url, roles(name)').eq('status', 'active')
      .then(({ data }) => { if (data) setAllUsers(data); });
  }, []);

  useEffect(() => {
    if (job?.ref_type && job?.ref_id) fetchTimelineImages();
  }, [job?.ref_type, job?.ref_id]);

  useEffect(() => { fetchWithdrawals(); }, [job?.id]);

  const fetchTimelineImages = async () => {
    const table = job.ref_type === 'order' ? 'order_updates' : 'service_updates';
    const fk    = job.ref_type === 'order' ? 'order_id'     : 'service_id';
    const { data } = await supabase.from(table)
      .select('images, description, created_at')
      .eq(fk, job.ref_id)
      .order('created_at', { ascending: true });
    if (data) {
      const imgs = data.flatMap(u =>
        (u.images || []).filter(Boolean).map(url => ({ url, description: u.description, created_at: u.created_at }))
      );
      setTimelineImages(imgs);
    }
  };

  const fetchWithdrawals = async () => {
    const { data } = await supabase
      .from('stock_transactions')
      .select('id, transaction_type, quantity, created_at, note, product_id, variant_id, location_id, store_id, product:product_id(name, sku), variant:variant_id(name), location:location_id(code, name, store:store_id(id, name)), creator:created_by(first_name, last_name)')
      .eq('reference_type', 'assembly')
      .eq('reference_id', job.id)
      .order('created_at', { ascending: true });
    setStockWithdrawals(data || []);
  };

  const loadWStockItems = async (product, variant) => {
    if (!product?.id) { setWStockItems([]); return; }
    setWStockLoading(true);
    let q = supabase.from('stock_items')
      .select('id, quantity, location_id, location:location_id(id, code, name, store:store_id(id, name))')
      .eq('product_id', product.id).gt('quantity', 0);
    if (variant?.id) q = q.eq('variant_id', variant.id);
    else q = q.is('variant_id', null);
    const { data } = await q;
    const items = data || [];
    setWStockItems(items);
    setWSelectedItemId(items[0]?.id || '');
    setWQty(1);
    setWStockLoading(false);
  };

  const submitReturn = async (tx) => {
    if (!returnNote.trim()) return alert('กรุณาระบุหมายเหตุการคืน');
    setReturnSaving(true);
    try {
      const customerName = job.customer_cache
        ? [job.customer_cache.first_name, job.customer_cache.last_name].filter(Boolean).join(' ')
        : null;
      const autoNote = `คืนคลัง: ${returnNote.trim()} / โปรเจ็ค "${job.title}"${customerName ? ` / ลูกค้า: ${customerName}` : ''}`;
      let q = supabase.from('stock_items').select('id, quantity').eq('product_id', tx.product_id);
      if (tx.variant_id) q = q.eq('variant_id', tx.variant_id); else q = q.is('variant_id', null);
      if (tx.location_id) q = q.eq('location_id', tx.location_id); else q = q.is('location_id', null);
      const { data: existing } = await q.maybeSingle();
      await supabase.from('stock_transactions').insert([{
        product_id: tx.product_id,
        variant_id: tx.variant_id || null,
        transaction_type: 'stock_in',
        quantity: tx.quantity,
        store_id: tx.store_id || null,
        location_id: tx.location_id || null,
        note: autoNote,
        reference_type: 'assembly',
        reference_id: job.id,
        created_by: profile?.id,
      }]);
      if (existing) {
        await supabase.from('stock_items').update({
          quantity: existing.quantity + tx.quantity,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('stock_items').insert([{
          product_id: tx.product_id,
          variant_id: tx.variant_id || null,
          location_id: tx.location_id || null,
          quantity: tx.quantity,
          created_by: profile?.id,
        }]);
      }
      setReturningTxId(null);
      setReturnNote('');
      fetchWithdrawals();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setReturnSaving(false);
    }
  };

  const resetWithdrawForm = () => {
    setWProduct(null); setWProductSearch(''); setWVariant(null);
    setWVariants([]); setWStockItems([]); setWSelectedItemId(''); setWQty(1);
    setWithdrawFormOpen(false);
  };

  const submitWithdrawal = async () => {
    if (!wProduct || !wSelectedItemId || wQty < 1) return alert('กรุณาเลือกสินค้าและที่เก็บ');
    const item = wStockItems.find(i => i.id === wSelectedItemId);
    if (!item) return;
    if (wQty > item.quantity) return alert(`สต๊อกไม่พอ — มีแค่ ${item.quantity} ชิ้น`);
    setWithdrawSaving(true);
    try {
      const customerName = job.customer_cache
        ? [job.customer_cache.first_name, job.customer_cache.last_name].filter(Boolean).join(' ')
        : null;
      const autoNote = `เบิกใช้งานโปรเจ็ค "${job.title}"${customerName ? ` / ลูกค้า: ${customerName}` : ''}`;
      await supabase.from('stock_transactions').insert([{
        product_id: wProduct.id,
        variant_id: wVariant?.id || null,
        transaction_type: 'stock_out',
        quantity: wQty,
        store_id: item.location?.store?.id || null,
        location_id: item.location_id || null,
        note: autoNote,
        reference_type: 'assembly',
        reference_id: job.id,
        created_by: profile?.id,
      }]);
      await supabase.from('stock_items').update({
        quantity: item.quantity - wQty,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      resetWithdrawForm();
      fetchWithdrawals();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setWithdrawSaving(false);
    }
  };

  const updateJobInDB = async (updates) => {
    const { data, error } = await supabase
      .from('assembly_jobs').update(updates).eq('id', job.id).select().single();
    if (error) { alert('อัพเดทไม่สำเร็จ: ' + error.message); return { data: null, error }; }
    if (data) setJob(data);
    return { data, error };
  };

  const meRef = () => profile
    ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` }
    : { id: null, name: 'Admin' };

  const isActive = job.stage !== 'completed' && job.stage !== 'cancelled';

  // ── Preview mode ──
  const effectiveUserId = previewUser?.id || profile?.id;
  const isPreviewMode = !!previewUser;
  const isItemOpenToUser = (item, uid) => {
    if (!item.item_assignees || item.item_assignees.length === 0) return true;
    return item.item_assignees.some(a => a.id === uid);
  };

  // ── Per-item assignment (multiple) ──
  const addItemAssignee = async (itemId, user) => {
    setSaving(true);
    const newItems = job.items.map(it => {
      if (it.id !== itemId) return it;
      const existing = it.item_assignees || [];
      if (existing.some(a => a.id === user.id)) return it;
      return { ...it, item_assignees: [...existing, { id: user.id, name: `${user.first_name} ${user.last_name}` }] };
    });
    await updateJobInDB({ items: newItems });
    setAssigneeSearch('');
    setSaving(false);
  };

  const removeItemAssignee = async (itemId, userId) => {
    setSaving(true);
    const newItems = job.items.map(it =>
      it.id === itemId
        ? { ...it, item_assignees: (it.item_assignees || []).filter(a => a.id !== userId) }
        : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  // ── Item Actions ──
  const markPrepared = async (itemId) => {
    setSaving(true);
    const newItems = job.items.map(it =>
      it.id === itemId ? { ...it, prepared_by: meRef(), prepared_at: new Date().toISOString() } : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  const markStarted = async (itemId) => {
    setSaving(true);
    const newItems = job.items.map(it =>
      it.id === itemId && !it.started_at
        ? { ...it, started_at: new Date().toISOString() }
        : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  const markAssembled = async (itemId, imageUrls = []) => {
    setSaving(true);
    const now = new Date().toISOString();
    const newItems = job.items.map(it =>
      it.id === itemId
        ? { ...it, assembled_by: meRef(), assembled_at: now, started_at: it.started_at || now, assembled_images: imageUrls }
        : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  const handleAssembleConfirm = async (skipImages = false) => {
    if (!assembleModal) return;
    setUploadingImages(true);
    let imageUrls = [];
    if (!skipImages && assembleImages.length > 0) {
      imageUrls = await Promise.all(assembleImages.map(async (imgObj) => {
        if (imgObj.file) {
          const ext = imgObj.file.name.split('.').pop();
          const fileName = `asm-${job.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          await supabase.storage.from('orders').upload(fileName, imgObj.file);
          const { data } = supabase.storage.from('orders').getPublicUrl(fileName);
          return data.publicUrl;
        }
        return imgObj.url;
      }));
    }
    await markAssembled(assembleModal.itemId, imageUrls);
    setUploadingImages(false);
    setAssembleModal(null);
    setAssembleImages([]);
  };

  const cancelPrepared = async (itemId) => {
    setSaving(true);
    const newItems = job.items.map(it =>
      it.id === itemId ? { ...it, prepared_by: null, prepared_at: null } : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  const cancelAssembled = async (itemId) => {
    setSaving(true);
    const newItems = job.items.map(it =>
      it.id === itemId ? { ...it, assembled_by: null, assembled_at: null, started_at: null } : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  const markSkipPrepare = async (itemId) => {
    setSaving(true);
    const newItems = job.items.map(it =>
      it.id === itemId ? { ...it, skip_prepare: true, prepared_by: null, prepared_at: null } : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  const cancelSkipPrepare = async (itemId) => {
    setSaving(true);
    const newItems = job.items.map(it =>
      it.id === itemId ? { ...it, skip_prepare: false } : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  const markQCPass = async (itemId) => {
    setSaving(true);
    const newItems = job.items.map(it =>
      it.id === itemId
        ? { ...it, qc_status: 'passed', qc_by: meRef(), qc_at: new Date().toISOString(), reject_reason: '' }
        : it
    );
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  const markQCReject = async (itemId) => {
    const reason = rejectInputs[itemId] || '';
    if (!reason.trim()) { alert('กรุณากรอกเหตุผล'); return; }
    setSaving(true);
    const newItems = job.items.map(it => {
      if (it.id !== itemId) return it;
      const history = [...(it.reject_history || []), { reason, by: meRef(), at: new Date().toISOString() }];
      return { ...it, qc_status: 'rejected', reject_reason: reason, reject_history: history, qc_by: meRef(), qc_at: new Date().toISOString() };
    });
    await updateJobInDB({ items: newItems });
    setRejectInputs(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    setSaving(false);
  };

  const resetAssembled = async (itemId) => {
    setSaving(true);
    const newItems = job.items.map(it => {
      if (it.id !== itemId) return it;
      const rework = [...(it.rework_history || []), {
        at: new Date().toISOString(),
        by: meRef(),
        round: (it.reject_history || []).length,
      }];
      return { ...it, assembled_by: null, assembled_at: null, started_at: null, qc_status: 'pending', qc_by: null, qc_at: null, reject_reason: '', rework_history: rework };
    });
    await updateJobInDB({ items: newItems });
    setSaving(false);
  };

  // ── Stage ──
  const canAdvance = () => {
    const its = job.items || [];
    if (!its.length) return true;
    switch (job.stage) {
      case 'preparing':   return its.every(i => i.prepared_at || i.skip_prepare);
      case 'in_progress': return its.every(i => i.assembled_at);
      case 'qc':          return its.every(i => i.qc_status === 'passed');
      default: return false;
    }
  };

  const advanceStage = async () => {
    const idx = STAGES.indexOf(job.stage);
    if (idx < 0 || idx >= STAGES.length - 1) return;
    const next = STAGES[idx + 1];
    setSaving(true);
    const updates = { stage: next };
    if (next === 'completed') {
      updates.completed_at = new Date().toISOString();
      try {
        if (job.ref_type === 'order' && job.ref_id)
          await supabase.from('orders').update({ status: 'Shipping' }).eq('id', job.ref_id);
        else if (job.ref_type === 'service' && job.ref_id)
          await supabase.from('services').update({ status: 'Tested' }).eq('id', job.ref_id);
      } catch (e) { console.error(e); }
    }
    await updateJobInDB(updates);
    setSaving(false);
  };

  // ── Comments ──
  const postComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);
    const comment = { id: crypto.randomUUID(), text: newComment, by: meRef(), at: new Date().toISOString() };
    const updated = [...comments, comment];
    await updateJobInDB({ comments: updated });
    setComments(updated);
    setNewComment('');
    setPostingComment(false);
  };

  if (!job) return null;

  const stageConf = STAGE_CONFIG[job.stage] || STAGE_CONFIG.preparing;
  const stageIdx  = STAGES.indexOf(job.stage);
  const items     = job.items || [];
  const assignees = job.assignees || [];

  // ── Assignee Picker (multiple) ──
  const AssigneePicker = ({ itemId }) => {
    const currentAssignees = job.items.find(it => it.id === itemId)?.item_assignees || [];
    const assignedIds = new Set(currentAssignees.map(a => a.id));
    const filtered = allUsers.filter(u =>
      !assignedIds.has(u.id) &&
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(assigneeSearch.toLowerCase())
    );
    return (
      <>
        <div className="fixed inset-0 z-30" onClick={() => { setItemAssigneePicker(null); setAssigneeSearch(''); }} />
        <div className="absolute left-0 top-7 z-40 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 w-60 animate-in fade-in zoom-in-95">
          {/* Assigned list */}
          {currentAssignees.length > 0 && (
            <div className="mb-1.5 space-y-0.5">
              {currentAssignees.map(a => (
                <div key={a.id} className="flex items-center justify-between px-2.5 py-1.5 bg-amber-500/10 rounded-lg">
                  <span className="text-xs text-amber-400 font-medium truncate">{a.name}</span>
                  <button onClick={e => { e.stopPropagation(); removeItemAssignee(itemId, a.id); }}
                    className="text-slate-600 hover:text-red-400 transition-colors ml-2 shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="border-t border-slate-700 my-1" />
            </div>
          )}
          {/* Search */}
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-2 text-slate-500" size={12} />
            <input
              className="w-full pl-7 pr-2 py-1.5 bg-slate-700 border border-slate-600 text-white placeholder:text-slate-500 rounded-lg text-xs focus:outline-none focus:border-amber-500"
              placeholder="ค้นหาช่างเพิ่ม..."
              value={assigneeSearch}
              onChange={e => setAssigneeSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {filtered.map(u => (
              <div key={u.id} onClick={() => addItemAssignee(itemId, u)}
                className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                <div className="w-7 h-7 rounded-full bg-amber-900/50 border border-amber-800/40 flex items-center justify-center text-xs text-amber-300 font-bold overflow-hidden shrink-0">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.first_name?.[0] || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-200 font-medium truncate">{u.first_name} {u.last_name}</p>
                  {u.roles?.name && <p className="text-[10px] text-slate-500">{u.roles.name}</p>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-3">
                {assigneeSearch ? 'ไม่พบรายชื่อ' : 'เพิ่มทุกคนแล้ว'}
              </p>
            )}
          </div>
        </div>
      </>
    );
  };

  // ── Prepare Cell ──
  const PrepareCell = ({ item }) => {
    const hasRolePerm = can('assembly', 'prepare');
    const notAssigned = (item.item_assignees?.length > 0) && !isItemOpenToUser(item, effectiveUserId);

    if (item.prepared_at) return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-emerald-400 font-semibold">✓ เตรียมแล้ว</span>
          {isActive && !isPreviewMode && (
            <button onClick={() => cancelPrepared(item.id)} disabled={saving}
              className="text-slate-600 hover:text-red-400 transition-colors" title="ยกเลิก">
              <X size={11} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-600 mt-0.5">{fmtTime(item.prepared_at)}</p>
        <p className="text-[10px] text-slate-600">{item.prepared_by?.name}</p>
      </div>
    );
    if (item.skip_prepare) return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-slate-500 font-semibold">– ข้ามการเตรียม</span>
          {isActive && !isPreviewMode && (
            <button onClick={() => cancelSkipPrepare(item.id)} disabled={saving}
              className="text-slate-600 hover:text-red-400 transition-colors" title="ยกเลิก">
              <X size={11} />
            </button>
          )}
        </div>
      </div>
    );
    if (!isActive) return <span className="text-slate-700 text-xs">—</span>;
    if (!hasRolePerm) return null;
    if (notAssigned) return (
      <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 border border-dashed border-slate-700 rounded-lg bg-slate-900/50">
        <span className="text-xs text-slate-500">🔒 ไม่ได้รับมอบหมาย</span>
      </div>
    );
    return (
      <div className={`space-y-1 ${isPreviewMode ? 'pointer-events-none opacity-50' : ''}`}>
        <button onClick={() => markPrepared(item.id)} disabled={saving}
          className="text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/25 px-3 py-1.5 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 w-full">
          ✓ เตรียมแล้ว
        </button>
        <button onClick={() => markSkipPrepare(item.id)} disabled={saving}
          className="text-[11px] text-slate-600 hover:text-slate-400 w-full transition-colors py-0.5">
          ข้ามการเตรียม
        </button>
      </div>
    );
  };

  // ── Assemble Cell ──
  const AssembleCell = ({ item }) => {
    const hasRolePerm = can('assembly', 'assemble');
    const notAssigned = (item.item_assignees?.length > 0) && !isItemOpenToUser(item, effectiveUserId);
    const rejected = item.qc_status === 'rejected';
    const readyToAssemble = item.prepared_at || item.skip_prepare;

    if (rejected) {
      if (!hasRolePerm || notAssigned) return null;
      return (
        <button onClick={() => resetAssembled(item.id)} disabled={saving || isPreviewMode}
          className={`text-xs bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/20 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 mx-auto transition-all ${isPreviewMode ? 'pointer-events-none opacity-50' : ''}`}>
          <RotateCcw size={11} /> ทำใหม่
        </button>
      );
    }

    if (item.assembled_at) return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-blue-400 font-semibold">✓ ทำเสร็จ</span>
          {isActive && item.qc_status !== 'passed' && !isPreviewMode && (
            <button onClick={() => cancelAssembled(item.id)} disabled={saving}
              className="text-slate-600 hover:text-red-400 transition-colors" title="ยกเลิก">
              <X size={11} />
            </button>
          )}
        </div>
        {item.started_at && <p className="text-[10px] text-slate-600 mt-0.5">เริ่ม {fmtTime(item.started_at)}</p>}
        <p className="text-[10px] text-slate-600">เสร็จ {fmtTime(item.assembled_at)}</p>
        <p className="text-[10px] text-slate-600">{item.assembled_by?.name}</p>
        {item.assembled_images?.length > 0 && (
          <div className="flex gap-1 mt-1.5 justify-center flex-wrap">
            {item.assembled_images.map((url, i) => (
              <img key={i} src={url} onClick={() => setLightboxImg(url)}
                className="w-9 h-9 object-cover rounded-lg cursor-zoom-in border border-slate-700 hover:border-amber-500/50 transition-colors" alt="" />
            ))}
          </div>
        )}
      </div>
    );

    if (!isActive) return <span className="text-slate-700 text-xs">—</span>;
    if (!readyToAssemble) return (
      <span className="text-[11px] text-slate-700 italic text-center block">รอเตรียมของก่อน</span>
    );
    if (!hasRolePerm) return null;
    if (notAssigned) return (
      <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 border border-dashed border-slate-700 rounded-lg bg-slate-900/50">
        <span className="text-xs text-slate-500">🔒 ไม่ได้รับมอบหมาย</span>
      </div>
    );

    return (
      <div className={`space-y-1.5 text-center ${isPreviewMode ? 'pointer-events-none opacity-50' : ''}`}>
        {item.started_at ? (
          <p className="text-[10px] text-slate-600">▶ {fmtTime(item.started_at)}</p>
        ) : (
          <button onClick={() => markStarted(item.id)} disabled={saving}
            className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors w-full">
            ▶ บันทึกเวลาเริ่ม
          </button>
        )}
        <button onClick={() => { setAssembleModal({ itemId: item.id, itemName: item.name }); setAssembleImages([]); }} disabled={saving}
          className="text-xs bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 w-full">
          ✓ ทำเสร็จ
        </button>
      </div>
    );
  };

  // ── QC Cell ──
  const QCCell = ({ item }) => {
    const showRI  = rejectInputs[item.id] !== undefined;
    const history = item.reject_history || [];

    if (item.qc_status === 'passed') return (
      <div className="text-center space-y-0.5">
        <span className="text-xs text-emerald-400 font-semibold block">✓ ผ่าน QC</span>
        <p className="text-[10px] text-slate-600">{item.qc_by?.name} · {fmtTime(item.qc_at)}</p>
        {history.length > 0 && (
          <p className="text-[10px] text-amber-600/80">ตีกลับ {history.length} ครั้ง</p>
        )}
      </div>
    );

    if (item.qc_status === 'rejected') return (
      <div className="space-y-1">
        {history.map((h, i) => (
          <div key={i} className="bg-red-500/8 border border-red-500/20 rounded-lg px-2 py-1.5">
            <p className="text-[10px] text-red-400 font-semibold">ตีกลับ ครั้งที่ {i + 1}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{h.reason}</p>
            <p className="text-[10px] text-slate-600">{fmtTime(h.at)} · {h.by?.name}</p>
          </div>
        ))}
      </div>
    );

    if (job.stage === 'qc' && item.assembled_at) return (
      <div className="space-y-1">
        {history.length > 0 && (
          <div className="mb-1 space-y-1">
            {history.map((h, i) => (
              <div key={i} className="bg-red-500/8 border border-red-500/20 rounded-lg px-2 py-1.5">
                <p className="text-[10px] text-red-400 font-semibold">ตีกลับ ครั้งที่ {i + 1}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{h.reason}</p>
                <p className="text-[10px] text-slate-600">{fmtTime(h.at)}</p>
              </div>
            ))}
          </div>
        )}
        {can('assembly', 'qc') && (
          <>
            <div className={`flex gap-1 justify-center ${isPreviewMode ? 'pointer-events-none opacity-50' : ''}`}>
              <button onClick={() => markQCPass(item.id)} disabled={saving}
                className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 px-2 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all">
                <CheckCircle size={11} /> ผ่าน
              </button>
              <button onClick={() => setRejectInputs(p => ({ ...p, [item.id]: p[item.id] !== undefined ? undefined : '' }))}
                className="text-xs bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 px-2 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all">
                <XCircle size={11} /> ตีกลับ
              </button>
            </div>
            {showRI && !isPreviewMode && (
              <div className="flex gap-1">
                <input className="text-xs bg-slate-800 border border-red-500/30 text-white rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:border-red-400 placeholder:text-slate-600"
                  placeholder="เหตุผล..." value={rejectInputs[item.id]}
                  onChange={e => setRejectInputs(p => ({ ...p, [item.id]: e.target.value }))}
                  autoFocus onKeyDown={e => { if (e.key === 'Enter') markQCReject(item.id); }} />
                <button onClick={() => markQCReject(item.id)}
                  className="text-xs bg-red-500 hover:bg-red-400 text-white px-2 py-1.5 rounded-lg font-semibold">ยืนยัน</button>
              </div>
            )}
          </>
        )}
      </div>
    );
    // default: ยังไม่ถึง QC แต่ถ้ามีประวัติตีกลับให้แสดงด้วย
    if (history.length > 0) return (
      <div className="space-y-1">
        {history.map((h, i) => (
          <div key={i} className="bg-red-500/8 border border-red-500/20 rounded-lg px-2 py-1.5">
            <p className="text-[10px] text-red-400 font-semibold">ตีกลับ ครั้งที่ {i + 1}</p>
            <p className="text-[10px] text-slate-400">{h.reason}</p>
            <p className="text-[10px] text-slate-600">{fmtTime(h.at)}</p>
          </div>
        ))}
      </div>
    );
    return <span className="text-slate-700 text-xs text-center block">—</span>;
  };

  // ── Desktop Row ──
  const DesktopRow = ({ item, idx }) => {
    const rejected = item.qc_status === 'rejected';
    const passed   = item.qc_status === 'passed';
    return (
      <tr className={`border-b border-slate-800 transition-colors ${rejected ? 'bg-red-500/5' : passed ? 'bg-emerald-500/5' : ''}`}>
        <td className="px-4 py-3 text-slate-600 text-xs font-mono">{idx + 1}</td>
        <td className="px-3 py-3">
          <p className="font-medium text-white text-sm">{item.name}</p>
          <div className="relative inline-block mt-1">
            <button onClick={() => setItemAssigneePicker(itemAssigneePicker === item.id ? null : item.id)}
              className={`text-xs flex items-center gap-1 transition-colors ${
                item.item_assignees?.length > 0
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-slate-600 hover:text-amber-400'
              }`}>
              <UserCheck size={11} />
              {item.item_assignees?.length > 0
                ? item.item_assignees.map(a => a.name.split(' ')[0]).join(', ')
                : '+ มอบหมายช่าง'}
            </button>
            {itemAssigneePicker === item.id && <AssigneePicker itemId={item.id} />}
          </div>
          {rejected && item.reject_reason && (
            <p className="text-xs text-red-400 mt-0.5">❌ {item.reject_reason}</p>
          )}
        </td>
        <td className="px-3 py-3 text-center text-slate-300 text-sm font-medium">{item.quantity}</td>
        <td className="px-3 py-3"><PrepareCell item={item} /></td>
        <td className="px-3 py-3"><AssembleCell item={item} /></td>
        <td className="px-3 py-3"><QCCell item={item} /></td>
      </tr>
    );
  };

  // ── Mobile Card ──
  const MobileCard = ({ item, idx }) => {
    const rejected = item.qc_status === 'rejected';
    const passed   = item.qc_status === 'passed';
    const showRI   = rejectInputs[item.id] !== undefined;

    return (
      <div className={`p-4 border-b border-slate-800 last:border-0 ${rejected ? 'bg-red-500/5' : passed ? 'bg-emerald-500/5' : ''}`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1">
            <p className="font-semibold text-white text-sm">{item.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">จำนวน {item.quantity}</p>
            {rejected && item.reject_reason && (
              <p className="text-xs text-red-400 mt-1">❌ {item.reject_reason}</p>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setItemAssigneePicker(itemAssigneePicker === item.id ? null : item.id)}
              className={`text-xs px-2 py-1 rounded-lg font-medium border transition-colors ${
                item.item_assignees?.length > 0
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-amber-400 hover:border-amber-500/20'
              }`}>
              {item.item_assignees?.length > 0
                ? `👤 ${item.item_assignees.map(a => a.name.split(' ')[0]).join(', ')}`
                : '+ มอบหมาย'}
            </button>
            {itemAssigneePicker === item.id && <AssigneePicker itemId={item.id} />}
          </div>
        </div>

        {/* Prepare */}
        {(() => {
          const hasPrepPerm = can('assembly', 'prepare');
          const notAssigned = (item.item_assignees?.length > 0) && !isItemOpenToUser(item, effectiveUserId);
          if (item.prepared_at) return (
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1.5 rounded-lg inline-flex items-center gap-1.5 mr-2 mb-2">
              ✓ เตรียมแล้ว {fmtTime(item.prepared_at)}
              {isActive && !isPreviewMode && <button onClick={() => cancelPrepared(item.id)} disabled={saving} className="text-emerald-700 hover:text-red-400 transition-colors"><X size={11} /></button>}
            </span>
          );
          if (item.skip_prepare) return (
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1.5 rounded-lg inline-flex items-center gap-1.5 mr-2 mb-2">
              – ข้ามการเตรียม
              {isActive && !isPreviewMode && <button onClick={() => cancelSkipPrepare(item.id)} disabled={saving} className="text-slate-600 hover:text-red-400 transition-colors"><X size={11} /></button>}
            </span>
          );
          if (!isActive || !hasPrepPerm) return null;
          if (notAssigned) return (
            <span className="text-xs text-slate-500 bg-slate-900 border border-dashed border-slate-700 px-2 py-1.5 rounded-lg inline-flex items-center gap-1.5 mr-2 mb-2">
              🔒 ไม่ได้รับมอบหมาย
            </span>
          );
          return (
            <div className={`flex gap-2 mb-2 ${isPreviewMode ? 'pointer-events-none opacity-50' : ''}`}>
              <button onClick={() => markPrepared(item.id)} disabled={saving}
                className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg font-semibold">
                ✓ เตรียมแล้ว
              </button>
              <button onClick={() => markSkipPrepare(item.id)} disabled={saving}
                className="text-xs text-slate-600 hover:text-slate-400 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                ข้ามการเตรียม
              </button>
            </div>
          );
        })()}

        {/* Assemble / Done */}
        {(() => {
          const hasAssemblePerm = can('assembly', 'assemble');
          const notAssigned = (item.item_assignees?.length > 0) && !isItemOpenToUser(item, effectiveUserId);
          if (rejected) {
            if (!hasAssemblePerm || notAssigned) return null;
            return (
              <button onClick={() => resetAssembled(item.id)} disabled={saving || isPreviewMode}
                className={`text-xs bg-orange-500/15 text-orange-400 border border-orange-500/20 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 mb-2 ${isPreviewMode ? 'pointer-events-none opacity-50' : ''}`}>
                <RotateCcw size={11} /> ทำใหม่
              </button>
            );
          }
          if (item.assembled_at) return (
            <div className="mr-2 mb-2">
              <span className="text-xs text-blue-400 font-semibold bg-blue-500/10 px-2 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                ✓ ทำเสร็จ {fmtTime(item.assembled_at)}
                {isActive && item.qc_status !== 'passed' && !isPreviewMode && (
                  <button onClick={() => cancelAssembled(item.id)} disabled={saving} className="text-blue-700 hover:text-red-400 transition-colors"><X size={11} /></button>
                )}
              </span>
              {item.assembled_images?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {item.assembled_images.map((url, i) => (
                    <img key={i} src={url} onClick={() => setLightboxImg(url)}
                      className="w-12 h-12 object-cover rounded-xl cursor-zoom-in border border-slate-700" alt="" />
                  ))}
                </div>
              )}
            </div>
          );
          if (!isActive || !(item.prepared_at || item.skip_prepare) || !hasAssemblePerm) return null;
          if (notAssigned) return (
            <span className="text-xs text-slate-500 bg-slate-900 border border-dashed border-slate-700 px-2 py-1.5 rounded-lg inline-flex items-center gap-1.5 mr-2 mb-2">
              🔒 ไม่ได้รับมอบหมาย
            </span>
          );
          return (
            <div className={`flex flex-wrap gap-2 mb-2 ${isPreviewMode ? 'pointer-events-none opacity-50' : ''}`}>
              {!item.started_at ? (
                <button onClick={() => markStarted(item.id)} disabled={saving}
                  className="text-xs bg-slate-700 text-slate-400 border border-slate-600 px-3 py-1.5 rounded-lg font-semibold">
                  ▶ เริ่มทำ
                </button>
              ) : (
                <span className="text-xs text-slate-500 py-1.5">▶ เริ่ม {fmtTime(item.started_at)}</span>
              )}
              <button onClick={() => { setAssembleModal({ itemId: item.id, itemName: item.name }); setAssembleImages([]); }} disabled={saving}
                className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg font-semibold">
                ✓ ทำเสร็จ
              </button>
            </div>
          );
        })()}

        {/* QC history */}
        {(item.reject_history || []).length > 0 && (
          <div className="space-y-1 mb-2">
            {(item.reject_history || []).map((h, i) => (
              <div key={i} className="bg-red-500/8 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                <p className="text-[10px] text-red-400 font-semibold">ตีกลับ ครั้งที่ {i + 1} · {fmtTime(h.at)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{h.reason}</p>
              </div>
            ))}
          </div>
        )}
        {passed && (
          <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1.5 rounded-lg inline-block mr-2">
            ✓ ผ่าน QC · {fmtTime(item.qc_at)}
          </span>
        )}
        {job.stage === 'qc' && item.assembled_at && item.qc_status === 'pending' && can('assembly', 'qc') && (
          <div className={`flex flex-wrap gap-2 mt-1 ${isPreviewMode ? 'pointer-events-none opacity-50' : ''}`}>
            <button onClick={() => markQCPass(item.id)} disabled={saving}
              className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1">
              <CheckCircle size={11} /> ผ่าน QC
            </button>
            <button onClick={() => setRejectInputs(p => ({ ...p, [item.id]: '' }))}
              className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1">
              <XCircle size={11} /> ตีกลับ
            </button>
          </div>
        )}
        {showRI && can('assembly', 'qc') && !isPreviewMode && (
          <div className="flex gap-2 mt-2">
            <input className="text-xs bg-slate-800 border border-red-500/30 text-white rounded-lg px-3 py-2 flex-1 focus:outline-none placeholder:text-slate-600"
              placeholder="เหตุผล..." value={rejectInputs[item.id]}
              onChange={e => setRejectInputs(p => ({ ...p, [item.id]: e.target.value }))}
              autoFocus onKeyDown={e => { if (e.key === 'Enter') markQCReject(item.id); }} />
            <button onClick={() => markQCReject(item.id)}
              className="text-xs bg-red-500 text-white px-3 py-2 rounded-lg font-semibold">ยืนยัน</button>
          </div>
        )}
      </div>
    );
  };

  // ── Build timeline events ──
  const timelineEvents = (() => {
    const events = [];
    (job.items || []).forEach(it => {
      if (it.prepared_at)
        events.push({ type: 'prepare', name: it.name, at: it.prepared_at, by: it.prepared_by?.name });
      if (it.skip_prepare)
        events.push({ type: 'skip', name: it.name, at: null, by: null });
      if (it.started_at)
        events.push({ type: 'start', name: it.name, at: it.started_at, by: null });
      if (it.assembled_at)
        events.push({ type: 'assemble', name: it.name, at: it.assembled_at, by: it.assembled_by?.name });
      (it.reject_history || []).forEach((h, i) =>
        events.push({ type: 'reject', name: it.name, at: h.at, by: h.by?.name, reason: h.reason, round: i + 1 })
      );
      (it.rework_history || []).forEach((h, i) =>
        events.push({ type: 'rework', name: it.name, at: h.at, by: h.by?.name, round: i + 1 })
      );
      if (it.qc_status === 'passed' && it.qc_at)
        events.push({ type: 'qc_pass', name: it.name, at: it.qc_at, by: it.qc_by?.name });
    });
    stockWithdrawals.forEach(tx => {
      const type = tx.transaction_type === 'stock_out' ? 'stock_withdraw' : 'stock_return';
      const pname = (tx.product?.name || '—') + (tx.variant?.name ? ` (${tx.variant.name})` : '') + ` ×${tx.quantity}`;
      const by = tx.creator ? `${tx.creator.first_name} ${tx.creator.last_name}` : null;
      events.push({ type, name: pname, at: tx.created_at, by, reason: tx.note });
    });
    events.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
    return events;
  })();

  return (
    <div className="bg-slate-950 rounded-3xl p-4 md:p-6 min-h-[calc(100vh-8rem)] pb-12 animate-in fade-in duration-300">

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} className="max-w-full max-h-[90vh] rounded-xl object-contain" alt="" />
          <button className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2">✕</button>
        </div>
      )}

      {/* Assemble Confirm Modal */}
      {assembleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold">ยืนยันทำเสร็จ</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{assembleModal.itemName}</p>
              </div>
              <button onClick={() => { setAssembleModal(null); setAssembleImages([]); }}
                className="text-slate-600 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Upload area */}
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-400">อัพโหลดรูปภาพหลักฐาน <span className="text-slate-600">(ไม่บังคับ)</span></p>

              {assembleImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {assembleImages.map((imgObj, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 group">
                      <img src={imgObj.url} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        <button
                          onClick={() => setAssembleImages(prev => prev.filter((_, i) => i !== idx))}
                          className="text-white bg-red-500/80 hover:bg-red-500 rounded-full p-1.5 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl cursor-pointer transition-colors text-slate-500 hover:text-amber-400 text-sm">
                <input type="file" accept="image/*" className="hidden" multiple
                  onChange={e => {
                    const files = Array.from(e.target.files || []);
                    const newImgs = files.map(f => ({ url: URL.createObjectURL(f), file: f }));
                    setAssembleImages(prev => [...prev, ...newImgs]);
                    e.target.value = '';
                  }} />
                <ImageIcon size={16} /> เพิ่มรูปภาพ
              </label>
            </div>

            {/* Actions */}
            <div className="p-5 pt-0 flex gap-3">
              <button onClick={() => handleAssembleConfirm(true)} disabled={uploadingImages || saving}
                className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors disabled:opacity-50">
                ข้ามรูป
              </button>
              <button onClick={() => handleAssembleConfirm(false)} disabled={uploadingImages || saving}
                className="flex-1 py-2.5 text-sm bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {(uploadingImages || saving) && <Loader2 size={15} className="animate-spin" />}
                ✓ ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800 sticky top-2 z-20 mb-5">
        <button onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white font-medium px-3 py-2 rounded-xl hover:bg-slate-800 transition-all text-sm">
          <ArrowLeft size={18} /> <span className="hidden sm:inline">ย้อนกลับ</span>
        </button>
        <div className="flex flex-wrap gap-2">
          {can('assembly', 'edit') && (
            <div className="relative">
              <button
                onClick={() => setShowPreviewPicker(!showPreviewPicker)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition-all border border-slate-700"
              >
                <Eye size={16} /> ดูมุมมองช่าง
              </button>
              {showPreviewPicker && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowPreviewPicker(false)} />
                  <div className="absolute right-0 top-11 z-40 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 w-56 animate-in fade-in zoom-in-95">
                    <p className="text-xs text-slate-500 px-2 py-1.5 font-medium">เลือกช่างที่ต้องการดู</p>
                    <div className="border-t border-slate-700 mb-1" />
                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                      {allUsers.map(u => (
                        <div key={u.id}
                          onClick={() => { setPreviewUser({ id: u.id, name: `${u.first_name} ${u.last_name}` }); setShowPreviewPicker(false); }}
                          className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                          <div className="w-7 h-7 rounded-full bg-amber-900/50 border border-amber-800/40 flex items-center justify-center text-xs text-amber-300 font-bold overflow-hidden shrink-0">
                            {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.first_name?.[0] || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-200 font-medium truncate">{u.first_name} {u.last_name}</p>
                            {u.roles?.name && <p className="text-[10px] text-slate-500">{u.roles.name}</p>}
                          </div>
                        </div>
                      ))}
                      {allUsers.length === 0 && (
                        <p className="text-xs text-slate-600 text-center py-3">ไม่มีรายชื่อ</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {can('assembly', 'edit') && (
            <button onClick={onEdit}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition-all active:scale-95">
              <Edit size={16} /> แก้ไข
            </button>
          )}
          {can('assembly', 'delete') && (
            <button onClick={onDelete}
              className="flex items-center gap-2 px-3 py-2.5 border border-slate-700 text-red-400 hover:bg-red-500/10 rounded-xl text-sm transition-all active:scale-95">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <div className="flex items-center justify-between bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-2.5 mb-2 -mt-2">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <Eye size={15} />
            <span>กำลังดูมุมมองของ <strong>{previewUser.name}</strong></span>
          </div>
          <button onClick={() => setPreviewUser(null)} className="text-amber-600 hover:text-amber-400 transition-colors text-xs flex items-center gap-1">
            ออกจากโหมดนี้ <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Main Column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Job Header */}
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-xs font-mono text-slate-600 bg-slate-800 px-2 py-1 rounded-md">{job.job_number}</span>
              <span className={`px-3 py-1 rounded-full font-bold text-xs border ${stageConf.badge}`}>{stageConf.label}</span>
              {job.ref_type && (
                <span className={`text-xs px-2.5 py-1 rounded border font-medium ${
                  job.ref_type === 'order'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                }`}>
                  {job.ref_type === 'order' ? '🛒 Order' : '🔧 Service'}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-1">{job.title}</h1>
          </div>

          {/* Stage Progress */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center justify-between">
              {STAGES.map((s, i) => {
                const conf = STAGE_CONFIG[s];
                const isAct = job.stage === s;
                const isDone = stageIdx > i;
                return (
                  <React.Fragment key={s}>
                    <div className="flex flex-col items-center gap-1.5 z-10">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow transition-all ${isDone ? 'bg-emerald-500' : isAct ? conf.bg : 'bg-slate-700'}`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-[10px] font-semibold text-center leading-tight max-w-[52px] ${isAct ? 'text-white' : isDone ? 'text-emerald-500' : 'text-slate-600'}`}>
                        {conf.label}
                      </span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={`flex-1 h-px mx-1 ${stageIdx > i ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Checklist */}
          {items.length > 0 && (
            <div className={cardCls}>
              <div className="px-6 py-4 border-b border-slate-800">
                {(() => {
                  const done = items.filter(i => i.assembled_at || i.qc_status === 'passed').length;
                  const pct  = items.length > 0 ? Math.round(done / items.length * 100) : 0;
                  const barColor = pct === 100 ? 'bg-emerald-500' : job.stage === 'qc' ? 'bg-purple-500' : job.stage === 'in_progress' ? 'bg-blue-500' : 'bg-amber-500';
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-white">รายการงาน ({items.length})</h3>
                        <span className="text-sm text-slate-500">
                          ทำเสร็จ {done}/{items.length} · <span className="text-amber-400 font-semibold">{pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider text-left">
                      <th className="px-4 py-3 w-10">#</th>
                      <th className="px-3 py-3">รายการ / ช่างที่รับผิดชอบ</th>
                      <th className="px-3 py-3 w-16 text-center">จำนวน</th>
                      <th className="px-3 py-3 w-36 text-center">เตรียมของ</th>
                      <th className="px-3 py-3 w-36 text-center">ประกอบ/ทำ</th>
                      <th className="px-3 py-3 w-44 text-center">QC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => <DesktopRow key={item.id} item={item} idx={idx} />)}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden">
                {items.map((item, idx) => <MobileCard key={item.id} item={item} idx={idx} />)}
              </div>
            </div>
          )}

          {/* Advance Stage */}
          {job.stage !== 'completed' && job.stage !== 'cancelled' && (
            <div className={`${cardCls} p-5`}>
              {canAdvance() ? (
                <button onClick={advanceStage} disabled={saving}
                  className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg text-sm disabled:opacity-50 ${stageConf.btnCls}`}>
                  {saving ? <Loader2 size={18} className="animate-spin" /> : (
                    <>
                      ย้ายไปขั้นถัดไป:
                      <span className="opacity-80 font-normal">{STAGE_CONFIG[STAGES[stageIdx + 1]]?.label}</span>
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              ) : (
                <div className="text-center py-2">
                  <p className="font-semibold text-slate-400 text-sm">ดำเนินการให้ครบทุกรายการก่อน</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {job.stage === 'preparing'   && 'กด "เตรียมแล้ว" ให้ครบทุกรายการ'}
                    {job.stage === 'in_progress' && 'กด "ทำเสร็จ" ให้ครบทุกรายการ'}
                    {job.stage === 'qc'          && 'QC ผ่านทุกรายการก่อน'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Completed */}
          {job.stage === 'completed' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl text-center">
              <p className="text-emerald-400 font-bold text-lg">✅ งานเสร็จสิ้น</p>
              {job.completed_at && <p className="text-emerald-600 text-sm mt-1">เสร็จเมื่อ {fmtTime(job.completed_at)}</p>}
              {job.ref_type && (
                <p className="text-slate-500 text-xs mt-2">
                  {job.ref_type === 'order' ? '🛒 Order อัปเดตเป็น Shipping' : '🔧 Service อัปเดตเป็น Tested'}
                </p>
              )}
            </div>
          )}

          {/* ── Stock Withdrawal Section ── */}
          {can('stock', 'stock_out') && (
            <div className={cardCls}>
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-amber-400" />
                  <h3 className="font-bold text-white">เบิกวัสดุจากคลัง</h3>
                  {stockWithdrawals.filter(t => t.transaction_type === 'stock_out').length > 0 && (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                      เบิก {stockWithdrawals.filter(t => t.transaction_type === 'stock_out').length} รายการ
                    </span>
                  )}
                </div>
                {!withdrawFormOpen && (
                  <button onClick={() => setWithdrawFormOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1.5 rounded-xl transition-colors">
                    <Plus size={13} /> เบิกเพิ่ม
                  </button>
                )}
              </div>

              {/* Section 1: Withdrawals (stock_out) */}
              {stockWithdrawals.filter(t => t.transaction_type === 'stock_out').length > 0 && (
                <div className="divide-y divide-slate-800/60">
                  {stockWithdrawals.filter(t => t.transaction_type === 'stock_out').map(tx => {
                    const creator = tx.creator ? `${tx.creator.first_name} ${tx.creator.last_name}` : '—';
                    const isReturning = returningTxId === tx.id;
                    return (
                      <div key={tx.id} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <PackageMinus size={14} className="text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{tx.product?.name}</span>
                              {tx.variant?.name && <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">{tx.variant.name}</span>}
                              <span className="text-sm font-bold text-green-400">×{tx.quantity}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                              {tx.location && (
                                <span className="flex items-center gap-1">
                                  <Warehouse size={10} />
                                  {tx.location.store?.name && `${tx.location.store.name} · `}{tx.location.code}
                                </span>
                              )}
                              <span className="flex items-center gap-1"><Clock size={10} />{fmtTime(tx.created_at)}</span>
                              <span className="flex items-center gap-1"><User size={10} />{creator}</span>
                            </div>
                          </div>
                          {can('stock', 'stock_in') && (
                            <button
                              onClick={() => { setReturningTxId(isReturning ? null : tx.id); setReturnNote(''); }}
                              className="shrink-0 flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-800 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20 border border-slate-700 px-2.5 py-1.5 rounded-xl transition-colors mt-0.5">
                              <Undo2 size={12} /> คืนคลัง
                            </button>
                          )}
                        </div>
                        {/* Return note inline form */}
                        {isReturning && (
                          <div className="mt-3 ml-11 p-3 bg-red-500/8 border border-red-500/20 rounded-xl space-y-2">
                            <p className="text-xs font-bold text-red-400">ระบุหมายเหตุการคืน <span className="text-red-500">*</span></p>
                            <input
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-600 rounded-xl text-sm focus:outline-none focus:border-red-500 transition-colors"
                              placeholder="เหตุผลที่คืน เช่น เหลือจากงาน, ไม่ได้ใช้..."
                              value={returnNote}
                              onChange={e => setReturnNote(e.target.value)}
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') submitReturn(tx); }}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => { setReturningTxId(null); setReturnNote(''); }}
                                className="px-3 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-medium transition-colors">
                                ยกเลิก
                              </button>
                              <button onClick={() => submitReturn(tx)} disabled={returnSaving || !returnNote.trim()}
                                className="flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40">
                                {returnSaving ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />}
                                ยืนยันคืน {tx.quantity} ชิ้น
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Section 2: Returns (stock_in) */}
              {stockWithdrawals.filter(t => t.transaction_type === 'stock_in').length > 0 && (
                <>
                  <div className="px-5 py-2 bg-slate-800/40 border-t border-slate-700/60 flex items-center gap-2">
                    <Undo2 size={12} className="text-red-400" />
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">คืนคลัง</span>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {stockWithdrawals.filter(t => t.transaction_type === 'stock_in').map(tx => {
                      const creator = tx.creator ? `${tx.creator.first_name} ${tx.creator.last_name}` : '—';
                      return (
                        <div key={tx.id} className="flex items-start gap-3 px-5 py-3 bg-red-500/5">
                          <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <PackagePlus size={14} className="text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{tx.product?.name}</span>
                              {tx.variant?.name && <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">{tx.variant.name}</span>}
                              <span className="text-sm font-bold text-red-400">×{tx.quantity}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                              {tx.location && (
                                <span className="flex items-center gap-1">
                                  <Warehouse size={10} />
                                  {tx.location.store?.name && `${tx.location.store.name} · `}{tx.location.code}
                                </span>
                              )}
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

              {stockWithdrawals.filter(t => t.transaction_type === 'stock_out').length === 0 && !withdrawFormOpen && (
                <p className="px-6 py-6 text-center text-slate-600 text-sm">ยังไม่มีการเบิกวัสดุ</p>
              )}

              {/* Withdraw Form */}
              {withdrawFormOpen && (
                <div className="p-5 border-t border-slate-800 space-y-4">
                  {/* Product search */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">สินค้าที่จะเบิก</p>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        className="w-full pl-8 pr-3 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-600 rounded-xl text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        placeholder="ค้นหาสินค้าหรือ SKU..."
                        value={wProductSearch}
                        onChange={async e => {
                          setWProductSearch(e.target.value);
                          setWShowDropdown(true);
                          if (!e.target.value.trim()) { setWProductResults([]); return; }
                          const { data } = await supabase.from('products')
                            .select('id, name, sku, has_variants').or(`name.ilike.%${e.target.value}%,sku.ilike.%${e.target.value}%`).limit(8);
                          setWProductResults(data || []);
                        }}
                        onFocus={() => setWShowDropdown(true)}
                        onBlur={() => setTimeout(() => setWShowDropdown(false), 150)}
                      />
                      {wShowDropdown && wProductResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                          {wProductResults.map(p => (
                            <button key={p.id} type="button" onMouseDown={async () => {
                              setWProduct(p); setWProductSearch(p.name); setWShowDropdown(false);
                              setWVariant(null);
                              if (p.has_variants) {
                                const { data } = await supabase.from('product_variants').select('*').eq('product_id', p.id);
                                setWVariants(data || []);
                                setWStockItems([]);
                              } else {
                                setWVariants([]);
                                loadWStockItems(p, null);
                              }
                            }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-700 text-sm border-b border-slate-700/50 last:border-0 transition-colors">
                              <span className="text-white font-medium">{p.name}</span>
                              <span className="ml-2 text-xs text-slate-500 font-mono">{p.sku}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {wProduct && (
                      <div className="mt-2 flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                        <span className="text-sm font-semibold text-amber-300">{wProduct.name}</span>
                        <button onClick={() => { setWProduct(null); setWProductSearch(''); setWVariant(null); setWVariants([]); setWStockItems([]); setWSelectedItemId(''); }}
                          className="text-slate-600 hover:text-red-400 transition-colors"><X size={14} /></button>
                      </div>
                    )}
                  </div>

                  {/* Variant */}
                  {wProduct?.has_variants && wVariants.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ตัวเลือก (Variant)</p>
                      <div className="relative">
                        <select
                          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:border-amber-500 appearance-none pr-8"
                          value={wVariant?.id || ''}
                          onChange={e => {
                            const v = wVariants.find(x => x.id === e.target.value) || null;
                            setWVariant(v);
                            loadWStockItems(wProduct, v);
                          }}>
                          <option value="">-- เลือก Variant --</option>
                          {wVariants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {/* Stock location picker */}
                  {wProduct && (!wProduct.has_variants || wVariant) && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">เบิกจากที่เก็บ</p>
                      {wStockLoading ? (
                        <p className="text-sm text-slate-500 text-center py-3"><Loader2 size={14} className="animate-spin inline mr-1" />กำลังโหลด...</p>
                      ) : wStockItems.length === 0 ? (
                        <p className="text-sm text-slate-600 text-center py-3">ไม่มีสต๊อกสินค้านี้ในคลังใด</p>
                      ) : (
                        <div className="space-y-2">
                          {wStockItems.map(item => {
                            const isSelected = wSelectedItemId === item.id;
                            return (
                              <div key={item.id} onClick={() => { setWSelectedItemId(item.id); setWQty(q => Math.min(q, item.quantity)); }}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
                                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? 'border-amber-400 bg-amber-400' : 'border-slate-600'}`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {item.location ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-xs">{item.location.code}</span>
                                      {item.location.name && <span className="text-xs text-slate-300">{item.location.name}</span>}
                                      {item.location.store?.name && <span className="text-xs text-slate-500 flex items-center gap-0.5"><Warehouse size={9} />{item.location.store.name}</span>}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500">ไม่ระบุที่เก็บ</span>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg shrink-0">มี {item.quantity}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quantity */}
                  {wSelectedItemId && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">จำนวนที่เบิก</p>
                      <input type="number" min={1} max={wStockItems.find(i => i.id === wSelectedItemId)?.quantity || 1}
                        value={wQty} onChange={e => setWQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:border-amber-500 text-center font-bold" />
                    </div>
                  )}

                  {/* Auto note preview */}
                  {wProduct && (
                    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-slate-500 mb-1">หมายเหตุอัตโนมัติ</p>
                      <p className="text-xs text-slate-300 italic">
                        เบิกใช้งานโปรเจ็ค "{job.title}"
                        {job.customer_cache && ` / ลูกค้า: ${[job.customer_cache.first_name, job.customer_cache.last_name].filter(Boolean).join(' ')}`}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={resetWithdrawForm}
                      className="px-4 py-2 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-medium transition-colors">
                      ยกเลิก
                    </button>
                    <button onClick={submitWithdrawal}
                      disabled={withdrawSaving || !wSelectedItemId || wQty < 1}
                      className="flex-1 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                      {withdrawSaving ? <Loader2 size={15} className="animate-spin" /> : <PackageMinus size={15} />}
                      ยืนยันเบิก {wQty > 0 && wSelectedItemId ? `(${wQty} ชิ้น)` : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline Images */}
          {timelineImages.length > 0 && (
            <div className={cardCls}>
              <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                <ImageIcon size={16} className="text-amber-400" />
                <h3 className="font-bold text-white">รูปภาพจาก Timeline ({timelineImages.length})</h3>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {timelineImages.map((img, i) => (
                  <div key={i} className="group cursor-zoom-in" onClick={() => setLightboxImg(img.url)}>
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-800">
                      <img src={img.url} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                        <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    </div>
                    {img.description && (
                      <p className="text-[10px] text-slate-600 mt-1 truncate">{img.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className={cardCls}>
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
              <MessageCircle size={16} className="text-amber-400" />
              <h3 className="font-bold text-white">บันทึก / ความคิดเห็น</h3>
            </div>
            <div className="divide-y divide-slate-800">
              {comments.length === 0 && (
                <p className="px-6 py-8 text-center text-slate-600 text-sm">ยังไม่มีความคิดเห็น</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="px-6 py-4 flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-900/40 border border-amber-800/40 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
                    {c.by?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm text-white">{c.by?.name}</span>
                      <span className="text-xs text-slate-600">{fmtTime(c.at)}</span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-800">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-900/40 border border-amber-800/40 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
                  {profile?.first_name?.[0] || '?'}
                </div>
                <div className="flex-1 flex gap-2">
                  <textarea
                    className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 resize-none"
                    placeholder="เพิ่มความคิดเห็น... (Enter เพื่อส่ง)"
                    rows={2} value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                  />
                  <button onClick={postComment} disabled={postingComment || !newComment.trim()}
                    className="self-end px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1 font-medium text-sm">
                    {postingComment ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="space-y-5">

          {/* Full Customer Info */}
          {job.customer_cache && (
            <div className={`${cardCls} p-5`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">ข้อมูลลูกค้า</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-amber-900/40 border border-amber-800/30 rounded-full flex items-center justify-center text-amber-400 font-bold text-lg shrink-0">
                    {job.customer_cache.first_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-white">{job.customer_cache.first_name} {job.customer_cache.last_name}</p>
                    {job.customer_cache.nickname && <p className="text-xs text-slate-500">({job.customer_cache.nickname})</p>}
                  </div>
                </div>
                {job.customer_cache.phone && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Phone size={13} className="text-slate-600 shrink-0" />{job.customer_cache.phone}
                  </div>
                )}
                {job.customer_cache.address_raw && (
                  <div className="flex items-start gap-2 text-slate-500 text-sm">
                    <MapPin size={13} className="text-slate-600 shrink-0 mt-0.5" />{job.customer_cache.address_raw}
                  </div>
                )}
                {(job.customer_cache.social_channels || []).map((sc, i) => (
                  <div key={i} className="flex items-center gap-2 text-slate-400 text-sm">
                    <span>{SOCIAL_ICON[sc.type] || '🔗'}</span>
                    <span className="text-xs text-slate-600">{sc.type}</span>
                    <span className="truncate">{sc.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignees */}
          {assignees.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">ทีมงาน</h4>
              <div className="space-y-2.5">
                {assignees.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-900/40 border border-amber-800/30 flex items-center justify-center text-amber-400 font-bold text-sm overflow-hidden shrink-0">
                      {a.user?.avatar_url ? <img src={a.user.avatar_url} className="w-full h-full object-cover" alt="" /> : a.user?.first_name?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{a.user?.first_name} {a.user?.last_name}</p>
                      <p className="text-xs text-slate-600 truncate">{a.job_role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className={`${cardCls} p-5 space-y-3`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">รายละเอียด</h4>
            {job.notes && (
              <p className="text-sm text-slate-400 whitespace-pre-wrap bg-slate-800/50 p-3 rounded-xl leading-relaxed">{job.notes}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock size={13} className="shrink-0" /><span>สร้าง: {fmtDate(job.created_at)}</span>
            </div>
            {job.completed_at && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Clock size={13} className="shrink-0" /><span>เสร็จ: {fmtDate(job.completed_at)}</span>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          {timelineEvents.length > 0 && (
            <TimelineWidget events={timelineEvents} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AssemblyDetail;
