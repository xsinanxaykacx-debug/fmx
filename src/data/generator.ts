

import type { Attributes, League, MatchFixture, Player, Position, Team, TeamTactics, Formation } from '@/types/game';
import { FIRST_NAMES_TR, LAST_NAMES_TR, FIRST_NAMES_FOREIGN, LAST_NAMES_FOREIGN, NATIONALITIES } from './names';
import { LIG1_2026 } from './lig1_2026';

export function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const rng = createRng(Date.now() % 1_000_000);
const rand = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export interface TeamTemplate { name: string; short: string; city: string; color: string; stadium: string; rep: number; logoUrl?: string; }

export const TEAM_TEMPLATES: TeamTemplate[] = [
  { name: 'İstanbul Kartalları', short: 'KAR', city: 'İstanbul', color: '#0ea5e9', stadium: 'Kartal Arena', rep: 18 },
  { name: 'Ankara Bozkartları', short: 'BOZ', city: 'Ankara', color: '#dc2626', stadium: 'Bozkurt Stadyumu', rep: 17 },
  { name: 'İzmir Fırtınası', short: 'FIR', city: 'İzmir', color: '#16a34a', stadium: 'Fırtına Park', rep: 16 },
  { name: 'Bursa Yeşil', short: 'BUR', city: 'Bursa', color: '#65a30d', stadium: 'Yeşil Timsah Arena', rep: 15 },
  { name: 'Trabzon Karadeniz', short: 'TRA', city: 'Trabzon', color: '#7c3aed', stadium: 'Karadeniz Stadyumu', rep: 16 },
  { name: 'Antalya Güneş', short: 'ANT', city: 'Antalya', color: '#f59e0b', stadium: 'Güneş Arena', rep: 13 },
  { name: 'Adana Şimşek', short: 'ADA', city: 'Adana', color: '#0891b2', stadium: 'Şimşek Park', rep: 12 },
  { name: 'Konya Şahinleri', short: 'KON', city: 'Konya', color: '#059669', stadium: 'Şahin Arena', rep: 13 },
  { name: 'Gaziantep Kartal', short: 'GAZ', city: 'Gaziantep', color: '#b91c1c', stadium: 'Kartal Stadyumu', rep: 11 },
  { name: 'Kayseri Yıldız', short: 'KAY', city: 'Kayseri', color: '#eab308', stadium: 'Yıldız Arena', rep: 11 },
  { name: 'Samsun Deniz', short: 'SAM', city: 'Samsun', color: '#0284c7', stadium: 'Deniz Stadyumu', rep: 10 },
  { name: 'Rize Fırtına', short: 'RIZ', city: 'Rize', color: '#15803d', stadium: 'Fırtına Arena', rep: 9 },
  { name: 'Eskişehir Bozkır', short: 'ESK', city: 'Eskişehir', color: '#7c2d12', stadium: 'Bozkır Stadyumu', rep: 9 },
  { name: 'Denizli Horozu', short: 'DEN', city: 'Denizli', color: '#dc2626', stadium: 'Horoz Arena', rep: 8 },
  { name: 'Malatya Kayısı', short: 'MAL', city: 'Malatya', color: '#f97316', stadium: 'Kayısı Park', rep: 8 },
  { name: 'Erzurum Kar', short: 'ERZ', city: 'Erzurum', color: '#0ea5e9', stadium: 'Kar Arena', rep: 8 },
  { name: 'Aydın İncir', short: 'AYD', city: 'Aydın', color: '#84cc16', stadium: 'İncir Stadyumu', rep: 7 },
  { name: 'Balıkesir Körfez', short: 'BAL', city: 'Balıkesir', color: '#06b6d4', stadium: 'Körfez Arena', rep: 7 },
];

const SQUAD_DISTRIBUTION = [
  { pos: 'GK', count: 2 }, { pos: 'CB', count: 3 }, { pos: 'LB', count: 1 }, { pos: 'RB', count: 1 },
  { pos: 'DM', count: 2 }, { pos: 'CM', count: 2 }, { pos: 'AM', count: 2 },
  { pos: 'LW', count: 2 }, { pos: 'RW', count: 2 }, { pos: 'ST', count: 2 },
] as const;

function pickNationality(): string {
  const totalWeight = NATIONALITIES.reduce((s, n) => s + n.weight, 0);
  let r = rng() * totalWeight;
  for (const n of NATIONALITIES) {
    r -= n.weight;
    if (r <= 0) return n.code;
  }
  return 'TR';
}

function generateName(nationality: string): string {
  const isTurkish = nationality === 'TR';
  const first = isTurkish ? pick(FIRST_NAMES_TR) : pick(FIRST_NAMES_FOREIGN);
  const last = isTurkish ? pick(LAST_NAMES_TR) : pick(LAST_NAMES_FOREIGN);
  return `${first} ${last}`;
}

const POSITION_WEIGHTS: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  GK:  { goalkeeping: 6, reflexes: 6, positioning: 4, composure: 3, passing: 2, decisions: 3 },
  CB:  { tackling: 5, heading: 5, strength: 4, positioning: 4, composure: 3, decisions: 3, passing: 2 },
  LB:  { pace: 4, stamina: 4, tackling: 3, passing: 3, workRate: 4, positioning: 3 },
  RB:  { pace: 4, stamina: 4, tackling: 3, passing: 3, workRate: 4, positioning: 3 },
  DM:  { tackling: 4, passing: 4, positioning: 4, workRate: 4, decisions: 3, stamina: 3 },
  CM:  { passing: 5, vision: 4, technique: 4, stamina: 4, decisions: 3, workRate: 3 },
  AM:  { passing: 4, vision: 5, dribbling: 4, technique: 4, shooting: 3, composure: 3 },
  LW:  { pace: 5, dribbling: 5, agility: 4, shooting: 3, technique: 4, workRate: 2 },
  RW:  { pace: 5, dribbling: 5, agility: 4, shooting: 3, technique: 4, workRate: 2 },
  ST: { shooting: 6, heading: 4, composure: 4, positioning: 4, technique: 3, pace: 3, strength: 3 },
};

function generateAttributes(position: Position, overallBase: number): Attributes {
  const weights = POSITION_WEIGHTS[position];
  const base = overallBase;
  const make = (key: keyof Attributes): number => {
    const w = weights[key] ?? 0;
    const value = base - 4 + w + rand(-3, 3);
    return Math.max(1, Math.min(20, value));
  };
  return {
    passing: make('passing'), shooting: make('shooting'), dribbling: make('dribbling'),
    tackling: make('tackling'), heading: make('heading'), technique: make('technique'),
    vision: make('vision'), positioning: make('positioning'), decisions: make('decisions'),
    workRate: make('workRate'), aggression: rand(4, 16), composure: make('composure'),
    pace: make('pace'), stamina: make('stamina'), strength: make('strength'), agility: make('agility'),
    goalkeeping: position === 'GK' ? base + 4 + rand(-2, 2) : rand(1, 4),
    reflexes: position === 'GK' ? base + 4 + rand(-2, 2) : rand(1, 4),
  };
}

export function calculateOverall(p: Player): number {
  const a = p.attributes;
  let raw = 0;
  if (p.position === 'GK') {
    raw = ((a.goalkeeping + a.reflexes + a.positioning + a.composure + a.decisions) / 5) * 5;
  } else {
    const technical = (a.passing + a.shooting + a.dribbling + a.tackling + a.technique) / 5;
    const mental   = (a.vision + a.positioning + a.decisions + a.workRate + a.composure) / 5;
    const physical = (a.pace + a.stamina + a.strength + a.agility) / 4;
    const weights = POSITION_WEIGHTS[p.position];
    const hasTechWeight = (weights.shooting ?? 0) + (weights.passing ?? 0) + (weights.dribbling ?? 0) > 0;
    const technicalW = hasTechWeight ? 0.5 : 0.4;
    const mentalW    = 0.3;
    const physicalW  = 1 - technicalW - mentalW;
    raw = (technical * technicalW + mental * mentalW + physical * physicalW) * 5;
  }
  return Math.min(99, Math.max(1, Math.round(raw)));
}


export function generatePlayer(
  teamId: string,
  position: Position,
  teamReputation: number,
  forcedId?: string,
): Player {
  const nationality = pickNationality();
  const name = generateName(nationality);
  const age = rand(17, 35);
  const ageFactor = age < 21 ? -3 : age > 32 ? -2 : 0;
  const repBase = Math.round(6 + teamReputation * 0.6);
  const overallBase = Math.max(4, Math.min(19, repBase + ageFactor + rand(-3, 2)));
  const attributes = generateAttributes(position, overallBase);

  // Reytingi (0-100) baz alarak değer hesapla
  const tempPlayer = { attributes, position } as Player;
  const trueRating = calculateOverall(tempPlayer);
  // Rating 50 ise ~ 500K, Rating 80 ise ~ 15M, Rating 90 ise ~ 40M
  const baseValue = Math.pow(Math.max(1, trueRating - 30), 3) * 100;
  const ageMultiplier = age <= 21 ? 1.8 : age <= 25 ? 1.4 : age <= 29 ? 1.0 : age <= 32 ? 0.6 : 0.3;
  const value = Math.max(100000, Math.round(baseValue * ageMultiplier));
  const wage = Math.max(10000, Math.round((value * 0.003) / 52 * (0.8 + rng() * 0.4)));

  const altPositions: Position[] = [];
  const altMap: Partial<Record<Position, Position[]>> = {
    LB: ['LW', 'CB'], RB: ['RW', 'CB'],
    LW: ['ST', 'AM'], RW: ['ST', 'AM'],
    AM: ['CM', 'LW', 'RW'], CM: ['DM', 'AM'],
    DM: ['CM', 'CB'], ST: ['AM', 'LW', 'RW'],
    CB: ['DM', 'LB', 'RB'], GK: [],
  };
  const possibleAlts = altMap[position] ?? [];
  if (possibleAlts.length && rng() < 0.5) altPositions.push(pick(possibleAlts));

  return {
    id: forcedId ?? uid('p'),
    name, age, nationality, position, altPositions,
    shirtNumber: rand(1, 99),
    attributes,
    condition: rand(88, 100),
    morale: rand(50, 95),
    wage, value, teamId,
    form: 5.5 + rng() * 2,
    injuredUntilDay: null,
    suspendedUntilDay: null,
    stats: { goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0 },
  };
}

function generateDefaultTactics(players: Player[]): TeamTactics {
  const formation: Formation = '4-4-2';
  const gks = players.filter(p => p.position === 'GK');
  const defs = players.filter(p => ['CB', 'LB', 'RB'].includes(p.position));
  const mids = players.filter(p => ['DM', 'CM', 'AM', 'LW', 'RW'].includes(p.position));
  const fwds = players.filter(p => p.position === 'ST');

  const lineup: string[] = [];
  if (gks[0]) lineup.push(gks[0].id);
  lineup.push(...defs.slice(0, 4).map(p => p.id));
  lineup.push(...mids.slice(0, 4).map(p => p.id));
  lineup.push(...fwds.slice(0, 2).map(p => p.id));

  const all = players.map(p => p.id);
  while (lineup.length < 11) {
    const candidate = all.find(id => !lineup.includes(id));
    if (!candidate) break;
    lineup.push(candidate);
  }

  return { formation, lineup, tempo: 'normal', pressing: 'normal', mentality: 'balanced' };
}

export function generateTeam(template: TeamTemplate, tier: 1 | 2 = 1): Team {
  const id = uid('team');
  const players: Player[] = [];
  for (const { pos, count } of SQUAD_DISTRIBUTION) {
    const actual = count + (rng() < 0.3 ? 1 : 0);
    for (let i = 0; i < actual; i++) {
      players.push(generatePlayer(id, pos, template.rep));
    }
  }
  // Takım içinde forma numaraları benzersiz olsun.
  const usedNumbers = new Set<number>();
  for (const player of players) {
    let number = rand(1, 99);
    while (usedNumbers.has(number)) number = rand(1, 99);
    usedNumbers.add(number);
    player.shirtNumber = number;
  }
  const tactics = generateDefaultTactics(players);
  return {
    id,
    name: template.name,
    shortName: template.short,
    city: template.city,
    color: template.color,
    stadium: template.stadium,
    logoUrl: template.logoUrl,
    tier,
    reputation: template.rep,
    balance: template.rep * 5_000_000,
    players, tactics,
    stats: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  };
}

export function generateFixtures(teamIds: string[], _season: number): MatchFixture[] {
  const fixtures: MatchFixture[] = [];
  const n = teamIds.length;
  if (n % 2 !== 0) throw new Error('Tek sayıda takım için fikstür üretilemez');
  const rounds = n - 1;
  const half = n / 2;
  const ids = [...teamIds];

  let week = 1;
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = ids[i]!;
      const away = ids[n - 1 - i]!;
      const swap = (round + i) % 2 === 0;
      fixtures.push({
        id: uid('fx'),
        week,
        homeTeamId: swap ? home : away,
        awayTeamId: swap ? away : home,
        homeScore: null,
        awayScore: null,
        played: false,
      });
    }
    const fixed = ids[0]!;
    const rest = ids.slice(1);
    rest.unshift(rest.pop()!);
    ids.splice(0, ids.length, fixed, ...rest);
    week++;
  }

  const firstHalf = [...fixtures];
  for (const f of firstHalf) {
    fixtures.push({
      id: uid('fx'),
      week: f.week + rounds,
      homeTeamId: f.awayTeamId,
      awayTeamId: f.homeTeamId,
      homeScore: null,
      awayScore: null,
      played: false,
    });
  }
  return fixtures;
}

function statToAttribute(stats: Record<string, number>, keys: string[], fallback: number): number {
  const values = keys.map(key => stats[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return fallback;
  return Math.max(1, Math.min(20, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length / 5)));
}

function generateOfficialAttributes(data: typeof import('./superLig2026').SUPER_LIG_2026[number]['players'][number], reputation: number): Attributes {
  const stats = data.rating?.stats;
  if (stats) {
    const fallback = Math.max(5, Math.min(17, Math.round(6 + reputation * 0.55)));
    return {
      passing: statToAttribute(stats, ['shortPassing', 'longPassing', 'pas'], fallback),
      shooting: statToAttribute(stats, ['finishing', 'shotPower', 'sho'], fallback),
      dribbling: statToAttribute(stats, ['ballControl', 'dribbling', 'dri'], fallback),
      tackling: statToAttribute(stats, ['standingTackle', 'slidingTackle', 'def'], fallback),
      heading: statToAttribute(stats, ['headingAccuracy'], fallback),
      technique: statToAttribute(stats, ['ballControl'], fallback),
      vision: statToAttribute(stats, ['vision'], fallback),
      positioning: statToAttribute(stats, ['positioning', 'defensiveAwareness'], fallback),
      decisions: statToAttribute(stats, ['reactions'], fallback),
      workRate: statToAttribute(stats, ['stamina'], fallback),
      aggression: statToAttribute(stats, ['aggression'], fallback),
      composure: statToAttribute(stats, ['composure'], fallback),
      pace: statToAttribute(stats, ['acceleration', 'sprintSpeed', 'pac'], fallback),
      stamina: statToAttribute(stats, ['stamina'], fallback),
      strength: statToAttribute(stats, ['strength'], fallback),
      agility: statToAttribute(stats, ['agility'], fallback),
      goalkeeping: statToAttribute(stats, ['gkHandling', 'gkDiving', 'gkPositioning'], data.position === 'GK' ? fallback : 2),
      reflexes: statToAttribute(stats, ['gkReflexes'], data.position === 'GK' ? fallback : 2),
    };
  }

  const seed = data.id.split('').reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  const random = createRng(seed);
  const ageFactor = data.age == null ? 0 : data.age < 21 ? -1 : data.age > 32 ? -1 : 0;
  const base = Math.max(5, Math.min(17, Math.round(6 + reputation * 0.55 + ageFactor)));
  const weights = POSITION_WEIGHTS[data.position];
  const make = (key: keyof Attributes) => Math.max(1, Math.min(20, base + (weights[key] ?? 0) + Math.floor(random() * 5) - 2));
  return {
    passing: make('passing'), shooting: make('shooting'), dribbling: make('dribbling'),
    tackling: make('tackling'), heading: make('heading'), technique: make('technique'),
    vision: make('vision'), positioning: make('positioning'), decisions: make('decisions'),
    workRate: make('workRate'), aggression: make('aggression'), composure: make('composure'),
    pace: make('pace'), stamina: make('stamina'), strength: make('strength'), agility: make('agility'),
    goalkeeping: data.position === 'GK' ? make('goalkeeping') : 2,
    reflexes: data.position === 'GK' ? make('reflexes') : 2,
  };
}

function generateOfficialTeam(data: typeof import('./superLig2026').SUPER_LIG_2026[number]): Team {
  const players: Player[] = data.players.map(playerData => {
    const attributes = generateOfficialAttributes(playerData, data.reputation);
    const overall = calculateOverall({ attributes, position: playerData.position } as Player);
    const ageMultiplier = playerData.age == null ? 1 : playerData.age <= 21 ? 1.8 : playerData.age <= 25 ? 1.4 : playerData.age <= 29 ? 1 : playerData.age <= 32 ? 0.6 : 0.3;
    const value = Math.max(100_000, Math.round(Math.pow(Math.max(1, overall - 30), 3) * 100 * ageMultiplier));
    const wage = Math.max(10_000, Math.round((value * 0.003) / 52));
    return {
      id: playerData.id,
      name: playerData.name,
      age: playerData.age,
      nationality: playerData.nationality,
      position: playerData.position,
      altPositions: playerData.altPositions,
      shirtNumber: playerData.number,
      photoUrl: playerData.photoUrl,
      positionEstimated: playerData.positionEstimated,
      ratingSource: playerData.rating?.source ?? 'Oyun içi scout tahmini',
      attributes,
      condition: 95,
      morale: 70,
      wage,
      value,
      teamId: data.id,
      form: 6.5,
      injuredUntilDay: null,
      suspendedUntilDay: null,
      stats: { goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0 },
    };
  });

  return {
    id: data.id,
    tier: 1,
    name: data.name,
    shortName: data.shortName,
    city: data.city,
    color: data.color,
    stadium: data.stadium,
    logoUrl: data.logoUrl,
    reputation: data.reputation,
    balance: data.reputation * 5_000_000,
    players,
    tactics: generateDefaultTactics(players),
    stats: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  };
}

export function generateLeague(
  season: number = 1,
  existingTeamIds?: string[],
  tier: 1 | 2 = 1,
  officialSuperLigData?: typeof import('./superLig2026').SUPER_LIG_2026,
): { league: League, teams: Record<string, Team> } {
  const useOfficialSquads = tier === 1 && season === 1 && !existingTeamIds && !!officialSuperLigData;
  const teamsArray = existingTeamIds
    ? []
    : tier === 2
      ? LIG1_2026.map(template => generateTeam(template, 2))
      : useOfficialSquads
        ? officialSuperLigData!.map(generateOfficialTeam)
        : TEAM_TEMPLATES.map(template => generateTeam(template, 1));
  const teamsRecord: Record<string, Team> = {};
  teamsArray.forEach(t => { teamsRecord[t.id] = t; });

  const teamIds = existingTeamIds ? [...existingTeamIds] : teamsArray.map(t => t.id);
  const fixtures = generateFixtures(teamIds, season);
  const startYear = 2026 + season - 1;
  const seasonLabel = `${startYear}/${String(startYear + 1).slice(-2)}`;
  const league: League = {
    id: uid('league'),
    name: tier === 1 ? 'Süper Lig' : '1. Lig',
    tier,
    season,
    seasonLabel,
    teamIds,
    fixtures,
  };
  return { league, teams: teamsRecord };
}



