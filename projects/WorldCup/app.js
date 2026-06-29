// ─── FIREBASE INIT ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCIYsYT_ogQKN_0ng4Se7vryTLuVrc6hnI",
  authDomain: "world-cup-801.firebaseapp.com",
  projectId: "world-cup-801",
  storageBucket: "world-cup-801.firebasestorage.app",
  messagingSenderId: "963929054332",
  appId: "1:963929054532:web:cc09b3e7480d81b22fcb11"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ─── GAMES (all times UTC, displayed in ET) ───────────────────────────────────
const GAMES = [
  { id: 'g1',  home: 'Brazil',          away: 'Japan',                  kickoff: '2026-06-29T17:00:00Z' },
  { id: 'g2',  home: 'Germany',         away: 'Paraguay',               kickoff: '2026-06-29T20:30:00Z' },
  { id: 'g3',  home: 'Netherlands',     away: 'Morocco',                kickoff: '2026-06-30T01:00:00Z' },
  { id: 'g4',  home: "Côte d'Ivoire",   away: 'Norway',                 kickoff: '2026-06-30T17:00:00Z' },
  { id: 'g5',  home: 'France',          away: 'Sweden',                 kickoff: '2026-06-30T21:00:00Z' },
  { id: 'g6',  home: 'Mexico',          away: 'Ecuador',                kickoff: '2026-07-01T01:00:00Z' },
  { id: 'g7',  home: 'England',         away: 'DR Congo',               kickoff: '2026-07-01T16:00:00Z' },
  { id: 'g8',  home: 'Belgium',         away: 'Senegal',                kickoff: '2026-07-01T20:00:00Z' },
  { id: 'g9',  home: 'USA',             away: 'Bosnia and Herzegovina', kickoff: '2026-07-02T00:00:00Z' },
  { id: 'g10', home: 'Spain',           away: 'Austria',                kickoff: '2026-07-02T19:00:00Z' },
  { id: 'g11', home: 'Portugal',        away: 'Croatia',                kickoff: '2026-07-02T23:00:00Z' },
  { id: 'g12', home: 'Switzerland',     away: 'Algeria',                kickoff: '2026-07-03T03:00:00Z' },
  { id: 'g13', home: 'Australia',       away: 'Egypt',                  kickoff: '2026-07-03T18:00:00Z' },
  { id: 'g14', home: 'Argentina',       away: 'Cabo Verde',             kickoff: '2026-07-03T22:00:00Z' },
  { id: 'g15', home: 'Colombia',        away: 'Ghana',                  kickoff: '2026-07-04T01:30:00Z' },
];

const ADMIN_PASSWORD = 'zac2026';

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentUser   = null; // { id, name }
let userPicks     = {};   // { gameId: team }
let results       = {};   // { gameId: winner }
let adminUnlocked = false;

// ─── BOOT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const savedId   = localStorage.getItem('wcUserId');
  const savedName = localStorage.getItem('wcUserName');
  if (savedId && savedName) {
    currentUser = { id: savedId, name: savedName };
    showApp();
  } else {
    showNameScreen();
  }

  document.getElementById('switchUserBtn').addEventListener('click', signOut);
  document.getElementById('adminBtn').addEventListener('click', handleAdminClick);
  document.getElementById('closeAdmin').addEventListener('click', () => {
    document.getElementById('adminPanel').classList.add('hidden');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
});

function signOut() {
  localStorage.removeItem('wcUserId');
  localStorage.removeItem('wcUserName');
  currentUser = null;
  userPicks   = {};
  results     = {};
  document.getElementById('app').classList.add('hidden');
  showNameScreen();
}

// ─── NAME SCREEN ──────────────────────────────────────────────────────────────
async function showNameScreen() {
  document.getElementById('nameScreen').classList.remove('hidden');
  const nameList = document.getElementById('nameList');
  nameList.innerHTML = '<p class="loading-names">Loading…</p>';

  const snap = await db.collection('users').orderBy('name').get();
  const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  nameList.innerHTML = users.length === 0 ? '<p class="empty-names">Be the first to join!</p>' : '';
  users.forEach(user => {
    const btn = document.createElement('button');
    btn.className = 'name-btn';
    btn.textContent = user.name;
    btn.addEventListener('click', () => selectUser(user));
    nameList.appendChild(btn);
  });

  const addBtn   = document.getElementById('addNameBtn');
  const input    = document.getElementById('newNameInput');
  const existingNames = users.map(u => u.name.toLowerCase());

  addBtn.onclick = () => addUser(input, existingNames);
  input.onkeydown = e => { if (e.key === 'Enter') addUser(input, existingNames); };
}

async function addUser(input, existingNames) {
  const name = input.value.trim();
  if (!name) return;
  if (existingNames.includes(name.toLowerCase())) {
    alert('That name already exists — select it from the list above.');
    return;
  }
  const ref = await db.collection('users').add({ name });
  selectUser({ id: ref.id, name });
}

function selectUser(user) {
  currentUser = user;
  localStorage.setItem('wcUserId', user.id);
  localStorage.setItem('wcUserName', user.name);
  document.getElementById('nameScreen').classList.add('hidden');
  showApp();
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
async function showApp() {
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('currentUserName').textContent = currentUser.name;

  const [picksSnap, resultsSnap] = await Promise.all([
    db.collection('picks').where('userId', '==', currentUser.id).get(),
    db.collection('results').get(),
  ]);

  userPicks = {};
  picksSnap.docs.forEach(doc => {
    userPicks[doc.data().gameId] = doc.data().team;
  });
  results = {};
  resultsSnap.docs.forEach(doc => {
    results[doc.id] = doc.data().winner;
  });

  renderGames();
}

// ─── PICKS TAB ────────────────────────────────────────────────────────────────
function renderGames() {
  const container = document.getElementById('gamesList');
  container.innerHTML = '';

  // Group games by ET date label
  const days = {};
  GAMES.forEach(game => {
    const label = new Date(game.kickoff).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
    });
    if (!days[label]) days[label] = [];
    days[label].push(game);
  });

  Object.entries(days).forEach(([day, games]) => {
    const section = document.createElement('div');
    section.className = 'day-section';
    section.innerHTML = `<h2 class="day-header">${day}</h2>`;

    games.forEach(game => {
      const kickoffDate = new Date(game.kickoff);
      const isLocked    = Date.now() >= kickoffDate.getTime();
      const pick        = userPicks[game.id];
      const winner      = results[game.id];
      const isCorrect   = winner && pick === winner;
      const isWrong     = winner && pick && pick !== winner;

      const timeStr = kickoffDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
      });

      const card = document.createElement('div');
      card.className = `game-card${isLocked ? ' locked' : ''}${isCorrect ? ' correct' : isWrong ? ' wrong' : ''}`;

      let pickHTML;
      if (winner) {
        const resultLine  = `Result: <strong>${winner}</strong>`;
        const pickLine    = pick
          ? `<span class="pick-badge ${isCorrect ? 'badge-correct' : 'badge-wrong'}">${isCorrect ? '✅' : '❌'} You picked ${pick}</span>`
          : `<span class="pick-badge badge-none">No pick made</span>`;
        pickHTML = `<div class="result-row">${resultLine} &nbsp; ${pickLine}</div>`;
      } else if (isLocked) {
        pickHTML = pick
          ? `<div class="locked-pick">Your pick: <strong>${pick}</strong></div>`
          : `<div class="locked-pick no-pick">No pick made 🔒</div>`;
      } else {
        pickHTML = `
          <select class="pick-select" data-game-id="${game.id}">
            <option value="">Pick a winner…</option>
            <option value="${game.home}" ${pick === game.home ? 'selected' : ''}>${game.home}</option>
            <option value="${game.away}" ${pick === game.away ? 'selected' : ''}>${game.away}</option>
          </select>`;
      }

      card.innerHTML = `
        <div class="game-meta">
          <span class="game-time">${timeStr} ET</span>
          ${isLocked && !winner ? '<span class="lock-icon">🔒</span>' : ''}
        </div>
        <div class="game-teams">
          <span class="team-name">${game.home}</span>
          <span class="vs">vs</span>
          <span class="team-name">${game.away}</span>
        </div>
        <div class="game-pick-row">${pickHTML}</div>`;

      section.appendChild(card);
    });

    container.appendChild(section);
  });

  // Attach change listeners to dropdowns
  container.querySelectorAll('.pick-select').forEach(sel => {
    sel.addEventListener('change', async e => {
      const gameId = e.target.dataset.gameId;
      const team   = e.target.value;
      if (!team) return;
      userPicks[gameId] = team;
      await db.collection('picks').doc(`${currentUser.id}_${gameId}`).set({
        userId: currentUser.id, gameId, team,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
  });
}

// ─── LEADERBOARD TAB ─────────────────────────────────────────────────────────
async function loadLeaderboard() {
  const container = document.getElementById('leaderboardList');
  container.innerHTML = '<p class="loading-names">Loading…</p>';

  const [usersSnap, picksSnap, resultsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('picks').get(),
    db.collection('results').get(),
  ]);

  const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const allPicksMap = {};
  picksSnap.docs.forEach(doc => {
    const { userId, gameId, team } = doc.data();
    if (!allPicksMap[userId]) allPicksMap[userId] = {};
    allPicksMap[userId][gameId] = team;
  });

  const resultsMap = {};
  resultsSnap.docs.forEach(doc => { resultsMap[doc.id] = doc.data().winner; });
  const totalDecided = Object.keys(resultsMap).length;

  const scores = users.map(user => {
    const picks   = allPicksMap[user.id] || {};
    let correct   = 0;
    Object.entries(resultsMap).forEach(([gameId, winner]) => {
      if (picks[gameId] === winner) correct++;
    });
    return { name: user.name, correct, totalDecided, pickCount: Object.keys(picks).length };
  }).sort((a, b) => b.correct - a.correct || b.pickCount - a.pickCount);

  container.innerHTML = '';

  if (totalDecided === 0) {
    container.innerHTML = '<p class="empty-state">No results in yet — check back after the first games kick off!</p>';
    return;
  }

  const header = document.createElement('div');
  header.className = 'lb-header';
  header.innerHTML = `<span></span><span>Player</span><span>Score</span>`;
  container.appendChild(header);

  scores.forEach((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const row   = document.createElement('div');
    row.className = `lb-row${s.name === currentUser.name ? ' lb-me' : ''}`;
    row.innerHTML = `
      <span class="lb-rank">${medal}</span>
      <span class="lb-name">${s.name}</span>
      <span class="lb-score">${s.correct} / ${s.totalDecided}</span>`;
    container.appendChild(row);
  });
}

// ─── TAB SWITCHING ────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('picksTab').classList.toggle('hidden', tab !== 'picks');
  document.getElementById('leaderboardTab').classList.toggle('hidden', tab !== 'leaderboard');
  if (tab === 'leaderboard') loadLeaderboard();
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function handleAdminClick() {
  if (!adminUnlocked) {
    const pw = prompt('Admin password:');
    if (pw !== ADMIN_PASSWORD) { alert('Incorrect password.'); return; }
    adminUnlocked = true;
  }
  renderAdminPanel();
  document.getElementById('adminPanel').classList.remove('hidden');
}

function renderAdminPanel() {
  const adminGames = document.getElementById('adminGames');
  adminGames.innerHTML = '';

  GAMES.forEach(game => {
    const current = results[game.id] || '';
    const kickoffDate = new Date(game.kickoff);
    const timeStr = kickoffDate.toLocaleDateString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric',
    }) + ' · ' + kickoffDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
    });

    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="admin-game-label">
        <span class="admin-teams">${game.home} vs ${game.away}</span>
        <span class="admin-time">${timeStr} ET</span>
      </div>
      <select class="admin-select" data-game-id="${game.id}">
        <option value="">No result yet</option>
        <option value="${game.home}" ${current === game.home ? 'selected' : ''}>${game.home}</option>
        <option value="${game.away}" ${current === game.away ? 'selected' : ''}>${game.away}</option>
      </select>`;
    adminGames.appendChild(row);
  });

  adminGames.querySelectorAll('.admin-select').forEach(sel => {
    sel.addEventListener('change', async e => {
      const gameId = e.target.dataset.gameId;
      const winner = e.target.value;
      if (winner) {
        results[gameId] = winner;
        await db.collection('results').doc(gameId).set({ winner });
      } else {
        delete results[gameId];
        await db.collection('results').doc(gameId).delete();
      }
      renderGames();
    });
  });
}
