import React from 'react';

interface KPICardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accentColor?: string;
}

const AdminDashboardKPICard: React.FC<KPICardProps> = ({
  label,
  value,
  sub,
  icon: Icon,
  accentColor,
}) => {
  return (
    <div className="rounded-xl border bg-card p-5 relative overflow-hidden shadow-sm">
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${
            accentColor || 'hsl(var(--primary))'
          }, transparent)`,
        }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </div>
          <div className="text-2xl font-bold font-mono mt-2">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        </div>
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${accentColor}15` }}>
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardKPICard;
