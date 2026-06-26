import React from 'react';
import { useGameStore } from '../store/gameStore';
import type { PlayerColor } from '../store/gameStore';
import { TokenComponent } from './Token';
import { Dice3 } from 'lucide-react';

// Pre-calculated coordinates for a 15x15 grid
const generateTrackCoords = () => {
  const coords: { x: number; y: number }[] = [];
  // Starting from top-left (Emerald start)
  // Down 6
  for (let i = 1; i <= 5; i++) coords.push({ x: 6, y: i });
  // Left 6
  for (let i = 5; i >= 0; i--) coords.push({ x: i, y: 6 });
  // Down 2 (Red start is at 13 in our model, wait, let's just map carefully)
  coords.push({ x: 0, y: 7 });
  coords.push({ x: 0, y: 8 });
  // Right 6
  for (let i = 1; i <= 5; i++) coords.push({ x: i, y: 8 });
  // Down 6
  for (let i = 9; i <= 14; i++) coords.push({ x: 6, y: i });
  // Right 2
  coords.push({ x: 7, y: 14 });
  coords.push({ x: 8, y: 14 });
  // Up 6
  for (let i = 13; i >= 9; i--) coords.push({ x: 8, y: i });
  // Right 6
  for (let i = 9; i <= 14; i++) coords.push({ x: i, y: 8 });
  // Up 2
  coords.push({ x: 14, y: 7 });
  coords.push({ x: 14, y: 6 });
  // Left 6
  for (let i = 13; i >= 9; i--) coords.push({ x: i, y: 6 });
  // Up 6
  for (let i = 5; i >= 0; i--) coords.push({ x: 8, y: i });
  // Left 2
  coords.push({ x: 7, y: 0 });
  coords.push({ x: 6, y: 0 });
  return coords;
};

const TRACK_COORDS = generateTrackCoords(); // Should be 52

const HOME_PATHS: Record<PlayerColor, { x: number; y: number }[]> = {
  emerald: Array.from({ length: 5 }, (_, i) => ({ x: 7, y: i + 1 })), // Top down
  red: Array.from({ length: 5 }, (_, i) => ({ x: i + 1, y: 7 })), // Left right
  blue: Array.from({ length: 5 }, (_, i) => ({ x: 7, y: 13 - i })), // Bottom up
  amber: Array.from({ length: 5 }, (_, i) => ({ x: 13 - i, y: 7 })), // Right left
};

const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];



export const GameBoard: React.FC<{ playerColor: PlayerColor }> = ({ playerColor }) => {
  const { tokens, currentTurn, diceRoll, rollDice, moveToken, consecutiveSixes } = useGameStore();

  return (
    <div className="flex flex-col items-center justify-center gap-8 p-4">
      
      {/* Game Header */}
      <div className="glass-panel p-4 flex gap-8 items-center">
        <div className="flex flex-col items-center">
          <span className="text-sm text-slate-400">Current Turn</span>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-4 h-4 rounded-full bg-${currentTurn}-500 shadow-[0_0_10px_rgba(255,255,255,0.5)]`} />
            <span className="font-bold capitalize">{currentTurn}</span>
          </div>
        </div>

        <div className="h-10 w-px bg-white/20" />

        <div className="flex flex-col items-center">
          <span className="text-sm text-slate-400">Dice Roll</span>
          <div className="font-bold text-2xl w-8 h-8 flex items-center justify-center bg-white/10 rounded-md">
            {diceRoll || '-'}
          </div>
          {consecutiveSixes > 0 && (
            <span className="text-xs text-red-400 absolute -bottom-4">Consecutive 6s: {consecutiveSixes}</span>
          )}
        </div>

        <button 
          onClick={rollDice}
          disabled={currentTurn !== playerColor || diceRoll !== null}
          className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2"
        >
          <Dice3 size={20} />
          Roll Dice
        </button>
      </div>

      {/* Board */}
      <div className="relative bg-white/5 border border-white/20 p-2 rounded-2xl shadow-2xl backdrop-blur-sm">
        <div 
          className="grid gap-[2px] bg-slate-900/50 p-[2px] rounded-xl"
          style={{ 
            gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
            width: '600px',
            height: '600px'
          }}
        >
          {/* Base Areas */}
          <BaseArea color="emerald" x={0} y={0} tokens={tokens} playerColor={playerColor} onMove={moveToken} />
          <BaseArea color="amber" x={9} y={0} tokens={tokens} playerColor={playerColor} onMove={moveToken} />
          <BaseArea color="red" x={0} y={9} tokens={tokens} playerColor={playerColor} onMove={moveToken} />
          <BaseArea color="blue" x={9} y={9} tokens={tokens} playerColor={playerColor} onMove={moveToken} />

          {/* Track Squares */}
          {TRACK_COORDS.map((coord, idx) => {
            const isSafe = SAFE_ZONES.includes(idx);
            const ts = tokens.filter(t => t.state === 'track' && t.position === idx);
            
            return (
              <div 
                key={`track-${idx}`} 
                className={`relative flex items-center justify-center border border-white/10 ${isSafe ? 'bg-white/10' : 'bg-transparent'}`}
                style={{ gridColumn: coord.x + 1, gridRow: coord.y + 1 }}
              >
                {isSafe && <div className="absolute inset-2 border border-white/20 rotate-45" />}
                <div className="flex flex-wrap items-center justify-center gap-1 w-full h-full p-1 z-10">
                  {ts.map(t => (
                    <TokenComponent 
                      key={t.id} 
                      color={t.color} 
                      className="w-4 h-4" 
                      onClick={() => currentTurn === playerColor && t.color === playerColor && moveToken(t.id, t.color)}
                      highlight={currentTurn === playerColor && t.color === playerColor}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Home Paths */}
          {Object.entries(HOME_PATHS).map(([color, coords]) => (
            coords.map((coord, idx) => {
              const ts = tokens.filter(t => t.color === color && t.state === 'homePath' && t.position === idx);
              return (
                <div 
                  key={`home-${color}-${idx}`} 
                  className={`bg-${color}-500/20 border border-${color}-500/30 flex items-center justify-center`}
                  style={{ gridColumn: coord.x + 1, gridRow: coord.y + 1 }}
                >
                  {ts.map(t => (
                    <TokenComponent 
                      key={t.id} 
                      color={t.color} 
                      className="w-5 h-5" 
                      onClick={() => currentTurn === playerColor && t.color === playerColor && moveToken(t.id, t.color)}
                      highlight={currentTurn === playerColor && t.color === playerColor}
                    />
                  ))}
                </div>
              )
            })
          ))}

          {/* Center Goal */}
          <div className="col-start-7 col-end-10 row-start-7 row-end-10 relative">
             <div className="absolute inset-0 border-[24px] border-transparent border-t-emerald-500/50 border-r-amber-500/50 border-b-blue-500/50 border-l-red-500/50" />
             <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 p-2">
                {tokens.filter(t => t.state === 'goal').map(t => (
                  <TokenComponent key={`${t.color}-${t.id}`} color={t.color} className="w-4 h-4 opacity-50" />
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BaseArea: React.FC<{ color: PlayerColor, x: number, y: number, tokens: any[], playerColor: PlayerColor, onMove: any }> = ({ color, x, y, tokens, playerColor, onMove }) => {
  const baseTokens = tokens.filter(t => t.color === color && t.state === 'base');
  const { currentTurn, diceRoll } = useGameStore();
  
  return (
    <div 
      className={`border-4 border-${color}-500/50 bg-${color}-500/10 p-4 flex flex-wrap gap-4 items-center justify-center`}
      style={{ gridColumn: `${x + 1} / span 6`, gridRow: `${y + 1} / span 6` }}
    >
      {baseTokens.map(t => (
        <div key={t.id} className={`w-12 h-12 rounded-full border-4 border-white/10 flex items-center justify-center bg-black/20`}>
          <TokenComponent 
            color={color} 
            onClick={() => currentTurn === playerColor && color === playerColor && onMove(t.id, color)} 
            highlight={currentTurn === playerColor && color === playerColor && diceRoll === 6}
          />
        </div>
      ))}
      {Array.from({ length: 4 - baseTokens.length }).map((_, i) => (
        <div key={`empty-${i}`} className={`w-12 h-12 rounded-full border-4 border-white/5 flex items-center justify-center bg-black/20`} />
      ))}
    </div>
  );
};
