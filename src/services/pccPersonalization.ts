import {
  getPccParticipantById as getParticipantById,
  getPccStats,
  searchPccOrderItems,
  searchPccParticipants,
} from './pccAlgolia';

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
  topCategory?: string;
  topCategoryPct?: number;
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

function transformHitToProfile(hit: any): ParticipantProfile {
  const personaName = hit.persona_name || 'Balanced Regular';
  const personaEmoji = hit.persona_emoji || '⚖️';
  const details =
    PERSONA_DETAILS[personaName] || PERSONA_DETAILS['Balanced Regular'];

  return {
    participantId: hit.participant_id || hit.objectID,
    name: hit.name || 'N/A',
    company: hit.company || 'N/A',
    totalOrders: hit.total_orders || 0,
    totalItems: hit.total_items || 0,
    totalSpent: hit.total_spent || 0,
    uniqueFoods: hit.unique_foods || 0,
    avgPrice: hit.avg_price || 0,
    varietyScore: hit.variety_score || 0,
    firstOrder: hit.first_order || '',
    lastOrder: hit.last_order || '',
    tenureDays: hit.tenure_days || 0,
    isActive: hit.is_active ?? true,
    persona: {
      name: personaName,
      emoji: personaEmoji,
      description: details.description,
      recommendations: details.recommendations,
    },
    categories: hit.categories || {},
    topCategory: hit.top_category || '',
    topCategoryPct: hit.top_category_pct || 0,
    topFoods: hit.top_foods || [],
    monthlyActivity: hit.monthly_activity || {},
    recentOrders: hit.recent_orders || [],
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

  const result = await searchPccParticipants({
    query: search || '',
    company,
    hitsPerPage: top,
    page,
  });

  const profiles: ParticipantProfile[] = result.hits.map((hit: any) =>
    transformHitToProfile(hit),
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
  return getPccStats();
}

export async function getOrderItems(
  options: {
    page?: number;
    hitsPerPage?: number;
    company?: string;
    search?: string;
  } = {},
) {
  return searchPccOrderItems({
    query: options.search,
    company: options.company,
    page: options.page || 0,
    hitsPerPage: options.hitsPerPage || 50,
  });
}
