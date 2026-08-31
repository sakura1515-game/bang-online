import { ExtendedPlayer } from './Room';
import { GameEngine } from './GameEngine';
import { calculateDistance } from './distance';

export class AIEngine {
  static async handleBotTurn(bot: ExtendedPlayer, engine: GameEngine, onAction: Function) {
    if (!bot.isAlive || !bot.isBot) return;

    const bangCard = bot.hand.find(c => c.name === 'BANG');
    if (bangCard && (!engine.bangUsedThisTurn || bot.table.weapon?.name === 'VOLCANIC')) {
      const candidates = engine.alivePlayers.filter(p => p.id !== bot.id) as ExtendedPlayer[];
      const reachable = candidates.filter(t => calculateDistance(bot, t, engine.alivePlayers).canAttack);

      if (reachable.length > 0) {
        let target = reachable[0];
        if (bot.role === 'OUTLAW') {
          const sheriff = reachable.find(p => p.role === 'SHERIFF');
          if (sheriff) target = sheriff;
        }

        await new Promise(r => setTimeout(r, 600));
        try {
          engine.playBang(bot.id, target.id, bangCard.id);
          onAction();
        } catch (e) {}
      }
    }

    while (bot.hand.length > bot.hp) {
      const disc = bot.hand.pop();
      if (disc) engine.discardPile.push(disc);
    }

    await new Promise(r => setTimeout(r, 500));
    engine.nextTurn();
    onAction();
  }

  static handleBotResponse(bot: ExtendedPlayer, engine: GameEngine) {
    if (!bot.isBot) return;
    const missed = bot.hand.find(c => c.name === 'MISSED');
    setTimeout(() => {
      engine.resolveBangResponse(bot.id, missed ? missed.id : undefined);
    }, 800);
  }
}