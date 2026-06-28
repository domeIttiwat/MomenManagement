'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Warehouse, MapPin, Edit2, Eye, Search, ToggleLeft, ToggleRight, ImageOff, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

const StoreList = ({ onNew, onEdit, onView }) => {
  const { can } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Delete store states
  const [deletingStore, setDeletingStore] = useState(null);
  const [deleteStoreNote, setDeleteStoreNote] = useState('');
  const [deleteStoreItems, setDeleteStoreItems] = useState([]);
  const [deleteStoreStats, setDeleteStoreStats] = useState({ locCount: 0, itemCount: 0, totalQty: 0 });
  const [deleteStoreLoading, setDeleteStoreLoading] = useState(false);

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
    const newActive = !store.is_active;
    // Cascade to storage_locations
    await supabase.from('storage_locations').update({ is_active: newActive }).eq('store_id', store.id);
    await supabase.from('stores').update({ is_active: newActive, updated_at: new Date().toISOString() }).eq('id', store.id);
    fetchStores();
  };

  const handleDeleteStoreClick = async (e, store) => {
    e.stopPropagation();
    const { data: locs } = await supabase.from('storage_locations').select('id').eq('store_id', store.id);
    const locIds = (locs || []).map(l => l.id);
    let items = [];
    if (locIds.length > 0) {
      const { data } = await supabase
        .from('stock_items')
        .select('id, quantity, product:product_id(name), variant:variant_id(name)')
        .in('location_id', locIds)
        .gt('quantity', 0);
      items = data || [];
    }
    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
    setDeleteStoreStats({ locCount: locIds.length, itemCount: items.length, totalQty });
    setDeleteStoreItems(items);
    setDeletingStore(store);
    setDeleteStoreNote('');
  };

  const closeDeleteStoreDialog = () => {
    setDeletingStore(null);
    setDeleteStoreNote('');
    setDeleteStoreItems([]);
    setDeleteStoreStats({ locCount: 0, itemCount: 0, totalQty: 0 });
  };

  const confirmDeleteStore = async () => {
    if (deleteStoreNote.trim() !== (deletingStore?.name || '')) return alert('พิมพ์ชื่อคลังให้ตรงเพื่อยืนยันการลบ');
    setDeleteStoreLoading(true);
    try {
      // 1. ย้าย stock ในคลังนี้ไป "ไม่ระบุที่เก็บ" แบบ "รวมยอด" (atomic ผ่าน RPC — กัน unique ชน)
      const { data: locs } = await supabase.from('storage_locations').select('id').eq('store_id', deletingStore.id);
      const locIds = (locs || []).map(l => l.id);
      if (locIds.length > 0) {
        const { error: rpcErr } = await supabase.rpc('stock_unassign_locations', { p_location_ids: locIds });
        if (rpcErr) throw rpcErr;
      }
      // 2. ลบคลัง (CASCADE ลบ storage_locations)
      const { error: delErr } = await supabase.from('stores').delete().eq('id', deletingStore.id);
      if (delErr) throw delErr;
      closeDeleteStoreDialog();
      fetchStores();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setDeleteStoreLoading(false);
    }
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
                    {can('stock', 'delete') && (
                      <button onClick={e => handleDeleteStoreClick(e, store)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-xl transition-colors" title="ลบถาวร">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Delete Store Modal */}
      {deletingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">ลบคลัง "{deletingStore.name}"</h3>
                <p className="text-xs text-gray-500">การลบถาวรไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            {deleteStoreItems.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm">
                <p className="font-semibold text-amber-800 mb-1">⚠ คลังนี้มีสินค้าอยู่</p>
                <ul className="text-amber-700 space-y-0.5">
                  <li>• {deleteStoreStats.locCount} ชั้นวาง</li>
                  <li>• {deleteStoreStats.itemCount} รายการสินค้า</li>
                  <li>• รวม {deleteStoreStats.totalQty} ชิ้น</li>
                </ul>
                <p className="text-xs text-amber-600 mt-2">สินค้าทั้งหมดจะถูกย้ายไปที่ "ไม่ระบุที่เก็บ"</p>
              </div>
            )}

            <p className="text-xs text-gray-500 mb-1.5">พิมพ์ชื่อคลัง <span className="font-bold text-gray-700">{deletingStore.name}</span> เพื่อยืนยันการลบ</p>
            <input
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 rounded-xl outline-none text-gray-700 text-sm mb-4"
              placeholder={deletingStore.name}
              value={deleteStoreNote}
              onChange={e => setDeleteStoreNote(e.target.value)}
              autoFocus
            />

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeDeleteStoreDialog}
                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium transition-colors">
                ยกเลิก
              </button>
              <button type="button" onClick={confirmDeleteStore} disabled={deleteStoreLoading || deleteStoreNote.trim() !== deletingStore.name}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                {deleteStoreLoading ? '...' : (
                  deleteStoreItems.length > 0
                    ? <><Trash2 size={13} /> ย้ายสินค้าไปไม่ระบุที่เก็บ แล้วลบคลัง</>
                    : <><Trash2 size={13} /> ยืนยันลบคลัง</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreList;
