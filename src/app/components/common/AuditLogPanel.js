'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Clock, User, ChevronDown, ChevronUp, RefreshCw, PlusCircle, Edit2, Trash2, Layers, Package, CheckCircle2, Undo2, ShoppingCart, PackageCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ============================================================
// Config
// ============================================================
const ACTION_CONFIG = {
  create:       { label: 'สร้างใหม่',     color: 'bg-green-100 text-green-700 border-green-200',  dot: 'bg-green-500',  Icon: PlusCircle },
  update:       { label: 'แก้ไข',         color: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500',   Icon: Edit2 },
  delete:       { label: 'ลบ',           color: 'bg-red-100 text-red-700 border-red-200',        dot: 'bg-red-500',    Icon: Trash2 },
  stage_change: { label: 'เปลี่ยนขั้นตอน', color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500', Icon: Layers },
  item_change:  { label: 'อัปเดตรายการ',   color: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-500',  Icon: Package },
  check:        { label: 'ติ๊กเสร็จ',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', Icon: CheckCircle2 },
  uncheck:      { label: 'ยกเลิกติ๊ก',     color: 'bg-rose-100 text-rose-700 border-rose-200',     dot: 'bg-rose-500',   Icon: Undo2 },
  // ของที่ต้องใช้เพิ่ม (ขอของหน้างาน) — แยกจาก item_change ให้อ่าน Log รู้เรื่อง
  material_request: { label: 'ขอของเพิ่ม',    color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', Icon: ShoppingCart },
  material_fulfill: { label: 'จัดของให้แล้ว',  color: 'bg-teal-100 text-teal-700 border-teal-200',      dot: 'bg-teal-500',   Icon: PackageCheck },
  material_undo:    { label: 'ย้อนจัดของ',    color: 'bg-rose-100 text-rose-700 border-rose-200',      dot: 'bg-rose-500',   Icon: Undo2 },
};

const RESOURCE_LABELS = {
  product:   'สินค้า',
  customer:  'ลูกค้า',
  order:     'ออเดอร์',
  service:   'งานซ่อม',
  assembly:  'ใบงาน',
  marketing: 'การตลาด',
  stock:     'สต๊อก',
  procurement: 'สั่งของ',
};

const FIELD_LABELS = {
  name: 'ชื่อ',
  sku: 'SKU',
  sell_price: 'ราคาขาย',
  cost_price: 'ราคาทุน',
  has_variants: 'มีตัวเลือก',
  description: 'รายละเอียด',
  first_name: 'ชื่อ',
  last_name: 'นามสกุล',
  nickname: 'ชื่อเล่น',
  phone: 'เบอร์โทร',
  notes: 'หมายเหตุ',
  status: 'สถานะ',
  grand_total: 'ยอดสุทธิ',
  order_number: 'เลขออเดอร์',
  service_number: 'เลขงานซ่อม',
  customer_name: 'ลูกค้า',
  order_date: 'วันที่สั่งซื้อ',
  received_date: 'วันที่รับ',
  amount: 'ยอดเงิน',
  channel_name: 'ช่องทาง',
  expense_date: 'วันที่จ่าย',
  title: 'หัวข้อ',
  stage: 'ขั้นตอน',
  job_number: 'เลขใบงาน',
  address_raw: 'ที่อยู่',
  location_url: 'ลิงก์แผนที่',
  discount: 'ส่วนลด',
  shipping_cost: 'ค่าขนส่ง',
  vat_type: 'ประเภท VAT',
  completed_at: 'วันที่เสร็จ',
  completed_date: 'วันที่เสร็จ',
  waiting_reason: 'สาเหตุที่รอ',
};

const formatValue = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'ใช่' : 'ไม่';
  if (typeof val === 'number') return val.toLocaleString('th-TH');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const PAGE_SIZE = 20;

// ============================================================
// Log Entry Component
// ============================================================
const LogEntry = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
  const Icon = cfg.Icon;

  const changedFields = log.changed_fields || [];
  const hasChanges = changedFields.length > 0 && log.old_data && log.new_data;

  const creatorName = log.created_by?.name || '—';
  const date = new Date(log.created_at);
  const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${cfg.color}`}>
        <Icon size={14} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
          {log.resource_label && (
            <span className="text-sm font-semibold text-gray-800 truncate">{log.resource_label}</span>
          )}
          {log.metadata?.from_stage && log.metadata?.to_stage && (
            <span className="text-xs text-gray-500">
              {log.metadata.from_stage} → {log.metadata.to_stage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1"><User size={11} />{creatorName}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{dateStr} {timeStr}</span>
          {changedFields.length > 0 && (
            <span className="text-gray-400">{changedFields.length} field ที่เปลี่ยน</span>
          )}
        </div>

        {/* Changed fields (collapsible) */}
        {hasChanges && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดการเปลี่ยนแปลง'}
            </button>

            {expanded && (
              <div className="mt-2 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-500">
                      <th className="text-left px-3 py-2 font-semibold w-1/3">Field</th>
                      <th className="text-left px-3 py-2 font-semibold">ก่อน</th>
                      <th className="text-left px-3 py-2 font-semibold">หลัง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changedFields.map((field) => (
                      <tr key={field} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 font-medium text-gray-600">
                          {FIELD_LABELS[field] || field}
                        </td>
                        <td className="px-3 py-1.5 text-red-500 line-through">{formatValue(log.old_data[field])}</td>
                        <td className="px-3 py-1.5 text-green-600 font-medium">{formatValue(log.new_data[field])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* metadata extra info */}
        {log.metadata?.note && (
          <p className="mt-1 text-xs text-gray-400 italic">"{log.metadata.note}"</p>
        )}
      </div>
    </div>
  );
};

// ============================================================
// AuditLogPanel - Main Component
// ============================================================
/**
 * @param {string}   resourceType  - 'product' | 'customer' | 'order' | etc.
 * @param {string}   [resourceId]  - ถ้าไม่ระบุ จะแสดง log ทั้งหมดของ resource type
 * @param {string}   [title]       - หัวข้อ panel
 * @param {boolean}  [compact]     - แสดงแบบกระชับ (สำหรับ detail view)
 */
const AuditLogPanel = ({ resourceType, resourceId, title, compact = false }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('resource_type', resourceType)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (resourceId) query = query.eq('resource_id', resourceId);
    if (filterAction) query = query.eq('action', filterAction);

    const { data, count } = await query;
    setLogs(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [resourceType, resourceId, page, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const resLabel = RESOURCE_LABELS[resourceType] || resourceType;
  const panelTitle = title || (resourceId ? `ประวัติการเปลี่ยนแปลง` : `Log รวม — ${resLabel}`);

  return (
    <div className={`bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden ${compact ? '' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-indigo-500" />
          <span className="font-bold text-gray-800 text-sm">{panelTitle}</span>
          {total > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{total}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!resourceId && (
            <select
              className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(0); }}
            >
              <option value="">ทุกประเภท</option>
              {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={fetchLogs}
            className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
            title="รีเฟรช"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Log List */}
      <div className={`px-5 ${compact ? 'max-h-[400px] overflow-y-auto' : ''}`}>
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">ยังไม่มีประวัติการเปลี่ยนแปลง</div>
        ) : (
          <div>
            {logs.map(log => <LogEntry key={log.id} log={log} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-gray-50">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ก่อนหน้า
          </button>
          <span className="text-xs text-gray-500">หน้า {page + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
          <button
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogPanel;
