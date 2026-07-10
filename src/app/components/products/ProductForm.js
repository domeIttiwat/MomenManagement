import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Info, Wrench, Package, Layers, Sparkles, FolderOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import { recordPriceHistory } from '@/lib/stockLots';
import ImageUploader from './ImageUploader';
import CategoryManager from './CategoryManager';
import VariantManager from './VariantManager';
import ProductFastenerSelector from './ProductFastenerSelector';
import ProductBundleSelector from './ProductBundleSelector';
import ProductAccessorySelector from './ProductAccessorySelector';
import NumericInput from './NumericInput';
import ProductFilesManager from './ProductFilesManager';

const ProductForm = ({ onCancel, onSuccess, initialData }) => {
  const { profile, can } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const canEditBom = can('products', 'bom'); // สิทธิ์จัดการสูตร BOM (ตั้งค่าใน RoleManager → สินค้า → จัดการสูตร BOM)
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); 
  const [currentCategoryNames, setCurrentCategoryNames] = useState([]);

  const normalizeImages = (imgs) => {
    return (imgs || []).map(img => (typeof img === 'string' ? { url: img, file: null } : img));
  };
  const moneyOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

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
    cost_price: '', 
    sell_price: 0, 
    has_variants: false,
    requires_frame: false,
    stock_quantity: 0
  });
  
  const [variants, setVariants] = useState([]);
  const [fasteners, setFasteners] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [accessories, setAccessories] = useState([]);

  // Fetch Full Data ... (เหมือนเดิม)
  useEffect(() => {
    const fetchFullProductData = async () => {
      if (!initialData?.id) return; 

      try {
        const { data: prod } = await supabase
          .from('products')
          .select(`*, product_categories (category_id)`)
          .eq('id', initialData.id)
          .single();

        if (prod) {
          const categoryIds = prod.product_categories?.map(pc => pc.category_id) || [];
          if (categoryIds.length === 0 && prod.category_id) categoryIds.push(prod.category_id);
          setFormData(prev => ({ ...prev, ...prod, images: normalizeImages(prod.images), category_ids: categoryIds }));
        }

        if (initialData.has_variants) {
          const { data } = await supabase.from('product_variants').select('*').eq('product_id', initialData.id);
          if (data) setVariants(data);
        }
        
        // Fetch Fasteners (ตรงนี้จะได้ URL มา)
        const { data: fData } = await supabase.from('product_fasteners').select('*').eq('product_id', initialData.id);
        if (fData) setFasteners(fData);

        const { data: bData } = await supabase.from('product_bundles').select('*, product:child_product_id(*)').eq('parent_product_id', initialData.id);
        if (bData) setBundles(bData);

        const { data: accData } = await supabase.from('product_compatible_accessories').select('*, product:accessory_id(*)').eq('product_id', initialData.id);
        if (accData) setAccessories(accData);

      } catch (err) {
        console.error("Error fetching product details:", err);
      }
    };
    fetchFullProductData();
  }, [initialData?.id]); 

  // Check Category ... (เหมือนเดิม)
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

  const isSparePart = currentCategoryNames.some(name => name.toLowerCase().includes('spare') || name.includes('อะไหล่'));
  const isVehicle = currentCategoryNames.some(name => name.toLowerCase().includes('scooter') || name.toLowerCase().includes('bike'));

  const handleSubmit = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (formData.category_ids.length === 0) return alert('กรุณาเลือกหมวดสินค้าอย่างน้อย 1 หมวด');

    setLoading(true);
    try {
      const existingProduct = initialData?.id
        ? (await supabase.from('products').select('cost_price, sell_price').eq('id', initialData.id).maybeSingle()).data
        : null;
      const existingVariants = initialData?.id
        ? (await supabase.from('product_variants').select('id, name, cost_price, sell_price').eq('product_id', initialData.id)).data || []
        : [];
      const oldVariantByName = {};
      existingVariants.forEach(v => { oldVariantByName[v.name] = v; });

      // 1. Upload Main Images
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
        category_id: formData.category_ids[0], 
        description: formData.description,
        images: uploadedImageUrls,
        cost_price: formData.has_variants ? null : moneyOrNull(formData.cost_price),
        sell_price: formData.has_variants ? 0 : Number(formData.sell_price || 0),
        has_variants: formData.has_variants,
        requires_frame: formData.requires_frame === true,
        paint_config: formData.paint_config
          ? {
              enabled: formData.paint_config.enabled === true,
              stock_color: formData.paint_config.stock_color || '#000000',
              stock_color_name: formData.paint_config.stock_color_name || 'ดำ',
              single_price: Number(formData.paint_config.single_price || 0),
              two_tone_price: Number(formData.paint_config.two_tone_price || 0),
            }
          : null,
      };

      let productId = initialData?.id;
      let resultData = null;

      if (productId) {
        const { data } = await supabase.from('products').update({ ...productPayload, updated_by: meRef() }).eq('id', productId).select().single();
        resultData = data;
        await supabase.from('product_categories').delete().eq('product_id', productId);
      } else {
        const { data, error } = await supabase.from('products').insert([{ ...productPayload, created_by: meRef() }]).select().single();
        if (error) throw error;
        productId = data.id;
        resultData = data;
      }

      // Categories
      if (formData.category_ids.length > 0) {
          await supabase.from('product_categories').insert(formData.category_ids.map(cId => ({ product_id: productId, category_id: cId })));
      }

      // Variants — ลบ+สร้างใหม่ทำให้ id เปลี่ยน จึงต้องเก็บ map old->new ไว้ remap ให้ BOM
      const variantIdMap = {}; // { oldVariantId: newVariantId } (จับคู่ด้วยชื่อ variant)
      if (formData.has_variants) {
        if (initialData?.id) {
          const { error: delErr } = await supabase.from('product_variants').delete().eq('product_id', productId);
          if (delErr) throw delErr;
        }
        if (variants.length > 0) {
          const { data: newVariants, error: varErr } = await supabase.from('product_variants').insert(variants.map(v => ({
            product_id: productId,
            name: v.name,
            sku: v.sku || `${formData.sku}-${v.name.replace(/\s+/g, '')}`,
            options: v.options,
            cost_price: moneyOrNull(v.cost_price),
            sell_price: Number(v.sell_price)
          }))).select();
          if (varErr) throw varErr;
          const newIdByName = {};
          (newVariants || []).forEach(nv => { newIdByName[nv.name] = nv.id; });
          variants.forEach(v => {
            if (v.id != null && newIdByName[v.name] != null) variantIdMap[v.id] = newIdByName[v.name];
          });

          for (const nv of newVariants || []) {
            const old = oldVariantByName[nv.name] || {};
            await recordPriceHistory({
              productId,
              variantId: nv.id,
              oldCostPrice: old.cost_price ?? null,
              newCostPrice: nv.cost_price,
              oldSellPrice: old.sell_price ?? null,
              newSellPrice: nv.sell_price,
              sourceType: initialData?.id ? 'product_form' : 'product_create',
              sourceId: productId,
              note: `แก้ราคา variant ${nv.name}`,
              profileId: profile?.id,
            });
          }
        }
      } else {
        await recordPriceHistory({
          productId,
          oldCostPrice: existingProduct?.cost_price ?? null,
          newCostPrice: productPayload.cost_price,
          oldSellPrice: existingProduct?.sell_price ?? null,
          newSellPrice: productPayload.sell_price,
          sourceType: initialData?.id ? 'product_form' : 'product_create',
          sourceId: productId,
          note: 'แก้ราคาสินค้า',
          profileId: profile?.id,
        });
      }

      // Bundles / BOM — แก้เฉพาะผู้มีสิทธิ์ 'จัดการสูตร BOM' (กันผู้ไม่มีสิทธิ์เผลอลบสูตร)
      if (!isSparePart && canEditBom) {
        if (initialData?.id) await supabase.from('product_bundles').delete().eq('parent_product_id', productId);
        const newVariantIds = new Set(Object.values(variantIdMap));
        const bundleRows = bundles
          .map(b => {
            const origPv = b.parent_variant_id ?? null;
            const pvid = origPv == null ? null : (variantIdMap[origPv] ?? null); // remap old->new
            return { origPv, row: {
              parent_product_id: productId,
              child_product_id: b.child_product_id ?? null,
              component_name: b.component_name ?? null,
              quantity: b.quantity,
              note: b.note ?? null,
              parent_variant_id: pvid,
            } };
          })
          // base (origPv=null) เก็บเสมอ; variant ต้อง remap เจอ id ใหม่จริง (กัน FK ล้มทั้งชุด)
          .filter(x => x.origPv == null || (x.row.parent_variant_id != null && newVariantIds.has(x.row.parent_variant_id)))
          .map(x => x.row);
        if (bundleRows.length > 0) {
          const { error: bErr } = await supabase.from('product_bundles').insert(bundleRows);
          if (bErr) throw bErr; // เดิมไม่เช็ค error → ล้มเงียบ ตอนนี้แจ้งแล้ว
        }
        // Audit log เฉพาะการแก้ BOM
        await logAction({
          resource_type: 'product',
          resource_id: productId,
          action: 'bom_update',
          resource_label: formData.name,
          metadata: { component_count: bundles.length },
          created_by: meRef(),
        });
      }

      // Fasteners (FIX: Upload & Save Images)
      if (initialData?.id) await supabase.from('product_fasteners').delete().eq('product_id', productId);
      if (fasteners.length > 0) {
        const processedFasteners = await Promise.all(fasteners.map(async (f) => {
            let finalUrl = null;
            // เช็คว่าเป็นไฟล์ที่ต้องอัปโหลดหรือไม่
            if (f.location_image && typeof f.location_image === 'object' && f.location_image.file) {
                 const fileName = `fastener-${Date.now()}-${Math.random()}`;
                 // ใช้ Bucket 'products' เหมือนกับรูปสินค้า
                 await supabase.storage.from('products').upload(fileName, f.location_image.file);
                 const { data } = supabase.storage.from('products').getPublicUrl(fileName);
                 finalUrl = data.publicUrl;
            } else if (f.location_image) {
                // ถ้าเป็น URL อยู่แล้ว (หรือ Object ที่มี url แต่ไม่มี file)
                finalUrl = typeof f.location_image === 'string' ? f.location_image : f.location_image.url;
            }

            return {
                product_id: productId,
                location_name: f.location_name,
                location_image: finalUrl, // บันทึก URL ที่เป็น String
                bolts_usage: f.bolts_usage,
                note: f.note
            };
        }));
        await supabase.from('product_fasteners').insert(processedFasteners);
      }

      // Accessories
      if (initialData?.id) await supabase.from('product_compatible_accessories').delete().eq('product_id', productId);
      if (accessories.length > 0) {
          await supabase.from('product_compatible_accessories').insert(accessories.map(acc => ({
              product_id: productId,
              accessory_id: acc.accessory_id
          })));
      }

      // Audit log
      const logFields = (d) => ({
        name: d?.name, sku: d?.sku, sell_price: d?.sell_price,
        cost_price: d?.cost_price, has_variants: d?.has_variants, requires_frame: d?.requires_frame === true, description: d?.description,
      });
      await logAction({
        resource_type: 'product',
        resource_id: productId,
        action: initialData?.id ? 'update' : 'create',
        resource_label: formData.name,
        old_data: initialData?.id ? logFields(initialData) : null,
        new_data: logFields(formData),
        created_by: meRef(),
      });

      onSuccess(resultData);
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
                        <Layers size={18}/> สูตรประกอบ (BOM)
                    </button>
                 )}

                 {isVehicle && (
                     <button type="button" onClick={() => setActiveTab('accessories')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${activeTab === 'accessories' ? 'bg-pink-50 text-pink-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Sparkles size={18}/> ชุดแต่งที่รองรับ
                    </button>
                 )}

                 <button type="button" onClick={() => setActiveTab('fasteners')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${activeTab === 'fasteners' ? 'bg-orange-50 text-orange-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Wrench size={18}/> จุดยึดและน็อต
                 </button>

                 <button type="button" onClick={() => setActiveTab('files')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all ${activeTab === 'files' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <FolderOpen size={18}/> ไฟล์เอกสาร
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
                    <label className="flex items-start gap-3 p-4 rounded-2xl border border-sky-100 bg-sky-50/50 cursor-pointer hover:bg-sky-50 transition-colors">
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 accent-sky-600 rounded"
                        checked={formData.requires_frame === true}
                        onChange={e => setFormData({...formData, requires_frame: e.target.checked})}
                      />
                      <span>
                        <span className="font-bold text-sky-900 flex items-center gap-2">
                          <Wrench size={16} className="text-sky-600"/> สินค้านี้ต้องทำโครง
                        </span>
                        <span className="text-xs text-sky-700 mt-1 block">
                          เมื่อนำสินค้านี้ไปใส่ออเดอร์ ระบบจะเปิดสถานะงานโครงให้ติดตามได้
                        </span>
                      </span>
                    </label>

                    {/* ระบบสั่งทำสี (paint_config) — ใช้โดยหน้า quote link + paint editor ในออเดอร์ */}
                    <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50/50">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4 accent-amber-600 rounded"
                          checked={formData.paint_config?.enabled === true}
                          onChange={e => setFormData({
                            ...formData,
                            paint_config: {
                              stock_color: '#000000', stock_color_name: 'ดำ',
                              single_price: 4900, two_tone_price: 6900,
                              ...(formData.paint_config || {}),
                              enabled: e.target.checked,
                            },
                          })}
                        />
                        <span>
                          <span className="font-bold text-amber-900">รุ่นนี้สั่งทำสีได้ (เฟรม/สวิงอาม)</span>
                          <span className="text-xs text-amber-700 mt-1 block">
                            ลูกค้าเลือกทำสีจากลิงก์ใบเสนอราคาได้ และแอดมินใส่สีให้ในออเดอร์ได้
                          </span>
                        </span>
                      </label>
                      {formData.paint_config?.enabled === true && (
                        <div className="grid grid-cols-2 gap-3 mt-3 pl-7">
                          <div>
                            <label className={labelClass}>สีเดิมจากโรงงาน</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                className="w-9 h-9 rounded border border-gray-200 cursor-pointer"
                                value={formData.paint_config?.stock_color || '#000000'}
                                onChange={e => setFormData({...formData, paint_config: {...formData.paint_config, stock_color: e.target.value}})}
                              />
                              <input
                                className={inputClass}
                                placeholder="ชื่อสี เช่น ดำ"
                                value={formData.paint_config?.stock_color_name || ''}
                                onChange={e => setFormData({...formData, paint_config: {...formData.paint_config, stock_color_name: e.target.value}})}
                              />
                            </div>
                          </div>
                          <div></div>
                          <div>
                            <label className={labelClass}>ราคาทำสี — สีเดียว</label>
                            <NumericInput
                              className={inputClass}
                              value={formData.paint_config?.single_price}
                              onChange={v => setFormData({...formData, paint_config: {...formData.paint_config, single_price: v}})}
                              placeholder="4900"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>ราคาทำสี — Two-Tone</label>
                            <NumericInput
                              className={inputClass}
                              value={formData.paint_config?.two_tone_price}
                              onChange={v => setFormData({...formData, paint_config: {...formData.paint_config, two_tone_price: v}})}
                              placeholder="6900"
                            />
                          </div>
                        </div>
                      )}
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
                    <div className="grid grid-cols-2 gap-5">
                      <div><label className={labelClass}>ราคาทุน</label><NumericInput className={inputClass} value={formData.cost_price} onChange={v => setFormData({...formData, cost_price: v})} placeholder="0" /></div>
                      <div><label className={labelClass}>ราคาขาย</label><NumericInput className={`${inputClass} text-indigo-600 font-bold`} value={formData.sell_price} onChange={v => setFormData({...formData, sell_price: v})} placeholder="0" /></div>
                    </div>
                  )}
               </div>
             </>
           )}

           {activeTab === 'bundles' && !isSparePart && (
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                <div className="mb-6">
                  <h3 className="font-bold text-gray-800 text-lg">สูตรประกอบ (BOM)</h3>
                  <p className="text-gray-400 text-sm mt-1">ระบุว่าสินค้า/รถรุ่นนี้ประกอบด้วยอะไรบ้าง (อะไหล่พื้นฐานใช้ทุกรุ่น + ส่วนต่างของแต่ละรุ่นย่อย) — เป็นสูตรกลาง ไม่ตัดสต๊อก</p>
                </div>
                {!canEditBom && (
                  <div className="mb-4 flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                    <Info size={14}/> โหมดดูอย่างเดียว — คุณไม่มีสิทธิ์ “จัดการสูตร BOM” (ตั้งค่าได้ใน จัดการทีมงาน → สิทธิ์)
                  </div>
                )}
                <ProductBundleSelector bundles={bundles} onChange={setBundles} variants={variants} canEdit={canEditBom} productSku={formData.sku} productName={formData.name} />
             </div>
           )}

           {activeTab === 'accessories' && isVehicle && (
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                <div className="mb-6">
                  <h3 className="font-bold text-gray-800 text-lg">ชุดแต่งที่รองรับ (Compatible Accessories)</h3>
                  <p className="text-gray-400 text-sm mt-1">เลือกรายการชุดแต่งหรืออุปกรณ์เสริมที่สามารถติดตั้งกับรถรุ่นนี้ได้ (เพื่อช่วยขาย)</p>
                </div>
                <ProductAccessorySelector accessories={accessories} onChange={setAccessories} />
             </div>
           )}

           {activeTab === 'fasteners' && (
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                <div className="mb-6">
                  <h3 className="font-bold text-gray-800 text-lg">จุดยึดและน็อตประกอบ (Fasteners Mapping)</h3>
                  <p className="text-gray-400 text-sm mt-1">ระบุตำแหน่งและสเปคน็อตที่ใช้สำหรับสินค้านี้</p>
                </div>
                <ProductFastenerSelector locations={fasteners} onChange={setFasteners} variants={variants} />
             </div>
           )}

           {activeTab === 'files' && (
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
               {initialData?.id ? (
                 <ProductFilesManager productId={initialData.id} />
               ) : (
                 <div className="text-center py-12 text-gray-400">
                   <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
                   <p className="font-medium text-gray-500">บันทึกสินค้าก่อนเพิ่มไฟล์</p>
                   <p className="text-sm mt-1">กรุณากดปุ่มบันทึกข้อมูลด้านบน แล้วกลับมาที่แท็บนี้</p>
                 </div>
               )}
             </div>
           )}

        </div>
      </div>
    </form>
  );
};
export default ProductForm;
