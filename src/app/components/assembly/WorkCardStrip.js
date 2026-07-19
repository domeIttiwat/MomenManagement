'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Hammer, Plus, CheckCircle2, ChevronRight, Flag, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import WorkCardForm from './WorkCardForm';
import WorkCardDetail from './WorkCardDetail';

// แถบการ์ดงานประกอบของออเดอร์/งานซ่อม — เห็นทุกรอบงาน กดเปิดดูรายละเอียด/คุยกันได้เลย
// ใช้ใน OrderDetail (refType='order') และ ServiceDetail (refType='service')
const STATUS_META = {
  todo: { label: 'ยังไม่เสร็จ', chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-400' },
  doing: { label: 'ยังไม่เสร็จ', chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-400' },
  blocked: { label: 'ยังไม่เสร็จ', chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-400' },
  done: { label: 'เสร็จแล้ว', chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
};

const WorkCardStrip = ({ refType, refId, refLabel }) => {
  const { profile, canView } = useAuth();
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState({});
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editCard, setEditCard] = useState(null);

  const fetchCards = useCallback(async () => {
    if (!refId) return;
    const { data } = await supabase.from('work_cards').select('*')
      .eq('ref_type', refType).eq('ref_id', String(refId))
      .order('created_at', { ascending: true });
    setCards(data || []);
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
  }, [refType, refId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const groups = useMemo(() => ({
    live: cards.filter((c) => !c.archived_at),
    archived: cards.filter((c) => c.archived_at),
  }), [cards]);

  const Row = ({ c }) => {
    const st = stats[c.id] || { total: 0, done: 0, matPending: 0 };
    const meta = STATUS_META[c.status] || STATUS_META.todo;
    const checked = Boolean(c.archived_at);
    return (
      <button onClick={() => setSelected(c)}
        className="w-full text-left bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm rounded-xl p-3 relative overflow-hidden transition-all group">
        <span className={`absolute left-0 top-0 bottom-0 w-1 ${checked ? 'bg-gray-200' : meta.bar}`} />
        <div className="pl-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {checked
              ? <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><CheckCircle2 size={9} /> ตรวจแล้ว</span>
              : <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.chip}`}>{meta.label}</span>}
            {c.priority === 'urgent' && !checked && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Flag size={9} /> ด่วน</span>}
            {st.matPending > 0 && !checked && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ShoppingCart size={9} /> ขอของเพิ่ม {st.matPending}</span>}
            {c.rework_count > 0 && !checked && <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">✨ รอบเก็บงาน #{c.rework_count}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <p className={`flex-1 text-sm font-semibold leading-snug truncate ${checked ? 'text-gray-400' : 'text-gray-800'}`}>{c.title}</p>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 shrink-0" />
          </div>
          <div className="flex items-center justify-between mt-1 gap-2">
            <span className="text-[11px] text-gray-400 truncate">
              {(c.assignees || []).length > 0 ? c.assignees.map((a) => a.name?.split(' ')[0]).join(', ') : 'งานกลาง'}
            </span>
            {st.total > 0 && <span className={`text-[11px] font-bold shrink-0 ${st.done === st.total ? 'text-emerald-600' : 'text-gray-500'}`}>{st.done}/{st.total}</span>}
          </div>
          {st.total > 0 && !checked && (
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5">
              <div className={`h-full rounded-full ${st.done === st.total ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.round((st.done / st.total) * 100)}%` }} />
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Hammer size={17} className="text-slate-600" /> งานประกอบ
          {cards.length > 0 && <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{cards.length} รอบ</span>}
        </h3>
        {canView('assembly') && (
          <button onClick={() => { setEditCard(null); setFormOpen(true); }}
            className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 active:scale-95">
            <Plus size={12} /> สร้างรอบงาน
          </button>
        )}
      </div>

      {cards.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีการ์ดงานประกอบของงานนี้</p>
      ) : (
        <div className="space-y-2">
          {groups.live.map((c) => <Row key={c.id} c={c} />)}
          {groups.archived.map((c) => <Row key={c.id} c={c} />)}
        </div>
      )}

      {/* Modals */}
      {formOpen && (
        <WorkCardForm
          initialData={editCard}
          presetRef={!editCard ? { type: refType, id: String(refId), label: refLabel } : null}
          profile={profile}
          onClose={() => { setFormOpen(false); setEditCard(null); }}
          onSaved={(newCard) => {
            setFormOpen(false); setEditCard(null); fetchCards();
            if (newCard) setSelected(newCard);
            if (selected && editCard) supabase.from('work_cards').select('*').eq('id', editCard.id).single().then(({ data }) => data && setSelected(data));
          }}
        />
      )}
      {selected && !formOpen && (
        <WorkCardDetail
          card={selected}
          onClose={() => setSelected(null)}
          onChanged={() => fetchCards()}
          onEdit={(c) => { setEditCard(c); setFormOpen(true); }}
        />
      )}
    </div>
  );
};

export default WorkCardStrip;
