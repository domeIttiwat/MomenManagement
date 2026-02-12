import React from 'react';
import { Package, User, Calendar, ArrowRight, ClipboardList } from 'lucide-react';

const IncomingJobs = ({ orders, onEnterBoard }) => {
  if (orders.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500">
            <ClipboardList size={48} className="mb-4 opacity-20"/>
            <p>No pending jobs available.</p>
        </div>
    );
  }

  return (
    <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between text-gray-400 px-2">
            <h2 className="text-sm font-bold uppercase tracking-wider">Pending Orders</h2>
            <span className="text-xs bg-white/10 px-2 py-1 rounded-full">{orders.length}</span>
        </div>

        {/* List Items */}
        <div className="grid gap-3">
            {orders.map((work) => {
                const isOrder = work.type === 'order';
                const data = work.data;
                const number = isOrder ? data.order_number : data.service_number;
                const customerName = data.customer_cache ? `${data.customer_cache.first_name} ${data.customer_cache.last_name}` : 'Unknown';
                const dateStr = new Date(data.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                return (
                    <div 
                        key={`${work.type}-${data.id}`} 
                        onClick={() => onEnterBoard(work)}
                        className="bg-[#22272b] border border-gray-700/50 p-4 rounded-xl shadow-sm hover:bg-[#2c333a] cursor-pointer transition-colors group flex flex-col md:flex-row md:items-center gap-4"
                    >
                        {/* ID Badge */}
                        <div className="shrink-0 flex items-center gap-3 md:w-32">
                            <div className={`w-1 h-10 rounded-full ${isOrder ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                            <div>
                                <div className="text-sm font-bold text-gray-200 font-mono">{number}</div>
                                <div className="text-[10px] text-gray-500 uppercase">{isOrder ? 'Order' : 'Service'}</div>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                                <User size={14}/>
                                <span className="truncate text-gray-300">{customerName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Package size={14}/>
                                <span>{work.items?.length || 0} items</span>
                            </div>
                            <div className="flex items-center gap-2 hidden md:flex">
                                <Calendar size={14}/>
                                <span>{dateStr}</span>
                            </div>
                        </div>

                        {/* Action */}
                        <button className="shrink-0 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all opacity-100 md:opacity-0 group-hover:opacity-100">
                            Start Board <ArrowRight size={14}/>
                        </button>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default IncomingJobs;