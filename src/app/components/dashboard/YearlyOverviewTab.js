import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, DollarSign, Megaphone, Percent } from 'lucide-react';

const fmt = (v) => `฿${Number(v).toLocaleString()}`;

const CustomTooltipMain = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-semibold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

const CustomTooltipRatio = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      <p className="text-orange-600 font-semibold">{payload[0]?.value ?? 0}%</p>
    </div>
  );
};

const YearlyOverviewTab = ({ yearlyData = [] }) => {
  const year = new Date().getFullYear();

  const totalSales = yearlyData.reduce((s, d) => s + d.sales, 0);
  const totalProfit = yearlyData.reduce((s, d) => s + d.profit, 0);
  const totalMarketing = yearlyData.reduce((s, d) => s + d.marketing, 0);
  const avgRatio = totalSales > 0 ? (totalMarketing / totalSales * 100).toFixed(1) : 0;

  const activeMonths = yearlyData.filter(d => d.sales > 0).length;
  const avgRatioRef = activeMonths > 0
    ? parseFloat((yearlyData.filter(d => d.sales > 0).reduce((s, d) => s + d.marketingRatio, 0) / activeMonths).toFixed(1))
    : 0;

  const kpis = [
    { label: 'ยอดขายรวม', value: fmt(totalSales), icon: <DollarSign size={18} />, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'กำไรสุทธิ', value: fmt(totalProfit), icon: <TrendingUp size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'ค่าการตลาด', value: fmt(totalMarketing), icon: <Megaphone size={18} />, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'สัดส่วนการตลาด/ยอดขาย', value: `${avgRatio}%`, icon: <Percent size={18} />, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4">ภาพรวมปี {year}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className={`flex items-center gap-3 p-3 rounded-xl border ${k.bg} ${k.border}`}>
              <span className={`p-2 rounded-lg bg-white shadow-sm ${k.color}`}>{k.icon}</span>
              <div>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-base font-bold ${k.color}`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart 1: Sales / Profit / Marketing */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">ยอดขาย · กำไร · ค่าการตลาด รายเดือน</h3>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={yearlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip content={<CustomTooltipMain />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sales" name="ยอดขาย" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="profit" name="กำไร" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="marketing" name="ค่าการตลาด" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Marketing Ratio */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-1">สัดส่วนการตลาด / ยอดขาย รายเดือน (%)</h3>
        {avgRatioRef > 0 && (
          <p className="text-xs text-gray-400 mb-4">เส้นประ = ค่าเฉลี่ยรายเดือน ({avgRatioRef}%)</p>
        )}
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={yearlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 'auto']} />
            <Tooltip content={<CustomTooltipRatio />} />
            {avgRatioRef > 0 && (
              <ReferenceLine y={avgRatioRef} stroke="#a78bfa" strokeDasharray="5 5" label={{ value: `เฉลี่ย ${avgRatioRef}%`, fill: '#7c3aed', fontSize: 11, position: 'insideTopRight' }} />
            )}
            <Line type="monotone" dataKey="marketingRatio" name="สัดส่วนการตลาด" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YearlyOverviewTab;
