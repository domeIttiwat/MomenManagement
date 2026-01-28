import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Package, Plus, X, Trash2, ArrowRight, AlertCircle, Box } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProductForm from './ProductForm';

const ProductBundleSelector = ({ bundles = [], onChange }) => {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [sparePartCategoryId, setSparePartCategoryId] = useState(null);
  
  // State สำหรับการสร้างสินค้าใหม่
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 1. หา ID ของหมวด Spare Parts (รองรับทั้งชื่อไทยและอังกฤษ)
    const fetchCatId = async () => {
      try {
        const { data } = await supabase.from('categories')
          .select('id')
          .or('name.ilike.Spare Parts,name.ilike.Parts,name.ilike.อะไหล่,name.ilike.ชิ้นส่วน') // ค้นหาหลายชื่อที่เป็นไปได้
          .limit(1);
          
        if (data && data.length > 0) {
          setSparePartCategoryId(data[0].id);
        } else {
            console.warn("ไม่พบหมวดหมู่ 'Spare Parts' หรือ 'อะไหล่' ในระบบ");
        }
      } catch (err) {
        console.error("Error fetching category:", err);
      }
    };
    fetchCatId();
  }, []);

  // Logic การค้นหาและแสดงรายการ
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchProducts = async () => {
      // ถ้ายังหาหมวดอะไหล่ไม่เจอ จะไม่ดึงข้อมูลสินค้าอื่นมาแสดง (ป้องกันการเลือกผิด)
      if (!sparePartCategoryId) {
         setSearchResults([]);
         return;
      }

      let query = supabase.from('products')
        // เพิ่ม cost_price เข้าไปในการดึงข้อมูล
        .select('id, name, sku, cost_price, sell_price, images')
        .limit(10); // แสดง 10 รายการ
      
      // บังคับกรองเฉพาะหมวด Spare Parts เท่านั้น
      query = query.eq('category_id', sparePartCategoryId);

      if (search.trim()) {
        // ถ้ามีการพิมพ์ค้นหา ให้หาตามชื่อ
        query = query.ilike('name', `%${search}%`);
      } else {
        // ถ้าไม่ได้พิมพ์ (แค่คลิก) ให้เรียงจากรายการล่าสุด
        query = query.order('created_at', { ascending: false });
      }

      const { data } = await query;
      if (data) setSearchResults(data);
    };

    // ใช้ Debounce เล็กน้อยเพื่อประสิทธิภาพ
    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [search, isOpen, sparePartCategoryId]);

  const addProductToBundle = (product) => {
    if (bundles.some(b => b.child_product_id === product.id)) return;
    
    onChange([...bundles, {
      child_product_id: product.id,
      product: product, 
      quantity: 1
    }]);
    setIsOpen(false);
    setSearch('');
  };

  const removeBundle = (idx) => {
    onChange(bundles.filter((_, i) => i !== idx));
  };

  const updateQty = (idx, qty) => {
    const newBundles = [...bundles];
    newBundles[idx].quantity = parseInt(qty) || 1;
    onChange(newBundles);
  };

  // --- FIX: เพิ่มสินค้าที่เพิ่งสร้างเข้าในรายการทันที ---
  const handleCreateSuccess = async () => {
    setShowCreateForm(false); // ปิด Modal
    
    try {
      // ดึงสินค้าล่าสุดที่เพิ่งสร้างในหมวด Spare Parts
      if (sparePartCategoryId) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, sku, cost_price, sell_price, images')
          .eq('category_id', sparePartCategoryId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (data) {
           // เพิ่มเข้า Bundle List ทันที
           addProductToBundle(data);
           alert(`เพิ่มอะไหล่ใหม่ "${data.name}" ลงในรายการเรียบร้อย`);
        }
      }
    } catch (err) {
      console.error("Error auto-adding new spare part:", err);
    }
  };

  // คำนวณต้นทุนรวมของ Bundle ทั้งหมด
  const totalBundleCost = bundles.reduce((sum, b) => sum + ((b.product?.cost_price || 0) * (b.quantity || 1)), 0);

  // Modal สำหรับสร้างสินค้าใหม่
  const createModal = showCreateForm && mounted ? createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-2">
            <ProductForm 
                onCancel={() => setShowCreateForm(false)} 
                onSuccess={handleCreateSuccess}
                // ส่งค่าเริ่มต้นให้ครบทุก field เพื่อป้องกัน error uncontrolled input และสร้าง SKU ให้เลย
                initialData={sparePartCategoryId ? { 
                  category_id: sparePartCategoryId,
                  name: '',
                  sku: `SP-${Math.floor(100000 + Math.random() * 900000)}`, // Auto-generate SKU for Spare Part
                  description: '',
                  images: [],
                  cost_price: 0,
                  sell_price: 0,
                  stock_quantity: 0,
                  has_variants: false
                } : null}
            />
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-4">
      {/* Alert Info */}
      <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-2 text-xs text-blue-700">
         <AlertCircle size={16} />
         <span>เลือกสินค้าจากหมวด <b>Spare Parts (อะไหล่)</b> เท่านั้น</span>
      </div>

      {/* List of Bundled Items */}
      <div className="space-y-2">
        {bundles.map((b, i) => (
          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-left-2 group">
             <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                {b.product?.images?.[0] ? <img src={b.product.images[0]} className="w-full h-full object-cover"/> : <Package size={20} className="m-2.5 text-gray-400"/>}
             </div>
             
             <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{b.product?.name}</p>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                   <span className="truncate">{b.product?.sku}</span>
                   <span className="w-px h-3 bg-gray-200 hidden sm:block"></span>
                   <span className="text-amber-600 hidden sm:inline-block">ทุน {b.product?.cost_price?.toLocaleString()}</span>
                   <span className="text-indigo-600 hidden sm:inline-block">ขาย {b.product?.sell_price?.toLocaleString()}</span>
                </div>
             </div>

             <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                <span className="text-[10px] text-gray-500">Qty</span>
                <input 
                  type="number" min="1" 
                  className="w-8 text-center bg-transparent text-sm font-bold outline-none"
                  value={b.quantity}
                  onChange={e => updateQty(i, e.target.value)}
                />
             </div>

             {/* แสดงยอดรวมทุนของรายการนี้ */}
             <div className="text-right min-w-[60px] hidden sm:block">
                 <p className="text-[9px] text-gray-400">รวมทุน</p>
                 <p className="text-sm font-bold text-amber-700">฿{((b.product?.cost_price || 0) * b.quantity).toLocaleString()}</p>
             </div>

             <button onClick={() => removeBundle(i)} className="text-gray-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={16}/></button>
          </div>
        ))}
        
        {bundles.length === 0 && <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">ยังไม่มีส่วนประกอบ</div>}

        {/* สรุปต้นทุนรวม */}
        {bundles.length > 0 && (
           <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100 mt-2">
              <span className="text-xs font-bold text-amber-800">ต้นทุนรวมส่วนประกอบทั้งหมด</span>
              <span className="text-lg font-black text-amber-600">฿{totalBundleCost.toLocaleString()}</span>
           </div>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <input 
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all outline-none text-sm"
          placeholder={sparePartCategoryId ? "คลิกเพื่อเลือกอะไหล่ (Spare Parts)..." : "ไม่พบหมวดหมู่อะไหล่ กรุณาสร้างหมวด 'Spare Parts' ก่อน"}
          value={search}
          onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          disabled={!sparePartCategoryId}
        />
        <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16}/>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}/>
            <div className="absolute top-12 left-0 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-20 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
               
               {/* ปุ่มสร้างอะไหล่ใหม่ */}
               <div 
                 onClick={() => { setIsOpen(false); setShowCreateForm(true); }}
                 className="p-3 bg-indigo-50 text-indigo-700 font-bold text-sm cursor-pointer hover:bg-indigo-100 flex items-center justify-center gap-2 border-b border-indigo-100 sticky top-0 z-30"
               >
                 <Box size={16}/> สร้างอะไหล่ใหม่ (Spare Part)
               </div>

               {searchResults.length > 0 ? searchResults.map(p => (
                 <div key={p.id} onClick={() => addProductToBundle(p)} className="flex items-center gap-3 p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-none transition-colors">
                    <div className="w-8 h-8 bg-gray-100 rounded shrink-0 overflow-hidden">
                       {p.images?.[0] && <img src={p.images[0]} className="w-full h-full object-cover"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                       <p className="text-xs text-gray-500 font-mono">{p.sku}</p>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap">
                       <p className="text-amber-600 font-medium">ทุน {p.cost_price?.toLocaleString()}</p>
                    </div>
                    <ArrowRight size={16} className="ml-2 text-gray-300"/>
                 </div>
               )) : (
                 <div className="p-4 text-center text-gray-400 text-sm">ไม่พบอะไหล่</div>
               )}
            </div>
          </>
        )}
      </div>

      {createModal}
    </div>
  );
};
export default ProductBundleSelector;