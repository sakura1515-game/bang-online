import { Player, Card, PendingAction, Role } from './types';
import { calculateDistance } from './distance';

export class GameEngine {
  players: Player[];
  deck: Card[] = [];
  discardPile: Card[] = [];
  currentTurnIdx: number = 0;
  bangUsedThisTurn: boolean = false;
  pendingAction: PendingAction | null = null;

  constructor(players: Player[]) {
    this.players = players;
    this.initDeck();
    this.dealInitialCards();
  }

  get alivePlayers(): Player[] {
    return this.players.filter(p => p.isAlive);
  }

  get currentPlayer(): Player {
    return this.players[this.currentTurnIdx];
  }

  private initDeck() {
    const list: Card[] = [];
    const suits: Card['suit'][] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];

    for (let i = 0; i < 28; i++) {
      list.push({ id: `bang_${i}`, name: 'BANG', type: 'BROWN', suit: suits[i % 4], rank: (i % 13) + 1 });
    }
    for (let i = 0; i < 14; i++) {
      list.push({ id: `missed_${i}`, name: 'MISSED', type: 'BROWN', suit: suits[i % 4], rank: (i % 13) + 1 });
    }
    for (let i = 0; i < 6; i++) {
      list.push({ id: `beer_${i}`, name: 'BEER', type: 'BROWN', suit: 'HEARTS', rank: (i % 13) + 1 });
    }
    for (let i = 0; i < 2; i++) {
      list.push({ id: `mustang_${i}`, name: 'MUSTANG', type: 'BLUE', suit: 'HEARTS', rank: 8 });
      list.push({ id: `scope_${i}`, name: 'SCOPE', type: 'BLUE', suit: 'SPADES', rank: 9 });
      list.push({ id: `volcanic_${i}`, name: 'VOLCANIC', type: 'BLUE', suit: 'CLUBS', rank: 10 });
    }
    this.deck = list.sort(() => Math.random() - 0.5);
  }

  private dealInitialCards() {
    this.players.forEach(p => this.drawCards(p, p.hp));
  }

  startTurn() {
    this.bangUsedThisTurn = false;
    this.pendingAction = null;
    this.drawCards(this.currentPlayer, 2);
  }

  nextTurn() {
    let nextIdx = (this.currentTurnIdx + 1) % this.players.length;
    let loopCount = 0;
    while (!this.players[nextIdx].isAlive && loopCount < this.players.length) {
      nextIdx = (nextIdx + 1) % this.players.length;
      loopCount++;
    }
    this.currentTurnIdx = nextIdx;
    this.startTurn();
  }

  playBang(attackerId: string, targetId: string, cardId: string) {
    if (this.pendingAction) throw new Error('대기 중인 응답이 있습니다.');
    const attacker = this.currentPlayer;
    if (attacker.id !== attackerId) throw new Error('현재 턴 플레이어가 아닙니다.');

    const isVolcanic = attacker.table.weapon?.name === 'VOLCANIC';
    if (this.bangUsedThisTurn && !isVolcanic) {
      throw new Error('이번 턴에 이미 뱅을 사용했습니다.');
    }

    const target = this.players.find(p => p.id === targetId && p.isAlive);
    if (!target) throw new Error('유효하지 않은 타겟입니다.');

    const { canAttack } = calculateDistance(attacker, target, this.alivePlayers);
    if (!canAttack) throw new Error('사거리가 닿지 않습니다.');

    const cIdx = attacker.hand.findIndex(c => c.id === cardId && c.name === 'BANG');
    if (cIdx === -1) throw new Error('손패에 뱅 카드가 없습니다.');

    const [card] = attacker.hand.splice(cIdx, 1);
    this.discardPile.push(card);
    this.bangUsedThisTurn = true;

    this.pendingAction = {
      type: 'RESPONSE_TO_BANG',
      attackerId: attacker.id,
      targetId: target.id,
      sourceCard: card,
    };
  }

  resolveBangResponse(targetId: string, missedCardId?: string) {
    if (!this.pendingAction) throw new Error('대기 중인 뱅 액션이 없습니다.');
    const target = this.players.find(p => p.id === targetId)!;

    if (missedCardId) {
      const cIdx = target.hand.findIndex(c => c.id === missedCardId && c.name === 'MISSED');
      if (cIdx === -1) throw new Error('빗나감 카드가 없습니다.');
      const [card] = target.hand.splice(cIdx, 1);
      this.discardPile.push(card);
    } else {
      this.damagePlayer(target, 1, this.pendingAction.attackerId);
    }
    this.pendingAction = null;
  }

  private damagePlayer(player: Player, amount: number, attackerId: string) {
    player.hp -= amount;
    if (player.hp <= 0) {
      player.isAlive = false;
      this.discardPile.push(...player.hand, ...Object.values(player.table).filter(Boolean) as Card[]);
      player.hand = [];
      player.table = {};

      const attacker = this.players.find(p => p.id === attackerId);
      if (attacker && attacker.isAlive) {
        if (player.role === 'OUTLAW') this.drawCards(attacker, 3);
        if (attacker.role === 'SHERIFF' && player.role === 'DEPUTY') {
          this.discardPile.push(...attacker.hand, ...Object.values(attacker.table).filter(Boolean) as Card[]);
          attacker.hand = [];
          attacker.table = {};
        }
      }
    }
  }

  checkGameOver(): Role | 'OUTLAWS' | null {
    const sheriff = this.players.find(p => p.role === 'SHERIFF');
    const aliveOutlaws = this.alivePlayers.filter(p => p.role === 'OUTLAW');
    const aliveRenegades = this.alivePlayers.filter(p => p.role === 'RENEGADE');

    if (!sheriff || !sheriff.isAlive) {
      return (this.alivePlayers.length === 1 && aliveRenegades.length === 1) ? 'RENEGADE' : 'OUTLAWS';
    }
    if (aliveOutlaws.length === 0 && aliveRenegades.length === 0) {
      return 'SHERIFF';
    }
    return null;
  }

  drawCards(player: Player, count: number) {
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) {
        if (this.discardPile.length === 0) break;
        this.deck = [...this.discardPile].sort(() => Math.random() - 0.5);
        this.discardPile = [];
      }
      const card = this.deck.pop();
      if (card) player.hand.push(card);
    }
  }
}