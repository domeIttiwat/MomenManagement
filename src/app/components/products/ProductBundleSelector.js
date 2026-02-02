import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Package, Plus, X, Trash2, ArrowRight, AlertCircle, Box, Layers, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProductForm from './ProductForm';

const ProductBundleSelector = ({ bundles = [], onChange, variants = [] }) => {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isAdding, setIsAdding] = useState(false); // ควบคุมการเปิด Modal ค้นหา
  const [targetVariants, setTargetVariants] = useState([]); // เก็บ ID ของรุ่นที่จะเพิ่มอะไหล่ลงไป
  
  const [sparePartCategoryId, setSparePartCategoryId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchCatId = async () => {
      try {
        const { data } = await supabase.from('categories')
          .select('id')
          .or('name.ilike.Spare Parts,name.ilike.Parts,name.ilike.อะไหล่,name.ilike.ชิ้นส่วน')
          .limit(1);
        if (data && data.length > 0) setSparePartCategoryId(data[0].id);
      } catch (err) { console.error(err); }
    };
    fetchCatId();
  }, []);

  // Search Logic
  useEffect(() => {
    if (!isAdding) return;
    
    const fetchProducts = async () => {
      let query = supabase.from('products')
        .select('id, name, sku, cost_price, sell_price, images')
        .limit(20);

      if (search.trim()) {
        query = query.ilike('name', `%${search}%`);
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data } = await query;
      if (data) setSearchResults(data);
    };

    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [search, isAdding]);

  // เริ่มต้นการเพิ่มอะไหล่
  const startAdd = (variantId = null) => {
    setTargetVariants([variantId]); 
    setIsAdding(true);
    setSearch('');
  };

  const toggleTargetVariant = (vId) => {
    setTargetVariants(prev => 
      prev.includes(vId) ? prev.filter(id => id !== vId) : [...prev, vId]
    );
  };

  const addProductToBundle = (product) => {
    const newBundles = [...bundles];
    let addedCount = 0;

    targetVariants.forEach(vId => {
        // ลบการเช็คซ้ำ (exists) ออก เพื่อให้เพิ่มรายการเดิมซ้ำได้ตามต้องการ
        newBundles.push({
            child_product_id: product.id,
            product: product, 
            quantity: 1,
            parent_variant_id: vId 
        });
        addedCount++;
    });

    if (addedCount > 0) {
        onChange(newBundles);
        // FIX: ปิดหน้าต่างทันทีหลังจากเพิ่มสำเร็จ
        setIsAdding(false);
    } else {
        alert('กรุณาเลือกสเปคที่ต้องการเพิ่มลงไปก่อน');
    }
  };

  const removeBundle = (idx) => {
    onChange(bundles.filter((_, i) => i !== idx));
  };

  const updateQty = (idx, qty) => {
    const newBundles = [...bundles];
    newBundles[idx].quantity = parseInt(qty) || 1;
    onChange(newBundles);
  };

  const handleCreateSuccess = (newProduct) => {
    setShowCreateForm(false);
    
    if (newProduct && newProduct.id) {
        addProductToBundle(newProduct);
        // ปิดหน้าต่างค้นหาด้วยเพื่อให้เห็นผลลัพธ์ที่หน้าหลัก
        setIsAdding(false);
    } else {
        setSearch(''); 
        alert('สร้างอะไหล่เรียบร้อย (กรุณาค้นหาเพื่อเพิ่มรายการ)');
    }
  };

  // Group bundles for display
  const commonBundles = bundles.filter(b => b.parent_variant_id === null);
  const variantBundles = {};
  variants.forEach(v => {
      variantBundles[v.id] = bundles.filter(b => b.parent_variant_id === v.id);
  });

  const totalBundleCost = bundles.reduce((sum, b) => sum + ((b.product?.cost_price || 0) * (b.quantity || 1)), 0);

  const renderItem = (b, originalIndex) => (
    <div key={originalIndex} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm mb-2 group">
        <div className="w-8 h-8 bg-gray-100 rounded-md overflow-hidden shrink-0 border border-gray-100">
        {b.product?.images?.[0] ? <img src={b.product.images[0]} className="w-full h-full object-cover"/> : <Package size={16} className="m-2 text-gray-400"/>}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{b.product?.name}</p>
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="truncate">{b.product?.sku}</span>
                <span className="text-amber-600">ทุน {b.product?.cost_price?.toLocaleString()}</span>
            </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-50 rounded px-1.5 py-0.5 border border-gray-200">
            <span className="text-[10px] text-gray-500">Qty</span>
            <input 
                type="number" min="1" 
                className="w-6 text-center bg-transparent text-sm font-bold outline-none"
                value={b.quantity}
                onChange={e => updateQty(originalIndex, e.target.value)}
            />
        </div>
        <button onClick={() => removeBundle(originalIndex)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. Common Parts Section */}
      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
         <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2"><Layers size={16}/> อะไหล่พื้นฐาน (ใช้ทุกรุ่น)</h4>
            <button type="button" onClick={() => startAdd(null)} className="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1 font-bold">
                <Plus size={12}/> เพิ่ม
            </button>
         </div>
         <div className="space-y-1">
             {commonBundles.length > 0 ? commonBundles.map(b => renderItem(b, bundles.indexOf(b))) : <p className="text-center text-xs text-gray-400 py-2">ไม่มีอะไหล่พื้นฐาน</p>}
         </div>
      </div>

      {/* 2. Variants Sections */}
      {variants.length > 0 && (
         <div className="space-y-4">
             {variants.map(v => (
                 <div key={v.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                     <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                            <span className="w-2 h-6 bg-indigo-500 rounded-full"></span> 
                            สเปค: {v.name}
                        </h4>
                        <button type="button" onClick={() => startAdd(v.id)} className="text-[10px] bg-white border border-gray-300 text-gray-600 px-2 py-1 rounded hover:bg-gray-100 flex items-center gap-1 font-bold">
                            <Plus size={12}/> เพิ่มเฉพาะรุ่นนี้
                        </button>
                     </div>
                     <div className="space-y-1">
                         {variantBundles[v.id]?.length > 0 ? variantBundles[v.id].map(b => renderItem(b, bundles.indexOf(b))) : <p className="text-center text-xs text-gray-400 py-2">ใช้อะไหล่พื้นฐานเหมือนกัน</p>}
                     </div>
                 </div>
             ))}
         </div>
      )}

      {/* Cost Summary */}
      <div className="flex justify-between items-center p-4 bg-amber-50 rounded-2xl border border-amber-100 mt-4">
        <span className="text-sm font-bold text-amber-800">ต้นทุนรวมอะไหล่ (โดยประมาณ)</span>
        <span className="text-xl font-black text-amber-600">฿{totalBundleCost.toLocaleString()}</span>
      </div>

      {/* ADD MODAL (Search & Select) */}
      {isAdding && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                   <h3 className="font-bold text-gray-800">เลือกอะไหล่ประกอบ</h3>
                   <button onClick={() => setIsAdding(false)}><X size={20}/></button>
                </div>
                
                {/* Target Selectors */}
                <div className="p-3 bg-indigo-50 border-b border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700 mb-2">เพิ่มลงใน:</p>
                    <div className="flex flex-wrap gap-2">
                        <button 
                            type="button"
                            onClick={() => toggleTargetVariant(null)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-all ${targetVariants.includes(null) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}
                        >
                            {targetVariants.includes(null) ? <CheckSquare size={12}/> : <Square size={12}/>} ทุกรุ่น (Common)
                        </button>
                        {variants.map(v => (
                            <button 
                                key={v.id}
                                type="button"
                                onClick={() => toggleTargetVariant(v.id)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-all ${targetVariants.includes(v.id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300'}`}
                            >
                                {targetVariants.includes(v.id) ? <CheckSquare size={12}/> : <Square size={12}/>} {v.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-3 border-b">
                   <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                      <input 
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="ค้นหา (ทุกหมวดหมู่)..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        autoFocus
                      />
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                   {/* Create New Button */}
                   <div onClick={() => { setIsAdding(false); setShowCreateForm(true); }} className="p-3 bg-white border border-dashed border-indigo-200 text-indigo-600 font-bold text-sm cursor-pointer hover:bg-indigo-50 flex items-center justify-center gap-2 rounded-xl mb-2">
                      <Box size={16}/> สร้างสินค้าใหม่
                   </div>

                   {searchResults.length > 0 ? searchResults.map(p => (
                      <div key={p.id} onClick={() => addProductToBundle(p)} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-xl border border-transparent hover:border-gray-200 transition-all">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg shrink-0 overflow-hidden border border-gray-200">
                             {p.images?.[0] && <img src={p.images[0]} className="w-full h-full object-cover"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-bold text-gray-800">{p.name}</p>
                             <p className="text-xs text-gray-500">{p.sku}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-bold text-amber-600">ทุน {p.cost_price?.toLocaleString()}</p>
                             <ArrowRight size={14} className="ml-auto text-gray-300 mt-1"/>
                          </div>
                      </div>
                   )) : (
                      <p className="text-center text-gray-400 text-sm py-4">ไม่พบสินค้า</p>
                   )}
                </div>
             </div>
          </div>
      )}

      {/* Create New Product Modal */}
      {showCreateForm && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-2" onSubmit={(e) => e.stopPropagation()}>
                <ProductForm 
                    onCancel={() => setShowCreateForm(false)} 
                    onSuccess={handleCreateSuccess}
                    initialData={sparePartCategoryId ? { category_id: sparePartCategoryId } : null}
                />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
export default ProductBundleSelector;