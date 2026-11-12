
import { calculateOverall } from '@/data/generator';
import type { Player, Position, Team } from '@/types/game';

export function isPlayerAvailableForMatch(player: Player, day: number): boolean {
  const injured = player.injuredUntilDay == null || player.injuredUntilDay <= day;
  const suspended = player.suspendedUntilDay == null || player.suspendedUntilDay < day;
  return injured && suspended;
}

export function getMatchdayLineup(team: Team, day: number): string[] {
  const availablePlayers = team.players.filter(player => isPlayerAvailableForMatch(player, day));
  const originalLineup = team.tactics.lineup.slice(0, 11);
  const usedPlayerIds = new Set<string>();
  const lineup: string[] = [];

  for (let index = 0; index < 11; index++) {
    const currentPlayer = team.players.find(player => player.id === originalLineup[index]);
    if (currentPlayer && isPlayerAvailableForMatch(currentPlayer, day) && !usedPlayerIds.has(currentPlayer.id)) {
      lineup.push(currentPlayer.id);
      usedPlayerIds.add(currentPlayer.id);
      continue;
    }

    const targetPosition: Position | undefined = currentPlayer?.position;
    const replacement = availablePlayers
      .filter(player => !usedPlayerIds.has(player.id))
      .sort((a, b) => {
        const aFit = targetPosition
          ? (a.position === targetPosition ? 2 : (a.altPositions ?? []).includes(targetPosition) ? 1 : 0)
          : 0;
        const bFit = targetPosition
          ? (b.position === targetPosition ? 2 : (b.altPositions ?? []).includes(targetPosition) ? 1 : 0)
          : 0;
        return bFit - aFit || calculateOverall(b) - calculateOverall(a);
      })[0];

    if (replacement) {
      lineup.push(replacement.id);
      usedPlayerIds.add(replacement.id);
    }
  }

  return lineup;
}


