'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, GripVertical, CheckCircle, Clock, Wrench, PackageSearch, MoreVertical, RotateCcw, MessageSquare, History, ImagePlus, Trash2, LoaderCircle, Check, ListChecks } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Menu } from '@headlessui/react';
import { ConfirmationModal } from './Modals'; // Simplified modal import
import ComponentList from './ComponentList';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

const formatDate = (dateString) => {
    if(!dateString) return "";
    return format(parseISO(dateString), 'd MMM yyyy, HH:mm', { locale: th });
}

// --- Log and Comment display components, now part of the card ---
const LogEntry = ({ log }) => (
    <div className="flex gap-3 py-3 border-b border-slate-100">
        <div className="mt-1"><History size={16} className="text-slate-500"/></div>
        <div>
            <p className="text-sm font-semibold text-slate-700 capitalize">{log.event_type.replace(/_/g, ' ')}</p>
            <p className="text-xs text-slate-400">{formatDate(log.created_at)}</p>
        </div>
    </div>
);

const CommentEntry = ({ comment }) => (
    <div className="flex gap-3 py-3 border-b border-slate-100">
        <div className="mt-1"><MessageSquare size={16} className="text-slate-500"/></div>
        <div className="flex-1">
            {comment.comment_text && <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.comment_text}</p>}
            {comment.image_urls && comment.image_urls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {comment.image_urls.map(url => 
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="Comment image" className="h-20 w-20 rounded-md object-cover hover:ring-2 ring-blue-500 transition" />
                        </a>
                    )}
                </div>
            )}
            <p className="text-xs text-slate-400 mt-2">{formatDate(comment.created_at)}</p>
        </div>
    </div>
);

const CommentForm = ({ itemId, onCommentAdded }) => {
    const [commentText, setCommentText] = useState('');
    const [imageFiles, setImageFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleImageSelect = (e) => {
        if (e.target.files.length > 0) {
            setImageFiles(Array.from(e.target.files));
        }
    }

    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim() && imageFiles.length === 0) return;

        setIsSubmitting(true);
        setError(null);
        
        try {
            let imageUrls = [];
            if (imageFiles.length > 0) {
                const uploadPromises = imageFiles.map(file => {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${uuidv4()}.${fileExt}`;
                    return supabase.storage.from('assembly_comment_images').upload(fileName, file);
                });

                const uploadResults = await Promise.all(uploadPromises);
                
                for (const result of uploadResults) {
                    if(result.error) throw result.error;
                    const { data: { publicUrl } } = supabase.storage.from('assembly_comment_images').getPublicUrl(result.data.path);
                    imageUrls.push(publicUrl);
                }
            }
            
            const { data: newComment, error: commentError } = await supabase
                .from('assembly_comments')
                .insert({ 
                    order_item_id: itemId,
                    comment_text: commentText,
                    image_urls: imageUrls,
                })
                .select()
                .single();

            if (commentError) throw commentError;
            
            onCommentAdded(newComment); // Callback to update parent state
            setCommentText('');
            setImageFiles([]);

        } catch(err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="p-4 border-t bg-slate-50">
            <form onSubmit={handleSubmitComment}>
                <textarea 
                    value={commentText} 
                    onChange={e => setCommentText(e.target.value)} 
                    placeholder="เพิ่มคอมเมนต์..." 
                    className="w-full p-2 border border-slate-300 rounded-md text-sm shadow-sm"
                    rows="3"
                />
                <div className="mt-2 flex justify-between items-center">
                    <div>
                        <label htmlFor={`file-upload-${itemId}`} className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2">
                            <ImagePlus size={18}/>
                            <span>{imageFiles.length > 0 ? `${imageFiles.length} รูป` : 'แนบรูปภาพ'}</span>
                        </label>
                        <input id={`file-upload-${itemId}`} type="file" multiple accept="image/*" onChange={handleImageSelect} className="hidden"/>
                        {imageFiles.length > 0 && 
                            <button type="button" onClick={() => setImageFiles([])} className="ml-2 text-xs text-red-500"><Trash2 size={12} className="inline"/> ล้าง</button>}
                    </div>
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg text-sm disabled:bg-blue-300 flex items-center gap-2">
                        {isSubmitting && <LoaderCircle size={16} className="animate-spin"/>}
                        ส่ง
                    </button>
                </div>
                {error && <p className="text-xs text-red-500 mt-2">Error: {error}</p>}
            </form>
        </div>
    );
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
        <form onSubmit={handleSubmit} className="p-4 border-t border-dashed">
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
                <button type="submit" className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"><Check size={16}/></button>
            </div>
        </form>
    )
}

// --- Main Item Card with integrated tabs ---
const ItemCard = ({ item, index, onComponentCheck, pickedComponents, onAddComponent, onRemoveManualComponent, onConfirmEmpty, onRevert, onCommentAdded, onLogAdded }) => {
    const [activeTab, setActiveTab] = useState('checklist');
    
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

    return (
        <Draggable draggableId={String(item.id)} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`bg-white rounded-xl shadow-md border flex flex-col transition-shadow ${snapshot.isDragging ? 'shadow-xl scale-105' : ''} ${allComponentsPicked && item.status === 'Picking' ? 'border-green-400' : 'border-slate-200/80'}`}
                >
                    <div className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-grow pr-4">
                                <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${currentStatus.color}`}>
                                    <currentStatus.icon size={12} />
                                    {currentStatus.label}
                                </div>
                                <p className="text-lg font-bold text-slate-800 mt-2">{item.name}</p>
                                <p className="text-sm text-slate-500">SKU: {item.sku} | จำนวน: {item.quantity}</p>
                            </div>
                            <div className="flex items-center">
                                <div {...provided.dragHandleProps} className="p-1 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={20} />
                                </div>
                                {item.status !== 'Picking' && (
                                    <Menu as="div" className="relative">
                                        <Menu.Button className="p-1 ml-1 rounded-full hover:bg-slate-100 text-slate-500">
                                            <MoreVertical size={20} />
                                        </Menu.Button>
                                        <Menu.Items className="absolute right-0 w-48 mt-2 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                            <div className="px-1 py-1 ">
                                            <Menu.Item>
                                                {({ active }) => (
                                                <button onClick={() => onRevert(item.id, item.status)} className={`${active ? 'bg-red-100 text-red-900' : 'text-gray-900'} group flex rounded-md items-center w-full px-2 py-2 text-sm`}>
                                                    <RotateCcw className="w-5 h-5 mr-2 text-red-500" />
                                                    ตีกลับไปขั้นตอนหยิบของ
                                                </button>
                                                )}
                                            </Menu.Item>
                                            </div>
                                        </Menu.Items>
                                    </Menu>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Tabs for content */}
                    <div className="border-b border-t flex-shrink-0">
                        <div className="flex gap-4 px-4">
                            <button onClick={() => setActiveTab('checklist')} className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${activeTab === 'checklist' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}><ListChecks size={16}/> Checklist ({pickedForThisItem.size}/{allComponents.length})</button>
                            <button onClick={() => setActiveTab('comments')} className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${activeTab === 'comments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}><MessageSquare size={16}/> คอมเมนต์ ({item.assembly_comments.length})</button>
                            <button onClick={() => setActiveTab('history')} className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}><History size={16}/> ประวัติ ({item.assembly_logs.length})</button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="bg-slate-50/50 flex-grow">
                        {activeTab === 'checklist' && (
                            <div>
                                {allComponents.length > 0 ? (
                                     <ComponentList 
                                        components={allComponents} 
                                        pickedStates={pickedForThisItem} 
                                        onComponentCheck={onComponentCheck} 
                                        onRemoveManualComponent={onRemoveManualComponent}
                                        itemId={item.id}
                                    />
                                ) : (
                                    <p className="text-sm text-center py-6 text-slate-500">ไม่มีส่วนประกอบในรายการ</p>
                                )}
                                <AddComponentForm itemId={item.id} onAddComponent={onAddComponent} />
                            </div>
                        )}
                        {activeTab === 'comments' && (
                            <div>
                                <div className="p-4 max-h-60 overflow-y-auto">{item.assembly_comments.length > 0 ? item.assembly_comments.map(c => <CommentEntry key={c.id} comment={c}/>) : <p className="text-sm text-center py-6 text-slate-500">ยังไม่มีคอมเมนต์</p>}</div>
                                <CommentForm itemId={item.id} onCommentAdded={onCommentAdded} />
                            </div>
                        )}
                        {activeTab === 'history' && (
                            <div className="p-4 max-h-80 overflow-y-auto">{item.assembly_logs.length > 0 ? item.assembly_logs.map(log => <LogEntry key={log.id} log={log} />) : <p className="text-sm text-center py-6 text-slate-500">ยังไม่มีประวัติการทำงาน</p>}</div>
                        )}
                    </div>
                     {item.status === 'Picking' && allComponents.length === 0 && (
                        <div className="p-4 border-t">
                            <button onClick={() => onConfirmEmpty(item.id)} className="flex items-center gap-2 w-full justify-center p-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm">
                                <Check size={18}/> ยืนยันการหยิบ (ไม่มีส่วนประกอบ)
                            </button>
                        </div>
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
    const [modal, setModal] = useState({ type: null, data: null });

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
    
    const createLogAndUpdateState = async (itemId, eventType, metadata = {}) => {
        try {
            const { data: newLog, error } = await supabase
                .from('assembly_logs')
                .insert({ order_item_id: itemId, event_type: eventType, metadata })
                .select()
                .single();

            if (error) throw error;

            // Update state immediately
            const currentItem = Object.values(columns).flatMap(c => c.items).find(i => i.id === itemId);
            if(currentItem) {
                const updatedLogs = [newLog, ...(currentItem.assembly_logs || [])];
                updateItemInState(itemId, { assembly_logs: updatedLogs });
            }
            return newLog;
        } catch (err) {
            console.error(`Failed to create log for event ${eventType}:`, err);
            setError(`สร้าง Log ไม่สำเร็จ: ${err.message}`);
        }
    };

    const moveItem = async (itemId, source, destination, isRevert = false) => {
        const sourceColId = source.droppableId;
        const destColId = destination.droppableId;

        const allItems = Object.values(columns).flatMap(c => c.items);
        const itemToMove = allItems.find(i => i.id == itemId);
        if (!itemToMove) return;

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
                await createLogAndUpdateState(itemId, 'REVERTED_TO_PICKING', { from: sourceColId });
            } else if (sourceColId === 'Picking' && destColId === 'Assembling'){
                await createLogAndUpdateState(itemId, 'PICKING_COMPLETED');
            }
        } catch (err) {
            setError(`บันทึกการย้ายไม่สำเร็จ: ${err.message}.`);
            // TODO: Revert UI state on failure
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
        const currentItem = Object.values(columns).flatMap(c => c.items).find(i => i.id === itemId);
        if (!currentItem) return;
        
        const newComponent = { id: uuidv4(), name, quantity, manual: true };
        const updatedManualComponents = [...(currentItem.manual_components || []), newComponent];
        updateItemInState(itemId, { manual_components: updatedManualComponents });
        setError(null);

        try {
            const { error } = await supabase.from('order_items').update({ manual_components: updatedManualComponents }).eq('id', itemId);
            if (error) throw error;
            await createLogAndUpdateState(itemId, 'MANUAL_COMPONENT_ADDED', { name, quantity });
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

        updateItemInState(itemId, { manual_components: updatedManualComponents });
        setPickedComponents({...pickedComponents, [itemId]: updatedPicks});

         try {
            const { error } = await supabase.from('order_items').update({ manual_components: updatedManualComponents, picked_component_ids: Array.from(updatedPicks) }).eq('id', itemId);
            if (error) throw error;
            await createLogAndUpdateState(itemId, 'MANUAL_COMPONENT_REMOVED', { name: componentToRemove.name });
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

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-6">
            {modal.type === 'revert' && (
                <ConfirmationModal 
                    title="ยืนยันการตีกลับ" 
                    message={`คุณต้องการตีกลับ "${modal.data.itemName}" กลับไปที่ขั้นตอน 'รอหยิบของ' จริงๆ หรือ?`}
                    onConfirm={confirmRevert}
                    onCancel={() => setModal({ type: null, data: null })}
                    confirmText="ใช่, ตีกลับ"
                />
            )}
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
                         <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
                        {Object.entries(columns).map(([id, column]) => (
                            <Droppable droppableId={id} key={id}>
                                {(provided, snapshot) => (
                                    <div 
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`p-4 rounded-xl bg-slate-100/70 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-100' : ''}`}
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
                                                    onCommentAdded={handleNewComment}
                                                    onLogAdded={createLogAndUpdateState}
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
