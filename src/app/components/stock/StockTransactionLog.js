'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { PackageCheck, PackageMinus, Sliders, Calendar, User, Warehouse, Search, RefreshCw, ChevronDown, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

const TX_TYPE_CONFIG = {
  stock_in:     { label: 'รับเข้า',    color: 'bg-green-100 text-green-700', icon: PackageCheck },
  stock_out:    { label: 'เบิกออก',    color: 'bg-red-100 text-red-700',    icon: PackageMinus },
  adjustment:   { label: 'ปรับสต๊อก',  color: 'bg-blue-100 text-blue-700',  icon: Sliders },
};

const REF_TYPE_LABEL = { order: 'ออเดอร์', service: 'งานบริการ', manual: 'บันทึกเอง' };

const StockTransactionLog = () => {
  const { can } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 30;

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stores, setStores] = useState([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    supabase.from('stores').select('id, name').order('name').then(({ data }) => setStores(data || []));
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('stock_transactions')
      .select(`
        *,
        product:product_id(name, sku),
        variant:variant_id(name),
        store:store_id(name),
        creator:created_by(first_name, last_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterType) query = query.eq('transaction_type', filterType);
    if (filterStore) query = query.eq('store_id', filterStore);
    if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

    const { data, count } = await query;
    let rows = data || [];

    // Client-side product search (after fetching)
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(tx =>
        (tx.product?.name || '').toLowerCase().includes(s) ||
        (tx.product?.sku || '').toLowerCase().includes(s)
      );
    }

    setTransactions(rows);
    setTotal(count || 0);
    setLoading(false);
  }, [filterType, filterStore, dateFrom, dateTo, page, search]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const applyFilters = () => { setPage(0); fetchTransactions(); };

  const deleteTransaction = async (id) => {
    if (!confirm('ยืนยันลบรายการนี้?')) return;
    await supabase.from('stock_transactions').delete().eq('id', id);
    fetchTransactions();
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-teal-500"
              placeholder="ค้นหาสินค้า..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <select className="w-full py-2 px-3 text-sm bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-teal-500 appearance-none pr-8"
              value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}>
              <option value="">ทุกประเภท</option>
              <option value="stock_in">รับเข้า</option>
              <option value="stock_out">เบิกออก</option>
              <option value="adjustment">ปรับสต๊อก</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="w-full py-2 px-3 text-sm bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-teal-500 appearance-none pr-8"
              value={filterStore} onChange={e => { setFilterStore(e.target.value); setPage(0); }}>
              <option value="">ทุกคลัง</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="col-span-2 md:col-span-1 flex gap-2 items-center">
            <input type="date" className="flex-1 py-2 px-3 text-sm bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-teal-500" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} title="วันเริ่มต้น" />
            <span className="text-gray-400 text-xs">—</span>
            <input type="date" className="flex-1 py-2 px-3 text-sm bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-teal-500" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} title="วันสิ้นสุด" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">พบทั้งหมด {total} รายการ</span>
          <button onClick={fetchTransactions} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-600 font-medium transition-colors">
            <RefreshCw size={13} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400">กำลังโหลด...</div>
        ) : transactions.length === 0 ? (
          <div className="py-20 text-center text-gray-400">ไม่พบรายการ</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map(tx => {
              const cfg = TX_TYPE_CONFIG[tx.transaction_type] || {};
              const Icon = cfg.icon || PackageCheck;
              const productName = tx.product?.name || '—';
              const variantName = tx.variant?.name;
              const storeName = tx.store?.name;
              const creator = tx.creator ? `${tx.creator.first_name} ${tx.creator.last_name}` : '—';
              const refLabel = tx.reference_type ? REF_TYPE_LABEL[tx.reference_type] : null;

              return (
                <div key={tx.id} className="flex items-start gap-3 p-4 hover:bg-gray-50/50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{productName}</span>
                      {variantName && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{variantName}</span>}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      <span className={`text-sm font-bold ${tx.transaction_type === 'stock_in' ? 'text-green-700' : tx.transaction_type === 'stock_out' ? 'text-red-600' : 'text-blue-700'}`}>
                        {tx.transaction_type === 'stock_in' ? '+' : tx.transaction_type === 'stock_out' ? '−' : '±'}{tx.quantity}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar size={11} />{new Date(tx.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} {new Date(tx.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><User size={11} />{creator}</span>
                      {storeName && <span className="flex items-center gap-1"><Warehouse size={11} />{storeName}</span>}
                      {refLabel && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{refLabel}</span>}
                      {tx.note && <span className="text-gray-500 italic">"{tx.note}"</span>}
                    </div>
                  </div>
                  {can('stock', 'delete') && (
                    <div className="shrink-0">
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบรายการ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors">ก่อนหน้า</button>
          <span className="text-sm text-gray-500">หน้า {page + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
          <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors">ถัดไป</button>
        </div>
      )}
    </div>
  );
};

export default StockTransactionLog;
