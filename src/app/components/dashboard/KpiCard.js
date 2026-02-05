import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const KpiCard = ({ title, value, growth, icon: Icon, color, subtext, subtext2, compareMode = 'prev_period' }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start justify-between">
    <div>
      <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-black text-gray-800">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      {subtext2 && <p className="text-xs text-red-500 mt-0.5">{subtext2}</p>}
      {!subtext && !subtext2 && compareMode !== 'none' && growth !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {growth >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
          <span>{Math.abs(growth).toFixed(1)}%</span>
          <span className="text-gray-400 font-normal">เทียบช่วงก่อน</span>
        </div>
      )}
    </div>
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} />
    </div>
  </div>
);

export default KpiCard;