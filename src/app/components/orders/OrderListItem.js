import React from 'react';
import { Package, User, Clock, CheckCircle2, MessageCircle, Facebook, Instagram, Phone, Wrench, Hourglass } from 'lucide-react';
import TagControl, { TagChips, firstTagColor } from '@/app/components/common/TagControl';
import { paymentTotals } from '@/lib/paymentSave';
import {
  getFrameStatusLabel,
  getFrameStatusStyle,
  hasFrameRequiredItems,
  normalizeFrameStatus,
} from './frameStatus';

const OrderListItem = ({ order, showProfit, onClick, tags = [], itemTagIds = [], onToggleTag = null, onCreateTag = null, onDeleteTag = null }) => {
  const tagColor = firstTagColor(tags, itemTagIds);
  const getStatusColor = (s) => {
    switch(s) {
      case 'Quotation': return 'bg-gray-100 text-gray-600';
      case 'Deposit': return 'bg-amber-100 text-amber-700';
      case 'Paid': return 'bg-indigo-100 text-indigo-700';
      case 'Assembling': return 'bg-blue-100 text-blue-700';
      case 'Shipping': return 'bg-purple-100 text-purple-700';
      case 'Completed': return 'bg-emerald-100 text-emerald-700';
      case 'Cancelled': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100';
    }
  };

  const getSocialIcon = (type) => {
    switch(type) {
        case 'Facebook': return <Facebook size={12} className="text-blue-600"/>;
        case 'Line': return <MessageCircle size={12} className="text-green-500"/>;
        case 'Instagram': return <Instagram size={12} className="text-pink-500"/>;
        case 'WhatsApp': return <Phone size={12} className="text-green-600"/>;
        default: return null;
    }
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

  const mainItem = order.order_items?.reduce((prev, current) => (prev.sell_price > current.sell_price) ? prev : current, order.order_items[0]) || { product_name: 'No items' };
  const totalQty = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalCost = order.order_items?.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0) || 0;
  const totalProfit = (order.subtotal - order.discount) - totalCost;
  const frameStatus = normalizeFrameStatus(order.frame_status, hasFrameRequiredItems(order.order_items || []));

  // Social info
  const social = order.customer_cache?.social_channels?.[0];
  const custImg = order.customer_cache?.images?.[0];
  const custImgUrl = typeof custImg === 'string' ? custImg : custImg?.url;

  return (
    <tr onClick={onClick} className="transition-colors cursor-pointer border-b last:border-none group hover:bg-indigo-50/30 border-gray-50"
      style={tagColor ? { backgroundColor: `${tagColor}14`, boxShadow: `inset 5px 0 0 ${tagColor}` } : undefined}>
      <td className="px-6 py-4 align-top">
        <div className="flex items-center gap-3">
          {onToggleTag && (
            <TagControl align="left" tags={tags} itemTagIds={itemTagIds} onToggle={onToggleTag} onCreate={onCreateTag} onDeleteTag={onDeleteTag} />
          )}
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 overflow-hidden">
            {custImgUrl ? <img src={custImgUrl} alt="" className="w-full h-full object-cover" /> : <User size={18} />}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {order.customer_cache?.first_name} {order.customer_cache?.last_name}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
               {social && getSocialIcon(social.type)}
               {social ? social.value : (order.customer_cache?.phone || '-')}
            </div>
            {itemTagIds.length > 0 && <div className="mt-1"><TagChips tags={tags} itemTagIds={itemTagIds} /></div>}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 align-top">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-indigo-400 shrink-0"/>
          <div>
            <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{mainItem.product_name}</p>
            {order.order_items?.length > 1 && <p className="text-[10px] text-gray-400">+{order.order_items.length - 1} รายการอื่นๆ</p>}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-center align-top">
        <span className="text-sm font-medium bg-gray-50 px-2 py-1 rounded-md text-gray-600">{totalQty}</span>
      </td>
      <td className="px-6 py-4 align-top">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-gray-800 text-xs block">{order.order_number}</span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            {new Date(order.order_date).toLocaleDateString('th-TH', {day: '2-digit', month: 'short', year: '2-digit'})}
          </span>
          <span className={`text-[10px] px-2 py-1 rounded border w-fit flex items-center gap-1 font-bold shadow-sm whitespace-nowrap ${getDurationColorClass(totalDays)}`}>
            <Clock size={10}/> {order.status === 'Completed' ? `เสร็จใน ${durationText}` : `รอ ${durationText}`}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-center align-top">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusColor(order.status)}`}>
          {order.status}
        </span>
        {order._prep && (
          <div className="mt-1.5 w-24 mx-auto">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${order._prep.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${order._prep.progress}%` }} />
            </div>
            <span className="text-[9px] text-gray-400">เตรียม {order._prep.progress}%</span>
          </div>
        )}
      </td>
      <td className="px-6 py-4 text-center align-top">
        <span className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${getFrameStatusStyle(frameStatus)}`}>
          <Wrench size={10}/> {getFrameStatusLabel(frameStatus)}
        </span>
      </td>
      <td className="px-6 py-4 text-right align-top">
        <span className="font-bold text-gray-900">฿{order.grand_total.toLocaleString()}</span>
        {(() => {
          if (order.status === 'Cancelled' || order.status === 'Quotation') return null;
          const { paid, pending, outstanding } = paymentTotals(order.order_payments || [], order.grand_total || 0);
          return (
            <div className="flex flex-col items-end gap-0.5 mt-1">
              {outstanding > 0 && (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                  ค้าง ฿{outstanding.toLocaleString()}
                </span>
              )}
              {outstanding > 0 && paid > 0 && (
                <span className="text-[9px] text-gray-400 whitespace-nowrap">ชำระแล้ว ฿{paid.toLocaleString()}</span>
              )}
              {pending > 0 && (
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-0.5">
                  <Hourglass size={9}/> รอเงินเข้า ฿{pending.toLocaleString()}
                </span>
              )}
            </div>
          );
        })()}
      </td>
      {showProfit && (
        <td className="px-6 py-4 text-right bg-emerald-50/30 align-top">
          <span className={`font-bold text-sm ${totalProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {totalProfit > 0 ? '+' : ''}{totalProfit.toLocaleString()}
          </span>
        </td>
      )}
    </tr>
  );
};
export default OrderListItem;
