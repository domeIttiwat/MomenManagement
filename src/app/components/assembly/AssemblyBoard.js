'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase'; 
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, GripVertical, CheckCircle, Clock, Wrench, PackageSearch, AlertTriangle, PlusCircle, RotateCcw, Check, Info } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ComponentList from './ComponentList';


// Helper to create a log entry
const createLog = async (itemId, eventType, metadata = {}) => {
  try {
    const { error } = await supabase.from('assembly_logs').insert({ 
      order_item_id: itemId, 
      event_type: eventType,
      metadata: metadata
    });
    if (error) throw error;
  } catch (err) {
    console.error(`Failed to create log for event ${eventType}:`, err);
    // Non-critical, so we don't block the UI for this.
  }
};


const AddComponentForm = ({ itemId, onAddComponent }) => {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState(1);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAddComponent(itemId, name.trim(), quantity);
        setName('');
        setQuantity(1);
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border-t border-dashed mt-2">
            <p className="text-xs font-semibold text-slate-600 mb-2">เพิ่มส่วนประกอบ Manual:</p>
            <div className="flex items-center gap-2">
                <input 
                    type="text" 
                    placeholder="ชื่อส่วนประกอบ" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="flex-grow text-sm p-1.5 border-slate-300 rounded-md shadow-sm"
                />
                <input 
                    type="number" 
                    min="1" 
                    value={quantity} 
                    onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)} 
                    className="w-16 text-sm p-1.5 border-slate-300 rounded-md shadow-sm"
                />
                <button type="submit" className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"><PlusCircle size={16}/></button>
            </div>
        </form>
    )
}

const ItemCard = ({ item, index, onComponentCheck, pickedComponents, onAddComponent, onRemoveManualComponent, onConfirmEmpty, onRevert }) => {
    const [showComponents, setShowComponents] = useState(false);
    
    const statusConfig = {
        Picking: { icon: PackageSearch, color: 'bg-sky-100 text-sky-700', label: 'รอหยิบของ' },
        Assembling: { icon: Wrench, color: 'bg-amber-100 text-amber-700', label: 'กำลังประกอบ' },
        Testing: { icon: Clock, color: 'bg-purple-100 text-purple-700', label: 'กำลังทดสอบ' },
        Done: { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'เสร็จสิ้น' },
    };
    const currentStatus = statusConfig[item.status] || statusConfig.Picking;

    const allComponents = [...(item.components || []), ...(item.manual_components || [])];
    const pickedForThisItem = pickedComponents[item.id] || new Set();
    const allComponentsPicked = allComponents.length > 0 && pickedForThisItem.size === allComponents.length;
    const hasNoComponents = allComponents.length === 0;

    return (
        <Draggable draggableId={String(item.id)} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`bg-white rounded-xl shadow-md border transition-shadow ${snapshot.isDragging ? 'shadow-xl scale-105' : ''} ${allComponentsPicked && item.status === 'Picking' ? 'border-green-400' : 'border-slate-200/80'}`}
                >
                    <div className="p-4">
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
                        {item.status === 'Assembling' && (
                            <button onClick={() => onRevert(item.id, item.status)} className="mt-2 text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1.5">
                                <RotateCcw size={12}/> ตีกลับไปขั้นตอนหยิบของ
                            </button>
                        )}
                         <div className="mt-3">
                            {!hasNoComponents ? (
                                <button onClick={() => setShowComponents(!showComponents)} className="text-sm text-blue-600 hover:underline">
                                    {showComponents ? 'ซ่อน' : 'แสดง'} Checklist ({pickedForThisItem.size}/{allComponents.length} ชิ้น)
                                </button>
                            ) : item.status === 'Picking' && (
                                <button onClick={() => onConfirmEmpty(item.id)} className="flex items-center gap-2 w-full justify-center p-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm">
                                    <Check size={18}/> ยืนยันการหยิบ (ไม่มีส่วนประกอบ)
                                </button>
                            )}
                        </div>
                    </div>
                    {showComponents && (
                        <>
                            <ComponentList 
                                components={allComponents} 
                                pickedStates={pickedForThisItem} 
                                onComponentCheck={onComponentCheck} 
                                onRemoveManualComponent={onRemoveManualComponent}
                                itemId={item.id}
                            />
                             <AddComponentForm itemId={item.id} onAddComponent={onAddComponent} />
                        </>
                    )}
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
        const newColumns = JSON.parse(JSON.stringify(initialColumns));
        order.items.forEach(item => {
            const status = ['Picking', 'Assembling', 'Testing', 'Done'].includes(item.status) ? item.status : 'Picking';
            newColumns[status].items.push(item);
        });
        return newColumns;
    });
    
    const [pickedComponents, setPickedComponents] = useState(() => {
        const initialState = {};
        order.items.forEach(item => {
            initialState[item.id] = new Set(item.picked_component_ids || []);
        });
        return initialState;
    });

    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);

    const showInfo = (message) => {
        setInfo(message);
        setTimeout(() => setInfo(null), 3000);
    }

    const moveItem = async (itemId, source, destination, isRevert = false) => {
        const sourceColId = source.droppableId;
        const destColId = destination.droppableId;

        const allItems = Object.values(columns).flatMap(c => c.items);
        const itemToMove = allItems.find(i => i.id == itemId);
        if (!itemToMove) return;

        // --- Optimistic UI Update ---
        const newColumnsState = { ...columns };
        const sourceColItems = [...newColumnsState[sourceColId].items];
        const [movedItem] = sourceColItems.splice(source.index, 1);
        movedItem.status = destColId;
        newColumnsState[sourceColId] = { ...newColumnsState[sourceColId], items: sourceColItems };

        if (sourceColId === destColId) {
            sourceColItems.splice(destination.index, 0, movedItem);
        } else {
            const destColItems = [...newColumnsState[destColId].items];
            destColItems.splice(destination.index, 0, movedItem);
            newColumnsState[destColId] = { ...newColumnsState[destColId], items: destColItems };
        }
        setColumns(newColumnsState);
        setError(null);

        // --- Database Update ---
        try {
            const { error: updateError } = await supabase
                .from('order_items')
                .update({ status: destColId })
                .eq('id', itemId);
            if (updateError) throw updateError;

            // --- Logging ---
            if (isRevert) {
                await createLog(itemId, 'REVERTED_TO_PICKING', { from: sourceColId, to: destColId });
                showInfo(`"${movedItem.name}" ถูกส่งกลับไปขั้นตอนหยิบของ`);
            } else if (sourceColId === 'Picking' && destColId === 'Assembling'){
                await createLog(itemId, 'PICKING_COMPLETED');
            }
            
        } catch (err) {
            setError(`บันทึกไม่สำเร็จ: ${err.message}.`);
            // Revert state change is complex, just show error for now.
        }
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        moveItem(draggableId, source, destination);
    };

    const handleComponentCheck = async (itemId, componentId, isChecked) => {
        const allItems = Object.values(columns).flatMap(c => c.items);
        const currentItem = allItems.find(i => i.id === itemId);
        if (!currentItem) return;

        const updatedPicks = new Set(pickedComponents[itemId] || []);
        if (isChecked) {
            updatedPicks.add(componentId);
        } else {
            updatedPicks.delete(componentId);
        }
        setPickedComponents({ ...pickedComponents, [itemId]: updatedPicks });
        setError(null);

        const updatedIdsArray = Array.from(updatedPicks);
        try {
             const { error: updateError } = await supabase
                .from('order_items')
                .update({ picked_component_ids: updatedIdsArray })
                .eq('id', itemId);
            if (updateError) throw updateError;
        } catch (err) {
            setError(`บันทึก Checklist ไม่สำเร็จ: ${err.message}`);
            return;
        }

        const allItemComponents = [...(currentItem.components || []), ...(currentItem.manual_components || [])];
        if (currentItem.status === 'Picking' && allItemComponents.length > 0 && updatedPicks.size === allItemComponents.length) {
             const source = { droppableId: 'Picking', index: columns.Picking.items.indexOf(currentItem) };
             const destination = { droppableId: 'Assembling', index: 0 };
             await moveItem(itemId, source, destination);
        }
    };

    const handleAddComponent = async (itemId, name, quantity) => {
        const newComponent = { id: uuidv4(), name, quantity, manual: true };

        const allItems = Object.values(columns).flatMap(c => c.items);
        const currentItem = allItems.find(i => i.id === itemId);
        if (!currentItem) return;

        const updatedManualComponents = [...(currentItem.manual_components || []), newComponent];

        // Optimistic UI update
        const newColumns = { ...columns };
        Object.keys(newColumns).forEach(colId => {
            newColumns[colId].items = newColumns[colId].items.map(item => 
                item.id === itemId ? { ...item, manual_components: updatedManualComponents } : item
            );
        });
        setColumns(newColumns);
        setError(null);

        // DB Update
        try {
            const { error: updateError } = await supabase
                .from('order_items')
                .update({ manual_components: updatedManualComponents })
                .eq('id', itemId);
            if (updateError) throw updateError;
            await createLog(itemId, 'MANUAL_COMPONENT_ADDED', { name, quantity });
        } catch (err) {
             setError(`เพิ่มส่วนประกอบไม่สำเร็จ: ${err.message}`);
        }
    };

    const handleRemoveManualComponent = async (itemId, componentId) => {
        const allItems = Object.values(columns).flatMap(c => c.items);
        const currentItem = allItems.find(i => i.id === itemId);
        if (!currentItem) return;

        const componentToRemove = currentItem.manual_components.find(c => c.id === componentId);
        const updatedManualComponents = currentItem.manual_components.filter(c => c.id !== componentId);

        const newColumns = { ...columns };
        Object.keys(newColumns).forEach(colId => {
            newColumns[colId].items = newColumns[colId].items.map(item => 
                item.id === itemId ? { ...item, manual_components: updatedManualComponents } : item
            );
        });
        setColumns(newColumns);

        // Also update picked set
        const updatedPicks = new Set(pickedComponents[itemId] || []);
        updatedPicks.delete(componentId);
        setPickedComponents({...pickedComponents, [itemId]: updatedPicks});

         try {
            const { error: updateError } = await supabase
                .from('order_items')
                .update({ manual_components: updatedManualComponents, picked_component_ids: Array.from(updatedPicks) })
                .eq('id', itemId);
            if (updateError) throw updateError;
            await createLog(itemId, 'MANUAL_COMPONENT_REMOVED', { name: componentToRemove.name });
        } catch (err) {
             setError(`ลบส่วนประกอบไม่สำเร็จ: ${err.message}`);
        }
    };
    
    const handleConfirmEmpty = async (itemId) => {
        const item = columns.Picking.items.find(i => i.id === itemId);
        if (!item) return;

        const source = { droppableId: 'Picking', index: columns.Picking.items.indexOf(item) };
        const destination = { droppableId: 'Assembling', index: 0 };
        await moveItem(itemId, source, destination);
    };

    const handleRevert = async (itemId, currentStatus) => {
        const item = columns[currentStatus].items.find(i => i.id === itemId);
        if (!item) return;

        const source = { droppableId: currentStatus, index: columns[currentStatus].items.indexOf(item) };
        const destination = { droppableId: 'Picking', index: 0 };
        await moveItem(itemId, source, destination, true);
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                 <div className="flex items-center mb-6">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
                        <ArrowLeft className="h-6 w-6 text-slate-600" />
                    </button>
                    <div className="ml-4 flex-grow">
                        <h1 className="text-2xl font-bold text-gray-800">บอร์ดงานประกอบ: {order.orderId}</h1>
                        <p className="text-slate-500">ลูกค้า: {order.customerName}</p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4 flex items-center gap-3" role="alert">
                        <AlertTriangle className="h-5 w-5"/>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                {info && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg relative mb-4 flex items-center gap-3" role="alert">
                        <Info className="h-5 w-5"/>
                        <span className="block sm:inline">{info}</span>
                    </div>
                )}

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
                                                <ItemCard 
                                                    item={item} 
                                                    index={index} 
                                                    key={item.id} 
                                                    onComponentCheck={handleComponentCheck} 
                                                    pickedComponents={pickedComponents} 
                                                    onAddComponent={handleAddComponent}
                                                    onRemoveManualComponent={handleRemoveManualComponent}
                                                    onConfirmEmpty={handleConfirmEmpty}
                                                    onRevert={handleRevert}
                                                />
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
