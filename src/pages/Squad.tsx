import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { PlayerModal } from '@/components/PlayerModal';
import { calculateOverall } from '@/data/generator';
import type { Player, Position } from '@/types/game';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

type SortKey = 'name' | 'position' | 'age' | 'condition' | 'overall' | 'value' | 'appearances' | 'goals' | 'assists';

// MEVKİ SIRALAMA ÖNCELİĞİ (FM Mantığı: Geriden Öne)
const POSITION_ORDER: Record<Position, number> = {
  GK: 1,
  CB: 2, LB: 3, RB: 4,
  DM: 5, CM: 6, AM: 7,
  LW: 8, RW: 9,
  ST: 10,
};

export function Squad() {
  const { teams, myTeamId, day } = useGameStore();
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  
  // Sıralama state'i (Varsayılan: Reyting - Azalan)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ 
    key: 'overall', 
    direction: 'desc' 
  });

  const myTeam = myTeamId ? teams[myTeamId] : null;

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPlayers = useMemo(() => {
    if (!myTeam) return [];
    
    let players = myTeam.players.map(p => ({ ...p, overall: calculateOverall(p) }));

    if (search) {
      players = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    }
    if (posFilter !== 'ALL') {
      players = players.filter(p => p.position === posFilter);
    }

    players.sort((a, b) => {
      // Eğer Mevki'ye göre sıralanıyorsa özel haritayı kullan
      if (sortConfig.key === 'position') {
        const orderA = POSITION_ORDER[a.position] ?? 99;
        const orderB = POSITION_ORDER[b.position] ?? 99;
        // Mevki aynıysa Reyting'e göre sırala (daha iyisi üstte)
        if (orderA === orderB) {
          return calculateOverall(b) - calculateOverall(a);
        }
        return sortConfig.direction === 'asc' ? orderA - orderB : orderB - orderA;
      }

      let aVal: any = a[sortConfig.key as keyof typeof a];
      let bVal: any = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'appearances') { aVal = a.stats.appearances; bVal = b.stats.appearances; }
      if (sortConfig.key === 'goals') { aVal = a.stats.goals; bVal = b.stats.goals; }
      if (sortConfig.key === 'assists') { aVal = a.stats.assists; bVal = b.stats.assists; }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return players;
  }, [myTeam, search, posFilter, sortConfig]);

  if (!myTeam) return <div className="p-6 text-slate-400">Takım bulunamadı.</div>;

  const positions: (Position | 'ALL')[] = ['ALL', 'GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-emerald-500" /> 
      : <ChevronDown className="w-3 h-3 text-emerald-500" />;
  };

  // Reyting Rengi (FM Tarzı)
  const getRatingColor = (rating: number) => {
    if (rating >= 85) return 'border-emerald-400 text-emerald-300 bg-emerald-950/50'; // Yıldız
    if (rating >= 75) return 'border-emerald-600 text-emerald-400 bg-emerald-950/30'; // İyi
    if (rating >= 65) return 'border-amber-500 text-amber-400 bg-amber-950/30';    // Ortalama
    if (rating >= 50) return 'border-slate-600 text-slate-300 bg-slate-900/50';     // Zayıf
    return 'border-red-600 text-red-400 bg-red-950/30';                             // Kötü
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <header className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold">Kadro</h2>
          <p className="text-slate-400 text-sm">{myTeam.name} • {sortedPlayers.length} Oyuncu</p>
        </div>
      </header>

      {/* Kontroller */}
      <div className="flex flex-wrap gap-4 items-center bg-slate-900 p-4 rounded-lg border border-slate-800">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Oyuncu ara..."
            className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
        >
          {positions.map(p => <option key={p} value={p}>{p === 'ALL' ? 'Tüm Mevkiler' : p}</option>)}
        </select>
      </div>

      {/* Tablo */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">İsim <SortIcon columnKey="name" /></div>
              </th>
              <th className="px-4 py-3 text-center cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('position')}>
                <div className="flex items-center justify-center gap-1">Mevki <SortIcon columnKey="position" /></div>
              </th>
              <th className="px-4 py-3 text-center cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('age')}>
                <div className="flex items-center justify-center gap-1">Yaş <SortIcon columnKey="age" /></div>
              </th>
              <th className="px-4 py-3 text-center cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('appearances')}>
                <div className="flex items-center justify-center gap-1">Maç <SortIcon columnKey="appearances" /></div>
              </th>
              <th className="px-4 py-3 text-center cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('goals')}>
                <div className="flex items-center justify-center gap-1">Gol <SortIcon columnKey="goals" /></div>
              </th>
              <th className="px-4 py-3 text-center cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('assists')}>
                <div className="flex items-center justify-center gap-1">Asist <SortIcon columnKey="assists" /></div>
              </th>
              <th className="px-4 py-3 text-center cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('condition')}>
                <div className="flex items-center justify-center gap-1">Kondisyon <SortIcon columnKey="condition" /></div>
              </th>
              <th className="px-4 py-3 text-center cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('overall')}>
                <div className="flex items-center justify-center gap-1">Reyting <SortIcon columnKey="overall" /></div>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer group hover:text-slate-200 transition-colors" onClick={() => handleSort('value')}>
                <div className="flex items-center justify-end gap-1">Değer <SortIcon columnKey="value" /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sortedPlayers.map(player => (
              <tr 
                key={player.id} 
                onClick={() => setSelectedPlayer(player)}
                className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
              >
                <td className="px-4 py-3 font-medium text-slate-200 group-hover:text-white transition-colors">
                  {player.name}
                  {player.injuredUntilDay != null && player.injuredUntilDay > day && <span className="ml-2 text-xs text-red-500 font-bold">SAKAT</span>}
                </td>
                <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{player.position}</td>
                <td className="px-4 py-3 text-center text-slate-400">{player.age}</td>
                <td className="px-4 py-3 text-center text-slate-300 font-mono">{player.stats.appearances}</td>
                <td className="px-4 py-3 text-center text-slate-300 font-mono">{player.stats.goals}</td>
                <td className="px-4 py-3 text-center text-slate-300 font-mono">{player.stats.assists}</td>
                <td className="px-4 py-3 text-center">
                  <div className="w-full bg-slate-800 rounded-full h-1.5 max-w-[60px] mx-auto overflow-hidden">
                    <div 
                      className={`h-full ${player.condition > 80 ? 'bg-emerald-500' : player.condition > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${player.condition}%` }}
                    ></div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border font-bold font-mono text-xs ${getRatingColor(player.overall)}`}>
                    {player.overall}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-300 font-mono">
                  ₺{(player.value / 1000000).toFixed(1)}M
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedPlayers.length === 0 && (
          <div className="p-8 text-center text-slate-500">Kriterlere uygun oyuncu bulunamadı.</div>
        )}
      </div>

      {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
}