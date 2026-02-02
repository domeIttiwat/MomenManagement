import React, { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Trash2, MapPin, Phone, MessageSquare, Facebook, Instagram, MessageCircle, X, ShoppingBag, TrendingUp, DollarSign, Eye, EyeOff, Package, ExternalLink, Map } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CustomerDetail = ({ customer, onBack, onEdit, onDelete, onViewOrder }) => {
  const [lightboxImg, setLightboxImg] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showProfit, setShowProfit] = useState(false);

  if (!customer) return null;

  useEffect(() => {
    const fetchOrders = async () => {
      setLoadingOrders(true);
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('customer_id', customer.id)
        .order('order_date', { ascending: false });
      
      if (data) setOrders(data);
      setLoadingOrders(false);
    };

    fetchOrders();
  }, [customer.id]);

  const totalOrders = orders.length;
  const grandTotalSpent = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
  
  const grandTotalProfit = orders.reduce((sum, o) => {
    const orderCost = o.order_items?.reduce((c, i) => c + (i.cost_price * i.quantity), 0) || 0;
    const orderProfit = (o.subtotal - o.discount) - orderCost; 
    return sum + orderProfit;
  }, 0);

  const getSocialIcon = (type) => {
    switch(type) {
      case 'Facebook': return <Facebook size={18} className="text-blue-600"/>;
      case 'Line': return <MessageCircle size={18} className="text-green-500"/>;
      case 'Instagram': return <Instagram size={18} className="text-pink-500"/>;
      case 'WhatsApp': return <Phone size={18} className="text-green-600"/>;
      case 'TikTok': return <span className="font-bold text-xs bg-black text-white px-1 rounded">TK</span>;
      default: return <MessageSquare size={18} className="text-gray-400"/>;
    }
  };

  const statusColors = {
    Quotation: 'bg-gray-100 text-gray-600',
    Deposit: 'bg-amber-100 text-amber-700',
    Paid: 'bg-indigo-100 text-indigo-700',
    Completed: 'bg-emerald-100 text-emerald-700',
    Cancelled: 'bg-red-50 text-red-600'
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-10">
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500 bg-black/50 rounded-full p-2"><X size={24}/></button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 sticky top-2 z-20">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-3 py-2 rounded-xl hover:bg-gray-100 transition-all">
          <ArrowLeft size={20} /> <span className="hidden sm:inline">ย้อนกลับ</span>
        </button>
        <div className="flex gap-2">
           <button 
            onClick={() => setShowProfit(!showProfit)} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${showProfit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            {showProfit ? <Eye size={18}/> : <EyeOff size={18}/>} {showProfit ? 'ซ่อนกำไร' : 'แสดงกำไร'}
          </button>
          <button onClick={onEdit} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl flex items-center gap-2 shadow-lg hover:bg-black transition-all active:scale-95 text-sm font-medium"><Edit size={16}/> แก้ไข</button>
          <button onClick={onDelete} className="px-4 py-2.5 bg-white text-red-600 border border-gray-200 rounded-xl flex items-center gap-2 hover:bg-red-50 hover:border-red-100 transition-all active:scale-95 text-sm font-medium"><Trash2 size={16}/> ลบ</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile & Contact */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 w-full h-24 bg-gradient-to-b from-indigo-50 to-white z-0"></div>
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg mb-4 bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity z-10" onClick={() => customer.images?.[0] && setLightboxImg(customer.images[0])}>
              {customer.images?.[0] ? (
                <img src={customer.images[0]} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300 bg-gray-50">{customer.first_name[0]}</div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 z-10">{customer.first_name} {customer.last_name}</h2>
            <p className="text-gray-500 font-medium mb-1 z-10">({customer.nickname || '-'})</p>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-mono z-10 border border-gray-200">{customer.code}</span>
            
            <div className="w-full mt-6 space-y-3 z-10">
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl text-indigo-700 justify-center">
                <Phone size={20} />
                <span className="font-bold text-lg">{customer.phone || '-'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">ช่องทางติดต่อ</h3>
            <div className="space-y-3">
              {customer.social_channels?.map((social, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                      {getSocialIcon(social.type)}
                    </div>
                    <span className="font-medium text-gray-600 text-sm">{social.type}</span>
                  </div>
                  <span className="text-gray-900 font-medium select-all text-sm">{social.value}</span>
                </div>
              ))}
              {(!customer.social_channels || customer.social_channels.length === 0) && <p className="text-gray-400 text-center text-sm">ไม่มีข้อมูลติดต่ออื่น</p>}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide border-b pb-2 flex items-center gap-2"><MapPin size={18} className="text-indigo-500"/> ที่อยู่</h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{customer.address_raw || 'ไม่ได้ระบุที่อยู่'}</p>
            
            {/* Location Button */}
            {customer.location_url && (
                <a 
                    href={customer.location_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 hover:bg-blue-100 font-medium text-sm transition-all"
                >
                    <Map size={16}/> เปิดแผนที่ (Google Maps)
                </a>
            )}
            
            {customer.address_parsed && (
              <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-100"><p className="text-gray-400 mb-0.5">จังหวัด</p><p className="font-bold text-indigo-900">{customer.address_parsed.prov || '-'}</p></div>
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-100"><p className="text-gray-400 mb-0.5">อำเภอ/เขต</p><p className="font-bold text-indigo-900">{customer.address_parsed.dist || '-'}</p></div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stats & History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">คำสั่งซื้อทั้งหมด</p>
                <ShoppingBag size={20} className="text-blue-500 bg-blue-50 p-1 rounded-md"/>
              </div>
              <p className="text-3xl font-black text-gray-900">{totalOrders}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">ยอดซื้อรวม</p>
                <DollarSign size={20} className="text-indigo-500 bg-indigo-50 p-1 rounded-md"/>
              </div>
              <p className="text-3xl font-black text-indigo-600">฿{grandTotalSpent.toLocaleString()}</p>
            </div>
            {showProfit && (
              <div className="bg-emerald-50 p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-emerald-700 text-xs font-bold uppercase tracking-wider">กำไรสะสม</p>
                  <TrendingUp size={20} className="text-emerald-600 bg-white p-1 rounded-md shadow-sm"/>
                </div>
                <p className="text-3xl font-black text-emerald-700">+฿{grandTotalProfit.toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Order History */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><ShoppingBag size={18} className="text-indigo-500"/> ประวัติการสั่งซื้อ</h3>
            </div>
            
            {loadingOrders ? (
              <div className="p-10 text-center text-gray-400">กำลังโหลดข้อมูล...</div>
            ) : orders.length === 0 ? (
              <div className="p-10 text-center text-gray-400 border-2 border-dashed border-gray-100 m-6 rounded-xl">ยังไม่มีประวัติการสั่งซื้อ</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-gray-500 border-b border-gray-100 text-xs uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-6 py-4 text-left">วันที่ / เลขที่</th>
                      <th className="px-6 py-4 text-left w-1/3">รายการสินค้า</th>
                      <th className="px-6 py-4 text-center">สถานะ</th>
                      <th className="px-6 py-4 text-right">ยอดสุทธิ</th>
                      {showProfit && <th className="px-6 py-4 text-right text-emerald-600 bg-emerald-50/30">กำไร</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map((order) => {
                      const cost = order.order_items?.reduce((c, i) => c + (i.cost_price * i.quantity), 0) || 0;
                      const profit = (order.subtotal - order.discount) - cost;
                      
                      return (
                        <tr 
                          key={order.id} 
                          onClick={() => onViewOrder && onViewOrder(order)} 
                          className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4 group-hover:text-indigo-700">
                             <div className="font-bold text-gray-900 text-xs mb-1 flex items-center gap-2">
                               {order.order_number} 
                               <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                             </div>
                             <div className="text-gray-500 text-[10px]">{new Date(order.order_date).toLocaleDateString('th-TH')}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              {order.order_items?.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                                  <Package size={12} className="text-gray-400 min-w-[12px]"/> 
                                  <span>{item.product_name}</span>
                                  {item.variant_name && <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 rounded">{item.variant_name}</span>}
                                  <span className="text-gray-400 text-[10px] whitespace-nowrap">x{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusColors[order.status] || 'bg-gray-100 border-gray-200'}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-indigo-900">฿{order.grand_total?.toLocaleString()}</span>
                          </td>
                          {showProfit && (
                            <td className="px-6 py-4 text-right bg-emerald-50/30">
                              <span className={`text-xs font-bold ${profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {profit > 0 ? '+' : ''}{profit.toLocaleString()}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Notes (ย้ายมาไว้ล่างสุด) */}
          {customer.notes && (
            <div className="bg-yellow-50 p-6 rounded-3xl border border-yellow-100">
              <h3 className="font-bold text-yellow-800 mb-2 text-sm uppercase tracking-wider">หมายเหตุ</h3>
              <p className="text-yellow-900 text-sm leading-relaxed">{customer.notes}</p>
            </div>
          )}
          
          {/* Gallery */}
          {customer.images?.length > 0 && (
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">รูปภาพเพิ่มเติม ({customer.images.length})</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {customer.images.map((img, i) => (
                    <img 
                      key={i} 
                      src={img} 
                      className="w-32 h-32 rounded-2xl object-cover border border-gray-200 cursor-zoom-in hover:scale-105 transition-transform shadow-sm" 
                      onClick={() => setLightboxImg(img)}
                    />
                  ))}
                </div>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};
export default CustomerDetail;