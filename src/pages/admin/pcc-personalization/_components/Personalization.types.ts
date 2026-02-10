import type {
  TAlgoliaOrder,
  TAlgoliaOrderItem,
  TAlgoliaParticipant,
} from '@services/algolia';

export interface PersonaResult {
  name: string;
  emoji: string;
  description: string;
  recommendations: string[];
}

export interface ParticipantProfile
  extends Omit<
    TAlgoliaParticipant,
    'personaName' | 'personaEmoji' | 'topFoods' | 'recentOrders' | '_tags'
  > {
  persona: PersonaResult;
  topFoods?: TAlgoliaParticipant['topFoods'];
  recentOrders?: TAlgoliaParticipant['recentOrders'];
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

export type OrderItem = TAlgoliaOrderItem;
export type Order = TAlgoliaOrder;
