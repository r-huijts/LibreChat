import React from 'react';
import { cn } from '~/utils';

interface CountryFlagProps {
  countryCode?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CountryFlag({ countryCode, className, size = 'md' }: CountryFlagProps) {
  if (!countryCode || countryCode.length !== 2) return null;

  const sizeClasses = {
    sm: 'w-4 h-3',
    md: 'w-5 h-4',
    lg: 'w-6 h-5',
  };

  return (
    <span
      className={cn(
        'fi',
        `fi-${countryCode.toLowerCase()}`,
        'inline-flex items-center justify-center rounded-sm overflow-hidden',
        sizeClasses[size],
        className,
      )}
      title={`Country: ${countryCode.toUpperCase()}`}
      role="img"
      aria-label={`${countryCode.toUpperCase()} flag`}
    />
  );
}

