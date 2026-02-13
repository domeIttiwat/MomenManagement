import React, { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { supabase } from '@/lib/supabase';
import { RefreshCw, ArrowLeft, KanbanSquare, Zap, LayoutGrid, List as ListIcon } from 'lucide-react';
import IncomingJobs from './IncomingJobs';
import AssemblyBoard from './AssemblyBoard';
import AssemblyAddPartModal from './AssemblyAddPartModal';

const AssemblyMain = () => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'board'
  const [cardViewMode, setCardViewMode] = useState('card'); 
  
  const [activeOrders, setActiveOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null); 
  const [orderJobs, setOrderJobs] = useState([]); 
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [addPartJob, setAddPartJob] = useState(null);
  const [targetProductId, setTargetProductId] = useState(null);

  useEffect(() => {
    fetchData();
    fetchUser();
    const savedMode = localStorage.getItem('assembly_card_view_mode');
    if (savedMode) setCardViewMode(savedMode);
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setCurrentUser({ ...user, ...profile });
    }
  };

  const toggleCardView = (mode) => {
      setCardViewMode(mode);
      localStorage.setItem('assembly_card_view_mode', mode);
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

      // Fetch stats for all
      const allOrderIds = orders?.map(o => o.id) || [];
      const allServiceIds = services?.map(s => s.id) || [];
      
      const { data: allJobs } = await supabase.from('assembly_jobs')
        .select('ref_id, ref_type, stage, assignees, comments, qc_logs')
        .neq('stage', 'archived')
        .in('ref_id', [...allOrderIds, ...allServiceIds]);

      const getStats = (type, id) => {
          const relatedJobs = allJobs?.filter(j => j.ref_type === type && j.ref_id === id) || [];
          if (relatedJobs.length === 0) return null;

          const total = relatedJobs.length;
          const stages = { preparing: 0, assembling: 0, testing: 0, completed: 0 };
          const assigneesMap = new Map();
          let commentCount = 0;
          let rejectCount = 0;

          relatedJobs.forEach(j => {
              stages[j.stage] = (stages[j.stage] || 0) + 1;
              if (j.assignees) j.assignees.forEach(a => { if (a.user) assigneesMap.set(a.user.id, a.user); });
              if (j.comments) commentCount += j.comments.length;
              if (j.qc_logs) rejectCount += j.qc_logs.length;
          });

          const score = (stages.preparing * 1) + (stages.assembling * 2) + (stages.testing * 3) + (stages.completed * 4);
          const maxScore = total * 4;
          const percentage = total === 0 ? 0 : Math.round((score / maxScore) * 100);

          return { total, stages, percentage, assignees: Array.from(assigneesMap.values()), commentCount, rejectCount };
      };

      const combined = [
        ...(orders || []).map(o => ({ type: 'order', data: o, items: o.order_items, stats: getStats('order', o.id) })),
        ...(services || []).map(s => ({ type: 'service', data: s, items: s.service_items, stats: getStats('service', s.id) }))
      ].sort((a, b) => new Date(b.data.created_at) - new Date(a.data.created_at));

      setActiveOrders(combined);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // ✅ FIX: คืนค่า Array เสมอ ไม่คืน null
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
        return createdJobs || []; // ✅ Force array
      }
      return [];
  };

  const handleEnterBoard = async (workOrder) => {
    setLoading(true);
    try {
      const { data: existingJobs } = await supabase.from('assembly_jobs').select('*').eq('ref_type', workOrder.type).eq('ref_id', workOrder.data.id).neq('stage', 'archived');
      let jobsToShow = existingJobs || [];

      if (jobsToShow.length === 0) {
        jobsToShow = await createDefaultJobs(workOrder);
      }

      setOrderJobs(jobsToShow || []); // ✅ ป้องกัน null
      setCurrentOrder(workOrder);
      setViewMode('board');
    } catch (error) { alert('Error: ' + error.message); } finally { setLoading(false); }
  };

  // ✅ Reset Board & Regenerate Default Cards
  const handleResetBoard = async (workOrder) => {
      try {
          // 1. Delete all jobs
          await supabase.from('assembly_jobs').delete().eq('ref_type', workOrder.type).eq('ref_id', workOrder.data.id);
          
          // 2. Regenerate immediately
          await createDefaultJobs(workOrder);
          
          // 3. Refresh Data
          fetchData();
      } catch (error) {
          console.error("Reset failed:", error);
          alert("Reset failed: " + error.message);
      }
  };

  const updateJobStage = async (jobId, newStage) => {
    setOrderJobs(prev => prev.map(j => j.id === jobId ? { ...j, stage: newStage } : j));
    const updatePayload = { stage: newStage };
    if (newStage === 'completed') updatePayload.completed_at = new Date().toISOString();
    await supabase.from('assembly_jobs').update(updatePayload).eq('id', jobId);
  };

  const handleDragEnd = async (result) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const realJobId = parseInt(draggableId.toString().split('::')[0]);
    updateJobStage(realJobId, destination.droppableId);
  };

  const handleManualMove = (jobId, newStage) => updateJobStage(jobId, newStage);

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
      setAddPartJob(null);
  };

  const handleAddCard = async (stage, jobName) => {
      if (!currentOrder) return;
      const newJobPayload = {
          ref_type: currentOrder.type,
          ref_id: currentOrder.data.id,
          stage: stage,
          job_name: jobName,
          checklists: [],
          comments: [],
          is_rework: false,
          started_at: new Date().toISOString(),
          created_by: currentUser ? { id: currentUser.id, name: currentUser.first_name || 'User', avatar_url: currentUser.avatar_url } : { name: 'Unknown' }
      };
      const { data, error } = await supabase.from('assembly_jobs').insert([newJobPayload]).select().single();
      if (data && !error) setOrderJobs(prev => [data, ...prev]);
  };

  const handleAddComment = async (job, text) => {
      if (!currentUser) return alert('กรุณาเข้าสู่ระบบ');
      const newComment = {
          id: Date.now(),
          text: text,
          user_id: currentUser.id,
          user_name: currentUser.first_name || 'User',
          avatar_url: currentUser.avatar_url,
          created_at: new Date().toISOString()
      };
      const newComments = [...(job.comments || []), newComment];
      const updatedJob = { ...job, comments: newComments };
      handleJobUpdate(updatedJob);
      await supabase.from('assembly_jobs').update({ comments: newComments }).eq('id', job.id);
  };

  const handleDeleteCard = async (jobId) => {
      setOrderJobs(prev => prev.filter(j => j.id !== jobId));
      await supabase.from('assembly_jobs').delete().eq('id', jobId);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans text-gray-200" style={{ backgroundColor: '#1d2125' }}>
      {/* Header */}
      <div className="relative z-20 bg-[#161a1d] border-b border-white/10 px-4 h-14 shrink-0 flex items-center justify-between shadow-md">
         <div className="flex items-center gap-3">
             {viewMode === 'board' && (
                <button onClick={() => setViewMode('list')} className="p-1.5 hover:bg-white/20 rounded text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft size={20}/>
                </button>
             )}
             <div>
                <h1 className="font-bold text-lg text-white flex items-center gap-2">
                    {viewMode === 'list' ? <><Zap size={18} className="text-yellow-400 fill-yellow-400"/> Workshop Queue</> : <><KanbanSquare size={18} className="text-blue-400"/> Assembly Board</>}
                </h1>
                {viewMode === 'board' && currentOrder && (
                  <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
                     <span className="font-mono bg-white/10 px-1.5 rounded text-gray-300">{currentOrder.type === 'order' ? currentOrder.data.order_number : currentOrder.data.service_number}</span>
                     <span>|</span>
                     <span>{currentOrder.data.customer_cache?.first_name}</span>
                  </div>
                )}
             </div>
         </div>

         <div className="flex items-center gap-3">
            {viewMode === 'board' && (
                <div className="flex bg-[#22272b] p-0.5 rounded-lg border border-white/10 mr-2">
                    <button onClick={() => toggleCardView('card')} className={`p-1.5 rounded-md transition-all ${cardViewMode === 'card' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><LayoutGrid size={16}/></button>
                    <button onClick={() => toggleCardView('list')} className={`p-1.5 rounded-md transition-all ${cardViewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><ListIcon size={16}/></button>
                </div>
            )}
            <button onClick={() => { fetchData(); if(currentOrder && viewMode === 'board') handleEnterBoard(currentOrder); }} className="p-1.5 hover:bg-white/20 rounded text-gray-400 hover:text-white transition-colors">
               <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:bg-blue-500 shadow-sm border border-white/10 overflow-hidden" title={currentUser?.email}>
                {currentUser?.avatar_url ? <img src={currentUser.avatar_url} className="w-full h-full object-cover"/> : (currentUser?.first_name?.[0] || 'U')}
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-hidden relative z-10">
         {viewMode === 'list' ? (
             <div className="h-full overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/20">
                <div className="max-w-5xl mx-auto"><IncomingJobs orders={activeOrders} onEnterBoard={handleEnterBoard} onReset={handleResetBoard} /></div>
             </div>
         ) : (
             <div className="h-full w-full overflow-x-auto overflow-y-hidden p-4">
                <DragDropContext onDragEnd={handleDragEnd}>
                   <AssemblyBoard 
                        jobs={orderJobs || []} // ✅ Pass safe array
                        onJobClick={() => {}} 
                        onManualMove={handleManualMove} 
                        onJobUpdate={handleJobUpdate}
                        onAddPartRequest={(job) => setAddPartJob(job)} 
                        onAddCard={handleAddCard}
                        onAddComment={handleAddComment}
                        onDeleteCard={handleDeleteCard}
                        currentUser={currentUser}
                        cardViewMode={cardViewMode}
                   />
                </DragDropContext>
             </div>
         )}
      </div>

      {addPartJob && <AssemblyAddPartModal productId={targetProductId} existingItems={addPartJob.checklists} onClose={() => setAddPartJob(null)} onAdd={handleAddPartToJob} />}
    </div>
  );
};

export default AssemblyMain;