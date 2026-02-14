import React, { useState } from 'react';
import { MessageSquare, History, User, Package, ArrowRight, Trash2, CheckCircle2, AlertTriangle, Clock, Plus, ShieldCheck } from 'lucide-react';

const AssemblySummary = ({ jobs }) => {
  const [activeTab, setActiveTab] = useState('comments'); // 'comments' | 'timeline'

  // 1. รวบรวมคอมเมนต์ทั้งหมด
  const getAllComments = () => {
    let allComments = [];
    if (!jobs) return allComments;
    
    jobs.forEach(job => {
      if (job.comments && job.comments.length > 0) {
        job.comments.forEach(c => {
          allComments.push({
            ...c,
            jobName: job.job_name,
            jobId: job.id,
            jobRef: job.ref_type === 'order' ? 'ORD' : 'SRV',
            type: 'comment'
          });
        });
      }
    });
    // เรียงใหม่ -> เก่า
    return allComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  // 2. รวบรวม Logs ทั้งหมด (Timeline)
  const getAllLogs = () => {
    let allLogs = [];
    if (!jobs) return allLogs;

    jobs.forEach(job => {
      // 2.1 Activity Logs (การกระทำทั่วไป)
      if (job.activity_logs && job.activity_logs.length > 0) {
        job.activity_logs.forEach(log => {
          allLogs.push({
            ...log,
            jobName: job.job_name,
            type: 'activity'
          });
        });
      }
      // 2.2 Creation Log
      if (job.created_at) {
        allLogs.push({
            action: 'JOB_CREATED',
            message: `เริ่มการ์ดงาน: ${job.job_name || 'รายการใหม่'}`,
            user: job.created_by,
            timestamp: job.created_at,
            jobName: job.job_name,
            type: 'system'
        });
      }
    });
    // เรียงใหม่ -> เก่า (ล่าสุดขึ้นก่อน)
    return allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const commentsList = getAllComments();
  const timelineList = getAllLogs();

  // Helper Render Icon
  const getLogIcon = (action) => {
      switch(action) {
          case 'ITEM_PREPARED': return <CheckCircle2 size={14} className="text-green-500"/>;
          case 'ITEM_ASSEMBLED': return <CheckCircle2 size={14} className="text-cyan-500"/>;
          case 'ITEM_DELETED': return <Trash2 size={14} className="text-red-500"/>;
          case 'QC_REJECTED': return <AlertTriangle size={14} className="text-red-500"/>;
          case 'QC_PASSED': return <ShieldCheck size={14} className="text-green-500"/>;
          case 'JOB_CREATED': return <Plus size={14} className="text-blue-500"/>;
          default: return <History size={14} className="text-gray-500"/>;
      }
  };

  return (
    <div className="mt-8 bg-[#18181b] border border-white/10 rounded-2xl overflow-hidden shadow-lg mb-20 animate-in fade-in slide-in-from-bottom-6">
       {/* Header Tabs */}
       <div className="flex border-b border-white/10 bg-[#22272b]">
          <button 
            onClick={() => setActiveTab('comments')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'comments' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
          >
             <MessageSquare size={18}/> รวมคอมเมนต์ ({commentsList.length})
          </button>
          <button 
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'timeline' ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
          >
             <History size={18}/> ไทม์ไลน์งาน ({timelineList.length})
          </button>
       </div>

       {/* Content */}
       <div className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
          
          {/* --- TAB: COMMENTS --- */}
          {activeTab === 'comments' && (
              <div className="flex flex-col">
                  {commentsList.length > 0 ? commentsList.map((c, i) => (
                      <div key={i} className="flex gap-4 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          {/* Avatar */}
                          <div className="shrink-0">
                              <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-[#22272b] flex items-center justify-center overflow-hidden">
                                  {c.avatar_url ? <img src={c.avatar_url} className="w-full h-full object-cover"/> : <span className="text-xs font-bold text-white">{c.user_name?.[0]}</span>}
                              </div>
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                  <div className="flex flex-col">
                                      <span className="font-bold text-gray-200 text-sm">{c.user_name}</span>
                                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                          <Clock size={10}/> {new Date(c.created_at).toLocaleString('th-TH')}
                                      </span>
                                  </div>
                                  {/* Badge: มาจากการ์ดไหน */}
                                  <div className="flex items-center gap-1 bg-[#2c333a] px-2 py-1 rounded text-[10px] text-gray-400 border border-white/5">
                                      <Package size={10} className="text-blue-400"/>
                                      <span className="truncate max-w-[150px]">{c.jobName}</span>
                                  </div>
                              </div>
                              
                              <div className="bg-[#2c333a] p-3 rounded-lg rounded-tl-none text-sm text-gray-300 leading-relaxed shadow-sm">
                                  {c.text}
                                  {c.images && c.images.length > 0 && (
                                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                                          {c.images.map((img, idx) => (
                                              <img key={idx} src={img} className="h-20 rounded border border-white/10" />
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  )) : (
                      <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                          <MessageSquare size={32} className="mb-2 opacity-20"/>
                          ยังไม่มีการพูดคุยในออเดอร์นี้
                      </div>
                  )}
              </div>
          )}

          {/* --- TAB: TIMELINE --- */}
          {activeTab === 'timeline' && (
              <div className="p-6 relative">
                  {/* Vertical Line */}
                  <div className="absolute left-9 top-6 bottom-6 w-0.5 bg-gray-800"></div>

                  {timelineList.length > 0 ? timelineList.map((log, i) => (
                      <div key={i} className="relative flex gap-4 mb-6 last:mb-0 group">
                          {/* Dot Icon */}
                          <div className={`relative z-10 w-6 h-6 rounded-full border-2 border-[#18181b] flex items-center justify-center shrink-0 
                              ${log.action?.includes('REJECT') || log.action?.includes('DELETE') ? 'bg-red-900/50 text-red-400' : 'bg-gray-800 text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-colors'}
                          `}>
                              {getLogIcon(log.action)}
                          </div>
                          
                          <div className="flex-1 bg-[#22272b] p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors shadow-sm">
                              <div className="flex justify-between items-start">
                                  <span className="text-xs font-bold text-blue-400 mb-1 block uppercase tracking-wider">{log.action?.replace(/_/g, ' ')}</span>
                                  <span className="text-[10px] text-gray-600 font-mono">{new Date(log.timestamp).toLocaleString('th-TH')}</span>
                              </div>
                              <p className="text-sm text-gray-300 font-medium">{log.message}</p>
                              
                              <div className="mt-2 flex items-center justify-between pt-2 border-t border-white/5">
                                  <div className="flex items-center gap-1.5">
                                      {log.user?.avatar_url ? (
                                          <img src={log.user.avatar_url} className="w-4 h-4 rounded-full"/>
                                      ) : (
                                          <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-[8px]">{log.user?.name?.[0] || 'S'}</div>
                                      )}
                                      <span className="text-[10px] text-gray-500">{log.user?.name || 'System'}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-600 flex items-center gap-1">
                                      <Package size={10}/> {log.jobName}
                                  </div>
                              </div>
                          </div>
                      </div>
                  )) : (
                      <div className="py-12 text-center text-gray-500 flex flex-col items-center ml-4">
                          <History size={32} className="mb-2 opacity-20"/>
                          ยังไม่มีประวัติกิจกรรม
                      </div>
                  )}
              </div>
          )}
       </div>
    </div>
  );
};

export default AssemblySummary;