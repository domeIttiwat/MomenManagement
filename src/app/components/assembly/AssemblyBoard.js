import React, { useState, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import AssemblyCard from './AssemblyCard';
import { MoreHorizontal, Plus, ArrowLeft, ArrowRight, X } from 'lucide-react';

const columns = [
  { 
    id: 'preparing', 
    title: 'Preparing', 
    headerColor: 'border-t-4 border-yellow-500',
    barColor: 'bg-yellow-500',
    isDragDisabled: true 
  },
  { 
    id: 'assembling', 
    title: 'Assembly', 
    headerColor: 'border-t-4 border-blue-500',
    barColor: 'bg-blue-500',
    isDragDisabled: false 
  },
  { 
    id: 'testing', 
    title: 'QC Testing', 
    headerColor: 'border-t-4 border-purple-500',
    barColor: 'bg-purple-500',
    isDragDisabled: false
  },
  { 
    id: 'completed', 
    title: 'Done', 
    headerColor: 'border-t-4 border-green-500',
    barColor: 'bg-green-500',
    isDragDisabled: false
  },
];

const AssemblyBoard = ({ jobs = [], onJobClick, onManualMove, onJobUpdate, onAddPartRequest, onAddCard, onAddComment, onDeleteCard, currentUser, cardViewMode }) => {
  const [activeColIndex, setActiveColIndex] = useState(0);
  const [addingCardCol, setAddingCardCol] = useState(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  const safeJobs = jobs || []; // ✅ กันเหนียว

  const nextCol = () => setActiveColIndex(prev => Math.min(prev + 1, columns.length - 1));
  const prevCol = () => setActiveColIndex(prev => Math.max(prev - 1, 0));

  const getJobsForColumn = (colId) => {
      if (colId === 'preparing') {
          return safeJobs.filter(j => j.stage === 'preparing' || j.stage === 'assembling');
      }
      if (colId === 'assembling') {
          return safeJobs.filter(j => {
             const isRelevant = j.stage === 'preparing' || j.stage === 'assembling';
             if (!isRelevant) return false;
             // ถ้าอยู่ขั้นเตรียมของ และ ไม่มีรายการย่อย -> ซ่อนจากช่องประกอบ
             if (j.stage === 'preparing' && (!j.checklists || j.checklists.length === 0)) {
                 return false;
             }
             return true;
          });
      }
      return safeJobs.filter(j => j.stage === colId);
  };

  const handleAddSubmit = (e, colId) => {
      e.preventDefault();
      if (!newCardTitle.trim()) return;
      onAddCard(colId, newCardTitle);
      setNewCardTitle('');
      setAddingCardCol(null);
  };

  return (
    <div className="h-full flex flex-col md:block relative">
       {/* Mobile Nav */}
       <div className="md:hidden flex items-center justify-between mb-4 bg-[#22272b] p-3 rounded-lg border border-white/5 shadow-md shrink-0">
          <button onClick={prevCol} disabled={activeColIndex === 0} className={`p-1 ${activeColIndex === 0 ? 'text-gray-600' : 'text-gray-300'}`}><ArrowLeft/></button>
          <span className="font-bold text-gray-200">{columns[activeColIndex].title}</span>
          <button onClick={nextCol} disabled={activeColIndex === columns.length - 1} className={`p-1 ${activeColIndex === columns.length - 1 ? 'text-gray-600' : 'text-gray-300'}`}><ArrowRight/></button>
       </div>

       {/* Board Columns */}
       <div className="flex md:flex-row h-full gap-4 overflow-x-auto items-start snap-x snap-mandatory md:snap-none pt-2">
          {columns.map((col, index) => {
             const colJobs = getJobsForColumn(col.id);
             const isHiddenOnMobile = index !== activeColIndex ? 'hidden md:flex' : 'flex';
             const isAdding = addingCardCol === col.id;

             let colTotalItems = 0;
             let colCompletedItems = 0;
             colJobs.forEach(j => {
                 const lists = j.checklists || [];
                 colTotalItems += lists.length;
                 if (col.id === 'preparing') colCompletedItems += lists.filter(i => i.is_checked).length;
                 else colCompletedItems += lists.filter(i => i.is_assembled).length;
             });
             const colPercent = colTotalItems === 0 ? 0 : Math.round((colCompletedItems / colTotalItems) * 100);

             return (
                <div key={col.id} className={`${isHiddenOnMobile} flex-col w-full md:w-72 shrink-0 max-h-full rounded-xl bg-[#101204] border border-white/5 shadow-lg snap-center`}>
                   {/* Header */}
                   <div className={`p-3 flex flex-col shrink-0 ${col.headerColor} bg-[#101204] rounded-t-xl border-b border-white/5`}>
                       <div className="flex justify-between items-center mb-2">
                           <h3 className="font-bold text-sm text-gray-300 px-1">{col.title} <span className="ml-1 text-gray-500 text-xs bg-white/5 px-1.5 py-0.5 rounded-full">{colJobs.length}</span></h3>
                           <button className="text-gray-500 hover:text-gray-300 p-1 hover:bg-white/10 rounded"><MoreHorizontal size={16}/></button>
                       </div>
                       <div className="px-1">
                           <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1 font-mono"><span>PROGRESS</span><span>{colPercent}%</span></div>
                           <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden border border-white/5"><div className={`h-full rounded-full transition-all duration-700 ${col.barColor}`} style={{ width: `${colPercent}%` }}></div></div>
                       </div>
                   </div>
   
                   {/* Drop Zone */}
                   <Droppable droppableId={col.id} isDropDisabled={col.isDragDisabled}>
                   {(provided, snapshot) => (
                       <div {...provided.droppableProps} ref={provided.innerRef} className={`flex-1 overflow-y-auto px-2 py-2 min-h-[50px] scrollbar-thin scrollbar-thumb-white/20 transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}>
                           {colJobs.map((job, idx) => {
                               const draggableId = `${job.id}::${col.id}`; 
                               return (
                                   <Draggable key={draggableId} draggableId={draggableId} index={idx} isDragDisabled={col.isDragDisabled}>
                                       {(provided, snapshot) => (
                                           <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="mb-2" style={provided.draggableProps.style}>
                                               <AssemblyCard 
                                                    job={job} 
                                                    isDragging={snapshot.isDragging}
                                                    onClick={() => onJobClick(job)}
                                                    onUpdate={onJobUpdate} 
                                                    onAddPart={onAddPartRequest}
                                                    viewContext={col.id}
                                                    onAddComment={onAddComment}
                                                    onDelete={onDeleteCard}
                                                    currentUser={currentUser}
                                                    viewMode={cardViewMode}
                                               />
                                               <div className={`md:hidden flex justify-between mt-1 px-1 ${snapshot.isDragging ? 'opacity-0' : 'opacity-100'}`}>
                                                   {index > 0 && !col.isDragDisabled && <button onClick={() => onManualMove(job.id, columns[index - 1].id)} className="text-[10px] bg-white/10 px-2 py-1 rounded text-gray-400">Prev</button>}
                                                   {index < columns.length - 1 && !col.isDragDisabled && <button onClick={() => onManualMove(job.id, columns[index + 1].id)} className="text-[10px] bg-white/10 px-2 py-1 rounded text-gray-400">Next</button>}
                                               </div>
                                           </div>
                                       )}
                                   </Draggable>
                               );
                           })}
                           {provided.placeholder}
                       </div>
                   )}
                   </Droppable>

                   {/* Add Card Footer */}
                   <div className="p-2 shrink-0">
                      {isAdding ? (
                          <form onSubmit={(e) => handleAddSubmit(e, col.id)} className="bg-[#22272b] p-2 rounded-lg border border-blue-500 shadow-md animate-in fade-in slide-in-from-bottom-2">
                              <textarea autoFocus className="w-full bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none h-16" placeholder="Enter title..." value={newCardTitle} onChange={e => setNewCardTitle(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) handleAddSubmit(e, col.id); }}/>
                              <div className="flex items-center gap-2 mt-2">
                                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded">Add Card</button>
                                  <button type="button" onClick={() => setAddingCardCol(null)} className="p-1 hover:bg-white/10 rounded text-gray-400"><X size={16}/></button>
                              </div>
                          </form>
                      ) : <button onClick={() => setAddingCardCol(col.id)} className="w-full flex items-center gap-2 text-gray-500 hover:bg-white/10 hover:text-gray-300 p-2 rounded-lg text-sm transition-colors text-left"><Plus size={16}/> <span className="text-xs">Add a card</span></button>}
                   </div>
                </div>
             );
          })}
       </div>
    </div>
  );
};

export default AssemblyBoard;