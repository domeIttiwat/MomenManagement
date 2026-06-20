import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Edit, Trash2, Printer, FileText, User, Package, Clock, MapPin, Phone, CreditCard, DollarSign, X, Eye, EyeOff, Banknote, Landmark, MessageCircle, Facebook, Instagram, History, Calendar, Send, Paperclip, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import BillPreview from './BillPreview';
import ImageUploader from './ImageUploader';
import AuditLogPanel from '@/app/components/common/AuditLogPanel';
import OrderPrep from './OrderPrep';

const OrderDetail = ({ order, onBack, onEdit, onDelete, showProfit, setShowProfit, onViewCustomer }) => {
  const { can } = useAuth();
  const [showBill, setShowBill] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  
  // Timeline State (Code Timeline เดิม...)
  const [updates, setUpdates] = useState(order?.order_updates || []);
  const [newUpdate, setNewUpdate] = useState({ description: '', date: new Date().toISOString().split('T')[0], images: [] });
  const [isPosting, setIsPosting] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState(null);
  const [editData, setEditData] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (order?.id) fetchUpdates();
  }, [order?.id]);

  const fetchUpdates = async () => {
    const { data } = await supabase.from('order_updates').select('*').eq('order_id', order.id).order('created_at', { ascending: true });
    if (data) setUpdates(data);
  };
  
  // (ฟังก์ชัน handleFileSelect, removeNewImage, handlePostUpdate, ฯลฯ เหมือนเดิม)
  // ... (เพื่อความกระชับ ขอละไว้ ใส่ตามเดิมได้เลยครับ)
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        const newImages = files.map(file => ({
            url: URL.createObjectURL(file),
            file
        }));
        if (editingUpdateId) {
             setEditData(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
        } else {
             setNewUpdate(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
        }
    }
  };

  const removeNewImage = (idx, isEdit = false) => {
      if (isEdit) {
          setEditData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
      } else {
          setNewUpdate(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
      }
  };

  const handlePostUpdate = async () => {
    if (!newUpdate.description.trim() && newUpdate.images.length === 0) return;
    setIsPosting(true);
    try {
      const uploadedImages = await Promise.all(newUpdate.images.map(async (imgObj) => {
        if (imgObj.file) {
          const fileName = `upd-${Date.now()}-${Math.random()}`;
          await supabase.storage.from('orders').upload(fileName, imgObj.file);
          const { data } = supabase.storage.from('orders').getPublicUrl(fileName);
          return data.publicUrl;
        }
        return imgObj.url;
      }));

      await supabase.from('order_updates').insert([{
        order_id: order.id,
        description: newUpdate.description,
        update_date: newUpdate.date,
        images: uploadedImages
      }]);

      setNewUpdate({ description: '', date: new Date().toISOString().split('T')[0], images: [] });
      fetchUpdates();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteUpdate = async (id) => {
    if (!confirm('ลบรายการนี้?')) return;
    await supabase.from('order_updates').delete().eq('id', id);
    fetchUpdates();
  };

  const startEditUpdate = (update) => {
    setEditingUpdateId(update.id);
    setEditData({ 
        description: update.description, 
        date: update.update_date.split('T')[0],
        images: (update.images || []).map(url => ({ url, file: null }))
    });
  };

  const saveEditUpdate = async (id) => {
     try {
        const uploadedImages = await Promise.all(editData.images.map(async (imgObj) => {
            if (imgObj.file) {
            const fileName = `upd-${Date.now()}-${Math.random()}`;
            await supabase.storage.from('orders').upload(fileName, imgObj.file);
            const { data } = supabase.storage.from('orders').getPublicUrl(fileName);
            return data.publicUrl;
            }
            return imgObj.url;
        }));

        await supabase.from('order_updates').update({
            description: editData.description,
            update_date: editData.date,
            images: uploadedImages
        }).eq('id', id);

        setEditingUpdateId(null);
        fetchUpdates();
     } catch(err) {
         alert('Error updating: ' + err.message);
     }
  };


  if (!order) return null;

  const totalCost = order.order_items?.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0) || 0;
  const totalProfit = (order.subtotal - order.discount) - totalCost;

  const statusColors = {
    Quotation: 'bg-gray-100 text-gray-700 border-gray-200',
    Deposit: 'bg-amber-50 text-amber-700 border-amber-200',
    Paid: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Assembling: 'bg-blue-50 text-blue-700 border-blue-200',
    Shipping: 'bg-purple-50 text-purple-700 border-purple-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelled: 'bg-red-50 text-red-700 border-red-200'
  };

  const getDurationInfo = () => {
    const start = new Date(order.order_date);
    const end = order.status === 'Completed' && order.completed_at ? new Date(order.completed_at) : new Date(); 
    start.setHours(0,0,0,0); end.setHours(0,0,0,0);
    let diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) diffTime = 0;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = (diffDays % 365) % 30;
    const parts = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    if (days > 0) parts.push(`${days} วัน`); 
    return { text: parts.join(' '), totalDays: diffDays };
  };

  const { text: durationText, totalDays } = getDurationInfo();

  const getDurationColorClass = (days) => {
    if (order.status === 'Completed') return 'bg-gray-100 text-gray-500 border-gray-200';
    if (days <= 30) return 'bg-green-100 text-green-700 border-green-200';
    if (days <= 60) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (days <= 90) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getPaymentIcon = (method) => {
    switch(method) {
      case 'Cash': return <Banknote size={14} className="text-green-600"/>;
      case 'CreditCard': return <CreditCard size={14} className="text-purple-600"/>;
      default: return <Landmark size={14} className="text-blue-600"/>;
    }
  };

  const getPaymentLabel = (method) => {
    switch(method) {
      case 'Cash': return 'เงินสด';
      case 'CreditCard': return 'บัตรเครดิต';
      default: return 'โอนเงิน';
    }
  };

  const getSocialIcon = (type) => {
    switch(type) {
        case 'Facebook': return <Facebook size={14} className="text-blue-600"/>;
        case 'Line': return <MessageCircle size={14} className="text-green-500"/>;
        case 'Instagram': return <Instagram size={14} className="text-pink-500"/>;
        case 'WhatsApp': return <Phone size={14} className="text-green-600"/>;
        default: return null;
    }
  };

  const social = order.customer_cache?.social_channels?.[0];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10 animate-in slide-in-from-right-4 fade-in duration-300">
      
      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500 bg-white/10 hover:bg-white/20 rounded-full p-2 backdrop-blur-sm transition-all"><X size={24}/></button>
        </div>
      )}

      {/* Sticky Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100 sticky top-2 z-20">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium px-3 py-2 rounded-xl hover:bg-gray-100 transition-all">
          <ArrowLeft size={20} /> <span className="hidden sm:inline">ย้อนกลับ</span>
        </button>
        <div className="flex flex-wrap gap-2">
          {can('orders', 'show_profit') && (
            <button onClick={() => setShowProfit(!showProfit)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all text-sm border ${showProfit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-500 border-gray-200'}`}>
              {showProfit ? <Eye size={18}/> : <EyeOff size={18}/>} {showProfit ? 'ซ่อนกำไร' : 'แสดงกำไร'}
            </button>
          )}
          <button onClick={() => setShowBill(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 rounded-xl font-semibold transition-all text-sm shadow-sm">
            <Printer size={18}/> พิมพ์/ดูเอกสาร
          </button>
          {can('orders', 'edit') && (
            <button onClick={onEdit} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black font-medium text-sm shadow-lg shadow-gray-200 transition-all active:scale-95">
              <Edit size={18}/> แก้ไข
            </button>
          )}
          {can('orders', 'delete') && (
            <button onClick={onDelete} className="flex items-center gap-2 px-3 py-2.5 bg-white text-red-500 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-100 font-medium text-sm transition-all active:scale-95">
              <Trash2 size={18}/>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform group-hover:scale-110 transition-transform duration-700 pointer-events-none"><FileText size={200} /></div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 relative z-10 gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded-md border border-gray-200">Order No.</span>
                  <span className={`px-3 py-1 rounded-full font-bold text-xs border ${statusColors[order.status] || 'bg-gray-100'}`}>
                    {order.status}
                  </span>
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{order.order_number}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="flex items-center gap-2 text-gray-500 font-medium">
                    <Clock size={16}/> 
                    {new Date(order.order_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded border flex items-center gap-1 font-bold ${getDurationColorClass(totalDays)}`}>
                    {order.status === 'Completed' ? `เสร็จใน ${durationText}` : `รอ ${durationText}`}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-left md:text-right bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">ยอดสุทธิ</p>
                  <p className="text-3xl font-black text-indigo-600 tracking-tight">฿{order.grand_total?.toLocaleString()}</p>
                </div>
                {showProfit && (
                  <div className="text-left md:text-right bg-emerald-50 p-3 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs text-emerald-600 font-bold mb-0.5">กำไรสุทธิ</p>
                    <p className="text-xl font-black text-emerald-700 tracking-tight">+฿{totalProfit.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100 relative z-10">
              <div className="flex gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors" onClick={() => onViewCustomer && onViewCustomer(order.customer_id)}>
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-1">ลูกค้า</h3>
                  <p className="font-bold text-gray-800 text-lg">
                    {order.customer_cache?.first_name} {order.customer_cache?.last_name} 
                    <span className="text-sm font-normal text-gray-500 ml-2">({order.customer_cache?.nickname || '-'})</span>
                  </p>
                  <div className="flex items-start gap-2 text-sm text-gray-600 mt-1">
                    <Phone size={14} className="mt-1 shrink-0"/> {order.customer_cache?.phone}
                  </div>
                  {social && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                       {getSocialIcon(social.type)} {social.value}
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-sm text-gray-600 mt-1">
                    <MapPin size={14} className="mt-1 shrink-0"/> {order.customer_cache?.address_raw || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex items-center gap-2">
              <Package size={20} className="text-indigo-500"/>
              <h3 className="font-bold text-gray-800">รายการสินค้า ({order.order_items?.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white border-b border-gray-50 text-gray-400 uppercase text-xs tracking-wider text-left">
                    <th className="py-4 px-8 font-semibold w-1/3">รายการ</th>
                    <th className="py-4 px-6 font-semibold text-center">จำนวน</th>
                    <th className="py-4 px-6 font-semibold text-right">ราคา/หน่วย</th>
                    {showProfit && <th className="py-4 px-6 font-semibold text-right text-emerald-600 bg-emerald-50/30">กำไร/หน่วย</th>}
                    <th className="py-4 px-8 font-semibold text-right">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {order.order_items?.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-8">
                        <p className="font-bold text-gray-900 text-base">{item.product_name}</p>
                        {item.variant_name && <p className="text-xs text-gray-500 bg-gray-100 inline-block px-2 py-0.5 rounded mt-1">{item.variant_name}</p>}
                        {item.sku && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.sku}</p>}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg font-bold">{item.quantity}</span>
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-gray-600">฿{item.sell_price.toLocaleString()}</td>
                      {showProfit && (
                        <td className="py-4 px-6 text-right font-bold text-emerald-600 bg-emerald-50/30">
                          +{(item.sell_price - item.cost_price).toLocaleString()}
                        </td>
                      )}
                      <td className="py-4 px-8 text-right font-bold text-gray-900">฿{(item.sell_price * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-gray-50/30 p-8 border-t border-gray-100">
              <div className="flex flex-col gap-3 ml-auto max-w-sm">
                <div className="flex justify-between text-gray-600"><span>รวมเป็นเงิน</span><span className="font-medium">฿{order.subtotal?.toLocaleString()}</span></div>
                <div className="flex justify-between text-gray-600"><span>ค่าขนส่ง</span><span className="font-medium">฿{order.shipping_cost?.toLocaleString()}</span></div>
                {order.discount > 0 && <div className="flex justify-between text-red-500"><span>ส่วนลด</span><span className="font-medium">-฿{order.discount.toLocaleString()}</span></div>}
                {order.vat_type !== 'no_vat' && <div className="flex justify-between text-gray-500 text-xs"><span>VAT ({order.vat_type})</span><span>฿{order.vat_amount?.toLocaleString()}</span></div>}
                <div className="flex justify-between items-center border-t border-gray-200 pt-4 mt-2">
                  <span className="text-gray-900 font-bold text-lg">ยอดรวมสุทธิ</span>
                  <span className="text-2xl font-black text-indigo-600">฿{order.grand_total?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* การจัดเตรียมของ (BOM → checklist) */}
          <OrderPrep order={order} />

        </div>

        <div className="space-y-6">
           {/* Assignees (NEW) */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">ผู้รับผิดชอบ</h3>
              <div className="space-y-2">
                 {order.order_assignees?.map((a, i) => (
                   <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                        {a.user?.avatar_url ? (
                          <img src={a.user.avatar_url} alt={a.user.first_name} className="w-full h-full object-cover"/>
                        ) : (
                          <span className="text-xs font-bold text-gray-400">{a.user?.first_name?.[0]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.user?.first_name} {a.user?.last_name}</p>
                        <p className="text-xs text-indigo-500">{a.job_role}</p>
                      </div>
                   </div>
                 ))}
                 {(!order.order_assignees || order.order_assignees.length === 0) && <p className="text-gray-400 text-sm text-center">-</p>}
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-indigo-500"/> ประวัติการชำระเงิน</h3>
              <div className="space-y-3 relative">
                {order.order_payments && order.order_payments.length > 0 ? (
                  <>
                    <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-100"></div>
                    {order.order_payments.map((pay, i) => (
                      <div key={i} className="flex gap-4 relative z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm shrink-0 ${pay.type === 'deposit' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          <DollarSign size={16} />
                        </div>
                        <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold uppercase tracking-wider ${pay.type === 'deposit' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {pay.type === 'deposit' ? 'มัดจำ' : 'ชำระเงิน'}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                   {getPaymentIcon(pay.payment_method)}
                                   {getPaymentLabel(pay.payment_method)}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1">{new Date(pay.payment_date).toLocaleDateString('th-TH')}</p>
                            </div>
                            <span className="font-bold text-gray-900">฿{pay.amount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">ยังไม่มีรายการชำระเงิน</p>
                  </div>
                )}
              </div>
           </div>


          {/* Timeline Feed — Social Media Style */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center gap-2">
              <MessageCircle size={20} className="text-indigo-500"/>
              <h3 className="font-bold text-gray-800 text-lg">ความคืบหน้า</h3>
              {updates.length > 0 && (
                <span className="ml-auto text-xs font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full">{updates.length} รายการ</span>
              )}
            </div>

            {/* Comment Feed */}
            <div className="px-6 py-4 space-y-5 max-h-[520px] overflow-y-auto">
              {updates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <MessageCircle size={36} className="mb-3 opacity-20"/>
                  <p className="text-sm font-medium">ยังไม่มีการอัปเดต</p>
                  <p className="text-xs mt-1">เพิ่มความคืบหน้าด้านล่าง</p>
                </div>
              ) : updates.map((update) => (
                <div key={update.id} className="group flex gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                    <User size={16}/>
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingUpdateId === update.id ? (
                      /* Edit Mode */
                      <div className="bg-white border-2 border-indigo-400 rounded-2xl p-4 shadow-md">
                        <textarea
                          className="w-full text-sm outline-none resize-none text-gray-800 placeholder:text-gray-400 mb-3"
                          rows={3}
                          value={editData.description}
                          onChange={e => setEditData({...editData, description: e.target.value})}
                        />
                        {/* Edit image previews */}
                        {editData.images?.length > 0 && (
                          <div className="flex gap-2 mb-3 overflow-x-auto">
                            {editData.images.map((img, i) => (
                              <div key={i} className="relative w-16 h-16 shrink-0">
                                <img src={img.url} className="w-full h-full object-cover rounded-xl border"/>
                                <button onClick={() => removeNewImage(i, true)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow"><X size={10}/></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
                          <input type="date" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:border-indigo-400"/>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingUpdateId(null)} className="px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">ยกเลิก</button>
                            <button onClick={() => saveEditUpdate(update.id)} className="px-4 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">บันทึก</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-100 group-hover:border-gray-200 transition-colors">
                        {/* Meta row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700">อัปเดต</span>
                            <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-semibold">
                              {new Date(update.update_date).toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'numeric'})}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(update.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          {/* Action buttons — show on hover */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEditUpdate(update)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                            ><Edit size={13}/></button>
                            <button
                              onClick={() => handleDeleteUpdate(update.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                            ><Trash2 size={13}/></button>
                          </div>
                        </div>
                        {/* Content */}
                        {update.description && (
                          <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{update.description}</p>
                        )}
                        {/* Images */}
                        {update.images?.length > 0 && (
                          <div className="flex gap-2 flex-wrap mt-3">
                            {update.images.map((img, imgIdx) => (
                              <img
                                key={imgIdx}
                                src={img}
                                className="w-20 h-20 rounded-xl object-cover cursor-zoom-in hover:opacity-90 border border-gray-200 transition-opacity shadow-sm"
                                onClick={() => setLightboxImg(img)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Compose Box — bottom, social media style */}
            <div className="px-6 pb-6 pt-4 border-t border-gray-100 bg-gray-50/50">
              {/* Image Preview Row */}
              {newUpdate.images.length > 0 && (
                <div className="flex gap-2 mb-3 pl-12 overflow-x-auto">
                  {newUpdate.images.map((img, i) => (
                    <div key={i} className="relative w-16 h-16 shrink-0">
                      <img src={img.url} className="w-full h-full object-cover rounded-xl border border-gray-200 shadow-sm"/>
                      <button
                        onClick={() => removeNewImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow"
                      ><X size={10}/></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 items-end">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <User size={16}/>
                </div>

                {/* Input area */}
                <div className="flex-1 bg-white border border-gray-200 rounded-2xl focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all overflow-hidden">
                  <textarea
                    className="w-full px-4 pt-3 pb-1 text-sm outline-none resize-none text-gray-800 placeholder:text-gray-400 bg-transparent"
                    placeholder="บันทึกความคืบหน้า..."
                    rows={2}
                    value={newUpdate.description}
                    onChange={e => setNewUpdate({...newUpdate, description: e.target.value})}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePostUpdate(); }}
                  />
                  {/* Bottom toolbar */}
                  <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                    <div className="flex items-center gap-1">
                      {/* Date picker */}
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all font-medium">
                        <Calendar size={14}/>
                        <input
                          type="date"
                          className="w-0 opacity-0 absolute"
                          value={newUpdate.date}
                          onChange={e => setNewUpdate({...newUpdate, date: e.target.value})}
                        />
                        <span>{new Date(newUpdate.date + 'T00:00:00').toLocaleDateString('th-TH', {day:'numeric', month:'short'})}</span>
                      </label>
                      {/* Image attach */}
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all font-medium">
                        <ImageIcon size={14}/>
                        <span>รูปภาพ</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} ref={fileInputRef}/>
                      </label>
                    </div>
                    {/* Send button */}
                    <button
                      onClick={handlePostUpdate}
                      disabled={isPosting || (!newUpdate.description.trim() && newUpdate.images.length === 0)}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm shadow-indigo-200"
                    >
                      {isPosting ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}
                      โพสต์
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 pl-12">กด Ctrl+Enter เพื่อส่งด่วน</p>
            </div>
          </div>

      {/* Audit Log */}
      <AuditLogPanel resourceType="order" resourceId={order.id} title="ประวัติการเปลี่ยนแปลง" compact />
           {order.notes && (
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
              <h3 className="font-bold text-amber-800 mb-2 text-sm uppercase tracking-wider">หมายเหตุ</h3>
              <p className="text-amber-900 text-sm leading-relaxed">{order.notes}</p>
            </div>
          )}

          {order.images?.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText size={18} className="text-indigo-500"/> รูปภาพแนบ ({order.images.length})</h3>
              <div className="grid grid-cols-2 gap-3">
                {order.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setLightboxImg(img)}>
                    <img src={img} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showBill && <BillPreview order={order} onClose={() => setShowBill(false)} />}

      {/* Audit Footer */}
      {(order.created_by || order.updated_by) && (
        <div className="text-xs text-gray-400 text-center py-2 border-t border-gray-100 mt-4">
          {order.created_by && (
            <span>สร้างโดย <span className="font-medium text-gray-500">{order.created_by.name}</span> · {new Date(order.created_at).toLocaleDateString('th-TH')}</span>
          )}
          {order.created_by && order.updated_by && <span className="mx-2">|</span>}
          {order.updated_by && (
            <span>แก้ไขล่าสุดโดย <span className="font-medium text-gray-500">{order.updated_by.name}</span> · {new Date(order.updated_at).toLocaleDateString('th-TH')}</span>
          )}
        </div>
      )}

    </div>
  );
};

export default OrderDetail;