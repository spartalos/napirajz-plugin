/* Game module — Canvas-based offline dino game */
window.Napirajz = window.Napirajz || {};

window.Napirajz.Game = (function () {
  const GROUND_Y = 240;
  const PLAYER_X = 80;
  const GRAVITY = 0.6;
  const JUMP_FORCE = -14;
  const BASE_SPEED = 5;
  const SPEED_INCREMENT = 0.001;

  let canvas, ctx;
  let animFrame = null;
  let running = false;
  let gameOver = false;

  let player, obstacles, score, speed, frameCount;
  let highScore = 0;

  // Wobble helper — gives a sketchy hand-drawn offset
  function wobble(base, amount) {
    return base + (Math.random() * amount * 2 - amount);
  }

  function initPlayer() {
    player = {
      x: PLAYER_X,
      y: GROUND_Y - 50,
      vy: 0,
      width: 28,
      height: 50,
      grounded: true,
      wobbleOffset: 0,
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
    ctx.save();
    ctx.strokeStyle = '#434343';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = '#f5f0e8';

    const x = player.x;
    const y = player.y;
    const w = 2; // wobble amount (subtle while running)

    // Body — slightly wobbly rectangle
    ctx.beginPath();
    ctx.moveTo(wobble(x + 4, w), wobble(y + 15, w));
    ctx.quadraticCurveTo(
      wobble(x + player.width / 2, w), wobble(y + 12, w),
      wobble(x + player.width - 4, w), wobble(y + 15, w)
    );
    ctx.quadraticCurveTo(
      wobble(x + player.width, w), wobble(y + player.height * 0.6, w),
      wobble(x + player.width - 4, w), wobble(y + player.height, w)
    );
    ctx.quadraticCurveTo(
      wobble(x + player.width / 2, w), wobble(y + player.height + 3, w),
      wobble(x + 4, w), wobble(y + player.height, w)
    );
    ctx.quadraticCurveTo(
      wobble(x, w), wobble(y + player.height * 0.6, w),
      wobble(x + 4, w), wobble(y + 15, w)
    );
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(
      wobble(x + player.width / 2, w),
      wobble(y + 8, w),
      wobble(10, w),
      0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();

    // Eye
    ctx.beginPath();
    ctx.arc(x + player.width / 2 + 3, y + 6, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#434343';
    ctx.fill();

    ctx.restore();
  }

  const OBSTACLE_TYPES = ['cat', 'cup', 'can'];

  function drawObstacle(obs) {
    ctx.save();
    ctx.strokeStyle = '#A7144C';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#f5f0e8';
    const w = 2;

    if (obs.type === 'cat') {
      // Simple cat silhouette
      ctx.beginPath();
      ctx.moveTo(wobble(obs.x + 5, w), wobble(obs.y + obs.h, w));
      ctx.lineTo(wobble(obs.x + 5, w), wobble(obs.y + 8, w));
      ctx.lineTo(wobble(obs.x + 2, w), wobble(obs.y, w)); // left ear
      ctx.lineTo(wobble(obs.x + 10, w), wobble(obs.y + 8, w));
      ctx.lineTo(wobble(obs.x + obs.w - 10, w), wobble(obs.y + 8, w));
      ctx.lineTo(wobble(obs.x + obs.w - 2, w), wobble(obs.y, w)); // right ear
      ctx.lineTo(wobble(obs.x + obs.w - 5, w), wobble(obs.y + 8, w));
      ctx.lineTo(wobble(obs.x + obs.w - 5, w), wobble(obs.y + obs.h, w));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (obs.type === 'cup') {
      // Coffee cup
      ctx.beginPath();
      ctx.moveTo(wobble(obs.x + 3, w), wobble(obs.y, w));
      ctx.lineTo(wobble(obs.x + obs.w - 3, w), wobble(obs.y, w));
      ctx.lineTo(wobble(obs.x + obs.w, w), wobble(obs.y + obs.h, w));
      ctx.lineTo(wobble(obs.x, w), wobble(obs.y + obs.h, w));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Handle
      ctx.beginPath();
      ctx.arc(obs.x + obs.w + 4, obs.y + obs.h * 0.55, 7, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    } else {
      // Trash can
      ctx.beginPath();
      ctx.rect(wobble(obs.x + 2, w), wobble(obs.y + 4, w), obs.w - 4, obs.h - 4);
      ctx.fill();
      ctx.stroke();
      // Lid
      ctx.beginPath();
      ctx.rect(wobble(obs.x, w), wobble(obs.y, w), obs.w, 5);
      ctx.fill();
      ctx.stroke();
      // Lines
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w * 0.3 * i, obs.y + 8);
        ctx.lineTo(obs.x + obs.w * 0.3 * i, obs.y + obs.h - 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function spawnObstacle() {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    const h = 30 + Math.floor(Math.random() * 25);
    const w = 22 + Math.floor(Math.random() * 16);
    obstacles.push({
      x: canvas.width + 20,
      y: GROUND_Y - h,
      w,
      h,
      type,
    });
  }

  function updateObstacles() {
    const gap = Math.max(60, 120 - score * 0.1);
    const spawnInterval = Math.max(50, Math.floor(gap / speed * 60));
    if (frameCount % spawnInterval === 0) {
      spawnObstacle();
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
    ctx.fillStyle = '#A7144C';
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

    // Draw initial idle state
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround();

    canvas.addEventListener('click', handleInput);
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleInput();
      }
    });
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
