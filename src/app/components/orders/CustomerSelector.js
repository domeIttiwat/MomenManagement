import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, X, User, Phone, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CustomerForm from '../customers/CustomerForm';

const CustomerSelector = ({ selectedCustomer, onSelect }) => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Keyboard nav
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCustomers = async (searchTerm = '') => {
    let query = supabase.from('customers').select('*');
    if (searchTerm) {
      query = query.or(`first_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,nickname.ilike.%${searchTerm}%`);
    } else {
      query = query.order('created_at', { ascending: false }).limit(5);
    }
    const { data } = await query;
    if (data) {
        setCustomers(data);
        setActiveIndex(-1); // Reset index on new search
    }
  };

  useEffect(() => {
    if (isOpen) fetchCustomers(search);
  }, [search, isOpen]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
        if (e.key === 'ArrowDown') setIsOpen(true);
        return;
    }
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < customers.length - 1 ? prev + 1 : prev));
      // Scroll into view logic could be added here similar to ProductSelector
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && customers[activeIndex]) {
        handleSelect(customers[activeIndex]);
      } else if (search) {
         // Maybe trigger Add New Customer? For now just prevent submit
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (c) => {
    onSelect(c);
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomerCreated = async () => {
    setShowAddForm(false);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(1).single();
    if (data) {
      onSelect(data);
      setSearch('');
      setIsOpen(false);
    }
  };

  const modalContent = showAddForm ? (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="p-2">
          <CustomerForm 
            onCancel={() => setShowAddForm(false)} 
            onSuccess={handleCustomerCreated} 
          /> 
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      {!selectedCustomer ? (
        <div className="relative">
          <input
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all outline-none font-medium"
            placeholder="ค้นหาลูกค้า หรือคลิกเพื่อดูรายการล่าสุด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
          <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
          
          {isOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
              <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="max-h-60 overflow-y-auto" ref={listRef}>
                  {!search && <div className="px-3 py-2 text-xs font-bold text-gray-400 bg-gray-50 flex items-center gap-1"><Clock size={12}/> ลูกค้าล่าสุด</div>}
                  
                  {customers.length > 0 ? customers.map((c, idx) => (
                    <div 
                        key={c.id} 
                        onClick={() => handleSelect(c)} 
                        className={`p-3 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-none group transition-colors ${activeIndex === idx ? 'bg-indigo-50' : 'hover:bg-indigo-50'}`}
                    >
                      <div>
                        <p className="font-bold text-gray-800 group-hover:text-indigo-700">{c.first_name} {c.last_name} <span className="text-gray-500 font-normal">({c.nickname || '-'})</span></p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10}/> {c.phone}</p>
                      </div>
                      <User size={16} className="text-gray-300 group-hover:text-indigo-500" />
                    </div>
                  )) : (
                    <div className="p-3 text-center text-sm text-gray-400">ไม่พบลูกค้า</div>
                  )}
                </div>
                <div 
                  onClick={() => setShowAddForm(true)}
                  className="p-3 bg-indigo-50 text-indigo-700 font-bold text-sm cursor-pointer hover:bg-indigo-100 flex items-center justify-center gap-2 border-t border-indigo-100"
                >
                  <UserPlus size={16} /> เพิ่มลูกค้าใหม่ทันที
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex justify-between items-start animate-in fade-in group relative">
          <div>
            <p className="font-bold text-indigo-900 text-lg flex items-center gap-2">
              <User size={18} className="text-indigo-500"/>
              {selectedCustomer.first_name} {selectedCustomer.last_name}
              <span className="text-sm font-normal text-indigo-600 bg-indigo-100 px-2 rounded-full">({selectedCustomer.nickname})</span>
            </p>
            <p className="text-sm text-indigo-700 mt-1 flex items-center gap-2"><Phone size={14}/> {selectedCustomer.phone}</p>
            <p className="text-xs text-gray-500 mt-1 flex items-start gap-2 max-w-md"><MapPin size={14} className="shrink-0 mt-0.5"/> {selectedCustomer.address_raw || 'ไม่ระบุที่อยู่'}</p>
          </div>
          <button onClick={() => onSelect(null)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors absolute top-2 right-2"><X size={18}/></button>
        </div>
      )}

      {mounted && modalContent && createPortal(modalContent, document.body)}
    </div>
  );
};
export default CustomerSelector;