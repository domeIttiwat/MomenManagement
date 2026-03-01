import React from 'react';
import { 
  ShoppingBag, FileText, DollarSign, Activity, ArrowRight, UserCheck, AlertCircle, Megaphone 
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Line, Area, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend 
} from 'recharts';
import TopRankings from './TopRankings';

const OrdersTab = ({ data, loading }) => {
  if (!data || !data.orderStats) return null;

  const { orderStats, chartData } = data;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      
      {/* 1. Quotation & Overview Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
         {/* Quotation Card */}
         <div className="lg:col-span-1 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
             <div className="absolute -top-4 -right-4 p-4 opacity-10"><FileText size={120}/></div>
             <div>
                <h3 className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText size={14}/> ใบเสนอราคา (Quotations)
                </h3>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black">{orderStats?.quotation?.count || 0}</p>
                    <span className="text-xs text-gray-400">รายการ</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">มูลค่ารวม ฿{(orderStats?.quotation?.totalValue || 0).toLocaleString()}</p>
             </div>
             <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-xs">
                   <span className="text-gray-300">โอกาสทำกำไร:</span>
                   <span className="font-bold text-green-400">+฿{(orderStats?.quotation?.potentialProfit || 0).toLocaleString()}</span>
                </div>
             </div>
         </div>

         {/* Marketing Cost Card */}
         <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
             <div>
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Megaphone size={14}/> งบโฆษณา (Ad Spend)
                </h3>
                <h3 className="text-3xl font-black text-rose-600">฿{orderStats?.marketingCost?.toLocaleString()}</h3>
             </div>
             <p className="text-xs text-gray-500 mt-2 bg-rose-50 px-2 py-1 rounded w-fit text-rose-700 font-bold">
                 {orderStats?.marketingPercent}% ของยอดขาย
             </p>
         </div>

         {/* Profit Breakdown Flow */}
         <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                <Activity size={16} className="text-indigo-500"/> โครงสร้างกำไร (Profit Breakdown)
             </h3>
             
             <div className="flex items-center justify-between gap-2 text-center w-full text-xs md:text-sm">
                 <div className="flex-1">
                     <p className="text-gray-500 mb-1">ยอดขาย</p>
                     <p className="font-bold text-gray-900">฿{orderStats?.salesValue?.toLocaleString()}</p>
                 </div>
                 <ArrowRight size={14} className="text-gray-300" />
                 <div className="flex-1">
                     <p className="text-amber-600 mb-1">กำไรขั้นต้น</p>
                     <p className="font-bold text-amber-800">฿{orderStats?.grossProfit?.toLocaleString()}</p>
                 </div>
                 <ArrowRight size={14} className="text-gray-300" />
                 <div className="flex-1">
                     <p className="text-emerald-600 mb-1 font-bold">กำไรสุทธิ</p>
                     <p className="font-black text-emerald-700 text-lg">฿{orderStats?.netProfit?.toLocaleString()}</p>
                 </div>
             </div>
             <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden flex">
                 <div className="bg-red-400 h-full" style={{width: `${100 - parseFloat(orderStats?.grossMargin || 0)}%`}} title="ต้นทุนสินค้า"></div>
                 <div className="bg-pink-400 h-full" style={{width: `${parseFloat(orderStats?.marketingPercent || 0)}%`}} title="ค่าการตลาด"></div>
                 <div className="bg-emerald-500 h-full flex-1" title="กำไรสุทธิ"></div>
             </div>
             <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                 <span>ต้นทุนสินค้า</span>
                 <span>การตลาด</span>
                 <span className="text-emerald-600 font-bold">Net {orderStats?.netMargin}%</span>
             </div>
         </div>
      </div>

      {/* 2. Marketing Chart (Full Width) */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[500px] flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Activity size={20} className="text-rose-500"/> ประสิทธิภาพการตลาด (ROI)
                </h3>
                <p className="text-xs text-gray-500 mt-1">เทียบ งบการตลาด (แกนขวา) กับ ยอดขาย/กำไร (แกนซ้าย)</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-rose-600">{orderStats?.roas}x</p>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">ROAS</p>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                    <defs>
                    <linearGradient id="colorMktSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#f43f5e'}} />
                    <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}} 
                        formatter={(value, name) => [`฿${value.toLocaleString()}`, name]} 
                    />
                    <Legend verticalAlign="top" height={36}/>
                    
                    <Area yAxisId="left" type="monotone" dataKey="sales" name="ยอดขาย" stroke="#10b981" fill="url(#colorMktSales)" strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="profit" name="กำไรสุทธิ" stroke="#3b82f6" strokeWidth={3} dot={false} />
                    
                    {/* Previous Period Sales Comparison */}
                    {chartData[0]?.prevOrderSales !== undefined && (
                        <Line yAxisId="left" type="monotone" dataKey="prevOrderSales" name="ยอดขายช่วงก่อน" stroke="#9ca3af" strokeDasharray="5 5" dot={false} strokeWidth={2}/>
                    )}

                    <Bar yAxisId="right" dataKey="marketingCost" name="งบการตลาด" fill="#f43f5e" barSize={20} radius={[4, 4, 0, 0]} opacity={0.8} />
                </ComposedChart>
                </ResponsiveContainer>
            </div>
      </div>

      {/* Top Rankings (Only Locations) */}
      <TopRankings
        topScooters={data.topScooters || []}
        topAccessories={data.topAccessories || []}
        topLocations={data.topLocations}
      />
    </div>
  );
};

export default OrdersTab;