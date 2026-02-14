import React, { useState } from 'react';
import { CheckSquare, User, Box, CheckCircle2, Circle, Lock, Wrench, AlertTriangle, ClipboardList, AlertCircle, Filter, ListFilter, X, Package, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ServiceTeamSelector from '../services/ServiceTeamSelector'; 

const AssemblyTaskTable = ({ jobs, activeTab, onUpdateJob, currentUser }) => {
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [activeAssigneeId, setActiveAssigneeId] = useState(null); // เก็บ ID ของรายการที่กำลังเปิดเลือกคน

  // 1. Flatten Jobs to Tasks
  const getAllTasks = () => {
      const tasks = [];
      if (!jobs) return tasks;

      jobs.forEach(job => {
          if (job.checklists && job.checklists.length > 0) {
              job.checklists.forEach(item => {
                  let statusInTab = 'unknown';
                  const isPrepared = item.is_checked;
                  const isAssembled = item.is_assembled;
                  const isPassed = item.status === 'passed';

                  if (activeTab === 'preparing') statusInTab = isPrepared ? 'done' : 'todo';
                  else if (activeTab === 'assembling') {
                      if (!isPrepared) statusInTab = 'waiting'; 
                      else if (isAssembled) statusInTab = 'done';
                      else statusInTab = 'todo'; 
                  } else if (activeTab === 'testing') {
                      if (!isAssembled) statusInTab = 'waiting'; 
                      else if (isPassed) statusInTab = 'done';
                      else statusInTab = 'todo'; 
                  } else if (activeTab === 'completed') statusInTab = isPassed ? 'done' : 'waiting';

                  if (shouldShow(statusInTab)) {
                      tasks.push({
                          ...item,
                          jobId: job.id,
                          jobName: job.job_name,
                          jobRefId: job.ref_id,
                          jobRefType: job.ref_type,
                          parentJob: job,
                          currentStatus: statusInTab,
                          isVirtual: false
                      });
                  }
              });
          } else {
              // Virtual Task Logic (เหมือนเดิม)
              let statusInTab = activeTab === 'preparing' ? 'todo' : 'waiting';
              if (shouldShow(statusInTab)) {
                  tasks.push({
                      id: `virtual-${job.id}`,
                      name: job.job_name || 'งานหลัก (Main Task)',
                      quantity: 1,
                      jobId: job.id,
                      jobName: 'การ์ดหลัก',
                      parentJob: job,
                      currentStatus: statusInTab,
                      isVirtual: true,
                      is_checked: false
                  });
              }
          }
      });
      return tasks;
  };

  const shouldShow = (status) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'todo') return status === 'todo';
      if (filterStatus === 'waiting') return status === 'waiting';
      if (filterStatus === 'done') return status === 'done';
      return false;
  };

  const tasks = getAllTasks();

  // 2. Actions
  const handleToggleTask = async (task) => {
      if (task.currentStatus === 'waiting') return;
      const job = task.parentJob;
      const checklists = job.checklists || [];
      
      if (task.isVirtual) {
          if (activeTab !== 'preparing') return;
          const newItem = {
            id: `main-${Date.now()}`,
            name: 'งานหลัก (Main Task)',
            quantity: 1,
            is_checked: true,
            checked_by: currentUser,
            is_assembled: false,
            type: 'main'
          };
          const newChecklists = [...checklists, newItem];
          onUpdateJob({ ...job, checklists: newChecklists });
          await supabase.from('assembly_jobs').update({ checklists: newChecklists }).eq('id', job.id);
          return;
      }

      if (activeTab === 'preparing' && task.type === 'main' && task.is_checked) {
           const newChecklists = checklists.filter(i => i.id !== task.id);
           onUpdateJob({ ...job, checklists: newChecklists });
           await supabase.from('assembly_jobs').update({ checklists: newChecklists }).eq('id', job.id);
           return;
      }

      let updates = {};
      if (activeTab === 'preparing') updates = { is_checked: !task.is_checked, checked_by: !task.is_checked ? currentUser : null };
      else if (activeTab === 'assembling') updates = { is_assembled: !task.is_assembled, assembled_by: !task.is_assembled ? currentUser : null };
      else if (activeTab === 'testing') {
          const newStatus = task.status === 'passed' ? 'normal' : 'passed';
          updates = { status: newStatus, qc_by: newStatus === 'passed' ? currentUser : null };
      }

      const newChecklists = checklists.map(i => i.id === task.id ? { ...i, ...updates } : i);
      onUpdateJob({ ...job, checklists: newChecklists });
      await supabase.from('assembly_jobs').update({ checklists: newChecklists }).eq('id', job.id);
  };

  // ✅ ฟังก์ชันกำหนดผู้รับผิดชอบ (เหมือนใน Card)
  const handleAssignSubTask = async (task, user) => {
      const job = task.parentJob;
      const checklists = job.checklists;

      const newChecklists = checklists.map(item => 
          item.id === task.id ? { ...item, assignee: user } : item
      );

      // Update UI & DB
      onUpdateJob({ ...job, checklists: newChecklists });
      await supabase.from('assembly_jobs').update({ checklists: newChecklists }).eq('id', job.id);
      
      setActiveAssigneeId(null); // ปิด Popover
  };

  const FilterOptions = () => (
      <div className="flex bg-[#161a1d] p-1 rounded-lg border border-white/10">
          {[
              { id: 'all', label: 'ทั้งหมด', icon: ListFilter },
              { id: 'todo', label: 'ต้องทำ', icon: Circle },
              { id: 'waiting', label: 'รอเตรียม', icon: Lock },
              { id: 'done', label: 'เสร็จแล้ว', icon: CheckCircle2 },
          ].map(opt => (
              <button
                  key={opt.id}
                  onClick={() => setFilterStatus(opt.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      filterStatus === opt.id 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                  <opt.icon size={12}/> {opt.label}
              </button>
          ))}
      </div>
  );

  if (tasks.length === 0) {
    return (
        <div className="mt-8 mb-20 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 mb-4 px-2 opacity-60">
                <CheckSquare className="text-gray-400" size={20}/>
                <h3 className="text-gray-400 font-bold text-lg">สรุปรายการงานย่อย (Task Summary)</h3>
            </div>
            <div className="bg-[#22272b] rounded-xl border border-white/5 border-dashed p-10 flex flex-col items-center justify-center text-gray-500">
                <ClipboardList size={32} className="mb-2 opacity-20"/>
                <p className="text-sm">ไม่มีรายการในขั้นตอน {activeTab.toUpperCase()}</p>
            </div>
        </div>
    );
  }

  return (
    <div className="mt-8 mb-20 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 px-2">
            <div className="flex items-center gap-2">
                <CheckSquare className="text-blue-400" size={20}/>
                <h3 className="text-gray-200 font-bold text-lg">สรุปรายการงานย่อย (Task Summary)</h3>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{tasks.length} รายการ</span>
            </div>
            <FilterOptions />
        </div>

        <div className="bg-[#22272b] rounded-xl border border-white/10 shadow-lg overflow-visible"> {/* overflow-visible เพื่อให้ Popover ไม่โดนบัง */}
            <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-[#1c2024] text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/10">
                        <tr>
                            <th className="px-4 py-3 w-12 text-center">#</th>
                            <th className="px-4 py-3">รายการ (Item)</th>
                            <th className="px-4 py-3 text-center">จำนวน</th>
                            <th className="px-4 py-3">งานหลัก (Parent Job)</th>
                            <th className="px-4 py-3 text-center">สถานะ ({activeTab})</th>
                            <th className="px-4 py-3 w-40">ผู้รับผิดชอบ</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-white/5">
                        {tasks.map((task, idx) => {
                            let statusIcon = <Circle size={16} className="text-gray-600"/>;
                            let isDone = task.currentStatus === 'done';
                            let isWaiting = task.currentStatus === 'waiting';
                            let rowClass = "hover:bg-[#2c333a] transition-colors group";

                            if (task.isVirtual) {
                                if (activeTab === 'preparing') statusIcon = <Plus size={16} className="text-blue-500"/>;
                                else statusIcon = <Lock size={16} className="text-gray-600"/>;
                            } else {
                                if (activeTab === 'preparing') statusIcon = isDone ? <CheckCircle2 size={18} className="text-green-500"/> : <Circle size={18} className="text-gray-500 group-hover:text-white"/>;
                                else if (activeTab === 'assembling') statusIcon = isWaiting ? <Lock size={16} className="text-gray-600"/> : (isDone ? <CheckCircle2 size={18} className="text-cyan-500"/> : <Wrench size={16} className="text-gray-500 group-hover:text-cyan-300"/>);
                                else if (activeTab === 'testing') statusIcon = isWaiting ? <Lock size={16} className="text-gray-600"/> : (isDone ? <CheckCircle2 size={18} className="text-green-500"/> : <AlertTriangle size={16} className="text-gray-500 group-hover:text-purple-300"/>);
                            }

                            if (isDone) rowClass += " bg-green-900/5 opacity-80";
                            else if (isWaiting) rowClass += " opacity-50 bg-black/20";
                            if (task.status === 'rejected') rowClass += " bg-red-900/10 border-l-2 border-red-500 opacity-100";

                            return (
                                <tr key={`${task.jobId}-${task.id}`} className={rowClass}>
                                    <td className="px-4 py-3 text-gray-600 font-mono text-xs text-center">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <div className={`font-medium flex items-center gap-2 ${isDone ? 'text-gray-500 line-through' : (isWaiting ? 'text-gray-500' : 'text-gray-200')}`}>
                                            {task.isVirtual && <Package size={14} className="text-blue-400"/>}
                                            {task.name}
                                            {isWaiting && <span className="text-[9px] bg-gray-700 text-gray-400 px-1.5 rounded">รอขั้นตอนก่อน</span>}
                                            {task.isVirtual && <span className="text-[9px] bg-blue-900/30 text-blue-300 px-1.5 rounded border border-blue-800">สร้างงานหลัก</span>}
                                        </div>
                                        {task.status === 'rejected' && <div className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={10}/> แก้ไข: {task.reject_reason}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded text-xs font-mono">x{task.quantity}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-xs text-blue-300 font-medium truncate max-w-[200px]">{task.jobName || 'งานไม่ระบุชื่อ'}</div>
                                        <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-mono">
                                            <Box size={10}/> {task.jobRefType?.toUpperCase()} #{task.jobRefId}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => handleToggleTask(task)} className={`p-1.5 rounded-full transition-colors ${isWaiting ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10'}`} disabled={isWaiting}>
                                            {statusIcon}
                                        </button>
                                    </td>
                                    
                                    {/* ✅ Assignee Column with Popover */}
                                    <td className="px-4 py-3 relative">
                                        {!task.isVirtual && !isWaiting && (
                                            <>
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setActiveAssigneeId(activeAssigneeId === task.id ? null : task.id); 
                                                    }}
                                                    className={`flex items-center gap-2 px-2 py-1 rounded-full border transition-all ${
                                                        task.assignee 
                                                        ? 'bg-blue-600/10 border-blue-500/30 text-blue-300 hover:bg-blue-600/20' 
                                                        : 'bg-transparent border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300'
                                                    }`}
                                                >
                                                    {task.assignee ? (
                                                        <>
                                                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[8px] text-white overflow-hidden">
                                                                {task.assignee.avatar_url ? <img src={task.assignee.avatar_url} className="w-full h-full object-cover"/> : task.assignee.first_name?.[0]}
                                                            </div>
                                                            <span className="text-xs font-medium max-w-[80px] truncate">{task.assignee.first_name}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <User size={14}/> 
                                                            <span className="text-[10px]">ระบุคน</span>
                                                        </>
                                                    )}
                                                </button>

                                                {/* Popover */}
                                                {activeAssigneeId === task.id && (
                                                    <div className="absolute right-0 top-10 z-[100] w-56 p-2 bg-[#282e33] border border-gray-600 rounded-xl shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                                        <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-600">
                                                            <span className="text-xs font-bold text-gray-400">เลือกผู้รับผิดชอบ</span>
                                                            <button onClick={() => setActiveAssigneeId(null)}><X size={14} className="text-gray-400 hover:text-white"/></button>
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                            <ServiceTeamSelector 
                                                                assignees={[]} 
                                                                onChange={(val) => {
                                                                    if (val.length > 0) handleAssignSubTask(task, val[val.length-1].user);
                                                                }} 
                                                            />
                                                            {task.assignee && (
                                                                <button onClick={() => handleAssignSubTask(task, null)} className="w-full text-center text-[10px] text-red-400 hover:bg-white/5 py-1.5 rounded mt-1 border border-transparent hover:border-red-900/30">
                                                                    เอาออก (Unassign)
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default AssemblyTaskTable;