import type { TAlgoliaParticipant } from './algolia';
import {
  getParticipantById,
  getStats,
  searchOrderItems,
  searchParticipants,
} from './algolia';

// =========================================================================
// INTERFACES
// =========================================================================

export interface PersonaResult {
  name: string;
  emoji: string;
  description: string;
  recommendations: string[];
}

export interface TopFood {
  name: string;
  quantity: number;
}

export interface RecentOrder {
  date: string;
  foods: string[];
}

export interface ParticipantProfile {
  participantId: string;
  name: string;
  company: string;
  totalOrders: number;
  totalItems: number;
  totalSpent: number;
  uniqueFoods: number;
  avgPrice: number;
  varietyScore: number;
  firstOrder: string;
  lastOrder: string;
  tenureDays: number;
  isActive: boolean;
  persona: PersonaResult;
  categories?: Record<string, number>;
  topFoods?: TopFood[];
  monthlyActivity?: Record<string, number>;
  recentOrders?: RecentOrder[];
}

export interface PersonalizationSummary {
  totalParticipants: number;
  personaDistribution: Record<string, number>;
  avgVarietyScore: number;
  avgOrdersPerPerson: number;
  activePercentage: number;
  companyBreakdown: Array<{ company: string; count: number }>;
}

export interface PersonalizationResponse {
  profiles: ParticipantProfile[];
  summary: PersonalizationSummary;
  generatedAt: string;
  lastSync?: string;
  source: string;
}

// =========================================================================
// PERSONA DESCRIPTIONS
// =========================================================================

const PERSONA_DETAILS: Record<
  string,
  { description: string; recommendations: string[] }
> = {
  'New User': {
    description: 'Mới tham gia hệ thống, chưa đủ data để phân tích sâu.',
    recommendations: [
      'Welcome offer: giảm giá lần đầu',
      'Gợi ý best-sellers của company',
      'Survey khẩu vị ban đầu',
    ],
  },
  'Premium Explorer': {
    description: 'Variety score cao, avg price thuộc premium segment.',
    recommendations: [
      'Premium tasting menu weekly',
      'First-try bonus points',
      "Chef's special / seasonal notifications",
    ],
  },
  Explorer: {
    description: 'Thích thử nhiều, hiếm khi repeat món cũ.',
    recommendations: [
      "Gợi ý 'Món mới tuần này'",
      'Push seasonal specials',
      'Reward trải nghiệm mới (badge system)',
    ],
  },
  'OG Loyalist': {
    description: 'Khách hàng lâu năm, đặt đơn consistent và trung thành.',
    recommendations: [
      'Loyalty tier: VIP status',
      'Birthday/Anniversary rewards',
      'Priority support channel',
    ],
  },
  'Budget Regular': {
    description: 'Đặt thường xuyên, ưu tiên giá economy.',
    recommendations: [
      'Budget combo deals',
      'Flash sale notifications',
      'Weekly economy specials',
    ],
  },
  'Balanced Regular': {
    description: 'Khách hàng cân bằng, mix giữa quen và mới.',
    recommendations: [
      'Personalized suggestions dựa trên history',
      'Combo recommendations',
      'Occasional upsell premium items',
    ],
  },
};

// =========================================================================
// HELPERS
// =========================================================================

function transformHitToProfile(hit: TAlgoliaParticipant): ParticipantProfile {
  const personaName = hit.personaName || 'Balanced Regular';
  const personaEmoji = hit.personaEmoji || '⚖️';
  const details =
    PERSONA_DETAILS[personaName] || PERSONA_DETAILS['Balanced Regular'];

  return {
    participantId: hit.participantId || hit.objectID,
    name: hit.name || 'N/A',
    company: hit.company || 'N/A',
    totalOrders: hit.totalOrders || 0,
    totalItems: hit.totalItems || 0,
    totalSpent: hit.totalSpent || 0,
    uniqueFoods: hit.uniqueFoods || 0,
    avgPrice: hit.avgPrice || 0,
    varietyScore: hit.varietyScore || 0,
    firstOrder: hit.firstOrder || '',
    lastOrder: hit.lastOrder || '',
    tenureDays: hit.tenureDays || 0,
    isActive: hit.isActive ?? true,
    persona: {
      name: personaName,
      emoji: personaEmoji,
      description: details.description,
      recommendations: details.recommendations,
    },
    categories: hit.categories || {},
    topFoods: hit.topFoods || [],
    monthlyActivity: hit.monthlyActivity || {},
    recentOrders: hit.recentOrders || [],
  };
}

function buildSummary(
  profiles: ParticipantProfile[],
  totalHits: number,
): PersonalizationSummary {
  const personaDistribution: Record<string, number> = {};
  const companyMap: Record<string, number> = {};
  let totalVariety = 0;
  let totalOrders = 0;
  let activeCount = 0;

  profiles.forEach((p) => {
    const pName = p.persona.name;
    personaDistribution[pName] = (personaDistribution[pName] || 0) + 1;

    if (p.company !== 'N/A') {
      companyMap[p.company] = (companyMap[p.company] || 0) + 1;
    }

    totalVariety += p.varietyScore;
    totalOrders += p.totalOrders;
    if (p.isActive) activeCount++;
  });

  const count = profiles.length || 1;

  return {
    totalParticipants: totalHits,
    personaDistribution,
    avgVarietyScore: parseFloat((totalVariety / count).toFixed(4)),
    avgOrdersPerPerson: parseFloat((totalOrders / count).toFixed(1)),
    activePercentage: parseFloat(((activeCount / count) * 100).toFixed(1)),
    companyBreakdown: Object.entries(companyMap)
      .map(([company, cnt]) => ({ company, count: cnt }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

// =========================================================================
// MAIN FUNCTIONS
// =========================================================================

export async function getPersonalizationData(
  options: {
    top?: number;
    minOrders?: number;
    company?: string;
    search?: string;
    page?: number;
  } = {},
): Promise<PersonalizationResponse> {
  const { top = 50, company, search, page = 0 } = options;

  const result = await searchParticipants({
    query: search || '',
    company,
    hitsPerPage: top,
    page,
  });

  const profiles: ParticipantProfile[] = result.hits.map(
    (hit: TAlgoliaParticipant) => transformHitToProfile(hit),
  );

  const summary = buildSummary(profiles, result.nbHits);

  return {
    profiles,
    summary,
    generatedAt: new Date().toISOString(),
    source: 'algolia',
  };
}

export async function getParticipantProfileById(
  participantId: string,
): Promise<ParticipantProfile | null> {
  const hit = await getParticipantById(participantId);
  if (!hit) return null;

  return transformHitToProfile(hit);
}

export async function getAlgoliaStats() {
  return getStats();
}

export async function getOrderItems(
  options: {
    page?: number;
    hitsPerPage?: number;
    company?: string;
    search?: string;
  } = {},
) {
  return searchOrderItems({
    query: options.search,
    company: options.company,
    page: options.page || 0,
    hitsPerPage: options.hitsPerPage || 50,
  });
}
