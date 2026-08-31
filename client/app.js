// 로컬 테스트 시 자동으로 현재 접속한 호스트 IP:3001 로 연결 (모바일 로컬 테스트 지원)
const SERVER_URL = (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.'))
  ? `http://${window.location.hostname}:3001`
  : 'https://bang-server-xxxx.onrender.com'; // 👈 본인의 실제 Render 주소로 유지

const socket = io(SERVER_URL);
let currentRoomId = '';
let isHost = false;
let myState = null;

// DOM 요소
const lobby = document.getElementById('lobby');
const waitingRoom = document.getElementById('waiting-room');
const board = document.getElementById('board');
const statusBar = document.getElementById('status-bar');
const otherPlayersDiv = document.getElementById('other-players');
const myProfileDiv = document.getElementById('my-profile');
const myHandDiv = document.getElementById('my-hand');
const btnEndTurn = document.getElementById('btn-end-turn');
const bangResponseBox = document.getElementById('bang-response-box');
const btnStartMulti = document.getElementById('btn-start-multi');

// 1. 싱글 플레이 (즉시 시작)
document.getElementById('btn-single').addEventListener('click', () => {
  const userName = document.getElementById('nickname').value || '플레이어1';
  const maxPlayers = parseInt(document.getElementById('max-players').value);
  currentRoomId = 'SINGLE_' + Math.random().toString(36).substring(2, 7);

  socket.emit('create_room', { roomId: currentRoomId, maxPlayers, isSinglePlayer: true, userName });
  lobby.classList.add('hidden');
  board.classList.remove('hidden');
});

// 2. 멀티 방 만들기 (대기실로 이동)
document.getElementById('btn-multi-create').addEventListener('click', () => {
  const userName = document.getElementById('nickname').value || '방장';
  const maxPlayers = parseInt(document.getElementById('max-players').value);
  currentRoomId = 'ROOM_' + Math.random().toString(36).substring(2, 7);
  isHost = true;

  socket.emit('create_room', { roomId: currentRoomId, maxPlayers, isSinglePlayer: false, userName });
  
  document.getElementById('display-room-code').innerText = currentRoomId;
  btnStartMulti.classList.remove('hidden'); // 방장에게만 시작 버튼 노출
  lobby.classList.add('hidden');
  waitingRoom.classList.remove('hidden');
});

// 3. 멀티 방 참가하기 (코드로 입장)
document.getElementById('btn-multi-join').addEventListener('click', () => {
  const userName = document.getElementById('nickname').value || '참가자';
  const roomCode = document.getElementById('join-room-code').value.trim();

  if (!roomCode) {
    alert('방 코드를 입력해주세요.');
    return;
  }

  currentRoomId = roomCode;
  isHost = false;
  socket.emit('join_room', { roomId: currentRoomId, userName });
});

// 대기실 업데이트 이벤트 (새로운 사람이 들어왔을 때)
socket.on('lobby_update', ({ count, max }) => {
  lobby.classList.add('hidden');
  waitingRoom.classList.remove('hidden');
  document.getElementById('display-room-code').innerText = currentRoomId;
  document.getElementById('waiting-count').innerText = `참가 인원: ${count} / ${max}`;
});

// 방장이 게임 시작 버튼을 눌렀을 때
btnStartMulti.addEventListener('click', () => {
  socket.emit('start_multi_game', { roomId: currentRoomId });
});

// 게임 시작 및 상태 동기화
socket.on('game_state_update', (state) => {
  myState = state;
  waitingRoom.classList.add('hidden');
  lobby.classList.add('hidden');
  board.classList.remove('hidden');
  renderMobileBoard(state);
});

socket.on('game_over', ({ winner }) => {
  alert(`🏆 게임 종료! 승리: ${winner}`);
  location.reload();
});

socket.on('error_message', (msg) => alert(msg));

// 게임 보드 렌더링
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