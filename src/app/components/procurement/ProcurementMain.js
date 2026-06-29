'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Building2, Calendar, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  DollarSign, ExternalLink, History, ImageIcon, LayoutGrid, List, Loader2, Package, PackagePlus, Plus, RefreshCw,
  Save, Search, Store, Trash2, Truck, X, Check, Pencil, AtSign, Phone, Globe,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import { receivePurchaseOrder, recordPriceHistory } from '@/lib/stockLots';
import ProductForm from '@/app/components/products/ProductForm';
import ImageLightbox from '@/app/components/common/ImageLightbox'; // แสดงรูปต้องใช้ตัวนี้เสมอ (GOTCHA #18)

const CHANNELS = ['Line', 'Lazada', 'Shopee', 'WhatsApp', 'WeChat', 'VCanBuy', 'AliExpress', 'Phone', 'Email', 'Other'];
const CURRENCIES = ['THB', 'USD', 'RMB'];
const STATUSES = [
  { id: 'draft', label: 'ร่าง' },
  { id: 'ordered', label: 'สั่งแล้ว' },
  { id: 'paid', label: 'จ่ายแล้ว / ระหว่างดำเนินการ' },
  { id: 'arrived', label: 'ถึงแล้ว' },
  { id: 'received', label: 'รับเข้าสต๊อกแล้ว' },
  { id: 'cancelled', label: 'ยกเลิก' },
];
const statusLabel = (status) => STATUSES.find(s => s.id === status)?.label || status;
const STATUS_RANK = { draft: 0, ordered: 1, paid: 2, arrived: 3, received: 4, cancelled: 5 };
const PO_STAGES = [
  { id: 'draft', label: 'ร่าง', short: 'ร่าง' },
  { id: 'ordered', label: 'สั่งแล้ว', short: 'สั่ง' },
  { id: 'paid', label: 'จ่ายแล้ว / ระหว่างดำเนินการ', short: 'จ่าย' },
  { id: 'arrived', label: 'ถึงแล้ว', short: 'ถึง' },
  { id: 'received', label: 'รับเข้าสต๊อกแล้ว', short: 'รับเข้า' },
];
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const round2 = (value) => Math.round((num(value) + Number.EPSILON) * 100) / 100;
const moneyOrNull = (value) => (value === '' || value === null || value === undefined ? null : round2(value));
const today = () => new Date().toISOString().split('T')[0];
const dtForInput = (iso) => iso ? iso.split('T')[0] : '';
const toIsoOrNull = (date) => date ? new Date(date + 'T00:00:00').toISOString() : null;
const profileRef = (profile) => profile ? { id: profile.id, name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() } : null;
const poDayDiff = (from, to = new Date()) => {
  if (!from) return null;
  const start = new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.floor((end - start) / 86400000));
};
// แปลงเป็นวันที่ local (ตัดเวลา/timezone ออก ให้ตรงกับวันที่ที่โชว์)
const toLocalDate = (v) => {
  if (!v) return null;
  const [y, m, d] = String(v).split('T')[0].split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};
// ช่วงห่างแบบ ปี/เดือน/วัน (เช่น "1 ปี 2 เดือน 5 วัน" หรือ "17 วัน")
const humanDuration = (from, to) => {
  let a = toLocalDate(from), b = toLocalDate(to);
  if (!a || !b) return null;
  if (b < a) { const t = a; a = b; b = t; }
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate();
  if (days < 0) { months -= 1; days += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
  if (months < 0) { years -= 1; months += 12; }
  const parts = [];
  if (years) parts.push(`${years} ปี`);
  if (months) parts.push(`${months} เดือน`);
  if (days || parts.length === 0) parts.push(`${days} วัน`);
  return parts.join(' ');
};
const poStepMeta = (order) => ([
  { id: 'ordered', label: 'สั่ง', date: order?.ordered_at || order?.created_at },
  { id: 'paid', label: 'จ่าย', date: order?.paid_at },
  { id: 'arrived', label: 'ถึง', date: order?.arrived_at },
  { id: 'received', label: 'รับเข้า', date: order?.received_at },
]);
const poItemSummary = (order) => {
  const items = order?.purchase_order_items || [];
  if (!items.length) return 'ยังไม่มีรายการสินค้า';
  const names = items.slice(0, 3).map(item => `${item.product?.name || 'สินค้า'}${item.variant?.name ? ` · ${item.variant.name}` : ''} x${num(item.quantity_ordered).toLocaleString()}`);
  return `${names.join(', ')}${items.length > 3 ? ` +${items.length - 3} รายการ` : ''}`;
};
const freightParts = (order) => {
  const fx = num(order?.fx_rate) || 1;
  const localThb = order?.currency === 'THB' ? 0 : round2(num(order?.freight_amount) * fx);
  const total = num(order?.freight_thb) || round2(localThb + num(order?.thai_freight_thb));
  const thai = hasCostValue(order?.thai_freight_thb) ? num(order.thai_freight_thb) : Math.max(0, round2(total - localThb));
  return { localThb, thai, total };
};
const paidAmountFromUpdates = (updates = []) => {
  for (const update of updates) {
    const match = String(update?.comment || '').match(/ยอดจ่าย(?:จริง)?\s*:?\s*฿?\s*([\d,]+(?:\.\d+)?)/);
    if (match) return num(match[1].replace(/,/g, ''));
  }
  return null;
};
const calculateLandedCosts = ({ items = [], receivedItems = {}, fxRate = 1, freightThb = 0 }) => {
  const fx = num(fxRate) || 1;
  const normalized = items.map(item => {
    const qty = Math.max(0, Math.trunc(num(receivedItems[item.id] ?? item.quantity_received ?? item.quantity_ordered)));
    const unitCostForeign = num(item.unit_cost_foreign);
    const lineTotalForeign = round2(unitCostForeign * qty);
    const lineTotalThb = round2(lineTotalForeign * fx);
    return { ...item, qty, unitCostForeign, lineTotalForeign, lineTotalThb };
  });
  const subtotalForeign = round2(normalized.reduce((sum, item) => sum + item.lineTotalForeign, 0));
  const subtotalThb = round2(normalized.reduce((sum, item) => sum + item.lineTotalThb, 0));
  const rows = normalized.map(item => {
    const allocatedFreightThb = subtotalThb > 0 ? round2(num(freightThb) * (item.lineTotalThb / subtotalThb)) : 0;
    const landedUnitCostThb = item.qty > 0 ? round2((item.lineTotalThb + allocatedFreightThb) / item.qty) : 0;
    return {
      id: item.id,
      quantity_received: item.qty,
      line_total_foreign: item.lineTotalForeign,
      unit_cost_thb: item.qty > 0 ? round2(item.lineTotalThb / item.qty) : 0,
      line_total_thb: item.lineTotalThb,
      allocated_freight_thb: allocatedFreightThb,
      landed_unit_cost_thb: landedUnitCostThb,
    };
  });
  return { rows, subtotalForeign, subtotalThb, grandTotalThb: round2(subtotalThb + num(freightThb)) };
};
const updatePurchaseOrderItemCosts = async (rows = []) => {
  const results = await Promise.all(rows.map(row => supabase
    .from('purchase_order_items')
    .update({
      quantity_received: row.quantity_received,
      line_total_foreign: row.line_total_foreign,
      unit_cost_thb: row.unit_cost_thb,
      line_total_thb: row.line_total_thb,
      allocated_freight_thb: row.allocated_freight_thb,
      landed_unit_cost_thb: row.landed_unit_cost_thb,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  ));
  const error = results.find(result => result.error)?.error;
  if (error) throw error;
};
const writePurchaseOrder = async (operation, payload) => {
  let nextPayload = { ...(payload || {}) };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await operation(nextPayload);
    const missing = String(result.error?.message || '').match(/'([^']+)' column/);
    if (!missing || result.error?.code !== 'PGRST204') return result;
    delete nextPayload[missing[1]];
  }
  return operation(nextPayload);
};
const PROCUREMENT_PRODUCT_SELECT = 'id, name, sku, category_id, images, cost_price, sell_price, has_variants, category:category_id(id, name), product_categories(category_id, category:category_id(id, name)), product_variants(id, name, sku, cost_price, sell_price), stock_items(quantity)';
const fetchProcurementProduct = async (productId) => {
  const { data, error } = await supabase
    .from('products')
    .select(PROCUREMENT_PRODUCT_SELECT)
    .eq('id', productId)
    .single();
  if (error) throw error;
  return data;
};
const uploadProcurementImages = async (files) => {
  const urls = [];
  for (const file of Array.from(files || [])) {
    const path = `updates/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
    const { error } = await supabase.storage.from('procurement').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('procurement').getPublicUrl(path);
    urls.push({ url: data.publicUrl });
  }
  return urls;
};
const getStoredViewMode = (key, fallback = 'grid') => {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  return value === 'list' || value === 'grid' ? value : fallback;
};
const setStoredViewMode = (key, value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
};
const productStockQty = (product) => (product?.stock_items || []).reduce((sum, item) => sum + num(item.quantity), 0);
const hasCostValue = (value) => value !== null && value !== undefined && value !== '';
const productCost = (product) => (hasCostValue(product?.cost_price) ? num(product.cost_price) : null);
const costText = (value) => (hasCostValue(value) ? `฿${num(value).toLocaleString()}` : 'ยังไม่ระบุต้นทุน');
const purchaseKey = (productId, variantId = '') => `${productId || ''}:${variantId || ''}`;
const findVariant = (product, variantId) => (product?.product_variants || []).find(v => String(v.id) === String(variantId));
const latestSellPrice = (product, variantId = '') => {
  const variant = variantId ? findVariant(product, variantId) : null;
  if (hasCostValue(variant?.sell_price)) return num(variant.sell_price);
  if (hasCostValue(product?.sell_price)) return num(product.sell_price);
  return null;
};
const productCostText = (product) => {
  if (product?.has_variants && Array.isArray(product.product_variants)) {
    const costs = product.product_variants
      .filter(variant => hasCostValue(variant.cost_price))
      .map(variant => num(variant.cost_price));
    if (costs.length === 0) return 'ยังไม่ระบุต้นทุน';
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    return minCost === maxCost
      ? `฿${minCost.toLocaleString()}`
      : `฿${minCost.toLocaleString()} - ฿${maxCost.toLocaleString()}`;
  }
  return costText(productCost(product));
};

const emptySupplier = {
  name: '',
  product_type: '',
  note: '',
  images: [],
  is_active: true,
  contacts: [{ channel: 'Line', label: '', account_id: '', url: '', phone: '', note: '' }],
  files: [],
};

const makeOrderNumber = () => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `PO-${yy}${mm}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const emptyOrder = {
  order_number: makeOrderNumber(),
  supplier_id: '',
  status: 'draft',
  ordered_at: '',
  paid_at: '',
  arrived_at: '',
  currency: 'THB',
  fx_rate: 1,
  freight_amount: 0,
  freight_currency: 'THB',
  freight_fx_rate: 1,
  thai_freight_thb: 0,
  discount_amount: 0, // ส่วนลดจากโรงงาน (ในสกุลเงินของรอบ)
  note: '',
  items: [],
};

const emptyItem = () => ({
  product_id: '',
  variant_id: '',
  spec: '',
  quantity_ordered: 1,
  quantity_received: '',
  unit_cost_foreign: 0,
  cost_thb_basis: null, // ต้นทุน THB ที่ใช้เดาราคาต่างประเทศ (auto)
  cost_auto: false,     // true = ราคามาจากเดา (บาท ÷ เรต) → คำนวณใหม่เมื่อเรตเปลี่ยน
  new_sell_price_thb: '',
  location_id: '',
  note: '',
});

const ProcurementMain = ({ onNavigateToProduct }) => {
  const { can, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [schemaMissing, setSchemaMissing] = useState(false);

  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [lastPurchases, setLastPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orderView, setOrderView] = useState('list');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [supplierView, setSupplierView] = useState('list');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const canCreate = can('procurement', 'create');
  const canEdit = can('procurement', 'edit');
  const canDelete = can('procurement', 'delete');
  const canReceive = can('procurement', 'receive_stock');
  const canMarkPaid = can('procurement', 'mark_paid');
  const canMarkArrived = can('procurement', 'mark_arrived');
  const showCost = can('procurement', 'show_cost') || can('products', 'show_cost');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setSchemaMissing(false);
    try {
      const [orderRes, supplierRes, productRes, locationRes, historyRes, lastPurchaseRes] = await Promise.all([
        supabase.from('purchase_orders').select('*, supplier:supplier_id(name), purchase_order_items(id, quantity_ordered, product:product_id(name, sku), variant:variant_id(name, sku))').order('created_at', { ascending: false }),
        supabase.from('suppliers').select(`*, supplier_contacts(*), supplier_products(*, product:product_id(${PROCUREMENT_PRODUCT_SELECT}))`).order('created_at', { ascending: false }),
        supabase.from('products').select(PROCUREMENT_PRODUCT_SELECT).order('name'),
        supabase.from('storage_locations').select('id, code, name, store:store_id(id, name)').order('code'),
        supabase.from('product_price_history').select('*, product:product_id(name, sku), variant:variant_id(name, sku)').order('created_at', { ascending: false }).limit(100),
        supabase.from('purchase_order_items').select('id, product_id, variant_id, unit_cost_foreign, unit_cost_thb, created_at, purchase_order:purchase_order_id(order_number, currency, fx_rate, ordered_at, received_at, created_at)').order('created_at', { ascending: false }).limit(800),
      ]);
      if (orderRes.error || supplierRes.error || productRes.error || locationRes.error || historyRes.error || lastPurchaseRes.error) {
        const err = orderRes.error || supplierRes.error || productRes.error || locationRes.error || historyRes.error || lastPurchaseRes.error;
        if (err?.code === '42P01' || String(err?.message || '').includes('schema cache')) setSchemaMissing(true);
        else throw err;
      }
      setOrders(orderRes.data || []);
      setSuppliers((supplierRes.data || []).map(s => ({
        ...s,
        contacts: (s.supplier_contacts || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        products: (s.supplier_products || []).map(sp => sp.product).filter(Boolean),
        productLinks: s.supplier_products || [],
      })));
      setProducts(productRes.data || []);
      setLocations(locationRes.data || []);
      setPriceHistory(historyRes.data || []);
      setLastPurchases(lastPurchaseRes.data || []);
    } catch (err) {
      alert('โหลดข้อมูลสั่งของไม่สำเร็จ: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openOrderForm = (order = null) => {
    setSelectedOrder(order);
    setOrderView('form');
  };

  const openOrderDetail = async (order) => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, supplier:supplier_id(*), purchase_order_items(*, product:product_id(name, sku), variant:variant_id(name, sku), location:location_id(code, name)), purchase_order_updates(*, creator:created_by(first_name, last_name))')
      .eq('id', order.id)
      .single();
    if (error) return alert(error.message);
    setSelectedOrder(data);
    setOrderView('detail');
  };

  const openSupplierForm = (supplier = null) => {
    setSelectedSupplier(supplier);
    setSupplierView('form');
  };

  const openSupplierDetail = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierView('detail');
  };

  const tabs = [
    { id: 'orders', label: 'รอบสั่งของ', icon: ClipboardList },
    { id: 'suppliers', label: 'Supplier', icon: Building2 },
    { id: 'history', label: 'ประวัติราคา', icon: History },
  ];

  if (schemaMissing) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-6">
          <h3 className="font-bold mb-1">ยังไม่ได้ apply migration ระบบสั่งของ</h3>
          <p className="text-sm">ให้รัน migration `supabase/migrations/20260627_procurement_lot_costing.sql` ผ่าน sandbox flow ก่อนใช้งานหน้านี้</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header onRefresh={fetchAll} loading={loading} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              <Icon size={16} />{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'orders' && (
        orderView === 'list'
          ? <OrderList orders={orders} onNew={() => openOrderForm()} onOpen={openOrderDetail} canCreate={canCreate} loading={loading} />
          : orderView === 'form'
            ? <OrderFormPanel order={selectedOrder} suppliers={suppliers} products={products} locations={locations} lastPurchases={lastPurchases} profile={profile} canEdit={canEdit || canCreate} onCancel={() => setOrderView('list')} onSaved={() => { setOrderView('list'); fetchAll(); }} showCost={showCost} />
            : <OrderDetail order={selectedOrder} profile={profile} locations={locations} onBack={() => setOrderView('list')} onEdit={() => openOrderForm(selectedOrder)} onRefresh={() => openOrderDetail(selectedOrder)} canEdit={canEdit} canDelete={canDelete} canMarkPaid={canMarkPaid} canMarkArrived={canMarkArrived} canReceive={canReceive} showCost={showCost} onChanged={() => { fetchAll(); openOrderDetail(selectedOrder); }} />
      )}

      {activeTab === 'suppliers' && (
        supplierView === 'list'
          ? <SupplierList suppliers={suppliers} onNew={() => openSupplierForm()} onOpen={openSupplierDetail} canCreate={canCreate} />
          : supplierView === 'form'
            ? <SupplierForm supplier={selectedSupplier} products={products} profile={profile} onCancel={() => setSupplierView('list')} onSaved={() => { setSupplierView('list'); fetchAll(); }} />
            : <SupplierDetail supplier={selectedSupplier} onBack={() => setSupplierView('list')} onEdit={() => openSupplierForm(selectedSupplier)} canEdit={canEdit} onNavigateToProduct={onNavigateToProduct} />
      )}

      {activeTab === 'history' && <PriceHistory rows={priceHistory} showCost={showCost} />}
    </div>
  );
};

const Header = ({ onRefresh, loading }) => (
  <div className="bg-gradient-to-r from-indigo-600 to-sky-500 rounded-3xl p-8 text-white shadow-lg">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
          <PackagePlus size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">สั่งของ</h1>
          <p className="text-indigo-100 text-sm mt-1">ติดตามรอบสั่งของ Supplier และต้นทุนล็อตแบบ FIFO</p>
        </div>
      </div>
      {onRefresh && (
        <button onClick={onRefresh} className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      )}
    </div>
  </div>
);

const MiniStageTracker = ({ order }) => {
  const steps = poStepMeta(order);
  const lastKnownIndex = steps.reduce((last, s, i) => (s.date ? i : last), -1);
  return (
    <div className="flex items-start">
      {steps.map((step, idx) => {
        const hasDate = Boolean(step.date);
        const completed = hasDate && idx < lastKnownIndex;
        const current = hasDate && idx === lastKnownIndex;
        const lineDone = idx < lastKnownIndex;
        const cls = completed
          ? 'bg-indigo-500 text-white'
          : current
            ? 'bg-white text-indigo-600 ring-2 ring-indigo-500'
            : hasDate
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-200 text-gray-400';
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1 w-12 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${cls}`}>
                {completed ? <Check size={14} strokeWidth={3} /> : idx + 1}
              </div>
              <span className={`text-[10px] font-semibold leading-none ${current ? 'text-indigo-700' : hasDate ? 'text-gray-600' : 'text-gray-400'}`}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && <div className={`w-5 h-0.5 rounded-full mt-3.5 shrink-0 ${lineDone ? 'bg-indigo-500' : 'bg-gray-200'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const OrderList = ({ orders, onNew, onOpen, canCreate, loading }) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showReceived, setShowReceived] = useState(false); // รอบที่รับเข้าสต๊อกแล้ว → เก็บเป็นประวัติ ซ่อนจากบอร์ด
  const receivedCount = orders.filter(o => o.status === 'received').length;
  const filtered = orders.filter(o => {
    const itemHay = (o.purchase_order_items || []).map(item => `${item.product?.name || ''} ${item.variant?.name || ''}`).join(' ');
    const hay = `${o.order_number || ''} ${o.supplier?.name || ''} ${itemHay}`.toLowerCase();
    if (!hay.includes(search.toLowerCase())) return false;
    if (status) return o.status === status;
    // ค่าเริ่มต้น: ซ่อนที่รับเข้าแล้ว เว้นแต่กดดูประวัติ
    if (o.status === 'received' && !showReceived) return false;
    return true;
  });
  const currentStageDate = (order) => {
    if (order.status === 'received') return order.received_at || order.arrived_at;
    if (order.status === 'arrived') return order.arrived_at;
    if (order.status === 'paid') return order.paid_at;
    if (order.status === 'ordered') return order.ordered_at || order.created_at;
    return order.created_at;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเลขรอบ / Supplier" className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-sm outline-none">
            <option value="">ทุกสถานะ</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {!status && (
            <button onClick={() => setShowReceived(v => !v)} disabled={receivedCount === 0 && !showReceived} className={`py-2.5 px-3 rounded-xl text-sm font-semibold border flex items-center gap-1.5 ${showReceived ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`} title={receivedCount === 0 ? 'ยังไม่มีรอบที่รับเข้าสต๊อกแล้ว' : ''}>
              <History size={15} /> {showReceived ? 'ซ่อนที่รับเข้าแล้ว' : `ดูที่รับเข้าแล้ว (${receivedCount})`}
            </button>
          )}
        </div>
        {canCreate && <button onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm"><Plus size={16} /> สร้างรอบสั่งของ</button>}
      </div>
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-3 sm:p-4">
        {loading ? <div className="py-16 text-center text-gray-400">กำลังโหลด...</div> : filtered.length === 0 ? <div className="py-16 text-center text-gray-400">ยังไม่มีรอบสั่งของ</div> : (
          <div className="space-y-2.5">
            {filtered.map(order => {
              const items = order.purchase_order_items || [];
              const days = poDayDiff(currentStageDate(order));
              const parts = freightParts(order);
              const tone = statusTone(order.status);
              return (
                <button key={order.id} onClick={() => onOpen(order)} className="group w-full text-left bg-white border border-gray-100 hover:border-indigo-300 hover:shadow-md rounded-2xl p-4 transition-all">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <div className="min-w-0 xl:flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 group-hover:text-indigo-700">{order.order_number}</p>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tone.badge}`}>{statusLabel(order.status)}</span>
                        <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">{items.length} รายการ</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{order.supplier?.name || 'ไม่ระบุ Supplier'}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{poItemSummary(order)}</p>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold">ยอดรวม</span>
                        <span className="font-bold text-gray-900">฿{num(order.grand_total_thb).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold">อยู่สเตจนี้</span>
                        <span className="font-semibold text-gray-700 text-sm">{days ?? 0} วัน</span>
                      </div>
                      {parts.total > 0 && (
                        <div>
                          <span className="block text-[10px] text-gray-400 font-bold">ค่าส่งรวม</span>
                          <span className="font-semibold text-amber-600 text-sm">฿{parts.total.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="xl:border-l xl:border-gray-100 xl:pl-5 overflow-x-auto">
                      <MiniStageTracker order={order} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ProductMiniThumb = ({ product, className = 'w-12 h-12 rounded-2xl' }) => {
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  const url = typeof first === 'string' ? first : first?.url;
  if (url) return <img src={url} alt="" className={`${className} object-cover bg-gray-100 border border-gray-100 shrink-0`} />;
  return <div className={`${className} bg-indigo-50 border border-indigo-100 text-indigo-300 flex items-center justify-center shrink-0`}><Package size={18}/></div>;
};

const OrderStageTracker =({ order, onEditStatus, canEdit, canMarkPaid, canMarkArrived }) => {
  const steps = poStepMeta(order);
  const lastKnownIndex = steps.reduce((last, step, idx) => (step.date ? idx : last), -1);
  const editableFor = { ordered: canEdit, paid: canMarkPaid, arrived: canMarkArrived };

  const renderStep = (step, idx) => {
    const hasDate = Boolean(step.date);
    const completed = hasDate && idx < lastKnownIndex;
    const current = hasDate && idx === lastKnownIndex;
    const editable = Boolean(editableFor[step.id]);
    const circleClass = completed
      ? 'bg-indigo-500 text-white'
      : current
        ? 'bg-white text-indigo-600 ring-[3px] ring-indigo-500 shadow-sm'
        : hasDate
          ? 'bg-indigo-500 text-white'
          : 'bg-gray-200 text-gray-400';
    return (
      <div className="flex flex-col items-center gap-2.5 shrink-0 w-[68px]">
        <div className="relative">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base transition-all ${circleClass} ${editable ? 'group-hover:ring-[3px] group-hover:ring-indigo-300' : ''}`}>
            {completed ? <Check size={22} strokeWidth={3} /> : idx + 1}
          </div>
          {editable && (
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil size={11} />
            </span>
          )}
        </div>
        <div className="text-center">
          <p className={`text-sm font-bold leading-tight ${current ? 'text-indigo-700' : hasDate ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
          {step.date && <p className="text-[11px] text-gray-400 mt-0.5">{dtForInput(step.date)}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6">
      <div className="flex items-center gap-2 mb-6">
        <h3 className="font-bold text-gray-900">สถานะรอบสั่งของ</h3>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">{statusLabel(order.status)}</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex items-start min-w-[420px]">
          {steps.map((step, idx) => {
            const editable = Boolean(editableFor[step.id]);
            const lineDone = idx < lastKnownIndex;
            return (
              <React.Fragment key={step.id}>
                {editable ? (
                  <button type="button" onClick={() => onEditStatus(step.id)} title={`แก้ ${step.label}`} className="group outline-none">
                    {renderStep(step, idx)}
                  </button>
                ) : renderStep(step, idx)}
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-1 rounded-full mt-6 min-w-[20px] ${lineDone ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ช่องค้นหา + เลือก Supplier (แทน dropdown เดิม เพื่อค้นง่ายเมื่อมีหลายร้าน)
const SupplierPicker = ({ suppliers, value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = suppliers.find(s => String(s.id) === String(value));
  const list = suppliers.filter(s => (s.name || '').toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        className={`${inputClass} pl-9 pr-8`}
        placeholder="ค้นหา / เลือก Supplier..."
        value={open ? query : (selected?.name || '')}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {selected && !open && (
        <button type="button" onMouseDown={e => { e.preventDefault(); onChange(''); setQuery(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500" title="ล้าง"><X size={15} /></button>
      )}
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {list.length === 0 ? <p className="px-4 py-3 text-sm text-gray-400">ไม่พบ Supplier</p> : list.map(s => (
            <button key={s.id} type="button" onMouseDown={() => { onChange(String(s.id)); setQuery(''); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 hover:bg-indigo-50 ${String(s.id) === String(value) ? 'bg-indigo-50/60 font-semibold text-indigo-700' : 'text-gray-700'}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const OrderFormPanel = ({ order, suppliers, products, lastPurchases, profile, canEdit, onCancel, onSaved, showCost }) => {
  const [saving, setSaving] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState(products || []);
  const [supplierProductList, setSupplierProductList] = useState([]);
  const [supplierVariantSelections, setSupplierVariantSelections] = useState({});
  const [specModal, setSpecModal] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [form, setForm] = useState(() => order ? {
    ...order,
    supplier_id: order.supplier_id || '',
    freight_amount: order.freight_amount ?? 0,
    thai_freight_thb: order.thai_freight_thb ?? (order.currency === 'THB' ? (order.freight_thb ?? order.freight_amount ?? 0) : 0),
    discount_amount: order.discount_amount ?? 0,
    items: (order.purchase_order_items || []).map(i => ({
      ...i,
      variant_id: i.variant_id || '',
      location_id: i.location_id || '',
      quantity_received: i.quantity_received ?? '',
      new_sell_price_thb: i.new_sell_price_thb ?? '',
    })),
  } : { ...emptyOrder, items: [] });

  useEffect(() => setCatalogProducts(products || []), [products]);

  const selectedSupplier = useMemo(() => suppliers.find(s => String(s.id) === String(form.supplier_id)), [suppliers, form.supplier_id]);
  useEffect(() => {
    setSupplierProductList(selectedSupplier?.products || []);
    setSupplierVariantSelections({});
  }, [selectedSupplier?.id, selectedSupplier?.products]);

  const productById = useMemo(() => Object.fromEntries(catalogProducts.map(p => [p.id, p])), [catalogProducts]);
  const supplierProducts = supplierProductList || [];
  const isTHB = (form.currency || 'THB') === 'THB';
  const lastPurchaseMap = useMemo(() => {
    const map = {};
    (lastPurchases || []).forEach(row => {
      const key = purchaseKey(row.product_id, row.variant_id || '');
      if (!map[key]) map[key] = row;
    });
    return map;
  }, [lastPurchases]);
  const getLastPurchase = useCallback((productId, variantId = '') => lastPurchaseMap[purchaseKey(productId, variantId || '')] || null, [lastPurchaseMap]);
  // คืน { foreign, basisThb, isForeignHistory }
  // - ถ้าเคยซื้อสกุลเดียวกันมาก่อน → ใช้ราคาต่างประเทศจริง (ไม่ใช่ค่าเดา → ไม่คำนวณใหม่ตอนเรตเปลี่ยน)
  // - ถ้าไม่มี → เดาจากต้นทุน THB ÷ เรต (basisThb เก็บไว้คำนวณใหม่เมื่อเรตเปลี่ยน)
  const autoCost = useCallback((product, variant = null) => {
    const fx = num(form.fx_rate) || 1;
    const latestPurchase = getLastPurchase(product?.id, variant?.id || '');
    const latestCurrency = latestPurchase?.purchase_order?.currency || 'THB';
    if (latestPurchase && latestCurrency === (form.currency || 'THB')) {
      return { foreign: num(latestPurchase.unit_cost_foreign), basisThb: null, isForeignHistory: true };
    }
    const costThb = hasCostValue(latestPurchase?.unit_cost_thb)
      ? num(latestPurchase.unit_cost_thb)
      : (hasCostValue(variant?.cost_price) ? num(variant.cost_price) : num(product?.cost_price));
    if (!hasCostValue(costThb)) return { foreign: 0, basisThb: null, isForeignHistory: false };
    const foreign = (form.currency || 'THB') === 'THB' ? round2(costThb) : round2(costThb / fx);
    return { foreign, basisThb: round2(costThb), isForeignHistory: false };
  }, [form.currency, form.fx_rate, getLastPurchase]);
  // ใส่ราคา auto ลงรายการ พร้อม flag เพื่อให้คำนวณใหม่เมื่อเรตเปลี่ยน
  const withAutoCost = useCallback((item, product, variant = null) => {
    const a = autoCost(product, variant);
    return { ...item, unit_cost_foreign: a.foreign, cost_thb_basis: a.basisThb, cost_auto: !a.isForeignHistory && hasCostValue(a.basisThb) };
  }, [autoCost]);
  // เมื่อเปลี่ยนสกุลเงิน/อัตราแลกเปลี่ยน → คำนวณราคาต่างประเทศของรายการที่เป็น auto ใหม่ (บาท ÷ เรต)
  useEffect(() => {
    const fx = num(form.fx_rate) || 1;
    const cur = form.currency || 'THB';
    setForm(prev => {
      let changed = false;
      const items = prev.items.map(it => {
        if (it.cost_auto && hasCostValue(it.cost_thb_basis)) {
          const nv = cur === 'THB' ? round2(num(it.cost_thb_basis)) : round2(num(it.cost_thb_basis) / fx);
          if (num(it.unit_cost_foreign) !== nv) { changed = true; return { ...it, unit_cost_foreign: nv }; }
        }
        return it;
      });
      return changed ? { ...prev, items } : prev;
    });
  }, [form.fx_rate, form.currency]); // eslint-disable-line
  const lastPurchaseText = (purchase) => {
    if (!purchase) return 'ซื้อครั้งล่าสุด: ยังไม่มีประวัติ';
    const currency = purchase.purchase_order?.currency || 'THB';
    const thbText = hasCostValue(purchase.unit_cost_thb) ? ` ≈ ฿${round2(purchase.unit_cost_thb).toLocaleString()}` : '';
    const date = dtForInput(purchase.purchase_order?.received_at || purchase.purchase_order?.ordered_at || purchase.created_at);
    return `ซื้อครั้งล่าสุด: ${currency} ${num(purchase.unit_cost_foreign).toLocaleString()}${thbText}${date ? ` · ${date}` : ''}`;
  };
  const patchCatalogProduct = useCallback((nextProduct) => {
    if (!nextProduct?.id) return;
    setCatalogProducts(prev => {
      const exists = prev.some(p => String(p.id) === String(nextProduct.id));
      return exists
        ? prev.map(p => String(p.id) === String(nextProduct.id) ? nextProduct : p)
        : [...prev, nextProduct].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
    });
    setSupplierProductList(prev => {
      const exists = prev.some(p => String(p.id) === String(nextProduct.id));
      return exists
        ? prev.map(p => String(p.id) === String(nextProduct.id) ? nextProduct : p)
        : [...prev, nextProduct].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
    });
  }, []);
  const totals = useMemo(() => {
    const fx = num(form.fx_rate) || 1;
    const subtotalForeign = form.items.reduce((sum, item) => sum + (num(item.unit_cost_foreign) * num(item.quantity_ordered)), 0);
    const subtotalThb = subtotalForeign * fx;
    const localFreightThb = (form.currency || 'THB') === 'THB' ? 0 : num(form.freight_amount) * fx;
    const freightThb = localFreightThb + num(form.thai_freight_thb);
    const discountThb = (form.currency || 'THB') === 'THB' ? num(form.discount_amount) : num(form.discount_amount) * fx;
    const grandTotalThb = round2(subtotalThb + freightThb - discountThb);
    return { subtotalForeign: round2(subtotalForeign), subtotalThb: round2(subtotalThb), freightThb: round2(freightThb), discountThb: round2(discountThb), grandTotalThb, grandTotalForeign: round2(grandTotalThb / fx) };
  }, [form]);

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'product_id') {
        const product = productById[value];
        items[idx] = withAutoCost({ ...items[idx], variant_id: '' }, product);
      } else if (field === 'unit_cost_foreign') {
        items[idx].cost_auto = false; // ผู้ใช้แก้ราคาเอง → เลิกคำนวณอัตโนมัติ
      }
      return { ...prev, items };
    });
  };

  const selectItemVariant = (idx, variantId) => {
    setForm(prev => {
      const items = [...prev.items];
      const product = productById[items[idx]?.product_id];
      const variant = (product?.product_variants || []).find(v => String(v.id) === String(variantId));
      items[idx] = withAutoCost({
        ...items[idx],
        variant_id: variantId || '',
        spec: variant?.name || items[idx].spec || '',
      }, product, variant);
      return { ...prev, items };
    });
  };

  const addSupplierProduct = (product, variantId = '') => {
    if (!product?.id) return;
    const variants = product.product_variants || [];
    const mustChooseVariant = product.has_variants || variants.length > 0;
    if (mustChooseVariant && !variantId) return alert('กรุณาเลือกสเปคให้ครบทุกรายการ');
    const variant = variants.find(v => String(v.id) === String(variantId));
    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        withAutoCost({
          ...emptyItem(),
          product_id: product.id,
          variant_id: variant?.id || '',
          spec: variant?.name || '',
        }, product, variant),
      ],
    }));
  };

  const createSpec = async ({ product, values, rowIndex = null }) => {
    if (!product?.id) return;
    const name = values.name.trim();
    if (!name) return alert('กรุณาระบุชื่อสเปค');
    const sku = values.sku.trim() || `${product.sku || 'SKU'}-${name.replace(/\s+/g, '').toUpperCase()}`;
    const { data: variant, error: variantError } = await supabase
      .from('product_variants')
      .insert([{
        product_id: product.id,
        name,
        sku,
        options: { spec: name },
        cost_price: moneyOrNull(values.cost_price),
        sell_price: num(values.sell_price),
      }])
      .select('id, name, sku, cost_price, sell_price')
      .single();
    if (variantError) throw variantError;

    const { error: productError } = await supabase
      .from('products')
      .update({ has_variants: true, updated_by: profileRef(profile) })
      .eq('id', product.id);
    if (productError) throw productError;

    await recordPriceHistory({
      productId: product.id,
      variantId: variant.id,
      oldCostPrice: null,
      newCostPrice: variant.cost_price,
      oldSellPrice: null,
      newSellPrice: variant.sell_price,
      sourceType: 'procurement_quick_spec',
      sourceId: product.id,
      note: `เพิ่มสเปคจากหน้า PO: ${variant.name}`,
      profileId: profile?.id,
    });

    const updatedProduct = await fetchProcurementProduct(product.id);
    patchCatalogProduct(updatedProduct);
    setSupplierVariantSelections(prev => ({ ...prev, [product.id]: String(variant.id) }));
    if (rowIndex !== null && rowIndex !== undefined) {
      setForm(prev => {
        const items = [...prev.items];
        items[rowIndex] = withAutoCost({
          ...items[rowIndex],
          product_id: product.id,
          variant_id: variant.id,
          spec: variant.name,
        }, updatedProduct, variant);
        return { ...prev, items };
      });
    }
  };

  const handleProductCreated = async (createdProduct) => {
    if (!form.supplier_id) return;
    try {
      const productId = createdProduct?.id;
      if (!productId) throw new Error('ไม่พบรหัสสินค้าที่สร้าง');
      const { error: linkError } = await supabase
        .from('supplier_products')
        .upsert([{ supplier_id: form.supplier_id, product_id: productId, created_by: profile?.id || null }], { onConflict: 'supplier_id,product_id' });
      if (linkError) throw linkError;
      const fullProduct = await fetchProcurementProduct(productId);
      patchCatalogProduct(fullProduct);
      setForm(prev => ({
        ...prev,
        items: [
          ...prev.items,
          withAutoCost({
            ...emptyItem(),
            product_id: fullProduct.id,
          }, fullProduct),
        ],
      }));
      setShowProductForm(false);
    } catch (err) {
      alert('สร้างสินค้าและผูก Supplier ไม่สำเร็จ: ' + err.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!form.supplier_id) return alert('กรุณาเลือก Supplier');
    if (form.items.length === 0) return alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
    if (form.items.some(i => !i.product_id)) return alert('กรุณาเลือกสินค้าให้ครบทุกรายการ');
    if (form.items.some(i => {
      const product = productById[i.product_id];
      return (product?.has_variants || (product?.product_variants || []).length > 0) && !i.variant_id;
    })) return alert('กรุณาเลือกสเปคให้ครบทุกรายการ');
    setSaving(true);
    try {
      const localFreightAmount = (form.currency || 'THB') === 'THB' ? 0 : num(form.freight_amount);
      const payload = {
        order_number: form.order_number,
        supplier_id: form.supplier_id,
        status: form.status || 'draft',
        currency: form.currency || 'THB',
        fx_rate: num(form.fx_rate) || 1,
        freight_amount: localFreightAmount,
        freight_currency: form.currency || 'THB',
        freight_fx_rate: num(form.fx_rate) || 1,
        thai_freight_thb: num(form.thai_freight_thb),
        discount_amount: num(form.discount_amount),
        discount_thb: totals.discountThb,
        subtotal_foreign: totals.subtotalForeign,
        subtotal_thb: totals.subtotalThb,
        freight_thb: totals.freightThb,
        grand_total_thb: totals.grandTotalThb,
        note: form.note || null,
        updated_by: profile?.id || null,
        updated_at: new Date().toISOString(),
      };
      let orderId = order?.id;
      if (orderId) {
        const { error } = await writePurchaseOrder(
          nextPayload => supabase.from('purchase_orders').update(nextPayload).eq('id', orderId),
          payload
        );
        if (error) throw error;
        await supabase.from('purchase_order_items').delete().eq('purchase_order_id', orderId);
      } else {
        const { data, error } = await writePurchaseOrder(
          nextPayload => supabase.from('purchase_orders').insert([{ ...nextPayload, created_by: profile?.id || null }]).select('id').single(),
          payload
        );
        if (error) throw error;
        orderId = data.id;
      }
      const itemPayload = form.items.map(item => ({
        purchase_order_id: orderId,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        spec: item.spec || null,
        quantity_ordered: Math.max(1, Math.trunc(num(item.quantity_ordered) || 1)),
        quantity_received: item.quantity_received === '' ? null : Math.max(0, Math.trunc(num(item.quantity_received))),
        unit_cost_foreign: num(item.unit_cost_foreign),
        line_total_foreign: round2(num(item.unit_cost_foreign) * num(item.quantity_ordered)),
        unit_cost_thb: round2(num(item.unit_cost_foreign) * (num(form.fx_rate) || 1)),
        line_total_thb: round2(num(item.unit_cost_foreign) * num(item.quantity_ordered) * (num(form.fx_rate) || 1)),
        new_sell_price_thb: null,
        location_id: item.location_id || null,
        note: item.note || null,
      }));
      const { error: itemError } = await supabase.from('purchase_order_items').insert(itemPayload);
      if (itemError) throw itemError;
      await logAction({
        resource_type: 'procurement',
        resource_id: orderId,
        action: order?.id ? 'update' : 'create',
        resource_label: form.order_number,
        new_data: { status: payload.status, total: totals.grandTotalThb, items: itemPayload.length },
        created_by: profileRef(profile),
      });
      onSaved();
    } catch (err) {
      alert('บันทึกรอบสั่งของไม่สำเร็จ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <form onSubmit={save} className="space-y-5">
      <FormHeader title={order ? 'แก้ไขรอบสั่งของ' : 'สร้างรอบสั่งของ'} onBack={onCancel} saving={saving} />
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="เลขรอบ"><input required value={form.order_number} onChange={e => setForm({ ...form, order_number: e.target.value })} className={inputClass} /></Field>
        <Field label="Supplier"><SupplierPicker suppliers={suppliers} value={form.supplier_id} onChange={id => setForm({ ...form, supplier_id: id })} /></Field>
        <Field label="สถานะ"><div className="px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-700">{statusLabel(form.status || 'draft')}</div></Field>
        <Field label="สกุลเงิน">
          <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={inputClass}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="อัตราแลกเปลี่ยน"><input type="number" step="0.000001" min="0" value={form.fx_rate} onChange={e => setForm({ ...form, fx_rate: e.target.value })} className={inputClass} /></Field>
        {!isTHB && (
          <Field label={`ค่าส่ง local (${form.currency || 'THB'})`}><input type="number" step="0.01" min="0" value={form.freight_amount} onChange={e => setForm({ ...form, freight_amount: e.target.value })} className={inputClass} /></Field>
        )}
        <Field label="ค่าส่งในไทย (THB)"><input type="number" step="0.01" min="0" value={form.thai_freight_thb} onChange={e => setForm({ ...form, thai_freight_thb: e.target.value })} className={inputClass} /></Field>
        <Field label={`ส่วนลดจากโรงงาน (${form.currency || 'THB'})`}><input type="number" step="0.01" min="0" value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: e.target.value })} className={inputClass} placeholder="0" /></Field>
        <Field label="ยอดรวม THB"><div className="px-4 py-3 bg-gray-50 rounded-xl"><div className="font-bold text-gray-800">฿{totals.grandTotalThb.toLocaleString()}</div>{form.currency && form.currency !== 'THB' && <div className="text-xs font-semibold text-indigo-500 mt-0.5">≈ {form.currency} {totals.grandTotalForeign.toLocaleString()}</div>}{num(form.discount_amount) > 0 && <div className="text-xs font-semibold text-emerald-600 mt-0.5">หักส่วนลด {form.currency !== 'THB' ? `${form.currency} ${num(form.discount_amount).toLocaleString()}` : `฿${num(form.discount_amount).toLocaleString()}`} แล้ว</div>}</div></Field>
        <div className="md:col-span-4"><Field label="หมายเหตุ"><textarea rows={2} value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} className={inputClass} /></Field></div>
      </div>

      {form.supplier_id && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-800">สินค้าของ {selectedSupplier?.name || 'Supplier นี้'}</h3>
              <p className="text-xs text-gray-400 mt-1">กดเพิ่มเพื่อใส่ในรอบนี้ แล้วแก้จำนวน/ราคาต่อชิ้นในรายการด้านล่าง</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">{supplierProducts.length} รายการ</span>
              <button
                type="button"
                onClick={() => setShowProductForm(true)}
                className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold flex items-center gap-1"
              >
                <Plus size={14}/> สร้างสินค้าใหม่
              </button>
            </div>
          </div>
          {supplierProducts.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center bg-gray-50 rounded-2xl">
              <p>ยังไม่ได้ผูกสินค้าไว้กับ Supplier นี้</p>
              <button type="button" onClick={() => setShowProductForm(true)} className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm inline-flex items-center gap-1"><Plus size={14}/> สร้างสินค้าใหม่</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {supplierProducts.map(product => {
                const variants = product.product_variants || [];
                const mustChooseVariant = product.has_variants || variants.length > 0;
                const selectedVariantId = supplierVariantSelections[product.id] || '';
                const qty = productStockQty(product);
                return (
                  <div key={product.id} className="group flex flex-col border border-gray-150 rounded-2xl p-3.5 bg-white hover:border-indigo-200 hover:shadow-md transition-all" style={{ borderColor: '#f0f0f3' }}>
                    <div className="flex gap-3">
                      <ProductMiniThumb product={product} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">{product.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{product.sku || '-'}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                          <span className="text-gray-400">ทุน <b className="text-gray-700 font-bold">{productCostText(product)}</b></span>
                          <span className="text-gray-200">·</span>
                          <span className={`font-semibold ${qty > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>สต๊อก {qty.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    {mustChooseVariant && (
                      <div className="mt-3 space-y-1.5">
                        <select
                          value={selectedVariantId}
                          onChange={e => setSupplierVariantSelections(prev => ({ ...prev, [product.id]: e.target.value }))}
                          className={`${inputClass} !py-2 text-sm ${!selectedVariantId ? 'border-amber-300 bg-amber-50/40' : ''}`}
                        >
                          <option value="">เลือกสเปค *</option>
                          {variants.map(variant => (
                            <option key={variant.id} value={variant.id}>
                              {variant.name}{variant.sku ? ` (${variant.sku})` : ''}{showCost && hasCostValue(variant.cost_price) ? ` · ฿${num(variant.cost_price).toLocaleString()}` : ''}
                            </option>
                          ))}
                        </select>
                        {variants.length > 1 && (
                          <div className="flex flex-wrap gap-1">
                            {variants.slice(0, 4).map(variant => (
                              <button type="button" key={variant.id}
                                onClick={() => setSupplierVariantSelections(prev => ({ ...prev, [product.id]: String(variant.id) }))}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${String(selectedVariantId) === String(variant.id) ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                                {variant.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-auto pt-3">
                      <button type="button" onClick={() => setSpecModal({ product })} title="เพิ่มสเปคใหม่" className="px-2.5 py-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-indigo-600 text-xs font-semibold flex items-center gap-1 shrink-0"><Plus size={14}/> สเปค</button>
                      <button type="button" onClick={() => addSupplierProduct(product, selectedVariantId)} className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"><Plus size={15}/> เพิ่มลงรอบ</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-800">รายการสินค้า</h3>
          <button type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1"><Plus size={14}/> เพิ่มรายการ</button>
        </div>
        {form.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
            <Package size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-500">ยังไม่มีรายการสินค้า</p>
            <p className="text-xs text-gray-400 mt-1">เลือกสินค้าจาก Supplier ด้านบน หรือกดเพิ่มรายการเพื่อเริ่มกรอก</p>
          </div>
        ) : form.items.map((item, idx) => {
          const product = productById[item.product_id];
          const variants = product?.product_variants || [];
          const mustChooseVariant = product?.has_variants || variants.length > 0;
          const purchase = item.product_id ? getLastPurchase(item.product_id, item.variant_id || '') : null;
          const unitCostThb = round2(num(item.unit_cost_foreign) * (num(form.fx_rate) || 1));
          const sellPrice = latestSellPrice(product, item.variant_id || '');
          return (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 border border-gray-100 rounded-2xl">
              <InlineField label="สินค้า" className="md:col-span-3"><select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className={inputClass}><option value="">สินค้า</option>{catalogProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku || '-'})</option>)}</select></InlineField>
              <InlineField label="สเปค" className="md:col-span-2">
                <div className="flex gap-1">
                  <select value={item.variant_id || ''} onChange={e => selectItemVariant(idx, e.target.value)} className={`${inputClass} ${mustChooseVariant && !item.variant_id ? 'border-amber-300 bg-amber-50' : ''}`}>
                    <option value="">{mustChooseVariant ? 'เลือกสเปค *' : 'Base/ไม่มีสเปค'}</option>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.name}{v.sku ? ` (${v.sku})` : ''}</option>)}
                  </select>
                  {product && (
                    <button type="button" onClick={() => setSpecModal({ product, rowIndex: idx })} title="เพิ่มสเปคใหม่" className="px-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl">
                      <Plus size={16}/>
                    </button>
                  )}
                </div>
              </InlineField>
              <InlineField label="หมายเหตุสเปค" className="md:col-span-2"><input placeholder="สีล็อตพิเศษ/ข้อความจาก Supplier" value={item.spec || ''} onChange={e => updateItem(idx, 'spec', e.target.value)} className={inputClass} /></InlineField>
              <InlineField label="จำนวนที่สั่ง"><input type="number" min="1" value={item.quantity_ordered} onChange={e => updateItem(idx, 'quantity_ordered', e.target.value)} className={inputClass} /></InlineField>
              <InlineField label={`ราคาซื้อ/ชิ้น (${form.currency || 'THB'})`} className="md:col-span-2">
                <input type="number" step="0.01" min="0" value={item.unit_cost_foreign} onChange={e => updateItem(idx, 'unit_cost_foreign', e.target.value)} className={`${inputClass} font-semibold text-gray-900`} />
              </InlineField>
              <div className="md:col-span-2 flex items-end justify-end">
                <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })} className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>
              </div>
              <div className="md:col-span-12 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>แปลงเป็น THB: ฿{unitCostThb.toLocaleString()} / ชิ้น</span>
                <span>ราคาขายล่าสุด: {hasCostValue(sellPrice) ? `฿${num(sellPrice).toLocaleString()}` : '-'}</span>
                <span>{lastPurchaseText(purchase)}</span>
                {mustChooseVariant && !item.variant_id && <span className="text-amber-600 font-semibold">ต้องเลือกสเปคจริงก่อนบันทึก</span>}
              </div>
            </div>
          );
        })}
        {form.items.length > 0 && (
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100">
            <span className="text-sm font-semibold text-gray-500">ยอดรวมสินค้า{form.currency && form.currency !== 'THB' ? ` (${form.currency})` : ''}</span>
            <div className="text-right">
              {form.currency && form.currency !== 'THB'
                ? (<>
                    <div className="text-xl font-black text-gray-800">{form.currency} {totals.subtotalForeign.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">≈ ฿{totals.subtotalThb.toLocaleString()} · FX {num(form.fx_rate) || 1}</div>
                  </>)
                : <div className="text-xl font-black text-gray-800">฿{totals.subtotalThb.toLocaleString()}</div>}
            </div>
          </div>
        )}
      </div>
    </form>
      {specModal && (
        <QuickAddSpecModal
          product={specModal.product}
          rowIndex={specModal.rowIndex}
          onClose={() => setSpecModal(null)}
          onCreate={async (payload) => {
            try {
              await createSpec(payload);
              setSpecModal(null);
            } catch (err) {
              alert('เพิ่มสเปคไม่สำเร็จ: ' + err.message);
            }
          }}
        />
      )}
      {showProductForm && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-7xl mx-auto p-4">
            <ProductForm onCancel={() => setShowProductForm(false)} onSuccess={handleProductCreated} />
          </div>
        </div>
      )}
    </>
  );
};

const QuickAddSpecModal = ({ product, rowIndex = null, onClose, onCreate }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    cost_price: '',
    sell_price: '',
  });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('กรุณาระบุชื่อสเปค');
    setSaving(true);
    try {
      await onCreate({ product, rowIndex, values: form });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-gray-900">เพิ่มสเปคใหม่</h3>
            <p className="text-sm text-gray-500 truncate mt-1">{product?.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400"><X size={18}/></button>
        </div>
        <Field label="ชื่อสเปค *">
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="เช่น แดงด้าน / Version 2026" />
        </Field>
        <Field label="SKU">
          <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className={inputClass} placeholder="เว้นว่างเพื่อให้ระบบตั้งจาก SKU สินค้า" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคาทุน">
            <input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} className={inputClass} placeholder="ยังไม่ระบุได้" />
          </Field>
          <Field label="ราคาขาย">
            <input type="number" min="0" step="0.01" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} className={inputClass} placeholder="0" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-semibold">ยกเลิก</button>
          <button disabled={saving} type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold flex items-center gap-2">{saving && <Loader2 size={14} className="animate-spin"/>} เพิ่มสเปค</button>
        </div>
      </form>
    </div>
  );
};

const OrderDetail = ({ order, profile, locations = [], onBack, onEdit, onRefresh, canEdit, canDelete, canMarkPaid, canMarkArrived, canReceive, showCost, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [statusModal, setStatusModal] = useState(null);
  const [receiveModal, setReceiveModal] = useState(null);
  const items = order?.purchase_order_items || [];
  const updates = (order?.purchase_order_updates || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const statusUpdates = updates.filter(u => classifyUpdate(u) === 'status');
  const comments = updates.filter(u => classifyUpdate(u) === 'comment');
  // เปิด modal เลือกคลังปลายทาง: ตั้งค่าเริ่มจาก location เดิมของแต่ละรายการ
  const openReceive = () => {
    const selections = {};
    items.forEach(item => { selections[item.id] = item.location_id || ''; });
    setReceiveModal({ selections });
  };
  const confirmReceive = async (selections) => {
    setBusy(true);
    try {
      const itemLocations = Object.fromEntries(Object.entries(selections).map(([id, loc]) => [id, loc || null]));
      const result = await receivePurchaseOrder({ purchaseOrderId: order.id, profileId: profile?.id, itemLocations });
      await supabase.from('purchase_order_updates').insert([{
        purchase_order_id: order.id,
        comment: `รับเข้าสต๊อกแล้ว (${result.itemCount} รายการ)`,
        images: [],
        update_type: 'status',
        status: 'received',
        created_by: profile?.id || null,
      }]);
      await logAction({ resource_type: 'procurement', resource_id: order.id, action: 'receive_stock', resource_label: order.order_number, new_data: result, created_by: profileRef(profile) });
      setReceiveModal(null);
      onChanged();
    } catch (err) {
      alert('รับเข้าสต๊อกไม่สำเร็จ: ' + err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!confirm('ยืนยันลบรอบสั่งของนี้?')) return;
    const { error } = await supabase.from('purchase_orders').delete().eq('id', order.id);
    if (error) return alert(error.message);
    onBack();
  };
  const shipping = freightParts(order);
  const paidAmountDisplay = hasCostValue(order.paid_amount_thb) ? num(order.paid_amount_thb) : paidAmountFromUpdates(updates);
  const goodsTotalThb = num(order.subtotal_thb) || Math.max(0, num(order.grand_total_thb) - shipping.total);
  const totalQty = items.reduce((sum, item) => sum + num(item.quantity_ordered), 0);
  const receivedQty = items.reduce((sum, item) => sum + num(item.quantity_received ?? item.quantity_ordered), 0);
  const landedPreviewById = useMemo(() => {
    if (!items.length) return {};
    const receivedItems = Object.fromEntries(items.map(item => [item.id, item.quantity_received ?? item.quantity_ordered ?? 0]));
    const calculation = calculateLandedCosts({
      items,
      receivedItems,
      fxRate: order.fx_rate,
      freightThb: shipping.total,
    });
    return Object.fromEntries((calculation.rows || []).map(row => [row.id, row]));
  }, [items, order.fx_rate, shipping.total]);
  const landedCostText = (item) => {
    const qty = num(item.quantity_received ?? item.quantity_ordered);
    if (qty <= 0) return 'ไม่ได้รับ';
    if (num(item.landed_unit_cost_thb) > 0) return `฿${num(item.landed_unit_cost_thb).toLocaleString()}`;
    const preview = landedPreviewById[item.id];
    if (['arrived', 'received'].includes(order.status) && num(preview?.landed_unit_cost_thb) > 0) {
      return `฿${num(preview.landed_unit_cost_thb).toLocaleString()}`;
    }
    if (['arrived', 'received'].includes(order.status)) return 'ยังไม่คำนวณ';
    return 'รอของถึง';
  };
  const purchaseUnitCost = (item) => {
    const unitThb = hasCostValue(item.unit_cost_thb)
      ? num(item.unit_cost_thb)
      : round2(num(item.unit_cost_foreign) * (num(order.fx_rate) || 1));
    return {
      foreign: `${order.currency || 'THB'} ${num(item.unit_cost_foreign).toLocaleString()}`,
      thb: unitThb,
    };
  };
  const freightUnitCostText = (item) => {
    const qty = num(item.quantity_received ?? item.quantity_ordered);
    if (qty <= 0) return 'ไม่ได้รับ';
    const preview = landedPreviewById[item.id];
    const allocatedFreight = num(item.allocated_freight_thb) > 0
      ? num(item.allocated_freight_thb)
      : num(preview?.allocated_freight_thb);
    if (allocatedFreight > 0) return `฿${round2(allocatedFreight / qty).toLocaleString()}`;
    if (['arrived', 'received'].includes(order.status)) return '฿0';
    return 'รอค่าส่ง';
  };
  const landedReadyCount = items.filter(item => num(item.landed_unit_cost_thb) > 0 || num(landedPreviewById[item.id]?.landed_unit_cost_thb) > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20}/></button>
          <div><h2 className="font-bold text-xl text-gray-900">{order.order_number}</h2><p className="text-sm text-gray-500">{order.supplier?.name || 'ไม่ระบุ Supplier'} · {statusLabel(order.status)}</p></div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canEdit && <button onClick={onEdit} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold">แก้ไข</button>}
          {order.status === 'arrived' && canReceive && <button disabled={busy} onClick={openReceive} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1">{busy ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>} รับเข้าสต๊อก</button>}
          {canDelete && <button onClick={remove} className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-semibold">ลบ</button>}
          <button onClick={onRefresh} className="p-2 bg-gray-50 rounded-xl"><RefreshCw size={16}/></button>
        </div>
      </div>

      <OrderStageTracker order={order} onEditStatus={setStatusModal} canEdit={canEdit} canMarkPaid={canMarkPaid} canMarkArrived={canMarkArrived} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SummaryPanel icon={Calendar} title="วันที่สำคัญ" subtitle="ข้อมูลที่ใช้วัดระยะเวลาของรอบนี้">
          <SummaryLine label="วันที่สั่ง" value={dtForInput(order.ordered_at) || '-'} />
          <SummaryLine label="วันที่จ่าย" value={dtForInput(order.paid_at) || '-'}
            sub={order.ordered_at && order.paid_at ? `ห่างจากสั่ง ${humanDuration(order.ordered_at, order.paid_at)}` : null} />
          <SummaryLine label="วันที่ถึง" value={dtForInput(order.arrived_at) || '-'}
            sub={order.paid_at && order.arrived_at ? `ห่างจากจ่าย ${humanDuration(order.paid_at, order.arrived_at)}` : null} />
          {order.ordered_at && order.arrived_at && (
            <SummaryLine label="รวม สั่ง → ถึง" value={humanDuration(order.ordered_at, order.arrived_at)} emphasis />
          )}
        </SummaryPanel>
        <SummaryPanel icon={DollarSign} title="ยอดเงิน" subtitle={`สกุลเงินหลัก: ${order.currency || 'THB'} · FX ${num(order.fx_rate) || 1}`}>
          {(() => {
            const cur = order.currency || 'THB';
            const fx = num(order.fx_rate) || 1;
            const isForeign = cur !== 'THB';
            const fgn = (thb) => isForeign ? `≈ ${cur} ${round2(num(thb) / fx).toLocaleString()}` : null;
            return (<>
              <SummaryLine label="ยอดสินค้า THB" value={`฿${goodsTotalThb.toLocaleString()}`} sub={isForeign ? `${cur} ${round2(num(order.subtotal_foreign) || (goodsTotalThb / fx)).toLocaleString()}` : null} />
              <SummaryLine label="ค่าส่งรวม" value={`฿${shipping.total.toLocaleString()}`} />
              {num(order.discount_thb) > 0 && <SummaryLine label="ส่วนลดโรงงาน" value={`-฿${num(order.discount_thb).toLocaleString()}`} sub={isForeign ? `-${cur} ${num(order.discount_amount).toLocaleString()}` : null} />}
              <SummaryLine label={`ยอดรวม${isForeign ? '' : ' THB'}`} value={`฿${num(order.grand_total_thb).toLocaleString()}`} sub={fgn(order.grand_total_thb)} emphasis />
              <SummaryLine label="ยอดจ่ายจริง" value={paidAmountDisplay !== null ? `฿${num(paidAmountDisplay).toLocaleString()}` : '-'} sub={paidAmountDisplay !== null ? fgn(paidAmountDisplay) : null} />
            </>);
          })()}
        </SummaryPanel>
        <SummaryPanel icon={Truck} title="ค่าส่งและต้นทุน" subtitle="ระบบกระจายค่าส่งเข้าต้นทุนตามมูลค่าสินค้า">
          <SummaryLine label={`ค่าส่ง local${order.currency === 'THB' ? '' : ` (${order.currency})`}`} value={order.currency === 'THB' ? 'ไม่ใช้กับ THB' : `${num(order.freight_amount).toLocaleString()} ${order.currency}`} />
          <SummaryLine label="ค่าส่งในไทย" value={`฿${shipping.thai.toLocaleString()}`} />
          <SummaryLine label="รายการที่คำนวณต้นทุนแล้ว" value={`${landedReadyCount}/${items.length} รายการ`} emphasis={['arrived', 'received'].includes(order.status)} />
        </SummaryPanel>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">รายการสินค้าในรอบนี้</h3>
            <p className="text-xs text-gray-400 mt-1">แสดงจำนวนที่สั่ง/รับ และต้นทุนต่อชิ้นหลังเฉลี่ยค่าส่ง</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <span className="rounded-xl bg-gray-50 px-3 py-2">
              <span className="block text-gray-400 font-bold">รายการ</span>
              <span className="font-bold text-gray-900">{items.length}</span>
            </span>
            <span className="rounded-xl bg-gray-50 px-3 py-2">
              <span className="block text-gray-400 font-bold">จำนวนสั่ง</span>
              <span className="font-bold text-gray-900">{totalQty.toLocaleString()}</span>
            </span>
            <span className="rounded-xl bg-gray-50 px-3 py-2">
              <span className="block text-gray-400 font-bold">รับจริง</span>
              <span className="font-bold text-gray-900">{receivedQty.toLocaleString()}</span>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-3">สินค้า</th>
                <th className="text-left p-3">สเปค</th>
                <th className="text-right p-3">จำนวน</th>
                {showCost && <th className="text-right p-3">ราคาซื้อจริง/ชิ้น</th>}
                {showCost && <th className="text-right p-3">ค่าส่ง/ชิ้น</th>}
                {showCost && <th className="text-right p-3">ต้นทุนรวม/ชิ้น</th>}
                <th className="text-left p-3">ที่เก็บ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => {
                const purchase = purchaseUnitCost(item);
                return (
                  <tr key={item.id}>
                    <td className="p-3 font-semibold text-gray-800">{item.product?.name}{item.variant?.name ? ` · ${item.variant.name}` : ''}</td>
                    <td className="p-3 text-gray-500">{item.spec || '-'}</td>
                    <td className="p-3 text-right">{item.quantity_received ?? item.quantity_ordered}</td>
                    {showCost && (
                      <td className="p-3 text-right">
                        <p className="font-bold text-gray-900">{purchase.foreign}</p>
                        {(order.currency || 'THB') !== 'THB' && <p className="text-[11px] text-gray-400">≈ ฿{purchase.thb.toLocaleString()}</p>}
                      </td>
                    )}
                    {showCost && <td className="p-3 text-right font-semibold text-sky-700">{freightUnitCostText(item)}</td>}
                    {showCost && <td className="p-3 text-right text-amber-700 font-bold">{landedCostText(item)}</td>}
                    <td className="p-3 text-gray-500">{item.location?.code || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {showCost && <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-50">ต้นทุนหลังค่าส่งคือราคาต่อชิ้นหลังรวมค่าขนส่ง กระจายตามมูลค่าสินค้า ระบบจะคำนวณตอนกด “ถึงแล้ว” และใช้ค่านี้ตอน “รับเข้าสต๊อก” เพื่อสร้างล็อต FIFO</p>}
      </div>

      <StatusHistoryCard updates={statusUpdates} />
      <PurchaseOrderTimeline orderId={order.id} updates={comments} profile={profile} onSaved={onChanged} />

      {statusModal && (
        <StatusUpdateModal
          order={order}
          status={statusModal}
          profile={profile}
          onClose={() => setStatusModal(null)}
          onSaved={() => { setStatusModal(null); onChanged(); }}
        />
      )}

      {receiveModal && (
        <ReceiveStockModal
          order={order}
          items={items}
          locations={locations}
          selections={receiveModal.selections}
          busy={busy}
          onChange={(itemId, locId) => setReceiveModal(prev => ({ selections: { ...prev.selections, [itemId]: locId } }))}
          onClose={() => !busy && setReceiveModal(null)}
          onConfirm={() => confirmReceive(receiveModal.selections)}
        />
      )}
    </div>
  );
};

const ReceiveStockModal = ({ order, items, locations = [], selections, busy, onChange, onClose, onConfirm }) => {
  const grouped = useMemo(() => {
    const map = {};
    (locations || []).forEach(loc => {
      const store = loc.store?.name || 'ไม่ระบุสาขา';
      (map[store] = map[store] || []).push(loc);
    });
    return map;
  }, [locations]);
  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xl text-gray-900">รับเข้าสต๊อก + สร้างล็อต FIFO</h3>
            <p className="text-sm text-gray-500">{order.order_number} · เลือกคลังปลายทางของแต่ละรายการ</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20}/></button>
        </div>
        <div className="space-y-3">
          {items.map(item => {
            const qty = num(item.quantity_received ?? item.quantity_ordered);
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{item.product?.name || 'สินค้า'}{item.variant?.name ? ` · ${item.variant.name}` : ''}</p>
                  <p className="text-xs text-gray-500">รับเข้า {qty} ชิ้น · {item.product?.sku || '-'}</p>
                </div>
                <select
                  value={selections[item.id] || ''}
                  onChange={e => onChange(item.id, e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm min-w-[180px]"
                >
                  <option value="">— ไม่ระบุคลัง —</option>
                  {Object.entries(grouped).map(([store, locs]) => (
                    <optgroup key={store} label={store}>
                      {locs.map(loc => <option key={loc.id} value={loc.id}>{loc.code} · {loc.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            );
          })}
          {!items.length && <p className="text-sm text-gray-500">ไม่มีรายการสินค้าในรอบนี้</p>}
        </div>
        {!locations.length && <p className="text-xs text-amber-600">ยังไม่มีคลัง/ตำแหน่งเก็บในระบบ — ของจะเข้าแบบไม่ระบุคลัง (ไปเพิ่มได้ที่เมนูสต๊อก)</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold disabled:opacity-50">ยกเลิก</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>} ยืนยันรับเข้า</button>
        </div>
      </div>
    </div>
  );
};

const StatusUpdateModal = ({ order, status, profile, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const statusDate = status === 'ordered' ? order.ordered_at : status === 'paid' ? order.paid_at : order.arrived_at;
  const [date, setDate] = useState(dtForInput(statusDate) || today());
  const [comment, setComment] = useState(`อัปเดตสถานะ: ${statusLabel(status)}`);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [paidAmountThb, setPaidAmountThb] = useState(order.paid_amount_thb ?? order.grand_total_thb ?? 0);
  const [paidAmountForeign, setPaidAmountForeign] = useState(() => round2(num(order.paid_amount_thb ?? order.grand_total_thb ?? 0) / (num(order.fx_rate) || 1)));
  const [localFreightAmount, setLocalFreightAmount] = useState(order.currency === 'THB' ? 0 : (order.freight_amount || 0));
  const [thaiFreightThb, setThaiFreightThb] = useState(order.thai_freight_thb ?? (order.currency === 'THB' ? (order.freight_thb ?? order.freight_amount ?? 0) : 0));
  const arrivedItems = order.purchase_order_items || [];
  const [receivedItems, setReceivedItems] = useState(() => Object.fromEntries(
    arrivedItems.map(item => [item.id, item.quantity_received ?? item.quantity_ordered ?? 0])
  ));
  const [receivedComplete, setReceivedComplete] = useState(() => arrivedItems.every(item => num(item.quantity_received ?? item.quantity_ordered) === num(item.quantity_ordered)));
  const orderCurrency = order.currency || 'THB';
  const isTHB = orderCurrency === 'THB';
  const filePreviews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => filePreviews.forEach(preview => URL.revokeObjectURL(preview.url)), [filePreviews]);
  const setAllReceived = () => {
    setReceivedItems(Object.fromEntries(arrivedItems.map(item => [item.id, item.quantity_ordered ?? 0])));
    setReceivedComplete(true);
  };
  const updateReceivedQty = (itemId, value) => {
    setReceivedItems(prev => {
      const next = { ...prev, [itemId]: value };
      setReceivedComplete(arrivedItems.length > 0 && arrivedItems.every(item => num(next[item.id]) === num(item.quantity_ordered)));
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!date) return alert('กรุณาระบุวันที่');
    if (status === 'paid' && paidAmountThb === '') return alert('กรุณาระบุยอดที่จ่าย');
    if (status === 'arrived' && ((!isTHB && localFreightAmount === '') || thaiFreightThb === '')) return alert('กรุณาระบุค่าส่ง หรือใส่ 0 ถ้ายังไม่มีค่าส่ง');
    if (status === 'arrived' && arrivedItems.some(item => num(receivedItems[item.id]) < 0)) return alert('จำนวนรับจริงต้องไม่ติดลบ');
    setSaving(true);
    try {
      const field = status === 'ordered' ? 'ordered_at' : status === 'paid' ? 'paid_at' : 'arrived_at';
      const localFreightThb = isTHB ? 0 : num(localFreightAmount) * (num(order.fx_rate) || 1);
      const freightThb = round2(localFreightThb + num(thaiFreightThb));
      const landedCalculation = status === 'arrived'
        ? calculateLandedCosts({
          items: arrivedItems,
          receivedItems,
          fxRate: order.fx_rate,
          freightThb,
        })
        : null;
      const statusToSave = STATUS_RANK[order.status] > STATUS_RANK[status] ? order.status : status;
      const patch = {
        status: statusToSave,
        [field]: toIsoOrNull(date),
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      };
      if (status === 'paid') {
        patch.paid_amount_thb = num(paidAmountThb);
      }
      if (status === 'arrived') {
        patch.freight_amount = isTHB ? 0 : num(localFreightAmount);
        patch.freight_currency = orderCurrency;
        patch.freight_fx_rate = num(order.fx_rate) || 1;
        patch.thai_freight_thb = num(thaiFreightThb);
        patch.freight_thb = freightThb;
        patch.subtotal_foreign = landedCalculation?.subtotalForeign ?? order.subtotal_foreign;
        patch.subtotal_thb = landedCalculation?.subtotalThb ?? order.subtotal_thb;
        patch.grand_total_thb = landedCalculation?.grandTotalThb ?? round2(num(order.subtotal_thb) + freightThb);
      }
      const { error } = await writePurchaseOrder(
        nextPatch => supabase.from('purchase_orders').update(nextPatch).eq('id', order.id),
        patch
      );
      if (error) throw error;
      if (status === 'arrived' && landedCalculation?.rows?.length > 0) {
        await updatePurchaseOrderItemCosts(landedCalculation.rows);
      }
      const images = await uploadProcurementImages(files);
      const paidAmountLine = `ยอดจ่ายจริง: ฿${num(paidAmountThb).toLocaleString()}`;
      const defaultComment = status === 'paid'
        ? `อัปเดตสถานะ: ${statusLabel(status)}\n${paidAmountLine}`
        : `อัปเดตสถานะ: ${statusLabel(status)}${status === 'arrived' ? (receivedComplete ? ' · รับครบ' : ' · รับไม่ครบ/รอตรวจเพิ่ม') : ''}`;
      const finalComment = status === 'paid' && comment.trim()
        ? `${comment.trim()}\n${paidAmountLine}`
        : (comment.trim() || defaultComment);
      const { error: updateError } = await supabase.from('purchase_order_updates').insert([{
        purchase_order_id: order.id,
        comment: finalComment,
        images,
        update_type: 'status',
        status,
        created_by: profile?.id || null,
      }]);
      if (updateError) throw updateError;
      await logAction({ resource_type: 'procurement', resource_id: order.id, action: `mark_${status}`, resource_label: order.order_number, new_data: patch, created_by: profileRef(profile) });
      onSaved();
    } catch (err) {
      alert('อัปเดตสถานะไม่สำเร็จ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-900">อัปเดตสถานะ: {statusLabel(status)}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400"><X size={18}/></button>
        </div>
        <Field label={`วันที่${status === 'ordered' ? 'สั่ง' : status === 'paid' ? 'จ่าย' : 'ถึง'} *`}>
          <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
        </Field>
        {status === 'paid' && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">ยอดตามระบบ</p>
                <p className="font-bold text-gray-900">฿{num(order.grand_total_thb).toLocaleString()}
                  {!isTHB && <span className="text-sm font-semibold text-emerald-600 ml-2">≈ {orderCurrency} {round2(num(order.grand_total_thb) / (num(order.fx_rate) || 1)).toLocaleString()}</span>}
                </p>
              </div>
              <p className="text-xs text-gray-400 sm:max-w-[230px]">กรอกได้ทั้ง THB หรือ {orderCurrency} ระบบแปลงให้อัตโนมัติ (เติมยอดระบบให้แล้ว)</p>
            </div>
            <div className={`grid grid-cols-1 ${isTHB ? '' : 'sm:grid-cols-2'} gap-2`}>
              <Field label="ยอดที่จ่ายจริง (THB) *">
                <input type="number" min="0" step="0.01" required value={paidAmountThb}
                  onChange={e => { const v = e.target.value; setPaidAmountThb(v); setPaidAmountForeign(v === '' ? '' : round2(num(v) / (num(order.fx_rate) || 1))); }}
                  className={inputClass} />
              </Field>
              {!isTHB && (
                <Field label={`ยอดที่จ่ายจริง (${orderCurrency})`}>
                  <input type="number" min="0" step="0.01" value={paidAmountForeign}
                    onChange={e => { const v = e.target.value; setPaidAmountForeign(v); setPaidAmountThb(v === '' ? '' : round2(num(v) * (num(order.fx_rate) || 1))); }}
                    className={inputClass} />
                </Field>
              )}
            </div>
          </div>
        )}
        {status === 'arrived' && (
          <div className="space-y-4 bg-amber-50 border border-amber-100 rounded-2xl p-3">
            <div className={`grid grid-cols-1 ${isTHB ? '' : 'sm:grid-cols-2'} gap-2`}>
              {!isTHB && <Field label={`ค่าส่ง local (${orderCurrency})`}><input type="number" min="0" step="0.01" value={localFreightAmount} onChange={e => setLocalFreightAmount(e.target.value)} className={inputClass} /></Field>}
              <Field label="ค่าส่งในไทย (THB)"><input type="number" min="0" step="0.01" value={thaiFreightThb} onChange={e => setThaiFreightThb(e.target.value)} className={inputClass} /></Field>
            </div>
            <div className="bg-white border border-amber-100 rounded-2xl p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-gray-800 text-sm">ตรวจรับสินค้า</h4>
                  <p className="text-xs text-gray-400 mt-0.5">แก้จำนวนรับจริงได้ ถ้าของมาไม่ครบตามที่สั่ง</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receivedComplete}
                    onChange={e => e.target.checked ? setAllReceived() : setReceivedComplete(false)}
                    className="accent-emerald-600"
                  />
                  ได้รับครบ
                </label>
              </div>
              {arrivedItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีรายการสินค้าให้ตรวจรับ</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {arrivedItems.map(item => (
                    <div key={item.id} className="py-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_90px_120px] gap-2 items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{item.product?.name || 'สินค้า'}{item.variant?.name ? ` · ${item.variant.name}` : ''}</p>
                        <p className="text-xs text-gray-400">{item.spec || '-'}</p>
                      </div>
                      <div className="text-sm text-gray-500 sm:text-right">
                        <span className="sm:block text-[10px] font-bold text-gray-400 uppercase">สั่ง</span>
                        <span className="font-bold text-gray-700">{num(item.quantity_ordered).toLocaleString()}</span>
                      </div>
                      <InlineField label="รับจริง">
                        <input
                          type="number"
                          min="0"
                          value={receivedItems[item.id] ?? ''}
                          onChange={e => updateReceivedQty(item.id, e.target.value)}
                          className={inputClass}
                        />
                      </InlineField>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <Field label="คอมเมนต์">
          <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} className={inputClass} />
        </Field>
        <div>
          <label className={labelClass}>รูปแนบ</label>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold flex items-center gap-2">
              <ImageIcon size={16}/> แนบรูป
            </button>
            {files.length > 0 && <span className="text-xs font-semibold text-gray-500">เลือกแล้ว {files.length} รูป</span>}
          </div>
          {filePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {filePreviews.map((preview, idx) => (
                <div key={`${preview.file.name}-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={preview.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white">
                    <X size={10}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-semibold">ยกเลิก</button>
          <button disabled={saving} type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold flex items-center gap-2">{saving && <Loader2 size={14} className="animate-spin"/>} บันทึกสถานะ</button>
        </div>
      </form>
    </div>
  );
};

// แยกประเภท update: ใช้คอลัมน์ update_type ก่อน, ถ้าเป็นแถวเก่า (ยังไม่มีค่า) เดาจากข้อความ
const classifyUpdate = (u) => {
  if (u?.update_type) return u.update_type;
  const text = u?.comment || '';
  return (/^อัปเดตสถานะ/.test(text) || /^รับเข้าสต๊อกแล้ว/.test(text)) ? 'status' : 'comment';
};

const PO_STATUS_TONE = {
  draft: { dot: 'bg-gray-300', ring: 'ring-gray-100', badge: 'bg-gray-100 text-gray-600' },
  ordered: { dot: 'bg-blue-500', ring: 'ring-blue-100', badge: 'bg-blue-50 text-blue-700' },
  paid: { dot: 'bg-violet-500', ring: 'ring-violet-100', badge: 'bg-violet-50 text-violet-700' },
  arrived: { dot: 'bg-amber-500', ring: 'ring-amber-100', badge: 'bg-amber-50 text-amber-700' },
  received: { dot: 'bg-emerald-500', ring: 'ring-emerald-100', badge: 'bg-emerald-50 text-emerald-700' },
  cancelled: { dot: 'bg-rose-500', ring: 'ring-rose-100', badge: 'bg-rose-50 text-rose-700' },
};
const statusTone = (s) => PO_STATUS_TONE[s] || { dot: 'bg-indigo-500', ring: 'ring-indigo-100', badge: 'bg-indigo-50 text-indigo-700' };
const cleanStatusDetail = (comment) => {
  const lines = String(comment || '').split('\n');
  if (lines[0] && /^อัปเดตสถานะ/.test(lines[0].trim())) lines.shift();
  return lines.join('\n').trim();
};
const initialsOf = (name) => (String(name || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?');
const STATUS_PREVIEW_COUNT = 5;
const COMMENT_PREVIEW_COUNT = 4;

const StatusHistoryCard = ({ updates = [] }) => {
  const [lightbox, setLightbox] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? updates : updates.slice(0, STATUS_PREVIEW_COUNT);
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><History size={18}/> ประวัติสถานะ</h3>
        {updates.length > 0 && <span className="text-xs font-semibold text-gray-400">{updates.length} เหตุการณ์</span>}
      </div>
      {updates.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">ยังไม่มีประวัติสถานะ</p>
      ) : (
        <ol className="relative">
          {visible.map((update, idx) => {
            const tone = statusTone(update.status);
            const creator = update.creator ? `${update.creator.first_name || ''} ${update.creator.last_name || ''}`.trim() : 'ไม่ระบุผู้บันทึก';
            const images = Array.isArray(update.images) ? update.images : [];
            const detail = cleanStatusDetail(update.comment);
            const isLast = idx === visible.length - 1;
            return (
              <li key={update.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                {!isLast && <span className="absolute left-[7px] top-5 -bottom-0 w-px bg-gray-200" aria-hidden />}
                <span className={`mt-1 w-3.5 h-3.5 rounded-full shrink-0 ${tone.dot} ring-4 ${tone.ring}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${tone.badge}`}>{update.status ? statusLabel(update.status) : 'อัปเดต'}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(update.created_at).toLocaleString('th-TH')}</span>
                  </div>
                  {detail && <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1.5">{detail}</p>}
                  <p className="text-xs text-gray-400 mt-1">โดย {creator}</p>
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {images.map((img, i) => (
                        <button key={i} type="button" onClick={() => setLightbox({ images, index: i })} className="block w-14 h-14 rounded-lg overflow-hidden border border-gray-100 hover:opacity-80 transition-opacity">
                          <img src={img.url || img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {updates.length > STATUS_PREVIEW_COUNT && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="w-full text-sm font-semibold text-indigo-600 hover:bg-indigo-50 py-2 rounded-xl transition-colors">
          {showAll ? 'ย่อ' : `ดูทั้งหมด (${updates.length} เหตุการณ์)`}
        </button>
      )}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(index) => setLightbox(prev => ({ ...prev, index }))}
        />
      )}
    </div>
  );
};

const PurchaseOrderTimeline = ({ orderId, updates, profile, onSaved }) => {
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const fileInputRef = useRef(null);
  const visibleComments = showAll ? updates : updates.slice(0, COMMENT_PREVIEW_COUNT);
  const selectedPreviews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => selectedPreviews.forEach(preview => URL.revokeObjectURL(preview.url)), [selectedPreviews]);

  const submit = async (e) => {
    e.preventDefault();
    if (!comment.trim() && files.length === 0) return alert('กรุณาใส่คอมเมนต์หรือแนบรูป');
    setSaving(true);
    try {
      const images = await uploadProcurementImages(files);
      const { error } = await supabase.from('purchase_order_updates').insert([{
        purchase_order_id: orderId,
        comment: comment.trim() || 'แนบรูปเพิ่มเติม',
        images,
        update_type: 'comment',
        created_by: profile?.id || null,
      }]);
      if (error) throw error;
      setComment('');
      setFiles([]);
      onSaved();
    } catch (err) {
      alert('เพิ่มคอมเมนต์ไม่สำเร็จ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
      <h3 className="font-bold text-gray-800 flex items-center gap-2"><History size={18}/> คอมเมนต์</h3>
      <form onSubmit={submit} className="space-y-3 bg-gray-50 rounded-2xl p-4">
        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} className={inputClass} placeholder="เขียนคอมเมนต์ อัปเดตเพิ่มเติม หรือหมายเหตุ..." />
        <div className="flex flex-col sm:flex-row gap-2 justify-between">
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold flex items-center gap-2">
              <ImageIcon size={15}/> แนบรูป
            </button>
          </div>
          <button disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">{saving && <Loader2 size={14} className="animate-spin"/>} เพิ่มคอมเมนต์</button>
        </div>
        {files.length > 0 && <p className="text-xs text-gray-400">เลือกแล้ว {files.length} รูป</p>}
        {selectedPreviews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedPreviews.map((preview, idx) => (
              <div key={`${preview.file.name}-${idx}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                <img src={preview.url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white"><X size={10}/></button>
              </div>
            ))}
          </div>
        )}
      </form>
      <div className="space-y-3">
        {updates.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">ยังไม่มีคอมเมนต์</p> : visibleComments.map(update => {
          const creator = update.creator ? `${update.creator.first_name || ''} ${update.creator.last_name || ''}`.trim() : 'ไม่ระบุผู้บันทึก';
          const images = Array.isArray(update.images) ? update.images : [];
          return (
            <div key={update.id} className="flex gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">{initialsOf(creator)}</div>
              <div className="flex-1 min-w-0 bg-gray-50 rounded-2xl rounded-tl-md p-3.5">
                <div className="flex justify-between items-baseline gap-3">
                  <p className="font-semibold text-gray-800 text-sm truncate">{creator}</p>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{new Date(update.created_at).toLocaleString('th-TH')}</p>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{update.comment}</p>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {images.map((img, idx) => (
                      <button key={idx} type="button" onClick={() => setLightbox({ images, index: idx })} className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-100 hover:opacity-80 transition-opacity">
                        <img src={img.url || img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {updates.length > COMMENT_PREVIEW_COUNT && (
          <button type="button" onClick={() => setShowAll(v => !v)} className="w-full text-sm font-semibold text-indigo-600 hover:bg-indigo-50 py-2 rounded-xl transition-colors">
            {showAll ? 'ย่อ' : `ดูคอมเมนต์ทั้งหมด (${updates.length})`}
          </button>
        )}
      </div>
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(index) => setLightbox(prev => ({ ...prev, index }))}
        />
      )}
    </div>
  );
};

const SupplierList = ({ suppliers, onNew, onOpen, canCreate }) => {
  const [viewMode, setViewMode] = useState(() => getStoredViewMode('procurement_supplier_list_view_mode', 'grid'));
  useEffect(() => {
    setStoredViewMode('procurement_supplier_list_view_mode', viewMode);
  }, [viewMode]);
  const supplierImage = (supplier) => {
    const first = Array.isArray(supplier.images) ? supplier.images[0] : null;
    return typeof first === 'string' ? first : first?.url;
  };
  const contactText = (supplier) => (supplier.contacts || [])
    .slice(0, 2)
    .map(c => `${c.channel}: ${c.account_id || c.phone || c.url || '-'}`)
    .join(' · ');
  const productPreview = (supplier) => (supplier.products || []).slice(0, 3);

  const Thumb = ({ supplier, size = 'lg' }) => {
    const image = supplierImage(supplier);
    const classes = size === 'sm' ? 'w-16 h-16 rounded-2xl' : 'w-full aspect-[4/3] rounded-2xl';
    if (image) return <img src={image} alt="" className={`${classes} object-cover bg-gray-100`} />;
    return (
      <div className={`${classes} bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100 flex items-center justify-center text-indigo-300`}>
        <Building2 size={size === 'sm' ? 24 : 38} />
      </div>
    );
  };

  const ToggleButton = ({ mode, icon: Icon, label }) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      className={`px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${viewMode === mode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
      title={label}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-1 flex w-fit">
          <ToggleButton mode="grid" icon={LayoutGrid} label="การ์ด" />
          <ToggleButton mode="list" icon={List} label="ลิสต์" />
        </div>
        {canCreate && <button onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm"><Plus size={16}/> เพิ่ม Supplier</button>}
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center text-gray-400">ยังไม่มี Supplier</div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map(supplier => (
            <button key={supplier.id} onClick={() => onOpen(supplier)} className="group text-left bg-white rounded-3xl border border-gray-100 shadow-sm p-3 hover:border-indigo-200 hover:shadow-md transition-all">
              <Thumb supplier={supplier} />
              <div className="p-2 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{supplier.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{supplier.product_type || 'ไม่ระบุชนิดสินค้า'}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] px-2 py-1 rounded-full font-bold ${supplier.is_active === false ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    {supplier.is_active === false ? 'ปิด' : 'ใช้งาน'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {productPreview(supplier).length === 0 ? <span className="text-xs text-gray-400">ยังไม่ได้ผูกสินค้า</span> : productPreview(supplier).map(product => (
                    <span key={product.id} className="max-w-full truncate text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-semibold">{product.name}</span>
                  ))}
                  {(supplier.products || []).length > 3 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-semibold">+{supplier.products.length - 3}</span>}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-400 truncate">{contactText(supplier) || 'ยังไม่มีช่องทางติดต่อ'}</p>
                  <p className="text-xs text-indigo-600 font-bold shrink-0">{(supplier.products || []).length} สินค้า</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {suppliers.map(supplier => (
            <button key={supplier.id} onClick={() => onOpen(supplier)} className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
              <Thumb supplier={supplier} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-gray-900 truncate">{supplier.name}</h3>
                  <span className="text-xs text-gray-400">{supplier.product_type || 'ไม่ระบุชนิดสินค้า'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">{contactText(supplier) || 'ยังไม่มีช่องทางติดต่อ'}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {productPreview(supplier).map(product => <span key={product.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-semibold">{product.name}</span>)}
                  {(supplier.products || []).length > 3 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-semibold">+{supplier.products.length - 3}</span>}
                </div>
              </div>
              <div className="hidden sm:block text-right shrink-0">
                <p className="font-bold text-indigo-600">{(supplier.products || []).length}</p>
                <p className="text-xs text-gray-400">สินค้า</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SupplierForm = ({ supplier, products, profile, onCancel, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => supplier ? { ...supplier, images: supplier.images || [], files: supplier.files || [], contacts: supplier.contacts?.length ? supplier.contacts : emptySupplier.contacts } : emptySupplier);
  const updateFile = (idx, key, val) => setForm(prev => ({ ...prev, files: prev.files.map((f, i) => i === idx ? { ...f, [key]: val } : f) }));
  const [selectedProductIds, setSelectedProductIds] = useState(() => (supplier?.productLinks || []).map(link => String(link.product_id)));
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const fileRef = useRef(null);
  const categoryOptions = useMemo(() => {
    const map = new Map();
    products.forEach(product => {
      (product.product_categories || []).forEach(link => {
        if (link.category?.id) map.set(String(link.category.id), link.category.name);
      });
      if (product.category?.id) map.set(String(product.category.id), product.category.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [products]);
  const productById = useMemo(() => new Map(products.map(product => [String(product.id), product])), [products]);
  const selectedProducts = selectedProductIds.map(id => productById.get(String(id))).filter(Boolean);
  const filteredProducts = products.filter(product => {
    const haystack = `${product.name || ''} ${product.sku || ''}`.toLowerCase();
    const matchesSearch = haystack.includes(productSearch.toLowerCase());
    const categoryIds = new Set([
      ...(product.product_categories || []).map(link => String(link.category_id)),
      product.category_id ? String(product.category_id) : null,
    ].filter(Boolean));
    const matchesCategory = !productCategoryFilter || categoryIds.has(String(productCategoryFilter));
    return matchesSearch && matchesCategory && !selectedProductIds.includes(String(product.id));
  });
  const productCategoryLabel = (product) => {
    const names = [
      ...(product.product_categories || []).map(link => link.category?.name).filter(Boolean),
      product.category?.name,
    ].filter(Boolean);
    return [...new Set(names)].join(', ') || 'ไม่มีหมวดหมู่';
  };

  const addImages = async (files) => {
    const next = [...(form.images || [])];
    for (const file of Array.from(files || [])) {
      const path = `suppliers/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const { error } = await supabase.storage.from('suppliers').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('suppliers').getPublicUrl(path);
      next.push({ url: data.publicUrl });
    }
    setForm({ ...form, images: next });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('กรุณาระบุชื่อร้านค้า');
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), product_type: form.product_type || null, note: form.note || null, images: form.images || [], files: (form.files || []).filter(f => (f.url || '').trim()).map(f => ({ label: (f.label || '').trim(), url: f.url.trim() })), is_active: form.is_active !== false, updated_by: profile?.id || null, updated_at: new Date().toISOString() };
      let supplierId = supplier?.id;
      if (supplierId) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', supplierId);
        if (error) throw error;
        await supabase.from('supplier_contacts').delete().eq('supplier_id', supplierId);
      } else {
        const { data, error } = await supabase.from('suppliers').insert([{ ...payload, created_by: profile?.id || null }]).select('id').single();
        if (error) throw error;
        supplierId = data.id;
      }
      const contacts = (form.contacts || []).filter(c => c.channel || c.account_id || c.url || c.phone || c.note).map((c, idx) => ({ supplier_id: supplierId, channel: c.channel || 'Other', label: c.label || null, account_id: c.account_id || null, url: c.url || null, phone: c.phone || null, note: c.note || null, sort_order: idx }));
      if (contacts.length) {
        const { error } = await supabase.from('supplier_contacts').insert(contacts);
        if (error) throw error;
      }
      await supabase.from('supplier_products').delete().eq('supplier_id', supplierId);
      if (selectedProductIds.length > 0) {
        const rows = selectedProductIds.map(productId => ({
          supplier_id: supplierId,
          product_id: productId,
          created_by: profile?.id || null,
        }));
        const { error } = await supabase.from('supplier_products').insert(rows);
        if (error) throw error;
      }
      await logAction({ resource_type: 'procurement', resource_id: supplierId, action: supplier?.id ? 'update_supplier' : 'create_supplier', resource_label: form.name, created_by: profileRef(profile) });
      onSaved();
    } catch (err) {
      alert('บันทึก Supplier ไม่สำเร็จ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateContact = (idx, field, value) => {
    const contacts = [...form.contacts];
    contacts[idx] = { ...contacts[idx], [field]: value };
    setForm({ ...form, contacts });
  };
  const addProduct = (productId) => {
    const id = String(productId);
    setSelectedProductIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };
  const removeProduct = (productId) => {
    const id = String(productId);
    setSelectedProductIds(prev => prev.filter(x => x !== id));
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <FormHeader title={supplier ? 'แก้ไข Supplier' : 'เพิ่ม Supplier'} onBack={onCancel} saving={saving} />
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="ชื่อร้านค้า"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
          <Field label="ชนิดสินค้า"><input value={form.product_type || ''} onChange={e => setForm({ ...form, product_type: e.target.value })} className={inputClass} placeholder="เช่น อะไหล่, สี, ชุดแต่ง" /></Field>
        </div>
        <Field label="หมายเหตุ"><textarea rows={3} value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} className={inputClass} /></Field>
        <div>
          <label className={labelClass}>รูปภาพ</label>
          <div className="flex gap-3 flex-wrap">
            {(form.images || []).map((img, idx) => <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border"><img src={img.url || img} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, i) => i !== idx) })} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X size={10}/></button></div>)}
            <button type="button" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 flex flex-col items-center justify-center"><ImageIcon size={18}/><span className="text-[10px]">เพิ่มรูป</span></button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addImages(e.target.files)} />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-800">สินค้าที่สั่งจาก Supplier นี้</h3>
            <p className="text-xs text-gray-400 mt-1">กรองตามหมวดหมู่แล้วกดเพิ่มเข้าลิสต์ด้านขวา</p>
          </div>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">{selectedProductIds.length} รายการ</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)] gap-4">
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-2">
              <select value={productCategoryFilter} onChange={e => setProductCategoryFilter(e.target.value)} className={inputClass}>
                <option value="">ทุกหมวดหมู่</option>
                {categoryOptions.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)} className={`${inputClass} pl-9`} placeholder="ค้นหาชื่อสินค้า / SKU" />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {filteredProducts.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">ไม่พบสินค้าที่เพิ่มได้</p> : filteredProducts.map(product => (
                <div key={product.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-gray-800 truncate">{product.name}</span>
                    <span className="block text-xs text-gray-400 font-mono">{product.sku || '-'}</span>
                    <span className="block text-xs text-indigo-500 mt-0.5">{productCategoryLabel(product)}</span>
                  </span>
                  <button type="button" onClick={() => addProduct(product.id)} className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1">
                    <Plus size={14}/> เพิ่ม
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-indigo-100 bg-indigo-50/40 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-gray-800 text-sm">รายการที่เลือก</h4>
              {selectedProducts.length > 0 && <button type="button" onClick={() => setSelectedProductIds([])} className="text-xs text-red-500 hover:text-red-600 font-semibold">ล้างทั้งหมด</button>}
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {selectedProducts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">ยังไม่ได้เพิ่มสินค้า</p>
              ) : selectedProducts.map(product => (
                <div key={product.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{product.sku || '-'}</p>
                    <p className="text-xs text-indigo-500 mt-1">{productCategoryLabel(product)}</p>
                  </div>
                  <button type="button" onClick={() => removeProduct(product.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
                    <Trash2 size={15}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center"><h3 className="font-bold text-gray-800">ช่องทางติดต่อ</h3><button type="button" onClick={() => setForm({ ...form, contacts: [...form.contacts, { channel: 'Line', label: '', account_id: '', url: '', phone: '', note: '' }] })} className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl text-sm font-semibold"><Plus size={14} className="inline mr-1"/>เพิ่มช่องทาง</button></div>
        {form.contacts.map((c, idx) => <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2"><select value={c.channel} onChange={e => updateContact(idx, 'channel', e.target.value)} className={inputClass}>{CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}</select><input placeholder="ชื่อ/Label" value={c.label || ''} onChange={e => updateContact(idx, 'label', e.target.value)} className={inputClass}/><input placeholder="ID" value={c.account_id || ''} onChange={e => updateContact(idx, 'account_id', e.target.value)} className={inputClass}/><input placeholder="URL" value={c.url || ''} onChange={e => updateContact(idx, 'url', e.target.value)} className={inputClass}/><input placeholder="Phone" value={c.phone || ''} onChange={e => updateContact(idx, 'phone', e.target.value)} className={inputClass}/><div className="flex gap-1"><input placeholder="Note" value={c.note || ''} onChange={e => updateContact(idx, 'note', e.target.value)} className={inputClass}/><button type="button" onClick={() => setForm({ ...form, contacts: form.contacts.filter((_, i) => i !== idx) })} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button></div></div>)}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center">
          <div><h3 className="font-bold text-gray-800">ไฟล์ที่เกี่ยวข้อง</h3><p className="text-xs text-gray-400">วางลิงก์ Google Drive/เอกสาร แล้วระบุว่าเป็นไฟล์อะไร (เพิ่มได้ไม่จำกัด)</p></div>
          <button type="button" onClick={() => setForm({ ...form, files: [...(form.files || []), { label: '', url: '' }] })} className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl text-sm font-semibold shrink-0"><Plus size={14} className="inline mr-1"/>เพิ่มไฟล์</button>
        </div>
        {(form.files || []).length === 0 && <p className="text-sm text-gray-400">ยังไม่มีไฟล์</p>}
        {(form.files || []).map((f, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-2">
            <input placeholder="ไฟล์เกี่ยวกับอะไร (เช่น แคตตาล็อก, ใบเสนอราคา)" value={f.label || ''} onChange={e => updateFile(idx, 'label', e.target.value)} className={inputClass}/>
            <input placeholder="วาง URL (Google Drive ฯลฯ)" value={f.url || ''} onChange={e => updateFile(idx, 'url', e.target.value)} className={inputClass}/>
            <button type="button" onClick={() => setForm({ ...form, files: form.files.filter((_, i) => i !== idx) })} className="p-2 text-red-400 hover:bg-red-50 rounded-xl justify-self-start"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
    </form>
  );
};

// เติม scheme ให้ URL ที่ผู้ใช้กรอกแบบไม่มี http (เช่น "shopee.co.th/...")
const normalizeUrl = (u) => {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};
const domainOf = (u) => {
  try { return new URL(normalizeUrl(u)).hostname.replace(/^www\./, ''); }
  catch { return String(u || '').replace(/^https?:\/\//i, '').split('/')[0]; }
};

// คืน URL สำหรับ embed preview ถ้าเป็นลิงก์ Google Drive/Docs, ไม่งั้นคืน null
const drivePreviewUrl = (u) => {
  const url = normalizeUrl(u);
  if (!url) return null;
  let m = url.match(/https?:\/\/(?:drive|docs)\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  m = url.match(/https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (/drive\.google\.com/.test(url) && m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return null;
};

const SupplierFileCard = ({ f }) => {
  const [open, setOpen] = useState(false);
  const url = normalizeUrl(f.url);
  const domain = url ? domainOf(f.url) : null;
  const preview = drivePreviewUrl(f.url);
  if (!url) return null;
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <span className="relative w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          <Globe size={16} className="text-gray-300" />
          <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="absolute inset-0 w-full h-full object-contain p-1" onError={e => e.currentTarget.remove()} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 truncate">{f.label || domain || 'ไฟล์'}</p>
          <p className="text-xs text-gray-400 truncate">{f.url}</p>
        </div>
        {preview && (
          <button type="button" onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg shrink-0">{open ? 'ซ่อน' : 'พรีวิว'}</button>
        )}
        <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-indigo-600 shrink-0" title="เปิดไฟล์"><ExternalLink size={16} /></a>
      </div>
      {preview && open && (
        <div className="border-t border-gray-100 bg-gray-50">
          <iframe src={preview} title={f.label || 'preview'} className="w-full h-80" allow="autoplay" />
        </div>
      )}
    </div>
  );
};

const SupplierContactCard = ({ c }) => {
  const url = normalizeUrl(c.url);
  const domain = url ? domainOf(c.url) : null;
  const hasAny = c.account_id || c.phone || url || c.note;
  return (
    <div className="border border-gray-100 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{c.channel || 'Other'}</span>
        {c.label && <span className="text-sm font-semibold text-gray-700">{c.label}</span>}
      </div>
      {c.account_id && <p className="text-sm text-gray-600 break-all flex items-center gap-1.5"><AtSign size={13} className="text-gray-400 shrink-0" />{c.account_id}</p>}
      {c.phone && <a href={`tel:${c.phone}`} className="text-sm text-gray-600 hover:text-indigo-600 flex items-center gap-1.5"><Phone size={13} className="text-gray-400 shrink-0" />{c.phone}</a>}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition-colors">
          <span className="relative w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
            <Globe size={16} className="text-gray-300" />
            <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="absolute inset-0 w-full h-full object-contain p-1" onError={e => e.currentTarget.remove()} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-800 truncate group-hover:text-indigo-700">{domain}</span>
            <span className="block text-xs text-gray-400 truncate">{c.url}</span>
          </span>
          <ExternalLink size={15} className="text-gray-400 group-hover:text-indigo-600 shrink-0" />
        </a>
      )}
      {c.note && <p className="text-xs text-gray-400">{c.note}</p>}
      {!hasAny && <p className="text-sm text-gray-300">—</p>}
    </div>
  );
};

const SupplierDetail = ({ supplier, onBack, onEdit, canEdit, onNavigateToProduct }) => {
  const [productViewMode, setProductViewMode] = useState(() => getStoredViewMode('procurement_supplier_product_view_mode', 'grid'));
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const images = Array.isArray(supplier.images) ? supplier.images : [];
  const imageUrl = (img) => typeof img === 'string' ? img : img?.url;
  const products = supplier.products || [];
  useEffect(() => {
    setStoredViewMode('procurement_supplier_product_view_mode', productViewMode);
  }, [productViewMode]);

  const openProductModal = async (product) => {
    setLoadingProduct(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:category_id(id, name), product_categories(category_id, category:category_id(id, name)), product_variants(*), stock_items(quantity, min_quantity, location_id, variant_id), supplier_products(id, supplier:supplier_id(id, name, product_type))')
        .eq('id', product.id)
        .single();
      if (error) throw error;
      setSelectedProduct(data);
    } catch (err) {
      alert('โหลดรายละเอียดสินค้าไม่สำเร็จ: ' + err.message);
    } finally {
      setLoadingProduct(false);
    }
  };

  const productImage = (product) => {
    const first = Array.isArray(product.images) ? product.images[0] : null;
    return imageUrl(first);
  };

  const ProductViewToggle = ({ mode, icon: Icon, label }) => (
    <button
      type="button"
      onClick={() => setProductViewMode(mode)}
      className={`px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${productViewMode === mode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
    >
      <Icon size={15} /> {label}
    </button>
  );

  const ProductThumb = ({ product }) => {
    const img = productImage(product);
    if (img) return <img src={img} alt="" className="w-14 h-14 rounded-2xl object-cover bg-gray-100 border border-gray-100" />;
    return <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-300 flex items-center justify-center"><Package size={22}/></div>;
  };
  const showPrevImage = () => setLightboxIndex(idx => idx === null ? null : (idx - 1 + images.length) % images.length);
  const showNextImage = () => setLightboxIndex(idx => idx === null ? null : (idx + 1) % images.length);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20}/></button>
          <div>
            <h2 className="font-bold text-xl text-gray-900">{supplier.name}</h2>
            <p className="text-sm text-gray-500">{supplier.product_type || 'ไม่ระบุชนิดสินค้า'}</p>
          </div>
        </div>
        {canEdit && <button onClick={onEdit} className="px-3 py-2 bg-gray-100 rounded-xl text-sm font-semibold">แก้ไข</button>}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-5">
          <div>
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {images.slice(0, 4).map((img, idx) => (
                  <button type="button" key={idx} onClick={() => setLightboxIndex(idx)} className={`relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 text-left ${idx === 0 ? 'col-span-2 aspect-[16/10]' : 'aspect-square'}`}>
                    <img src={imageUrl(img)} alt="" className="w-full h-full object-cover" />
                    {idx === 3 && images.length > 4 && <span className="absolute inset-0 bg-black/45 text-white flex items-center justify-center font-bold">+{images.length - 4}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="aspect-[16/10] rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-300 flex flex-col items-center justify-center gap-2">
                <ImageIcon size={30}/>
                <span className="text-sm font-semibold">ยังไม่มีรูป Supplier</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800 mb-2">ข้อมูล Supplier</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{supplier.note || 'ไม่มีหมายเหตุ'}</p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {(supplier.contacts || []).length === 0 ? <p className="text-sm text-gray-400">ยังไม่มีช่องทางติดต่อ</p> : (supplier.contacts || []).map((c, i) => (
                <SupplierContactCard key={c.id || `${c.channel}-${i}`} c={c} />
              ))}
            </div>
            {(supplier.files || []).length > 0 && (
              <div className="mt-5">
                <h3 className="font-bold text-gray-800 mb-2">ไฟล์ที่เกี่ยวข้อง</h3>
                <div className="space-y-2">
                  {(supplier.files || []).map((f, i) => <SupplierFileCard key={i} f={f} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-800">สินค้าที่สั่งจาก Supplier นี้ ({products.length})</h3>
            <p className="text-xs text-gray-400 mt-1">กดสินค้าเพื่อเปิดรายละเอียดในหน้านี้</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-1 flex w-fit">
            <ProductViewToggle mode="grid" icon={LayoutGrid} label="การ์ด" />
            <ProductViewToggle mode="list" icon={List} label="ลิสต์" />
          </div>
        </div>

        {products.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center">ยังไม่ได้ผูกสินค้า</p> : productViewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {products.map(product => (
              <button key={product.id} type="button" onClick={() => openProductModal(product)} className="text-left border border-gray-100 hover:border-indigo-200 hover:shadow-sm rounded-2xl p-3 transition-all flex items-center gap-3">
                <ProductThumb product={product} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-gray-800 truncate">{product.name}</span>
                  <span className="block text-xs text-gray-400 font-mono truncate">{product.sku || '-'}</span>
                  <span className="mt-2 grid grid-cols-2 gap-2">
                    <span className="rounded-xl bg-amber-50 px-2 py-1">
                      <span className="block text-[10px] font-bold text-amber-500">ทุนล่าสุด</span>
                      <span className="block text-xs font-bold text-amber-700">{productCostText(product)}</span>
                    </span>
                    <span className="rounded-xl bg-emerald-50 px-2 py-1">
                      <span className="block text-[10px] font-bold text-emerald-500">สต๊อก</span>
                      <span className="block text-xs font-bold text-emerald-700">{productStockQty(product).toLocaleString()}</span>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {products.map(product => (
              <button key={product.id} type="button" onClick={() => openProductModal(product)} className="w-full text-left p-3 hover:bg-gray-50 transition-colors grid grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[56px_minmax(0,1fr)_120px_90px_auto] items-center gap-3">
                <ProductThumb product={product} />
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-800 truncate">{product.name}</span>
                  <span className="block text-xs text-gray-400 font-mono truncate">{product.sku || '-'}</span>
                </span>
                <span className="hidden md:block text-right">
                  <span className="block text-[10px] font-bold text-gray-400">ทุนล่าสุด</span>
                  <span className="block text-sm font-bold text-amber-700">{productCostText(product)}</span>
                </span>
                <span className="hidden md:block text-right">
                  <span className="block text-[10px] font-bold text-gray-400">สต๊อก</span>
                  <span className="block text-sm font-bold text-emerald-700">{productStockQty(product).toLocaleString()}</span>
                </span>
                <span className="text-xs text-indigo-600 font-bold px-2 py-1 bg-indigo-50 rounded-lg">ดูรายละเอียด</span>
                <span className="col-span-2 grid grid-cols-2 gap-2 md:hidden">
                  <span className="rounded-xl bg-amber-50 px-2 py-1">
                    <span className="block text-[10px] font-bold text-amber-500">ทุนล่าสุด</span>
                    <span className="block text-xs font-bold text-amber-700">{productCostText(product)}</span>
                  </span>
                  <span className="rounded-xl bg-emerald-50 px-2 py-1">
                    <span className="block text-[10px] font-bold text-emerald-500">สต๊อก</span>
                    <span className="block text-xs font-bold text-emerald-700">{productStockQty(product).toLocaleString()}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadingProduct && <div className="fixed inset-0 z-[9998] bg-black/20 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={32}/></div>}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <button type="button" onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"><X size={22}/></button>
          {images.length > 1 && <button type="button" onClick={showPrevImage} className="absolute left-4 md:left-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"><ChevronLeft size={28}/></button>}
          <div className="max-w-5xl w-full">
            <img src={imageUrl(images[lightboxIndex])} alt="" className="max-h-[78vh] w-full object-contain rounded-2xl" />
            <div className="mt-4 flex items-center justify-center gap-2">
              {images.map((img, idx) => (
                <button key={idx} type="button" onClick={() => setLightboxIndex(idx)} className={`w-14 h-14 rounded-xl overflow-hidden border ${idx === lightboxIndex ? 'border-white ring-2 ring-white/40' : 'border-white/20 opacity-60 hover:opacity-100'}`}>
                  <img src={imageUrl(img)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          {images.length > 1 && <button type="button" onClick={showNextImage} className="absolute right-4 md:right-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"><ChevronRight size={28}/></button>}
        </div>
      )}
      {selectedProduct && <SupplierProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onNavigateToProduct={onNavigateToProduct} />}
    </div>
  );
};

const SupplierProductModal = ({ product, onClose, onNavigateToProduct }) => {
  const images = Array.isArray(product.images) ? product.images : [];
  const imageUrl = (img) => typeof img === 'string' ? img : img?.url;
  const [selectedImage, setSelectedImage] = useState(() => imageUrl(images[0]));
  const categories = [
    ...(product.product_categories || []).map(pc => pc.category?.name).filter(Boolean),
    product.category?.name,
  ].filter(Boolean);
  const categoryText = [...new Set(categories)].join(', ') || 'ไม่มีหมวดหมู่';
  const variants = product.product_variants || [];
  const stockTotal = (product.stock_items || []).reduce((sum, item) => sum + num(item.quantity), 0);
  const supplierLinks = (product.supplier_products || []).map(link => link.supplier).filter(Boolean);

  useEffect(() => {
    setSelectedImage(imageUrl(images[0]));
  }, [product.id]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h3 className="font-bold text-xl text-gray-900 truncate">{product.name}</h3>
            <p className="text-xs text-gray-400 font-mono">{product.sku || '-'}</p>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToProduct && (
              <button type="button" onClick={() => onNavigateToProduct(product)} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2">
                <ExternalLink size={15}/> ไปหน้าสินค้าจริง
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400"><X size={20}/></button>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <div>
            {selectedImage ? (
              <img src={selectedImage} alt="" className="w-full aspect-square object-cover rounded-3xl border border-gray-100 bg-gray-100" />
            ) : (
              <div className="w-full aspect-square rounded-3xl border border-dashed border-gray-200 bg-gray-50 text-gray-300 flex flex-col items-center justify-center gap-2"><Package size={40}/><span className="text-sm font-semibold">ไม่มีรูปสินค้า</span></div>
            )}
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-2 mt-3">
                {images.slice(0, 10).map((img, idx) => {
                  const url = imageUrl(img);
                  return <button key={idx} type="button" onClick={() => setSelectedImage(url)} className={`aspect-square rounded-xl overflow-hidden border ${selectedImage === url ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-100'}`}><img src={url} alt="" className="w-full h-full object-cover" /></button>;
                })}
              </div>
            )}
          </div>
          <div className="space-y-5 min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoCard icon={Package} label="สต๊อกรวม" value={stockTotal.toLocaleString()} />
              <InfoCard icon={DollarSign} label="ราคาขาย" value={`฿${num(product.sell_price).toLocaleString()}`} />
              <InfoCard icon={DollarSign} label="ต้นทุน" value={costText(product.cost_price)} />
              <InfoCard icon={Building2} label="Supplier" value={supplierLinks.length.toLocaleString()} />
            </div>
            <div className="border border-gray-100 rounded-2xl p-4">
              <h4 className="font-bold text-gray-800 mb-2">ข้อมูลสินค้า</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <p><span className="text-gray-400">หมวดหมู่:</span> <span className="font-semibold text-gray-700">{categoryText}</span></p>
                <p><span className="text-gray-400">สถานะ:</span> <span className="font-semibold text-gray-700">{product.status || '-'}</span></p>
              </div>
              {product.description && <p className="text-sm text-gray-600 whitespace-pre-wrap mt-3">{product.description}</p>}
            </div>
            <div className="border border-gray-100 rounded-2xl p-4">
              <h4 className="font-bold text-gray-800 mb-3">Variants ({variants.length})</h4>
              {variants.length === 0 ? <p className="text-sm text-gray-400">ไม่มี variants</p> : (
                <div className="divide-y divide-gray-100">
                  {variants.map(variant => (
                    <div key={variant.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{variant.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{variant.sku || '-'}</p>
                      </div>
                      <p className="text-sm font-bold text-indigo-600">฿{num(variant.sell_price || product.sell_price).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border border-gray-100 rounded-2xl p-4">
              <h4 className="font-bold text-gray-800 mb-3">Supplier ที่เกี่ยวข้อง</h4>
              {supplierLinks.length === 0 ? <p className="text-sm text-gray-400">ยังไม่มี Supplier ที่ผูกไว้</p> : (
                <div className="flex flex-wrap gap-2">
                  {supplierLinks.map(supplier => <span key={supplier.id} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-semibold">{supplier.name}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PriceHistory = ({ rows, showCost }) => {
  if (!showCost) return <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center text-gray-400">ไม่มีสิทธิ์ดูประวัติราคา</div>;
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500"><tr><th className="text-left p-3">สินค้า</th><th className="text-right p-3">ทุนเดิม</th><th className="text-right p-3">ทุนใหม่</th><th className="text-right p-3">ขายเดิม</th><th className="text-right p-3">ขายใหม่</th><th className="text-left p-3">ที่มา</th><th className="text-left p-3">เวลา</th></tr></thead>
        <tbody className="divide-y divide-gray-50">{rows.map(r => <tr key={r.id}><td className="p-3 font-semibold text-gray-800">{r.product?.name}{r.variant?.name ? ` · ${r.variant.name}` : ''}</td><td className="p-3 text-right text-amber-700">{costText(r.old_cost_price)}</td><td className="p-3 text-right text-amber-700 font-bold">{costText(r.new_cost_price)}</td><td className="p-3 text-right text-indigo-600">฿{num(r.old_sell_price).toLocaleString()}</td><td className="p-3 text-right text-indigo-700 font-bold">฿{num(r.new_sell_price).toLocaleString()}</td><td className="p-3 text-gray-500">{r.source_type}</td><td className="p-3 text-gray-400">{new Date(r.created_at).toLocaleString('th-TH')}</td></tr>)}</tbody>
      </table>
    </div>
  );
};

const SummaryPanel = ({ icon: Icon, title, subtitle, children }) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Icon size={18}/></div>
      <div className="min-w-0">
        <h3 className="font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

const SummaryLine = ({ label, value, sub = null, emphasis = false }) => (
  <div className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 ${emphasis ? 'bg-indigo-50' : 'bg-gray-50'}`}>
    <span className="text-xs font-bold text-gray-500">{label}</span>
    <div className="text-right">
      <span className={`text-sm font-bold ${emphasis ? 'text-indigo-700' : 'text-gray-900'}`}>{value}</span>
      {sub && <span className="block text-[11px] font-semibold text-indigo-500 mt-0.5">{sub}</span>}
    </div>
  </div>
);

const InfoCard = ({ icon: Icon, label, value }) => <div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="flex items-center gap-2 text-gray-400 text-xs font-bold mb-2"><Icon size={14}/>{label}</div><p className="font-bold text-gray-900">{value}</p></div>;
const FormHeader = ({ title, onBack, saving }) => <div className="flex justify-between items-center bg-white rounded-2xl border border-gray-100 p-4 sticky top-2 z-10"><div className="flex items-center gap-3"><button type="button" onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20}/></button><h2 className="font-bold text-xl text-gray-900">{title}</h2></div><button type="submit" disabled={saving} className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2">{saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} บันทึก</button></div>;
const Field = ({ label, children }) => <label className="block"><span className={labelClass}>{label}</span>{children}</label>;
const InlineField = ({ label, children, className = '' }) => <label className={`block min-w-0 ${className}`}><span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 ml-1">{label}</span>{children}</label>;
const inputClass = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 rounded-xl outline-none text-sm text-gray-700';
const labelClass = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1';

export default ProcurementMain;
