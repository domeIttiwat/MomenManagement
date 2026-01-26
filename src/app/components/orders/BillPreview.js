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
    // Load Fonts
    printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Kanit:wght@300;400;500;600&display=swap" rel="stylesheet">');
    // Simple Reset CSS for Print
    printWindow.document.write(`
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; font-family: "Sarabun", sans-serif; -webkit-print-color-adjust: exact; }
        * { box-sizing: border-box; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px 12px; }
      </style>
    `);
    printWindow.document.write('</head><body class="bg-white">');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 1000);
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

  // --- STYLES (HARDCODED HEX for Stability) ---
  const styles = {
    chatContainer: {
      fontFamily: '"Kanit", sans-serif',
      backgroundColor: '#ffffff',
      minHeight: '600px',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: '30px',
      position: 'relative'
    },
    chatHeader: {
      backgroundColor: '#111827', // Gray 900
      color: '#facc15', // Yellow 400
      padding: '30px 20px',
      textAlign: 'center',
      borderBottomLeftRadius: '40px',
      borderBottomRightRadius: '40px',
      marginBottom: '20px'
    },
    chatCard: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
      border: '1px solid #f3f4f6',
      padding: '20px',
      textAlign: 'center',
      marginBottom: '20px'
    },
    textDark: { color: '#1f2937' },
    textGray: { color: '#6b7280' },
    textLight: { color: '#9ca3af' },
    borderDashed: { borderBottom: '1px dashed #e5e7eb', margin: '20px 0' }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
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
            // ใช้ inline style สำหรับ width/height เพื่อความแน่นอน และ class ที่ไม่ซับซ้อน
            style={{
                width: mode === 'official' ? '210mm' : '400px',
                minHeight: mode === 'official' ? '297mm' : 'auto',
                backgroundColor: '#ffffff',
                boxShadow: mode === 'official' ? '0 10px 30px rgba(0,0,0,0.1)' : 'none',
                margin: '0 auto'
            }}
          >
            
            {/* =================================================================================
                                          MODE 1: OFFICIAL (New Modern Design)
               ================================================================================= */}
            {mode === 'official' && (
              <div className="p-[15mm] text-gray-800 relative min-h-[297mm] flex flex-col" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                
                {/* 1. Modern Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                  <div style={{ width: '60%' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#1e1b4b', letterSpacing: '-0.5px' }}>บริษัท ไทยฟรอสเทค จำกัด</h1>
                    <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      97 หมู่ 1 ซอยรังสิต-นครนายก 64 ต.ประชาธิปัตย์<br/>
                      อ.ธัญบุรี จ.ปทุมธานี 12130<br/>
                      <span style={{ color: '#374151', fontWeight: 600 }}>โทร:</span> 093-121-5740
                      {order.show_tax_id && <span> &nbsp;|&nbsp; <span style={{ color: '#374151', fontWeight: 600 }}>Tax ID:</span> 0105551234567</span>}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', textTransform: 'uppercase', color: '#1e1b4b', marginBottom: '2px' }}>
                      {docTitle}
                    </h2>
                    <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', fontWeight: 600 }}>{docTitleEn}</p>
                    
                    <div style={{ marginTop: '15px' }}>
                       <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                          <span style={{ color: '#9ca3af', fontSize: '12px', marginRight: '8px' }}>เลขที่:</span> 
                          <span style={{ fontWeight: 'bold' }}>{order.order_number}</span>
                       </div>
                       {hasInvoiceNumber && (
                           <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                              <span style={{ color: '#9ca3af', fontSize: '12px', marginRight: '8px' }}>TAX Inv:</span> 
                              <span style={{ fontWeight: 'bold', color: '#4f46e5' }}>{order.invoice_number}</span>
                           </div>
                       )}
                       <div style={{ fontSize: '14px', color: '#374151' }}>
                          <span style={{ color: '#9ca3af', fontSize: '12px', marginRight: '8px' }}>วันที่:</span> 
                          <span>{new Date(order.order_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* 2. Customer Section (Clean Box) */}
                <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex' }}>
                     <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>ลูกค้า (Bill To)</h3>
                        <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                            {order.customer_cache?.first_name} {order.customer_cache?.last_name}
                        </p>
                        <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.5', maxWidth: '300px' }}>
                            {order.customer_cache?.address_raw || '-'}
                        </p>
                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#4b5563' }}>
                             <span style={{ fontWeight: 600 }}>โทร:</span> {order.customer_cache?.phone}
                             {order.show_tax_id && order.customer_cache?.tax_id && (
                                <span style={{ marginLeft: '15px' }}><span style={{ fontWeight: 600 }}>Tax ID:</span> {order.customer_cache.tax_id}</span>
                             )}
                        </div>
                     </div>
                     {order.status === 'Paid' && (
                        <div style={{ alignSelf: 'center', border: '2px solid #10b981', color: '#10b981', padding: '8px 20px', borderRadius: '8px', transform: 'rotate(-10deg)', fontSize: '18px', fontWeight: 'bold', opacity: 0.8 }}>
                            PAID
                        </div>
                     )}
                  </div>
                </div>

                {/* 3. Items Table (Minimalist) */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '12px 10px', textAlign: 'left', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', width: '50px' }}>#</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>รายการ (Description)</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', width: '80px' }}>จำนวน</th>
                      <th style={{ padding: '12px 10px', textAlign: 'right', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', width: '120px' }}>ราคา/หน่วย</th>
                      <th style={{ padding: '12px 10px', textAlign: 'right', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', width: '120px' }}>จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items?.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 10px', color: '#9ca3af', verticalAlign: 'top' }}>{i+1}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                          <p style={{ margin: 0, fontWeight: '600', color: '#1f2937' }}>{item.product_name}</p>
                          {item.variant_name && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>{item.variant_name}</p>}
                          {item.sku && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{item.sku}</p>}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'top', color: '#4b5563' }}>{item.quantity}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'top', color: '#4b5563' }}>{item.sell_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'top', fontWeight: '600', color: '#111827' }}>{ (item.sell_price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2}) }</td>
                      </tr>
                    ))}
                    {/* Spacer to push footer */}
                    <tr style={{ height: 'auto' }}><td colSpan={5}></td></tr>
                  </tbody>
                </table>

                {/* 4. Footer & Summary */}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   {/* Left: Notes & Text Total */}
                   <div style={{ width: '50%', paddingRight: '20px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                         <p style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af' }}>หมายเหตุ (Note)</p>
                         <p>{order.notes || '-'}</p>
                      </div>
                      <div style={{ marginTop: '15px', fontSize: '13px', color: '#4b5563', fontStyle: 'italic' }}>
                         ( {toThaiBahtText(order.grand_total)} )
                      </div>
                   </div>

                   {/* Right: Numbers */}
                   <div style={{ width: '40%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px', color: '#4b5563' }}>
                        <span>รวมเป็นเงิน</span>
                        <span style={{ fontWeight: 500 }}>{order.subtotal?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      {order.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px', color: '#ef4444' }}>
                          <span>หักส่วนลด</span>
                          <span>-{order.discount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px', color: '#4b5563' }}>
                        <span>ค่าขนส่ง</span>
                        <span>{order.shipping_cost === 0 ? '-' : order.shipping_cost?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      {order.vat_type !== 'no_vat' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px', color: '#4b5563' }}>
                          <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                          <span>{order.vat_amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', marginTop: '10px', borderTop: '2px solid #1f2937', fontSize: '18px', color: '#111827' }}>
                        <span style={{ fontWeight: 'bold' }}>จำนวนเงินสุทธิ</span>
                        <span style={{ fontWeight: '800', color: '#1e1b4b' }}>฿{order.grand_total?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                   </div>
                </div>

                {/* 5. Signature Area */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', paddingTop: '30px' }}>
                   <div style={{ textAlign: 'center', width: '35%' }}>
                      <div style={{ borderBottom: '1px solid #d1d5db', height: '40px', marginBottom: '10px' }}></div>
                      <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>ผู้รับวางบิล / ผู้รับสินค้า</p>
                      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>วันที่ ______/______/______</p>
                   </div>
                   <div style={{ textAlign: 'center', width: '35%' }}>
                      <div style={{ borderBottom: '1px solid #d1d5db', height: '40px', marginBottom: '10px' }}></div>
                      <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>ผู้มีอำนาจลงนาม</p>
                      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>วันที่ {new Date().toLocaleDateString('th-TH')}</p>
                   </div>
                </div>

              </div>
            )}

            {/* =================================================================================
                                          MODE 2: CHAT SUMMARY (Pure Inline Style)
               ================================================================================= */}
            {mode === 'chat' && (
              <div style={styles.chatContainer}>
                
                {/* Brand Header Bar */}
                <div style={styles.chatHeader}>
                  <h1 style={{ fontSize: '36px', fontWeight: '900', letterSpacing: '2px', margin: 0, color: '#facc15', lineHeight: 1 }}>MOMEN</h1>
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '4px', opacity: 0.8, marginTop: '5px', color: '#d1d5db' }}>Technology</p>
                </div>

                <div style={{ padding: '0 25px', flex: 1, marginTop: '-20px', position: 'relative', zIndex: 10 }}>
                  
                  {/* Order Summary Card */}
                  <div style={styles.chatCard}>
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