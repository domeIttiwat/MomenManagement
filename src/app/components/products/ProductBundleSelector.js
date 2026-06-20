import React, { useState, useRef } from 'react';
import { Package, Plus, Trash2, Layers, Download, Upload, X, AlertCircle, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';

// BOM editor แบบ "พิมพ์ชื่อชิ้นส่วนอิสระ" (ไม่ผูกแคตตาล็อกสินค้า)
// เก็บใน product_bundles: { component_name, quantity, parent_variant_id, child_product_id:null, note }
// parent_variant_id = null => อะไหล่พื้นฐาน (ใช้ทุกรุ่น); = v.id => เฉพาะรุ่นย่อยนั้น
const ProductBundleSelector = ({ bundles = [], onChange, variants = [], canEdit = true, productSku = '', productName = '' }) => {
  const [drafts, setDrafts] = useState({}); // { base|<variantId>: { name, qty } }
  const fileRef = useRef(null);
  const [pendingImport, setPendingImport] = useState(null); // { parsed:[], unmatched:[] }
  const [mapping, setMapping] = useState({}); // { rawVariant: 'skip'|'base'|<variantId> }

  const variantNameById = {};
  variants.forEach((v) => { variantNameById[v.id] = v.name; });

  // ---------- helpers ----------
  const cellText = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.text != null) return String(v.text);
      if (v.result != null) return String(v.result);
      if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
      return '';
    }
    return String(v);
  };
  const norm = (s) => cellText(s).trim().replace(/\s+/g, ' ').toLowerCase();

  // ---------- Export (ExcelJS + dropdown ที่คอลัมน์ variant) ----------
  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('BOM');
    ws.columns = [
      { header: 'product_sku', key: 'product_sku', width: 16 },
      { header: 'product_name', key: 'product_name', width: 24 },
      { header: 'variant', key: 'variant', width: 22 },
      { header: 'component_name', key: 'component_name', width: 28 },
      { header: 'qty', key: 'qty', width: 8 },
      { header: 'note', key: 'note', width: 28 },
    ];
    ws.getRow(1).font = { bold: true };
    const dataRows = (bundles.length ? bundles : [{}]).map((b) => ({
      product_sku: productSku,
      product_name: productName,
      variant: b.parent_variant_id == null ? '' : (variantNameById[b.parent_variant_id] || ''),
      component_name: b.component_name ?? b.product?.name ?? '',
      qty: b.quantity ?? 1,
      note: b.note ?? '',
    }));
    ws.addRows(dataRows);

    // sheet อ้างอิงรุ่นย่อย (ใช้เป็นแหล่ง dropdown ด้วย)
    const wsRef = wb.addWorksheet('variants');
    wsRef.getCell('A1').value = 'รุ่นย่อยที่ใช้ได้ (เลือกในคอลัมน์ variant) — เว้นว่าง = อะไหล่พื้นฐานใช้ทุกรุ่น';
    wsRef.getCell('A1').font = { bold: true };
    variants.forEach((v, i) => { wsRef.getCell(`A${i + 2}`).value = v.name; });

    // dropdown ที่คอลัมน์ variant (C) อ้างจาก variants!$A$2:$A$n
    if (variants.length > 0) {
      const ref = `variants!$A$2:$A$${variants.length + 1}`;
      for (let r = 2; r <= 500; r++) {
        ws.getCell(`C${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [ref],
          showErrorMessage: true,
          errorStyle: 'warning',
          error: 'เลือกชื่อรุ่นย่อยจากรายการ หรือเว้นว่างสำหรับอะไหล่พื้นฐาน',
        };
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BOM_${productSku || 'template'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ---------- Import (ExcelJS อ่าน + จับคู่ variant) ----------
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.getWorksheet('BOM') || wb.worksheets[0];
      if (!ws) throw new Error('ไม่พบชีตข้อมูล');

      const colIdx = {};
      ws.getRow(1).eachCell((cell, c) => { colIdx[cellText(cell.value).trim()] = c; });
      const get = (row, key) => (colIdx[key] ? cellText(row.getCell(colIdx[key]).value) : '');

      const nameToId = {};
      variants.forEach((v) => { nameToId[norm(v.name)] = v.id; });

      const parsed = [];
      ws.eachRow((row, r) => {
        if (r === 1) return;
        const name = get(row, 'component_name').trim();
        if (!name) return;
        const variantRaw = get(row, 'variant').trim();
        const qty = parseInt(get(row, 'qty'), 10) || 1;
        const noteVal = get(row, 'note').trim() || null;
        if (!variantRaw) {
          parsed.push({ component_name: name, quantity: qty, note: noteVal, variantRaw: '', pvid: null, matched: true });
          return;
        }
        const id = nameToId[norm(variantRaw)];
        if (id !== undefined) parsed.push({ component_name: name, quantity: qty, note: noteVal, variantRaw, pvid: id, matched: true });
        else parsed.push({ component_name: name, quantity: qty, note: noteVal, variantRaw, pvid: null, matched: false });
      });

      const unmatched = [...new Set(parsed.filter((p) => !p.matched).map((p) => p.variantRaw))];
      const initMap = {};
      unmatched.forEach((u) => { initMap[u] = 'skip'; });
      setMapping(initMap);
      setPendingImport({ parsed, unmatched });
    } catch (err) {
      alert('อ่านไฟล์ไม่สำเร็จ: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  // undefined = ข้ามแถวนี้; null = อะไหล่พื้นฐาน; number = รุ่นย่อย
  const resolvePvid = (p) => {
    if (p.matched) return p.pvid;
    const m = mapping[p.variantRaw];
    if (!m || m === 'skip') return undefined;
    return m === 'base' ? null : Number(m);
  };
  const countToImport = () => (pendingImport ? pendingImport.parsed.filter((p) => resolvePvid(p) !== undefined).length : 0);

  const applyImport = (mode) => {
    if (!pendingImport) return;
    const finalRows = [];
    pendingImport.parsed.forEach((p) => {
      const pvid = resolvePvid(p);
      if (pvid === undefined) return;
      finalRows.push({ child_product_id: null, component_name: p.component_name, quantity: p.quantity, note: p.note, parent_variant_id: pvid });
    });
    onChange(mode === 'replace' ? finalRows : [...bundles, ...finalRows]);
    setPendingImport(null);
    setMapping({});
  };

  const closeImport = () => { setPendingImport(null); setMapping({}); };

  // ---------- editor helpers ----------
  const keyOf = (variantId) => (variantId == null ? 'base' : String(variantId));
  const getDraft = (variantId) => drafts[keyOf(variantId)] || { name: '', qty: 1 };
  const setDraft = (variantId, patch) =>
    setDrafts((prev) => ({ ...prev, [keyOf(variantId)]: { ...getDraft(variantId), ...patch } }));

  const addRow = (variantId) => {
    const d = getDraft(variantId);
    if (!d.name.trim()) return;
    onChange([
      ...bundles,
      { child_product_id: null, component_name: d.name.trim(), quantity: Number(d.qty) || 1, parent_variant_id: variantId ?? null },
    ]);
    setDraft(variantId, { name: '', qty: 1 });
  };

  const updateField = (idx, field, value) => {
    const next = [...bundles];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };
  const removeRow = (idx) => onChange(bundles.filter((_, i) => i !== idx));

  const renderRow = (b, idx) => (
    <div key={idx} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm mb-2">
      <div className="flex items-center gap-2">
        <Package size={14} className="text-gray-300 shrink-0" />
        <input
          type="text"
          disabled={!canEdit}
          value={b.component_name ?? b.product?.name ?? ''}
          onChange={(e) => updateField(idx, 'component_name', e.target.value)}
          placeholder="ชื่อชิ้นส่วน"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-gray-800 outline-none disabled:opacity-70"
        />
        <div className="flex items-center gap-1 bg-gray-50 rounded px-1.5 py-0.5 border border-gray-200 shrink-0">
          <span className="text-[10px] text-gray-500">จำนวน</span>
          <input
            type="number"
            min="1"
            disabled={!canEdit}
            value={b.quantity ?? 1}
            onChange={(e) => updateField(idx, 'quantity', parseInt(e.target.value) || 1)}
            className="w-10 text-center bg-transparent text-sm font-bold outline-none disabled:opacity-70"
          />
        </div>
        {canEdit && (
          <button type="button" onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-500 p-1 shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {(canEdit || b.note) && (
        <input
          type="text"
          disabled={!canEdit}
          value={b.note ?? ''}
          onChange={(e) => updateField(idx, 'note', e.target.value)}
          placeholder="หมายเหตุ (ไม่บังคับ)"
          className="mt-1.5 ml-6 w-[calc(100%-1.5rem)] bg-gray-50 rounded px-2 py-1 text-xs text-gray-600 outline-none border border-transparent focus:border-indigo-300 focus:bg-white disabled:opacity-70"
        />
      )}
    </div>
  );

  const renderAddForm = (variantId) => {
    if (!canEdit) return null;
    const d = getDraft(variantId);
    return (
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={d.name}
          onChange={(e) => setDraft(variantId, { name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRow(variantId); } }}
          placeholder="พิมพ์ชื่อชิ้นส่วน เช่น Stepdown, กล่องควบคุม, มอเตอร์..."
          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400"
        />
        <input
          type="number"
          min="1"
          value={d.qty}
          onChange={(e) => setDraft(variantId, { qty: parseInt(e.target.value) || 1 })}
          className="w-16 px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center outline-none focus:border-indigo-400"
        />
        <button
          type="button"
          onClick={() => addRow(variantId)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 active:scale-95 transition-all shrink-0"
        >
          <Plus size={14} /> เพิ่ม
        </button>
      </div>
    );
  };

  const baseRows = bundles.map((b, i) => ({ b, i })).filter(({ b }) => b.parent_variant_id == null);

  return (
    <div className="space-y-6">
      {/* Export / Import Excel */}
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={handleExport} className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 font-bold">
          <Download size={14} /> ดาวน์โหลด Excel
        </button>
        {canEdit && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 font-bold">
              <Upload size={14} /> นำเข้า Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          </>
        )}
      </div>

      {/* อะไหล่พื้นฐาน (ใช้ทุกรุ่น) */}
      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
        <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2 mb-3">
          <Layers size={16} /> อะไหล่พื้นฐาน (ใช้ทุกรุ่น)
        </h4>
        <div className="space-y-1">
          {baseRows.length > 0
            ? baseRows.map(({ b, i }) => renderRow(b, i))
            : <p className="text-center text-xs text-gray-400 py-2">ยังไม่มีอะไหล่พื้นฐาน — พิมพ์ชื่อด้านล่างเพื่อเพิ่ม</p>}
        </div>
        {renderAddForm(null)}
      </div>

      {/* ส่วนต่างของแต่ละรุ่นย่อย */}
      {variants.length > 0 && (
        <div className="space-y-4">
          {variants.map((v) => {
            const rows = bundles.map((b, i) => ({ b, i })).filter(({ b }) => String(b.parent_variant_id) === String(v.id));
            return (
              <div key={v.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2 mb-3">
                  <span className="w-2 h-6 bg-indigo-500 rounded-full"></span> สเปค: {v.name}
                  <span className="text-[10px] font-normal text-gray-400">(เพิ่มเฉพาะส่วนที่ต่างจากพื้นฐาน)</span>
                </h4>
                <div className="space-y-1">
                  {rows.length > 0
                    ? rows.map(({ b, i }) => renderRow(b, i))
                    : <p className="text-center text-xs text-gray-400 py-2">ใช้อะไหล่พื้นฐานเหมือนกัน</p>}
                </div>
                {renderAddForm(v.id)}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1">
        <Package size={12} /> BOM เป็นสูตรกลาง (รายการว่าประกอบด้วยอะไร) — ไม่ตัดสต๊อก ที่มาของแต่ละชิ้นจะเลือกตอนเตรียมของต่อออเดอร์
      </p>

      {/* Import preview + จับคู่ variant ที่ไม่ตรง */}
      {pendingImport && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet size={18} /> นำเข้า BOM จาก Excel</h3>
              <button type="button" onClick={closeImport}><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-sm text-gray-700">
                พบทั้งหมด <b>{pendingImport.parsed.length}</b> แถว · จะนำเข้า <b className="text-indigo-600">{countToImport()}</b> แถว
              </p>

              {pendingImport.unmatched.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                    <AlertCircle size={14} /> มีชื่อรุ่นย่อยที่ไม่ตรงกับระบบ {pendingImport.unmatched.length} ชื่อ — เลือกวิธีจัดการแต่ละชื่อ:
                  </p>
                  {pendingImport.unmatched.map((u) => (
                    <div key={u} className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-100 rounded-lg p-2">
                      <span className="flex-1 truncate" title={u}>“{u}”</span>
                      <span className="text-gray-400">→</span>
                      <select
                        value={mapping[u] || 'skip'}
                        onChange={(e) => setMapping((m) => ({ ...m, [u]: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white max-w-[55%]"
                      >
                        <option value="skip">ข้ามแถวนี้ (ไม่ใส่)</option>
                        <option value="base">อะไหล่พื้นฐาน (ทุกรุ่น)</option>
                        {variants.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">ข้อมูลจะเข้าไปในหน้าจอให้ตรวจก่อน — ยังไม่บันทึกจนกว่าจะกด “บันทึกข้อมูล” ด้านบน</p>
            </div>
            <div className="p-4 border-t flex flex-wrap gap-2 justify-end bg-gray-50">
              <button type="button" onClick={closeImport} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">ยกเลิกทั้งหมด</button>
              <button type="button" onClick={() => applyImport('append')} disabled={countToImport() === 0} className="px-4 py-2 text-sm font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-40">เพิ่มต่อท้าย</button>
              <button type="button" onClick={() => applyImport('replace')} disabled={countToImport() === 0} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40">แทนที่ทั้งหมด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductBundleSelector;
