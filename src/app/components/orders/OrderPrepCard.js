import React from 'react';
import { Package, Clock, Building2, ShoppingCart, HelpCircle, ArrowRight, ListChecks } from 'lucide-react';

const STATUS_LABEL = {
  Quotation: 'เสนอราคา',
  Deposit: 'มัดจำ',
  Paid: 'ชำระแล้ว',
  Assembling: 'ส่งประกอบ',
  Shipping: 'เตรียมส่ง',
  Completed: 'เรียบร้อย',
  Cancelled: 'ยกเลิก',
};

const getStatusColor = (s) => {
  switch (s) {
    case 'Quotation': return 'bg-gray-100 text-gray-600';
    case 'Deposit': return 'bg-amber-100 text-amber-700';
    case 'Paid': return 'bg-indigo-100 text-indigo-700';
    case 'Assembling': return 'bg-blue-100 text-blue-700';
    case 'Shipping': return 'bg-purple-100 text-purple-700';
    case 'Completed': return 'bg-emerald-100 text-emerald-700';
    case 'Cancelled': return 'bg-red-100 text-red-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const OrderPrepCard = ({ order, onClick }) => {
  const prep = order._prep || { total: 0, done: 0, progress: 0, pending: [], source: { stock: 0, buy: 0, none: 0 } };
  const done = prep.progress === 100;

  // อายุออเดอร์ (จำนวนวันรอ)
  const start = new Date(order.order_date);
  const now = new Date();
  start.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0);
  const totalDays = Math.max(0, Math.floor((now - start) / 86400000));
  const ageColor = totalDays <= 30 ? 'text-green-600' : totalDays <= 60 ? 'text-blue-600' : totalDays <= 90 ? 'text-orange-600' : 'text-red-600';

  // รุ่นสกู๊ตเตอร์ / สินค้า
  const mainItem = order.order_items?.[0];
  const moreItems = (order.order_items?.length || 0) - 1;

  const cust = order.customer_cache;
  const custName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : 'ไม่ระบุลูกค้า';
  const nickname = cust?.nickname;

  const assignees = order.order_assignees || [];
  const items = prep.items || [];

  // จัดกลุ่มเป็น 3 แถบ: ยังไม่ได้เตรียม → กำลังทำ → เตรียมแล้ว
  const groups = [
    {
      key: 'pending', label: 'ยังไม่ได้เตรียม',
      list: items.filter(i => i.status === 'pending'),
      dot: 'bg-gray-300', headChip: 'bg-gray-100 text-gray-500', text: 'text-gray-700',
    },
    {
      key: 'in_progress', label: 'กำลังทำ',
      list: items.filter(i => i.status === 'in_progress'),
      dot: 'bg-amber-400', headChip: 'bg-amber-100 text-amber-700', text: 'text-gray-800',
    },
    {
      key: 'done', label: 'เตรียมแล้ว',
      list: items.filter(i => i.status === 'done'),
      dot: 'bg-emerald-500', headChip: 'bg-emerald-100 text-emerald-700', text: 'text-gray-400 line-through',
    },
  ];

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col p-5"
    >
      {/* Header: เลขออเดอร์ + สถานะ + อายุ */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800 text-sm group-hover:text-indigo-600 transition-colors">{order.order_number}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getStatusColor(order.status)}`}>
              {STATUS_LABEL[order.status] || order.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 truncate">
            {custName}{nickname ? ` (${nickname})` : ''}
          </p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-600 truncate">
            <Package size={12} className="text-indigo-400 shrink-0" />
            <span className="truncate">{mainItem?.product_name || '—'}{mainItem?.variant_name ? ` · ${mainItem.variant_name}` : ''}</span>
            {moreItems > 0 && <span className="text-[10px] bg-gray-100 px-1 rounded shrink-0">+{moreItems}</span>}
          </div>
        </div>
        <span className={`text-[11px] whitespace-nowrap flex items-center gap-1 font-semibold ${ageColor}`}>
          <Clock size={11} /> {totalDays} วัน
        </span>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">เตรียมแล้ว</span>
          <span className={`font-bold ${done ? 'text-emerald-600' : 'text-indigo-600'}`}>{prep.done} / {prep.total} ชิ้น · {prep.progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${prep.progress}%` }} />
        </div>
      </div>

      {/* แยกตามแหล่งของ */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {prep.source?.stock > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 flex items-center gap-1 font-medium">
            <Building2 size={11} /> สต๊อก {prep.source.stock}
          </span>
        )}
        {prep.source?.buy > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 flex items-center gap-1 font-medium">
            <ShoppingCart size={11} /> สั่งซื้อเพิ่ม {prep.source.buy}
          </span>
        )}
        {prep.source?.none > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-50 text-gray-500 flex items-center gap-1 font-medium">
            <HelpCircle size={11} /> ยังไม่ระบุ {prep.source.none}
          </span>
        )}
      </div>

      {/* รายชิ้นทั้งหมด แยก 3 แถบ */}
      <div className="mt-3 border-t border-gray-50 pt-3 flex-1 space-y-2.5">
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <ListChecks size={13} /> ยังไม่มีรายการจัดเตรียม
          </p>
        ) : (
          groups.map(g => g.list.length > 0 && (
            <div key={g.key}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                <span className="text-[11px] font-semibold text-gray-500">{g.label}</span>
                <span className={`text-[10px] px-1.5 rounded-full font-bold ${g.headChip}`}>{g.list.length}</span>
              </div>
              <div className="flex flex-col gap-0.5 pl-3.5">
                {g.list.map((it, i) => (
                  <span key={i} className={`text-xs truncate ${g.text}`}>{it.title}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ผู้รับผิดชอบ + เข้าจัดเตรียม */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {assignees.length > 0 ? (
            <>
              <div className="flex -space-x-2">
                {assignees.slice(0, 3).map((a, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-indigo-50 border border-white flex items-center justify-center overflow-hidden shrink-0" title={`${a.user?.first_name || ''} ${a.user?.last_name || ''}`}>
                    {a.user?.avatar_url
                      ? <img src={a.user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[10px] font-bold text-indigo-400">{a.user?.first_name?.[0] || '?'}</span>}
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-gray-500 truncate">
                {assignees[0]?.user?.first_name}{assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-gray-400">ยังไม่มีผู้รับผิดชอบ</span>
          )}
        </div>
        <span className="text-xs text-indigo-600 font-semibold flex items-center gap-1 shrink-0">
          เข้าจัดเตรียม <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </div>
  );
};

export default OrderPrepCard;
