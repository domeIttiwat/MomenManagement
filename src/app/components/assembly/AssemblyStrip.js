import React, { useState, useEffect, useRef } from 'react';
import { User, Package, CheckSquare, ChevronDown, ChevronUp, Trash2, CheckCircle2, Circle, Plus, History, X, Lock, Wrench, Users, MessageSquare, Send, AlertTriangle, AlertCircle, ArrowRight, ShieldCheck, Paperclip, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ServiceTeamSelector from '../services/ServiceTeamSelector'; 

const AssemblyStrip = ({ job, viewContext, onUpdate, onAddPart, onAddComment, onDelete, currentUser }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('checklist'); 
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  
  // Chat State
  const [commentText, setCommentText] = useState('');
  const [attachedImages, setAttachedImages] = useState([]); 
  const [imagePreviews, setImagePreviews] = useState([]); 
  const [hasUnread, setHasUnread] = useState(false);
  const fileInputRef = useRef(null);

  const [qcNote, setQcNote] = useState('');
  const [rejectingItem, setRejectingItem] = useState(null);
  const [activeAssigneeItem, setActiveAssigneeItem] = useState(null);

  const checklists = job.checklists || [];
  const comments = job.comments || [];
  const totalChecks = checklists.length;
  
  // Check Unread Logic
  useEffect(() => {
    const lastRead = localStorage.getItem(`assembly_read_${job.id}`);
    const lastCommentTime = comments.length > 0 ? new Date(comments[comments.length - 1].created_at).getTime() : 0;
    if (!lastRead || lastCommentTime > parseInt(lastRead)) {
        if (comments.length > 0) setHasUnread(true);
    }
    if (isExpanded && activeTab === 'chat') {
        markAsRead();
    }
  }, [comments, isExpanded, activeTab, job.id]);

  const markAsRead = () => {
      localStorage.setItem(`assembly_read_${job.id}`, Date.now().toString());
      setHasUnread(false);
  };

  // Logic Progress
  let checkedCount = 0;
  if (viewContext === 'preparing') checkedCount = checklists.filter(c => c.is_checked).length;
  else if (viewContext === 'testing') checkedCount = checklists.filter(c => c.status === 'passed').length;
  else checkedCount = checklists.filter(c => c.is_assembled).length;
  const progress = totalChecks === 0 && checklists.length > 0 ? 0 : (totalChecks === 0 ? 0 : Math.round((checkedCount / totalChecks) * 100));
  const isAllDone = totalChecks > 0 && checkedCount === totalChecks;

  // --- Actions ---
  const updateJob = async (updates) => {
    onUpdate({ ...job, ...updates }); 
    await supabase.from('assembly_jobs').update(updates).eq('id', job.id);
  };

  const handleToggleCheck = async (itemId) => {
    // 1. กรณีไม่มีรายการย่อย -> กดเพื่อยืนยันทั้งการ์ด
    if (itemId === 'MAIN_TASK') {
        const newItem = { 
            id: `main-${Date.now()}`, 
            name: viewContext === 'preparing' ? 'จัดเตรียมสินค้าครบถ้วน (Whole Card)' : 'งานหลัก', 
            quantity: 1, 
            is_checked: true, // สร้างปุ๊บ เสร็จปั๊บ (สำหรับ Prep)
            checked_by: currentUser, 
            is_assembled: viewContext !== 'preparing', 
            type: 'main' 
        };
        updateJob({ checklists: [...checklists, newItem] });
        return;
    }

    const item = checklists.find(i => i.id === itemId);
    if (!item) return;
    let updates = {};
    if (viewContext === 'preparing') updates = { is_checked: !item.is_checked, checked_by: !item.is_checked ? currentUser : null };
    else if (viewContext === 'assembling') { if (!item.is_checked) return; updates = { is_assembled: !item.is_assembled, assembled_by: !item.is_assembled ? currentUser : null }; }
    else if (viewContext === 'testing') { const newStatus = item.status === 'passed' ? 'normal' : 'passed'; updates = { status: newStatus, qc_by: newStatus === 'passed' ? currentUser : null }; }
    else updates = { is_assembled: !item.is_assembled };

    const newChecklists = checklists.map(i => i.id === itemId ? { ...i, ...updates } : i);
    updateJob({ checklists: newChecklists });
  };

  const handleDeleteItem = async (itemId) => {
      if(!confirm('ลบรายการ?')) return;
      updateJob({ checklists: checklists.filter(i => i.id !== itemId) });
  };

  const handleAssignSubTask = (itemId, user) => {
      updateJob({ checklists: checklists.map(i => i.id === itemId ? { ...i, assignee: user } : i) });
      setActiveAssigneeItem(null);
  };

  const handleImageSelect = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
          setAttachedImages([...attachedImages, ...files]);
          const newPreviews = files.map(f => URL.createObjectURL(f));
          setImagePreviews([...imagePreviews, ...newPreviews]);
      }
  };

  const removeImage = (idx) => {
      setAttachedImages(attachedImages.filter((_, i) => i !== idx));
      setImagePreviews(imagePreviews.filter((_, i) => i !== idx));
  };

  const handleSendComment = (e) => {
      e.preventDefault();
      if(!commentText.trim() && attachedImages.length === 0) return;
      onAddComment(job, `[CTX:${viewContext}] ${commentText}`, attachedImages);
      setCommentText('');
      setAttachedImages([]);
      setImagePreviews([]);
      markAsRead();
  };

  const parseCommentContext = (text) => {
      const match = text.match(/^\[CTX:(\w+)\] (.*)/);
      if (match) {
          const ctx = match[1];
          const content = match[2];
          let badge = { label: '?', icon: MessageSquare, color: 'text-gray-400', bg: 'bg-gray-700/50', border: 'border-gray-600' };
          
          if (ctx === 'preparing') badge = { label: 'PREP', icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
          else if (ctx === 'assembling') badge = { label: 'ASM', icon: Wrench, color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' };
          else if (ctx === 'testing') badge = { label: 'QC', icon: AlertTriangle, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
          else if (ctx === 'completed') badge = { label: 'DONE', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
          
          return { badge, content };
      }
      return { badge: null, content: text };
  };

  const handleMoveStage = async (nextStage) => {
      if (!confirm(`ยืนยันย้ายงานไปขั้นตอน ${nextStage}?`)) return;
      const updates = { stage: nextStage };
      if (nextStage === 'completed') updates.completed_at = new Date().toISOString();
      updateJob(updates);
  };

  const handleRejectItem = async () => {
    if (!rejectingItem || !qcNote.trim()) return alert('ระบุเหตุผล');
    const newChecklists = checklists.map(i => i.id === rejectingItem ? { ...i, status: 'rejected', reject_reason: qcNote, rejection_history: [...(i.rejection_history||[]), {reason: qcNote, date: new Date()}] } : i);
    updateJob({ checklists: newChecklists, stage: 'assembling', is_rework: true });
    setRejectingItem(null); setQcNote('');
  };

  const getStatusColor = () => {
      if (job.is_rework) return 'border-l-red-500 bg-red-900/10';
      if (isAllDone) return 'border-l-emerald-500 bg-[#22272b]';
      if (viewContext === 'preparing') return 'border-l-amber-500 bg-[#22272b]';
      if (viewContext === 'assembling') return 'border-l-cyan-500 bg-[#22272b]';
      return 'border-l-purple-500 bg-[#22272b]';
  };

  return (
    <div className={`relative w-full rounded-lg border border-white/10 shadow-sm transition-all border-l-[4px] ${getStatusColor()} ${isExpanded ? 'ring-1 ring-white/20 bg-[#2b3136]' : 'hover:bg-[#282e33]'}`}>
        {/* --- STRIP HEADER --- */}
        <div className="flex items-center p-3 gap-4 cursor-pointer" onClick={() => { setIsExpanded(!isExpanded); if(!isExpanded) markAsRead(); }}>
            <div className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={20}/></div>
            
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-200 truncate">{job.job_name || 'รายการไม่ระบุชื่อ'}</span>
                    {job.is_rework && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex items-center gap-1 animate-pulse"><AlertTriangle size={10}/> REWORK</span>}
                    {isAllDone && (viewContext === 'assembling' || viewContext === 'testing') && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1"><CheckCircle2 size={10}/> READY</span>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <div className="flex -space-x-1.5">
                            {job.assignees?.slice(0, 3).map((u, i) => (
                                <div key={i} className="w-5 h-5 rounded-full bg-gray-700 border border-[#22272b] flex items-center justify-center text-[8px] text-gray-300 overflow-hidden" title={u.user?.first_name}>
                                    {u.user?.avatar_url ? <img src={u.user.avatar_url} className="w-full h-full object-cover"/> : u.user?.first_name?.[0]}
                                </div>
                            ))}
                            {(!job.assignees || job.assignees.length === 0) && <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center"><User size={10}/></div>}
                        </div>
                        {job.created_by && <span>by {job.created_by.name}</span>}
                    </div>
                </div>
            </div>

            {hasUnread && !isExpanded && (
                 <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full animate-pulse border border-red-500/30">
                     <MessageSquare size={12}/> <span className="text-[10px] font-bold">New</span>
                 </div>
            )}

            <div className="w-32 hidden md:block">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>{progress}%</span><span>{checkedCount}/{totalChecks}</span></div>
                <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${viewContext === 'preparing' ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${progress}%` }}></div></div>
            </div>

            <div className="flex items-center gap-2">
                {viewContext === 'preparing' && <button onClick={(e) => { e.stopPropagation(); onAddPart(job); }} className="p-2 hover:bg-white/10 rounded-full text-green-400"><Plus size={18}/></button>}
                <button onClick={(e) => { e.stopPropagation(); onDelete(job.id); }} className="p-2 hover:bg-red-500/20 rounded-full text-gray-600 hover:text-red-400"><Trash2 size={16}/></button>
            </div>
        </div>

        {/* --- EXPANDED BODY --- */}
        {isExpanded && (
            <div className="border-t border-white/5 p-4 bg-black/20 animate-in slide-in-from-top-2">
                <div className="flex gap-4 border-b border-white/10 pb-2 mb-4">
                    <button onClick={() => setActiveTab('checklist')} className={`text-xs font-bold flex items-center gap-2 pb-1 ${activeTab === 'checklist' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500'}`}><CheckSquare size={14}/> Checklist</button>
                    <button onClick={() => setActiveTab('chat')} className={`text-xs font-bold flex items-center gap-2 pb-1 ${activeTab === 'chat' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500'}`}>
                        <MessageSquare size={14}/> Comments ({comments.length})
                        {hasUnread && <span className="w-2 h-2 rounded-full bg-red-500 ml-1"></span>}
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        {isAllDone && viewContext === 'assembling' && <button onClick={() => handleMoveStage('testing')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded flex items-center gap-2">Send to QC <ArrowRight size={12}/></button>}
                        {isAllDone && viewContext === 'testing' && <button onClick={() => handleMoveStage('completed')} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded flex items-center gap-2">Finish Job <ShieldCheck size={12}/></button>}
                        <div className="relative">
                            <button onClick={() => setShowTeamSelector(!showTeamSelector)} className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded flex items-center gap-1"><Users size={12}/> Team</button>
                            {showTeamSelector && <div className="absolute right-0 top-8 z-50 w-48 p-2 bg-[#22272b] border border-gray-600 rounded shadow-xl"><ServiceTeamSelector assignees={job.assignees||[]} onChange={(val) => updateJob({ assignees: val })}/></div>}
                        </div>
                    </div>
                </div>

                {/* Checklist Content */}
                {activeTab === 'checklist' && (
                    <div className="space-y-1">
                        {/* ✅ Logic การ์ดเปล่า: ถ้าไม่มีรายการ และอยู่ช่อง Preparing ให้โชว์ปุ่มยืนยันทั้งการ์ด */}
                        {checklists.length === 0 && (
                            <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-white/10 rounded-lg">
                                {viewContext === 'preparing' ? (
                                    <>
                                        <p className="mb-3">ยังไม่มีรายการย่อย (เลือกเพิ่มรายการ หรือ ยืนยันว่าเตรียมเสร็จแล้ว)</p>
                                        <button 
                                            onClick={() => handleToggleCheck('MAIN_TASK')}
                                            className="px-4 py-2 bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded-lg font-bold hover:bg-amber-500/30 flex items-center justify-center gap-2 mx-auto"
                                        >
                                            <CheckCircle2 size={16}/> ยืนยันการจัดเตรียม (Complete Prep)
                                        </button>
                                    </>
                                ) : (
                                    <p>รอการเตรียมของ...</p>
                                )}
                            </div>
                        )}

                        {checklists.map((item) => {
                            const isPrepared = item.is_checked;
                            const isAssembled = item.is_assembled;
                            const isRejected = item.status === 'rejected';
                            let isChecked = false, isDisabled = false, opacity = 'opacity-100', icon = null;

                            if (isRejected) opacity = 'bg-red-900/10 border border-red-900/30';
                            
                            if (viewContext === 'assembling' || viewContext === 'testing') {
                                if (!isPrepared) { isDisabled = true; opacity = 'opacity-40'; icon = <Lock size={14}/>; }
                                else { icon = isAssembled ? <CheckCircle2 size={16} className="text-cyan-400"/> : <Wrench size={14} className="text-gray-500"/>; }
                            } else {
                                isChecked = isPrepared;
                                icon = isChecked ? <CheckCircle2 size={16} className="text-green-400"/> : <Circle size={14} className="text-gray-500"/>;
                            }
                            if (viewContext === 'testing' && item.status === 'passed') icon = <CheckCircle2 size={16} className="text-green-400"/>;

                            return (
                                <div key={item.id} className={`flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors ${opacity}`}>
                                    <button onClick={() => !isDisabled && handleToggleCheck(item.id)} className={isDisabled ? 'cursor-not-allowed' : ''}>{icon}</button>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs ${isChecked || isAssembled ? 'text-gray-500 line-through' : (isRejected ? 'text-red-400' : 'text-gray-300')}`}>{item.name} {item.quantity > 1 && <span className="bg-gray-700 px-1 rounded text-[9px] ml-1">x{item.quantity}</span>}</div>
                                        {isRejected && <div className="text-[10px] text-red-400 mt-0.5">⚠️ {item.reject_reason}</div>}
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => setActiveAssigneeItem(activeAssigneeItem === item.id ? null : item.id)} className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[8px] text-gray-300 hover:bg-gray-600">{item.assignee ? item.assignee.first_name[0] : <User size={10}/>}</button>
                                        {activeAssigneeItem === item.id && <div className="absolute right-0 top-6 z-50 w-48 p-2 bg-[#22272b] border border-gray-600 rounded shadow-xl"><ServiceTeamSelector assignees={[]} onChange={(val) => {if(val.length) handleAssignSubTask(item.id, val[val.length-1].user)}}/></div>}
                                    </div>
                                    {viewContext === 'testing' && !isRejected && <button onClick={() => setRejectingItem(item.id)} className="text-gray-500 hover:text-red-400"><XCircle size={14}/></button>}
                                    {viewContext === 'preparing' && <button onClick={() => handleDeleteItem(item.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={14}/></button>}
                                </div>
                            );
                        })}
                    </div>
                )}

                {rejectingItem && (
                    <div className="mt-2 bg-red-900/10 p-2 rounded border border-red-900/30">
                        <input autoFocus className="w-full bg-black/40 text-xs text-white p-2 rounded mb-2 border border-red-900/50" placeholder="เหตุผลที่ตีกลับ..." value={qcNote} onChange={e => setQcNote(e.target.value)}/>
                        <div className="flex gap-2"><button onClick={handleRejectItem} className="bg-red-600 text-white text-xs px-3 py-1 rounded">Confirm Reject</button><button onClick={() => setRejectingItem(null)} className="text-xs text-gray-400">Cancel</button></div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="mt-2">
                        <div className="max-h-[150px] overflow-y-auto space-y-2 mb-2">
                            {comments.map((m, i) => (
                                <div key={i} className="bg-white/5 p-2 rounded text-xs text-gray-300">
                                    <div className="flex justify-between mb-1"><span className="font-bold text-gray-400">{m.user_name}</span><span className="text-[9px] text-gray-600">{new Date(m.created_at).toLocaleTimeString()}</span></div>
                                    {m.text}
                                    {m.images && m.images.map((img, idx) => <img key={idx} src={img} className="mt-2 w-20 h-20 object-cover rounded"/>)}
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleSendComment} className="flex gap-2 items-center bg-[#161a1d] p-1.5 rounded-lg border border-white/10">
                            <label className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded cursor-pointer"><ImageIcon size={18}/><input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect}/></label>
                            <input className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none" placeholder="พิมพ์ข้อความ..." value={commentText} onChange={e => setCommentText(e.target.value)}/>
                            <button type="submit" disabled={!commentText.trim() && attachedImages.length === 0} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"><Send size={14}/></button>
                        </form>
                        {imagePreviews.length > 0 && <div className="flex gap-2 overflow-x-auto mt-2 pb-2">{imagePreviews.map((src, i) => <div key={i} className="relative w-12 h-12 shrink-0 rounded overflow-hidden group"><img src={src} className="w-full h-full object-cover"/><button onClick={() => removeImage(i)} className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"><X size={14}/></button></div>)}</div>}
                    </div>
                )}
            </div>
        )}
    </div>
  );
};
//send
export default AssemblyStrip;