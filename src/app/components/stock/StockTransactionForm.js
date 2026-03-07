'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Save, Loader2, PackageCheck, PackageMinus, Sliders,
  Search, ChevronDown, MapPin, Plus, Trash2, ImageIcon, X, Warehouse,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

const TX_TYPES = [
  { id: 'stock_in',   label: 'รับเข้าสต๊อก', icon: PackageCheck, color: 'text-green-700 bg-green-50 border-green-200' },
  { id: 'stock_out',  label: 'เบิกออก',        icon: PackageMinus, color: 'text-red-700 bg-red-50 border-red-200' },
  { id: 'adjustment', label: 'ปรับสต๊อก',      icon: Sliders,      color: 'text-blue-700 bg-blue-50 border-blue-200' },
];

const upsertStockItem = async (productId, variantId, locationId, delta, profileId) => {
  let q = supabase.from('stock_items').select('id, quantity').eq('product_id', productId);
  if (variantId) q = q.eq('variant_id', variantId); else q = q.is('variant_id', null);
  if (locationId) q = q.eq('location_id', locationId); else q = q.is('location_id', null);
  const { data: existing } = await q.maybeSingle();
  if (existing) {
    await supabase.from('stock_items').update({
      quantity: Math.max(0, existing.quantity + delta),
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await supabase.from('stock_items').insert([{
      product_id: productId, variant_id: variantId || null,
      location_id: locationId || null, quantity: Math.max(0, delta), created_by: profileId,
    }]);
  }
};

const StockTransactionForm = ({ initialData, onCancel, onSuccess }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  const [txType, setTxType] = useState(initialData?.type || 'stock_in');
  const [selectedProduct, setSelectedProduct] = useState(initialData?.product || null);
  const [selectedVariant, setSelectedVariant] = useState(initialData?.variant || null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  // Product search
  const [productSearch, setProductSearch] = useState(initialData?.product?.name || '');
  const [productResults, setProductResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [variants, setVariants] = useState([]);

  // Existing stock locations for the product
  const [productStockItems, setProductStockItems] = useState([]);
  const [stockItemsLoading, setStockItemsLoading] = useState(false);
  const [itemsToRemove, setItemsToRemove] = useState(new Set());

  // stock_in: 'new' = add to new location, else = existing stock_item id
  const [selectedInItemId, setSelectedInItemId] = useState('new');
  // stock_out: existing stock_item id to pull from
  const [selectedOutItemId, setSelectedOutItemId] = useState('');

  // New location cascades (stock_in new + adjustment)
  const [stores, setStores] = useState([]);
  const [locations, setLocations] = useState([]);
  const [newStoreId, setNewStoreId] = useState(initialData?.prefilledStore?.id || '');
  const [newLocationId, setNewLocationId] = useState(initialData?.prefilledLocation?.id || '');

  // Images (stock_in only)
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    supabase.from('stores').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setStores(data || []));
  }, []);

  useEffect(() => {
    if (!newStoreId) { setLocations([]); setNewLocationId(''); return; }
    supabase.from('storage_locations').select('id, code, name')
      .eq('store_id', newStoreId).eq('is_active', true).order('sort_order').order('code')
      .then(({ data }) => setLocations(data || []));
  }, [newStoreId]);

  useEffect(() => {
    if (!selectedProduct?.id) { setVariants([]); setSelectedVariant(null); return; }
    if (selectedProduct.has_variants) {
      supabase.from('product_variants').select('*').eq('product_id', selectedProduct.id)
        .then(({ data }) => setVariants(data || []));
    } else setVariants([]);
  }, [selectedProduct?.id]);

  const loadProductStockItems = useCallback(async () => {
    if (!selectedProduct?.id) { setProductStockItems([]); return; }
    setStockItemsLoading(true);
    let q = supabase.from('stock_items')
      .select('id, quantity, location_id, location:location_id(id, code, name, store:store_id(id, name))')
      .eq('product_id', selectedProduct.id);
    if (selectedVariant?.id) q = q.eq('variant_id', selectedVariant.id);
    else q = q.is('variant_id', null);
    const { data } = await q;
    const items = data || [];
    setProductStockItems(items);
    setItemsToRemove(new Set());
    // auto-select first existing for stock_in, first with qty for stock_out
    setSelectedInItemId(items.length > 0 ? items[0].id : 'new');
    setSelectedOutItemId(items.find(i => i.quantity > 0)?.id || '');
    setStockItemsLoading(false);
  }, [selectedProduct?.id, selectedVariant?.id]);

  useEffect(() => { loadProductStockItems(); }, [loadProductStockItems]);

  const searchProducts = async (term) => {
    if (!term.trim()) { setProductResults([]); return; }
    const { data } = await supabase.from('products')
      .select('id, name, sku, has_variants').or(`name.ilike.%${term}%,sku.ilike.%${term}%`).limit(10);
    setProductResults(data || []);
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setSelectedVariant(null);
    setShowProductDropdown(false);
  };

  const toggleRemove = (itemId) => {
    setItemsToRemove(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      // if removing the selected in-item, switch to new
      if (next.has(selectedInItemId)) setSelectedInItemId('new');
      return next;
    });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const combined = [...imageFiles, ...files].slice(0, 5);
    setImageFiles(combined);
    setImagePreviews(combined.map(f => URL.createObjectURL(f)));
  };

  const removeImageAt = (idx) => {
    const newFiles = imageFiles.filter((_, i) => i !== idx);
    setImageFiles(newFiles);
    setImagePreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  const uploadImages = async () => {
    const urls = [];
    for (const file of imageFiles) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `tx/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from('stock').upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('stock').getPublicUrl(path);
        urls.push({ url: publicUrl });
      }
    }
    return urls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return alert('กรุณาเลือกสินค้า');
    if (selectedProduct.has_variants && !selectedVariant) return alert('กรุณาเลือก variant');
    if (!quantity || quantity < 1) return alert('กรุณาระบุจำนวน');
    if (!note.trim()) return alert('กรุณาใส่หมายเหตุ (บังคับ)');

    setLoading(true);
    try {
      const variantId = selectedVariant?.id || null;
      let locId = null;
      let stId = null;

      if (txType === 'stock_in') {
        if (selectedInItemId === 'new') {
          locId = newLocationId || null;
          stId = newStoreId || null;
        } else {
          const item = productStockItems.find(i => i.id === selectedInItemId);
          locId = item?.location_id || null;
          stId = item?.location?.store?.id || null;
        }
        // Delete marked items
        for (const itemId of itemsToRemove) {
          const item = productStockItems.find(i => i.id === itemId);
          if (!item) continue;
          // Log cancellation as adjustment
          await supabase.from('stock_transactions').insert([{
            product_id: selectedProduct.id, variant_id: variantId,
            transaction_type: 'adjustment', quantity: item.quantity || 1,
            store_id: item.location?.store?.id || null, location_id: item.location_id,
            note: `ยกเลิกการจัดเก็บที่ ${item.location?.code || 'ไม่ระบุ'}`,
            reference_type: 'manual', created_by: profile?.id,
          }]);
          await supabase.from('stock_items').delete().eq('id', itemId);
        }

      } else if (txType === 'stock_out') {
        if (!selectedOutItemId) { setLoading(false); return alert('กรุณาเลือกที่เก็บที่จะเบิกออก'); }
        const item = productStockItems.find(i => i.id === selectedOutItemId);
        if (!item) { setLoading(false); return; }
        if (quantity > item.quantity) { setLoading(false); return alert(`สต๊อกไม่พอ — มีแค่ ${item.quantity} ชิ้น`); }
        locId = item.location_id || null;
        stId = item.location?.store?.id || null;

      } else {
        locId = newLocationId || null;
        stId = newStoreId || null;
      }

      const imageData = txType === 'stock_in' ? await uploadImages() : [];
      const delta = txType === 'stock_out' ? -quantity : +quantity;

      await supabase.from('stock_transactions').insert([{
        product_id: selectedProduct.id, variant_id: variantId,
        transaction_type: txType, quantity,
        store_id: stId, location_id: locId,
        note: note.trim(),
        images: imageData.length > 0 ? imageData : null,
        reference_type: 'manual', created_by: profile?.id,
      }]);

      await upsertStockItem(selectedProduct.id, variantId, locId, delta, profile?.id);
      onSuccess();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl transition-all outline-none text-gray-700 font-medium";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1";
  const selectedOutItem = productStockItems.find(i => i.id === selectedOutItemId);

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto pb-20 animate-in slide-in-from-bottom-4 fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">บันทึกการเคลื่อนไหวสต๊อก</h1>
        </div>
        <button type="submit" disabled={loading}
          className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm disabled:opacity-60">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} บันทึก
        </button>
      </div>

      <div className="space-y-5">
        {/* Transaction type */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <p className={labelClass}>ประเภทรายการ</p>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {TX_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} type="button" onClick={() => setTxType(t.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 font-semibold text-sm transition-all ${txType === t.id ? t.color + ' border-current' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                  <Icon size={20} />{t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product + Variant */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className={labelClass}>สินค้า <span className="text-red-400">*</span></label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl outline-none text-gray-700 font-medium transition-all"
                placeholder="ค้นหาชื่อสินค้าหรือ SKU..."
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); searchProducts(e.target.value); }}
                onFocus={() => setShowProductDropdown(true)}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 150)}
              />
              {showProductDropdown && productResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-30 overflow-hidden">
                  {productResults.map(p => (
                    <button key={p.id} type="button" onMouseDown={() => selectProduct(p)}
                      className="w-full text-left px-4 py-3 hover:bg-teal-50 text-sm border-b border-gray-50 last:border-0 transition-colors">
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      <span className="ml-2 text-xs text-gray-400 font-mono">{p.sku}</span>
                      {p.has_variants && <span className="ml-2 text-xs text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">มี variant</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedProduct && (
              <div className="mt-2 p-3 bg-teal-50 rounded-xl border border-teal-100 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-teal-800">{selectedProduct.name}</span>
                  <span className="ml-2 text-xs text-teal-600 font-mono">{selectedProduct.sku}</span>
                </div>
                <button type="button"
                  onClick={() => { setSelectedProduct(null); setProductSearch(''); setSelectedVariant(null); setProductStockItems([]); }}
                  className="text-xs text-teal-600 hover:text-red-500 transition-colors">เปลี่ยน</button>
              </div>
            )}
          </div>

          {selectedProduct?.has_variants && (
            <div>
              <label className={labelClass}>ตัวเลือกสินค้า (Variant) <span className="text-red-400">*</span></label>
              <div className="relative">
                <select className={inputClass + ' appearance-none pr-10'} value={selectedVariant?.id || ''}
                  onChange={e => setSelectedVariant(variants.find(v => v.id === e.target.value) || null)}>
                  <option value="">-- เลือก Variant --</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* ── LOCATION: Stock In ── */}
        {selectedProduct && txType === 'stock_in' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={15} className="text-teal-600" />
              <p className="font-bold text-gray-700 text-sm">รับเข้าที่ไหน</p>
            </div>

            {stockItemsLoading ? (
              <div className="text-center text-gray-400 text-sm py-6"><Loader2 size={16} className="animate-spin inline mr-2" />กำลังโหลด...</div>
            ) : (
              <>
                {productStockItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium ml-1">ที่เก็บปัจจุบันของสินค้านี้</p>
                    {productStockItems.map(item => {
                      const isRemoving = itemsToRemove.has(item.id);
                      const isSelected = selectedInItemId === item.id && !isRemoving;
                      return (
                        <div key={item.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                            isRemoving ? 'border-red-200 bg-red-50/60 opacity-60' :
                            isSelected ? 'border-teal-400 bg-teal-50' :
                            'border-gray-100 hover:border-teal-200 cursor-pointer'
                          }`}
                          onClick={() => !isRemoving && setSelectedInItemId(item.id)}
                        >
                          {/* Radio */}
                          {!isRemoving && (
                            <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-300'}`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          )}
                          {isRemoving && (
                            <div className="w-5 h-5 rounded-full border-2 border-red-300 bg-red-100 shrink-0 flex items-center justify-center">
                              <X size={10} className="text-red-500" />
                            </div>
                          )}
                          {/* Location info */}
                          <div className="flex-1 min-w-0">
                            {item.location ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-xs">{item.location.code}</span>
                                {item.location.name && <span className="text-sm text-gray-700">{item.location.name}</span>}
                                {item.location.store?.name && (
                                  <span className="text-xs text-gray-400 flex items-center gap-0.5"><Warehouse size={10} />{item.location.store.name}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">ไม่ระบุที่เก็บ</span>
                            )}
                          </div>
                          {/* Qty badge */}
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${item.quantity === 0 ? 'bg-gray-100 text-gray-400' : 'bg-teal-50 text-teal-700'}`}>
                            {item.quantity} ชิ้น
                          </span>
                          {/* Delete toggle */}
                          <button type="button" onClick={e => { e.stopPropagation(); toggleRemove(item.id); }}
                            className={`p-1.5 rounded-lg transition-colors shrink-0 ${isRemoving ? 'bg-red-100 text-red-500' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                            title={isRemoving ? 'ยกเลิก' : 'ลบที่เก็บนี้ออก'}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {itemsToRemove.size > 0 && (
                      <p className="text-xs text-red-500 ml-1">* ที่เก็บที่เลือกลบจะถูกยกเลิกพร้อมบันทึกรายการนี้</p>
                    )}
                  </div>
                )}

                {/* New location option */}
                <div
                  onClick={() => setSelectedInItemId('new')}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedInItemId === 'new' ? 'border-teal-400 bg-teal-50' : 'border-dashed border-gray-200 hover:border-teal-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${selectedInItemId === 'new' ? 'border-teal-500 bg-teal-500' : 'border-gray-300'}`}>
                    {selectedInItemId === 'new' ? <div className="w-2 h-2 rounded-full bg-white" /> : <Plus size={11} className="text-gray-400" />}
                  </div>
                  <span className="text-sm font-semibold text-teal-700">เพิ่มที่เก็บใหม่</span>
                </div>

                {/* New location cascade */}
                {selectedInItemId === 'new' && (
                  <div className="pl-8 space-y-3 pt-1">
                    <div>
                      <label className={labelClass}>คลังสินค้า</label>
                      <div className="relative">
                        <select className={inputClass + ' appearance-none pr-10'} value={newStoreId}
                          onChange={e => { setNewStoreId(e.target.value); setNewLocationId(''); }}>
                          <option value="">-- ไม่ระบุคลัง --</option>
                          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    {newStoreId && (
                      <div>
                        <label className={labelClass}>ชั้นวาง / พื้นที่</label>
                        {locations.length === 0 ? (
                          <p className="text-xs text-gray-400 ml-1 mt-1">คลังนี้ยังไม่มีชั้นวาง — ไปที่ "จัดการคลัง" เพื่อเพิ่ม</p>
                        ) : (
                          <div className="relative">
                            <select className={inputClass + ' appearance-none pr-10'} value={newLocationId}
                              onChange={e => setNewLocationId(e.target.value)}>
                              <option value="">-- ไม่ระบุชั้นวาง --</option>
                              {locations.map(l => <option key={l.id} value={l.id}>{l.code}{l.name ? ` — ${l.name}` : ''}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── LOCATION: Stock Out ── */}
        {selectedProduct && txType === 'stock_out' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={15} className="text-red-500" />
              <p className="font-bold text-gray-700 text-sm">เบิกออกจาก <span className="text-red-400">*</span></p>
            </div>
            {stockItemsLoading ? (
              <div className="text-center text-gray-400 text-sm py-6"><Loader2 size={16} className="animate-spin inline mr-2" />กำลังโหลด...</div>
            ) : productStockItems.filter(i => i.quantity > 0).length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">ไม่มีสต๊อกในที่เก็บใด</p>
            ) : (
              <div className="space-y-2">
                {productStockItems.filter(i => i.quantity > 0).map(item => {
                  const isSelected = selectedOutItemId === item.id;
                  return (
                    <div key={item.id}
                      onClick={() => { setSelectedOutItemId(item.id); setQuantity(q => Math.min(q, item.quantity)); }}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-red-400 bg-red-50' : 'border-gray-100 hover:border-red-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${isSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.location ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-xs">{item.location.code}</span>
                            {item.location.name && <span className="text-sm text-gray-700">{item.location.name}</span>}
                            {item.location.store?.name && (
                              <span className="text-xs text-gray-400 flex items-center gap-0.5"><Warehouse size={10} />{item.location.store.name}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">ไม่ระบุที่เก็บ</span>
                        )}
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 shrink-0">มี {item.quantity} ชิ้น</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LOCATION: Adjustment ── */}
        {txType === 'adjustment' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-blue-600" />
              <p className="font-bold text-gray-700 text-sm">ตำแหน่งที่จัดเก็บ</p>
            </div>
            <div>
              <label className={labelClass}>คลังสินค้า</label>
              <div className="relative">
                <select className={inputClass + ' appearance-none pr-10'} value={newStoreId}
                  onChange={e => { setNewStoreId(e.target.value); setNewLocationId(''); }}>
                  <option value="">-- ไม่ระบุคลัง --</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            {newStoreId && locations.length > 0 && (
              <div>
                <label className={labelClass}>ชั้นวาง / พื้นที่</label>
                <div className="relative">
                  <select className={inputClass + ' appearance-none pr-10'} value={newLocationId}
                    onChange={e => setNewLocationId(e.target.value)}>
                    <option value="">-- ไม่ระบุชั้นวาง --</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.code}{l.name ? ` — ${l.name}` : ''}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quantity */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <label className={labelClass}>จำนวน <span className="text-red-400">*</span></label>
          <input type="number" min="1"
            max={txType === 'stock_out' && selectedOutItem ? selectedOutItem.quantity : undefined}
            required className={inputClass} value={quantity}
            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
          {txType === 'stock_out' && selectedOutItem && (
            <p className="text-xs text-gray-400 mt-1.5 ml-1">สต๊อกที่มีในที่เก็บนี้: <span className="font-bold text-gray-600">{selectedOutItem.quantity} ชิ้น</span></p>
          )}
        </div>

        {/* Note — required */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <label className={labelClass}>
            หมายเหตุ <span className="text-red-400">* (บังคับ)</span>
          </label>
          <textarea className={inputClass} rows={3}
            placeholder={
              txType === 'stock_out' ? 'เบิกไปทำอะไร / ใช้กับงานหรือออเดอร์ไหน...' :
              txType === 'stock_in'  ? 'ซื้อจากที่ไหน / ล็อตไหน / หมายเลขใบสั่งซื้อ...' :
              'เหตุผลในการปรับสต๊อก...'
            }
            value={note} onChange={e => setNote(e.target.value)} required />
        </div>

        {/* Images — stock_in only */}
        {txType === 'stock_in' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <label className={labelClass}>รูปภาพ (ไม่บังคับ)</label>
            <div className="flex flex-wrap gap-3 mt-2">
              {imagePreviews.map((src, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImageAt(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {imagePreviews.length < 5 && (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-colors gap-1 shrink-0">
                  <ImageIcon size={20} />
                  <span className="text-[10px]">เพิ่มรูป</span>
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            <p className="text-xs text-gray-400 mt-2">สูงสุด 5 รูป · ระบบบันทึกวัน เวลา และผู้บันทึกอัตโนมัติ</p>
          </div>
        )}
      </div>
    </form>
  );
};

export default StockTransactionForm;
