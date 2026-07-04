'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, ChevronLeft, ChevronRight, Search, X, Loader2,
  Pencil, Trash2, ImagePlus, Tags, ArrowUpCircle, ArrowDownCircle, RefreshCw, Package, Percent, Repeat, ToggleLeft, ToggleRight,
  GripVertical, FolderPlus, Check, Camera,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Line, ReferenceLine } from 'recharts';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import ImageLightbox from '@/app/components/common/ImageLightbox'; // แสดงรูปต้องใช้ตัวนี้เสมอ (GOTCHA #18)

// สร้าง <optgroup> ของ "ชนิด" จัดตาม "หมวด" (ไม่โชว์ตัวที่เป็นหมวด)
const renderCatOptions = (categories, type) => {
  const typed = (categories || []).filter(c => c.type === type && c.is_active !== false);
  const groups = typed.filter(c => c.is_group).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const items = typed.filter(c => !c.is_group);
  const byParent = {};
  items.forEach(it => { const k = it.parent_id || 'none'; (byParent[k] = byParent[k] || []).push(it); });
  return (
    <>
      {groups.map(g => (byParent[g.id]?.length ? <optgroup key={g.id} label={g.name}>{byParent[g.id].map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</optgroup> : null))}
      {byParent['none']?.length ? <optgroup label="ไม่มีหมวด">{byParent['none'].map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</optgroup> : null}
    </>
  );
};

const METHODS = [
  { key: 'cash', label: 'เงินสด' },
  { key: 'bank', label: 'ธนาคาร' },
  { key: 'promptpay', label: 'พร้อมเพย์' },
  { key: 'other', label: 'อื่นๆ' },
];
const methodLabel = (k) => METHODS.find(m => m.key === k)?.label || k || '—';
const baht = (n) => `฿${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pad = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// ค่าใส่ input datetime-local (เวลาท้องถิ่น) "YYYY-MM-DDTHH:MM"
const toLocalDT = (v) => { const d = v ? new Date(v) : new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// แสดงวันที่+เวลาแบบไทย
const fmtDateTime = (v) => { const d = new Date(v); return `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`; };
// ที่มาของรายการ: กรอกมือ → ชื่อคนกรอก, auto → ระบบต้นทาง
const TXN_ORIGIN = { order: 'จากออเดอร์', service: 'จากงานบริการ', marketing: 'จากการตลาด', purchase: 'จากการสั่งของ', adjustment: 'จากการปรับยอด', recurring: 'รายการประจำ' };
const txnOrigin = (t) => (!t.source || t.source === 'manual') ? (t.created_by?.name ? `โดย ${t.created_by.name}` : 'กรอกมือ') : (TXN_ORIGIN[t.source] || 'อัตโนมัติ');
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
// พาเลตเอิร์ธโทน (รายรับ=เซจ, รายจ่าย=ดินเผา/ทองแดง, สุทธิ=น้ำตาลเทา)
const EARTH = { income: '#5b7553', expense: '#b5651d', net: '#7d6b57', cogs: '#a47148', profit: '#606c38' };

// วงแหวนความคืบหน้า (โฟกัสรายเดือน)
const ProgressRing = ({ pct, color, size = 76, stroke = 8 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eceae7" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)' }} />
    </svg>
  );
};

const rangeFor = (mode, a) => {
  const y = a.getFullYear(), m = a.getMonth();
  if (mode === 'month') return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  if (mode === 'quarter') { const q = Math.floor(m / 3); return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 1) }; }
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
};
const shiftAnchor = (mode, a, dir) => {
  const d = new Date(a);
  if (mode === 'month') d.setMonth(d.getMonth() + dir);
  else if (mode === 'quarter') d.setMonth(d.getMonth() + dir * 3);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
};
const periodLabel = (mode, a) => {
  const y = a.getFullYear() + 543;
  if (mode === 'month') return `${TH_MONTHS[a.getMonth()]} ${y}`;
  if (mode === 'quarter') return `ไตรมาส ${Math.floor(a.getMonth() / 3) + 1}/${y}`;
  return `ปี ${y}`;
};
// สร้างชุด "แกนเวลาเต็มช่วง" — เดือน = ทุกวันในเดือน (1..N), ไม่ใช่เดือน = ทุกเดือนในช่วง
// คืน seed(): buckets เปล่าครบทุกช่อง, และ today = ช่อง/ป้ายของวันนี้ (ถ้าวันนี้อยู่ในช่วงที่ดู)
const axisFull = (mode, start, end) => {
  const s = new Date(start), e = new Date(end);
  const isMonth = mode === 'month';
  const keys = [];
  if (isMonth) {
    const days = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= days; d++) keys.push({ k: d, label: String(d) });
  } else {
    const cur = new Date(s.getFullYear(), s.getMonth(), 1);
    while (cur < e) { const m = cur.getMonth(); keys.push({ k: m, label: TH_MONTHS[m] }); cur.setMonth(cur.getMonth() + 1); }
  }
  const now = new Date();
  const inRange = now >= s && now < e;
  const tk = !inRange ? null : (isMonth ? now.getDate() : now.getMonth());
  return { keys, todayKey: tk, todayLabel: tk == null ? null : (isMonth ? String(tk) : TH_MONTHS[tk]) };
};

const FinanceMain = () => {
  const { can, profile } = useAuth();
  const canEdit = can('finance', 'create') || can('finance', 'edit');
  const canDelete = can('finance', 'delete');
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);

  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [customStart, setCustomStart] = useState(() => toStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => toStr(new Date()));
  const [categories, setCategories] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | income | expense
  const [txModal, setTxModal] = useState(null);   // { type } for new, or txn for edit
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [recurOpen, setRecurOpen] = useState(false);
  const [cogs, setCogs] = useState(0);
  const [budgets, setBudgets] = useState([]);
  const [monthSpent, setMonthSpent] = useState({});
  const [budgetModal, setBudgetModal] = useState(null); // { categoryId, categoryName, existing }
  const [systemBalance, setSystemBalance] = useState(0); // ยอดคงเหลือที่ DB session มองเห็น (อาจไม่รวม offset ถ้าไม่มีสิทธิ์)
  const [offsetPeriodSum, setOffsetPeriodSum] = useState(0);     // ยอดรวม offset ของช่วงที่เลือก (RPC, เลขรวมเท่านั้น)
  const [offsetBalanceEffect, setOffsetBalanceEffect] = useState(0); // ผลต่อยอดคงเหลือจาก offset ทั้งหมด (RPC)
  const [recons, setRecons] = useState([]);              // ประวัติการปรับยอด
  const [reconOpen, setReconOpen] = useState(false);
  const [closes, setCloses] = useState([]);              // การปิดงวดรายเดือน (snapshot)
  const [closing, setClosing] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { images, index } เปิดรูปแบบ popup ในหน้าเดิม
  const postedRef = useRef(false);
  const canAdjust = can('finance', 'adjust'); // ปรับยอด: เฉพาะ role ที่ติ๊ก action "ปรับยอด" (ตอนนี้ Supervisor)
  const canClose = can('finance', 'close_period'); // ปิด/เปิดงวด: Supervisor + Admin
  const canSeeOffset = can('finance', 'offset'); // เห็นหมวด Offset (ลับ): เฉพาะ Supervisor
  const [showOffset, setShowOffset] = useState(false); // toggle เปิด/ปิด Offset (เฉพาะ Supervisor)
  useEffect(() => { try { if (canSeeOffset && localStorage.getItem('fin_show_offset') === '1') setShowOffset(true); } catch { /* ignore */ } }, [canSeeOffset]);
  const toggleOffset = () => setShowOffset(v => { const n = !v; try { localStorage.setItem('fin_show_offset', n ? '1' : '0'); } catch { /* ignore */ } return n; });

  const { start, end } = useMemo(() => {
    if (mode === 'custom') {
      const s = new Date(customStart + 'T00:00:00');
      const e = new Date(customEnd + 'T00:00:00'); e.setDate(e.getDate() + 1);
      return { start: s, end: e };
    }
    return rangeFor(mode, anchor);
  }, [mode, anchor, customStart, customEnd]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('finance_categories').select('*').order('type').order('sort_order').order('id');
    setCategories(data || []);
  }, []);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('finance_transactions')
      .select('*, category:category_id(id, name, color, type)')
      .gte('txn_date', toStr(start)).lt('txn_date', toStr(end))
      .order('txn_at', { ascending: false }).order('id', { ascending: false });
    setTxns(data || []);
    setLoading(false);
  }, [start, end]);

  const fetchBudgets = useCallback(async () => {
    const { data } = await supabase.from('finance_budgets').select('*, category:category_id(id, name, color, is_group, parent_id)');
    setBudgets(data || []);
  }, []);
  // ยอดจ่ายของ "เดือนนี้" ต่อหมวด (สำหรับการ์ดเป้าหมาย — ไม่ขึ้นกับช่วงที่เลือกดู)
  const fetchMonthSpent = useCallback(async () => {
    const now = new Date();
    const ms = toStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const me = toStr(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const { data } = await supabase.from('finance_transactions').select('category_id, amount').eq('type', 'expense').gte('txn_date', ms).lt('txn_date', me);
    const m = {}; (data || []).forEach(r => { m[r.category_id] = (m[r.category_id] || 0) + Number(r.amount || 0); });
    setMonthSpent(m);
  }, []);
  // ยอดเงินคงเหลือในระบบ = SUM(income) - SUM(expense) ทั้งหมด (ไม่ขึ้นกับช่วงที่เลือกดู)
  const fetchBalance = useCallback(async () => {
    const { data } = await supabase.from('finance_transactions').select('type, amount');
    let inc = 0, exp = 0;
    (data || []).forEach(r => { if (r.type === 'income') inc += Number(r.amount || 0); else if (r.type === 'expense') exp += Number(r.amount || 0); });
    setSystemBalance(inc - exp);
  }, []);
  const fetchRecons = useCallback(async () => {
    const { data } = await supabase.from('finance_reconciliations').select('*').order('created_at', { ascending: false }).limit(100);
    setRecons(data || []);
  }, []);
  const fetchCloses = useCallback(async () => {
    const { data } = await supabase.from('finance_period_closes').select('*').order('period', { ascending: false }).limit(60);
    setCloses(data || []);
  }, []);
  const refreshAll = useCallback(() => { fetchTxns(); fetchMonthSpent(); fetchBalance(); }, [fetchTxns, fetchMonthSpent, fetchBalance]);

  useEffect(() => { fetchCategories(); fetchBudgets(); fetchMonthSpent(); fetchBalance(); fetchRecons(); fetchCloses(); }, [fetchCategories, fetchBudgets, fetchMonthSpent, fetchBalance, fetchRecons, fetchCloses]);
  useEffect(() => { fetchTxns(); }, [fetchTxns]);
  useEffect(() => { fetchBalance(); }, [txns, fetchBalance]); // ยอดคงเหลือเปลี่ยนเมื่อมีรายการเพิ่ม/แก้/ลบ
  // โพสต์รายการประจำที่ถึงกำหนด (ครั้งเดียวตอนเปิดหน้า) แล้วโหลดใหม่
  useEffect(() => { if (postedRef.current) return; postedRef.current = true; supabase.rpc('finance_post_due_recurring').then(() => fetchTxns()); }, [fetchTxns]);
  // COGS ของช่วงที่เลือก
  useEffect(() => { supabase.rpc('finance_cogs', { p_start: toStr(start), p_end: toStr(end) }).then(({ data }) => setCogs(Number(data) || 0)); }, [start, end]);
  // ยอดรวม offset (เลขรวมเท่านั้น) — ไว้บวกกลับสำหรับ session ที่ไม่เห็นแถว offset
  useEffect(() => { supabase.rpc('finance_offset_sum', { p_start: toStr(start), p_end: toStr(end) }).then(({ data }) => setOffsetPeriodSum(Number(data) || 0)); }, [start, end, txns]);
  useEffect(() => { supabase.rpc('finance_offset_balance').then(({ data }) => setOffsetBalanceEffect(Number(data) || 0)); }, [txns]);

  const scoped = txns; // สิ่งที่ DB session มองเห็น (supervisor รวม offset, คนอื่น RLS ตัด offset ออก)

  // ---- Offset (ค่าใช้จ่ายลับ): ยอดรวมบวกเสมอ แต่ breakdown/รายการ/กราฟ เห็นเฉพาะ Supervisor ที่เปิด toggle ----
  const offsetCatId = useMemo(() => categories.find(c => c.system_key === 'offset')?.id, [categories]);
  const effectiveShowOffset = canSeeOffset && showOffset;
  const visibleTxns = useMemo(() => (effectiveShowOffset || !offsetCatId) ? scoped : scoped.filter(t => t.category_id !== offsetCatId), [scoped, effectiveShowOffset, offsetCatId]);
  // หมวดที่โชว์ใน picker/จัดการ — ซ่อน Offset จาก role ที่ไม่มีสิทธิ์
  const pickCategories = useMemo(() => canSeeOffset ? categories : categories.filter(c => c.system_key !== 'offset'), [categories, canSeeOffset]);
  // DB session นี้ "ไม่เห็น" offset หรือไม่ (RLS ซ่อนหมวด offset ไป) → ต้องบวกยอด offset กลับจาก RPC
  const offsetHidden = categories.length > 0 && !offsetCatId;

  const income = scoped.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const baseExpense = scoped.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = baseExpense + (offsetHidden ? offsetPeriodSum : 0); // ยอดรายจ่ายรวม(กระแสเงินสด) = บวก offset เสมอ
  const shownBalance = systemBalance + (offsetHidden ? offsetBalanceEffect : 0); // ยอดคงเหลือที่แสดง = บวก offset เสมอ
  // แยก "การปรับยอด/ตั้งต้น" (source=adjustment) ออกจากรายรับ-รายจ่าย "ดำเนินงาน" — ไม่ให้ก้อนปรับยอดไปปนกราฟ/KPI
  const adjIncome = scoped.filter(t => t.type === 'income' && t.source === 'adjustment').reduce((s, t) => s + Number(t.amount || 0), 0);
  const adjExpense = scoped.filter(t => t.type === 'expense' && t.source === 'adjustment').reduce((s, t) => s + Number(t.amount || 0), 0);
  const adjNet = adjIncome - adjExpense; // + = ปรับเพิ่มเงิน, − = ปรับลด/ถอน
  const opIncome = income - adjIncome;   // รายรับดำเนินงาน (ไม่รวมปรับยอด)
  const opExpense = expense - adjExpense; // รายจ่ายดำเนินงาน (ไม่รวมปรับยอด)
  const net = opIncome - opExpense;       // กำไร/ขาดทุนจากการดำเนินงาน
  const flowTxns = useMemo(() => visibleTxns.filter(t => t.source !== 'adjustment'), [visibleTxns]); // สำหรับกราฟ (ตัดปรับยอดออก)

  // ---- ปิดยอดสิ้นเดือน (เฉพาะมุมมองรายเดือน) ----
  const periodKey = toStr(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const prevPeriodKey = toStr(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  const closesByPeriod = useMemo(() => Object.fromEntries(closes.map(c => [c.period, c])), [closes]);
  const thisClose = closesByPeriod[periodKey];
  const openingBalance = Number(closesByPeriod[prevPeriodKey]?.ending_balance || 0); // ยอดยกมา = ending ของเดือนก่อน (snapshot)
  const endingThisMonth = openingBalance + income - expense; // คงเหลือสิ้นเดือน (รวม offset)
  const reconciledThisMonth = recons.some(r => String(r.recon_date).slice(0, 7) === periodKey.slice(0, 7));

  // ปิดงวด: ระบุเดือน (pKey = 'YYYY-MM-01') + ยอดยกไปเดือนใหม่เอง (endingVal, null = คำนวณอัตโนมัติ)
  const closeMonth = async (pKey, endingVal) => {
    const key = pKey || periodKey;
    const lbl = periodLabel('month', new Date(key + 'T00:00:00'));
    if (!window.confirm(`ปิดงวด ${lbl}\nยอดยกไปเดือนถัดไป = ${baht(Number(endingVal))}\n\nยืนยัน?`)) return;
    setClosing(true);
    try {
      await supabase.rpc('finance_close_period', { p_period: key, p_by: meRef(), p_ending: endingVal === null || endingVal === undefined ? null : Number(endingVal) });
      await logAction({ resource_type: 'finance', action: 'create', resource_label: `ปิดงวด ${lbl} (ยกไป ${baht(Number(endingVal))})`, created_by: meRef() });
      fetchCloses();
    } catch (err) { alert('ปิดงวดไม่สำเร็จ: ' + err.message); }
    finally { setClosing(false); }
  };
  const reopenMonth = async (pKey) => {
    const key = pKey || periodKey;
    const lbl = periodLabel('month', new Date(key + 'T00:00:00'));
    if (!window.confirm(`เปิดงวด ${lbl} ใหม่?\n(ยอดยกมาของเดือนถัดไปที่ปิดไปแล้วจะไม่เปลี่ยน เพื่อไม่ให้กระทบเดือนปัจจุบัน)`)) return;
    setClosing(true);
    try {
      await supabase.rpc('finance_reopen_period', { p_period: key });
      await logAction({ resource_type: 'finance', action: 'update', resource_label: `เปิดงวด ${lbl}`, created_by: meRef() });
      fetchCloses();
    } catch (err) { alert('เปิดงวดไม่สำเร็จ: ' + err.message); }
    finally { setClosing(false); }
  };
  const salesIncome = scoped.filter(t => t.type === 'income' && (t.source === 'order' || t.source === 'service')).reduce((s, t) => s + Number(t.amount || 0), 0);
  const grossProfit = salesIncome - cogs;

  // ---- สถิติ: ลูกค้าจ่ายเข้ามาทางช่องไหน (รายรับแยกตามช่องทาง) ----
  const incomeByMethod = useMemo(() => {
    const m = {}; METHODS.forEach(x => { m[x.key] = { key: x.key, label: x.label, value: 0 }; });
    m.unknown = { key: 'unknown', label: 'ไม่ระบุ', value: 0 };
    scoped.filter(t => t.type === 'income').forEach(t => { (m[t.method] || m.unknown).value += Number(t.amount || 0); });
    return Object.values(m).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  }, [scoped]);
  const incomeByMethodTotal = incomeByMethod.reduce((s, x) => s + x.value, 0);

  // ---- การ์ดเป้าหมายโฟกัส (รายเดือน) ----
  const childIdsOf = (id) => categories.filter(c => c.parent_id === id).map(c => c.id);
  const focusData = budgets.filter(b => effectiveShowOffset || b.category_id !== offsetCatId).map(b => {
    const memberIds = [b.category_id, ...childIdsOf(b.category_id)];
    const spent = memberIds.reduce((s, id) => s + (monthSpent[id] || 0), 0);
    const target = Number(b.target_amount) || 0;
    const pct = target > 0 ? Math.round((spent / target) * 100) : 0;
    const cardColor = b.color || b.category?.color || EARTH.expense;
    return { ...b, spent, target, pct, remaining: target - spent, cardColor };
  }).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || b.target - a.target);
  const focusTotals = focusData.reduce((a, f) => ({ target: a.target + f.target, spent: a.spent + f.spent }), { target: 0, spent: 0 });
  focusTotals.remaining = focusTotals.target - focusTotals.spent;
  focusTotals.pct = focusTotals.target > 0 ? Math.round((focusTotals.spent / focusTotals.target) * 100) : 0;

  // เปลี่ยนสีการ์ดโฟกัส
  const recolorBudget = async (b, color) => {
    setBudgets(prev => prev.map(x => x.id === b.id ? { ...x, color } : x));
    await supabase.from('finance_budgets').update({ color }).eq('id', b.id);
  };
  // ลบเป้าหมายโฟกัส
  const deleteBudget = async (b) => {
    if (!window.confirm(`ลบเป้าหมาย “${b.category?.name || ''}” ?`)) return;
    await supabase.from('finance_budgets').delete().eq('id', b.id);
    fetchBudgets(); fetchMonthSpent();
  };
  // ลากสลับการ์ดโฟกัส → บันทึก sort_order
  const onFocusDragEnd = async (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const ordered = [...focusData];
    const [moved] = ordered.splice(result.source.index, 1);
    ordered.splice(result.destination.index, 0, moved);
    setBudgets(prev => {
      const pos = Object.fromEntries(ordered.map((f, i) => [f.id, i]));
      return prev.map(x => x.id in pos ? { ...x, sort_order: pos[x.id] } : x);
    });
    await Promise.all(ordered.map((f, i) => supabase.from('finance_budgets').update({ sort_order: i }).eq('id', f.id)));
  };
  const budgetByCat = Object.fromEntries(budgets.map(b => [b.category_id, b]));

  // ---- trend: income vs expense by sub-bucket ----
  // seed ทุกวัน/ทุกเดือนในช่วง เพื่อให้แกน x ครบทั้งเดือน (แม้วันไหนไม่มีรายการ)
  const trendAxis = useMemo(() => axisFull(mode, start, end), [mode, start, end]);
  const trend = useMemo(() => {
    const buckets = {};
    trendAxis.keys.forEach(({ k, label }) => { buckets[k] = { k, label, income: 0, expense: 0 }; });
    const keyOf = (dateStr) => {
      const d = new Date(dateStr);
      return mode === 'month' ? d.getDate() : d.getMonth();
    };
    const labelOf = (k) => mode === 'month' ? String(k) : TH_MONTHS[k];
    flowTxns.forEach(t => {
      const k = keyOf(t.txn_date);
      if (!buckets[k]) buckets[k] = { k, label: labelOf(k), income: 0, expense: 0 };
      buckets[k][t.type] += Number(t.amount || 0);
    });
    return Object.values(buckets).sort((a, b) => a.k - b.k);
  }, [flowTxns, mode, trendAxis]);

  // ---- list (search + type) — ซ่อนรายการ Offset จากคนที่ไม่มีสิทธิ์ ----
  const list = useMemo(() => visibleTxns.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (!search) return true;
    const hay = `${t.note || ''} ${t.category?.name || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [visibleTxns, typeFilter, search]);

  const deleteTx = async (t) => {
    const warn = t.source !== 'manual' ? 'รายการนี้มาจากระบบอัตโนมัติ (ออเดอร์/บริการ) — ถ้าออเดอร์มีการอัปเดตยอดจ่ายอีก ระบบอาจสร้างรายการนี้กลับมา\n\nยืนยันลบ?' : 'ลบรายการนี้?';
    if (!confirm(warn)) return;
    await supabase.from('finance_transactions').delete().eq('id', t.id);
    await logAction({ resource_type: 'finance', resource_id: t.id, action: 'delete', resource_label: `${t.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${baht(t.amount)}`, created_by: meRef() });
    refreshAll();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-800 to-stone-900 rounded-3xl p-8 text-white shadow-lg flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {canSeeOffset ? (
            <button onClick={toggleOffset} title={showOffset ? 'กำลังแสดง Offset — คลิกเพื่อซ่อน' : 'คลิกเพื่อแสดงหมวด Offset (ลับ)'}
              className={`relative w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-colors ${showOffset ? 'bg-amber-400/25 ring-2 ring-amber-300/70' : 'bg-white/10 hover:bg-white/20'}`}>
              <Wallet size={28} />
              {showOffset && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-300 border-2 border-stone-800" />}
            </button>
          ) : (
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm"><Wallet size={28} /></div>
          )}
          <div>
            <h1 className="text-2xl font-bold">การจัดการเงิน</h1>
            <p className="text-stone-300 text-sm mt-1">{canSeeOffset && showOffset ? 'กำลังแสดงหมวด Offset (ลับ) — เห็นเฉพาะคุณ' : 'บันทึกรายรับ-รายจ่าย ดูสรุปและกราฟตามช่วงเวลา'}</p>
          </div>
        </div>
        {(canEdit || canAdjust) && (
          <div className="flex gap-2 flex-wrap">
            {canEdit && <button onClick={() => setTxModal({ type: 'income' })} className="px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm text-white" style={{ backgroundColor: EARTH.income }}><ArrowUpCircle size={16} /> + รายรับ</button>}
            {canEdit && <button onClick={() => setTxModal({ type: 'expense' })} className="px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm text-white" style={{ backgroundColor: EARTH.expense }}><ArrowDownCircle size={16} /> + รายจ่าย</button>}
            {canAdjust && <button onClick={() => setReconOpen(true)} className="px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm text-white bg-white/15 backdrop-blur border border-white/25 hover:bg-white/25 transition-colors"><Wallet size={16} /> ปรับยอด</button>}
            {canClose && mode === 'month' && <button onClick={() => setPeriodModalOpen(true)} className="px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm text-white bg-white/15 backdrop-blur border border-white/25 hover:bg-white/25 transition-colors"><Check size={16} /> ปิดยอด</button>}
          </div>
        )}
      </div>

      {/* บันทึกรายจ่ายด่วน (ใช้บ่อย) */}
      {canEdit && <QuickExpense categories={pickCategories} profile={profile} onSaved={refreshAll} />}

      {/* Period controls */}
      <div className="flex flex-col lg:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex">
            {[['month', 'เดือน'], ['quarter', 'ไตรมาส'], ['year', 'ปี'], ['custom', 'กำหนดเอง']].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${mode === k ? 'bg-stone-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{l}</button>
            ))}
          </div>
          {mode === 'custom' ? (
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-sm outline-none text-gray-700 bg-transparent" />
              <span className="text-gray-400 text-sm">ถึง</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-sm outline-none text-gray-700 bg-transparent" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1">
                <button onClick={() => setAnchor(a => shiftAnchor(mode, a, -1))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold text-gray-700 px-2 min-w-[110px] text-center">{periodLabel(mode, anchor)}</span>
                <button onClick={() => setAnchor(a => shiftAnchor(mode, a, 1))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ChevronRight size={16} /></button>
              </div>
              <button onClick={() => setAnchor(new Date())} className="text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-xl">วันนี้</button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { fetchTxns(); fetchCategories(); }} className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-500" title="รีเฟรช"><RefreshCw size={16} /></button>
          <button onClick={() => setRecurOpen(true)} className="text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2.5 rounded-xl flex items-center gap-1.5"><Repeat size={15} /> รายการประจำ</button>
          <button onClick={() => setCatModalOpen(true)} className="text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2.5 rounded-xl flex items-center gap-1.5"><Tags size={15} /> หมวดหมู่</button>
        </div>
      </div>

      {/* KPI — มุมมองไตรมาส/ปี/กำหนดเอง (มุมมองเดือนใช้แถบสมการด้านล่างแทน ไม่ให้ซ้ำ) */}
      {mode !== 'month' && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1" style={{ color: EARTH.income }}><TrendingUp size={18} /><span className="text-xs font-bold uppercase tracking-wider">รายรับ</span></div>
          <p className="text-2xl font-black" style={{ color: EARTH.income }}>{baht(opIncome)}</p>
        </div>
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1" style={{ color: EARTH.expense }}><TrendingDown size={18} /><span className="text-xs font-bold uppercase tracking-wider">รายจ่าย</span></div>
          <p className="text-2xl font-black" style={{ color: EARTH.expense }}>{baht(opExpense)}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-stone-50 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1" style={{ color: EARTH.net }}><Wallet size={18} /><span className="text-xs font-bold uppercase tracking-wider">กำไร/ขาดทุน</span></div>
          <p className="text-2xl font-black" style={{ color: net >= 0 ? EARTH.net : EARTH.expense }}>{baht(net)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">รายรับ − รายจ่าย</p>
        </div>
      </div>
      )}

      {/* แถบเงินสดของเดือน: ยอดยกมา → +รับ −จ่าย = คงเหลือสิ้นเดือน (เฉพาะมุมมองเดือน) */}
      {mode === 'month' && (
        <div className="rounded-3xl border border-stone-200 bg-white shadow-sm p-4 sm:p-5">
          <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
            <div className="flex-1 min-w-[120px]">
              <p className="text-[11px] text-gray-400">ยอดยกมาจากเดือนก่อน</p>
              <p className="text-lg font-black" style={{ color: openingBalance < 0 ? EARTH.expense : '#44403c' }}>{baht(openingBalance)}</p>
            </div>
            <span className="text-gray-300 font-black">+</span>
            <div className="flex-1 min-w-[100px]">
              <p className="text-[11px] text-gray-400">รายรับเดือนนี้</p>
              <p className="text-lg font-black" style={{ color: EARTH.income }}>{baht(opIncome)}</p>
            </div>
            <span className="text-gray-300 font-black">−</span>
            <div className="flex-1 min-w-[100px]">
              <p className="text-[11px] text-gray-400">รายจ่ายเดือนนี้</p>
              <p className="text-lg font-black" style={{ color: EARTH.expense }}>{baht(opExpense)}</p>
            </div>
            {Math.round(adjNet * 100) !== 0 && (<>
              <span className="text-gray-300 font-black">{adjNet >= 0 ? '+' : '−'}</span>
              <div className="flex-1 min-w-[90px]">
                <p className="text-[11px] text-gray-400">ปรับยอด</p>
                <p className="text-lg font-black" style={{ color: adjNet >= 0 ? EARTH.income : EARTH.expense }}>{baht(Math.abs(adjNet))}</p>
              </div>
            </>)}
            <span className="text-gray-300 font-black">=</span>
            <div className="flex-1 min-w-[130px] rounded-2xl px-3 py-2 text-white" style={{ background: 'linear-gradient(135deg, #5b4a3c, #3d3833)' }}>
              <p className="text-[11px] text-white/55">คงเหลือสิ้นเดือน (เงินจริงที่ควรมี)</p>
              <p className="text-xl font-black">{baht(endingThisMonth)}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2.5 pt-2.5 border-t border-stone-100">กำไร/ขาดทุนจากการดำเนินงานเดือนนี้ (รับ − จ่าย): <span className="font-bold" style={{ color: net >= 0 ? EARTH.net : EARTH.expense }}>{baht(net)}</span></p>
        </div>
      )}

      {/* เป้าหมายโฟกัส — แสดงเฉพาะมุมมองรายเดือน */}
      {mode === 'month' && (
      <div className="rounded-[28px] border border-stone-200/80 bg-stone-50/50 p-4 sm:p-5 space-y-4">
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-8 rounded-full" style={{ background: `linear-gradient(${EARTH.expense}, ${EARTH.net})` }} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400">โฟกัสรายเดือน</p>
              <h2 className="font-black text-lg text-gray-800 leading-tight">{periodLabel('month', anchor)}</h2>
            </div>
          </div>
          {canEdit && <button onClick={() => setBudgetModal({})} className="text-sm font-semibold text-white px-3.5 py-2 rounded-full flex items-center gap-1.5 shrink-0 shadow-sm hover:shadow transition-shadow" style={{ backgroundColor: EARTH.expense }}><Plus size={15} /> ตั้งเป้าหมาย</button>}
        </div>

        {focusData.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-stone-200 p-10 text-center">
            <p className="text-sm text-gray-400">ยังไม่มีเป้าหมายโฟกัส</p>
            <p className="text-xs text-gray-300 mt-1">กด “ตั้งเป้าหมาย” แล้วเลือกหมวดรายจ่ายที่อยากคุม + ใส่ยอดเป้าต่อเดือน</p>
          </div>
        ) : (
          <>
            {/* แถบสรุป — ไฮไลต์โทนเข้มให้รู้สึกเป็น “สิ่งที่ต้องโฟกัส” */}
            <div className="relative rounded-3xl p-5 sm:p-6 overflow-hidden text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #5b4a3c 0%, #423a33 55%, #36302a 100%)' }}>
              <div className="absolute -right-8 -top-10 w-44 h-44 rounded-full opacity-[0.08]" style={{ background: EARTH.expense }} />
              <div className="absolute -right-16 top-10 w-40 h-40 rounded-full opacity-[0.06]" style={{ background: EARTH.income }} />
              <div className="relative flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/45">ยอดที่ต้องโฟกัสเดือนนี้</p>
                  <p className="text-3xl sm:text-4xl font-black mt-0.5">{baht(focusTotals.target)}</p>
                </div>
                <div className="flex gap-2.5">
                  <div className="rounded-2xl bg-white/10 backdrop-blur px-3.5 py-2">
                    <p className="text-[10px] text-white/50 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: EARTH.expense }} /> จ่ายแล้ว</p>
                    <p className="text-base font-black mt-0.5">{baht(focusTotals.spent)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 backdrop-blur px-3.5 py-2">
                    <p className="text-[10px] text-white/50 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: focusTotals.remaining < 0 ? EARTH.expense : '#a3b18a' }} /> {focusTotals.remaining < 0 ? 'เกินงบ' : 'คงเหลือ'}</p>
                    <p className="text-base font-black mt-0.5">{baht(Math.abs(focusTotals.remaining))}</p>
                  </div>
                </div>
              </div>
              <div className="relative mt-4">
                <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, focusTotals.pct)}%`, background: focusTotals.remaining < 0 ? EARTH.expense : 'linear-gradient(90deg, #c97b3c, #a3b18a)' }} />
                </div>
                <div className="flex justify-between text-[11px] text-white/55 mt-1.5">
                  <span>ใช้ไปแล้ว {focusTotals.pct}% ของเป้ารวม</span>
                  <span>{focusData.length} เป้าหมาย</span>
                </div>
              </div>
            </div>

            {/* การ์ดแต่ละเป้าหมาย — เติมสีตามความคืบหน้า, 3 คอลัมน์บนจอคอม */}
            <DragDropContext onDragEnd={onFocusDragEnd}>
              <Droppable droppableId="focus" direction="horizontal">
                {(dp) => (
                  <div ref={dp.innerRef} {...dp.droppableProps} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {focusData.map((f, idx) => {
                      const col = f.cardColor;
                      const over = f.spent > f.target;
                      return (
                        <Draggable key={f.id} draggableId={String(f.id)} index={idx} isDragDisabled={!canEdit}>
                          {(dr, snap) => (
                            <div ref={dr.innerRef} {...dr.draggableProps}
                              className={`relative rounded-2xl bg-white border border-stone-100 group transition-shadow ${snap.isDragging ? 'shadow-xl' : 'shadow-sm hover:shadow-md'}`}
                              style={{ ...dr.draggableProps.style }}>
                              <div className="p-4">
                                {/* หัว: ชื่อ + ปุ่มจัดการ */}
                                <div className="flex items-center gap-1.5 mb-3">
                                  {canEdit && <span {...dr.dragHandleProps} className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing shrink-0" title="ลากเพื่อสลับ"><GripVertical size={15} /></span>}
                                  <span className="text-sm font-bold text-gray-800 truncate flex-1">{f.category?.name || 'หมวด'}</span>
                                  {canEdit && (
                                    <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <label className="relative w-4 h-4 rounded-full cursor-pointer ring-1 ring-white shadow" style={{ backgroundColor: col }} title="เปลี่ยนสี">
                                        <input type="color" value={col} onChange={e => recolorBudget(f, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                      </label>
                                      <button onClick={() => setBudgetModal({ categoryId: f.category_id, categoryName: f.category?.name, existing: f })} className="p-0.5 text-gray-400 hover:text-stone-700" title="แก้ยอดเป้า"><Pencil size={13} /></button>
                                      {canDelete && <button onClick={() => deleteBudget(f)} className="p-0.5 text-gray-400 hover:text-red-600" title="ลบเป้าหมาย"><Trash2 size={13} /></button>}
                                    </span>
                                  )}
                                </div>
                                {/* รายละเอียดชิดซ้าย + วงแหวนใหญ่ด้านขวา */}
                                <div className="flex items-center gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] text-gray-400">เป้าหมาย</p>
                                    <p className="text-2xl font-black text-gray-800 leading-tight truncate">{baht(f.target)}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                                      <span className="text-gray-400">จ่าย</span>
                                      <span className="font-bold" style={{ color: over ? EARTH.expense : col }}>{baht(f.spent)}</span>
                                    </div>
                                    <p className="text-xs font-bold mt-0.5" style={{ color: over ? EARTH.expense : EARTH.income }}>
                                      {over ? `เกินงบ ${baht(-f.remaining)}` : `เหลือ ${baht(f.remaining)}`}
                                    </p>
                                  </div>
                                  <div className="relative shrink-0" style={{ width: 116, height: 116 }}>
                                    <ProgressRing pct={f.pct} color={over ? EARTH.expense : col} size={116} stroke={10} />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                      <span className="text-2xl font-black leading-none" style={{ color: over ? EARTH.expense : col }}>{f.pct}%</span>
                                      <span className="text-[10px] text-gray-400 mt-0.5">ใช้ไป</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {dp.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </>
        )}
      </div>
      )}

      {/* กราฟวิเคราะห์รายจ่าย (อัปเดตตามช่วงที่เลือก) */}
      <ExpenseTrendCard scoped={flowTxns} categories={pickCategories} mode={mode} start={start} end={end} />
      <ExpenseBreakdownCard scoped={flowTxns} categories={pickCategories} canEdit={canEdit} budgetByCat={budgetByCat} setBudgetModal={setBudgetModal} />

      {/* Analytics: COGS + gross profit (วิเคราะห์ ไม่ใช่กระแสเงินสด) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1" style={{ color: EARTH.cogs }}><Package size={18} /><span className="text-xs font-bold uppercase tracking-wider">ต้นทุนสินค้าที่ขายไป (COGS)</span></div>
          <p className="text-2xl font-black" style={{ color: EARTH.cogs }}>{baht(cogs)}</p>
          <p className="text-[11px] text-stone-400 mt-0.5">วิเคราะห์จากต้นทุนล็อตที่ตัดออกจากการขาย · ไม่ใช่กระแสเงินสด</p>
        </div>
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1" style={{ color: EARTH.profit }}><Percent size={18} /><span className="text-xs font-bold uppercase tracking-wider">กำไรขั้นต้น (ขาย − ต้นทุน)</span></div>
          <p className="text-2xl font-black" style={{ color: grossProfit >= 0 ? EARTH.profit : EARTH.expense }}>{baht(grossProfit)}</p>
          <p className="text-[11px] text-stone-400 mt-0.5">รายรับจากการขาย {baht(salesIncome)} − COGS {baht(cogs)}</p>
        </div>
      </div>

      {/* รายรับ vs รายจ่าย */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-3">รายรับ vs รายจ่าย ({mode === 'month' ? 'รายวัน' : 'รายเดือน'})</h3>
        {trend.every(r => !r.income && !r.expense) ? <p className="text-center text-gray-400 py-16 text-sm">ไม่มีข้อมูลในช่วงนี้</p> : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" interval="preserveStartEnd" minTickGap={4} />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                <Tooltip formatter={(v) => baht(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {trendAxis.todayLabel != null && <ReferenceLine x={trendAxis.todayLabel} stroke="#78716c" strokeDasharray="4 3" label={{ value: 'วันนี้', position: 'top', fontSize: 10, fill: '#78716c' }} />}
                <Bar dataKey="income" name="รายรับ" fill={EARTH.income} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="รายจ่าย" fill={EARTH.expense} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>


      {/* ช่องทางที่ลูกค้าจ่ายเข้ามา (สถิติ) */}
      {incomeByMethod.length > 0 && (
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-3">ช่องทางที่ลูกค้าจ่ายเข้ามา</h3>
          <div className="space-y-2.5">
            {incomeByMethod.map(m => {
              const pct = incomeByMethodTotal ? Math.round((m.value / incomeByMethodTotal) * 100) : 0;
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20 shrink-0">{m.label}</span>
                  <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: EARTH.income }} />
                  </div>
                  <span className="text-sm font-bold text-gray-800 w-28 text-right shrink-0">{baht(m.value)}</span>
                  <span className="text-xs text-gray-400 w-10 text-right shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-2 justify-between">
          <div className="flex gap-2">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-1 flex">
              {[['all', 'ทั้งหมด'], ['income', 'รายรับ'], ['expense', 'รายจ่าย']].map(([k, l]) => (
                <button key={k} onClick={() => setTypeFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${typeFilter === k ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="relative sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหารายการ/หมวด..." className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-stone-500" />
          </div>
        </div>
        {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="animate-spin inline" size={22} /></div>
          : list.length === 0 ? <div className="py-16 text-center text-gray-400 text-sm">ไม่มีรายการในช่วงนี้</div> : (
            <div className="divide-y divide-gray-50">
              {list.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 group">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (t.type === 'income' ? EARTH.income : EARTH.expense) + '1f', color: t.type === 'income' ? EARTH.income : EARTH.expense }}>
                    {t.type === 'income' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {t.category && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: (t.category.color || '#94a3b8') + '22', color: t.category.color || '#64748b' }}>{t.category.name}</span>}
                      <span className="text-sm text-gray-700 truncate">{t.note || (t.type === 'income' ? 'รายรับ' : 'รายจ่าย')}</span>
                      {t.source === 'recurring' ? <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">ประจำ</span> : t.source !== 'manual' && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">อัตโนมัติ</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(t.txn_at || t.txn_date)} · {methodLabel(t.method)} · <span className="text-gray-500 font-medium">{txnOrigin(t)}</span></p>
                  </div>
                  {Array.isArray(t.images) && t.images[0] && (
                    <button type="button" onClick={() => setLightbox({ images: t.images, index: 0 })} className="relative w-9 h-9 rounded-lg overflow-hidden border border-gray-100 shrink-0 hover:opacity-80 transition-opacity" title="ดูรูป">
                      <img src={t.images[0].url || t.images[0]} alt="" className="w-full h-full object-cover" />
                      {t.images.length > 1 && <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] font-bold px-1 rounded-tl">+{t.images.length - 1}</span>}
                    </button>
                  )}
                  <span className="font-bold text-sm shrink-0" style={{ color: t.type === 'income' ? EARTH.income : EARTH.expense }}>{t.type === 'income' ? '+' : '-'}{baht(t.amount)}</span>
                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1 shrink-0 sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {canEdit && <button onClick={() => setTxModal(t)} className="p-1.5 text-gray-400 hover:text-stone-700"><Pencil size={15} /></button>}
                      {canDelete && <button onClick={() => deleteTx(t)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      {txModal && (
        <TxModal txn={txModal.id ? txModal : null} defaultType={txModal.type} categories={pickCategories} profile={profile}
          onClose={() => setTxModal(null)} onSaved={() => { setTxModal(null); refreshAll(); }} />
      )}
      {catModalOpen && <CategoryModal categories={pickCategories} onClose={() => setCatModalOpen(false)} onChanged={fetchCategories} canDelete={canDelete} />}
      {recurOpen && <RecurringModal categories={pickCategories} profile={profile} onClose={() => setRecurOpen(false)} onChanged={fetchTxns} canDelete={canDelete} />}
      {budgetModal && <BudgetModal {...budgetModal} categories={pickCategories} profile={profile} onClose={() => setBudgetModal(null)} onSaved={() => { setBudgetModal(null); fetchBudgets(); fetchMonthSpent(); }} />}
      {reconOpen && <ReconcileModal systemBalance={mode === 'month' ? endingThisMonth : shownBalance} monthCtx={mode === 'month' ? { label: periodLabel('month', anchor), opening: openingBalance, income, expense } : null} recons={recons} categories={categories} profile={profile} onClose={() => setReconOpen(false)} onSaved={() => { setReconOpen(false); refreshAll(); fetchRecons(); }} />}
      {periodModalOpen && <PeriodCloseModal periodKey={periodKey} periodTitle={periodLabel('month', anchor)} opening={openingBalance} income={income} expense={expense} ending={endingThisMonth} thisClose={thisClose} closesByPeriod={closesByPeriod} closes={closes} reconciled={reconciledThisMonth} closing={closing} onCloseMonth={closeMonth} onReopen={reopenMonth} onClose={() => setPeriodModalOpen(false)} />}
      {lightbox && <ImageLightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} onIndex={(i) => setLightbox(p => ({ ...p, index: i }))} />}
    </div>
  );
};

// ===================== Budget / focus target =====================
const BudgetModal = ({ categoryId, categoryName, existing, categories, profile, onClose, onSaved }) => {
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);
  const [catId, setCatId] = useState(categoryId ? String(categoryId) : '');
  const [target, setTarget] = useState(existing?.target_amount ?? '');
  const [saving, setSaving] = useState(false);
  const picker = !categoryId; // เปิดจากปุ่ม "ตั้งเป้าหมาย" → ให้เลือกหมวดเอง

  const expOptions = () => {
    const exp = (categories || []).filter(c => c.type === 'expense' && c.is_active !== false);
    const groups = exp.filter(c => c.is_group).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const itemsOf = (gid) => exp.filter(c => !c.is_group && c.parent_id === gid);
    const ungrouped = exp.filter(c => !c.is_group && !c.parent_id);
    const out = [];
    groups.forEach(g => { out.push(<option key={'g' + g.id} value={g.id}>📁 {g.name} (ทั้งหมวด)</option>); itemsOf(g.id).forEach(it => out.push(<option key={it.id} value={it.id}>　• {it.name}</option>)); });
    ungrouped.forEach(it => out.push(<option key={it.id} value={it.id}>• {it.name}</option>));
    return out;
  };

  const save = async () => {
    const cid = Number(catId);
    if (!cid) return alert('เลือกหมวด/ชนิดที่จะตั้งเป้า');
    const t = Number(target);
    if (!(t > 0)) return alert('กรอกเป้าหมาย (มากกว่า 0)');
    setSaving(true);
    try {
      await supabase.from('finance_budgets').upsert([{ category_id: cid, target_amount: t, created_by: meRef(), updated_at: new Date().toISOString() }], { onConflict: 'category_id' });
      onSaved();
    } catch (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); } finally { setSaving(false); }
  };
  const remove = async () => { if (!confirm('เอาหมวดนี้ออกจากโฟกัส?')) return; await supabase.from('finance_budgets').delete().eq('category_id', Number(catId)); onSaved(); };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-xl text-gray-900">ตั้งเป้าหมายเดือน</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>
        {picker ? (
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">เลือกหมวด/ชนิดรายจ่าย</label>
            <select value={catId} onChange={e => setCatId(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-stone-500">
              <option value="">— เลือก —</option>
              {expOptions()}
            </select>
          </div>
        ) : (
          <p className="text-sm text-gray-500">หมวด: <span className="font-bold text-gray-800">{categoryName || 'หมวด'}</span></p>
        )}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">เป้าหมายต่อเดือน (บาท)</label>
          <input type="number" min="0" value={target} onChange={e => setTarget(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') save(); }} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-black text-gray-900 outline-none focus:border-stone-500" placeholder="เช่น 20000" />
          <p className="text-[11px] text-gray-400 mt-1">การ์ดโฟกัสจะแสดงว่าจ่ายไปแล้วเท่าไร เหลือเท่าไรจะถึงเป้า (นับยอดของเดือนปัจจุบัน)</p>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          {existing ? <button onClick={remove} className="text-sm text-red-500 hover:bg-red-50 px-3 py-2 rounded-xl font-semibold flex items-center gap-1"><Trash2 size={14} /> เอาออก</button> : <span />}
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-stone-700 hover:bg-stone-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} บันทึก</button>
        </div>
      </div>
    </div>
  );
};

// ===================== Recurring (รายการประจำ) =====================
const RecurringModal = ({ categories, profile, onClose, onChanged, canDelete }) => {
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(1);
  const [method, setMethod] = useState('bank');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('finance_recurring').select('*, category:category_id(name, color)').order('created_at', { ascending: false });
    setList(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchList(); }, [fetchList]);

  const cats = categories.filter(c => c.type === type && c.is_active !== false && !c.is_group);

  const add = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert('กรอกจำนวนเงิน');
    setBusy(true);
    try {
      await supabase.from('finance_recurring').insert([{ type, category_id: categoryId || null, amount: amt, day_of_month: Number(day) || 1, method, note: note.trim() || null, created_by: meRef() }]);
      await supabase.rpc('finance_post_due_recurring'); // ถ้าถึงกำหนดเดือนนี้แล้ว ลงให้เลย
      setAmount(''); setNote('');
      await fetchList(); onChanged();
    } catch (err) { alert('เพิ่มไม่สำเร็จ: ' + err.message); }
    finally { setBusy(false); }
  };
  const toggle = async (r) => { await supabase.from('finance_recurring').update({ is_active: !r.is_active }).eq('id', r.id); fetchList(); };
  const remove = async (r) => { if (!confirm('ลบรายการประจำนี้? (รายการที่ลงไปแล้วยังอยู่)')) return; await supabase.from('finance_recurring').delete().eq('id', r.id); fetchList(); };

  const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-stone-500';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2"><Repeat size={20} /> รายการประจำ (ทุกเดือน)</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>
        <p className="text-xs text-gray-400">ตั้งครั้งเดียว ระบบจะลงรายการให้อัตโนมัติทุกเดือนเมื่อถึงวันที่กำหนด (เช่น เงินเดือน/ค่าเช่า)</p>

        {loading ? <div className="py-6 text-center text-gray-400"><Loader2 className="animate-spin inline" size={20} /></div> : (
          <div className="space-y-2">
            {list.length === 0 && <p className="text-sm text-gray-400 text-center py-3">ยังไม่มีรายการประจำ</p>}
            {list.map(r => (
              <div key={r.id} className={`flex items-center gap-3 border rounded-xl p-3 ${r.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (r.type === 'income' ? EARTH.income : EARTH.expense) + '1f', color: r.type === 'income' ? EARTH.income : EARTH.expense }}>{r.type === 'income' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.note || r.category?.name || (r.type === 'income' ? 'รายรับประจำ' : 'รายจ่ายประจำ')}</p>
                  <p className="text-xs text-gray-400">{r.category?.name || 'ไม่ระบุหมวด'} · ทุกวันที่ {r.day_of_month} · {methodLabel(r.method)}</p>
                </div>
                <span className="font-bold text-sm shrink-0" style={{ color: r.type === 'income' ? EARTH.income : EARTH.expense }}>{baht(r.amount)}</span>
                <button onClick={() => toggle(r)} className="shrink-0" title={r.is_active ? 'ปิด' : 'เปิด'} style={{ color: r.is_active ? EARTH.income : '#9ca3af' }}>{r.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}</button>
                {canDelete && <button onClick={() => remove(r)} className="p-1 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs font-bold text-gray-500">เพิ่มรายการประจำ</p>
          <div className="bg-gray-100 rounded-xl p-1 flex">
            {[['income', 'รายรับ'], ['expense', 'รายจ่าย']].map(([k, l]) => (
              <button key={k} onClick={() => { setType(k); setCategoryId(''); }} className={`flex-1 py-1.5 rounded-lg text-sm font-bold ${type === k ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="จำนวนเงิน" className={inputCls} />
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">— หมวด —</option>
              {renderCatOptions(categories, type)}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 shrink-0">ทุกวันที่</span>
              <input type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} className={`${inputCls} text-center`} />
            </div>
            <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
              {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="รายละเอียด (เช่น เงินเดือนพนักงาน)" className={inputCls} />
          <button onClick={add} disabled={busy} className="w-full bg-stone-700 hover:bg-stone-800 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50"><Plus size={15} /> เพิ่มรายการประจำ</button>
        </div>
      </div>
    </div>
  );
};

// ===================== Transaction modal =====================
const TxModal = ({ txn, defaultType, categories, profile, onClose, onSaved }) => {
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);
  const [type, setType] = useState(txn?.type || defaultType || 'expense');
  const [amount, setAmount] = useState(txn?.amount ?? '');
  const [categoryId, setCategoryId] = useState(txn?.category_id || '');
  const [dt, setDt] = useState(toLocalDT(txn?.txn_at || (txn?.txn_date ? txn.txn_date + 'T00:00' : null)));
  const [method, setMethod] = useState(txn?.method || 'cash');
  const [note, setNote] = useState(txn?.note || '');
  const [images, setImages] = useState(txn?.images || []);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const cats = categories.filter(c => c.type === type && c.is_active !== false && !c.is_group);
  useEffect(() => { if (categoryId && !cats.some(c => String(c.id) === String(categoryId))) setCategoryId(''); }, [type]); // eslint-disable-line

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert('กรุณากรอกจำนวนเงิน');
    setSaving(true);
    try {
      let uploaded = images.filter(i => i.url || typeof i === 'string').map(i => (i.url ? i : { url: i }));
      for (const f of files) {
        const path = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { error: upErr } = await supabase.storage.from('finance').upload(path, f);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('finance').getPublicUrl(path);
        uploaded.push({ url: data.publicUrl });
      }
      const payload = {
        type, category_id: categoryId || null, amount: amt,
        txn_at: new Date(dt).toISOString(), txn_date: dt.slice(0, 10),
        method, note: note.trim() || null, images: uploaded,
      };
      if (txn?.id) {
        await supabase.from('finance_transactions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', txn.id);
        await logAction({ resource_type: 'finance', resource_id: txn.id, action: 'update', resource_label: `${type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${baht(amt)}`, created_by: meRef() });
      } else {
        const { data } = await supabase.from('finance_transactions').insert([{ ...payload, source: 'manual', created_by: meRef() }]).select('id').single();
        await logAction({ resource_type: 'finance', resource_id: data?.id, action: 'create', resource_label: `${type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${baht(amt)}`, created_by: meRef() });
      }
      onSaved();
    } catch (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-stone-500';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-xl text-gray-900">{txn?.id ? 'แก้ไขรายการ' : 'บันทึกรายการ'}</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>

        <div className="bg-gray-100 rounded-xl p-1 flex">
          {[['income', 'รายรับ', EARTH.income], ['expense', 'รายจ่าย', EARTH.expense]].map(([k, l, col]) => (
            <button key={k} onClick={() => setType(k)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === k ? 'bg-white shadow-sm' : 'text-gray-400'}`} style={type === k ? { color: col } : undefined}>{l}</button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">จำนวนเงิน (บาท)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus className={`${inputCls} text-2xl font-black text-gray-900`} placeholder="0" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">หมวดหมู่</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">— ไม่ระบุหมวด —</option>
            {renderCatOptions(categories, type)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">วันที่ &amp; เวลา</label>
            <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">ช่องทาง</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
              {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">รายละเอียด (ไม่บังคับ)</label>
          <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} placeholder="จ่ายอะไร / รับจากใคร..." />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">แนบหลักฐาน (รูป)</label>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100">
                <img src={img.url || img} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setImages(images.filter((_, x) => x !== i))} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5"><X size={10} /></button>
              </div>
            ))}
            {files.map((f, i) => (
              <div key={`f${i}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setFiles(files.filter((_, x) => x !== i))} className="absolute top-0.5 right-0.5 bg-black/55 text-white rounded-full p-0.5"><X size={10} /></button>
              </div>
            ))}
            <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-stone-400 text-gray-400 text-[9px] gap-0.5">
              <ImagePlus size={16} /> แนบรูป
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; setFiles(prev => [...prev, ...picked]); }} />
            </label>
            <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-stone-400 text-gray-400 text-[9px] gap-0.5">
              <Camera size={16} /> ถ่ายรูป
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; setFiles(prev => [...prev, ...picked]); }} />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold">ยกเลิก</button>
          <button type="button" onClick={submit} disabled={saving} className="px-5 py-2 bg-stone-700 hover:bg-stone-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} บันทึก</button>
        </div>
      </div>
    </div>
  );
};

// ===================== Category manager =====================
const CAT_COLORS = ['#5b7553', '#7a8450', '#9a9b6a', '#b5651d', '#a47148', '#8a5a44', '#9c6b4f', '#7d8471', '#b08968', '#6b705c'];
const CategoryModal = ({ categories, onClose, onChanged, canDelete }) => {
  const [type, setType] = useState('expense');
  const [cats, setCats] = useState(categories);
  useEffect(() => setCats(categories), [categories]);
  const [newGroup, setNewGroup] = useState('');
  const [addItemFor, setAddItemFor] = useState(null); // group id | 'none'
  const [itemName, setItemName] = useState('');

  const typed = cats.filter(c => c.type === type);
  const groups = typed.filter(c => c.is_group).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const itemsOf = (gid) => typed.filter(c => !c.is_group && c.parent_id === gid);
  const ungrouped = typed.filter(c => !c.is_group && !c.parent_id);

  const onDragEnd = async (res) => {
    if (!res.destination) return;
    const id = Number(res.draggableId);
    const dest = res.destination.droppableId;
    const parent_id = dest === 'none' ? null : Number(dest);
    setCats(prev => prev.map(c => c.id === id ? { ...c, parent_id } : c));
    await supabase.from('finance_categories').update({ parent_id }).eq('id', id);
    onChanged();
  };
  const addGroup = async () => { if (!newGroup.trim()) return; const max = Math.max(0, ...groups.map(g => g.sort_order || 0)); await supabase.from('finance_categories').insert([{ type, name: newGroup.trim(), is_group: true, color: CAT_COLORS[groups.length % CAT_COLORS.length], sort_order: max + 1 }]); setNewGroup(''); onChanged(); };
  const addItem = async (gid) => { if (!itemName.trim()) return; await supabase.from('finance_categories').insert([{ type, name: itemName.trim(), is_group: false, parent_id: gid, color: CAT_COLORS[0] }]); setItemName(''); setAddItemFor(null); onChanged(); };
  const rename = async (c, nm) => { if (nm.trim() && nm !== c.name) { await supabase.from('finance_categories').update({ name: nm.trim() }).eq('id', c.id); onChanged(); } };
  const recolor = async (c, color) => { await supabase.from('finance_categories').update({ color }).eq('id', c.id); onChanged(); };
  const remove = async (c) => { const msg = c.is_group ? `ลบหมวด "${c.name}"? ชนิดข้างในจะกลายเป็นไม่มีหมวด (รายการเดิมยังอยู่)` : `ลบชนิด "${c.name}"? (รายการเดิมจะกลายเป็นไม่ระบุหมวด)`; if (!confirm(msg)) return; await supabase.from('finance_categories').delete().eq('id', c.id); onChanged(); };

  const ItemRow = (it, idx) => (
    <Draggable key={it.id} draggableId={String(it.id)} index={idx}>
      {(p, snap) => (
        <div ref={p.innerRef} {...p.draggableProps} className={`flex items-center gap-2 bg-white border rounded-lg px-2 py-1.5 mb-1 ${snap.isDragging ? 'shadow-lg border-stone-300' : 'border-gray-100'}`}>
          <span {...p.dragHandleProps} className="text-gray-300 cursor-grab"><GripVertical size={14} /></span>
          <label className="relative w-5 h-5 rounded-full cursor-pointer shrink-0" style={{ backgroundColor: it.color || '#94a3b8' }}><input type="color" value={it.color || '#94a3b8'} onChange={e => recolor(it, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" /></label>
          <input defaultValue={it.name} key={it.name} onBlur={e => rename(it, e.target.value)} className="flex-1 text-sm bg-transparent outline-none text-gray-800 min-w-0" />
          {canDelete && <button onClick={() => remove(it)} className="p-1 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>}
        </div>
      )}
    </Draggable>
  );

  const AddItemInline = (gid) => (addItemFor === (gid ?? 'none') && (
    <div className="flex items-center gap-2 mt-1">
      <input autoFocus value={itemName} onChange={e => setItemName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addItem(gid); }} placeholder="ชื่อชนิด เช่น ค่าน้ำ, ค่าไฟ" className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-stone-500" />
      <button onClick={() => addItem(gid)} className="bg-stone-700 hover:bg-stone-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold"><Check size={13} /></button>
    </div>
  ));

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2"><Tags size={20} /> จัดการหมวดหมู่</h3>
            <p className="text-xs text-gray-400 mt-0.5">ลาก "ชนิด" ไปวางในหมวดที่ต้องการได้ (เช่น ลากค่าน้ำ/ค่าไฟ ไปไว้ในสาธารณูปโภค)</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>
        <div className="bg-gray-100 rounded-xl p-1 flex">
          {[['income', 'รายรับ'], ['expense', 'รายจ่าย']].map(([k, l]) => (
            <button key={k} onClick={() => setType(k)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${type === k ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>{l}</button>
          ))}
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} className="rounded-2xl border border-gray-100 bg-gray-50/40">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                  <label className="relative w-5 h-5 rounded-md cursor-pointer shrink-0" style={{ backgroundColor: g.color || '#94a3b8' }}><input type="color" value={g.color || '#94a3b8'} onChange={e => recolor(g, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" /></label>
                  <input defaultValue={g.name} key={g.name} onBlur={e => rename(g, e.target.value)} className="flex-1 text-sm font-bold bg-transparent outline-none text-gray-800 min-w-0" />
                  <button onClick={() => { setAddItemFor(addItemFor === g.id ? null : g.id); setItemName(''); }} className="text-xs text-stone-600 hover:bg-stone-100 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0"><Plus size={12} /> ชนิด</button>
                  {canDelete && <button onClick={() => remove(g)} className="p-1 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>}
                </div>
                <Droppable droppableId={String(g.id)}>
                  {(prov, snap) => (
                    <div ref={prov.innerRef} {...prov.droppableProps} className={`p-2 min-h-[44px] ${snap.isDraggingOver ? 'bg-stone-100/60' : ''}`}>
                      {itemsOf(g.id).map((it, idx) => ItemRow(it, idx))}
                      {prov.placeholder}
                      {itemsOf(g.id).length === 0 && !snap.isDraggingOver && <p className="text-xs text-gray-300 text-center py-1">ลากชนิดมาวางที่นี่</p>}
                      {AddItemInline(g.id)}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}

            <div className="rounded-2xl border border-dashed border-gray-200">
              <div className="px-3 py-2 border-b border-gray-100 text-sm font-bold text-gray-500 flex items-center justify-between">
                <span>ไม่มีหมวด</span>
                <button onClick={() => { setAddItemFor(addItemFor === 'none' ? null : 'none'); setItemName(''); }} className="text-xs text-stone-600 hover:bg-stone-100 px-2 py-1 rounded-lg flex items-center gap-1"><Plus size={12} /> ชนิด</button>
              </div>
              <Droppable droppableId="none">
                {(prov, snap) => (
                  <div ref={prov.innerRef} {...prov.droppableProps} className={`p-2 min-h-[44px] ${snap.isDraggingOver ? 'bg-stone-100/60' : ''}`}>
                    {ungrouped.map((it, idx) => ItemRow(it, idx))}
                    {prov.placeholder}
                    {ungrouped.length === 0 && !snap.isDraggingOver && <p className="text-xs text-gray-300 text-center py-1">—</p>}
                    {AddItemInline(null)}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </DragDropContext>

        <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
          <input value={newGroup} onChange={e => setNewGroup(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addGroup(); }} placeholder="ชื่อหมวดใหม่ เช่น สาธารณูปโภค, ค่าดำเนินการ" className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-stone-500" />
          <button onClick={addGroup} disabled={!newGroup.trim()} className="bg-stone-700 hover:bg-stone-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 disabled:opacity-50 shrink-0"><FolderPlus size={15} /> เพิ่มหมวด</button>
        </div>
      </div>
    </div>
  );
};

// ===================== Quick expense (กรอกรายจ่ายด่วน — ใช้บ่อย) =====================
const QuickExpense = ({ categories, profile, onSaved }) => {
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);
  const expCats = categories.filter(c => c.type === 'expense' && c.is_active !== false && !c.is_group);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [dt, setDt] = useState(toLocalDT());
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [preview, setPreview] = useState(null); // ดูรูปที่แนบเป็น popup ก่อนบันทึก
  useEffect(() => { if (!categoryId && expCats[0]) setCategoryId(String(expCats[0].id)); }, [expCats]); // eslint-disable-line

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert('กรอกจำนวนเงิน');
    setSaving(true);
    try {
      const images = [];
      for (const f of files) {
        const path = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { error } = await supabase.storage.from('finance').upload(path, f);
        if (error) throw error;
        const { data: pu } = supabase.storage.from('finance').getPublicUrl(path);
        images.push({ url: pu.publicUrl });
      }
      await supabase.from('finance_transactions').insert([{ type: 'expense', category_id: categoryId || null, amount: amt, txn_at: new Date(dt).toISOString(), txn_date: dt.slice(0, 10), method, note: note.trim() || null, images, source: 'manual', created_by: meRef() }]);
      await logAction({ resource_type: 'finance', action: 'create', resource_label: `รายจ่าย ${baht(amt)}`, created_by: meRef() });
      setAmount(''); setNote(''); setFiles([]); setDt(toLocalDT()); // รีเซ็ตเวลาเป็นปัจจุบันสำหรับรายการถัดไป
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1900);
      onSaved();
    } catch (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); }
    finally { setSaving(false); }
  };
  const inputCls = 'px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-stone-500';

  return (
    <div className="bg-white rounded-3xl border-2 shadow-sm p-4" style={{ borderColor: EARTH.expense + '44' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: EARTH.expense + '1f', color: EARTH.expense }}><ArrowDownCircle size={18} /></span>
        <h3 className="font-bold text-gray-800">บันทึกรายจ่ายด่วน</h3>
        <span className="text-xs text-gray-400">— กรอกแล้วกด Enter ได้เลย</span>
        {savedFlash && <span className="ml-auto text-xs font-bold text-white px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm animate-bounce" style={{ backgroundColor: EARTH.income }}><Check size={13} /> บันทึกแล้ว</span>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} placeholder="จำนวนเงิน" className={`${inputCls} sm:w-36 text-xl font-black`} style={{ color: EARTH.expense }} autoFocus />
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="">— หมวด —</option>
          {renderCatOptions(categories, 'expense')}
        </select>
        <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} placeholder="จ่ายอะไร (ไม่บังคับ)" className={`${inputCls} flex-1`} />
        <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 shrink-0" style={{ backgroundColor: EARTH.expense }}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} บันทึก</button>
      </div>
      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        <label className="text-xs text-gray-500 flex items-center gap-1.5">วันที่ &amp; เวลา
          <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} className="text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
        </label>
        <button onClick={() => setShowMore(s => !s)} className="text-xs font-semibold text-stone-600 hover:underline">{showMore ? 'ซ่อนช่องทาง' : 'เลือกช่องทางจ่าย'}</button>
        {showMore && <select value={method} onChange={e => setMethod(e.target.value)} className="text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none">{METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select>}
      </div>
      {/* แนบรูปบิล — เห็นตัวอย่าง, หลายรูป, ถ่ายรูปได้ */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {files.map((f, i) => (
          <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
            <img src={URL.createObjectURL(f)} alt="" onClick={() => setPreview({ images: files.map(x => ({ url: URL.createObjectURL(x) })), index: i })} className="w-full h-full object-cover cursor-zoom-in" title="กดดูรูป" />
            <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, x) => x !== i)); }} className="absolute top-0.5 right-0.5 bg-black/55 text-white rounded-full p-0.5" title="เอารูปออก"><X size={11} /></button>
          </div>
        ))}
        <label className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-stone-400 text-gray-400 text-[9px] gap-0.5">
          <ImagePlus size={16} /> แนบรูป
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; setFiles(prev => [...prev, ...picked]); }} />
        </label>
        <label className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-stone-400 text-gray-400 text-[9px] gap-0.5">
          <Camera size={16} /> ถ่ายรูป
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; setFiles(prev => [...prev, ...picked]); }} />
        </label>
        {files.length > 0 && <span className="text-xs text-gray-400">{files.length} รูป · กดรูปเพื่อดูเต็ม</span>}
      </div>
      {preview && <ImageLightbox images={preview.images} index={preview.index} onClose={() => setPreview(null)} onIndex={(i) => setPreview(p => ({ ...p, index: i }))} />}
    </div>
  );
};

// ===================== กราฟรายจ่ายตามช่วงเวลา (แท่ง/เส้น + เลือกหมวด + เทียบช่วง) =====================
const Chip = ({ active, color, onClick, children }) => (
  <button onClick={onClick}
    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all duration-150 flex items-center gap-1.5 ${active ? 'text-white border-transparent shadow-sm' : 'text-gray-500 bg-white border-stone-200 hover:border-stone-300'}`}
    style={active ? { backgroundColor: color || '#57534e' } : undefined}>
    {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? 'rgba(255,255,255,.7)' : color }} />}
    {children}
  </button>
);

const ExpenseTrendCard = ({ scoped, categories, mode, start, end }) => {
  const [chartType, setChartType] = useState('bar');
  const [sel, setSel] = useState([]); // group ids; ว่าง = ภาพรวมรวมทุกหมวด
  const [compare, setCompare] = useState(false);
  const [prevArr, setPrevArr] = useState({});

  const catById = useMemo(() => Object.fromEntries((categories || []).map(c => [c.id, c])), [categories]);
  const grp = (catId) => {
    const c = catById[catId];
    if (!c) return { id: 0, name: 'ไม่ระบุ', color: '#a8a29e' };
    const p = c.parent_id ? catById[c.parent_id] : null;
    const g = p || c;
    return { id: g.id, name: g.name, color: g.color || '#a8a29e' };
  };
  const expTxns = useMemo(() => (scoped || []).filter(t => t.type === 'expense'), [scoped]);
  const groups = useMemo(() => {
    const m = {}; expTxns.forEach(t => { const g = grp(t.category_id); if (!m[g.id]) m[g.id] = g; });
    return Object.values(m).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [expTxns, catById]); // eslint-disable-line

  const series = sel.length === 0
    ? [{ key: 'total', name: 'รายจ่ายรวม', color: EARTH.expense }]
    : sel.map((gid, i) => { const g = catById[gid]; return { key: `g${gid}`, name: g?.name || 'หมวด', color: g?.color || CAT_COLORS[i % CAT_COLORS.length] }; });

  // seed ทุกวัน/ทุกเดือนในช่วง เพื่อให้แกน x ครบทั้งเดือน + จุดบอกว่า "วันนี้" คือช่องไหน
  const axis = useMemo(() => axisFull(mode, start, end), [mode, start, end]);
  const data = useMemo(() => {
    const keyOf = (d) => mode === 'month' ? new Date(d).getDate() : new Date(d).getMonth();
    const buckets = {};
    axis.keys.forEach(({ k, label }) => { buckets[k] = { k, label, total: 0 }; });
    expTxns.forEach(t => {
      const k = keyOf(t.txn_date);
      if (!buckets[k]) buckets[k] = { k, label: mode === 'month' ? String(k) : TH_MONTHS[k], total: 0 };
      const amt = Number(t.amount || 0);
      buckets[k].total += amt;
      if (sel.length > 0) { const gid = grp(t.category_id).id; if (sel.includes(gid)) buckets[k][`g${gid}`] = (buckets[k][`g${gid}`] || 0) + amt; }
    });
    return Object.values(buckets).sort((a, b) => a.k - b.k);
  }, [expTxns, mode, sel.join(','), axis]); // eslint-disable-line

  useEffect(() => {
    if (!compare) { setPrevArr({}); return; }
    const s = new Date(start), e = new Date(end); const dur = e - s;
    const ps = new Date(s.getTime() - dur), pe = new Date(s.getTime());
    let cancelled = false;
    supabase.from('finance_transactions').select('txn_date,amount').eq('type', 'expense').gte('txn_date', toStr(ps)).lt('txn_date', toStr(pe)).then(({ data: d }) => {
      if (cancelled) return;
      const keyOf = (x) => mode === 'month' ? new Date(x).getDate() : new Date(x).getMonth();
      const m = {}; (d || []).forEach(t => { const k = keyOf(t.txn_date); m[k] = (m[k] || 0) + Number(t.amount || 0); });
      setPrevArr(m); // เก็บเป็น map ตาม key (วัน/เดือน) เพื่อจับคู่กับช่วงปัจจุบันให้ตรงช่อง
    });
    return () => { cancelled = true; };
  }, [compare, start, end, mode]);

  const chartData = compare ? data.map(r => ({ ...r, prev: prevArr[r.k] ?? 0 })) : data;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="font-bold text-gray-800">รายจ่ายตามช่วงเวลา</h3>
          <p className="text-xs text-gray-400">{mode === 'month' ? 'รายวันในเดือนนี้' : 'รายเดือนในช่วงที่เลือก'}{compare ? ' · เทียบกับช่วงก่อนหน้า' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 rounded-xl p-0.5">
            {[['bar', 'แท่ง'], ['line', 'เส้น']].map(([k, l]) => (
              <button key={k} onClick={() => setChartType(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${chartType === k ? 'bg-white text-stone-700 shadow-sm' : 'text-gray-400'}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setCompare(c => !c)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${compare ? 'text-white border-transparent' : 'text-gray-500 bg-white border-stone-200 hover:border-stone-300'}`} style={compare ? { backgroundColor: EARTH.net } : undefined}>เทียบช่วงก่อน</button>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <Chip active={sel.length === 0} onClick={() => setSel([])}>ทุกหมวด</Chip>
          {groups.map(g => (
            <Chip key={g.id} active={sel.includes(g.id)} color={g.color} onClick={() => setSel(s => s.includes(g.id) ? s.filter(x => x !== g.id) : [...s, g.id])}>{g.name}</Chip>
          ))}
        </div>
      )}

      {chartData.every(r => !r.total) ? <p className="text-center text-gray-400 py-16 text-sm">ไม่มีรายจ่ายในช่วงนี้</p> : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" interval="preserveStartEnd" minTickGap={4} />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
              <Tooltip formatter={(v) => baht(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {axis.todayLabel != null && <ReferenceLine x={axis.todayLabel} stroke="#78716c" strokeDasharray="4 3" label={{ value: 'วันนี้', position: 'top', fontSize: 10, fill: '#78716c' }} />}
              {chartType === 'bar'
                ? series.map(s => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} animationDuration={500} maxBarSize={46} />)
                : series.map(s => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} animationDuration={500} />)}
              {compare && <Line type="monotone" dataKey="prev" name="ช่วงก่อน (รวม)" stroke="#a8a29e" strokeWidth={2} strokeDasharray="5 4" dot={false} animationDuration={500} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ===================== กราฟวงกลมสัดส่วนรายจ่าย (หมวดใหญ่/ย่อย + เลือกเทียบหมวด) =====================
const ExpenseBreakdownCard = ({ scoped, categories, canEdit, budgetByCat, setBudgetModal }) => {
  const [level, setLevel] = useState('group'); // group = หมวดใหญ่, sub = หมวดย่อย
  const [sel, setSel] = useState([]); // กรองเฉพาะบางหมวดใหญ่ (ว่าง = ทั้งหมด)

  const catById = useMemo(() => Object.fromEntries((categories || []).map(c => [c.id, c])), [categories]);
  const grp = (catId) => {
    const c = catById[catId];
    if (!c) return { id: 0, name: 'ไม่ระบุ', color: '#a8a29e' };
    const p = c.parent_id ? catById[c.parent_id] : null;
    const g = p || c;
    return { id: g.id, name: g.name, color: g.color || '#a8a29e' };
  };
  const expTxns = useMemo(() => (scoped || []).filter(t => t.type === 'expense'), [scoped]);
  const groups = useMemo(() => {
    const m = {}; expTxns.forEach(t => { const g = grp(t.category_id); if (!m[g.id]) m[g.id] = g; });
    return Object.values(m).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [expTxns, catById]); // eslint-disable-line

  const data = useMemo(() => {
    const map = {};
    expTxns.forEach(t => {
      const g = grp(t.category_id);
      if (sel.length > 0 && !sel.includes(g.id)) return;
      const amt = Number(t.amount || 0);
      if (level === 'group') {
        if (!map[g.id]) map[g.id] = { id: g.id, name: g.name, value: 0, color: g.color };
        map[g.id].value += amt;
      } else {
        const c = catById[t.category_id];
        const id = c ? c.id : 0;
        const name = c ? c.name : 'ไม่ระบุ';
        if (!map[id]) map[id] = { id, name, value: 0, color: (c && c.color) || g.color };
        map[id].value += amt;
      }
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [expTxns, level, sel.join(','), catById]); // eslint-disable-line
  const colored = data.map((d, i) => ({ ...d, color: d.color || CAT_COLORS[i % CAT_COLORS.length] }));
  const total = colored.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="font-bold text-gray-800">สัดส่วนรายจ่าย</h3>
          <p className="text-xs text-gray-400">ดูว่าใช้เงินไปกับอะไรมากที่สุด ({level === 'group' ? 'หมวดใหญ่' : 'หมวดย่อย'})</p>
        </div>
        <div className="flex bg-stone-100 rounded-xl p-0.5">
          {[['group', 'หมวดใหญ่'], ['sub', 'หมวดย่อย']].map(([k, l]) => (
            <button key={k} onClick={() => setLevel(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${level === k ? 'bg-white text-stone-700 shadow-sm' : 'text-gray-400'}`}>{l}</button>
          ))}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <Chip active={sel.length === 0} onClick={() => setSel([])}>ทั้งหมด</Chip>
          {groups.map(g => (
            <Chip key={g.id} active={sel.includes(g.id)} color={g.color} onClick={() => setSel(s => s.includes(g.id) ? s.filter(x => x !== g.id) : [...s, g.id])}>{g.name}</Chip>
          ))}
        </div>
      )}

      {colored.length === 0 ? <p className="text-center text-gray-400 py-16 text-sm">ไม่มีรายจ่ายในช่วงนี้</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
          {/* ซ้าย: กราฟวงกลม (ขนาดพอดี ไม่ใหญ่เกิน) */}
          <div className="relative mx-auto w-44 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={colored} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={2} animationDuration={600}>
                  {colored.map((e, i) => <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2} />)}
                </Pie>
                <Tooltip formatter={(v) => `${baht(v)} (${total ? Math.round((v / total) * 100) : 0}%)`} contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] text-gray-400">รวมรายจ่าย</span>
              <span className="text-base font-black text-gray-800">{baht(total)}</span>
            </div>
          </div>
          {/* ขว: อันดับค่าใช้จ่ายสูงสุด */}
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2">อันดับค่าใช้จ่ายสูงสุด</p>
            <div className="space-y-2 max-h-60 overflow-auto pr-1">
              {colored.map((e, i) => {
                const pct = total ? Math.round((e.value / total) * 100) : 0;
                return (
                  <div key={i} className="group">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-center text-xs font-black text-gray-300 shrink-0">{i + 1}</span>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <span className="flex-1 text-gray-700 font-medium truncate">{e.name}</span>
                      <span className="font-bold text-gray-800 shrink-0">{baht(e.value)}</span>
                      <span className="text-xs text-gray-400 shrink-0 w-9 text-right">{pct}%</span>
                      {level === 'group' && canEdit && e.id ? (
                        <button onClick={() => setBudgetModal({ categoryId: e.id, categoryName: e.name, existing: budgetByCat[e.id] || null })}
                          title={budgetByCat[e.id] ? 'แก้เป้าหมาย' : 'ตั้งเป้าหมาย/ดึงมาโฟกัส'}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${budgetByCat[e.id] ? 'bg-stone-200 text-stone-600' : 'opacity-0 group-hover:opacity-100 bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                          {budgetByCat[e.id] ? '★' : '+'}
                        </button>
                      ) : null}
                    </div>
                    <div className="ml-7 mt-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: e.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===================== กระทบยอดเงินสด (สถิติเห็นทุกคน / ปรับยอดเฉพาะ Supervisor) =====================
const reconDateLabel = (s) => { const d = new Date(s); return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`; };

const ReconcileModal = ({ systemBalance, monthCtx = null, recons = [], categories, profile, onClose, onSaved }) => {
  const totalOver = recons.filter(r => Number(r.diff) > 0).reduce((s, r) => s + Number(r.diff), 0);
  const totalShort = recons.filter(r => Number(r.diff) < 0).reduce((s, r) => s + Math.abs(Number(r.diff)), 0);
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);
  const [date, setDate] = useState(toStr(new Date()));
  const [lines, setLines] = useState([{ name: 'เงินสด', amount: '' }]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const counted = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const diff = counted - systemBalance;
  const even = Math.round(diff * 100) === 0;
  const over = diff > 0;
  const setLine = (i, k, v) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLine = () => setLines(ls => [...ls, { name: '', amount: '' }]);
  const rmLine = (i) => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls);
  const inputCls = 'px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-stone-500';

  const save = async () => {
    if (!reason.trim()) return alert('กรอกเหตุผลการปรับยอด');
    if (lines.every(l => !l.amount)) return alert('กรอกยอดเงินจริงอย่างน้อย 1 บัญชี');
    if (!window.confirm(even ? 'ยอดตรงพอดี จะบันทึกการกระทบยอดนี้ไว้?' : `ยืนยันปรับยอด: ${over ? 'เงินเกิน' : 'เงินขาด'} ${baht(Math.abs(diff))} ?`)) return;
    setSaving(true);
    try {
      const images = [];
      for (const f of files) {
        const path = `recon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { error } = await supabase.storage.from('finance').upload(path, f);
        if (error) throw error;
        const { data: pu } = supabase.storage.from('finance').getPublicUrl(path);
        images.push({ url: pu.publicUrl });
      }
      let txnId = null;
      if (!even) {
        const key = over ? 'adjust_over' : 'adjust_short';
        const cat = categories.find(c => c.system_key === key);
        const { data: tx, error } = await supabase.from('finance_transactions')
          .insert([{ type: over ? 'income' : 'expense', category_id: cat ? cat.id : null, amount: Math.abs(diff), txn_date: date, method: 'cash', note: `ปรับยอด: ${reason.trim()}`, images, source: 'adjustment', created_by: meRef() }])
          .select('id').single();
        if (error) throw error;
        txnId = tx?.id || null;
      }
      const accounts = lines.filter(l => l.amount).map(l => ({ name: l.name.trim() || 'ไม่ระบุ', amount: Number(l.amount) || 0 }));
      const { error: rerr } = await supabase.from('finance_reconciliations').insert([{ recon_date: date, system_balance: systemBalance, counted_total: counted, diff, accounts, reason: reason.trim(), note: note.trim() || null, images, txn_id: txnId, created_by: meRef() }]);
      if (rerr) throw rerr;
      await logAction({ resource_type: 'finance', action: 'create', resource_label: `ปรับยอด ${even ? 'ตรงพอดี' : over ? 'เกิน' : 'ขาด'} ${baht(Math.abs(diff))}`, created_by: meRef() });
      onSaved();
    } catch (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl text-gray-900">ปรับยอด / กระทบยอดเงินสด</h3>
            <p className="text-xs text-gray-400">กรอกยอดจริงที่นับได้ของแต่ละบัญชี ระบบจะคำนวณส่วนต่างให้</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #5b4a3c, #3d3833)' }}>
          <p className="text-[11px] uppercase tracking-wider text-white/50">{monthCtx ? `ยอดที่ควรมีสิ้นเดือน (${monthCtx.label})` : 'ยอดคงเหลือในระบบ'}</p>
          <p className="text-2xl font-black">{baht(systemBalance)}</p>
          {monthCtx && (
            <p className="text-[11px] text-white/55 mt-1">ยกมา {baht(monthCtx.opening)} + รับ {baht(monthCtx.income)} − จ่าย {baht(monthCtx.expense)}</p>
          )}
          <div className="flex gap-4 mt-2 pt-2 border-t border-white/10 text-xs">
            <span className="text-white/60">ปรับเกินสะสม <span className="font-bold text-white">{baht(totalOver)}</span></span>
            <span className="text-white/60">ปรับขาดสะสม <span className="font-bold text-white">{baht(totalShort)}</span></span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-gray-700">ยอดเงินจริงที่นับได้ (แยกบัญชี)</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={l.name} onChange={e => setLine(i, 'name', e.target.value)} placeholder="ชื่อบัญชี เช่น ธนาคาร SCB, เงินสด" className={`${inputCls} flex-1`} />
                <input type="number" min="0" value={l.amount} onChange={e => setLine(i, 'amount', e.target.value)} placeholder="0" className={`${inputCls} w-32 text-right font-bold`} />
                <button onClick={() => rmLine(i)} className="p-1.5 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button onClick={addLine} className="mt-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1"><Plus size={14} /> เพิ่มบัญชี</button>
        </div>

        {/* สรุปส่วนต่าง */}
        <div className="rounded-2xl border border-stone-200 p-4 space-y-1.5">
          <div className="flex justify-between text-sm"><span className="text-gray-500">นับได้รวม</span><span className="font-bold text-gray-800">{baht(counted)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">ยอดในระบบ</span><span className="font-bold text-gray-800">{baht(systemBalance)}</span></div>
          <div className="flex justify-between items-center pt-1.5 border-t border-stone-100">
            <span className="text-sm font-bold text-gray-700">ส่วนต่าง</span>
            <span className="text-lg font-black" style={{ color: even ? '#78716c' : over ? EARTH.income : EARTH.expense }}>
              {even ? 'ตรงพอดี' : `${over ? 'เกิน ' : 'ขาด '}${baht(Math.abs(diff))}`}
            </span>
          </div>
          {!even && <p className="text-[11px] text-gray-400">ระบบจะบันทึกรายการ{over ? 'รายรับ (เงินเกิน)' : 'รายจ่าย (เงินขาด)'} {baht(Math.abs(diff))} เพื่อปรับยอดให้ตรงกับเงินจริง</p>}
        </div>

        <div>
          <label className="text-sm font-bold text-gray-700">เหตุผล <span className="text-red-400">*</span></label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="เช่น นับเงินสดหน้าร้านขาด, ตกหล่นบันทึก" className={`${inputCls} w-full mt-1`} />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer flex items-center gap-1 text-gray-500"><ImagePlus size={13} /> แนบรูปหลักฐาน<input type="file" accept="image/*" multiple className="hidden" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} /></label>
          {files.length > 0 && <span className="text-xs text-gray-400">{files.length} รูป</span>}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold">ยกเลิก</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50" style={{ backgroundColor: EARTH.net }}>{saving && <Loader2 size={14} className="animate-spin" />} ยืนยันปรับยอด</button>
        </div>

        {/* ประวัติการปรับยอด */}
        <div className="pt-1">
          <p className="text-xs font-bold text-gray-400 mb-2">ประวัติการปรับยอด {recons.length > 0 ? `(${recons.length})` : ''}</p>
          {recons.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">ยังไม่มีการปรับยอด</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-auto pr-1">
              {recons.map(r => {
                const d = Number(r.diff); const ov = d > 0; const ev = Math.round(d * 100) === 0;
                const col = ev ? '#a8a29e' : ov ? EARTH.income : EARTH.expense;
                return (
                  <div key={r.id} className="flex items-start gap-3 p-2.5 rounded-2xl border border-stone-100">
                    <span className="mt-0.5 shrink-0" style={{ color: col }}>{ov ? <ArrowUpCircle size={20} /> : ev ? <Check size={20} /> : <ArrowDownCircle size={20} />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-800">{ev ? 'ตรงพอดี' : ov ? 'เงินเกิน' : 'เงินขาด'} {!ev && <span style={{ color: col }}>{baht(Math.abs(d))}</span>}<span className="text-xs font-normal text-gray-400"> · {reconDateLabel(r.recon_date)}</span></p>
                      <p className="text-xs text-gray-500 truncate">{r.reason || '—'}</p>
                      <p className="text-[11px] text-gray-400">นับได้ {baht(r.counted_total)} / ระบบ {baht(r.system_balance)}{r.created_by?.name ? ` · โดย ${r.created_by.name}` : ''}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===================== ปิดยอดสิ้นเดือน (หน้าต่าง) =====================
const PeriodCloseModal = ({ periodKey, periodTitle, opening, income, expense, ending, thisClose, closesByPeriod = {}, closes, reconciled, closing, onCloseMonth, onReopen, onClose }) => {
  const monthLabel = (p) => { const d = new Date(p); return `${TH_MONTHS[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`; };
  const [selMonth, setSelMonth] = useState(periodKey.slice(0, 7)); // 'YYYY-MM' เดือนที่จะปิด
  const selKey = selMonth + '-01';
  const selClose = closesByPeriod[selKey] || null;
  const isAnchored = selKey === periodKey; // เดือนที่กำลังดูอยู่หน้าหลัก (มีตัวเลขให้)
  const [endInput, setEndInput] = useState(selClose ? Number(selClose.ending_balance) : (isAnchored ? ending : ''));
  useEffect(() => {
    const sc = closesByPeriod[selMonth + '-01'] || null;
    const anch = (selMonth + '-01') === periodKey;
    setEndInput(sc ? Number(sc.ending_balance) : (anch ? ending : ''));
  }, [selMonth]); // eslint-disable-line
  const op = selClose ? Number(selClose.opening_balance) : (isAnchored ? opening : null);
  const inc = selClose ? Number(selClose.total_income) : (isAnchored ? income : null);
  const exp = selClose ? Number(selClose.total_expense) : (isAnchored ? expense : null);
  const hasFigures = op !== null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] overflow-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">ปิดยอดสิ้นเดือน {selClose && <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: EARTH.net }}>ปิดงวดแล้ว</span>}</h3>
            <p className="text-xs text-gray-400">{selClose ? `ปิดเมื่อ ${reconDateLabel(selClose.closed_at)}${selClose.closed_by?.name ? ` โดย ${selClose.closed_by.name}` : ''}` : 'เลือกเดือน แล้วตั้งยอดยกไปเดือนใหม่'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        {/* เลือกเดือนที่จะปิด */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">เดือนที่จะปิดงวด</label>
          <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-stone-500" />
        </div>

        {/* สมการยกยอด (ถ้ามีตัวเลขของเดือนนั้น) */}
        {hasFigures ? (
          <div className="rounded-2xl border border-stone-200 divide-y divide-stone-100">
            <div className="flex justify-between px-4 py-2.5"><span className="text-sm text-gray-500">ยอดยกมา</span><span className="font-bold" style={{ color: op < 0 ? EARTH.expense : '#44403c' }}>{baht(op)}</span></div>
            <div className="flex justify-between px-4 py-2.5"><span className="text-sm text-gray-500">+ รายรับเดือนนี้</span><span className="font-bold" style={{ color: EARTH.income }}>{baht(inc)}</span></div>
            <div className="flex justify-between px-4 py-2.5"><span className="text-sm text-gray-500">− รายจ่ายเดือนนี้</span><span className="font-bold" style={{ color: EARTH.expense }}>{baht(exp)}</span></div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-stone-50"><span className="text-xs text-gray-400">คำนวณได้</span><span className="font-bold text-gray-600">{baht(op + inc - exp)}</span></div>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400">* ดูสมการรายรับ-รายจ่ายได้เฉพาะเดือนที่เปิดอยู่หน้าหลัก — เดือนอื่นกรอกยอดยกไปเองด้านล่าง</p>
        )}

        {/* ยอดยกไปเดือนใหม่ (ตั้งเองได้) */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">ยอดยกไปเดือนใหม่ (เงินจริงสิ้นเดือน)</label>
          <input type="number" step="0.01" value={endInput} onChange={e => setEndInput(e.target.value)} disabled={!!selClose} placeholder="0" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-lg font-black outline-none focus:border-stone-500 disabled:opacity-60" />
          {hasFigures && !selClose && Math.round((Number(endInput) - (op + inc - exp)) * 100) !== 0 && (
            <p className="text-[11px] text-gray-400 mt-1">ต่างจากยอดคำนวณ {baht(Number(endInput) - (op + inc - exp))} (ปรับยอดยกมาตามเงินจริง)</p>
          )}
        </div>

        {!selClose && !reconciled && isAnchored && <p className="text-[11px]" style={{ color: EARTH.expense }}>เดือนนี้ยังไม่ได้กระทบยอด — แนะนำกด “ปรับยอด” ให้ตรงเงินจริงก่อน</p>}
        {selClose && <p className="text-[11px] text-gray-400">ปิดงวดแล้ว · ยอด {baht(Number(selClose.ending_balance))} ยกไปเป็นต้นเดือนถัดไป · แก้รายการย้อนหลังได้ ไม่กระทบเดือนปัจจุบัน</p>}

        {/* ปุ่มปิด/เปิดงวด */}
        {selClose
          ? <button onClick={() => onReopen(selKey)} disabled={closing} className="w-full py-2.5 rounded-xl text-sm font-bold border border-stone-300 text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-2 disabled:opacity-50">{closing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} เปิดงวด {monthLabel(selKey)} ใหม่</button>
          : <button onClick={() => onCloseMonth(selKey, endInput === '' ? (op + inc - exp) : Number(endInput))} disabled={closing || (endInput === '' && !hasFigures)} className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: EARTH.net }}>{closing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} ปิดงวด {monthLabel(selKey)} · ยกไป {baht(endInput === '' ? (hasFigures ? op + inc - exp : 0) : Number(endInput))}</button>}

        {/* ประวัติการปิดงวด */}
        {closes.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2">ประวัติการปิดงวด</p>
            <div className="space-y-1.5 max-h-48 overflow-auto pr-1">
              {closes.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-xl bg-stone-50">
                  <span className="font-semibold text-gray-700">{monthLabel(c.period)}</span>
                  <span className="text-xs text-gray-400">ยกมา {baht(c.opening_balance)} → คงเหลือ</span>
                  <span className="font-bold" style={{ color: Number(c.ending_balance) < 0 ? EARTH.expense : '#44403c' }}>{baht(c.ending_balance)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceMain;
