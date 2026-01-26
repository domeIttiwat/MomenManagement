import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ImageUploader from './ImageUploader';
import CategoryManager from './CategoryManager';
import VariantManager from './VariantManager';
import NumericInput from './NumericInput';
import CompatibilitySelector from './CompatibilitySelector';

const ProductForm = ({ onCancel, onSuccess, initialData }) => {
  const [loading, setLoading] = useState(false);

  const normalizeImages = (imgs) => {
    return (imgs || []).map(img => (typeof img === 'string' ? { url: img, file: null } : img));
  };

  const [formData, setFormData] = useState(initialData ? {
    ...initialData,
    images: normalizeImages(initialData.images),
    compatibility_mode: initialData.compatibility_mode || 'universal',
    compatible_models: initialData.compatible_models || []
  } : {
    name: '', 
    sku: `SC-${Math.floor(100000 + Math.random() * 900000)}`, 
    category_id: null, 
    description: '', 
    images: [], 
    cost_price: 0, 
    sell_price: 0, 
    has_variants: false,
    compatibility_mode: 'universal',
    compatible_models: []
  });
  
  const [variants, setVariants] = useState([]);

  useEffect(() => {
    if (initialData?.id && initialData?.has_variants) {
      const fetchVariants = async () => {
        const { data } = await supabase.from('product_variants').select('*').eq('product_id', initialData.id);
        if (data) setVariants(data);
      };
      fetchVariants();
    }
  }, [initialData]);

  const profit = formData.sell_price - formData.cost_price;
  const margin = formData.sell_price > 0 ? ((profit / formData.sell_price) * 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.stopPropagation(); // หยุดการ Bubbling ของ event submit
    e.preventDefault();
    
    setLoading(true);
    try {
      const uploadedImageUrls = await Promise.all(formData.images.map(async (imgObj) => {
        if (imgObj.file) {
          const file = imgObj.file;
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${fileName}`;
          const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('products').getPublicUrl(filePath);
          return data.publicUrl;
        }
        return imgObj.url;
      }));

      const productPayload = {
        name: formData.name,
        sku: formData.sku,
        category_id: formData.category_id,
        description: formData.description,
        images: uploadedImageUrls,
        cost_price: formData.has_variants ? 0 : formData.cost_price,
        sell_price: formData.has_variants ? 0 : formData.sell_price,
        has_variants: formData.has_variants,
        compatibility_mode: formData.compatibility_mode,
        compatible_models: formData.compatible_models
      };

      let productId = initialData?.id;
      
      if (productId) {
        const { error } = await supabase.from('products').update(productPayload).eq('id', productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('products').insert([productPayload]).select().single();
        if (error) throw error;
        productId = data.id;
      }

      if (formData.has_variants) {
        if (initialData?.id) {
           await supabase.from('product_variants').delete().eq('product_id', productId);
        }
        if (variants.length > 0) {
          const variantsPayload = variants.map(v => ({
            product_id: productId,
            name: v.name, 
            sku: v.sku || `${formData.sku}-${v.name.replace(/\s+/g, '')}`, 
            options: v.options,
            cost_price: Number(v.cost_price), 
            sell_price: Number(v.sell_price)
          }));
          await supabase.from('product_variants').insert(variantsPayload);
        }
      }

      onSuccess();
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
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 font-medium text-sm transition-colors">ยกเลิก</button>
          <button type="submit" disabled={loading} className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-gray-200 flex items-center gap-2 active:scale-95 transition-all">
            {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} บันทึกข้อมูล
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Info size={16} className="text-indigo-500"/> รูปภาพสินค้า</h3>
            <ImageUploader images={formData.images} onChange={imgs => setFormData({...formData, images: imgs})} />
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Info size={16} className="text-indigo-500"/> หมวดหมู่</h3>
            <CategoryManager selectedCategoryId={formData.category_id} onChange={id => setFormData({...formData, category_id: id})} />
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Info size={16} className="text-indigo-500"/> รุ่นที่รองรับ</h3>
            <CompatibilitySelector 
              mode={formData.compatibility_mode} 
              selectedModels={formData.compatible_models}
              onChange={(key, mode, models) => setFormData({...formData, compatibility_mode: mode, compatible_models: models})}
            />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <h3 className="font-bold text-gray-800 text-lg border-b border-gray-50 pb-4 mb-6">ข้อมูลพื้นฐาน</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>ชื่อสินค้า / รุ่น</label>
                <input required placeholder="เช่น Scooter Model X Pro" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className={labelClass}>รหัส SKU (Auto)</label>
                    <input className={`${inputClass} font-mono bg-gray-100`} value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                 </div>
              </div>
              <div>
                <label className={labelClass}>รายละเอียด / หมายเหตุ</label>
                <textarea placeholder="สเปคสินค้าเพิ่มเติม..." className={inputClass} rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-50 pb-4 mb-6">
              <h3 className="font-bold text-gray-800 text-lg">ราคาและสเปค</h3>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={formData.has_variants} onChange={e => setFormData({...formData, has_variants: e.target.checked})} /> 
                เปิดใช้งานหลายสเปค (เช่น แบตเตอรี่ต่างกัน)
              </label>
            </div>

            {formData.has_variants ? (
              <VariantManager variants={variants} onChange={setVariants} mainSku={formData.sku} />
            ) : (
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>ราคาทุน</label>
                  <NumericInput className={inputClass} value={formData.cost_price} onChange={val => setFormData({...formData, cost_price: val})} />
                </div>
                <div>
                  <label className={labelClass}>ราคาขาย</label>
                  <NumericInput className={`${inputClass} text-indigo-600 font-bold`} value={formData.sell_price} onChange={val => setFormData({...formData, sell_price: val})} />
                </div>
                
                <div className="col-span-2 bg-gradient-to-r from-gray-50 to-white p-4 rounded-xl border border-gray-100 flex justify-between items-center mt-2">
                  <div className="text-sm text-gray-500">ประมาณการกำไร</div>
                  <div className="flex gap-6 text-sm">
                    <span>กำไร: <b className={`text-lg ${profit > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>฿{profit.toLocaleString()}</b></span>
                    <span>Margin: <b className={`text-lg ${margin > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{margin}%</b></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};
export default ProductForm;