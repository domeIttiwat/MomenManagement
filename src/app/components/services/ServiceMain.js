import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Wrench, Loader2, List as ListIcon, LayoutGrid, Filter, ArrowUpDown, History, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import { fetchFocusIds, toggleFocus } from '@/lib/userFocus';
import AuditLogPanel from '@/app/components/common/AuditLogPanel';
import ServiceList from './ServiceList';
import ServiceForm from './ServiceForm';
import ServiceDetail from './ServiceDetail';

const ServiceMain = () => {
  const { can, profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const [view, setView] = useState('list');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [selectedService, setSelectedService] = useState(null);
  const [search, setSearch] = useState('');
  
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortOption, setSortOption] = useState('newest');
  const [showHistory, setShowHistory] = useState(false);
  const [showProfit, setShowProfit] = useState(false);
  const [focusIds, setFocusIds] = useState(new Set()); // Focus ส่วนตัว — ของใครของมัน

  useEffect(() => {
    if (!profile?.id) return;
    fetchFocusIds(profile.id, 'service').then(setFocusIds);
  }, [profile?.id]);

  const handleToggleFocus = async (serviceId) => {
    const id = String(serviceId);
    setFocusIds(prev => { // optimistic
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    try { await toggleFocus(profile?.id, 'service', serviceId); }
    catch { fetchFocusIds(profile?.id, 'service').then(setFocusIds); }
  };

  const fetchServices = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase.from('services')
      // --- FIX: เพิ่ม user_id ใน service_assignees ---
      .select('*, service_items(*), service_assignees(user_id, job_role, user:user_id(first_name, last_name, avatar_url)), service_payments(*), service_updates(*)')
      .order('created_at', { ascending: false });
    let list = data || [];
    // เติมข้อมูลลูกค้าสด (รูป/ชื่อ/เบอร์ล่าสุด) ทับ cache — ใบงานเก่าที่ cache ไม่มีรูปจะได้แสดงรูปด้วย
    try {
      const customerIds = [...new Set(list.map((s) => s.customer_id).filter(Boolean))];
      if (customerIds.length) {
        const { data: customers } = await supabase.from('customers').select('*').in('id', customerIds);
        const byId = {};
        (customers || []).forEach((c) => { byId[c.id] = c; });
        list = list.map((s) => byId[s.customer_id]
          ? { ...s, customer_cache: { ...(s.customer_cache || {}), ...byId[s.customer_id] } }
          : s);
      }
    } catch { /* ไม่ให้กระทบการโหลด */ }
    // แนบความคืบหน้าการเตรียมของ (เฉพาะงานที่กดเริ่มเตรียมแล้ว) → ใช้โชว์บาร์ในหน้ารวม
    try {
      const { data: preps } = await supabase.from('service_preps').select('id, service_id, status');
      if (preps && preps.length) {
        const { data: pitems } = await supabase.from('service_prep_items')
          .select('prep_id, id, kind, parent_item_id, status').in('prep_id', preps.map((p) => p.id));
        const byPrep = {};
        (pitems || []).forEach((it) => { (byPrep[it.prep_id] = byPrep[it.prep_id] || []).push(it); });
        const prepByService = {};
        preps.forEach((p) => {
          const its = byPrep[p.id] || [];
          const parents = new Set(its.filter((x) => x.parent_item_id).map((x) => x.parent_item_id));
          const leaves = its.filter((x) => x.kind !== 'product' || !parents.has(x.id));
          const total = leaves.length;
          const done = leaves.filter((x) => x.status === 'done').length;
          prepByService[p.service_id] = { total, done, progress: total ? Math.round((done / total) * 100) : 0, status: p.status };
        });
        list = list.map((s) => ({ ...s, _prep: prepByService[s.id] || null }));
      }
    } catch { /* ไม่ให้กระทบการโหลดงานซ่อม */ }
    setServices(list);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const handleDelete = async (id) => {
    if(!confirm('ลบรายการซ่อมนี้?')) return;
    const target = services.find(s => s.id === id);
    await logAction({
      resource_type: 'service', resource_id: id, action: 'delete',
      resource_label: target?.service_number,
      old_data: target ? { service_number: target.service_number, status: target.status, grand_total: target.grand_total } : null,
      created_by: meRef(),
    });
    await supabase.from('services').delete().eq('id', id);
    fetchServices();
    setView('list');
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...services];

    if (!showHistory) {
      result = result.filter(item => item.status !== 'Completed' && item.status !== 'Cancelled');
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(item => 
        item.service_number.toLowerCase().includes(s) ||
        item.customer_cache?.first_name?.toLowerCase().includes(s) ||
        item.customer_cache?.phone?.includes(s)
      );
    }

    if (filterStatus !== 'All') {
      result = result.filter(item => item.status === filterStatus);
    }

    switch(sortOption) {
      case 'newest': result.sort((a,b) => new Date(b.received_date) - new Date(a.received_date)); break;
      case 'oldest': result.sort((a,b) => new Date(a.received_date) - new Date(b.received_date)); break;
      case 'price_high': result.sort((a,b) => b.grand_total - a.grand_total); break;
      case 'price_low': result.sort((a,b) => a.grand_total - b.grand_total); break;
    }

    return result;
  }, [services, search, filterStatus, sortOption, showHistory]);

  if (view === 'form') return <ServiceForm onCancel={() => setView('list')} onSuccess={() => { setView('list'); fetchServices(); }} initialData={selectedService} />;
  if (view === 'detail') return <ServiceDetail service={selectedService} onBack={() => { setView('list'); fetchServices(true); }} onEdit={() => setView('form')} onDelete={() => handleDelete(selectedService.id)} showProfit={showProfit} setShowProfit={setShowProfit} />;
  if (view === 'log') return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-in fade-in">
      <button onClick={() => setView('list')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
        <Wrench size={16} /> กลับรายการงานซ่อม
      </button>
      <AuditLogPanel resourceType="service" title="Log รวม — งานซ่อมทั้งหมด" />
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-orange-500 to-amber-500 p-6 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Wrench size={32} className="text-orange-100"/> คิวซ่อม / งานบริการ
          </h1>
          <p className="text-orange-100 mt-1 font-medium ml-1">
            รายการทั้งหมด ({filteredAndSorted.length})
            {!showHistory && <span className="text-xs bg-white/20 px-2 py-0.5 rounded ml-2 text-white">ซ่อนรายการเสร็จสิ้น</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('log')}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-medium backdrop-blur-sm transition-all text-sm border border-white/10 flex items-center gap-2"
          >
            <History size={18}/> Log ทั้งหมด
          </button>
          {can('services', 'create') && (
            <button
              onClick={() => { setSelectedService(null); setView('form'); }}
              className="bg-white text-orange-600 hover:bg-orange-50 px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus size={24}/> เปิดใบงานใหม่
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-3">
         <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
            <input 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl outline-none" 
              placeholder="ค้นหาเลขที่ใบงาน, ชื่อลูกค้า, เบอร์โทร..." 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
         </div>

         <div className="flex flex-wrap items-center gap-2 px-2">
            {/* Show History Toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showHistory ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-gray-500 hover:bg-gray-50'}`}
              title="แสดงงานที่เสร็จสิ้น/ยกเลิก"
            >
              <History size={18}/> {showHistory ? 'แสดงทั้งหมด' : 'ดูประวัติเก่า'}
            </button>

            <div className="w-px h-8 bg-gray-200 mx-1 hidden md:block"/>

            {/* Status Filter */}
            <div className="relative">
               <select 
                 className="appearance-none bg-gray-50 hover:bg-gray-100 px-4 py-3 pl-10 pr-8 rounded-xl text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer border-none"
                 value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
               >
                 <option value="All">ทุกสถานะ</option>
                 <option value="Assessing">รอประเมิน</option>
                 <option value="Waiting">รอทำ</option>
                 <option value="In Progress">ส่งทำ</option>
                 <option value="Tested">ทดสอบแล้ว</option>
                 <option value="Delivered">รอส่ง</option>
                 <option value="Completed">เรียบร้อย</option>
                 <option value="Cancelled">ยกเลิก</option>
               </select>
               <Filter size={16} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none"/>
            </div>

            {/* Sort */}
            <div className="relative">
               <select 
                 className="appearance-none bg-gray-50 hover:bg-gray-100 px-4 py-3 pl-10 pr-8 rounded-xl text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer border-none"
                 value={sortOption} onChange={e => setSortOption(e.target.value)}
               >
                 <option value="newest">วันที่รับ (ใหม่-เก่า)</option>
                 <option value="oldest">วันที่รับ (เก่า-ใหม่)</option>
                 <option value="price_high">ค่าใช้จ่าย (มาก-น้อย)</option>
                 <option value="price_low">ค่าใช้จ่าย (น้อย-มาก)</option>
               </select>
               <ArrowUpDown size={16} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none"/>
            </div>

            <div className="w-px h-8 bg-gray-200 mx-2 hidden xl:block" />

            {/* Profit Toggle */}
            {can('services', 'show_profit') && (
              <button
                onClick={() => setShowProfit(!showProfit)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showProfit ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {showProfit ? <Eye size={18}/> : <EyeOff size={18}/>}
                <span className="hidden sm:inline">{showProfit ? 'ซ่อนกำไร' : 'แสดงกำไร'}</span>
              </button>
            )}

            <div className="w-px h-8 bg-gray-200 mx-2 hidden xl:block" />

            {/* View Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><ListIcon size={20}/></button>
              <button onClick={() => setViewMode('card')} className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={20}/></button>
            </div>
         </div>
      </div>

      {loading ? <div className="text-center py-20"><Loader2 className="animate-spin inline"/></div> : 
         <ServiceList services={filteredAndSorted} viewMode={viewMode} onSelect={s => { setSelectedService(s); setView('detail'); }} focusIds={focusIds} onToggleFocus={handleToggleFocus} />
      }
    </div>
  );
};
export default ServiceMain;