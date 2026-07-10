import React, { useState, useRef } from 'react';
import { X, Download, Share2, Printer, Loader2, FileText, MessageCircle, Tag, Facebook, Instagram, Phone, Globe } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { customizationParts } from '@/app/components/common/PaintBadge';

// จุดสี+label (สีเดิมโรงงาน + สีสั่งทำ) สำหรับพิมพ์ลงบิล (inline style ให้ html2canvas/print เก็บสีชัวร์)
const BillPaintLine = ({ customization, size = 10 }) => {
  const parts = customizationParts(customization);
  if (!parts.length) return null;
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: '2px' }}>
      {parts.map(([label, hex]) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: `${size}px`, color: '#374151' }}>
          <span style={{ width: `${size}px`, height: `${size}px`, borderRadius: '9999px', background: hex, border: '1px solid #9ca3af', display: 'inline-block', flexShrink: 0 }} />
          {label} <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{hex}</span>
        </span>
      ))}
    </span>
  );
};

const BillPreview = ({ order, onClose }) => {
  const [mode, setMode] = useState('official'); // 'official' | 'chat' | 'tag' (S1)
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef(null);

  if (!order) return null;

  const handlePrint = () => {
    const printContent = contentRef.current.innerHTML;
    const win = window.open('', '', 'height=800,width=800');
    
    win.document.write('<html><head><title>Order Document</title>');
    win.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    win.document.write('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&family=Kanit:wght@300;400;600;700;900&display=swap" rel="stylesheet">');
    
    win.document.write(`
      <style>
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background-color: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .print-wrapper { width: 210mm; margin: 0 auto; background: white; position: relative; }
        * { box-sizing: border-box; }
        /* ไม่บังคับความสูงเต็มหน้า + ซ่อนแถวเติมว่าง → รายการน้อยอยู่หน้าเดียว ไม่หลุดไปหน้า 2 */
        [class*="min-h-"] { min-height: 0 !important; }
        .bill-filler { display: none !important; }
        /* multi-page: หัวตารางซ้ำทุกหน้า, แถวไม่ถูกตัดครึ่ง, บล็อกยอดรวม/เซ็นไม่ขาดหน้า */
        thead { display: table-header-group; }
        tr, .bill-keep { break-inside: avoid; page-break-inside: avoid; }
        table { border-collapse: collapse; width: 100%; }
      </style>
    `);
    
    win.document.write('</head><body class="bg-gray-100 flex justify-center">');
    win.document.write('<div class="print-wrapper">');
    win.document.write(printContent);
    win.document.write('</div>');
    win.document.write('</body></html>');
    
    win.document.close();
    
    setTimeout(() => {
        win.focus();
        win.print();
    }, 2000);
  };

  const handleDownloadImage = async () => {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      const el = contentRef.current;
      // html2canvas-pro รองรับสี oklch/lab/lch ของ Tailwind v4 ได้เอง ไม่ต้อง patch
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `MOMEN-${mode === 'tag' ? 'S1' : 'Order'}-${order.order_number}.png`;
      link.click();
    } catch (error) {
      console.error("Error generating image:", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const toThaiBahtText = (num) => {
    if (!num) return '';
    return '( - จำนวนเงินบาทถ้วน - )'; 
  };

  const getSocialIcon = (type) => {
    const t = type?.toLowerCase();
    if(t === 'line') return 'LINE';
    if(t === 'facebook') return 'FB';
    if(t === 'instagram') return 'IG';
    return type;
  };

  const hasInvoiceNumber = order.invoice_number && order.invoice_number.trim().length > 0;
  const isTaxInvoice = order.show_tax_id && hasInvoiceNumber;
  const isReceipt = ['Paid', 'Completed', 'Shipping'].includes(order.status);

  let docTitle = 'ใบเสนอราคา';
  let docTitleEn = 'QUOTATION';

  if (isReceipt) {
    if (hasInvoiceNumber) {
      docTitle = 'ใบเสร็จรับเงิน / ใบกำกับภาษี';
      docTitleEn = 'RECEIPT / TAX INVOICE';
    } else {
      docTitle = 'ใบเสร็จรับเงิน';
      docTitleEn = 'RECEIPT';
    }
  }

  let displaySubtotal = order.subtotal;
  let displayDiscount = order.discount;
  
  if (order.vat_type === 'include') {
    displaySubtotal = order.subtotal / 1.07;
    displayDiscount = order.discount / 1.07;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Toolbar */}
        <div className="bg-gray-900 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex bg-gray-800 p-1 rounded-lg gap-1">
            <button 
                onClick={() => setMode('official')} 
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${mode === 'official' ? 'bg-white text-gray-900 shadow' : 'text-gray-400 hover:text-white'}`}
            >
                <FileText size={16}/> ทางการ (A4)
            </button>
            <button 
                onClick={() => setMode('tag')} 
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${mode === 'tag' ? 'bg-white text-gray-900 shadow' : 'text-gray-400 hover:text-white'}`}
            >
                <Tag size={16}/> ใบงาน S1 (ประกอบ)
            </button>
            <button 
                onClick={() => setMode('chat')} 
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${mode === 'chat' ? 'bg-white text-gray-900 shadow' : 'text-gray-400 hover:text-white'}`}
            >
                <MessageCircle size={16}/> ส่งแชท
            </button>
          </div>
          <div className="flex gap-2">
             <button onClick={handlePrint} className="flex gap-2 items-center bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-white text-sm font-medium shadow-lg shadow-indigo-900/50"><Printer size={18}/> พิมพ์</button>
             {(mode === 'chat' || mode === 'tag') && (
                 <button onClick={handleDownloadImage} disabled={downloading} className="flex gap-2 items-center bg-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-white text-sm font-medium shadow-lg shadow-emerald-900/50">
                    {downloading ? <Loader2 size={18} className="animate-spin"/> : <Share2 size={18}/>} บันทึกรูป
                 </button>
             )}
             <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
          </div>
        </div>
        
        {/* Preview Area */}
        <div className="flex-1 overflow-y-auto bg-gray-200 p-8 flex justify-center items-start">
           
           <div 
             ref={contentRef} 
             className={`bg-white shadow-xl print:shadow-none relative flex flex-col ${mode === 'chat' ? 'w-[400px]' : 'w-[210mm] min-h-[297mm]'}`}
             style={{ 
                 fontFamily: mode === 'official' ? '"Sarabun", sans-serif' : '"Kanit", sans-serif' 
             }}
           >
              
              {/* ======================= MODE 1: OFFICIAL (A4) ======================= */}
              {mode === 'official' && (
                <div className="p-[15mm] text-gray-900 h-full flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-2/3 pr-8">
                            <h1 className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">MOMENTECH</h1>
                            <p className="text-[11px] text-gray-600 leading-snug">
                              97 ซอยรังสิต-นครนายก 64 ต.ประชาธิปัตย์<br/>
                              อ.ธัญบุรี จ.ปทุมธานี 12130<br/>
                              โทร: 093-121-5740 {order.show_tax_id && <span>&nbsp;|&nbsp; เลขประจำตัวผู้เสียภาษี: 0105551234567</span>}
                            </p>
                        </div>
                        <div className="w-1/3 text-right">
                            <div className="inline-block bg-white text-black border-2 border-black px-4 py-1 mb-1">
                            <h2 className="text-base font-bold uppercase tracking-widest">{docTitle}</h2>
                            </div>
                            <p className="text-[10px] font-bold text-gray-500 tracking-[0.2em]">{docTitleEn}</p>
                        </div>
                    </div>

                    <div className="h-px bg-gray-300 w-full mb-6"></div>

                    {/* Info Grid */}
                    <div className="flex justify-between mb-6 text-[11px]">
                        <div className="w-[55%] border border-gray-300 p-3 rounded-lg">
                            <h3 className="font-bold text-gray-900 uppercase mb-2 border-b border-gray-100 pb-1">ข้อมูลลูกค้า (Customer)</h3>
                            <div className="space-y-1">
                                <p className="text-sm font-bold">{order.customer_cache?.first_name} {order.customer_cache?.last_name} {order.customer_cache?.nickname ? `(${order.customer_cache.nickname})` : ''}</p>
                                <p className="text-gray-600">{order.customer_cache?.address_raw || '-'}</p>
                                <p className="text-gray-600"><span className="font-semibold text-gray-800">โทร:</span> {order.customer_cache?.phone}</p>
                                {order.show_tax_id && order.customer_cache?.tax_id && (
                                   <p className="text-gray-600"><span className="font-semibold text-gray-800">Tax ID:</span> {order.customer_cache?.tax_id}</p>
                                )}
                            </div>
                        </div>
                        <div className="w-[40%] border border-gray-300 p-3 rounded-lg bg-gray-50/30">
                            <h3 className="font-bold text-gray-900 uppercase mb-2 border-b border-gray-200 pb-1">รายละเอียด (Details)</h3>
                            <div className="space-y-1.5">
                                <div className="flex justify-between"><span className="text-gray-500">เลขที่เอกสาร:</span> <span className="font-bold text-sm">{order.order_number}</span></div>
                                {hasInvoiceNumber && (
                                    <div className="flex justify-between"><span className="text-gray-500">เลขที่ใบกำกับ:</span> <span className="font-bold text-indigo-700">{order.invoice_number}</span></div>
                                )}
                                <div className="flex justify-between"><span className="text-gray-500">วันที่:</span> <span className="font-bold">{new Date(order.order_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                                {order.status === 'Paid' && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">วันที่ชำระ:</span>
                                    <span className="font-bold">{new Date().toLocaleDateString('th-TH')}</span>
                                  </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full mb-4 text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-800 font-bold border-y border-black">
                            <th className="py-2 px-3 text-center w-12 border-r border-gray-300">#</th>
                            <th className="py-2 px-3 text-left border-r border-gray-300">รายการสินค้า (Description)</th>
                            <th className="py-2 px-3 text-center w-24 border-r border-gray-300">จำนวน</th>
                            <th className="py-2 px-3 text-right w-28 border-r border-gray-300">ราคา/หน่วย</th>
                            <th className="py-2 px-3 text-right w-32">จำนวนเงิน</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-700">
                            {order.order_items?.map((item, i) => (
                            <React.Fragment key={i}>
                                <tr className="border-b border-gray-200">
                                    <td className="py-2 px-3 text-center align-top border-r border-gray-200 text-gray-500">{i+1}</td>
                                    <td className="py-2 px-3 align-top border-r border-gray-200">
                                        <p className="font-bold text-gray-900">{item.product_name}</p>
                                        {item.variant_name && <p className="text-[10px] text-gray-500">{item.variant_name}</p>}
                                        <BillPaintLine customization={item.customization} size={10} />
                                        {item.sku && <p className="text-[10px] text-gray-400 font-mono">SKU: {item.sku}</p>}
                                    </td>
                                    <td className="py-2 px-3 text-center align-top border-r border-gray-200">{item.quantity}</td>
                                    <td className="py-2 px-3 text-right align-top border-r border-gray-200">{item.sell_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="py-2 px-3 text-right align-top font-bold text-gray-900">{(item.sell_price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                </tr>
                            </React.Fragment>
                            ))}
                            {/* Filler */}
                            {Array.from({length: Math.max(0, 15 - (order.order_items?.length||0))}).map((_,i) => (
                                <tr key={`fill-${i}`} className="bill-filler border-b border-gray-100 h-8">
                                    <td className="border-r border-gray-200"></td><td className="border-r border-gray-200"></td><td className="border-r border-gray-200"></td><td className="border-r border-gray-200"></td><td></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Footer */}
                    <div className="bill-keep flex justify-end mt-auto">
                        <div className="w-[45%] text-[11px]">
                            <div className="flex justify-between py-1 border-b border-gray-200">
                                <span className="font-bold text-gray-600">
                                   {order.vat_type === 'include' ? 'รวมเป็นเงิน (ก่อน VAT)' : 'รวมเป็นเงิน (Subtotal)'}
                                </span>
                                <span className="font-medium">{displaySubtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            {order.discount > 0 && (
                                <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                                    <span>
                                        {order.vat_type === 'include' ? 'ส่วนลด (ก่อน VAT)' : 'ส่วนลด (Discount)'}
                                    </span>
                                    <span>-{displayDiscount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}
                            {order.shipping_cost > 0 && (
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span>ค่าขนส่ง (Shipping)</span>
                                    <span>{order.shipping_cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}
                            {order.vat_type !== 'no_vat' && (
                                <div className="flex justify-between py-1 border-b border-gray-200 text-gray-500">
                                    <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                                    <span>{order.vat_amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}
                            
                            <div className="flex justify-between py-2 border-b-4 border-double border-gray-800 bg-gray-50 px-2 mt-2 rounded">
                                <span className="font-bold text-sm text-black">ยอดสุทธิ (Total)</span>
                                <span className="font-bold text-base text-black">฿{order.grand_total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="mt-1 text-right text-[10px] text-gray-500 italic">{toThaiBahtText(order.grand_total)}</div>
                        </div>
                    </div>

                    {order.notes && <div className="mt-4 border border-dashed border-gray-300 p-3 rounded bg-gray-50 text-[10px]"><span className="font-bold text-gray-700">หมายเหตุ:</span> {order.notes}</div>}

                    {/* Signature */}
                    <div className="bill-keep flex justify-between items-end mt-8 pt-6 border-t border-gray-200">
                        <div className="text-center w-1/3"><div className="border-b border-black mb-2 h-8"></div><p className="text-xs">ลายเซ็นลูกค้า / Customer Signature</p></div>
                        <div className="text-center w-1/3"><div className="border-b border-black mb-2 h-8"></div><p className="text-xs">ผู้รับเงิน / Receiver Signature</p></div>
                    </div>
                </div>
              )}

              {/* ======================= MODE 2: JOB TAG (S1 - ใบสั่งประกอบ) ======================= */}
              {mode === 'tag' && (
                  <div className="p-[10mm] text-gray-900 bg-white h-full relative border-l-[12px] border-blue-600 flex flex-col min-h-[297mm]">
                      
                      {/* S1 Header - Cool Blue */}
                      <div className="flex justify-between items-start mb-4 pb-2 border-b-2 border-blue-900">
                          <div>
                              <h1 className="text-5xl font-black text-blue-700 leading-none">S1</h1>
                              <p className="text-lg font-bold text-gray-600 mt-0.5 tracking-widest">ใบรายการสั่งประกอบ</p>
                              <p className="text-sm text-blue-500 font-bold uppercase tracking-[0.2em] mt-1">Assembly Order</p>
                          </div>
                          <div className="text-right">
                              <h2 className="text-xl font-bold text-gray-900">MOMENTECH</h2>
                              <p className="text-xs text-gray-500 mt-1">JOB NO: <span className="text-base font-mono font-bold text-black">{order.order_number}</span></p>
                              <p className="text-xs text-gray-500">วันที่: {new Date(order.order_date).toLocaleDateString('th-TH')}</p>
                          </div>
                      </div>

                      {/* Customer Info (Compact & Detailed) */}
                      <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-200 mb-4">
                          <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">ข้อมูลลูกค้า</h3>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="flex items-baseline"><span className="text-gray-500 w-16 shrink-0">ชื่อ-นามสกุล:</span> <span className="font-bold text-sm text-gray-900">{order.customer_cache?.first_name} {order.customer_cache?.last_name}</span></div>
                              <div className="flex items-baseline"><span className="text-gray-500 w-12 shrink-0">ชื่อเล่น:</span> <span className="font-bold text-gray-900">{order.customer_cache?.nickname || '-'}</span></div>
                              <div className="flex items-baseline"><span className="text-gray-500 w-16 shrink-0">เบอร์โทร:</span> <span className="font-bold text-lg text-blue-900">{order.customer_cache?.phone}</span></div>
                              <div className="flex items-baseline overflow-hidden"><span className="text-gray-500 w-12 shrink-0">ที่อยู่:</span> <span className="font-bold text-gray-900 truncate">{order.customer_cache?.address_raw || '-'}</span></div>
                              
                              {/* Social Channels */}
                              <div className="col-span-2 mt-1 pt-1 border-t border-blue-100 flex items-center gap-2">
                                  <span className="text-gray-500 shrink-0">ติดต่อ:</span>
                                  <div className="flex flex-wrap gap-2">
                                      {order.customer_cache?.social_channels?.map((soc, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 bg-white border border-blue-200 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium text-blue-800">
                                              <span className="text-blue-600 font-bold uppercase">{getSocialIcon(soc.type)}:</span> {soc.value}
                                          </span>
                                      ))}
                                      {(!order.customer_cache?.social_channels || order.customer_cache.social_channels.length === 0) && <span>-</span>}
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Work Items (List) */}
                      <div className="flex-1">
                          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1 border-b border-blue-900 pb-1">รายการประกอบ (Parts List)</h3>
                          <table className="w-full text-xs border-collapse">
                              <thead>
                                  <tr className="bg-blue-50 text-blue-900">
                                      <th className="p-1.5 text-center w-8 border-b border-blue-200">#</th>
                                      <th className="p-1.5 text-left border-b border-blue-200">รายการ (Description)</th>
                                      <th className="p-1.5 text-center w-12 border-b border-blue-200">จำนวน</th>
                                      <th className="p-1.5 text-center w-12 border-b border-blue-200">เช็ค</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {order.order_items?.map((item, i) => (
                                      <tr key={i} className="border-b border-gray-200">
                                          <td className="p-2 text-center align-top font-bold text-gray-500">{i+1}</td>
                                          <td className="p-2 align-top">
                                              <p className="font-bold text-sm text-gray-900">{item.product_name}</p>
                                              {item.variant_name && <span className="text-[10px] bg-gray-100 px-1 py-0.5 rounded text-gray-600 mt-0.5 inline-block border border-gray-300">{item.variant_name}</span>}
                                              <BillPaintLine customization={item.customization} size={12} />
                                              {item.sku && <p className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {item.sku}</p>}
                                          </td>
                                          <td className="p-2 text-center align-top font-bold">{item.quantity}</td>
                                          <td className="p-2 text-center align-top"><div className="w-4 h-4 border border-gray-400 rounded mx-auto"></div></td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      {/* Footer Note */}
                      <div className="mt-auto border-t-2 border-blue-900 pt-3">
                          <div className="flex gap-4">
                              <div className="flex-1 border border-gray-300 rounded p-2 h-20">
                                  <p className="text-[10px] text-gray-400 mb-1">หมายเหตุ (Note):</p>
                                  <p className="text-xs text-gray-800">{order.notes || '-'}</p>
                              </div>
                              <div className="w-1/3 text-center flex flex-col justify-end">
                                  <div className="border-b border-black mb-1 h-14"></div>
                                  <p className="text-xs font-bold">ผู้ประกอบ / Technician</p>
                                  <p className="text-[10px] text-gray-400">วันที่ ____/____/____</p>
                              </div>
                              <div className="w-1/3 text-center flex flex-col justify-end">
                                  <div className="border-b border-black mb-1 h-14"></div>
                                  <p className="text-xs font-bold">ผู้ตรวจสอบ (QC)</p>
                                  <p className="text-[10px] text-gray-400">วันที่ ____/____/____</p>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* ======================= MODE 3: CHAT (Simple) ======================= */}
              {mode === 'chat' && (
                  <div style={{ padding: '20px', fontFamily: '"Kanit", sans-serif', backgroundColor: '#ffffff', minHeight: '500px' }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #facc15', paddingBottom: '10px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>MOMENTECH</h1>
                        <p style={{ fontSize: '12px', color: '#6b7280' }}>รายการสินค้าจัดสเปค</p>
                    </div>

                    {/* Info */}
                    <div style={{ marginBottom: '20px' }}>
                        <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>คุณ {order.customer_cache?.first_name}</p>
                        <p style={{ fontSize: '12px', color: '#9ca3af' }}>Order: {order.order_number} | Date: {new Date(order.order_date).toLocaleDateString('th-TH')}</p>
                    </div>

                    {/* List */}
                    <div style={{ marginBottom: '20px' }}>
                        {order.order_items?.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #e5e7eb' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: 0 }}>
                                      {item.product_name}
                                      {item.variant_name && <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '4px' }}>({item.variant_name})</span>}
                                    </p>
                                    <BillPaintLine customization={item.customization} size={10} />
                                    <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>x{item.quantity}</p>
                                </div>
                                <div style={{ fontWeight: 'bold', color: '#1f2937' }}>฿{(item.sell_price * item.quantity).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div style={{ backgroundColor: '#f9fafb', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>ยอดสุทธิ</p>
                        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#4f46e5', margin: 0 }}>฿{order.grand_total?.toLocaleString()}</p>
                    </div>

                    {/* Footer Note */}
                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                        {order.notes && (
                        <p style={{ fontSize: '11px', color: '#854d0e', backgroundColor: '#fefce8', display: 'inline-block', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fef9c3', marginBottom: '15px' }}>
                            <span style={{ fontWeight: 'bold' }}>Note:</span> {order.notes}
                        </p>
                        )}
                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>ขอบคุณที่เลือกใช้บริการ MOMEN ครับ 🙏</p>
                    </div>
                  </div>
              )}

           </div>
        </div>
      </div>
    </div>
  );
};

const toThaiBahtText = (num) => {
  if (!num) return '';
  return '( - จำนวนเงินบาทถ้วน - )'; 
};

export default BillPreview;