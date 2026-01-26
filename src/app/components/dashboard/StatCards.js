import React from 'react';
import { DollarSign, TrendingUp, ShoppingBag, Megaphone, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

const StatCards = ({ stats = {}, loading }) => {
  const Card = ({ title, value, subValue, icon: Icon, color, trend }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
        {trend !== undefined && trend !== null && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(Number(trend).toFixed(1))}%
          </div>
        )}
      </div>
      <div>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-100 rounded animate-pulse"></div>
        ) : (
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h3>
        )}
        {subValue && <p className="text-xs text-gray-400 mt-2 font-medium">{subValue}</p>}
      </div>
    </div>
  );

  // Helper function: แปลงตัวเลขให้ปลอดภัย (ถ้าไม่มีค่า ให้เป็น 0)
  const fmt = (num) => (num || 0).toLocaleString();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card 
        title="ยอดขายรวม (Revenue)" 
        value={`฿${fmt(stats?.revenue)}`} 
        subValue={`เฉลี่ย ฿${fmt(stats?.avgDailySales)}/วัน`}
        icon={DollarSign} 
        color="bg-indigo-500"
        trend={stats?.revenueGrowth || 0}
      />
      <Card 
        title="กำไรสุทธิ (Net Profit)" 
        value={`฿${fmt(stats?.netProfit)}`} 
        subValue={`${stats?.profitMargin || 0}% Margin`}
        icon={TrendingUp} 
        color="bg-emerald-500"
        trend={stats?.profitGrowth || 0}
      />
      <Card 
        title="ออเดอร์ทั้งหมด (Orders)" 
        value={fmt(stats?.totalOrders)} 
        subValue="รายการที่สำเร็จ"
        icon={ShoppingBag} 
        color="bg-blue-500"
        trend={stats?.ordersGrowth || 0}
      />
      <Card 
        title="ประสิทธิภาพการตลาด" 
        value={`${stats?.marketingPercent || 0}%`} 
        subValue={`ROAS: ${stats?.roas || 0}x`}
        icon={Megaphone} 
        color="bg-pink-500"
        trend={0} 
      />
    </div>
  );
};

export default StatCards;