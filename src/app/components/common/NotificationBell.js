'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

// กระดิ่งแจ้งเตือนกลาง — ลอยมุมขวาล่าง เห็นจากทุกหน้า
// กดแจ้งเตือนงานประกอบ → เปิดการ์ดงานนั้นให้เลย (ผ่าน onOpenWorkCard)
const NotificationBell = ({ onOpenWorkCard }) => {
  const { profile } = useAuth();
  const [notis, setNotis] = useState([]);
  const [open, setOpen] = useState(false);

  const fetchNotis = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase.from('notifications').select('*')
        .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
      setNotis(data || []);
    } catch { /* ignore */ }
  }, [profile?.id]);

  useEffect(() => {
    fetchNotis();
    const t = setInterval(fetchNotis, 60000); // เช็คทุก 1 นาที
    const onFocus = () => fetchNotis();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [fetchNotis]);

  if (!profile?.id) return null;

  const unread = notis.filter((n) => !n.read_at).length;

  const openNoti = (n) => {
    setOpen(false);
    if (!n.read_at) {
      setNotis((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id).then(() => {});
    }
    if (n.link_type === 'work_card' && n.link_id && onOpenWorkCard) onOpenWorkCard(n.link_id);
  };

  const markAllRead = async () => {
    setNotis((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', profile.id).is('read_at', null);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[85]">
      {open && (
        <>
          <span className="fixed inset-0 z-[84]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-16 right-0 z-[86] w-[320px] max-w-[calc(100vw-40px)] bg-white text-gray-800 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="px-4 py-2.5 border-b flex items-center justify-between bg-gray-50">
              <span className="text-sm font-bold">แจ้งเตือน</span>
              {unread > 0 && <button onClick={markAllRead} className="text-[11px] font-bold text-indigo-600 hover:underline">อ่านทั้งหมด</button>}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notis.length === 0 && <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีแจ้งเตือน</p>}
              {notis.map((n) => (
                <button key={n.id} onClick={() => openNoti(n)}
                  className={`w-full text-left px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${!n.read_at ? 'bg-indigo-50/50' : ''}`}>
                  <p className={`text-xs leading-snug ${!n.read_at ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                  {n.body && <p className="text-[11px] text-gray-400 truncate mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-gray-300 mt-0.5">{new Date(n.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <button onClick={() => { setOpen((v) => !v); if (!open) fetchNotis(); }}
        className={`relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${unread > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
};

export default NotificationBell;
