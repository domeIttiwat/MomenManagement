import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, LayoutGrid, List as ListIcon, Loader2, ArrowUpDown, Filter, Eye, EyeOff, History, ShoppingBag, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import AuditLogPanel from '@/app/components/common/AuditLogPanel';
import OrderList from './OrderList';
import OrderForm from './OrderForm';
import OrderDetail from './OrderDetail';
import OrderCard from './OrderCard';

const OrderMain = ({ initialNavData, onViewCustomer }) => {
  const { can, profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const [view, setView] = useState('list');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState('');
  
  const [sortOption, setSortOption] = useState('newest');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showProfit, setShowProfit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders')
      // --- FIX: เพิ่ม user_id ใน order_assignees ---
      .select('*, order_items(*), order_payments(*), order_updates(*), order_assignees(user_id, job_role, user:user_id(first_name, last_name, avatar_url))')
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // ... (Code ส่วนที่เหลือเหมือนเดิมทุกประการ)
  useEffect(() => {
    if (initialNavData && initialNavData.target === 'order' && initialNavData.data) {
      setSelectedOrder(initialNavData.data);
      setView('detail');
    }
  }, [initialNavData]);

  const handleDelete = async (id) => {
    if(!confirm('ลบออเดอร์นี้?')) return;
    const target = orders.find(o => o.id === id);
    await logAction({
      resource_type: 'order', resource_id: id, action: 'delete',
      resource_label: target?.order_number,
      old_data: target ? { order_number: target.order_number, status: target.status, grand_total: target.grand_total } : null,
      created_by: meRef(),
    });
    await supabase.from('orders').delete().eq('id', id);
    fetchOrders();
    setView('list');
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...orders];

    if (!showHistory) {
      result = result.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled');
    }

    if (!showQuotation) {
      result = result.filter(o => o.status !== 'Quotation');
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(o => 
        o.order_number.toLowerCase().includes(s) || 
        o.customer_cache?.first_name?.toLowerCase().includes(s) ||
        o.customer_cache?.nickname?.toLowerCase().includes(s)
      );
    }

    if (filterStatus !== 'All') {
      result = result.filter(o => o.status === filterStatus);
    }

    switch(sortOption) {
      case 'newest': result.sort((a,b) => new Date(b.order_date) - new Date(a.order_date)); break;
      case 'oldest': result.sort((a,b) => new Date(a.order_date) - new Date(b.order_date)); break;
      case 'total_high': result.sort((a,b) => b.grand_total - a.grand_total); break;
      case 'total_low': result.sort((a,b) => a.grand_total - b.grand_total); break;
    }

    return result;
  }, [orders, search, filterStatus, sortOption, showHistory, showQuotation]);

  if (view === 'form') return <OrderForm onCancel={() => setView('list')} onSuccess={() => { setView('list'); fetchOrders(); }} initialData={selectedOrder} />;
  if (view === 'log') return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-in fade-in">
      <button onClick={() => setView('list')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
        <ShoppingBag size={16} /> กลับรายการออเดอร์
      </button>
      <AuditLogPanel resourceType="order" title="Log รวม — ออเดอร์ทั้งหมด" />
    </div>
  );
  
  if (view === 'detail') return (
    <OrderDetail 
      order={selectedOrder} 
      onBack={() => setView('list')} 
      onEdit={() => setView('form')} 
      onDelete={() => handleDelete(selectedOrder.id)} 
      showProfit={showProfit}
      setShowProfit={setShowProfit}
      onViewCustomer={onViewCustomer} 
    />
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-emerald-600 to-teal-600 p-6 rounded-2xl shadow-lg text-white">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <ShoppingBag size={32} className="text-emerald-100" /> คำสั่งซื้อ
           </h1>
           <p className="text-emerald-100 mt-1 font-medium ml-1">
             รายการขายทั้งหมด ({filteredAndSorted.length}) 
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
          {can('orders', 'create') && (
            <button
              onClick={() => { setSelectedOrder(null); setView('form'); }}
              className="bg-white text-emerald-600 hover:bg-emerald-50 px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus size={24}/> สร้างออเดอร์ใหม่
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
          <input 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 hover:bg-gray-100 focus:bg-white border-transparent focus:border-indigo-500 rounded-xl transition-all outline-none" 
            placeholder="ค้นหาเลขที่, ชื่อลูกค้า..." 
            value={search} onChange={e => setSearch(e.target.value)} 
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 px-2">
          {/* Show History Toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showHistory ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-gray-500 hover:bg-gray-50'}`}
            title="แสดงออเดอร์ที่เสร็จสิ้น/ยกเลิก"
          >
             <History size={18} /> {showHistory ? 'แสดงทั้งหมด' : 'ดูประวัติเก่า'}
          </button>

          {/* Show Quotation Toggle */}
          <button
            onClick={() => setShowQuotation(!showQuotation)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showQuotation ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-gray-500 hover:bg-gray-50'}`}
            title="แสดง/ซ่อนใบเสนอราคา"
          >
            <FileText size={18} /> {showQuotation ? 'ซ่อนเสนอราคา' : 'เสนอราคา'}
          </button>

          <div className="w-px h-8 bg-gray-200 mx-2 hidden md:block" />

          {/* Status Filter */}
          <div className="relative">
             <select 
               className="appearance-none bg-gray-50 hover:bg-gray-100 px-4 py-3 pl-10 pr-8 rounded-xl text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer border-none"
               value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
             >
               <option value="All">ทุกสถานะ</option>
               <option value="Quotation">เสนอราคา</option>
               <option value="Deposit">มัดจำ</option>
               <option value="Paid">ชำระแล้ว</option>
               <option value="Assembling">ส่งประกอบ</option>
               <option value="Shipping">เตรียมส่ง</option>
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
               <option value="newest">วันที่ (ใหม่-เก่า)</option>
               <option value="oldest">วันที่ (เก่า-ใหม่)</option>
               <option value="total_high">ยอด (มาก-น้อย)</option>
               <option value="total_low">ยอด (น้อย-มาก)</option>
             </select>
             <ArrowUpDown size={16} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none"/>
          </div>

          <div className="w-px h-8 bg-gray-200 mx-2 hidden md:block" />
          
          {/* Profit Toggle */}
          {can('orders', 'show_profit') && (
            <button
              onClick={() => setShowProfit(!showProfit)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showProfit ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {showProfit ? <Eye size={18}/> : <EyeOff size={18}/>}
              <span className="hidden sm:inline">{showProfit ? 'ซ่อนกำไร' : 'แสดงกำไร'}</span>
            </button>
          )}

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><ListIcon size={20}/></button>
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={20}/></button>
          </div>
        </div>
      </div>

      {loading ? <div className="text-center py-20"><Loader2 className="animate-spin inline text-indigo-600"/></div> : 
        viewMode === 'list' ? (
          <OrderList orders={filteredAndSorted} showProfit={showProfit} onSelect={o => { setSelectedOrder(o); setView('detail'); }} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
             {filteredAndSorted.map(o => <OrderCard key={o.id} order={o} showProfit={showProfit} onClick={() => { setSelectedOrder(o); setView('detail'); }} />)}
          </div>
        )
      }
    </div>
  );
};
export default OrderMain;