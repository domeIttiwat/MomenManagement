import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Filter, Shield, ShoppingBag, Wrench, PieChart, 
  DollarSign, Activity, Users, Calendar, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, PieChart as RePieChart, Pie, Cell 
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { 
  startOfMonth, endOfMonth, subMonths, 
  startOfYear, endOfYear, subYears, 
  startOfQuarter, endOfQuarter, setQuarter,
  eachDayOfInterval, eachMonthOfInterval, 
  format, isSameMonth, isWithinInterval, isValid, parseISO 
} from 'date-fns';
import { th } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext'; 

// Components เดิม
import StatCards from './StatCards';
import SalesChart from './SalesChart';
import MarketingChart from './MarketingChart';
import CategoryChart from './CategoryChart';
import TopRankings from './TopRankings';

const DashboardMain = () => {
  const auth = useAuth();
  const role = auth?.role; 
  
  const [activeTab, setActiveTab] = useState('overview'); 
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('this_month');
  const [compareMode, setCompareMode] = useState('prev_period');
  
  const [rawData, setRawData] = useState({ 
    orders: [], 
    services: [], 
    marketing: [], 
    products: [] 
  });
  
  const [mounted, setMounted] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*), order_payments(*)')
        .order('order_date', { ascending: true });

      // 2. Fetch Services
      const { data: services } = await supabase
        .from('services')
        .select('*, service_items(*), service_assignees(user:user_id(first_name, last_name)), service_payments(*)')
        .order('received_date', { ascending: true });

      // 3. Fetch Marketing
      const { data: marketing } = await supabase
        .from('marketing_expenses')
        .select('*')
        .order('expense_date', { ascending: true });

      // 4. Fetch Products (เพื่อนำมา map หมวดหมู่)
      const { data: products } = await supabase
        .from('products')
        .select('id, name, category_id, categories(name), product_categories(categories(name))');

      setRawData({ 
        orders: orders || [], 
        services: services || [],
        marketing: marketing || [],
        products: products || [] 
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    setMounted(true);
    fetchData(); 
  }, []);

  const processedData = useMemo(() => {
    if (!mounted) return null;

    const { orders, services, marketing, products } = rawData;
    const now = new Date();
    
    // --- 1. Date Filter Logic ---
    let start, end, prevStart, prevEnd;
    let groupBy = 'day';

    if (dateFilter === 'this_month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
      prevStart = startOfMonth(subMonths(now, 1));
      prevEnd = endOfMonth(subMonths(now, 1));
      groupBy = 'day';
    } else if (dateFilter === 'last_month') {
      start = startOfMonth(subMonths(now, 1));
      end = endOfMonth(subMonths(now, 1));
      prevStart = startOfMonth(subMonths(now, 2));
      prevEnd = endOfMonth(subMonths(now, 2));
      groupBy = 'day';
    } else if (['Q1', 'Q2', 'Q3', 'Q4'].includes(dateFilter)) {
      const qIndex = parseInt(dateFilter.slice(1));
      const qDate = setQuarter(now, qIndex);
      start = startOfQuarter(qDate);
      end = endOfQuarter(qDate);
      const prevQDate = subMonths(start, 3);
      prevStart = startOfQuarter(prevQDate);
      prevEnd = endOfQuarter(prevQDate);
      groupBy = 'month';
    } else if (dateFilter === 'this_year') {
      start = startOfYear(now);
      end = endOfYear(now);
      prevStart = startOfYear(subYears(now, 1));
      prevEnd = endOfYear(subYears(now, 1));
      groupBy = 'month';
    }

    const safeDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return isValid(d) ? d : null;
    };

    const filterByDate = (data, field) => data.filter(item => {
      const d = safeDate(item[field]);
      return d && isWithinInterval(d, { start, end });
    });

    const currentOrders = filterByDate(orders, 'order_date');
    const currentServices = filterByDate(services, 'received_date');
    const currentMarketing = filterByDate(marketing, 'expense_date');

    const prevOrders = orders.filter(o => {
        const d = safeDate(o.order_date);
        return d && d >= prevStart && d <= prevEnd;
    });
    
    // --- 2. Calculate Stats ---
    const isValidItem = (status) => status !== 'Cancelled' && status !== 'Quotation';

    const calcOrderStats = (ords) => {
        const validOrds = ords.filter(o => isValidItem(o.status));
        
        // ยอดขายรวมตามใบสั่งซื้อ
        const totalSalesValue = validOrds.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);
        
        // ยอดรับจริง (Cash In) จาก payments
        const actualReceived = validOrds.reduce((sum, o) => {
             const payments = o.order_payments || [];
             return sum + payments.reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
        }, 0);

        const outstanding = totalSalesValue - actualReceived;
        
        let productCost = 0;
        validOrds.forEach(o => {
            productCost += o.order_items?.reduce((s, i) => s + (Number(i.cost_price)*Number(i.quantity)), 0) || 0;
        });
        const shipping = validOrds.reduce((sum, o) => sum + (Number(o.shipping_cost) || 0), 0);
        
        const cost = productCost + shipping;
        // กำไร (Profit) คิดจากยอดขาย - ต้นทุน (Accrual Basis)
        const profit = totalSalesValue - cost; 

        return { revenue: actualReceived, salesValue: totalSalesValue, outstanding, cost, profit, count: validOrds.length }; 
    };

    const calcServiceStats = (srvs) => {
        const validSrvs = srvs.filter(s => isValidItem(s.status));
        
        const totalSalesValue = validSrvs.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0);

        const actualReceived = validSrvs.reduce((sum, s) => {
             const payments = s.service_payments || [];
             return sum + payments.reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
        }, 0);

        const outstanding = totalSalesValue - actualReceived;
        
        let partCost = 0;
        let laborRevenue = 0;
        let partsRevenue = 0;

        validSrvs.forEach(s => {
            s.service_items?.forEach(i => {
                const total = Number(i.sell_price) * Number(i.quantity);
                const cost = Number(i.cost_price) * Number(i.quantity);
                if (i.type === 'Part') {
                    partsRevenue += total;
                    partCost += cost;
                } else {
                    laborRevenue += total;
                }
            });
        });
        
        const profit = totalSalesValue - partCost; // Service Profit (Gross)

        return { 
            revenue: actualReceived, 
            salesValue: totalSalesValue,
            outstanding,
            cost: partCost, 
            profit, 
            count: validSrvs.length, 
            laborRevenue, 
            partsRevenue 
        };
    };

    const currOrderStats = calcOrderStats(currentOrders);
    const currServiceStats = calcServiceStats(currentServices);
    const mktCost = currentMarketing.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const prevOrderStats = calcOrderStats(prevOrders);

    // รวมยอดทั้งหมด (Overview)
    // ใช้ยอดรับจริง (Actual Revenue) เป็นรายรับรวม
    const totalActualRevenue = currOrderStats.revenue + currServiceStats.revenue;
    // ใช้ยอดขายรวม (Sales Value) เพื่อคำนวณกำไรและเปรียบเทียบ
    const totalSalesValue = currOrderStats.salesValue + currServiceStats.salesValue;
    const totalOutstanding = currOrderStats.outstanding + currServiceStats.outstanding;

    const totalCost = currOrderStats.cost + currServiceStats.cost + mktCost;
    const netProfit = totalSalesValue - totalCost; // Net Profit based on Sales

    const prevRevenueOrders = prevOrderStats.revenue; 
    const getGrowth = (curr, prev) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

    const overviewStats = {
        totalRevenue: totalActualRevenue, // โชว์ยอดเงินสดที่รับมาจริง
        totalSalesValue,
        totalOutstanding,
        netProfit,
        totalOrders: currOrderStats.count,
        totalServices: currServiceStats.count,
        revenueGrowth: getGrowth(totalActualRevenue, prevRevenueOrders), 
        marketingCost: mktCost,
        
        orderRevenue: currOrderStats.revenue, // รับจริง
        orderOutstanding: currOrderStats.outstanding,
        orderProfit: currOrderStats.profit,
        
        serviceRevenue: currServiceStats.revenue, // รับจริง
        serviceOutstanding: currServiceStats.outstanding,
        serviceProfit: currServiceStats.profit
    };

    const marketingPercentRaw = totalSalesValue > 0 ? (mktCost / totalSalesValue) * 100 : 0;
    const roasRaw = mktCost > 0 ? (totalSalesValue / mktCost) : 0;

    const orderStats = {
      revenue: currOrderStats.revenue,
      salesValue: currOrderStats.salesValue,
      outstanding: currOrderStats.outstanding,
      netProfit: currOrderStats.profit - mktCost,
      ordersCount: currOrderStats.count,
      revenueGrowth: getGrowth(currOrderStats.revenue, prevOrderStats.revenue),
      roas: roasRaw.toFixed(1),
      mktCost: mktCost,
      marketingPercent: marketingPercentRaw.toFixed(1)
    };

    // --- 3. Chart Data Preparation ---
    let intervals;
    if (groupBy === 'day') {
      intervals = eachDayOfInterval({ start, end });
    } else {
      intervals = eachMonthOfInterval({ start, end });
    }

    const chartData = intervals.map((datePoint) => {
       const label = format(datePoint, groupBy === 'day' ? 'd MMM' : 'MMM', { locale: th });
       
       const isMatch = (dStr) => {
           const d = safeDate(dStr);
           if (!d) return false;
           return groupBy === 'day' 
             ? format(d, 'yyyy-MM-dd') === format(datePoint, 'yyyy-MM-dd')
             : isSameMonth(d, datePoint);
       };

       const dayOrders = currentOrders.filter(o => isMatch(o.order_date) && isValidItem(o.status));
       const dayServices = currentServices.filter(s => isMatch(s.received_date) && isValidItem(s.status));
       const dayMarketing = currentMarketing.filter(m => isMatch(m.expense_date));
       
       // ยอดขาย (Sales Value)
       const orderSalesValue = dayOrders.reduce((s, o) => s + (Number(o.grand_total) || 0), 0);
       
       // ยอดรับจริง (Actual Revenue)
       const orderReceived = dayOrders.reduce((sum, o) => {
          const payments = o.order_payments || [];
          return sum + payments.reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
       }, 0);

       const serviceSalesValue = dayServices.reduce((s, srv) => s + (Number(srv.grand_total) || 0), 0);
       
       const serviceReceived = dayServices.reduce((sum, s) => {
          const payments = s.service_payments || [];
          return sum + payments.reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
       }, 0);

       const marketingCost = dayMarketing.reduce((s, m) => s + (Number(m.amount) || 0), 0);
       
       // Profit Calculation for Chart
       const orderCosts = dayOrders.reduce((sum, o) => {
            const itemsCost = o.order_items?.reduce((s, i) => s + (Number(i.cost_price)*Number(i.quantity)), 0) || 0;
            return sum + itemsCost + (Number(o.shipping_cost) || 0);
       }, 0);
       
       // กำไรวันนั้น = ยอดขาย - ต้นทุน - การตลาด
       const orderProfit = orderSalesValue - orderCosts - marketingCost;

       return {
           date: label,
           orderSales: orderReceived, // กราฟแสดงยอดรับจริง (Cash Flow)
           serviceSales: serviceReceived,
           marketingCost,
           
           // Field สำหรับกราฟ
           sales: orderReceived, 
           marketing: marketingCost,
           profit: orderProfit, 
           cost: marketingCost,
           totalSales: orderReceived + serviceReceived,
           orderProfit: orderProfit
       };
    });

    // --- 4. Prepare Ranking & Category Data ---
    const productCatMap = {};
    products.forEach(p => {
        let catName = 'อื่นๆ';
        if (p.categories?.name) {
            catName = p.categories.name;
        } else if (p.product_categories && Array.isArray(p.product_categories) && p.product_categories.length > 0) {
            const firstCat = p.product_categories.find(pc => pc.categories?.name);
            if (firstCat) catName = firstCat.categories.name;
        }
        productCatMap[p.id] = catName;
    });

    const productStats = {};
    const locationStats = {};
    const categoryStats = {};
    
    currentOrders.forEach(o => {
      if (!isValidItem(o.status)) return;
      
      const prov = o.customer_cache?.address_parsed?.prov || 'ไม่ระบุ';
      if (!locationStats[prov]) locationStats[prov] = { province: prov, count: 0, total: 0 };
      locationStats[prov].count += 1;
      locationStats[prov].total += (Number(o.grand_total) || 0);

      o.order_items?.forEach(i => {
         const totalItemSales = (Number(i.sell_price) * Number(i.quantity));
         
         const pName = i.product_name || i.name || 'Unknown Product';
         if (!productStats[pName]) productStats[pName] = { name: pName, quantity: 0, total: 0 };
         productStats[pName].quantity += Number(i.quantity) || 0;
         productStats[pName].total += totalItemSales;

         const catName = productCatMap[i.product_id] || 'สินค้าทั่วไป';
         if (!categoryStats[catName]) categoryStats[catName] = { name: catName, sales: 0 };
         categoryStats[catName].sales += totalItemSales;
      });
    });

    const categoryData = Object.values(categoryStats).sort((a,b) => b.sales - a.sales);
    const topProducts = Object.values(productStats).sort((a,b) => b.total - a.total).slice(0, 10); 
    const topLocations = Object.values(locationStats).sort((a,b) => b.total - a.total).slice(0, 5);

    // --- 5. Service Specific Analytics ---
    const serviceStatusCounts = {};
    currentServices.forEach(s => {
        if (!isValidItem(s.status)) return;
        const st = s.status === 'In Progress' ? 'กำลังซ่อม' : 
                   s.status === 'Waiting' ? 'รอคิว/อะไหล่' :
                   ['Completed', 'Delivered', 'Done'].includes(s.status) ? 'เสร็จสิ้น' : 
                   s.status === 'Tested' ? 'รอเทส' : s.status;
        serviceStatusCounts[st] = (serviceStatusCounts[st] || 0) + 1;
    });
    const serviceStatusData = Object.keys(serviceStatusCounts).map(k => ({ name: k, value: serviceStatusCounts[k] }));

    const techStats = {};
    currentServices.forEach(s => {
        if (!isValidItem(s.status)) return;
        if (s.service_assignees && s.service_assignees.length > 0) {
            s.service_assignees.forEach(a => {
                const name = a.user?.first_name || 'ไม่ระบุ';
                if (!techStats[name]) techStats[name] = { name, jobs: 0, revenue: 0 };
                techStats[name].jobs += 1;
                techStats[name].revenue += (s.grand_total || 0);
            });
        } else {
             if (!techStats['ไม่ระบุ']) techStats['ไม่ระบุ'] = { name: 'ไม่ระบุ', jobs: 0, revenue: 0 };
             techStats['ไม่ระบุ'].jobs += 1;
        }
    });
    const technicianData = Object.values(techStats).sort((a,b) => b.jobs - a.jobs).slice(0, 5);

    const revenueCompositionData = [
        { name: 'ค่าแรง/บริการ', value: currServiceStats.laborRevenue },
        { name: 'ค่าอะไหล่', value: currServiceStats.partsRevenue }
    ];

    return {
        overviewStats,
        orderStats,
        chartData,
        categoryData,
        topProducts, 
        topLocations,
        serviceStats: {
            totalRevenue: currServiceStats.revenue,
            totalCost: currServiceStats.cost,
            totalProfit: currServiceStats.profit, 
            totalJobs: currServiceStats.count,
            avgTicket: currServiceStats.count > 0 ? currServiceStats.revenue / currServiceStats.count : 0,
            statusData: serviceStatusData,
            technicianData,
            revenueCompositionData
        }
    };

  }, [rawData, dateFilter, mounted]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (!mounted) return <div className="p-10 text-center text-gray-400">Loading Dashboard...</div>;

  const KpiCard = ({ title, value, growth, icon: Icon, color, subtext, subtext2 }) => (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-black text-gray-800">{value}</h3>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        {subtext2 && <p className="text-xs text-red-500 mt-0.5">{subtext2}</p>}
        {!subtext && !subtext2 && compareMode !== 'none' && growth !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {growth >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
            <span>{Math.abs(growth).toFixed(1)}%</span>
            <span className="text-gray-400 font-normal">เทียบช่วงก่อน</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Activity className="text-indigo-600"/> 
          Dashboard ภาพรวม
          {role && (
            <span className="text-sm font-medium bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full flex items-center gap-1 border border-indigo-100">
              <Shield size={14}/> {role.name}
            </span>
          )}
        </h1>
        
        <div className="flex flex-wrap items-center gap-3">
           {/* Date Filter */}
           <div className="relative">
             <Filter size={16} className="absolute left-3 top-3 text-gray-400"/>
             <select 
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="this_month">เดือนนี้</option>
              <option value="last_month">เดือนที่แล้ว</option>
              <option value="Q1">Q1 (ม.ค.-มี.ค.)</option>
              <option value="Q2">Q2 (เม.ย.-มิ.ย.)</option>
              <option value="Q3">Q3 (ก.ค.-ก.ย.)</option>
              <option value="Q4">Q4 (ต.ค.-ธ.ค.)</option>
              <option value="this_year">ปีนี้</option>
            </select>
           </div>
           
           <div className="relative">
            <select 
              className="bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm font-medium outline-none cursor-pointer"
              value={compareMode}
              onChange={(e) => setCompareMode(e.target.value)}
            >
              <option value="prev_period">เปรียบเทียบกับช่วงก่อน</option>
              <option value="none">ไม่เปรียบเทียบ</option>
            </select>
           </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex p-1 bg-gray-100/80 rounded-xl w-fit">
         <button onClick={() => setActiveTab('overview')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>ภาพรวมทั้งหมด</button>
         <button onClick={() => setActiveTab('orders')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>ยอดขายออเดอร์</button>
         <button onClick={() => setActiveTab('services')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'services' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>งานซ่อม/บริการ</button>
      </div>

      {/* ================= ZONE 1: OVERVIEW ================= */}
      {activeTab === 'overview' && processedData && (
         <div className="space-y-6 animate-in slide-in-from-bottom-4">
            {/* KPI Cards (ปรับปรุง: แสดงยอดรับจริง และ ยอดค้างชำระ) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard 
                   title="รายรับรวมทั้งหมด (รับจริง)" 
                   value={`฿${(processedData.overviewStats.totalRevenue || 0).toLocaleString()}`} 
                   growth={processedData.overviewStats.revenueGrowth}
                   icon={DollarSign}
                   color="bg-indigo-50 text-indigo-600"
                   subtext2={processedData.overviewStats.totalOutstanding > 0 ? `ค้างชำระ: ฿${processedData.overviewStats.totalOutstanding.toLocaleString()}` : null}
                 />
                 <KpiCard 
                   title="กำไรรวมสุทธิ (Net Profit)" 
                   value={`฿${(processedData.overviewStats.netProfit || 0).toLocaleString()}`} 
                   icon={TrendingUp}
                   color="bg-emerald-50 text-emerald-600"
                 />
                 <KpiCard 
                   title="งบการตลาดที่ใช้" 
                   value={`฿${(processedData.overviewStats.marketingCost || 0).toLocaleString()}`} 
                   icon={Activity}
                   color="bg-rose-50 text-rose-600"
                 />
            </div>
            
            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <KpiCard 
                   title="ยอดขาย (ออเดอร์)" 
                   value={`฿${(processedData.overviewStats.orderRevenue || 0).toLocaleString()}`} 
                   icon={ShoppingBag}
                   color="bg-emerald-50 text-emerald-600"
                   subtext2={processedData.overviewStats.orderOutstanding > 0 ? `ค้าง: ฿${processedData.overviewStats.orderOutstanding.toLocaleString()}` : null}
                 />
                 <KpiCard 
                   title="ยอดขาย (งานซ่อม)" 
                   value={`฿${(processedData.overviewStats.serviceRevenue || 0).toLocaleString()}`} 
                   icon={Wrench}
                   color="bg-orange-50 text-orange-600"
                   subtext2={processedData.overviewStats.serviceOutstanding > 0 ? `ค้าง: ฿${processedData.overviewStats.serviceOutstanding.toLocaleString()}` : null}
                 />
                 <KpiCard 
                   title="กำไร (ออเดอร์)" 
                   value={`฿${(processedData.overviewStats.orderProfit || 0).toLocaleString()}`} 
                   icon={TrendingUp}
                   color="bg-emerald-50 text-emerald-600"
                 />
                 <KpiCard 
                   title="กำไร (งานซ่อม)" 
                   value={`฿${(processedData.overviewStats.serviceProfit || 0).toLocaleString()}`} 
                   icon={TrendingUp}
                   color="bg-orange-50 text-orange-600"
                 />
            </div>

            {/* Combined Chart */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-gray-800 mb-6">แนวโน้มรายรับจริง (Cash Flow)</h3>
               <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={processedData.chartData}>
                       <defs>
                          <linearGradient id="colorOrder" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorService" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                       <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                       <Tooltip contentStyle={{borderRadius:'12px'}} formatter={(val)=>[val.toLocaleString(), 'บาท']} />
                       <Legend verticalAlign="top" height={36}/>
                       <Area type="monotone" dataKey="orderSales" name="รับจริง (ออเดอร์)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOrder)" />
                       <Area type="monotone" dataKey="serviceSales" name="รับจริง (งานซ่อม)" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorService)" />
                    </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>
         </div>
      )}

      {/* ================= ZONE 2: ORDERS ================= */}
      {activeTab === 'orders' && processedData && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <StatCards stats={processedData.orderStats} loading={loading} />
              
              <div className="w-full h-[450px]">
                {/* ส่งข้อมูลเฉพาะ Order Sales ไปแสดง พร้อม stats เพื่อแสดง % Marketing และ Profit */}
                <MarketingChart 
                    data={processedData.chartData.map(d => ({ 
                        ...d, 
                        sales: d.orderSales,
                        profit: d.orderProfit 
                    }))} 
                    stats={processedData.orderStats} 
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex-1 min-h-[350px]">
                   <CategoryChart data={processedData.categoryData || []} />
                </div>
                <div className="flex-1 min-h-[350px]">
                   <MarketingChart data={processedData.chartData} stats={processedData.orderStats} />
                </div>
              </div>

              <TopRankings 
                topProducts={processedData.topProducts} 
                topLocations={processedData.topLocations} 
              />
          </div>
      )}

      {/* ================= ZONE 3: SERVICES ================= */}
      {activeTab === 'services' && processedData && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <KpiCard 
                   title="งานซ่อมทั้งหมด" 
                   value={processedData.serviceStats.totalJobs} 
                   growth={0}
                   icon={Wrench}
                   color="bg-indigo-50 text-indigo-600"
                 />
                 <KpiCard 
                   title="รายได้งานซ่อม (รับจริง)" 
                   value={`฿${processedData.serviceStats.totalRevenue.toLocaleString()}`} 
                   growth={0}
                   icon={DollarSign}
                   color="bg-emerald-50 text-emerald-600"
                   subtext2={processedData.serviceStats.outstanding > 0 ? `ค้าง: ฿${processedData.serviceStats.outstanding.toLocaleString()}` : null}
                 />
                 <KpiCard 
                   title="กำไรขั้นต้น (Est.)" 
                   value={`฿${processedData.serviceStats.totalProfit.toLocaleString()}`} 
                   growth={0}
                   icon={TrendingUp}
                   color="bg-amber-50 text-amber-600"
                 />
                 <KpiCard 
                   title="เฉลี่ยต่อคัน" 
                   value={`฿${Math.round(processedData.serviceStats.avgTicket).toLocaleString()}`} 
                   growth={0}
                   icon={Users}
                   color="bg-blue-50 text-blue-600"
                 />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Service Revenue Trend */}
                 <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-[400px]">
                    <h3 className="font-bold text-gray-800 mb-6">แนวโน้มรายได้งานซ่อม</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={processedData.chartData}>
                           <defs>
                              <linearGradient id="colorSrv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} />
                           <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                           <Tooltip contentStyle={{borderRadius:'12px'}} formatter={(val)=>[val.toLocaleString(), 'บาท']} />
                           <Area type="monotone" dataKey="serviceSales" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorSrv)" />
                        </AreaChart>
                    </ResponsiveContainer>
                 </div>

                 {/* Status Pie Chart */}
                 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-[400px]">
                    <h3 className="font-bold text-gray-800 mb-6">สถานะงานซ่อม</h3>
                    <ResponsiveContainer width="100%" height="85%">
                       <RePieChart>
                          <Pie
                             data={processedData.serviceStats.statusData}
                             cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                             paddingAngle={5} dataKey="value"
                          >
                             {processedData.serviceStats.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36}/>
                       </RePieChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Technician Performance */}
                 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6">ประสิทธิภาพทีมช่าง (Top Active Technicians)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                       <BarChart data={processedData.serviceStats.technicianData} layout="vertical" margin={{left: 20}}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                          <XAxis type="number" hide/>
                          <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/>
                          <Tooltip cursor={{fill: 'transparent'}}/>
                          <Bar dataKey="jobs" fill="#6366f1" radius={[0, 4, 4, 0]} name="จำนวนงาน" barSize={20} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>

                 {/* Revenue Composition */}
                 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6">สัดส่วนรายได้ (ค่าแรง vs ค่าอะไหล่)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                       <RePieChart>
                          <Pie
                             data={processedData.serviceStats.revenueCompositionData}
                             cx="50%" cy="50%" outerRadius={100}
                             dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                             <Cell fill="#3b82f6" /> {/* ค่าแรง */}
                             <Cell fill="#f59e0b" /> {/* ค่าอะไหล่ */}
                          </Pie>
                          <Tooltip formatter={(val)=>[val.toLocaleString(), 'บาท']} />
                       </RePieChart>
                    </ResponsiveContainer>
                 </div>
              </div>
          </div>
      )}

    </div>
  );
};
export default DashboardMain;