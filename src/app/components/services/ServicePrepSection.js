'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Hammer, Plus, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import AssemblyForm from '@/app/components/assembly/AssemblyForm';
import AssemblyDetail from '@/app/components/assembly/AssemblyDetail';

const STAGE_LABEL = { preparing: 'เตรียมของ', in_progress: 'กำลังทำ', qc: 'QC / ทดสอบ', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };

// งานจัดของของงานบริการ = ใช้ "ระบบงานประกอบ (assembly)" เป็นระบบกลาง (ref_type='service')
// สร้างงานจัดของ → เลือกของจากคลัง/เพิ่มเอง (ใน AssemblyForm) → เบิก/เตรียม (ใน AssemblyDetail) เหมือนฝั่ง order 100%
const ServicePrepSection = ({ service }) => {
  const { can, profile } = useAuth();
  const meRef = () => (profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | form | detail
  const [selectedJob, setSelectedJob] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('assembly_jobs').select('*')
      .eq('ref_type', 'service').eq('ref_id', String(service.id))
      .order('created_at', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  }, [service.id]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const refreshSelected = async (id) => {
    const { data } = await supabase.from('assembly_jobs').select('*').eq('id', id).single();
    if (data) setSelectedJob(data);
  };

  // AssemblyDetail.onDelete ทำ auto-return ของที่เบิกไว้ + confirm ให้แล้ว → ที่นี่แค่ลบ row + log
  const handleDelete = async (id) => {
    const target = jobs.find(j => j.id === id) || selectedJob;
    await logAction({ resource_type: 'assembly', resource_id: id, action: 'delete', resource_label: target?.title || target?.job_number, created_by: meRef() });
    await supabase.from('assembly_jobs').delete().eq('id', id);
    setSelectedJob(null); setView('list'); fetchJobs();
  };

  // prefill สำหรับสร้างใหม่: ผูกกับ service นี้เลย (AssemblyForm จะ auto-populate items จาก service_items ให้)
  const newJobPrefill = {
    ref_type: 'service',
    ref_id: service.id,
    customer_cache: service.customer_cache || null,
    title: `จัดของ ${service.service_number || ''}`.trim(),
  };

  if (view === 'form') return (
    <AssemblyForm
      initialData={selectedJob || newJobPrefill}
      onCancel={() => { setSelectedJob(null); setView('list'); }}
      onSuccess={() => { setSelectedJob(null); setView('list'); fetchJobs(); }}
    />
  );

  if (view === 'detail' && selectedJob) return (
    <AssemblyDetail
      job={selectedJob}
      onBack={() => { setSelectedJob(null); setView('list'); fetchJobs(); }}
      onEdit={() => setView('form')}
      onDelete={() => handleDelete(selectedJob.id)}
      onRefresh={() => refreshSelected(selectedJob.id)}
    />
  );

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Hammer size={17} className="text-amber-500" /> จัดของ / เตรียมของให้ช่าง</h3>
        {can('assembly', 'create') && (
          <button onClick={() => { setSelectedJob(null); setView('form'); }} className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl">
            <Plus size={14} /> สร้างงานจัดของ
          </button>
        )}
      </div>
      {loading ? (
        <div className="py-8 text-center text-gray-400"><Loader2 size={20} className="animate-spin inline" /></div>
      ) : jobs.length === 0 ? (
        <p className="py-8 text-center text-gray-400 text-sm">ยังไม่มีงานจัดของ — กด "สร้างงานจัดของ" เพื่อสร้างรายการที่ต้องเตรียม แล้วเบิกจากคลังหรือเพิ่มเอง (ใช้ระบบเดียวกับฝั่งคำสั่งซื้อ)</p>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const items = job.items || [];
            const done = items.filter(i => i.assembled_at || i.prepared_at).length;
            const pct = items.length ? Math.round((done / items.length) * 100) : 0;
            return (
              <button key={job.id} onClick={() => { setSelectedJob(job); setView('detail'); }} className="group w-full text-left border border-gray-100 hover:border-amber-300 hover:shadow-sm rounded-2xl p-4 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate group-hover:text-amber-700">{job.title}</p>
                    <p className="text-xs text-gray-400 font-mono">{job.job_number} · {STAGE_LABEL[job.stage] || job.stage}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500">{items.length} รายการ · {pct}%</span>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-amber-500" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServicePrepSection;
