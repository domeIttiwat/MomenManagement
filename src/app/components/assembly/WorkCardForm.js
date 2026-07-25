'use client';
import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, Loader2, Flag, CalendarDays, Link2, Package, Check, LayoutTemplate, Bookmark, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { notifyUsers } from './workNotify';
import { fetchUserTags, fetchTagLinks } from '@/lib/userTags';
import { TagChips } from '@/app/components/common/TagControl';

// ฟอร์มสร้าง/แก้ไขการ์ดงานประกอบ
// - ผูกคำสั่งซื้อ/งานซ่อมก็ได้ ไม่ผูกก็ได้ (งานอิสระ)
// - ผูกแล้วเลือกได้ว่ารอบนี้ประกอบชิ้นไหนบ้าง (ดึงจากเช็คลิสต์เตรียมของ) — ชิ้นที่ประกอบแล้วเลือกซ้ำไม่ได้
// - presetRef: เปิดจากหน้าออเดอร์/งานซ่อม จะผูกงานนั้นให้อัตโนมัติ
// - เทมเพลตเช็คลิสต์: บันทึกชุดงานที่ใช้บ่อย (ต่อรุ่นรถ) แล้วดึงมาใช้ซ้ำได้
const WorkCardForm = ({ initialData = null, presetRef = null, profile, onClose, onSaved }) => {
  const isEdit = Boolean(initialData?.id);
  const { role } = useAuth();
  const isBoss = ['Supervisor', 'Admin'].includes(role?.name);
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initialData?.title || '');
  const [detail, setDetail] = useState(initialData?.detail || '');
  const [priority, setPriority] = useState(initialData?.priority || 'normal');
  const [focusToday, setFocusToday] = useState(isEdit ? Boolean(initialData?.focus_date) : true);
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [assignees, setAssignees] = useState(Array.isArray(initialData?.assignees) ? initialData.assignees : []);
  const [people, setPeople] = useState([]);

  // รูปแนบการ์ด (แนบได้หลายรูป)
  const [existingImages, setExistingImages] = useState(Array.isArray(initialData?.images) ? initialData.images : []);
  const [imgFiles, setImgFiles] = useState([]);

  // ผูกงาน
  const [refType, setRefType] = useState(initialData?.ref_type || presetRef?.type || null); // 'order' | 'service' | null
  const [refId, setRefId] = useState(initialData?.ref_id || presetRef?.id || null);
  const [refLabel, setRefLabel] = useState(initialData?.ref_label || presetRef?.label || '');
  const [refSearch, setRefSearch] = useState('');
  const [refResults, setRefResults] = useState([]);
  const [refPicking, setRefPicking] = useState(null); // 'order' | 'service' ตอนกำลังค้นหา

  // Tag ส่วนตัวของเรา — โชว์ในผลค้นหาให้หางานเจอง่าย
  const [myTags, setMyTags] = useState([]);
  const [refTagLinks, setRefTagLinks] = useState({});
  useEffect(() => {
    if (profile?.id) fetchUserTags(profile.id).then(setMyTags);
  }, [profile?.id]);
  useEffect(() => {
    if (refPicking && profile?.id) fetchTagLinks(profile.id, refPicking).then(setRefTagLinks);
    else setRefTagLinks({});
  }, [refPicking, profile?.id]);

  // ชิ้นส่วนจากรถ (เลือกเป็นงานรอบนี้)
  const [parts, setParts] = useState([]);            // จาก prep items
  const [selectedParts, setSelectedParts] = useState(new Set());
  const [partsLoading, setPartsLoading] = useState(false);
  const [existingPartIds, setExistingPartIds] = useState(new Set()); // ชิ้นที่อยู่ในการ์ดนี้แล้ว (ตอนแก้ไข)
  const [usedPartIds, setUsedPartIds] = useState(new Set());         // ชิ้นที่อยู่ในการ์ดรอบอื่นแล้ว (เลือกซ้ำไม่ได้)
  const [existingItems, setExistingItems] = useState([]);            // เช็คลิสต์เดิมของการ์ด (ตอนแก้ไข)
  const [removedItemIds, setRemovedItemIds] = useState([]);          // รายการเดิมที่กดลบ (ลบจริงตอนบันทึก)

  // เช็คลิสต์พิมพ์เอง
  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState('');

  // เทมเพลตเช็คลิสต์ (ใช้ร่วมกันทั้งทีม เช่น ต่อรุ่นรถ)
  const [templates, setTemplates] = useState([]);
  const [tplOpen, setTplOpen] = useState(false);

  // งานค้างต่อคน (เตือนงานล้นมือ) — นับการ์ดที่ยังไม่เสร็จและยังไม่ถูกยกออก
  const WIP_LIMIT = 3;
  const [workload, setWorkload] = useState({});

  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    supabase.from('profiles').select('id, first_name, last_name, avatar_url').order('first_name')
      .then(({ data }) => setPeople(data || []));
  }, []);

  // เปิดจากหน้าออเดอร์/งานซ่อม → โหลดชิ้นส่วนของงานนั้นให้เลย
  // ตอนแก้ไข: โหลดชิ้นส่วนของงานที่ผูกไว้ + จำว่าชิ้นไหนอยู่ในการ์ดแล้ว (เลือกเพิ่มได้ ไม่ซ้ำ)
  useEffect(() => {
    if (!isEdit && presetRef?.id) loadParts(presetRef.type, presetRef.id);
    if (isEdit && initialData?.ref_id) loadParts(initialData.ref_type, initialData.ref_id);
    if (isEdit && initialData?.id) {
      supabase.from('work_card_items').select('id, title, kind, done, prep_item_id')
        .eq('card_id', initialData.id).neq('kind', 'material').order('sort_order').order('created_at')
        .then(({ data }) => {
          const rows = data || [];
          setExistingItems(rows);
          setExistingPartIds(new Set(rows.filter((r) => r.prep_item_id).map((r) => r.prep_item_id)));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // โหลดเทมเพลตเช็คลิสต์
  const fetchTemplates = async () => {
    const { data } = await supabase.from('work_card_templates').select('*').order('name');
    setTemplates(data || []);
  };
  useEffect(() => { fetchTemplates(); }, []);

  // ลบรายการเดิมออกจากการ์ด (ลบจริงตอนกดบันทึก)
  const removeExisting = (it) => {
    setExistingItems((prev) => prev.filter((x) => x.id !== it.id));
    setRemovedItemIds((prev) => [...prev, it.id]);
    if (it.prep_item_id) setExistingPartIds((prev) => { const n = new Set(prev); n.delete(it.prep_item_id); return n; });
  };

  const applyTemplate = (tpl) => {
    const items = Array.isArray(tpl.items) ? tpl.items : [];
    setTasks((prev) => [...prev, ...items.filter((t) => !prev.includes(t))]);
    setTplOpen(false);
  };

  const saveAsTemplate = async () => {
    if (!tasks.length) return;
    const name = prompt('ตั้งชื่อเทมเพลต (เช่น "ประกอบ TOGETHER มาตรฐาน")');
    if (!name?.trim()) return;
    const { error } = await supabase.from('work_card_templates')
      .insert({ name: name.trim(), items: tasks, created_by: meRef() });
    if (error) return alert('บันทึกเทมเพลตไม่สำเร็จ: ' + error.message);
    fetchTemplates();
    alert(`บันทึกเทมเพลต "${name.trim()}" แล้ว — ครั้งหน้ากด "ดึงเทมเพลต" มาใช้ได้เลย`);
  };

  const deleteTemplate = async (tpl) => {
    if (!confirm(`ลบเทมเพลต "${tpl.name}"?`)) return;
    await supabase.from('work_card_templates').delete().eq('id', tpl.id);
    setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
  };

  // นับงานค้างของแต่ละคน (การ์ดยังไม่เสร็จ ยังไม่ยกออก) — ไม่นับการ์ดที่กำลังแก้ไขอยู่
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('work_cards').select('id, assignees, status, archived_at');
      const m = {};
      (data || []).forEach((c) => {
        if (c.archived_at || c.status === 'done') return;
        if (isEdit && c.id === initialData?.id) return;
        (Array.isArray(c.assignees) ? c.assignees : []).forEach((a) => { if (a?.id) m[a.id] = (m[a.id] || 0) + 1; });
      });
      setWorkload(m);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overloaded = assignees.filter((a) => (workload[a.id] || 0) >= WIP_LIMIT);

  // งานที่ผูกได้: whitelist เฉพาะที่จ่ายเงิน/มัดจำ/ตกลงทำแล้ว และยังไม่จบ — โหลดชุดเดียวแล้วค้นหาฝั่งหน้าจอ
  // ค้นได้ทั้ง เลขออเดอร์ / ชื่อ-ชื่อเล่นลูกค้า / เบอร์โทร / ชื่อรุ่นรถ-สินค้า / อาการซ่อม
  const [refAll, setRefAll] = useState([]);
  useEffect(() => {
    if (!refPicking) { setRefAll([]); setRefResults([]); return; }
    (async () => {
      if (refPicking === 'order') {
        const { data } = await supabase.from('orders')
          .select('id, order_number, status, customer_cache, notes, images, order_items(product_name)')
          .in('status', ['Deposit', 'Paid', 'Assembling', 'Shipping'])
          .order('created_at', { ascending: false }).limit(100);
        setRefAll(data || []);
      } else {
        // งานซ่อม: รวม "รอประเมิน" ด้วย — บางงานเริ่มเตรียม/วางแผนก่อนประเมินเสร็จ
        const { data } = await supabase.from('services')
          .select('id, service_number, status, customer_cache, notes, images, service_items(description)')
          .in('status', ['Assessing', 'Waiting', 'In Progress', 'Tested', 'Delivered'])
          .order('created_at', { ascending: false }).limit(100);
        setRefAll(data || []);
      }
    })();
  }, [refPicking]);

  useEffect(() => {
    const q = refSearch.trim().toLowerCase();
    const match = (r) => {
      if (!q) return true;
      const cc = r.customer_cache || {};
      // ค้นได้จากทุกอย่างในงานนั้น: เลข / ชื่อ-สกุล-ชื่อเล่น-เบอร์ลูกค้า / รายการสินค้า-อาการ / หมายเหตุ / สถานะ
      const hay = [
        refPicking === 'order' ? r.order_number : r.service_number,
        cc.first_name, cc.last_name, cc.nickname, cc.phone,
        r.notes,
        REF_STATUS_TH[r.status] || r.status,
        ...(refPicking === 'order'
          ? (r.order_items || []).map((x) => x.product_name)
          : (r.service_items || []).map((x) => x.description)),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    };
    setRefResults(refAll.filter(match).slice(0, 30));
  }, [refSearch, refAll, refPicking]);

  // ป้ายสถานะไทยของงานที่จะผูก
  const REF_STATUS_TH = {
    Deposit: 'มัดจำ', Paid: 'ชำระแล้ว', Assembling: 'ส่งประกอบ', Shipping: 'เตรียมส่ง',
    Assessing: 'รอประเมิน', Waiting: 'รอคิว', 'In Progress': 'ส่งทำ', Tested: 'ทดสอบแล้ว', Delivered: 'รอส่ง',
  };
  const imgUrl = (v) => (typeof v === 'string' ? v : v?.url || null);
  const custImgOf = (cc) => imgUrl(cc?.images?.[0]);
  const jobImgOf = (row) => imgUrl((row.images || [])[0]);

  // โหลดชิ้นส่วนจากเช็คลิสต์เตรียมของ ของงานที่ผูก
  const loadParts = async (type, id) => {
    setPartsLoading(true); setParts([]); setSelectedParts(new Set());
    try {
      const prepTable = type === 'service' ? 'service_preps' : 'order_preps';
      const itemTable = type === 'service' ? 'service_prep_items' : 'order_prep_items';
      const refCol = type === 'service' ? 'service_id' : 'order_id';
      const { data: p } = await supabase.from(prepTable).select('id').eq(refCol, id).maybeSingle();
      if (p) {
        const { data: its } = await supabase.from(itemTable)
          .select('id, title, status, kind, parent_item_id, assembled_at, assembled_by, no_assemble')
          .eq('prep_id', p.id).order('sort_order').order('created_at');
        const all = its || [];
        const hasChild = (xid) => all.some((y) => y.parent_item_id === xid);
        // ไม่โชว์ของเตรียมให้เฉยๆ (no_assemble เช่น ลูกปืน) — ไม่ใช่งานติ๊กประกอบ
        setParts(all.filter((x) => (x.kind !== 'product' || !hasChild(x.id)) && x.status !== 'skipped' && !x.no_assemble));
        // เช็คว่าชิ้นไหนถูกดึงเข้าการ์ดรอบอื่นไปแล้ว — กันเลือกซ้ำข้ามรอบ
        const leafIds = all.map((x) => x.id);
        if (leafIds.length) {
          const { data: lk } = await supabase.from('work_card_items').select('prep_item_id, card_id').in('prep_item_id', leafIds);
          setUsedPartIds(new Set((lk || []).filter((r) => !(isEdit && r.card_id === initialData?.id)).map((r) => r.prep_item_id)));
        } else setUsedPartIds(new Set());
      }
    } finally { setPartsLoading(false); }
  };

  const pickRef = (type, row) => {
    const label = type === 'order' ? row.order_number : row.service_number;
    setRefType(type); setRefId(String(row.id)); setRefLabel(label);
    setRefPicking(null); setRefSearch(''); setRefResults([]);
    if (!title.trim()) {
      const main = type === 'order' ? row.order_items?.[0]?.product_name : row.service_items?.[0]?.description;
      setTitle(`${type === 'order' ? 'ประกอบ' : 'งานซ่อม'} ${label}${main ? ` — ${main}` : ''}`);
    }
    loadParts(type, row.id);
  };

  const clearRef = () => { setRefType(null); setRefId(null); setRefLabel(''); setParts([]); setSelectedParts(new Set()); };

  const togglePart = (id) => setSelectedParts((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAssignee = (p) => setAssignees((prev) => (
    prev.some((a) => a.id === p.id)
      ? prev.filter((a) => a.id !== p.id)
      : [...prev, { id: p.id, name: `${p.first_name} ${p.last_name || ''}`.trim() }]
  ));

  const addTask = () => {
    if (!taskInput.trim()) return;
    setTasks((prev) => [...prev, taskInput.trim()]);
    setTaskInput('');
  };

  const save = async () => {
    if (!title.trim()) return alert('กรุณาตั้งชื่องาน');
    setSaving(true);
    try {
      // อัปโหลดรูปแนบ
      const urls = [];
      for (const file of imgFiles) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `card-cover/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('assembly').upload(path, file);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('assembly').getPublicUrl(path);
          urls.push(publicUrl);
        }
      }
      const payload = {
        images: [...existingImages, ...urls],
        title: title.trim(),
        detail: detail.trim() || null,
        priority,
        focus_date: focusToday ? localDate() : null,
        due_date: dueDate || null,
        assignees,
        ref_type: refType,
        ref_id: refId,
        ref_label: refLabel || null,
        updated_at: new Date().toISOString(),
      };
      if (isEdit) {
        const { error } = await supabase.from('work_cards').update(payload).eq('id', initialData.id);
        if (error) throw error;
        // ลบรายการเดิมที่กดลบไว้
        if (removedItemIds.length) await supabase.from('work_card_items').delete().in('id', removedItemIds);
        // ชิ้นส่วนที่เพิ่งเลือกเพิ่ม (ยังไม่อยู่ในการ์ด) → เพิ่มเข้าเช็คลิสต์
        const newParts = parts.filter((p) => selectedParts.has(p.id) && !existingPartIds.has(p.id));
        if (newParts.length) {
          await supabase.from('work_card_items').upsert(newParts.map((p, i) => ({
            card_id: initialData.id, title: p.title, kind: 'part', prep_item_id: p.id, sort_order: 200 + i, added_by: meRef(),
          })), { onConflict: 'prep_item_id', ignoreDuplicates: true });
        }
        // งานที่พิมพ์เพิ่มใหม่
        if (tasks.length) {
          await supabase.from('work_card_items').insert(tasks.map((t, i) => ({
            card_id: initialData.id, title: t, kind: 'task', sort_order: 300 + i, added_by: meRef(),
          })));
        }
        // เพิ่งติ๊กจากคิว → เข้าโฟกัสในหน้าแก้ไข = งานเพิ่งโผล่ใน timeline ช่าง → แจ้งผู้รับผิดชอบ
        if (focusToday && !initialData?.focus_date) {
          await notifyUsers({
            userIds: assignees.map((a) => a.id),
            title: `งานเข้าโฟกัสแล้ว: ${payload.title}`,
            body: refLabel ? `ผูกกับ ${refLabel}` : null,
            linkId: initialData.id,
            actorId: profile?.id,
          });
        }
        onSaved();
      } else {
        const { data: card, error } = await supabase.from('work_cards')
          .insert({ ...payload, status: 'todo', created_by: meRef() }).select().single();
        if (error) throw error;
        const partRows = parts.filter((p) => selectedParts.has(p.id)).map((p, i) => ({
          card_id: card.id, title: p.title, kind: 'part', prep_item_id: p.id, sort_order: i, added_by: meRef(),
        }));
        if (partRows.length) await supabase.from('work_card_items').upsert(partRows, { onConflict: 'prep_item_id', ignoreDuplicates: true });
        const taskRows = tasks.map((t, i) => ({ card_id: card.id, title: t, kind: 'task', sort_order: 100 + i, added_by: meRef() }));
        if (taskRows.length) await supabase.from('work_card_items').insert(taskRows);
        // แจ้งช่างเฉพาะตอนงานเข้าโฟกัส (โผล่ใน timeline จริง) — สร้างเข้าคิวเฉยๆ ยังไม่แจ้ง รอแจ้งตอนดึงเข้าโฟกัส
        if (focusToday) {
          await notifyUsers({
            userIds: assignees.map((a) => a.id),
            title: `งานใหม่เข้าโฟกัส: ${card.title}`,
            body: refLabel ? `ผูกกับ ${refLabel}` : null,
            linkId: card.id,
            actorId: profile?.id,
          });
        }
        onSaved(card);
      }
    } catch (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); }
    finally { setSaving(false); }
  };

  const inputClass = 'w-full px-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-400 rounded-xl transition-all outline-none text-gray-800';
  const labelClass = 'block text-xs font-bold text-gray-500 mb-1.5 ml-1';

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 flex items-center justify-center p-3 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[94vh]">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 rounded-t-3xl">
          <h3 className="font-bold text-lg text-gray-900">{isEdit ? 'แก้ไขงาน' : 'สร้างงานใหม่'}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-400"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ชื่องาน */}
          <div>
            <label className={labelClass}>ชื่องาน *</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ประกอบ TOGETHER คันสีเทา รอบเดินสายไฟ" className={inputClass + ' text-base font-semibold'} />
          </div>

          {/* รายละเอียด */}
          <div>
            <label className={labelClass}>รายละเอียด (ไม่บังคับ)</label>
            <textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="อธิบายงานเพิ่มเติม..." className={inputClass} />
          </div>

          {/* รูปแนบ (หลายรูปได้) */}
          <div>
            <label className={labelClass}>รูปแนบงาน (แนบได้หลายรูป)</label>
            <div className="flex gap-2 flex-wrap">
              {existingImages.map((img, i) => (
                <span key={`e${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                  <img src={img} className="w-full h-full object-cover" />
                  <button onClick={() => setExistingImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X size={11} /></button>
                </span>
              ))}
              {imgFiles.map((f, i) => (
                <span key={`n${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-indigo-200">
                  <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                  <button onClick={() => setImgFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X size={11} /></button>
                </span>
              ))}
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 flex flex-col items-center justify-center gap-1 cursor-pointer text-gray-400 hover:text-indigo-500 transition-all">
                <ImageIcon size={20} />
                <span className="text-[10px] font-bold">เพิ่มรูป</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []); // ต้องอ่านไฟล์ก่อนเคลียร์ค่า ไม่งั้นรูปหาย
                    if (files.length) setImgFiles((prev) => [...prev, ...files]);
                    e.target.value = '';
                  }} />
              </label>
            </div>
          </div>

          {/* ผูกกับงาน — สร้างใหม่ก็ผูกได้ แก้ไขทีหลังก็ผูกได้ */}
          {(
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
              <label className={labelClass + ' mb-0'}>ผูกกับคำสั่งซื้อ / งานซ่อม (ไม่ผูกก็ได้)</label>
              {refId ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-xl text-sm font-bold">
                    <Link2 size={14} /> {refLabel}
                  </span>
                  <button onClick={clearRef} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1">เอาออก</button>
                </div>
              ) : refPicking ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input autoFocus value={refSearch} onChange={(e) => setRefSearch(e.target.value)}
                      placeholder={refPicking === 'order' ? 'ค้นหา: รุ่นรถ / ชื่อลูกค้า / เลขออเดอร์...' : 'ค้นหา: อาการ / ชื่อลูกค้า / เลขใบงาน...'}
                      className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400" />
                    <button onClick={() => setRefPicking(null)} className="absolute right-2 top-2 p-1 text-gray-400 hover:bg-gray-100 rounded-full"><X size={16} /></button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1.5">
                    {refResults.map((r) => {
                      const mainName = refPicking === 'order' ? r.order_items?.[0]?.product_name : r.service_items?.[0]?.description;
                      const extraCount = (refPicking === 'order' ? r.order_items?.length : r.service_items?.length) - 1;
                      const jobImg = jobImgOf(r);
                      const custImg = custImgOf(r.customer_cache);
                      const custName = `${r.customer_cache?.first_name || ''} ${r.customer_cache?.last_name || ''}`.trim() || r.customer_cache?.nickname || '-';
                      return (
                        <button key={r.id} onClick={() => pickRef(refPicking, r)}
                          className="w-full flex items-center gap-3 p-2.5 bg-white hover:bg-indigo-50 rounded-xl border border-gray-100 hover:border-indigo-200 text-left transition-all">
                          {/* รูปงาน / รถ */}
                          <span className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                            {jobImg ? <img src={jobImg} className="w-full h-full object-cover" /> : <Package size={20} className="text-gray-300" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900 truncate">
                              {mainName || '(ไม่ระบุสินค้า)'}{extraCount > 0 ? ` +${extraCount}` : ''}
                              {' '}<TagChips tags={myTags} itemTagIds={refTagLinks[String(r.id)] || refTagLinks[r.id] || []} />
                            </p>
                            <p className="text-[11px] text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                              <span className="w-4 h-4 rounded-full overflow-hidden bg-gray-200 shrink-0 flex items-center justify-center text-[8px] font-bold text-gray-500">
                                {custImg ? <img src={custImg} className="w-full h-full object-cover" /> : (custName[0] || '?')}
                              </span>
                              <span className="truncate">{custName}</span>
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{refPicking === 'order' ? r.order_number : r.service_number}</p>
                          </div>
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full shrink-0">
                            {REF_STATUS_TH[r.status] || r.status}
                          </span>
                        </button>
                      );
                    })}
                    {refResults.length === 0 && <p className="text-xs text-gray-400 text-center py-3">— ไม่พบ (แสดงเฉพาะงานที่มัดจำ/จ่ายเงิน/ตกลงทำแล้ว และยังไม่จบ) —</p>}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setRefPicking('order')} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 hover:border-indigo-300 text-sm font-bold text-gray-600">ผูกคำสั่งซื้อ</button>
                  <button onClick={() => setRefPicking('service')} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 hover:border-indigo-300 text-sm font-bold text-gray-600">ผูกงานซ่อม</button>
                </div>
              )}

              {/* เลือกชิ้นส่วนรอบนี้ */}
              {refId && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-gray-500 ml-1 pt-1">รอบนี้ประกอบชิ้นไหนบ้าง (แตะเลือก — ชิ้นที่ประกอบแล้วเลือกซ้ำไม่ได้)</p>
                  {partsLoading ? (
                    <p className="text-xs text-gray-400 py-2 flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> กำลังโหลดชิ้นส่วน...</p>
                  ) : parts.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1">งานนี้ยังไม่มีเช็คลิสต์เตรียมของ — ใช้เช็คลิสต์พิมพ์เองด้านล่างแทนได้</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1">
                      {parts.map((p) => {
                        const assembled = Boolean(p.assembled_at);
                        const inCard = existingPartIds.has(p.id);
                        const inOther = !inCard && usedPartIds.has(p.id); // อยู่ในการ์ดรอบอื่น
                        const sel = selectedParts.has(p.id);
                        const locked = assembled || inCard || inOther;
                        return (
                          <button key={p.id} disabled={locked} onClick={() => togglePart(p.id)}
                            className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left text-sm transition-all ${locked ? 'border-gray-100 bg-gray-50 opacity-60' : sel ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${sel || inCard ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 bg-white'}`}>
                              {(sel || inCard) && <Check size={13} className="text-white" strokeWidth={3} />}
                            </span>
                            <span className={`flex-1 truncate ${assembled ? 'line-through text-gray-400' : 'text-gray-800'}`}>{p.title}</span>
                            {assembled
                              ? <span className="text-[10px] font-bold text-gray-400 shrink-0">ประกอบแล้ว</span>
                              : inCard
                                ? <span className="text-[10px] font-bold text-indigo-400 shrink-0">อยู่ในการ์ดแล้ว</span>
                                : inOther
                                  ? <span className="text-[10px] font-bold text-gray-400 shrink-0">อยู่ในการ์ดรอบอื่น</span>
                                  : <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${p.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.status === 'done' ? 'ของพร้อม' : 'ของยังไม่พร้อม'}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* เช็คลิสต์พิมพ์เอง */}
          {(
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass + ' mb-0'}>เช็คลิสต์งาน (พิมพ์เพิ่มได้เรื่อย ๆ)</label>
                <div className="flex items-center gap-1.5">
                  {/* ดึงเทมเพลต */}
                  <div className="relative">
                    <button type="button" onClick={() => setTplOpen((v) => !v)}
                      className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                      <LayoutTemplate size={12} /> ดึงเทมเพลต
                    </button>
                    {tplOpen && (
                      <>
                        <span className="fixed inset-0 z-[96]" onClick={() => setTplOpen(false)} />
                        <div className="absolute right-0 top-9 z-[97] w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                          <div className="px-3.5 py-2 border-b bg-gray-50 text-xs font-bold text-gray-600">เทมเพลตเช็คลิสต์ (ทั้งทีมใช้ร่วมกัน)</div>
                          <div className="max-h-56 overflow-y-auto">
                            {templates.length === 0 && <p className="text-[11px] text-gray-400 text-center py-5 px-3">ยังไม่มีเทมเพลต — พิมพ์เช็คลิสต์แล้วกด "บันทึกเป็นเทมเพลต" ไว้ใช้ครั้งหน้า</p>}
                            {templates.map((tpl) => (
                              <div key={tpl.id} className="flex items-center border-b border-gray-50 hover:bg-indigo-50/50 group">
                                <button type="button" onClick={() => applyTemplate(tpl)} className="flex-1 text-left px-3.5 py-2.5 min-w-0">
                                  <p className="text-xs font-bold text-gray-800 truncate">{tpl.name}</p>
                                  <p className="text-[10px] text-gray-400">{Array.isArray(tpl.items) ? tpl.items.length : 0} รายการ · โดย {tpl.created_by?.name?.split(' ')[0] || '-'}</p>
                                </button>
                                {(isBoss || tpl.created_by?.id === profile?.id) && (
                                  <button type="button" onClick={() => deleteTemplate(tpl)} className="p-2 mr-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {/* บันทึกเป็นเทมเพลต */}
                  {tasks.length > 0 && (
                    <button type="button" onClick={saveAsTemplate}
                      className="text-[11px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                      <Bookmark size={12} /> บันทึกเป็นเทมเพลต
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {/* เช็คลิสต์เดิมของการ์ด (ตอนแก้ไข) */}
                {existingItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${it.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                      {it.done && <Check size={11} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className={`flex-1 text-sm ${it.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {it.title}
                      {it.kind === 'part' && <span className="ml-1.5 text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">ชิ้นส่วนรถ</span>}
                    </span>
                    {!it.done && <button onClick={() => removeExisting(it)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>}
                  </div>
                ))}
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-3 py-2">
                    <span className="w-4 h-4 rounded border-2 border-gray-300 shrink-0" />
                    <span className="flex-1 text-sm text-gray-800">{t}</span>
                    <button onClick={() => setTasks((prev) => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input value={taskInput} onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                    placeholder="พิมพ์งานที่ต้องทำ แล้วกด Enter..." className={inputClass + ' py-2.5'} />
                  <button onClick={addTask} className="bg-gray-900 text-white px-4 rounded-xl shrink-0"><Plus size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {/* มอบหมาย */}
          <div>
            <label className={labelClass}>มอบหมายให้ (ไม่เลือก = งานกลาง ใครว่างหยิบได้)</label>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const on = assignees.some((a) => a.id === p.id);
                const load = workload[p.id] || 0;
                return (
                  <button key={p.id} onClick={() => toggleAssignee(p)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${on ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <span className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.first_name?.[0] || '?')}
                    </span>
                    {p.first_name}
                    {load > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${load >= WIP_LIMIT ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                        {load} ค้าง
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {overloaded.length > 0 && (
              <p className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-2">
                ⚠️ {overloaded.map((a) => `${a.name?.split(' ')[0]} (ค้าง ${workload[a.id]} งาน)`).join(', ')} — งานค้างเยอะแล้ว มอบหมายเพิ่มได้แต่ควรเช็คก่อนว่ารับไหว
              </p>
            )}
          </div>

          {/* ตัวเลือก */}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setFocusToday((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${focusToday ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500'}`}>
              <CalendarDays size={16} /> {focusToday ? 'ทำวันนี้' : 'เข้าคิวงานไว้ก่อน'}
            </button>
            <button onClick={() => setPriority((p) => (p === 'urgent' ? 'normal' : 'urgent'))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${priority === 'urgent' ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500'}`}>
              <Flag size={16} /> {priority === 'urgent' ? 'งานด่วน' : 'ปกติ'}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">เสร็จภายใน</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none border border-transparent focus:border-indigo-400" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-3xl flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-600 font-bold">ยกเลิก</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'บันทึก' : 'สร้างงาน'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkCardForm;
