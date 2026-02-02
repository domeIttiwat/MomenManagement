import React from 'react';
import { Wrench, Calendar, User, Clock, Wallet, CheckCircle2, AlertCircle, Truck, PauseCircle, XCircle, PlayCircle } from 'lucide-react';

const ServiceListItem = ({ service, onClick }) => {
  // Logic การแสดงผลสถานะ (Unified Status Logic)
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

  // Payment Status Logic
  const getPaymentStatus = () => {
    const totalPaid = service.service_payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const grandTotal = service.grand_total || 0;

    if (grandTotal === 0 && totalPaid === 0) return { label: '-', color: 'text-gray-400' };
    
    if (totalPaid === 0) return { label: 'ยังไม่ได้ชำระ', color: 'bg-red-50 text-red-600 border-red-100' };
    
    if (totalPaid >= grandTotal) return { label: 'ชำระครบแล้ว', color: 'bg-green-50 text-green-600 border-green-100' };

    const isOnlyDeposit = service.service_payments?.length > 0 && service.service_payments.every(p => p.type === 'deposit');
    if (isOnlyDeposit) return { label: 'มัดจำแล้ว', color: 'bg-amber-50 text-amber-600 border-amber-100' };
    
    return { label: 'ชำระยังไม่ครบ', color: 'bg-orange-50 text-orange-600 border-orange-100' };
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
  const technicians = service.service_assignees?.map(a => a.user?.first_name).join(', ') || '-';
  const mainItem = service.service_items?.[0]?.description || 'ไม่มีรายการ';

  return (
    <tr onClick={onClick} className="hover:bg-indigo-50/30 transition-colors cursor-pointer border-b border-gray-50 last:border-none group">
      <td className="px-6 py-4">
        <div className="font-bold text-indigo-900 text-sm">{service.service_number}</div>
        <div className="text-[10px] text-gray-500 mb-1">{new Date(service.received_date).toLocaleDateString('th-TH')}</div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 font-bold ${getDurationColorClass(totalDays, isFinished)}`}>
           <Clock size={9}/> {durationText}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="font-bold text-gray-900">{service.customer_cache?.first_name}</div>
        <div className="text-xs text-gray-500">{service.customer_cache?.phone}</div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
           <Wrench size={16} className="text-gray-400 shrink-0"/>
           <span className="text-sm text-gray-700 truncate max-w-[200px]">{mainItem}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
         <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border flex items-center justify-center gap-1 w-fit mx-auto ${statusInfo.color}`}>
           <statusInfo.icon size={12}/> {statusInfo.label}
         </span>
      </td>
      <td className="px-6 py-4 text-center">
         <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${payStatus.color}`}>
           {payStatus.label}
         </span>
      </td>
      <td className="px-6 py-4 text-xs text-gray-600 truncate max-w-[150px]">
         {technicians}
      </td>
      <td className="px-6 py-4 text-right font-bold text-gray-900">
         ฿{service.grand_total.toLocaleString()}
      </td>
    </tr>
  );
};
export default ServiceListItem;