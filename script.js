// script.js – Click Rush ⚡ game logic

(function() {
  // ----- DOM elements -----
  const gameArea = document.getElementById('gameArea');
  const scoreSpan = document.getElementById('scoreDisplay');
  const timerSpan = document.getElementById('timerDisplay');
  const comboSpan = document.getElementById('comboDisplay');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const finalScoreSpan = document.getElementById('finalScoreSpan');
  const highScoreSpan = document.getElementById('highScoreSpan');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const muteBtn = document.getElementById('muteBtn');
  const countdownEl = document.getElementById('countdownDisplay');

  // canvas for particles (bonus)
  const canvas = document.getElementById('burst-canvas');
  let ctx = canvas.getContext('2d');

  // ----- sound -----
  let clickSound = null;
  let soundEnabled = true;
  try {
    clickSound = new Audio('./sound/UI element 3.mp3');
    // if 404, silent fallback
    clickSound.onerror = () => { 
      console.warn('sound file missing, game will run muted'); 
      soundEnabled = false; 
    };
  } catch (e) { 
    soundEnabled = false; 
  }

  // ----- game state -----
  let score = 0;
  let timeLeft = 30;
  let combo = 0;
  let highScore = localStorage.getItem('clickRushHigh') ? parseInt(localStorage.getItem('clickRushHigh')) : 0;
  let gameActive = false;
  let timerInterval = null;
  let targetTimeout = null;
  let nextTargetTimeout = null;
  let currentTarget = null;
  let targetHideTimer = null;

  // particle system data
  let particles = [];
  const PARTICLE_COUNT = 15;

  // resize canvas to match game area
  function resizeCanvas() {
    canvas.width = gameArea.clientWidth;
    canvas.height = gameArea.clientHeight;
  }
  window.addEventListener('resize', resizeCanvas);

  // ----- helper: update UI stats -----
  function updateUI() {
    scoreSpan.innerText = score;
    timerSpan.innerText = timeLeft;
    comboSpan.innerText = combo;

    // pulse animation on score change
    scoreSpan.classList.add('pulse');
    setTimeout(() => scoreSpan.classList.remove('pulse'), 200);
  }

  // ----- high score -----
  function updateHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('clickRushHigh', highScore);
    }
  }

  // ----- stop game (timer end / forced) -----
  function stopGame(showGameOver = true) {
    if (!gameActive) return;
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);
    if (targetTimeout) clearTimeout(targetTimeout);
    if (nextTargetTimeout) clearTimeout(nextTargetTimeout);
    if (targetHideTimer) clearTimeout(targetHideTimer);
    removeCurrentTarget();

    if (showGameOver) {
      updateHighScore();
      finalScoreSpan.innerText = score;
      highScoreSpan.innerText = highScore;
      gameOverScreen.classList.remove('hidden');
    }
  }

  // ----- remove target from arena -----
  function removeCurrentTarget() {
    if (currentTarget && currentTarget.parentNode) {
      currentTarget.remove();
      currentTarget = null;
    }
    if (targetHideTimer) {
      clearTimeout(targetHideTimer);
      targetHideTimer = null;
    }
  }

  // ----- create particle burst (bonus) -----
  function createBurst(x, y) {
    const rect = gameArea.getBoundingClientRect();
    const canvasX = x - 8; // rough offset relative to canvas
    const canvasY = y - 8;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: canvasX, 
        y: canvasY,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 1.0,
        size: 4 + Math.random() * 6,
      });
    }
    if (!window._animFrame) {
      requestAnimationFrame(drawParticles);
    }
  }

  // draw particles on canvas
  function drawParticles() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.life -= 0.02;
      if (p.life <= 0) {
        particles.splice(i, 1);
      } else {
        alive = true;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = `hsl(${60 + Math.random()*40}, 90%, 60%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2);
        ctx.fill();
      }
    }
    if (alive) {
      requestAnimationFrame(drawParticles);
    } else {
      window._animFrame = false;
    }
  }

  // ----- spawn a new target -----
  function spawnTarget() {
    if (!gameActive) return;

    removeCurrentTarget(); // remove old one

    const target = document.createElement('div');
    target.className = 'target';

    // random position inside gameArea
    const targetSize = window.innerWidth <= 500 ? 60 : 70;
    const maxLeft = gameArea.clientWidth - targetSize - 8;
    const maxTop = gameArea.clientHeight - targetSize - 8;
    let left = Math.max(4, Math.min(maxLeft, Math.random() * maxLeft));
    let top = Math.max(4, Math.min(maxTop, Math.random() * maxTop));

    target.style.left = left + 'px';
    target.style.top = top + 'px';

    // click handler
    target.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!gameActive || !currentTarget) return;

      // HIT!
      if (soundEnabled && clickSound) {
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
      }

      // combo + score (multiplier)
      combo++;
      score += 10 * combo;
      updateUI();

      // particle burst
      createBurst(left + targetSize/2, top + targetSize/2);

      // remove target
      removeCurrentTarget();

      // next target with dynamic delay (difficulty: faster with combo)
      let baseDelay = 400;
      let dynamicDelay = Math.max(200, baseDelay - combo * 15);
      if (nextTargetTimeout) clearTimeout(nextTargetTimeout);
      nextTargetTimeout = setTimeout(() => spawnTarget(), dynamicDelay);
    });

    gameArea.appendChild(target);
    currentTarget = target;

    // auto disappear after 1-2 seconds
    const visibleTime = 1000 + Math.random() * 1000;
    targetHideTimer = setTimeout(() => {
      if (!gameActive || !currentTarget) return;
      // MISS: -5, combo reset
      score = Math.max(0, score - 5);
      combo = 0;
      updateUI();

      removeCurrentTarget();

      // spawn next after miss penalty
      if (nextTargetTimeout) clearTimeout(nextTargetTimeout);
      nextTargetTimeout = setTimeout(() => spawnTarget(), 500);
    }, visibleTime);
  }

  // ----- countdown before game (bonus) -----
  function startCountdown(callback) {
    let count = 3;
    countdownEl.classList.remove('hidden');
    countdownEl.innerText = count;
    const cdInterval = setInterval(() => {
      count--;
      if (count === 0) countdownEl.innerText = 'GO!';
      else if (count > 0) countdownEl.innerText = count;
      if (count < 0) {
        clearInterval(cdInterval);
        countdownEl.classList.add('hidden');
        callback();
      }
    }, 600);
  }

  // ----- reset and start game -----
  function resetAndStart() {
    // kill previous game
    if (gameActive) stopGame(false);
    
    // reset state
    score = 0;
    timeLeft = 30;
    combo = 0;
    gameActive = true;
    updateUI();
    removeCurrentTarget();
    if (timerInterval) clearInterval(timerInterval);
    if (nextTargetTimeout) clearTimeout(nextTargetTimeout);
    if (targetHideTimer) clearTimeout(targetHideTimer);

    // hide overlays
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    // start timer
    timerInterval = setInterval(() => {
      if (!gameActive) return;
      timeLeft--;
      timerSpan.innerText = timeLeft;
      if (timeLeft <= 0) {
        stopGame(true);
      }
    }, 1000);

    // begin with countdown, then spawn
    startCountdown(() => {
      if (gameActive) spawnTarget();
    });
  }

  // ----- event listeners -----
  muteBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    muteBtn.innerText = soundEnabled ? '🔊 SOUND' : '🔇 MUTE';
  });

  startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    resetAndStart();
  });

  restartBtn.addEventListener('click', resetAndStart);

  playAgainBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    resetAndStart();
  });

  // initialize
  highScoreSpan.innerText = highScore;
  resizeCanvas();
})();