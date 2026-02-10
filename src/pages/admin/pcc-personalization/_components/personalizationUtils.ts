export const PERSONA_COLORS: Record<string, string> = {
  'New User': '#94a3b8',
  'Premium Explorer': '#a855f7',
  Explorer: '#3b82f6',
  'OG Loyalist': '#f59e0b',
  'Budget Regular': '#10b981',
  'Balanced Regular': '#64748b',
};

export const PIE_COLORS = [
  'hsl(24, 95%, 53%)',
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(263, 70%, 50%)',
  'hsl(48, 96%, 53%)',
  'hsl(215, 16%, 47%)',
];

export const formatCurrency = (amount: number): string => {
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;

  return amount.toLocaleString();
};
