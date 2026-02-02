import React, { useState, useRef } from 'react';
import { X, Printer, Tag, FileText, Share2, Loader2, MessageCircle, Facebook, Instagram, Phone } from 'lucide-react';
import html2canvas from 'html2canvas';

const ServiceBillPreview = ({ service, onClose }) => {
  const [mode, setMode] = useState('official'); // 'official' | 'chat' | 'tag'
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef(null);

  if (!service) return null;

  const handlePrint = () => {
    const printContent = contentRef.current.innerHTML;
    const win = window.open('', '', 'height=800,width=800');
    
    win.document.write('<html><head><title>Job Document</title>');
    // Load Fonts & Tailwind
    win.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    win.document.write('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&family=Kanit:wght@300;400;600;700&display=swap" rel="stylesheet">');
    
    // CSS Setup สำหรับการพิมพ์โดยเฉพาะ
    win.document.write(`
      <style>
        @page { size: A4; margin: 0; } 
        body { 
            margin: 0; 
            padding: 0; 
            background-color: white;
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
        }
        /* บังคับขนาด A4 และฟอนต์ให้เหมือนต้นฉบับ */
        .print-wrapper {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: white;
            position: relative;
            /* เลือกฟอนต์ตามโหมด (Tag/Chat ใช้ Kanit, Official ใช้ Sarabun) */
            font-family: ${mode === 'official' ? '"Sarabun", sans-serif' : '"Kanit", sans-serif'};
        }
        /* แก้ปัญหา Tailwind ในโหมด Print */
        * { box-sizing: border-box; }
        table { border-collapse: collapse; width: 100%; }
      </style>
    `);
    
    win.document.write('</head><body>');
    // สร้าง Wrapper หุ้มเนื้อหาเพื่อกำหนดขนาดและฟอนต์
    win.document.write('<div class="print-wrapper">');
    win.document.write(printContent);
    win.document.write('</div>');
    win.document.write('</body></html>');
    
    win.document.close();
    
    // รอให้โหลด Tailwind และ Font เสร็จก่อนพิมพ์
    setTimeout(() => {
        win.focus();
        win.print();
    }, 2000);
  };

  const handleDownloadImage = async () => {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        removeContainer: true
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `MOMEN-Service-${service.service_number}-${mode}.png`;
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
    return type;
  };

  const isCompleted = ['Done', 'Delivered', 'Completed'].includes(service.status);
  const docTitle = isCompleted ? 'ใบเสร็จรับเงิน / ใบส่งของ' : 'ใบรับซ่อม / JOB ORDER';
  const docTitleEn = isCompleted ? 'RECEIPT / DELIVERY NOTE' : 'SERVICE ORDER';

  // --- Logic คำนวณยอดเงินสำหรับแสดงผล ---
  let displaySubtotal = service.subtotal;
  let displayDiscount = service.discount;
  
  // ถ้าเป็น Include VAT ให้ถอด VAT ออกจากยอดรวมและส่วนลด เพื่อแสดงเป็นฐานภาษี
  if (service.vat_type === 'include') {
    displaySubtotal = service.subtotal / 1.07;
    displayDiscount = service.discount / 1.07;
  }

  // คำนวณยอดหลังหักส่วนลด (ก่อนภาษี/ขนส่ง) เพื่อเช็คความถูกต้อง (Optional Debug)
  // const afterDisc = displaySubtotal - displayDiscount;

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
                <Tag size={16}/> ใบงาน (S2)
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
                 // Inline style เพื่อความชัวร์เวลา save image
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
                            97 หมู่ 1 ซอยรังสิต-นครนายก 64 ต.ประชาธิปัตย์<br/>
                            อ.ธัญบุรี จ.ปทุมธานี 12130<br/>
                            โทร: 093-121-5740
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

                    {/* Info */}
                    <div className="flex justify-between mb-6 text-[11px]">
                        <div className="w-[55%] border border-gray-300 p-3 rounded-lg">
                            <h3 className="font-bold text-gray-900 uppercase mb-2 border-b border-gray-100 pb-1">ข้อมูลลูกค้า (Customer)</h3>
                            <div className="space-y-1">
                                <p className="text-sm font-bold">{service.customer_cache?.first_name} {service.customer_cache?.last_name} {service.customer_cache?.nickname ? `(${service.customer_cache.nickname})` : ''}</p>
                                <p className="text-gray-600">{service.customer_cache?.address_raw || '-'}</p>
                                <p className="text-gray-600"><span className="font-semibold text-gray-800">โทร:</span> {service.customer_cache?.phone}</p>
                                {service.show_tax_id && service.customer_cache?.tax_id && (
                                   <p className="text-gray-600"><span className="font-semibold text-gray-800">Tax ID:</span> {service.customer_cache?.tax_id}</p>
                                )}
                            </div>
                        </div>
                        <div className="w-[40%] border border-gray-300 p-3 rounded-lg bg-gray-50/30">
                            <h3 className="font-bold text-gray-900 uppercase mb-2 border-b border-gray-200 pb-1">รายละเอียด (Details)</h3>
                            <div className="space-y-1.5">
                                <div className="flex justify-between"><span className="text-gray-500">เลขที่ใบงาน:</span> <span className="font-bold text-sm">{service.service_number}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">วันที่รับรถ:</span> <span className="font-bold">{new Date(service.received_date).toLocaleDateString('th-TH')}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">วันนัดรับ:</span> <span className="font-bold">{service.appointment_date ? new Date(service.appointment_date).toLocaleDateString('th-TH') : '-'}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">ผู้รับรถ:</span> <span className="font-medium">{service.service_assignees?.[0]?.user?.first_name || '-'}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full mb-4 text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-800 font-bold border-y border-black">
                            <th className="py-2 px-3 text-center w-12 border-r border-gray-300">#</th>
                            <th className="py-2 px-3 text-left border-r border-gray-300">รายการ (Description)</th>
                            <th className="py-2 px-3 text-center w-24 border-r border-gray-300">จำนวน</th>
                            <th className="py-2 px-3 text-right w-28 border-r border-gray-300">ราคา/หน่วย</th>
                            <th className="py-2 px-3 text-right w-32">จำนวนเงิน</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-700">
                            {service.service_items?.map((item, i) => (
                            <React.Fragment key={i}>
                                <tr className="border-b border-gray-200">
                                    <td className="py-2 px-3 text-center align-top border-r border-gray-200 text-gray-500">{i+1}</td>
                                    <td className="py-2 px-3 align-top border-r border-gray-200">
                                        <p className="font-bold text-gray-900">{item.description}</p>
                                        <span className="text-[9px] bg-gray-100 px-1.5 rounded text-gray-500 mt-1 inline-block">{item.type}</span>
                                        {/* Sub Items */}
                                        {item.sub_items && item.sub_items.length > 0 && (
                                            <ul className="list-disc list-inside mt-1 text-[10px] text-gray-500 pl-2">
                                                {item.sub_items.map((sub, idx) => (
                                                    <li key={idx}>{sub.description}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-center align-top border-r border-gray-200">{item.quantity}</td>
                                    <td className="py-2 px-3 text-right align-top border-r border-gray-200">
                                        {/* กรณี Include VAT ราคาต่อหน่วยในตารางอาจแสดงเต็มหรือถอด VAT ก็ได้ แต่ปกติใบเสร็จย่อยมักแสดงเต็ม แต่ที่นี่เราถอดที่ Total ถ้าจะให้เป๊ะควรถอดที่นี่ด้วย แต่เพื่อความไม่งงของ User ทั่วไป อาจแสดงเต็ม แล้วไปถอดที่ Summary */}
                                        {/* ในที่นี้ขอแสดงราคาเต็มที่กรอกมา เพื่อไม่ให้ลูกค้าสับสนว่าทำไมราคาไม่ตรงป้าย */}
                                        {item.sell_price.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                    <td className="py-2 px-3 text-right align-top font-bold text-gray-900">{(item.sell_price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                </tr>
                            </React.Fragment>
                            ))}
                            {/* Filler */}
                            {Array.from({length: Math.max(0, 10 - (service.service_items?.length||0))}).map((_,i) => (
                                <tr key={`fill-${i}`} className="border-b border-gray-100 h-8">
                                    <td className="border-r border-gray-200"></td><td className="border-r border-gray-200"></td><td className="border-r border-gray-200"></td><td className="border-r border-gray-200"></td><td></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Footer */}
                    <div className="flex justify-end mt-auto">
                        <div className="w-[45%] text-[11px]">
                            <div className="flex justify-between py-1 border-b border-gray-200">
                                <span className="font-bold text-gray-600">
                                    {service.vat_type === 'include' ? 'รวมเป็นเงิน (ก่อน VAT)' : 'รวมเป็นเงิน (Subtotal)'}
                                </span>
                                <span className="font-medium">{displaySubtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            {service.discount > 0 && (
                                <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                                    <span>
                                        {service.vat_type === 'include' ? 'ส่วนลด (ก่อน VAT)' : 'ส่วนลด (Discount)'}
                                    </span>
                                    <span>-{displayDiscount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}
                            {service.shipping_cost > 0 && (
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span>ค่าขนส่ง (Shipping)</span>
                                    <span>{service.shipping_cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}
                            {service.vat_type !== 'no_vat' && (
                                <div className="flex justify-between py-1 border-b border-gray-200 text-gray-500">
                                    <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                                    <span>{service.vat_amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}
                            
                            <div className="flex justify-between py-2 border-b-4 border-double border-gray-800 bg-gray-50 px-2 mt-2 rounded">
                                <span className="font-bold text-sm text-black">ยอดสุทธิ (Total)</span>
                                <span className="font-bold text-base text-black">฿{service.grand_total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="mt-1 text-right text-[10px] text-gray-500 italic">{toThaiBahtText(service.grand_total)}</div>
                        </div>
                    </div>

                    {service.notes && <div className="mt-4 border border-dashed border-gray-300 p-3 rounded bg-gray-50 text-[10px]"><span className="font-bold text-gray-700">หมายเหตุ:</span> {service.notes}</div>}

                    {/* Signature */}
                    <div className="flex justify-between items-end mt-8 pt-6 border-t border-gray-200">
                        <div className="text-center w-1/3"><div className="border-b border-black mb-2 h-8"></div><p className="text-xs">ลายเซ็นลูกค้า / Customer Signature</p></div>
                        <div className="text-center w-1/3"><div className="border-b border-black mb-2 h-8"></div><p className="text-xs">ผู้รับรถ / Receiver Signature</p></div>
                    </div>
                </div>
              )}

              {/* ======================= MODE 2: JOB TAG (S2 - สำหรับช่าง) ======================= */}
              {mode === 'tag' && (
                  <div className="p-[10mm] text-gray-900 bg-white h-full relative border-l-[12px] border-orange-500 flex flex-col min-h-[297mm]">
                      
                      {/* S2 Header - Compact & Orange */}
                      <div className="flex justify-between items-start mb-4 pb-2 border-b-2 border-gray-800">
                          <div>
                              <h1 className="text-5xl font-black text-orange-600 leading-none">S2</h1>
                              <p className="text-lg font-bold text-gray-600 mt-0.5 tracking-widest">เอกสารงานซ่อม</p>
                          </div>
                          <div className="text-right">
                              <h2 className="text-xl font-bold text-gray-900">MOMENTECH</h2>
                              <p className="text-xs text-gray-500 mt-1">JOB NO: <span className="text-base font-mono font-bold text-black">{service.service_number}</span></p>
                              <p className="text-xs text-gray-500">วันที่: {new Date(service.received_date).toLocaleDateString('th-TH')}</p>
                          </div>
                      </div>

                      {/* Customer Info (Compact) */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mb-4">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ข้อมูลลูกค้า</h3>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="flex items-baseline"><span className="text-gray-500 w-16 shrink-0">ชื่อ-นามสกุล:</span> <span className="font-bold text-sm text-gray-900">{service.customer_cache?.first_name} {service.customer_cache?.last_name}</span></div>
                              <div className="flex items-baseline"><span className="text-gray-500 w-12 shrink-0">ชื่อเล่น:</span> <span className="font-bold text-gray-900">{service.customer_cache?.nickname || '-'}</span></div>
                              <div className="flex items-baseline"><span className="text-gray-500 w-16 shrink-0">เบอร์โทร:</span> <span className="font-bold text-lg">{service.customer_cache?.phone}</span></div>
                              <div className="flex items-baseline overflow-hidden"><span className="text-gray-500 w-12 shrink-0">ที่อยู่:</span> <span className="font-bold text-gray-900 truncate">{service.customer_cache?.address_raw || '-'}</span></div>
                              
                              {/* Social Channels */}
                              <div className="col-span-2 mt-1 pt-1 border-t border-gray-200 flex items-center gap-2">
                                  <span className="text-gray-500 shrink-0">ติดต่อ:</span>
                                  <div className="flex flex-wrap gap-2">
                                      {service.customer_cache?.social_channels?.map((soc, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 bg-white border border-gray-300 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium">
                                              <span className="text-orange-600 font-bold uppercase">{getSocialIcon(soc.type)}:</span> {soc.value}
                                          </span>
                                      ))}
                                      {(!service.customer_cache?.social_channels || service.customer_cache.social_channels.length === 0) && <span>-</span>}
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Work Items (List) */}
                      <div className="flex-1">
                          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1 border-b border-black pb-1">รายการที่ต้องทำ (Work List)</h3>
                          <table className="w-full text-xs border-collapse">
                              <thead>
                                  <tr className="bg-gray-100 text-gray-700">
                                      <th className="p-1.5 text-center w-8 border-b border-gray-300">#</th>
                                      <th className="p-1.5 text-left border-b border-gray-300">รายการ (Description)</th>
                                      <th className="p-1.5 text-center w-12 border-b border-gray-300">จำนวน</th>
                                      <th className="p-1.5 text-center w-12 border-b border-gray-300">เช็ค</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {service.service_items?.map((item, i) => (
                                      <React.Fragment key={i}>
                                          <tr className="border-b border-gray-200">
                                              <td className="p-2 text-center align-top font-bold text-gray-500">{i+1}</td>
                                              <td className="p-2 align-top">
                                                  <p className="font-bold text-sm text-gray-900">{item.description}</p>
                                                  <span className="text-[10px] bg-gray-100 px-1 py-0.5 rounded text-gray-500 mt-0.5 inline-block">{item.type}</span>
                                                  
                                                  {/* Sub Items */}
                                                  {item.sub_items && item.sub_items.length > 0 && (
                                                      <div className="mt-1 pl-3 border-l-2 border-gray-300 space-y-0.5">
                                                          {item.sub_items.map((sub, idx) => (
                                                              <div key={idx} className="flex justify-between text-xs text-gray-600">
                                                                  <span>• {sub.description}</span>
                                                                  <span className="text-[10px] text-gray-400">x{sub.qty}</span>
                                                              </div>
                                                          ))}
                                                      </div>
                                                  )}
                                              </td>
                                              <td className="p-2 text-center align-top font-bold">{item.quantity}</td>
                                              <td className="p-2 text-center align-top"><div className="w-4 h-4 border border-gray-400 rounded mx-auto"></div></td>
                                          </tr>
                                      </React.Fragment>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      {/* Footer Note */}
                      <div className="mt-auto border-t-2 border-gray-800 pt-3">
                          <div className="flex gap-4">
                              <div className="flex-1 border border-gray-300 rounded p-2 h-20">
                                  <p className="text-[10px] text-gray-400 mb-1">หมายเหตุช่าง:</p>
                              </div>
                              <div className="w-1/3 text-center">
                                  <div className="border-b border-black mb-1 h-14"></div>
                                  <p className="text-xs font-bold">ผู้รับผิดชอบงาน</p>
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
                        <p style={{ fontSize: '12px', color: '#6b7280' }}>Service & Repair</p>
                    </div>

                    {/* Info */}
                    <div style={{ marginBottom: '20px' }}>
                        <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>คุณ {service.customer_cache?.first_name}</p>
                        <p style={{ fontSize: '12px', color: '#9ca3af' }}>Job: {service.service_number} | Date: {new Date(service.received_date).toLocaleDateString('th-TH')}</p>
                    </div>

                    {/* List */}
                    <div style={{ marginBottom: '20px' }}>
                        {service.service_items?.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #e5e7eb' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: 0 }}>{item.description}</p>
                                    <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>x{item.quantity}</p>
                                </div>
                                <div style={{ fontWeight: 'bold', color: '#1f2937' }}>฿{(item.sell_price * item.quantity).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div style={{ backgroundColor: '#f9fafb', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>ยอดสุทธิ</p>
                        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#4f46e5', margin: 0 }}>฿{service.grand_total?.toLocaleString()}</p>
                    </div>
                  </div>
              )}

           </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceBillPreview;