import React, { useState } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface CompatibilityBadgeProps {
  score?: number;
  highlights?: string[];
  size?: 'sm' | 'md' | 'lg';
}

export const CompatibilityBadge: React.FC<CompatibilityBadgeProps> = ({
  score = 80,
  highlights = ['Age compatible', 'Education match', 'Location match'],
  size = 'md',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Color scheme based on score
  const getColorClasses = (sc: number) => {
    if (sc >= 85) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (sc >= 70) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-bold',
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold border shadow-sm transition hover:scale-105 ${getColorClasses(
          score
        )} ${sizeClasses[size]}`}
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        <span>{score}% Match</span>
      </button>

      {/* Tooltip Hover Breakdown */}
      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-2 w-56 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl z-30 pointer-events-none animate-fadeIn border border-slate-700">
          <div className="font-semibold text-amber-300 pb-1 mb-1.5 border-b border-slate-700 flex items-center justify-between">
            <span>Match Compatibility</span>
            <span className="text-emerald-400 font-bold">{score}%</span>
          </div>
          <div className="space-y-1">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

