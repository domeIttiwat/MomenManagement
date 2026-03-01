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

const calcOrderCOGS = (order) => {
  const itemsCost = order.order_items?.reduce((s, i) => s + (Number(i.cost_price) * Number(i.quantity)), 0) || 0;
  return itemsCost + (Number(order.shipping_cost) || 0);
};

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

    // 2.2 Cash-Basis Sales Stats (grouped by payment_date)
    const orderPaymentsInPeriod = [];
    orders.filter(o => isValidItem(o.status)).forEach(o => {
        (o.order_payments || []).forEach(p => {
            const d = safeDate(p.payment_date);
            if (d && isWithinInterval(d, { start, end })) {
                orderPaymentsInPeriod.push({ ...p, _order: o });
            }
        });
    });

    const marketingCost = currentMarketing.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const salesValue = orderPaymentsInPeriod.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const costOfGoods = orderPaymentsInPeriod.reduce((s, p) => {
        const orderTotal = Number(p._order.grand_total) || 0;
        const cogs = calcOrderCOGS(p._order);
        return s + (orderTotal > 0 ? cogs * Number(p.amount) / orderTotal : 0);
    }, 0);

    const grossProfit = salesValue - costOfGoods;
    const netProfit = grossProfit - marketingCost;

    const marketingPercent = salesValue > 0 ? (marketingCost / salesValue) * 100 : 0;
    const grossMargin = salesValue > 0 ? (grossProfit / salesValue) * 100 : 0;
    const netMargin = salesValue > 0 ? (netProfit / salesValue) * 100 : 0;

    const outstanding = validOrders.reduce((sum, o) => {
        const paid = (o.order_payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        return sum + Math.max(0, (Number(o.grand_total) || 0) - paid);
    }, 0);

    // Prev period comparison (payment_date based)
    const prevOrderPaymentsInPeriod = [];
    orders.filter(o => isValidItem(o.status)).forEach(o => {
        (o.order_payments || []).forEach(p => {
            const d = safeDate(p.payment_date);
            if (d && d >= prevStart && d <= prevEnd) prevOrderPaymentsInPeriod.push(p);
        });
    });
    const prevSalesValue = prevOrderPaymentsInPeriod.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const getGrowth = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

    const orderStats = {
        totalOrders: currentOrders.length,
        completedCount: validOrders.length,
        salesValue,
        cost: costOfGoods,
        costOfGoods,
        grossProfit,
        marketingCost,
        netProfit,
        actualReceived: salesValue,
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

    // 2.3 Service Stats (Cash-Basis by payment_date)
    const validServices = currentServicesFiltered.filter(s => isValidItem(s.status));

    const servicePaymentsInPeriod = [];
    services.filter(s => isValidItem(s.status)).forEach(s => {
        (s.service_payments || []).forEach(p => {
            const d = safeDate(p.payment_date);
            if (d && isWithinInterval(d, { start, end })) {
                servicePaymentsInPeriod.push({ ...p, _service: s });
            }
        });
    });

    const prevServicePaymentsInPeriod = [];
    services.filter(s => isValidItem(s.status)).forEach(s => {
        (s.service_payments || []).forEach(p => {
            const d = safeDate(p.payment_date);
            if (d && d >= prevStart && d <= prevEnd) prevServicePaymentsInPeriod.push(p);
        });
    });

    const serviceRevenue = servicePaymentsInPeriod.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const prevServiceRevenue = prevServicePaymentsInPeriod.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const serviceCost = servicePaymentsInPeriod.reduce((sum, p) => {
        const sTotal = Number(p._service.grand_total) || 0;
        const sCost = p._service.service_items?.filter(i => i.type === 'Part').reduce((c, i) => c + Number(i.cost_price) * Number(i.quantity), 0) || 0;
        return sum + (sTotal > 0 ? sCost * Number(p.amount) / sTotal : 0);
    }, 0);
    const serviceProfit = serviceRevenue - serviceCost;

    const serviceOutstandingAmt = services.filter(s => isValidItem(s.status)).reduce((sum, s) => {
        const paid = (s.service_payments || []).reduce((t, p) => t + (Number(p.amount) || 0), 0);
        return sum + Math.max(0, (Number(s.grand_total) || 0) - paid);
    }, 0);

    // --- Overview Stats Calculation ---
    const totalRevenue = salesValue + serviceRevenue;
    const totalNetProfit = orderStats.netProfit + serviceProfit;
    const prevTotalRevenue = prevSalesValue + prevServiceRevenue;

    // Outstanding orders (all-time unpaid — not period-filtered)
    const outstandingOrdersList = orders
        .filter(o => isValidItem(o.status))
        .map(o => {
            const totalPaid = (o.order_payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const outstandingAmt = (Number(o.grand_total) || 0) - totalPaid;
            if (outstandingAmt < 1) return null;
            return {
                id: o.id,
                orderNumber: o.order_number,
                customerName: o.customer_cache?.nickname || o.customer_cache?.first_name || 'ไม่ระบุ',
                grandTotal: Number(o.grand_total) || 0,
                received: totalPaid,
                outstanding: outstandingAmt,
                orderDate: o.order_date,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.outstanding - a.outstanding);

    const totalOutstandingAll = outstandingOrdersList.reduce((s, o) => s + o.outstanding, 0);

    const overviewStats = {
        totalRevenue,
        netProfit: totalNetProfit,
        totalOrders: currentOrders.length,
        marketingCost,

        revenueGrowth: getGrowth(totalRevenue, prevTotalRevenue),

        orderRevenue: salesValue,
        orderProfit: orderStats.netProfit,
        serviceRevenue,
        serviceProfit,

        orderRevenueShare: totalRevenue > 0 ? (salesValue / totalRevenue * 100).toFixed(1) : 0,
        serviceRevenueShare: totalRevenue > 0 ? (serviceRevenue / totalRevenue * 100).toFixed(1) : 0,

        orderProfitShare: totalNetProfit > 0 ? (orderStats.netProfit / totalNetProfit * 100).toFixed(1) : 0,
        serviceProfitShare: totalNetProfit > 0 ? (serviceProfit / totalNetProfit * 100).toFixed(1) : 0,

        orderOutstanding: outstanding,
        serviceOutstanding: serviceOutstandingAmt,

        outstandingOrdersList,
        totalOutstandingAll,
    };

    // --- Chart Data ---
    let intervals = groupBy === 'day' ? eachDayOfInterval({ start, end }) : eachMonthOfInterval({ start, end });

    const chartData = intervals.map((datePoint) => {
        const label = format(datePoint, groupBy === 'day' ? 'd MMM' : 'MMM', { locale: th });
        const isMatch = (dStr) => {
            const d = safeDate(dStr);
            return d && (groupBy === 'day' ? format(d, 'yyyy-MM-dd') === format(datePoint, 'yyyy-MM-dd') : isSameMonth(d, datePoint));
        };

        // Group by payment_date (cash-basis)
        const dayOrderPayments = orderPaymentsInPeriod.filter(p => isMatch(p.payment_date));
        const dayServicePayments = servicePaymentsInPeriod.filter(p => isMatch(p.payment_date));
        const dayMarketing = currentMarketing.filter(m => isMatch(m.expense_date));

        const orderReceived = dayOrderPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const serviceReceived = dayServicePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const dayMarketingCost = dayMarketing.reduce((s, m) => s + (Number(m.amount) || 0), 0);

        const propCOGS = dayOrderPayments.reduce((s, p) => {
            const orderTotal = Number(p._order.grand_total) || 0;
            const cogs = calcOrderCOGS(p._order);
            return s + (orderTotal > 0 ? cogs * Number(p.amount) / orderTotal : 0);
        }, 0);

        const orderProfit = orderReceived - propCOGS - dayMarketingCost;

        // Prev period comparison (payment_date based)
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
            prevOrderSales = orders.filter(o => isValidItem(o.status)).reduce((s, o) =>
                s + (o.order_payments || []).filter(p => isPrevMatch(p.payment_date)).reduce((ps, p) => ps + (Number(p.amount) || 0), 0), 0);
            const prevSrvSales = services.filter(s => isValidItem(s.status)).reduce((s, srv) =>
                s + (srv.service_payments || []).filter(p => isPrevMatch(p.payment_date)).reduce((ps, p) => ps + (Number(p.amount) || 0), 0), 0);
            prevTotalSales = prevOrderSales + prevSrvSales;
        }

        return {
            date: label,
            orderSales: orderReceived,
            serviceSales: serviceReceived,
            sales: orderReceived,
            profit: orderProfit,
            marketing: dayMarketingCost,
            marketingCost: dayMarketingCost,
            cost: dayMarketingCost,
            totalSales: orderReceived + serviceReceived,
            orderProfit,
            prevTotalSales,
            prevOrderSales,
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

  const yearlyData = useMemo(() => {
    if (rawData.orders.length === 0 && rawData.services.length === 0 && rawData.marketing.length === 0) return [];
    const { orders, services, marketing } = rawData;
    const now = new Date();
    const months = eachMonthOfInterval({ start: startOfYear(now), end: endOfYear(now) });
    const isValidStatus = (status) => status !== 'Cancelled' && status !== 'Quotation';
    const safeD = (d) => { if (!d) return null; const dt = new Date(d); return isValid(dt) ? dt : null; };

    return months.map(monthDate => {
      // Order payments received in this month (cash-basis)
      const mOrderPayments = [];
      orders.filter(o => isValidStatus(o.status)).forEach(o => {
        (o.order_payments || []).forEach(p => {
          const d = safeD(p.payment_date);
          if (d && isSameMonth(d, monthDate)) mOrderPayments.push({ ...p, _order: o });
        });
      });

      const orderSales = mOrderPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const propCOGS = mOrderPayments.reduce((sum, p) => {
        const orderTotal = Number(p._order.grand_total) || 0;
        const cogs = calcOrderCOGS(p._order);
        return sum + (orderTotal > 0 ? cogs * Number(p.amount) / orderTotal : 0);
      }, 0);

      // Service payments received in this month (cash-basis)
      const mSvcPayments = [];
      services.filter(s => isValidStatus(s.status)).forEach(s => {
        (s.service_payments || []).forEach(p => {
          const d = safeD(p.payment_date);
          if (d && isSameMonth(d, monthDate)) mSvcPayments.push({ ...p, _service: s });
        });
      });

      const serviceSales = mSvcPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const serviceCostProp = mSvcPayments.reduce((sum, p) => {
        const sTotal = Number(p._service.grand_total) || 0;
        const sCost = p._service.service_items?.filter(i => i.type === 'Part').reduce((c, i) => c + Number(i.cost_price) * Number(i.quantity), 0) || 0;
        return sum + (sTotal > 0 ? sCost * Number(p.amount) / sTotal : 0);
      }, 0);

      const mktCost = marketing
        .filter(m => { const d = safeD(m.expense_date); return d && isSameMonth(d, monthDate); })
        .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

      const totalSales = orderSales + serviceSales;
      const profit = (orderSales - propCOGS - mktCost) + (serviceSales - serviceCostProp);
      const marketingRatio = totalSales > 0 ? parseFloat((mktCost / totalSales * 100).toFixed(1)) : 0;

      return {
        month: format(monthDate, 'MMM', { locale: th }),
        sales: totalSales,
        profit,
        marketing: mktCost,
        marketingRatio,
      };
    });
  }, [rawData]);

  return { loading, processedData, yearlyData, dateFilter, setDateFilter, compareMode, setCompareMode };
};