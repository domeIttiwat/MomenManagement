'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, PackageCheck, PackageMinus, Sliders, Search, ChevronDown, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

const TX_TYPES = [
  { id: 'stock_in',   label: 'รับเข้าสต๊อก', icon: PackageCheck, color: 'text-green-700 bg-green-50 border-green-200' },
  { id: 'stock_out',  label: 'เบิกออก',        icon: PackageMinus, color: 'text-red-700 bg-red-50 border-red-200' },
  { id: 'adjustment', label: 'ปรับสต๊อก',      icon: Sliders,      color: 'text-blue-700 bg-blue-50 border-blue-200' },
];

const upsertStockItem = async (productId, variantId, locationId, delta, profileId) => {
  let query = supabase.from('stock_items').select('id, quantity').eq('product_id', productId);
  if (variantId) query = query.eq('variant_id', variantId);
  else query = query.is('variant_id', null);
  if (locationId) query = query.eq('location_id', locationId);
  else query = query.is('location_id', null);

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    await supabase.from('stock_items').update({
      quantity: Math.max(0, existing.quantity + delta),
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await supabase.from('stock_items').insert([{
      product_id: productId,
      variant_id: variantId || null,
      location_id: locationId || null,
      quantity: Math.max(0, delta),
      created_by: profileId,
    }]);
  }
};

const StockTransactionForm = ({ initialData, onCancel, onSuccess }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [txType, setTxType] = useState(initialData?.type || 'stock_in');
  const [selectedProduct, setSelectedProduct] = useState(initialData?.product || null);
  const [selectedVariant, setSelectedVariant] = useState(initialData?.variant || null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [storeId, setStoreId] = useState(initialData?.prefilledStore?.id || '');
  const [locationId, setLocationId] = useState(initialData?.prefilledLocation?.id || '');

  const [productSearch, setProductSearch] = useState(initialData?.product?.name || '');
  const [productResults, setProductResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [variants, setVariants] = useState([]);
  const [stores, setStores] = useState([]);
  const [locations, setLocations] = useState([]);

  // Prefilled store/location labels for display
  const prefilledStoreName = initialData?.prefilledStore?.name;
  const prefilledLocCode = initialData?.prefilledLocation?.code;
  const prefilledLocName = initialData?.prefilledLocation?.name;

  useEffect(() => {
    supabase.from('stores').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setStores(data || []));
  }, []);

  // Fetch locations when store changes
  useEffect(() => {
    if (!storeId) { setLocations([]); setLocationId(''); return; }
    supabase.from('storage_locations')
      .select('id, code, name')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('sort_order')
      .order('code')
      .then(({ data }) => setLocations(data || []));
  }, [storeId]);

  useEffect(() => {
    if (!selectedProduct?.id) { setVariants([]); setSelectedVariant(null); return; }
    if (selectedProduct.has_variants) {
      supabase.from('product_variants').select('*').eq('product_id', selectedProduct.id)
        .then(({ data }) => setVariants(data || []));
    } else {
      setVariants([]);
    }
  }, [selectedProduct?.id]);

  const searchProducts = async (term) => {
    if (!term.trim()) { setProductResults([]); return; }
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, has_variants')
      .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
      .limit(10);
    setProductResults(data || []);
  };

  const handleProductInputChange = (e) => {
    const val = e.target.value;
    setProductSearch(val);
    setShowProductDropdown(true);
    searchProducts(val);
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setSelectedVariant(null);
    setShowProductDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return alert('กรุณาเลือกสินค้า');
    if (!quantity || quantity < 1) return alert('กรุณาระบุจำนวน');
    if (selectedProduct.has_variants && !selectedVariant) return alert('กรุณาเลือก variant');

    setLoading(true);
    try {
      const variantId = selectedVariant?.id || null;
      const locId = locationId || null;
      const delta = txType === 'stock_out' ? -quantity : +quantity;

      await supabase.from('stock_transactions').insert([{
        product_id: selectedProduct.id,
        variant_id: variantId,
        transaction_type: txType,
        quantity: quantity,
        store_id: storeId || null,
        location_id: locId,
        note: note || null,
        reference_type: 'manual',
        created_by: profile?.id,
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

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto pb-20 animate-in slide-in-from-bottom-4 fade-in duration-500">
      {/* Sticky header */}
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">บันทึกการเคลื่อนไหวสต๊อก</h1>
        </div>
        <button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm disabled:opacity-60">
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
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTxType(t.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 font-semibold text-sm transition-all ${txType === t.id ? t.color + ' border-current' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                >
                  <Icon size={20} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product + Variant + Quantity */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className={labelClass}>สินค้า <span className="text-red-400">*</span></label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl outline-none text-gray-700 font-medium transition-all"
                placeholder="ค้นหาชื่อสินค้าหรือ SKU..."
                value={productSearch}
                onChange={handleProductInputChange}
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
                <button type="button" onClick={() => { setSelectedProduct(null); setProductSearch(''); setSelectedVariant(null); }}
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

          <div>
            <label className={labelClass}>จำนวน <span className="text-red-400">*</span></label>
            <input type="number" min="1" required className={inputClass} value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        </div>

        {/* Location (Store → Shelf cascade) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={15} className="text-teal-600" />
            <p className="font-bold text-gray-700 text-sm">ตำแหน่งที่จัดเก็บ</p>
            {(prefilledStoreName || prefilledLocCode) && (
              <span className="text-xs text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                pre-filled
              </span>
            )}
          </div>

          <div>
            <label className={labelClass}>คลังสินค้า</label>
            <div className="relative">
              <select
                className={inputClass + ' appearance-none pr-10'}
                value={storeId}
                onChange={e => { setStoreId(e.target.value); setLocationId(''); }}
              >
                <option value="">-- ไม่ระบุคลัง --</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {storeId && (
            <div>
              <label className={labelClass}>ชั้นวาง / พื้นที่จัดเก็บ</label>
              {locations.length === 0 ? (
                <p className="text-xs text-gray-400 ml-1 mt-1">คลังนี้ยังไม่มีชั้นวาง — ไปที่ "จัดการคลัง" เพื่อเพิ่ม</p>
              ) : (
                <div className="relative">
                  <select
                    className={inputClass + ' appearance-none pr-10'}
                    value={locationId}
                    onChange={e => setLocationId(e.target.value)}
                  >
                    <option value="">-- ไม่ระบุชั้นวาง --</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.code}{l.name ? ` — ${l.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>หมายเหตุ</label>
            <textarea className={inputClass} rows={3} placeholder="บันทึกเพิ่มเติม..." value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
      </div>
    </form>
  );
};

export default StockTransactionForm;
