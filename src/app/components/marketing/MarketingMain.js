import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Megaphone, LayoutGrid, List as ListIcon, Loader2, Calendar, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import AuditLogPanel from '@/app/components/common/AuditLogPanel';
import MarketingList from './MarketingList';
import MarketingForm from './MarketingForm';
import MarketingDetail from './MarketingDetail';

const MarketingMain = () => {
  const { profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const [view, setView] = useState('list');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  
  // Filter States
  const [dateFilter, setDateFilter] = useState('this_month');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const fetchExpenses = async () => {
    setLoading(true);
    let query = supabase.from('marketing_expenses').select('*').order('expense_date', { ascending: false });
    
    // Date Logic
    const now = new Date();
    let startDate, endDate;

    if (dateFilter === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    } else if (dateFilter === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      endDate = new Date(now.getFullYear(), 11, 31).toISOString();
    } else if (dateFilter === 'this_quarter') {
      const q = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), q * 3, 1).toISOString();
      endDate = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString();
    } else if (dateFilter === 'custom' && customRange.start && customRange.end) {
      startDate = customRange.start;
      endDate = customRange.end;
    }

    if (startDate && endDate) {
       query = query.gte('expense_date', startDate).lte('expense_date', endDate);
    }

    const { data } = await query;
    if (data) setExpenses(data);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [dateFilter, customRange]);

  const handleDelete = async (id) => {
    if(!confirm('ลบรายการนี้?')) return;
    const target = expenses.find(e => e.id === id);
    await logAction({
      resource_type: 'marketing', resource_id: id, action: 'delete',
      resource_label: target?.title || target?.channel_name,
      old_data: target ? { title: target.title, channel_name: target.channel_name, amount: target.amount, expense_date: target.expense_date } : null,
      created_by: meRef(),
    });
    await supabase.from('marketing_expenses').delete().eq('id', id);
    fetchExpenses();
    setView('list');
  };

  // Stats
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  if (view === 'form') return <MarketingForm onCancel={() => setView('list')} onSuccess={() => { setView('list'); fetchExpenses(); }} initialData={selectedItem} />;
  if (view === 'detail') return <MarketingDetail expense={selectedItem} onBack={() => setView('list')} onEdit={() => setView('form')} onDelete={() => handleDelete(selectedItem.id)} />;
  if (view === 'log') return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-in fade-in">
      <button onClick={() => setView('list')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
        <Megaphone size={16} /> กลับรายการการตลาด
      </button>
      <AuditLogPanel resourceType="marketing" title="Log รวม — การตลาดทั้งหมด" />
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header Bar - Pink Theme */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-pink-600 to-rose-500 p-6 rounded-2xl shadow-lg text-white">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <Megaphone size={32} className="text-pink-100" /> การตลาด
           </h1>
           <p className="text-pink-100 mt-1 font-medium ml-1">บริหารงบประมาณโฆษณา</p>
        </div>
        <div className="text-right bg-white/10 p-3 rounded-xl border border-white/20">
           <p className="text-xs text-pink-100 uppercase tracking-wider">ยอดรวมช่วงนี้</p>
           <p className="text-2xl font-black">฿{totalSpent.toLocaleString()}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-3 items-center">
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setView('log')}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-colors"
          >
            <History size={16}/> Log ทั้งหมด
          </button>
          <button
            onClick={() => { setSelectedItem(null); setView('form'); }}
            className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-medium shadow-lg flex items-center gap-2"
          >
            <Plus size={20}/> เพิ่มรายการ
          </button>
        </div>

        <div className="w-px h-8 bg-gray-200 mx-2 hidden xl:block" />

        {/* Date Filter */}
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <select 
            className="bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 outline-none cursor-pointer"
            value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          >
            <option value="this_month">เดือนนี้</option>
            <option value="this_quarter">ไตรมาสนี้</option>
            <option value="this_year">ปีนี้</option>
            <option value="custom">กำหนดเอง</option>
          </select>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
              <input type="date" className="border rounded-lg px-2 py-1 text-sm" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} />
              <span className="text-gray-400">-</span>
              <input type="date" className="border rounded-lg px-2 py-1 text-sm" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} />
            </div>
          )}
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><ListIcon size={20}/></button>
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={20}/></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-pink-600" size={32} /></div>
      ) : (
        <MarketingList 
          expenses={expenses} 
          viewMode={viewMode} 
          onSelect={(item) => { setSelectedItem(item); setView('detail'); }} 
        />
      )}
    </div>
  );
};
export default MarketingMain;