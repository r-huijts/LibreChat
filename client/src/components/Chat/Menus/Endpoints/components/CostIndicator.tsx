import React from 'react';
import { cn } from '~/utils';

interface CostIndicatorProps {
  costLevel?: 'low' | 'medium' | 'high';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CostIndicator({ costLevel, className, size = 'md' }: CostIndicatorProps) {
  if (!costLevel) return null;

  const getCostSymbol = () => {
    switch (costLevel) {
      case 'low':
        return '€';
      case 'medium':
        return '€€';
      case 'high':
        return '€€€';
      default:
        return '';
    }
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-end font-semibold leading-none tracking-tight text-black dark:text-white',
        sizeClasses[size],
        className,
      )}
      title={`Cost: ${costLevel}`}
    >
      {getCostSymbol()}
    </span>
  );
}

