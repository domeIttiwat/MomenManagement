import React from 'react';
import { DollarSign, TrendingUp, ShoppingBag, Wrench, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import KpiCard from './KpiCard';
import SalesChart from './SalesChart';

const OverviewTab = ({ data, compareMode }) => {
  if (!data) return null;

  const chartData = data.chartData || [];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard 
              title="รายรับรวมทั้งหมด (รับจริง)" 
              value={`฿${(data.overviewStats?.totalRevenue || 0).toLocaleString()}`} 
              growth={data.overviewStats?.revenueGrowth}
              icon={DollarSign}
              color="bg-indigo-50 text-indigo-600"
              subtext2={data.overviewStats?.totalOutstanding > 0 ? `ค้างชำระรวม: ฿${data.overviewStats.totalOutstanding.toLocaleString()}` : null}
              compareMode={compareMode}
            />
            <KpiCard 
              title="กำไรรวมสุทธิ (Net Profit)" 
              value={`฿${(data.overviewStats?.netProfit || 0).toLocaleString()}`} 
              icon={TrendingUp}
              color="bg-emerald-50 text-emerald-600"
              compareMode={compareMode}
            />
            <KpiCard 
              title="งบการตลาดที่ใช้" 
              value={`฿${(data.overviewStats?.marketingCost || 0).toLocaleString()}`} 
              icon={Activity}
              color="bg-rose-50 text-rose-600"
              subtext="(หักลบในกำไรสุทธิแล้ว)"
              compareMode={compareMode}
            />
      </div>
      
      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard 
              title="ยอดขาย (ออเดอร์)" 
              value={`฿${(data.overviewStats?.orderRevenue || 0).toLocaleString()}`} 
              icon={ShoppingBag}
              color="bg-emerald-50 text-emerald-600"
              growth={data.orderStats?.revenueGrowth}
              // แสดงสัดส่วนรายได้ %
              subtext={`${data.overviewStats?.orderRevenuePercent?.toFixed(1)}% ของรายรับรวม`}
              compareMode={compareMode}
            />
            <KpiCard 
              title="ยอดขาย (งานซ่อม)" 
              value={`฿${(data.overviewStats?.serviceRevenue || 0).toLocaleString()}`} 
              icon={Wrench}
              color="bg-orange-50 text-orange-600"
              growth={data.serviceStats?.revenueGrowth}
              // แสดงสัดส่วนรายได้ %
              subtext={`${data.overviewStats?.serviceRevenuePercent?.toFixed(1)}% ของรายรับรวม`}
              compareMode={compareMode}
            />
            <KpiCard 
              title="กำไร (ออเดอร์)" 
              value={`฿${(data.overviewStats?.orderProfit || 0).toLocaleString()}`} 
              icon={TrendingUp}
              color="bg-emerald-50 text-emerald-600"
              growth={data.overviewStats?.orderProfitGrowth}
              // แสดง % Margin
              subtext={`${data.overviewStats?.orderProfitMargin?.toFixed(1)}% Margin`}
              compareMode={compareMode}
            />
            <KpiCard 
              title="กำไร (งานซ่อม)" 
              value={`฿${(data.overviewStats?.serviceProfit || 0).toLocaleString()}`} 
              icon={TrendingUp}
              color="bg-orange-50 text-orange-600"
              growth={data.overviewStats?.serviceProfitGrowth}
              // แสดง % Margin
              subtext={`${data.overviewStats?.serviceProfitMargin?.toFixed(1)}% Margin`}
              compareMode={compareMode}
            />
      </div>

      {/* Combined Chart */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-6">แนวโน้มรายรับจริง (Cash Flow)</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="colorOrder" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorService" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <Tooltip contentStyle={{borderRadius:'12px'}} formatter={(val)=>[val.toLocaleString(), 'บาท']} />
                  <Legend verticalAlign="top" height={36}/>
                  <Area type="monotone" dataKey="orderSales" name="รับจริง (ออเดอร์)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOrder)" />
                  <Area type="monotone" dataKey="serviceSales" name="รับจริง (งานซ่อม)" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorService)" />
                  {compareMode !== 'none' && (
                    <Line type="monotone" dataKey="prevTotalSales" name="รวมช่วงก่อนหน้า" stroke="#9ca3af" strokeDasharray="5 5" dot={false} strokeWidth={2}/>
                  )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};

export default OverviewTab;