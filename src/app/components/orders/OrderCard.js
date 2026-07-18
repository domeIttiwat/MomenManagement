import React from 'react';
import { Package, Calendar, User, FileText, Clock, Banknote, Landmark, CreditCard, Facebook, Instagram, MessageCircle, Phone, Wrench, Star } from 'lucide-react';
import {
  getFrameStatusLabel,
  getFrameStatusStyle,
  hasFrameRequiredItems,
  normalizeFrameStatus,
} from './frameStatus';

const OrderCard = ({ order, showProfit, onClick, focused = false, onToggleFocus = null }) => {
  const totalCost = order.order_items?.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0) || 0;
  const totalProfit = (order.subtotal - order.discount) - totalCost;
  const paymentMethods = [...new Set(order.order_payments?.map(p => p.payment_method) || [])];
  const frameStatus = normalizeFrameStatus(order.frame_status, hasFrameRequiredItems(order.order_items || []));

  const statusColors = {
    Quotation: 'bg-gray-100 text-gray-600',
    Deposit: 'bg-amber-100 text-amber-700',
    Paid: 'bg-indigo-100 text-indigo-700',
    Completed: 'bg-emerald-100 text-emerald-700',
    Cancelled: 'bg-red-50 text-red-600'
  };

  const getDurationInfo = () => {
    const start = new Date(order.order_date);
    const end = order.status === 'Completed' && order.completed_at ? new Date(order.completed_at) : new Date(); 
    start.setHours(0,0,0,0); end.setHours(0,0,0,0);
    let diffTime = end - start;
    if (diffTime < 0) diffTime = 0;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = (diffDays % 365) % 30;
    const parts = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    if (days > 0 || parts.length === 0) parts.push(`${days} วัน`); 
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
      case 'Cash': return <Banknote size={12} className="text-green-600"/>;
      case 'CreditCard': return <CreditCard size={12} className="text-purple-600"/>;
      default: return <Landmark size={12} className="text-blue-600"/>;
    }
  };

  // Social Icon Helper
  const getSocialIcon = (type) => {
    switch(type) {
        case 'Facebook': return <Facebook size={12} className="text-blue-600"/>;
        case 'Line': return <MessageCircle size={12} className="text-green-500"/>;
        case 'Instagram': return <Instagram size={12} className="text-pink-500"/>;
        case 'WhatsApp': return <Phone size={12} className="text-green-600"/>;
        default: return null;
    }
  };

  const social = order.customer_cache?.social_channels?.[0];
  const custImg = order.customer_cache?.images?.[0];
  const custImgUrl = typeof custImg === 'string' ? custImg : custImg?.url;

  return (
    <div onClick={onClick} className={`rounded-2xl p-4 shadow-sm border transition-all cursor-pointer group flex flex-col h-full ${focused ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 hover:shadow-md' : 'bg-white border-gray-100 hover:shadow-md hover:border-indigo-200'}`}>
      <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden mb-4 border border-gray-50">
        {order.images && order.images.length > 0 ? (
          <img src={order.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText size={32}/></div>
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
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm ${statusColors[order.status] || 'bg-gray-100'}`}>
            {order.status}
          </span>
        </div>
        
        {paymentMethods.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1">
             {paymentMethods.map((m, i) => (
               <div key={i} className="bg-white/90 backdrop-blur-sm p-1 rounded-md shadow-sm border border-gray-100" title={m}>{getPaymentIcon(m)}</div>
             ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">{order.order_number}</h3>
            <div className="flex flex-col gap-1 mt-0.5">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Calendar size={10}/> {new Date(order.order_date).toLocaleDateString('th-TH')}
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border w-fit flex items-center gap-1 font-bold ${getDurationColorClass(totalDays)}`}>
                    <Clock size={9}/> {order.status === 'Completed' ? `เสร็จใน ${durationText}` : `รอ ${durationText}`}
                </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-indigo-600">฿{order.grand_total.toLocaleString()}</p>
            {showProfit && (
              <p className={`text-[10px] font-bold ${totalProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {totalProfit > 0 ? '+' : ''}{totalProfit.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded-lg mt-2">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm overflow-hidden shrink-0">{custImgUrl ? <img src={custImgUrl} alt="" className="w-full h-full object-cover"/> : <User size={12}/>}</div>
          <div className="min-w-0">
             <p className="text-xs font-medium text-gray-700 truncate">{order.customer_cache?.first_name} {order.customer_cache?.last_name}</p>
             {social && (
                <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5 truncate">
                   {getSocialIcon(social.type)} {social.value}
                </div>
             )}
          </div>
        </div>

        <div className="mt-auto border-t border-gray-50 pt-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Package size={12}/> 
            <span className="truncate">{order.order_items?.[0]?.product_name}</span>
            {order.order_items?.length > 1 && <span className="text-[10px] bg-gray-100 px-1 rounded">+{order.order_items.length-1}</span>}
          </div>
          <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${getFrameStatusStyle(frameStatus)}`}>
            <Wrench size={10}/> {getFrameStatusLabel(frameStatus)}
          </div>
        </div>

        {order._prep && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-gray-400">จัดเตรียมของ</span>
              <span className={`font-bold ${order._prep.progress === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>{order._prep.progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${order._prep.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${order._prep.progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default OrderCard;
