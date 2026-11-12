import { getTableName } from '@/utils/formatName';
import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { Trophy, Calendar, ListOrdered, Users } from 'lucide-react';

type TabType = 'standings' | 'fixtures' | 'scorers' | 'assists';

export function League() {
  const { teams, myTeamId, leagues, day } = useGameStore();
  const myTeam = myTeamId ? teams[myTeamId] : null;
  const league = myTeam ? leagues[myTeam.tier ?? 1] : null;
  const [activeTab, setActiveTab] = useState<TabType>('standings');

  // Puan Durumu Hesaplama
  const standings = useMemo(() => {
    if (!league) return [];
    
    const table = league.teamIds.map(id => {
      const team = teams[id];
      const matches = league.fixtures.filter(f => 
        f.played && (f.homeTeamId === id || f.awayTeamId === id)
      );

      let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;

      matches.forEach(m => {
        const isHome = m.homeTeamId === id;
        const scored = isHome ? (m.homeScore || 0) : (m.awayScore || 0);
        const conceded = isHome ? (m.awayScore || 0) : (m.homeScore || 0);
        
        goalsFor += scored;
        goalsAgainst += conceded;

        if (scored > conceded) won++;
        else if (scored === conceded) drawn++;
        else lost++;
      });

      return {
        team,
        played: matches.length,
        won, drawn, lost, goalsFor, goalsAgainst,
        goalDiff: goalsFor - goalsAgainst,
        points: won * 3 + drawn,
      };
    });

    // Sıralama: Puan -> Averaj -> Atılan Gol
    return table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });
  }, [league, teams]);

  // Gol Krallığı
  const topScorers = useMemo(() => {
    const allPlayers = Object.values(teams).flatMap(t => t.players);
    return allPlayers
      .filter(p => p.stats.goals > 0)
      .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)
      .slice(0, 20);
  }, [teams]);

  // Asist Krallığı
  const topAssisters = useMemo(() => {
    const allPlayers = Object.values(teams).flatMap(t => t.players);
    return allPlayers
      .filter(p => p.stats.assists > 0)
      .sort((a, b) => b.stats.assists - a.stats.assists || b.stats.goals - a.stats.goals)
      .slice(0, 20);
  }, [teams]);

  // Fikstürü haftalara göre grupla
  const fixturesByWeek = useMemo(() => {
    if (!league) return [];
    const weeks: Record<number, typeof league.fixtures> = {};
    league.fixtures.forEach(f => {
      if (!weeks[f.week]) weeks[f.week] = [];
      weeks[f.week].push(f);
    });
    return weeks;
  }, [league]);

  const currentWeek = Math.floor(day / 7) + 1;

  if (!league) return <div className="p-6 text-slate-400">Lig verisi yükleniyor...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold">{league.name}</h2>
          <p className="text-slate-400 text-sm">{league.seasonLabel ?? `Sezon ${league.season}`} • Hafta {Math.min(league.fixtures.length / Math.max(1, league.teamIds.length / 2), currentWeek)}</p>
        </div>
      </header>

      {/* Sekmeler */}
      <div className="flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('standings')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'standings' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListOrdered className="w-4 h-4" /> Puan Durumu
        </button>
        <button
          onClick={() => setActiveTab('fixtures')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'fixtures' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" /> Fikstür
        </button>
        <button
          onClick={() => setActiveTab('scorers')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'scorers' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4" /> Gol Krallığı
        </button>
        <button
          onClick={() => setActiveTab('assists')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'assists' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> Asist Krallığı
        </button>
      </div>

      {/* Puan Durumu */}
      {activeTab === 'standings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3">Takım</th>
                <th className="px-4 py-3 text-center">O</th>
                <th className="px-4 py-3 text-center">G</th>
                <th className="px-4 py-3 text-center">B</th>
                <th className="px-4 py-3 text-center">M</th>
                <th className="px-4 py-3 text-center">A</th>
                <th className="px-4 py-3 text-center">Y</th>
                <th className="px-4 py-3 text-center">AV</th>
                <th className="px-4 py-3 text-center font-bold text-slate-200">P</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {standings.map((row, index) => {
                const isMyTeam = row.team.id === myTeamId;
                return (
                  <tr 
                    key={row.team.id} 
                    className={`transition-colors ${
                      isMyTeam ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                        index < 1 ? 'bg-amber-500 text-slate-950' :
                        index < 4 ? 'bg-emerald-600 text-white' :
                        index >= 16 ? 'bg-red-600 text-white' :
                        'text-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${isMyTeam ? 'text-emerald-400' : 'text-slate-200'}`}>
                      <span className="flex items-center gap-2">
                        {row.team.logoUrl && <img src={row.team.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                        {row.team.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.played}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.won}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.drawn}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.lost}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.goalsFor}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.goalsAgainst}</td>
                    <td className={`px-4 py-3 text-center font-mono ${row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}
                    </td>
                    <td className={`px-4 py-3 text-center font-bold ${isMyTeam ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Fikstür */}
      {activeTab === 'fixtures' && (
        <div className="space-y-4">
          {Object.entries(fixturesByWeek).map(([week, fixtures]) => (
            <div key={week} className={`bg-slate-900 border rounded-lg overflow-hidden ${
              Number(week) === currentWeek ? 'border-emerald-500/50' : 'border-slate-800'
            }`}>
              <div className={`p-3 border-b text-sm font-bold flex justify-between ${
                Number(week) === currentWeek ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 bg-slate-950/50 text-slate-300'
              }`}>
                <span>{week}. Hafta</span>
                {Number(week) === currentWeek && <span className="text-xs animate-pulse">Şu Anki Hafta</span>}
              </div>
              <div className="divide-y divide-slate-800/50">
                {fixtures.map(f => {
                  const home = teams[f.homeTeamId];
                  const away = teams[f.awayTeamId];
                  const isMyMatch = f.homeTeamId === myTeamId || f.awayTeamId === myTeamId;
                  
                  return (
                    <div key={f.id} className={`flex items-center px-4 py-2 text-sm ${
                      isMyMatch ? 'bg-emerald-500/5' : ''
                    }`}>
                      <span className={`flex-1 text-right flex items-center justify-end gap-2 ${f.homeTeamId === myTeamId ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                        {home?.name || 'Bilinmeyen'}
                        {home?.logoUrl && <img src={home.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                      </span>
                      <span className="px-4 font-mono font-bold w-20 text-center">
                        {f.played ? (
                          <span className={isMyMatch ? 'text-emerald-400' : 'text-slate-200'}>
                            {f.homeScore} - {f.awayScore}
                          </span>
                        ) : (
                          <span className="text-slate-600">vs</span>
                        )}
                      </span>
                      <span className={`flex-1 flex items-center gap-2 ${f.awayTeamId === myTeamId ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                        {away?.logoUrl && <img src={away.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                        {away?.name || 'Bilinmeyen'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gol Krallığı */}
      {activeTab === 'scorers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3">Oyuncu</th>
                <th className="px-4 py-3 text-center">Takım</th>
                <th className="px-4 py-3 text-center">Maç</th>
                <th className="px-4 py-3 text-center font-bold text-slate-200">Gol</th>
                <th className="px-4 py-3 text-center">Asist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {topScorers.map((player, index) => {
                const team = teams[player.teamId];
                const isMyPlayer = player.teamId === myTeamId;
                return (
                  <tr key={player.id} className={`hover:bg-slate-800/30 ${isMyPlayer ? 'bg-emerald-500/5' : ''}`}>
                    <td className="px-4 py-3 text-center font-bold text-slate-400">{index + 1}</td>
                    <td className={`px-4 py-3 font-medium ${isMyPlayer ? 'text-emerald-400' : 'text-slate-200'}`} title={player.name}>{getTableName(player.name)}</td>
                    <td className="px-4 py-3 text-center text-slate-400 text-xs">{team?.shortName}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{player.stats.appearances}</td>
                    <td className={`px-4 py-3 text-center font-bold ${isMyPlayer ? 'text-emerald-400' : 'text-white'}`}>{player.stats.goals}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{player.stats.assists}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {topScorers.length === 0 && <div className="p-8 text-center text-slate-500">Henüz gol atan oyuncu yok.</div>}
        </div>
      )}

      {/* Asist Krallığı */}
      {activeTab === 'assists' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3">Oyuncu</th>
                <th className="px-4 py-3 text-center">Takım</th>
                <th className="px-4 py-3 text-center">Maç</th>
                <th className="px-4 py-3 text-center font-bold text-slate-200">Asist</th>
                <th className="px-4 py-3 text-center">Gol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {topAssisters.map((player, index) => {
                const team = teams[player.teamId];
                const isMyPlayer = player.teamId === myTeamId;
                return (
                  <tr key={player.id} className={`hover:bg-slate-800/30 ${isMyPlayer ? 'bg-emerald-500/5' : ''}`}>
                    <td className="px-4 py-3 text-center font-bold text-slate-400">{index + 1}</td>
                    <td className={`px-4 py-3 font-medium ${isMyPlayer ? 'text-emerald-400' : 'text-slate-200'}`} title={player.name}>{getTableName(player.name)}</td>
                    <td className="px-4 py-3 text-center text-slate-400 text-xs">{team?.shortName}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{player.stats.appearances}</td>
                    <td className={`px-4 py-3 text-center font-bold ${isMyPlayer ? 'text-emerald-400' : 'text-white'}`}>{player.stats.assists}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{player.stats.goals}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {topAssisters.length === 0 && <div className="p-8 text-center text-slate-500">Henüz asist yapan oyuncu yok.</div>}
        </div>
      )}
    </div>
  );
}
