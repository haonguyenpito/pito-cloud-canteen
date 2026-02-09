import React from 'react';

interface MetricBoxProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}

const PCCMetricBox: React.FC<MetricBoxProps> = ({
  label,
  value,
  sub,
  icon: Icon,
  color,
}) => {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </div>
          <div className="text-xl font-bold font-mono mt-1">{value}</div>
          {sub && (
            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PCCMetricBox;
