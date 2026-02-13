import React, { useState, useEffect } from 'react';
import { User, AlertTriangle, Clock, Package, CheckSquare, ChevronDown, ChevronUp, Trash2, CheckCircle2, Circle, Plus, History, X, Lock, Wrench, Users, MessageSquare, Send, MoreHorizontal, ArrowRight, XCircle, AlertCircle, Info, PlayCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ServiceTeamSelector from '../services/ServiceTeamSelector'; 

const AssemblyCard = ({ job, isDragging, onUpdate, onAddPart, viewContext, onAddComment, onDelete, currentUser, onClick, viewMode = 'card' }) => {
  const [details, setDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('checklist'); 
  const [isExpanded, setIsExpanded] = useState(true); 
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [activeAssigneeItem, setActiveAssigneeItem] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [qcNote, setQcNote] = useState('');
  const [rejectingItem, setRejectingItem] = useState(null);
  const [expandedHistoryItem, setExpandedHistoryItem] = useState(null);

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
  const comments = job.comments || [];
  const totalChecks = checklists.length;
  
  // Logic การนับ Progress ตาม Stage
  let checkedCount = 0;
  if (viewContext === 'preparing') {
      checkedCount = checklists.filter(c => c.is_checked).length;
  } else if (viewContext === 'testing') {
      checkedCount = checklists.filter(c => c.status === 'passed').length;
  } else {
      checkedCount = checklists.filter(c => c.is_assembled).length;
  }
  
  const progress = totalChecks === 0 && checklists.length > 0 ? 0 : (totalChecks === 0 ? 0 : Math.round((checkedCount / totalChecks) * 100));
  
  const isReadyToMove = totalChecks > 0 && checkedCount === totalChecks;

  // --- Helper Parse Comment ---
  const parseCommentContext = (text) => {
      const match = text.match(/^\[CTX:(\w+)\] (.*)/);
      if (match) {
          const ctx = match[1];
          const content = match[2];
          let badge = { label: 'Unknown', icon: MessageSquare, color: 'text-gray-400', bg: 'bg-gray-700/50' };
          
          if (ctx === 'preparing') badge = { label: 'PREPARING', icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
          else if (ctx === 'assembling') badge = { label: 'ASSEMBLY', icon: Wrench, color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' };
          else if (ctx === 'testing') badge = { label: 'QC/TEST', icon: AlertTriangle, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
          else if (ctx === 'completed') badge = { label: 'DONE', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
          
          return { badge, content };
      }
      return { badge: null, content: text };
  };

  // --- Actions ---

  const handleToggleCheck = async (itemId) => {
    if (itemId === 'MAIN_TASK') {
        const newItem = {
            id: `main-${Date.now()}`,
            name: 'งานหลัก (Main Task)',
            quantity: 1,
            is_checked: true,
            checked_by: currentUser,
            is_assembled: viewContext === 'assembling' || viewContext === 'testing',
            assembled_by: (viewContext === 'assembling' || viewContext === 'testing') ? currentUser : null,
            status: viewContext === 'testing' ? 'passed' : 'normal',
            qc_by: viewContext === 'testing' ? currentUser : null,
            type: 'main'
        };
        const newChecklists = [...checklists, newItem];
        updateJob({ checklists: newChecklists });
        return;
    }

    const item = checklists.find(i => i.id === itemId);
    if (!item) return;

    let updates = {};
    if (viewContext === 'preparing') {
        updates = { 
            is_checked: !item.is_checked,
            checked_by: !item.is_checked ? currentUser : null 
        };
    } else if (viewContext === 'assembling') {
        if (!item.is_checked) return; 
        updates = { 
            is_assembled: !item.is_assembled,
            assembled_by: !item.is_assembled ? currentUser : null,
            status: 'normal', 
            reject_reason: null
        };
    } else if (viewContext === 'testing') {
        const newStatus = item.status === 'passed' ? 'normal' : 'passed';
        updates = { 
            status: newStatus,
            qc_by: newStatus === 'passed' ? currentUser : null
        };
    } else {
        updates = { is_assembled: !item.is_assembled };
    }

    const newChecklists = checklists.map(i => i.id === itemId ? { ...i, ...updates } : i);
    updateJob({ checklists: newChecklists });
  };

  const handleRejectItem = async () => {
      if (!rejectingItem || !qcNote.trim()) return alert('กรุณาระบุเหตุผลที่ต้องแก้ไข');
      
      const newChecklists = checklists.map(i => {
          if (i.id === rejectingItem) {
              const historyEntry = {
                  reason: qcNote,
                  rejected_by: currentUser,
                  rejected_at: new Date().toISOString()
              };
              const newHistory = [...(i.rejection_history || []), historyEntry];

              return { 
                  ...i, 
                  is_assembled: false, 
                  status: 'rejected',
                  reject_reason: qcNote,
                  rejected_by: currentUser,
                  rejected_at: new Date().toISOString(),
                  rejection_history: newHistory,
                  reject_count: newHistory.length
              };
          }
          return i;
      });

      updateJob({ 
          checklists: newChecklists,
          stage: 'assembling',
          is_rework: true
      });
      
      setRejectingItem(null);
      setQcNote('');
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

  const handleSendComment = (e) => {
      e.preventDefault();
      if(!commentText.trim()) return;
      const contextTag = `[CTX:${viewContext}]`; 
      const finalMsg = `${contextTag} ${commentText}`;
      onAddComment(job, finalMsg);
      setCommentText('');
  };

  const handleDeleteCard = (e) => {
      e.stopPropagation();
      if(confirm('คุณต้องการลบการ์ดนี้ใช่ไหม?')) onDelete(job.id);
  };

  const handleMoveToQC = async () => {
      if (!confirm('งานประกอบเสร็จสิ้น ส่งไปตรวจสอบคุณภาพ (QC)?')) return;
      updateJob({ stage: 'testing' }); 
  };

  const handleMoveToDone = async () => {
      if (!confirm('ยืนยันผลการทดสอบ QC ผ่านทั้งหมด และจบงาน?')) return;
      updateJob({ stage: 'completed', completed_at: new Date().toISOString() }); 
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

  const getStageColor = () => {
    if (isReadyToMove && (viewContext === 'assembling' || viewContext === 'testing')) {
        return { border: 'border-l-emerald-500', text: 'text-emerald-500', bar: 'bg-emerald-500', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)] border-emerald-500/50' };
    }

    switch (viewContext) {
      case 'preparing': return { border: 'border-l-amber-500', text: 'text-amber-500', bar: 'bg-amber-500' };
      case 'assembling': return { border: 'border-l-cyan-500', text: 'text-cyan-500', bar: 'bg-cyan-500' };
      case 'testing': return { border: 'border-l-purple-500', text: 'text-purple-500', bar: 'bg-purple-500' };
      case 'completed': return { border: 'border-l-lime-500', text: 'text-lime-500', bar: 'bg-lime-500' };
      default: return { border: 'border-l-gray-500', text: 'text-gray-500', bar: 'bg-gray-500' };
    }
  };
  const color = getStageColor();

  if (viewMode === 'list') {
      return (
        <div onClick={onClick} className={`relative w-full bg-[#22272b] rounded p-2 border-l-[3px] border-y border-r border-gray-700/50 ${color.border} shadow-sm group hover:bg-[#282e33] mb-1 flex items-center justify-between cursor-pointer`}>
            <div className="flex items-center gap-3 overflow-hidden">
                 <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider bg-black/20 px-1.5 py-0.5 rounded shrink-0">{number}</span>
                 <div className="flex flex-col min-w-0">
                     <span className="text-xs font-medium text-gray-200 truncate">{job.job_name || 'รายการไม่ระบุชื่อ'}</span>
                     <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden"><div className={`h-full ${color.bar}`} style={{ width: `${progress}%` }}></div></div>
                        {job.is_rework && <span className="text-[8px] text-red-400 font-bold flex items-center gap-0.5"><AlertTriangle size={8}/> REWORK</span>}
                     </div>
                 </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                 <div className="flex -space-x-1">{job.assignees?.slice(0, 2).map((u, i) => (<div key={i} className="w-5 h-5 rounded-full bg-gray-700 border border-[#22272b] flex items-center justify-center text-[8px] text-gray-300 overflow-hidden" title={u.user?.first_name}>{u.user?.avatar_url ? <img src={u.user.avatar_url} className="w-full h-full object-cover"/> : u.user?.first_name?.[0]}</div>))}</div>
                 <div className="flex items-center gap-1 text-[10px] text-gray-500"><CheckSquare size={12}/> {checkedCount}/{totalChecks}</div>
            </div>
        </div>
      );
  }

  return (
    <div className={`relative w-full bg-[#22272b] rounded-r-lg rounded-l-sm border-y border-r border-gray-700/50 border-l-[4px] ${color.border} shadow-sm group transition-all duration-300 ${isDragging ? 'shadow-2xl rotate-2 z-50 ring-2 ring-blue-500/50' : 'hover:bg-[#282e33]'} ${color.glow || ''}`}>
       <div className="p-3">
            {/* Header */}
            <div className="flex justify-between items-start mb-2 relative">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400 font-mono tracking-wider bg-black/20 px-1.5 py-0.5 rounded w-fit">{number}</span>
                    {job.created_by && (
                        <span className="text-[9px] text-gray-500 flex items-center gap-1">added by {job.created_by.name || 'System'}</span>
                    )}
                </div>
                <div className="flex gap-1">
                    {/* Ready Badge */}
                    {isReadyToMove && (viewContext === 'assembling' || viewContext === 'testing') && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-black flex items-center gap-1 animate-pulse shadow-lg shadow-emerald-500/20">
                            <CheckCircle2 size={10}/> {viewContext === 'assembling' ? 'QC READY' : 'PASS'}
                        </span>
                    )}
                    {job.is_rework && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex items-center gap-1 animate-pulse"><AlertTriangle size={10}/> REWORK</span>}
                    <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1 rounded hover:bg-white/10 text-gray-400"><MoreHorizontal size={14}/></button>
                        {showMenu && (
                            <div className="absolute right-0 top-6 w-32 bg-[#282e33] border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden">
                                <button onClick={handleDeleteCard} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5 flex items-center gap-2"><Trash2 size={12}/> ลบการ์ด</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Title */}
            <div className="flex items-start gap-2 mb-2">
                <div className={`p-1.5 rounded bg-black/20 ${color.text}`}><Package size={16} /></div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-gray-200 leading-snug line-clamp-2">{job.job_name || 'รายการไม่ระบุชื่อ'}</h3>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 truncate"><User size={12}/> {customerName}</div>
                </div>
            </div>

            {/* Progress */}
            <div className="mt-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 mb-1">
                    <div className="flex items-center gap-2">
                        <span>{viewContext === 'preparing' ? 'Prepared' : (viewContext === 'testing' ? 'Passed' : 'Assembled')}</span>
                        <span className={color.text}>{checkedCount}/{totalChecks}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {viewContext === 'preparing' && (
                            <button onClick={() => onAddPart(job)} className="p-1 hover:bg-white/10 rounded text-green-400" title="เพิ่มรายการ"><Plus size={14}/></button>
                        )}
                        {checklists.length > 0 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                className="p-1 hover:bg-white/10 rounded text-gray-400 transition-colors"
                            >
                                {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            </button>
                        )}
                    </div>
                </div>
                <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden border border-white/5">
                    <div className={`h-full rounded-full transition-all duration-500 ${color.bar}`} style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mt-2 flex items-center gap-2 border-b border-gray-700 pb-1 mb-2">
                <button onClick={(e) => { e.stopPropagation(); setActiveTab('checklist'); setIsExpanded(true); }} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 ${activeTab === 'checklist' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}><CheckSquare size={12}/> List</button>
                <button onClick={(e) => { e.stopPropagation(); setActiveTab('chat'); setIsExpanded(true); }} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 ${activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}><MessageSquare size={12}/> Chat {comments.length > 0 && `(${comments.length})`}</button>
            </div>

            {/* Action Buttons */}
            {isReadyToMove && viewContext === 'assembling' && (
                <button onClick={handleMoveToQC} className="w-full mb-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/50 transition-all animate-in zoom-in">ส่งตรวจสอบ (Send to QC) <ArrowRight size={14}/></button>
            )}
            {isReadyToMove && viewContext === 'testing' && (
                <button onClick={handleMoveToDone} className="w-full mb-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/50 transition-all animate-in zoom-in">ผ่านการตรวจสอบ (Finish Job) <ShieldCheck size={14}/></button>
            )}

            {/* Content Area */}
            {isExpanded && (
                <div className="bg-black/20 rounded p-1.5 min-h-[50px] max-h-[200px] overflow-y-auto custom-scrollbar">
                    {activeTab === 'checklist' && (
                        <div className="space-y-0.5">
                            {checklists.length === 0 && (
                                <div className="p-3 text-center">
                                    <p className="text-xs text-gray-500 mb-2">
                                        {viewContext === 'assembling' ? 'รอฝ่ายเตรียมของยืนยัน (Waiting)' : 'ไม่มีรายการย่อย (Main Task Only)'}
                                    </p>
                                    <button 
                                        onClick={() => handleToggleCheck('MAIN_TASK')}
                                        className={`w-full py-2 rounded text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                                            (viewContext === 'preparing' || viewContext === 'assembling' || viewContext === 'testing')
                                            ? 'bg-blue-600/20 text-blue-400 border-blue-600/50 hover:bg-blue-600/30'
                                            : 'bg-gray-700/50 text-gray-400 border-gray-600 cursor-not-allowed opacity-50'
                                        }`}
                                    >
                                        {viewContext === 'preparing' ? <CheckCircle2 size={14}/> : (viewContext === 'testing' ? <ShieldCheck size={14}/> : <Wrench size={14}/>)}
                                        {viewContext === 'preparing' ? 'ยืนยันจัดเตรียม' : (viewContext === 'testing' ? 'ยืนยัน QC ผ่าน' : 'ยืนยันประกอบเสร็จ')}
                                    </button>
                                </div>
                            )}

                            {checklists.map((item, idx) => {
                                const isPrepared = item.is_checked;
                                const isAssembled = item.is_assembled;
                                const isRejected = item.status === 'rejected';

                                let isChecked = false;
                                let isDisabled = false;
                                let opacityClass = 'opacity-100';
                                let statusIcon = null;
                                let borderColor = 'border-transparent';
                                let bgColor = 'hover:bg-white/5';

                                if (isRejected) {
                                    borderColor = 'border-red-500/50';
                                    bgColor = 'bg-red-900/10';
                                }

                                if (viewContext === 'assembling' || viewContext === 'testing' || viewContext === 'completed') {
                                    if (!isPrepared) { isDisabled = true; opacityClass = 'opacity-40'; statusIcon = <Lock size={12} className="text-gray-500"/>; }
                                    else { statusIcon = isAssembled ? <CheckCircle2 size={14} className="text-cyan-500"/> : <Wrench size={12} className="text-gray-500"/>; }
                                } else {
                                    statusIcon = isChecked ? <CheckCircle2 size={14} className="text-green-500"/> : <Circle size={14} className="text-gray-500"/>;
                                    isChecked = isPrepared;
                                }

                                if (viewContext === 'testing') {
                                    statusIcon = item.status === 'passed' ? <CheckCircle2 size={14} className="text-green-500"/> : <Circle size={14} className="text-gray-500"/>;
                                    isChecked = item.status === 'passed';
                                }

                                return (
                                    <div key={item.id || idx} className={`flex flex-col border ${borderColor} ${bgColor} ${opacityClass} rounded mb-1`}>
                                        <div className="flex items-center gap-2 group/item p-1.5 transition-colors relative">
                                            <button 
                                                onClick={() => !isDisabled && handleToggleCheck(item.id)}
                                                className={`shrink-0 transition-colors ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:text-white'}`}
                                            >
                                                {statusIcon}
                                            </button>
                                            
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-[11px] leading-snug break-words ${isChecked ? 'text-gray-500 line-through decoration-gray-600' : (isRejected ? 'text-red-300 font-bold' : 'text-gray-300')}`}>
                                                    {item.name} {item.quantity > 1 && <span className="bg-gray-700 px-1 rounded text-[9px] text-gray-400">x{item.quantity}</span>}
                                                </span>
                                                {(item.checked_by || item.assembled_by) && (
                                                    <div className="text-[9px] text-gray-600 mt-0.5 flex items-center gap-1">
                                                        {item.is_assembled ? <><Wrench size={8}/> {item.assembled_by?.first_name}</> : <><Package size={8}/> {item.checked_by?.first_name}</>}
                                                    </div>
                                                )}
                                                {isRejected && (
                                                    <div className="text-[9px] text-red-400 mt-0.5 flex flex-col gap-1">
                                                        <div className="flex items-start gap-1">
                                                            <AlertCircle size={8} className="mt-0.5"/> 
                                                            <span>แก้ไข (ครั้งที่ {item.reject_count || 1}): {item.reject_reason}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {!isRejected && (item.reject_count > 0) && (
                                                    <div 
                                                        className="text-[9px] text-orange-400 mt-0.5 flex items-center gap-1 cursor-pointer hover:underline"
                                                        onClick={(e) => { e.stopPropagation(); setExpandedHistoryItem(expandedHistoryItem === item.id ? null : item.id); }}
                                                    >
                                                       <History size={8}/> เคยถูกตีกลับ {item.reject_count} ครั้ง
                                                    </div>
                                                )}
                                            </div>

                                            <div className="relative shrink-0">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setActiveAssigneeItem(activeAssigneeItem === item.id ? null : item.id); }}
                                                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${item.assignee ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-gray-600 text-gray-600 hover:border-gray-400'}`}
                                                >
                                                    {item.assignee ? (item.assignee.avatar_url ? <img src={item.assignee.avatar_url} className="w-full h-full rounded-full object-cover"/> : <span className="text-[8px]">{item.assignee.first_name[0]}</span>) : <User size={10}/>}
                                                </button>
                                                {activeAssigneeItem === item.id && (
                                                    <div className="absolute right-0 top-6 w-48 bg-[#282e33] shadow-xl rounded-lg border border-gray-600 z-[70] p-2" onClick={e => e.stopPropagation()}>
                                                        <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-600"><span className="text-xs font-bold text-gray-400">ผู้รับผิดชอบ</span><button onClick={() => setActiveAssigneeItem(null)}><X size={12} className="text-gray-400"/></button></div>
                                                        <ServiceTeamSelector assignees={[]} onChange={(val) => { if (val.length > 0) handleAssignSubTask(item.id, val[val.length-1].user); }} />
                                                    </div>
                                                )}
                                            </div>

                                            {viewContext === 'testing' && !isRejected && (
                                                <button onClick={() => setRejectingItem(item.id)} className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded ml-1 transition-colors" title="ตีกลับ"><XCircle size={14}/></button>
                                            )}
                                            {viewContext === 'preparing' && <button onClick={() => handleDeleteItem(item.id)} className="opacity-0 group-hover/item:opacity-100 text-gray-500 hover:text-red-400 ml-1"><Trash2 size={12}/></button>}
                                        </div>

                                        {expandedHistoryItem === item.id && item.rejection_history?.length > 0 && (
                                            <div className="ml-6 mr-2 mb-2 p-1.5 bg-black/30 rounded border-l-2 border-orange-500/50">
                                                <div className="text-[9px] text-gray-400 font-bold mb-1">ประวัติการแก้ไข:</div>
                                                {item.rejection_history.map((h, hIdx) => (
                                                    <div key={hIdx} className="text-[9px] text-gray-500 mb-0.5 flex gap-1">
                                                        <span>• {new Date(h.rejected_at).toLocaleDateString()}:</span>
                                                        <span className="text-orange-300">{h.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {/* ... (QC Reject Form & Chat Tab เหมือนเดิม) ... */}
                    {rejectingItem && viewContext === 'testing' && (
                        <div className="absolute inset-0 bg-[#22272b] z-50 p-2 flex flex-col justify-center animate-in fade-in"><p className="text-xs text-red-400 font-bold mb-2">ระบุเหตุผลที่ตีกลับรายการนี้:</p><textarea autoFocus className="w-full bg-black/30 border border-red-900/50 rounded p-2 text-xs text-gray-200 mb-2 outline-none focus:border-red-500" rows="2" value={qcNote} onChange={e => setQcNote(e.target.value)}/><div className="flex gap-2"><button onClick={handleRejectItem} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs py-1.5 rounded font-bold">ยืนยันส่งแก้</button><button onClick={() => { setRejectingItem(null); setQcNote(''); }} className="px-3 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded">ยกเลิก</button></div></div>
                    )}
                    {activeTab === 'chat' && (
                        <div className="flex flex-col h-full"><div className="flex-1 space-y-2 mb-2">{comments.length > 0 ? comments.map((msg, i) => { const { badge, content } = parseCommentContext(msg.text); return (<div key={i} className="flex gap-2 items-start"><div className="w-5 h-5 rounded-full bg-gray-600 shrink-0 overflow-hidden mt-0.5">{msg.avatar_url ? <img src={msg.avatar_url} className="w-full h-full object-cover"/> : <span className="flex items-center justify-center h-full text-[8px] text-white">{msg.user_name?.[0]}</span>}</div><div className="bg-[#323940] p-1.5 rounded-lg rounded-tl-none flex-1"><div className="flex justify-between items-center mb-0.5"><span className="text-[10px] font-bold text-gray-300">{msg.user_name}</span><span className="text-[9px] font-normal text-gray-500">{new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>{badge && (<div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded mb-1 text-[8px] font-bold w-fit border ${badge.bg} ${badge.color} ${badge.border}`}><badge.icon size={8}/> {badge.label}</div>)}<p className="text-[11px] text-gray-200 leading-snug">{content}</p></div></div>); }) : <p className="text-center text-xs text-gray-500 py-4">No comments yet</p>}</div><form onSubmit={handleSendComment} className="flex gap-1 mt-auto pt-1 border-t border-white/5"><input className="flex-1 bg-[#161a1d] text-xs text-gray-200 rounded px-2 py-1 border border-transparent focus:border-blue-500 outline-none" placeholder="Write a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} onClick={e => e.stopPropagation()}/><button type="submit" disabled={!commentText.trim()} className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"><Send size={12}/></button></form></div>
                    )}
                </div>
            )}
            
            {/* ... (Footer เหมือนเดิม) ... */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700/30"><div className="relative"><div className="flex -space-x-1.5 cursor-pointer hover:opacity-80" onClick={() => setShowTeamSelector(!showTeamSelector)}>{job.assignees?.length > 0 ? (job.assignees.slice(0, 3).map((u, i) => (<div key={i} className="w-6 h-6 rounded-full bg-gray-700 border border-[#22272b] flex items-center justify-center text-[8px] text-gray-300 overflow-hidden" title={u.user?.first_name}>{u.user?.avatar_url ? <img src={u.user.avatar_url} className="w-full h-full object-cover"/> : u.user?.first_name?.[0]}</div>))) : <div className="w-6 h-6 rounded-full bg-gray-700/50 border border-gray-600 flex items-center justify-center text-gray-500"><Users size={12}/></div>}</div>{showTeamSelector && (<div className="absolute top-full left-0 mt-2 w-48 bg-[#282e33] shadow-xl rounded-lg border border-gray-600 z-[60] p-2"><div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-600"><span className="text-xs font-bold text-gray-400">Team</span><button onClick={() => setShowTeamSelector(false)}><X size={14} className="text-gray-400 hover:text-white"/></button></div><ServiceTeamSelector assignees={job.assignees || []} onChange={(val) => updateJob({ assignees: val })} /></div>)}</div><div className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300"><Clock size={10}/> {new Date(job.created_at).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</div></div>
       </div>
    </div>
  );
};

export default AssemblyCard;