import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { PlayerColor } from '../store/gameStore';
import { TokenComponent } from './Token';
import { Dice3, Star, User } from 'lucide-react';

const generateTrackCoords = () => {
  const coords: { x: number; y: number }[] = [];
  // Left arm, top row (left to right)
  for (let i = 0; i <= 5; i++) coords.push({ x: i, y: 6 });
  // Top arm, left column (bottom to top)
  for (let i = 5; i >= 0; i--) coords.push({ x: 6, y: i });
  // Top arm, top center
  coords.push({ x: 7, y: 0 });
  // Top arm, right column (top to bottom)
  for (let i = 0; i <= 5; i++) coords.push({ x: 8, y: i });
  // Right arm, top row (left to right)
  for (let i = 9; i <= 14; i++) coords.push({ x: i, y: 6 });
  // Right arm, right center
  coords.push({ x: 14, y: 7 });
  // Right arm, bottom row (right to left)
  for (let i = 14; i >= 9; i--) coords.push({ x: i, y: 8 });
  // Bottom arm, right column (top to bottom)
  for (let i = 9; i <= 14; i++) coords.push({ x: 8, y: i });
  // Bottom arm, bottom center
  coords.push({ x: 7, y: 14 });
  // Bottom arm, left column (bottom to top)
  for (let i = 14; i >= 9; i--) coords.push({ x: 6, y: i });
  // Left arm, bottom row (right to left)
  for (let i = 5; i >= 0; i--) coords.push({ x: i, y: 8 });
  // Left arm, left center
  coords.push({ x: 0, y: 7 });
  return coords;
};

const TRACK_COORDS = generateTrackCoords();

const HOME_PATHS: Record<PlayerColor, { x: number; y: number }[]> = {
  emerald: Array.from({ length: 5 }, (_, i) => ({ x: i + 1, y: 7 })),
  amber: Array.from({ length: 5 }, (_, i) => ({ x: 7, y: i + 1 })),
  blue: Array.from({ length: 5 }, (_, i) => ({ x: 13 - i, y: 7 })),
  red: Array.from({ length: 5 }, (_, i) => ({ x: 7, y: 13 - i })),
};

const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

export const GameBoard: React.FC<{ playerColor: PlayerColor; colorNames: Record<string, string> }> = ({ playerColor, colorNames }) => {
  const { tokens, currentTurn, diceRoll, rollDice, moveToken } = useGameStore();
  const [isRolling, setIsRolling] = useState(false);

  const handleRoll = () => {
    setIsRolling(true);
    rollDice();
    setTimeout(() => setIsRolling(false), 1500); // 1.5s debounce rate limit
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full h-full min-h-0 min-w-0">
      
      {/* Game Header */}
      <div className="glass-panel p-3 flex gap-4 items-center justify-between w-full max-w-md shrink-0 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">Current Turn</span>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`w-3 h-3 rounded-full bg-${currentTurn}-500 shadow-sm`} />
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
              <User size={14} className="opacity-70" /> {colorNames[currentTurn] || currentTurn}
            </span>
          </div>
        </div>

        <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div className="flex flex-col items-center relative">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">Dice Roll</span>
          <div className="font-bold text-lg w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 mt-0.5">
            {diceRoll || '-'}
          </div>
        </div>

        <button 
          onClick={handleRoll}
          disabled={currentTurn !== playerColor || diceRoll !== null || isRolling}
          className="bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-md font-semibold transition-colors flex items-center gap-2 text-sm shadow-sm"
        >
          <Dice3 size={16} />
          Roll
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center overflow-hidden">
        <div 
          className="relative glass-panel p-1.5 shadow-sm mx-auto bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          style={{ 
            width: '100%', 
            maxWidth: 'min(100%, 75vh)', // Strictly prevents vertical overflow
            aspectRatio: '1 / 1'
          }}
        >
          <div 
            className="grid gap-0 bg-zinc-200 dark:bg-zinc-800 p-1 rounded-lg w-full h-full"
            style={{ 
              gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(15, minmax(0, 1fr))'
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
                className={`relative flex items-center justify-center border-[0.5px] border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950`}
                style={{ gridColumn: coord.x + 1, gridRow: coord.y + 1 }}
              >
                {isSafe && <Star className="absolute w-1/2 h-1/2 text-zinc-300 dark:text-zinc-700 opacity-50" fill="currentColor" />}
                <div className="relative w-full h-full">
                  {ts.map((t, idx) => (
                    <div 
                      key={t.id} 
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        transform: ts.length > 1 ? `translate(calc(${idx} * 4px), calc(${idx} * -4px))` : 'none',
                        zIndex: idx
                      }}
                    >
                      <TokenComponent 
                        color={t.color} 
                        className={ts.length > 1 ? "w-4 h-4 sm:w-5 sm:h-5 shadow-sm ring-1 ring-white/50" : "w-4 h-4 sm:w-6 sm:h-6"} 
                        onClick={() => currentTurn === playerColor && t.color === playerColor && moveToken(t.id, t.color)}
                        highlight={currentTurn === playerColor && t.color === playerColor}
                      />
                    </div>
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
                  className={`border-[0.5px] border-black/10 dark:border-white/10 flex items-center justify-center bg-${color}-500/80`}
                  style={{ gridColumn: coord.x + 1, gridRow: coord.y + 1 }}
                >
                  <div className="relative w-full h-full">
                    {ts.map((t, index) => (
                      <div 
                        key={t.id} 
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          transform: ts.length > 1 ? `translate(calc(${index} * 4px), calc(${index} * -4px))` : 'none',
                          zIndex: index
                        }}
                      >
                        <TokenComponent 
                          color={t.color} 
                          className="w-4 h-4 sm:w-6 sm:h-6" 
                          onClick={() => currentTurn === playerColor && t.color === playerColor && moveToken(t.id, t.color)}
                          highlight={currentTurn === playerColor && t.color === playerColor}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          ))}

          {/* Center Goal */}
          <div className="col-start-7 col-end-10 row-start-7 row-end-10 relative overflow-hidden bg-zinc-100 dark:bg-zinc-900">
             <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full preserve-3d" preserveAspectRatio="none">
                <polygon points="0,0 100,0 50,50" fill="#10b981" /> {/* top emerald */}
                <polygon points="100,0 100,100 50,50" fill="#f59e0b" /> {/* right amber */}
                <polygon points="0,100 100,100 50,50" fill="#3b82f6" /> {/* bottom blue */}
                <polygon points="0,0 0,100 50,50" fill="#ef4444" /> {/* left red */}
             </svg>
             <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 p-2">
                {tokens.filter(t => t.state === 'goal').map(t => (
                  <TokenComponent key={`${t.color}-${t.id}`} color={t.color} className="w-3 h-3 sm:w-4 sm:h-4 opacity-90" />
                ))}
             </div>
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
      className={`bg-${color}-500 relative flex items-center justify-center border-4 border-${color}-600 dark:border-${color}-400/80 shadow-inner`}
      style={{ gridColumn: `${x + 1} / span 6`, gridRow: `${y + 1} / span 6` }}
    >
        <div className={`bg-white dark:bg-zinc-900 w-[70%] h-[70%] rounded-xl p-2 sm:p-4 shadow-sm flex items-center justify-center`}>
           <div className="grid grid-cols-2 grid-rows-2 gap-3 place-items-center w-full h-full">
              {baseTokens.map(t => (
                <div key={t.id} className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-4 border-${color}-500/30 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800`}>
                  <TokenComponent 
                    color={color} 
                    onClick={() => currentTurn === playerColor && color === playerColor && onMove(t.id, color)} 
                    highlight={currentTurn === playerColor && color === playerColor && diceRoll === 6}
                    className="w-full h-full cursor-pointer"
                  />
                </div>
              ))}
              {Array.from({ length: 4 - baseTokens.length }).map((_, i) => (
                <div key={`empty-${i}`} className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-4 border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50 opacity-50`} />
              ))}
           </div>
        </div>
    </div>
  );
};
