


import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Team, League, NewsItem, MatchFixture, MatchEvent, FinanceRecord, Position } from '@/types/game';
import { generateLeague, generatePlayer } from '@/data/generator';
import { computeConditionAtMinute, simulateMatch } from '@/engine/matchEngine';

interface GameState {
  initialized: boolean;
  season: number;
  day: number;
  myTeamId: string | null;
  teams: Record<string, Team>;
  leagues: Record<1 | 2, League | null>;
  lastEndedSeason: Record<1 | 2, number | null>;
  finalStandings: Record<1 | 2, string[] | null>;
  news: NewsItem[];
  finance: FinanceRecord[];

  initGame: (teamId: string, teamsData: Record<string, Team>, leaguesData: Record<1 | 2, League>) => void;
  advanceDay: () => void;
  addNews: (news: Omit<NewsItem, 'id' | 'day' | 'read'>) => void;
  playMatch: (fixture: MatchFixture, events: MatchEvent[], homeScore: number, awayScore: number) => void;
  simulateOtherMatches: () => void;
  endSeason: () => void;
  startNewSeason: () => void;
  resetGame: () => void;
}

// Yapay zekâ maçlarında yalnızca kondisyon toparlanması için gereken olayları sakla.
// Gol/şut/yorum metinleri lig fikstüründe tutulmak zorunda değil; localStorage'ı şişiriyor.
function compactFixtureEvents(events: MatchEvent[] = []): MatchEvent[] {
  return events
    .filter(event => event.type === 'substitution' || event.type === 'red' || event.type === 'injury')
    .map(({ text: _text, ...event }) => event as MatchEvent);
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
  const entryMinutes = new Map<string, number>();
  [...homeTeam.tactics.lineup, ...awayTeam.tactics.lineup].forEach(id => minutesPlayed.set(id, 90));
  events.forEach(event => {
    if (event.type === 'substitution') {
      const outgoingPlayerId = event.playerOutId ?? event.playerId;
      if (outgoingPlayerId) minutesPlayed.set(outgoingPlayerId, Math.max(0, event.minute - (entryMinutes.get(outgoingPlayerId) ?? 0)));
      const incomingPlayerId = event.playerInId ?? event.assisterId;
      if (incomingPlayerId) {
        entryMinutes.set(incomingPlayerId, event.minute);
        minutesPlayed.set(incomingPlayerId, 90 - event.minute);
      }
    } else if ((event.type === 'red' || event.type === 'injury') && event.playerId) {
      minutesPlayed.set(event.playerId, Math.max(0, event.minute - (entryMinutes.get(event.playerId) ?? 0)));
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
        player.condition = computeConditionAtMinute(player.condition, stamina, workRate, minutes);
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
      player.suspendedUntilDay = day + 7;
    }
  });
}

const safeGameStorage = createJSONStorage(() => ({
  getItem: (name: string) => localStorage.getItem(name),
  removeItem: (name: string) => localStorage.removeItem(name),
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
      return;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error;
    }

    // Kota dolduysa önce geçmiş maçların ayrıntılarını ve eski kayıtları küçült.
    try {
      const parsed = JSON.parse(value) as { state?: Record<string, unknown>; version?: number };
      const state = parsed.state;
      if (state) {
        const teams = state.teams as Record<string, Team> | undefined;
        const myTeamId = state.myTeamId as string | null;
        const myTier = teams?.[myTeamId ?? '']?.tier ?? 1;
        const leagues = state.leagues as Record<string, League | null> | undefined;
        let latestUserFixtureId: string | null = null;
        const userFixtures = leagues?.[String(myTier)]?.fixtures
          .filter(f => f.played && (f.homeTeamId === myTeamId || f.awayTeamId === myTeamId)) ?? [];
        latestUserFixtureId = userFixtures[userFixtures.length - 1]?.id ?? null;

        Object.values(leagues ?? {}).forEach(league => {
          if (!league) return;
          league.fixtures.forEach(fixture => {
            if (fixture.id !== latestUserFixtureId) fixture.events = compactFixtureEvents(fixture.events);
          });
        });
        if (Array.isArray(state.news)) state.news = state.news.slice(0, 80);
        if (Array.isArray(state.finance)) state.finance = state.finance.slice(-120);
      }

      let compacted = JSON.stringify(parsed);
      try {
        localStorage.setItem(name, compacted);
        console.warn('Kayıt kotası dolduğu için geçmiş maç ayrıntıları arşivlendi.');
        return;
      } catch (retryError) {
        if (!(retryError instanceof DOMException) || retryError.name !== 'QuotaExceededError') throw retryError;
      }

      // Son çare: geçmiş haber/finans listesini daha da sınırla; mevcut sağlam kayıt silinmez.
      if (state) {
        if (Array.isArray(state.news)) state.news = state.news.slice(0, 30);
        if (Array.isArray(state.finance)) state.finance = state.finance.slice(-40);
        compacted = JSON.stringify(parsed);
        localStorage.setItem(name, compacted);
        console.warn('Kayıt, güvenli alan sınırına göre küçültüldü.');
      }
    } catch (fallbackError) {
      console.error('Kayıt alanı dolu. Önceki kayıt korundu; yeni ilerleme kaydedilemedi.', fallbackError);
      window.dispatchEvent(new CustomEvent('fm-save-quota-error'));
      // Hata yukarı fırlatılmaz; React ekranı çökmez ve önceki kayıt korunur.
    }
  },
}));

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      initialized: false,
      season: 1,
      day: 0,
      myTeamId: null,
      teams: {},
      leagues: { 1: null, 2: null },
      lastEndedSeason: { 1: null, 2: null },
      finalStandings: { 1: null, 2: null },
      news: [],
      finance: [],

      initGame: (teamId: string, teamsData: Record<string, Team>, leaguesData: Record<1 | 2, League>) => {
        set({
          initialized: true,
          myTeamId: teamId,
          leagues: leaguesData,
          teams: teamsData,
          day: 0,
          season: 1,
          lastEndedSeason: { 1: null, 2: null },
          finalStandings: { 1: null, 2: null },
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
        const { day, leagues, teams, myTeamId } = get();
        if (!leagues[1]) return;

        const newDay = day + 1;
        const currentWeek = Math.floor(day / 7) + 1;
        const nextWeek = Math.floor(newDay / 7) + 1;
        const isNewWeek = nextWeek > currentWeek;

        const updatedTeams: Record<string, Team> = Object.fromEntries(
          Object.entries(teams).map(([id, team]) => [id, {
            ...team,
            stats: { ...team.stats },
            players: team.players.map(player => ({
              ...player,
              stats: { ...player.stats },
              injuredUntilDay: player.injuredUntilDay != null && player.injuredUntilDay <= newDay
                ? null
                : player.injuredUntilDay,
              suspendedUntilDay: player.suspendedUntilDay != null && player.suspendedUntilDay < newDay
                ? null
                : player.suspendedUntilDay ?? null,
            })),
          }])
        );
        const updatedLeagues: Record<1 | 2, League | null> = { ...leagues };

        if (isNewWeek) {
          const userTier = teams[myTeamId ?? '']?.tier ?? 1;
          const userLeague = updatedLeagues[userTier];
          const userFixture = userLeague?.fixtures.some(fixture =>
            !fixture.played && fixture.week === currentWeek &&
            (fixture.homeTeamId === myTeamId || fixture.awayTeamId === myTeamId)
          ) ?? false;
          if (userFixture) {
            const reminder = `${currentWeek}. hafta maçını oynamadan yeni haftaya geçemezsin.`;
            set(state => ({
              teams: updatedTeams,
              news: state.news.some(item => item.day === day && item.body === reminder)
                ? state.news
                : [{ id: `match_required_${state.season}_${day}`, day, category: 'general', title: 'Önce maçını oyna', body: reminder, read: false }, ...state.news],
            }));
            return;
          }

          for (const tier of [1, 2] as const) {
            const league = updatedLeagues[tier];
            if (!league) continue;
            const fixtures = league.fixtures.map(fixture => {
              const isUserMatch = tier === userTier &&
                (fixture.homeTeamId === myTeamId || fixture.awayTeamId === myTeamId);
              if (fixture.played) {
                return isUserMatch ? fixture : { ...fixture, events: compactFixtureEvents(fixture.events) };
              }
              if (fixture.week !== currentWeek || isUserMatch) return fixture;

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
                events: compactFixtureEvents(result.events),
              };
            });
            updatedLeagues[tier] = { ...league, fixtures };
          }

          // Haftalık maaşlar tüm kulüplerden düşülür.
          Object.values(updatedTeams).forEach(team => {
            const totalWages = team.players.reduce((sum, player) => sum + player.wage, 0);
            team.balance -= totalWages;
          });

          // Her iki ligde forma giyen oyuncuların toparlanması doğru hesaplanır.
          const playedPlayerIds = new Set<string>();
          for (const tier of [1, 2] as const) {
            const league = updatedLeagues[tier];
            if (!league) continue;
            league.fixtures.filter(fixture => fixture.played && fixture.week === currentWeek).forEach(fixture => {
              const home = updatedTeams[fixture.homeTeamId];
              const away = updatedTeams[fixture.awayTeamId];
              [...(home?.tactics.lineup ?? []), ...(away?.tactics.lineup ?? [])].forEach(id => playedPlayerIds.add(id));
              (fixture.events ?? []).forEach(event => {
                if (event.type === 'substitution') {
                  const outgoingPlayerId = event.playerOutId ?? event.playerId;
                  if (outgoingPlayerId) playedPlayerIds.add(outgoingPlayerId);
                  const incomingPlayerId = event.playerInId ?? event.assisterId;
                  if (incomingPlayerId) playedPlayerIds.add(incomingPlayerId);
                } else if ((event.type === 'red' || event.type === 'injury') && event.playerId) {
                  playedPlayerIds.add(event.playerId);
                }
              });
            });
          }

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
          leagues: updatedLeagues,
          teams: updatedTeams,
          finance: isNewWeek ? [...state.finance, ...(
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
        const { leagues, teams, myTeamId, day } = get();
        const userTier = teams[myTeamId ?? '']?.tier ?? 1;
        const userLeague = leagues[userTier];
        if (!userLeague) return;

        const selectedFixture = userLeague.fixtures.find(item => item.id === fixture.id);
        if (!selectedFixture || selectedFixture.played) return;

        const updatedTeams: Record<string, Team> = Object.fromEntries(
          Object.entries(teams).map(([id, team]) => [id, {
            ...team,
            stats: { ...team.stats },
            players: team.players.map(player => ({ ...player, stats: { ...player.stats } })),
          }])
        );
        const updatedLeagues: Record<1 | 2, League | null> = { ...leagues };

        for (const tier of [1, 2] as const) {
          const league = updatedLeagues[tier];
          if (!league) continue;

          const fixtures = league.fixtures.map(item => {
            if (tier === userTier && item.id === selectedFixture.id) {
              const userHome = updatedTeams[item.homeTeamId];
              const userAway = updatedTeams[item.awayTeamId];
              if (userHome && userAway) {
                applyMatchStats(userHome, userAway, events, homeScore, awayScore, day);
              }
              return { ...item, played: true, homeScore, awayScore, events };
            }

            if (item.played) return { ...item, events: compactFixtureEvents(item.events) };
            if (item.week !== selectedFixture.week) return item;
            const homeTeam = updatedTeams[item.homeTeamId];
            const awayTeam = updatedTeams[item.awayTeamId];
            if (!homeTeam || !awayTeam) return item;

            const result = simulateMatch(homeTeam, awayTeam);
            applyMatchStats(homeTeam, awayTeam, result.events, result.homeScore, result.awayScore, day);
            return {
              ...item,
              played: true,
              homeScore: result.homeScore,
              awayScore: result.awayScore,
              events: compactFixtureEvents(result.events),
            };
          });

          updatedLeagues[tier] = { ...league, fixtures };
        }

        set({ leagues: updatedLeagues, teams: updatedTeams });
      },

      simulateOtherMatches: () => {
        // Gelecekte gerçek maç motoruyla simüle edilecek
      },

      endSeason: () => {
        const { leagues, teams, myTeamId, day, lastEndedSeason, finalStandings } = get();
        if (!leagues[1]) return;

        const updatedTeams = { ...teams };
        const finance = [...get().finance];
        const newNews = [...get().news];
        const newLastEndedSeason: Record<1 | 2, number | null> = { ...lastEndedSeason };
        const newFinalStandings: Record<1 | 2, string[] | null> = { ...finalStandings };

        for (const tier of [1, 2] as const) {
          const league = leagues[tier];
          if (!league || lastEndedSeason[tier] === league.season) continue;

          const standings = league.teamIds.map(id => {
            const team = updatedTeams[id];
            if (!team) return null;
            const matches = league.fixtures.filter(f => f.played && (f.homeTeamId === id || f.awayTeamId === id));
            let won = 0;
            let drawn = 0;
            let goalsFor = 0;
            let goalsAgainst = 0;
            matches.forEach(match => {
              const isHome = match.homeTeamId === id;
              const scored = isHome ? (match.homeScore || 0) : (match.awayScore || 0);
              const conceded = isHome ? (match.awayScore || 0) : (match.homeScore || 0);
              goalsFor += scored;
              goalsAgainst += conceded;
              if (scored > conceded) won += 1;
              else if (scored === conceded) drawn += 1;
            });
            return { team, points: won * 3 + drawn, goalDiff: goalsFor - goalsAgainst };
          }).filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);

          const champion = standings[0]?.team;
          if (!champion) continue;

          newFinalStandings[tier] = standings.map(item => item.team.id);

          const myPosition = standings.findIndex(item => item.team.id === myTeamId) + 1;
          const isMyTeamInLeague = myPosition > 0;
          const prize = tier === 1 ? 50_000_000 : 15_000_000;

          updatedTeams[champion.id] = {
            ...updatedTeams[champion.id],
            balance: updatedTeams[champion.id].balance + prize,
          };

          if (champion.id === myTeamId) {
            finance.push({
              id: `prize_${league.season}_tier_${tier}_${champion.id}`,
              day,
              type: 'income',
              category: 'prize',
              amount: prize,
              description: `${league.season}. sezon ${tier === 1 ? 'Süper Lig' : '1. Lig'} şampiyonluk ödülü`,
            });
          }

          newNews.push({
            id: `season_end_${tier}_${league.season}`,
            day,
            category: 'general',
            title: `${league.season}. Sezon Sona Erdi — ${tier === 1 ? 'Süper Lig' : '1. Lig'}`,
            body: isMyTeamInLeague
              ? `Şampiyon: ${champion.name}${champion.id === myTeamId
                ? ' — Tebrikler, şampiyon oldunuz!'
                : `. Ligi ${myPosition}. sırada bitirdiniz.`}`
              : `Şampiyon: ${champion.name}.`,
            read: false,
          });
          newLastEndedSeason[tier] = league.season;
        }

        set({
          teams: updatedTeams,
          news: newNews,
          finance,
          lastEndedSeason: newLastEndedSeason,
          finalStandings: newFinalStandings,
        });
      },

      startNewSeason: () => {
        const { season, teams, leagues, finalStandings, myTeamId } = get();
        const newSeason = season + 1;
        const previousTier = teams[myTeamId ?? '']?.tier ?? 1;

        // Sıralamalar eksiksiz ve mevcut lig kadrolarıyla tutarlıysa yükselme/düşme uygula.
        let teamsForNewSeason: Record<string, Team> = { ...teams };
        const tier1Standing = finalStandings[1];
        const tier2Standing = finalStandings[2];
        const hasValidStandings = (() => {
          if (!leagues[1] || !leagues[2] || !tier1Standing || !tier2Standing) return false;
          if (tier1Standing.length !== 18 || tier2Standing.length !== 20) return false;
          const tier1Set = new Set(tier1Standing);
          const tier2Set = new Set(tier2Standing);
          if (tier1Set.size !== 18 || tier2Set.size !== 20) return false;
          if (tier2Standing.some(id => tier1Set.has(id))) return false;
          if (!tier1Standing.every(id => teams[id] && leagues[1]!.teamIds.includes(id))) return false;
          if (!tier2Standing.every(id => teams[id] && leagues[2]!.teamIds.includes(id))) return false;
          if (leagues[1]!.teamIds.length !== 18 || leagues[2]!.teamIds.length !== 20) return false;
          if (leagues[1]!.teamIds.some(id => !tier1Set.has(id)) ||
              leagues[2]!.teamIds.some(id => !tier2Set.has(id))) return false;
          if (tier1Standing.some(id => (teams[id].tier ?? 1) !== 1) ||
              tier2Standing.some(id => teams[id].tier !== 2)) return false;
          return true;
        })();

        if (hasValidStandings && tier1Standing && tier2Standing) {
          tier1Standing.slice(-3).forEach(id => {
            teamsForNewSeason[id] = { ...teamsForNewSeason[id], tier: 2 };
          });
          tier2Standing.slice(0, 3).forEach(id => {
            teamsForNewSeason[id] = { ...teamsForNewSeason[id], tier: 1 };
          });
        } else if (leagues[2]) {
          console.warn('Yükselme/düşme atlandı: finalStandings verisi eksik veya tutarsız.');
        }

        // Sezon geçişi: yaşlanma, gelişim, emeklilik ve genç oyuncu üretimi.
        let retiredCount = 0;
        let youthCount = 0;
        const youthPositionOrder: Position[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST'];
        const updatedTeams: Record<string, Team> = Object.fromEntries(
          Object.entries(teamsForNewSeason).map(([teamId, originalTeam]) => {
            const players = originalTeam.players.flatMap(player => {
              const age = player.age == null ? null : player.age + 1;
              const retirementChance = age == null ? 0
                : age >= 40 ? 1
                : age === 39 ? 0.65
                : age === 38 ? 0.4
                : age === 37 ? 0.25
                : age === 36 ? 0.15
                : 0;

              if (retirementChance === 1 || Math.random() < retirementChance) {
                retiredCount += 1;
                return [];
              }

              const attributes = { ...player.attributes };
              if (age != null && age <= 23) {
                (['passing', 'shooting', 'dribbling', 'tackling', 'technique', 'vision', 'pace', 'stamina', 'strength', 'agility'] as const)
                  .forEach(key => {
                    if (Math.random() < 0.16) attributes[key] = Math.min(20, attributes[key] + 1);
                  });
              } else if (age != null && age >= 32) {
                (['pace', 'stamina', 'agility'] as const).forEach(key => {
                  if (Math.random() < 0.22) attributes[key] = Math.max(1, attributes[key] - 1);
                });
              }

              return [{
                ...player,
                age,
                attributes,
                condition: 100,
                injuredUntilDay: null,
                suspendedUntilDay: null,
                stats: { goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0 },
              }];
            });

            const targetSquadSize = Math.max(24, originalTeam.players.length);
            while (players.length < targetSquadSize) {
              const positionCounts = players.reduce((counts, player) => {
                counts[player.position] = (counts[player.position] ?? 0) + 1;
                return counts;
              }, {} as Partial<Record<Position, number>>);
              const position = [...youthPositionOrder].sort(
                (a, b) => (positionCounts[a] ?? 0) - (positionCounts[b] ?? 0)
              )[0]!;
              const youth = generatePlayer(teamId, position, originalTeam.reputation);
              youth.age = 17 + Math.floor(Math.random() * 5);
              youth.condition = 100;
              youth.morale = 65;
              players.push(youth);
              youthCount += 1;
            }

            return [teamId, {
              ...originalTeam,
              players,
              stats: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
            }];
          })
        );

        // Her lig kendi takımlarıyla yeni sezon fikstürünü alır.
        const tier1TeamIds = Object.values(updatedTeams)
          .filter(team => (team.tier ?? 1) === 1)
          .map(team => team.id);
        const updatedLeagues: Record<1 | 2, League | null> = { 1: null, 2: null };

        // Bozuk bir sıralama swap'ı engeller; normal mevcut tier dağılımı yine devam eder.
        if (tier1TeamIds.length !== 18) {
          console.error(`Süper Lig takım sayısı 18 olmalı; bulunan: ${tier1TeamIds.length}. Sezon geçişi durduruldu.`);
          return;
        }
        updatedLeagues[1] = {
          ...generateLeague(newSeason, tier1TeamIds, 1).league,
          teamIds: tier1TeamIds,
        };

        // 1. Lig yalnızca mevcut kariyerde zaten varsa yenilenir.
        if (leagues[2]) {
          const tier2TeamIds = Object.values(updatedTeams)
            .filter(team => team.tier === 2)
            .map(team => team.id);
          if (tier2TeamIds.length !== 20) {
            console.error(`1. Lig takım sayısı 20 olmalı; bulunan: ${tier2TeamIds.length}. Sezon geçişi durduruldu.`);
            return;
          }
          updatedLeagues[2] = {
            ...generateLeague(newSeason, tier2TeamIds, 2).league,
            teamIds: tier2TeamIds,
          };
        }

        const newNews: NewsItem[] = [{
          id: `new_season_${newSeason}_${Date.now()}`,
          day: 0,
          category: 'general',
          title: `${newSeason}. Sezon Başladı!`,
          body: `Yeni sezon başladı! ${retiredCount} oyuncu emekli oldu, ${youthCount} genç oyuncu kadrolara katıldı. Kadronuzu güçlendirin ve şampiyonluk için savaşın.`,
          read: false,
        }];

        const newTier = updatedTeams[myTeamId ?? '']?.tier ?? 1;
        if (previousTier !== newTier) {
          newNews.push({
            id: `tier_change_${newSeason}_${Date.now()}`,
            day: 0,
            category: newTier === 1 ? 'match' : 'board',
            title: newTier === 1 ? 'Süper Lig\'e Yükseldiniz!' : '1. Lig\'e Düştünüz',
            body: newTier === 1
              ? `Tebrikler! ${newSeason}. sezonda Süper Lig'de mücadele edeceksiniz. Yönetim ve taraftarlar sizden büyük başarılar bekliyor.`
              : `${newSeason}. sezonda 1. Lig'de mücadele edeceksiniz. Hedefiniz en kısa sürede Süper Lig'e geri dönmek.`,
            read: false,
          });
        }

        set({
          season: newSeason,
          day: 0,
          teams: updatedTeams,
          leagues: updatedLeagues,
          lastEndedSeason: { 1: null, 2: null },
          finalStandings: { 1: null, 2: null },
          news: newNews,
        });
      },

      resetGame: () => {
        set({
          initialized: false,
          myTeamId: null,
          leagues: { 1: null, 2: null },
          teams: {},
          news: [],
          finance: [],
          lastEndedSeason: { 1: null, 2: null },
          finalStandings: { 1: null, 2: null },
        });
      }
    }),
    {
      name: 'fm-simulator-save',
      storage: safeGameStorage,
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        const state = persistedState as Record<string, unknown>;

        if (version < 2) {
          // Eski tek lig kaydını yapısal olarak taşı; ikinci ligi asla burada üretme.
          if (!state.leagues) {
            state.leagues = {
              1: (state.league as League | null | undefined) ?? null,
              2: null,
            };
            delete state.league;
          }
        }

        // Önceden oluşturulmuş leagues[2] aynen korunur; eksikse null bırakılır.
        if (!state.leagues) {
          state.leagues = {
            1: (state.league as League | null | undefined) ?? null,
            2: null,
          };
          delete state.league;
        } else {
          const leagues = state.leagues as Record<string, unknown>;
          if (leagues['1'] === undefined) {
            leagues['1'] = (state.league as League | null | undefined) ?? null;
          }
          if (leagues['2'] === undefined) leagues['2'] = null;
          delete state.league;
        }
        if (!state.lastEndedSeason) {
          state.lastEndedSeason = { 1: null, 2: null };
        }

        if (!state.finalStandings) {
          state.finalStandings = { 1: null, 2: null };
        }

        return state;
      },
    }
  )
);



