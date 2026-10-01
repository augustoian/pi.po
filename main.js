// Configurações Globais Canvas
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Elementos da UI
const score1El = document.getElementById('score1');
score2El = document.getElementById('score2');
const p1Label = document.getElementById('p1-label');
const p2Label = document.getElementById('p2-label');
const overlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySubtitle = document.getElementById('overlaySubtitle');
const btn1Player = document.getElementById('btn1Player');
const btn2Players = document.getElementById('btn2Players');
const btnPause = document.getElementById('btnPause');
const btnSound = document.getElementById('btnSound');

// Sistema de Áudio Synth (Web Audio API)
let soundEnabled = true;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (!soundEnabled) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'hit') {
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'wall') {
    osc.frequency.setValueAtTime(250, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'score') {
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.25);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

// Estado do Jogo
const WINNING_SCORE = 5;
let gameMode = 'vsAI'; // 'vsAI' ou 'pvp'
let isPaused = false;
let gameRunning = false;

// Objetos do Jogo
const paddleWidth = 12;
const paddleHeight = 90;

const player1 = {
  x: 20,
  y: canvas.height / 2 - paddleHeight / 2,
  width: paddleWidth,
  height: paddleHeight,
  score: 0,
  speed: 8,
  dy: 0
};

const player2 = {
  x: canvas.width - 20 - paddleWidth,
  y: canvas.height / 2 - paddleHeight / 2,
  width: paddleWidth,
  height: paddleHeight,
  score: 0,
  speed: 8,
  dy: 0
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 7,
  speed: 6,
  dx: 6,
  dy: 3
};

// Partículas
let particles = [];

function createParticles(x, y, color) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: x,
      y: y,
      dx: (Math.random() - 0.5) * 6,
      dy: (Math.random() - 0.5) * 6,
      radius: Math.random() * 3 + 1,
      color: color,
      life: 25
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.life--;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 25;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  });
}

// Input / Teclas
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
    if (gameRunning) togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Suporte a Touch no Canvas
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touchY = e.touches[0].clientY - rect.top;
  player1.y = touchY - player1.height / 2;
}, { passive: false });

// Lógica de Movimento
function movePaddles() {
  // Jogador 1 (W e S)
  if (keys['w'] || keys['W']) player1.dy = -player1.speed;
  else if (keys['s'] || keys['S']) player1.dy = player1.speed;
  else player1.dy = 0;

  player1.y += player1.dy;

  // Jogador 2 (Setas ou IA)
  if (gameMode === 'pvp') {
    if (keys['ArrowUp']) player2.dy = -player2.speed;
    else if (keys['ArrowDown']) player2.dy = player2.speed;
    else player2.dy = 0;
  } else {
    // IA do Computador
    let target = ball.y - player2.height / 2;
    let delta = target - player2.y;
    player2.dy = delta * 0.09; // Suavização/Dificuldade
  }

  player2.y += player2.dy;

  // Limites das raquetes na tela
  player1.y = Math.max(10, Math.min(canvas.height - player1.height - 10, player1.y));
  player2.y = Math.max(10, Math.min(canvas.height - player2.height - 10, player2.y));
}

// Reiniciar Bola
function resetBall(winner) {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.speed = 6;
  ball.dx = (winner === 1 ? 1 : -1) * ball.speed;
  ball.dy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 3 + 2);
}

// Lógica da Bola
function moveBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Colisão com Topo e Base
  if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= canvas.height) {
    ball.dy *= -1;
    playSound('wall');
    createParticles(ball.x, ball.y, '#ffffff');
  }

  // Colisão com Raquete 1
  if (
    ball.x - ball.radius <= player1.x + player1.width &&
    ball.x + ball.radius >= player1.x &&
    ball.y >= player1.y &&
    ball.y <= player1.y + player1.height
  ) {
    let hitPoint = (ball.y - (player1.y + player1.height / 2)) / (player1.height / 2);
    let angle = hitPoint * (Math.PI / 4);
    
    ball.speed = Math.min(ball.speed + 0.4, 15);
    ball.dx = ball.speed * Math.cos(angle);
    ball.dy = ball.speed * Math.sin(angle);
    ball.x = player1.x + player1.width + ball.radius;

    playSound('hit');
    createParticles(ball.x, ball.y, '#66fcf1');
  }

  // Colisão com Raquete 2
  if (
    ball.x + ball.radius >= player2.x &&
    ball.x - ball.radius <= player2.x + player2.width &&
    ball.y >= player2.y &&
    ball.y <= player2.y + player2.height
  ) {
    let hitPoint = (ball.y - (player2.y + player2.height / 2)) / (player2.height / 2);
    let angle = hitPoint * (Math.PI / 4);

    ball.speed = Math.min(ball.speed + 0.4, 15);
    ball.dx = -ball.speed * Math.cos(angle);
    ball.dy = ball.speed * Math.sin(angle);
    ball.x = player2.x - ball.radius;

    playSound('hit');
    createParticles(ball.x, ball.y, '#45a29e');
  }

  // Ponto para Jogador 2
  if (ball.x - ball.radius < 0) {
    player2.score++;
    score2El.textContent = player2.score;
    playSound('score');
    checkGameOver();
    if (gameRunning) resetBall(2);
  }

  // Ponto para Jogador 1
  if (ball.x + ball.radius > canvas.width) {
    player1.score++;
    score1El.textContent = player1.score;
    playSound('score');
    checkGameOver();
    if (gameRunning) resetBall(1);
  }
}

// Checar Fim de Jogo
function checkGameOver() {
  if (player1.score >= WINNING_SCORE || player2.score >= WINNING_SCORE) {
    gameRunning = false;
    let winnerText = "";
    if (player1.score >= WINNING_SCORE) {
      winnerText = "JOGADOR 1 VENCEU!";
    } else {
      winnerText = gameMode === 'vsAI' ? "COMPUTADOR VENCEU!" : "JOGADOR 2 VENCEU!";
    }
    
    overlayTitle.textContent = "FIM DE JOGO";
    overlaySubtitle.textContent = winnerText;
    btn1Player.textContent = "Jogar Novamente (vs IA)";
    btn2Players.textContent = "Jogar Novamente (2p)";
    overlay.classList.remove('hidden');
  }
}

// Renderização Gráfica
function draw() {
  // Limpar fundo
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Redenrizar Rede Pontilhada
  ctx.strokeStyle = '#1f2833';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Desenhar Raquetes
  ctx.fillStyle = '#66fcf1';
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#66fcf1';
  ctx.fillRect(player1.x, player1.y, player1.width, player1.height);

  ctx.fillStyle = '#45a29e';
  ctx.shadowColor = '#45a29e';
  ctx.fillRect(player2.x, player2.y, player2.width, player2.height);

  // Desenhar Bola
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  // Resetar Efeito Glow para Partículas
  ctx.shadowBlur = 0;

  // Desenhar Partículas
  drawParticles();
}

// Game Loop
function loop() {
  if (gameRunning && !isPaused) {
    movePaddles();
    moveBall();
    updateParticles();
  }
  draw();
  requestAnimationFrame(loop);
}

// Iniciar Jogo
function startGame(mode) {
  gameMode = mode;
  p2Label.textContent = gameMode === 'vsAI' ? 'COMPUTADOR' : 'JOGADOR 2';
  
  player1.score = 0;
  player2.score = 0;
  score1El.textContent = '0';
  score2El.textContent = '0';
  
  player1.y = canvas.height / 2 - paddleHeight / 2;
  player2.y = canvas.height / 2 - paddleHeight / 2;
  
  resetBall(Math.random() > 0.5 ? 1 : 2);
  
  isPaused = false;
  gameRunning = true;
  overlay.classList.add('hidden');
}

// Pausar Jogo
function togglePause() {
  if (!gameRunning) return;
  isPaused = !isPaused;

  if (isPaused) {
    overlayTitle.textContent = "PAUSADO";
    overlaySubtitle.textContent = "Pressione P ou o botão para continuar";
    btn1Player.textContent = "Continuar";
    btn2Players.style.display = "none";
    overlay.classList.remove('hidden');
    btnPause.textContent = "Continuar (P)";
  } else {
    overlay.classList.add('hidden');
    btn2Players.style.display = "block";
    btnPause.textContent = "Pausar (P)";
  }
}

// Listeners dos Botões
btn1Player.addEventListener('click', () => {
  if (isPaused) {
    togglePause();
  } else {
    startGame('vsAI');
  }
});

btn2Players.addEventListener('click', () => {
  startGame('pvp');
});

btnPause.addEventListener('click', () => {
  togglePause();
});

btnSound.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  btnSound.textContent = `Som: ${soundEnabled ? 'LIGADO' : 'DESLIGADO'}`;
});

// Iniciar Loop Continuo
loop();
