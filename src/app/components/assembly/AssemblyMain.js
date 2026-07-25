'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Hammer, Plus, Loader2, Clock, Flag, Link2, Inbox, CheckCircle2, Target, ArrowUp, ArrowDown, ShoppingCart, History, ClipboardCheck, BarChart3, Trophy, LayoutGrid, List as ListIcon, Wrench, Bike, GripVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import WorkCardForm from './WorkCardForm';
import WorkCardDetail from './WorkCardDetail';
import TagControl, { TagChips, firstTagColor } from '@/app/components/common/TagControl';
import { fetchUserTags, createTag, deleteTag, fetchTagLinks, toggleTagLink } from '@/lib/userTags';
import { notifyUsers } from './workNotify';

// ระบบงานประกอบ (ก.ค. 2026): บอร์ด "งาน Focus ช่วงนี้" สองคอลัมน์
// ซ้าย = มอบหมายแล้วยังไม่เสร็จ | ขวา = เสร็จแล้วรอตรวจ → ตรวจแล้ว "ยกออก" เข้าประวัติ
// คิวงาน = งานที่ยังไม่ถึงคิว ดึงเข้ามาโฟกัสทีละไม่มาก
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STATUS_META = {
  todo: { label: 'ยังไม่เสร็จ', chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-400' },
  doing: { label: 'ยังไม่เสร็จ', chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-400' },
  blocked: { label: 'ยังไม่เสร็จ', chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-400' },
  done: { label: 'เสร็จแล้ว', chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
};

// ประเภทงาน — ให้เห็นชัดว่าใบไหนซ่อม ใบไหนประกอบรถใหม่
const TYPE_META = {
  service: { label: 'งานซ่อม', chip: 'bg-orange-500 text-white', Icon: Wrench },
  order: { label: 'ประกอบรถใหม่', chip: 'bg-indigo-600 text-white', Icon: Bike },
  none: { label: 'งานทั่วไป', chip: 'bg-slate-500 text-white', Icon: Hammer },
};
const typeOf = (c) => TYPE_META[c.ref_type === 'service' ? 'service' : c.ref_type === 'order' ? 'order' : 'none'];

const ageText = (from) => {
  const days = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86400000));
  if (days < 1) return 'วันนี้';
  if (days < 30) return `${days} วัน`;
  const m = Math.floor(days / 30);
  if (m < 12) return `${m} เดือน`;
  return `${Math.floor(m / 12)} ปี ${m % 12} ด.`;
};

const AssemblyMain = ({ initialNavData = null }) => {
  const { profile, can } = useAuth();
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState({});
  const [refData, setRefData] = useState({}); // ข้อมูลออเดอร์/งานซ่อมที่การ์ดผูกอยู่: ลูกค้า รายการ รูป หมายเหตุ
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('focus'); // focus | queue | history
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editCard, setEditCard] = useState(null);

  // มุมมองการ์ด/ลิสต์ (จำค่าไว้ในเครื่อง)
  const [view, setView] = useState(() => { try { return localStorage.getItem('asm_view') || 'card'; } catch { return 'card'; } });
  const setViewPersist = (v) => { setView(v); try { localStorage.setItem('asm_view', v); } catch { /* ignore */ } };

  // Tag ส่วนตัว (เหมือนหน้าขาย/งานซ่อม — ของใครของมัน)
  const [myTags, setMyTags] = useState([]);
  const [tagLinks, setTagLinks] = useState({});
  const [tagFilter, setTagFilter] = useState('');
  useEffect(() => {
    if (!profile?.id) return;
    fetchUserTags(profile.id).then(setMyTags);
    fetchTagLinks(profile.id, 'work_card').then(setTagLinks);
  }, [profile?.id]);
  const handleToggleTag = async (cardId, tagId) => {
    setTagLinks((prev) => {
      const cur = prev[cardId] || [];
      return { ...prev, [cardId]: cur.includes(tagId) ? cur.filter((t) => t !== tagId) : [...cur, tagId] };
    });
    try { await toggleTagLink(tagId, 'work_card', cardId); } catch { fetchTagLinks(profile.id, 'work_card').then(setTagLinks); }
  };
  const handleCreateTag = async (name, color) => {
    const t = await createTag(profile.id, name, color);
    setMyTags((prev) => [...prev, t]);
    return t;
  };
  const handleDeleteTag = async (tagId) => {
    await deleteTag(tagId);
    setMyTags((prev) => prev.filter((t) => t.id !== tagId));
    fetchTagLinks(profile.id, 'work_card').then(setTagLinks);
  };

  // ลากจัดลำดับเอง
  const dragRef = useRef(null);
  const [dragOverId, setDragOverId] = useState(null); // ไฮไลต์ใบที่กำลังจะวางทับ

  // FLIP animation: จำตำแหน่งเดิมของทุกการ์ด แล้วให้มัน "ไหล" ไปตำแหน่งใหม่แทนการวาร์ป
  const flipNodes = useRef(new Map()); // id → element
  const flipRects = useRef(new Map()); // id → ตำแหน่งล่าสุด
  const flipRef = (id) => (el) => { if (el) flipNodes.current.set(id, el); else flipNodes.current.delete(id); };
  useLayoutEffect(() => {
    const next = new Map();
    flipNodes.current.forEach((el, id) => { if (el.isConnected) next.set(id, el.getBoundingClientRect()); });
    next.forEach((rect, id) => {
      const prev = flipRects.current.get(id);
      const el = flipNodes.current.get(id);
      if (!prev || !el) return;
      const dx = prev.left - rect.left;
      const dy = prev.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 320ms cubic-bezier(.2,.8,.2,1)';
        el.style.transform = '';
        const clear = () => { el.style.transition = ''; el.removeEventListener('transitionend', clear); };
        el.addEventListener('transitionend', clear);
      });
    });
    flipRects.current = next;
  });
  const sortCards = (list) => [...list].sort((a, b) =>
    ((a.sort_order ?? 1e9) - (b.sort_order ?? 1e9))
    || ((b.priority === 'urgent') - (a.priority === 'urgent'))
    || (new Date(a.created_at) - new Date(b.created_at)));
  const dropOn = async (zoneList, targetId) => {
    const dragId = dragRef.current; dragRef.current = null;
    if (!dragId || dragId === targetId) return;
    const ids = zoneList.map((c) => c.id);
    if (!ids.includes(dragId)) return; // ลากข้ามโซนไม่ได้ (ใช้ปุ่มดึงเข้าโฟกัส/พักแทน)
    const arr = ids.filter((id) => id !== dragId);
    const ti = targetId ? arr.indexOf(targetId) : arr.length;
    arr.splice(ti === -1 ? arr.length : ti, 0, dragId);
    const orderMap = {}; arr.forEach((id, i) => { orderMap[id] = (i + 1) * 10; });
    setCards((prev) => prev.map((c) => (orderMap[c.id] != null ? { ...c, sort_order: orderMap[c.id] } : c)));
    await Promise.all(arr.map((id) => supabase.from('work_cards').update({ sort_order: orderMap[id] }).eq('id', id)));
  };

  // สถิติช่าง
  const [statsPeriod, setStatsPeriod] = useState('month'); // day | month | 30d | all
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsDate, setStatsDate] = useState(localDate()); // วันที่ดูแบบรายวัน
  const [daily, setDaily] = useState(null); // ไทม์ไลน์รายคนของวันนั้น
  const [statsOpenId, setStatsOpenId] = useState(null); // แถวสถิติที่กดกางดูรายละเอียด

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase.from('work_cards').select('*')
      .order('priority', { ascending: false }).order('created_at', { ascending: true });
    setCards(data || []);
    // ดึงข้อมูลงานที่ผูก (ลูกค้า/รุ่นรถ/รูป/หมายเหตุ) มาโชว์บนการ์ด — ดึงเป็นชุดเดียว
    try {
      const list = data || [];
      const toUrls = (arr) => (arr || []).map((v) => (typeof v === 'string' ? v : v?.url)).filter(Boolean);
      const oids = [...new Set(list.filter((c) => c.ref_type === 'order' && c.ref_id).map((c) => c.ref_id))];
      const sids = [...new Set(list.filter((c) => c.ref_type === 'service' && c.ref_id).map((c) => c.ref_id))];
      const m = {};
      if (oids.length) {
        const { data: os } = await supabase.from('orders').select('id, customer_cache, notes, images, order_items(product_name, quantity)').in('id', oids);
        (os || []).forEach((o) => { m[`order:${o.id}`] = { customer: o.customer_cache, notes: o.notes, images: toUrls(o.images), items: (o.order_items || []).map((x) => `${x.product_name}${x.quantity > 1 ? ` ×${x.quantity}` : ''}`).filter(Boolean) }; });
      }
      if (sids.length) {
        const { data: ss } = await supabase.from('services').select('id, customer_cache, notes, images, service_items(description)').in('id', sids);
        (ss || []).forEach((s) => { m[`service:${s.id}`] = { customer: s.customer_cache, notes: s.notes, images: toUrls(s.images), items: (s.service_items || []).map((x) => x.description).filter(Boolean) }; });
      }
      // นับสถานะของจากเช็คลิสต์เตรียมของ: พร้อมประกอบ (ยังไม่ทำ) / รอของ / ประกอบแล้ว
      const loadPrep = async (prepTable, itemTable, refCol, rids, typeKey) => {
        if (!rids.length) return;
        const { data: ps } = await supabase.from(prepTable).select(`id, ${refCol}`).in(refCol, rids);
        const prepIds = (ps || []).map((p) => p.id);
        if (!prepIds.length) return;
        const { data: its } = await supabase.from(itemTable).select('id, prep_id, status, kind, parent_item_id, assembled_at, no_assemble').in('prep_id', prepIds);
        const byPrep = {};
        (its || []).forEach((x) => { (byPrep[x.prep_id] = byPrep[x.prep_id] || []).push(x); });
        (ps || []).forEach((p) => {
          const all = byPrep[p.id] || [];
          const hasChild = (xid) => all.some((y) => y.parent_item_id === xid);
          const leaves = all.filter((x) => (x.kind !== 'product' || !hasChild(x.id)) && x.status !== 'skipped');
          const key = `${typeKey}:${p[refCol]}`;
          if (m[key]) m[key].prep = {
            // ไม่นับของเตรียมให้เฉยๆ (no_assemble) ใน "พร้อมประกอบ" — มันไม่ใช่งานติ๊ก
            ready: leaves.filter((x) => x.status === 'done' && !x.assembled_at && !x.no_assemble).length,
            waiting: leaves.filter((x) => x.status !== 'done' && !x.assembled_at).length,
            assembled: leaves.filter((x) => x.assembled_at).length,
          };
        });
      };
      await loadPrep('order_preps', 'order_prep_items', 'order_id', oids, 'order');
      await loadPrep('service_preps', 'service_prep_items', 'service_id', sids, 'service');
      setRefData(m);
    } catch { /* ignore */ }
    try {
      const ids = (data || []).map((c) => c.id);
      if (ids.length) {
        const { data: its } = await supabase.from('work_card_items').select('card_id, kind, done').in('card_id', ids);
        const m = {};
        (its || []).forEach((it) => {
          const s = (m[it.card_id] = m[it.card_id] || { total: 0, done: 0, matPending: 0 });
          if (it.kind === 'material') { if (!it.done) s.matPending += 1; }
          else { s.total += 1; if (it.done) s.done += 1; }
        });
        setStats(m);
      } else setStats({});
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // เปิดการ์ดที่ถูกส่งมาจากหน้าอื่น (กระดิ่งแจ้งเตือน / แถบงานประกอบในออเดอร์)
  useEffect(() => {
    if (initialNavData?.target === 'work_card' && initialNavData.id) {
      supabase.from('work_cards').select('*').eq('id', initialNavData.id).maybeSingle()
        .then(({ data }) => { if (data) setSelected(data); });
    }
  }, [initialNavData?.timestamp]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    let live = cards.filter((c) => !c.archived_at);
    if (tagFilter) live = live.filter((c) => (tagLinks[c.id] || []).includes(tagFilter)); // กรองตาม Tag ส่วนตัว
    return {
      doingCol: sortCards(live.filter((c) => c.focus_date && c.status !== 'done')),   // ซ้าย: โฟกัสอยู่ ยังไม่เสร็จ
      doneCol: sortCards(live.filter((c) => c.status === 'done')),                     // ขวา: เสร็จแล้ว รอตรวจ
      queue: sortCards(live.filter((c) => !c.focus_date && c.status !== 'done')),      // คิวงาน
      history: cards.filter((c) => c.archived_at).slice(0, 80),                        // ยกออกแล้ว
    };
  }, [cards, tagFilter, tagLinks]); // eslint-disable-line

  // ── สถิติช่าง: นับจากบันทึกการติ๊กจริง (ใครติ๊ก เมื่อไหร่) + เก็บรายละเอียดให้กดกางดูได้ ──
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const now = new Date();
      let from = null;
      if (statsPeriod === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      else if (statsPeriod === '30d') from = new Date(Date.now() - 30 * 86400000).toISOString();
      let cq = supabase.from('work_cards').select('title, ref_label, done_by, done_at, created_at').not('done_at', 'is', null);
      let iq = supabase.from('work_card_items').select('title, kind, done_by, done_at, work_cards(title)').eq('done', true).not('done_at', 'is', null);
      let opq = supabase.from('order_prep_items').select('title, prepared_by, prepared_at').not('prepared_at', 'is', null);
      let spq = supabase.from('service_prep_items').select('title, prepared_by, prepared_at').not('prepared_at', 'is', null);
      if (from) {
        cq = cq.gte('done_at', from); iq = iq.gte('done_at', from);
        opq = opq.gte('prepared_at', from); spq = spq.gte('prepared_at', from);
      }
      const [{ data: cs }, { data: its }, { data: ops }, { data: sps }] = await Promise.all([cq, iq, opq, spq]);
      const m = {};
      const ent = (p) => {
        if (!p?.id) return null;
        return (m[p.id] = m[p.id] || { id: p.id, name: p.name || '-', cards: 0, parts: 0, ticks: 0, preps: 0, durMs: 0, closedList: [], tickList: [], prepList: [] });
      };
      (cs || []).forEach((c) => {
        const e = ent(c.done_by); if (!e) return;
        e.cards += 1;
        e.closedList.push({ t: `${c.title}${c.ref_label ? ` · ${c.ref_label}` : ''}`, at: c.done_at });
        if (c.created_at && c.done_at) e.durMs += Math.max(0, new Date(c.done_at) - new Date(c.created_at));
      });
      (its || []).forEach((it) => {
        if (it.kind === 'material') return;
        const e = ent(it.done_by); if (!e) return;
        e.ticks += 1;
        if (it.kind === 'part') e.parts += 1;
        e.tickList.push({ t: `${it.title}${it.work_cards?.title ? ` (${it.work_cards.title})` : ''}`, at: it.done_at, part: it.kind === 'part' });
      });
      [...(ops || []), ...(sps || [])].forEach((r) => {
        const e = ent(r.prepared_by); if (!e) return;
        e.preps += 1;
        e.prepList.push({ t: r.title, at: r.prepared_at });
      });
      const byTime = (a, b) => new Date(b.at) - new Date(a.at); // ล่าสุดขึ้นก่อน
      setStatsData(Object.values(m).map((e) => ({
        ...e,
        closedList: e.closedList.sort(byTime),
        tickList: e.tickList.sort(byTime),
        prepList: e.prepList.sort(byTime),
      })).sort((a, b) => (b.parts * 2 + b.ticks + b.cards * 3 + b.preps) - (a.parts * 2 + a.ticks + a.cards * 3 + a.preps)));
    } finally { setStatsLoading(false); }
  }, [statsPeriod]);
  // สถิติรายวัน: ไทม์ไลน์รายคน — ชื่อ+รูป แล้วไล่เวลาว่ากี่โมงทำอะไรบ้าง
  const fetchDaily = useCallback(async () => {
    setStatsLoading(true);
    try {
      const start = new Date(`${statsDate}T00:00:00`);
      const end = new Date(start.getTime() + 86400000);
      const sISO = start.toISOString(); const eISO = end.toISOString();
      const [op, sp, closed, created, archived, ticks, cmts] = await Promise.all([
        supabase.from('order_prep_items').select('title, prepared_by, prepared_at').gte('prepared_at', sISO).lt('prepared_at', eISO),
        supabase.from('service_prep_items').select('title, prepared_by, prepared_at').gte('prepared_at', sISO).lt('prepared_at', eISO),
        supabase.from('work_cards').select('title, ref_label, done_by, done_at').gte('done_at', sISO).lt('done_at', eISO),
        supabase.from('work_cards').select('title, ref_label, created_by, created_at').gte('created_at', sISO).lt('created_at', eISO),
        supabase.from('work_cards').select('title, archived_by, archived_at').gte('archived_at', sISO).lt('archived_at', eISO),
        supabase.from('work_card_items').select('title, kind, done_by, done_at, work_cards(title)').eq('done', true).gte('done_at', sISO).lt('done_at', eISO),
        supabase.from('work_card_comments').select('body, created_by, created_at, parent_id, work_cards(title)').gte('created_at', sISO).lt('created_at', eISO),
      ]);
      const people = {};
      const add = (p, at, type, text) => {
        if (!p?.id || !at) return;
        const e = (people[p.id] = people[p.id] || { id: p.id, name: p.name || '-', avatar: null, events: [] });
        e.events.push({ at, type, text });
      };
      [...(op.data || []), ...(sp.data || [])].forEach((r) => add(r.prepared_by, r.prepared_at, 'prep', `เตรียมของ: ${r.title}`));
      (closed.data || []).forEach((c) => add(c.done_by, c.done_at, 'done', `ปิดงาน: ${c.title}${c.ref_label ? ` · ${c.ref_label}` : ''}`));
      (created.data || []).forEach((c) => add(c.created_by, c.created_at, 'create', `สั่งงาน/สร้างการ์ด: ${c.title}${c.ref_label ? ` · ${c.ref_label}` : ''}`));
      (archived.data || []).forEach((c) => add(c.archived_by, c.archived_at, 'check', `ตรวจงานผ่าน ยกออกบอร์ด: ${c.title}`));
      (ticks.data || []).forEach((t) => add(t.done_by, t.done_at,
        t.kind === 'material' ? 'mat' : 'tick',
        `${t.kind === 'material' ? 'จัดของให้' : t.kind === 'part' ? 'ประกอบ' : 'ทำเสร็จ'}: ${t.title}${t.work_cards?.title ? ` (${t.work_cards.title})` : ''}`));
      (cmts.data || []).forEach((c) => add(c.created_by, c.created_at, 'comment',
        `${c.parent_id ? 'ตอบกลับ' : 'คอมเมนต์'}ใน "${c.work_cards?.title || '-'}": ${String(c.body || 'แนบรูป').slice(0, 70)}`));
      // รูปโปรไฟล์
      const ids = Object.keys(people);
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', ids);
        (profs || []).forEach((pr) => { if (people[pr.id]) people[pr.id].avatar = pr.avatar_url; });
      }
      setDaily(Object.values(people)
        .map((p) => ({ ...p, events: p.events.sort((a, b) => new Date(a.at) - new Date(b.at)) }))
        .sort((a, b) => b.events.length - a.events.length));
    } finally { setStatsLoading(false); }
  }, [statsDate]);

  useEffect(() => {
    if (tab !== 'stats') return;
    if (statsPeriod === 'day') fetchDaily(); else fetchStats();
  }, [tab, statsPeriod, fetchStats, fetchDaily]);

  const shiftDay = (n) => {
    const d = new Date(`${statsDate}T00:00:00`);
    d.setDate(d.getDate() + n);
    setStatsDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const avgDur = (e) => {
    if (!e.cards) return '-';
    const h = e.durMs / e.cards / 3600000;
    if (h < 1) return '< 1 ชม.';
    if (h < 48) return `${Math.round(h)} ชม.`;
    return `${(h / 24).toFixed(1)} วัน`;
  };

  const pullToFocus = async (c) => {
    const fd = localDate();
    setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, focus_date: fd } : x)));
    await supabase.from('work_cards').update({ focus_date: fd, updated_at: new Date().toISOString() }).eq('id', c.id);
    // งานเพิ่งโผล่ใน timeline ช่าง → แจ้งผู้รับผิดชอบตอนนี้ (ตอนสร้างเข้าคิวไม่แจ้ง / คนกดเองไม่ได้รับ)
    await notifyUsers({
      userIds: (c.assignees || []).map((a) => a?.id),
      title: `งานเข้าโฟกัสแล้ว: ${c.title}`,
      body: 'งานขึ้นใน timeline ของคุณแล้ว เริ่มทำได้เลย',
      linkId: c.id,
      actorId: profile?.id,
    });
  };
  const backToQueue = async (c) => {
    setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, focus_date: null } : x)));
    await supabase.from('work_cards').update({ focus_date: null, updated_at: new Date().toISOString() }).eq('id', c.id);
  };
  // ตรวจเช็คเรียบร้อย → ยกออกจากบอร์ด เข้าประวัติ
  const archiveCard = async (c) => {
    const patch = { archived_at: new Date().toISOString(), archived_by: meRef() };
    setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    await supabase.from('work_cards').update(patch).eq('id', c.id);
  };

  // ── การ์ดใบเดียวบนบอร์ด ──
  const CardTile = ({ c, zone, zoneList = [] }) => {
    const st = stats[c.id] || { total: 0, done: 0, matPending: 0 };
    const meta = STATUS_META[c.status] || STATUS_META.todo;
    const mine = (c.assignees || []).some((a) => a.id === profile?.id);
    const tm = typeOf(c);
    const cardTagIds = tagLinks[c.id] || [];
    const tagColor = firstTagColor(myTags, cardTagIds);
    const ref = c.ref_type && c.ref_id ? refData[`${c.ref_type}:${c.ref_id}`] : null;
    const rawCust = ref?.customer?.images?.[0];
    const custImg = typeof rawCust === 'string' ? rawCust : rawCust?.url || null;
    const custName = ref ? (`${ref.customer?.first_name || ''} ${ref.customer?.last_name || ''}`.trim() || '-') : '';
    const allImgs = [...(c.images || []), ...(ref?.images || [])];
    // อยู่ในระบบมากี่วันแล้ว (นับจากวันที่ดึงเข้าโฟกัส ถ้าไม่มีนับจากวันสร้าง) — ตัวเลขใหญ่มุมขวาบน
    const from = c.focus_date ? new Date(c.focus_date) : new Date(c.created_at);
    const days = Math.max(0, Math.floor((Date.now() - from.getTime()) / 86400000));
    const ageNum = days < 31 ? days : days < 365 ? Math.floor(days / 30) : Math.floor(days / 365);
    const ageUnit = days < 31 ? 'วัน' : days < 365 ? 'เดือน' : 'ปี';
    const ageTone = days >= 7 ? 'bg-red-50 text-red-600 border-red-200' : days >= 3 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200';
    const isPolish = c.rework_count > 0 && c.status !== 'done'; // การ์ดที่ถูกส่งกลับมาเก็บงาน — ต้องเด่น
    return (
      <div onClick={() => setSelected(c)}
        ref={flipRef(c.id)}
        draggable
        onDragStart={() => { dragRef.current = c.id; }}
        onDragOver={(e) => { e.preventDefault(); if (dragRef.current && dragRef.current !== c.id) setDragOverId(c.id); }}
        onDragLeave={() => setDragOverId((p) => (p === c.id ? null : p))}
        onDragEnd={() => { setDragOverId(null); dragRef.current = null; }}
        onDrop={(e) => { e.preventDefault(); setDragOverId(null); dropOn(zoneList, c.id); }}
        className={`w-full text-left bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-4 relative cursor-pointer ${dragOverId === c.id ? 'ring-2 ring-teal-400 border-teal-300' : isPolish ? 'border-violet-300 ring-2 ring-violet-200 bg-violet-50/40' : mine ? 'border-indigo-200' : 'border-gray-100'}`}
        style={!isPolish && tagColor ? { backgroundColor: `${tagColor}10`, borderColor: `${tagColor}66` } : undefined}>
        <span className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${isPolish ? 'bg-violet-500' : meta.bar}`} />
        {/* แถบม่วงเด่นๆ: งานถูกส่งกลับมาเก็บเพิ่ม */}
        {isPolish && (
          <div className="-mx-4 -mt-4 mb-2.5 px-4 py-2 bg-violet-500 text-white text-[11px] font-bold flex items-center gap-1.5 rounded-t-2xl">
            ✨ กลับมาเก็บงานเพิ่ม รอบ #{c.rework_count} — เปิดดูคอมเมนต์ว่าต้องเก็บจุดไหน
          </div>
        )}
        {/* ตัวเลขวันชัดๆ มุมขวาบน */}
        <span title={`${c.focus_date ? 'เข้าโฟกัสเมื่อ' : 'สร้างเมื่อ'} ${from.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} · ${days} วันแล้ว`}
          className={`absolute ${isPolish ? 'top-11' : 'top-2.5'} right-2.5 flex flex-col items-center justify-center leading-none rounded-xl border px-2.5 py-1.5 ${ageTone}`}>
          <span className="text-lg font-black">{days === 0 ? '•' : ageNum}</span>
          <span className="text-[9px] font-bold mt-0.5">{days === 0 ? 'วันนี้' : ageUnit}</span>
        </span>
        <div className="pl-2">
          <div className="flex items-center gap-1.5 flex-wrap pr-12">
            {/* ประเภทงานชัดๆ: ซ่อม ส้ม / ประกอบรถใหม่ น้ำเงิน / ทั่วไป เทา */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${tm.chip}`}><tm.Icon size={10} /> {tm.label}</span>
            {c.priority === 'urgent' && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Flag size={9} /> ด่วน</span>}
            {c.ref_label && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Link2 size={9} /> {c.ref_label}</span>}
            <TagChips tags={myTags} itemTagIds={cardTagIds} />
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.chip}`}>{meta.label}</span>
            {st.matPending > 0 && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ShoppingCart size={9} /> ขอของเพิ่ม {st.matPending}</span>}
            {c.rework_count > 0 && c.status === 'done' && (
              <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                ✨ เก็บงานแล้ว รอตรวจใหม่
              </span>
            )}
          </div>
          <p className="font-bold text-gray-900 mt-1.5 leading-snug pr-12">{c.title}</p>

          {/* ลูกค้า + รุ่นรถ/อาการ จากออเดอร์ที่ผูก — รู้เลยว่าคันไหน */}
          {ref && (
            <div className="mt-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-5 h-5 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center text-[9px] font-bold text-gray-500">
                  {custImg ? <img src={custImg} draggable={false} className="w-full h-full object-cover" /> : (custName[0] || '?')}
                </span>
                <span className="text-xs font-semibold text-gray-700 truncate">
                  {custName}{ref.customer?.nickname ? ` (${ref.customer.nickname})` : ''}
                </span>
              </div>
              {ref.items.length > 0 && (
                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                  {c.ref_type === 'service' ? '🔧' : '🛵'} {ref.items[0]}{ref.items.length > 1 ? ` +${ref.items.length - 1}` : ''}
                </p>
              )}
              {ref.notes && <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-1 mt-1 line-clamp-2">📝 {ref.notes}</p>}
              {/* สถานะของ: พร้อมประกอบ (ยังไม่ทำ) / รอของ / ประกอบแล้ว */}
              {ref.prep && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {ref.prep.ready > 0 && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">พร้อมประกอบ {ref.prep.ready}</span>}
                  {ref.prep.waiting > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">รอเตรียมของ {ref.prep.waiting}</span>}
                  {ref.prep.assembled > 0 && <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">ประกอบแล้ว {ref.prep.assembled}</span>}
                </div>
              )}
            </div>
          )}

          {allImgs.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {allImgs.slice(0, 3).map((img, i) => (
                <img key={i} src={img} draggable={false} className="w-12 h-12 rounded-lg object-cover border border-gray-100" />
              ))}
              {allImgs.length > 3 && <span className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">+{allImgs.length - 3}</span>}
            </div>
          )}
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="min-w-0">
              {(c.assignees || []).length > 0
                ? <span className="text-xs text-gray-500 truncate block">{c.assignees.map((a) => a.name?.split(' ')[0]).join(', ')}</span>
                : <span className="text-xs text-teal-600 font-semibold">งานกลาง — ใครว่างรับได้</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {st.total > 0 && <span className={`text-[11px] font-bold ${st.done === st.total ? 'text-emerald-600' : 'text-gray-500'}`}>{st.done}/{st.total}</span>}
              <span className="text-[11px] text-gray-400 flex items-center gap-0.5"><Clock size={10} /> {ageText(c.created_at)}</span>
            </div>
          </div>
          {st.total > 0 && (
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className={`h-full rounded-full ${st.done === st.total ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.round((st.done / st.total) * 100)}%` }} />
            </div>
          )}

          {/* ปุ่มลัดตามโซน */}
          <div className="flex items-center gap-1.5 mt-2.5" onClick={(e) => e.stopPropagation()}>
            <TagControl tags={myTags} itemTagIds={cardTagIds}
              onToggle={(tagId) => handleToggleTag(c.id, tagId)} onCreate={handleCreateTag} onDeleteTag={handleDeleteTag} align="left" />
            {zone === 'queue' && (
              <button onClick={() => pullToFocus(c)}
                className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 active:scale-95">
                <ArrowUp size={11} /> ดึงเข้ามาโฟกัส
              </button>
            )}
            {zone === 'doing' && (
              <button onClick={() => backToQueue(c)}
                className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                <ArrowDown size={11} /> พักกลับเข้าคิว
              </button>
            )}
            {zone === 'done' && (
              <button onClick={() => { if (confirm(`ตรวจงาน "${c.title}" เรียบร้อยแล้ว ยกออกจากบอร์ด?`)) archiveCard(c); }}
                className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95">
                <ClipboardCheck size={12} /> ตรวจแล้ว ยกออก
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // แท็บคิวงาน/ประวัติ/สถิติ — เปิดปิดต่อตำแหน่งได้ที่ จัดการทีมงาน → สิทธิ์การใช้งาน
  // ── แถวลิสต์ (มุมมองลิสต์) ──
  const ListRow = ({ c, zone, zoneList = [] }) => {
    const st = stats[c.id] || { total: 0, done: 0, matPending: 0 };
    const tm = typeOf(c);
    const ref = c.ref_type && c.ref_id ? refData[`${c.ref_type}:${c.ref_id}`] : null;
    const custName = ref ? (`${ref.customer?.first_name || ''} ${ref.customer?.last_name || ''}`.trim()) : '';
    const cardTagIds = tagLinks[c.id] || [];
    const tagColor = firstTagColor(myTags, cardTagIds);
    const from = c.focus_date ? new Date(c.focus_date) : new Date(c.created_at);
    const days = Math.max(0, Math.floor((Date.now() - from.getTime()) / 86400000));
    const isPolish = c.rework_count > 0 && c.status !== 'done';
    return (
      <div onClick={() => setSelected(c)} draggable
        ref={flipRef(c.id)}
        onDragStart={() => { dragRef.current = c.id; }}
        onDragOver={(e) => { e.preventDefault(); if (dragRef.current && dragRef.current !== c.id) setDragOverId(c.id); }}
        onDragLeave={() => setDragOverId((p) => (p === c.id ? null : p))}
        onDragEnd={() => { setDragOverId(null); dragRef.current = null; }}
        onDrop={(e) => { e.preventDefault(); setDragOverId(null); dropOn(zoneList, c.id); }}
        className={`flex items-center gap-2.5 px-3 py-2.5 bg-white border rounded-xl cursor-pointer hover:shadow-sm transition-all ${dragOverId === c.id ? 'ring-2 ring-teal-400 border-teal-300' : isPolish ? 'border-violet-300 ring-1 ring-violet-200' : 'border-gray-100'}`}
        style={!isPolish && tagColor ? { backgroundColor: `${tagColor}10`, boxShadow: `inset 4px 0 0 ${tagColor}` } : undefined}>
        <GripVertical size={14} className="text-gray-200 shrink-0 cursor-grab" title="ลากเพื่อจัดลำดับ" />
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${tm.chip}`}><tm.Icon size={10} /> {tm.label}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{c.title} <TagChips tags={myTags} itemTagIds={cardTagIds} /></p>
          <p className="text-[11px] text-gray-400 truncate">
            {custName}{c.ref_label ? ` · ${c.ref_label}` : ''}
            {isPolish ? <span className="text-violet-600 font-bold"> · ✨ รอบเก็บงาน #{c.rework_count}</span> : ''}
          </p>
        </div>
        {ref?.prep?.ready > 0 && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">พร้อม {ref.prep.ready}</span>}
        {st.matPending > 0 && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full shrink-0">ขอของ {st.matPending}</span>}
        {st.total > 0 && <span className={`text-[11px] font-bold shrink-0 ${st.done === st.total ? 'text-emerald-600' : 'text-gray-500'}`}>{st.done}/{st.total}</span>}
        <span className={`text-[11px] font-bold shrink-0 ${days >= 7 ? 'text-red-500' : days >= 3 ? 'text-amber-500' : 'text-gray-400'}`}>{days === 0 ? 'วันนี้' : `${days} วัน`}</span>
        <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <TagControl tags={myTags} itemTagIds={cardTagIds}
            onToggle={(tagId) => handleToggleTag(c.id, tagId)} onCreate={handleCreateTag} onDeleteTag={handleDeleteTag} align="right" />
          {zone === 'queue' && <button onClick={() => pullToFocus(c)} className="text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded-lg active:scale-95">ดึงเข้าโฟกัส</button>}
          {zone === 'doing' && <button onClick={() => backToQueue(c)} className="text-[11px] font-semibold text-gray-400 hover:bg-gray-100 px-2 py-1 rounded-lg">พัก</button>}
          {zone === 'done' && <button onClick={() => { if (confirm(`ตรวจงาน "${c.title}" เรียบร้อยแล้ว ยกออกจากบอร์ด?`)) archiveCard(c); }} className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded-lg active:scale-95">ตรวจแล้ว ยกออก</button>}
        </div>
      </div>
    );
  };

  const renderZoneItems = (list, zone) => (view === 'list'
    ? list.map((c) => <ListRow key={c.id} c={c} zone={zone} zoneList={list} />)
    : list.map((c) => <CardTile key={c.id} c={c} zone={zone} zoneList={list} />));

  const TABS = [
    { id: 'focus', label: `งาน Focus (${grouped.doingCol.length + grouped.doneCol.length})`, icon: Target },
    ...(can('assembly', 'queue') ? [{ id: 'queue', label: `คิวงาน (${grouped.queue.length})`, icon: Inbox }] : []),
    ...(can('assembly', 'history') ? [{ id: 'history', label: 'ประวัติ', icon: History }] : []),
    ...(can('assembly', 'stats') ? [{ id: 'stats', label: 'สถิติ', icon: BarChart3 }] : []),
  ];

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-slate-700 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center shrink-0"><Hammer size={22} /></div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">งานประกอบ</h1>
            <p className="text-slate-300 text-xs sm:text-sm truncate">กำลังทำ {grouped.doingCol.length} · เสร็จรอตรวจ {grouped.doneCol.length} · ในคิว {grouped.queue.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setEditCard(null); setFormOpen(true); }}
            className="bg-white text-slate-800 hover:bg-slate-100 px-4 sm:px-5 py-2.5 rounded-xl font-bold flex items-center gap-1.5 active:scale-95 transition-all">
            <Plus size={18} /> <span className="hidden sm:inline">สร้างงาน</span>
          </button>
        </div>
      </div>

      {/* Tabs + ตัวกรอง Tag + สลับการ์ด/ลิสต์ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1 items-center">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-slate-800 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
        {myTags.length > 0 && (
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
            className={`text-xs font-bold border rounded-xl px-2 py-2.5 outline-none max-w-[120px] shrink-0 ${tagFilter ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <option value="">ทุก Tag</option>
            {myTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <div className="flex bg-gray-100 rounded-xl p-0.5 shrink-0">
          <button onClick={() => setViewPersist('card')} title="มุมมองการ์ด"
            className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-slate-700 shadow-sm' : 'text-gray-400'}`}><LayoutGrid size={15} /></button>
          <button onClick={() => setViewPersist('list')} title="มุมมองลิสต์"
            className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white text-slate-700 shadow-sm' : 'text-gray-400'}`}><ListIcon size={15} /></button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400"><Loader2 size={22} className="animate-spin inline" /></div>
      ) : tab === 'focus' ? (
        /* ── บอร์ด Focus: 2 คอลัมน์ ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* ซ้าย: ยังทำไม่เสร็จ */}
          <div className="bg-gray-50/80 rounded-3xl border border-gray-100 p-3.5">
            <div className="flex items-center justify-between px-1.5 pb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> กำลังทำ / ยังไม่เสร็จ</h3>
              <span className="text-xs font-bold text-gray-400 bg-white border border-gray-200 rounded-full px-2.5 py-0.5">{grouped.doingCol.length}</span>
            </div>
            <div className="space-y-2.5">
              {renderZoneItems(grouped.doingCol, 'doing')}
              {grouped.doingCol.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
                  ยังไม่มีงานโฟกัส — ดึงจาก "คิวงาน" หรือสร้างงานใหม่
                </div>
              )}
            </div>
          </div>

          {/* ขวา: เสร็จแล้ว รอตรวจ */}
          <div className="bg-emerald-50/50 rounded-3xl border border-emerald-100 p-3.5">
            <div className="flex items-center justify-between px-1.5 pb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> เสร็จแล้ว รอตรวจ</h3>
              <span className="text-xs font-bold text-emerald-600 bg-white border border-emerald-200 rounded-full px-2.5 py-0.5">{grouped.doneCol.length}</span>
            </div>
            <div className="space-y-2.5">
              {renderZoneItems(grouped.doneCol, 'done')}
              {grouped.doneCol.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-emerald-100 rounded-2xl bg-white/50">
                  งานที่ทำเสร็จจะย้ายมารอตรวจที่นี่
                </div>
              )}
            </div>
          </div>
        </div>
      ) : tab === 'queue' ? (
        grouped.queue.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-20 text-center">
            <Inbox size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-500">คิวงานว่าง</p>
          </div>
        ) : (
          view === 'list' ? (
            <div className="space-y-2">{renderZoneItems(grouped.queue, 'queue')}</div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {renderZoneItems(grouped.queue, 'queue')}
          </div>
          )
        )
      ) : tab === 'stats' ? (
        /* ── สถิติช่าง ── */
        <div className="space-y-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1 w-fit">
            {[['day', 'รายวัน'], ['month', 'เดือนนี้'], ['30d', '30 วันล่าสุด'], ['all', 'ทั้งหมด']].map(([id, label]) => (
              <button key={id} onClick={() => setStatsPeriod(id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statsPeriod === id ? 'bg-slate-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {statsPeriod === 'day' ? (() => {
            const dayLabel = statsDate === localDate() ? 'วันนี้' : new Date(`${statsDate}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
            return (
              <div className="space-y-3">
                {/* เลือกวันดูย้อนหลังได้ */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex items-center gap-1.5 w-fit">
                  <button onClick={() => shiftDay(-1)} className="px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-500 font-bold">‹</button>
                  <input type="date" value={statsDate} onChange={(e) => e.target.value && setStatsDate(e.target.value)}
                    className="px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold outline-none" />
                  <button onClick={() => shiftDay(1)} className="px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-500 font-bold">›</button>
                  <button onClick={() => setStatsDate(localDate())} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl">วันนี้</button>
                </div>
                {statsLoading || daily === null ? (
                  <div className="text-center py-16 text-gray-400"><Loader2 size={20} className="animate-spin inline" /></div>
                ) : daily.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-16 text-center">
                    <BarChart3 size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="font-semibold text-gray-500">ไม่มีความเคลื่อนไหวใน{dayLabel}</p>
                  </div>
                ) : (
                  /* ── การ์ดรายคน: รูป+ชื่อ + ไทม์ไลน์ว่ากี่โมงทำอะไร ── */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                    {daily.map((p) => {
                      const TYPE = {
                        done: { label: 'ปิดงาน', chip: 'bg-indigo-100 text-indigo-700' },
                        check: { label: 'ตรวจผ่าน', chip: 'bg-emerald-600 text-white' },
                        prep: { label: 'เตรียมของ', chip: 'bg-emerald-100 text-emerald-700' },
                        tick: { label: 'ประกอบ', chip: 'bg-blue-100 text-blue-700' },
                        mat: { label: 'จัดของ', chip: 'bg-amber-100 text-amber-700' },
                        create: { label: 'สั่งงาน', chip: 'bg-slate-200 text-slate-700' },
                        comment: { label: 'คอมเมนต์', chip: 'bg-gray-100 text-gray-500' },
                      };
                      const count = (t) => p.events.filter((e) => e.type === t).length;
                      const tm = (at) => new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={p.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
                          {/* หัว: รูป + ชื่อ + สรุปยอด */}
                          <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                            <span className="w-11 h-11 rounded-full overflow-hidden bg-indigo-50 shrink-0 flex items-center justify-center text-sm font-bold text-indigo-500">
                              {p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" /> : (p.name[0] || '?')}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-gray-900 truncate">{p.name}</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {Object.entries(TYPE).map(([t, meta]) => count(t) > 0 && (
                                  <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.chip}`}>{meta.label} {count(t)}</span>
                                ))}
                              </div>
                            </div>
                            <span className="text-2xl font-black text-gray-200 shrink-0">{p.events.length}</span>
                          </div>
                          {/* ไทม์ไลน์เรียงตามเวลา */}
                          <div className="mt-2.5 space-y-1 max-h-80 overflow-y-auto">
                            {p.events.map((e, i) => (
                              <div key={i} className="flex items-start gap-2 py-1 border-b border-gray-50 last:border-0">
                                <span className="text-[11px] font-mono font-bold text-gray-400 shrink-0 pt-0.5 w-11">{tm(e.at)}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${TYPE[e.type]?.chip || 'bg-gray-100 text-gray-500'}`}>{TYPE[e.type]?.label}</span>
                                <span className="text-xs text-gray-700 leading-relaxed min-w-0">{e.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-gray-400 text-center">เริ่มบันทึก "ใครเตรียมของ" 19 ก.ค. 2026 — ของที่เตรียมไว้ก่อนหน้านั้นไม่ถูกนับย้อนหลัง</p>
              </div>
            );
          })() : statsLoading || statsData === null ? (
            <div className="text-center py-16 text-gray-400"><Loader2 size={20} className="animate-spin inline" /></div>
          ) : statsData.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-20 text-center">
              <BarChart3 size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-500">ยังไม่มีข้อมูลในช่วงนี้</p>
              <p className="text-xs text-gray-400 mt-1">สถิตินับจากการติ๊กเช็คลิสต์และการปิดงานจริง</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {statsData.map((e, i) => {
                const maxScore = Math.max(...statsData.map((x) => x.parts + x.ticks), 1);
                const open = statsOpenId === e.id;
                const fmt = (at) => new Date(at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={e.id}>
                    {/* แถวสรุป — กดเพื่อกางรายละเอียดทั้งหมด */}
                    <button onClick={() => setStatsOpenId(open ? null : e.id)} className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50/60 transition-colors">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                        {i === 0 ? <Trophy size={16} /> : `#${i + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 truncate">{e.name}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mt-0.5">
                          <span>ปิดงาน <b className="text-gray-700">{e.cards}</b> ใบ</span>
                          <span>ประกอบ <b className="text-indigo-600">{e.parts}</b> ชิ้น</span>
                          <span>ติ๊กงาน <b className="text-gray-700">{e.ticks}</b> รายการ</span>
                          <span>เตรียมของ <b className="text-emerald-600">{e.preps}</b> ชิ้น</span>
                          <span>เฉลี่ยปิดงาน <b className="text-gray-700">{avgDur(e)}</b></span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2 max-w-sm">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(((e.parts + e.ticks) / maxScore) * 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-indigo-500 shrink-0 flex items-center gap-1">
                        {open ? 'ปิด ▲' : 'ดูรายละเอียด ▼'}
                      </span>
                    </button>

                    {/* รายละเอียดทั้งหมด: งานไหน วันไหน กี่โมง */}
                    {open && (
                      <div className="px-5 pb-4 grid grid-cols-1 lg:grid-cols-3 gap-3 items-start bg-gray-50/40">
                        {[
                          { title: `ปิดงาน (${e.closedList.length})`, tone: 'text-indigo-600', dot: 'bg-indigo-500', list: e.closedList },
                          { title: `ประกอบ/ติ๊กงาน (${e.tickList.length})`, tone: 'text-blue-600', dot: 'bg-blue-500', list: e.tickList },
                          { title: `เตรียมของ (${e.prepList.length})`, tone: 'text-emerald-600', dot: 'bg-emerald-500', list: e.prepList },
                        ].map((sec, si) => (
                          <div key={si} className="bg-white rounded-2xl border border-gray-100 p-3 mt-1">
                            <p className={`text-[11px] font-bold flex items-center gap-1.5 mb-1.5 ${sec.tone}`}>
                              <span className={`w-2 h-2 rounded-full ${sec.dot}`} /> {sec.title}
                            </p>
                            {sec.list.length === 0 && <p className="text-[11px] text-gray-300 text-center py-3">— ไม่มี —</p>}
                            <div className="space-y-1 max-h-56 overflow-y-auto">
                              {sec.list.map((r, ri) => (
                                <div key={ri} className="flex items-start gap-2 text-[11px] border-b border-gray-50 last:border-0 py-1">
                                  <span className="font-mono font-bold text-gray-400 shrink-0">{fmt(r.at)}</span>
                                  <span className="text-gray-700 min-w-0">{r.t}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-gray-400 text-center">นับจากบันทึกจริง: ใครติ๊กเช็คลิสต์/ประกอบชิ้นส่วน/ปิดงาน เมื่อไหร่</p>
        </div>
      ) : (
        /* ── ประวัติ (ตรวจแล้ว ยกออก) ── */
        grouped.history.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-20 text-center">
            <History size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-500">ยังไม่มีงานที่ตรวจเช็คแล้ว</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {grouped.history.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)} className="w-full text-left px-5 py-3.5 hover:bg-gray-50 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-700 truncate">{c.title}</p>
                  <p className="text-[11px] text-gray-400">
                    {c.ref_label ? `${c.ref_label} · ` : ''}เสร็จโดย {c.done_by?.name || '-'} · ตรวจโดย {c.archived_by?.name || '-'} · {new Date(c.archived_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* Modals */}
      {formOpen && (
        <WorkCardForm
          initialData={editCard}
          profile={profile}
          onClose={() => { setFormOpen(false); setEditCard(null); }}
          onSaved={(newCard) => {
            setFormOpen(false); setEditCard(null); fetchAll(true);
            if (newCard) setSelected(newCard);
            if (selected && editCard) supabase.from('work_cards').select('*').eq('id', editCard.id).single().then(({ data }) => data && setSelected(data));
          }}
        />
      )}
      {selected && !formOpen && (
        <WorkCardDetail
          card={selected}
          onClose={() => setSelected(null)}
          onChanged={() => fetchAll(true)}
          onEdit={(c) => { setEditCard(c); setFormOpen(true); }}
        />
      )}
    </div>
  );
};

export default AssemblyMain;
