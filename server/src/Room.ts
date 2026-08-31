import { Player } from './types';
import { getRolesForCount } from './rules';
import { GameEngine } from './GameEngine';

export interface ExtendedPlayer extends Player {
  isBot: boolean;
  socketId?: string;
}

export class Room {
  roomId: string;
  maxPlayers: number;
  players: ExtendedPlayer[] = [];
  engine: GameEngine | null = null;
  isGameStarted: boolean = false;

  constructor(roomId: string, maxPlayers: number) {
    this.roomId = roomId;
    this.maxPlayers = maxPlayers;
  }

  join(userId: string, userName: string, socketId: string) {
    if (this.players.length >= this.maxPlayers) throw new Error('방 정원 초과');
    this.players.push({
      id: userId,
      name: userName,
      role: 'OUTLAW',
      hp: 4,
      maxHp: 4,
      hand: [],
      table: {},
      isAlive: true,
      isBot: false,
      socketId,
    });
  }

  startGame() {
    const needBots = this.maxPlayers - this.players.length;
    for (let i = 1; i <= needBots; i++) {
      this.players.push({
        id: `BOT_${i}_${Math.random().toString(36).substring(2, 5)}`,
        name: `AI_봇_${i}`,
        role: 'OUTLAW',
        hp: 4,
        maxHp: 4,
        hand: [],
        table: {},
        isAlive: true,
        isBot: true,
      });
    }

    this.players.sort(() => Math.random() - 0.5);
    const roles = getRolesForCount(this.maxPlayers);

    this.players.forEach((p, idx) => {
      p.role = roles[idx];
      if (p.role === 'SHERIFF') {
        p.maxHp = 5;
        p.hp = 5;
      }
    });

    const sIdx = this.players.findIndex(p => p.role === 'SHERIFF');
    if (sIdx > 0) {
      this.players = [...this.players.slice(sIdx), ...this.players.slice(0, sIdx)];
    }

    this.isGameStarted = true;
    this.engine = new GameEngine(this.players);
    this.engine.startTurn();
  }
}