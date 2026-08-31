// 로컬 테스트 시 자동으로 현재 접속한 호스트 IP:3001 로 연결 (모바일 로컬 테스트 지원)
const SERVER_URL = (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.'))
  ? `http://${window.location.hostname}:3001`
  : 'https://bang-server-ozuj.onrender.com';

const socket = io(SERVER_URL);
let currentRoomId = '';
let myState = null;

const lobby = document.getElementById('lobby');
const board = document.getElementById('board');
const statusBar = document.getElementById('status-bar');
const otherPlayersDiv = document.getElementById('other-players');
const myProfileDiv = document.getElementById('my-profile');
const myHandDiv = document.getElementById('my-hand');
const btnEndTurn = document.getElementById('btn-end-turn');
const bangResponseBox = document.getElementById('bang-response-box');

// 싱글 플레이
document.getElementById('btn-single').addEventListener('click', () => {
  const userName = document.getElementById('nickname').value || '플레이어';
  const maxPlayers = parseInt(document.getElementById('max-players').value);
  currentRoomId = 'SINGLE_' + Math.random().toString(36).substring(2, 7);

  socket.emit('create_room', { roomId: currentRoomId, maxPlayers, isSinglePlayer: true, userName });
  lobby.classList.add('hidden');
  board.classList.remove('hidden');
});

// 멀티 플레이
document.getElementById('btn-multi').addEventListener('click', () => {
  const userName = document.getElementById('nickname').value || '플레이어';
  const maxPlayers = parseInt(document.getElementById('max-players').value);
  currentRoomId = 'ROOM_' + Math.random().toString(36).substring(2, 7);

  socket.emit('create_room', { roomId: currentRoomId, maxPlayers, isSinglePlayer: false, userName });
  alert(`방 코드: ${currentRoomId}`);
  lobby.classList.add('hidden');
  board.classList.remove('hidden');
});

socket.on('game_state_update', (state) => {
  myState = state;
  renderMobileBoard(state);
});

socket.on('game_over', ({ winner }) => {
  alert(`🏆 게임 종료! 승리: ${winner}`);
  location.reload();
});

socket.on('error_message', (msg) => alert(msg));

function renderMobileBoard(state) {
  const isMyTurn = state.currentTurnPlayerId === socket.id;

  statusBar.innerText = isMyTurn ? '👉 당신의 턴입니다!' : '⏳ 다른 플레이어 행동 대기 중';
  statusBar.style.color = isMyTurn ? '#ffd700' : '#fff';

  if (isMyTurn) btnEndTurn.classList.remove('hidden');
  else btnEndTurn.classList.add('hidden');

  if (state.pendingAction && state.pendingAction.targetId === socket.id) {
    bangResponseBox.classList.remove('hidden');
  } else {
    bangResponseBox.classList.add('hidden');
  }

  otherPlayersDiv.innerHTML = '';
  state.players.forEach(p => {
    if (p.id === socket.id) return;
    const isTargetTurn = state.currentTurnPlayerId === p.id;
    const div = document.createElement('div');
    div.className = `player-card ${isTargetTurn ? 'active' : ''} ${!p.isAlive ? 'dead' : ''}`;
    div.innerHTML = `
      <div>
        <strong>${p.name}</strong><br>
        <span style="color:#d4a373">${p.role}</span>
      </div>
      <div style="margin: 4px 0;">
        ❤️ ${p.hp}/${p.maxHp}<br>
        🃏 ${p.handCount}장
      </div>
      ${isMyTurn && p.isAlive ? `<button class="btn-target" onclick="shootBang('${p.id}')">🔫 조준</button>` : ''}
    `;
    otherPlayersDiv.appendChild(div);
  });

  const me = state.players.find(p => p.id === socket.id);
  if (me) {
    myProfileDiv.innerHTML = `
      <span>[나] ${me.name} (${state.myRole})</span>
      <span>❤️ ${me.hp}/${me.maxHp}</span>
    `;
  }

  myHandDiv.innerHTML = '';
  state.myHand.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'game-card';
    cardEl.innerHTML = `
      <span>${card.name}</span>
      <span style="font-size:10px; color:#555;">${card.suit}<br>${card.rank}</span>
    `;
    myHandDiv.appendChild(cardEl);
  });
}

function shootBang(targetId) {
  const bangCard = myState.myHand.find(c => c.name === 'BANG');
  if (!bangCard) {
    alert('손패에 뱅(BANG) 카드가 없습니다!');
    return;
  }
  socket.emit('action_bang', { roomId: currentRoomId, targetId, cardId: bangCard.id });
}

document.getElementById('btn-use-missed').addEventListener('click', () => {
  const missedCard = myState.myHand.find(c => c.name === 'MISSED');
  if (!missedCard) {
    alert('빗나감 카드가 없습니다!');
    return;
  }
  socket.emit('action_respond_bang', { roomId: currentRoomId, missedCardId: missedCard.id });
});

document.getElementById('btn-take-hit').addEventListener('click', () => {
  socket.emit('action_respond_bang', { roomId: currentRoomId });
});

btnEndTurn.addEventListener('click', () => {
  socket.emit('action_end_turn', { roomId: currentRoomId });
});