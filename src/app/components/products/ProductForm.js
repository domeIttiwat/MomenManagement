import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Info, Wrench, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ImageUploader from './ImageUploader';
import CategoryManager from './CategoryManager';
import VariantManager from './VariantManager';
import ProductFastenerSelector from './ProductFastenerSelector';
import ProductBundleSelector from './ProductBundleSelector';
import NumericInput from './NumericInput';

const ProductForm = ({ onCancel, onSuccess, initialData }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); 
  const [currentCategoryNames, setCurrentCategoryNames] = useState([]);

  const normalizeImages = (imgs) => {
    return (imgs || []).map(img => (typeof img === 'string' ? { url: img, file: null } : img));
  };

  const [formData, setFormData] = useState(initialData ? {
    ...initialData,
    images: normalizeImages(initialData.images),
    category_ids: initialData.product_categories?.map(pc => pc.category_id).filter(Boolean) || (initialData.category_id ? [initialData.category_id] : [])
  } : {
    name: '', 
    sku: `PD-${Math.floor(100000 + Math.random() * 900000)}`, 
    category_ids: initialData?.category_id ? [initialData.category_id] : [],
    description: '', 
    images: [], 
    cost_price: 0, 
    sell_price: 0, 
    has_variants: false,
    // stock_quantity: 0 // ตัดออก
  });
  
  const [variants, setVariants] = useState([]);
  const [fasteners, setFasteners] = useState([]);
  const [bundles, setBundles] = useState([]);

  useEffect(() => {
    const fetchFullProductData = async () => {
      if (!initialData?.id) return; 

      try {
        const { data: prod, error } = await supabase
          .from('products')
          .select(`
            *,
            product_categories (category_id)
          `)
          .eq('id', initialData.id)
          .single();

        if (prod) {
          const categoryIds = prod.product_categories?.map(pc => pc.category_id) || [];
          if (categoryIds.length === 0 && prod.category_id) {
             categoryIds.push(prod.category_id);
          }

          setFormData(prev => ({
            ...prev,
            ...prod,
            images: normalizeImages(prod.images),
            category_ids: categoryIds
          }));
        }

        if (initialData.has_variants) {
          const { data } = await supabase.from('product_variants').select('*').eq('product_id', initialData.id);
          if (data) setVariants(data);
        }
        
        const { data: fData } = await supabase.from('product_fasteners').select('*').eq('product_id', initialData.id);
        if (fData) setFasteners(fData);

        const { data: bData } = await supabase.from('product_bundles').select('*, product:child_product_id(*)').eq('parent_product_id', initialData.id);
        if (bData) setBundles(bData);

      } catch (err) {
        console.error("Error fetching product details:", err);
      }
    };

    fetchFullProductData();
  }, [initialData?.id]); 

  useEffect(() => {
    const fetchCatNames = async () => {
      if (formData.category_ids && formData.category_ids.length > 0) {
        const { data } = await supabase.from('categories').select('name').in('id', formData.category_ids);
        if (data) setCurrentCategoryNames(data.map(c => c.name));
      } else {
        setCurrentCategoryNames([]);
      }
    };
    fetchCatNames();
  }, [formData.category_ids]);

  const isSparePart = currentCategoryNames.some(name => 
    name === 'Spare Parts' || name === 'อะไหล่' || name === 'Parts'
  );

  useEffect(() => {
    if (isSparePart && activeTab === 'bundles') {
      setActiveTab('info');
    }
  }, [isSparePart, activeTab]);

  const handleSubmit = async (e) => {
    // FIX: หยุดการส่ง event ไปยังฟอร์มแม่ (ป้องกันหน้าหลักเด้งออก)
    e.stopPropagation();
    e.preventDefault();
    
    if (formData.category_ids.length === 0) return alert('กรุณาเลือกหมวดสินค้าอย่างน้อย 1 หมวด');

    setLoading(true);
    try {
      const uploadedImageUrls = await Promise.all(formData.images.map(async (imgObj) => {
        if (imgObj.file) {
          const fileName = `${Date.now()}-${Math.random()}`;
          await supabase.storage.from('products').upload(fileName, imgObj.file);
          const { data } = supabase.storage.from('products').getPublicUrl(fileName);
          return data.publicUrl;
        }
        return imgObj.url;
      }));

      const productPayload = {
        name: formData.name,
        sku: formData.sku,
        category_id: formData.category_ids.length > 0 ? formData.category_ids[0] : null,
        description: formData.description,
        images: uploadedImageUrls,
        cost_price: formData.has_variants ? 0 : formData.cost_price,
        sell_price: formData.has_variants ? 0 : formData.sell_price,
        // stock_quantity: formData.has_variants ? 0 : formData.stock_quantity, // ตัดออกตาม Error ที่แจ้ง
        has_variants: formData.has_variants,
      };

      let productId = initialData?.id;
      let resultData = null;
      
      if (productId) {
        const { data } = await supabase.from('products').update(productPayload).eq('id', productId).select().single();
        resultData = data;
        await supabase.from('product_categories').delete().eq('product_id', productId);
      } else {
        const { data, error } = await supabase.from('products').insert([productPayload]).select().single();
        if (error) throw error;
        if (!data) throw new Error("บันทึกสำเร็จ แต่ฐานข้อมูลไม่ส่ง ID กลับมา (กรุณาเช็ค RLS Policy)");
        productId = data.id;
        resultData = data;
      }

      if (formData.category_ids.length > 0) {
          const catPayload = formData.category_ids.map(cId => ({
              product_id: productId,
              category_id: cId
          }));
          await supabase.from('product_categories').insert(catPayload);
      }

      if (formData.has_variants) {
        if (initialData?.id) await supabase.from('product_variants').delete().eq('product_id', productId);
        if (variants.length > 0) {
          await supabase.from('product_variants').insert(variants.map(v => ({
            product_id: productId,
            name: v.name, 
            sku: v.sku || `${formData.sku}-${v.name.replace(/\s+/g, '')}`, 
            options: v.options,
            cost_price: Number(v.cost_price), 
            sell_price: Number(v.sell_price),
            // stock_quantity: Number(v.stock_quantity) // ตัดออกเช่นกัน
          })));
        }
      }

      if (!isSparePart) {
        if (initialData?.id) await supabase.from('product_bundles').delete().eq('parent_product_id', productId);
        if (bundles.length > 0) {
            await supabase.from('product_bundles').insert(bundles.map(b => ({
                parent_product_id: productId,
                child_product_id: b.child_product_id,
                quantity: b.quantity
            })));
        }
      }

      if (initialData?.id) await supabase.from('product_fasteners').delete().eq('product_id', productId);
      if (fasteners.length > 0) {
        await supabase.from('product_fasteners').insert(fasteners.map(f => ({
            product_id: productId,
            location_name: f.location_name,
            location_image: f.location_image,
            bolts_usage: f.bolts_usage
        })));
      }

      onSuccess(resultData); // ส่งข้อมูลกลับไป (เผื่อใช้)
    } catch (err) {
      alert('Error: ' + err.message);
    } finally { setLoading(false); }
  };

  const inputClass = "w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all outline-none font-medium text-gray-700 placeholder:text-gray-400";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto pb-20 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-bold text-gray-900">{initialData ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h1>
        </div>
        <button type="submit" disabled={loading} className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-gray-200 flex items-center gap-2 active:scale-95 transition-all">
          {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} บันทึกข้อมูล
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sidebar Tabs */}
        <div className="space-y-6">
           <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
              <div className="space-y-2">
                 <button type="button" onClick={() => setActiveTab('info')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${activeTab === 'info' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Info size={18}/> ข้อมูลทั่วไป
                 </button>
                 
                 {!isSparePart && (
                    <button type="button" onClick={() => setActiveTab('bundles')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${activeTab === 'bundles' ? 'bg-purple-50 text-purple-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Layers size={18}/> ส่วนประกอบ (Bundles)
                    </button>
                 )}

                 <button type="button" onClick={() => setActiveTab('fasteners')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${activeTab === 'fasteners' ? 'bg-orange-50 text-orange-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Wrench size={18}/> จุดยึดและน็อต
                 </button>
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Info size={16} className="text-indigo-500"/> รูปภาพ</h3>
              <ImageUploader images={formData.images} onChange={imgs => setFormData({...formData, images: imgs})} />
           </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
           
           {activeTab === 'info' && (
             <>
               <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6 animate-in fade-in">
                  <h3 className="font-bold text-gray-800 text-lg border-b border-gray-50 pb-4 mb-6">ข้อมูลพื้นฐาน</h3>
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>ชื่อสินค้า</label>
                      <input required placeholder="ระบุชื่อสินค้า..." className={inputClass} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelClass}>รหัส SKU</label><input className={`${inputClass} font-mono bg-gray-100`} value={formData.sku || ''} onChange={e => setFormData({...formData, sku: e.target.value})} /></div>
                      <div>
                        <label className={labelClass}>หมวดหมู่ (เลือกได้มากกว่า 1)</label>
                        <CategoryManager selectedCategoryIds={formData.category_ids} onChange={ids => setFormData({...formData, category_ids: ids})} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>รายละเอียด</label>
                      <textarea placeholder="คำอธิบายสินค้าเพิ่มเติม..." className={inputClass} rows="4" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                  </div>
               </div>

               <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-4 mb-6">
                    <h3 className="font-bold text-gray-800 text-lg">ราคาและสต็อก</h3>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={formData.has_variants} onChange={e => setFormData({...formData, has_variants: e.target.checked})} /> 
                      เปิดใช้งานตัวเลือกสินค้า
                    </label>
                  </div>
                  {formData.has_variants ? (
                    <VariantManager variants={variants} onChange={setVariants} mainSku={formData.sku} />
                  ) : (
                    <div className="grid grid-cols-3 gap-5">
                      <div><label className={labelClass}>ราคาทุน</label><NumericInput className={inputClass} value={formData.cost_price} onChange={v => setFormData({...formData, cost_price: v})} placeholder="0" /></div>
                      <div><label className={labelClass}>ราคาขาย</label><NumericInput className={`${inputClass} text-indigo-600 font-bold`} value={formData.sell_price} onChange={v => setFormData({...formData, sell_price: v})} placeholder="0" /></div>
                      <div><label className={labelClass}>สต็อก</label><NumericInput className={inputClass} value={formData.stock_quantity} onChange={v => setFormData({...formData, stock_quantity: v})} placeholder="0" /></div>
                    </div>
                  )}
               </div>
             </>
           )}

           {activeTab === 'bundles' && !isSparePart && (
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                <div className="mb-6">
                  <h3 className="font-bold text-gray-800 text-lg">ส่วนประกอบสินค้า (Bundles / BOM)</h3>
                  <p className="text-gray-400 text-sm mt-1">เลือกอะไหล่หรือสินค้าลูกที่ใช้ประกอบเป็นสินค้านี้</p>
                </div>
                <ProductBundleSelector bundles={bundles} onChange={setBundles} />
             </div>
           )}

           {activeTab === 'fasteners' && (
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                <div className="mb-6">
                  <h3 className="font-bold text-gray-800 text-lg">จุดยึดและน็อตประกอบ (Fasteners Mapping)</h3>
                  <p className="text-gray-400 text-sm mt-1">ระบุตำแหน่งและสเปคน็อตที่ใช้สำหรับสินค้านี้</p>
                </div>
                <ProductFastenerSelector locations={fasteners} onChange={setFasteners} />
             </div>
           )}

        </div>
      </div>
    </form>
  );
};
export default ProductForm;