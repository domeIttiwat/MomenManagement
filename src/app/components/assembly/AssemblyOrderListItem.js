'use client';

import { Calendar, Users, Hash, ChevronRight, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

// This is the fully restored version of the list item component.
// It is designed to work with the rich fake data structure.
export default function AssemblyOrderListItem({ order, onSelect }) {

  const formattedDueDate = order.dueDate 
    ? format(parseISO(order.dueDate), 'd MMM yyyy', { locale: th })
    : 'ไม่มีกำหนด';

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
          {/* Due Date */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar size={14} />
            <span>{formattedDueDate}</span>
          </div>
          <ChevronRight size={20} className="text-slate-400" />
        </div>
      </div>

      <div className="border-t border-slate-100 my-3"></div>

      <div className="flex items-center justify-between text-sm">
        {/* Customer Name */}
        <div className="flex items-center gap-2 text-slate-500">
          <Users size={14} />
          <span>{order.customerName}</span>
        </div>
        {/* Item Count */}
        <div className="font-medium text-slate-600 bg-slate-100 rounded-full px-3 py-1 flex items-center gap-1.5">
            <Package size={14} />
            <span>{order.itemCount} ชิ้น</span>
        </div>
      </div>
    </button>
  );
}
