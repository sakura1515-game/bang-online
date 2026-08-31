export type Role = 'SHERIFF' | 'DEPUTY' | 'OUTLAW' | 'RENEGADE';
export type CardType = 'BROWN' | 'BLUE';
export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';

export interface Card {
  id: string;
  name: 'BANG' | 'MISSED' | 'BEER' | 'MUSTANG' | 'SCOPE' | 'VOLCANIC' | 'SCHOFIELD';
  type: CardType;
  suit: Suit;
  rank: number;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  hp: number;
  maxHp: number;
  hand: Card[];
  table: {
    weapon?: Card;
    mustang?: Card;
    scope?: Card;
  };
  isAlive: boolean;
}

export interface PendingAction {
  type: 'RESPONSE_TO_BANG';
  attackerId: string;
  targetId: string;
  sourceCard: Card;
}