import React, { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Trash2, Eye, EyeOff, Layers, Package, Wrench, Bike, Check, Tag, Box, TrendingUp, DollarSign, ShoppingBag, Puzzle, MapPin, ChevronDown, ChevronUp, Sparkles, Image as ImageIcon, Printer, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import FastenerBillPreview from './FastenerBillPreview';

const ProductDetail = ({ product, onBack, onEdit, onDelete, showCost, setShowCost }) => {
  const { can } = useAuth();
  const [variants, setVariants] = useState([]);
  const [fasteners, setFasteners] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [accessories, setAccessories] = useState([]); 
  const [selectedImg, setSelectedImg] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  
  const [expandedVariants, setExpandedVariants] = useState({});
  const [showLocationImages, setShowLocationImages] = useState(true);
  const [showFastenerBill, setShowFastenerBill] = useState(false);

  // Helper to safely get image URL
  const getImageUrl = (img) => {
    if (!img) return null;
    return typeof img === 'string' ? img : img.url;
  };

  useEffect(() => {
    if (product) {
      // FIX: ตั้งค่ารูปเริ่มต้นอย่างปลอดภัย
      const imgs = product.images || [];
      if (imgs.length > 0) {
        setSelectedImg(getImageUrl(imgs[0]));
      } else {
        setSelectedImg(null);
      }
      
      const fetchData = async () => {
        // 1. Fetch Variants
        if (product.has_variants) {
          const { data } = await supabase.from('product_variants').select('*').eq('product_id', product.id).order('sell_price');
          if (data) {
              setVariants(data);
              const initialExpanded = {};
              data.forEach(v => initialExpanded[v.id] = false); 
              setExpandedVariants(initialExpanded);
          }
        } else {
          setVariants([]);
        }

        // 2. Fetch Fasteners
        const { data: fData } = await supabase.from('product_fasteners').select('*').eq('product_id', product.id);
        if (fData) setFasteners(fData);

        // 3. Fetch Bundles
        const { data: bData } = await supabase.from('product_bundles').select('*, product:child_product_id(name, sku, cost_price)').eq('parent_product_id', product.id);
        if (bData) setBundles(bData);

        // 4. Fetch Accessories
        const { data: accData } = await supabase.from('product_compatible_accessories').select('*, product:accessory_id(id, name, sku, sell_price, cost_price, images)').eq('product_id', product.id);
        if (accData) setAccessories(accData);
      };
      
      fetchData();
    }
  }, [product]);

  const toggleVariantExpand = (id) => {
    setExpandedVariants(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!product) return null;

  const sellPrice = product.sell_price || 0;
  const costPrice = product.cost_price || 0;
  const profit = sellPrice - costPrice;
  const { soldCount, timesOrdered, totalSalesVal, totalProfitVal } = product.stats || { soldCount: 0, timesOrdered: 0, totalSalesVal: 0, totalProfitVal: 0 };
  
  const hasBundlesData = bundles.length > 0 || product.hasBundles;
  const hasFastenersData = fasteners.length > 0 || product.hasFasteners;
  const totalBundleCost = bundles.reduce((sum, b) => sum + ((b.product?.cost_price || 0) * (b.quantity || 1)), 0);

  const commonBundles = bundles.filter(b => b.parent_variant_id === null);
  const variantBundles = {};
  variants.forEach(v => {
      variantBundles[v.id] = bundles.filter(b => b.parent_variant_id === v.id);
  });

  const displayCategories = product.categoryNames && product.categoryNames.length > 0 
    ? product.categoryNames 
    : [product.categories?.name || 'Uncategorized'];

  return (
    <div className="space-y-8 pb-10">
      
      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500 bg-white/10 hover:bg-white/20 rounded-full p-2 backdrop-blur-sm transition-all"><X size={24}/></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100 sticky top-2 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium px-3 py-2 rounded-xl hover:bg-gray-100 transition-all">
          <ArrowLeft size={20} /> <span className="hidden sm:inline">ย้อนกลับ</span>
        </button>
        <div className="flex flex-wrap gap-2">
          {can('products', 'show_cost') && (
            <button
              onClick={() => setShowCost(!showCost)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                showCost ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {showCost ? <Eye size={18}/> : <EyeOff size={18}/>}
              <span className="hidden sm:inline">{showCost ? 'ซ่อนต้นทุน/กำไร' : 'แสดงต้นทุน/กำไร'}</span>
            </button>
          )}
          {can('products', 'edit') && (
            <button onClick={onEdit} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl flex items-center gap-2 hover:bg-black font-medium text-sm shadow-lg shadow-gray-200 transition-all active:scale-95">
              <Edit size={18}/> แก้ไข
            </button>
          )}
          {can('products', 'delete') && (
            <button onClick={onDelete} className="px-3 py-2.5 bg-white text-red-500 border border-gray-200 rounded-xl flex items-center gap-2 hover:bg-red-50 hover:border-red-100 font-medium text-sm transition-all active:scale-95">
              <Trash2 size={18}/>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Images */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-24 space-y-4">
            <div className="aspect-square bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 relative shadow-sm group">
               {selectedImg ? (
                 <img src={selectedImg} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
               ) : (
                 <div className="flex items-center justify-center h-full text-gray-300"><Package size={64}/></div>
               )}
            </div>
            {/* Thumbnail List */}
            {product.images?.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {product.images?.map((img, i) => {
                  const url = getImageUrl(img);
                  return (
                    <button
                        key={i}
                        onClick={() => setSelectedImg(url)}
                        className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                        selectedImg === url ? 'border-indigo-600 shadow-md scale-95 ring-2 ring-indigo-100' : 'border-transparent hover:border-gray-300'
                        }`}
                    >
                        <img src={url} className="w-full h-full object-cover"/>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Info */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">ขายไปแล้ว</p><div className="flex items-center gap-2 text-indigo-600"><ShoppingBag size={20}/><span className="text-xl font-black">{soldCount}</span></div></div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">ยอดขายรวม</p><div className="flex items-center gap-2 text-gray-800"><DollarSign size={20}/><span className="text-xl font-black">฿{totalSalesVal.toLocaleString()}</span></div></div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {displayCategories.map((cat, idx) => (
                <span key={idx} className="text-xs font-bold tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase border border-indigo-100">{cat}</span>
              ))}
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md font-mono flex items-center gap-1"><Tag size={12}/> {product.sku}</span>
              
              {hasBundlesData && (
                <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md flex items-center gap-1">
                   <Puzzle size={12}/> มีส่วนประกอบ (Bundles)
                </span>
              )}
              {hasFastenersData && (
                <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-1 rounded-md flex items-center gap-1">
                   <Wrench size={12}/> มีข้อมูลน็อต (Fasteners)
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">{product.name}</h1>
          </div>

          <div className="p-6 rounded-3xl border border-gray-100 shadow-sm bg-gradient-to-br from-white to-gray-50/50">
            {!product.has_variants ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div><p className="text-sm text-gray-500 font-medium mb-1">ราคาขายต่อชิ้น</p><p className="text-4xl font-black text-gray-900 tracking-tight">฿{sellPrice.toLocaleString()}</p></div>
                 {showCost && <div><p className="text-sm text-amber-600 font-medium mb-1">ต้นทุนต่อชิ้น</p><p className="text-2xl font-bold text-amber-700">฿{costPrice.toLocaleString()}</p></div>}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-gray-600"><Layers size={24} className="text-indigo-500"/><span className="text-lg font-medium">สินค้านี้มี <span className="text-indigo-600 font-bold">{variants.length}</span> ตัวเลือก</span></div>
            )}
          </div>

          {/* 1. Variants Table */}
          {product.has_variants && (
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
               <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                 <h3 className="font-bold text-gray-800 flex items-center gap-2">
                   <Box size={18} className="text-indigo-600"/> รายการสเปคสินค้า
                 </h3>
                 <span className="text-xs font-medium bg-white px-2 py-1 rounded-md border border-gray-200 text-gray-500">{variants.length} รายการ</span>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm">
                   <thead>
                     <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500 uppercase text-xs tracking-wider font-semibold text-left">
                       <th className="px-6 py-3">รุ่นย่อย / สเปค</th>
                       <th className="px-6 py-3 text-right">ราคาขาย</th>
                       {showCost && <><th className="px-6 py-3 text-right text-amber-600">ต้นทุน</th><th className="px-6 py-3 text-right text-emerald-600">กำไร/ชิ้น</th></>}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                     {variants.map(v => (
                       <tr key={v.id} className="hover:bg-indigo-50/30 transition-colors">
                         <td className="px-6 py-4">
                           <div className="font-bold text-gray-900">{v.name}</div>
                           <div className="text-xs text-gray-400 font-mono mt-0.5">{v.sku}</div>
                         </td>
                         <td className="px-6 py-4 text-right font-bold text-lg text-gray-900">฿{v.sell_price.toLocaleString()}</td>
                         {showCost && (
                           <>
                             <td className="px-6 py-4 text-right text-amber-700 font-medium">฿{v.cost_price.toLocaleString()}</td>
                             <td className="px-6 py-4 text-right">
                               <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-bold text-xs border border-emerald-100">
                                 +฿{(v.sell_price - v.cost_price).toLocaleString()}
                                </span>
                             </td>
                           </>
                         )}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {/* 2. Accessories */}
          {accessories.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Sparkles size={16} className="text-indigo-500" /> ชุดแต่งที่แนะนำ (Accessories)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {accessories.map((acc, i) => {
                      const accImg = getImageUrl(acc.product?.images?.[0]);
                      return (
                          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm hover:border-indigo-300 transition-colors">
                             <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                                 {accImg ? <img src={accImg} className="w-full h-full object-cover"/> : <Package size={20} className="m-3 text-gray-300"/>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{acc.product?.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 rounded">{acc.product?.sku}</span>
                                    <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-1.5 rounded border border-indigo-100">ตรงรุ่น</span>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="text-sm font-bold text-indigo-600">฿{acc.product?.sell_price?.toLocaleString()}</p>
                                {showCost && <p className="text-xs text-amber-600 font-medium">ทุน {acc.product?.cost_price?.toLocaleString()}</p>}
                             </div>
                          </div>
                      );
                   })}
                </div>
            </div>
          )}

          {/* 3. Description */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 text-lg border-b border-gray-100 pb-2">รายละเอียดสินค้า</h3>
            <div className="prose prose-sm sm:prose-base text-gray-600 max-w-none whitespace-pre-line leading-relaxed">
              {product.description || <span className="text-gray-400 italic">ไม่มีรายละเอียดเพิ่มเติม</span>}
            </div>
          </div>

          {/* 4. Bundles Detail */}
          {hasBundlesData && (
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                      <Puzzle size={16} className="text-purple-500" /> ส่วนประกอบ (Parts Bundle)
                    </h3>
                    {showCost && (
                        <div className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-lg border border-amber-100">
                            รวมต้นทุนอะไหล่: <b>฿{totalBundleCost.toLocaleString()}</b>
                        </div>
                    )}
                </div>
                
                <div className="space-y-4">
                    {/* Common Parts */}
                    {commonBundles.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1 rounded-lg mb-2 inline-block border border-gray-200">อะไหล่พื้นฐาน (Common Parts)</p>
                            <div className="space-y-2">
                                {commonBundles.map((b, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 hover:border-purple-200 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Package size={16} className="text-gray-400"/>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">{b.product?.name}</p>
                                                <p className="text-xs text-gray-500">{b.product?.sku}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {showCost && (
                                                <div className="text-right mr-2 hidden sm:block">
                                                    <p className="text-[10px] text-gray-400">ทุนต่อชิ้น</p>
                                                    <p className="text-xs font-bold text-amber-600">฿{b.product?.cost_price?.toLocaleString()}</p>
                                                </div>
                                            )}
                                            <span className="text-xs font-bold bg-gray-50 px-2 py-1 rounded border border-gray-200">x{b.quantity}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Variant Specific Parts */}
                    {variants.map(v => {
                        const vBundles = variantBundles[v.id];
                        if (!vBundles || vBundles.length === 0) return null;
                        const isExpanded = expandedVariants[v.id];

                        return (
                            <div key={v.id} className="border border-indigo-100 rounded-xl overflow-hidden">
                                <div 
                                    onClick={() => toggleVariantExpand(v.id)}
                                    className="bg-indigo-50 p-3 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                        <span className="text-xs font-bold text-indigo-800">เฉพาะรุ่น: {v.name}</span>
                                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-indigo-600 border border-indigo-200">{vBundles.length} รายการ</span>
                                    </div>
                                    {isExpanded ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>}
                                </div>
                                
                                {isExpanded && (
                                    <div className="p-3 space-y-2 bg-white">
                                        {vBundles.map((b, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                                                    <p className="text-sm text-gray-700">{b.product?.name}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {showCost && <span className="text-xs text-amber-600 font-medium">฿{b.product?.cost_price?.toLocaleString()}</span>}
                                                    <span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600">x{b.quantity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
          )}

          {/* 5. Fasteners Detail */}
          {hasFastenersData && (
             <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                    <Wrench size={16} className="text-orange-500" /> สเปคน็อต (Fasteners)
                    </h3>
                    <div className="flex gap-2">
                        {/* Toggle Images */}
                        <button 
                            onClick={() => setShowLocationImages(!showLocationImages)} 
                            className={`p-1.5 rounded-lg border transition-all ${showLocationImages ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-gray-400 border-gray-200'}`}
                            title={showLocationImages ? "ซ่อนรูป" : "แสดงรูป"}
                        >
                            <ImageIcon size={16}/>
                        </button>
                        {/* Print Button */}
                        <button 
                            onClick={() => setShowFastenerBill(true)}
                            className="flex items-center gap-1 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-black font-medium shadow-sm transition-all"
                        >
                            <Printer size={14}/> พิมพ์ใบสรุป
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fasteners.map((loc, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <div className="flex items-center gap-3 mb-2 pb-2 border-b border-gray-200">
                                {showLocationImages && loc.location_image ? (
                                    <div className="w-12 h-8 bg-white rounded-md overflow-hidden border border-gray-200 shrink-0 cursor-zoom-in" onClick={() => setLightboxImg(loc.location_image)}>
                                        <img src={loc.location_image} className="w-full h-full object-cover"/>
                                    </div>
                                ) : (
                                    <MapPin size={16} className="text-orange-400 shrink-0"/>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-700 truncate">{loc.location_name}</p>
                                    {loc.note && <p className="text-[10px] text-gray-400 italic truncate">{loc.note}</p>}
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                {loc.bolts_usage?.map((bolt, idx) => (
                                    <div key={idx} className="flex justify-between text-xs text-gray-600">
                                        <div className="flex flex-col">
                                            <span>• {bolt.name}</span>
                                            {bolt.parent_variant_id && (
                                                <span className="text-[9px] text-indigo-500 ml-2">
                                                    (สำหรับ: {variants.find(v => v.id === bolt.parent_variant_id)?.name || 'Unknown'})
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-medium">x{bolt.qty}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          )}

        </div>
      </div>

      {showFastenerBill && (
          <FastenerBillPreview product={product} fasteners={fasteners} onClose={() => setShowFastenerBill(false)} />
      )}

      {/* Audit Footer */}
      {(product.created_by || product.updated_by) && (
        <div className="text-xs text-gray-400 text-center py-2 border-t border-gray-100 mt-4">
          {product.created_by && (
            <span>สร้างโดย <span className="font-medium text-gray-500">{product.created_by.name}</span> · {new Date(product.created_at).toLocaleDateString('th-TH')}</span>
          )}
          {product.created_by && product.updated_by && <span className="mx-2">|</span>}
          {product.updated_by && (
            <span>แก้ไขล่าสุดโดย <span className="font-medium text-gray-500">{product.updated_by.name}</span> · {new Date(product.updated_at).toLocaleDateString('th-TH')}</span>
          )}
        </div>
      )}
    </div>
  );
};
export default ProductDetail;