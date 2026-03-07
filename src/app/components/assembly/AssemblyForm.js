import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Plus, Trash2, Search, X, UserPlus, Phone, MapPin, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';

// หาสินค้า/บริการที่แพงที่สุดจาก order
const getMostExpensiveOrderItem = (order) => {
  const items = order?.order_items || [];
  if (!items.length) return null;
  return items.reduce((max, it) => ((it.sell_price || 0) > (max.sell_price || 0) ? it : max));
};

// หาสินค้า/บริการที่แพงที่สุดจาก service
const getMostExpensiveServiceItem = (service) => {
  const items = service?.service_items || [];
  if (!items.length) return null;
  return items.reduce((max, it) => ((it.price || 0) > (max.price || 0) ? it : max));
};

const buildAutoTitle = (expItem, customer) => {
  const itemName = expItem?.product_name || expItem?.description || '';
  const custName = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : '';
  return [itemName, custName].filter(Boolean).join(' · ');
};

const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  : '';

const SOCIAL_ICON = { Facebook: '📘', Line: '💬', Instagram: '📷', WhatsApp: '📱' };

const AssemblyForm = ({ initialData, onCancel, onSuccess }) => {
  const { profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(initialData?.title || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [refType, setRefType] = useState(initialData?.ref_type || 'none');
  const [refId, setRefId] = useState(initialData?.ref_id || null);
  const [customerCache, setCustomerCache] = useState(initialData?.customer_cache || null);
  const [items, setItems] = useState(initialData?.items || []);
  const [assignees, setAssignees] = useState(initialData?.assignees || []);

  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    fetchOrders();
    fetchServices();
    fetchUsers();
    if (initialData?.ref_type === 'order' && initialData?.ref_id) loadOrderById(initialData.ref_id);
    else if (initialData?.ref_type === 'service' && initialData?.ref_id) loadServiceById(initialData.ref_id);
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, customer_cache, status, created_at, order_items(*)')
      .not('status', 'in', '("Quotation","Completed","completed","Cancelled","cancelled")')
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  const fetchServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('id, service_number, customer_cache, status, created_at, service_items(*)')
      .not('status', 'in', '("Completed","completed","Cancelled","cancelled")')
      .order('created_at', { ascending: false });
    if (data) setServices(data);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('status', 'active');
    if (data) setAllUsers(data);
  };

  const loadOrderById = async (id) => {
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).single();
    if (data) { setSelectedOrder(data); setCustomerCache(data.customer_cache); populateItemsFromOrder(data); }
  };

  const loadServiceById = async (id) => {
    const { data } = await supabase.from('services').select('*, service_items(*)').eq('id', id).single();
    if (data) { setSelectedService(data); setCustomerCache(data.customer_cache); populateItemsFromService(data); }
  };

  const makeItem = (name = '', qty = 1, type = 'custom') => ({
    id: crypto.randomUUID(),
    name, quantity: qty, type,
    item_assignees: [], skip_prepare: false, started_at: null,
    prepared_by: null, prepared_at: null,
    assembled_by: null, assembled_at: null,
    qc_status: 'pending', qc_by: null, qc_at: null,
    reject_reason: '', reject_history: [],
  });

  const populateItemsFromOrder = (order) => {
    setItems((order.order_items || []).map(oi =>
      makeItem(oi.product_name || oi.name || '', oi.quantity || 1, 'main')
    ));
  };

  const populateItemsFromService = (service) => {
    const list = [];
    (service.service_items || []).forEach(si => {
      list.push(makeItem(si.description || si.name || '', si.qty || 1, si.type === 'Part' ? 'part' : 'sub'));
      (si.sub_items || []).forEach(sub =>
        list.push(makeItem(sub.description || sub.name || '', sub.qty || 1, 'part'))
      );
    });
    setItems(list);
  };

  const handleSelectOrder = (order) => {
    setSelectedOrder(order); setSelectedService(null);
    setRefType('order'); setRefId(order.id);
    setCustomerCache(order.customer_cache);
    populateItemsFromOrder(order);
    setOrderSearch('');
    if (!initialData?.id) {
      const exp = getMostExpensiveOrderItem(order);
      setTitle(buildAutoTitle(exp, order.customer_cache));
    }
  };

  const handleSelectService = (service) => {
    setSelectedService(service); setSelectedOrder(null);
    setRefType('service'); setRefId(service.id);
    setCustomerCache(service.customer_cache);
    populateItemsFromService(service);
    setServiceSearch('');
    if (!initialData?.id) {
      const exp = getMostExpensiveServiceItem(service);
      setTitle(buildAutoTitle(exp, service.customer_cache));
    }
  };

  const handleClearRef = () => {
    setRefType('none'); setRefId(null);
    setSelectedOrder(null); setSelectedService(null);
    setCustomerCache(null); setItems([]);
    if (!initialData?.id) setTitle('');
  };

  const addCustomItem = () => setItems(prev => [...prev, makeItem()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const addAssignee = (user) => {
    if (assignees.some(a => a.user_id === user.id)) return;
    setAssignees(prev => [...prev, { user_id: user.id, user, job_role: 'ช่างประกอบ' }]);
    setShowUserPicker(false); setUserSearch('');
  };
  const removeAssignee = (idx) => setAssignees(prev => prev.filter((_, i) => i !== idx));
  const updateRole = (idx, role) =>
    setAssignees(prev => prev.map((a, i) => i === idx ? { ...a, job_role: role } : a));

  const generateJobNumber = async () => {
    const now = new Date();
    const prefix = `ASM-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const { count } = await supabase.from('assembly_jobs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start).lt('created_at', end);
    return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const handleSave = async () => {
    if (!title.trim()) { alert('กรุณากรอกชื่องาน'); return; }
    setSaving(true);
    try {
      const payload = {
        title, notes,
        ref_type: refType === 'none' ? null : refType,
        ref_id: refId || null,
        customer_cache: customerCache || null,
        items, assignees,
      };
      let savedId = initialData?.id;
      let savedJobNumber = initialData?.job_number;
      if (initialData?.id) {
        const { error } = await supabase.from('assembly_jobs').update(payload).eq('id', initialData.id);
        if (error) throw new Error(error.message);
      } else {
        savedJobNumber = await generateJobNumber();
        const { data, error } = await supabase.from('assembly_jobs').insert([{
          ...payload, job_number: savedJobNumber, stage: 'preparing', comments: [],
        }]).select().single();
        if (error) throw new Error(error.message);
        if (data) savedId = data.id;
      }

      await logAction({
        resource_type: 'assembly',
        resource_id: savedId,
        action: initialData?.id ? 'update' : 'create',
        resource_label: title || savedJobNumber,
        old_data: initialData?.id ? { title: initialData.title, notes: initialData.notes, stage: initialData.stage } : null,
        new_data: { title, notes, stage: initialData?.id ? initialData.stage : 'preparing', job_number: savedJobNumber },
        created_by: meRef(),
      });

      onSuccess();
    } catch (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); }
    finally { setSaving(false); }
  };

  const filteredUsers = allUsers.filter(u =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.nickname?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    o.order_number?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.customer_cache?.first_name?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.customer_cache?.last_name?.toLowerCase().includes(orderSearch.toLowerCase())
  );

  const filteredServices = services.filter(s =>
    s.service_number?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.customer_cache?.first_name?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.customer_cache?.last_name?.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const TYPE_LABELS = { main: 'สินค้า', part: 'อะไหล่', sub: 'บริการ', custom: 'กำหนดเอง' };
  const TYPE_COLORS = {
    main: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    part: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    sub:  'bg-purple-500/15 text-purple-400 border-purple-500/20',
    custom: 'bg-slate-700 text-slate-400 border-slate-600',
  };

  const inputCls = 'w-full bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-all text-sm';
  const sectionCls = 'bg-slate-900 rounded-2xl border border-slate-800 p-5 md:p-6 space-y-4';

  return (
    <div className="bg-slate-950 rounded-3xl p-4 md:p-6 min-h-[calc(100vh-8rem)] pb-20 animate-in fade-in duration-300">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-br from-amber-900/60 via-slate-900 to-slate-900 p-5 rounded-2xl border border-amber-800/20">
          <button onClick={onCancel} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium text-sm">
            <ArrowLeft size={18} /> ยกเลิก
          </button>
          <h2 className="text-lg font-bold text-white">
            {initialData?.id ? 'แก้ไขใบงาน' : 'สร้างใบงานใหม่'}
          </h2>
          <button
            onClick={handleSave} disabled={saving}
            className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-sm shadow-lg shadow-amber-950"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} บันทึก
          </button>
        </div>

        {/* ── Section 1: เชื่อมโยง (FIRST) ── */}
        <div className={sectionCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">1. เชื่อมโยง</h3>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'order',   label: '🛒 เชื่อม Order',   active: 'bg-green-500/20 text-green-400 border-green-500/30',   hover: 'hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20' },
              { key: 'service', label: '🔧 เชื่อม Service',  active: 'bg-orange-500/20 text-orange-400 border-orange-500/30', hover: 'hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/20' },
              { key: 'none',    label: 'ไม่เชื่อมโยง',       active: 'bg-slate-700 text-white border-slate-600',             hover: 'hover:bg-slate-800 hover:text-slate-200' },
            ].map(btn => (
              <button
                key={btn.key}
                onClick={() => { if (refType !== btn.key) { handleClearRef(); if (btn.key !== 'none') setRefType(btn.key); } }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  refType === btn.key ? btn.active : `bg-transparent text-slate-500 border-slate-700 ${btn.hover}`
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Order Search */}
          {refType === 'order' && !selectedOrder && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:border-green-500 transition-all"
                  placeholder="ค้นหา Order, ชื่อลูกค้า..."
                  value={orderSearch} onChange={e => setOrderSearch(e.target.value)} autoFocus
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/50">
                {filteredOrders.slice(0, 10).map(o => {
                  const exp = getMostExpensiveOrderItem(o);
                  return (
                    <div key={o.id} onClick={() => handleSelectOrder(o)}
                      className="flex items-center justify-between p-3 hover:bg-slate-800 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{o.order_number}</span>
                          {exp && <span className="text-xs text-amber-400 truncate max-w-[140px]">{exp.product_name}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{o.customer_cache?.first_name} {o.customer_cache?.last_name}</span>
                          <span className="text-xs text-slate-600">{fmtDate(o.created_at)}</span>
                        </div>
                      </div>
                      <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-medium ml-2 shrink-0">{o.status}</span>
                    </div>
                  );
                })}
                {filteredOrders.length === 0 && <p className="text-center text-xs text-slate-600 py-5">ไม่พบรายการ</p>}
              </div>
            </div>
          )}

          {refType === 'order' && selectedOrder && (
            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
              <div>
                <span className="font-bold text-green-400">{selectedOrder.order_number}</span>
                <span className="text-sm text-slate-400 ml-2">
                  {selectedOrder.customer_cache?.first_name} {selectedOrder.customer_cache?.last_name}
                </span>
              </div>
              <button onClick={handleClearRef} className="text-slate-500 hover:text-red-400 transition-colors"><X size={18} /></button>
            </div>
          )}

          {/* Service Search */}
          {refType === 'service' && !selectedService && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:border-orange-500 transition-all"
                  placeholder="ค้นหา Service, ชื่อลูกค้า..."
                  value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} autoFocus
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/50">
                {filteredServices.slice(0, 10).map(s => {
                  const exp = getMostExpensiveServiceItem(s);
                  return (
                    <div key={s.id} onClick={() => handleSelectService(s)}
                      className="flex items-center justify-between p-3 hover:bg-slate-800 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{s.service_number}</span>
                          {exp && <span className="text-xs text-amber-400 truncate max-w-[140px]">{exp.description}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{s.customer_cache?.first_name} {s.customer_cache?.last_name}</span>
                          <span className="text-xs text-slate-600">{fmtDate(s.created_at)}</span>
                        </div>
                      </div>
                      <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded font-medium ml-2 shrink-0">{s.status}</span>
                    </div>
                  );
                })}
                {filteredServices.length === 0 && <p className="text-center text-xs text-slate-600 py-5">ไม่พบรายการ</p>}
              </div>
            </div>
          )}

          {refType === 'service' && selectedService && (
            <div className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <div>
                <span className="font-bold text-orange-400">{selectedService.service_number}</span>
                <span className="text-sm text-slate-400 ml-2">
                  {selectedService.customer_cache?.first_name} {selectedService.customer_cache?.last_name}
                </span>
              </div>
              <button onClick={handleClearRef} className="text-slate-500 hover:text-red-400 transition-colors"><X size={18} /></button>
            </div>
          )}
        </div>

        {/* ── Section 2: ชื่อใบงาน + หมายเหตุ ── */}
        <div className={sectionCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">2. ข้อมูลใบงาน</h3>
          <div>
            <label className="text-sm font-medium text-slate-400 mb-1.5 block">
              ชื่องาน <span className="text-red-400">*</span>
              {refType !== 'none' && <span className="text-xs text-slate-600 ml-2">(auto-suggest จากรายการที่เลือก)</span>}
            </label>
            <input className={inputCls} placeholder="ชื่อใบงาน..." value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-400 mb-1.5 block">หมายเหตุ</label>
            <textarea
              className={`${inputCls} resize-none`} rows={3}
              placeholder="รายละเอียดเพิ่มเติม..." value={notes} onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* ── Section 3: ข้อมูลลูกค้า (Full, Readonly) ── */}
        {customerCache && (
          <div className={sectionCls}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">3. ข้อมูลลูกค้า</h3>
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-900/50 rounded-full flex items-center justify-center text-amber-400 font-bold text-xl border border-amber-800/50 shrink-0">
                  {customerCache.first_name?.[0] || '?'}
                </div>
                <div>
                  <p className="font-bold text-white text-base">
                    {customerCache.first_name} {customerCache.last_name}
                  </p>
                  {customerCache.nickname && (
                    <p className="text-sm text-slate-400">({customerCache.nickname})</p>
                  )}
                </div>
              </div>
              {customerCache.phone && (
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <Phone size={14} className="text-slate-500 shrink-0" />
                  {customerCache.phone}
                </div>
              )}
              {customerCache.address_raw && (
                <div className="flex items-start gap-2 text-slate-400 text-sm">
                  <MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" />
                  {customerCache.address_raw}
                </div>
              )}
              {(customerCache.social_channels || []).map((sc, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-400 text-sm">
                  <span className="text-base">{SOCIAL_ICON[sc.type] || '🔗'}</span>
                  <span className="text-xs text-slate-500">{sc.type}</span>
                  <span>{sc.value}</span>
                </div>
              ))}
              {customerCache.email && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <MessageCircle size={14} className="text-slate-500 shrink-0" />
                  {customerCache.email}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Section 4: รายการงาน ── */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {customerCache ? '4.' : '3.'} รายการงาน ({items.length})
            </h3>
            <button
              onClick={addCustomItem}
              className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 font-semibold px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20"
            >
              <Plus size={15} /> เพิ่มรายการ
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
              <p className="text-sm font-medium">ยังไม่มีรายการ</p>
              <p className="text-xs mt-1">เชื่อม Order/Service เพื่อ auto-populate หรือกดเพิ่มรายการเอง</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 bg-slate-800 rounded-xl p-3 group border border-slate-700/50">
                  <span className="text-xs text-slate-600 font-mono w-5 text-center shrink-0">{idx + 1}</span>
                  <input
                    className="flex-1 bg-transparent text-white placeholder:text-slate-600 font-medium focus:outline-none text-sm min-w-0"
                    value={item.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)}
                    placeholder="ชื่อรายการ..."
                    readOnly={item.type !== 'custom'}
                    style={item.type !== 'custom' ? { cursor: 'default' } : {}}
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-slate-600 hidden sm:inline">จำนวน</span>
                    <input
                      type="number" min="1"
                      className="w-14 text-center text-sm bg-slate-700 border border-slate-600 text-white rounded-lg px-1 py-1.5 focus:outline-none focus:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                      disabled={item.type !== 'custom'}
                    />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border shrink-0 hidden sm:inline ${TYPE_COLORS[item.type] || TYPE_COLORS.custom}`}>
                    {TYPE_LABELS[item.type] || 'กำหนดเอง'}
                  </span>
                  {item.type === 'custom' && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 5: ทีมงาน ── */}
        <div className={sectionCls}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
            {customerCache ? '5.' : '4.'} ทีมงาน
          </h3>

          <div className="space-y-2">
            {assignees.map((a, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                <div className="w-9 h-9 rounded-full bg-amber-900/50 flex items-center justify-center overflow-hidden border border-amber-800/50 shrink-0">
                  {a.user?.avatar_url
                    ? <img src={a.user.avatar_url} className="w-full h-full object-cover" alt="" />
                    : <span className="text-amber-400 font-bold text-sm">{a.user?.first_name?.[0] || '?'}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{a.user?.first_name} {a.user?.last_name}</p>
                </div>
                <input
                  className="text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500 w-28 shrink-0"
                  value={a.job_role}
                  onChange={e => updateRole(i, e.target.value)}
                  placeholder="หน้าที่..."
                />
                <button onClick={() => removeAssignee(i)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                  <X size={18} />
                </button>
              </div>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserPicker(!showUserPicker)}
                className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:border-amber-500 hover:text-amber-400 hover:bg-amber-500/5 transition-all font-medium text-sm"
              >
                <UserPlus size={18} /> เพิ่มผู้รับผิดชอบ
              </button>

              {showUserPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserPicker(false)} />
                  <div className="absolute top-12 left-0 z-20 w-full md:w-72 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 p-2 animate-in fade-in zoom-in-95">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                      <input
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm outline-none placeholder:text-slate-600"
                        placeholder="ค้นหาชื่อ..." value={userSearch}
                        onChange={e => setUserSearch(e.target.value)} autoFocus
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                      {filteredUsers.map(u => (
                        <div key={u.id} onClick={() => addAssignee(u)}
                          className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold overflow-hidden border border-slate-600">
                            {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : u.first_name?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{u.first_name} {u.last_name}</p>
                            <p className="text-[10px] text-slate-500">{u.roles?.name || ''}</p>
                          </div>
                        </div>
                      ))}
                      {filteredUsers.length === 0 && <p className="text-center text-xs text-slate-600 py-4">ไม่พบรายชื่อ</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssemblyForm;
