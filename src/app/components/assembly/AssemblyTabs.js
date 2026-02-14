import React from 'react';
import { Box, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';

const tabs = [
  { id: 'preparing', label: 'เตรียมของ (Prep)', icon: Box, color: 'text-amber-400', border: 'border-amber-500' },
  { id: 'assembling', label: 'การประกอบ (Assembly)', icon: Wrench, color: 'text-cyan-400', border: 'border-cyan-500' },
  { id: 'testing', label: 'ตรวจสอบ (QC)', icon: AlertTriangle, color: 'text-purple-400', border: 'border-purple-500' },
  { id: 'completed', label: 'เสร็จสิ้น (Done)', icon: CheckCircle2, color: 'text-green-400', border: 'border-green-500' },
];

const AssemblyTabs = ({ activeTab, onTabChange, jobs }) => {
  const getCount = (tabId) => {
      if (tabId === 'preparing') return jobs.filter(j => j.stage === 'preparing' || j.stage === 'assembling').length;
      if (tabId === 'assembling') return jobs.filter(j => (j.stage === 'preparing' || j.stage === 'assembling') && (j.checklists && j.checklists.length > 0)).length;
      return jobs.filter(j => j.stage === tabId).length;
  };

  return (
    <div className="flex gap-2 bg-[#22272b] p-1.5 rounded-xl border border-white/10 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const count = getCount(tab.id);
            return (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`
                        flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all min-w-[160px]
                        ${isActive 
                            ? `bg-[#323940] text-white shadow-md border-b-4 ${tab.border}` 
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border-b-4 border-transparent'
                        }
                    `}
                >
                    <tab.icon size={16} className={isActive ? tab.color : 'text-gray-500'}/>
                    <span>{tab.label}</span>
                    {count > 0 && <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/10 text-white' : 'bg-black/30 text-gray-500'}`}>{count}</span>}
                </button>
            );
        })}
    </div>
  );
};

export default AssemblyTabs;