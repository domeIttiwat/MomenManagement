import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, ArrowLeft, KanbanSquare, Zap, LayoutList } from 'lucide-react';
import IncomingJobs from './IncomingJobs';
import AssemblyTabs from './AssemblyTabs'; 
import AssemblyStrip from './AssemblyStrip';
import AssemblyAddPartModal from './AssemblyAddPartModal';
import AssemblyTaskTable from './AssemblyTaskTable'; 
import AssemblySummary from './AssemblySummary'; 

const AssemblyMain = () => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'workspace'
  
  const [activeOrders, setActiveOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null); 
  const [orderJobs, setOrderJobs] = useState([]); 
  const [activeTab, setActiveTab] = useState('preparing'); 
  const [currentUser, setCurrentUser] = useState(null);
  
  // State Modal
  const [addPartJob, setAddPartJob] = useState(null);
  const [targetProductId, setTargetProductId] = useState(null);

  // ✅ State สำหรับวาร์ปไปหาการ์ด (Focus)
  const [focusJobId, setFocusJobId] = useState(null);

  useEffect(() => {
    fetchData();
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setCurrentUser({ ...user, ...profile });
    }
  };

  useEffect(() => {
    if (!addPartJob) { setTargetProductId(null); return; }
    const fetchProductId = async () => {
        let foundId = null;
        if (addPartJob.ref_type === 'order') {
            const { data } = await supabase.from('order_items').select('product_id').eq('order_id', addPartJob.ref_id).ilike('product_name', addPartJob.job_name).limit(1).maybeSingle();
            if (data?.product_id) foundId = data.product_id;
        } 
        if (!foundId && addPartJob.job_name) {
            const { data } = await supabase.from('products').select('id').ilike('name', addPartJob.job_name).limit(1).maybeSingle();
            if (data?.id) foundId = data.id;
        }
        setTargetProductId(foundId);
    };
    fetchProductId();
  }, [addPartJob]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: orders } = await supabase.from('orders')
        .select('id, order_number, customer_cache, status, order_date, created_at, grand_total, order_items(*)')
        .eq('status', 'Assembling')
        .order('created_at', { ascending: false });

      const { data: services } = await supabase.from('services')
        .select('id, service_number, customer_cache, status, received_date, created_at, grand_total, service_items(*)')
        .eq('status', 'In Progress')
        .order('created_at', { ascending: false });

      const combined = [
        ...(orders || []).map(o => ({ type: 'order', data: o, items: o.order_items })),
        ...(services || []).map(s => ({ type: 'service', data: s, items: s.service_items }))
      ].sort((a, b) => new Date(b.data.created_at) - new Date(a.data.created_at));

      setActiveOrders(combined);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const createDefaultJobs = async (workOrder) => {
      if (workOrder.items?.length > 0) {
        const newJobsPayload = workOrder.items.map((item, idx) => ({
          ref_type: workOrder.type,
          ref_id: workOrder.data.id,
          stage: 'preparing',
          job_name: item.product_name || item.description || 'รายการไม่ระบุชื่อ',
          checklists: [], 
          is_rework: false,
          started_at: new Date().toISOString(),
          created_by: currentUser ? { id: currentUser.id, name: currentUser.first_name || 'System', avatar_url: currentUser.avatar_url } : { name: 'System' }
        }));
        const { data: createdJobs } = await supabase.from('assembly_jobs').insert(newJobsPayload).select();
        return createdJobs || [];
      }
      return [];
  };

  const handleEnterBoard = async (workOrder) => {
    setLoading(true);
    try {
      const { data: existingJobs } = await supabase.from('assembly_jobs')
        .select('*')
        .eq('ref_type', workOrder.type)
        .eq('ref_id', workOrder.data.id)
        .neq('stage', 'archived')
        .order('created_at');
        
      let jobsToShow = existingJobs || [];

      if (jobsToShow.length === 0) {
        jobsToShow = await createDefaultJobs(workOrder);
      }
      
      setOrderJobs(jobsToShow);
      setCurrentOrder(workOrder);
      setViewMode('workspace');
      setActiveTab('preparing'); 
    } catch (error) { alert('Error: ' + error.message); } finally { setLoading(false); }
  };

  const handleResetBoard = async (workOrder) => {
      try {
          await supabase.from('assembly_jobs').delete().eq('ref_type', workOrder.type).eq('ref_id', workOrder.data.id);
          await createDefaultJobs(workOrder);
          fetchData(); 
      } catch (error) {
          alert("Reset failed: " + error.message);
      }
  };

  const handleJobUpdate = (updatedJob) => {
    setOrderJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    if (addPartJob?.id === updatedJob.id) setAddPartJob(updatedJob);
  };

  const handleAddPartToJob = async (part) => {
      if (!addPartJob) return;
      const newItem = {
        id: `part-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: part.name || part.description,
        quantity: part.quantity || 1,
        is_checked: false,
        type: part.type === 'custom' ? 'custom' : 'part', 
        ref_id: part.id || part.ref_id || null 
      };
      const newChecklists = [...(addPartJob.checklists || []), newItem];
      const updatedJob = { ...addPartJob, checklists: newChecklists };
      handleJobUpdate(updatedJob); 
      await supabase.from('assembly_jobs').update({ checklists: newChecklists }).eq('id', addPartJob.id);
      
      // Log Activity
      handleLogActivity(addPartJob, 'ITEM_ADDED', `เพิ่มรายการ: ${part.name} (x${part.quantity})`);
  };

  const handleAddComment = async (job, text, images = []) => {
      if (!currentUser) return alert('กรุณาเข้าสู่ระบบ');
      let uploadedImageUrls = [];
      if (images && images.length > 0) {
          try {
              const uploadPromises = images.map(async (file) => {
                  const fileName = `comment-${Date.now()}-${Math.random()}`;
                  const { error } = await supabase.storage.from('orders').upload(fileName, file);
                  if (error) throw error;
                  const { data } = supabase.storage.from('orders').getPublicUrl(fileName);
                  return data.publicUrl;
              });
              uploadedImageUrls = await Promise.all(uploadPromises);
          } catch (error) {
              return alert("อัปโหลดรูปภาพไม่สำเร็จ: " + error.message);
          }
      }
      const newComment = {
          id: Date.now(),
          text: text,
          user_id: currentUser.id,
          user_name: currentUser.first_name || 'User',
          avatar_url: currentUser.avatar_url,
          created_at: new Date().toISOString(),
          images: uploadedImageUrls
      };
      const newComments = [...(job.comments || []), newComment];
      const updatedJob = { ...job, comments: newComments };
      handleJobUpdate(updatedJob);
      await supabase.from('assembly_jobs').update({ comments: newComments }).eq('id', job.id);
  };

  const handleDeleteJob = async (jobId) => {
      setOrderJobs(prev => prev.filter(j => j.id !== jobId));
      await supabase.from('assembly_jobs').delete().eq('id', jobId);
  };

  // ✅ Log Activity Helper
  const handleLogActivity = async (job, action, message) => {
      if (!currentUser) return;
      const newLog = {
          action: action,
          message: message,
          user: { id: currentUser.id, name: currentUser.first_name || 'User', avatar_url: currentUser.avatar_url },
          timestamp: new Date().toISOString()
      };
      const newLogs = [...(job.activity_logs || []), newLog];
      const updatedJob = { ...job, activity_logs: newLogs };
      handleJobUpdate(updatedJob);
      await supabase.from('assembly_jobs').update({ activity_logs: newLogs }).eq('id', job.id);
  };

  // ✅ ฟังก์ชันวาร์ป (Jump to Job)
  const handleJumpToJob = (jobId, stage) => {
      setActiveTab(stage); // 1. เปลี่ยน Tab ไปหาการ์ด
      // 2. ส่งสัญญาณ Focus (ใช้ timestamp เพื่อให้ค่าเปลี่ยนตลอดแม้ ID เดิม)
      setFocusJobId({ id: jobId, ts: Date.now() }); 
  };

  const getFilteredJobs = () => {
      if (activeTab === 'preparing') {
          return orderJobs.filter(j => j.stage === 'preparing' || j.stage === 'assembling');
      }
      if (activeTab === 'assembling') {
          return orderJobs.filter(j => {
             const isRelevant = j.stage === 'preparing' || j.stage === 'assembling';
             if (!isRelevant) return false;
             if (j.stage === 'preparing' && (!j.checklists || j.checklists.length === 0)) return false;
             return true;
          });
      }
      return orderJobs.filter(j => j.stage === activeTab);
  };

  const filteredJobs = getFilteredJobs();

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans text-gray-200" style={{ backgroundColor: '#1d2125' }}>
      {/* Header */}
      <div className="relative z-20 bg-[#161a1d] border-b border-white/10 px-4 h-14 shrink-0 flex items-center justify-between shadow-md">
         <div className="flex items-center gap-3">
             {viewMode === 'workspace' && (
                <button onClick={() => setViewMode('list')} className="p-1.5 hover:bg-white/20 rounded text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft size={20}/>
                </button>
             )}
             <div>
                <h1 className="font-bold text-lg text-white flex items-center gap-2">
                    {viewMode === 'list' ? 
                        <><Zap size={18} className="text-yellow-400 fill-yellow-400" /> Workshop Queue</> : 
                        <><KanbanSquare size={18} className="text-blue-400" /> Assembly Workspace</>
                    }
                </h1>
                {viewMode === 'workspace' && currentOrder && (
                  <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
                     <span className="font-mono bg-white/10 px-1.5 rounded text-gray-300">{currentOrder.type === 'order' ? currentOrder.data.order_number : currentOrder.data.service_number}</span>
                     <span>|</span>
                     <span>{currentOrder.data.customer_cache?.first_name}</span>
                  </div>
                )}
             </div>
         </div>
         <div className="flex items-center gap-3">
            <button onClick={() => { fetchData(); if(currentOrder && viewMode === 'workspace') handleEnterBoard(currentOrder); }} className="p-1.5 hover:bg-white/20 rounded text-gray-400 hover:text-white transition-colors">
               <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:bg-blue-500 shadow-sm border border-white/10 overflow-hidden" title={currentUser?.email}>
                {currentUser?.avatar_url ? <img src={currentUser.avatar_url} className="w-full h-full object-cover"/> : (currentUser?.first_name?.[0] || 'U')}
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
         {viewMode === 'list' ? (
             <div className="h-full overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/20">
                <div className="max-w-5xl mx-auto"><IncomingJobs orders={activeOrders} onEnterBoard={handleEnterBoard} onReset={handleResetBoard} /></div>
             </div>
         ) : (
             <div className="h-full flex flex-col max-w-6xl mx-auto w-full">
                <div className="px-4 pt-6 pb-2 shrink-0">
                    <AssemblyTabs activeTab={activeTab} onTabChange={setActiveTab} jobs={orderJobs} />
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-10 custom-scrollbar">
                    <div className="space-y-3">
                        {filteredJobs.length > 0 ? (
                            filteredJobs.map(job => (
                                <AssemblyStrip 
                                    key={job.id} 
                                    id={`job-strip-${job.id}`} // ✅ ID สำหรับ scroll มาหา
                                    job={job} 
                                    viewContext={activeTab}
                                    currentUser={currentUser}
                                    onUpdate={handleJobUpdate}
                                    onAddPart={() => setAddPartJob(job)}
                                    onAddComment={handleAddComment}
                                    onDelete={handleDeleteJob}
                                    onLogActivity={handleLogActivity} // ✅ ส่ง Log function
                                    focusRequest={focusJobId} // ✅ ส่งคำสั่งวาร์ป
                                />
                            ))
                        ) : (
                            <div className="text-center py-20 text-gray-500 border-2 border-dashed border-white/5 rounded-2xl mt-4">
                                <LayoutList size={48} className="mx-auto mb-4 opacity-20"/>
                                <p>ไม่มีงานในขั้นตอน {activeTab.toUpperCase()}</p>
                            </div>
                        )}

                        <AssemblyTaskTable 
                            jobs={orderJobs} 
                            activeTab={activeTab} 
                            onUpdateJob={handleJobUpdate} 
                            currentUser={currentUser} 
                        />
                        
                        {/* ✅ สรุปงานและส่ง handleJumpToJob ไปให้ใช้ */}
                        <AssemblySummary jobs={orderJobs} onCommentClick={handleJumpToJob} />
                    </div>
                </div>
             </div>
         )}
      </div>

      {addPartJob && (
        <AssemblyAddPartModal 
            productId={targetProductId} 
            existingItems={addPartJob.checklists}
            onClose={() => setAddPartJob(null)} 
            onAdd={handleAddPartToJob} 
        />
      )}
    </div>
  );
};

export default AssemblyMain;