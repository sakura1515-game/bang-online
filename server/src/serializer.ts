import { Room } from './Room';

export function serializeForPlayer(room: Room, viewerId: string) {
  const engine = room.engine!;
  const viewer = room.players.find(p => p.id === viewerId);

  const players = room.players.map(p => ({
    id: p.id,
    name: p.name,
    role: (p.role === 'SHERIFF' || p.id === viewerId) ? p.role : 'UNKNOWN',
    hp: p.hp,
    maxHp: p.maxHp,
    handCount: p.hand.length,
    table: p.table,
    isAlive: p.isAlive,
    isBot: p.isBot,
  }));

  return {
    roomId: room.roomId,
    players,
    myHand: viewer ? viewer.hand : [],
    myRole: viewer ? viewer.role : 'UNKNOWN',
    currentTurnPlayerId: engine.currentPlayer.id,
    pendingAction: engine.pendingAction,
  };
}