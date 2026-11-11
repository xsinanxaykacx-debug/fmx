import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Team, League, NewsItem, MatchFixture, MatchEvent, FinanceRecord } from '@/types/game';
import { generateLeague } from '@/data/generator';
import { simulateMatch } from '@/engine/matchEngine';

interface GameState {
  initialized: boolean;
  season: number;
  day: number;
  myTeamId: string | null;
  teams: Record<string, Team>;
  league: League | null;
  news: NewsItem[];
  finance: FinanceRecord[];

  initGame: (teamId: string, teamsData: Record<string, Team>, leagueData: League) => void;
  advanceDay: () => void;
  addNews: (news: Omit<NewsItem, 'id' | 'day' | 'read'>) => void;
  playMatch: (fixture: MatchFixture, events: MatchEvent[], homeScore: number, awayScore: number) => void;
  simulateOtherMatches: () => void;
  endSeason: () => void;
  startNewSeason: () => void;
  resetGame: () => void;
}

function applyMatchStats(homeTeam: Team, awayTeam: Team, events: MatchEvent[], homeScore: number, awayScore: number, day: number) {
  homeTeam.stats.played += 1;
  awayTeam.stats.played += 1;
  homeTeam.stats.goalsFor += homeScore;
  homeTeam.stats.goalsAgainst += awayScore;
  awayTeam.stats.goalsFor += awayScore;
  awayTeam.stats.goalsAgainst += homeScore;

  if (homeScore > awayScore) {
    homeTeam.stats.won += 1;
    homeTeam.stats.points += 3;
    awayTeam.stats.lost += 1;
  } else if (homeScore < awayScore) {
    awayTeam.stats.won += 1;
    awayTeam.stats.points += 3;
    homeTeam.stats.lost += 1;
  } else {
    homeTeam.stats.drawn += 1;
    awayTeam.stats.drawn += 1;
    homeTeam.stats.points += 1;
    awayTeam.stats.points += 1;
  }

  // Maç sonunda sahada olanlar ve değişiklikle çıkan/giren herkes forma giymiş sayılır.
  const appearedPlayerIds = new Set<string>([
    ...homeTeam.tactics.lineup,
    ...awayTeam.tactics.lineup,
  ]);
  events.forEach(event => {
    if (event.type === 'substitution') {
      const outgoingPlayerId = event.playerOutId ?? event.playerId;
      if (outgoingPlayerId) appearedPlayerIds.add(outgoingPlayerId);
      const incomingPlayerId = event.playerInId ?? event.assisterId;
      if (incomingPlayerId) appearedPlayerIds.add(incomingPlayerId);
    }
  });
  // İlk 11 oyuncuları 90 dakika; değişen, atılan veya sakatlanan oyuncular gerçek süreleri kadar oynar.
  const minutesPlayed = new Map<string, number>();
  [...homeTeam.tactics.lineup, ...awayTeam.tactics.lineup].forEach(id => minutesPlayed.set(id, 90));
  events.forEach(event => {
    if (event.type === 'substitution') {
      const outgoingPlayerId = event.playerOutId ?? event.playerId;
      if (outgoingPlayerId) minutesPlayed.set(outgoingPlayerId, event.minute);
      const incomingPlayerId = event.playerInId ?? event.assisterId;
      if (incomingPlayerId) minutesPlayed.set(incomingPlayerId, 90 - event.minute);
    } else if ((event.type === 'red' || event.type === 'injury') && event.playerId) {
      minutesPlayed.set(event.playerId, event.minute);
    }
  });

  appearedPlayerIds.forEach(id => {
    const player = homeTeam.players.find(p => p.id === id) ||
      awayTeam.players.find(p => p.id === id);
    if (player) {
      player.stats.appearances += 1;
      const minutes = minutesPlayed.get(id) ?? 0;
      if (minutes > 0) {
        const stamina = Math.max(1, Math.min(20, player.attributes.stamina));
        const workRate = Math.max(1, Math.min(20, player.attributes.workRate));
        const conditionLoss = (minutes / 90) * (6 + (20 - stamina) * 0.18 + (20 - workRate) * 0.06);
        player.condition = Math.max(25, player.condition - conditionLoss);
      }
    }
  });

  events.forEach(event => {
    if (!event.playerId) return;
    const player = homeTeam.players.find(p => p.id === event.playerId) ||
      awayTeam.players.find(p => p.id === event.playerId);
    if (!player) return;
    if (event.type === 'goal') {
      player.stats.goals += 1;
      if (event.assisterId) {
        const assister = homeTeam.players.find(p => p.id === event.assisterId) ||
          awayTeam.players.find(p => p.id === event.assisterId);
        if (assister) assister.stats.assists += 1;
      }
    } else if (event.type === 'injury') {
      player.injuredUntilDay = day + 14;
    } else if (event.type === 'yellow') {
      player.stats.yellowCards += 1;
    } else if (event.type === 'red') {
      player.stats.redCards += 1;
    }
  });
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      initialized: false,
      season: 1,
      day: 0,
      myTeamId: null,
      teams: {},
      league: null,
      news: [],
      finance: [],

      initGame: (teamId: string, teamsData: Record<string, Team>, leagueData: League) => {
        set({
          initialized: true,
          myTeamId: teamId,
          league: leagueData,
          teams: teamsData,
          day: 0,
          season: 1,
          news: [{
            id: 'welcome',
            day: 0,
            category: 'board',
            title: 'Kulübe Hoş Geldiniz!',
            body: `Yönetim kurulu olarak size güveniyoruz. ${teamsData[teamId]?.name} olarak bu sezon hedefimiz büyük!`,
            read: false
          }]
        });
      },

      advanceDay: () => {
        const { day, league, teams, myTeamId } = get();
        if (!league) return;

        const newDay = day + 1;
        const currentWeek = Math.floor(day / 7) + 1;
        const nextWeek = Math.floor(newDay / 7) + 1;

        let updatedFixtures = [...league.fixtures];
        let updatedTeams: Record<string, Team> = Object.fromEntries(
          Object.entries(teams).map(([id, team]) => [id, {
            ...team,
            stats: { ...team.stats },
            players: team.players.map(player => ({
              ...player,
              stats: { ...player.stats },
              injuredUntilDay: player.injuredUntilDay != null && player.injuredUntilDay <= newDay
                ? null
                : player.injuredUntilDay,
            })),
          }])
        );

        // Kullanıcının önceki haftadaki maçı oynanmadan takvim yeni haftaya geçemez.
        // Maç ekranından sonuç kaydedilince gün ilerletme tekrar kullanılabilir.
        if (nextWeek > currentWeek) {
          const userMatchUnplayed = updatedFixtures.some(fixture =>
            !fixture.played && fixture.week === currentWeek &&
            (fixture.homeTeamId === myTeamId || fixture.awayTeamId === myTeamId)
          );
          if (userMatchUnplayed) {
            const reminder = `${currentWeek}. hafta maçını oynamadan yeni haftaya geçemezsin.`;
            set(state => ({
              teams: updatedTeams,
              news: state.news.some(item => item.day === day && item.body === reminder)
                ? state.news
                : [{ id: `match_required_${state.season}_${day}`, day, category: 'general', title: 'Önce maçını oyna', body: reminder, read: false }, ...state.news],
            }));
            return;
          }
          updatedFixtures = updatedFixtures.map(fixture => {
            // Sadece oynanmamış maçları simüle et
            // Kullanıcının maçını advanceDay otomatik oynatmaz; maç ekranından yönetilir.
            if (!fixture.played && fixture.week === currentWeek &&
                fixture.homeTeamId !== myTeamId && fixture.awayTeamId !== myTeamId) {
              const homeTeam = updatedTeams[fixture.homeTeamId];
              const awayTeam = updatedTeams[fixture.awayTeamId];
              if (!homeTeam || !awayTeam) return fixture;

              const result = simulateMatch(homeTeam, awayTeam);
              applyMatchStats(homeTeam, awayTeam, result.events, result.homeScore, result.awayScore, newDay);
              return {
                ...fixture,
                played: true,
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                events: result.events,
              };
            }
            return fixture;
          });

          // Haftalık maaşları düş ve finans defterine işle.
          Object.values(updatedTeams).forEach(team => {
            const totalWages = team.players.reduce((sum, player) => sum + player.wage, 0);
            team.balance -= totalWages;
          });

          // Maç oynayanlar daha az dinlenir; oynamayanlar kondisyonunu daha hızlı toplar.
          const playedPlayerIds = new Set<string>();
          updatedFixtures.filter(fixture => fixture.played && fixture.week === currentWeek).forEach(fixture => {
            const home = updatedTeams[fixture.homeTeamId];
            const away = updatedTeams[fixture.awayTeamId];
            [...(home?.tactics.lineup ?? []), ...(away?.tactics.lineup ?? [])].forEach(id => playedPlayerIds.add(id));
            (fixture.events ?? []).forEach(event => {
              if (event.type === 'substitution') {
                const outgoingPlayerId = event.playerOutId ?? event.playerId;
                if (outgoingPlayerId) playedPlayerIds.add(outgoingPlayerId);
                const incomingPlayerId = event.playerInId ?? event.assisterId;
                if (incomingPlayerId) playedPlayerIds.add(incomingPlayerId);
              }
            });
          });
          Object.values(updatedTeams).forEach(team => {
            team.players = team.players.map(player => {
              const recovery = playedPlayerIds.has(player.id)
                ? 2 + Math.floor(Math.random() * 3)
                : 8 + Math.floor(Math.random() * 5);
              return {
                ...player,
                condition: Math.min(100, player.condition + recovery),
                form: Math.min(10, Math.max(3, player.form + (Math.random() - 0.5))),
              };
            });
          });
        }

        set(state => ({
          day: newDay,
          league: { ...league, fixtures: updatedFixtures },
          teams: updatedTeams,
          finance: nextWeek > currentWeek ? [...state.finance, ...(
            myTeamId && updatedTeams[myTeamId]
              ? [{ id: `wages_${state.season}_${newDay}_${myTeamId}`, day: newDay, type: 'expense' as const, category: 'wages' as const, amount: updatedTeams[myTeamId].players.reduce((sum, player) => sum + player.wage, 0), description: 'Haftalık oyuncu maaşları' }]
              : []
          )] : state.finance,
        }));
      },

      addNews: (newsItem) => {
        const { day, news } = get();
        const newItem: NewsItem = {
          ...newsItem,
          id: Math.random().toString(36).slice(2),
          day,
          read: false,
        };
        set({ news: [newItem, ...news] });
      },

      playMatch: (fixture, events, homeScore, awayScore) => {
        const { league, teams } = get();
        if (!league || league.fixtures.find(f => f.id === fixture.id)?.played) return;

        // 1. Senin maçını kaydet
        let updatedFixtures = league.fixtures.map((f) => {
          if (f.id === fixture.id) {
            return { ...f, played: true, homeScore, awayScore, events };
          }
          return f;
        });

        // 2. Yalnızca diğer maçlar simüle edilir. Kullanıcının maçı yukarıda played:true
        // olarak işaretlendiği için aşağıdaki !f.played filtresine girmez ve ikinci kez işlenmez.
        const updatedTeams: Record<string, Team> = Object.fromEntries(
          Object.entries(teams).map(([id, team]) => [id, {
            ...team,
            stats: { ...team.stats },
            players: team.players.map(player => ({ ...player, stats: { ...player.stats } })),
          }])
        );
        updatedFixtures = updatedFixtures.map(f => {
          if (!f.played && f.week === fixture.week) {
            const homeTeam = updatedTeams[f.homeTeamId];
            const awayTeam = updatedTeams[f.awayTeamId];
            if (!homeTeam || !awayTeam) return f;

            const result = simulateMatch(homeTeam, awayTeam);
            applyMatchStats(homeTeam, awayTeam, result.events, result.homeScore, result.awayScore, get().day);
            return {
              ...f,
              played: true,
              homeScore: result.homeScore,
              awayScore: result.awayScore,
              events: result.events,
            };
          }
          return f;
        });

        // 3. Kullanıcının maç istatistiklerini de ortak kayıt fonksiyonuyla işle
        const homeTeam = updatedTeams[fixture.homeTeamId];
        const awayTeam = updatedTeams[fixture.awayTeamId];
        if (homeTeam && awayTeam) {
          applyMatchStats(homeTeam, awayTeam, events, homeScore, awayScore, get().day);
        }

        set({ league: { ...league, fixtures: updatedFixtures }, teams: updatedTeams });
      },

      simulateOtherMatches: () => {
        // Gelecekte gerçek maç motoruyla simüle edilecek
      },

      endSeason: () => {
        const { league, teams, myTeamId, day } = get();
        if (!league) return;

        // Şampiyonu belirle
        const standings = league.teamIds.map(id => {
          const team = teams[id];
          const matches = league.fixtures.filter(f => f.played && (f.homeTeamId === id || f.awayTeamId === id));
          let won = 0, drawn = 0, goalsFor = 0, goalsAgainst = 0;
          matches.forEach(m => {
            const isHome = m.homeTeamId === id;
            const scored = isHome ? (m.homeScore || 0) : (m.awayScore || 0);
            const conceded = isHome ? (m.awayScore || 0) : (m.homeScore || 0);
            goalsFor += scored;
            goalsAgainst += conceded;
            if (scored > conceded) won++;
            else if (scored === conceded) drawn++;
          });
          return { team, points: won * 3 + drawn, goalDiff: goalsFor - goalsAgainst };
        }).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);

        const champion = standings[0]?.team;
        const myPosition = standings.findIndex(s => s.team.id === myTeamId) + 1;

        const newNews = [...get().news];
        if (champion) {
          newNews.push({
            id: `season_end_${Date.now()}`,
            day: get().day,
            category: 'general',
            title: `${league.season}. Sezon Sona Erdi!`,
            body: `Şampiyon: ${champion.name}. Siz ${myPosition}. sırada bitirdiniz.`,
            read: false
          });
        }

        const updatedTeams = { ...teams };
        const finance = [...get().finance];
        if (champion && updatedTeams[champion.id]) {
          updatedTeams[champion.id].balance += 50_000_000; // 50M ödül
          if (champion.id === myTeamId) {
            finance.push({
              id: `prize_${league.season}_${champion.id}`,
              day,
              type: 'income',
              category: 'prize',
              amount: 50_000_000,
              description: `${league.season}. sezon şampiyonluk ödülü`,
            });
          }
        }

        set({ teams: updatedTeams, news: newNews, finance });
      },

      startNewSeason: () => {
        const { season, teams } = get();
        const newSeason = season + 1;

        // Oyuncuları yaşlandır ve istatistikleri sıfırla
        const updatedTeams = { ...teams };
        Object.values(updatedTeams).forEach(team => {
          team.players = team.players.map(p => ({
            ...p,
            age: p.age + 1,
            condition: 100,
            injuredUntilDay: null,
            stats: { goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0 }
          }));
          team.stats = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
        });

        // Yeni fikstür oluştur
        const teamIds = Object.keys(updatedTeams);
        const newLeagueData = generateLeague(newSeason, teamIds);
        const updatedLeague = { ...newLeagueData.league, teamIds };

        set({
          season: newSeason,
          day: 0,
          teams: updatedTeams,
          league: updatedLeague,
          news: [{
            id: `new_season_${Date.now()}`,
            day: 0,
            category: 'general',
            title: `${newSeason}. Sezon Başladı!`,
            body: 'Yeni sezon başladı! Kadronuzu güçlendirin ve şampiyonluk için savaşın.',
            read: false
          }]
        });
      },

      resetGame: () => {
        set({ initialized: false, myTeamId: null, league: null, teams: {}, news: [] });
      }
    }),
    { name: 'fm-simulator-save' }
  )
);