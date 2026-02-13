import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckSquare, Plus, AlertTriangle, History, CheckCircle2, Box, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ServiceTeamSelector from '../services/ServiceTeamSelector'; 
import AssemblyAddPartModal from './AssemblyAddPartModal';

const AssemblyJobDetail = ({ job, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('checklist');
  const [checklists, setChecklists] = useState(job.checklists || []);
  const [showAddPart, setShowAddPart] = useState(false);
  const [qcNote, setQcNote] = useState('');
  const [assignees, setAssignees] = useState(job.assignees || []);
  const [targetProductId, setTargetProductId] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // 🔍 ค้นหา Product ID ของงานนี้ เพื่อนำไปดึงอะไหล่แนะนำ
    const fetchSourceItem = async () => {
        // ถ้าเป็นงานซ่อม อาจจะไม่มี Product ID ชัดเจน (ข้ามไป)
        // ถ้าเป็น Order ต้องไปหาว่า job_name นี้ตรงกับ Product ตัวไหน
        const table = job.ref_type === 'order' ? 'order_items' : 'service_items';
        const fk = job.ref_type === 'order' ? 'order_id' : 'service_id';
        const nameField = job.ref_type === 'order' ? 'product_name' : 'description';

        const { data } = await supabase.from(table)
            .select('product_id')
            .eq(fk, job.ref_id)
            .ilike(nameField, job.job_name) // เทียบชื่อ
            .limit(1)
            .maybeSingle();
            
        if (data?.product_id) {
            setTargetProductId(data.product_id);
        }
    };
    
    if (job.stage === 'preparing' && !targetProductId) {
        fetchSourceItem();
    }

    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, job, targetProductId]);

  const handleCheck = (chkId) => {
    const newLists = checklists.map(c => c.id === chkId ? { ...c, is_checked: !c.is_checked } : c);
    setChecklists(newLists);
    saveChanges({ checklists: newLists });
  };

  const saveChanges = async (updates) => {
    const { data, error } = await supabase.from('assembly_jobs').update(updates).eq('id', job.id).select().single();
    if (data && !error) onUpdate(data);
  };

  const handleAddPart = (part) => {
     // ✅ เพิ่มอะไหล่ลงใน Checklist โดยเก็บ ref_id ไว้เช็คซ้ำ
     const newItem = {
        id: `part-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        name: part.name,
        quantity: part.quantity || 1,
        is_checked: false,
        type: 'part',
        ref_id: part.ref_id || part.id, // เก็บ ID อ้างอิง (สำคัญสำหรับเช็คว่าแอดแล้ว)
        ref_type: part.type // fastener หรือ product
     };
     
     const newLists = [...checklists, newItem];
     setChecklists(newLists);
     saveChanges({ checklists: newLists });
  };

  const handleQCPass = async () => {
     if(!confirm('ยืนยันผลการทดสอบ: ผ่าน?')) return;
     const updates = { stage: 'completed', completed_at: new Date().toISOString() };
     saveChanges(updates);
     onClose();
  };

  const handleQCFail = async () => {
     if (!qcNote.trim()) return alert('กรุณาระบุสิ่งที่ต้องแก้ไข');
     const newLog = { date: new Date().toISOString(), note: qcNote, reporter: 'QC' };
     const updates = { stage: 'assembling', is_rework: true, qc_logs: [...(job.qc_logs || []), newLog] };
     saveChanges(updates);
     setQcNote('');
     alert('ส่งกลับไปแก้ไขเรียบร้อย');
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
         {/* Header */}
         <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
            <div>
               <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <span className="uppercase font-bold">{job.ref_type}</span> #{job.ref_id}
                  {job.is_rework && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"><AlertTriangle size={12}/> งานแก้</span>}
               </div>
               <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 <Box className="text-indigo-600"/> {job.job_name || 'รายละเอียดงานประกอบ'}
               </h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-red-500"><X size={24}/></button>
         </div>

         <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-100 p-4 bg-gray-50/50 flex flex-col gap-2 shrink-0">
               <button onClick={() => setActiveTab('checklist')} className={`text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'checklist' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}>
                  <CheckSquare size={18}/> รายการที่ต้องทำ
               </button>
               <button onClick={() => setActiveTab('qc')} className={`text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'qc' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}>
                  <History size={18}/> ประวัติ QC / ส่งแก้
               </button>
               
               <div className="mt-auto border-t border-gray-200 pt-4">
                  <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">ผู้รับผิดชอบ</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                     {assignees.map((u, i) => (
                        <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white overflow-hidden" title={u.user?.first_name}>
                           {u.user?.avatar_url ? <img src={u.user.avatar_url} className="w-full h-full object-cover"/> : <span className="w-full h-full flex items-center justify-center text-xs">{u.user?.first_name?.[0]}</span>}
                        </div>
                     ))}
                  </div>
                  <ServiceTeamSelector assignees={assignees} onChange={val => { setAssignees(val); saveChanges({ assignees: val }); }} />
               </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
               {activeTab === 'checklist' && (
                  <div className="space-y-4">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><CheckSquare size={20} className="text-indigo-500"/> รายการประกอบ (BOM)</h3>
                        
                        {job.stage === 'preparing' && (
                            <button 
                                onClick={() => setShowAddPart(true)} 
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors border border-indigo-200"
                            >
                                <Plus size={16}/> เพิ่มอะไหล่/รายการ
                            </button>
                        )}
                     </div>
                     
                     <div className="space-y-2">
                        {checklists.length > 0 ? checklists.map((item) => (
                           <div key={item.id} onClick={() => handleCheck(item.id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${item.is_checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-sm'}`}>
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${item.is_checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent group-hover:border-indigo-300'}`}>
                                 <CheckSquare size={14}/>
                              </div>
                              <div className="flex-1">
                                 <p className={`text-sm font-medium ${item.is_checked ? 'text-green-800 line-through decoration-green-300' : 'text-gray-700'}`}>{item.name}</p>
                                 {item.type === 'part' && <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 rounded ml-2">อะไหล่</span>}
                              </div>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">x{item.quantity}</span>
                           </div>
                        )) : (
                            <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                                <Package size={32} className="mx-auto mb-2 opacity-20"/>
                                <p className="text-sm">ยังไม่มีรายการ Checklist</p>
                                {job.stage === 'preparing' && <p className="text-xs text-indigo-500 mt-1">กด "เพิ่มอะไหล่" เพื่อเริ่มเตรียมของ</p>}
                            </div>
                        )}
                     </div>
                  </div>
               )}

               {activeTab === 'qc' && (
                  <div className="space-y-6">
                     {job.stage === 'testing' ? (
                        <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 text-center">
                           <h3 className="font-bold text-purple-900 text-lg mb-4">สถานะ: รอการตรวจสอบ (QC)</h3>
                           <div className="flex justify-center gap-4">
                              <button onClick={handleQCPass} className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold shadow-lg hover:bg-green-600 flex items-center gap-2">
                                 <CheckCircle2 size={20}/> ผ่าน (Pass)
                              </button>
                           </div>
                           <div className="mt-6 pt-6 border-t border-purple-200 text-left">
                              <div className="flex gap-2">
                                 <input 
                                    className="flex-1 border border-purple-200 rounded-xl px-4 py-2 bg-white"
                                    placeholder="ระบุจุดบกพร่อง..."
                                    value={qcNote}
                                    onChange={e => setQcNote(e.target.value)}
                                 />
                                 <button onClick={handleQCFail} className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600">ส่งแก้</button>
                              </div>
                           </div>
                        </div>
                     ) : (
                        <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl bg-gray-50/50">
                           <p>ต้องย้ายงานไปช่อง "การทดสอบ (QC)" ก่อน</p>
                        </div>
                     )}
                     <div>
                        <h4 className="font-bold text-gray-700 mb-3">ประวัติการส่งกลับ</h4>
                        <div className="space-y-3">
                           {job.qc_logs?.length > 0 ? job.qc_logs.map((log, i) => (
                              <div key={i} className="flex gap-3 bg-red-50 p-3 rounded-xl border border-red-100">
                                 <div className="mt-1"><AlertTriangle size={16} className="text-red-500"/></div>
                                 <div>
                                    <p className="text-sm text-red-800 font-medium">{log.note}</p>
                                    <p className="text-xs text-red-400 mt-1">{new Date(log.date).toLocaleString('th-TH')} โดย {log.reporter}</p>
                                 </div>
                              </div>
                           )) : (
                              <p className="text-sm text-gray-400 italic text-center">ยังไม่มีประวัติการตีกลับ</p>
                           )}
                        </div>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
      
      {showAddPart && (
        <AssemblyAddPartModal 
            productId={targetProductId} 
            existingItems={checklists} // ✅ ส่งรายการที่มีอยู่แล้วไปเช็ค
            onClose={() => setShowAddPart(false)} 
            onAdd={handleAddPart} 
        />
      )}
    </div>,
    document.body
  );
};
//send
export default AssemblyJobDetail;