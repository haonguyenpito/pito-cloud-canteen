import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@components/ui/button';
import { Skeleton } from '@components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { getPccDashboardApi } from '@src/apis/pccApi';
import type { PCCDashboardData } from '@src/pages/admin/_components/AdminDashboard.types';
import AdminDashboardInsightCard from '@src/pages/admin/_components/AdminDashboardInsightCard';
import AdminDashboardKPICard from '@src/pages/admin/_components/AdminDashboardKPICard';
import AdminDashboardStatusFunnelBar from '@src/pages/admin/_components/AdminDashboardStatusFunnelBar';

const PIE_COLORS = [
  'hsl(24, 95%, 53%)',
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(263, 70%, 50%)',
  'hsl(48, 96%, 53%)',
  'hsl(215, 16%, 47%)',
];

const CHART_COLORS = {
  orange: 'hsl(24, 95%, 53%)',
  blue: 'hsl(221, 83%, 53%)',
  green: 'hsl(142, 71%, 45%)',
  cyan: 'hsl(189, 94%, 43%)',
};

const formatCurrency = (amount: number): string => {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;

  return amount.toLocaleString();
};

const AdminDashboard = () => {
  const intl = useIntl();
  const [data, setData] = useState<PCCDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getPccDashboardApi();
      setData(response.data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <AlertTriangle className="w-12 h-12 text-destructive" />
          <p className="text-destructive">
            {error ||
              intl.formatMessage({
                id: 'AdminDashboard.noData',
                defaultMessage: 'No data available',
              })}
          </p>
          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <FormattedMessage id="common.retry" defaultMessage="Retry" />
          </Button>
        </div>
      </div>
    );
  }

  const {
    kpis,
    status_funnel,
    monthly_data,
    top_companies,
    top_foods,
    dow_data,
    dow_labels,
    hourly_data,
    price_distribution,
  } = data;

  // Prepare chart data
  const monthlyChartData = Object.entries(monthly_data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      month: month.slice(2),
      orders: values.count,
      items: values.items,
    }));

  const dowChartData = dow_labels.map((label, i) => ({
    day: label,
    orders: dow_data[i],
  }));

  const hourlyChartData = hourly_data.map((count, hour) => ({
    hour: `${hour}h`,
    orders: count,
  }));

  const priceChartData = Object.entries(price_distribution).map(
    ([range, count]) => ({
      range,
      count,
    }),
  );

  const pieData = top_companies.slice(0, 5).map((c) => ({
    name:
      c.company.length > 20 ? `${c.company.substring(0, 20)}...` : c.company,
    value: c.revenue,
    share: c.share,
  }));

  const tooltipStyle = {
    contentStyle: {
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '8px',
      fontSize: '12px',
    },
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {intl.formatMessage({
              id: 'AdminDashboard.title',
              defaultMessage: 'PITO Cloud Canteen Dashboard',
            })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {intl.formatMessage({
              id: 'AdminDashboard.dataLabel',
              defaultMessage: 'Data:',
            })}{' '}
            {data.date_range}
            {data.last_sync &&
              ` · ${intl.formatMessage({
                id: 'AdminDashboard.lastSeed',
                defaultMessage: 'Last Seed:',
              })} ${new Date(data.last_sync).toLocaleString('vi-VN')}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {kpis.total_orders.toLocaleString()}{' '}
            {intl.formatMessage({
              id: 'AdminDashboard.orders',
              defaultMessage: 'orders',
            })}{' '}
            · {kpis.total_items.toLocaleString()}{' '}
            {intl.formatMessage({
              id: 'AdminDashboard.items',
              defaultMessage: 'items',
            })}
          </div>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <FormattedMessage id="common.refresh" defaultMessage="Refresh" />
          </Button>
        </div>
      </div>

      {/* Critical Alert */}
      {kpis.expired_rate > 50 && (
        <div className="bg-destructive/10 border border-destructive/25 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">
                <FormattedMessage
                  id="AdminDashboard.criticalExpiredTitle"
                  defaultMessage="Critical: Expired rate is {rate}% of total orders"
                  values={{ rate: kpis.expired_rate.toFixed(1) }}
                />
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="px-2 py-0.5 bg-destructive/20 text-destructive rounded text-xs font-medium mr-2">
                  {kpis.expired_count.toLocaleString()} orders
                </span>
                <FormattedMessage
                  id="AdminDashboard.criticalExpiredDescription"
                  defaultMessage="expired. Only {completion}% of orders are completed."
                  values={{
                    completion: (
                      <strong>{kpis.completion_rate.toFixed(1)}%</strong>
                    ),
                  }}
                />
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminDashboardKPICard
          label={intl.formatMessage({
            id: 'AdminDashboard.totalOrders',
            defaultMessage: 'Total Orders',
          })}
          value={kpis.total_orders.toLocaleString()}
          sub={data.date_range}
          icon={ShoppingCart}
          accentColor="hsl(24, 95%, 53%)"
        />
        <AdminDashboardKPICard
          label={intl.formatMessage({
            id: 'AdminDashboard.completedOrders',
            defaultMessage: 'Completed',
          })}
          value={kpis.completed_orders.toString()}
          sub={intl.formatMessage(
            {
              id: 'AdminDashboard.completionRate',
              defaultMessage: '{rate}% completion rate',
            },
            { rate: kpis.completion_rate.toFixed(1) },
          )}
          icon={TrendingUp}
          accentColor="hsl(142, 71%, 45%)"
        />
        <AdminDashboardKPICard
          label={intl.formatMessage({
            id: 'AdminDashboard.totalRevenue',
            defaultMessage: 'Total Revenue',
          })}
          value={kpis.total_revenue_formatted}
          sub={intl.formatMessage(
            {
              id: 'AdminDashboard.avgPricePerItem',
              defaultMessage: 'VND · Avg {price}₫/item',
            },
            { price: kpis.avg_price_per_item.toLocaleString() },
          )}
          icon={DollarSign}
          accentColor="hsl(221, 83%, 53%)"
        />
        <AdminDashboardKPICard
          label={intl.formatMessage({
            id: 'AdminDashboard.participants',
            defaultMessage: 'Participants',
          })}
          value={kpis.unique_participants.toLocaleString()}
          sub={intl.formatMessage({
            id: 'AdminDashboard.uniqueDiners',
            defaultMessage: 'Unique diners',
          })}
          icon={Users}
          accentColor="hsl(263, 70%, 50%)"
        />
        <AdminDashboardKPICard
          label={intl.formatMessage({
            id: 'AdminDashboard.expiredRate',
            defaultMessage: 'Expired Rate',
          })}
          value={`${kpis.expired_rate.toFixed(1)}%`}
          sub={intl.formatMessage(
            {
              id: 'AdminDashboard.expiredOrders',
              defaultMessage: '{count} expired orders',
            },
            { count: kpis.expired_count.toLocaleString() },
          )}
          icon={Clock}
          accentColor="hsl(0, 84%, 60%)"
        />
      </div>

      {/* Row: Status Funnel + Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Funnel */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'AdminDashboard.orderStatusFunnel',
              defaultMessage: 'Order Status Funnel',
            })}
          </h3>
          <div className="space-y-2">
            {status_funnel.map((item) => (
              <AdminDashboardStatusFunnelBar
                key={item.label}
                item={item}
                maxCount={Math.max(...status_funnel.map((s) => s.count))}
              />
            ))}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'AdminDashboard.monthlyTrend',
              defaultMessage: 'Monthly Orders & Items Trend',
            })}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={monthlyChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="orders"
                fill={CHART_COLORS.orange}
                opacity={0.8}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="items"
                stroke={CHART_COLORS.cyan}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row: Top Companies + Top Foods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Companies */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'AdminDashboard.topCompanies',
              defaultMessage: 'Top Companies by Revenue',
            })}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>
                  <FormattedMessage
                    id="AdminDashboard.company"
                    defaultMessage="Company"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage
                    id="AdminDashboard.revenue"
                    defaultMessage="Revenue"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage
                    id="AdminDashboard.ordersColumn"
                    defaultMessage="Orders"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage
                    id="AdminDashboard.share"
                    defaultMessage="Share"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top_companies.slice(0, 8).map((company, i) => (
                <TableRow key={company.company}>
                  <TableCell className="font-mono text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {company.company}
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    {formatCurrency(company.revenue)}₫
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {company.orders}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {company.share.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Top Foods */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'AdminDashboard.topFoods',
              defaultMessage: 'Top 15 Foods (by Quantity)',
            })}
          </h3>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {top_foods.slice(0, 15).map((food, i) => (
              <div
                key={food.name}
                className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50">
                <span className="text-xs text-muted-foreground font-mono w-5">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm truncate">{food.name}</span>
                <span className="text-sm text-blue-600 font-mono">
                  {food.quantity.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row: Day of Week + Hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of Week */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'AdminDashboard.ordersByDayOfWeek',
              defaultMessage: 'Orders by Day of Week',
            })}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dowChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip {...tooltipStyle} />
              <Bar
                dataKey="orders"
                fill={CHART_COLORS.blue}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Distribution */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'AdminDashboard.hourlyDistribution',
              defaultMessage: 'Hourly Distribution (UTC)',
            })}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip {...tooltipStyle} />
              <Bar
                dataKey="orders"
                fill={CHART_COLORS.orange}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row: Revenue Pie + Price Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Pie */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'AdminDashboard.revenueDistribution',
              defaultMessage: 'Revenue Distribution',
            })}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
                labelLine={false}>
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${formatCurrency(value as number)}₫`}
                {...tooltipStyle}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Price Distribution */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'AdminDashboard.priceDistribution',
              defaultMessage: 'Price Distribution (VND)',
            })}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={priceChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {priceChartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          {intl.formatMessage({
            id: 'AdminDashboard.insightsTitle',
            defaultMessage: 'Operational Insights & Recommendations',
          })}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AdminDashboardInsightCard
            type="warn"
            title={intl.formatMessage({
              id: 'AdminDashboard.expiredRateInsight',
              defaultMessage: 'Expired Rate',
            })}
            metric={`${kpis.expired_rate.toFixed(1)}%`}
            description={intl.formatMessage(
              {
                id: 'AdminDashboard.expiredRateInsightDescription',
                defaultMessage:
                  '{count} orders expired. Action: Reduce SLA review time, add auto-reminders.',
              },
              { count: kpis.expired_count.toLocaleString() },
            )}
          />
          <AdminDashboardInsightCard
            type="info"
            title={intl.formatMessage({
              id: 'AdminDashboard.concentrationRisk',
              defaultMessage: 'Concentration Risk',
            })}
            metric={intl.formatMessage(
              {
                id: 'AdminDashboard.concentrationRiskMetric',
                defaultMessage: 'Top 3 = {share}%',
              },
              {
                share: top_companies
                  .slice(0, 3)
                  .reduce((sum, c) => sum + c.share, 0)
                  .toFixed(0),
              },
            )}
            description={intl.formatMessage({
              id: 'AdminDashboard.concentrationRiskDescription',
              defaultMessage:
                'Top 3 companies account for most of the revenue. Action: Diversify customer base.',
            })}
          />
          <AdminDashboardInsightCard
            type="success"
            title={intl.formatMessage({
              id: 'AdminDashboard.totalItemsInsight',
              defaultMessage: 'Total Items',
            })}
            metric={kpis.total_items.toLocaleString()}
            description={intl.formatMessage(
              {
                id: 'AdminDashboard.totalItemsInsightDescription',
                defaultMessage:
                  'Total number of items ordered. Avg price: {price}₫/item.',
              },
              { price: kpis.avg_price_per_item.toLocaleString() },
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
