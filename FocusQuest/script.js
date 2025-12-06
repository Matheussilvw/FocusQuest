
// --- GAME STATE ---
let game = {
  level: 1, xp: 0, xpNext: 200,
  bossName: "Procrastinathos", bossMaxHp: 1000, bossHp: 1000,
  bossesKilled: 0, totalDamage: 0, tasksCompleted: 0, streak: 0,
  lastLogin: null,
  tasks: [],
  history: [2, 4, 1, 5, 3, 6, 0] // Dummy data for chart start
};

const BOSS_NAMES = ["Preguiça Titânica", "Instagramus o Distraidor", "Lorde da Soneca", "Rei do Caos", "General da Apatia"];
const ICONS = ["fa-d-and-d", "fa-dragon", "fa-spider", "fa-ghost", "fa-skull"];

// --- AUDIO SYSTEM (Web Audio API - No Files Needed) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function sfxHit() { playTone(150, 'sawtooth', 0.1); }
function sfxComplete() { playTone(600, 'sine', 0.1); setTimeout(() => playTone(900, 'sine', 0.2), 100); }
function sfxWin() {
  [440, 554, 659, 880].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.3), i * 100));
}

// --- CORE FUNCTIONS ---
function init() {
  const saved = localStorage.getItem('FocusQuestV3');
  if (saved) game = JSON.parse(saved);
  updateUI();
  renderTasks();
  renderChart();
  log("Sistema inicializado. Pronto para a batalha.");
}

function save() {
  localStorage.setItem('FocusQuestV3', JSON.stringify(game));
  updateUI();
}

function updateUI() {
  // Stats
  document.getElementById('level-num').innerText = game.level;
  document.getElementById('xp-num').innerText = game.xp;
  document.getElementById('xp-bar').style.width = (game.xp / game.xpNext * 100) + '%';

  document.getElementById('stat-killed').innerText = game.bossesKilled;
  document.getElementById('stat-tasks').innerText = game.tasksCompleted;
  document.getElementById('stat-dmg').innerText = game.totalDamage;
  document.getElementById('stat-streak').innerText = game.streak;

  // Boss
  document.getElementById('boss-name').innerText = game.bossName.toUpperCase();
  const hpPct = (game.bossHp / game.bossMaxHp) * 100;
  document.getElementById('boss-hp-bar').style.width = hpPct + '%';
  document.getElementById('boss-hp-text').innerText = `${game.bossHp}/${game.bossMaxHp}`;
}

function addTask() {
  const input = document.getElementById('task-input');
  if (!input.value.trim()) return;
  const diff = document.getElementById('diff-select').value;
  const dmgMap = { easy: 50, medium: 100, hard: 200 };

  game.tasks.push({
    id: Date.now(),
    text: input.value,
    diff: diff,
    dmg: dmgMap[diff]
  });

  input.value = '';
  renderTasks();
  save();
  playTone(300, 'sine', 0.1); // Add sound
}

function completeTask(id) {
  const idx = game.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;

  const task = game.tasks[idx];

  // Effects
  sfxHit();
  damageBoss(task.dmg);
  showFloatingText(task.dmg);

  // Logic
  game.xp += Math.floor(task.dmg / 2);
  game.totalDamage += task.dmg;
  game.tasksCompleted++;

  // Update Chart History (Last element is today)
  game.history[6]++;

  game.tasks.splice(idx, 1);
  log(`Missão "${task.text}" completada. -${task.dmg} HP no Boss.`);

  checkLevelUp();
  renderTasks();
  renderChart();
  save();
}

function damageBoss(amount) {
  game.bossHp -= amount;

  // Visual shake
  const icon = document.getElementById('boss-icon');
  icon.classList.remove('hit');
  void icon.offsetWidth; // Trigger reflow
  icon.classList.add('hit');

  if (game.bossHp <= 0) {
    game.bossHp = 0;
    bossDefeated();
  }
}

function bossDefeated() {
  sfxWin();
  const icon = document.getElementById('boss-icon');
  icon.classList.add('dead');

  setTimeout(() => {
    document.getElementById('modal').classList.add('active');
    createConfetti();
  }, 1000);

  game.xp += 500;
  game.bossesKilled++;
  checkLevelUp();
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
  document.getElementById('boss-icon').classList.remove('dead');

  // New Boss
  game.bossMaxHp = Math.floor(game.bossMaxHp * 1.2);
  game.bossHp = game.bossMaxHp;
  game.bossName = BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)];

  // Change Icon
  const newIcon = ICONS[Math.floor(Math.random() * ICONS.length)];
  document.getElementById('boss-icon').innerHTML = `<i class="fa-brands ${newIcon}"></i>`;

  save();
  log("Um novo Boss apareceu!");
}

function checkLevelUp() {
  if (game.xp >= game.xpNext) {
    game.level++;
    game.xp -= game.xpNext;
    game.xpNext = Math.floor(game.xpNext * 1.2);
    log(`LEVEL UP! Você subiu para o nível ${game.level}!`);
  }
}

// --- VISUALS & UTILS ---
function renderTasks() {
  const list = document.getElementById('task-list');
  list.innerHTML = "";
  game.tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = `task-item priority-${t.diff}`;
    li.innerHTML = `
                <span>${t.text} <small style="color:#aaa">(${t.dmg} DMG)</small></span>
                <button class="btn btn-sm btn-ghost" onclick="completeTask(${t.id})">
                    <i class="fa-solid fa-sword"></i> Atacar
                </button>
            `;
    list.appendChild(li);
  });
}

function renderChart() {
  const container = document.getElementById('weekly-chart');
  container.innerHTML = '';
  const max = Math.max(...game.history, 5); // Prevent div by zero

  game.history.forEach((val, i) => {
    const h = (val / max) * 100;
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = `${h}%`;
    bar.setAttribute('data-val', val);
    container.appendChild(bar);
  });
}

function showFloatingText(dmg) {
  const arena = document.getElementById('arena');
  const txt = document.createElement('div');
  txt.className = 'damage-text';
  txt.innerText = `-${dmg}`;
  txt.style.left = '50%';
  txt.style.top = '40%';
  arena.appendChild(txt);
  setTimeout(() => txt.remove(), 1000);
}

function createConfetti() {
  const colors = ['#f43f5e', '#8b5cf6', '#10b981'];
  for (let i = 0; i < 50; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.left = Math.random() * 100 + 'vw';
    c.style.top = -10 + 'px';
    document.body.appendChild(c);

    const dur = Math.random() * 3 + 2;
    c.animate([
      { transform: 'translateY(0) rotate(0)', opacity: 1 },
      { transform: `translateY(100vh) rotate(${Math.random() * 500}deg)`, opacity: 0 }
    ], { duration: dur * 1000 }).onfinish = () => c.remove();
  }
}

function log(msg) {
  const ul = document.getElementById('combat-log');
  const li = document.createElement('li');
  li.innerHTML = `> ${msg}`;
  ul.prepend(li);
}

// --- NOISE GENERATOR (Brownian Noise approx) ---
// Simulating noise with a simple buffer loop to save CPU
let noiseNode = null;
function toggleNoise(type, btn) {
  if (noiseNode) {
    noiseNode.disconnect();
    noiseNode = null;
    document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
    return;
  }

  if (audioCtx.state === 'suspended') audioCtx.resume();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; // White noise
    if (type === 'rain') data[i] *= 0.1; // Quieter
  }

  noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = buffer;
  noiseNode.loop = true;

  // Simple filter to make it sound like rain or cafe murmur
  const filter = audioCtx.createBiquadFilter();
  filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
  filter.frequency.value = type === 'rain' ? 800 : 400;

  noiseNode.connect(filter);
  filter.connect(audioCtx.destination);
  noiseNode.start();

  btn.classList.add('active');
}

// START
init();