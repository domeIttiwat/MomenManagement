import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  startOfMonth, endOfMonth, subMonths, 
  startOfYear, endOfYear, subYears, 
  startOfQuarter, endOfQuarter, setQuarter,
  eachDayOfInterval, eachMonthOfInterval, 
  format, isSameMonth, isWithinInterval, isValid 
} from 'date-fns';
import { th } from 'date-fns/locale';

export const useDashboardData = (initialDateFilter = 'this_month') => {
  const [loading, setLoading] = useState(true);
  
  const [dateFilter, setDateFilter] = useState(initialDateFilter);
  const [compareMode, setCompareMode] = useState('prev_period');
  
  const [rawData, setRawData] = useState({ 
    orders: [], services: [], marketing: [], products: [] 
  });

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

      // 4. Fetch Products (ดึง product_categories ให้ครบ)
      const { data: products } = await supabase
        .from('products')
        .select('id, name, category_id, categories(name), product_categories(category_id, categories(name))');

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

  useEffect(() => { fetchData(); }, []);

  const processedData = useMemo(() => {
    if (loading && rawData.orders.length === 0) return null;

    const { orders, services, marketing, products } = rawData;
    const now = new Date();
    
    // --- 0. Prepare Product Category Map (หัวใจสำคัญ) ---
    const productCatMap = {};
    products.forEach(p => {
        let catName = 'สินค้าทั่วไป';
        
        // 1. ลองหาจากระบบใหม่ (Multi)
        if (p.product_categories && p.product_categories.length > 0) {
            // เอาหมวดหมู่แรกที่เจอ
            const firstValid = p.product_categories.find(pc => pc.categories?.name);
            if (firstValid) catName = firstValid.categories.name;
        } 
        // 2. ถ้าไม่มี ลองหาระบบเก่า (Single)
        else if (p.categories?.name) {
            catName = p.categories.name;
        }
        
        // Map ID (String) -> Category Name
        productCatMap[String(p.id)] = catName;
    });

    // --- Date Filter Logic ---
    let start, end, prevStart, prevEnd;
    let groupBy = 'day';

    if (dateFilter === 'this_month') {
      start = startOfMonth(now); end = endOfMonth(now);
      prevStart = startOfMonth(subMonths(now, 1)); prevEnd = endOfMonth(subMonths(now, 1));
      groupBy = 'day';
    } else if (dateFilter === 'last_month') {
      start = startOfMonth(subMonths(now, 1)); end = endOfMonth(subMonths(now, 1));
      prevStart = startOfMonth(subMonths(now, 2)); prevEnd = endOfMonth(subMonths(now, 2));
      groupBy = 'day';
    } else if (['Q1', 'Q2', 'Q3', 'Q4'].includes(dateFilter)) {
      const qIndex = parseInt(dateFilter.slice(1));
      const qDate = setQuarter(now, qIndex);
      start = startOfQuarter(qDate); end = endOfQuarter(qDate);
      const prevQDate = subMonths(start, 3);
      prevStart = startOfQuarter(prevQDate); prevEnd = endOfQuarter(prevQDate);
      groupBy = 'month';
    } else if (dateFilter === 'this_year') {
      start = startOfYear(now); end = endOfYear(now);
      prevStart = startOfYear(subYears(now, 1)); prevEnd = endOfYear(subYears(now, 1));
      groupBy = 'month';
    }

    const safeDate = (d) => d ? (isValid(new Date(d)) ? new Date(d) : null) : null;

    const filterByDate = (data, field) => data.filter(item => {
      const d = safeDate(item[field]);
      return d && isWithinInterval(d, { start, end });
    });

    const currentOrders = filterByDate(orders, 'order_date');
    const currentServices = filterByDate(services, 'received_date');
    const currentMarketing = filterByDate(marketing, 'expense_date');

    const prevOrders = orders.filter(o => { const d = safeDate(o.order_date); return d && d >= prevStart && d <= prevEnd; });
    const prevServices = services.filter(s => { const d = safeDate(s.received_date); return d && d >= prevStart && d <= prevEnd; });

    // --- Calculate Stats ---
    const isValidItem = (status) => status !== 'Cancelled' && status !== 'Quotation';

    const calcOrderStats = (ords) => {
        const validOrds = ords.filter(o => isValidItem(o.status));
        const revenue = validOrds.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);
        // ยอดรับจริงจาก payments
        const actualReceived = validOrds.reduce((sum, o) => sum + (o.order_payments || []).reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0), 0);
        const outstanding = revenue - actualReceived;
        
        let productCost = 0;
        validOrds.forEach(o => {
            productCost += o.order_items?.reduce((s, i) => s + (Number(i.cost_price)*Number(i.quantity)), 0) || 0;
        });
        const shipping = validOrds.reduce((sum, o) => sum + (Number(o.shipping_cost) || 0), 0);
        const cost = productCost + shipping;
        const profit = revenue - cost; 
        return { revenue: actualReceived, salesValue: revenue, outstanding, cost, profit, count: validOrds.length }; 
    };

    const calcServiceStats = (srvs) => {
        const validSrvs = srvs.filter(s => isValidItem(s.status));
        const revenue = validSrvs.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0);
        const actualReceived = validSrvs.reduce((sum, s) => sum + (s.service_payments || []).reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0), 0);
        const outstanding = revenue - actualReceived;
        
        let partCost = 0; let laborRevenue = 0; let partsRevenue = 0;
        validSrvs.forEach(s => {
            s.service_items?.forEach(i => {
                const total = Number(i.sell_price) * Number(i.quantity);
                const cost = Number(i.cost_price) * Number(i.quantity);
                if (i.type === 'Part') { partsRevenue += total; partCost += cost; } 
                else { laborRevenue += total; }
            });
        });
        const profit = revenue - partCost;
        return { revenue: actualReceived, salesValue: revenue, outstanding, cost: partCost, profit, count: validSrvs.length, laborRevenue, partsRevenue };
    };

    const currOrderStats = calcOrderStats(currentOrders);
    const currServiceStats = calcServiceStats(currentServices);
    const mktCost = currentMarketing.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const prevOrderStats = calcOrderStats(prevOrders);
    const prevServiceStats = calcServiceStats(prevServices);

    const totalActualRevenue = currOrderStats.revenue + currServiceStats.revenue;
    const totalSalesValue = currOrderStats.salesValue + currServiceStats.salesValue;
    const totalOutstanding = currOrderStats.outstanding + currServiceStats.outstanding;
    const totalCost = currOrderStats.cost + currServiceStats.cost + mktCost;
    const netProfit = totalSalesValue - totalCost;

    const prevTotalRevenue = prevOrderStats.revenue + prevServiceStats.revenue; 
    const getGrowth = (curr, prev) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

    const overviewStats = {
        totalRevenue: totalActualRevenue,
        netProfit,
        totalOrders: currOrderStats.count,
        totalServices: currServiceStats.count,
        revenueGrowth: getGrowth(totalActualRevenue, prevTotalRevenue), 
        marketingCost: mktCost,
        orderRevenue: currOrderStats.revenue,
        orderOutstanding: currOrderStats.outstanding,
        orderProfit: currOrderStats.profit,
        orderProfitGrowth: getGrowth(currOrderStats.profit, prevOrderStats.profit), 
        serviceRevenue: currServiceStats.revenue,
        serviceOutstanding: currServiceStats.outstanding,
        serviceProfit: currServiceStats.profit,
        serviceProfitGrowth: getGrowth(currServiceStats.profit, prevServiceStats.profit)
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

    // --- Chart Data ---
    let intervals = groupBy === 'day' ? eachDayOfInterval({ start, end }) : eachMonthOfInterval({ start, end });

    const chartData = intervals.map((datePoint) => {
       const label = format(datePoint, groupBy === 'day' ? 'd MMM' : 'MMM', { locale: th });
       const isMatch = (dStr) => {
           const d = safeDate(dStr);
           return d && (groupBy === 'day' ? format(d, 'yyyy-MM-dd') === format(datePoint, 'yyyy-MM-dd') : isSameMonth(d, datePoint));
       };

       const dayOrders = currentOrders.filter(o => isMatch(o.order_date) && isValidItem(o.status));
       const dayServices = currentServices.filter(s => isMatch(s.received_date) && isValidItem(s.status));
       const dayMarketing = currentMarketing.filter(m => isMatch(m.expense_date));
       
       const orderSalesValue = dayOrders.reduce((s, o) => s + (Number(o.grand_total) || 0), 0);
       const orderReceived = dayOrders.reduce((sum, o) => sum + (o.order_payments || []).reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0), 0);
       const serviceReceived = dayServices.reduce((sum, s) => sum + (s.service_payments || []).reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0), 0);
       const marketingCost = dayMarketing.reduce((s, m) => s + (Number(m.amount) || 0), 0);
       const orderCosts = dayOrders.reduce((sum, o) => sum + (o.order_items?.reduce((s, i) => s + (Number(i.cost_price)*Number(i.quantity)), 0) || 0) + (Number(o.shipping_cost) || 0), 0);
       
       const orderProfit = orderSalesValue - orderCosts - marketingCost;

       // Calc prev sales for chart
       let prevTotalSales = 0;
       let prevServiceSales = 0;
       let prevDatePoint;
       if (dateFilter === 'this_month' || dateFilter === 'last_month') {
          prevDatePoint = subMonths(datePoint, 1);
       } else if (dateFilter === 'this_year') {
          prevDatePoint = subYears(datePoint, 1);
       } else {
          prevDatePoint = subMonths(datePoint, 3);
       }

       if (prevDatePoint) {
           const isPrevMatch = (dStr) => {
               const d = safeDate(dStr);
               return d && (groupBy === 'day' ? format(d, 'yyyy-MM-dd') === format(prevDatePoint, 'yyyy-MM-dd') : isSameMonth(d, prevDatePoint));
           };
           const pOrd = prevOrders.filter(o => isPrevMatch(o.order_date) && isValidItem(o.status));
           const pSrv = prevServices.filter(s => isPrevMatch(s.received_date) && isValidItem(s.status));
           const pOrdRev = pOrd.reduce((s,o)=> s + (o.order_payments || []).reduce((ps,p)=>ps+(Number(p.amount)||0),0), 0);
           const pSrvRev = pSrv.reduce((s,srv)=> s + (srv.service_payments || []).reduce((ps,p)=>ps+(Number(p.amount)||0),0), 0);
           prevTotalSales = pOrdRev + pSrvRev;
           prevServiceSales = pSrvRev; // Add this for Service Dashboard comparison
       }

       return {
           date: label,
           orderSales: orderReceived, 
           serviceSales: serviceReceived,
           marketingCost,
           sales: orderReceived, 
           marketing: marketingCost,
           profit: orderProfit, 
           cost: marketingCost,
           totalSales: orderReceived + serviceReceived,
           orderProfit: orderProfit,
           prevTotalSales,
           prevServiceSales // Send this to chart
       };
    });

    // --- Ranking & Category Data (Loop & Accumulate) ---
    const categoryStats = {};
    const productStats = {};
    const locationStats = {};
    
    currentOrders.forEach(o => {
      if (!isValidItem(o.status)) return;
      
      const prov = o.customer_cache?.address_parsed?.prov || 'ไม่ระบุ';
      if (!locationStats[prov]) locationStats[prov] = { province: prov, count: 0, total: 0 };
      locationStats[prov].count += 1; locationStats[prov].total += (Number(o.grand_total) || 0);

      // Loop รายการสินค้าเพื่อจัดอันดับและแยกหมวดหมู่
      if (o.order_items && Array.isArray(o.order_items)) {
          o.order_items.forEach(i => {
             const qty = Number(i.quantity) || 0;
             const totalItemSales = (Number(i.sell_price) * qty);
             const totalItemCost = (Number(i.cost_price) * qty);
             
             // 1. Top Products
             const pName = i.product_name || i.name || 'Unknown Product';
             if (!productStats[pName]) productStats[pName] = { name: pName, quantity: 0, total: 0 };
             productStats[pName].quantity += qty;
             productStats[pName].total += totalItemSales;

             // 2. Category Share (ใช้ Map ที่เตรียมไว้)
             // FIX: ใช้ String(i.product_id) เพื่อให้ match กับ key ใน Map
             const catName = productCatMap[String(i.product_id)] || 'สินค้าทั่วไป';
             if (!categoryStats[catName]) categoryStats[catName] = { name: catName, sales: 0, profit: 0 };
             categoryStats[catName].sales += totalItemSales;
             categoryStats[catName].profit += (totalItemSales - totalItemCost); // เพิ่มกำไร
          });
      }
    });

    const categoryData = Object.values(categoryStats).sort((a,b) => b.sales - a.sales);
    
    const topProducts = Object.values(productStats)
        .filter(p => p.total > 0)
        .sort((a,b) => b.total - a.total)
        .slice(0, 10);
        
    const topLocations = Object.values(locationStats)
        .filter(l => l.total > 0 && l.province !== 'ไม่ระบุ')
        .sort((a,b) => b.total - a.total)
        .slice(0, 5);

    // --- Service Specific Analytics ---
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
        s.service_assignees?.forEach(a => {
            const name = a.user?.first_name || 'ไม่ระบุ';
            if (!techStats[name]) techStats[name] = { name, jobs: 0, revenue: 0 };
            techStats[name].jobs += 1;
            techStats[name].revenue += (s.grand_total || 0);
        });
    });
    const technicianData = Object.values(techStats).sort((a,b) => b.jobs - a.jobs).slice(0, 5);

    const revenueCompositionData = [
        { name: 'ค่าแรง/บริการ', value: currServiceStats.laborRevenue },
        { name: 'ค่าอะไหล่', value: currServiceStats.partsRevenue }
    ];

    return {
        overviewStats, orderStats, chartData, categoryData, topProducts, topLocations,
        serviceStats: {
            totalRevenue: currServiceStats.revenue,
            totalCost: currServiceStats.cost,
            totalProfit: currServiceStats.profit, 
            totalJobs: currServiceStats.count,
            avgTicket: currServiceStats.count > 0 ? currServiceStats.revenue / currServiceStats.count : 0,
            statusData: serviceStatusData,
            technicianData,
            revenueCompositionData,
            jobsGrowth: getGrowth(currServiceStats.count, prevServiceStats.count),
            revenueGrowth: getGrowth(currServiceStats.revenue, prevServiceStats.revenue),
            profitGrowth: getGrowth(currServiceStats.profit, prevServiceStats.profit),
            outstanding: currServiceStats.outstanding
        }
    };
  }, [rawData, dateFilter]);

  return { loading, processedData, dateFilter, setDateFilter, compareMode, setCompareMode };
};