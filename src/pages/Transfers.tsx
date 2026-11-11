import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { calculateOverall } from '@/data/generator';
import type { Player, FinanceRecord } from '@/types/game';
import { Search, ArrowRightLeft, Wallet, Check } from 'lucide-react';

export function Transfers() {
  const { teams, myTeamId, league } = useGameStore();
  const [search, setSearch] = useState('');
  const [offerAmount, setOfferAmount] = useState<number>(0);
  const [showOfferModal, setShowOfferModal] = useState<Player | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const myTeam = myTeamId ? teams[myTeamId] : null;
  if (!myTeam || !league) return <div className="p-6 text-slate-400">Veri yükleniyor...</div>;

  // Tüm oyuncuları topla (kendi takımım hariç)
  const allPlayers = useMemo(() => {
    const players: Player[] = [];
    Object.values(teams).forEach(team => {
      if (team.id !== myTeamId) {
        players.push(...team.players);
      }
    });
    return players;
  }, [teams, myTeamId]);

  // Arama filtresi
  const filteredPlayers = useMemo(() => {
    if (!search) return allPlayers.slice(0, 50);
    return allPlayers.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 50);
  }, [allPlayers, search]);

  const handleMakeOffer = (player: Player) => {
    setShowOfferModal(player);
    setOfferAmount(player.value);
  };

  const confirmOffer = () => {
    if (!showOfferModal) return;
    
    if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
      setNotification('Geçersiz teklif tutarı!');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (offerAmount > myTeam.balance) {
      setNotification('Yetersiz bütçe!');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    // Transfer kabul şansı (basit: piyasa değerinin %10 üstü kabul edilir)
    const isAccepted = offerAmount >= showOfferModal.value * 1.1;
    
    if (isAccepted) {
      useGameStore.setState((state) => {
        const newTeams = Object.fromEntries(
          Object.entries(state.teams).map(([id, team]) => [id, {
            ...team,
            players: [...team.players],
            tactics: { ...team.tactics, lineup: [...team.tactics.lineup] },
          }])
        );
        const sellerTeam = Object.values(newTeams).find(team =>
          team.id !== myTeamId && team.players.some(player => player.id === showOfferModal.id)
        );

        // Oyuncuyu eski takımından ve ilk 11'inden çıkar; satış gelirini ekle.
        if (sellerTeam) {
          const lineupIndex = sellerTeam.tactics.lineup.indexOf(showOfferModal.id);
          sellerTeam.players = sellerTeam.players.filter(player => player.id !== showOfferModal.id);
          sellerTeam.tactics.lineup = sellerTeam.tactics.lineup.filter(id => id !== showOfferModal.id);
          // İlk 11'i 11 kişide tut ve yedek oyuncuyu boşalan taktik yuvasına yerleştir.
          if (lineupIndex >= 0) {
            const replacement = sellerTeam.players
              .filter(player => !sellerTeam.tactics.lineup.includes(player.id) && player.injuredUntilDay == null)
              .sort((a, b) => {
                const aFit = a.position === showOfferModal.position || a.altPositions.includes(showOfferModal.position) ? 1 : 0;
                const bFit = b.position === showOfferModal.position || b.altPositions.includes(showOfferModal.position) ? 1 : 0;
                return bFit - aFit || calculateOverall(b) - calculateOverall(a);
              })[0];
            if (replacement) sellerTeam.tactics.lineup.splice(lineupIndex, 0, replacement.id);
          }
          sellerTeam.balance += offerAmount;
        }

        // Oyuncuyu yeni takıma ekle ve transfer giderini kaydet.
        const newPlayer = { ...showOfferModal, teamId: myTeamId! };
        newTeams[myTeamId!].players.push(newPlayer);
        newTeams[myTeamId!].balance -= offerAmount;

        const financeRecord: FinanceRecord = {
          id: `transfer_${showOfferModal.id}_${state.day}`,
          day: state.day,
          type: 'expense',
          category: 'transfer',
          amount: offerAmount,
          description: `${showOfferModal.name} transferi`,
        };

        return { teams: newTeams, finance: [...state.finance, financeRecord] };
      });
      
      setNotification('Transfer başarılı!');
    } else {
      setNotification('Teklif reddedildi. Daha yüksek bir teklif deneyin.');
    }
    
    setShowOfferModal(null);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <header className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold">Transfer Merkezi</h2>
          <p className="text-slate-400 text-sm">Oyuncu arayın ve teklif yapın</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
          <Wallet className="w-5 h-5 text-emerald-500" />
          <span className="font-mono text-lg font-bold text-emerald-400">
            ₺{(myTeam.balance / 1000000).toFixed(1)}M
          </span>
        </div>
      </header>

      {notification && (
        <div className={`p-4 rounded-lg font-bold text-sm ${
          notification.includes('başarılı') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
        }`}>
          {notification}
        </div>
      )}

      <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Oyuncu ara..."
            className="w-full bg-slate-950 border border-slate-700 rounded-md py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase font-medium border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">İsim</th>
              <th className="px-4 py-3 text-center">Mevki</th>
              <th className="px-4 py-3 text-center">Yaş</th>
              <th className="px-4 py-3 text-center">Reyting</th>
              <th className="px-4 py-3 text-center">Takım</th>
              <th className="px-4 py-3 text-right">Değer</th>
              <th className="px-4 py-3 text-center">Aksiyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredPlayers.map(player => {
              const team = teams[player.teamId];
              const overall = calculateOverall(player);
              
              return (
                <tr key={player.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200">{player.name}</td>
                  <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{player.position}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{player.age}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-950 border border-slate-700 text-emerald-400 font-bold font-mono text-xs">
                      {overall}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400 text-xs">{team?.shortName || '-'}</td>
                  <td className="px-4 py-3 text-right text-slate-300 font-mono">₺{(player.value / 1000000).toFixed(1)}M</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleMakeOffer(player)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 mx-auto"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> Teklif Yap
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredPlayers.length === 0 && (
          <div className="p-8 text-center text-slate-500">Oyuncu bulunamadı.</div>
        )}
      </div>

      {/* Teklif Modalı */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Teklif Yap</h2>
            <p className="text-slate-400 text-sm mb-4">
              <span className="text-emerald-400 font-bold">{showOfferModal.name}</span> için teklifinizi girin.
              <br />Piyasa Değeri: <span className="font-mono">₺{(showOfferModal.value / 1000000).toFixed(1)}M</span>
            </p>
            
            <div className="mb-6">
              <label className="block text-xs text-slate-500 mb-1">Teklif Tutarı (₺)</label>
              <input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-md py-3 px-4 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowOfferModal(null)}
                className="px-4 py-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
              >
                İptal
              </button>
              <button
                onClick={confirmOffer}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-medium transition-colors text-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Teklifi Gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}