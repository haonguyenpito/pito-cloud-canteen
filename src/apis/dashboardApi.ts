import { getApi } from './configs';

// PCC Dashboard
export const getDashboardApi = () => getApi('/admin/dashboard');

// PCC Personalization
export const getPersonalizationApi = (params?: {
  top?: number;
  company?: string;
  search?: string;
  page?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.top) query.append('top', params.top.toString());
  if (params?.company) query.append('company', params.company);
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', params.page.toString());

  const qs = query.toString();

  return getApi(`/admin/personalization${qs ? `?${qs}` : ''}`);
};

// PCC Personalization - Order Items
export const getOrderItemsApi = (params?: {
  page?: number;
  hitsPerPage?: number;
  company?: string;
  search?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.hitsPerPage)
    query.append('hitsPerPage', params.hitsPerPage.toString());
  if (params?.company) query.append('company', params.company);
  if (params?.search) query.append('search', params.search);

  const qs = query.toString();

  return getApi(`/admin/personalization/order-items${qs ? `?${qs}` : ''}`);
};

// PCC Personalization - Stats
export const getStatsApi = () => getApi('/admin/personalization/stats');

// PCC Personalization - Single Participant
export const getPccParticipantApi = (id: string) =>
  getApi(`/admin/personalization/${id}`);
