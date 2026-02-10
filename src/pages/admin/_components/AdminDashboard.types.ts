export interface StatusFunnelItem {
  label: string;
  count: number;
  color: string;
  pct: number;
}

export interface CompanyData {
  company: string;
  revenue: number;
  orders: number;
  share: number;
}

export interface FoodData {
  name: string;
  quantity: number;
}

export interface DashboardData {
  generated_at: string;
  date_range: string;
  last_sync?: string;
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
  monthly_data: Record<string, { count: number; items: number }>;
  top_companies: CompanyData[];
  top_foods: FoodData[];
  dow_data: number[];
  dow_labels: string[];
  hourly_data: number[];
  price_distribution: Record<string, number>;
}
