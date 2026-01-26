import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, LayoutGrid, List as ListIcon, Loader2, ArrowUpDown, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CustomerList from './CustomerList';
import CustomerForm from './CustomerForm';
import CustomerDetail from './CustomerDetail';

const CustomerMain = ({ initialNavData, onViewOrder }) => {
  const [view, setView] = useState('list');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState('last_purchase');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (data) setCustomers(data);
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  // Handle Navigation from other tabs
  useEffect(() => {
    if (initialNavData && initialNavData.target === 'customer' && initialNavData.id && customers.length > 0) {
      const targetCustomer = customers.find(c => c.id === initialNavData.id);
      if (targetCustomer) {
        setSelectedCustomer(targetCustomer);
        setView('detail');
      }
    }
  }, [initialNavData, customers]);

  const handleDelete = async (id) => {
    if(!confirm('ยืนยันการลบลูกค้า?')) return;
    await supabase.from('customers').delete().eq('id', id);
    fetchCustomers();
    setView('list');
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...customers];
    if (search) {
      result = result.filter(c => 
        c.first_name.toLowerCase().includes(search.toLowerCase()) || 
        c.phone?.includes(search) ||
        c.nickname?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Sort
    switch(sortOption) {
      case 'last_purchase': result.sort((a,b) => new Date(b.last_purchase_date) - new Date(a.last_purchase_date)); break;
      case 'spent_high': result.sort((a,b) => b.total_spent - a.total_spent); break;
      case 'spent_low': result.sort((a,b) => a.total_spent - b.total_spent); break;
      case 'name_asc': result.sort((a,b) => a.first_name.localeCompare(b.first_name)); break;
      case 'name_desc': result.sort((a,b) => b.first_name.localeCompare(a.first_name)); break;
    }
    return result;
  }, [customers, search, sortOption]);

  if (view === 'form') return <CustomerForm onCancel={() => setView('list')} onSuccess={() => { setView('list'); fetchCustomers(); }} initialData={selectedCustomer} />;
  
  if (view === 'detail' && selectedCustomer) return (
    <CustomerDetail 
        customer={selectedCustomer} 
        onBack={() => setView('list')} 
        onEdit={() => setView('form')} 
        onDelete={() => handleDelete(selectedCustomer.id)} 
        onViewOrder={onViewOrder} // Pass function
    />
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header Bar - Blue Theme */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users size={32} className="text-blue-100" /> ลูกค้า
          </h1>
          <p className="text-blue-100 mt-1 font-medium ml-1">ฐานข้อมูลลูกค้าทั้งหมด ({filteredAndSorted.length})</p>
        </div>
        <button 
            onClick={() => { setSelectedCustomer(null); setView('form'); }} 
            className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
        >
          <Plus size={24} /> เพิ่มลูกค้า
        </button>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
          <input 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 hover:bg-gray-100 focus:bg-white border-transparent focus:border-indigo-500 rounded-xl transition-all outline-none" 
            placeholder="ค้นหาชื่อ, เบอร์โทร..." 
            value={search} onChange={e => setSearch(e.target.value)} 
          />
        </div>
        
        <div className="flex items-center gap-2 px-2">
          <div className="relative">
             <select 
               className="appearance-none bg-gray-50 hover:bg-gray-100 px-4 py-3 pl-10 pr-8 rounded-xl text-sm font-semibold text-gray-600 focus:outline-none cursor-pointer border-none"
               value={sortOption} onChange={e => setSortOption(e.target.value)}
             >
               <option value="last_purchase">ซื้อล่าสุด</option>
               <option value="spent_high">ยอดซื้อ มาก-น้อย</option>
               <option value="spent_low">ยอดซื้อ น้อย-มาก</option>
               <option value="name_asc">ชื่อ ก-ฮ</option>
             </select>
             <ArrowUpDown size={16} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none"/>
          </div>

          <div className="w-px h-8 bg-gray-200 mx-2" />
          
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><ListIcon size={20}/></button>
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={20}/></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
      ) : (
        <CustomerList 
          customers={filteredAndSorted} 
          viewMode={viewMode} 
          onSelect={(c) => { setSelectedCustomer(c); setView('detail'); }} 
        />
      )}
    </div>
  );
};
export default CustomerMain;