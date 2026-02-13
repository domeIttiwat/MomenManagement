import React, { useState } from 'react';
import { ClipboardList, ArrowRight, User, Settings, Box, Wrench, AlertTriangle, CheckCircle2, Clock, Users, Star, MessageSquare, AlertCircle, LayoutGrid, List as ListIcon, Package, Trash2, AlertOctagon, X, Loader2, RotateCcw } from 'lucide-react';

const IncomingJobs = ({ orders, onEnterBoard, onReset }) => { // ✅ รับ prop onReset
  const [viewType, setViewType] = useState('table'); 
  const [jobToReset, setJobToReset] = useState(null); 
  const [confirmText, setConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const handleConfirmReset = async () => {
    if (confirmText !== 'RESET' || !jobToReset) return;
    setIsClearing(true);
    // ✅ เรียกใช้ onReset จาก Parent แทนการทำเอง
    await onReset(jobToReset);
    closeResetModal();
  };

  const openResetModal = (e, work) => {
      e.stopPropagation();
      setJobToReset(work);
      setConfirmText('');
  };

  const closeResetModal = () => {
      setJobToReset(null);
      setIsClearing(false);
  };

  if (orders.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-600 border border-dashed border-white/10 rounded-3xl bg-white/5">
            <ClipboardList size={48} className="mb-4 opacity-30 text-blue-500"/>
            <p className="text-sm font-medium tracking-wide">NO PENDING JOBS</p>
        </div>
    );
  }

  const getTopItem = (items) => {
      if (!items || items.length === 0) return null;
      return items.reduce((prev, current) => ((prev.sell_price || 0) > (current.sell_price || 0)) ? prev : current, items[0]);
  };

  const getWorkStats = (work) => {
      return work.stats || {
          percentage: 0,
          total: work.items?.length || 0,
          commentCount: 0,
          rejectCount: 0,
          stages: { preparing: 0, assembling: 0, testing: 0, completed: 0 },
          assignees: []
      };
  };

  function renderResetModal() {
      if (!jobToReset) return null;
      const isOrder = jobToReset.type === 'order';
      const number = isOrder ? jobToReset.data.order_number : jobToReset.data.service_number;

      return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e1e1e] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-orange-600"></div>
                <button onClick={closeResetModal} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20}/></button>
                <div className="flex items-center gap-3 mb-4 text-red-500">
                    <div className="p-3 bg-red-500/10 rounded-full"><RotateCcw size={32}/></div>
                    <div>
                        <h3 className="text-xl font-bold text-white">รีเซ็ตงานใหม่?</h3>
                        <p className="text-xs text-red-400 font-mono mt-0.5">{number}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <p className="text-sm text-gray-300 leading-relaxed">คุณกำลังจะ <strong className="text-red-400">ลบความคืบหน้าทั้งหมด</strong> ของงานนี้ ระบบจะสร้างการ์ดงานเริ่มต้นใหม่ทั้งหมดจากรายการสินค้า/ซ่อม</p>
                    <div className="space-y-2 pt-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">พิมพ์คำว่า <span className="text-white select-all">RESET</span> เพื่อยืนยัน</label>
                        <input autoFocus type="text" className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-red-500 outline-none font-mono tracking-widest text-center uppercase" placeholder="RESET" value={confirmText} onChange={e => setConfirmText(e.target.value.toUpperCase())}/>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={closeResetModal} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-all">ยกเลิก</button>
                        <button disabled={confirmText !== 'RESET' || isClearing} onClick={handleConfirmReset} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2">{isClearing ? <Loader2 size={20} className="animate-spin"/> : <Trash2 size={20}/>} รีเซ็ตทันที</button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="space-y-4">
        {/* Header (Desktop Only) */}
        <div className="hidden md:flex justify-between items-center bg-[#161a1d] p-4 rounded-2xl border border-white/5 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Settings size={20}/></div>
                <div><h2 className="font-bold text-gray-200 text-sm">Incoming Queue</h2><p className="text-xs text-gray-500 font-mono">TOTAL: {orders.length}</p></div>
            </div>
            <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
                <button onClick={() => setViewType('table')} className={`p-2 rounded-md transition-all ${viewType === 'table' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} title="Table View"><ListIcon size={16}/></button>
                <button onClick={() => setViewType('grid')} className={`p-2 rounded-md transition-all ${viewType === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} title="Grid View"><LayoutGrid size={16}/></button>
            </div>
        </div>

        {/* Grid/Table Views */}
        <div className={`grid gap-4 ${viewType === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:hidden'}`}>
            {orders.map((work) => {
                const isOrder = work.type === 'order';
                const data = work.data;
                const number = isOrder ? data.order_number : data.service_number;
                const customerName = data.customer_cache ? `${data.customer_cache.first_name} ${data.customer_cache.last_name}` : '-';
                const stats = getWorkStats(work);
                const hasStarted = work.stats !== null;
                const topItem = getTopItem(work.items);
                
                return (
                    <div key={`${work.type}-${data.id}`} onClick={() => onEnterBoard(work)} className="bg-[#18181b] border border-white/5 p-4 rounded-2xl active:scale-[0.98] transition-all shadow-lg relative overflow-hidden group">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isOrder ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                        {hasStarted && (
                            <button onClick={(e) => openResetModal(e, work)} className="absolute top-2 right-2 p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10" title="Reset Job"><RotateCcw size={16}/></button>
                        )}
                        <div className="flex justify-between items-start mb-3 pl-2">
                            <div><div className="flex items-center gap-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${isOrder ? 'bg-indigo-500/20 text-indigo-300' : 'bg-orange-500/20 text-orange-300'}`}>{work.type === 'order' ? 'ORDER' : 'SERVICE'}</span><span className="text-xs text-gray-500 font-mono">{new Date(data.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div><h3 className="text-lg font-bold text-white mt-1 font-mono">{number}</h3></div>
                            <div className="text-right pr-6"><div className="flex flex-col items-end"><span className={`text-xl font-bold ${stats.percentage > 0 ? 'text-blue-400' : 'text-gray-600'}`}>{stats.percentage}%</span></div></div>
                        </div>
                        <div className="pl-2 space-y-2 mb-3">
                            <div className="flex items-center gap-2 text-sm text-gray-400"><User size={14} className="text-gray-600 shrink-0"/><span className="truncate">{customerName}</span></div>
                            {topItem && (<div className="flex items-start gap-2 text-sm text-gray-300"><Star size={14} className="text-yellow-500/70 shrink-0 mt-0.5"/><span className="truncate leading-snug">{topItem.product_name || topItem.description}</span></div>)}
                        </div>
                        <div className="pl-2 pt-3 border-t border-white/5 flex justify-between items-center mt-auto">
                            <div className="flex gap-3 text-xs text-gray-500"><span className="flex items-center gap-1"><Box size={12}/> {work.items?.length || 0}</span><span className={`flex items-center gap-1 ${stats.commentCount > 0 ? 'text-blue-400' : ''}`}><MessageSquare size={12}/> {stats.commentCount}</span><span className={`flex items-center gap-1 ${stats.rejectCount > 0 ? 'text-red-400' : ''}`}><AlertCircle size={12}/> {stats.rejectCount}</span></div>
                            <div className="text-[10px] text-gray-600 font-bold flex items-center gap-1">TAP TO VIEW <ArrowRight size={12}/></div>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Desktop Table View */}
        <div className={`hidden ${viewType === 'table' ? 'md:block' : ''} bg-[#161a1d] border border-white/5 rounded-2xl overflow-hidden shadow-2xl`}>
            {/* ... (Table Header เหมือนเดิม) ... */}
            <table className="w-full text-left border-collapse">
                <thead className="bg-white/[0.02] text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr><th className="px-6 py-4 font-mono w-28">ID / Type</th><th className="px-6 py-4 w-48">Customer</th><th className="px-6 py-4">Main Product</th><th className="px-6 py-4 w-32 text-center">Progress</th><th className="px-6 py-4 text-center">Breakdown</th><th className="px-6 py-4 text-center">Activity</th><th className="px-6 py-4 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                    {orders.map((work) => {
                        const isOrder = work.type === 'order';
                        const data = work.data;
                        const number = isOrder ? data.order_number : data.service_number;
                        const customerName = data.customer_cache ? `${data.customer_cache.first_name} ${data.customer_cache.last_name}` : '-';
                        const stats = getWorkStats(work);
                        const hasStarted = work.stats !== null;
                        const topItem = getTopItem(work.items);

                        return (
                            <tr key={`${work.type}-${data.id}`} className="hover:bg-white/[0.03] transition-colors group cursor-pointer" onClick={() => onEnterBoard(work)}>
                                <td className="px-6 py-4"><div className="flex flex-col"><span className="font-mono font-bold text-white group-hover:text-blue-400 transition-colors">{number}</span><span className={`text-[10px] font-bold uppercase w-fit px-1.5 rounded ${isOrder ? 'text-indigo-400 bg-indigo-500/10' : 'text-orange-400 bg-orange-500/10'}`}>{isOrder ? 'ORDER' : 'SERVICE'}</span></div></td>
                                <td className="px-6 py-4"><div className="flex items-center gap-3 text-gray-300"><div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 shrink-0 border border-white/5"><User size={14}/></div><span className="truncate font-medium">{customerName}</span></div></td>
                                <td className="px-6 py-4">{topItem ? <div className="flex flex-col"><span className="text-gray-200 font-medium truncate max-w-[200px]" title={topItem.product_name || topItem.description}>{topItem.product_name || topItem.description}</span>{work.items.length > 1 && <span className="text-[10px] text-gray-500">+ {work.items.length - 1} more items</span>}</div> : <span className="text-gray-600 text-xs italic">No items</span>}</td>
                                <td className="px-6 py-4"><div className="w-full flex flex-col gap-1"><div className="flex justify-between text-[10px] font-bold text-gray-400"><span className={stats.percentage > 0 ? 'text-blue-400' : ''}>{stats.percentage}%</span><span className="text-gray-600">{stats.total} Tasks</span></div><div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${stats.percentage}%` }}></div></div></div></td>
                                <td className="px-6 py-4"><div className="flex justify-center gap-2">{hasStarted ? <><div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${stats.stages.preparing > 0 ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 'text-gray-600 border-gray-700'}`} title="Preparing"><Box size={10}/> {stats.stages.preparing}</div><div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${stats.stages.assembling > 0 ? 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' : 'text-gray-600 border-gray-700'}`} title="Assembling"><Wrench size={10}/> {stats.stages.assembling}</div><div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${stats.stages.testing > 0 ? 'text-purple-500 bg-purple-500/10 border-purple-500/20' : 'text-gray-600 border-gray-700'}`} title="Testing"><AlertTriangle size={10}/> {stats.stages.testing}</div><div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${stats.stages.completed > 0 ? 'text-green-500 bg-green-500/10 border-green-500/20' : 'text-gray-600 border-gray-700'}`} title="Done"><CheckCircle2 size={10}/> {stats.stages.completed}</div></> : <span className="text-gray-600 text-xs">-</span>}</div></td>
                                <td className="px-6 py-4"><div className="flex justify-center gap-4 text-gray-400"><div className="flex flex-col items-center gap-0.5" title="Comments"><MessageSquare size={14} className={stats.commentCount > 0 ? 'text-blue-400' : 'text-gray-600'}/><span className={`text-[10px] ${stats.commentCount > 0 ? 'text-blue-300' : ''}`}>{stats.commentCount}</span></div><div className="flex flex-col items-center gap-0.5" title="Rejections"><AlertTriangle size={14} className={stats.rejectCount > 0 ? 'text-red-500' : 'text-gray-600'}/><span className={`text-[10px] ${stats.rejectCount > 0 ? 'text-red-400 font-bold' : ''}`}>{stats.rejectCount}</span></div></div></td>
                                <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2">{hasStarted && <button onClick={(e) => openResetModal(e, work)} className="p-2 bg-gray-800 hover:bg-red-900/30 hover:text-red-400 text-gray-500 rounded-lg transition-colors border border-gray-700 hover:border-red-900/50" title="Reset Job"><RotateCcw size={14}/></button>}<button onClick={(e) => { e.stopPropagation(); onEnterBoard(work); }} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all transform hover:-translate-y-0.5">OPEN <ArrowRight size={14}/></button></div></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        
        {renderResetModal()}
    </div>
  );
};

export default IncomingJobs;