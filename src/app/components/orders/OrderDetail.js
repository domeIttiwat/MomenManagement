import React, { useState } from 'react';
import { ArrowLeft, Edit, Trash2, Printer, FileText, User, Package, Clock, MapPin, Phone, CreditCard, DollarSign, X, Eye, EyeOff, Banknote, Landmark, MessageCircle, Facebook, Instagram, History, Calendar } from 'lucide-react';
import BillPreview from './BillPreview';

const OrderDetail = ({ order, onBack, onEdit, onDelete, showProfit, setShowProfit, onViewCustomer }) => {
  const [showBill, setShowBill] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  if (!order) return null;

  const totalCost = order.order_items?.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0) || 0;
  const totalProfit = (order.subtotal - order.discount) - totalCost;

  const statusColors = {
    Quotation: 'bg-gray-100 text-gray-700 border-gray-200',
    Deposit: 'bg-amber-50 text-amber-700 border-amber-200',
    Paid: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Assembling: 'bg-blue-50 text-blue-700 border-blue-200',
    Shipping: 'bg-purple-50 text-purple-700 border-purple-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelled: 'bg-red-50 text-red-700 border-red-200'
  };

  // ... (ฟังก์ชัน helper อื่นๆ เหมือนเดิม)

  const getDurationInfo = () => {
    const start = new Date(order.order_date);
    const end = order.status === 'Completed' && order.completed_at ? new Date(order.completed_at) : new Date(); 
    start.setHours(0,0,0,0); end.setHours(0,0,0,0);
    let diffTime = end - start;
    if (diffTime < 0) diffTime = 0;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = (diffDays % 365) % 30;
    const parts = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    if (days > 0 || parts.length === 0) parts.push(`${days} วัน`); 
    return { text: parts.join(' '), totalDays: diffDays };
  };

  const { text: durationText, totalDays } = getDurationInfo();

  const getDurationColorClass = (days) => {
    if (order.status === 'Completed') return 'bg-gray-100 text-gray-500 border-gray-200';
    if (days <= 30) return 'bg-green-100 text-green-700 border-green-200';
    if (days <= 60) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (days <= 90) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getPaymentIcon = (method) => {
    switch(method) {
      case 'Cash': return <Banknote size={14} className="text-green-600"/>;
      case 'CreditCard': return <CreditCard size={14} className="text-purple-600"/>;
      default: return <Landmark size={14} className="text-blue-600"/>;
    }
  };

  const getPaymentLabel = (method) => {
    switch(method) {
      case 'Cash': return 'เงินสด';
      case 'CreditCard': return 'บัตรเครดิต';
      default: return 'โอนเงิน';
    }
  };

  const getSocialIcon = (type) => {
    switch(type) {
        case 'Facebook': return <Facebook size={14} className="text-blue-600"/>;
        case 'Line': return <MessageCircle size={14} className="text-green-500"/>;
        case 'Instagram': return <Instagram size={14} className="text-pink-500"/>;
        case 'WhatsApp': return <Phone size={14} className="text-green-600"/>;
        default: return null;
    }
  };

  const social = order.customer_cache?.social_channels?.[0];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10 animate-in slide-in-from-right-4 fade-in duration-300">
      
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500 bg-white/10 hover:bg-white/20 rounded-full p-2 backdrop-blur-sm transition-all"><X size={24}/></button>
        </div>
      )}

      {/* Navbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100 sticky top-2 z-20">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium px-3 py-2 rounded-xl hover:bg-gray-100 transition-all">
          <ArrowLeft size={20} /> <span className="hidden sm:inline">ย้อนกลับ</span>
        </button>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowProfit(!showProfit)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all text-sm border ${showProfit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-500 border-gray-200'}`}>
            {showProfit ? <Eye size={18}/> : <EyeOff size={18}/>} {showProfit ? 'ซ่อนกำไร' : 'แสดงกำไร'}
          </button>
          <button onClick={() => setShowBill(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 rounded-xl font-semibold transition-all text-sm shadow-sm">
            <Printer size={18}/> พิมพ์/ดูเอกสาร
          </button>
          <button onClick={onEdit} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black font-medium text-sm shadow-lg shadow-gray-200 transition-all active:scale-95">
            <Edit size={18}/> แก้ไข
          </button>
          <button onClick={onDelete} className="flex items-center gap-2 px-3 py-2.5 bg-white text-red-500 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-100 font-medium text-sm transition-all active:scale-95">
            <Trash2 size={18}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform group-hover:scale-110 transition-transform duration-700 pointer-events-none"><FileText size={200} /></div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 relative z-10 gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded-md border border-gray-200">Order No.</span>
                  <span className={`px-3 py-1 rounded-full font-bold text-xs border ${statusColors[order.status] || 'bg-gray-100'}`}>{order.status}</span>
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{order.order_number}</h1>
                <div className="flex items-center gap-2 text-gray-500 mt-2 font-medium">
                  <Clock size={16}/> {new Date(order.order_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-left md:text-right bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">ยอดสุทธิ</p>
                  <p className="text-3xl font-black text-indigo-600 tracking-tight">฿{order.grand_total?.toLocaleString()}</p>
                </div>
                {showProfit && (
                  <div className="text-left md:text-right bg-emerald-50 p-3 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs text-emerald-600 font-bold mb-0.5">กำไรสุทธิ</p>
                    <p className="text-xl font-black text-emerald-700 tracking-tight">+฿{totalProfit.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100 relative z-10">
              <div className="flex gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors" onClick={() => onViewCustomer && onViewCustomer(order.customer_id)}>
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shrink-0"><User size={24} /></div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-1">ลูกค้า</h3>
                  <p className="font-bold text-gray-800 text-lg">{order.customer_cache?.first_name} {order.customer_cache?.last_name} <span className="text-sm font-normal text-gray-500 ml-2">({order.customer_cache?.nickname || '-'})</span></p>
                  <div className="flex items-start gap-2 text-sm text-gray-600 mt-1"><Phone size={14} className="mt-1 shrink-0"/> {order.customer_cache?.phone}</div>
                  {social && <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">{getSocialIcon(social.type)} {social.value}</div>}
                  <div className="flex items-start gap-2 text-sm text-gray-600 mt-1"><MapPin size={14} className="mt-1 shrink-0"/> {order.customer_cache?.address_raw || '-'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex items-center gap-2">
              <Package size={20} className="text-indigo-500"/>
              <h3 className="font-bold text-gray-800">รายการสินค้า ({order.order_items?.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white border-b border-gray-50 text-gray-400 uppercase text-xs tracking-wider text-left">
                    <th className="py-4 px-8 font-semibold w-1/3">รายการ</th>
                    <th className="py-4 px-6 font-semibold text-center">จำนวน</th>
                    <th className="py-4 px-6 font-semibold text-right">ราคา/หน่วย</th>
                    {showProfit && <th className="py-4 px-6 font-semibold text-right text-emerald-600 bg-emerald-50/30">กำไร/หน่วย</th>}
                    <th className="py-4 px-8 font-semibold text-right">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {order.order_items?.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-8">
                        <p className="font-bold text-gray-900 text-base">{item.product_name}</p>
                        {item.variant_name && <p className="text-xs text-gray-500 bg-gray-100 inline-block px-2 py-0.5 rounded mt-1">{item.variant_name}</p>}
                        {item.sku && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.sku}</p>}
                      </td>
                      <td className="py-4 px-6 text-center"><span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg font-bold">{item.quantity}</span></td>
                      <td className="py-4 px-6 text-right font-medium text-gray-600">฿{item.sell_price.toLocaleString()}</td>
                      {showProfit && <td className="py-4 px-6 text-right font-bold text-emerald-600 bg-emerald-50/30">+{(item.sell_price - item.cost_price).toLocaleString()}</td>}
                      <td className="py-4 px-8 text-right font-bold text-gray-900">฿{(item.sell_price * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-gray-50/30 p-8 border-t border-gray-100">
              <div className="flex flex-col gap-3 ml-auto max-w-sm">
                <div className="flex justify-between text-gray-600"><span>รวมเป็นเงิน</span><span className="font-medium">฿{order.subtotal?.toLocaleString()}</span></div>
                <div className="flex justify-between text-gray-600"><span>ค่าขนส่ง</span><span className="font-medium">฿{order.shipping_cost?.toLocaleString()}</span></div>
                {order.discount > 0 && <div className="flex justify-between text-red-500"><span>ส่วนลด</span><span className="font-medium">-฿{order.discount.toLocaleString()}</span></div>}
                {order.vat_type !== 'no_vat' && <div className="flex justify-between text-gray-500 text-xs"><span>VAT ({order.vat_type})</span><span>฿{order.vat_amount?.toLocaleString()}</span></div>}
                <div className="flex justify-between items-center border-t border-gray-200 pt-4 mt-2">
                  <span className="text-gray-900 font-bold text-lg">ยอดรวมสุทธิ</span>
                  <span className="text-2xl font-black text-indigo-600">฿{order.grand_total?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* New Section: Timeline */}
          {order.order_updates && order.order_updates.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><History size={18} className="text-indigo-500"/> ความคืบหน้างาน (Timeline)</h3>
                <div className="relative pl-4 border-l-2 border-indigo-100 ml-2 space-y-6">
                {order.order_updates.map((update, i) => (
                    <div key={i} className="relative">
                        <div className="absolute -left-[23px] top-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-sm"></div>
                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                            <Calendar size={12}/> {new Date(update.update_date).toLocaleDateString('th-TH')}
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-sm text-gray-800 whitespace-pre-line mb-2">{update.description}</p>
                            {update.images?.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {update.images.map((img, imgIdx) => (
                                    <img key={imgIdx} src={img} className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80" onClick={() => setLightboxImg(img)} />
                                ))}
                            </div>
                            )}
                        </div>
                    </div>
                ))}
                </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-indigo-500"/> ประวัติการชำระเงิน</h3>
              <div className="space-y-3 relative">
                {order.order_payments && order.order_payments.length > 0 ? (
                  <>
                    <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-100"></div>
                    {order.order_payments.map((pay, i) => (
                      <div key={i} className="flex gap-4 relative z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm shrink-0 ${pay.type === 'deposit' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          <DollarSign size={16} />
                        </div>
                        <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold uppercase tracking-wider ${pay.type === 'deposit' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {pay.type === 'deposit' ? 'มัดจำ' : 'ชำระเงิน'}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                   {getPaymentIcon(pay.payment_method)}
                                   {getPaymentLabel(pay.payment_method)}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1">{new Date(pay.payment_date).toLocaleDateString('th-TH')}</p>
                            </div>
                            <span className="font-bold text-gray-900">฿{pay.amount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">ยังไม่มีรายการชำระเงิน</p>
                  </div>
                )}
              </div>
           </div>

           {order.notes && (
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
              <h3 className="font-bold text-amber-800 mb-2 text-sm uppercase tracking-wider">หมายเหตุ</h3>
              <p className="text-amber-900 text-sm leading-relaxed">{order.notes}</p>
            </div>
          )}

          {order.images?.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText size={18} className="text-indigo-500"/> รูปภาพแนบ ({order.images.length})</h3>
              <div className="grid grid-cols-2 gap-3">
                {order.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setLightboxImg(img)}>
                    <img src={img} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showBill && <ServiceBillPreview service={order} onClose={() => setShowBill(false)} />}
    </div>
  );
};

export default OrderDetail;