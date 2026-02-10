import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  AlertTriangle,
  Download,
  RefreshCw,
  Search,
  ShoppingCart,
  Star,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@components/lib/utils';
import Pagination from '@components/Pagination/Pagination';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Skeleton } from '@components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import {
  getOrderItemsApi,
  getPersonalizationApi,
} from '@src/apis/dashboardApi';

import MetricBox from './_components/MetricBox';
import type {
  OrderItem,
  ParticipantProfile,
  PersonalizationData,
} from './_components/Personalization.types';
import {
  formatCurrency,
  PERSONA_COLORS,
  PIE_COLORS,
} from './_components/personalizationUtils';
import ProfileModal from './_components/ProfileModal';

const PCCPersonalization = () => {
  const intl = useIntl();
  const [data, setData] = useState<PersonalizationData | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [selectedProfile, setSelectedProfile] =
    useState<ParticipantProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profiles' | 'orderItems'>(
    'profiles',
  );
  const [profilesPage, setProfilesPage] = useState(1);
  const [profilesPageSize, setProfilesPageSize] = useState(50);
  const [orderItemsPage, setOrderItemsPage] = useState(1);
  const [orderItemsPageSize, setOrderItemsPageSize] = useState(50);
  const [orderItemsTotal, setOrderItemsTotal] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getPersonalizationApi({
        search: searchQuery || undefined,
        company: filterCompany || undefined,
        top: profilesPageSize,
        page: profilesPage - 1,
      });
      setData(response.data);
    } catch (err) {
      setError('Failed to load personalization data');
      console.error('Personalization fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterCompany, profilesPage, profilesPageSize]);

  const fetchOrderItems = useCallback(async () => {
    try {
      setItemsLoading(true);
      const response = await getOrderItemsApi({
        page: orderItemsPage - 1,
        hitsPerPage: orderItemsPageSize,
        company: filterCompany || undefined,
        search: searchQuery || undefined,
      });
      setOrderItems(response.data.hits || []);
      setOrderItemsTotal(response.data.nbHits || 0);
      if (response.data.hitsPerPage) {
        setOrderItemsPageSize(response.data.hitsPerPage);
      }
    } catch (err) {
      console.error('Order items fetch error:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [searchQuery, filterCompany, orderItemsPage, orderItemsPageSize]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch order items when tab changes
  useEffect(() => {
    if (activeTab === 'orderItems') {
      fetchOrderItems();
    }
  }, [activeTab, fetchOrderItems]);

  // Handle search submit
  const handleSearch = useCallback(() => {
    setProfilesPage(1);
    setOrderItemsPage(1);
    setSearchQuery(searchTerm);
  }, [searchTerm]);

  const handleCompanyChange = useCallback((company: string) => {
    setFilterCompany(company);
    setProfilesPage(1);
    setOrderItemsPage(1);
  }, []);

  const filteredProfiles = useMemo(() => {
    if (!data?.profiles) return [];

    return data.profiles;
  }, [data]);

  const handleExportCSV = () => {
    if (!filteredProfiles.length) return;

    const headers = [
      'Name',
      'Company',
      'Persona',
      'Orders',
      'Items',
      'TotalSpent',
      'UniqueFoods',
      'AvgPrice',
      'VarietyScore',
      'Active',
    ];
    const rows = filteredProfiles.map((p) => [
      p.name,
      p.company,
      p.persona.name,
      p.totalOrders,
      p.totalItems,
      p.totalSpent,
      p.uniqueFoods,
      p.avgPrice,
      p.varietyScore.toFixed(4),
      p.isActive ? 'Yes' : 'No',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personalization-${
      new Date().toISOString().split('T')[0]
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 rounded-xl" />
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
                id: 'Personalization.noData',
                defaultMessage: 'No data available',
              })}
          </p>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <FormattedMessage id="common.retry" defaultMessage="Retry" />
          </Button>
        </div>
      </div>
    );
  }

  const { summary } = data;

  // Persona distribution chart data
  const personaChartData = Object.entries(summary.personaDistribution).map(
    ([name, count]) => ({
      name,
      count,
      color: PERSONA_COLORS[name] || '#64748b',
    }),
  );

  // Companies for filter
  const companies = Array.from(
    new Set(filteredProfiles.map((p) => p.company).filter(Boolean)),
  ).sort();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {intl.formatMessage({
              id: 'Personalization.title',
              defaultMessage: 'PCC Personalization',
            })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {intl.formatMessage({
              id: 'Personalization.subtitle',
              defaultMessage: 'Participant profiles & persona analysis',
            })}
            {data.lastSync &&
              ` · ${intl.formatMessage({
                id: 'Personalization.lastSync',
                defaultMessage: 'Last sync:',
              })} ${new Date(data.lastSync).toLocaleString('vi-VN')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!filteredProfiles.length}>
            <Download className="w-4 h-4 mr-2" />
            <FormattedMessage
              id="Personalization.exportCsv"
              defaultMessage="Export CSV"
            />
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <FormattedMessage id="common.refresh" defaultMessage="Refresh" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox
          label={intl.formatMessage({
            id: 'Personalization.totalParticipants',
            defaultMessage: 'Total Participants',
          })}
          value={summary.totalParticipants.toLocaleString()}
          sub={intl.formatMessage(
            {
              id: 'Personalization.activePercentage',
              defaultMessage: '{percentage}% active',
            },
            { percentage: summary.activePercentage.toFixed(0) },
          )}
          icon={Users}
          color="hsl(221, 83%, 53%)"
        />
        <MetricBox
          label={intl.formatMessage({
            id: 'Personalization.avgVarietyScore',
            defaultMessage: 'Avg Variety Score',
          })}
          value={summary.avgVarietyScore.toFixed(2)}
          sub={intl.formatMessage({
            id: 'Personalization.varietyScale',
            defaultMessage: '0-1 scale',
          })}
          icon={Star}
          color="hsl(48, 96%, 53%)"
        />
        <MetricBox
          label={intl.formatMessage({
            id: 'Personalization.avgOrdersPerPerson',
            defaultMessage: 'Avg Orders/Person',
          })}
          value={summary.avgOrdersPerPerson.toFixed(1)}
          icon={ShoppingCart}
          color="hsl(24, 95%, 53%)"
        />
        <MetricBox
          label={intl.formatMessage({
            id: 'Personalization.personaTypes',
            defaultMessage: 'Persona Types',
          })}
          value={Object.keys(summary.personaDistribution).length.toString()}
          sub={intl.formatMessage({
            id: 'Personalization.uniquePersonas',
            defaultMessage: 'unique personas',
          })}
          icon={Users}
          color="hsl(263, 70%, 50%)"
        />
      </div>

      {/* Persona Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Persona Bar Chart */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'Personalization.personaDistribution',
              defaultMessage: 'Persona Distribution',
            })}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={personaChartData} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                type="number"
                tick={{
                  fontSize: 11,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={130}
                tick={{
                  fontSize: 10,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {personaChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Company Breakdown Pie */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {intl.formatMessage({
              id: 'Personalization.participantsByCompany',
              defaultMessage: 'Participants by Company',
            })}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={summary.companyBreakdown.slice(0, 6)}
                dataKey="count"
                nameKey="company"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}>
                {summary.companyBreakdown.slice(0, 6).map((_, index) => (
                  <Cell
                    key={index}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab Switch */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => setActiveTab('profiles')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'profiles'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}>
          {intl.formatMessage({
            id: 'Personalization.profilesTab',
            defaultMessage: 'Participant Profiles',
          })}{' '}
          ({summary.totalParticipants.toLocaleString()})
        </button>
        <button
          onClick={() => setActiveTab('orderItems')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'orderItems'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}>
          {intl.formatMessage({
            id: 'Personalization.orderItemsTab',
            defaultMessage: 'Raw Order Items',
          })}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={intl.formatMessage({
              id: 'Personalization.searchPlaceholder',
              defaultMessage: 'Search by name...',
            })}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSearch}
          disabled={loading || itemsLoading}>
          <Search className="w-4 h-4 mr-2" />
          <FormattedMessage id="common.search" defaultMessage="Search" />
        </Button>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={filterCompany}
          onChange={(e) => handleCompanyChange(e.target.value)}>
          <option value="">
            {intl.formatMessage({
              id: 'Personalization.allCompanies',
              defaultMessage: 'All Companies',
            })}
          </option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {(searchQuery || filterCompany) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setSearchQuery('');
              setFilterCompany('');
            }}>
            <X className="w-4 h-4 mr-1" />
            <FormattedMessage id="common.clear" defaultMessage="Clear" />
          </Button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'profiles' ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>
                    <FormattedMessage
                      id="Personalization.participantColumn"
                      defaultMessage="Participant"
                    />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage
                      id="Personalization.companyColumn"
                      defaultMessage="Company"
                    />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage
                      id="Personalization.personaColumn"
                      defaultMessage="Persona"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage
                      id="Personalization.ordersColumn"
                      defaultMessage="Orders"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage
                      id="Personalization.spentColumn"
                      defaultMessage="Spent"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage
                      id="Personalization.varietyColumn"
                      defaultMessage="Variety"
                    />
                  </TableHead>
                  <TableHead className="text-center">
                    <FormattedMessage
                      id="Personalization.statusColumn"
                      defaultMessage="Status"
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((profile, i) => (
                  <TableRow
                    key={profile.participantId}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedProfile(profile);
                      setModalOpen(true);
                    }}>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {profile.persona.emoji}
                        </span>
                        <span className="font-medium text-sm">
                          {profile.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {profile.company}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          backgroundColor: `${
                            PERSONA_COLORS[profile.persona.name] || '#64748b'
                          }15`,
                          color:
                            PERSONA_COLORS[profile.persona.name] || '#64748b',
                          borderColor:
                            PERSONA_COLORS[profile.persona.name] || '#64748b',
                        }}>
                        {profile.persona.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {profile.totalOrders}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-600">
                      {formatCurrency(profile.totalSpent)}₫
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-blue-600">
                      {profile.varietyScore.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          'inline-block w-2 h-2 rounded-full',
                          profile.isActive ? 'bg-green-500' : 'bg-gray-300',
                        )}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProfiles.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground">
                      <FormattedMessage
                        id="Personalization.noParticipants"
                        defaultMessage="No participants found"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {summary.totalParticipants > 0 && (
            <div className="flex items-center justify-end px-4 py-3 border-t">
              <Pagination
                total={summary.totalParticipants}
                pageSize={profilesPageSize}
                current={profilesPage}
                showSizeChanger
                pageSizeOptions={['10', '25', '50', '100']}
                onChange={(page) => setProfilesPage(page)}
                onShowSizeChange={(_, size) => {
                  setProfilesPageSize(size);
                  setProfilesPage(1);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {itemsLoading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>
                      <FormattedMessage
                        id="Personalization.foodNameColumn"
                        defaultMessage="Food Name"
                      />
                    </TableHead>
                    <TableHead>
                      <FormattedMessage
                        id="Personalization.participantColumn"
                        defaultMessage="Participant"
                      />
                    </TableHead>
                    <TableHead>
                      <FormattedMessage
                        id="Personalization.companyColumn"
                        defaultMessage="Company"
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <FormattedMessage
                        id="Personalization.qtyColumn"
                        defaultMessage="Qty"
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <FormattedMessage
                        id="Personalization.priceColumn"
                        defaultMessage="Price"
                      />
                    </TableHead>
                    <TableHead>
                      <FormattedMessage
                        id="Personalization.dateColumn"
                        defaultMessage="Date"
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item, i) => (
                    <TableRow key={item.objectID || i}>
                      <TableCell className="font-mono text-muted-foreground text-xs">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">
                        {item.foodName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.participantName || item.participantId}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.company || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.quantity || 1}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600">
                        {item.foodPrice
                          ? `${formatCurrency(item.foodPrice)}`
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString('vi-VN')
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {orderItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-12 text-muted-foreground">
                        <FormattedMessage
                          id="Personalization.noOrderItems"
                          defaultMessage="No order items found"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {orderItemsTotal > 0 && (
                <div className="flex items-center justify-end px-4 py-3 border-t">
                  <Pagination
                    total={orderItemsTotal}
                    pageSize={orderItemsPageSize}
                    current={orderItemsPage}
                    showSizeChanger
                    pageSizeOptions={['10', '25', '50', '100']}
                    onChange={(page) => setOrderItemsPage(page)}
                    onShowSizeChange={(_, size) => {
                      setOrderItemsPageSize(size);
                      setOrderItemsPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal
        profile={selectedProfile}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default PCCPersonalization;
