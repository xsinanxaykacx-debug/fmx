import { useGameStore } from '@/store/useGameStore';
import { Mail, Trophy, AlertTriangle, TrendingUp, Building2 } from 'lucide-react';
import type { NewsItem } from '@/types/game';

export function Inbox() {
  const { news, day } = useGameStore();

  const getIcon = (category: NewsItem['category']) => {
    switch (category) {
      case 'match': return <Trophy className="w-5 h-5 text-emerald-400" />;
      case 'injury': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'finance': return <TrendingUp className="w-5 h-5 text-amber-400" />;
      case 'board': return <Building2 className="w-5 h-5 text-amber-400" />;
      default: return <Mail className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <header className="flex justify-between items-end mb-6 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold">Gelen Kutusu</h2>
          <p className="text-slate-400 text-sm">Kulüp haberleri ve bildirimler</p>
        </div>
        <span className="text-xs text-slate-500">Gün {day}</span>
      </header>

      <div className="space-y-2">
        {news.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Henüz mesaj yok.</p>
          </div>
        ) : (
          news.slice().reverse().map(item => (
            <div key={item.id} className={`bg-slate-900 border rounded-lg p-4 flex gap-4 transition-colors hover:bg-slate-800/50 ${item.read ? 'border-slate-800' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
              <div className="shrink-0 mt-1">{getIcon(item.category)}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className={`font-bold ${item.read ? 'text-slate-300' : 'text-white'}`}>{item.title}</h3>
                  <span className="text-xs text-slate-500">Gün {item.day}</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{item.body}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
