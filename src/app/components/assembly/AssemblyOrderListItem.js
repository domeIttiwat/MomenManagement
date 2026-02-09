'use client';

import { Calendar, Users, Hash, ChevronRight, Package, PackageSearch, Wrench, Clock, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

export default function AssemblyOrderListItem({ order, onSelect }) {

  const formattedDueDate = order.dueDate 
    ? format(parseISO(order.dueDate), 'd MMM yyyy', { locale: th })
    : 'ไม่มีกำหนด';

  const getOrderStatus = (items) => {
    if (!items || items.length === 0) return { label: 'ไม่มีสินค้า', icon: Package, color: 'bg-gray-100 text-gray-500' };

    const statuses = items.map(i => i.status);
    
    if (statuses.every(s => s === 'Done')) {
        return { label: 'เสร็จสิ้น', icon: CheckCircle, color: 'bg-green-100 text-green-700' };
    }
    if (statuses.some(s => s === 'Testing')) {
        return { label: 'กำลังทดสอบ', icon: Clock, color: 'bg-purple-100 text-purple-700' };
    }
    if (statuses.some(s => s === 'Assembling')) {
        return { label: 'กำลังประกอบ', icon: Wrench, color: 'bg-amber-100 text-amber-700' };
    }
    return { label: 'รอหยิบของ', icon: PackageSearch, color: 'bg-sky-100 text-sky-700' };
  };

  const currentStatus = getOrderStatus(order.items);

  return (
    <button 
      onClick={onSelect} 
      className="w-full text-left bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
          {/* Order ID */}
          <div className="flex items-center font-bold text-blue-600 text-lg">
            <Hash size={16} className="mr-2 opacity-80" />
            <span>{order.orderId}</span>
          </div>

          {/* Vehicle Name */}
          <div className="font-semibold text-slate-700 text-base">
            {order.vehicleName}
          </div>
        </div>

        <div className="flex items-center gap-4">
           {/* Status Badge */}
           <div className={`hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${currentStatus.color}`}>
              <currentStatus.icon size={12} />
              {currentStatus.label}
          </div>
          <ChevronRight size={20} className="text-slate-400" />
        </div>
      </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-3">
            <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
                {/* Customer */}
                <div className="flex items-center text-sm text-slate-500">
                    <Users size={14} className="mr-1.5" />
                    <span>{order.customerName}</span>
                </div>

                {/* Item Count */}
                <div className="flex items-center text-sm text-slate-500">
                    <Package size={14} className="mr-1.5" />
                    <span>{order.itemCount} ชิ้น</span>
                </div>
                
                {/* Due Date */}
                <div className="flex items-center text-sm text-slate-500">
                    <Calendar size={14} className="mr-1.5" />
                    <span>กำหนดส่ง: {formattedDueDate}</span>
                </div>
            </div>

            {/* Status Badge for mobile */}
            <div className={`sm:hidden inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${currentStatus.color} self-start`}>
                <currentStatus.icon size={12} />
                {currentStatus.label}
            </div>
        </div>
    </button>
  );
}
