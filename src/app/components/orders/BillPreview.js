import React, { useState, useRef } from 'react';
import { X, Download, Share2, Printer, Copy, Check, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

const BillPreview = ({ order, onClose }) => {
  const [mode, setMode] = useState('official'); // 'official' | 'chat'
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef(null);

  if (!order) return null;

  const handlePrint = () => {
    const printContent = contentRef.current.innerHTML;
    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write('<html><head><title>Print Bill</title>');
    // ใส่ Tailwind CDN สำหรับหน้าพิมพ์
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    // Load Fonts: Sarabun & Kanit
    printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Kanit:wght@300;400;500;600&display=swap" rel="stylesheet">');
    
    // Custom CSS สำหรับการพิมพ์
    printWindow.document.write(`
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; -webkit-print-color-adjust: exact; font-family: 'Sarabun', sans-serif; }
        .print-container { padding: 10mm; min-height: 297mm; position: relative; }
      </style>
    `);
    
    printWindow.document.write('</head><body class="bg-white">');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
    // รอให้โหลด Style/Font เสร็จก่อนพิมพ์
    setTimeout(() => {
      printWindow.print();
    }, 1500);
  };

  const handleDownloadImage = async () => {
    if (!contentRef.current) return;
    setDownloading(true);

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 3, 
        useCORS: true,
        backgroundColor: '#ffffff', 
        logging: false,
        foreignObjectRendering: false,
        imageTimeout: 0,
        removeContainer: true
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `MOMEN-Order-${order.order_number}.png`;
      link.click();
    } catch (error) {
      console.error("Error generating image:", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const hasInvoiceNumber = order.invoice_number && order.invoice_number.trim().length > 0;
  const isTaxInvoice = order.show_tax_id && hasInvoiceNumber;
  const docTitle = order.status === 'Paid' || order.status === 'Completed' 
    ? (isTaxInvoice ? 'ใบเสร็จรับเงิน / ใบกำกับภาษี' : 'ใบเสร็จรับเงิน')
    : 'ใบเสนอราคา';
  const docTitleEn = order.status === 'Paid' || order.status === 'Completed'
    ? (isTaxInvoice ? 'RECEIPT / TAX INVOICE' : 'RECEIPT')
    : 'QUOTATION';

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      {/* เพิ่มลิงก์ฟอนต์ในหน้า Preview นี้ด้วย เพื่อให้แสดงผลถูกต้องก่อนพิมพ์ */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Kanit:wght@300;400;500;600&display=swap');
      `}</style>

      <div className="bg-white w-full max-w-5xl h-[95vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header Tools */}
        <div className="bg-gray-900 text-white p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex bg-gray-800 p-1 rounded-lg">
            <button 
              onClick={() => setMode('official')} 
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === 'official' ? 'bg-white text-gray-900 shadow' : 'text-gray-400 hover:text-white'}`}
            >
              ทางการ (A4)
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
              <button 
                onClick={handleDownloadImage} 
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-900/50 disabled:opacity-50"
              >
                {downloading ? <Loader2 size={18} className="animate-spin"/> : <Share2 size={18}/>} 
                บันทึกรูป
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg ml-2 transition-colors"><X size={24}/></button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-y-auto bg-gray-200/50 p-4 sm:p-8 flex justify-center items-start">
          
          <div 
            ref={contentRef} 
            className={mode === 'official' ? "bg-white shadow-2xl print:shadow-none" : ""}
            style={{
                width: mode === 'official' ? '210mm' : '400px',
                minHeight: mode === 'official' ? '297mm' : 'auto',
                backgroundColor: '#ffffff',
                // Box shadow only for visual preview
                boxShadow: mode === 'official' ? '0 10px 30px rgba(0,0,0,0.1)' : 'none',
                margin: '0 auto'
            }}
          >
            
            {/* =================================================================================
                                          MODE 1: OFFICIAL (Modern Professional Redesign)
               ================================================================================= */}
            {mode === 'official' && (
              <div className="print-container p-[10mm] text-gray-900 relative min-h-[297mm] flex flex-col" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                
                {/* 1. Header & Brand */}
                <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-100">
                  <div className="w-2/3 pr-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">บริษัท ไทยฟรอสเทค จำกัด</h1>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      97 หมู่ 1 ซอยรังสิต-นครนายก 64 ต.ประชาธิปัตย์<br/>
                      อ.ธัญบุรี จ.ปทุมธานี 12130
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                       <span className="flex items-center gap-1"><span className="font-bold text-gray-700">โทร:</span> 093-121-5740</span>
                       {order.show_tax_id && <span className="flex items-center gap-1 border-l pl-4 border-gray-300"><span className="font-bold text-gray-700">เลขประจำตัวผู้เสียภาษี:</span> 0105551234567</span>}
                    </div>
                  </div>
                  <div className="w-1/3 text-right">
                    <div className="inline-block">
                        <h2 className="text-xl font-bold uppercase tracking-wider text-indigo-900 mb-1">
                        {docTitle}
                        </h2>
                        <p className="text-[10px] font-bold text-gray-400 tracking-[0.3em] border-t border-gray-200 pt-1">{docTitleEn}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Info Grid */}
                <div className="flex gap-8 mb-8">
                  {/* Customer Block */}
                  <div className="flex-1 bg-gray-50/50 rounded-lg p-4 border border-gray-100">
                    <h3 className="text-[10px] font-bold text-indigo-500 uppercase mb-3 tracking-wider">ข้อมูลลูกค้า (Customer)</h3>
                    <p className="font-bold text-sm text-gray-900 mb-1">{order.customer_cache?.first_name} {order.customer_cache?.last_name}</p>
                    <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">{order.customer_cache?.address_raw || '-'}</p>
                    <div className="flex flex-col gap-1 text-[11px] text-gray-600">
                        <div><span className="font-semibold text-gray-800">โทร:</span> {order.customer_cache?.phone}</div>
                        {order.show_tax_id && order.customer_cache?.tax_id && (
                             <div><span className="font-semibold text-gray-800">Tax ID:</span> {order.customer_cache.tax_id}</div>
                        )}
                    </div>
                  </div>

                  {/* Document Info Block */}
                  <div className="w-[35%] space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                      <span className="text-[11px] font-semibold text-gray-500">เลขที่เอกสาร</span>
                      <span className="text-sm font-bold text-gray-900">{order.order_number}</span>
                    </div>
                    {hasInvoiceNumber && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-[11px] font-semibold text-gray-500">เลขที่ใบกำกับ</span>
                        <span className="text-sm font-bold text-indigo-700">{order.invoice_number}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                      <span className="text-[11px] font-semibold text-gray-500">วันที่</span>
                      <span className="text-sm font-bold text-gray-900">{new Date(order.order_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    {order.status === 'Paid' && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-[11px] font-semibold text-gray-500">วันที่ชำระ</span>
                        <span className="text-sm font-bold text-green-700">{new Date().toLocaleDateString('th-TH')}</span>
                        </div>
                    )}
                  </div>
                </div>

                {/* 3. Items Table */}
                <div className="mb-6 border rounded-lg border-gray-200 overflow-hidden">
                    <table className="w-full text-[11px] border-collapse">
                    <thead>
                        <tr className="bg-gray-100 text-gray-800 border-b border-gray-200">
                        <th className="py-2.5 px-3 text-center w-12 font-bold border-r border-gray-200">#</th>
                        <th className="py-2.5 px-3 text-left font-bold border-r border-gray-200">รายการสินค้า (Description)</th>
                        <th className="py-2.5 px-3 text-center w-20 font-bold border-r border-gray-200">จำนวน</th>
                        <th className="py-2.5 px-3 text-right w-28 font-bold border-r border-gray-200">ราคา/หน่วย</th>
                        <th className="py-2.5 px-3 text-right w-32 font-bold">รวมเงิน</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {order.order_items?.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-none">
                            <td className="py-2 px-3 text-center text-gray-400 border-r border-gray-100 bg-gray-50/30">{i+1}</td>
                            <td className="py-2 px-3 border-r border-gray-100">
                            <p className="font-bold text-gray-900 text-[12px]">{item.product_name}</p>
                            {item.variant_name && <p className="text-[10px] text-gray-500 mt-0.5 inline-block bg-gray-100 px-1.5 rounded">{item.variant_name}</p>}
                            {item.sku && <p className="text-[9px] text-gray-400 font-mono mt-0.5">SKU: {item.sku}</p>}
                            </td>
                            <td className="py-2 px-3 text-center border-r border-gray-100 font-medium">{item.quantity}</td>
                            <td className="py-2 px-3 text-right border-r border-gray-100">{item.sell_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900">{ (item.sell_price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2}) }</td>
                        </tr>
                        ))}
                        {/* Filler Rows */}
                        {Array.from({ length: Math.max(0, 12 - (order.order_items?.length || 0)) }).map((_, i) => (
                        <tr key={`fill-${i}`} className="border-b border-gray-50 h-8 last:border-none">
                            <td className="border-r border-gray-50 bg-gray-50/10"></td>
                            <td className="border-r border-gray-50"></td>
                            <td className="border-r border-gray-50"></td>
                            <td className="border-r border-gray-50"></td>
                            <td></td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>

                {/* 4. Footer & Totals */}
                <div className="flex justify-end mt-auto">
                  <div className="w-[45%] bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex justify-between py-1 text-[11px] text-gray-600">
                      <span>รวมเป็นเงิน (Subtotal)</span>
                      <span className="font-medium">{order.subtotal?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between py-1 text-[11px] text-red-600">
                        <span>หักส่วนลด (Discount)</span>
                        <span>-{order.discount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 text-[11px] text-gray-600">
                      <span>ค่าขนส่ง (Shipping)</span>
                      <span>{order.shipping_cost === 0 ? '-' : order.shipping_cost?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    {order.vat_type !== 'no_vat' && (
                      <div className="flex justify-between py-1 text-[11px] text-gray-600">
                        <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                        <span>{order.vat_amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    )}
                    
                    <div className="my-2 border-t border-gray-300"></div>

                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-gray-900">จำนวนเงินสุทธิ (Total)</span>
                      <span className="font-bold text-lg text-indigo-900">฿{order.grand_total?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="mt-1 text-right text-[10px] text-gray-500 italic">
                      {toThaiBahtText(order.grand_total)}
                    </div>
                  </div>
                </div>

                {/* 5. Signatures Area */}
                <div className="flex justify-between items-end mt-12 pt-6 border-t border-gray-200">
                  <div className="text-center w-1/3">
                    <div className="h-10 border-b border-dotted border-gray-400 mb-2"></div>
                    <p className="text-[11px] font-bold text-gray-700">ผู้รับวางบิล / ผู้รับสินค้า</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">วันที่ ______/______/______</p>
                  </div>
                  <div className="text-center w-1/3">
                    <div className="h-10 border-b border-dotted border-gray-400 mb-2"></div>
                    <p className="text-[11px] font-bold text-gray-700">ผู้มีอำนาจลงนาม</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">วันที่ {new Date().toLocaleDateString('th-TH')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================================
                                          MODE 2: CHAT SUMMARY (Pure Inline Style)
               ================================================================================= */}
            {mode === 'chat' && (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', paddingBottom: '30px', fontFamily: '"Kanit", sans-serif', backgroundColor: '#ffffff', minHeight: '600px' }}>
                
                {/* Brand Header Bar */}
                <div style={{ backgroundColor: '#111827', color: '#facc15', padding: '30px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden', borderBottomLeftRadius: '40px', borderBottomRightRadius: '40px' }}>
                  {/* เปลี่ยน Gradient เป็น rgba เพื่อให้ html2canvas อ่านได้ */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.1, background: 'radial-gradient(circle at top right, rgba(255,255,255,1), rgba(255,255,255,0))' }}></div>
                  <h1 style={{ fontSize: '36px', fontWeight: '900', letterSpacing: '2px', margin: 0, color: '#facc15', lineHeight: 1 }}>MOMEN</h1>
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '4px', opacity: 0.8, marginTop: '5px', color: '#d1d5db' }}>Technology</p>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px', backgroundColor: '#facc15' }}></div>
                </div>

                <div style={{ padding: '0 25px', flex: 1, marginTop: '-20px', position: 'relative', zIndex: 10 }}>
                  
                  {/* Order Summary Card */}
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
                    <p style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '5px' }}>รายการสั่งซื้อ</p>
                    <p style={{ color: '#111827', fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>#{order.order_number}</p>
                    <p style={{ color: '#6b7280', fontSize: '12px' }}>{new Date(order.order_date).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
                    
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #e5e7eb' }}>
                      <p style={{ color: '#1f2937', fontWeight: '600', fontSize: '18px' }}>คุณ {order.customer_cache?.first_name}</p>
                      {order.customer_cache?.nickname && <p style={{ color: '#9ca3af', fontSize: '14px' }}>({order.customer_cache?.nickname})</p>}
                    </div>
                  </div>

                  {/* Items List */}
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '5px', marginBottom: '10px' }}>รายการสินค้า</p>
                    {order.order_items?.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1, paddingRight: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#1f2937', fontWeight: '600', fontSize: '14px' }}>{item.product_name}</span>
                            <span style={{ color: '#6b7280', fontSize: '11px', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '10px' }}>x{item.quantity}</span>
                          </div>
                          {item.variant_name && <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{item.variant_name}</p>}
                        </div>
                        <div style={{ color: '#111827', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>฿{(item.sell_price * item.quantity).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px dashed #d1d5db', margin: '20px 0' }}></div>

                  {/* Totals */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280', marginBottom: '5px' }}>
                      <span>รวมสินค้า</span>
                      <span>฿{order.subtotal?.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280', marginBottom: '5px' }}>
                      <span>ค่าจัดส่ง</span>
                      <span>{order.shipping_cost === 0 ? 'ฟรี' : `฿${order.shipping_cost.toLocaleString()}`}</span>
                    </div>
                    {order.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444', marginBottom: '5px' }}>
                        <span>ส่วนลด</span>
                        <span>-฿{order.discount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Grand Total */}
                  <div style={{ backgroundColor: '#111827', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)' }}>
                    <span style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>ยอดชำระสุทธิ</span>
                    <span style={{ fontSize: '32px', fontWeight: '900', color: '#facc15' }}>฿{order.grand_total?.toLocaleString()}</span>
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