import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, Info, Wrench, Calendar, Clock, User, FileText, CheckCircle, Printer, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import CustomerSelector from '../orders/CustomerSelector';
import ImageUploader from '../orders/ImageUploader';
import PaymentManager from '../orders/PaymentManager';
import ServiceTeamSelector from './ServiceTeamSelector'; // นำเข้า Component เลือกทีมงาน
import ServiceItemManager from './ServiceItemManager';
import NumericInput from '../products/NumericInput';
import ServiceBillPreview from './ServiceBillPreview';
import ServiceUpdateManager from './ServiceUpdateManager';
import { allocateFifoStockOut } from '@/lib/stockLots';

const ServiceForm = ({ onCancel, onSuccess, initialData }) => {
  const { profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deductStock, setDeductStock] = useState(true);
  
  const getLocalDate = () => new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState(initialData ? {
    ...initialData,
    customer: initialData.customer_cache || null,
    assignees: initialData.service_assignees || [], // โหลดข้อมูลทีมงานเดิม
    items: initialData.service_items || [],
    payments: (initialData.service_payments || []).map(p => ({
        ...p,
        date: p.payment_date ? p.payment_date.split('T')[0] : (p.date || getLocalDate()),
        method: p.method || 'Transfer',
        fee_amount: p.fee_amount || 0
    })),
    updates: (initialData.service_updates || []).map(u => ({
        ...u,
        images: (u.images || []).map(url => ({ url, file: null }))
    })),
    images: (initialData.images || []).map(url => ({ url, file: null })),
    appointment_date: initialData.appointment_date ? initialData.appointment_date.split('T')[0] : '',
    received_date: initialData.received_date ? initialData.received_date.split('T')[0] : getLocalDate(),
    completed_date: initialData.completed_date ? initialData.completed_date.split('T')[0] : '',
    
    status: initialData.status || 'Waiting', 
    waiting_reason: initialData.waiting_reason || 'รอคิว'
  } : {
    service_number: `SRV-${new Date().getFullYear().toString().substr(-2)}${(new Date().getMonth()+1).toString().padStart(2,0)}-${Math.floor(1000 + Math.random() * 9000)}`,
    received_date: getLocalDate(),
    appointment_date: '',
    completed_date: '',
    status: 'Waiting',
    waiting_reason: 'รอคิว',
    customer: null,
    assignees: [], // เริ่มต้นเป็นว่าง
    items: [],
    payments: [],
    updates: [],
    images: [],
    shipping_cost: 0,
    discount: 0,
    vat_type: 'no_vat',
    service_fee: 0,
    notes: ''
  });
  
  const [customWaitingReason, setCustomWaitingReason] = useState(
    (formData.status === 'Waiting' && !['รออะไหล่', 'รอคิว'].includes(formData.waiting_reason)) 
    ? formData.waiting_reason 
    : ''
  );

  const itemsTotal = formData.items.reduce((sum, item) => sum + (item.sell_price * item.quantity), 0);
  const subtotal = itemsTotal + parseFloat(formData.service_fee || 0);
  const discountVal = parseFloat(formData.discount) || 0;
  const shippingVal = parseFloat(formData.shipping_cost) || 0;
  const taxable = Math.max(0, subtotal - discountVal);
  
  let vatAmt = 0;
  let grandTotal = taxable + shippingVal;

  if (formData.vat_type === 'exclude') {
    vatAmt = taxable * 0.07;
    grandTotal += vatAmt;
  } else if (formData.vat_type === 'include') {
    vatAmt = taxable * 7 / 107;
  }

  const previewServiceData = {
    ...formData,
    customer_cache: formData.customer,
    service_items: formData.items,
    service_assignees: formData.assignees,
    service_payments: formData.payments,
    subtotal,
    vat_amount: vatAmt,
    grand_total: grandTotal
  };

  const handleStatusChange = (e) => {
    const status = e.target.value;
    let completedDate = formData.completed_date;
    if (status === 'Completed' && !completedDate) {
        completedDate = getLocalDate();
    }
    setFormData({...formData, status, completed_date: completedDate});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer) return alert('กรุณาระบุข้อมูลลูกค้า');
    
    setLoading(true);
    try {
      const uploadedImages = await Promise.all(formData.images.map(async (img) => {
        if (img.file) {
          const fileName = `srv-${Date.now()}-${Math.random()}`;
          await supabase.storage.from('services').upload(fileName, img.file);
          const { data } = supabase.storage.from('services').getPublicUrl(fileName);
          return data.publicUrl;
        }
        return img.url;
      }));

      const processedUpdates = await Promise.all(formData.updates.map(async (upd) => {
          const updateImgs = await Promise.all(upd.images.map(async (img) => {
             if (img.file) {
                const fileName = `srv-upd-${Date.now()}-${Math.random()}`;
                await supabase.storage.from('services').upload(fileName, img.file);
                const { data } = supabase.storage.from('services').getPublicUrl(fileName);
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

      let finalWaitingReason = null;
      if (formData.status === 'Waiting') {
         finalWaitingReason = formData.waiting_reason === 'อื่นๆ' ? customWaitingReason : formData.waiting_reason;
      }

      const payload = {
        service_number: formData.service_number,
        customer_id: formData.customer.id,
        customer_cache: formData.customer,
        status: formData.status,
        waiting_reason: finalWaitingReason,
        received_date: formData.received_date,
        appointment_date: formData.appointment_date || null,
        completed_date: formData.status === 'Completed' ? formData.completed_date : null,
        subtotal,
        service_fee: formData.service_fee,
        shipping_cost: shippingVal,
        discount: discountVal,
        vat_type: formData.vat_type,
        vat_amount: vatAmt,
        grand_total: grandTotal,
        notes: formData.notes,
        images: uploadedImages
      };

      let serviceId = initialData?.id;

      if (serviceId) {
        const { error } = await supabase.from('services').update({ ...payload, updated_by: meRef() }).eq('id', serviceId);
        if (error) throw error;
        
        await supabase.from('service_items').delete().eq('service_id', serviceId);
        await supabase.from('service_assignees').delete().eq('service_id', serviceId);
        await supabase.from('service_payments').delete().eq('service_id', serviceId);
        await supabase.from('service_updates').delete().eq('service_id', serviceId);
      } else {
        const { data, error } = await supabase.from('services').insert([{ ...payload, created_by: meRef() }]).select().single();
        if (error) throw error;
        serviceId = data.id;
      }

      const serviceItemsPayload = formData.items.map(i => ({
          service_id: serviceId,
          description: i.description,
          type: i.type,
          cost_price: i.cost_price,
          sell_price: i.sell_price,
          quantity: i.quantity,
          sub_items: i.sub_items
        }));

      // ตัดสต๊อกอัตโนมัติ (เฉพาะงานใหม่ที่มี product_id)
      const stockShortages = [];
      if (deductStock && !initialData?.id) {
        for (const [idx, item] of formData.items.entries()) {
          if (!item.product_id) continue;
          const { data: txRow, error: txError } = await supabase.from('stock_transactions').insert([{
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            transaction_type: 'stock_out',
            quantity: item.quantity || 1,
            note: `งานซ่อม ${formData.service_number}`,
            reference_type: 'service',
            reference_id: serviceId,
            created_by: meRef()?.id || profile?.id,
          }]).select('id').single();
          if (txError) throw txError;
          const lotResult = await allocateFifoStockOut({
            productId: item.product_id,
            variantId: item.variant_id || null,
            quantity: item.quantity || 1,
            referenceType: 'service',
            referenceId: serviceId,
            stockTransactionId: txRow?.id,
            profileId: meRef()?.id || profile?.id,
            syncSummary: true,
          });
          await supabase.from('stock_transactions').update({
            unit_cost_thb: lotResult.weightedUnitCost,
            total_cost_thb: lotResult.totalCost,
          }).eq('id', txRow.id);
          if (lotResult.missingQty > 0) stockShortages.push(lotResult.missingQty);
          serviceItemsPayload[idx].cost_price = lotResult.weightedUnitCost;
        }
        if (stockShortages.length > 0) {
          alert(`⚠️ มี ${stockShortages.length} รายการที่สต๊อกไม่พอ — ระบบตัดเท่าที่มีและบันทึกงานแล้ว โปรดตรวจสอบสต๊อก`);
        }
      }

      if (serviceItemsPayload.length > 0) {
        await supabase.from('service_items').insert(serviceItemsPayload);
      }

      if (processedUpdates.length > 0) {
          await supabase.from('service_updates').insert(processedUpdates.map(u => ({
              service_id: serviceId,
              description: u.description,
              update_date: u.update_date,
              images: u.images
          })));
      }

      // บันทึก Assignees
      if (formData.assignees.length > 0) {
        await supabase.from('service_assignees').insert(formData.assignees.map(a => ({
          service_id: serviceId,
          user_id: a.user_id,
          job_role: a.job_role
        })));
      }

      if (formData.payments.length > 0) {
        await supabase.from('service_payments').insert(formData.payments.map(p => ({
          service_id: serviceId,
          amount: p.amount,
          payment_date: p.date,
          type: p.type,
          method: p.method,
          fee_amount: p.fee_amount
        })));
      }

      const logFields = (d, total) => ({
        service_number: d?.service_number, status: d?.status,
        customer_name: d?.customer ? `${d.customer.first_name || ''} ${d.customer.last_name || ''}`.trim() : (d?.customer_cache ? `${d.customer_cache.first_name || ''} ${d.customer_cache.last_name || ''}`.trim() : null),
        grand_total: total ?? d?.grand_total,
        received_date: d?.received_date, notes: d?.notes,
      });
      await logAction({
        resource_type: 'service',
        resource_id: serviceId,
        action: initialData?.id ? 'update' : 'create',
        resource_label: formData.service_number,
        old_data: initialData?.id ? logFields(initialData, initialData.grand_total) : null,
        new_data: logFields(formData, grandTotal),
        created_by: meRef(),
      });

      onSuccess();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all outline-none text-gray-700 font-medium";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1";
  const handleFocus = (e) => e.target.select();

  return (
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto pb-20 animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{initialData ? 'แก้ไขใบงานซ่อม' : 'เปิดใบงานซ่อมใหม่'}</h1>
            <p className="text-xs text-gray-500 font-mono">{formData.service_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
                type="button" 
                onClick={() => setShowPreview(true)}
                className="bg-white text-indigo-700 border border-indigo-100 hover:bg-indigo-50 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all"
            >
                <Printer size={18} /> พรีวิวใบงาน
            </button>
            <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg flex gap-2">
                {loading ? <Loader2 className="animate-spin"/> : <Save size={18} />} บันทึก
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
            <h3 className="font-bold text-gray-800 text-lg border-b border-gray-50 pb-3 flex items-center gap-2">
              <User size={20} className="text-indigo-500"/> ข้อมูลลูกค้า & วันที่
            </h3>
            
            <CustomerSelector selectedCustomer={formData.customer} onSelect={c => setFormData({...formData, customer: c})} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div><label className={labelClass}>วันที่รับรถ</label><input type="date" className={inputClass} value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} /></div>
               <div><label className={labelClass}>วันนัดส่งคืน (Optional)</label><input type="date" className={inputClass} value={formData.appointment_date} onChange={e => setFormData({...formData, appointment_date: e.target.value})} /></div>
               <div>
                 <label className={labelClass}>สถานะงาน</label>
                 <select className={inputClass} value={formData.status} onChange={handleStatusChange}>
                   <option value="Waiting">รอทำ</option>
                   <option value="In Progress">ส่งทำ</option>
                   <option value="Tested">ทดสอบแล้ว</option>
                   <option value="Delivered">รอส่ง</option>
                   <option value="Completed">เรียบร้อย</option>
                   <option value="Cancelled">ยกเลิก</option>
                 </select>
               </div>
            </div>

            {formData.status === 'Waiting' && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 animate-in fade-in slide-in-from-top-2">
                    <label className={`${labelClass} text-amber-800 mb-2`}>สาเหตุการรอ (Waiting Reason)</label>
                    <div className="flex flex-wrap gap-3">
                        {['รออะไหล่', 'รอคิว', 'อื่นๆ'].map(reason => (
                            <label key={reason} className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-amber-200 text-sm text-gray-700 hover:bg-amber-50 transition-colors">
                                <input 
                                    type="radio" 
                                    name="waiting_reason"
                                    className="accent-amber-600"
                                    checked={formData.waiting_reason === reason || (reason === 'อื่นๆ' && !['รออะไหล่', 'รอคิว'].includes(formData.waiting_reason))}
                                    onChange={() => setFormData({...formData, waiting_reason: reason === 'อื่นๆ' ? customWaitingReason : reason})}
                                />
                                {reason}
                            </label>
                        ))}
                    </div>
                    {(!['รออะไหล่', 'รอคิว'].includes(formData.waiting_reason)) && (
                        <input 
                            className="mt-3 w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            placeholder="ระบุสาเหตุอื่นๆ..."
                            value={customWaitingReason}
                            onChange={e => {
                                setCustomWaitingReason(e.target.value);
                                setFormData({...formData, waiting_reason: e.target.value});
                            }}
                        />
                    )}
                </div>
            )}

            {formData.status === 'Completed' && (
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="font-bold text-green-700 text-sm whitespace-nowrap">วันที่เสร็จสิ้น:</div>
                <input type="date" className="w-full px-4 py-2 bg-white border border-green-200 rounded-lg text-sm text-green-800 focus:outline-none focus:ring-2 focus:ring-green-500/50" value={formData.completed_date} onChange={e => setFormData({...formData, completed_date: e.target.value})} required/>
              </div>
            )}

            {/* ส่วนเลือกทีมงานผู้รับผิดชอบ (RESTORED) */}
            <div>
              <label className={labelClass}>ทีมงานผู้รับผิดชอบ</label>
              <ServiceTeamSelector assignees={formData.assignees} onChange={a => setFormData({...formData, assignees: a})} />
            </div>
            
            <div className="flex items-center gap-2 pt-2 border-t border-gray-50 mt-2">
              <input type="checkbox" id="showTax" className="w-4 h-4 accent-indigo-600 rounded" checked={formData.show_tax_id} onChange={e => setFormData({...formData, show_tax_id: e.target.checked})}/>
              <label htmlFor="showTax" className="text-sm font-medium text-gray-700 cursor-pointer">แสดงเลขผู้เสียภาษีลูกค้าในบิล</label>
            </div>
            {!initialData?.id && (
              <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-xl border border-teal-100">
                <div className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors ${deductStock ? 'bg-teal-500' : 'bg-gray-300'}`} onClick={() => setDeductStock(v => !v)}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${deductStock ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <label className="text-sm font-medium text-teal-800 cursor-pointer" onClick={() => setDeductStock(v => !v)}>
                  ตัดสต๊อกอัตโนมัติเมื่อบันทึก
                </label>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[300px]">
             <h3 className="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2"><Wrench size={20} className="text-indigo-500"/> รายการซ่อม / อะไหล่</h3>
             <ServiceItemManager items={formData.items} onChange={i => setFormData({...formData, items: i})} />
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2"><History size={20} className="text-indigo-500"/> อัปเดตความคืบหน้า (Job Timeline)</h3>
             <ServiceUpdateManager updates={formData.updates} onChange={u => setFormData({...formData, updates: u})} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 text-lg">สรุปค่าใช้จ่าย</h3>
            <div className="space-y-3 text-sm">
               <div className="flex justify-between text-gray-600"><span>รวมค่าแรง/อะไหล่</span><span>{itemsTotal.toLocaleString()}</span></div>
               <div className="flex justify-between items-center"><span className="text-gray-600">ค่าบริการเพิ่มเติม</span><NumericInput className="w-24 text-right border rounded px-2 py-1 focus:border-indigo-500 outline-none" value={formData.service_fee} onChange={v => setFormData({...formData, service_fee: v})} placeholder="0" onFocus={handleFocus}/></div>
               <div className="flex justify-between items-center"><span className="text-gray-600">ค่าขนส่ง</span><NumericInput className="w-24 text-right border rounded px-2 py-1 focus:border-indigo-500 outline-none" value={formData.shipping_cost} onChange={v => setFormData({...formData, shipping_cost: v})} placeholder="0" onFocus={handleFocus}/></div>
               <div className="flex justify-between items-center"><span className="text-gray-600">ส่วนลด</span><NumericInput className="w-24 text-right border rounded px-2 py-1 text-red-500 focus:border-red-500 outline-none" value={formData.discount} onChange={v => setFormData({...formData, discount: v})} placeholder="0" onFocus={handleFocus}/></div>
               <div className="flex justify-between items-center pt-2">
                <span className="text-gray-600">VAT 7%</span>
                <select className="border border-gray-200 rounded px-1 py-1 text-xs bg-gray-50 outline-none" value={formData.vat_type} onChange={e => setFormData({...formData, vat_type: e.target.value})}>
                  <option value="no_vat">ไม่คิด</option>
                  <option value="exclude">คิดแยก (Exclude)</option>
                  <option value="include">รวมในยอด (Include)</option>
                </select>
               </div>
               {formData.vat_type !== 'no_vat' && <div className="flex justify-between text-gray-500 text-xs"><span>ยอด VAT</span><span>{vatAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>}
               <div className="pt-4 border-t border-dashed border-gray-200 flex justify-between items-end mt-2">
                 <span className="text-gray-900 font-bold">ยอดสุทธิ</span>
                 <span className="text-2xl font-extrabold text-indigo-600">฿{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
               </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="font-bold text-gray-800 mb-4">การชำระเงิน</h3>
              <PaymentManager payments={formData.payments} onChange={p => setFormData({...formData, payments: p})} grandTotal={grandTotal} />
          </div>

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

      {showPreview && <ServiceBillPreview service={previewServiceData} onClose={() => setShowPreview(false)} />}
    </form>
  );
};
export default ServiceForm;
