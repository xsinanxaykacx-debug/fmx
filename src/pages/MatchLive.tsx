import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { simulateMatch } from '@/engine/matchEngine';
import type { MatchEvent, MatchFixture, Player, Formation } from '@/types/game';
import { Play, Pause, ArrowLeft, Trophy, AlertTriangle } from 'lucide-react';

const DEFAULT_FORMATIONS: Record<Formation, { x: number, y: number }[]> = {
  '4-4-2': [
    { x: 5, y: 50 }, { x: 25, y: 15 }, { x: 20, y: 35 }, { x: 20, y: 65 }, { x: 25, y: 85 },
    { x: 50, y: 15 }, { x: 45, y: 40 }, { x: 45, y: 60 }, { x: 50, y: 85 }, { x: 75, y: 35 }, { x: 75, y: 65 }
  ],
  '4-3-3': [
    { x: 5, y: 50 }, { x: 25, y: 15 }, { x: 20, y: 35 }, { x: 20, y: 65 }, { x: 25, y: 85 },
    { x: 45, y: 25 }, { x: 40, y: 50 }, { x: 45, y: 75 }, { x: 70, y: 15 }, { x: 80, y: 50 }, { x: 70, y: 85 }
  ],
  '4-2-3-1': [
    { x: 5, y: 50 }, { x: 25, y: 15 }, { x: 20, y: 35 }, { x: 20, y: 65 }, { x: 25, y: 85 },
    { x: 40, y: 35 }, { x: 40, y: 65 }, { x: 65, y: 15 }, { x: 60, y: 50 }, { x: 65, y: 85 }, { x: 80, y: 50 }
  ],
};

export function MatchLive({ fixture, onFinish }: { fixture: MatchFixture; onFinish: () => void }) {
  const { teams, myTeamId } = useGameStore();
  const homeTeam = teams[fixture.homeTeamId];
  const awayTeam = teams[fixture.awayTeamId];
  
  const isUserMatch = myTeamId === homeTeam.id || myTeamId === awayTeam.id;
  const userTeam = myTeamId === homeTeam.id ? homeTeam : myTeamId === awayTeam.id ? awayTeam : null;

  const [minute, setMinute] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isHalfTime, setIsHalfTime] = useState(false);

  const [subbedOut, setSubbedOut] = useState<Set<string>>(new Set()); 
  const [subsCount, setSubsCount] = useState(0);
  
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [localPositions, setLocalPositions] = useState<{ x: number, y: number }[]>([]);
  const [injuredPlayerOnPitch, setInjuredPlayerOnPitch] = useState<string | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const allEventsRef = useRef<MatchEvent[]>([]);
  const fullResultRef = useRef<ReturnType<typeof simulateMatch> | null>(null);
  const matchInitializedRef = useRef(false);
  const matchSavedRef = useRef<boolean>(false);

  // Skoru olaylardan hesapla
  const homeScore = visibleEvents.filter(e => e.type === 'goal' && e.teamId === homeTeam?.id).length;
  const awayScore = visibleEvents.filter(e => e.type === 'goal' && e.teamId === awayTeam?.id).length;

  useEffect(() => {
    if (!userTeam) return;
    const formation = userTeam.tactics.formation || '4-4-2';
    if (userTeam.tactics.customPositions && userTeam.tactics.customPositions.length === 11) {
      setLocalPositions(userTeam.tactics.customPositions);
    } else {
      setLocalPositions(DEFAULT_FORMATIONS[formation]);
    }
  }, [userTeam?.tactics.formation, userTeam?.tactics.customPositions]);

  useEffect(() => {
    if (!homeTeam || !awayTeam || matchInitializedRef.current) return;
    const result = simulateMatch(homeTeam, awayTeam);
    fullResultRef.current = result;
    allEventsRef.current = result.events;
    matchInitializedRef.current = true;
  }, [homeTeam, awayTeam]);

  // Zamanlayıcı
  useEffect(() => {
    if (!isPlaying || isFinished || isHalfTime) return;
    if (!fullResultRef.current) return;

    const interval = setInterval(() => {
      setMinute(m => {
        const nextMinute = m + 1;
        
        const eventsAtMinute = allEventsRef.current.filter(e => e.minute === nextMinute);
        const injuryEvent = eventsAtMinute.find(e => e.type === 'injury' && e.teamId === myTeamId);

        if (injuryEvent && injuryEvent.playerId) {
          if (subsCount < 3) {
            setIsPlaying(false);
            setInjuredPlayerOnPitch(injuryEvent.playerId);
            alert(`Sakatlık! ${userTeam?.players.find(p => p.id === injuryEvent.playerId)?.name} oyuna devam edemiyor. Yerine birini almalısın!`);
          } else {
            alert(`Sakatlanan oyuncu oyuna devam edemiyor. Değişiklik hakkın kalmadığı için takım 10 kişi devam edecek.`);
          }
        }

        if (nextMinute === 45) { setIsPlaying(false); setIsHalfTime(true); return 45; }
        if (nextMinute > 90) { setIsPlaying(false); setIsFinished(true); return 90; }
        return nextMinute;
      });
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, isFinished, isHalfTime, myTeamId, userTeam, subsCount]);

  // Olayları güncelle
  useEffect(() => {
    if (minute === 0) {
      setVisibleEvents([]);
      return;
    }
    const eventsUpToMinute = allEventsRef.current.filter(e => e.minute <= minute);
    setVisibleEvents(eventsUpToMinute);
  }, [minute]);

  // Maç bitince store'a kaydet (Skoru son olaylardan hesapla)
  useEffect(() => {
    if (isFinished && fullResultRef.current) {
      const allEvents = fullResultRef.current.events;
      const finalHomeScore = allEvents.filter(e => e.type === 'goal' && e.teamId === homeTeam?.id).length;
      const finalAwayScore = allEvents.filter(e => e.type === 'goal' && e.teamId === awayTeam?.id).length;

      if (!matchSavedRef.current) {
        matchSavedRef.current = true;
        useGameStore.getState().playMatch(fixture, allEvents, finalHomeScore, finalAwayScore);
      }
    }
  }, [isFinished, fixture, homeTeam?.id, awayTeam?.id]);

  const handleStartSecondHalf = () => { setIsHalfTime(false); setIsPlaying(true); };

  if (!homeTeam || !awayTeam) return <div className="p-6">Takım verisi yok.</div>;

  const removedPlayerIds = new Set<string>();
  visibleEvents.forEach(ev => {
    if ((ev.type === 'red' || ev.type === 'injury') && ev.teamId === myTeamId && ev.playerId) {
      removedPlayerIds.add(ev.playerId);
    }
  });

    const userBench = userTeam ? userTeam.players.filter(p => 
    !userTeam.tactics.lineup.includes(p.id) && 
    !subbedOut.has(p.id) && 
    p.injuredUntilDay == null
  ) : [];

  // Sürükleme
  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (!userTeam || !myTeamId) return;
    e.preventDefault();
    setDraggingIndex(index);
    
    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!pitchRef.current) return;
      const rect = pitchRef.current.getBoundingClientRect();
      let x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      let y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      x = Math.max(2, Math.min(98, x));
      y = Math.max(2, Math.min(98, y));
      
      setLocalPositions(prev => {
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

        localPositions.forEach((pos, i) => {
          if (i === index) return;
          const dist = Math.hypot(pos.x - dropX, pos.y - dropY);
          if (dist < minDistance) {
            minDistance = dist;
            closestIndex = i;
          }
        });

        let finalPositions = [...localPositions];

        if (closestIndex !== -1) {
          const temp = finalPositions[index];
          finalPositions[index] = finalPositions[closestIndex];
          finalPositions[closestIndex] = temp;
        } else {
          finalPositions[index] = {
            x: Math.max(2, Math.min(98, dropX)),
            y: Math.max(2, Math.min(98, dropY)),
          };
        }

        setLocalPositions(finalPositions);
        
        useGameStore.setState((state) => {
          const newTeams = { ...state.teams };
          newTeams[myTeamId].tactics.customPositions = finalPositions;
          return { teams: newTeams };
        });
      }
      setDraggingIndex(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Yedekten sahaya sürükleme
  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    e.dataTransfer.setData('playerId', playerId);
  };

  const handleDropOnPitch = (e: React.DragEvent, outPlayerId: string) => {
    e.preventDefault();
    const inPlayerId = e.dataTransfer.getData('playerId');
    if (!inPlayerId) return;
    if (subsCount >= 3) {
      alert('Maksimum 3 oyuncu değişikliği hakkınızı kullandınız!');
      return;
    }

    const outPlayer = userTeam?.players.find(p => p.id === outPlayerId);
    const inPlayer = userTeam?.players.find(p => p.id === inPlayerId);

    useGameStore.setState((state) => {
      const newTeams = { ...state.teams };
      const team = newTeams[myTeamId!];
      const newLineup = team.tactics.lineup.map(id => id === outPlayerId ? inPlayerId : id);
      team.tactics.lineup = newLineup;
      return { teams: newTeams };
    });

    setSubbedOut(prev => { const newSet = new Set(prev); newSet.add(outPlayerId); return newSet; });
    setSubsCount(prev => prev + 1);
    setInjuredPlayerOnPitch(null);

    setIsPlaying(false);
    setTimeout(() => {
      const updatedHome = useGameStore.getState().teams[homeTeam.id];
      const updatedAway = useGameStore.getState().teams[awayTeam.id];
      if (updatedHome && updatedAway) {
        const pastEvents = allEventsRef.current.filter(ev => ev.minute <= minute);
        const subEvent: MatchEvent = {
          minute,
          type: 'substitution',
          teamId: myTeamId,
          playerInId: inPlayerId,
          playerOutId: outPlayerId,
          text: `🔄 Oyuncu Değişikliği (${userTeam?.shortName}): ${outPlayer?.name} çıktı, ${inPlayer?.name} girdi.`,
        };
        const newResult = simulateMatch(updatedHome, updatedAway, {
          startMinute: minute,
          initialHomeScore: homeScore,
          initialAwayScore: awayScore,
          initialHomePossessionMinutes: Math.round(((fullResultRef.current?.homePossessionMinutes ?? 45) / 90) * minute),
          initialAwayPossessionMinutes: minute - Math.round(((fullResultRef.current?.homePossessionMinutes ?? 45) / 90) * minute),
          priorEvents: [...pastEvents, subEvent],
        });

        const futureEvents = newResult.events.filter(ev => ev.minute > minute);
        const combinedEvents = [...pastEvents, subEvent, ...futureEvents]
          .sort((a, b) => a.minute - b.minute);
        allEventsRef.current = combinedEvents;
        // Maç bittiğinde eski ilk simülasyon değil, değişiklik sonrası birleşik akış kaydedilsin.
        fullResultRef.current = { ...newResult, events: combinedEvents };
        setIsPlaying(true);
      }
    }, 100);
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-4 h-screen flex flex-col">
      <header className="flex justify-between items-center shrink-0">
        <button onClick={onFinish} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Geri Dön
        </button>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-400 mr-2">Değişiklik Hakkı: <span className="text-amber-500 font-bold">{3 - subsCount}</span>/3</span>
          
          {/* Anında Simüle Et Butonu */}
          <button
            disabled={isFinished}
            onClick={() => {
              if (isFinished) return;
              if (confirm('Maç anında simüle edilecek. Onaylıyor musunuz?')) {
                const pastEvents = allEventsRef.current.filter(event => event.minute <= minute);
                const homePossessionMinutes = Math.round(((fullResultRef.current?.homePossessionMinutes ?? 45) / 90) * minute);
                const result = simulateMatch(homeTeam, awayTeam, {
                  startMinute: minute,
                  initialHomeScore: homeScore,
                  initialAwayScore: awayScore,
                  initialHomePossessionMinutes: homePossessionMinutes,
                  initialAwayPossessionMinutes: minute - homePossessionMinutes,
                  priorEvents: pastEvents,
                });
                // Oynanmış dakikaları koru; yalnızca kalan süreyi yeniden simüle et.
                fullResultRef.current = result;
                allEventsRef.current = result.events;
                setVisibleEvents(result.events);
                setMinute(90);
                setIsPlaying(false);
                setIsHalfTime(false);
                setIsFinished(true);
              }
            }}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition-colors"
          >
            <Trophy className="w-4 h-4" /> Maçı Simüle Et
          </button>

          <button onClick={() => setIsPlaying(!isPlaying)} disabled={isFinished || isHalfTime || injuredPlayerOnPitch !== null}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Duraklat' : 'Oynat'}
          </button>

          {/* Sadece 1x ve 2x hız */}
          {[1, 2].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${speed === s ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {s}x
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 text-center">
                <div className="text-xl font-bold text-white">{homeTeam.name}</div>
                <div className="text-xs text-slate-500 mt-1">Ev Sahibi</div>
              </div>
              <div className="flex items-center gap-6 px-6">
                <div className="text-4xl font-bold text-emerald-400 font-mono">{homeScore}</div>
                <div className="text-center">
                  <div className="text-slate-500 text-xs">DAKİKA</div>
                  <div className="text-xl font-bold text-slate-300 font-mono">{minute}'</div>
                </div>
                <div className="text-4xl font-bold text-emerald-400 font-mono">{awayScore}</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-xl font-bold text-white">{awayTeam.name}</div>
                <div className="text-xs text-slate-500 mt-1">Deplasman</div>
              </div>
            </div>
            
            {isHalfTime && !isFinished && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10">
                <h3 className="text-xl font-bold text-amber-500 mb-1">İlk Yarı Sona Erdi</h3>
                <p className="text-slate-400 text-sm mb-4">Skor: {homeScore} - {awayScore}</p>
                <button onClick={handleStartSecondHalf} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-bold transition-colors flex items-center gap-2">
                  <Play className="w-4 h-4" /> 2. Yarıyı Başlat
                </button>
              </div>
            )}

            {isFinished && (
              <div className="text-center mt-4 pt-4 border-t border-slate-800">
                <p className="text-amber-400 font-bold flex items-center justify-center gap-2"><Trophy className="w-4 h-4" /> Maç Sonu</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col flex-1 min-h-0">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 shrink-0">Maç Akışı</h3>
            <div className="space-y-2 overflow-y-auto pr-2 flex-1">
              {visibleEvents.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Maçı başlatmak için "Oynat" butonuna bas.</p>
              ) : (
                visibleEvents.slice().reverse().map((event, idx) => (
                  <div key={`${event.minute}-${idx}`} className={`flex items-start gap-3 p-2.5 rounded-lg border text-sm ${
                    event.type === 'goal' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
                    event.type === 'injury' ? 'bg-orange-500/20 border-orange-500/50 text-orange-300' :
                    event.type === 'red' ? 'bg-red-500/20 border-red-500/50 text-red-300' :
                    event.type === 'yellow' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' :
                    'bg-slate-800/50 border-slate-700/50 text-slate-300'
                  }`}>
                    <div className="font-mono font-bold text-xs w-8 shrink-0 text-center pt-0.5">{event.minute}'</div>
                    <div className="text-base shrink-0">
                      {event.type === 'goal' ? '⚽' : event.type === 'injury' ? '🚑' : event.type === 'yellow' ? '🟨' : event.type === 'red' ? '🟥' : event.type === 'corner' ? '🚩' : (event.type === 'commentary' || event.type === 'turnover') ? '🔄' : '💬'}
                    </div>
                    <div className="flex-1">{event.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 h-full">
          <h3 className="text-sm font-bold text-slate-400 uppercase shrink-0">Kenar Yönetimi</h3>
          
          {!isUserMatch ? (
            <div className="text-slate-500 text-sm text-center py-8">Sadece kendi takımının maçlarına müdahale edebilirsin.</div>
          ) : (
            <>
              {injuredPlayerOnPitch && subsCount < 3 && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-400 flex items-start gap-2 shrink-0 animate-pulse">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold">Sakatlık!</p>
                    <p className="text-xs mt-1">Sahadaki sakat oyuncuyu değiştirmek için yedeklerden birini seç.</p>
                  </div>
                </div>
              )}

              <div ref={pitchRef} className="relative w-full aspect-[4/3] bg-emerald-950/50 rounded-lg border border-emerald-900/50 shadow-inner shrink-0 select-none">
                 <div className="absolute inset-0 flex flex-col opacity-20 pointer-events-none">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-emerald-500' : 'bg-transparent'}`} />
                  ))}
                 </div>
                 <div className="absolute inset-2 border border-white/10 rounded-sm pointer-events-none"></div>
                 <div className="absolute inset-y-2 left-1/2 w-px bg-white/10 pointer-events-none"></div>
                 
                 <div className="relative w-full h-full">
                  {userTeam?.tactics.lineup.map((playerId, i) => {
                    const player = userTeam.players.find(p => p.id === playerId);
                    if (!player) return null;
                    
                    const isRemoved = removedPlayerIds.has(player.id);
                    const pos = localPositions[i] || { x: 50, y: 50 };
                    const isDragging = draggingIndex === i;
                    const isInjured = injuredPlayerOnPitch === player.id;
                    
                    if (isRemoved) {
                      return (
                        <div
                          key={`removed-${i}`}
                          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-30 pointer-events-none z-10"
                        >
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-red-500 text-red-500 bg-red-900/50">
                            🟥
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={player.id}
                        onPointerDown={(e) => !isInjured && handlePointerDown(e, i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnPitch(e, player.id)}
                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-transform z-10 ${
                          isInjured ? 'ring-2 ring-red-500 rounded-full animate-pulse' :
                          isDragging ? 'scale-125 z-50 cursor-grabbing' : 'cursor-grab hover:scale-110'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border ${
                          isDragging ? 'bg-amber-500 border-white text-slate-950' : 
                          isInjured ? 'bg-red-800 border-red-500 text-white' :
                          'bg-slate-800 border-slate-600 text-emerald-400'
                        }`}>
                          {player.position}
                        </div>
                        <span className="mt-0.5 px-1 bg-slate-950/80 text-[8px] font-bold text-slate-300 rounded whitespace-nowrap border border-slate-800 shadow">
                          {player.name.split(' ').pop()}
                        </span>
                      </div>
                    );
                  })}
                 </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 bg-slate-950/50 rounded-lg border border-slate-800 p-2">
                <div className="text-xs font-bold text-slate-400 mb-2 flex justify-between items-center shrink-0">
                  <span>Yedek Kulübesi</span>
                  {injuredPlayerOnPitch && <span className="text-red-500 text-[10px] animate-pulse">Sahaya alınacak oyuncuyu seç</span>}
                </div>
                <div className="overflow-y-auto flex-1 space-y-1 pr-1">
                  {userBench.map((player) => (
                    <div
                      key={player.id}
                      draggable={subsCount < 3}
                      onDragStart={(e) => handleDragStart(e, player.id)}
                      onClick={() => {
                        if (injuredPlayerOnPitch) {
                          handleDropOnPitch({ preventDefault: () => {}, dataTransfer: { getData: () => player.id } } as unknown as React.DragEvent, injuredPlayerOnPitch);
                        }
                      }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex justify-between items-center border ${
                        subsCount >= 3 ? 'opacity-50 cursor-not-allowed bg-slate-900/30 border-transparent text-slate-500' :
                        injuredPlayerOnPitch ? 'bg-emerald-900/30 border-emerald-500/30 hover:bg-emerald-800/50 cursor-pointer text-slate-200' :
                        'bg-slate-800/50 border-transparent hover:bg-slate-800 cursor-grab active:cursor-grabbing text-slate-400'
                      }`}
                    >
                      <span className="truncate">{player.name}</span>
                      <span className="text-emerald-500 font-mono text-[10px]">{player.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}