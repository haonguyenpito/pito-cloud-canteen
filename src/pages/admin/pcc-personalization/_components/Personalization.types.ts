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

export interface PersonalizationData {
  profiles: ParticipantProfile[];
  summary: PersonalizationSummary;
  generatedAt: string;
  lastSync?: string;
  source: string;
}

export interface OrderItem {
  objectID: string;
  food_name: string;
  quantity: number;
  price: number;
  participant_id: string;
  participant_name?: string;
  company?: string;
  order_date?: string;
  status?: string;
}
