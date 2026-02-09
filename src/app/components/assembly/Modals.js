'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { X, AlertTriangle, MessageSquare, History, ImagePlus, Trash2, LoaderCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

// --- General Purpose Modal Shell ---
const Modal = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

// --- Confirmation Modal ---
export const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "ยืนยัน", cancelText = "ยกเลิก" }) => (
    <Modal onClose={onCancel}>
        <div className="p-6">
            <div className="flex items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-bold text-gray-900">{title}</h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500">{message}</p>
                    </div>
                </div>
            </div>
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-xl">
            <button type="button" onClick={onConfirm} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm">{confirmText}</button>
            <button type="button" onClick={onCancel} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">{cancelText}</button>
        </div>
    </Modal>
);

const formatDate = (dateString) => {
    if(!dateString) return "";
    return format(parseISO(dateString), 'd MMM yyyy, HH:mm', { locale: th });
}

// --- History / Comments Modal ---
export const ActivityModal = ({ item, onClose, onCommentAdded }) => {
    const [activeTab, setActiveTab] = useState('comments');
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
                    order_item_id: item.id,
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

    const LogEntry = ({ log }) => (
        <div className="flex gap-3 py-3 border-b border-slate-100">
            <div className="mt-1"><History size={16} className="text-slate-500"/></div>
            <div>
                <p className="text-sm font-semibold text-slate-700">{log.event_type.replace(/_/g, ' ')}</p>
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
                                <img src={url} alt="Comment image" className="h-20 w-20 rounded-md object-cover hover:ring-2 ring-blue-500" />
                            </a>
                        )}
                    </div>
                )}
                 <p className="text-xs text-slate-400 mt-2">{formatDate(comment.created_at)}</p>
            </div>
        </div>
    )

    return (
        <Modal onClose={onClose}>
            <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-bold text-gray-800">ประวัติ & คอมเมนต์: {item.name}</h3>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button>
            </div>

            <div className="flex-shrink-0 border-b">
                <div className="flex gap-4 px-4">
                    <button onClick={() => setActiveTab('comments')} className={`py-3 text-sm font-semibold border-b-2 ${activeTab === 'comments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>คอมเมนต์ ({item.assembly_comments.length})</button>
                    <button onClick={() => setActiveTab('history')} className={`py-3 text-sm font-semibold border-b-2 ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>ประวัติ ({item.assembly_logs.length})</button>
                </div>
            </div>
            
            <div className="overflow-y-auto flex-grow p-4">
                {activeTab === 'history' && (
                    <div>{item.assembly_logs.length > 0 ? item.assembly_logs.map(log => <LogEntry key={log.id} log={log} />) : <p className="text-sm text-center py-8 text-slate-500">ยังไม่มีประวัติการทำงาน</p>}</div>
                )}
                {activeTab === 'comments' && (
                     <div>{item.assembly_comments.length > 0 ? item.assembly_comments.map(comment => <CommentEntry key={comment.id} comment={comment}/>) : <p className="text-sm text-center py-8 text-slate-500">ยังไม่มีคอมเมนต์</p>}</div>
                )}
            </div>

            {activeTab === 'comments' && (
                 <div className="p-4 border-t bg-slate-50 rounded-b-xl">
                    <form onSubmit={handleSubmitComment}>
                        <textarea 
                            value={commentText} 
                            onChange={e => setCommentText(e.target.value)} 
                            placeholder="เพิ่มคอมเมนต์..." 
                            className="w-full p-2 border border-slate-300 rounded-md text-sm"
                            rows="3"
                        />
                        <div className="mt-2 flex justify-between items-center">
                            <div>
                                <label htmlFor={`file-upload-${item.id}`} className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2">
                                    <ImagePlus size={18}/>
                                    <span>{imageFiles.length > 0 ? `${imageFiles.length} รูป` : 'แนบรูปภาพ'}</span>
                                </label>
                                <input id={`file-upload-${item.id}`} type="file" multiple accept="image/*" onChange={handleImageSelect} className="hidden"/>
                                {imageFiles.length > 0 && 
                                    <button onClick={() => setImageFiles([])} className="ml-2 text-xs text-red-500"><Trash2 size={12} className="inline"/> ล้าง</button>}
                            </div>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg text-sm disabled:bg-blue-300 flex items-center gap-2">
                                {isSubmitting && <LoaderCircle size={16} className="animate-spin"/>}
                                ส่ง
                            </button>
                        </div>
                        {error && <p className="text-xs text-red-500 mt-2">Error: {error}</p>}
                    </form>
                 </div>
            )}
        </Modal>
    );
};