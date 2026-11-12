
export type Position =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'DM' | 'CM' | 'AM' | 'LW' | 'RW' | 'ST';

export interface Attributes {
  passing: number; shooting: number; dribbling: number; tackling: number;
  heading: number; technique: number;
  vision: number; positioning: number; decisions: number;
  workRate: number; aggression: number; composure: number;
  pace: number; stamina: number; strength: number; agility: number;
  goalkeeping: number; reflexes: number;
}

export interface Player {
  id: string;
  name: string;
  age: number | null;
  nationality: string;
  position: Position;
  altPositions: Position[];
  shirtNumber?: number;
  photoUrl?: string;
  positionEstimated?: boolean;
  ratingSource?: string;
  attributes: Attributes;
  condition: number;
  morale: number;
  wage: number;
  value: number;
  teamId: string;
  form: number;
  injuredUntilDay: number | null;
  suspendedUntilDay: number | null;
  stats: { goals: number; assists: number; appearances: number; yellowCards: number; redCards: number };
}

export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1';

export interface TeamTactics {
  customPositions?: { x: number, y: number }[];
  formation: Formation;
  lineup: string[];
  tempo: 'low' | 'normal' | 'high';
  pressing: 'low' | 'normal' | 'high';
  mentality: 'defensive' | 'balanced' | 'attacking';
}

export interface Team {
  tier?: 1 | 2;
  id: string;
  name: string;
  shortName: string;
  city: string;
  color: string;
  stadium: string;
  logoUrl?: string;
  reputation: number;
  balance: number;
  players: Player[];
  tactics: TeamTactics;
  stats: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number };
}

export type MatchEventType =
  | 'kickoff' | 'goal' | 'shot' | 'save' | 'miss' | 'yellow' | 'red'
  | 'injury' | 'substitution' | 'halftime' | 'fulltime' | 'commentary' | 'corner' | 'turnover';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  teamId?: string;
  opponentTeamId?: string;
  playerId?: string;
  assisterId?: string;
  playerInId?: string;
  playerOutId?: string;
  text: string;
}

export interface MatchFixture {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
  events?: MatchEvent[];
}

export interface League {
  tier: 1 | 2;
  id: string;
  name: string;
  season: number;
  seasonLabel?: string;
  teamIds: string[];
  fixtures: MatchFixture[];
}

export type NewsCategory = 'transfer' | 'match' | 'injury' | 'finance' | 'board' | 'general';

export interface NewsItem {
  id: string;
  day: number;
  category: NewsCategory;
  title: string;
  body: string;
  read: boolean;
}

export interface FinanceRecord {
  id: string;
  day: number;
  type: 'income' | 'expense';
  category: 'matchday' | 'sponsor' | 'transfer' | 'wages' | 'prize' | 'other';
  amount: number;
  description: string;
}

export interface TransferOffer {
  id: string;
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
  amount: number;
  wage: number;
  status: 'pending' | 'accepted' | 'rejected';
  day: number;
}

