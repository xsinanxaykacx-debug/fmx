import type { Team, MatchEvent, Player, Position } from '@/types/game';
import { calculateOverall } from '@/data/generator';

type MatchStats = { shots: number; shotsOnTarget: number; saves: number; possession: number; corners: number };

function activePlayers(team: Team, sentOff: Set<string>, injured: Set<string>, subbedOut: Set<string>): Player[] {
  return team.players.filter(player =>
    team.tactics.lineup.includes(player.id) &&
    player.injuredUntilDay == null &&
    !sentOff.has(player.id) &&
    !injured.has(player.id) &&
    !subbedOut.has(player.id)
  );
}

function average(players: Player[], selector: (player: Player) => number, fallback = 10): number {
  if (!players.length) return fallback;
  return players.reduce((sum, player) => sum + selector(player), 0) / players.length;
}

function averagePlayedCondition(players: Player[], minute: number, entryMinutes: Map<string, number>): number {
  let totalConditionMinutes = 0;
  let totalMinutes = 0;
  players.forEach(player => {
    const minutesPlayed = Math.max(1, minute - (entryMinutes.get(player.id) ?? 0));
    totalConditionMinutes += (player.condition ?? 100) * minutesPlayed;
    totalMinutes += minutesPlayed;
  });
  return totalMinutes ? totalConditionMinutes / totalMinutes : 100;
}

function roleAverage(
  players: Player[],
  role: 'attack' | 'midfield' | 'defense',
  minute: number,
  fallback = 48,
  entryMinutes: Map<string, number> = new Map()
): number {
  if (!players.length) return fallback;
  const totalWeight = players.reduce((sum, player) => sum + roleFit(player, role), 0);
  if (totalWeight <= 0) return fallback;
  const weighted = players.reduce(
    (sum, player) =>
      sum + playerSkillRating(player, minute, role, entryMinutes.get(player.id) ?? 0) * 5 * roleFit(player, role),
    0
  );
  return weighted / totalWeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickWeighted(players: Player[], weight: (player: Player) => number): Player | null {
  if (!players.length) return null;
  const weights = players.map(player => Math.max(0.1, weight(player)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let roll = Math.random() * total;
  for (let index = 0; index < players.length; index++) {
    roll -= weights[index];
    if (roll <= 0) return players[index];
  }
  return players[players.length - 1];
}

// Her mevkinin her saha rolüne katkısı farklıdır; alternatif mevki
// oyuncuya uyum sağlar ama doğal mevki kadar yüksek katkı vermez.
const POSITION_ROLE_FIT: Record<Exclude<Position, 'GK'>, Record<'attack' | 'midfield' | 'defense', number>> = {
  ST: { attack: 1, midfield: 0.42, defense: 0.08 },
  LW: { attack: 0.96, midfield: 0.82, defense: 0.28 },
  RW: { attack: 0.96, midfield: 0.82, defense: 0.28 },
  AM: { attack: 0.92, midfield: 0.96, defense: 0.18 },
  CM: { attack: 0.58, midfield: 1, defense: 0.58 },
  DM: { attack: 0.22, midfield: 0.96, defense: 0.94 },
  CB: { attack: 0.06, midfield: 0.28, defense: 1 },
  LB: { attack: 0.42, midfield: 0.58, defense: 0.96 },
  RB: { attack: 0.42, midfield: 0.58, defense: 0.96 },
};

function roleFit(player: Player, role: 'attack' | 'midfield' | 'defense' | 'keeper'): number {
  if (role === 'keeper') return player.position === 'GK' ? 1 : 0.12;
  if (player.position === 'GK') return 0.12;
  const naturalFit = POSITION_ROLE_FIT[player.position][role];
  const alternativeFit = (player.altPositions ?? []).reduce((best, position) => {
    if (position === 'GK') return best;
    return Math.max(best, POSITION_ROLE_FIT[position][role] * 0.9);
  }, 0);
  return Math.max(naturalFit, alternativeFit);
}

// 30% oyuncu kalitesi + mevkiye özgü nitelikler; kondisyon, form ve moral
// ayrı çarpanlarla uygulanır. Değerler 1-20 özellik ölçeğine normalize edilir.
function playerSkillRating(
  player: Player,
  minute: number,
  role: 'attack' | 'midfield' | 'defense' | 'keeper',
  entryMinute = 0
): number {
  const a = player.attributes;
  // Oyuncu oyuna sonradan girdiyse yorgunluğu kendi oynadığı dakikaya göre hesaplanır.
  const minutesPlayed = Math.max(0, minute - entryMinute);
  const matchLoad = clamp((minutesPlayed - 25) / 65, 0, 1);
  const stamina = clamp(a.stamina, 1, 20) / 20;
  const workRate = clamp(a.workRate, 1, 20) / 20;
  const fatigueRate = clamp(0.12 + (1 - stamina) * 0.2 - workRate * 0.04, 0.06, 0.3);
  const fatigue = clamp(1 - matchLoad * fatigueRate, 0.68, 1);
  // Düşük kondisyon maça başlarken de performansı sınırlar.
  const condition = clamp(0.72 + (clamp(player.condition ?? 100, 0, 100) / 100) * 0.28, 0.72, 1);
  const form = clamp(0.94 + ((player.form ?? 6) - 5) * 0.018, 0.88, 1.06);
  const morale = clamp(0.94 + ((player.morale ?? 70) - 70) * 0.0015, 0.9, 1.04);

  let attributeScore = 10;
  if (role === 'attack') {
    attributeScore = (a.shooting * 0.24 + a.dribbling * 0.18 + a.pace * 0.14 +
      a.positioning * 0.16 + a.composure * 0.12 + a.technique * 0.1 + a.decisions * 0.06);
  } else if (role === 'midfield') {
    attributeScore = (a.passing * 0.22 + a.vision * 0.2 + a.decisions * 0.18 +
      a.technique * 0.12 + a.dribbling * 0.1 + a.workRate * 0.1 + a.stamina * 0.08);
  } else if (role === 'defense') {
    attributeScore = (a.tackling * 0.24 + a.positioning * 0.22 + a.strength * 0.16 +
      a.heading * 0.12 + a.decisions * 0.12 + a.pace * 0.08 + a.aggression * 0.06);
  } else {
    attributeScore = (a.goalkeeping * 0.34 + a.reflexes * 0.3 + a.positioning * 0.18 +
      a.composure * 0.1 + a.decisions * 0.08);
  }

  const overall = calculateOverall(player);
  const quality = overall / 5;
  const blendedSkill = quality * 0.58 + attributeScore * 0.42;
  return blendedSkill * fatigue * condition * form * morale;
}

function playerRating(
  player: Player,
  minute: number,
  role: 'attack' | 'midfield' | 'defense' | 'keeper',
  entryMinute = 0
): number {
  return playerSkillRating(player, minute, role, entryMinute) * roleFit(player, role);
}

function getTeamStrength(
  team: Team,
  sentOff: Set<string>,
  injured: Set<string>,
  subbedOut: Set<string>,
  minute: number,
  goalDifference: number,
  entryMinutes: Map<string, number>
) {
  const players = activePlayers(team, sentOff, injured, subbedOut);
  const outfield = players.filter(player => player.position !== 'GK');
  const attackers = outfield.filter(player => roleFit(player, 'attack') >= 0.35);
  const midfielders = outfield.filter(player => roleFit(player, 'midfield') >= 0.35);
  const defenders = outfield.filter(player => roleFit(player, 'defense') >= 0.35);
  const keepers = players.filter(player => player.position === 'GK');

  const mentality = team.tactics.mentality;
  const tempo = team.tactics.tempo;
  const pressing = team.tactics.pressing;
  const chasing = minute >= 68 && goalDifference < 0;
  const protectingLead = minute >= 72 && goalDifference > 0;

  const mentalityAttack = (mentality === 'attacking' ? 1.055 : mentality === 'defensive' ? 0.94 : 1) *
    (chasing ? 1.075 : protectingLead ? 0.95 : 1);
  const mentalityDefense = (mentality === 'defensive' ? 1.07 : mentality === 'attacking' ? 0.94 : 1) *
    (chasing ? 0.95 : protectingLead ? 1.05 : 1);
  const tempoAttack = (tempo === 'high' ? 1.035 : tempo === 'low' ? 0.975 : 1) * (chasing ? 1.035 : 1);
  const pressingFactor = (pressing === 'high' ? 1.08 : pressing === 'low' ? 0.94 : 1) *
    (chasing ? 1.05 : protectingLead ? 0.96 : 1);

  const attackBase = roleAverage(attackers, 'attack', minute, 48, entryMinutes);
  const midfieldBase = roleAverage(midfielders, 'midfield', minute, 48, entryMinutes);
  const defenseBase = roleAverage(defenders, 'defense', minute, 48, entryMinutes);
  const keeperBase = average(keepers, player =>
    playerRating(player, minute, 'keeper', entryMinutes.get(player.id) ?? 0) * 5, 48);

  // Rol derinliği, sadece oyuncu sayısıyla değil mevki uyumuyla ölçülür.
  const outfieldCoverage = clamp(outfield.length / 10, 0.55, 1);
  const attackFitDepth = attackers.reduce((sum, player) => sum + roleFit(player, 'attack'), 0);
  const midfieldFitDepth = midfielders.reduce((sum, player) => sum + roleFit(player, 'midfield'), 0);
  const defenseFitDepth = defenders.reduce((sum, player) => sum + roleFit(player, 'defense'), 0);
  // Dizilişin beklediği rol dağılımı ile sahadaki gerçek oyuncu profili karşılaştırılır.
  // Oyuncu değişikliği sonrası yeni mevki dağılımı her dakika yeniden hesaplanır.
  const formationNeeds = {
    '4-4-2': { attack: 3.0, midfield: 4.0, defense: 4.0 },
    '4-3-3': { attack: 3.5, midfield: 3.5, defense: 4.0 },
    '4-2-3-1': { attack: 3.2, midfield: 4.2, defense: 3.8 },
  }[team.tactics.formation];

  const attackCoverage = clamp(attackFitDepth / formationNeeds.attack, 0.58, 1.08);
  const midfieldCoverage = clamp(midfieldFitDepth / formationNeeds.midfield, 0.58, 1.08);
  const defenseCoverage = clamp(defenseFitDepth / formationNeeds.defense, 0.58, 1.08);

  // Dengesiz değişiklikler diğer hatları da etkiler: hücumcu eklemek savunma
  // güvenliğini azaltabilir; savunmacı eklemek hücum bağlantısını zayıflatabilir.
  const attackDefenseGap = attackFitDepth - defenseFitDepth;
  const midfieldBalance = clamp(1 - Math.abs(midfieldFitDepth - formationNeeds.midfield) * 0.025, 0.9, 1);
  const defensiveExposure = clamp(1 - Math.max(0, attackDefenseGap - 0.5) * 0.035, 0.88, 1);
  const attackingSupport = clamp(1 - Math.max(0, defenseFitDepth - attackFitDepth - 1) * 0.018, 0.92, 1);

  return {
    players,
    attack: attackBase * mentalityAttack * tempoAttack * attackCoverage * midfieldBalance * attackingSupport * outfieldCoverage,
    midfield: midfieldBase * (tempo === 'high' ? 1.015 : tempo === 'low' ? 0.985 : 1) * midfieldCoverage * outfieldCoverage,
    defense: defenseBase * mentalityDefense * defenseCoverage * defensiveExposure * outfieldCoverage,
    keeper: keeperBase,
    pressing: pressingFactor,
    keeperPlayer: pickWeighted(keepers, player => player.attributes.reflexes + player.attributes.goalkeeping),
  };
}

// Dizilişler mutlak üstünlük sağlamaz; küçük eşleşme avantajları üretir.
function formationMatchup(attackFormation: Team['tactics']['formation'], defendFormation: Team['tactics']['formation']): number {
  const edges: Record<Team['tactics']['formation'], Partial<Record<Team['tactics']['formation'], number>>> = {
    '4-4-2': { '4-3-3': 0.012, '4-2-3-1': -0.008 },
    '4-3-3': { '4-4-2': -0.012, '4-2-3-1': 0.018 },
    '4-2-3-1': { '4-4-2': 0.008, '4-3-3': -0.018 },
  };
  return edges[attackFormation]?.[defendFormation] ?? 0;
}

function pickAttacker(
  team: Team, sentOff: Set<string>, injured: Set<string>, subbedOut: Set<string>, minute: number,
  entryMinutes: Map<string, number>
): Player | null {
  const candidates = activePlayers(team, sentOff, injured, subbedOut).filter(player => player.position !== 'GK');
  return pickWeighted(candidates, player =>
    playerRating(player, minute, 'attack', entryMinutes.get(player.id) ?? 0) *
    (player.attributes.shooting + player.attributes.positioning + player.attributes.composure)
  );
}

function pickDefender(
  team: Team, sentOff: Set<string>, injured: Set<string>, subbedOut: Set<string>, minute: number,
  entryMinutes: Map<string, number>
): Player | null {
  const candidates = activePlayers(team, sentOff, injured, subbedOut).filter(player =>
    player.position !== 'GK' && roleFit(player, 'defense') >= 0.35
  );
  return pickWeighted(candidates, player =>
    playerRating(player, minute, 'defense', entryMinutes.get(player.id) ?? 0) *
    (player.attributes.tackling + player.attributes.positioning)
  );
}

// Katman 1: takım gücü. Katman 2: pozisyon üretimi. Katman 3: şutun sonucu.
export function simulateMatch(
  homeTeam: Team,
  awayTeam: Team,
  options: { startMinute?: number; initialHomeScore?: number; initialAwayScore?: number; initialHomePossessionMinutes?: number; initialAwayPossessionMinutes?: number; priorEvents?: MatchEvent[] } = {}
): {
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  homeStats: MatchStats;
  awayStats: MatchStats;
} {
  const startMinute = clamp(options.startMinute ?? 0, 0, 90);
  const priorEvents = options.priorEvents ?? [];
  let homeScore = options.initialHomeScore ?? priorEvents.filter(event => event.type === 'goal' && event.teamId === homeTeam.id).length;
  let awayScore = options.initialAwayScore ?? priorEvents.filter(event => event.type === 'goal' && event.teamId === awayTeam.id).length;
  const events: MatchEvent[] = startMinute === 0 && priorEvents.length === 0 ? [{
    minute: 0,
    type: 'kickoff',
    text: `Maç başladı! ${homeTeam.name} - ${awayTeam.name}`,
  }] : [];
  const homeStats: MatchStats = { shots: 0, shotsOnTarget: 0, saves: 0, possession: 50, corners: 0 };
  const awayStats: MatchStats = { shots: 0, shotsOnTarget: 0, saves: 0, possession: 50, corners: 0 };
  const homeSentOff = new Set<string>();
  const awaySentOff = new Set<string>();
  const homeInjured = new Set<string>();
  const awayInjured = new Set<string>();
  const homeSubbedOut = new Set<string>();
  const awaySubbedOut = new Set<string>();
  const yellowCards: Record<string, number> = {};
  const entryMinutes = new Map<string, number>();
  priorEvents.forEach(event => {
    if (event.type === 'substitution') {
      const incomingPlayerId = event.playerInId ?? event.assisterId;
      if (incomingPlayerId) entryMinutes.set(incomingPlayerId, event.minute);
      const outgoingPlayerId = event.playerOutId ?? event.playerId;
      if (outgoingPlayerId) {
        const subbedOut = event.teamId === homeTeam.id ? homeSubbedOut : awaySubbedOut;
        subbedOut.add(outgoingPlayerId);
      }
    }
    if (event.teamId) {
      const stats = event.teamId === homeTeam.id ? homeStats : event.teamId === awayTeam.id ? awayStats : null;
      if (stats && ['goal', 'save', 'miss'].includes(event.type)) stats.shots++;
      if (stats && ['goal', 'save'].includes(event.type)) stats.shotsOnTarget++;
      if (event.type === 'save' && event.opponentTeamId) {
        const defendingStats = event.opponentTeamId === homeTeam.id ? homeStats : awayStats;
        defendingStats.saves++;
      }
      if (stats && event.type === 'corner') stats.corners++;
    }
    if (!event.playerId || !event.teamId) return;
    const sentOff = event.teamId === homeTeam.id ? homeSentOff : awaySentOff;
    const injured = event.teamId === homeTeam.id ? homeInjured : awayInjured;
    if (event.type === 'yellow') yellowCards[event.playerId] = (yellowCards[event.playerId] ?? 0) + 1;
    if (event.type === 'red') sentOff.add(event.playerId);
    if (event.type === 'injury') injured.add(event.playerId);
  });
  const lastTurnover = [...priorEvents].reverse().find(event => event.type === 'turnover');
  let possessionTeam = lastTurnover?.teamId === homeTeam.id
    ? homeTeam
    : lastTurnover?.teamId === awayTeam.id
      ? awayTeam
      : Math.random() < 0.54 ? homeTeam : awayTeam;
  let homePossessionMinutes = options.initialHomePossessionMinutes ?? Math.round(startMinute * 0.5);
  let awayPossessionMinutes = options.initialAwayPossessionMinutes ?? (startMinute - homePossessionMinutes);

  for (let minute = startMinute + 1; minute <= 90; minute++) {
    const homeStrength = getTeamStrength(homeTeam, homeSentOff, homeInjured, homeSubbedOut, minute, homeScore - awayScore, entryMinutes);
    const awayStrength = getTeamStrength(awayTeam, awaySentOff, awayInjured, awaySubbedOut, minute, awayScore - homeScore, entryMinutes);
    const isHomePossession = possessionTeam.id === homeTeam.id;
    const attackTeam = isHomePossession ? homeTeam : awayTeam;
    const defendTeam = isHomePossession ? awayTeam : homeTeam;
    const attackSentOff = isHomePossession ? homeSentOff : awaySentOff;
    const defendSentOff = isHomePossession ? awaySentOff : homeSentOff;
    const attackInjured = isHomePossession ? homeInjured : awayInjured;
    const defendInjured = isHomePossession ? awayInjured : homeInjured;
    const attackSubbedOut = isHomePossession ? homeSubbedOut : awaySubbedOut;
    const defendSubbedOut = isHomePossession ? awaySubbedOut : homeSubbedOut;
    const attackStrength = isHomePossession ? homeStrength : awayStrength;
    const defendStrength = isHomePossession ? awayStrength : homeStrength;
    const attackStats = isHomePossession ? homeStats : awayStats;

    if (isHomePossession) homePossessionMinutes++;
    else awayPossessionMinutes++;

    let possessionChangedThisMinute = false;
    // İç saha etkisi yalnızca ev sahibi hücumunda küçük bir avantaj sağlar.
    const homeEdge = isHomePossession ? 0.018 : -0.006;
    const attackTeamScore = isHomePossession ? homeScore : awayScore;
    const defendTeamScore = isHomePossession ? awayScore : homeScore;
    const chasingLate = minute >= 68 && attackTeamScore < defendTeamScore;
    const protectingLeadLate = minute >= 72 && attackTeamScore > defendTeamScore;
    const scoreStateAttack = chasingLate ? 0.028 : protectingLeadLate ? -0.014 : 0;
    const midfieldEdge = attackStrength.midfield - defendStrength.midfield;
    const formationEdge = formationMatchup(attackTeam.tactics.formation, defendTeam.tactics.formation);
    const progressChance = clamp(
      0.43 + midfieldEdge / 430 + (attackTeam.tactics.tempo === 'high' ? 0.025 : 0) + formationEdge + homeEdge + (chasingLate ? 0.012 : 0),
      0.32, 0.56
    );
    const turnoverChance = clamp(
      0.22 + (defendStrength.pressing - 1) * 0.28 - midfieldEdge / 850,
      0.14, 0.34
    );

    if (Math.random() < progressChance) {
      // Pozisyon üretimi: hücum gücü, rakip savunma, taktik riski ve pres.
      const attackVsDefense = attackStrength.attack - defendStrength.defense;
      const attackChance = clamp(
        0.235 + attackVsDefense / 950 +
        (attackTeam.tactics.mentality === 'attacking' ? 0.025 : 0) +
        (defendTeam.tactics.pressing === 'high' ? -0.018 : 0) + formationEdge + homeEdge + scoreStateAttack,
        0.14, 0.34
      );

      if (Math.random() < attackChance) {
        attackStats.shots++;
        const shooter = pickAttacker(attackTeam, attackSentOff, attackInjured, attackSubbedOut, minute, entryMinutes);
        const keeper = defendStrength.keeperPlayer;
        const defender = pickDefender(defendTeam, defendSentOff, defendInjured, defendSubbedOut, minute, entryMinutes);

        if (shooter) {
          // Şut kalitesi: bitiricilik/teknik/soğukkanlılık; rakip baskısı ve kaleci ayrı.
          const a = shooter.attributes;
          const shotSkill = (a.shooting * 0.38 + a.composure * 0.2 +
            a.technique * 0.16 + a.positioning * 0.14 + a.decisions * 0.12) / 20;
          const keeperSkill = clamp(defendStrength.keeper / 100, 0.08, 0.95);
          const defensivePressure = defender
            ? (defender.attributes.tackling * 0.45 + defender.attributes.positioning * 0.35 +
              defender.attributes.strength * 0.2) / 20
            : 0.35;
          const shotQuality = clamp(
            0.5 + (shotSkill - 0.5) * 0.8 - (defensivePressure - 0.5) * 0.34,
            0.22, 0.88
          );
          const goalChance = clamp(
            0.18 + shotQuality * 0.14 - keeperSkill * 0.035 +
            attackVsDefense / 2200,
            0.12, 0.3
          );

          if (Math.random() < goalChance) {
            attackStats.shotsOnTarget++;
            if (isHomePossession) homeScore++;
            else awayScore++;
            const assisterPool = activePlayers(attackTeam, attackSentOff, attackInjured, attackSubbedOut).filter(player =>
              player.id !== shooter.id &&
              ['CM', 'DM', 'AM', 'LW', 'RW', 'LB', 'RB'].includes(player.position)
            );
            const assister = pickWeighted(assisterPool, player =>
              player.attributes.passing + player.attributes.vision + player.attributes.decisions
            );
            events.push({
              minute, type: 'goal', teamId: attackTeam.id, playerId: shooter.id, assisterId: assister?.id,
              text: `⚽ GOL! ${shooter.name} (${attackTeam.shortName})${assister ? ` - Asist: ${assister.name}` : ''}. Skor: ${homeScore}-${awayScore}`,
            });
          } else if (Math.random() < clamp(0.28 + keeperSkill * 0.36, 0.3, 0.68)) {
            attackStats.shotsOnTarget++;
            const defendingStats = isHomePossession ? awayStats : homeStats;
            defendingStats.saves++;
            events.push({
              minute, type: 'save', teamId: attackTeam.id, opponentTeamId: defendTeam.id,
              playerId: shooter.id, assisterId: keeper?.id,
              text: `🧤 ${shooter.name} şut çekti, ${keeper?.name ?? 'kaleci'} kurtardı!`,
            });
          } else {
            events.push({
              minute, type: 'miss', teamId: attackTeam.id, playerId: shooter.id,
              text: `🎯 ${shooter.name} şutu auta gönderdi.`,
            });
          }
        }

        if (Math.random() < 0.38) {
          attackStats.corners++;
          events.push({ minute, type: 'corner', teamId: attackTeam.id, text: `🚩 ${attackTeam.shortName} korner kazandı.` });

          // Korner: ortayı yapan oyuncu ve hava topunda etkili hücumcu ayrı seçilir.
          if (Math.random() < 0.45) {
            const cornerPlayers = activePlayers(attackTeam, attackSentOff, attackInjured, attackSubbedOut);
            const cornerTaker = pickWeighted(cornerPlayers, player =>
              player.attributes.passing * 0.65 + player.attributes.vision * 0.35
            );
            const headerPlayer = pickWeighted(
              cornerPlayers.filter(player => player.position !== 'GK'),
              player => player.attributes.heading * 0.55 + player.attributes.strength * 0.25 +
                player.attributes.positioning * 0.2
            );
            const cornerKeeper = defendStrength.keeperPlayer;
            if (headerPlayer) {
              attackStats.shots++;
              const cornerKeeperSkill = clamp(defendStrength.keeper / 100, 0.08, 0.95);
              const headerChance = clamp(
                0.075 + (headerPlayer.attributes.heading - 10) / 260 - cornerKeeperSkill * 0.018,
                0.035, 0.12
              );
              if (Math.random() < headerChance) {
                attackStats.shotsOnTarget++;
                if (isHomePossession) homeScore++;
                else awayScore++;
                events.push({
                  minute, type: 'goal', teamId: attackTeam.id, playerId: headerPlayer.id,
                  assisterId: cornerTaker?.id,
                  text: `⚽ KORNERDEN GOL! ${headerPlayer.name} kafa vuruşuyla ağları buldu. Skor: ${homeScore}-${awayScore}`,
                });
              } else if (Math.random() < 0.38) {
                attackStats.shotsOnTarget++;
                const defendingStats = isHomePossession ? awayStats : homeStats;
                defendingStats.saves++;
                events.push({
                  minute, type: 'save', teamId: attackTeam.id, opponentTeamId: defendTeam.id,
                  playerId: headerPlayer.id, assisterId: cornerKeeper?.id,
                  text: `🧤 ${headerPlayer.name} kafa vurdu, ${cornerKeeper?.name ?? 'kaleci'} kurtardı!`,
                });
              } else {
                events.push({
                  minute, type: 'miss', teamId: attackTeam.id, playerId: headerPlayer.id,
                  text: `🎯 ${headerPlayer.name} kornerden gelen topa vurdu ancak isabet bulamadı.`,
                });
              }
            }
          }
        }
      } else if (Math.random() < turnoverChance) {
        possessionTeam = defendTeam;
        possessionChangedThisMinute = true;
        events.push({ minute, type: 'turnover', teamId: defendTeam.id, text: `${defendTeam.shortName} topu kazandı.` });
      }
    } else if (Math.random() < turnoverChance) {
      possessionTeam = defendTeam;
      possessionChangedThisMinute = true;
      events.push({ minute, type: 'turnover', teamId: defendTeam.id, text: `${defendTeam.shortName} topu kazandı.` });
    }

    // Topun maç boyunca el değiştirmesi: mevcut top sahibi hücum eden takımsa
    // savunmacı takımın topu kapması için ek, bağımsız bir turnover ihtimali.
    if (!possessionChangedThisMinute && possessionTeam.id === attackTeam.id && Math.random() < 0.27) {
      possessionTeam = defendTeam;
      events.push({ minute, type: 'turnover', teamId: defendTeam.id, text: `${defendTeam.shortName} topu kaptı.` });
    }

    if (Math.random() < 0.025) {
      const foulTeam = Math.random() < 0.5 ? homeTeam : awayTeam;
      const isHomeFoul = foulTeam.id === homeTeam.id;
      const sentOff = foulTeam.id === homeTeam.id ? homeSentOff : awaySentOff;
      const injured = foulTeam.id === homeTeam.id ? homeInjured : awayInjured;
      const foulSubbedOut = isHomeFoul ? homeSubbedOut : awaySubbedOut;
      const player = pickDefender(foulTeam, sentOff, injured, foulSubbedOut, minute, entryMinutes);
      if (player) {
        // Her faul kart değildir; ikinci sarı ve direkt kırmızı daha seyrek oluşur.
        if (Math.random() < 0.62) {
          yellowCards[player.id] = (yellowCards[player.id] ?? 0) + 1;
          if (yellowCards[player.id] >= 2 || Math.random() < 0.0025) {
            sentOff.add(player.id);
            events.push({
              minute, type: 'red', teamId: foulTeam.id, playerId: player.id,
              text: `🟥 KIRMIZI KART! ${player.name} (${foulTeam.shortName}) oyundan atıldı!`,
            });
          } else {
            events.push({
              minute, type: 'yellow', teamId: foulTeam.id, playerId: player.id,
              text: `🟨 ${player.name} (${foulTeam.shortName}) sarı kart gördü.`,
            });
          }
        } else {
          events.push({
            minute, type: 'commentary', teamId: foulTeam.id,
            text: `⚖️ ${player.name} (${foulTeam.shortName}) faul yaptı.`,
          });
        }

        // Faulün ceza sahasında olma ihtimali düşük; penaltı ayrı bir şut olarak çözülür.
        if (Math.random() < 0.08) {
          const penaltyTeam = isHomeFoul ? awayTeam : homeTeam;
          const penaltySentOff = penaltyTeam.id === homeTeam.id ? homeSentOff : awaySentOff;
          const penaltyInjured = penaltyTeam.id === homeTeam.id ? homeInjured : awayInjured;
          const penaltySubbedOut = penaltyTeam.id === homeTeam.id ? homeSubbedOut : awaySubbedOut;
          const penaltyStats = penaltyTeam.id === homeTeam.id ? homeStats : awayStats;
          const penaltyTaker = pickWeighted(
            activePlayers(penaltyTeam, penaltySentOff, penaltyInjured, penaltySubbedOut).filter(candidate => candidate.position !== 'GK'),
            candidate => candidate.attributes.shooting * 0.65 + candidate.attributes.composure * 0.35
          );
          const penaltyKeeper = (isHomeFoul ? awayStrength : homeStrength).keeperPlayer;
          if (penaltyTaker) {
            events.push({ minute, type: 'commentary', teamId: penaltyTeam.id, text: `⚽ ${penaltyTeam.shortName} penaltı kazandı!` });
            penaltyStats.shots++;
            const keeperPenaltySkill = penaltyKeeper
              ? (penaltyKeeper.attributes.goalkeeping * 0.6 + penaltyKeeper.attributes.reflexes * 0.4) / 20
              : 0.5;
            const penaltyGoalChance = clamp(
              0.77 + ((penaltyTaker.attributes.shooting + penaltyTaker.attributes.composure) / 40 - 0.5) * 0.2 -
                (keeperPenaltySkill - 0.5) * 0.12,
              0.68, 0.9
            );
            if (Math.random() < penaltyGoalChance) {
              penaltyStats.shotsOnTarget++;
              if (penaltyTeam.id === homeTeam.id) homeScore++;
              else awayScore++;
              events.push({
                minute, type: 'goal', teamId: penaltyTeam.id, playerId: penaltyTaker.id,
                text: `⚽ PENALTI GOL! ${penaltyTaker.name} topu ağlara gönderdi. Skor: ${homeScore}-${awayScore}`,
              });
            } else if (Math.random() < 0.65) {
              penaltyStats.shotsOnTarget++;
              const defendingStats = isHomeFoul ? homeStats : awayStats;
              defendingStats.saves++;
              events.push({
                minute, type: 'save', teamId: penaltyTeam.id, opponentTeamId: foulTeam.id,
                playerId: penaltyTaker.id, assisterId: penaltyKeeper?.id,
                text: `🧤 PENALTI KURTARILDI! ${penaltyKeeper?.name ?? 'Kaleci'} ${penaltyTaker.name}'in vuruşunu çıkardı.`,
              });
            } else {
              events.push({
                minute, type: 'miss', teamId: penaltyTeam.id, playerId: penaltyTaker.id,
                text: `❌ PENALTI KAÇTI! ${penaltyTaker.name} fırsatı değerlendiremedi.`,
              });
            }
          }
        }
      }
    }

    const matchLoad = clamp((minute - 25) / 65, 0, 1);
    const averageCondition = (averagePlayedCondition(homeStrength.players, minute, entryMinutes) +
      averagePlayedCondition(awayStrength.players, minute, entryMinutes)) / 2;
    const highIntensity = Number(homeTeam.tactics.tempo === 'high' || awayTeam.tactics.tempo === 'high') * 0.00025 +
      Number(homeTeam.tactics.pressing === 'high' || awayTeam.tactics.pressing === 'high') * 0.0002;
    const injuryChance = 0.00065 + matchLoad * 0.0011 +
      ((100 - averageCondition) / 100) * 0.0007 + highIntensity;
    if (Math.random() < injuryChance) {
      const injuredTeam = Math.random() < 0.5 ? homeTeam : awayTeam;
      const sentOff = injuredTeam.id === homeTeam.id ? homeSentOff : awaySentOff;
      const injured = injuredTeam.id === homeTeam.id ? homeInjured : awayInjured;
      const player = pickWeighted(
        activePlayers(injuredTeam, sentOff, injured, injuredTeam.id === homeTeam.id ? homeSubbedOut : awaySubbedOut),
        candidate => (21 - candidate.attributes.stamina) * 1.1 +
          (21 - candidate.attributes.agility) * 0.4 +
          (100 - (candidate.condition ?? 100)) * 0.05
      );
      if (player) {
        injured.add(player.id);
        events.push({
          minute, type: 'injury', teamId: injuredTeam.id, playerId: player.id,
          text: `🚑 ${player.name} (${injuredTeam.shortName}) sakatlandı ve oyuna devam edemiyor!`,
        });
      }
    }

    if (minute === 45 && startMinute < 45 && !priorEvents.some(event => event.type === 'halftime')) {
      events.push({ minute, type: 'halftime', text: `⏸️ İlk yarı sona erdi. Skor: ${homeScore}-${awayScore}` });
    }
  }

  const playedMinutes = 90;
  homeStats.possession = Math.round(homePossessionMinutes / Math.max(1, playedMinutes) * 100);
  awayStats.possession = 100 - homeStats.possession;
  events.push({
    minute: 90, type: 'fulltime',
    text: `🏁 Maç sona erdi! Sonuç: ${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}`,
  });
  return { homeScore, awayScore, events, homeStats, awayStats, homePossessionMinutes, awayPossessionMinutes };
}