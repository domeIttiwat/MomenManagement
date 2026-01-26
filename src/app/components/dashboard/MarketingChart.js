import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const MarketingChart = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800">ประสิทธิภาพการตลาด (ROI)</h3>
        <p className="text-xs text-gray-400">งบการตลาด (แท่งชมพู) เทียบกับ ยอดขายที่ได้ (เส้นม่วง)</p>
      </div>

      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10}/>
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#ec4899' }} tickFormatter={(val)=>`${val/1000}k`}/>
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6366f1' }} tickFormatter={(val)=>`${val/1000}k`}/>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              formatter={(value) => `฿${Number(value).toLocaleString()}`}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
            <Bar yAxisId="left" dataKey="marketingCost" name="งบการตลาด" barSize={12} fill="#ec4899" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="sales" name="ยอดขาย" stroke="#6366f1" strokeWidth={3} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MarketingChart;