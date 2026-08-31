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
  socket.on('create_room', ({ roomId, maxPlayers, isSinglePlayer, userName }) => {
    const room = new Room(roomId, maxPlayers);
    room.join(socket.id, userName, socket.id);
    rooms.set(roomId, room);
    socket.join(roomId);

    if (isSinglePlayer) {
      room.startGame();
      broadcastGameState(room);
      triggerBotLoop(room);
    } else {
      socket.emit('room_created', { roomId });
    }
  });

  socket.on('join_room', ({ roomId, userName }) => {
    const room = rooms.get(roomId);
    if (!room || room.isGameStarted) {
      socket.emit('error_message', '입장할 수 없는 방입니다.');
      return;
    }
    room.join(socket.id, userName, socket.id);
    socket.join(roomId);
    io.to(roomId).emit('lobby_update', { count: room.players.length, max: room.maxPlayers });
  });

  socket.on('start_multi_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.startGame();
    broadcastGameState(room);
    triggerBotLoop(room);
  });

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
// '0.0.0.0' 바인딩으로 같은 공유기 내 스마트폰 접속 허용
server.listen(Number(PORT), '0.0.0.0', () => console.log(`BANG Server running on port ${PORT}`));