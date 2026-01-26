import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, RefreshCw, TrendingUp, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  startOfMonth, endOfMonth, subMonths, 
  startOfYear, endOfYear, subYears, 
  startOfQuarter, endOfQuarter, setQuarter,
  eachDayOfInterval, eachMonthOfInterval, 
  format, isSameMonth 
} from 'date-fns';
import { th } from 'date-fns/locale';

import StatCards from './StatCards';
import SalesChart from './SalesChart';
import MarketingChart from './MarketingChart';
import CategoryChart from './CategoryChart'; // Import กราฟวงกลม
import TopRankings from './TopRankings';

const DashboardMain = () => {
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('this_month');
  const [compareMode, setCompareMode] = useState('prev_period');
  const [rawData, setRawData] = useState({ orders: [], marketing: [], products: [] });
  const [mounted, setMounted] = useState(false);

  // 1. Fetch All Data
  const fetchData = async () => {
    setLoading(true);
    try {
      // FIX 1: ดึงทุกสถานะ ยกเว้น "ยกเลิก" และ "ใบเสนอราคา" (เพื่อให้ Completed/Paid/Deposit มาครบ)
      const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .neq('status', 'Cancelled')
        .neq('status', 'Quotation') 
        .order('order_date', { ascending: true });

      const { data: marketing } = await supabase
        .from('marketing_expenses')
        .select('*')
        .order('expense_date', { ascending: true });

      // FIX 2: ดึงสินค้า+หมวดหมู่ มาทำ Map (สำหรับกราฟวงกลม)
      const { data: products } = await supabase
        .from('products')
        .select('id, category_id, categories(name)');

      setRawData({ 
        orders: orders || [], 
        marketing: marketing || [],
        products: products || []
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    setMounted(true);
    fetchData(); 
  }, []);

  // 2. Process Data
  const processedData = useMemo(() => {
    if (!mounted) return null;

    const { orders, marketing, products } = rawData;
    const now = new Date();
    
    // สร้าง Map: ProductID -> CategoryName
    const productCategoryMap = {};
    products.forEach(p => {
      productCategoryMap[p.id] = p.categories?.name || 'Uncategorized';
    });
    
    let start, end, prevStart, prevEnd;
    let groupBy = 'day';

    // --- Define Date Ranges ---
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

    const filterByDate = (data, field, s, e) => data.filter(item => {
      const d = new Date(item[field]);
      return d >= s && d <= e;
    });

    const currentOrders = filterByDate(orders, 'order_date', start, end);
    const currentMarketing = filterByDate(marketing, 'expense_date', start, end);
    const prevOrders = filterByDate(orders, 'order_date', prevStart, prevEnd);
    
    const calcStats = (ords, mkts) => {
      const revenue = ords.reduce((sum, o) => sum + (o.grand_total || 0), 0);
      const mktCost = mkts.reduce((sum, m) => sum + (m.amount || 0), 0);
      let productCost = 0;
      ords.forEach(o => {
        productCost += o.order_items?.reduce((s, i) => s + (i.cost_price * i.quantity), 0) || 0;
      });
      const shipping = ords.reduce((sum, o) => sum + (o.shipping_cost || 0), 0);
      const netProfit = revenue - productCost - shipping - mktCost;
      return { revenue, netProfit, ordersCount: ords.length, mktCost };
    };

    const currStats = calcStats(currentOrders, currentMarketing);
    const prevStats = calcStats(prevOrders, []); 
    const getGrowth = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
    
    const stats = {
      ...currStats,
      revenueGrowth: getGrowth(currStats.revenue, prevStats.revenue),
      profitGrowth: getGrowth(currStats.netProfit, prevStats.netProfit),
      ordersGrowth: getGrowth(currStats.ordersCount, prevStats.ordersCount),
      marketingPercent: currStats.revenue > 0 ? (currStats.mktCost / currStats.revenue * 100).toFixed(1) : 0,
      roas: currStats.mktCost > 0 ? (currStats.revenue / currStats.mktCost).toFixed(2) : 0,
      avgDailySales: currStats.revenue / (groupBy === 'day' ? Math.max(1, end.getDate()) : 30),
      profitMargin: currStats.revenue > 0 ? (currStats.netProfit / currStats.revenue * 100).toFixed(1) : 0,
    };

    // --- Chart Data ---
    let intervals;
    if (groupBy === 'day') {
      intervals = eachDayOfInterval({ start, end });
    } else {
      intervals = eachMonthOfInterval({ start, end });
    }

    const chartData = intervals.map((datePoint, index) => {
      let label, dayOrders, dayMarketing, prevSales = 0;

      if (groupBy === 'day') {
        const dayStr = format(datePoint, 'yyyy-MM-dd');
        label = format(datePoint, 'd MMM', { locale: th });
        dayOrders = currentOrders.filter(o => o.order_date.startsWith(dayStr));
        dayMarketing = currentMarketing.filter(m => m.expense_date === dayStr);
        
        if (compareMode === 'prev_period') {
          const targetPrev = new Date(prevStart);
          targetPrev.setDate(prevStart.getDate() + index);
          if (targetPrev <= prevEnd) {
             const prevStr = format(targetPrev, 'yyyy-MM-dd');
             prevSales = prevOrders.filter(o => o.order_date.startsWith(prevStr)).reduce((s, o) => s + o.grand_total, 0);
          }
        }
      } else {
        label = format(datePoint, 'MMM', { locale: th });
        dayOrders = currentOrders.filter(o => isSameMonth(new Date(o.order_date), datePoint));
        dayMarketing = currentMarketing.filter(m => isSameMonth(new Date(m.expense_date), datePoint));
        
        if (compareMode === 'prev_period') {
           const targetPrev = new Date(prevStart);
           targetPrev.setMonth(prevStart.getMonth() + index);
           if (targetPrev <= prevEnd) {
              prevSales = prevOrders.filter(o => isSameMonth(new Date(o.order_date), targetPrev)).reduce((s, o) => s + o.grand_total, 0);
           }
        }
      }

      const sales = dayOrders.reduce((sum, o) => sum + o.grand_total, 0);
      const mkt = dayMarketing.reduce((sum, m) => sum + m.amount, 0);
      
      let cost = 0;
      dayOrders.forEach(o => {
        cost += (o.order_items?.reduce((s, i) => s + (i.cost_price * i.quantity), 0) || 0) + (o.shipping_cost || 0);
      });
      const profit = sales - cost - mkt;

      return { date: label, sales, profit, marketingCost: mkt, prevSales: compareMode === 'none' ? null : prevSales };
    });

    // --- Category Stats (New Feature) ---
    const categoryStats = {};
    currentOrders.forEach(o => {
      o.order_items?.forEach(i => {
        const catName = productCategoryMap[i.product_id] || (i.is_custom ? 'อื่นๆ/Custom' : 'Uncategorized');
        
        if (!categoryStats[catName]) categoryStats[catName] = { name: catName, sales: 0, profit: 0 };
        
        const itemSales = i.sell_price * i.quantity;
        const itemCost = i.cost_price * i.quantity;
        const itemProfit = itemSales - itemCost;

        categoryStats[catName].sales += itemSales;
        categoryStats[catName].profit += itemProfit;
      });
    });
    const categoryData = Object.values(categoryStats).sort((a,b) => b.sales - a.sales);

    // --- Rankings ---
    const productStats = {};
    const locationStats = {};
    currentOrders.forEach(o => {
      o.order_items?.forEach(i => {
        if (!productStats[i.product_name]) productStats[i.product_name] = { name: i.product_name, quantity: 0, total: 0 };
        productStats[i.product_name].quantity += i.quantity;
        productStats[i.product_name].total += (i.sell_price * i.quantity);
      });
      const prov = o.customer_cache?.address_parsed?.prov || 'ไม่ระบุ';
      if (!locationStats[prov]) locationStats[prov] = { province: prov, count: 0, total: 0 };
      locationStats[prov].count += 1;
      locationStats[prov].total += o.grand_total;
    });

    return { 
      stats, 
      chartData, 
      categoryData, // ส่งข้อมูลหมวดหมู่ไป
      topProducts: Object.values(productStats).sort((a,b)=>b.total-a.total).slice(0,5), 
      topLocations: Object.values(locationStats).sort((a,b)=>b.total-a.total).slice(0,5) 
    };

  }, [rawData, dateFilter, compareMode, mounted]);

  if (!mounted) return <div className="p-10 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-indigo-600"/> ภาพรวมธุรกิจ
        </h1>
        
        <div className="flex flex-wrap items-center gap-3">
           <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
             <span className="text-xs font-bold text-gray-500 px-2">เปรียบเทียบ:</span>
             <button onClick={() => setCompareMode('none')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${compareMode==='none' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>ปิด</button>
             <button onClick={() => setCompareMode('prev_period')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${compareMode==='prev_period' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>ช่วงก่อนหน้า</button>
           </div>

           <select 
            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="this_month">เดือนนี้ (รายวัน)</option>
            <option value="last_month">เดือนที่แล้ว (รายวัน)</option>
            <option value="Q1">ไตรมาส 1 (ม.ค.-มี.ค.)</option>
            <option value="Q2">ไตรมาส 2 (เม.ย.-มิ.ย.)</option>
            <option value="Q3">ไตรมาส 3 (ก.ค.-ก.ย.)</option>
            <option value="Q4">ไตรมาส 4 (ต.ค.-ธ.ค.)</option>
            <option value="this_year">ปีนี้ (รายเดือน)</option>
          </select>
          <button onClick={fetchData} className="p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <StatCards stats={processedData?.stats} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart data={processedData?.chartData} />
        {/* ใส่กราฟวงกลมคู่กับกราฟแท่ง */}
        <div className="flex flex-col gap-6">
           <div className="flex-1 min-h-[300px]">
             <CategoryChart data={processedData?.categoryData || []} />
           </div>
           <div className="flex-1 min-h-[300px]">
             <MarketingChart data={processedData?.chartData} />
           </div>
        </div>
      </div>

      <TopRankings 
        topProducts={processedData?.topProducts} 
        topLocations={processedData?.topLocations} 
      />
    </div>
  );
};
export default DashboardMain;