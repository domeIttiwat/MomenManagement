'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; 
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, GripVertical, CheckCircle, Clock, Wrench, PackageSearch, AlertTriangle, PlusCircle, RotateCcw, Check, Info, MessageSquare, MoreVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Menu } from '@headlessui/react';
import ComponentList from './ComponentList';
import { ConfirmationModal, ActivityModal } from './Modals';

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

const ItemCard = ({ item, index, onComponentCheck, pickedComponents, onAddComponent, onRemoveManualComponent, onConfirmEmpty, onRevert, onOpenActivityModal }) => {
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
                             <div className="flex items-center">
                                <div {...provided.dragHandleProps} className="p-1 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={20} />
                                </div>
                                 <Menu as="div" className="relative">
                                    <Menu.Button className="p-1 ml-1 rounded-full hover:bg-slate-100 text-slate-500">
                                        <MoreVertical size={20} />
                                    </Menu.Button>
                                    <Menu.Items className="absolute right-0 w-48 mt-2 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                        <div className="px-1 py-1 ">
                                        <Menu.Item>
                                            {({ active }) => (
                                            <button onClick={() => onRevert(item.id, item.status)} disabled={item.status === 'Picking'} className={`${active ? 'bg-red-100 text-red-900' : 'text-gray-900'} group flex rounded-md items-center w-full px-2 py-2 text-sm disabled:text-gray-400 disabled:bg-transparent`}>
                                                <RotateCcw className="w-5 h-5 mr-2 text-red-500" />
                                                ตีกลับ
                                            </button>
                                            )}
                                        </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Menu>
                            </div>
                        </div>
                        
                         <div className="mt-3 flex justify-between items-center">
                            {!hasNoComponents ? (
                                <button onClick={() => setShowComponents(!showComponents)} className="text-sm text-blue-600 hover:underline">
                                    {showComponents ? 'ซ่อน' : 'แสดง'} Checklist ({pickedForThisItem.size}/{allComponents.length} ชิ้น)
                                </button>
                            ) : item.status === 'Picking' ? (
                                <button onClick={() => onConfirmEmpty(item.id)} className="flex items-center gap-2 w-full justify-center p-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm">
                                    <Check size={18}/> ยืนยัน (ไม่มีส่วนประกอบ)
                                </button>
                            ) : <div/>}
                            <button onClick={() => onOpenActivityModal(item)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600">
                                <MessageSquare size={14}/>
                                <span>{item.assembly_comments?.length || 0}</span>
                            </button>
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
    const [modal, setModal] = useState({ type: null, data: null });

    const showInfo = (message) => {
        setInfo(message);
        setTimeout(() => setInfo(null), 3000);
    }

    const updateItemInState = (itemId, updates) => {
        const newColumns = { ...columns };
        let found = false;
        for (const colId in newColumns) {
            const itemIndex = newColumns[colId].items.findIndex(i => i.id === itemId);
            if (itemIndex > -1) {
                const oldItem = newColumns[colId].items[itemIndex];
                newColumns[colId].items[itemIndex] = { ...oldItem, ...updates };
                found = true;
                break;
            }
        }
        if (found) {
            setColumns(newColumns);
        }
    };

    const moveItem = async (itemId, source, destination, isRevert = false) => {
        const sourceColId = source.droppableId;
        const destColId = destination.droppableId;

        const allItems = Object.values(columns).flatMap(c => c.items);
        const itemToMove = allItems.find(i => i.id == itemId);
        if (!itemToMove) return;

        // Optimistic UI Update
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

        try {
            const { error: updateError } = await supabase.from('order_items').update({ status: destColId }).eq('id', itemId);
            if (updateError) throw updateError;

            if (isRevert) {
                await createLog(itemId, 'REVERTED_TO_PICKING', { from: sourceColId, to: destColId });
                showInfo(`"${movedItem.name}" ถูกส่งกลับไปขั้นตอนหยิบของ`);
            } else if (sourceColId === 'Picking' && destColId === 'Assembling'){
                await createLog(itemId, 'PICKING_COMPLETED');
            }
        } catch (err) {
            setError(`บันทึกไม่สำเร็จ: ${err.message}.`);
        }
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        moveItem(draggableId, source, destination);
    };

    const handleComponentCheck = async (itemId, componentId, isChecked) => {
        const currentItem = Object.values(columns).flatMap(c => c.items).find(i => i.id === itemId);
        if (!currentItem) return;

        const updatedPicks = new Set(pickedComponents[itemId] || []);
        isChecked ? updatedPicks.add(componentId) : updatedPicks.delete(componentId);
        setPickedComponents({ ...pickedComponents, [itemId]: updatedPicks });
        setError(null);

        try {
             const { error } = await supabase.from('order_items').update({ picked_component_ids: Array.from(updatedPicks) }).eq('id', itemId);
            if (error) throw error;
        } catch (err) {
            setError(`บันทึก Checklist ไม่สำเร็จ: ${err.message}`);
            return;
        }

        const allItemComponents = [...(currentItem.components || []), ...(currentItem.manual_components || [])];
        if (currentItem.status === 'Picking' && allItemComponents.length > 0 && updatedPicks.size === allItemComponents.length) {
             moveItem(itemId, { droppableId: 'Picking', index: columns.Picking.items.indexOf(currentItem) }, { droppableId: 'Assembling', index: 0 });
        }
    };

    const handleAddComponent = async (itemId, name, quantity) => {
        const newComponent = { id: uuidv4(), name, quantity, manual: true };
        const currentItem = Object.values(columns).flatMap(c => c.items).find(i => i.id === itemId);
        if (!currentItem) return;

        const updatedManualComponents = [...(currentItem.manual_components || []), newComponent];
        updateItemInState(itemId, { manual_components: updatedManualComponents });
        setError(null);

        try {
            const { error } = await supabase.from('order_items').update({ manual_components: updatedManualComponents }).eq('id', itemId);
            if (error) throw error;
            await createLog(itemId, 'MANUAL_COMPONENT_ADDED', { name, quantity });
        } catch (err) {
             setError(`เพิ่มส่วนประกอบไม่สำเร็จ: ${err.message}`);
        }
    };

    const handleRemoveManualComponent = async (itemId, componentId) => {
        const currentItem = Object.values(columns).flatMap(c => c.items).find(i => i.id === itemId);
        if (!currentItem) return;

        const componentToRemove = currentItem.manual_components.find(c => c.id === componentId);
        const updatedManualComponents = currentItem.manual_components.filter(c => c.id !== componentId);
        const updatedPicks = new Set(pickedComponents[itemId] || []);
        updatedPicks.delete(componentId);

        updateItemInState(itemId, { manual_components: updatedManualComponents, picked_component_ids: Array.from(updatedPicks) });
        setPickedComponents({...pickedComponents, [itemId]: updatedPicks});

         try {
            const { error } = await supabase.from('order_items').update({ manual_components: updatedManualComponents, picked_component_ids: Array.from(updatedPicks) }).eq('id', itemId);
            if (error) throw error;
            await createLog(itemId, 'MANUAL_COMPONENT_REMOVED', { name: componentToRemove.name });
        } catch (err) {
             setError(`ลบส่วนประกอบไม่สำเร็จ: ${err.message}`);
        }
    };
    
    const handleConfirmEmpty = async (itemId) => {
        const item = columns.Picking.items.find(i => i.id === itemId);
        if (!item) return;
        moveItem(itemId, { droppableId: 'Picking', index: columns.Picking.items.indexOf(item) }, { droppableId: 'Assembling', index: 0 });
    };

    const handleRevert = (itemId, currentStatus) => {
        const item = columns[currentStatus].items.find(i => i.id === itemId);
        if (!item) return;
        setModal({ type: 'revert', data: { itemId, currentStatus, itemName: item.name } });
    };

    const confirmRevert = () => {
        const { itemId, currentStatus } = modal.data;
        const item = columns[currentStatus].items.find(i => i.id === itemId);
        if (!item) return;
        moveItem(itemId, { droppableId: currentStatus, index: columns[currentStatus].items.indexOf(item) }, { droppableId: 'Picking', index: 0 }, true);
        setModal({ type: null, data: null });
    };

    const handleNewComment = (newComment) => {
        const itemId = newComment.order_item_id;
        const currentItem = Object.values(columns).flatMap(c => c.items).find(i => i.id === itemId);
        if (!currentItem) return;

        const updatedComments = [newComment, ...(currentItem.assembly_comments || [])];
        updateItemInState(itemId, { assembly_comments: updatedComments });
    };

    const renderModals = () => {
        if (!modal.type) return null;

        if (modal.type === 'revert') {
            return (
                <ConfirmationModal 
                    title="ยืนยันการตีกลับ" 
                    message={`คุณต้องการตีกลับ "${modal.data.itemName}" กลับไปที่ขั้นตอน 'รอหยิบของ' จริงๆ หรือ?`}
                    onConfirm={confirmRevert}
                    onCancel={() => setModal({ type: null, data: null })}
                    confirmText="ใช่, ตีกลับ"
                />
            );
        }

        if (modal.type === 'activity') {
            return (
                <ActivityModal 
                    item={modal.data}
                    onClose={() => setModal({ type: null, data: null })}
                    onCommentAdded={handleNewComment}
                />
            )
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-6">
            {renderModals()}
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
                                        <div className="min-h-[200px] space-y-4">
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
                                                    onOpenActivityModal={(item) => setModal({ type: 'activity', data: item })}
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
