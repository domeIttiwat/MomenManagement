'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Edit2, MapPin, Warehouse, PackageCheck, PackageMinus,
  Sliders, Calendar, User, MessageSquare, Plus, ChevronDown,
  ChevronRight, Layers, Trash2, Package, Clock, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import StorageLocationForm from './StorageLocationForm';

const TX_TYPE_CONFIG = {
  stock_in:   { label: 'รับเข้า',   color: 'bg-green-100 text-green-700',  icon: PackageCheck },
  stock_out:  { label: 'เบิกออก',   color: 'bg-red-100 text-red-700',     icon: PackageMinus },
  adjustment: { label: 'ปรับสต๊อก', color: 'bg-blue-100 text-blue-700',   icon: Sliders },
};

const StoreDetail = ({ store, onBack, onEdit, onAddToLocation }) => {
  const { can, profile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationItems, setLocationItems] = useState({});
  const [locationLogs, setLocationLogs] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [locLoading, setLocLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(true);
  const [expandedLocs, setExpandedLocs] = useState({});
  const [showLocForm, setShowLocForm] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);

  // Delete with note
  const [deletingLoc, setDeletingLoc] = useState(null); // location object
  const [deleteNote, setDeleteNote] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteLocItems, setDeleteLocItems] = useState([]); // stock_items with qty > 0

  const fetchLocations = useCallback(async () => {
    if (!store?.id) return;
    setLocLoading(true);
    const { data: locs } = await supabase
      .from('storage_locations').select('*')
      .eq('store_id', store.id).order('sort_order').order('code');
    const locList = locs || [];
    setLocations(locList);
    if (locList.length > 0) {
      const { data: items } = await supabase
        .from('stock_items')
        .select('id, quantity, min_quantity, location_id, product:product_id(id, name, sku), variant:variant_id(id, name)')
        .in('location_id', locList.map(l => l.id));
      const map = {};
      (items || []).forEach(item => {
        if (!map[item.location_id]) map[item.location_id] = [];
        map[item.location_id].push(item);
      });
      setLocationItems(map);
    } else {
      setLocationItems({});
    }
    setLocLoading(false);
  }, [store?.id]);

  const fetchTx = useCallback(async () => {
    if (!store?.id) return;
    setTxLoading(true);
    const { data } = await supabase
      .from('stock_transactions')
      .select(`*, product:product_id(name, sku), variant:variant_id(name), location:location_id(code, name), created_by_profile:created_by(first_name, last_name)`)
      .eq('store_id', store.id).order('created_at', { ascending: false }).limit(50);
    setTransactions(data || []);
    setTxLoading(false);
  }, [store?.id]);

  const fetchLocationLogs = useCallback(async () => {
    if (!store?.id) return;
    setLogLoading(true);
    const { data } = await supabase
      .from('storage_location_logs')
      .select('*, creator:created_by(first_name, last_name)')
      .eq('store_id', store.id).order('created_at', { ascending: false }).limit(100);
    setLocationLogs(data || []);
    setLogLoading(false);
  }, [store?.id]);

  useEffect(() => {
    fetchLocations();
    fetchTx();
    fetchLocationLogs();
  }, [fetchLocations, fetchTx, fetchLocationLogs]);

  const handleDeleteLocClick = async (e, loc) => {
    e.stopPropagation();
    const { data } = await supabase
      .from('stock_items')
      .select('id, quantity, product:product_id(id, name), variant:variant_id(id, name)')
      .eq('location_id', loc.id)
      .gt('quantity', 0);
    setDeleteLocItems(data || []);
    setDeletingLoc(loc);
    setDeleteNote('');
  };

  const closeDeleteLocDialog = () => {
    setDeletingLoc(null);
    setDeleteNote('');
    setDeleteLocItems([]);
  };

  const confirmDeleteLocation = async () => {
    if (!deleteNote.trim()) return alert('กรุณาระบุหมายเหตุการลบ');
    setDeleteLoading(true);
    try {
      await supabase.from('storage_location_logs').insert([{
        location_id: deletingLoc.id,
        store_id: store.id,
        location_code: deletingLoc.code,
        action: 'delete',
        note: deleteNote.trim(),
        created_by: profile?.id,
      }]);
      await supabase.from('storage_locations').delete().eq('id', deletingLoc.id);
      closeDeleteLocDialog();
      fetchLocations();
      fetchLocationLogs();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmDeleteLocationWithMove = async () => {
    if (!deleteNote.trim()) return alert('กรุณาระบุหมายเหตุการลบ');
    setDeleteLoading(true);
    try {
      // 1. Move all items to "ไม่ระบุที่เก็บ"
      await supabase.from('stock_items').update({ location_id: null }).eq('location_id', deletingLoc.id);
      // 2. Log deletion
      await supabase.from('storage_location_logs').insert([{
        location_id: deletingLoc.id,
        store_id: store.id,
        location_code: deletingLoc.code,
        action: 'delete',
        note: deleteNote.trim(),
        created_by: profile?.id,
      }]);
      // 3. Delete location
      await supabase.from('storage_locations').delete().eq('id', deletingLoc.id);
      closeDeleteLocDialog();
      fetchLocations();
      fetchLocationLogs();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openLocForm = (loc = null) => { setEditingLoc(loc); setShowLocForm(true); };
  const closeLocForm = () => { setShowLocForm(false); setEditingLoc(null); };
  const toggleLoc = (id) => setExpandedLocs(prev => ({ ...prev, [id]: !prev[id] }));
  const coverImage = Array.isArray(store?.images) && store.images.length > 0 ? store.images[0]?.url : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium">
          <ArrowLeft size={20} /> กลับ
        </button>
        {can('stock', 'edit') && (
          <button onClick={onEdit} className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            <Edit2 size={15} /> แก้ไขคลัง
          </button>
        )}
      </div>

      {/* Store Info */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {coverImage && (
          <div className="h-40 overflow-hidden">
            <img src={coverImage} alt={store.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Warehouse size={20} className="text-teal-600" />
                <h2 className="text-xl font-bold text-gray-900">{store.name}</h2>
              </div>
              {store.location_detail && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5"><MapPin size={14} />{store.location_detail}</p>
              )}
            </div>
            <span className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full ${store.is_active ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
              {store.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
            </span>
          </div>
          {store.description && <p className="mt-3 text-sm text-gray-600">{store.description}</p>}
        </div>
      </div>

      {/* Storage Locations */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Layers size={18} className="text-teal-600" />
            ชั้นวาง / พื้นที่จัดเก็บ
            {!locLoading && (
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{locations.length}</span>
            )}
          </h3>
          {can('stock', 'create') && (
            <button onClick={() => openLocForm(null)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
              <Plus size={14} /> เพิ่มชั้นวาง
            </button>
          )}
        </div>

        {showLocForm && (
          <div className="mb-4">
            <StorageLocationForm
              storeId={store.id} initialData={editingLoc}
              onCancel={closeLocForm}
              onSuccess={() => { closeLocForm(); fetchLocations(); fetchLocationLogs(); }}
            />
          </div>
        )}

        {/* Delete confirmation inline form */}
        {deletingLoc && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
            {deleteLocItems.length > 0 ? (
              <>
                <p className="text-sm font-bold text-red-700 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> ชั้นวาง "{deletingLoc.code}" มีสินค้าอยู่
                </p>
                <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                  {deleteLocItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-white border border-red-100 rounded-xl text-sm">
                      <span className="text-gray-700 font-medium">
                        {item.product?.name}{item.variant ? ` · ${item.variant.name}` : ''}
                      </span>
                      <span className="font-bold text-red-600">{item.quantity} ชิ้น</span>
                    </div>
                  ))}
                </div>
                <input
                  className="w-full px-3 py-2.5 bg-white border border-red-200 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 rounded-xl outline-none text-gray-700 text-sm mb-3"
                  placeholder="หมายเหตุการลบ (บังคับ)..."
                  value={deleteNote}
                  onChange={e => setDeleteNote(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={closeDeleteLocDialog}
                    className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium transition-colors">
                    ยกเลิก
                  </button>
                  <button type="button" onClick={confirmDeleteLocationWithMove} disabled={deleteLoading || !deleteNote.trim()}
                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                    {deleteLoading ? '...' : <><Trash2 size={13} /> ย้ายไปไม่ระบุที่เก็บ แล้วลบชั้นนี้</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-red-700 mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> ยืนยันลบชั้นวาง "{deletingLoc.code}"
                </p>
                <input
                  className="w-full px-3 py-2.5 bg-white border border-red-200 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 rounded-xl outline-none text-gray-700 text-sm mb-3"
                  placeholder="หมายเหตุการลบ (บังคับ)..."
                  value={deleteNote}
                  onChange={e => setDeleteNote(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={closeDeleteLocDialog}
                    className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium transition-colors">
                    ยกเลิก
                  </button>
                  <button type="button" onClick={confirmDeleteLocation} disabled={deleteLoading || !deleteNote.trim()}
                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                    {deleteLoading ? '...' : <><Trash2 size={13} /> ยืนยันลบ</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {locLoading ? (
          <div className="py-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : locations.length === 0 ? (
          <div className="py-10 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
            <Layers size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">ยังไม่มีชั้นวาง</p>
          </div>
        ) : (
          <div className="space-y-2">
            {locations.map(loc => {
              const items = locationItems[loc.id] || [];
              const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
              const isExpanded = expandedLocs[loc.id];
              return (
                <div key={loc.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/80 transition-colors"
                    onClick={() => toggleLoc(loc.id)}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isExpanded ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
                      <span className="font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg text-sm shrink-0">{loc.code}</span>
                      {loc.name && <span className="font-semibold text-gray-800 text-sm truncate">{loc.name}</span>}
                      {loc.description && <span className="text-xs text-gray-400 truncate hidden sm:block">{loc.description}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                        {items.length} รายการ · {totalQty} ชิ้น
                      </span>
                      {onAddToLocation && can('stock', 'stock_in') && (
                        <button onClick={e => { e.stopPropagation(); onAddToLocation(store, loc); }}
                          className="text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 whitespace-nowrap">
                          <Plus size={11} /> เพิ่มสินค้า
                        </button>
                      )}
                      {can('stock', 'edit') && (
                        <button onClick={e => { e.stopPropagation(); openLocForm(loc); }}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="แก้ไข">
                          <Edit2 size={13} />
                        </button>
                      )}
                      {can('stock', 'delete') && (
                        <button onClick={e => handleDeleteLocClick(e, loc)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/40">
                      {items.length === 0 ? (
                        <div className="py-6 text-center text-sm text-gray-400">
                          ยังไม่มีสินค้าในชั้นวางนี้
                          {onAddToLocation && can('stock', 'stock_in') && (
                            <button onClick={() => onAddToLocation(store, loc)}
                              className="block mx-auto mt-2 text-xs text-teal-600 hover:text-teal-800 font-semibold underline">
                              + เพิ่มสินค้า
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                              <Package size={14} className="text-gray-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-gray-800 text-sm">{item.product?.name}</span>
                                {item.variant && (
                                  <span className="ml-2 text-xs text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded-md">{item.variant.name}</span>
                                )}
                                <span className="ml-2 text-xs text-gray-400 font-mono">{item.product?.sku}</span>
                              </div>
                              <span className={`font-bold text-base px-3 py-1 rounded-xl shrink-0 ${item.quantity === 0 ? 'bg-gray-100 text-gray-400' : item.quantity <= (item.min_quantity || 0) ? 'bg-red-100 text-red-700' : 'bg-teal-50 text-teal-700'}`}>
                                {item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4">ประวัติการเคลื่อนไหวในคลังนี้</h3>
        {txLoading ? (
          <div className="py-10 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">ยังไม่มีประวัติการเคลื่อนไหว</div>
        ) : (
          <div className="space-y-3">
            {transactions.map(tx => {
              const cfg = TX_TYPE_CONFIG[tx.transaction_type] || {};
              const Icon = cfg.icon || PackageCheck;
              const locationLabel = tx.location ? `${tx.location.code}${tx.location.name ? ` · ${tx.location.name}` : ''}` : null;
              const creatorName = tx.created_by_profile ? `${tx.created_by_profile.first_name} ${tx.created_by_profile.last_name}` : '—';
              return (
                <div key={tx.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{tx.product?.name || '—'}</span>
                      {tx.variant?.name && <span className="text-xs bg-white border px-2 py-0.5 rounded-full text-gray-600">{tx.variant.name}</span>}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      {locationLabel && (
                        <span className="text-xs font-mono bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-md">{locationLabel}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="font-bold text-gray-700">จำนวน: {tx.quantity}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} />{new Date(tx.created_at).toLocaleDateString('th-TH')}</span>
                      <span className="flex items-center gap-1"><Clock size={11} />{new Date(tx.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><User size={11} />{creatorName}</span>
                    </div>
                    {tx.note && (
                      <div className="mt-1.5 flex items-start gap-1 text-xs text-gray-600 bg-white px-2.5 py-1.5 rounded-lg border border-gray-100">
                        <MessageSquare size={11} className="shrink-0 mt-0.5 text-gray-400" />
                        <span>{tx.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Storage Location Logs */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Layers size={17} className="text-gray-500" />
          ประวัติการสร้าง/ลบชั้นวาง
        </h3>
        {logLoading ? (
          <div className="py-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : locationLogs.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">ยังไม่มีประวัติ</div>
        ) : (
          <div className="space-y-2">
            {locationLogs.map(log => {
              const isDelete = log.action === 'delete';
              const creatorName = log.creator ? `${log.creator.first_name} ${log.creator.last_name}` : '—';
              return (
                <div key={log.id} className={`flex items-start gap-3 p-3.5 rounded-xl border ${isDelete ? 'bg-red-50/60 border-red-100' : 'bg-green-50/40 border-green-100'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${isDelete ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {isDelete ? '−' : '+'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-sm ${isDelete ? 'text-red-700' : 'text-green-700'}`}>
                        {isDelete ? 'ลบชั้นวาง' : 'สร้างชั้นวาง'}
                      </span>
                      <span className="font-mono font-bold text-gray-700 bg-white border border-gray-200 px-1.5 py-0.5 rounded text-xs">{log.location_code}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar size={10} />{new Date(log.created_at).toLocaleDateString('th-TH')}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><User size={10} />{creatorName}</span>
                    </div>
                    {log.note && (
                      <div className="mt-1.5 flex items-start gap-1 text-xs text-gray-600 bg-white px-2.5 py-1.5 rounded-lg border border-gray-100">
                        <MessageSquare size={10} className="shrink-0 mt-0.5 text-gray-400" />
                        <span>{log.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreDetail;
