import type { SearchClient, SearchResponse } from 'algoliasearch';
import { algoliasearch } from 'algoliasearch';

// =========================================================================
// TYPES
// =========================================================================

export type TAlgoliaSearchResponse<T> = {
  hits: T[];
  nbHits: number;
  page: number;
  nbPages: number;
};

// CamelCase types for app use
export type TAlgoliaParticipant = {
  objectID: string;
  participantId: string;
  name: string;
  company: string;
  totalOrders: number;
  totalItems: number;
  totalSpent: number;
  uniqueFoods: number;
  avgPrice: number;
  varietyScore: number;
  tenureDays: number;
  isActive: boolean;
  firstOrder: string;
  lastOrder: string;
  personaName: string;
  personaEmoji: string;
  monthlyActivity: Record<string, number>;
  topCategory?: string;
  topCategoryPct?: number;
  topFoods: { name: string; quantity: number }[];
  recentOrders: { date: string; foods: string[] }[];
  categories: Record<string, number>;
  _tags: string[];
};

export type TAlgoliaOrder = {
  objectID: string;
  orderId: string;
  createdAt: string;
  createdAtTimestamp: number;
  status: string;
  customerName: string;
  company: string;
  phone?: string;
  email: string;
  totalItems: number;
  participants: string[];
  totalSpent: number;
};

export type TAlgoliaOrderItem = {
  objectID: string;
  orderId: string;
  createdAt: string;
  createdAtTimestamp: number;
  company: string;
  participantId: string;
  participantName: string;
  foodName: string;
  foodPrice: number;
  quantity: number;
  status: string;
};

// Raw snake_case types from Algolia
export type TAlgoliaParticipantRaw = {
  objectID: string;
  participant_id: string;
  name: string;
  company: string;
  total_orders: number;
  total_items: number;
  total_spent: number;
  unique_foods: number;
  avg_price: number;
  variety_score: number;
  tenure_days: number;
  is_active: boolean;
  first_order: string;
  last_order: string;
  persona_name: string;
  persona_emoji: string;
  monthly_activity: Record<string, number>;
  top_category?: string;
  top_category_pct?: number;
  top_foods: { name: string; quantity: number }[];
  recent_orders: { date: string; foods: string[] }[];
  categories: Record<string, number>;
  _tags: string[];
};

export type TAlgoliaOrderRaw = {
  objectID: string;
  order_id: string;
  created_at: string;
  created_at_timestamp: number;
  status: string;
  customer_name: string;
  company: string;
  phone?: string;
  email: string;
  total_items: number;
  participants: string[];
  total_spent: number;
};

export type TAlgoliaOrderItemRaw = {
  objectID: string;
  order_id: string;
  created_at: string;
  created_at_timestamp: number;
  company: string;
  participant_id: string;
  participant_name: string;
  food_name: string;
  food_price: number;
  quantity: number;
  status: string;
};

// =========================================================================
// TRANSFORMERS
// =========================================================================

function transformParticipant(
  raw: TAlgoliaParticipantRaw,
): TAlgoliaParticipant {
  return {
    objectID: raw.objectID,
    participantId: raw.participant_id,
    name: raw.name,
    company: raw.company,
    totalOrders: raw.total_orders,
    totalItems: raw.total_items,
    totalSpent: raw.total_spent,
    uniqueFoods: raw.unique_foods,
    avgPrice: raw.avg_price,
    varietyScore: raw.variety_score,
    tenureDays: raw.tenure_days,
    isActive: raw.is_active,
    firstOrder: raw.first_order,
    lastOrder: raw.last_order,
    personaName: raw.persona_name,
    personaEmoji: raw.persona_emoji,
    monthlyActivity: raw.monthly_activity,
    topCategory: raw.top_category,
    topCategoryPct: raw.top_category_pct,
    topFoods: raw.top_foods,
    recentOrders: raw.recent_orders,
    categories: raw.categories,
    _tags: raw._tags,
  };
}

function transformOrder(raw: TAlgoliaOrderRaw): TAlgoliaOrder {
  return {
    objectID: raw.objectID,
    orderId: raw.order_id,
    createdAt: raw.created_at,
    createdAtTimestamp: raw.created_at_timestamp,
    status: raw.status,
    customerName: raw.customer_name,
    company: raw.company,
    phone: raw.phone,
    email: raw.email,
    totalItems: raw.total_items,
    participants: raw.participants,
    totalSpent: raw.total_spent,
  };
}

function transformOrderItem(raw: TAlgoliaOrderItemRaw): TAlgoliaOrderItem {
  return {
    objectID: raw.objectID,
    orderId: raw.order_id,
    createdAt: raw.created_at,
    createdAtTimestamp: raw.created_at_timestamp,
    company: raw.company,
    participantId: raw.participant_id,
    participantName: raw.participant_name,
    foodName: raw.food_name,
    foodPrice: raw.food_price,
    quantity: raw.quantity,
    status: raw.status,
  };
}

// PCC Algolia indices
const PCC_ORDERS_INDEX = 'pcc-orders';
const PCC_PARTICIPANTS_INDEX = 'pcc-participants';
const PCC_ORDER_ITEMS_INDEX = 'pcc-order-items';

let client: SearchClient | null = null;

function getClient(): SearchClient {
  if (!client) {
    const appId = process.env.ALGOLIA_APP_ID || '';
    const adminKey =
      process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_ADMIN_KEY || '';
    client = algoliasearch(appId, adminKey);
  }

  return client;
}

// =========================================================================
// SEARCH FUNCTIONS
// =========================================================================

export async function searchOrders(options: {
  query?: string;
  company?: string;
  status?: string;
  page?: number;
  hitsPerPage?: number;
}): Promise<TAlgoliaSearchResponse<TAlgoliaOrder>> {
  const algolia = getClient();
  const filters: string[] = [];
  const combinedQuery = options.query || '';

  if (options.company) {
    filters.push(`company:"${options.company}"`);
  }
  if (options.status) {
    filters.push(`status:"${options.status}"`);
  }

  const response = await algolia.search<TAlgoliaOrderRaw>({
    requests: [
      {
        indexName: PCC_ORDERS_INDEX,
        query: combinedQuery.trim(),
        filters: filters.length > 0 ? filters.join(' AND ') : undefined,
        page: options.page || 0,
        hitsPerPage: options.hitsPerPage || 50,
      },
    ],
  });

  const result = response.results[0] as SearchResponse<TAlgoliaOrderRaw>;

  return {
    hits: (result.hits || []).map(transformOrder),
    nbHits: result.nbHits || 0,
    page: result.page || 0,
    nbPages: result.nbPages || 0,
  };
}

export async function searchOrderItems(options: {
  query?: string;
  company?: string;
  foodName?: string;
  participantId?: string;
  status?: string;
  page?: number;
  hitsPerPage?: number;
}): Promise<TAlgoliaSearchResponse<TAlgoliaOrderItem>> {
  const algolia = getClient();
  const filters: string[] = [];
  const combinedQuery = options.query || '';

  if (options.company) {
    filters.push(`company:"${options.company}"`);
  }
  if (options.foodName) {
    filters.push(`food_name:"${options.foodName}"`);
  }
  if (options.participantId) {
    filters.push(`participant_id:"${options.participantId}"`);
  }
  if (options.status) {
    filters.push(`status:"${options.status}"`);
  }

  const response = await algolia.search<TAlgoliaOrderItemRaw>({
    requests: [
      {
        indexName: PCC_ORDER_ITEMS_INDEX,
        query: combinedQuery.trim(),
        filters: filters.length > 0 ? filters.join(' AND ') : undefined,
        page: options.page || 0,
        hitsPerPage: options.hitsPerPage || 50,
      },
    ],
  });

  const result = response.results[0] as SearchResponse<TAlgoliaOrderItemRaw>;

  return {
    hits: (result.hits || []).map(transformOrderItem),
    nbHits: result.nbHits || 0,
    page: result.page || 0,
    nbPages: result.nbPages || 0,
  };
}

export async function searchParticipants(options: {
  query?: string;
  company?: string;
  persona?: string;
  isActive?: boolean;
  page?: number;
  hitsPerPage?: number;
}): Promise<TAlgoliaSearchResponse<TAlgoliaParticipant>> {
  const algolia = getClient();
  const filters: string[] = [];
  const trimmedQuery = options.query?.trim() || '';

  if (options.company) {
    filters.push(`company:"${options.company}"`);
  }
  if (options.persona) {
    filters.push(`persona_name:"${options.persona}"`);
  }

  filters.push('is_active:true');
  const response = await algolia.search({
    requests: [
      {
        indexName: PCC_PARTICIPANTS_INDEX,
        query: trimmedQuery,
        filters: filters.length > 0 ? filters.join(' AND ') : undefined,
        page: options.page || 0,
        hitsPerPage: options.hitsPerPage || 50,
      },
    ],
  });

  const result = response.results[0] as SearchResponse<TAlgoliaParticipantRaw>;

  return {
    hits: (result.hits || []).map(transformParticipant),
    nbHits: result.nbHits || 0,
    page: result.page || 0,
    nbPages: result.nbPages || 0,
  };
}

export async function getParticipantById(
  participantId: string,
): Promise<TAlgoliaParticipant | null> {
  const algolia = getClient();

  const response = await algolia.search<TAlgoliaParticipantRaw>({
    requests: [
      {
        indexName: PCC_PARTICIPANTS_INDEX,
        query: '',
        filters: `participant_id:"${participantId}"`,
        hitsPerPage: 1,
      },
    ],
  });

  const result = response.results[0] as SearchResponse<TAlgoliaParticipantRaw>;

  return result.hits?.[0] ? transformParticipant(result.hits[0]) : null;
}

export async function getStats() {
  const algolia = getClient();

  const response = await algolia.search({
    requests: [
      { indexName: PCC_ORDERS_INDEX, query: '', hitsPerPage: 0 },
      { indexName: PCC_PARTICIPANTS_INDEX, query: '', hitsPerPage: 0 },
      { indexName: PCC_ORDER_ITEMS_INDEX, query: '', hitsPerPage: 0 },
    ],
  });

  return {
    ordersCount: (response.results[0] as SearchResponse<any>).nbHits || 0,
    participantsCount: (response.results[1] as SearchResponse<any>).nbHits || 0,
    orderItemsCount: (response.results[2] as SearchResponse<any>).nbHits || 0,
  };
}
