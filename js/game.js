/* Game module — Canvas-based offline dino game */
window.Napirajz = window.Napirajz || {};

window.Napirajz.Game = (function () {
  const GROUND_Y = 240;
  const PLAYER_X = 80;
  const GRAVITY = 0.6;
  const JUMP_FORCE = -14;
  const BASE_SPEED = 7;
  const SPEED_INCREMENT = 0.002;

  let canvas, ctx;
  let animFrame = null;
  let running = false;
  let gameOver = false;

  let player, obstacles, score, speed, frameCount;
  let highScore = 0;
  let listenersAttached = false;

  const playerSprite = new Image();
  playerSprite.src = 'icons/tibi.png';

  // Add new enemy image filenames here to include them in the game
  const ENEMY_SOURCES = [
    'icons/ellenseg.png',
    'icons/kutya.png',
    'icons/neni2-enemy.jpg',
  ];

  const enemySprites = ENEMY_SOURCES.map((src) => {
    const img = new Image();
    img.src = src;
    return img;
  });

  // Wobble helper — gives a sketchy hand-drawn offset
  function wobble(base, amount) {
    return base + (Math.random() * amount * 2 - amount);
  }

  function initPlayer() {
    player = {
      x: PLAYER_X,
      y: GROUND_Y - 70,
      vy: 0,
      width: 45,
      height: 70,
      grounded: true,
    };
  }

  function initState() {
    obstacles = [];
    score = 0;
    speed = BASE_SPEED;
    frameCount = 0;
    gameOver = false;
    initPlayer();
  }

  function drawGround() {
    ctx.beginPath();
    ctx.strokeStyle = '#434343';
    ctx.lineWidth = 2;
    // Wavy sine ground
    ctx.moveTo(0, GROUND_Y + 5);
    for (let x = 0; x <= canvas.width; x += 8) {
      const y = GROUND_Y + 5 + Math.sin(x * 0.05 + frameCount * 0.02) * 2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawPlayer() {
    ctx.drawImage(playerSprite, player.x, player.y, player.width, player.height);
  }

  function drawObstacle(obs) {
    ctx.drawImage(obs.sprite, obs.x, obs.y, obs.w, obs.h);
  }

  function spawnObstacle() {
    const sprite = enemySprites[Math.floor(Math.random() * enemySprites.length)];
    const h = 55 + Math.floor(Math.random() * 20);
    const w = Math.floor(h * 1.3);
    obstacles.push({
      x: canvas.width + 20,
      y: GROUND_Y - h,
      w,
      h,
      sprite,
    });
  }

  function updateObstacles() {
    // Random gaps: 300-700px between enemies, shrinking slightly with score
    const minGap = Math.max(400, 600 - Math.floor(score * 0.2));
    const maxGap = Math.max(700, 1400 - Math.floor(score * 0.3));
    if (obstacles.length === 0 && frameCount > 90) {
      spawnObstacle();
    } else {
      const last = obstacles[obstacles.length - 1];
      if (last && last.x < canvas.width - (minGap + Math.floor(Math.random() * (maxGap - minGap)))) {
        spawnObstacle();
      }
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed;
      if (obstacles[i].x + obstacles[i].w < 0) {
        obstacles.splice(i, 1);
      }
    }
  }

  function checkCollision() {
    const margin = 6;
    const px = player.x + margin;
    const py = player.y + margin;
    const pw = player.width - margin * 2;
    const ph = player.height - margin;

    for (const obs of obstacles) {
      if (
        px < obs.x + obs.w &&
        px + pw > obs.x &&
        py < obs.y + obs.h &&
        py + ph > obs.y
      ) {
        return true;
      }
    }
    return false;
  }

  function drawScore() {
    ctx.save();
    ctx.font = '18px Patrick Hand, cursive';
    ctx.fillStyle = '#434343';
    ctx.textAlign = 'right';
    ctx.fillText(Math.floor(score), canvas.width - 16, 28);
    ctx.restore();
  }

  function drawGameOver() {
    ctx.save();
    ctx.font = 'bold 28px Patrick Hand, cursive';
    ctx.fillStyle = '#2ea2cc';
    ctx.textAlign = 'center';
    ctx.fillText('Vége!', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '18px Patrick Hand, cursive';
    ctx.fillStyle = '#434343';
    ctx.fillText('Nyomj szóközt vagy kattints az újrakezdéshez', canvas.width / 2, canvas.height / 2 + 20);
    ctx.restore();
  }

  function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameOver) {
      // Physics
      if (!player.grounded) {
        player.vy += GRAVITY;
        player.y += player.vy;
      }
      if (player.y >= GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.grounded = true;
      }

      speed += SPEED_INCREMENT;
      score += speed * 0.02;
      frameCount++;

      updateObstacles();

      if (checkCollision()) {
        gameOver = true;
        running = false;
        saveHighScore();
        updateScoreDisplay();
        drawGround();
        drawObstacles();
        drawPlayer();
        drawGameOver();
        return;
      }
    }

    drawGround();
    drawObstacles();
    drawPlayer();
    drawScore();
    updateScoreDisplay();

    if (running) {
      animFrame = requestAnimationFrame(gameLoop);
    }
  }

  function drawObstacles() {
    obstacles.forEach(drawObstacle);
  }

  function jump() {
    if (player.grounded) {
      player.vy = JUMP_FORCE;
      player.grounded = false;
    }
  }

  function startGame() {
    if (animFrame) cancelAnimationFrame(animFrame);
    initState();
    running = true;
    updateScoreDisplay();
    animFrame = requestAnimationFrame(gameLoop);
  }

  function handleInput() {
    if (gameOver) {
      startGame();
    } else if (!running) {
      startGame();
    } else {
      jump();
    }
  }

  function updateScoreDisplay() {
    const el = document.getElementById('current-score');
    if (el) el.textContent = Math.floor(score);
    const hs = document.getElementById('high-score');
    if (hs) hs.textContent = Math.max(highScore, Math.floor(score));
  }

  async function saveHighScore() {
    const current = Math.floor(score);
    if (current > highScore) {
      highScore = current;
      await window.Napirajz.Storage.setHighScore(highScore);
      const hs = document.getElementById('high-score');
      if (hs) hs.textContent = highScore;
    }
  }

  async function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    highScore = await window.Napirajz.Storage.getHighScore();
    const hsEl = document.getElementById('high-score');
    if (hsEl) hsEl.textContent = highScore;

    // Draw initial idle state with proper state
    initState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround();
    drawPlayer();

    // Only attach listeners once
    if (!listenersAttached) {
      listenersAttached = true;
      canvas.addEventListener('click', handleInput);
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          handleInput();
        }
      });
    }
  }

  function stop() {
    running = false;
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  return { init, stop };
})();
