import React from 'react';
import type { PlayerColor } from '../store/gameStore';

interface TokenProps {
  color: PlayerColor;
  className?: string;
  onClick?: () => void;
  highlight?: boolean;
}

export const TokenComponent: React.FC<TokenProps> = ({ color, className = '', onClick, highlight = false }) => {
  const baseClasses = 'rounded-full flex items-center justify-center transition-all duration-300';
  const colorClasses = {
    emerald: 'token-emerald',
    blue: 'token-blue',
    red: 'token-red',
    amber: 'token-amber',
  };

  return (
    <div
      onClick={onClick}
      className={`
        ${baseClasses} 
        ${colorClasses[color]} 
        ${onClick ? 'cursor-pointer hover:scale-110' : ''} 
        ${highlight ? 'ring-2 sm:ring-4 ring-white/70 animate-pulse z-10' : ''}
        ${className || 'w-4 h-4 sm:w-6 sm:h-6 md:w-8 md:h-8'}
      `}
    />
  );
};
