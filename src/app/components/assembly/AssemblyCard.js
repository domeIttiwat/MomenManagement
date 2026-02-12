import React, { useState, useEffect } from 'react';
import { User, AlertTriangle, Clock, Package, CheckSquare, ChevronDown, ChevronUp, Trash2, CheckCircle2, Circle, Plus, History, X, Lock, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ServiceTeamSelector from '../services/ServiceTeamSelector'; 

const AssemblyCard = ({ job, isDragging, onUpdate, onAddPart }) => {
  const [details, setDetails] = useState(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [qcNote, setQcNote] = useState('');
  const [activeAssigneeItem, setActiveAssigneeItem] = useState(null);

  useEffect(() => {
     const fetchDetails = async () => {
         const table = job.ref_type === 'order' ? 'orders' : 'services';
         const { data } = await supabase.from(table).select('id, customer_cache, ' + (job.ref_type === 'order' ? 'order_number' : 'service_number')).eq('id', job.ref_id).single();
         if (data) setDetails(data);
     };
     if (job.ref_id) fetchDetails();
  }, [job.ref_type, job.ref_id]);

  const number = details ? (job.ref_type === 'order' ? details.order_number : details.service_number) : '...';
  const customerName = details?.customer_cache ? `${details.customer_cache.first_name} ${details.customer_cache.last_name}` : '...';

  const checklists = job.checklists || [];
  const totalChecks = checklists.length;
  
  // คำนวณ Progress ตาม Stage
  let checkedCount = 0;
  if (job.stage === 'preparing') {
      checkedCount = checklists.filter(c => c.is_checked).length;
  } else {
      // ในขั้นตอนประกอบ/QC ให้นับจากสิ่งที่ประกอบเสร็จแล้ว
      checkedCount = checklists.filter(c => c.is_assembled).length;
  }
  const progress = totalChecks === 0 ? 0 : Math.round((checkedCount / totalChecks) * 100);

  // --- Logic การติ๊กงานแบบ 2 Step ---
  const handleToggleCheck = async (itemId) => {
    const item = checklists.find(i => i.id === itemId);
    if (!item) return;

    let updates = {};

    if (job.stage === 'preparing') {
        // Stage เตรียมของ: ติ๊กเพื่อบอกว่า "เตรียมแล้ว"
        updates = { is_checked: !item.is_checked };
    } else if (job.stage === 'assembling') {
        // Stage ประกอบ: 
        // ถ้ายังไม่เตรียม (is_checked = false) -> ห้ามติ๊ก (Return เลย)
        if (!item.is_checked) return;
        
        // ถ้าเตรียมแล้ว -> ติ๊กเพื่อบอกว่า "ประกอบแล้ว"
        updates = { is_assembled: !item.is_assembled };
    } else {
        // Stage อื่นๆ -> แก้สถานะประกอบได้
        updates = { is_assembled: !item.is_assembled };
    }

    const newChecklists = checklists.map(i => i.id === itemId ? { ...i, ...updates } : i);
    updateJob({ checklists: newChecklists });
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('ลบรายการนี้?')) return;
    const newChecklists = checklists.filter(item => item.id !== itemId);
    updateJob({ checklists: newChecklists });
  };

  const handleAssignSubTask = async (itemId, user) => {
      const newChecklists = checklists.map(item => item.id === itemId ? { ...item, assignee: user } : item);
      updateJob({ checklists: newChecklists });
      setActiveAssigneeItem(null);
  };

  const updateJob = async (updates) => {
    onUpdate({ ...job, ...updates }); 
    await supabase.from('assembly_jobs').update(updates).eq('id', job.id);
  };

  const handleQCPass = async () => {
     if(!confirm('ยืนยันผลการทดสอบ: ผ่าน?')) return;
     updateJob({ stage: 'completed', completed_at: new Date().toISOString() });
  };

  const handleQCFail = async () => {
     if (!qcNote.trim()) return alert('ระบุสิ่งที่ต้องแก้');
     const newLog = { date: new Date().toISOString(), note: qcNote, reporter: 'QC' };
     updateJob({ stage: 'assembling', is_rework: true, qc_logs: [...(job.qc_logs || []), newLog] });
     setQcNote('');
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'preparing': return { border: 'border-l-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10', bar: 'bg-amber-500' };
      case 'assembling': return { border: 'border-l-cyan-500', text: 'text-cyan-500', bg: 'bg-cyan-500/10', bar: 'bg-cyan-500' };
      case 'testing': return { border: 'border-l-purple-500', text: 'text-purple-500', bg: 'bg-purple-500/10', bar: 'bg-purple-500' };
      case 'completed': return { border: 'border-l-lime-500', text: 'text-lime-500', bg: 'bg-lime-500/10', bar: 'bg-lime-500' };
      default: return { border: 'border-l-gray-500', text: 'text-gray-500', bg: 'bg-gray-500/10', bar: 'bg-gray-500' };
    }
  };
  const color = getStageColor(job.stage);

  return (
    <div
      className={`
        relative w-full bg-[#22272b] rounded-r-lg rounded-l-sm border-y border-r border-gray-700/50 
        border-l-[4px] ${color.border} shadow-sm group
        ${isDragging ? 'shadow-2xl rotate-2 z-50 ring-2 ring-blue-500/50' : 'hover:bg-[#282e33]'}
      `}
    >
       <div className="p-3">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider bg-black/20 px-1.5 py-0.5 rounded">
                    {number}
                </span>
                <div className="flex gap-1">
                    {job.is_rework && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={10}/> REWORK
                        </span>
                    )}
                    <button onClick={() => setShowHistory(!showHistory)} className={`p-1 rounded hover:bg-white/10 text-gray-400 ${showHistory ? 'text-blue-400 bg-blue-500/10' : ''}`} title="ประวัติ/QC">
                        <History size={14}/>
                    </button>
                </div>
            </div>

            {/* Title */}
            <div className="flex items-start gap-2 mb-2">
                <div className={`p-1.5 rounded bg-black/20 ${color.text}`}>
                    <Package size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-gray-200 leading-snug line-clamp-2" title={job.job_name}>
                        {job.job_name || 'รายการไม่ระบุชื่อ'}
                    </h3>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 truncate">
                        <User size={12}/> {customerName}
                    </div>
                </div>
            </div>

            {/* Progress Bar & Toggle */}
            <div className="mt-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 mb-1">
                    <div className="flex items-center gap-2">
                        <span>Checklist</span>
                        <span className={color.text}>{checkedCount}/{totalChecks}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {/* ปุ่มเพิ่มอะไหล่ มีเฉพาะตอน Preparing */}
                        {job.stage === 'preparing' && (
                            <button onClick={() => onAddPart(job)} className="p-1 hover:bg-white/10 rounded text-green-400 transition-colors" title="เพิ่มรายการ">
                                <Plus size={14}/>
                            </button>
                        )}
                        {checklists.length > 0 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowChecklist(!showChecklist); }}
                                className="p-1 hover:bg-white/10 rounded text-gray-400 transition-colors"
                            >
                                {showChecklist ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            </button>
                        )}
                    </div>
                </div>
                <div className="w-full bg-gray-700 h-1 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${color.bar}`} 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            {/* Checklist Section */}
            {showChecklist && checklists.length > 0 && (
                <div className="mt-2 bg-black/20 rounded p-1 space-y-0.5">
                    {checklists.map((item, idx) => {
                        const isPreparing = job.stage === 'preparing';
                        const isAssembling = job.stage === 'assembling';
                        const isPrepared = item.is_checked; // เตรียมแล้ว
                        const isAssembled = item.is_assembled; // ประกอบแล้ว

                        // Logic การแสดงผล
                        let isChecked = isPreparing ? isPrepared : isAssembled;
                        let isDisabled = false;
                        let opacityClass = 'opacity-100';
                        let statusIcon = null;

                        if (isAssembling) {
                            if (!isPrepared) {
                                // ถ้ายังไม่เตรียม -> ทึบ & ล็อค
                                isDisabled = true;
                                opacityClass = 'opacity-40';
                                statusIcon = <Lock size={12} className="text-gray-500"/>;
                            } else {
                                // เตรียมแล้ว -> พร้อมประกอบ
                                statusIcon = isAssembled ? <CheckCircle2 size={14} className="text-cyan-500"/> : <Wrench size={12} className="text-gray-500"/>;
                            }
                        } else {
                            // Preparing
                            statusIcon = isChecked ? <CheckCircle2 size={14} className="text-green-500"/> : <Circle size={14} className="text-gray-500"/>;
                        }

                        return (
                            <div key={item.id || idx} className={`flex items-center gap-2 group/item hover:bg-white/5 p-1 rounded transition-colors relative ${opacityClass}`}>
                                {/* Checkbox / Status Icon */}
                                <button 
                                    onClick={() => !isDisabled && handleToggleCheck(item.id)}
                                    className={`shrink-0 transition-colors ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:text-white'}`}
                                >
                                    {statusIcon}
                                </button>
                                
                                {/* Text */}
                                <span className={`flex-1 text-[11px] leading-snug break-words ${isChecked ? 'text-gray-500 line-through decoration-gray-600' : 'text-gray-300'}`}>
                                    {item.name} {item.quantity > 1 && <span className="bg-gray-700 px-1 rounded text-[9px] text-gray-400">x{item.quantity}</span>}
                                </span>

                                {/* Assignee */}
                                <div className="relative">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveAssigneeItem(activeAssigneeItem === item.id ? null : item.id); }}
                                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${item.assignee ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-gray-600 text-gray-600 hover:border-gray-400'}`}
                                    >
                                        {item.assignee ? (
                                            item.assignee.avatar_url ? <img src={item.assignee.avatar_url} className="w-full h-full rounded-full object-cover"/> : <span className="text-[8px]">{item.assignee.first_name[0]}</span>
                                        ) : <User size={10}/>}
                                    </button>

                                    {/* Popover Team Selector */}
                                    {activeAssigneeItem === item.id && (
                                        <div className="absolute right-0 top-6 w-48 bg-[#282e33] shadow-xl rounded-lg border border-gray-600 z-[70] p-2" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-600">
                                                <span className="text-xs font-bold text-gray-400">ผู้รับผิดชอบ</span>
                                                <button onClick={() => setActiveAssigneeItem(null)}><X size={12} className="text-gray-400"/></button>
                                            </div>
                                            <ServiceTeamSelector assignees={[]} onChange={(val) => { if (val.length > 0) handleAssignSubTask(item.id, val[val.length-1].user); }} />
                                            {item.assignee && (
                                                <button onClick={() => handleAssignSubTask(item.id, null)} className="w-full text-center text-[10px] text-red-400 hover:bg-white/5 py-1 rounded mt-1">เอาออก</button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Delete Button (Only in Preparing) */}
                                {job.stage === 'preparing' && (
                                    <button onClick={() => handleDeleteItem(item.id)} className="opacity-0 group-hover/item:opacity-100 text-gray-500 hover:text-red-400 ml-1"><Trash2 size={12}/></button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* History & QC Panel */}
            {showHistory && (
                <div className="mt-2 p-2 bg-black/30 rounded border border-white/5 animate-in slide-in-from-top-2">
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">History & QC</div>
                    {job.qc_logs?.length > 0 ? (
                        <div className="space-y-2 mb-2">
                            {job.qc_logs.map((log, i) => (
                                <div key={i} className="text-[10px] bg-red-900/20 text-red-300 p-1.5 rounded border border-red-900/30">
                                    <div className="font-bold flex items-center gap-1"><AlertTriangle size={10}/> Fix: {log.note}</div>
                                    <div className="text-red-500/70 text-[9px]">{new Date(log.date).toLocaleDateString()}</div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-[10px] text-gray-600 text-center py-2">No history</p>}

                    {job.stage === 'testing' && (
                        <div className="pt-2 border-t border-white/10">
                            <input 
                                className="w-full text-xs bg-black/40 border border-white/10 rounded p-1.5 mb-1 text-gray-300 focus:border-blue-500 outline-none" 
                                placeholder="QC Note..." 
                                value={qcNote} 
                                onChange={e => setQcNote(e.target.value)}
                            />
                            <div className="flex gap-1">
                                <button onClick={handleQCPass} className="flex-1 bg-green-600 text-white text-[10px] py-1 rounded hover:bg-green-500 font-bold">PASS</button>
                                <button onClick={handleQCFail} className="flex-1 bg-red-600 text-white text-[10px] py-1 rounded hover:bg-red-500 font-bold">REWORK</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-700/30">
                <div className="relative">
                    <div className="flex -space-x-1.5 cursor-pointer hover:opacity-80" onClick={() => setShowTeamSelector(!showTeamSelector)}>
                        {job.assignees?.length > 0 ? (
                            job.assignees.slice(0, 3).map((u, i) => (
                                <div key={i} className="w-6 h-6 rounded-full bg-gray-700 border border-[#22272b] flex items-center justify-center text-[8px] text-gray-300 overflow-hidden" title={u.user?.first_name}>
                                    {u.user?.avatar_url ? <img src={u.user.avatar_url} className="w-full h-full object-cover"/> : u.user?.first_name?.[0]}
                                </div>
                            ))
                        ) : <div className="w-6 h-6 rounded-full bg-gray-700/50 border border-gray-600 flex items-center justify-center text-gray-500"><Plus size={12}/></div>}
                    </div>
                    {showTeamSelector && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-[#282e33] shadow-xl rounded-lg border border-gray-600 z-[60] p-2">
                            <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-600">
                                <span className="text-xs font-bold text-gray-400">ผู้รับผิดชอบหลัก</span>
                                <button onClick={() => setShowTeamSelector(false)}><X size={14} className="text-gray-400 hover:text-white"/></button>
                            </div>
                            <ServiceTeamSelector assignees={job.assignees || []} onChange={(val) => updateJob({ assignees: val })} />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300">
                    <Clock size={10}/> {new Date(job.created_at).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}
                </div>
            </div>
       </div>
    </div>
  );
};

export default AssemblyCard;