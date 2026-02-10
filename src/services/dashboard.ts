import type { TAlgoliaOrder, TAlgoliaOrderItem } from './algolia';
import { searchOrderItems, searchOrders } from './algolia';

// =========================================================================
// INTERFACES
// =========================================================================

interface StatusFunnelItem {
  label: string;
  count: number;
  color: string;
  pct: number;
}

interface CompanyData {
  company: string;
  revenue: number;
  orders: number;
  share: number;
}

interface FoodData {
  name: string;
  quantity: number;
}

interface MonthlyData {
  [month: string]: {
    count: number;
    items: number;
  };
}

export interface DashboardData {
  generated_at: string;
  date_range: string;
  kpis: {
    total_orders: number;
    total_items: number;
    total_revenue: number;
    total_revenue_formatted: string;
    avg_price_per_item: number;
    unique_participants: number;
    completed_orders: number;
    completion_rate: number;
    expired_rate: number;
    expired_count: number;
  };
  status_funnel: StatusFunnelItem[];
  monthly_data: MonthlyData;
  top_companies: CompanyData[];
  top_foods: FoodData[];
  dow_data: number[];
  dow_labels: string[];
  hourly_data: number[];
  price_distribution: { [key: string]: number };
}

// =========================================================================
// CACHE
// =========================================================================

let cachedDashboard: DashboardData | null = null;
let lastCacheTime: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// =========================================================================
// HELPERS
// =========================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;

  return Math.floor(amount).toString();
}

function getMonthKey(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: '#10b981',
    pending: '#f59e0b',
    expired: '#ef4444',
    cancelled: '#6b7280',
  };

  return colors[status.toLowerCase()] || '#94a3b8';
}

function getDateRange(orders: TAlgoliaOrder[]): string {
  if (orders.length === 0) return 'No data';

  const dates = orders
    .filter((o) => o.createdAt)
    .map((o) => new Date(o.createdAt).getTime())
    .sort();

  if (dates.length === 0) return 'No data';

  const earliest = new Date(dates[0]).toLocaleDateString();
  const latest = new Date(dates[dates.length - 1]).toLocaleDateString();

  return `${earliest} - ${latest}`;
}

function calculatePriceDistribution(orders: TAlgoliaOrder[]): {
  [key: string]: number;
} {
  const distribution: { [key: string]: number } = {
    '0-50K': 0,
    '50-100K': 0,
    '100-200K': 0,
    '200-500K': 0,
    '500K+': 0,
  };

  orders.forEach((o) => {
    const spent = o.totalSpent || 0;
    if (spent < 50000) distribution['0-50K']++;
    else if (spent < 100000) distribution['50-100K']++;
    else if (spent < 200000) distribution['100-200K']++;
    else if (spent < 500000) distribution['200-500K']++;
    else distribution['500K+']++;
  });

  return distribution;
}

// =========================================================================
// MAIN FUNCTION
// =========================================================================

export async function getDashboardData(): Promise<DashboardData> {
  // Check cache
  if (
    cachedDashboard &&
    lastCacheTime &&
    Date.now() - lastCacheTime < CACHE_TTL_MS
  ) {
    return cachedDashboard;
  }

  // Fetch all orders from Algolia
  const [ordersResult] = await Promise.all([
    searchOrders({ query: '', hitsPerPage: 10000 }),
  ]);

  const orders = ordersResult.hits as TAlgoliaOrder[];

  // Fetch larger sample of items for top foods
  const topItemsResult = await searchOrderItems({
    query: '',
    hitsPerPage: 1000,
  });
  const rawItems = topItemsResult.hits as TAlgoliaOrderItem[];

  // Calculate KPIs
  const totalOrders = orders.length;
  const totalItems = orders.reduce(
    (sum: number, o) => sum + (o.totalItems || 0),
    0,
  );
  const totalRevenue = orders.reduce(
    (sum: number, o) => sum + (o.totalSpent || 0),
    0,
  );
  const completedOrders = orders.filter((o) =>
    o.status?.includes('complete'),
  ).length;
  const expiredOrders = orders.filter((o) =>
    o.status?.includes('expired'),
  ).length;

  // Unique participants
  const uniqueParticipants = new Set(
    orders.flatMap((o) => o.participants || []),
  ).size;

  // Status funnel
  const statusCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const status = o.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const statusFunnel: StatusFunnelItem[] = Object.entries(statusCounts)
    .map(([label, count]) => ({
      label,
      count,
      color: getStatusColor(label),
      pct: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Monthly data
  const monthlyData: MonthlyData = {};
  orders.forEach((o) => {
    if (o.createdAt) {
      const monthKey = getMonthKey(o.createdAt);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, items: 0 };
      }
      monthlyData[monthKey].count++;
      monthlyData[monthKey].items += o.totalItems || 0;
    }
  });

  // Top companies
  const companyRevenue: Record<string, { revenue: number; orders: number }> =
    {};
  orders.forEach((o) => {
    const company = o.company || 'Unknown';
    if (!companyRevenue[company]) {
      companyRevenue[company] = { revenue: 0, orders: 0 };
    }
    companyRevenue[company].revenue += o.totalSpent || 0;
    companyRevenue[company].orders++;
  });

  const topCompanies: CompanyData[] = Object.entries(companyRevenue)
    .map(([company, data]) => ({
      company,
      revenue: data.revenue,
      orders: data.orders,
      share: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Day of week analysis
  const dowCounts = new Array(7).fill(0);
  orders.forEach((o) => {
    if (o.createdAt) {
      const day = new Date(o.createdAt).getDay();
      dowCounts[day]++;
    }
  });

  // Hourly analysis
  const hourlyCounts = new Array(24).fill(0);
  orders.forEach((o) => {
    if (o.createdAt) {
      const hour = new Date(o.createdAt).getUTCHours();
      hourlyCounts[hour]++;
    }
  });

  // Top foods from sample
  const foodCounts: Record<string, number> = {};
  rawItems.forEach((item) => {
    const name = item.foodName || 'Unknown';
    foodCounts[name] = (foodCounts[name] || 0) + (item.quantity || 1);
  });

  const topFoods: FoodData[] = Object.entries(foodCounts)
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 15);

  // Build dashboard
  const dashboard: DashboardData = {
    generated_at: new Date().toISOString(),
    date_range: getDateRange(orders),
    kpis: {
      total_orders: totalOrders,
      total_items: totalItems,
      total_revenue: totalRevenue,
      total_revenue_formatted: formatCurrency(totalRevenue),
      avg_price_per_item:
        totalItems > 0 ? Math.round(totalRevenue / totalItems) : 0,
      unique_participants: uniqueParticipants,
      completed_orders: completedOrders,
      completion_rate:
        totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
      expired_rate: totalOrders > 0 ? (expiredOrders / totalOrders) * 100 : 0,
      expired_count: expiredOrders,
    },
    status_funnel: statusFunnel,
    monthly_data: monthlyData,
    top_companies: topCompanies,
    top_foods: topFoods,
    dow_data: dowCounts,
    dow_labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    hourly_data: hourlyCounts,
    price_distribution: calculatePriceDistribution(orders),
  };

  // Cache it
  cachedDashboard = dashboard;
  lastCacheTime = Date.now();

  return dashboard;
}
