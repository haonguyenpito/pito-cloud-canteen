import React from 'react';

import { cn } from '@components/lib/utils';

type InsightCardType = 'warn' | 'info' | 'success';

interface InsightCardProps {
  type: InsightCardType;
  title: string;
  metric: string;
  description: string;
}

const AdminDashboardInsightCard: React.FC<InsightCardProps> = ({
  type,
  title,
  metric,
  description,
}) => {
  const config: Record<InsightCardType, { border: string; metric: string }> = {
    warn: {
      border: 'border-l-red-500',
      metric: 'text-red-600',
    },
    info: {
      border: 'border-l-blue-500',
      metric: 'text-blue-600',
    },
    success: {
      border: 'border-l-green-500',
      metric: 'text-green-600',
    },
  };

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 border-l-4 shadow-sm',
        config[type].border,
      )}>
      <h4 className="text-sm font-semibold">{title}</h4>
      <div
        className={cn(
          'text-2xl font-bold font-mono mt-2',
          config[type].metric,
        )}>
        {metric}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{description}</p>
    </div>
  );
};

export default AdminDashboardInsightCard;
