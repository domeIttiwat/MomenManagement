import React, { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import AssemblyCard from './AssemblyCard';
import { MoreHorizontal, Plus, ArrowLeft, ArrowRight } from 'lucide-react';

const columns = [
  { 
    id: 'preparing', 
    title: 'Preparing', 
    headerColor: 'border-t-4 border-yellow-500'
  },
  { 
    id: 'assembling', 
    title: 'Assembly', 
    headerColor: 'border-t-4 border-blue-500'
  },
  { 
    id: 'testing', 
    title: 'QC Testing', 
    headerColor: 'border-t-4 border-purple-500'
  },
  { 
    id: 'completed', 
    title: 'Done', 
    headerColor: 'border-t-4 border-green-500'
  },
];

const AssemblyBoard = ({ jobs, onJobClick, onManualMove, onJobUpdate, onAddPartRequest }) => {
  const [activeColIndex, setActiveColIndex] = useState(0);

  const nextCol = () => setActiveColIndex(prev => Math.min(prev + 1, columns.length - 1));
  const prevCol = () => setActiveColIndex(prev => Math.max(prev - 1, 0));

  return (
    <div className="h-full flex flex-col md:block">
       
       {/* Mobile Nav */}
       <div className="md:hidden flex items-center justify-between mb-4 bg-[#22272b] p-3 rounded-lg border border-white/5 shadow-md shrink-0">
          <button onClick={prevCol} disabled={activeColIndex === 0} className={`p-1 ${activeColIndex === 0 ? 'text-gray-600' : 'text-gray-300'}`}><ArrowLeft/></button>
          <span className="font-bold text-gray-200">{columns[activeColIndex].title}</span>
          <button onClick={nextCol} disabled={activeColIndex === columns.length - 1} className={`p-1 ${activeColIndex === columns.length - 1 ? 'text-gray-600' : 'text-gray-300'}`}><ArrowRight/></button>
       </div>

       {/* Board Columns Container */}
       <div className="flex md:flex-row h-full gap-4 overflow-x-auto items-start snap-x snap-mandatory md:snap-none">
          {columns.map((col, index) => {
             const colJobs = jobs.filter(j => j.stage === col.id);
             const isHiddenOnMobile = index !== activeColIndex ? 'hidden md:flex' : 'flex';

             return (
                <div 
                   key={col.id} 
                   className={`${isHiddenOnMobile} flex-col w-full md:w-72 shrink-0 max-h-full rounded-xl bg-[#101204] border border-white/5 shadow-lg snap-center`}
                >
                   {/* Column Header */}
                   <div className={`p-3 flex justify-between items-center shrink-0 ${col.headerColor} bg-[#101204] rounded-t-xl`}>
                       <h3 className="font-bold text-sm text-gray-300 px-1">{col.title} <span className="ml-1 text-gray-500 text-xs">{colJobs.length}</span></h3>
                       <button className="text-gray-500 hover:text-gray-300 p-1 hover:bg-white/10 rounded"><MoreHorizontal size={16}/></button>
                   </div>
   
                   {/* Drop Zone */}
                   <Droppable droppableId={col.id}>
                   {(provided, snapshot) => (
                       <div
                           {...provided.droppableProps}
                           ref={provided.innerRef}
                           className={`flex-1 overflow-y-auto px-2 py-1 min-h-[100px] scrollbar-thin scrollbar-thumb-white/20 transition-colors ${
                               snapshot.isDraggingOver ? 'bg-white/5' : ''
                           }`}
                       >
                           {colJobs.map((job, idx) => (
                               <Draggable key={job.id} draggableId={String(job.id)} index={idx}>
                                   {(provided, snapshot) => (
                                       <div
                                           ref={provided.innerRef}
                                           {...provided.draggableProps}
                                           {...provided.dragHandleProps}
                                           className="mb-2"
                                           style={provided.draggableProps.style}
                                       >
                                           <AssemblyCard 
                                                job={job} 
                                                isDragging={snapshot.isDragging}
                                                onClick={() => onJobClick(job)}
                                                onUpdate={onJobUpdate} 
                                                onAddPart={onAddPartRequest} 
                                           />
                                           
                                           {/* Mobile Move Buttons */}
                                           <div className={`md:hidden flex justify-between mt-1 px-1 ${snapshot.isDragging ? 'opacity-0' : 'opacity-100'}`}>
                                               {index > 0 && <button onClick={() => onManualMove(job.id, columns[index - 1].id)} className="text-[10px] bg-white/10 px-2 py-1 rounded text-gray-400">Prev</button>}
                                               {index < columns.length - 1 && <button onClick={() => onManualMove(job.id, columns[index + 1].id)} className="text-[10px] bg-white/10 px-2 py-1 rounded text-gray-400">Next</button>}
                                           </div>
                                       </div>
                                   )}
                               </Draggable>
                           ))}
                           {provided.placeholder}
                       </div>
                   )}
                   </Droppable>

                   {/* Footer (Add Card button mock) */}
                   <div className="p-2 shrink-0">
                      <button className="w-full flex items-center gap-2 text-gray-500 hover:bg-white/10 hover:text-gray-300 p-2 rounded-lg text-sm transition-colors text-left">
                         <Plus size={16}/> <span className="text-xs">Add a card</span>
                      </button>
                   </div>
                </div>
             );
          })}
       </div>
    </div>
  );
};

export default AssemblyBoard;