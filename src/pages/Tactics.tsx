import { getShortName } from '@/utils/formatName';
import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { calculateOverall } from '@/data/generator';
import { getMatchdayLineup, isPlayerAvailableForMatch } from '@/utils/lineup';
import type { Formation, Player, Position } from '@/types/game';
import { Save, AlertCircle } from 'lucide-react';

const FORMATIONS: Record<Formation, { pos: Position, x: number, y: number }[]> = {
  '4-4-2': [
    { pos: 'GK', x: 5, y: 50 }, 
    { pos: 'LB', x: 25, y: 15 }, { pos: 'CB', x: 20, y: 35 }, { pos: 'CB', x: 20, y: 65 }, { pos: 'RB', x: 25, y: 85 },
    { pos: 'LW', x: 50, y: 15 }, { pos: 'CM', x: 45, y: 40 }, { pos: 'CM', x: 45, y: 60 }, { pos: 'RW', x: 50, y: 85 },
    { pos: 'ST', x: 75, y: 35 }, { pos: 'ST', x: 75, y: 65 }
  ],
  '4-3-3': [
    { pos: 'GK', x: 5, y: 50 }, 
    { pos: 'LB', x: 25, y: 15 }, { pos: 'CB', x: 20, y: 35 }, { pos: 'CB', x: 20, y: 65 }, { pos: 'RB', x: 25, y: 85 },
    { pos: 'CM', x: 45, y: 25 }, { pos: 'DM', x: 40, y: 50 }, { pos: 'CM', x: 45, y: 75 },
    { pos: 'LW', x: 70, y: 15 }, { pos: 'ST', x: 80, y: 50 }, { pos: 'RW', x: 70, y: 85 }
  ],
  '4-2-3-1': [
    { pos: 'GK', x: 5, y: 50 }, 
    { pos: 'LB', x: 25, y: 15 }, { pos: 'CB', x: 20, y: 35 }, { pos: 'CB', x: 20, y: 65 }, { pos: 'RB', x: 25, y: 85 },
    { pos: 'DM', x: 40, y: 35 }, { pos: 'DM', x: 40, y: 65 },
    { pos: 'LW', x: 65, y: 15 }, { pos: 'AM', x: 60, y: 50 }, { pos: 'RW', x: 65, y: 85 },
    { pos: 'ST', x: 80, y: 50 }
  ],
};

// Mevki Uyum Haritası (1 = Tam Uyum, 0.5 = Yedek Mevki, 0 = Alakasız)
const POSITION_FAMILIARITY: Record<Position, Partial<Record<Position, number>>> = {
  GK: { GK: 1 },
  CB: { CB: 1, DM: 0.8, LB: 0.6, RB: 0.6 },
  LB: { LB: 1, LW: 0.8, CB: 0.6, DM: 0.4 },
  RB: { RB: 1, RW: 0.8, CB: 0.6, DM: 0.4 },
  DM: { DM: 1, CM: 0.9, CB: 0.8 },
  CM: { CM: 1, DM: 0.8, AM: 0.8 },
  AM: { AM: 1, CM: 0.8, LW: 0.7, RW: 0.7, ST: 0.6 },
  LW: { LW: 1, AM: 0.8, ST: 0.7, LB: 0.5 },
  RW: { RW: 1, AM: 0.8, ST: 0.7, RB: 0.5 },
  ST: { ST: 1, AM: 0.6, LW: 0.5, RW: 0.5 },
};

// Oyuncunun sahada oynadığı yüzdelik konuma göre (x,y) tahmini mevki bulma
function getPositionFromCoords(x: number, y: number): Position {
  if (x < 15) return 'GK';
  if (x < 35) {
    if (y < 30) return 'LB';
    if (y > 70) return 'RB';
    return 'CB';
  }
  if (x < 60) {
    if (y < 25) return 'LW';
    if (y > 75) return 'RW';
    if (x < 45) return 'DM';
    return 'CM';
  }
  if (x < 80) {
    if (y < 30) return 'AM'; // Sol kanat gibi
    if (y > 70) return 'AM'; // Sağ kanat gibi
    return 'AM';
  }
  return 'ST';
}

// Uyum Skorunu Hesapla (0 - 100)
function getFamiliarityScore(playerPos: Position, slotPos: Position, altPositions: Position[]): number {
  if (playerPos === slotPos) return 100; // Tam uyum
  if (altPositions.includes(slotPos)) return 80; // Yedek mevki

  const baseScore = POSITION_FAMILIARITY[playerPos]?.[slotPos] ?? 0;
  return Math.round(baseScore * 100);
}

export function Tactics() {
  const { teams, myTeamId, day } = useGameStore();
  const myTeam = myTeamId ? teams[myTeamId] : null;
  
  const pitchRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [positions, setPositions] = useState<{ x: number, y: number }[]>([]);

  useEffect(() => {
    if (!myTeam) return;
    const formation = myTeam.tactics.formation || '4-4-2';
    if (myTeam.tactics.customPositions && myTeam.tactics.customPositions.length === 11) {
      setPositions(myTeam.tactics.customPositions);
    } else {
      setPositions(FORMATIONS[formation].map(s => ({ x: s.x, y: s.y })));
    }
  }, [myTeam?.tactics.formation]);

  const formation = myTeam?.tactics.formation || '4-4-2';
  const matchdayLineup = myTeam ? getMatchdayLineup(myTeam, day) : [];
  const startingXI = myTeam ? matchdayLineup.map(id => myTeam.players.find(p => p.id === id)).filter(Boolean) as Player[] : [];
  const bench = myTeam ? myTeam.players
    .filter(player => isPlayerAvailableForMatch(player, day) && !matchdayLineup.includes(player.id))
    .sort((a, b) => calculateOverall(b) - calculateOverall(a))
    .slice(0, 7) : [];

  useEffect(() => {
    if (!myTeam || !myTeamId || matchdayLineup.length !== 11 || matchdayLineup.join('|') === myTeam.tactics.lineup.join('|')) return;
    if (matchdayLineup.length === 11 && matchdayLineup.join('|') !== myTeam.tactics.lineup.join('|')) {
      useGameStore.setState(state => {
        if (!myTeamId) return state;
        const currentTeam = state.teams[myTeamId];
        if (!currentTeam) return state;
        return {
          teams: {
            ...state.teams,
            [myTeamId]: {
              ...currentTeam,
              tactics: { ...currentTeam.tactics, lineup: matchdayLineup },
            },
          },
        };
      });
    }
  }, [myTeam, myTeamId, day]);

  if (!myTeam) return <div className="p-6 text-slate-400">Takım bulunamadı.</div>;

  // --- SAHA İÇİ SÜRÜKLEME ---
  const handlePitchPointerDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    setDraggingIndex(index);
    
    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!pitchRef.current) return;
      const rect = pitchRef.current.getBoundingClientRect();
      let x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      let y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      x = Math.max(2, Math.min(98, x));
      y = Math.max(2, Math.min(98, y));
      setPositions(prev => {
        const newPos = [...prev];
        newPos[index] = { x, y };
        return newPos;
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      
      if (pitchRef.current) {
        const rect = pitchRef.current.getBoundingClientRect();
        const dropX = ((upEvent.clientX - rect.left) / rect.width) * 100;
        const dropY = ((upEvent.clientY - rect.top) / rect.height) * 100;

        let closestIndex = -1;
        let minDistance = 8;

        positions.forEach((pos, i) => {
          if (i === index) return;
          const dist = Math.hypot(pos.x - dropX, pos.y - dropY);
          if (dist < minDistance) {
            minDistance = dist;
            closestIndex = i;
          }
        });

        if (closestIndex !== -1) {
          const newPositions = [...positions];
          const temp = newPositions[index];
          newPositions[index] = newPositions[closestIndex];
          newPositions[closestIndex] = temp;
          setPositions(newPositions);
          updateStore(newPositions);
        } else {
          updateStore(positions);
        }
      }
      setDraggingIndex(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // --- YEDEKTEN SAHAYA SÜRÜKLEME ---
  const handleBenchDragStart = (e: React.DragEvent, benchPlayerId: string) => {
    const player = myTeam.players.find(item => item.id === benchPlayerId);
    if (!player || !isPlayerAvailableForMatch(player, day)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('benchPlayerId', benchPlayerId);
  };

  const handlePitchDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handlePitchDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const benchPlayerId = e.dataTransfer.getData('benchPlayerId');
    if (!benchPlayerId) return;

    const incomingPlayer = myTeam.players.find(player => player.id === benchPlayerId);
    if (!incomingPlayer || !isPlayerAvailableForMatch(incomingPlayer, day)) {
      alert('Sakatlığı devam eden oyuncu ilk 11’e alınamaz.');
      return;
    }

    const currentLineup = [...matchdayLineup];
    const playerToRemoveId = currentLineup[targetIndex];
    if (!playerToRemoveId || currentLineup.includes(benchPlayerId)) return;

    currentLineup[targetIndex] = benchPlayerId;

    useGameStore.setState((state) => {
      const newTeams = { ...state.teams };
      if (myTeamId) {
        newTeams[myTeamId].tactics.lineup = currentLineup;
      }
      return { teams: newTeams };
    });
  };

  const updateStore = (newPositions: { x: number, y: number }[]) => {
    useGameStore.setState((state) => {
      const newTeams = { ...state.teams };
      if (myTeamId) {
        newTeams[myTeamId].tactics.customPositions = newPositions;
      }
      return { teams: newTeams };
    });
  };

  const handleFormationChange = (newFormation: Formation) => {
    setPositions(FORMATIONS[newFormation].map(s => ({ x: s.x, y: s.y })));
    useGameStore.setState((state) => {
      const newTeams = { ...state.teams };
      if (myTeamId) {
        newTeams[myTeamId].tactics.formation = newFormation;
        newTeams[myTeamId].tactics.customPositions = undefined;
      }
      return { teams: newTeams };
    });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto h-screen flex flex-col">
      <header className="flex justify-between items-end mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold">Taktikler</h2>
          <p className="text-slate-400 text-sm">Sürükle-bırak ile dizilişi değiştir veya oyuncu değiştir</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={formation}
            onChange={(e) => handleFormationChange(e.target.value as Formation)}
            className="bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
          >
            <option value="4-4-2">4-4-2</option>
            <option value="4-3-3">4-3-3</option>
            <option value="4-2-3-1">4-2-3-1</option>
          </select>
          <span title="Taktik değişiklikleri otomatik kaydedilir" className="text-xs text-emerald-400 px-2 py-2 flex items-center gap-2">
            <Save className="w-4 h-4" /> Otomatik Kaydediliyor
          </span>
        </div>
      </header>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 bg-emerald-950 rounded-xl overflow-hidden relative shadow-2xl border border-emerald-900/50 flex items-center justify-center p-4">
          <div ref={pitchRef} className="relative w-full max-w-4xl aspect-[4/3] bg-emerald-800/20 shadow-inner overflow-hidden select-none">
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-emerald-800/30' : 'bg-emerald-900/30'}`} />
              ))}
            </div>

            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-white/20" fill="none" strokeWidth="2" preserveAspectRatio="none">
              <rect x="2%" y="2%" width="96%" height="96%" />
              <line x1="50%" y1="2%" x2="50%" y2="98%" />
              <circle cx="50%" cy="50%" r="12%" />
              <rect x="2%" y="20%" width="14%" height="60%" />
              <rect x="2%" y="35%" width="5%" height="30%" />
              <rect x="84%" y="20%" width="14%" height="60%" />
              <rect x="93%" y="35%" width="5%" height="30%" />
            </svg>

            <div className="relative w-full h-full">
              {startingXI.map((player, i) => {
                const pos = positions[i] || { x: 50, y: 50 };
                const isDragging = draggingIndex === i;
                
                // Oyuncunun o an bulunduğu noktanın mevkisi
                const estimatedSlotPos = getPositionFromCoords(pos.x, pos.y);
                const familiarity = getFamiliarityScore(player.position, estimatedSlotPos, player.altPositions);

                // Rengine Karar Ver (0-100 Skor)
                let ringColor = 'ring-red-500 bg-red-900/50 text-red-400 border-red-500';
                if (familiarity >= 90) ringColor = 'ring-emerald-500 bg-emerald-900/50 text-emerald-400 border-emerald-500';
                else if (familiarity >= 70) ringColor = 'ring-amber-500 bg-amber-900/50 text-amber-400 border-amber-500';
                else if (familiarity >= 40) ringColor = 'ring-orange-500 bg-orange-900/50 text-orange-400 border-orange-500';

                if (isDragging) ringColor = 'bg-amber-500 border-white text-slate-950 scale-110 shadow-amber-500/50';

                return (
                  <div
                    key={player.id}
                    onPointerDown={(e) => handlePitchPointerDown(e, i)}
                    onDragOver={(e) => handlePitchDragOver(e)}
                    onDrop={(e) => handlePitchDrop(e, i)}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-transform ${
                      isDragging ? 'z-50 cursor-grabbing' : 'z-10 cursor-grab hover:scale-110'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 transition-colors ${ringColor}`}>
                      {calculateOverall(player)}
                    </div>
                    <span className={`mt-1 px-2 py-0.5 bg-slate-950/80 text-[10px] font-bold rounded whitespace-nowrap border shadow max-w-[104px] truncate ${
                      familiarity >= 90 ? 'text-emerald-300 border-emerald-800' : familiarity >= 70 ? 'text-amber-300 border-amber-800' : 'text-red-300 border-red-800'
                    }`}>
                      {getShortName(player.name, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="w-80 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col flex-1 min-h-0">
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-300">Yedek Kulübesi</h3>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {bench.map((player) => (
                <div 
                  key={player.id} 
                  draggable
                  onDragStart={(e) => handleBenchDragStart(e, player.id)}
                  className="flex items-center justify-between p-2 rounded cursor-grab active:cursor-grabbing transition-colors hover:bg-slate-800 border border-transparent hover:border-slate-600"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 w-6">{player.position}</span>
                    <span className="text-sm text-slate-200 truncate max-w-[170px]" title={player.name}>{getShortName(player.name, 18)}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-500 bg-slate-950 px-1.5 py-0.5 rounded">
                    {calculateOverall(player)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-400 flex items-start gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Yedekteki bir oyuncuyu sahaya sürükleyip bırakarak ilk 11'i değiştirebilirsin.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
