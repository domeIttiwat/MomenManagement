'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Warehouse, MapPin, Edit2, Eye, Search, ToggleLeft, ToggleRight, ImageOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

const StoreList = ({ onNew, onEdit, onView }) => {
  const { can } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStores = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    setStores(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const toggleActive = async (store) => {
    await supabase.from('stores').update({ is_active: !store.is_active, updated_at: new Date().toISOString() }).eq('id', store.id);
    fetchStores();
  };

  const filtered = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.location_detail || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            placeholder="ค้นหาคลังสินค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {can('stock', 'create') && (
          <button onClick={onNew} className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm transition-colors shadow-sm">
            <Plus size={16} /> เพิ่มคลังใหม่
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
          <Warehouse size={40} className="mb-3 opacity-20" />
          <p className="font-medium">ยังไม่มีคลังสินค้า</p>
          <p className="text-sm mt-1">กดปุ่ม "เพิ่มคลังใหม่" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(store => {
            const coverImage = Array.isArray(store.images) && store.images.length > 0 ? store.images[0]?.url : null;
            return (
              <div key={store.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Image */}
                <div className="h-36 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {coverImage
                    ? <img src={coverImage} alt={store.name} className="w-full h-full object-cover" />
                    : <ImageOff size={32} className="text-gray-300" />
                  }
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 truncate">{store.name}</h3>
                      {store.location_detail && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={12} /> {store.location_detail}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${store.is_active ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                      {store.is_active ? 'ใช้งาน' : 'ปิด'}
                    </span>
                  </div>

                  {store.description && <p className="text-xs text-gray-500 line-clamp-2">{store.description}</p>}

                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => onView(store)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl font-medium transition-colors">
                      <Eye size={14} /> ดู
                    </button>
                    {can('stock', 'edit') && (
                      <button onClick={() => onEdit(store)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl font-medium transition-colors">
                        <Edit2 size={14} /> แก้ไข
                      </button>
                    )}
                    {can('stock', 'edit') && (
                      <button onClick={() => toggleActive(store)} className="p-2 text-gray-400 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 rounded-xl transition-colors" title={store.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                        {store.is_active ? <ToggleRight size={18} className="text-teal-500" /> : <ToggleLeft size={18} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreList;
