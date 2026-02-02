import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Wrench, Loader2, List as ListIcon, LayoutGrid, Filter, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ServiceList from './ServiceList';
import ServiceForm from './ServiceForm';
import ServiceDetail from './ServiceDetail';

const ServiceMain = () => {
  const [view, setView] = useState('list');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [selectedService, setSelectedService] = useState(null);
  const [search, setSearch] = useState('');
  
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortOption, setSortOption] = useState('newest');

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase.from('services')
      // --- FIX: เพิ่ม user_id ใน service_assignees ---
      .select('*, service_items(*), service_assignees(user_id, job_role, user:user_id(first_name, last_name, avatar_url)), service_payments(*), service_updates(*)')
      .order('created_at', { ascending: false });
    if (data) setServices(data);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const handleDelete = async (id) => {
    if(!confirm('ลบรายการซ่อมนี้?')) return;
    await supabase.from('services').delete().eq('id', id);
    fetchServices();
    setView('list');
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...services];

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
  }, [services, search, filterStatus, sortOption]);

  if (view === 'form') return <ServiceForm onCancel={() => setView('list')} onSuccess={() => { setView('list'); fetchServices(); }} initialData={selectedService} />;
  if (view === 'detail') return <ServiceDetail service={selectedService} onBack={() => setView('list')} onEdit={() => setView('form')} onDelete={() => handleDelete(selectedService.id)} />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
           <Wrench className="text-indigo-600"/> คิวซ่อม / งานบริการ
        </h1>
        <button 
          onClick={() => { setSelectedService(null); setView('form'); }} 
          className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-medium shadow-lg flex items-center gap-2 transition-all active:scale-95"
        >
           <Plus size={20}/> เปิดใบงานใหม่
        </button>
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
            {/* Status Filter */}
            <div className="relative">
               <select 
                 className="appearance-none bg-gray-50 hover:bg-gray-100 px-4 py-3 pl-10 pr-8 rounded-xl text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer border-none"
                 value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
               >
                 <option value="All">ทุกสถานะ</option>
                 <option value="Waiting">รอทำ</option>
                 <option value="In Progress">ส่งทำ</option>
                 <option value="Done">ทำเสร็จแล้ว</option>
                 <option value="Tested">ทดสอบแล้ว</option>
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

            {/* View Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><ListIcon size={20}/></button>
              <button onClick={() => setViewMode('card')} className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={20}/></button>
            </div>
         </div>
      </div>

      {loading ? <div className="text-center py-20"><Loader2 className="animate-spin inline"/></div> : 
         <ServiceList services={filteredAndSorted} viewMode={viewMode} onSelect={s => { setSelectedService(s); setView('detail'); }} />
      }
    </div>
  );
};
export default ServiceMain;