import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp } from 'lucide-react';

const CategoryChart = ({ data }) => {
  const [mode, setMode] = useState('sales'); // 'sales' | 'profit'

  // สีสำหรับแต่ละหมวดหมู่ (วนใช้)
  const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  const chartData = data.map(d => ({
    name: d.name,
    value: mode === 'sales' ? d.sales : d.profit
  })).filter(d => d.value > 0); // กรองค่าที่เป็น 0 ออก

  const totalValue = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800">สัดส่วนตามหมวดหมู่</h3>
          <p className="text-xs text-gray-400">วิเคราะห์{mode === 'sales' ? 'ยอดขาย' : 'กำไร'}แยกตามกลุ่มสินค้า</p>
        </div>
        
        {/* Toggle Button */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
           <button 
             onClick={() => setMode('sales')} 
             className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'sales' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
           >
             <DollarSign size={14}/> ยอดขาย
           </button>
           <button 
             onClick={() => setMode('profit')} 
             className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'profit' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
           >
             <TrendingUp size={14}/> กำไร
           </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[300px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              formatter={(value) => `฿${value.toLocaleString()}`}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              formatter={(value, entry) => {
                 const { payload } = entry;
                 const percent = totalValue > 0 ? ((payload.value / totalValue) * 100).toFixed(1) : 0;
                 return <span className="text-xs text-gray-600 ml-1">{value} ({percent}%)</span>;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Text */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[65%] text-center pointer-events-none">
           <p className="text-xs text-gray-400 font-medium">รวม{mode === 'sales' ? 'ยอดขาย' : 'กำไร'}</p>
           <p className={`text-lg font-black ${mode === 'sales' ? 'text-indigo-600' : 'text-emerald-600'}`}>
             {chartData.length > 0 ? `${(totalValue/1000).toFixed(1)}k` : '0'}
           </p>
        </div>
      </div>
    </div>
  );
};

export default CategoryChart;