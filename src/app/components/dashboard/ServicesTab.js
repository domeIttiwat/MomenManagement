import React from 'react';
import { Wrench, DollarSign, TrendingUp, Users } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import KpiCard from './KpiCard';

const ServicesTab = ({ data, compareMode }) => {
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard 
              title="งานซ่อมทั้งหมด" 
              value={data.serviceStats.totalJobs} 
              growth={data.serviceStats.jobsGrowth}
              icon={Wrench}
              color="bg-indigo-50 text-indigo-600"
              compareMode={compareMode}
            />
            <KpiCard 
              title="รายได้งานซ่อม (รับจริง)" 
              value={`฿${data.serviceStats.totalRevenue.toLocaleString()}`} 
              growth={data.serviceStats.revenueGrowth}
              icon={DollarSign}
              color="bg-emerald-50 text-emerald-600"
              subtext2={data.serviceStats.outstanding > 0 ? `ค้าง: ฿${data.serviceStats.outstanding.toLocaleString()}` : null}
              compareMode={compareMode}
            />
            <KpiCard 
              title="กำไรขั้นต้น (Est.)" 
              value={`฿${data.serviceStats.totalProfit.toLocaleString()}`} 
              growth={data.serviceStats.profitGrowth}
              icon={TrendingUp}
              color="bg-amber-50 text-amber-600"
              compareMode={compareMode}
            />
            <KpiCard 
              title="เฉลี่ยต่อคัน" 
              value={`฿${Math.round(data.serviceStats.avgTicket).toLocaleString()}`} 
              growth={0} // ยังไม่ได้ทำ logic เทียบ avg
              icon={Users}
              color="bg-blue-50 text-blue-600"
              compareMode={compareMode}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Service Revenue Trend */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-[400px]">
              <h3 className="font-bold text-gray-800 mb-6">แนวโน้มรายได้งานซ่อม</h3>
              <ResponsiveContainer width="100%" height="85%">
                  <AreaChart data={data.chartData}>
                      <defs>
                        <linearGradient id="colorSrv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                      <Tooltip contentStyle={{borderRadius:'12px'}} formatter={(val)=>[val.toLocaleString(), 'บาท']} />
                      <Area type="monotone" dataKey="serviceSales" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorSrv)" />
                  </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Status Pie Chart */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-[400px]">
              <h3 className="font-bold text-gray-800 mb-6">สถานะงานซ่อม</h3>
              <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie
                        data={data.serviceStats.statusData}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                        paddingAngle={5} dataKey="value"
                    >
                        {data.serviceStats.statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
              </ResponsiveContainer>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Technician Performance */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6">ประสิทธิภาพทีมช่าง (Top Active Technicians)</h3>
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.serviceStats.technicianData} layout="vertical" margin={{left: 20}}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                    <XAxis type="number" hide/>
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/>
                    <Tooltip cursor={{fill: 'transparent'}}/>
                    <Bar dataKey="jobs" fill="#6366f1" radius={[0, 4, 4, 0]} name="จำนวนงาน" barSize={20} />
                  </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue Composition */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6">สัดส่วนรายได้ (ค่าแรง vs ค่าอะไหล่)</h3>
              <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                        data={data.serviceStats.revenueCompositionData}
                        cx="50%" cy="50%" outerRadius={100}
                        dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                        <Cell fill="#3b82f6" /> {/* ค่าแรง */}
                        <Cell fill="#f59e0b" /> {/* ค่าอะไหล่ */}
                    </Pie>
                    <Tooltip formatter={(val)=>[val.toLocaleString(), 'บาท']} />
                  </PieChart>
              </ResponsiveContainer>
            </div>
        </div>
    </div>
  );
};

export default ServicesTab;