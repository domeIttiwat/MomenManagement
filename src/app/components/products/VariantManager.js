import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Settings2, Sparkles } from 'lucide-react';
import NumericInput from './NumericInput';

const VariantManager = ({ variants, onChange, mainSku }) => {
  const [options, setOptions] = useState([{ name: 'Spec', values: [] }]);
  const [newVal, setNewVal] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  // --- 1. กู้คืนข้อมูล (Restore) ---
  useEffect(() => {
    if (variants.length > 0 && options.length === 1 && options[0].values.length === 0) {
      const extractedOptions = {};
      
      variants.forEach(v => {
        if (v.options) {
          Object.entries(v.options).forEach(([key, val]) => {
            if (!extractedOptions[key]) extractedOptions[key] = new Set();
            extractedOptions[key].add(val);
          });
        }
      });

      const restored = Object.entries(extractedOptions).map(([name, set]) => ({
        name,
        values: Array.from(set)
      }));

      if (restored.length > 0) setOptions(restored);
    }
  }, [variants]);

  // --- 2. สร้างรายการสินค้า (Generate) ---
  useEffect(() => {
    const validOpts = options.filter(o => o.values.length > 0);
    
    if (validOpts.length === 0) {
      if (variants.length > 0) onChange([]); 
      return;
    }

    const combine = (acc, idx) => {
      if (idx === validOpts.length) return acc;
      let newAcc = [];
      const curr = validOpts[idx];
      if (acc.length === 0) {
        newAcc = curr.values.map(v => ({ name: v, options: { [curr.name]: v } }));
      } else {
        acc.forEach(a => curr.values.forEach(v => {
          newAcc.push({ name: `${a.name} / ${v}`, options: { ...a.options, [curr.name]: v } });
        }));
      }
      return combine(newAcc, idx + 1);
    };

    const combinations = combine([], 0);

    const merged = combinations.map(c => {
      const existing = variants.find(v => v.name === c.name);
      const generatedSku = `${mainSku}-${c.name.replace(/[^a-zA-Z0-9]/g, '')}-${Math.floor(Math.random() * 1000)}`;
      return existing || { 
        ...c, 
        sku: generatedSku, 
        cost_price: '', 
        sell_price: 0, 
        stock_quantity: 0 
      };
    });

    if (merged.length !== variants.length || !merged.every((m, i) => m.name === variants[i]?.name)) {
      onChange(merged);
    }
  }, [options, mainSku]);

  // --- Helper Functions ---
  const addVal = () => {
    if (!newVal.trim()) return;
    const newOptions = options.map((opt, i) => {
      if (i === activeIdx && !opt.values.includes(newVal)) {
        return { ...opt, values: [...opt.values, newVal] };
      }
      return opt;
    });
    setOptions(newOptions);
    setNewVal('');
  };

  const removeVal = (optIdx, valIdx) => {
    const newOptions = options.map((opt, i) => {
      if (i === optIdx) {
        return { ...opt, values: opt.values.filter((_, vi) => vi !== valIdx) };
      }
      return opt;
    });
    setOptions(newOptions);
  };

  const updateVar = (idx, field, val) => {
    const newVars = variants.map((v, i) => {
      if (i === idx) return { ...v, [field]: val };
      return v;
    });
    onChange(newVars);
  };

  const inputClass = "w-full border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";

  return (
    <div className="space-y-6">
      <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
          <Settings2 size={16} className="text-indigo-500"/> 1. กำหนดสเปค
        </h3>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {options.map((opt, i) => (
            <button 
              key={i} type="button" onClick={() => setActiveIdx(i)} 
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${activeIdx === i ? 'bg-white border-indigo-500 text-indigo-600 shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}
            >
              {opt.name}
            </button>
          ))}
          <button 
            type="button" onClick={() => { setOptions([...options, { name: 'Option', values: [] }]); setActiveIdx(options.length); }} 
            className="px-3 py-2 rounded-xl border border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50"
          >
            <Plus size={18}/>
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex gap-3">
            <input 
              className="w-1/3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none" 
              placeholder="ชื่อสเปค" 
              value={options[activeIdx].name} 
              onChange={e => {
                const newOpts = [...options];
                newOpts[activeIdx] = { ...newOpts[activeIdx], name: e.target.value };
                setOptions(newOpts);
              }} 
            />
            <div className="flex-1 flex gap-2">
              <input 
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white" 
                placeholder="เพิ่มค่า (เช่น 20Ah, 30Ah) แล้วกด Enter..." 
                value={newVal} 
                onChange={e => setNewVal(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addVal()} 
              />
              <button type="button" onClick={addVal} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium">เพิ่ม</button>
            </div>
            {options.length > 1 && (
               <button onClick={() => { setOptions(options.filter((_, i) => i !== activeIdx)); setActiveIdx(0); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {options[activeIdx].values.map((v, i) => (
              <span key={i} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2">
                {v} <button type="button" onClick={() => removeVal(activeIdx, i)} className="hover:text-red-500"><X size={12}/></button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
             <Sparkles size={16} className="text-amber-500"/> 2. รายการสินค้า ({variants.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-1/4">ชื่อรุ่นย่อย</th>
                <th className="px-4 py-4 w-28">ต้นทุน</th>
                <th className="px-4 py-4 w-28">ราคาขาย</th>
                <th className="px-4 py-4 w-24">กำไร</th>
                <th className="px-4 py-4 w-48">SKU (สร้างอัตโนมัติ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {variants.map((v, i) => {
                // คำนวณกำไรและ Margin แบบ Real-time
                const hasCost = v.cost_price !== '' && v.cost_price !== null && v.cost_price !== undefined;
                const cost = hasCost ? (parseFloat(v.cost_price) || 0) : 0;
                const price = parseFloat(v.sell_price) || 0;
                const profit = price - cost;
                const margin = price > 0 ? ((profit / price) * 100).toFixed(1) : 0;

                return (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3 font-bold text-gray-700">{v.name}</td>
                    <td className="px-4 py-3">
                      <NumericInput className={inputClass} value={v.cost_price} onChange={val => updateVar(i, 'cost_price', val)} placeholder="0.00" />
                    </td>
                    <td className="px-4 py-3">
                      <NumericInput className={`${inputClass} text-indigo-600 font-bold`} value={v.sell_price} onChange={val => updateVar(i, 'sell_price', val)} placeholder="0.00" />
                    </td>
                    
                    {/* แสดงผลกำไร */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        {hasCost ? (
                          <>
                            <span className={`font-bold text-sm ${profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              {profit > 0 ? '+' : ''}{profit.toLocaleString()}
                            </span>
                            {price > 0 && <span className="text-[10px] text-gray-400">{margin}%</span>}
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-gray-400">ยังไม่ระบุ</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        className={`${inputClass} font-mono text-xs bg-gray-50 text-gray-600`} 
                        value={v.sku} 
                        onChange={e => updateVar(i, 'sku', e.target.value)} 
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default VariantManager;
