import type { SearchClient } from 'algoliasearch';
import { algoliasearch } from 'algoliasearch';

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
}) {
  const algolia = getClient();
  const filters: string[] = [];
  let combinedQuery = options.query || '';

  if (options.company) {
    combinedQuery += ` ${options.company}`;
  }
  if (options.status) {
    filters.push(`status:"${options.status}"`);
  }

  const response = await algolia.search({
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

  const result = response.results[0] as any;

  return {
    hits: result.hits || [],
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
}) {
  const algolia = getClient();
  const filters: string[] = [];
  let combinedQuery = options.query || '';

  if (options.company) {
    combinedQuery += ` ${options.company}`;
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

  const response = await algolia.search({
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

  const result = response.results[0] as any;

  return {
    hits: result.hits || [],
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
}) {
  const algolia = getClient();
  const filters: string[] = [];
  let combinedQuery = options.query || '';

  if (options.company) {
    combinedQuery += ` ${options.company}`;
  }
  if (options.persona) {
    filters.push(`persona_name:"${options.persona}"`);
  }
  if (options.isActive !== undefined) {
    filters.push(`is_active:${options.isActive}`);
  }

  const response = await algolia.search({
    requests: [
      {
        indexName: PCC_PARTICIPANTS_INDEX,
        query: combinedQuery.trim(),
        filters: filters.length > 0 ? filters.join(' AND ') : undefined,
        page: options.page || 0,
        hitsPerPage: options.hitsPerPage || 50,
      },
    ],
  });

  const result = response.results[0] as any;

  return {
    hits: result.hits || [],
    nbHits: result.nbHits || 0,
    page: result.page || 0,
    nbPages: result.nbPages || 0,
  };
}

export async function getParticipantById(participantId: string) {
  const algolia = getClient();

  const response = await algolia.search({
    requests: [
      {
        indexName: PCC_PARTICIPANTS_INDEX,
        query: '',
        filters: `participant_id:"${participantId}"`,
        hitsPerPage: 1,
      },
    ],
  });

  const result = response.results[0] as any;

  return result.hits?.[0] || null;
}

export async function getStats() {
  const algolia = getClient();

  const [ordersResponse, participantsResponse, itemsResponse] =
    await Promise.all([
      algolia.search({
        requests: [{ indexName: PCC_ORDERS_INDEX, query: '', hitsPerPage: 0 }],
      }),
      algolia.search({
        requests: [
          {
            indexName: PCC_PARTICIPANTS_INDEX,
            query: '',
            hitsPerPage: 0,
          },
        ],
      }),
      algolia.search({
        requests: [
          {
            indexName: PCC_ORDER_ITEMS_INDEX,
            query: '',
            hitsPerPage: 0,
          },
        ],
      }),
    ]);

  return {
    ordersCount: (ordersResponse.results[0] as any).nbHits || 0,
    participantsCount: (participantsResponse.results[0] as any).nbHits || 0,
    orderItemsCount: (itemsResponse.results[0] as any).nbHits || 0,
  };
}
