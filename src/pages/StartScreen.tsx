import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { Shield, Star, Wallet, ChevronRight } from 'lucide-react';
import { generateLeague } from '@/data/generator';

export function StartScreen() {
  const { initGame } = useGameStore();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Lig SADECE BİR KERE üretilsin (her render'da yeni ID üretmesin diye)
  const previewLeague = useMemo(() => generateLeague(1), []);
  const teamsArray = Object.values(previewLeague.teams).sort((a, b) => b.reputation - a.reputation);

  const handleStart = () => {
    if (selectedTeam) {
      initGame(selectedTeam, previewLeague.teams, previewLeague.league);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center">
      <header className="text-center mb-10 mt-10">
        <h1 className="text-4xl font-bold text-emerald-500 mb-2 flex items-center justify-center gap-3">
          <Shield className="w-10 h-10" /> Futbol Menajeri 2026
        </h1>
        <p className="text-slate-400">Kariyerine başlamak istediğin takımı seç.</p>
      </header>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-24">
        {teamsArray.map(team => {
          const isSelected = selectedTeam === team.id;
          const stars = Math.round(team.reputation / 4);
          
          return (
            <button
              key={team.id}
              onClick={() => setSelectedTeam(team.id)}
              className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden group ${
                isSelected 
                  ? 'bg-emerald-900/20 border-emerald-500 scale-[1.02] shadow-lg shadow-emerald-900/20' 
                  : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800/50'
              }`}
            >
              {isSelected && <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-bold px-2 py-1 rounded-bl-lg">SEÇİLDİ</div>}
              
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner shrink-0" style={{ backgroundColor: team.color, color: '#fff' }}>
                  {team.shortName}
                </div>
                <div>
                  <h3 className={`font-bold text-lg leading-tight ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>{team.name}</h3>
                  <p className="text-xs text-slate-500">{team.city} • {team.stadium}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800/50">
                <div className="flex text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < stars ? 'fill-amber-500' : 'text-slate-700'}`} />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-emerald-400 font-mono text-sm">
                  <Wallet className="w-3.5 h-3.5" />
                  {(team.balance / 1000000).toFixed(1)}M
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Alt Sabit Buton */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4 flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center">
          <div className="text-slate-300">
            {selectedTeam ? (
              <span>Seçilen Takım: <strong className="text-emerald-400 text-lg">{teamsArray.find(t => t.id === selectedTeam)?.name}</strong></span>
            ) : (
              <span className="text-slate-500">Lütfen bir takım seçin.</span>
            )}
          </div>
          <button
            onClick={handleStart}
            disabled={!selectedTeam}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold text-lg transition-all flex items-center gap-2 shadow-lg"
          >
            Kariyere Başla <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}