'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Warehouse, ChevronRight, ArrowLeft, AlertTriangle,
  PackageCheck, PackageMinus, RefreshCw, Plus, LayoutGrid, List, MapPin, Layers, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import StockList from './StockList';
import StockProductDetailModal from './StockProductDetailModal';
import { allocateFifoStockOut, createStockLot } from '@/lib/stockLots';

const UNASSIGNED = '__UNASSIGNED__';

const StockByWarehouse = ({ onStockIn, onStockOut, onAdjust, onNewTx }) => {
  const { can, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [productMode, setProductMode] = useState(false);
  const [lotMode, setLotMode] = useState(false);
  const [selected, setSelected] = useState(null); // store object | UNASSIGNED | null
  const [search, setSearch] = useState('');
  const [popupProduct, setPopupProduct] = useState(null);
  const [assign, setAssign] = useState(null); // decorated stock_item ที่จะจัดเข้าชั้น

  const [stores, setStores] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]); // stock_items rows
  const [productById, setProductById] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, stockRes, locRes, storeRes] = await Promise.all([
      supabase.from('products').select('id, name, sku, has_variants, images, product_variants(id, name, sku)').order('name'),
      supabase.from('stock_items').select('id, product_id, variant_id, location_id, quantity, min_quantity'),
      supabase.from('storage_locations').select('id, code, name, store_id').order('code'),
      supabase.from('stores').select('id, name, location_detail, color').order('name'),
    ]);
    const pmap = {};
    (prodRes.data || []).forEach(p => { pmap[p.id] = p; });
    setProductById(pmap);
    setItems(stockRes.data || []);
    setLocations(locRes.data || []);
    setStores(storeRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const locById = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);
  const variantOf = useCallback((it) => {
    const p = productById[it.product_id];
    if (!p || !it.variant_id) return null;
    return (p.product_variants || []).find(v => v.id === it.variant_id) || null;
  }, [productById]);

  // เติมข้อมูลแสดงผลให้ stock_item แต่ละแถว
  const decorate = useCallback((it) => {
    const p = productById[it.product_id] || null;
    const v = variantOf(it);
    const loc = it.location_id ? locById[it.location_id] : null;
    return { ...it, product: p, variant: v, loc, name: p?.name || 'สินค้า', sku: p?.sku || '' };
  }, [productById, variantOf, locById]);

  // สถิติต่อคลัง
  const storeStats = useMemo(() => {
    const map = {};
    stores.forEach(s => { map[s.id] = { qty: 0, skus: 0, shelves: new Set() }; });
    let unQty = 0, unSkus = 0;
    items.forEach(it => {
      const q = it.quantity || 0;
      if (it.location_id) {
        const loc = locById[it.location_id];
        if (!loc) return;
        const st = map[loc.store_id];
        if (!st) return;
        st.qty += q;
        if (q > 0) { st.skus += 1; st.shelves.add(loc.id); }
      } else if (q > 0) {
        unQty += q; unSkus += 1;
      }
    });
    return { byStore: map, unassigned: { qty: unQty, skus: unSkus } };
  }, [stores, items, locById]);

  const openDetail = (it) => { const p = productById[it.product_id]; if (p) setPopupProduct(p); };

  // ===== Lot mode (มุมมองล็อต) =====
  if (lotMode) {
    return (
      <div className="space-y-3">
        <button onClick={() => setLotMode(false)} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-2 rounded-xl">
          <LayoutGrid size={15} /> กลับไปมุมมองคลัง
        </button>
        <LotView />
      </div>
    );
  }

  // ===== Product mode (ลิสต์รายสินค้าข้ามคลัง — ของเดิม) =====
  if (productMode) {
    return (
      <div className="space-y-3">
        <button onClick={() => setProductMode(false)} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-2 rounded-xl">
          <LayoutGrid size={15} /> กลับไปมุมมองคลัง
        </button>
        <StockList onStockIn={onStockIn} onStockOut={onStockOut} onAdjust={onAdjust} onNewTx={onNewTx} />
      </div>
    );
  }

  // ===== รายการสินค้าในแถว (ใช้ทั้งใน store detail / unassigned) =====
  const ItemRow = ({ it, onAssign }) => {
    const d = decorate(it);
    const low = (it.min_quantity || 0) > 0 && (it.quantity || 0) <= (it.min_quantity || 0);
    return (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-teal-50/40 transition-colors cursor-pointer" onClick={() => openDetail(it)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 truncate">{d.name}</span>
            {d.variant && <span className="text-xs text-gray-500 truncate">· {d.variant.name}</span>}
            {low && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{d.sku}{d.loc ? ` · ${d.loc.code}` : ''}</p>
        </div>
        <span className={`font-bold text-base px-3 py-1 rounded-xl shrink-0 ${low ? 'bg-red-100 text-red-700' : 'bg-teal-50 text-teal-700'}`}>{it.quantity ?? 0}</span>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {onAssign && (
            <button onClick={() => onAssign(d)} title="จัดเข้าชั้น" className="px-2.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center gap-1"><Layers size={14} /> จัดเข้าชั้น</button>
          )}
          {can('stock', 'stock_in') && (
            <button onClick={() => onStockIn(d.product, d.variant)} title="รับเข้า" className="p-2 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"><PackageCheck size={15} /></button>
          )}
          {can('stock', 'stock_out') && (it.quantity || 0) > 0 && (
            <button onClick={() => onStockOut(d.product, d.variant)} title="เบิกออก" className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"><PackageMinus size={15} /></button>
          )}
        </div>
      </div>
    );
  };

  // ===== Detail: ไม่ระบุคลัง =====
  if (selected === UNASSIGNED) {
    const list = items.filter(it => !it.location_id && (it.quantity || 0) > 0)
      .map(decorate)
      .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.sku || '').toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="space-y-4">
        <DetailHeader title="ของที่ยังไม่ระบุคลัง" subtitle={`${list.length} รายการ — รับมาแล้วแต่ยังไม่จัดที่เก็บ`} onBack={() => { setSelected(null); setSearch(''); }} search={search} setSearch={setSearch} onRefresh={fetchData} amber />
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {list.length === 0 ? <p className="py-16 text-center text-gray-400">ไม่มีของค้างแบบไม่ระบุคลัง 🎉</p> : list.map(it => <ItemRow key={it.id} it={it} onAssign={setAssign} />)}
        </div>
        <p className="text-xs text-gray-400 px-1">กด “จัดเข้าชั้น” เพื่อย้ายของเข้าชั้นวางในคลัง หรือกดที่รายการเพื่อดูรายละเอียด</p>
        {assign && <AssignShelfModal item={assign} locations={locations} stores={stores} profile={profile} onClose={() => setAssign(null)} onDone={() => { setAssign(null); fetchData(); }} />}
        {popupProduct && <DetailModalWrap product={popupProduct} onClose={() => { setPopupProduct(null); fetchData(); }} can={can} onStockIn={onStockIn} onStockOut={onStockOut} onAdjust={onAdjust} setPopupProduct={setPopupProduct} />}
      </div>
    );
  }

  // ===== Detail: คลังหนึ่งคลัง =====
  if (selected && selected !== UNASSIGNED) {
    const store = selected;
    const shelves = locations.filter(l => l.store_id === store.id);
    const itemsInStore = items.filter(it => it.location_id && locById[it.location_id]?.store_id === store.id && (it.quantity || 0) !== 0);
    const matchSearch = (d) => !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.sku || '').toLowerCase().includes(search.toLowerCase());
    return (
      <div className="space-y-4">
        <DetailHeader title={store.name} subtitle={store.location_detail || 'คลังสินค้า'} onBack={() => { setSelected(null); setSearch(''); }} search={search} setSearch={setSearch} onRefresh={fetchData} />
        {shelves.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center text-gray-400">คลังนี้ยังไม่มีชั้นวาง — เพิ่มได้ที่แท็บ “จัดการคลัง”</div>
        ) : shelves.map(shelf => {
          const shelfItems = itemsInStore.filter(it => it.location_id === shelf.id).map(decorate).filter(matchSearch);
          return (
            <div key={shelf.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50/70 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center"><Layers size={16} /></span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 text-sm truncate">{shelf.code}</p>
                    {shelf.name && <p className="text-[11px] text-gray-400 truncate">{shelf.name}</p>}
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-500 bg-white border border-gray-100 px-2 py-1 rounded-lg shrink-0">{shelfItems.length} รายการ</span>
              </div>
              <div className="divide-y divide-gray-50">
                {shelfItems.length === 0 ? <p className="py-6 text-center text-xs text-gray-300">ชั้นนี้ว่าง</p> : shelfItems.map(it => <ItemRow key={it.id} it={it} />)}
              </div>
            </div>
          );
        })}
        {popupProduct && <DetailModalWrap product={popupProduct} onClose={() => { setPopupProduct(null); fetchData(); }} can={can} onStockIn={onStockIn} onStockOut={onStockOut} onAdjust={onAdjust} setPopupProduct={setPopupProduct} />}
      </div>
    );
  }

  // ===== Grid: เลือกคลัง =====
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2">
          <button onClick={() => setProductMode(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2.5 rounded-xl">
            <List size={15} /> มุมมองรายสินค้า
          </button>
          <button onClick={() => setLotMode(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2.5 rounded-xl">
            <Layers size={15} /> มุมมองล็อต
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-500" title="รีเฟรช"><RefreshCw size={16} /></button>
          {can('stock', 'create') && (
            <button onClick={onNewTx} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm"><Plus size={16} /> บันทึกสต๊อก</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-100 py-20 text-center text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stores.map(store => {
            const st = storeStats.byStore[store.id] || { qty: 0, skus: 0, shelves: new Set() };
            const color = store.color;
            return (
              <button key={store.id} onClick={() => setSelected(store)} style={color ? { borderLeftWidth: 4, borderLeftColor: color } : undefined} className="group text-left bg-white border border-gray-100 hover:border-teal-300 hover:shadow-md rounded-2xl p-5 transition-all">
                <div className="flex items-start justify-between">
                  <span className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center" style={color ? { backgroundColor: color + '22', color } : undefined}><Warehouse size={22} /></span>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-teal-500 mt-2" />
                </div>
                <p className="font-bold text-gray-900 mt-3 group-hover:text-teal-700">{store.name}</p>
                {store.location_detail && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate"><MapPin size={11} />{store.location_detail}</p>}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-sm">
                  <span><b className="text-gray-900">{st.qty}</b> <span className="text-gray-400 text-xs">ชิ้น</span></span>
                  <span><b className="text-gray-900">{st.skus}</b> <span className="text-gray-400 text-xs">SKU</span></span>
                  <span><b className="text-gray-900">{st.shelves.size}</b> <span className="text-gray-400 text-xs">ชั้น</span></span>
                </div>
              </button>
            );
          })}

          {/* การ์ดไม่ระบุคลัง */}
          {storeStats.unassigned.skus > 0 && (
            <button onClick={() => setSelected(UNASSIGNED)} className="group text-left bg-amber-50/60 border border-amber-200 hover:border-amber-400 hover:shadow-md rounded-2xl p-5 transition-all">
              <div className="flex items-start justify-between">
                <span className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center"><AlertTriangle size={22} /></span>
                <ChevronRight size={18} className="text-amber-300 group-hover:text-amber-500 mt-2" />
              </div>
              <p className="font-bold text-amber-900 mt-3">ไม่ระบุคลัง</p>
              <p className="text-xs text-amber-600 mt-0.5">รับมาแล้วยังไม่จัดที่เก็บ</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-amber-100 text-sm">
                <span><b className="text-amber-900">{storeStats.unassigned.qty}</b> <span className="text-amber-500 text-xs">ชิ้น</span></span>
                <span><b className="text-amber-900">{storeStats.unassigned.skus}</b> <span className="text-amber-500 text-xs">SKU</span></span>
              </div>
            </button>
          )}

          {stores.length === 0 && (
            <div className="col-span-full bg-white rounded-3xl border border-gray-100 py-16 text-center text-gray-400">
              ยังไม่มีคลัง — เพิ่มได้ที่แท็บ “จัดการคลัง”
            </div>
          )}
        </div>
      )}

      {popupProduct && <DetailModalWrap product={popupProduct} onClose={() => { setPopupProduct(null); fetchData(); }} can={can} onStockIn={onStockIn} onStockOut={onStockOut} onAdjust={onAdjust} setPopupProduct={setPopupProduct} />}
    </div>
  );
};

const DetailHeader = ({ title, subtitle, onBack, search, setSearch, onRefresh, amber }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
    <div className="flex items-center gap-3 min-w-0">
      <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 shrink-0"><ArrowLeft size={20} /></button>
      <div className="min-w-0">
        <h2 className={`font-bold text-xl truncate ${amber ? 'text-amber-900' : 'text-gray-900'}`}>{title}</h2>
        <p className="text-sm text-gray-400 truncate">{subtitle}</p>
      </div>
    </div>
    <div className="flex gap-2">
      <div className="relative flex-1 sm:w-64">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาในนี้..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500" />
      </div>
      <button onClick={onRefresh} className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-500" title="รีเฟรช"><RefreshCw size={16} /></button>
    </div>
  </div>
);

const DetailModalWrap = ({ product, onClose, can, onStockIn, onStockOut, onAdjust, setPopupProduct }) => (
  <StockProductDetailModal
    product={product}
    onClose={onClose}
    onStockIn={can('stock', 'stock_in') ? () => { setPopupProduct(null); onStockIn(product, null); } : null}
    onStockOut={can('stock', 'stock_out') ? () => { setPopupProduct(null); onStockOut(product, null); } : null}
    onAdjust={can('stock', 'create') ? () => { setPopupProduct(null); onAdjust(product, null); } : null}
  />
);

const LOT_SOURCE_LABEL = { opening_balance: 'ยอดยกมา', purchase_order: 'ใบสั่งซื้อ', manual: 'บันทึกมือ', return: 'คืนวัสดุ' };

const LotView = () => {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('stock_lots')
        .select('id, lot_code, source_type, original_quantity, remaining_quantity, landed_unit_cost_thb, received_at, product:product_id(name, sku), variant:variant_id(name), location:location_id(code, name, store:store_id(name)), purchase_order:purchase_order_id(order_number)')
        .gt('remaining_quantity', 0)
        .order('received_at', { ascending: false })
        .limit(500);
      setLots(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = lots.filter(l => {
    const hay = `${l.product?.name || ''} ${l.product?.sku || ''} ${l.lot_code || ''} ${l.purchase_order?.order_number || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });
  const sourceLabel = (l) => l.purchase_order?.order_number ? `PO ${l.purchase_order.order_number}` : (LOT_SOURCE_LABEL[l.source_type] || l.source_type);

  return (
    <div className="space-y-3">
      <div className="relative sm:max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ล็อต / สินค้า / PO" className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500" />
      </div>
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? <div className="py-16 text-center text-gray-400">กำลังโหลด...</div> : filtered.length === 0 ? <div className="py-16 text-center text-gray-400">ไม่มีล็อตที่ยังเหลือ</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">ล็อต</th>
                  <th className="py-3 px-4">สินค้า</th>
                  <th className="py-3 px-4 hidden md:table-cell">แหล่ง</th>
                  <th className="py-3 px-4 hidden lg:table-cell">คลัง / ชั้น</th>
                  <th className="py-3 px-4 text-center">คงเหลือ</th>
                  <th className="py-3 px-4 text-right hidden sm:table-cell">ต้นทุน/ชิ้น</th>
                  <th className="py-3 px-4 hidden xl:table-cell">รับเข้า</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-teal-50/30">
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{l.lot_code}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-800">{l.product?.name || '—'}</span>
                      {l.variant?.name && <span className="text-xs text-gray-500"> · {l.variant.name}</span>}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-gray-600">{sourceLabel(l)}</td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {l.location ? <span className="text-gray-600">{l.location.store?.name ? `${l.location.store.name} · ` : ''}{l.location.code}</span> : <span className="text-amber-600 font-semibold">ไม่ระบุคลัง</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-teal-700">{l.remaining_quantity}</span>
                      <span className="text-gray-300 text-xs"> / {l.original_quantity}</span>
                    </td>
                    <td className="py-3 px-4 text-right hidden sm:table-cell text-gray-700">฿{Number(l.landed_unit_cost_thb || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 hidden xl:table-cell text-xs text-gray-400">{l.received_at ? new Date(l.received_at).toLocaleDateString('th-TH') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const AssignShelfModal = ({ item, locations, stores, profile, onClose, onDone }) => {
  const available = item.quantity || 0;
  const [destLoc, setDestLoc] = useState('');
  const [qty, setQty] = useState(available);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const storeName = Object.fromEntries((stores || []).map(s => [s.id, s.name]));
    const map = {};
    (locations || []).forEach(l => {
      const store = storeName[l.store_id] || 'คลัง';
      (map[store] = map[store] || []).push(l);
    });
    return map;
  }, [locations, stores]);

  const submit = async () => {
    const n = Math.max(1, Math.min(available, Math.trunc(Number(qty) || 0)));
    if (!destLoc) return alert('กรุณาเลือกชั้นปลายทาง');
    if (n <= 0) return alert('จำนวนไม่ถูกต้อง');
    setBusy(true);
    try {
      const destStoreId = (locations.find(l => l.id === destLoc) || {}).store_id || null;
      const note = `จัดเข้าชั้น (จากของไม่ระบุคลัง)`;
      const base = { product_id: item.product_id, variant_id: item.variant_id || null, quantity: n, note, reference_type: 'manual', created_by: profile?.id };
      const { data: txRows, error } = await supabase.from('stock_transactions').insert([
        { ...base, transaction_type: 'stock_out', location_id: null, store_id: null },
        { ...base, transaction_type: 'stock_in', location_id: destLoc, store_id: destStoreId },
      ]).select('id, transaction_type');
      if (error) throw error;
      const outTx = (txRows || []).find(t => t.transaction_type === 'stock_out');
      const inTx = (txRows || []).find(t => t.transaction_type === 'stock_in');
      // ตัดจากล็อต "ไม่ระบุคลัง" (locationId: null = scoped null) — summary ลดที่ฝั่ง null
      const res = await allocateFifoStockOut({
        productId: item.product_id, variantId: item.variant_id || null, locationId: null,
        quantity: n, referenceType: 'manual', stockTransactionId: outTx?.id, profileId: profile?.id, syncSummary: true,
      });
      if (outTx?.id) await supabase.from('stock_transactions').update({ unit_cost_thb: res.weightedUnitCost, total_cost_thb: res.totalCost }).eq('id', outTx.id);
      // สร้างล็อตใหม่ที่ชั้นปลายทาง คงต้นทุนต่อล็อต — summary เพิ่มที่ฝั่งปลายทาง
      const allocs = (res.allocations && res.allocations.length) ? res.allocations : [{ quantity: n, unit_cost_thb: res.weightedUnitCost }];
      for (const a of allocs) {
        await createStockLot({
          productId: item.product_id, variantId: item.variant_id || null, locationId: destLoc,
          quantity: a.quantity, unitCostThb: a.unit_cost_thb, sourceType: 'manual', note, profileId: profile?.id, syncSummary: true,
        });
      }
      if (inTx?.id) await supabase.from('stock_transactions').update({ unit_cost_thb: res.weightedUnitCost, total_cost_thb: res.totalCost }).eq('id', inTx.id);
      onDone();
    } catch (err) {
      alert('จัดเข้าชั้นไม่สำเร็จ: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <h3 className="font-bold text-xl text-gray-900">จัดเข้าชั้น</h3>
            <p className="text-sm text-gray-500 truncate">{item.name}{item.variant ? ` · ${item.variant.name}` : ''} · ไม่ระบุคลัง {available} ชิ้น</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">ชั้นปลายทาง</label>
          <select value={destLoc} onChange={e => setDestLoc(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500">
            <option value="">เลือกชั้นวาง</option>
            {Object.entries(grouped).map(([store, locs]) => (
              <optgroup key={store} label={store}>
                {locs.map(l => <option key={l.id} value={l.id}>{l.code}{l.name ? ` · ${l.name}` : ''}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">จำนวน (สูงสุด {available})</label>
          <input type="number" min={1} max={available} value={qty} onChange={e => setQty(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500" />
        </div>
        {locations.length === 0 && <p className="text-xs text-amber-600">ยังไม่มีชั้นวางในระบบ — เพิ่มได้ที่แท็บ “จัดการคลัง”</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold disabled:opacity-50">ยกเลิก</button>
          <button type="button" onClick={submit} disabled={busy || !destLoc} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">{busy ? 'กำลังจัด...' : 'ยืนยันจัดเข้าชั้น'}</button>
        </div>
      </div>
    </div>
  );
};

export default StockByWarehouse;
