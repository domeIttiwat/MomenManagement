'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, GripVertical, CheckCircle, Clock, Wrench, PackageSearch } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ComponentList from './ComponentList'; // Import the new component

// A more robust card component
const ItemCard = ({ item, index }) => {
    const [showComponents, setShowComponents] = useState(false);

    const statusConfig = {
        Picking: { icon: PackageSearch, color: 'bg-sky-100 text-sky-700', label: 'รอหยิบของ' },
        Assembling: { icon: Wrench, color: 'bg-amber-100 text-amber-700', label: 'กำลังประกอบ' },
        Testing: { icon: Clock, color: 'bg-purple-100 text-purple-700', label: 'กำลังทดสอบ' },
        Done: { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'เสร็จสิ้น' },
    };

    const currentStatus = statusConfig[item.status] || statusConfig.Picking;

    return (
        <Draggable draggableId={String(item.id)} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`bg-white rounded-xl shadow-md border border-slate-200/80 mb-4 p-4 transition-shadow ${snapshot.isDragging ? 'shadow-xl scale-105' : ''}`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-grow pr-4">
                            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${currentStatus.color}`}>
                                <currentStatus.icon size={12} />
                                {currentStatus.label}
                            </div>
                            <p className="text-lg font-bold text-slate-800 mt-2">{item.name}</p>
                            <p className="text-sm text-slate-500">SKU: {item.sku}</p>
                            <p className="text-sm text-slate-500">จำนวน: {item.quantity}</p>
                        </div>
                        <div {...provided.dragHandleProps} className="p-2 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                            <GripVertical size={20} />
                        </div>
                    </div>
                    {/* Collapsible Component List */}
                    <div className="mt-3">
                        <button onClick={() => setShowComponents(!showComponents)} className="text-sm text-blue-600 hover:underline">
                            {showComponents ? 'ซ่อนส่วนประกอบ' : 'แสดงส่วนประกอบ'} ({item.components?.length || 0})
                        </button>
                        {showComponents && <ComponentList components={item.components} />}
                    </div>
                </div>
            )}
        </Draggable>
    );
};

export default function AssemblyBoard({ order, onBack }) {
    const initialColumns = {
        'Picking': { name: 'รอหยิบของ', items: [] },
        'Assembling': { name: 'กำลังประกอบ', items: [] },
        'Testing': { name: 'ทดสอบ', items: [] },
        'Done': { name: 'เสร็จสิ้น', items: [] },
    };

    const [columns, setColumns] = useState(() => {
        const newColumns = JSON.parse(JSON.stringify(initialColumns)); // Deep copy
        order.items.forEach(item => {
            const status = item.status || 'Picking';
            if (newColumns[status]) {
                newColumns[status].items.push(item);
            } else {
                 newColumns['Picking'].items.push(item); // Default to picking if status is unknown
            }
        });
        return newColumns;
    });

    const onDragEnd = (result) => {
        if (!result.destination) return;

        const { source, destination } = result;
        const sourceCol = columns[source.droppableId];
        const destCol = columns[destination.droppableId];
        const sourceItems = [...sourceCol.items];
        const [removed] = sourceItems.splice(source.index, 1);

        // Update status of the moved item
        removed.status = destination.droppableId;

        if (source.droppableId === destination.droppableId) {
            sourceItems.splice(destination.index, 0, removed);
            setColumns({ ...columns, [source.droppableId]: { ...sourceCol, items: sourceItems } });
        } else {
            const destItems = [...destCol.items];
            destItems.splice(destination.index, 0, removed);
            setColumns({ 
                ...columns, 
                [source.droppableId]: { ...sourceCol, items: sourceItems },
                [destination.droppableId]: { ...destCol, items: destItems }
            });
        }
        // Here you would typically also update the database
        // e.g., updateItemStatus(removed.id, destination.droppableId);
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                 <div className="flex items-center mb-6">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
                        <ArrowLeft className="h-6 w-6 text-slate-600" />
                    </button>
                    <div className="ml-4">
                        <h1 className="text-2xl font-bold text-gray-800">บอร์ดงานประกอบ: {order.orderId}</h1>
                        <p className="text-slate-500">ลูกค้า: {order.customerName}</p>
                    </div>
                </div>

                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {Object.entries(columns).map(([id, column]) => (
                            <Droppable droppableId={id} key={id}>
                                {(provided, snapshot) => (
                                    <div 
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`p-4 rounded-xl bg-slate-100 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-100' : ''}`}
                                    >
                                        <h2 className="text-lg font-semibold text-slate-700 mb-4 px-2">{column.name}</h2>
                                        <div className="min-h-[200px]">
                                            {column.items.map((item, index) => (
                                                <ItemCard item={item} index={index} key={item.id} />
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        ))}
                    </div>
                </DragDropContext>
            </div>
        </div>
    );
}
