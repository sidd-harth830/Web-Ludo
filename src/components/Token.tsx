import React from 'react';
import type { PlayerColor } from '../store/gameStore';

interface TokenProps {
  color: PlayerColor;
  className?: string;
  onClick?: () => void;
  highlight?: boolean;
}

export const TokenComponent: React.FC<TokenProps> = ({ color, className = '', onClick, highlight = false }) => {
  const baseClasses = 'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300';
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
        ${highlight ? 'ring-4 ring-white animate-pulse z-10' : ''}
        ${className}
      `}
    >
      <div className="w-4 h-4 rounded-full bg-white/30 backdrop-blur-sm" />
    </div>
  );
};
