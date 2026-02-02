import React, { useState } from 'react';
import { ArrowLeft, Edit, Trash2, Printer, Wrench, User, Calendar, Clock, DollarSign, CreditCard, Banknote, Landmark, X, History, FileText, CheckCircle2, AlertCircle, Truck, PauseCircle, XCircle, PlayCircle } from 'lucide-react';
import ServiceBillPreview from './ServiceBillPreview';

const ServiceDetail = ({ service, onBack, onEdit, onDelete }) => {
  const [showBill, setShowBill] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  if (!service) return <div className="p-10 text-center text-gray-500">ไม่พบข้อมูลงานซ่อม</div>;

  // --- Status Logic (Unified) ---
  const getStatusDisplay = (status, reason) => {
    switch (status) {
      case 'Waiting':
        if (reason === 'รอคิว') return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: PauseCircle, label: 'รอคิว' };
        if (reason === 'รออะไหล่') return { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle, label: 'รออะไหล่' };
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: reason ? `รอ: ${reason}` : 'รอดำเนินการ' };
      
      case 'In Progress': return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Wrench, label: 'กำลังซ่อม' };
      case 'Tested': return { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: PlayCircle, label: 'ทดสอบแล้ว' };
      case 'Delivered': return { color: 'bg-teal-100 text-teal-700 border-teal-200', icon: Truck, label: 'ส่งมอบแล้ว' };
      case 'Completed': return { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, label: 'เรียบร้อย' };
      case 'Cancelled': return { color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle, label: 'ยกเลิก' };
      default: return { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock, label: status };
    }
  };

  const statusInfo = getStatusDisplay(service.status, service.waiting_reason);
  // ------------------------------

  // Duration Logic
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
    if (finished) return 'bg-gray-100 text-gray-500 border-gray-200';
    if (days <= 7) return 'bg-green-100 text-green-700 border-green-200';
    if (days <= 30) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (days <= 60) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  // Payment Status Logic
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
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft size={20}/> กลับหน้ารายการ
        </button>
        <div className="flex gap-2">
           <button onClick={() => setShowBill(true)} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-indigo-100 transition-colors border border-indigo-100"><Printer size={16}/> ใบรับซ่อม/ใบเสร็จ</button>
           <button onClick={onEdit} className="px-4 py-2 bg-gray-900 text-white rounded-xl flex items-center gap-2 text-sm hover:bg-black transition-colors shadow-lg shadow-gray-200"><Edit size={16}/> แก้ไข</button>
           <button onClick={onDelete} className="px-4 py-2 bg-white text-red-600 border border-red-100 rounded-xl flex items-center gap-2 text-sm hover:bg-red-50 transition-colors"><Trash2 size={16}/> ลบ</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
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

              {/* ... (ส่วนอื่นๆ ของ Detail เหมือนเดิม) ... */}
              {/* เพื่อความกระชับ ผมละโค้ดส่วนแสดงลูกค้าและรายการซ่อมไว้ (ให้ใช้ของเดิมได้เลย) 
                  แต่ถ้าคุณต้องการให้ผมพิมพ์ซ้ำทั้งหมด บอกได้ครับ */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6 flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-400 shadow-sm border border-gray-200"><User size={24}/></div>
                 <div>
                    <h3 className="font-bold text-gray-900">{service.customer_cache?.first_name} {service.customer_cache?.last_name}</h3>
                    <p className="text-sm text-gray-500">{service.customer_cache?.phone}</p>
                 </div>
              </div>

              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Wrench size={18}/> รายการซ่อม</h3>
              <div className="space-y-4 mb-6">
                  {service.service_items?.map((item, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <p className="font-bold text-gray-800">{item.description}</p>
                              <span className="text-[10px] bg-white border px-2 py-0.5 rounded text-gray-500">{item.type}</span>
                           </div>
                           <div className="text-right">
                              <p className="font-bold text-indigo-700">฿{item.sell_price.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">x{item.quantity}</p>
                           </div>
                        </div>
                        {item.sub_items && item.sub_items.length > 0 && (
                            <div className="mt-3 pl-4 border-l-2 border-indigo-100 space-y-1">
                                {item.sub_items.map((sub, sIdx) => (
                                    <div key={sIdx} className="flex justify-between text-xs text-gray-600">
                                        <span>• {sub.description} <span className="text-[9px] text-gray-400">({sub.type})</span></span>
                                        <span>฿{Number(sub.price).toLocaleString()}</span>
                                    </div>
                                ))}
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
                 </div>
              </div>
           </div>
           
           {/* Timeline & Updates */}
           {service.service_updates && service.service_updates.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><History size={18} className="text-indigo-500"/> ความคืบหน้างาน (Timeline)</h3>
                <div className="relative pl-4 border-l-2 border-indigo-100 ml-2 space-y-6">
                {service.service_updates.map((update, i) => (
                    <div key={i} className="relative">
                        <div className="absolute -left-[23px] top-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-sm"></div>
                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                            <Calendar size={12}/> {new Date(update.update_date).toLocaleDateString('th-TH')}
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-sm text-gray-800 whitespace-pre-line mb-2">{update.description}</p>
                            {update.images?.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {update.images.map((img, imgIdx) => (
                                    <img key={imgIdx} src={img} className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80" onClick={() => setLightboxImg(img)} />
                                ))}
                            </div>
                            )}
                        </div>
                    </div>
                ))}
                </div>
            </div>
          )}
        </div>

        {/* Right Column */}
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
                   <div key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                      <User size={14} className="text-indigo-400"/> {a.user?.first_name} <span className="text-xs text-gray-400">({a.job_role})</span>
                   </div>
                 ))}
                 {(!service.service_assignees || service.service_assignees.length === 0) && <p className="text-gray-400 text-sm text-center">ไม่ได้ระบุผู้รับผิดชอบ</p>}
              </div>
           </div>

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
    </div>
  );
};
export default ServiceDetail;