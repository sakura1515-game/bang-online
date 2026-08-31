import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { Room, ExtendedPlayer } from './Room';
import { AIEngine } from './AIEngine';
import { serializeForPlayer } from './serializer';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
  // 1. 방 생성 (싱글 / 멀티 공통)
  socket.on('create_room', ({ roomId, maxPlayers, isSinglePlayer, userName }) => {
    try {
      const room = new Room(roomId, maxPlayers);
      room.join(socket.id, userName, socket.id);
      rooms.set(roomId, room);
      socket.join(roomId);

      if (isSinglePlayer) {
        room.startGame();
        broadcastGameState(room);
        triggerBotLoop(room);
      } else {
        // 방장에게 방 생성 및 초기 대기실 데이터 전송
        socket.emit('lobby_update', {
          roomId: room.roomId,
          players: room.players.map(p => p.name),
          count: room.players.length,
          max: room.maxPlayers,
          isHost: true
        });
      }
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  // 2. 멀티 방 참가
  socket.on('join_room', ({ roomId, userName }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error_message', '존재하지 않는 방 코드입니다.');
      return;
    }
    if (room.isGameStarted) {
      socket.emit('error_message', '이미 게임이 시작된 방입니다.');
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      socket.emit('error_message', '방 정원이 초과되었습니다.');
      return;
    }

    room.join(socket.id, userName, socket.id);
    socket.join(roomId);

    // 방 안의 모든 참가자에게 갱신된 명단 전송
    io.to(roomId).emit('lobby_update', {
      roomId: room.roomId,
      players: room.players.map(p => p.name),
      count: room.players.length,
      max: room.maxPlayers,
      isHost: false
    });
  });

  // 3. 멀티 게임 시작 (방장 전용)
  socket.on('start_multi_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.isGameStarted) return;

    room.startGame();
    broadcastGameState(room);
    triggerBotLoop(room);
  });

  // 4. 뱅(BANG) 공격
  socket.on('action_bang', ({ roomId, targetId, cardId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.engine) return;

    try {
      room.engine.playBang(socket.id, targetId, cardId);
      broadcastGameState(room);

      const target = room.players.find(p => p.id === targetId);
      if (target && target.isBot) {
        AIEngine.handleBotResponse(target, room.engine);
        setTimeout(() => {
          broadcastGameState(room);
          checkAndRunNext(room);
        }, 1000);
      }
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  // 5. 방어(빗나감) 응답
  socket.on('action_respond_bang', ({ roomId, missedCardId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.engine) return;

    try {
      room.engine.resolveBangResponse(socket.id, missedCardId);
      broadcastGameState(room);
      checkAndRunNext(room);
    } catch (e: any) {
      socket.emit('error_message', e.message);
    }
  });

  // 6. 턴 종료
  socket.on('action_end_turn', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.engine || room.engine.currentPlayer.id !== socket.id) return;
    room.engine.nextTurn();
    broadcastGameState(room);
    triggerBotLoop(room);
  });
});

function broadcastGameState(room: Room) {
  room.players.forEach(p => {
    if (!p.isBot && p.socketId) {
      io.to(p.socketId).emit('game_state_update', serializeForPlayer(room, p.id));
    }
  });
}

async function triggerBotLoop(room: Room) {
  if (!room.engine) return;
  const current = room.engine.currentPlayer as ExtendedPlayer;
  if (current.isBot && current.isAlive) {
    await AIEngine.handleBotTurn(current, room.engine, () => broadcastGameState(room));
    const winner = room.engine.checkGameOver();
    if (winner) {
      io.to(room.roomId).emit('game_over', { winner });
      return;
    }
    triggerBotLoop(room);
  }
}

function checkAndRunNext(room: Room) {
  const winner = room.engine!.checkGameOver();
  if (winner) {
    io.to(room.roomId).emit('game_over', { winner });
    return;
  }
  const current = room.engine!.currentPlayer as ExtendedPlayer;
  if (current.isBot) triggerBotLoop(room);
}

const PORT = process.env.PORT || 3001;
server.listen(Number(PORT), '0.0.0.0', () => console.log(`BANG Server running on port ${PORT}`));