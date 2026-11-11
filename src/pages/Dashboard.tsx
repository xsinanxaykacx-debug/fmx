import { useGameStore } from '@/store/useGameStore';
import { formatGameDate } from '@/utils/date';
import { ChevronRight, TrendingUp, Inbox, Wallet, Play, Trophy } from 'lucide-react';
import type { MatchFixture } from '@/types/game';

export function Dashboard({ onNavigate, onPlayMatch }: { onNavigate: (p: string) => void; onPlayMatch: (f: MatchFixture) => void }) {
  const { day, season, news, teams, myTeamId, league } = useGameStore();
  
  const myTeam = myTeamId ? teams[myTeamId] : null;

  // Güvenlik Kontrolü: Eğer lig veya takım yoksa yükleniyor ekranı göster (Çökmeyi önler)
  if (!myTeam || !league) {
    return (
      <div className="p-6 flex items-center justify-center h-full text-slate-500">
        Yükleniyor veya maç verisi bulunamadı...
      </div>
    );
  }

  const nextFixture = league.fixtures.find(f => !f.played && (f.homeTeamId === myTeamId || f.awayTeamId === myTeamId));
  const allMatchesPlayed = league.fixtures.every(f => f.played);
  const isHome = nextFixture?.homeTeamId === myTeamId;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold">{myTeam.name}</h2>
          <p className="text-slate-400 text-sm">{formatGameDate(day, season)}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <Wallet className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-sm font-bold text-emerald-400">
              ₺{(myTeam.balance / 1000000).toFixed(1)}M
            </span>
          </div>
          
          {allMatchesPlayed ? (
            <button 
              onClick={() => {
                useGameStore.getState().endSeason();
                useGameStore.getState().startNewSeason();
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors animate-pulse"
            >
              Sezonu Bitir & Yeni Sezona Geç <Trophy className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={() => {
                if (nextFixture && !nextFixture.played) {
                  onPlayMatch(nextFixture);
                } else {
                  useGameStore.getState().advanceDay();
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors"
            >
              {nextFixture && !nextFixture.played ? 'Sıradaki Maçı Oyna' : 'Gün Geç'} <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Sıradaki Maç
          </h3>
          {nextFixture ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="truncate flex-1 text-center">{teams[nextFixture.homeTeamId]?.name || 'Ev Sahibi'}</span>
                <span className="text-slate-500 text-sm px-2">vs</span>
                <span className="truncate flex-1 text-center">{teams[nextFixture.awayTeamId]?.name || 'Deplasman'}</span>
              </div>
              <div className="text-xs text-slate-500 text-center">
                {isHome ? '🏠 Ev Sahibi' : '✈️ Deplasman'} • Hafta {nextFixture.week}
              </div>
              <button
                onClick={() => onPlayMatch(nextFixture)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2 text-sm font-bold transition-colors"
              >
                <Play className="w-4 h-4" /> Maçı Oyna
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              {allMatchesPlayed ? 'Sezon tamamlandı!' : 'Sıradaki maç yok.'}
            </p>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
            <Inbox className="w-4 h-4" /> Gelen Kutusu
          </h3>
          {news.length > 0 ? (
            <ul className="space-y-2">
              {news.slice(0, 3).map(n => (
                <li key={n.id} className="text-sm text-slate-300 truncate">• {n.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Henüz mesaj yok.</p>
          )}
        </div>
      </div>
    </div>
  );
}