'use client';

import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className = '' }: StatCardProps) {
  return (
    <div className={`bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/50 text-sm">{title}</span>
        <Icon className="w-4 h-4 text-white/30" />
      </div>
      <div className="text-2xl font-semibold text-white/90">{value}</div>
      {trend && (
        <div className={`text-xs mt-1 ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
        </div>
      )}
    </div>
  );
}
