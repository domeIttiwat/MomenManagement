import React from 'react';
import StatCards from './StatCards';
import MarketingChart from './MarketingChart';
import CategoryChart from './CategoryChart';
import TopRankings from './TopRankings';

const OrdersTab = ({ data, loading }) => {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      <StatCards stats={data.orderStats} loading={loading} />
      
      <div className="w-full h-[450px]">
        {/* ส่งข้อมูลเฉพาะ Order Sales ไปแสดง พร้อม stats เพื่อแสดง % Marketing และ Profit */}
        <MarketingChart 
            data={data.chartData.map(d => ({ 
                ...d, 
                sales: d.orderSales,
                profit: d.orderProfit 
            }))} 
            stats={data.orderStats} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex-1 min-h-[350px]">
            <CategoryChart data={data.categoryData || []} />
        </div>
        {/* Placeholder for future charts or leave empty */}
        <div className="flex-1 min-h-[350px] hidden lg:block"></div> 
      </div>

      <TopRankings 
        topProducts={data.topProducts} 
        topLocations={data.topLocations} 
      />
  </div>
  );
};

export default OrdersTab;