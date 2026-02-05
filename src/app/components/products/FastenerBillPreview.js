import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';

const FastenerBillPreview = ({ product, fasteners, onClose }) => {
  const contentRef = useRef(null);

  // รวมยอดน็อตทั้งหมด
  const aggregateBolts = () => {
    const totals = {};
    fasteners.forEach(loc => {
      if (loc.bolts_usage && Array.isArray(loc.bolts_usage)) {
        loc.bolts_usage.forEach(b => {
          const key = b.name; // รวมตามชื่อน็อต
          if (!totals[key]) {
            totals[key] = {
              name: b.name,
              head_type: b.head_type,
              material: b.material,
              qty: 0,
              locations: []
            };
          }
          totals[key].qty += (parseInt(b.qty) || 0);
          totals[key].locations.push(`${loc.location_name} (${b.qty})`);
        });
      }
    });
    return Object.values(totals).sort((a, b) => a.name.localeCompare(b.name));
  };

  const aggregatedList = aggregateBolts();

  const handlePrint = () => {
    const printContent = contentRef.current.innerHTML;
    const win = window.open('', '', 'height=800,width=800');
    win.document.write('<html><head><title>Fastener List</title>');
    win.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    win.document.write('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">');
    win.document.write(`
      <style>
        @page { size: A4; margin: 0; } 
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .print-wrapper { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; position: relative; padding: 10mm; font-family: 'Sarabun', sans-serif; }
        * { box-sizing: border-box; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        th { background-color: #f9fafb; font-weight: bold; }
      </style>
    `);
    win.document.write('</head><body class="bg-gray-100 flex justify-center">');
    win.document.write('<div class="print-wrapper">');
    win.document.write(printContent);
    win.document.write('</div>');
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="bg-gray-900 p-4 flex justify-between items-center text-white shrink-0">
          <div className="font-bold text-lg">รายการน็อตและจุดยึด (Fastener BOM)</div>
          <div className="flex gap-2">
             <button onClick={handlePrint} className="flex gap-2 items-center bg-orange-600 px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"><Printer size={18}/> พิมพ์รายการ</button>
             <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-gray-100 p-8 flex justify-center">
           <div ref={contentRef} className="bg-white w-[210mm] min-h-[297mm] p-[10mm] text-gray-900 shadow-sm print:shadow-none">
              
              {/* Header */}
              <div className="mb-6 border-b-2 border-orange-500 pb-4">
                 <h1 className="text-2xl font-bold text-gray-900">ใบรายการน็อตประกอบ (Fastener Bill of Materials)</h1>
                 <div className="flex justify-between mt-2 text-sm text-gray-600">
                    <p>สินค้า: <span className="font-bold text-black text-lg">{product.name}</span></p>
                    <p>รหัส: <span className="font-mono">{product.sku}</span></p>
                 </div>
              </div>

              {/* Summary Table */}
              <div className="mb-8">
                 <h3 className="font-bold text-lg mb-2 bg-orange-50 p-2 rounded border-l-4 border-orange-500">1. สรุปยอดรวม (Total Required)</h3>
                 <table className="w-full text-sm mb-4">
                    <thead>
                       <tr className="bg-gray-100">
                          <th className="w-10 text-center">#</th>
                          <th>รายการน็อต (Specification)</th>
                          <th>ชนิดหัว</th>
                          <th>วัสดุ</th>
                          <th className="w-20 text-center text-orange-700">จำนวนรวม</th>
                       </tr>
                    </thead>
                    <tbody>
                       {aggregatedList.map((item, i) => (
                          <tr key={i}>
                             <td className="text-center">{i+1}</td>
                             <td className="font-bold">{item.name}</td>
                             <td>{item.head_type}</td>
                             <td>{item.material}</td>
                             <td className="text-center font-black text-lg">{item.qty}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              {/* Breakdown Table */}
              <div>
                 <h3 className="font-bold text-lg mb-2 bg-gray-50 p-2 rounded border-l-4 border-gray-500">2. รายละเอียดตามจุดติดตั้ง (Location Breakdown)</h3>
                 <table className="w-full text-sm">
                    <thead>
                       <tr className="bg-gray-100">
                          <th className="w-1/4">จุดติดตั้ง (Location)</th>
                          <th>รายการน็อต</th>
                          <th className="w-16 text-center">จำนวน</th>
                          <th className="w-1/4">หมายเหตุ (Note)</th>
                       </tr>
                    </thead>
                    <tbody>
                       {fasteners.map((loc, i) => (
                          <React.Fragment key={i}>
                             {loc.bolts_usage && loc.bolts_usage.length > 0 ? (
                                loc.bolts_usage.map((b, bIdx) => (
                                   <tr key={`${i}-${bIdx}`} className={bIdx === 0 ? "border-t-2 border-gray-200" : ""}>
                                      {bIdx === 0 && (
                                         <td rowSpan={loc.bolts_usage.length} className="align-top font-bold bg-gray-50/30">
                                            {loc.location_name}
                                         </td>
                                      )}
                                      <td>{b.name}</td>
                                      <td className="text-center">{b.qty}</td>
                                      {bIdx === 0 && (
                                         <td rowSpan={loc.bolts_usage.length} className="align-top text-xs text-gray-500 italic">
                                            {loc.note || '-'}
                                         </td>
                                      )}
                                   </tr>
                                ))
                             ) : (
                                <tr className="border-t border-gray-200">
                                    <td className="font-bold bg-gray-50/30">{loc.location_name}</td>
                                    <td colSpan={2} className="text-gray-400 italic text-center">ไม่มีข้อมูลน็อต</td>
                                    <td className="text-xs text-gray-500 italic">{loc.note || '-'}</td>
                                </tr>
                             )}
                          </React.Fragment>
                       ))}
                    </tbody>
                 </table>
              </div>

           </div>
        </div>
      </div>
    </div>
  );
};

export default FastenerBillPreview;