import React from 'react';
import { ChevronRight } from 'lucide-react';

import { Badge } from '@components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Progress } from '@components/ui/progress';

import type { ParticipantProfile } from './PCCPersonalization.types';
import { formatCurrency, PERSONA_COLORS } from './pccPersonalizationUtils';

interface ProfileModalProps {
  profile: ParticipantProfile | null;
  open: boolean;
  onClose: () => void;
}

const PCCProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  open,
  onClose,
}) => {
  if (!profile) return null;

  const p = profile;
  const personaColor = PERSONA_COLORS[p.persona.name] || '#64748b';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl">{p.persona.emoji}</span>
            <div>
              <div className="text-lg">{p.name}</div>
              <div className="text-sm text-muted-foreground font-normal">
                {p.company}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2">
              <Badge
                className="text-xs"
                style={{
                  backgroundColor: `${personaColor}15`,
                  color: personaColor,
                  borderColor: personaColor,
                }}
                variant="outline">
                {p.persona.name}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xs text-muted-foreground">Orders</div>
            <div className="text-lg font-bold font-mono">{p.totalOrders}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xs text-muted-foreground">Total Spent</div>
            <div className="text-lg font-bold font-mono text-green-600">
              {formatCurrency(p.totalSpent)}₫
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xs text-muted-foreground">Variety Score</div>
            <div className="text-lg font-bold font-mono text-blue-600">
              {p.varietyScore.toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xs text-muted-foreground">Tenure</div>
            <div className="text-lg font-bold font-mono">{p.tenureDays}d</div>
          </div>
        </div>

        {/* Persona Description */}
        <div className="mt-4 rounded-xl border p-4 bg-muted/30">
          <h4 className="text-sm font-semibold mb-2">Persona Analysis</h4>
          <p className="text-sm text-muted-foreground">
            {p.persona.description}
          </p>
        </div>

        {/* Recommendations */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
          <div className="space-y-2">
            {p.persona.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Category */}
        {p.topCategory && (
          <div className="mt-4 rounded-xl border p-4">
            <h4 className="text-sm font-semibold mb-2">
              Top Category: {p.topCategory}
            </h4>
            <Progress value={p.topCategoryPct || 0} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {(p.topCategoryPct || 0).toFixed(1)}% of orders
            </div>
          </div>
        )}

        {/* Top Foods */}
        {p.topFoods && p.topFoods.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Top Foods</h4>
            <div className="space-y-1">
              {p.topFoods.slice(0, 5).map((food, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                  <span className="truncate flex-1">{food.name}</span>
                  <span className="font-mono text-muted-foreground ml-2">
                    x{food.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Info */}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">First Order: </span>
            <span className="font-mono">
              {p.firstOrder
                ? new Date(p.firstOrder).toLocaleDateString('vi-VN')
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Order: </span>
            <span className="font-mono">
              {p.lastOrder
                ? new Date(p.lastOrder).toLocaleDateString('vi-VN')
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Unique Foods: </span>
            <span className="font-mono">{p.uniqueFoods}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg Price: </span>
            <span className="font-mono">{formatCurrency(p.avgPrice)}₫</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PCCProfileModal;
