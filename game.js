/**
 * Penalty Strike 2D - Core Engine
 * Developed by Antigravity
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const startBtn = document.getElementById('start-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const goalMessage = document.getElementById('goal-message');
const msgText = document.getElementById('msg-text');
const playerScoreEl = document.getElementById('player-score');
const cpuScoreEl = document.getElementById('cpu-score');
const finalScoreEl = document.getElementById('final-score');
const dragHint = document.getElementById('drag-hint');
const indicators = document.querySelectorAll('.indicator');

// Game Config
const CONFIG = {
    goalWidth: 360,
    goalHeight: 120,
    ballRadius: 10,
    gravity: 0,
    friction: 0.985,
    shotPowerLimit: 15,
    keeperSpeed: 2.5,
    canvasWidth: 1280,
    canvasHeight: 720
};

// State
let gameState = 'START'; // START, IDLE, AIMING, SHOOTING, RESULT, GAMEOVER
let score = { player: 0, keeper: 0 };
let currentShot = 0;
let maxShots = 5;
let shotHistory = [];

// Assets
const assets = {
    field: new Image(),
    crowd: new Image()
};
assets.field.src = 'assets/field.png';
assets.crowd.src = 'assets/crowd.png';

// Objects
class Ball {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 150;
        this.vx = 0;
        this.vy = 0;
        this.z = 0; // Height simulation
        this.vz = 0;
        this.radius = CONFIG.ballRadius;
        this.dragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.aimX = 0;
        this.aimY = 0;
    }

    update() {
        if (gameState === 'SHOOTING') {
            this.x += this.vx;
            this.y += this.vy;
            this.z += this.vz;
            this.vz -= 0.3; // Simulated gravity/fall

            if (this.z < 0) {
                this.z = 0;
                this.vz *= -0.4; // Bounce
            }

            this.vx *= CONFIG.friction;
            this.vy *= CONFIG.friction;

            // Stop if too slow
            if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1 && this.z < 1) {
                checkShotResult('MISSED');
            }
        }
    }

    draw() {
        ctx.save();
        
        // Shadow
        const shadowScale = 1 + (this.z / 50);
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 10, this.radius * shadowScale, this.radius * 0.5 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Ball
        ctx.translate(this.x, this.y - this.z);
        const ballScale = 1 + (this.z / 100);
        ctx.scale(ballScale, ballScale);
        
        // Sphere gradient
        const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, this.radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(1, '#ccc');
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pattern
        ctx.beginPath();
        ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
        ctx.moveTo(5, -5); ctx.lineTo(-5, 5);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.stroke();

        ctx.restore();

        // Aim line
        if (gameState === 'AIMING') {
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(this.x, this.y);
            const dx = this.x - this.aimX;
            const dy = this.y - this.aimY;
            ctx.lineTo(this.x + dx * 2, this.y + dy * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

class Keeper {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = canvas.width / 2;
        this.y = 180;
        this.width = 60;
        this.height = 80;
        this.diveX = 0;
        this.diveY = 0;
        this.state = 'IDLE'; // IDLE, DIVING, RETURN
        this.animTimer = 0;
    }

    update() {
        if (gameState === 'IDLE' || gameState === 'AIMING') {
            // Slight shuffle
            this.x += Math.sin(Date.now() / 500) * 1;
        }

        if (this.state === 'DIVING') {
            this.x += (this.diveX - this.x) * 0.15;
            this.y += (this.diveY - this.y) * 0.15;
            this.animTimer++;
            if (this.animTimer > 60) this.state = 'RETURN';
        }

        if (this.state === 'RETURN') {
            this.x += (canvas.width / 2 - this.x) * 0.05;
            this.y += (180 - this.y) * 0.05;
            if (Math.abs(this.x - canvas.width/2) < 5) this.state = 'IDLE';
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Body Shadow
        ctx.beginPath();
        ctx.ellipse(0, 40, 30, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();

        // Articulated Human Look (Top-Downish 2D)
        // Shirt (Black)
        ctx.fillStyle = '#111';
        ctx.fillRect(-20, -10, 40, 30);
        
        // Shorts (White)
        ctx.fillStyle = '#fff';
        ctx.fillRect(-20, 20, 40, 15);

        // Head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(0, -20, 12, 0, Math.PI * 2);
        ctx.fill();

        // Face detail
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-5, -22, 3, 3);
        ctx.fillRect(2, -22, 3, 3);

        // Arms / Gloves (Yellow)
        ctx.fillStyle = '#ff6b00'; // Darker orange/yellow for gloves
        if (this.state === 'DIVING') {
            const dir = Math.sign(this.diveX - (canvas.width / 2));
            ctx.beginPath();
            ctx.moveTo(dir * 15, 0);
            ctx.lineTo(dir * 50, -30);
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#111';
            ctx.stroke();
            
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(dir * 45, -40, 15, 20); // Glove
        } else {
            // Idle arms
            ctx.fillStyle = '#111';
            ctx.fillRect(-30, 0, 10, 25);
            ctx.fillRect(20, 0, 10, 25);
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-35, 20, 15, 12); // L Glove
            ctx.fillRect(20, 20, 15, 12);  // R Glove
        }

        ctx.restore();
    }

    dive(targetX, targetY) {
        this.state = 'DIVING';
        this.diveX = targetX;
        this.diveY = targetY;
        this.animTimer = 0;
    }
}

class Player {
    constructor() {
        this.x = canvas.width / 2 - 40;
        this.y = canvas.height - 120;
    }

    draw() {
        if (gameState === 'SHOOTING' || gameState === 'RESULT') return;
        
        ctx.save();
        ctx.translate(this.x, this.y);

        // Shirt (Red)
        ctx.fillStyle = '#ff2d2d';
        ctx.fillRect(-15, -10, 30, 30);
        
        // Shorts (Black)
        ctx.fillStyle = '#111';
        ctx.fillRect(-15, 20, 30, 15);

        // Head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(0, -20, 10, 0, Math.PI * 2);
        ctx.fill();

        // Arms
        ctx.fillStyle = '#ff2d2d';
        ctx.fillRect(-22, -8, 8, 20);
        ctx.fillRect(14, -8, 8, 20);

        // Shoes
        ctx.fillStyle = '#111';
        ctx.fillRect(-15, 35, 12, 6);
        ctx.fillRect(3, 35, 12, 6);

        ctx.restore();
    }
}

// Game Instances
let ball, keeper, player;

function init() {
    handleResize();
    window.addEventListener('resize', handleResize);
    
    ball = new Ball();
    keeper = new Keeper();
    player = new Player();

    requestAnimationFrame(loop);
}

function handleResize() {
    const container = document.getElementById('game-container');
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    const scale = Math.min(w / CONFIG.canvasWidth, h / CONFIG.canvasHeight);
    
    canvas.style.width = `${CONFIG.canvasWidth * scale}px`;
    canvas.style.height = `${CONFIG.canvasHeight * scale}px`;
    
    // Virtual resolution stays fixed
    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Background Layers
    // Field
    ctx.drawImage(assets.field, 0, 0, canvas.width, canvas.height);
    
    // Draw Goal
    drawGoal();

    // Update & Draw Objects
    keeper.update();
    keeper.draw();

    ball.update();
    ball.draw();

    player.draw();

    // Physics Checks
    if (gameState === 'SHOOTING') {
        checkCollisions();
    }

    requestAnimationFrame(loop);
}

function drawGoal() {
    const gx = (canvas.width - CONFIG.goalWidth) / 2;
    const gy = 150;

    // Net Pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for(let i=0; i <= CONFIG.goalWidth; i+=15) {
        ctx.beginPath();
        ctx.moveTo(gx + i, gy);
        ctx.lineTo(gx + i, gy + CONFIG.goalHeight);
        ctx.stroke();
    }
    for(let i=0; i <= CONFIG.goalHeight; i+=15) {
        ctx.beginPath();
        ctx.moveTo(gx, gy + i);
        ctx.lineTo(gx + CONFIG.goalWidth, gy + i);
        ctx.stroke();
    }

    // Goal Frame
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeRect(gx, gy, CONFIG.goalWidth, CONFIG.goalHeight);
    
    // Remove bottom line
    ctx.clearRect(gx + 4, gy + CONFIG.goalHeight - 4, CONFIG.goalWidth - 8, 8);
}

function checkCollisions() {
    const goalX = (canvas.width - CONFIG.goalWidth) / 2;
    const goalY = 150;

    // Goal Check
    if (ball.y <= goalY + 20 && ball.y > goalY - 20) {
        if (ball.x > goalX && ball.x < goalX + CONFIG.goalWidth) {
            if (ball.z < CONFIG.goalHeight) {
                checkShotResult('GOAL');
            } else {
                checkShotResult('OUT');
            }
        } else {
            checkShotResult('OUT');
        }
    }

    // Keeper Save Check
    const dist = Math.hypot(ball.x - keeper.x, (ball.y - ball.z) - (keeper.y + 10));
    if (dist < 40) {
        // Deflect ball
        ball.vx = (ball.x - keeper.x) * 0.5;
        ball.vy = 5;
        ball.vz = 2;
        checkShotResult('SAVED');
    }

    // Bounds check
    if (ball.y < 0 || ball.y > canvas.height || ball.x < 0 || ball.x > canvas.width) {
        checkShotResult('OUT');
    }
}

function checkShotResult(result) {
    if (gameState !== 'SHOOTING') return;
    gameState = 'RESULT';
    
    let isGoal = result === 'GOAL';
    if (isGoal) {
        score.player++;
        playerScoreEl.innerText = score.player;
        showGoalMessage("GOOOOOL!");
        indicators[currentShot].classList.add('success');
    } else {
        score.keeper++;
        cpuScoreEl.innerText = score.keeper;
        showGoalMessage(result === 'SAVED' ? "DEFENDAÇA!" : "FORA!");
        indicators[currentShot].classList.add('fail');
    }

    currentShot++;
    
    setTimeout(() => {
        if (currentShot >= maxShots) {
            endGame();
        } else {
            resetBall();
        }
    }, 2000);
}

function showGoalMessage(text) {
    msgText.innerText = text;
    goalMessage.classList.add('show');
    setTimeout(() => goalMessage.classList.remove('show'), 1500);
}

function resetBall() {
    ball.reset();
    keeper.reset();
    gameState = 'IDLE';
}

function endGame() {
    gameState = 'GAMEOVER';
    finalScoreEl.innerText = `${score.player} - ${score.keeper}`;
    gameOverScreen.classList.add('active');
}

// Input Handling
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'IDLE') return;
    
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (Math.hypot(mx - ball.x, my - ball.y) < 50) {
        ball.dragging = true;
        ball.dragStartX = mx;
        ball.dragStartY = my;
        gameState = 'AIMING';
        dragHint.style.opacity = '0';
    }
});

window.addEventListener('mousemove', (e) => {
    if (!ball.dragging) return;
    
    const rect = canvas.getBoundingClientRect();
    ball.aimX = (e.clientX - rect.left) * (canvas.width / rect.width);
    ball.aimY = (e.clientY - rect.top) * (canvas.height / rect.height);
});

window.addEventListener('mouseup', () => {
    if (!ball.dragging) return;
    
    ball.dragging = false;
    const dx = ball.x - ball.aimX;
    const dy = ball.y - ball.aimY;
    
    const power = Math.min(Math.hypot(dx, dy) / 10, CONFIG.shotPowerLimit);
    const angle = Math.atan2(dy, dx);
    
    ball.vx = Math.cos(angle) * power;
    ball.vy = Math.sin(angle) * power;
    ball.vz = power * 0.8; // Vertical lob based on power

    gameState = 'SHOOTING';
    
    // Keeper Decision
    setTimeout(() => {
        // Aim for where the ball is likely going
        const predictedX = ball.x + ball.vx * 30;
        const predictedZ = ball.vz * 10;
        keeper.dive(predictedX, 150 + (100 - predictedZ));
    }, 200);
});

// UI Events
startBtn.addEventListener('click', () => {
    startScreen.classList.remove('active');
    gameState = 'IDLE';
});

playAgainBtn.addEventListener('click', () => {
    score = { player: 0, keeper: 0 };
    currentShot = 0;
    playerScoreEl.innerText = "0";
    cpuScoreEl.innerText = "0";
    indicators.forEach(i => i.className = 'indicator');
    gameOverScreen.classList.remove('active');
    resetBall();
});

// Start
init();
