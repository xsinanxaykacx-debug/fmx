import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { Squad } from '@/pages/Squad';
import { Tactics } from '@/pages/Tactics';
import { MatchLive } from '@/pages/MatchLive';
import { Transfers } from '@/pages/Transfers';
import { Finance } from '@/pages/Finance';
import { League } from '@/pages/League';
import { Inbox } from '@/pages/Inbox';
import { StartScreen } from '@/pages/StartScreen';
import { useGameStore } from '@/store/useGameStore';
import type { MatchFixture } from '@/types/game';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeMatch, setActiveMatch] = useState<MatchFixture | null>(null);
  const { initialized, myTeamId, teams, leagues } = useGameStore();
  const myTeam = myTeamId ? teams[myTeamId] : null;
  const activeLeague = myTeam ? leagues[myTeam.tier ?? 1] : null;

  // Eğer oyun başlamamışsa veya takım/lig verisi yoksa StartScreen göster
  if (!initialized || !myTeamId || !activeLeague) {
    return <StartScreen />;
  }

  if (activeMatch) {
    return <MatchLive fixture={activeMatch} onFinish={() => setActiveMatch(null)} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'dashboard' && <Dashboard onNavigate={setCurrentPage} onPlayMatch={setActiveMatch} />}
        {currentPage === 'squad' && <Squad />}
        {currentPage === 'tactics' && <Tactics />}
        {currentPage === 'transfers' && <Transfers />}
        {currentPage === 'finance' && <Finance />}
        {currentPage === 'league' && <League />}
        {currentPage === 'inbox' && <Inbox />}
      </main>
    </div>
  );
}
