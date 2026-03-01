import React from 'react';
import { Activity, Shield, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; 

// Imported Refactored Components
import { useDashboardData } from './useDashboardData';
import OverviewTab from './OverviewTab';
import OrdersTab from './OrdersTab';
import ServicesTab from './ServicesTab';
import YearlyOverviewTab from './YearlyOverviewTab';

const DashboardMain = () => {
  const auth = useAuth();
  const role = auth?.role; 
  
  const [activeTab, setActiveTab] = React.useState('overview');
  const [compareMode, setCompareMode] = React.useState('prev_period');
  
  // Use Custom Hook for Data Logic
  const { loading, processedData, yearlyData, dateFilter, setDateFilter } = useDashboardData(undefined); // undefined means default initial filter

  if (loading || !processedData) return <div className="p-10 text-center text-gray-400">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Activity className="text-indigo-600"/> 
          Dashboard ภาพรวม
          {role && (
            <span className="text-sm font-medium bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full flex items-center gap-1 border border-indigo-100">
              <Shield size={14}/> {role.name}
            </span>
          )}
        </h1>
        
        <div className="flex flex-wrap items-center gap-3">
           <div className="relative">
             <Filter size={16} className="absolute left-3 top-3 text-gray-400"/>
             <select 
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="this_month">เดือนนี้</option>
              <option value="last_month">เดือนที่แล้ว</option>
              <option value="Q1">Q1 (ม.ค.-มี.ค.)</option>
              <option value="Q2">Q2 (เม.ย.-มิ.ย.)</option>
              <option value="Q3">Q3 (ก.ค.-ก.ย.)</option>
              <option value="Q4">Q4 (ต.ค.-ธ.ค.)</option>
              <option value="this_year">ปีนี้</option>
            </select>
           </div>
           
           <div className="relative">
            <select 
              className="bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm font-medium outline-none cursor-pointer"
              value={compareMode}
              onChange={(e) => setCompareMode(e.target.value)}
            >
              <option value="prev_period">เปรียบเทียบกับช่วงก่อน</option>
              <option value="none">ไม่เปรียบเทียบ</option>
            </select>
           </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex p-1 bg-gray-100/80 rounded-xl w-fit">
         <button onClick={() => setActiveTab('overview')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>ภาพรวมทั้งหมด</button>
         <button onClick={() => setActiveTab('orders')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>ยอดขายออเดอร์</button>
         <button onClick={() => setActiveTab('services')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'services' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>งานซ่อม/บริการ</button>
         <button onClick={() => setActiveTab('yearly')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'yearly' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>ภาพรวมรายปี</button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'overview' && <OverviewTab data={processedData} compareMode={compareMode} />}
        {activeTab === 'orders' && <OrdersTab data={processedData} loading={loading} />}
        {activeTab === 'services' && <ServicesTab data={processedData} compareMode={compareMode} />}
        {activeTab === 'yearly' && <YearlyOverviewTab yearlyData={yearlyData} />}
      </div>

    </div>
  );
};

export default DashboardMain;