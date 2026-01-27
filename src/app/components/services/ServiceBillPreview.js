import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';

const ServiceBillPreview = ({ service, onClose }) => {
  const contentRef = useRef(null);

  const handlePrint = () => {
    const printContent = contentRef.current.innerHTML;
    const win = window.open('', '', 'height=800,width=800');
    win.document.write('<html><head><title>Job Order</title>');
    win.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    win.document.write('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">');
    win.document.write('<style>@page { size: A4; margin: 0; } body { margin: 0; -webkit-print-color-adjust: exact; font-family: "Sarabun", sans-serif; } * { box-sizing: border-box; }</style>');
    win.document.write('</head><body class="bg-white">');
    win.document.write(printContent);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => win.print(), 1000);
  };

  const toThaiBahtText = (num) => {
    if (!num) return '';
    return '( - จำนวนเงินบาทถ้วน - )'; // ในโปรเจกต์จริงใช้ library แปลง
  };

  const isCompleted = ['Done', 'Delivered', 'Completed'].includes(service.status);
  const docTitle = isCompleted ? 'ใบเสร็จรับเงิน / ใบส่งของ' : 'ใบรับซ่อม / JOB ORDER';
  const docTitleEn = isCompleted ? 'RECEIPT / DELIVERY NOTE' : 'SERVICE ORDER';

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-5xl h-[95vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="bg-gray-900 p-4 flex justify-between items-center text-white shrink-0">
          <div className="font-bold text-lg">ตัวอย่างเอกสาร (Preview)</div>
          <div className="flex gap-2">
             <button onClick={handlePrint} className="flex gap-2 items-center bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-lg shadow-indigo-900/50"><Printer size={18}/> พิมพ์ / PDF</button>
             <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-gray-200 p-8 flex justify-center items-start">
           <div ref={contentRef} className="bg-white w-[210mm] min-h-[297mm] p-[10mm] text-gray-900 shadow-xl print:shadow-none relative flex flex-col">
              
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                 <div className="w-2/3 pr-8">
                    <h1 className="text-xl font-bold text-gray-900 mb-1">บริษัท ไทยฟรอสเทค จำกัด</h1>
                    <p className="text-[11px] text-gray-600 leading-snug">
                      97 หมู่ 1 ซอยรังสิต-นครนายก 64 ต.ประชาธิปัตย์<br/>
                      อ.ธัญบุรี จ.ปทุมธานี 12130<br/>
                      โทร: 093-121-5740 &nbsp;|&nbsp; เลขประจำตัวผู้เสียภาษี: 0105551234567
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
                        <p className="text-sm font-bold">{service.customer_cache?.first_name} {service.customer_cache?.last_name}</p>
                        <p className="text-gray-600">{service.customer_cache?.address_raw || '-'}</p>
                        <p className="text-gray-600"><span className="font-semibold text-gray-800">โทร:</span> {service.customer_cache?.phone}</p>
                    </div>
                 </div>
                 <div className="w-[40%] border border-gray-300 p-3 rounded-lg bg-gray-50/50">
                    <h3 className="font-bold text-gray-900 uppercase mb-2 border-b border-gray-200 pb-1">รายละเอียดงาน (Job Details)</h3>
                    <div className="space-y-1.5">
                        <div className="flex justify-between"><span className="text-gray-500">เลขที่ใบงาน:</span> <span className="font-bold text-sm">{service.service_number}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">วันที่รับรถ:</span> <span className="font-bold">{new Date(service.received_date).toLocaleDateString('th-TH')}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">วันนัดรับ:</span> <span className="font-bold">{service.appointment_date ? new Date(service.appointment_date).toLocaleDateString('th-TH') : '-'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">ผู้รับรถ:</span> <span className="font-medium">{service.service_assignees?.[0]?.user?.first_name || '-'}</span></div>
                    </div>
                 </div>
              </div>

              {/* Items Table */}
              <table className="w-full mb-4 text-[11px] border-collapse">
                 <thead>
                    <tr className="bg-gray-100 text-gray-800 font-bold border-y border-black">
                       <th className="py-2 px-3 text-center w-12 border-r border-gray-300">#</th>
                       <th className="py-2 px-3 text-left border-r border-gray-300">รายการซ่อม / อะไหล่ (Description)</th>
                       <th className="py-2 px-3 text-center w-24 border-r border-gray-300">จำนวน</th>
                       <th className="py-2 px-3 text-right w-28 border-r border-gray-300">หน่วยละ</th>
                       <th className="py-2 px-3 text-right w-32">จำนวนเงิน</th>
                    </tr>
                 </thead>
                 <tbody className="text-gray-700">
                    {service.service_items?.map((item, i) => (
                       <tr key={i} className="border-b border-gray-200">
                          <td className="py-2 px-3 text-center align-top border-r border-gray-200 text-gray-500">{i+1}</td>
                          <td className="py-2 px-3 align-top border-r border-gray-200">
                             <p className="font-bold text-gray-900">{item.description}</p>
                             <span className="text-[9px] bg-gray-100 px-1.5 rounded text-gray-500 mt-1 inline-block">{item.type === 'Service' ? 'ค่าแรง' : 'ค่าอะไหล่'}</span>
                             {item.sub_items && item.sub_items.length > 0 && (
                                <ul className="list-disc list-inside mt-1 text-[10px] text-gray-500 pl-1">
                                    {item.sub_items.map((sub, idx) => (
                                        <li key={idx}>{sub.description}</li>
                                    ))}
                                </ul>
                             )}
                          </td>
                          <td className="py-2 px-3 text-center align-top border-r border-gray-200">{item.quantity}</td>
                          <td className="py-2 px-3 text-right align-top border-r border-gray-200">{item.sell_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="py-2 px-3 text-right align-top font-bold text-gray-900">{(item.sell_price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                       </tr>
                    ))}
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
                       <span className="font-bold text-gray-600">รวมเป็นเงิน (Subtotal)</span>
                       <span className="font-medium">{service.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    {service.discount > 0 && <div className="flex justify-between py-1 border-b border-gray-200 text-red-600"><span>ส่วนลด (Discount)</span><span>-{service.discount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>}
                    {service.shipping_cost > 0 && <div className="flex justify-between py-1 border-b border-gray-200"><span>ค่าขนส่ง (Shipping)</span><span>{service.shipping_cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>}
                    {service.vat_type !== 'no_vat' && <div className="flex justify-between py-1 border-b border-gray-200 text-gray-500"><span>ภาษีมูลค่าเพิ่ม (7%)</span><span>{service.vat_amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>}
                    
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
                 <div className="text-center w-1/3">
                    <div className="border-b border-dotted border-gray-400 mb-2 h-8"></div>
                    <p className="text-[10px] font-bold text-gray-600">ลงชื่อลูกค้ารับรถ / Customer</p>
                    <p className="text-[10px] text-gray-400">วันที่ ______/______/______</p>
                 </div>
                 <div className="text-center w-1/3">
                    <div className="border-b border-dotted border-gray-400 mb-2 h-8"></div>
                    <p className="text-[10px] font-bold text-gray-600">ลงชื่อผู้ส่งมอบ / Staff</p>
                    <p className="text-[10px] text-gray-400">วันที่ ______/______/______</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
export default ServiceBillPreview;