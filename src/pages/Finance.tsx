import { useGameStore } from '@/store/useGameStore';
import { formatGameDate } from '@/utils/date';
import { Wallet, TrendingUp, TrendingDown, Users } from 'lucide-react';

export function Finance() {
  const { teams, myTeamId, day, season, finance } = useGameStore();
  const myTeam = myTeamId ? teams[myTeamId] : null;

  if (!myTeam) return <div className="p-6 text-slate-400">Takım bulunamadı.</div>;

  const totalWages = myTeam.players.reduce((sum, p) => sum + p.wage, 0);
  const recentFinance = finance ? finance.slice(-10).reverse() : [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold">Finans</h2>
          <p className="text-slate-400 text-sm">{formatGameDate(day, season)} • {myTeam.name}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-medium text-slate-400">Kulüp Kasası</h3>
          </div>
          <p className="text-3xl font-bold text-emerald-400 font-mono">
            ₺{(myTeam.balance / 1000000).toFixed(2)}M
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-medium text-slate-400">Haftalık Maaş Gideri</h3>
          </div>
          <p className="text-3xl font-bold text-red-400 font-mono">
            ₺{(totalWages / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-slate-500 mt-1">{myTeam.players.length} oyuncu</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-slate-400">Takım Değeri</h3>
          </div>
          <p className="text-3xl font-bold text-amber-400 font-mono">
            ₺{(myTeam.players.reduce((sum, p) => sum + p.value, 0) / 1000000).toFixed(1)}M
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Son Finansal Hareketler
          </h3>
        </div>
        <div className="divide-y divide-slate-800/50">
          {recentFinance.length > 0 ? (
            recentFinance.map(record => (
              <div key={record.id} className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition-colors">
                <div>
                  <p className="text-sm text-slate-200 font-medium">{record.description}</p>
                  <p className="text-xs text-slate-500">Gün {record.day}</p>
                </div>
                <div className={`font-mono font-bold text-sm ${record.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {record.type === 'income' ? '+' : '-'}₺{(record.amount / 1000000).toFixed(2)}M
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">Henüz finansal hareket yok.</div>
          )}
        </div>
      </div>
    </div>
  );
}
