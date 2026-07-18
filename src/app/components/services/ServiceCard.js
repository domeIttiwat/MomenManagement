import React from 'react';
import { Wrench, Calendar, User, Clock, CheckCircle2, AlertCircle, Truck, Wallet, PauseCircle, XCircle, PlayCircle, ClipboardList, Star } from 'lucide-react';

const ServiceCard = ({ service, onClick, focused = false, onToggleFocus = null }) => {
  
  // Logic การแสดงผลสถานะ (Unified Status Logic) - Updated to match ServiceDetail
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

  const getPaymentStatus = () => {
    const totalPaid = service.service_payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const grandTotal = service.grand_total || 0;

    if (grandTotal === 0 && totalPaid === 0) return null;
    if (totalPaid === 0) return { label: 'ยังไม่ชำระ', color: 'text-red-500 bg-red-50 border-red-100' };
    if (totalPaid >= grandTotal) return { label: 'ชำระครบ', color: 'text-green-600 bg-green-50 border-green-100' };
    
    const isOnlyDeposit = service.service_payments?.length > 0 && service.service_payments.every(p => p.type === 'deposit');
    if (isOnlyDeposit) return { label: 'มัดจำแล้ว', color: 'text-amber-600 bg-amber-50 border-amber-100' };
    
    return { label: 'ยังไม่ครบ', color: 'text-orange-600 bg-orange-50 border-orange-100' };
  };

  // Duration Logic
  const getDurationInfo = () => {
    if (!service.received_date) return { text: '-', totalDays: 0, isFinished: false };

    const start = new Date(service.received_date);
    const isFinished = ['Done', 'Tested', 'Completed', 'Delivered', 'Cancelled'].includes(service.status);
    
    const end = isFinished && service.completed_date 
      ? new Date(service.completed_date) 
      : new Date();

    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    let diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) diffTime = 0;

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const years = Math.floor(diffDays / 365);
    const remainingDaysAfterYears = diffDays % 365;
    const months = Math.floor(remainingDaysAfterYears / 30);
    const days = remainingDaysAfterYears % 30;

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

  const payStatus = getPaymentStatus();
  const mainItem = service.service_items?.[0]?.description || 'ไม่มีรายการ';

  return (
    <div onClick={onClick} className={`rounded-2xl p-4 shadow-sm border transition-all cursor-pointer group flex flex-col h-full ${focused ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 hover:shadow-md' : 'bg-white border-gray-100 hover:shadow-md hover:border-indigo-200'}`}>
      {/* Header Image */}
      <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden mb-4 border border-gray-50">
        {service.images && service.images.length > 0 ? (
          <img src={service.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 flex-col gap-2">
            <Wrench size={32} />
          </div>
        )}
        {onToggleFocus && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFocus(); }}
            title={focused ? 'เลิกโฟกัส' : 'โฟกัสงานนี้'}
            className={`absolute top-2 left-2 p-1.5 rounded-lg backdrop-blur-sm shadow-sm transition-colors ${focused ? 'bg-white/90 text-emerald-600' : 'bg-white/70 text-gray-300 hover:text-emerald-500'}`}
          >
            <Star size={15} className={focused ? 'fill-emerald-500' : ''} />
          </button>
        )}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm flex items-center gap-1 border ${statusInfo.color}`}>
            <statusInfo.icon size={12}/> {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Service No & Date */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">{service.service_number}</h3>
            <div className="flex flex-col gap-1 mt-0.5">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Calendar size={10}/> {new Date(service.received_date).toLocaleDateString('th-TH')}
                </div>
                {/* Duration Badge */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded border w-fit flex items-center gap-1 font-bold ${getDurationColorClass(totalDays, isFinished)}`}>
                    <Clock size={9}/> {isFinished ? `เสร็จใน ${durationText}` : `รอ ${durationText}`}
                </span>
            </div>
          </div>
          {service.grand_total > 0 && (
            <div className="text-right flex flex-col items-end gap-1">
              <p className="font-bold text-indigo-600">฿{service.grand_total.toLocaleString()}</p>
              {payStatus && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold flex items-center gap-1 ${payStatus.color}`}>
                   <Wallet size={8}/> {payStatus.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Customer */}
        <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded-lg mt-2">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
            <User size={12}/>
          </div>
          <p className="text-xs font-medium text-gray-700 truncate">
            {service.customer_cache?.first_name} {service.customer_cache?.last_name}
          </p>
        </div>

        {/* Prep Progress */}
        {service._prep && (
          <div className="mb-2">
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="text-gray-400">เตรียมของ</span>
              <span className={`font-bold ${service._prep.progress === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                {service._prep.done}/{service._prep.total} · {service._prep.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${service._prep.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${service._prep.progress}%` }} />
            </div>
          </div>
        )}

        {/* Job Description */}
        <div className="mt-auto border-t border-gray-50 pt-2">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <AlertCircle size={12} className="text-orange-500 shrink-0"/> 
            <div className="truncate flex-1">
                {mainItem}
            </div>
            {service.service_items?.length > 1 && <span className="text-[10px] bg-gray-100 px-1 rounded text-gray-400 shrink-0">+{service.service_items.length-1}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;