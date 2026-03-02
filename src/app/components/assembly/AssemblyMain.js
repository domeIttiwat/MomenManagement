import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Loader2, History, Filter, Hammer, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import AssemblyForm from './AssemblyForm';
import AssemblyDetail from './AssemblyDetail';

const STAGE_CONFIG = {
  preparing:   { label: 'เตรียมของ',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  in_progress: { label: 'กำลังทำ',    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  qc:          { label: 'QC / ทดสอบ', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  completed:   { label: 'เสร็จสิ้น',  badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled:   { label: 'ยกเลิก',     badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

const PROGRESS_COLOR = {
  completed: 'bg-emerald-500',
  qc: 'bg-purple-500',
  in_progress: 'bg-blue-500',
  preparing: 'bg-amber-500',
  cancelled: 'bg-slate-600',
};

const AssemblyMain = () => {
  const { can } = useAuth();
  const [view, setView] = useState('list');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [showHistory, setShowHistory] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('assembly_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setJobs(data);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('ลบใบงานนี้?')) return;
    await supabase.from('assembly_jobs').delete().eq('id', id);
    fetchJobs();
    setView('list');
  };

  const filtered = useMemo(() => {
    let result = [...jobs];
    if (!showHistory) result = result.filter(j => j.stage !== 'completed' && j.stage !== 'cancelled');
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(j =>
        j.job_number?.toLowerCase().includes(s) ||
        j.title?.toLowerCase().includes(s) ||
        j.customer_cache?.first_name?.toLowerCase().includes(s) ||
        j.customer_cache?.last_name?.toLowerCase().includes(s) ||
        j.customer_cache?.phone?.includes(s)
      );
    }
    if (filterStage !== 'All') result = result.filter(j => j.stage === filterStage);
    return result;
  }, [jobs, search, filterStage, showHistory]);

  const refreshSelected = async (id) => {
    const { data } = await supabase.from('assembly_jobs').select('*').eq('id', id).single();
    if (data) setSelectedJob(data);
  };

  if (view === 'form') return (
    <AssemblyForm
      initialData={selectedJob}
      onCancel={() => { setSelectedJob(null); setView('list'); }}
      onSuccess={() => { setSelectedJob(null); setView('list'); fetchJobs(); }}
    />
  );

  if (view === 'detail') return (
    <AssemblyDetail
      job={selectedJob}
      onBack={() => { setSelectedJob(null); setView('list'); fetchJobs(); }}
      onEdit={() => setView('form')}
      onDelete={() => handleDelete(selectedJob.id)}
      onRefresh={() => refreshSelected(selectedJob.id)}
    />
  );

  const JobCard = ({ job }) => {
    const items = job.items || [];
    const total = items.length;
    const prepared  = items.filter(i => i.prepared_at || i.skip_prepare).length;
    const assembled = items.filter(i => i.assembled_at).length;
    const remaining = total - assembled;
    const done = items.filter(i => i.qc_status === 'passed' || i.assembled_at || i.prepared_at).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const stageConf = STAGE_CONFIG[job.stage] || STAGE_CONFIG.preparing;
    const assignees = job.assignees || [];

    return (
      <div
        onClick={() => { setSelectedJob(job); setView('detail'); }}
        className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/80 cursor-pointer transition-all duration-200 active:scale-[0.99] p-5 group"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-slate-500">{job.job_number}</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${stageConf.badge}`}>
                {stageConf.label}
              </span>
              {job.ref_type && (
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                  job.ref_type === 'order'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                }`}>
                  {job.ref_type === 'order' ? '🛒 Order' : '🔧 Service'}
                </span>
              )}
            </div>
            <h3 className="font-bold text-white text-sm truncate group-hover:text-amber-300 transition-colors">
              {job.title}
            </h3>
            {job.customer_cache?.first_name && (
              <p className="text-sm text-slate-400 mt-0.5 truncate">
                {job.customer_cache.first_name} {job.customer_cache.last_name}
                {job.customer_cache.phone && (
                  <span className="ml-2 text-slate-500 text-xs">{job.customer_cache.phone}</span>
                )}
              </p>
            )}
          </div>

          {assignees.length > 0 && (
            <div className="flex -space-x-2 shrink-0">
              {assignees.slice(0, 3).map((a, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-amber-900/60 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-amber-300 overflow-hidden">
                  {a.user?.avatar_url
                    ? <img src={a.user.avatar_url} className="w-full h-full object-cover" alt="" />
                    : (a.user?.first_name?.[0] || '?')
                  }
                </div>
              ))}
              {assignees.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-300">
                  +{assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="mt-2 mb-3 space-y-2">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-600">ความคืบหน้า</span>
              <span className="text-slate-500">{pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${PROGRESS_COLOR[job.stage] || 'bg-amber-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg">
                รายการ <span className="text-slate-300 font-semibold">{total}</span>
              </span>
              <span className="text-[11px] text-amber-600/80 bg-amber-500/8 border border-amber-500/15 px-2 py-0.5 rounded-lg">
                เตรียมแล้ว <span className="font-semibold">{prepared}</span>
              </span>
              <span className="text-[11px] text-blue-400/80 bg-blue-500/8 border border-blue-500/15 px-2 py-0.5 rounded-lg">
                ทำเสร็จ <span className="font-semibold">{assembled}</span>
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-lg border ${
                remaining === 0
                  ? 'text-emerald-400/80 bg-emerald-500/8 border-emerald-500/15'
                  : 'text-slate-500 bg-slate-800/60 border-slate-700'
              }`}>
                คงเหลือ <span className="font-semibold">{remaining}</span>
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-600">
            {new Date(job.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <ChevronRight size={14} className="text-slate-700 group-hover:text-amber-400 transition-colors" />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-950 rounded-3xl p-4 md:p-6 min-h-[calc(100vh-8rem)] space-y-5 pb-20 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-br from-amber-900/60 via-slate-900 to-slate-900 p-6 rounded-2xl border border-amber-800/20">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
            <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900">
              <Hammer size={20} className="text-white" />
            </div>
            งานประกอบ
          </h1>
          <p className="text-slate-400 mt-1.5 ml-1 text-sm">
            {filtered.length} รายการ
            {!showHistory && (
              <span className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded ml-2 border border-slate-700">
                ซ่อนรายการเสร็จสิ้น
              </span>
            )}
          </p>
        </div>
        {can('assembly', 'create') && (
          <button
            onClick={() => { setSelectedJob(null); setView('form'); }}
            className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-amber-950 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus size={20} /> สร้างใบงานใหม่
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-2 rounded-2xl flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
            <input
              className="w-full pl-11 pr-4 py-3 bg-slate-800 text-white placeholder:text-slate-500 rounded-xl outline-none border border-slate-700 focus:border-amber-500 transition-colors text-sm"
              placeholder="ค้นหาเลขที่ใบงาน, ชื่องาน, ลูกค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 px-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                showHistory
                  ? 'bg-amber-600/20 text-amber-400 ring-1 ring-amber-500/30'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <History size={16} /> {showHistory ? 'แสดงทั้งหมด' : 'ดูประวัติเก่า'}
            </button>
            <div className="w-px h-7 bg-slate-700 hidden md:block" />
            <div className="relative">
              <select
                className="appearance-none bg-slate-800 border border-slate-700 text-slate-300 pl-9 pr-7 py-2.5 rounded-xl text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
                value={filterStage}
                onChange={e => setFilterStage(e.target.value)}
              >
                <option value="All">ทุกขั้นตอน</option>
                <option value="preparing">เตรียมของ</option>
                <option value="in_progress">กำลังทำ</option>
                <option value="qc">QC / ทดสอบ</option>
                <option value="completed">เสร็จสิ้น</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
              <Filter size={14} className="absolute left-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="animate-spin inline text-amber-500" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-slate-600">
          <Hammer size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium text-slate-500">ยังไม่มีใบงาน</p>
          <p className="text-sm mt-1">กดปุ่ม "สร้างใบงานใหม่" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(job => <JobCard key={job.id} job={job} />)}
        </div>
      )}
    </div>
  );
};

export default AssemblyMain;
