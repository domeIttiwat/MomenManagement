import React, { useState, useRef } from 'react';
import { X, Download, Share2, Printer, Copy, Check } from 'lucide-react';

const BillPreview = ({ order, onClose }) => {
  const [mode, setMode] = useState('official'); // 'official' | 'chat'
  const contentRef = useRef(null);

  if (!order) return null;

  const handlePrint = () => {
    const printContent = contentRef.current.innerHTML;
    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write('<html><head><title>Print Bill</title>');
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Kanit:wght@300;400;500;600&display=swap" rel="stylesheet">');
    printWindow.document.write('<style>@page { size: A4; margin: 0; } body { margin: 0; -webkit-print-color-adjust: exact; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleDownloadImage = () => {
    alert("ฟังก์ชัน Save Image ต้องใช้ library 'html2canvas' ในการทำงานจริงครับ\n\nตอนนี้แนะนำให้ใช้ Screenshot หรือ Print > Save as PDF ครับ");
  };

  const isTaxInvoice = order.show_tax_id && order.invoice_number;
  const docTitle = order.status === 'Paid' || order.status === 'Completed' 
    ? (isTaxInvoice ? 'ใบเสร็จรับเงิน / ใบกำกับภาษี' : 'ใบเสร็จรับเงิน')
    : 'ใบเสนอราคา';
  const docTitleEn = order.status === 'Paid' || order.status === 'Completed'
    ? (isTaxInvoice ? 'RECEIPT / TAX INVOICE' : 'RECEIPT')
    : 'QUOTATION';

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-white w-full max-w-5xl h-[95vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header Control Bar */}
        <div className="bg-gray-900 text-white p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex bg-gray-800 p-1 rounded-lg">
            <button 
              onClick={() => setMode('official')} 
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'official' ? 'bg-white text-gray-900 shadow' : 'text-gray-400 hover:text-white'}`}
            >
              เอกสารทางการ (A4)
            </button>
            <button 
              onClick={() => setMode('chat')} 
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'chat' ? 'bg-white text-gray-900 shadow' : 'text-gray-400 hover:text-white'}`}
            >
              รูปส่งแชท (Mobile)
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/50">
              <Printer size={18}/> {mode === 'official' ? 'พิมพ์ / PDF' : 'พิมพ์'}
            </button>
            {mode === 'chat' && (
              <button onClick={handleDownloadImage} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-900/50">
                <Share2 size={18}/> บันทึกรูป
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg ml-2 transition-colors"><X size={24}/></button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-y-auto bg-gray-200/50 p-4 sm:p-8 flex justify-center items-start">
          <div ref={contentRef} className={`bg-white shadow-xl print:shadow-none transition-all duration-300 ${mode === 'official' ? 'w-[210mm] min-h-[297mm]' : 'w-[375px] min-h-[600px] rounded-none'}`}>
            
            {/* =================================================================================
                                          MODE 1: OFFICIAL (A4 Standard)
               ================================================================================= */}
            {mode === 'official' && (
              <div className="relative flex flex-col h-[297mm] p-[15mm] text-gray-900 box-border" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                
                {/* 1. Header Section */}
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
                  <div className="w-2/3 pr-4">
                    <h1 className="text-xl font-bold mb-1">บริษัท ไทยฟรอสเทค จำกัด</h1>
                    <p className="text-[11px] leading-relaxed text-gray-600">
                      97 หมู่ 1 ซอยรังสิต-นครนายก 64 ต.ประชาธิปัตย์ อ.ธัญบุรี จ.ปทุมธานี 12130<br/>
                      โทร: 093-121-5740 &nbsp;|&nbsp; Tax ID: 0105551234567
                    </p>
                  </div>
                  <div className="w-1/3 text-right">
                    <h2 className="text-lg font-bold uppercase text-indigo-900">{docTitle}</h2>
                    <p className="text-[10px] font-medium text-gray-500 tracking-wider mb-2">{docTitleEn}</p>
                    <div className="text-[11px]">
                      <div className="flex justify-between mb-1"><span className="text-gray-500">เลขที่:</span> <span className="font-bold">{order.order_number}</span></div>
                      <div className="flex justify-between mb-1"><span className="text-gray-500">วันที่:</span> <span className="font-bold">{new Date(order.order_date).toLocaleDateString('th-TH')}</span></div>
                      {isTaxInvoice && <div className="flex justify-between"><span className="text-gray-500">Tax Inv:</span> <span className="font-bold">{order.invoice_number}</span></div>}
                    </div>
                  </div>
                </div>

                {/* 2. Customer Info */}
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-1">ลูกค้า (Customer)</h3>
                    <p className="text-sm font-bold">{order.customer_cache?.first_name} {order.customer_cache?.last_name}</p>
                    <p className="text-[11px] mt-1 text-gray-600 line-clamp-2 h-[2.4em]">{order.customer_cache?.address_raw || '-'}</p>
                    <p className="text-[11px] mt-1">โทร: {order.customer_cache?.phone}</p>
                    {/* แสดง Tax ID ลูกค้าเฉพาะเมื่อมีข้อมูล */}
                    {order.show_tax_id && order.customer_cache?.tax_id && (
                      <p className="text-[11px]">Tax ID: {order.customer_cache.tax_id}</p>
                    )}
                  </div>
                  <div className="w-[35%] p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-1">รายละเอียด (Reference)</h3>
                    <div className="text-[11px] space-y-1">
                      {/* ตัดผู้ขายออกตามที่ขอ */}
                      <div className="flex justify-between"><span>เงื่อนไข:</span> <span className="font-medium">เงินสด/โอน</span></div>
                      {/* ตัดกำหนดส่งออกตามที่ขอ */}
                    </div>
                  </div>
                </div>

                {/* 3. Items Table (Compact) */}
                <div className="flex-1">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 font-semibold border-y border-gray-300">
                        <th className="py-2 px-2 text-center w-10">ลำดับ</th>
                        <th className="py-2 px-2 text-left">รายการสินค้า (Description)</th>
                        <th className="py-2 px-2 text-center w-16">จำนวน</th>
                        <th className="py-2 px-2 text-right w-24">ราคา/หน่วย</th>
                        <th className="py-2 px-2 text-right w-24">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {order.order_items?.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-1.5 px-2 text-center align-top">{i+1}</td>
                          <td className="py-1.5 px-2 align-top">
                            <span className="font-medium text-gray-900">{item.product_name}</span>
                            {item.variant_name && <span className="text-[10px] text-gray-500 ml-2">({item.variant_name})</span>}
                            {item.sku && <div className="text-[9px] text-gray-400 font-mono">{item.sku}</div>}
                          </td>
                          <td className="py-1.5 px-2 text-center align-top">{item.quantity}</td>
                          <td className="py-1.5 px-2 text-right align-top">{item.sell_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="py-1.5 px-2 text-right align-top font-medium">{(item.sell_price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                      {/* Filler rows to push footer down if items are few */}
                      {Array.from({ length: Math.max(0, 15 - (order.order_items?.length || 0)) }).map((_, i) => (
                        <tr key={`fill-${i}`} className="h-6"><td colSpan={5}></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. Footer Totals */}
                <div className="flex border-t-2 border-gray-800 pt-2 mt-2">
                  <div className="flex-1 pr-8">
                    <div className="text-[10px] text-gray-500 mb-1">หมายเหตุ (Remarks):</div>
                    <div className="text-[11px] text-gray-700 bg-gray-50 p-2 rounded h-16 overflow-hidden">{order.notes || '-'}</div>
                    <div className="mt-2 text-[11px] font-medium text-gray-800 bg-gray-100 px-2 py-1 rounded inline-block">
                      ( {toThaiBahtText(order.grand_total)} )
                    </div>
                  </div>
                  
                  <div className="w-1/3 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600">รวมเป็นเงิน</span>
                      <span className="font-medium">{order.subtotal?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between py-1 border-b border-gray-100 text-red-600">
                        <span>หักส่วนลด</span>
                        <span>-{order.discount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600">ค่าขนส่ง</span>
                      <span>{order.shipping_cost === 0 ? '-' : order.shipping_cost?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    {order.vat_type !== 'no_vat' && (
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">ภาษีมูลค่าเพิ่ม (7%)</span>
                        <span>{order.vat_amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 items-center mt-1">
                      <span className="font-bold text-gray-900 text-sm">จำนวนเงินสุทธิ</span>
                      <span className="font-bold text-gray-900 text-lg border-b-4 border-double border-gray-400">
                        {order.grand_total?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Signature Area */}
                <div className="flex justify-between items-end mt-8 pt-4">
                  <div className="text-center w-1/3">
                    <div className="border-b border-dashed border-gray-400 mb-2 h-8"></div>
                    <p className="text-[10px] font-medium text-gray-600">ผู้รับวางบิล / ผู้รับสินค้า</p>
                    <p className="text-[10px] text-gray-400">วันที่ ______/______/______</p>
                  </div>
                  <div className="text-center w-1/3">
                    <div className="border-b border-dashed border-gray-400 mb-2 h-8"></div>
                    <p className="text-[10px] font-medium text-gray-600">ผู้มีอำนาจลงนาม</p>
                    <p className="text-[10px] text-gray-400">วันที่ ______/______/______</p>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================================
                                          MODE 2: CHAT SUMMARY (Dark Gray / Yellow Theme)
               ================================================================================= */}
            {mode === 'chat' && (
              <div className="relative bg-white min-h-[600px] flex flex-col pb-8" style={{ fontFamily: '"Kanit", sans-serif' }}>
                
                {/* Modern Brand Header - เปลี่ยนสีเป็นเทาเข้ม/เหลือง */}
                <div className="bg-gray-900 text-white px-6 py-8 rounded-b-[2.5rem] shadow-xl text-center relative overflow-hidden shrink-0">
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-gray-700/30 to-transparent"></div>
                  <h1 className="text-3xl font-bold tracking-widest relative z-10 text-yellow-400">MOMEN</h1>
                  <p className="text-[10px] font-medium uppercase tracking-[0.4em] opacity-80 mt-1 relative z-10 text-gray-300">Technology</p>
                </div>

                <div className="px-6 -mt-6 relative z-10 flex-1 flex flex-col">
                  {/* Order Summary Card */}
                  <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-6 border border-gray-100 mb-6 text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-wide font-bold mb-1">รายการสั่งซื้อ</p>
                    <p className="text-gray-900 text-lg font-bold mb-1">#{order.order_number}</p>
                    <p className="text-gray-500 text-xs">{new Date(order.order_date).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
                    
                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                      <p className="text-gray-800 font-medium text-lg">คุณ {order.customer_cache?.first_name}</p>
                      {order.customer_cache?.nickname && <p className="text-gray-400 text-sm">({order.customer_cache?.nickname})</p>}
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-4 mb-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Items</p>
                    {order.order_items?.map((item, i) => (
                      <div key={i} className="flex justify-between items-start group">
                        <div className="flex-1 pr-4">
                          <div className="flex items-baseline gap-2">
                            <span className="text-gray-800 font-medium text-base leading-tight">{item.product_name}</span>
                            <span className="text-gray-400 text-xs whitespace-nowrap">x {item.quantity}</span>
                          </div>
                          {item.variant_name && <p className="text-xs text-gray-400 mt-0.5">{item.variant_name}</p>}
                        </div>
                        <div className="text-gray-900 font-bold text-base whitespace-nowrap">฿{(item.sell_price * item.quantity).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>

                  {/* Pricing Details */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-6">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-500">
                        <span>ยอดรวม</span>
                        <span>{order.subtotal?.toLocaleString()}</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between text-red-500">
                          <span>ส่วนลด</span>
                          <span>-{order.discount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-500">
                        <span>ค่าจัดส่ง</span>
                        <span>{order.shipping_cost === 0 ? 'ฟรี' : order.shipping_cost?.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-gray-200 my-2 pt-2 flex justify-between items-center">
                        <span className="font-bold text-gray-900">ยอดสุทธิ</span>
                        <span className="font-black text-2xl text-gray-900">฿{order.grand_total?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Note */}
                  {order.notes && (
                    <div className="mb-8 bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-xs text-yellow-800 leading-relaxed">
                      <span className="font-bold mr-1">Note:</span> {order.notes}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-auto text-center pb-4">
                    <p className="text-gray-300 text-xs">Thank you for your order</p>
                    <div className="flex justify-center gap-1 mt-1">
                      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                      <div className="w-1 h-1 rounded-full bg-yellow-400"></div>
                      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

// ฟังก์ชันแปลงเลขเป็นบาทถ้วน (รองรับทศนิยม)
const toThaiBahtText = (number) => {
  const num = parseFloat(number);
  if (isNaN(num)) return '';
  if (num === 0) return 'ศูนย์บาทถ้วน';

  const thaiNumbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const numStr = num.toFixed(2);
  const [bahtStr, satangStr] = numStr.split('.');

  const convert = (nStr) => {
    let text = '';
    for (let i = 0; i < nStr.length; i++) {
      const digit = parseInt(nStr[i]);
      const pos = nStr.length - i - 1;
      
      if (digit !== 0) {
        if (pos === 0 && digit === 1 && nStr.length > 1) {
          text += 'เอ็ด';
        } else if (pos === 1 && digit === 2) {
          text += 'ยี่';
        } else if (pos === 1 && digit === 1) {
          // skip
        } else {
          text += thaiNumbers[digit];
        }
        text += units[pos];
      }
    }
    return text;
  };

  let text = '';
  // แปลงบาท (แบบง่าย รองรับหลักสิบล้านแบบต่อ string เอา ถ้าจะให้เป๊ะต้องมี logic วนลูป)
  if (parseInt(bahtStr) > 0) {
     if (bahtStr.length > 6) {
       // ถ้าเกินล้าน ตัด string (แบบง่าย)
       const million = bahtStr.substring(0, bahtStr.length - 6);
       const rest = bahtStr.substring(bahtStr.length - 6);
       text += convert(million) + 'ล้าน' + convert(rest);
     } else {
       text += convert(bahtStr);
     }
     text += 'บาท';
  }

  // แปลงสตางค์
  if (parseInt(satangStr) > 0) {
    text += convert(satangStr) + 'สตางค์';
  } else {
    text += 'ถ้วน';
  }

  return '(' + text + ')';
};

export default BillPreview;