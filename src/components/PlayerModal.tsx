

import { X } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import type { Player } from '@/types/game';
import { calculateOverall } from '@/data/generator';

const ATTR_GROUPS = {
  'Teknik': ['passing', 'shooting', 'dribbling', 'tackling', 'heading', 'technique'],
  'Zihinsel': ['vision', 'positioning', 'decisions', 'workRate', 'aggression', 'composure'],
  'Fiziksel': ['pace', 'stamina', 'strength', 'agility'],
  'Kaleci': ['goalkeeping', 'reflexes'],
};

export function PlayerModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const overall = calculateOverall(player);
  const day = useGameStore(state => state.day);
  
  const getAttrColor = (val: number) => {
    if (val >= 16) return 'text-emerald-400 font-bold';
    if (val >= 12) return 'text-emerald-500';
    if (val >= 8) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-slate-800 p-6 flex justify-between items-start border-b border-slate-700">
          {player.photoUrl && <img src={player.photoUrl} alt={player.name} className="w-20 h-20 rounded-lg object-cover bg-slate-900" />}
          <div>
            <h2 className="text-2xl font-bold text-white break-words">{player.shirtNumber ? `#${player.shirtNumber} ` : ''}{player.name}</h2>
            <p className="text-slate-400 text-sm mt-1">
              {player.position}{player.positionEstimated ? '*' : ''} • {player.age ?? '—'} yaş • {player.nationality}
            </p>
            {player.positionEstimated && <p className="text-amber-400 text-xs mt-1">Mevki tahmini</p>}
            {player.suspendedUntilDay != null && player.suspendedUntilDay >= day && (
              <p className="text-orange-400 text-xs mt-1">{'Cezal\u0131 (G\u00FCn '}{player.suspendedUntilDay}{')'}</p>
            )}
            <p className="text-slate-500 text-xs mt-1">{player.ratingSource}</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center border-2 border-emerald-500">
              <span className="text-2xl font-bold text-emerald-400">{overall}</span>
            </div>
            <span className="text-xs text-slate-500 mt-1 font-medium">GENEL</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors absolute top-4 right-4">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {Object.entries(ATTR_GROUPS).map(([groupName, attrs]) => {
            // Kaleci özelliklerini sadece GK oyuncularında göster
            if (groupName === 'Kaleci' && player.position !== 'GK') return null;
            
            return (
              <div key={groupName}>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                  {groupName}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {attrs.map((attr) => {
                    const val = player.attributes[attr as keyof typeof player.attributes] as number;
                    return (
                      <div key={attr} className="flex justify-between items-center bg-slate-950/50 px-3 py-2 rounded">
                        <span className="text-sm text-slate-300 capitalize">
                          {attr.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className={`text-sm font-mono ${getAttrColor(val)}`}>{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Stats */}
        <div className="bg-slate-800/50 p-4 border-t border-slate-700 flex justify-between text-sm">
          <div className="flex gap-4">
            <span className="text-slate-400">Piyasa Değeri: <span className="text-emerald-400 font-mono">₺{(player.value / 1000000).toFixed(1)}M</span></span>
            <span className="text-slate-400">Maaş: <span className="text-slate-300 font-mono">₺{(player.wage / 1000).toFixed(0)}K/hafta</span></span>
          </div>
          <div className="flex gap-2">
            <span className="text-slate-500">Form:</span>
            <span className="text-amber-400 font-mono">{player.form.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}



