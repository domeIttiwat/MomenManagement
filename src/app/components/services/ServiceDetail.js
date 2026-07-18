import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Edit, Trash2, Printer, Wrench, User, Calendar, Clock, DollarSign, CreditCard, Banknote, Landmark, X, History, FileText, CheckCircle2, AlertCircle, Truck, PauseCircle, XCircle, PlayCircle, Send, Paperclip, Loader2, Image as ImageIcon, MessageCircle, Eye, EyeOff, TrendingUp, ClipboardList, ListChecks } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import ServiceBillPreview from './ServiceBillPreview';
import AuditLogPanel from '@/app/components/common/AuditLogPanel';
import ServicePrep from './ServicePrep';

// chip สถานะการเตรียมของ — ใช้โชว์บนอะไหล่แต่ละตัวในรายการซ่อม
const PREP_CHIP = {
  pending:     { label: 'ยังไม่เตรียม', cls: 'bg-gray-100 text-gray-500' },
  in_progress: { label: 'กำลังเตรียม',  cls: 'bg-amber-100 text-amber-700' },
  done:        { label: 'เตรียมแล้ว',   cls: 'bg-emerald-100 text-emerald-700' },
};

const ServiceDetail = ({ service, onBack, onEdit, onDelete, showProfit, setShowProfit }) => {
  const { can } = useAuth();
  const [showBill, setShowBill] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [prepItems, setPrepItems] = useState([]); // รายการจาก ServicePrep (sync ให้เอง)
  const [prepSignal, setPrepSignal] = useState(0); // กดปุ่มบนหัวข้อรายการซ่อม → สั่ง ServicePrep เริ่ม/เปิดป๊อปอัพ

  // map ชื่อรายการ → สถานะเตรียม (นับเฉพาะ leaf จริง)
  const prepStatusByTitle = React.useMemo(() => {
    const parents = new Set(prepItems.filter((x) => x.parent_item_id).map((x) => x.parent_item_id));
    const map = {};
    prepItems.forEach((x) => {
      const isLeaf = x.kind !== 'product' || !parents.has(x.id);
      if (isLeaf && x.title) map[x.title.trim()] = x.status;
    });
    return map;
  }, [prepItems]);
  const prepChip = (title) => {
    const st = prepStatusByTitle[(title || '').trim()];
    return st ? PREP_CHIP[st] : null;
  };

  // Timeline State
  const [updates, setUpdates] = useState(service?.service_updates || []);
  const [newUpdate, setNewUpdate] = useState({ description: '', date: new Date().toISOString().split('T')[0], images: [] });
  const [isPosting, setIsPosting] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState(null);
  const [editData, setEditData] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
     if (service?.id) fetchUpdates();
  }, [service?.id]);

  const fetchUpdates = async () => {
    const { data } = await supabase.from('service_updates').select('*').eq('service_id', service.id).order('created_at', { ascending: true });
    if (data) setUpdates(data);
  };

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
          const fileName = `srv-upd-${Date.now()}-${Math.random()}`;
          await supabase.storage.from('services').upload(fileName, imgObj.file);
          const { data } = supabase.storage.from('services').getPublicUrl(fileName);
          return data.publicUrl;
        }
        return imgObj.url;
      }));

      await supabase.from('service_updates').insert([{
        service_id: service.id,
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
    await supabase.from('service_updates').delete().eq('id', id);
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
                const fileName = `srv-upd-${Date.now()}-${Math.random()}`;
                await supabase.storage.from('services').upload(fileName, imgObj.file);
                const { data } = supabase.storage.from('services').getPublicUrl(fileName);
                return data.publicUrl;
            }
            return imgObj.url;
        }));

        await supabase.from('service_updates').update({
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

  if (!service) return <div className="p-10 text-center text-gray-500">ไม่พบข้อมูลงานซ่อม</div>;

  const getStatusDisplay = (status, reason) => {
    switch (status) {
      case 'Assessing': return { color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: ClipboardList, label: 'รอประเมิน' };
      case 'Waiting':
        if (reason === 'รอคิว') return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: PauseCircle, label: 'รอคิว' };
        if (reason === 'รออะไหล่') return { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle, label: 'รออะไหล่' };
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: reason ? `รอ: ${reason}` : 'รอทำ' };

      case 'In Progress': return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Wrench, label: 'ส่งทำ' };
      case 'Tested': return { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: PlayCircle, label: 'ทดสอบแล้ว' };
      case 'Delivered': return { color: 'bg-teal-100 text-teal-700 border-teal-200', icon: Truck, label: 'รอส่ง' };
      case 'Completed': return { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, label: 'เรียบร้อย' };
      case 'Cancelled': return { color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle, label: 'ยกเลิก' };
      default: return { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock, label: status };
    }
  };

  const statusInfo = getStatusDisplay(service.status, service.waiting_reason);

  const getDurationInfo = () => {
    if (!service.received_date) return { text: '-', totalDays: 0, isFinished: false };
    const start = new Date(service.received_date);
    const isFinished = ['Done', 'Tested', 'Completed', 'Delivered', 'Cancelled'].includes(service.status);
    const end = isFinished && service.completed_date ? new Date(service.completed_date) : new Date();
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
    if (parts.length === 0) parts.push('0 วัน');
    return { text: parts.join(' '), totalDays: diffDays, isFinished };
  };

  const { text: durationText, totalDays, isFinished } = getDurationInfo();

  const getDurationColorClass = (days, finished) => {
    if (finished) return 'bg-gray-100 text-gray-600 border-gray-200';
    if (days <= 7) return 'bg-green-100 text-green-700 border-green-200';
    if (days <= 30) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (days <= 60) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getPaymentStatus = () => {
    const totalPaid = service.service_payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const grandTotal = service.grand_total || 0;
    if (grandTotal === 0 && totalPaid === 0) return { label: '-', color: 'bg-gray-100 text-gray-500' };
    if (totalPaid === 0) return { label: 'ยังไม่ได้ชำระ', color: 'bg-red-100 text-red-700 border-red-200' };
    if (totalPaid >= grandTotal) return { label: 'ชำระครบแล้ว', color: 'bg-green-100 text-green-700 border-green-200' };
    const isOnlyDeposit = service.service_payments?.length > 0 && service.service_payments.every(p => p.type === 'deposit');
    if (isOnlyDeposit) return { label: 'มัดจำแล้ว', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'ชำระยังไม่ครบ', color: 'bg-orange-100 text-orange-700 border-orange-200' };
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

  const payStatus = getPaymentStatus();

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500 bg-white/10 hover:bg-white/20 rounded-full p-2 backdrop-blur-sm transition-all"><X size={24}/></button>
        </div>
      )}

      {/* Navbar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 sticky top-2 z-20">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft size={20}/> กลับหน้ารายการ
        </button>
        <div className="flex gap-2">
           {can('services', 'show_profit') && (
             <button
               onClick={() => setShowProfit && setShowProfit(!showProfit)}
               className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all text-sm border ${showProfit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-500 border-gray-200'}`}
             >
               {showProfit ? <Eye size={16}/> : <EyeOff size={16}/>} {showProfit ? 'ซ่อนกำไร' : 'แสดงกำไร'}
             </button>
           )}
           <button onClick={() => setShowBill(true)} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-indigo-100 transition-colors border border-indigo-100"><Printer size={16}/> ใบรับซ่อม/ใบเสร็จ</button>
           {can('services', 'edit') && (
             <button onClick={onEdit} className="px-4 py-2 bg-gray-900 text-white rounded-xl flex items-center gap-2 text-sm hover:bg-black transition-colors shadow-lg shadow-gray-200"><Edit size={16}/> แก้ไข</button>
           )}
           {can('services', 'delete') && (
             <button onClick={onDelete} className="px-4 py-2 bg-white text-red-600 border border-red-100 rounded-xl flex items-center gap-2 text-sm hover:bg-red-50 transition-colors"><Trash2 size={16}/> ลบ</button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              {/* Header Info */}
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded">Job No.</span>
                    <h1 className="text-4xl font-bold text-gray-900 mt-2">{service.service_number}</h1>
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Calendar size={14}/> รับรถ: {new Date(service.received_date).toLocaleDateString('th-TH')}</span>
                            {service.appointment_date && <span className="flex items-center gap-1 text-indigo-600 font-bold"><Clock size={14}/> นัดรับ: {new Date(service.appointment_date).toLocaleDateString('th-TH')}</span>}
                        </div>
                        <div className="flex">
                            <span className={`text-xs px-2 py-1 rounded-lg border inline-flex items-center gap-1 font-bold ${getDurationColorClass(totalDays, isFinished)}`}>
                                <Clock size={12}/> {isFinished ? `เสร็จสิ้น (ใช้เวลา ${durationText})` : `อยู่ในศูนย์มาแล้ว ${durationText}`}
                            </span>
                        </div>
                    </div>
                 </div>
                 <div className="flex flex-col items-end gap-2">
                    <span className={`px-4 py-2 rounded-lg font-bold text-sm border shadow-sm flex items-center gap-2 ${statusInfo.color}`}>
                       <statusInfo.icon size={16}/> {statusInfo.label}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${payStatus.color} flex items-center gap-1`}>
                       <DollarSign size={12}/> {payStatus.label}
                    </span>
                 </div>
              </div>

              {/* Customer */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6 flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-400 shadow-sm border border-gray-200"><User size={24}/></div>
                 <div>
                    <h3 className="font-bold text-gray-900">{service.customer_cache?.first_name} {service.customer_cache?.last_name}</h3>
                    <p className="text-sm text-gray-500">{service.customer_cache?.phone}</p>
                 </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Wrench size={18}/> รายการซ่อม</h3>
                {can('assembly', 'prepare') && (
                  <button onClick={() => setPrepSignal((s) => s + 1)}
                    className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all">
                    <ListChecks size={14} /> เช็คลิสต์เตรียมอะไหล่
                  </button>
                )}
              </div>
              <div className="space-y-4 mb-6">
                  {service.service_items?.map((item, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <p className="font-bold text-gray-800">{item.description}</p>
                              <span className="text-[10px] bg-white border px-2 py-0.5 rounded text-gray-500">{item.type}</span>
                              {(!item.sub_items || item.sub_items.length === 0) && (() => {
                                const c = prepChip(item.description);
                                return c ? <span className={`ml-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.cls}`}>{c.label}</span> : null;
                              })()}
                           </div>
                           <div className="text-right">
                              <p className="font-bold text-indigo-700">฿{item.sell_price.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">x{item.quantity}</p>
                           </div>
                        </div>
                        {item.sub_items && item.sub_items.length > 0 && (
                            <div className="mt-3 pl-4 border-l-2 border-indigo-100 space-y-1">
                                {item.sub_items.map((sub, sIdx) => {
                                    const c = prepChip(sub.description);
                                    return (
                                    <div key={sIdx} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                                        <span className="min-w-0 truncate">• {sub.description} <span className="text-[9px] text-gray-400">({sub.type})</span></span>
                                        <span className="flex items-center gap-2 shrink-0">
                                            {c && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${c.cls}`}>{c.label}</span>}
                                            <span>฿{Number(sub.price).toLocaleString()}</span>
                                        </span>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                  ))}
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-4 mt-6">
                 <div className="w-1/2 text-right space-y-2 text-sm">
                    <div className="flex justify-between"><span>รวมค่าบริการ</span><span>{service.subtotal.toLocaleString()}</span></div>
                    {service.shipping_cost > 0 && <div className="flex justify-between"><span>ค่าขนส่ง</span><span>{service.shipping_cost.toLocaleString()}</span></div>}
                    {service.discount > 0 && <div className="flex justify-between text-red-500"><span>ส่วนลด</span><span>-{service.discount.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-bold text-lg text-indigo-700 mt-2 pt-2 border-t border-dashed border-gray-200"><span>สุทธิ</span><span>฿{service.grand_total.toLocaleString()}</span></div>
                    {showProfit && (() => {
                      const totalCost = service.service_items?.reduce((sum, item) => sum + ((item.cost_price || 0) * item.quantity), 0) || 0;
                      const profit = (service.subtotal - (service.discount || 0)) - totalCost;
                      return (
                        <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 animate-in fade-in zoom-in-95">
                          <span className="flex items-center gap-1"><TrendingUp size={14}/> กำไร</span>
                          <span>{profit >= 0 ? '+' : ''}฿{profit.toLocaleString()}</span>
                        </div>
                      );
                    })()}
                 </div>
              </div>
           </div>

           {/* การจัดเตรียมของ — เช็คลิสต์เตรียมอะไหล่ (ระบบเดียวกับฝั่งคำสั่งซื้อ) */}
           <ServicePrep service={service} onItemsChange={setPrepItems} openSignal={prepSignal} />

           {/* Timeline Feed (Facebook Style) */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-lg">
                 <MessageCircle size={20} className="text-indigo-500"/> ความคืบหน้างาน (Updates)
              </h3>
              
              {/* Feed List */}
              <div className="relative pl-4 border-l-2 border-indigo-100 ml-2 space-y-6 mb-6">
                {updates.length > 0 ? updates.map((update, i) => (
                    <div key={update.id} className="relative group">
                       <div className="absolute -left-[23px] top-1 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full shadow-sm z-10"></div>
                       
                       {editingUpdateId === update.id ? (
                           <div className="bg-white p-4 rounded-xl border-2 border-indigo-500 shadow-lg">
                               <textarea 
                                  className="w-full border rounded-lg p-2 text-sm mb-2"
                                  value={editData.description}
                                  onChange={e => setEditData({...editData, description: e.target.value})}
                               />
                               <div className="flex justify-between items-center">
                                  <input type="date" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} className="text-xs border rounded px-2 py-1"/>
                                  <div className="flex gap-2">
                                      <button onClick={() => setEditingUpdateId(null)} className="text-xs text-gray-500 px-3 py-1 rounded hover:bg-gray-100">ยกเลิก</button>
                                      <button onClick={() => saveEditUpdate(update.id)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded font-bold hover:bg-indigo-700">บันทึก</button>
                                  </div>
                               </div>
                               <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                                    {editData.images?.map((img, imgIdx) => (
                                        <div key={imgIdx} className="relative group/img w-16 h-16 shrink-0">
                                            <img src={img.url} className="w-full h-full object-cover rounded-lg border"/>
                                            <button onClick={() => removeNewImage(imgIdx, true)} className="absolute -top-1 -right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500"><X size={10}/></button>
                                        </div>
                                    ))}
                                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 bg-white">
                                        <Paperclip size={20}/>
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} ref={fileInputRef} />
                                    </label>
                               </div>
                           </div>
                       ) : (
                           <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-indigo-200 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                 <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                    <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{new Date(update.update_date).toLocaleDateString('th-TH')}</span>
                                    <span className="text-gray-300">|</span>
                                    <span>{new Date(update.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</span>
                                 </div>
                                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditUpdate(update)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"><Edit size={12}/></button>
                                    <button onClick={() => handleDeleteUpdate(update.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"><Trash2 size={12}/></button>
                                 </div>
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{update.description}</p>
                              {update.images?.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 mt-3">
                                   {update.images.map((img, imgIdx) => (
                                     <img key={imgIdx} src={img} className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-90 border border-gray-200" onClick={() => setLightboxImg(img)} />
                                   ))}
                                </div>
                              )}
                           </div>
                       )}
                    </div>
                )) : (
                    <div className="text-center py-6 text-gray-400 text-sm italic">ยังไม่มีการอัปเดต</div>
                )}
              </div>

              {/* Input Bar (Bottom) */}
              <div className="flex gap-3 items-start pt-4 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold shrink-0">
                       <User size={20}/>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-2xl p-2 border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all">
                       <textarea 
                          className="w-full bg-transparent border-none focus:ring-0 text-sm p-2 resize-none max-h-32 outline-none text-gray-800 placeholder-gray-400"
                          placeholder="เขียนอัปเดตงาน..."
                          rows="1"
                          value={newUpdate.description}
                          onChange={e => {
                              setNewUpdate({...newUpdate, description: e.target.value});
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                       />
                       
                       {/* Image Preview in Input */}
                       {newUpdate.images.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto p-2 pb-3">
                              {newUpdate.images.map((img, i) => (
                                  <div key={i} className="relative w-16 h-16 shrink-0 group/preview">
                                      <img src={img.url} className="w-full h-full object-cover rounded-lg border"/>
                                      <button onClick={() => removeNewImage(i)} className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5 hover:bg-red-500"><X size={10}/></button>
                                  </div>
                              ))}
                          </div>
                       )}

                       <div className="flex justify-between items-center px-2 pt-1 border-t border-gray-200 mt-1">
                           <div className="flex gap-2 items-center">
                               {/* Attach Image Button - Clean Icon */}
                               <label className="cursor-pointer text-gray-500 hover:text-indigo-600 p-2 rounded-full hover:bg-gray-200 transition-colors" title="แนบรูป">
                                  <ImageIcon size={20}/>
                                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} ref={fileInputRef} />
                               </label>
                               
                               {/* Date Picker Button */}
                               <div className="relative group/date">
                                  <label className="cursor-pointer text-gray-500 hover:text-indigo-600 p-2 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-1" title="เปลี่ยนวันที่">
                                     <Calendar size={20}/>
                                     <span className="text-xs font-medium text-gray-600">{new Date(newUpdate.date).toLocaleDateString('th-TH', {day: '2-digit', month: 'short'})}</span>
                                  </label>
                                  <input 
                                      type="date" 
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                      value={newUpdate.date}
                                      onChange={e => setNewUpdate({...newUpdate, date: e.target.value})}
                                   />
                               </div>
                           </div>
                           
                           {/* Send Button */}
                           <button 
                              onClick={handlePostUpdate} 
                              disabled={isPosting || (!newUpdate.description.trim() && newUpdate.images.length === 0)}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                                (!newUpdate.description.trim() && newUpdate.images.length === 0) 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95'
                              }`}
                           >
                              {isPosting ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} 
                              <span>โพสต์</span>
                           </button>
                       </div>
                  </div>
              </div>
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-indigo-500"/> ประวัติการชำระเงิน</h3>
              <div className="space-y-3 relative">
                {service.service_payments && service.service_payments.length > 0 ? (
                  <>
                    <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-100"></div>
                    {service.service_payments.map((pay, i) => (
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
                                   {getPaymentIcon(pay.method)}
                                   {getPaymentLabel(pay.method)}
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
                  <div className="text-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
                    ยังไม่มีรายการชำระเงิน
                  </div>
                )}
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">ทีมงาน</h3>
              <div className="space-y-2">
                 {service.service_assignees?.map((a, i) => (
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
                 {(!service.service_assignees || service.service_assignees.length === 0) && <p className="text-gray-400 text-sm text-center">-</p>}
              </div>
           </div>
           
           {/* ... (Images, Notes like before) */}
           {service.images?.length > 0 && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                 <h3 className="font-bold text-gray-800 mb-4">รูปภาพ</h3>
                 <div className="grid grid-cols-2 gap-2">
                    {service.images.map((img, i) => (
                       <div key={i} className="cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setLightboxImg(img)}>
                          <img src={img} className="rounded-lg w-full h-24 object-cover border border-gray-200 shadow-sm"/>
                       </div>
                    ))}
                 </div>
              </div>
           )}
           
           {service.notes && (
             <div className="bg-yellow-50 p-6 rounded-3xl border border-yellow-100">
                <h3 className="font-bold text-yellow-800 mb-2 text-sm uppercase tracking-wider">หมายเหตุ</h3>
                <p className="text-yellow-900 text-sm leading-relaxed whitespace-pre-line">{service.notes}</p>
             </div>
           )}
        </div>
      </div>

      {showBill && <ServiceBillPreview service={service} onClose={() => setShowBill(false)} />}

      {/* Audit Footer */}
      {(service.created_by || service.updated_by) && (
        <div className="text-xs text-gray-400 text-center py-2 border-t border-gray-100 mt-4">
          {service.created_by && (
            <span>สร้างโดย <span className="font-medium text-gray-500">{service.created_by.name}</span> · {new Date(service.created_at).toLocaleDateString('th-TH')}</span>
          )}
          {service.created_by && service.updated_by && <span className="mx-2">|</span>}
          {service.updated_by && (
            <span>แก้ไขล่าสุดโดย <span className="font-medium text-gray-500">{service.updated_by.name}</span> · {new Date(service.updated_at).toLocaleDateString('th-TH')}</span>
          )}
        </div>
      )}

      {/* Audit Log */}
      <AuditLogPanel resourceType="service" resourceId={service.id} title="ประวัติการเปลี่ยนแปลง" compact />
    </div>
  );
};
export default ServiceDetail;