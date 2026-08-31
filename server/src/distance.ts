import { Player } from './types';

const WEAPONS: Record<string, number> = {
  VOLCANIC: 1,
  SCHOFIELD: 2,
};

export function calculateDistance(attacker: Player, target: Player, aliveList: Player[]) {
  if (attacker.id === target.id) return { actualDistance: 0, reachableRange: 0, canAttack: false };

  const N = aliveList.length;
  const aIdx = aliveList.findIndex(p => p.id === attacker.id);
  const tIdx = aliveList.findIndex(p => p.id === target.id);

  const rawDiff = Math.abs(aIdx - tIdx);
  const baseDistance = Math.min(rawDiff, N - rawDiff);

  const defMod = target.table.mustang ? 1 : 0;
  const atkMod = attacker.table.scope ? 1 : 0;
  const actualDistance = baseDistance + defMod - atkMod;

  let reachableRange = 1;
  if (attacker.table.weapon) {
    reachableRange = WEAPONS[attacker.table.weapon.name] || 1;
  }

  return {
    actualDistance,
    reachableRange,
    canAttack: reachableRange >= actualDistance,
  };
}