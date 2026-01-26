import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const SalesChart = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800">แนวโน้มรายได้และกำไร</h3>
        {/* คำอธิบายเส้นเปรียบเทียบ */}
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-indigo-500"></span> 
            <span>ยอดขายปัจจุบัน</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-emerald-500"></span> 
            <span>กำไรสุทธิ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 border-t-2 border-dashed border-gray-400"></span> 
            <span>ช่วงเวลาก่อนหน้า (เปรียบเทียบ)</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#9ca3af' }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={(value) => `${value/1000}k`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              formatter={(value, name) => [
                `฿${Number(value).toLocaleString()}`, 
                name === 'prevSales' ? 'ช่วงก่อนหน้า' : name === 'sales' ? 'ยอดขาย' : 'กำไร'
              ]}
            />
            
            {/* เส้นเปรียบเทียบ (ช่วงก่อนหน้า) - เส้นประ */}
            <Area 
              type="monotone" 
              dataKey="prevSales" 
              name="prevSales"
              stroke="#94a3b8" 
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="transparent" 
              activeDot={false}
            />

            {/* เส้นปัจจุบัน */}
            <Area 
              type="monotone" 
              dataKey="sales" 
              name="sales"
              stroke="#6366f1" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorSales)" 
            />
            <Area 
              type="monotone" 
              dataKey="profit" 
              name="profit"
              stroke="#10b981" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorProfit)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesChart;