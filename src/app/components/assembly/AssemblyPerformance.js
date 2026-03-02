import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Loader2, ClipboardList, CheckCircle, RotateCcw, Award, XCircle, TrendingUp,
  ArrowLeft, ChevronRight, ChevronDown, Filter,
} from 'lucide-react';

const ROLE_STORAGE_KEY = 'assembly_perf_role_ids';
import { supabase } from '@/lib/supabase';

// ── Helpers ─────────────────────────────────────────────────
const getDateRange = (dateFilter) => {
  if (!dateFilter) return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (dateFilter === 'this_month') return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
  if (dateFilter === 'last_month') return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
  if (dateFilter === 'Q1') return { start: new Date(y, 0, 1), end: new Date(y, 3, 0, 23, 59, 59) };
  if (dateFilter === 'Q2') return { start: new Date(y, 3, 1), end: new Date(y, 6, 0, 23, 59, 59) };
  if (dateFilter === 'Q3') return { start: new Date(y, 6, 1), end: new Date(y, 9, 0, 23, 59, 59) };
  if (dateFilter === 'Q4') return { start: new Date(y, 9, 1), end: new Date(y, 12, 0, 23, 59, 59) };
  if (dateFilter === 'this_year') return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) };
  if (dateFilter?.startsWith('custom_')) {
    const parts = dateFilter.split('_');
    const cy = parseInt(parts[1]);
    const cm = parseInt(parts[2]) - 1;
    return { start: new Date(cy, cm, 1), end: new Date(cy, cm + 1, 0, 23, 59, 59) };
  }
  return null;
};

const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// ── Stat box ────────────────────────────────────────────────
const StatBox = ({ label, value, icon, color, bg }) => (
  <div className={`${bg} rounded-xl p-3 flex items-center gap-2.5`}>
    <span className={color}>{icon}</span>
    <div>
      <p className={`text-lg font-bold leading-none ${color}`}>{value ?? 0}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{label}</p>
    </div>
  </div>
);

// ── Worker Card ──────────────────────────────────────────────
const WorkerCard = ({ profile, s, onSelect }) => (
  <div
    onClick={onSelect}
    className="bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 rounded-2xl p-5 transition-all cursor-pointer relative"
  >
    {/* Profile header */}
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
      <div className="w-11 h-11 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-sm font-bold text-amber-700 overflow-hidden shrink-0">
        {profile.avatar_url
          ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
          : (profile.first_name?.[0] || '?')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 truncate">
          {profile.first_name} {profile.last_name}
        </p>
        <p className="text-xs text-amber-600 mt-0.5">{profile.roles?.name || '—'}</p>
      </div>
      {/* Efficiency badge */}
      {s.assembled > 0 && (
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-emerald-600 leading-none">
            {s.rejected === 0 ? '100' : Math.round(((s.assembled - (s.rejected > s.assembled ? s.assembled : s.rejected)) / s.assembled) * 100)}%
          </p>
          <p className="text-[10px] text-gray-400">ไม่ตีกลับ</p>
        </div>
      )}
    </div>

    {/* Stats grid */}
    <div className="grid grid-cols-2 gap-2">
      <StatBox
        label="มอบหมาย"
        value={s.assigned}
        icon={<ClipboardList size={13} />}
        color="text-gray-500"
        bg="bg-gray-50"
      />
      <StatBox
        label="ทำสำเร็จ"
        value={s.assembled}
        icon={<CheckCircle size={13} />}
        color="text-blue-600"
        bg="bg-blue-50"
      />
      <StatBox
        label="ถูกตีกลับ"
        value={s.rejected}
        icon={<RotateCcw size={13} />}
        color={s.rejected > 0 ? 'text-orange-600' : 'text-gray-300'}
        bg={s.rejected > 0 ? 'bg-orange-50' : 'bg-gray-50'}
      />
      <div className="bg-gray-50 rounded-xl p-3 col-span-1" />
      <StatBox
        label="ให้ผ่าน QC"
        value={s.qcPass}
        icon={<Award size={13} />}
        color={s.qcPass > 0 ? 'text-emerald-600' : 'text-gray-300'}
        bg={s.qcPass > 0 ? 'bg-emerald-50' : 'bg-gray-50'}
      />
      <StatBox
        label="ตีกลับ QC"
        value={s.qcFail}
        icon={<XCircle size={13} />}
        color={s.qcFail > 0 ? 'text-red-600' : 'text-gray-300'}
        bg={s.qcFail > 0 ? 'bg-red-50' : 'bg-gray-50'}
      />
    </div>

    {/* Drill-down hint */}
    <div className="absolute bottom-4 right-4 text-gray-300">
      <ChevronRight size={16} />
    </div>
  </div>
);

// ── Worker Detail ────────────────────────────────────────────
const DETAIL_TABS = [
  { key: 'all',      label: 'ทั้งหมด' },
  { key: 'assigned', label: 'มอบหมาย' },
  { key: 'assembled',label: 'ทำสำเร็จ' },
  { key: 'rejected', label: 'ถูกตีกลับ' },
  { key: 'qc',       label: 'QC' },
];

const WorkerDetail = ({ profile, s, jobs, onBack, detailTab, setDetailTab }) => {
  const userId = profile.id;

  const workerItems = useMemo(() => {
    const result = [];
    jobs.forEach(job => {
      (job.items || []).forEach(item => {
        const roles = [];
        if ((item.item_assignees || []).some(a => a.id === userId)) roles.push('assigned');
        if (item.assembled_by?.id === userId) roles.push('assembled');
        if ((item.reject_history || []).length > 0 && item.assembled_by?.id === userId) roles.push('rejected');
        if ((item.qc_by?.id === userId && item.qc_status === 'passed') ||
            (item.reject_history || []).some(h => h.by?.id === userId)) roles.push('qc');
        if (roles.length > 0) result.push({ job, item, roles });
      });
    });
    return result.sort((a, b) =>
      (b.item.assembled_at || b.job.created_at || '').localeCompare(
      (a.item.assembled_at || a.job.created_at || ''))
    );
  }, [jobs, userId]);

  const filtered = useMemo(() => {
    if (detailTab === 'all') return workerItems;
    return workerItems.filter(({ roles }) => roles.includes(detailTab));
  }, [workerItems, detailTab]);

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-600 transition-colors font-medium"
      >
        <ArrowLeft size={16} />
        ย้อนกลับ
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-base font-bold text-amber-700 overflow-hidden shrink-0">
            {profile.avatar_url
              ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
              : (profile.first_name?.[0] || '?')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-gray-900">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">{profile.roles?.name || '—'}</p>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium">
            มอบหมาย {s?.assigned ?? 0}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium">
            ทำสำเร็จ {s?.assembled ?? 0}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
            s?.rejected > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'
          }`}>
            ถูกตีกลับ {s?.rejected ?? 0}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
            s?.qcPass > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
          }`}>
            QC ผ่าน {s?.qcPass ?? 0}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
            s?.qcFail > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'
          }`}>
            QC ตีกลับ {s?.qcFail ?? 0}
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {DETAIL_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all ${
              detailTab === t.key
                ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
            {t.key !== 'all' && (
              <span className="ml-1 opacity-60">
                ({workerItems.filter(w => w.roles.includes(t.key)).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">ไม่มีข้อมูล</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ job, item, roles }, idx) => (
            <div
              key={`${job.id}-${item.id || idx}`}
              className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {job.job_number} · {job.title}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 shrink-0">
                  {roles.includes('assembled') && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">
                      ทำเสร็จ
                    </span>
                  )}
                  {roles.includes('rejected') && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-semibold border border-orange-100">
                      ตีกลับ {(item.reject_history || []).length} ครั้ง
                    </span>
                  )}
                  {roles.includes('qc') && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold border border-purple-100">
                      QC
                    </span>
                  )}
                </div>
              </div>

              {item.assembled_at && (
                <p className="text-[10px] text-gray-400 mt-1">{fmtTime(item.assembled_at)}</p>
              )}

              {roles.includes('rejected') && (item.reject_history || []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {item.reject_history.map((h, hi) => (
                    <p key={hi} className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                      ตีกลับครั้งที่ {hi + 1}{h.reason ? `: ${h.reason}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────
const AssemblyPerformance = ({ dateFilter }) => {
  const [roles, setRoles]       = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedRoleIds, setSelectedRoleIds] = useState(new Set());
  const [selectedWorker, setSelectedWorker]   = useState(null);
  const [detailTab, setDetailTab]             = useState('all');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setRoleDropdownOpen(false);
    };
    if (roleDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [roleDropdownOpen]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: rolesData }, { data: profilesData }, { data: jobsData }] = await Promise.all([
        supabase.from('roles').select('id, name').order('name'),
        supabase.from('profiles')
          .select('id, first_name, last_name, avatar_url, role_id, roles(id, name)')
          .eq('status', 'active')
          .order('first_name'),
        supabase.from('assembly_jobs').select('id, job_number, title, created_at, items, stage'),
      ]);
      if (rolesData) {
        setRoles(rolesData);
        // โหลดค่าที่บันทึกไว้ใน localStorage
        try {
          const saved = localStorage.getItem(ROLE_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            const valid = parsed.filter(id => rolesData.some(r => r.id === id));
            setSelectedRoleIds(valid.length > 0 ? new Set(valid) : new Set(rolesData.map(r => r.id)));
          } else {
            setSelectedRoleIds(new Set(rolesData.map(r => r.id)));
          }
        } catch {
          setSelectedRoleIds(new Set(rolesData.map(r => r.id)));
        }
      }
      if (profilesData) setProfiles(profilesData);
      if (jobsData) setJobs(jobsData);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const saveAndSet = (next) => {
    setSelectedRoleIds(next);
    localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify([...next]));
  };

  const toggleRole = (roleId) => {
    setSelectedRoleIds(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const selectAll   = () => saveAndSet(new Set(roles.map(r => r.id)));
  const deselectAll = () => saveAndSet(new Set());

  const filteredProfiles = useMemo(() =>
    profiles.filter(p => p.role_id && selectedRoleIds.has(p.role_id)),
  [profiles, selectedRoleIds]);

  // Filter jobs ตาม dateFilter (created_at)
  const jobsInRange = useMemo(() => {
    const range = getDateRange(dateFilter);
    if (!range) return jobs;
    return jobs.filter(job => {
      const d = new Date(job.created_at);
      return d >= range.start && d <= range.end;
    });
  }, [jobs, dateFilter]);

  // คำนวณ stats ต่อคน
  const stats = useMemo(() => {
    const map = {};
    profiles.forEach(p => {
      map[p.id] = { assigned: 0, assembled: 0, rejected: 0, qcPass: 0, qcFail: 0 };
    });

    jobsInRange.forEach(job => {
      (job.items || []).forEach(item => {
        (item.item_assignees || []).forEach(a => {
          if (map[a.id] !== undefined) map[a.id].assigned++;
        });
        if (item.assembled_at && item.assembled_by?.id && map[item.assembled_by.id] !== undefined) {
          map[item.assembled_by.id].assembled++;
        }
        if (item.assembled_by?.id && map[item.assembled_by.id] !== undefined) {
          map[item.assembled_by.id].rejected += (item.reject_history || []).length;
        }
        if (item.qc_status === 'passed' && item.qc_by?.id && map[item.qc_by.id] !== undefined) {
          map[item.qc_by.id].qcPass++;
        }
        (item.reject_history || []).forEach(h => {
          if (h.by?.id && map[h.by.id] !== undefined) map[h.by.id].qcFail++;
        });
      });
    });

    return map;
  }, [profiles, jobsInRange]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-amber-500" size={32} />
    </div>
  );

  // ── Detail view ──
  if (selectedWorker) return (
    <WorkerDetail
      profile={selectedWorker.profile}
      s={selectedWorker.s}
      jobs={jobsInRange}
      onBack={() => setSelectedWorker(null)}
      detailTab={detailTab}
      setDetailTab={setDetailTab}
    />
  );

  // ── Grid view ──
  const allSelected  = selectedRoleIds.size === roles.length;
  const noneSelected = selectedRoleIds.size === 0;

  return (
    <div className="space-y-5 animate-in slide-in-from-bottom-4">

      {/* Toolbar row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Role filter dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setRoleDropdownOpen(o => !o)}
            className={`flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl border transition-all ${
              roleDropdownOpen
                ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 shadow-sm'
            }`}
          >
            <Filter size={14} />
            {allSelected
              ? 'ทุกตำแหน่ง'
              : noneSelected
              ? 'ไม่มีตำแหน่ง'
              : `${selectedRoleIds.size} ตำแหน่ง`}
            <ChevronDown size={14} className={`transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {roleDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[200px] p-2">
              {/* Select all / clear */}
              <div className="flex gap-1 px-1 pb-2 mb-1 border-b border-gray-100">
                <button
                  onClick={selectAll}
                  disabled={allSelected}
                  className="flex-1 text-[11px] py-1 rounded-lg text-gray-500 hover:bg-amber-50 hover:text-amber-700 transition-colors disabled:opacity-30 font-medium"
                >
                  เลือกทั้งหมด
                </button>
                <button
                  onClick={deselectAll}
                  disabled={noneSelected}
                  className="flex-1 text-[11px] py-1 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 font-medium"
                >
                  ล้างทั้งหมด
                </button>
              </div>
              {/* Role checkboxes */}
              {roles.map(r => (
                <label
                  key={r.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.has(r.id)}
                    onChange={() => toggleRole(r.id)}
                    className="accent-amber-500 w-3.5 h-3.5"
                  />
                  <span className="text-sm text-gray-700">{r.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {filteredProfiles.length > 0 && (
          <p className="text-sm text-gray-400">
            แสดง <span className="text-gray-600 font-semibold">{filteredProfiles.length}</span> คน
          </p>
        )}
      </div>

      {/* Summary row */}
      {filteredProfiles.length > 0 && (() => {
        const totals = filteredProfiles.reduce((acc, p) => {
          const s = stats[p.id] || {};
          acc.assigned  += s.assigned  || 0;
          acc.assembled += s.assembled || 0;
          acc.rejected  += s.rejected  || 0;
          acc.qcPass    += s.qcPass    || 0;
          acc.qcFail    += s.qcFail    || 0;
          return acc;
        }, { assigned: 0, assembled: 0, rejected: 0, qcPass: 0, qcFail: 0 });

        return (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-amber-600" />
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider">สรุปภาพรวม</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'มอบหมาย',    val: totals.assigned,  color: 'text-gray-700' },
                { label: 'ทำสำเร็จ',   val: totals.assembled, color: 'text-blue-600' },
                { label: 'ถูกตีกลับ',  val: totals.rejected,  color: 'text-orange-600' },
                { label: 'ให้ผ่าน QC', val: totals.qcPass,    color: 'text-emerald-600' },
                { label: 'ตีกลับ QC',  val: totals.qcFail,    color: 'text-red-600' },
              ].map(item => (
                <div key={item.label} className="bg-white/70 rounded-xl p-3 text-center shadow-sm">
                  <p className={`text-2xl font-bold ${item.color}`}>{item.val}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Worker grid */}
      {noneSelected ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">เลือกตำแหน่งเพื่อดูข้อมูล</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">ไม่พบบุคคลในตำแหน่งที่เลือก</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProfiles.map(p => (
            <WorkerCard
              key={p.id}
              profile={p}
              s={stats[p.id] || {}}
              onSelect={() => {
                setSelectedWorker({ profile: p, s: stats[p.id] || {} });
                setDetailTab('all');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AssemblyPerformance;
