import React, { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { supabase } from '@/lib/supabase';
import { RefreshCw, ArrowLeft, KanbanSquare, Zap } from 'lucide-react';
import IncomingJobs from './IncomingJobs';
import AssemblyBoard from './AssemblyBoard';
// ❌ AssemblyJobDetail ถูกเอาออกแล้ว
import AssemblyAddPartModal from './AssemblyAddPartModal';

const AssemblyMain = () => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  
  const [activeOrders, setActiveOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null); 
  const [orderJobs, setOrderJobs] = useState([]); 
  
  // State สำหรับ Modal เพิ่มอะไหล่
  const [addPartJob, setAddPartJob] = useState(null);
  const [targetProductId, setTargetProductId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  // ค้นหา Product ID เมื่อเปิด Modal เพิ่มอะไหล่
  useEffect(() => {
    if (!addPartJob) {
        setTargetProductId(null);
        return;
    }

    const fetchProductId = async () => {
        if (addPartJob.ref_type === 'order') {
            const { data } = await supabase.from('order_items')
                .select('product_id')
                .eq('order_id', addPartJob.ref_id)
                .ilike('product_name', addPartJob.job_name)
                .limit(1)
                .maybeSingle();
            
            if (data?.product_id) setTargetProductId(data.product_id);
        }
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

  const handleEnterBoard = async (workOrder) => {
    setLoading(true);
    try {
      const { data: existingJobs } = await supabase.from('assembly_jobs').select('*').eq('ref_type', workOrder.type).eq('ref_id', workOrder.data.id).neq('stage', 'archived');
      let jobsToShow = existingJobs || [];

      if (jobsToShow.length === 0 && workOrder.items?.length > 0) {
        const newJobsPayload = workOrder.items.map((item, idx) => ({
          ref_type: workOrder.type,
          ref_id: workOrder.data.id,
          stage: 'preparing',
          job_name: item.product_name || item.description || 'รายการไม่ระบุชื่อ',
          checklists: [], 
          is_rework: false,
          started_at: new Date().toISOString()
        }));
        const { data: createdJobs } = await supabase.from('assembly_jobs').insert(newJobsPayload).select();
        if (createdJobs) jobsToShow = createdJobs;
      }
      setOrderJobs(jobsToShow);
      setCurrentOrder(workOrder);
      setViewMode('board');
    } catch (error) { alert('Error: ' + error.message); } finally { setLoading(false); }
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
    updateJobStage(parseInt(draggableId), destination.droppableId);
  };

  const handleManualMove = (jobId, newStage) => updateJobStage(jobId, newStage);

  const handleJobUpdate = (updatedJob) => {
    setOrderJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    if (addPartJob?.id === updatedJob.id) setAddPartJob(updatedJob);
  };

  // ✅ Add Part & Close Modal immediately
  const handleAddPartToJob = async (part) => {
      if (!addPartJob) return;
      const newItem = {
        id: `part-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: part.name || part.description,
        quantity: part.quantity || 1,
        is_checked: false,
        is_assembled: false, // Default
        type: part.type === 'custom' ? 'custom' : 'part', 
        ref_id: part.id || part.ref_id || null 
      };
      const newChecklists = [...(addPartJob.checklists || []), newItem];
      
      const updatedJob = { ...addPartJob, checklists: newChecklists };
      handleJobUpdate(updatedJob); 
      await supabase.from('assembly_jobs').update({ checklists: newChecklists }).eq('id', addPartJob.id);

      // ✅ ปิด Modal ทันที
      setAddPartJob(null);
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
            <button onClick={() => { fetchData(); if(currentOrder && viewMode === 'board') handleEnterBoard(currentOrder); }} className="p-1.5 hover:bg-white/20 rounded text-gray-400 hover:text-white transition-colors">
               <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
            </button>
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative z-10">
         {viewMode === 'list' ? (
             <div className="h-full overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/20">
                <div className="max-w-5xl mx-auto"><IncomingJobs orders={activeOrders} onEnterBoard={handleEnterBoard} /></div>
             </div>
         ) : (
             <div className="h-full w-full overflow-x-auto overflow-y-hidden p-4">
                <DragDropContext onDragEnd={handleDragEnd}>
                   <AssemblyBoard 
                        jobs={orderJobs} 
                        onJobClick={() => {}} // ❌ ไม่ทำอะไรเมื่อคลิกการ์ด
                        onManualMove={handleManualMove} 
                        onJobUpdate={handleJobUpdate}
                        onAddPartRequest={(job) => setAddPartJob(job)} 
                   />
                </DragDropContext>
             </div>
         )}
      </div>

      {/* Modal เพิ่มอะไหล่ */}
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