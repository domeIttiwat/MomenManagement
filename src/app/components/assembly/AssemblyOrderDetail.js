'use client';

import { ArrowLeft, CheckCircle, Package, Settings, Wrench, Shield, User, Calendar, Truck } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';

const STAGE_DETAILS = {
    Picking: { icon: Package, title: 'เตรียมของ', color: 'text-yellow-600', description: 'กำลังรวบรวมชิ้นส่วนและอะไหล่ทั้งหมดสำหรับออเดอร์นี้' },
    Assembling: { icon: Wrench, title: 'กำลังประกอบ', color: 'text-blue-600', description: 'ช่างเทคนิคกำลังดำเนินการประกอบยานพาหนะ' },
    Testing: { icon: Shield, title: 'กำลังทดสอบ', color: 'text-purple-600', description: 'อยู่ระหว่างการตรวจสอบคุณภาพและความปลอดภัยก่อนส่งมอบ' },
    Completed: { icon: CheckCircle, title: 'ประกอบเสร็จสิ้น', color: 'text-green-600', description: 'ยานพาหนะพร้อมสำหรับการจัดส่งหรือรับสินค้า' },
};

export default function AssemblyOrderDetail({ order, onBack }) {

    const currentStage = STAGE_DETAILS[order.status] || {
        icon: Settings,
        title: 'ไม่ระบุสถานะ',
        color: 'text-slate-500',
        description: 'ไม่พบสถานะปัจจุบันของออเดอร์นี้'
    };

    const getDueDateInfo = (dueDate) => {
        if (!dueDate) return { text: 'ไม่ได้ระบุวันส่ง', className: 'text-slate-500' };

        try {
            const date = parseISO(dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diff = differenceInDays(date, today);

            if (diff < 0) return { text: `เลยกำหนด ${Math.abs(diff)} วัน`, className: 'text-red-600' };
            if (diff === 0) return { text: 'กำหนดส่งวันนี้', className: 'text-red-500' };
            if (diff <= 3) return { text: `อีก ${diff} วัน`, className: 'text-amber-600' };
            return { text: `เหลือ ${diff} วัน`, className: 'text-green-600' };
        } catch (e) {
            return { text: 'รูปแบบวันส่งไม่ถูกต้อง', className: 'text-slate-500' };
        }
    };

    const mainItem = order.vehicleName || order.mostExpensiveItemName || 'รายการหลัก';

    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="bg-slate-50 min-h-screen animate-in fade-in duration-300">
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                {/* Header */}
                <header className="flex items-center gap-4 mb-6">
                    <button 
                        onClick={onBack} 
                        className="p-2 rounded-full hover:bg-slate-200 transition-colors"
                    >
                        <ArrowLeft className="text-slate-600" size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">{mainItem}</h1>
                        <p className="text-slate-500 font-mono text-sm">{order.orderId}</p>
                    </div>
                </header>

                {/* Main Content */}
                <main className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
                    
                    {/* Current Status Section */}
                    <div className="bg-slate-100/80 p-5 rounded-lg flex items-center gap-5 border border-slate-200">
                        <currentStage.icon className={`h-10 w-10 flex-shrink-0 ${currentStage.color}`} />
                        <div>
                            <p className={`font-bold text-xl ${currentStage.color}`}>{currentStage.title}</p>
                            <p className="text-slate-600">{currentStage.description}</p>
                        </div>
                    </div>

                    {/* Customer & Due Date Section */}
                    <div className="border-t border-slate-200 mt-6 pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-500 text-sm">ลูกค้า</p>
                                <p className="font-semibold text-lg text-slate-800 flex items-center gap-2"><User size={16} />{order.customerName}</p>
                            </div>
                            <div className="text-left md:text-right">
                                <p className={`text-lg ${getDueDateInfo(order.dueDate).className} font-bold`}>{getDueDateInfo(order.dueDate).text}</p>
                                <p className="text-slate-500">กำหนดส่ง: {order.dueDate ? format(parseISO(order.dueDate), 'd MMMM yyyy', { locale: th }) : 'ไม่ได้ระบุ'}</p>
                            </div>
                        </div>
                        <div className="border-t border-slate-200 mt-4 pt-4 flex flex-wrap gap-x-6 gap-y-3 text-slate-600">
                            <div className="flex items-center gap-2">
                                <Package size={16} />
                                <span>รวม {totalQuantity} ชิ้น</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={16} />
                                <span>สั่งเมื่อ: {order.items?.[0]?.created_at ? format(parseISO(order.items[0].created_at), 'd MMM yy', { locale: th }) : 'ไม่ระบุ'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Items List Section */}
                    <div className="border-t border-slate-200 mt-6 pt-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">รายการสินค้าในออเดอร์</h3>
                        <ul className="space-y-3">
                            {order.items.map(item => (
                                <li key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-md border border-slate-200/80">
                                    <div>
                                        {/* FIX: Use optional chaining and provide a fallback name */}
                                        <p className="font-medium text-slate-800">{item.products?.name || '[ไม่มีชื่อสินค้า]'}</p>
                                        {/* FIX: Use optional chaining for SKU as well */}
                                        <p className="text-sm text-slate-500 font-mono">SKU: {item.products?.sku || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-slate-700">x{item.quantity}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                </main>
            </div>
        </div>
    );
}
