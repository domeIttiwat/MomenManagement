import React from 'react';
import { 
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Activity, DollarSign, TrendingUp } from 'lucide-react';

const MarketingChart = ({ data, stats }) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Activity size={20} className="text-rose-500"/> ประสิทธิภาพการตลาด (ROI)
          </h3>
          <p className="text-xs text-gray-500 mt-1">เทียบ งบการตลาด (แกนขวา) กับ ยอดขาย/กำไร (แกนซ้าย)</p>
        </div>
        <div className="text-right">
           <p className="text-2xl font-black text-rose-600">{stats?.roas}x</p>
           <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">ROAS</p>
           
           <p className="text-xs text-indigo-600 mt-1 font-medium bg-indigo-50 px-2 py-0.5 rounded">
              Cost: {stats?.marketingPercent}% of Sales
           </p>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="colorMktSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
            
            <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 12, fill: '#9ca3af'}} 
                dy={10} 
            />
            
            {/* แกนซ้าย: สำหรับยอดขายและกำไร */}
            <YAxis 
                yAxisId="left"
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 12, fill: '#9ca3af'}} 
            />

            {/* แกนขวา: สำหรับงบการตลาด (สีแดง) */}
            <YAxis 
                yAxisId="right" 
                orientation="right" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 12, fill: '#f43f5e'}}
            />

            <Tooltip 
              contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}}
              formatter={(value, name) => [`฿${value.toLocaleString()}`, name]}
            />
            <Legend verticalAlign="top" height={36}/>
            
            {/* ยอดขาย (แกนซ้าย) */}
            <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="sales" 
                name="ยอดขาย" 
                stroke="#10b981" 
                fill="url(#colorMktSales)" 
                strokeWidth={2} 
            />
            
            {/* กำไร (แกนซ้าย) */}
            <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="profit" 
                name="กำไรสุทธิ" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={false} 
            />
            
            {/* งบการตลาด (แกนขวา) - ทำให้กราฟดูสูงขึ้นเพราะใช้สเกลตัวเอง */}
            <Bar 
                yAxisId="right"
                dataKey="marketingCost" 
                name="งบการตลาด" 
                fill="#f43f5e" 
                barSize={20} 
                radius={[4, 4, 0, 0]} 
                opacity={0.8}
            />
            
            {/* เปรียบเทียบยอดขายเก่า (แกนซ้าย) */}
            {data[0]?.prevOrderSales !== undefined && (
                <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="prevOrderSales" 
                    name="ยอดขายช่วงก่อน" 
                    stroke="#9ca3af" 
                    strokeDasharray="5 5" 
                    dot={false} 
                    strokeWidth={2} 
                />
            )}
            
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MarketingChart;