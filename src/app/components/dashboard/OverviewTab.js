import React from 'react';
import { DollarSign, TrendingUp, ShoppingBag, Wrench, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell } from 'recharts';
import KpiCard from './KpiCard';

const OverviewTab = ({ data, compareMode }) => {
  if (!data) return <div className="p-8 text-center text-gray-400">กำลังโหลดข้อมูล...</div>;

  const { overviewStats, chartData } = data;
  const COLORS = ['#10b981', '#f97316']; 

  const revenueShareData = [
      { name: 'ยอดขายออเดอร์', value: overviewStats?.orderRevenue || 0 },
      { name: 'ยอดขายงานซ่อม', value: overviewStats?.serviceRevenue || 0 }
  ];

  const profitShareData = [
      { name: 'กำไรออเดอร์', value: overviewStats?.orderProfit || 0 },
      { name: 'กำไรงานซ่อม', value: overviewStats?.serviceProfit || 0 }
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard 
              title="รายรับรวมทั้งหมด (รับจริง)" 
              value={`฿${(overviewStats?.totalRevenue || 0).toLocaleString()}`} 
              growth={overviewStats?.revenueGrowth}
              icon={DollarSign}
              color="bg-indigo-50 text-indigo-600"
              subtext2={overviewStats?.totalOutstanding > 0 ? `ค้างชำระรวม: ฿${overviewStats.totalOutstanding.toLocaleString()}` : null}
              compareMode={compareMode}
            />
            <KpiCard 
              title="กำไรรวมสุทธิ (Net Profit)" 
              value={`฿${(overviewStats?.netProfit || 0).toLocaleString()}`} 
              icon={TrendingUp}
              color="bg-emerald-50 text-emerald-600"
              compareMode={compareMode}
            />
            <KpiCard 
              title="งบการตลาดที่ใช้" 
              value={`฿${(overviewStats?.marketingCost || 0).toLocaleString()}`} 
              icon={Activity}
              color="bg-rose-50 text-rose-600"
              subtext="(หักลบในกำไรสุทธิแล้ว)"
              compareMode={compareMode}
            />
      </div>
      
      {/* Detailed Breakdown with Percentages */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard 
              title="ยอดขาย (ออเดอร์)" 
              value={`฿${(overviewStats?.orderRevenue || 0).toLocaleString()}`} 
              icon={ShoppingBag}
              color="bg-emerald-50 text-emerald-600"
              growth={data.orderStats?.revenueGrowth}
              subtext={`${overviewStats?.orderRevenueShare || 0}% ของรายรับรวม`}
              subtext2={overviewStats?.orderOutstanding > 0 ? `ค้าง: ฿${overviewStats.orderOutstanding.toLocaleString()}` : null}
              compareMode={compareMode}
            />
            <KpiCard 
              title="ยอดขาย (งานซ่อม)" 
              value={`฿${(overviewStats?.serviceRevenue || 0).toLocaleString()}`} 
              icon={Wrench}
              color="bg-orange-50 text-orange-600"
              growth={data.serviceStats?.revenueGrowth}
              subtext={`${overviewStats?.serviceRevenueShare || 0}% ของรายรับรวม`}
              subtext2={overviewStats?.serviceOutstanding > 0 ? `ค้าง: ฿${overviewStats.serviceOutstanding.toLocaleString()}` : null}
              compareMode={compareMode}
            />
            <KpiCard 
              title="กำไร (ออเดอร์)" 
              value={`฿${(overviewStats?.orderProfit || 0).toLocaleString()}`} 
              icon={TrendingUp}
              color="bg-emerald-50 text-emerald-600"
              growth={overviewStats?.orderProfitGrowth}
              subtext={`${overviewStats?.orderProfitShare || 0}% ของกำไรรวม`}
              compareMode={compareMode}
            />
            <KpiCard 
              title="กำไร (งานซ่อม)" 
              value={`฿${(overviewStats?.serviceProfit || 0).toLocaleString()}`} 
              icon={TrendingUp}
              color="bg-orange-50 text-orange-600"
              growth={overviewStats?.serviceProfitGrowth}
              subtext={`${overviewStats?.serviceProfitShare || 0}% ของกำไรรวม`}
              compareMode={compareMode}
            />
      </div>

      {/* Share Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <h3 className="text-gray-700 font-bold mb-2">สัดส่วนรายได้ (Revenue Share)</h3>
                  <div className="flex flex-col gap-2 text-sm">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> ออเดอร์: {overviewStats?.orderRevenueShare}%</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div> งานซ่อม: {overviewStats?.serviceRevenueShare}%</div>
                  </div>
              </div>
              <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie 
                            data={revenueShareData} 
                            dataKey="value" 
                            cx="50%" cy="50%" 
                            innerRadius={30} 
                            outerRadius={50}
                            paddingAngle={5}
                          >
                              {revenueShareData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}
                          </Pie>
                          <Tooltip formatter={(val) => `฿${val.toLocaleString()}`} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <h3 className="text-gray-700 font-bold mb-2">สัดส่วนกำไร (Profit Share)</h3>
                  <div className="flex flex-col gap-2 text-sm">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> ออเดอร์: {overviewStats?.orderProfitShare}%</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div> งานซ่อม: {overviewStats?.serviceProfitShare}%</div>
                  </div>
              </div>
              <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie 
                            data={profitShareData} 
                            dataKey="value" 
                            cx="50%" cy="50%" 
                            innerRadius={30} 
                            outerRadius={50}
                            paddingAngle={5}
                          >
                              {profitShareData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}
                          </Pie>
                          <Tooltip formatter={(val) => `฿${val.toLocaleString()}`} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
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