import React from 'react';
import { 
  TrendingUp, ShoppingBag, FileText, PieChart, DollarSign, Activity, ArrowRight, UserCheck 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Line, Area, PieChart as RePieChart, Pie, Cell, Legend 
} from 'recharts';
import MarketingChart from './MarketingChart';
import TopRankings from './TopRankings';

const OrdersTab = ({ data, loading }) => {
  if (!data || !data.orderStats) return null;

  const { orderStats, categoryData } = data;
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      
      {/* 1. Quotation & Overview Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Quotation Card */}
         <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
             <div className="absolute -top-4 -right-4 p-4 opacity-10"><FileText size={140}/></div>
             <h3 className="text-indigo-200 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText size={16}/> ลูกค้าที่ยังไม่ตัดสินใจ (Quotation)
             </h3>
             <div className="flex justify-between items-end mb-4 relative z-10">
                 <div>
                    <p className="text-4xl font-black">{orderStats?.quotation?.count || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">ใบเสนอราคาค้างอยู่</p>
                 </div>
                 <div className="text-right">
                    <p className="text-2xl font-bold text-yellow-400">฿{(orderStats?.quotation?.totalValue || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">มูลค่ารวม</p>
                 </div>
             </div>
             <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm relative z-10 border border-white/10">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-300 flex items-center gap-1">โอกาสทำกำไร:</span>
                   <span className="font-bold text-green-400">+฿{(orderStats?.quotation?.potentialProfit || 0).toLocaleString()}</span>
                </div>
             </div>
         </div>

         {/* Profit Breakdown Flow */}
         <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center">
             <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Activity size={20} className="text-indigo-500"/> วิเคราะห์โครงสร้างกำไร (Profit Structure)
             </h3>
             
             <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left w-full">
                 {/* Sales */}
                 <div className="flex-1 bg-blue-50 p-4 rounded-2xl border border-blue-100 w-full relative">
                     <p className="text-xs text-blue-600 mb-1 font-bold uppercase">ยอดขายรวม</p>
                     <p className="text-lg font-black text-blue-900">฿{orderStats?.salesValue?.toLocaleString()}</p>
                 </div>
                 
                 <ArrowRight className="text-gray-300 hidden md:block" />

                 {/* Gross Profit */}
                 <div className="flex-1 bg-amber-50 p-4 rounded-2xl border border-amber-100 w-full relative">
                     <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-600 text-[9px] px-2 py-0.5 rounded-full border border-red-200 whitespace-nowrap">
                        หักต้นทุน {orderStats?.costOfGoods ? ((orderStats.costOfGoods/orderStats.salesValue)*100).toFixed(0) : 0}%
                     </div>
                     <p className="text-xs text-amber-700 mb-1 font-bold uppercase">กำไรขั้นต้น</p>
                     <p className="text-lg font-black text-amber-800">฿{orderStats?.grossProfit?.toLocaleString()}</p>
                     <span className="text-[10px] text-amber-600 font-medium">{orderStats?.grossMargin}% Margin</span>
                 </div>

                 <ArrowRight className="text-gray-300 hidden md:block" />

                 {/* Net Profit */}
                 <div className="flex-1 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 w-full ring-2 ring-emerald-500/20 relative">
                     <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-pink-100 text-pink-600 text-[9px] px-2 py-0.5 rounded-full border border-pink-200 whitespace-nowrap">
                        หักการตลาด {orderStats?.marketingPercent}%
                     </div>
                     <p className="text-xs text-emerald-700 mb-1 font-bold uppercase">กำไรสุทธิ</p>
                     <p className="text-2xl font-black text-emerald-700">฿{orderStats?.netProfit?.toLocaleString()}</p>
                     <span className="text-[10px] text-emerald-600 font-bold">{orderStats?.netMargin}% Net Margin</span>
                 </div>
             </div>
         </div>
      </div>

      {/* 2. Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Marketing Chart */}
         <div className="h-[420px]">
             <MarketingChart 
                 data={data.chartData} 
                 stats={data.orderStats} 
             />
         </div>

         {/* Category Analysis Chart */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[420px] flex flex-col">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><PieChart size={20} className="text-orange-500"/> สัดส่วนกำไรตามหมวดหมู่</h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                        <Pie
                            data={categoryData}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={80}
                            paddingAngle={5}
                            dataKey="profit" // Show Profit Share
                        >
                            {categoryData?.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(val, name) => [`฿${val.toLocaleString()}`, 'กำไร']} />
                        <Legend />
                    </RePieChart>
                </ResponsiveContainer>
            </div>
            {/* Mini Table */}
            <div className="mt-2 overflow-y-auto max-h-32 text-xs border-t border-gray-100 pt-2">
              <table className="w-full">
                  <thead>
                      <tr className="text-gray-400 border-b border-gray-100"><th className="text-left pb-1">หมวดหมู่</th><th className="text-right pb-1">ยอดขาย</th><th className="text-right pb-1 text-emerald-600">กำไร</th></tr>
                  </thead>
                  <tbody>
                      {categoryData?.map((cat, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-none">
                              <td className="py-1.5 text-gray-700 font-medium flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                                  {cat.name}
                              </td>
                              <td className="py-1.5 text-right text-gray-500">฿{cat.sales.toLocaleString()}</td>
                              <td className="py-1.5 text-right text-emerald-600 font-bold">฿{cat.profit.toLocaleString()}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
           </div>
         </div>
      </div>

      {/* 3. Top Products & Locations */}
      <TopRankings 
        topProducts={data.topProducts} 
        topLocations={data.topLocations} 
      />
    </div>
  );
};

export default OrdersTab;