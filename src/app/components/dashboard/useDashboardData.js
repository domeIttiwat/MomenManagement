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
    
    // --- 0. Prepare Product Category Map ---
    const productCatMap = {};
    products.forEach(p => {
        let catName = 'สินค้าทั่วไป';
        if (p.product_categories && p.product_categories.length > 0) {
            const firstValid = p.product_categories.find(pc => pc.categories?.name);
            if (firstValid) catName = firstValid.categories.name;
        } else if (p.categories?.name) {
            catName = p.categories.name;
        }
        productCatMap[String(p.id)] = catName;
    });

    // --- 1. Date Filter Logic ---
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
    const currentServicesFiltered = filterByDate(services, 'received_date');
    const currentMarketing = filterByDate(marketing, 'expense_date');

    const prevOrders = orders.filter(o => {
        const d = safeDate(o.order_date);
        return d && d >= prevStart && d <= prevEnd;
    });
    const prevServices = services.filter(s => {
        const d = safeDate(s.received_date);
        return d && d >= prevStart && d <= prevEnd;
    });

    // --- Calculate Stats ---
    const isValidItem = (status) => status !== 'Cancelled' && status !== 'Quotation';
    const validOrders = currentOrders.filter(o => isValidItem(o.status));
    
    // 2.1 Quotation Stats
    const quotationOrders = currentOrders.filter(o => o.status === 'Quotation');
    const cancelledOrders = currentOrders.filter(o => o.status === 'Cancelled');
    
    const quoteStats = {
        count: quotationOrders.length,
        totalValue: quotationOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0),
        potentialProfit: quotationOrders.reduce((sum, o) => {
            const cost = o.order_items?.reduce((s, i) => s + (Number(i.cost_price)*Number(i.quantity)), 0) || 0;
            const revenue = Number(o.grand_total) || 0;
            return sum + (revenue - cost - (Number(o.shipping_cost) || 0));
        }, 0)
    };

    // 2.2 Actual Sales Stats
    const salesValue = validOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);
    const costOfGoods = validOrders.reduce((sum, o) => {
        const itemsCost = o.order_items?.reduce((s, i) => s + (Number(i.cost_price)*Number(i.quantity)), 0) || 0;
        return sum + itemsCost + (Number(o.shipping_cost) || 0);
    }, 0);
    
    const marketingCost = currentMarketing.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    
    const grossProfit = salesValue - costOfGoods; 
    const netProfit = grossProfit - marketingCost; 

    const marketingPercent = salesValue > 0 ? (marketingCost / salesValue) * 100 : 0;
    const grossMargin = salesValue > 0 ? (grossProfit / salesValue) * 100 : 0;
    const netMargin = salesValue > 0 ? (netProfit / salesValue) * 100 : 0;

    const actualReceived = validOrders.reduce((sum, o) => {
        const payments = o.order_payments || [];
        return sum + payments.reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
    }, 0);
    const outstanding = salesValue - actualReceived;

    // Prev Order Sales (Booking Value for comparison)
    const prevValidOrders = prevOrders.filter(o => isValidItem(o.status));
    const prevSalesValue = prevValidOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);

    const getGrowth = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

    const orderStats = {
        totalOrders: currentOrders.length,
        completedCount: validOrders.length,
        salesValue,
        cost: costOfGoods, // for legacy
        costOfGoods,
        grossProfit,
        marketingCost,
        netProfit,
        actualReceived,
        outstanding,
        grossMargin: grossMargin.toFixed(1),
        marketingPercent: marketingPercent.toFixed(1),
        netMargin: netMargin.toFixed(1),
        quotation: quoteStats,
        conversionRate: (currentOrders.length - cancelledOrders.length) > 0 
            ? (validOrders.length / (currentOrders.length - cancelledOrders.length) * 100).toFixed(1) 
            : 0,
        revenueGrowth: getGrowth(salesValue, prevSalesValue),
        roas: marketingCost > 0 ? (salesValue / marketingCost).toFixed(1) : 0
    };

    // 2.3 Service Stats
    const validServices = currentServicesFiltered.filter(s => isValidItem(s.status));
    const prevValidServices = prevServices.filter(s => isValidItem(s.status));
    
    const serviceRevenue = validServices.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0);
    const prevServiceRevenue = prevValidServices.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0);
    
    const serviceCost = validServices.reduce((sum, s) => {
         let pCost = 0;
         if(s.service_items) {
             s.service_items.forEach(i => {
                if(i.type === 'Part') pCost += (Number(i.cost_price)*Number(i.quantity));
             });
         }
         return sum + pCost;
    }, 0);
    const serviceProfit = serviceRevenue - serviceCost; // Gross Profit of Service

    // --- Overview Stats Calculation ---
    const totalActualRevenue = orderStats.actualReceived + 
        validServices.reduce((sum, s) => sum + (s.service_payments || []).reduce((p, i) => p + (Number(i.amount)||0), 0), 0);
        
    const totalBookingRevenue = orderStats.salesValue + serviceRevenue; 
    const totalNetProfit = orderStats.netProfit + serviceProfit;
    const prevTotalRevenue = prevSalesValue + prevServiceRevenue;

    const overviewStats = {
        totalRevenue: totalActualRevenue, 
        netProfit: totalNetProfit, 
        totalOrders: currentOrders.length,
        marketingCost: marketingCost,
        
        revenueGrowth: getGrowth(totalBookingRevenue, prevTotalRevenue), // Use Booking for growth trend
        
        orderRevenue: orderStats.salesValue,
        orderProfit: orderStats.netProfit,
        serviceRevenue: serviceRevenue,
        serviceProfit: serviceProfit,

        orderRevenueShare: totalBookingRevenue > 0 ? (orderStats.salesValue / totalBookingRevenue * 100).toFixed(1) : 0,
        serviceRevenueShare: totalBookingRevenue > 0 ? (serviceRevenue / totalBookingRevenue * 100).toFixed(1) : 0,
        
        orderProfitShare: totalNetProfit > 0 ? (orderStats.netProfit / totalNetProfit * 100).toFixed(1) : 0,
        serviceProfitShare: totalNetProfit > 0 ? (serviceProfit / totalNetProfit * 100).toFixed(1) : 0,

        orderOutstanding: orderStats.outstanding,
        serviceOutstanding: serviceRevenue - validServices.reduce((sum, s) => sum + (s.service_payments || []).reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0), 0),
    };

    // --- Chart Data ---
    let intervals = groupBy === 'day' ? eachDayOfInterval({ start, end }) : eachMonthOfInterval({ start, end });

    const chartData = intervals.map((datePoint) => {
        const label = format(datePoint, groupBy === 'day' ? 'd MMM' : 'MMM', { locale: th });
        const isMatch = (dStr) => {
            const d = safeDate(dStr);
            return d && (groupBy === 'day' ? format(d, 'yyyy-MM-dd') === format(datePoint, 'yyyy-MM-dd') : isSameMonth(d, datePoint));
        };

        const dayOrders = validOrders.filter(o => isMatch(o.order_date));
        const dayServices = validServices.filter(s => isMatch(s.received_date));
        const dayMarketing = currentMarketing.filter(m => isMatch(m.expense_date));

        const orderSalesValue = dayOrders.reduce((s, o) => s + (Number(o.grand_total) || 0), 0);
        const orderReceived = dayOrders.reduce((sum, o) => sum + (o.order_payments || []).reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0), 0);
        const serviceReceived = dayServices.reduce((sum, s) => sum + (s.service_payments || []).reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0), 0);
        const serviceSalesValue = dayServices.reduce((s, srv) => s + (Number(srv.grand_total) || 0), 0);
        
        const marketingCost = dayMarketing.reduce((s, m) => s + (Number(m.amount) || 0), 0);
        
        const orderCosts = dayOrders.reduce((sum, o) => {
            const iCost = o.order_items?.reduce((s, i) => s + (Number(i.cost_price)*Number(i.quantity)), 0) || 0;
            return sum + iCost + (Number(o.shipping_cost) || 0);
        }, 0);
        
        const orderProfit = orderSalesValue - orderCosts - marketingCost;

        // Calc Prev Sales for Chart
        let prevTotalSales = 0;
        let prevOrderSales = 0;
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
            
            // ใช้ยอดขายรวม (Booking) ในการเปรียบเทียบ
            const pOrdSales = pOrd.reduce((s,o)=> s + (Number(o.grand_total)||0), 0);
            const pSrvSales = pSrv.reduce((s,srv)=> s + (Number(srv.grand_total)||0), 0);
            
            prevOrderSales = pOrdSales;
            prevTotalSales = pOrdSales + pSrvSales;
        }

        return {
            date: label,
            orderSales: orderReceived, 
            serviceSales: serviceReceived,
            marketing: marketingCost, 
            marketingCost: marketingCost,
            
            // FIX: ใช้ยอดขายรวม (Booking) สำหรับกราฟ Sales/ROI เพื่อให้สัมพันธ์กับค่าการตลาด
            sales: orderSalesValue, 
            
            profit: orderProfit, 
            cost: marketingCost,
            totalSales: orderReceived + serviceReceived,
            orderProfit: orderProfit,
            prevTotalSales,
            prevOrderSales 
        };
    });

    // --- Ranking Data ---
    const categoryStats = {};
    const productStats = {};
    const locationStats = {};
    
    validOrders.forEach(o => {
      // Location
      let prov = o.customer_cache?.address_parsed?.prov;
      if (!prov) {
          const raw = o.customer_cache?.address_raw || '';
          const match = raw.match(/(?:จังหวัด|จ\.)\s*([^\s,]+)/) || raw.match(/(กรุงเทพมหานคร|กรุงเทพฯ|กทม)/);
          prov = match ? match[1] : 'ไม่ระบุ';
      }
      prov = prov.replace(/^(จังหวัด|จ\.|แขวง|เขต)/, '').trim();

      if (!locationStats[prov]) locationStats[prov] = { province: prov, count: 0, total: 0 };
      locationStats[prov].count += 1; 
      locationStats[prov].total += (Number(o.grand_total) || 0);

      // Items
      if (o.order_items && Array.isArray(o.order_items)) {
          o.order_items.forEach(i => {
             const qty = Number(i.quantity) || 0;
             const totalItemSales = (Number(i.sell_price) * qty);
             const totalItemCost = (Number(i.cost_price) * qty);
             const itemProfit = totalItemSales - totalItemCost;
             
             // Product
             const pName = i.product_name || i.name || 'Unknown Product';
             if (!productStats[pName]) productStats[pName] = { name: pName, quantity: 0, total: 0, profit: 0 };
             productStats[pName].quantity += qty;
             productStats[pName].total += totalItemSales;
             productStats[pName].profit += itemProfit;

             // Category
             const catName = productCatMap[String(i.product_id)] || 'สินค้าทั่วไป';
             if (!categoryStats[catName]) categoryStats[catName] = { name: catName, sales: 0, profit: 0 };
             categoryStats[catName].sales += totalItemSales;
             categoryStats[catName].profit += itemProfit;
          });
      }
    });

    const categoryData = Object.values(categoryStats).sort((a,b) => b.sales - a.sales);
    const topProducts = Object.values(productStats).filter(p=>p.total > 0).sort((a,b) => b.total - a.total).slice(0, 10);
    const topLocations = Object.values(locationStats).filter(l=>l.total > 0 && l.province !== 'ไม่ระบุ').sort((a,b) => b.total - a.total).slice(0, 5);

    // Service Helper
    const calcServiceStatsForTab = (srvs) => {
        let pCost = 0; let lRev = 0; let pRev = 0;
        srvs.forEach(s => {
            s.service_items?.forEach(i => {
                const total = Number(i.sell_price) * Number(i.quantity);
                const cost = Number(i.cost_price) * Number(i.quantity);
                if (i.type === 'Part') { pRev += total; pCost += cost; } else { lRev += total; }
            });
        });
        return { laborRevenue: lRev, partsRevenue: pRev };
    };

    const serviceStatusCounts = {};
    currentServicesFiltered.forEach(s => {
        if (!isValidItem(s.status)) return;
        const st = s.status || 'Unknown';
        serviceStatusCounts[st] = (serviceStatusCounts[st] || 0) + 1;
    });
    const serviceStatusData = Object.keys(serviceStatusCounts).map(k => ({ name: k, value: serviceStatusCounts[k] }));

    const techStats = {};
    validServices.forEach(s => {
        s.service_assignees?.forEach(a => {
            const name = a.user?.first_name || 'ไม่ระบุ';
            if (!techStats[name]) techStats[name] = { name, jobs: 0, revenue: 0 };
            techStats[name].jobs += 1;
            techStats[name].revenue += (s.grand_total || 0);
        });
    });
    const technicianData = Object.values(techStats).sort((a,b) => b.jobs - a.jobs).slice(0, 5);

    const revenueCompositionData = [
        { name: 'ค่าแรง/บริการ', value: calcServiceStatsForTab(validServices).laborRevenue },
        { name: 'ค่าอะไหล่', value: calcServiceStatsForTab(validServices).partsRevenue }
    ];

    return {
        overviewStats,
        orderStats,
        chartData,
        categoryData,
        topProducts, 
        topLocations,
        serviceStats: {
            totalRevenue: serviceRevenue,
            totalCost: serviceCost,
            totalProfit: serviceProfit, 
            totalJobs: currentServicesFiltered.length,
            avgTicket: validServices.length > 0 ? serviceRevenue / validServices.length : 0,
            statusData: serviceStatusData,
            technicianData,
            revenueCompositionData,
            jobsGrowth: getGrowth(validServices.length, prevServices.filter(s => isValidItem(s.status)).length),
            revenueGrowth: getGrowth(serviceRevenue, prevServiceRevenue),
            profitGrowth: 0, // Placeholder
            outstanding: overviewStats.serviceOutstanding
        }
    };
  }, [rawData, dateFilter]);

  return { loading, processedData, dateFilter, setDateFilter, compareMode, setCompareMode };
};