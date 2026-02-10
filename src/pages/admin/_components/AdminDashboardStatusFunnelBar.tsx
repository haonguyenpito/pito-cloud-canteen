import React from 'react';

import type { StatusFunnelItem } from './AdminDashboard.types';

interface StatusFunnelBarProps {
  item: StatusFunnelItem;
  maxCount: number;
}

const AdminDashboardStatusFunnelBar: React.FC<StatusFunnelBarProps> = ({
  item,
  maxCount,
}) => {
  const width = (item.count / maxCount) * 100;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50">
      <span
        className="text-xs font-medium w-24 shrink-0"
        style={{ color: item.color }}>
        {item.label}
      </span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${width}%`, backgroundColor: item.color }}
        />
      </div>
      <span
        className="text-xs font-mono font-semibold w-14 text-right"
        style={{ color: item.color }}>
        {item.count.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground w-12 text-right">
        {item.pct.toFixed(1)}%
      </span>
    </div>
  );
};

export default AdminDashboardStatusFunnelBar;
