import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Trash2, Receipt, Truck, Printer, PackagePlus, DollarSign, Calculator, History, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import CustomerSelector from './CustomerSelector';
import ProductSelector from './ProductSelector';
import PaymentManager from './PaymentManager';
import ImageUploader from './ImageUploader';
import BillPreview from './BillPreview';
import NumericInput from '../products/NumericInput';
import OrderUpdateManager from './OrderUpdateManager';
import OrderTeamSelector from './OrderTeamSelector';
import AccessorySuggestionModal from './AccessorySuggestionModal';

const OrderForm = ({ onCancel, onSuccess, initialData }) => {
  const { profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // State for Suggestion Modal
  const [suggestionProduct, setSuggestionProduct] = useState(null);
  
  const getLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

  // Initial State Setup
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        customer: initialData.customer_cache || null, 
        items: initialData.order_items || [], 
        assignees: initialData.order_assignees || [],
        payments: (initialData.order_payments || []).map(p => ({
          ...p,
          date: p.payment_date ? p.payment_date.split('T')[0] : p.date,
          method: p.payment_method || 'Transfer',
          fee_percent: p.fee_percent || 0,
          fee_amount: p.fee_amount || 0
        })),
        updates: (initialData.order_updates || []).map(u => ({
          ...u,
          images: (u.images || []).map(url => ({ url, file: null }))
        })),
        images: (initialData.images || []).map(url => ({ url, file: null })),
        shipping_cost: initialData.shipping_cost || 0,
        discount: initialData.discount || 0,
        vat_type: initialData.vat_type || 'no_vat',
        show_tax_id: initialData.show_tax_id || false,
        invoice_number: initialData.invoice_number || '',
        notes: initialData.notes || '',
        order_date: initialData.order_date ? initialData.order_date.split('T')[0] : getLocalDate(),
        completed_at: initialData.completed_at ? initialData.completed_at.split('T')[0] : ''
      };
    }
    return {
      order_number: `ORD-${new Date().getFullYear().toString().substr(-2)}${(new Date().getMonth()+1).toString().padStart(2,0)}-${Math.floor(1000 + Math.random() * 9000)}`,
      order_date: getLocalDate(),
      completed_at: '',
      status: 'Quotation',
      customer: null,
      assignees: [],
      items: [],
      payments: [],
      updates: [],
      images: [], 
      shipping_cost: 0,
      discount: 0,
      vat_type: 'no_vat',
      show_tax_id: false,
      invoice_number: '',
      notes: ''
    };
  });

  // --- FIX: Auto-Refresh Data on Mount (แก้ปัญหาข้อมูลเก่า) ---
  useEffect(() => {
    // ทำงานเฉพาะตอนแก้ไข (มี ID) เพื่อดึงข้อมูลล่าสุดจาก DB เสมอ
    if (initialData?.id) {
      const fetchFreshData = async () => {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(*),
            order_payments(*),
            order_updates(*),
            order_assignees(user_id, job_role, user:user_id(first_name, last_name, avatar_url))
          `)
          .eq('id', initialData.id)
          .single();

        if (data && !error) {
          setFormData(prev => ({
            ...prev,
            // อัปเดตข้อมูลสถานะและลูกค้าล่าสุด
            status: data.status,
            customer: data.customer_cache,
            
            // อัปเดตรายการต่างๆ ให้เป็นปัจจุบัน
            items: data.order_items || [],
            assignees: data.order_assignees || [],
            payments: (data.order_payments || []).map(p => ({
              ...p,
              date: p.payment_date ? p.payment_date.split('T')[0] : p.date,
              method: p.payment_method || 'Transfer',
              fee_percent: p.fee_percent || 0,
              fee_amount: p.fee_amount || 0
            })),
            
            // หัวใจสำคัญ: อัปเดต Timeline ให้เป็นของล่าสุด เพื่อไม่ให้ข้อมูลหายเวลาบันทึก
            updates: (data.order_updates || []).map(u => ({
              ...u,
              images: (u.images || []).map(url => ({ url, file: null }))
            })),
            
            // อัปเดตข้อมูลการเงินล่าสุด
            shipping_cost: data.shipping_cost || 0,
            discount: data.discount || 0,
            vat_type: data.vat_type || 'no_vat',
            show_tax_id: data.show_tax_id || false,
            invoice_number: data.invoice_number || '',
            notes: data.notes || '',
            order_date: data.order_date ? data.order_date.split('T')[0] : prev.order_date,
            completed_at: data.completed_at ? data.completed_at.split('T')[0] : prev.completed_at
          }));
        }
      };
      fetchFreshData();
    }
  }, [initialData?.id]);
  // -----------------------------------------------------------

  const subtotal = formData.items.reduce((sum, item) => sum + (item.sell_price * item.quantity), 0);
  const discountVal = parseFloat(formData.discount) || 0;
  const shippingVal = parseFloat(formData.shipping_cost) || 0;
  const taxableAmount = Math.max(0, subtotal - discountVal);
  
  let vatAmount = 0;
  let grandTotal = taxableAmount + shippingVal;

  if (formData.vat_type === 'exclude') {
    vatAmount = round2(taxableAmount * 0.07);
    grandTotal = round2(grandTotal + vatAmount);
  } else if (formData.vat_type === 'include') {
    vatAmount = round2(taxableAmount * 7 / 107);
    grandTotal = round2(grandTotal);
  } else {
    grandTotal = round2(grandTotal);
  }

  const handleTargetPriceChange = (targetPrice) => {
    const target = parseFloat(targetPrice) || 0;
    let newDiscount = 0;
    if (formData.vat_type === 'exclude') {
      const base = (target - shippingVal) / 1.07;
      newDiscount = subtotal - base;
    } else {
      newDiscount = subtotal + shippingVal - target;
    }
    setFormData({ ...formData, discount: Math.max(0, round2(newDiscount)) });
  };

  const handleAddItem = (item) => {
    setFormData(prev => ({...prev, items: [...prev.items, item]}));
    
    // Check if item is a main product (not custom) and trigger suggestion modal
    if (!item.is_custom) {
        // FIX: Prepare object with ID for Modal
        const itemForModal = {
            ...item,
            id: item.product_id || item.id, // Ensure ID is passed for lookup
            name: item.product_name || item.name
        };
        setSuggestionProduct(itemForModal);
    }
  };

  const handleAddAccessories = (accessories) => {
    const newItems = accessories.map(acc => ({
        product_id: acc.id,
        product_name: acc.name,
        sku: acc.sku,
        variant_name: '', 
        cost_price: acc.cost_price, 
        sell_price: acc.sell_price,
        quantity: 1,
        is_custom: false
    }));
    setFormData(prev => ({...prev, items: [...prev.items, ...newItems]}));
  };

  const handleRemoveItem = (idx) => setFormData({...formData, items: formData.items.filter((_, i) => i !== idx)});
  const updateItem = (idx, field, value) => {
    const newItems = [...formData.items];
    newItems[idx][field] = value;
    setFormData({...formData, items: newItems});
  };
  const handleFocus = (e) => e.target.select();

  const handleManualOpenSuggestion = (item) => {
    const itemForModal = {
        ...item,
        id: item.product_id || item.id, 
        name: item.product_name || item.name
    };
    setSuggestionProduct(itemForModal);
  };

  const previewOrderData = {
    ...formData,
    customer_cache: formData.customer,
    order_items: formData.items,
    order_payments: formData.payments,
    order_assignees: formData.assignees,
    subtotal,
    vat_amount: vatAmount,
    grand_total: grandTotal
  };

  // --- FIX: สร้าง Array ของ Product IDs ที่มีอยู่แล้ว เพื่อส่งไปเช็คใน Modal ---
  // แปลงทุกอย่างเป็น String เพื่อความชัวร์ในการเทียบ
  const existingProductIds = formData.items.map(item => String(item.product_id || item.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer) return alert('กรุณาเลือกลูกค้า');
    if (formData.items.length === 0) return alert('กรุณาเพิ่มสินค้า');
    
    setLoading(true);
    try {
      const uploadedImages = await Promise.all(formData.images.map(async (img) => {
        if (img.file) {
          const fileName = `ord-${Date.now()}-${Math.random()}`;
          await supabase.storage.from('orders').upload(fileName, img.file);
          const { data } = supabase.storage.from('orders').getPublicUrl(fileName);
          return data.publicUrl;
        }
        return img.url;
      }));

      const processedUpdates = await Promise.all(formData.updates.map(async (upd) => {
          const updateImgs = await Promise.all(upd.images.map(async (img) => {
             if (img.file) {
                const fileName = `ord-upd-${Date.now()}-${Math.random()}`;
                await supabase.storage.from('orders').upload(fileName, img.file);
                const { data } = supabase.storage.from('orders').getPublicUrl(fileName);
                return data.publicUrl;
             }
             return img.url;
          }));
          return {
              description: upd.description,
              update_date: upd.update_date,
              images: updateImgs
          };
      }));

      const orderPayload = {
        order_number: formData.order_number,
        customer_id: formData.customer.id,
        customer_cache: formData.customer,
        status: formData.status,
        order_date: formData.order_date || getLocalDate(),
        completed_at: formData.status === 'Completed' ? formData.completed_at : null,
        show_tax_id: formData.show_tax_id,
        invoice_number: formData.invoice_number,
        subtotal,
        shipping_cost: shippingVal,
        discount: discountVal,
        vat_type: formData.vat_type,
        vat_amount: vatAmount,
        grand_total: grandTotal,
        notes: formData.notes,
        images: uploadedImages
      };

      let orderId = initialData?.id;

      if (orderId) {
        await supabase.from('orders').update({ ...orderPayload, updated_by: meRef() }).eq('id', orderId);
        
        // ลบข้อมูลเก่าทั้งหมด (Strategy: Delete & Re-insert)
        // ข้อดี: ง่ายและจัดการลำดับได้ดี
        // ข้อเสีย: ถ้าข้อมูลใน formData ไม่อัปเดต ข้อมูลจริงจะหาย (เราแก้ด้วย useEffect fetchFreshData ข้างบนแล้ว)
        await supabase.from('order_items').delete().eq('order_id', orderId);
        await supabase.from('order_payments').delete().eq('order_id', orderId);
        await supabase.from('order_updates').delete().eq('order_id', orderId);
        await supabase.from('order_assignees').delete().eq('order_id', orderId);
      } else {
        const { data } = await supabase.from('orders').insert([{ ...orderPayload, created_by: meRef() }]).select().single();
        orderId = data.id;
      }

      const itemsPayload = formData.items.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        variant_name: item.variant_name,
        cost_price: item.cost_price,
        sell_price: item.sell_price,
        quantity: item.quantity
      }));
      await supabase.from('order_items').insert(itemsPayload);

      if (processedUpdates.length > 0) {
        await supabase.from('order_updates').insert(processedUpdates.map(u => ({
            order_id: orderId,
            description: u.description,
            update_date: u.update_date,
            images: u.images
        })));
      }

      if (formData.assignees.length > 0) {
        await supabase.from('order_assignees').insert(formData.assignees.map(a => ({
          order_id: orderId,
          user_id: a.user_id,
          job_role: a.job_role
        })));
      }

      if (formData.payments.length > 0) {
        const paymentsPayload = formData.payments.map(p => ({
          order_id: orderId,
          amount: p.amount,
          payment_date: p.date, 
          type: p.type,
          payment_method: p.method || 'Transfer',
          fee_percent: p.fee_percent || 0,
          fee_amount: p.fee_amount || 0
        }));
        await supabase.from('order_payments').insert(paymentsPayload);
      }

      onSuccess();
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all outline-none text-gray-700 font-medium";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1";

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto pb-20 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{initialData ? 'แก้ไขออเดอร์' : 'สร้างออเดอร์ใหม่'}</h1>
              <p className="text-xs text-gray-500 font-mono">{formData.order_number}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowPreview(true)} className="bg-white text-indigo-700 border border-indigo-100 hover:bg-indigo-50 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all">
              <Printer size={18} /> พรีวิวเอกสาร
            </button>
            <button type="submit" disabled={loading} className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-gray-200 flex items-center gap-2 active:scale-95 transition-all">
              {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} บันทึก
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
              <h3 className="font-bold text-gray-800 text-lg border-b border-gray-50 pb-3">ข้อมูลลูกค้า & เอกสาร</h3>
              <CustomerSelector selectedCustomer={formData.customer} onSelect={c => setFormData({...formData, customer: c})} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelClass}>วันที่สั่งซื้อ</label><input type="date" className={inputClass} value={formData.order_date} onChange={e => setFormData({...formData, order_date: e.target.value})} /></div>
                <div><label className={labelClass}>เลขที่ใบกำกับภาษี</label><input type="text" className={inputClass} placeholder="INV-XXXX" value={formData.invoice_number || ''} onChange={e => setFormData({...formData, invoice_number: e.target.value})} /></div>
                <div>
                  <label className={labelClass}>สถานะ</label>
                  <select className={inputClass} value={formData.status} onChange={e => {
                      const status = e.target.value;
                      const completedAt = status === 'Completed' && !formData.completed_at ? getLocalDate() : formData.completed_at;
                      setFormData({...formData, status, completed_at: completedAt});
                    }}>
                    <option value="Quotation">เสนอราคา</option>
                    <option value="Deposit">มัดจำ</option>
                    <option value="Paid">ชำระแล้ว</option>
                    <option value="Assembling">ส่งประกอบ</option>
                    <option value="Shipping">เตรียมส่ง</option>
                    <option value="Completed">เสร็จสิ้น/เรียบร้อย</option>
                    <option value="Cancelled">ยกเลิก</option>
                  </select>
                </div>
              </div>
              {formData.status === 'Completed' && (
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="font-bold text-green-700 text-sm whitespace-nowrap">วันที่เสร็จสิ้น:</div>
                  <input type="date" className="w-full px-4 py-2 bg-white border border-green-200 rounded-lg text-sm text-green-800 focus:outline-none focus:ring-2 focus:ring-green-500/50" value={formData.completed_at} onChange={e => setFormData({...formData, completed_at: e.target.value})} required/>
                </div>
              )}
              
              <div>
                 <label className={labelClass}>ผู้รับผิดชอบ (Team)</label>
                 <OrderTeamSelector assignees={formData.assignees} onChange={a => setFormData({...formData, assignees: a})} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="showTax" className="w-4 h-4 accent-indigo-600 rounded" checked={formData.show_tax_id} onChange={e => setFormData({...formData, show_tax_id: e.target.checked})}/>
                <label htmlFor="showTax" className="text-sm font-medium text-gray-700 cursor-pointer">แสดงเลขผู้เสียภาษีลูกค้าในบิล</label>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[300px]">
              <h3 className="font-bold text-gray-800 mb-4 text-lg">รายการสินค้า</h3>
              <ProductSelector onAddProduct={handleAddItem} />
              <div className="mt-4 space-y-3">
                {formData.items.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border transition-all ${item.is_custom ? 'bg-indigo-50/30 border-indigo-200' : 'bg-gray-50 border-gray-100'} group`}>
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                      <div className="flex-1 w-full">
                        {item.is_custom ? (
                          <div className="flex items-center gap-2">
                            <PackagePlus size={20} className="text-indigo-500 shrink-0" />
                            <input className="bg-white border border-indigo-200 rounded-lg px-3 py-2 w-full text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="ระบุชื่อรายการ..." value={item.product_name} onChange={(e) => updateItem(idx, 'product_name', e.target.value)} autoFocus={item.shouldFocus}/>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-800 text-base">{item.product_name}</p>
                                <button 
                                    type="button" 
                                    onClick={() => handleManualOpenSuggestion(item)} 
                                    className="text-pink-500 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 p-1.5 rounded-full transition-colors"
                                    title="เพิ่มชุดแต่ง"
                                >
                                    <Sparkles size={14}/>
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              {item.variant_name && <span className="bg-white px-2 py-0.5 rounded border">{item.variant_name}</span>}
                              {item.sku && <span className="font-mono text-[10px] bg-gray-100 px-1.5 rounded">{item.sku}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end bg-white/50 p-2 rounded-xl">
                        {item.is_custom && (
                          <div className="flex items-center gap-2 mr-2">
                             <div className="flex flex-col"><label className="text-[10px] text-gray-400 font-bold ml-1">ทุน</label><div className="relative w-20"><NumericInput className="w-full text-right bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm focus:border-amber-400 outline-none text-gray-600" value={item.cost_price} onChange={(val) => updateItem(idx, 'cost_price', val)} placeholder="0" onFocus={handleFocus} /></div></div>
                             <div className="flex flex-col"><label className="text-[10px] text-indigo-500 font-bold ml-1">ขาย</label><div className="relative w-24"><NumericInput className="w-full text-right bg-white border border-indigo-200 rounded-lg px-2 py-1 text-sm font-bold text-indigo-700 focus:border-indigo-500 outline-none" value={item.sell_price} onChange={(val) => updateItem(idx, 'sell_price', val)} placeholder="0" onFocus={handleFocus} /></div></div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-2 py-1 h-[38px]">
                          <span className="text-xs text-gray-400 font-bold">Qty</span>
                          <input type="number" min="1" className="w-10 text-center text-sm font-bold outline-none" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} onFocus={handleFocus}/>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <p className="text-sm font-bold text-gray-900">฿{(item.sell_price * item.quantity).toLocaleString()}</p>
                          {item.is_custom && <p className={`text-[10px] ${(item.sell_price - item.cost_price) > 0 ? 'text-green-600' : 'text-red-400'}`}>กำไร: {((item.sell_price - item.cost_price) * item.quantity).toLocaleString()}</p>}
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-white transition-colors"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  </div>
                ))}
                {formData.items.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl"><Receipt size={40} className="mb-2 opacity-20"/><p>ยังไม่มีรายการสินค้า</p></div>}
              </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2">
               <History size={20} className="text-indigo-500"/> อัปเดตความคืบหน้า (Job Timeline)
             </h3>
             <OrderUpdateManager updates={formData.updates} onChange={u => setFormData({...formData, updates: u})} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 text-lg">สรุปยอดเงิน</h3>
            <div className="space-y-3 text-sm">
               <div className="flex justify-between text-gray-600"><span>รวมสินค้า</span><span>{subtotal.toLocaleString()}</span></div>
               <div className="flex justify-between items-center"><span className="text-gray-600">ส่วนลด</span><div className="w-24"><NumericInput className="w-full text-right border border-gray-200 rounded-lg px-2 py-1 focus:border-indigo-500 outline-none" placeholder="0" value={formData.discount} onChange={val => setFormData({...formData, discount: val})} onFocus={handleFocus} /></div></div>
               <div className="flex justify-between items-center"><span className="text-gray-600 flex items-center gap-1"><Truck size={14}/> ค่าขนส่ง</span><div className="w-24"><NumericInput className="w-full text-right border border-gray-200 rounded-lg px-2 py-1 focus:border-indigo-500 outline-none" placeholder="0" value={formData.shipping_cost} onChange={val => setFormData({...formData, shipping_cost: val})} onFocus={handleFocus} /></div></div>
               <div className="flex justify-between items-center pt-2">
                <span className="text-gray-600">VAT 7%</span>
                <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-gray-50 outline-none" value={formData.vat_type} onChange={e => setFormData({...formData, vat_type: e.target.value})}>
                  <option value="no_vat">ไม่คิด</option>
                  <option value="exclude">คิดแยก (Exclude)</option>
                  <option value="include">รวมในยอด (Include)</option>
                </select>
               </div>
               {formData.vat_type !== 'no_vat' && <div className="flex justify-between text-gray-500 text-xs"><span>ยอด VAT</span><span>{vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>}
               <div className="pt-4 border-t border-dashed border-gray-200 mt-2">
                 <div className="flex justify-between items-end mb-2"><span className="text-gray-900 font-bold">ยอดสุทธิ</span><span className="text-2xl font-extrabold text-indigo-600">฿{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                 <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                    <Calculator size={16} className="text-indigo-400"/>
                    <span className="text-xs text-indigo-700 whitespace-nowrap">ยอดที่ต้องการขาย:</span>
                    <NumericInput className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-right text-sm font-bold text-indigo-700 focus:outline-none" placeholder="กรอกยอดสุทธิ..." value={grandTotal} onChange={handleTargetPriceChange} onFocus={handleFocus}/>
                 </div>
               </div>
            </div>
          </div>

          {formData.status !== 'Quotation' && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="font-bold text-gray-800 mb-4">การชำระเงิน</h3>
              <PaymentManager payments={formData.payments} onChange={p => setFormData({...formData, payments: p})} grandTotal={grandTotal} />
            </div>
          )}

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">รูปภาพอ้างอิง</h3>
            <ImageUploader images={formData.images} onChange={imgs => setFormData({...formData, images: imgs})} />
          </div>
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-2">หมายเหตุ</h3>
            <textarea className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl p-3 text-sm transition-all outline-none" rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="บันทึกเพิ่มเติม..." />
          </div>
        </div>
      </div>

      {showPreview && <BillPreview order={previewOrderData} onClose={() => setShowPreview(false)} />}
      
      {/* Suggestion Modal */}
      {suggestionProduct && (
          <AccessorySuggestionModal 
              mainProduct={suggestionProduct} 
              onClose={() => setSuggestionProduct(null)} 
              onAdd={handleAddAccessories}
              existingItems={formData.items} // FIX: ส่ง existingItems ไปด้วย
          />
      )}
    </form>
    </>
  );
};
export default OrderForm;