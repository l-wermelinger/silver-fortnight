// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size (viewport size)
canvas.width = 800;
canvas.height = 600;

// Map size (much larger than viewport)
const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1800;

// Camera
const camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
};

// Game state
let gameRunning = true;
let score = 0;
let wave = 1;
let lastTime = 0;
let deltaTime = 0;
let enemiesInWave = 0;
let waveCompleted = true;

// Player
const player = {
    x: MAP_WIDTH / 2,
    y: MAP_HEIGHT / 2,
    width: 30,
    height: 30,
    speed: 200,
    health: 100,
    maxHealth: 100,
    angle: 0,
    weapon: 'rifle',
    ammo: 200,
    maxAmmo: 200,
    shootCooldown: 0,
    reloadTime: 2,
    isReloading: false,
    reloadProgress: 0,
    color: '#0066ff',  // Changed to blue
    // New leveling system
    level: 1,
    experience: 0,
    experienceToNextLevel: 100,
    skillPoints: 0,
    // Special abilities
    abilities: {
        dash: {
            cooldown: 2.0,          // Increased from 0.5 to 2.0 seconds
            currentCooldown: 0,
            duration: 0.4,
            speed: 1000,
            isActive: false,
            charges: 3,
            maxCharges: 3,
            chargeRefreshTime: 3.0,  // Increased from 1.0 to 3.0 seconds
            chargeTimer: 0,
            damage: 200,
            trailColor: '#0066ff',
            trailLength: 20,
            radius: 150,
            chainRange: 300,
            chainCount: 0,
            maxChains: 3,
            chainDelay: 0.1,
            direction: { x: 0, y: 0 }
        },
        shield: {
            cooldown: 10,
            currentCooldown: 0,
            duration: 3,
            isActive: false
        },
        timeSlow: {
            cooldown: 15,
            currentCooldown: 0,
            duration: 5,
            slowFactor: 0.5,
            isActive: false
        }
    },
    // Stats that can be upgraded with skill points
    stats: {
        maxHealthBonus: 0,
        speedBonus: 0,
        damageBonus: 0,
        criticalChance: 0
    },
    autoShoot: true,
    autoShootRange: 400
};

// Experience thresholds for each level
const levelThresholds = Array.from({length: 50}, (_, i) => Math.floor(100 * Math.pow(1.5, i)));

// Skill upgrade costs
const skillUpgradeCosts = {
    maxHealth: 1,
    speed: 1,
    damage: 1,
    criticalChance: 2
};

// Weapons
const weapons = {
    rifle: {
        name: 'Assault Rifle',
        damage: 50,
        fireRate: 0.05,      // Very fast fire rate (20 shots per second)
        projectileSpeed: 800,
        ammoCapacity: 200,   // Doubled from 100 to 200
        spread: 0.02,        // Very accurate
        projectileType: 'laser',
        penetrating: true    // Shots go through enemies
    }
};

// Add scoring system variables
let highScore = 0;
let lastKillTime = 0;
let killStreak = 0;
const MULTIKILL_TIME = 1.5; // Time window for multikills in seconds
let multiKillCount = 0;
let multiKillTimer = 0;

// Enemy types with reduced speeds
const enemyTypes = {
    tank: {
        width: 120,
        height: 120,
        speed: 20,          // Reduced from 40 to 20
        health: 1500,
        damage: 30,
        color: '#00ff00',  // Changed to bright green
        points: 50
    },
    shooter: {
        width: 40,
        height: 40,
        speed: 40,          // Reduced from 80 to 40
        health: 40,
        damage: 10,
        color: '#00ff00',  // Changed to bright green
        points: 15,
        fireRate: 2,
        projectileSpeed: 200
    },
    fast: {
        width: 30,
        height: 30,
        speed: 90,          // Reduced from 180 to 90
        health: 20,
        damage: 5,
        color: '#00ff00',  // Changed to bright green
        points: 20
    },
    normal: {
        width: 40,
        height: 40,
        speed: 50,          // Reduced from 100 to 50
        health: 40,
        damage: 10,
        color: '#00ff00',  // Changed to bright green
        points: 10
    },
    chemical: {
        width: 50,
        height: 50,
        speed: 45,          // Reduced from 90 to 45
        health: 60,
        damage: 15,
        color: '#00ff00',  // Changed to bright green
        points: 25
    }
};

// Arrays for game objects
let enemies = [];
let projectiles = [];
let powerUps = [];
let enemyProjectiles = [];
let chemicalClouds = [];
let particles = [];

// Input handling
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ' ': false,
    q: false,
    e: false,
    t: false
};

const mouse = {
    x: 0,
    y: 0,
    clicked: false
};

// Event listeners
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    // Handle auto-shoot toggle
    if (key === 't') {
        player.autoShoot = !player.autoShoot;
        // Add visual feedback
        createFloatingText(
            player.x,
            player.y - 30,
            `Auto-shoot ${player.autoShoot ? 'ON' : 'OFF'}`,
            '#00ffff',
            20
        );
        console.log('Auto-shoot:', player.autoShoot ? 'ON' : 'OFF'); // Debug log
    }
    
    // Update other keys
    if (key in keys) {
        keys[key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = false;
    }
});

// Track player movement direction
let lastPlayerX = MAP_WIDTH / 2;
let lastPlayerY = MAP_HEIGHT / 2;
let playerMoveDirection = { x: 0, y: 0 };

// Update player movement direction
function updatePlayerDirection() {
    const dx = player.x - lastPlayerX;
    const dy = player.y - lastPlayerY;
    if (dx !== 0 || dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            playerMoveDirection.x = dx / length;
            playerMoveDirection.y = dy / length;
        }
    }
    lastPlayerX = player.x;
    lastPlayerY = player.y;
}

// Update camera to follow player
function updateCamera() {
    // Center camera on player
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    
    // Keep camera within map bounds
    camera.x = Math.max(0, Math.min(camera.x, MAP_WIDTH - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, MAP_HEIGHT - canvas.height));
}

// Convert world coordinates to screen coordinates
function worldToScreen(worldX, worldY) {
    return {
        x: worldX - camera.x,
        y: worldY - camera.y
    };
}

// Convert screen coordinates to world coordinates
function screenToWorld(screenX, screenY) {
    return {
        x: screenX + camera.x,
        y: screenY + camera.y
    };
}

// Modify mouse event handler to use world coordinates
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    mouse.x = worldPos.x;
    mouse.y = worldPos.y;
    
    // Update player angle based on world coordinates
    player.angle = Math.atan2(
        worldPos.y - player.y,
        worldPos.x - player.x
    );
});

canvas.addEventListener('mousedown', () => {
    mouse.clicked = true;
});

canvas.addEventListener('mouseup', () => {
    mouse.clicked = false;
});

// Modify the projectile creation to include penetration
function shoot() {
    if (player.ammo <= 0) {
        startReload();
        return;
    }

    const weapon = weapons[player.weapon];
            player.ammo--;
            player.shootCooldown = weapon.fireRate;
            
    audio.playSound('shoot');  // Add shooting sound
    
    const numProjectiles = weapon.projectiles || 1;
    const baseAngle = player.angle;
    const damage = weapon.damage * (1 + player.stats.damageBonus / 100);

    for (let i = 0; i < numProjectiles; i++) {
        const spread = (Math.random() - 0.5) * weapon.spread;
        const angle = baseAngle + spread;

        const projectile = {
            x: player.x,
            y: player.y,
            width: weapon.projectileType === 'laser' ? 4 : 8,
            height: weapon.projectileType === 'laser' ? 4 : 8,
            speed: weapon.projectileSpeed,
            angle: angle,
            damage: damage,
            penetrating: weapon.penetrating || false,
            type: weapon.projectileType,
            color: getProjectileColor(weapon.projectileType)
        };

        if (weapon.projectileType === 'explosive') {
            projectile.explosionRadius = weapon.explosionRadius;
        }

        if (weapon.projectileType === 'flame') {
            projectile.dotDamage = weapon.dotDamage;
            projectile.dotDuration = weapon.dotDuration;
        }

        projectiles.push(projectile);
        createMuzzleFlash(player.x, player.y, angle);
    }
}

// Start reload
function startReload() {
    if (!player.isReloading && player.ammo < weapons[player.weapon].ammoCapacity) {
        player.isReloading = true;
        player.reloadProgress = 0;
        audio.playSound('reload');  // Add reload sound
    }
}

// Find nearest enemy
function findNearestEnemy() {
    if (enemies.length === 0) return null;
    
    let nearest = null;
    let minDist = Infinity;
    
    for (const enemy of enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < minDist && dist <= player.autoShootRange) {
            minDist = dist;
            nearest = enemy;
        }
    }
    
    return nearest;
}

// Achievement system
const achievements = {
    sharpshooter: {
        name: 'Sharpshooter',
        description: 'Kill 50 enemies with headshots',
        progress: 0,
        goal: 50,
        unlocked: false
    },
    survivor: {
        name: 'Survivor',
        description: 'Survive 10 waves',
        progress: 0,
        goal: 10,
        unlocked: false
    },
    arsenal: {
        name: 'Arsenal Master',
        description: 'Collect all weapons',
        progress: 0,
        goal: Object.keys(weapons).length,
        unlocked: false
    },
    speedster: {
        name: 'Speedster',
        description: 'Kill 100 enemies while dashing',
        progress: 0,
        goal: 100,
        unlocked: false
    },
    tankKiller: {
        name: 'Tank Killer',
        description: 'Destroy 20 tank enemies',
        progress: 0,
        goal: 20,
        unlocked: false
    }
};

function checkAchievements() {
    Object.entries(achievements).forEach(([key, achievement]) => {
        if (!achievement.unlocked && achievement.progress >= achievement.goal) {
            achievement.unlocked = true;
            // Show achievement notification
            createFloatingText(
                canvas.width / 2,
                50,
                `Achievement Unlocked: ${achievement.name}!`,
                '#ffd700',
                24
            );
            // Give reward
            player.skillPoints += 2;
        }
    });
}

// Add visual effects configuration
const visualEffects = {
    timeSlow: {
        color: '#00ffff',
        vignette: true,
        particles: true,
        screenShake: 0.5
    },
    dash: {
        trailColor: '#4444ff',
        trailLength: 5,
        screenShake: 0.3
    },
    shield: {
        pulseColor: '#0088ff',
        rippleEffect: true,
        particleColor: '#00ffff'
    }
};

// Add new power-up types
const powerUpTypes = {
    health: {
        color: '#ff0000',
        effect: (player) => {
            player.health = Math.min(player.maxHealth, player.health + 50);
            createFloatingText(player.x, player.y - 20, '+50 HP', '#ff0000', 20);
        }
    },
    ammo: {
        color: '#ffff00',
        effect: (player) => {
            player.ammo = weapons[player.weapon].ammoCapacity;
            createFloatingText(player.x, player.y - 20, 'Ammo Refilled!', '#ffff00', 20);
        }
    },
    speedBoost: {
        color: '#00ff00',
        duration: 5,
        effect: (player) => {
            player.stats.speedBonus += 100;
            setTimeout(() => {
                player.stats.speedBonus -= 100;
            }, 5000);
            createFloatingText(player.x, player.y - 20, 'Speed Boost!', '#00ff00', 20);
        }
    },
    weaponUpgrade: {
        color: '#ff00ff',
        effect: (player) => {
            const currentWeapon = player.weapon;
            const availableWeapons = Object.keys(weapons);
            const currentIndex = availableWeapons.indexOf(currentWeapon);
            const nextWeapon = availableWeapons[(currentIndex + 1) % availableWeapons.length];
            player.weapon = nextWeapon;
            player.ammo = weapons[nextWeapon].ammoCapacity;
            createFloatingText(player.x, player.y - 20, `New Weapon: ${nextWeapon}!`, '#ff00ff', 20);
        }
    },
    nuke: {
        color: '#ff4500',
        effect: (player) => {
            enemies.forEach(enemy => {
                enemy.health -= 100;
                if (enemy.health <= 0) {
                    score += enemy.points;
                    createParticles(enemy.x, enemy.y, 'explosion');
                }
            });
            addScreenShake(10);
            createFloatingText(player.x, player.y - 20, 'NUKE!', '#ff4500', 30);
        }
    }
};

// Add combo system
let combo = 0;
let comboTimer = 0;
const COMBO_TIME = 3; // seconds to maintain combo

function updateGameLoop(deltaTime) {
    if (!gameRunning) return;

    // Handle abilities
    handleAbilities(deltaTime);

    // Apply time slow effect if active
    const effectiveDeltaTime = player.abilities.timeSlow.isActive ? 
        deltaTime * player.abilities.timeSlow.slowFactor : deltaTime;

    // Update game objects
    updatePlayer(effectiveDeltaTime);
    updateProjectiles(effectiveDeltaTime);
    updateEnemies(effectiveDeltaTime);
    updateParticles(effectiveDeltaTime);
    updateHazards(effectiveDeltaTime);
    updateCamera();
    
    // Update DOT effects
    updateDotEffects(player, effectiveDeltaTime);
    enemies.forEach(enemy => updateDotEffects(enemy, effectiveDeltaTime));

    // Check for wave completion
    if (enemies.length === 0 && enemiesInWave === 0) {
        if (!waveCompleted) {
            waveCompleted = true;
            wave++;
            achievements.survivor.progress = wave;
            // Give rewards for completing wave
            gainExperience(wave * 50);
            player.skillPoints++;
            
            // Spawn random weapon pickup
            const availableWeapons = Object.keys(weapons);
            const randomWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
            createPowerUp(
                Math.random() * MAP_WIDTH,
                Math.random() * MAP_HEIGHT,
                'weapon',
                randomWeapon
            );

            // Add environmental hazards
            for (let i = 0; i < wave; i++) {
                const hazardTypes = ['spikes', 'acid', 'fire'];
                const randomType = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
                createHazard(
                    randomType,
                    Math.random() * MAP_WIDTH,
                    Math.random() * MAP_HEIGHT
                );
            }
        }
        startNewWave();
    }

    // Check achievements
    checkAchievements();

    // Update screen shake
    if (screenShake > 0) {
        screenShake -= deltaTime * 60;
        if (screenShake < 0) screenShake = 0;
    }

    // Update combo timer
    if (combo > 0) {
        comboTimer -= deltaTime;
        if (comboTimer <= 0) {
            combo = 0;
        }
    }

    // Update multikill timer
    if (multiKillTimer > 0) {
        multiKillTimer -= deltaTime;
        if (multiKillTimer <= 0) {
            multiKillCount = 0;
        }
    }
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    updateGameLoop(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

function draw() {
    // Apply screen shake before clearing
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake * 2;
        const shakeY = (Math.random() - 0.5) * screenShake * 2;
        ctx.translate(shakeX, shakeY);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    drawGrid();

    // Draw game objects
    drawProjectiles();
    drawEnemies();
    drawPlayer();
    drawParticles();
    drawPowerUps();

    // Draw UI
                    updateUI();

    // Draw simple white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Convert world borders to screen coordinates
    const topLeft = worldToScreen(0, 0);
    const bottomRight = worldToScreen(MAP_WIDTH, MAP_HEIGHT);

    // Draw border
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(bottomRight.x, topLeft.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(topLeft.x, bottomRight.y);
    ctx.closePath();
    ctx.stroke();

    // Reset transform after shake
    if (screenShake > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        screenShake = Math.max(0, screenShake - 1);  // Smoother shake decay
    }
}

function drawAchievements() {
    const recentAchievements = Object.values(achievements)
        .filter(a => a.unlocked)
        .slice(-1); // Only show most recent achievement

    if (recentAchievements.length === 0) return;

    const achievement = recentAchievements[0];
    const achievementY = 20;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, achievementY - 15, 200, 30);

    ctx.fillStyle = '#ffd700';
    ctx.font = '14px Arial';
    ctx.fillText(achievement.name, 20, achievementY + 5);
}

function createPowerUp(x, y, type, value) {
    powerUps.push({
        x,
        y,
        width: 30,
        height: 30,
        type,
        value,
        collectible: true
    });
}

function drawPowerUps() {
    powerUps.forEach(powerUp => {
        const screenPos = worldToScreen(powerUp.x, powerUp.y);
        
        // Draw power-up
        ctx.save();
        ctx.translate(screenPos.x + powerUp.width / 2, screenPos.y + powerUp.height / 2);
        
        // Make power-ups float and rotate
        const floatOffset = Math.sin(Date.now() / 500) * 5;
        ctx.translate(0, floatOffset);
        ctx.rotate(Date.now() / 1000);

        // Draw different icons for different power-up types
        switch (powerUp.type) {
            case 'weapon':
                ctx.fillStyle = '#ffd700';
                drawStar(0, 0, 20, 10, 5);
                break;
            case 'health':
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(-10, -10, 20, 20);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-8, -2, 16, 4);
                ctx.fillRect(-2, -8, 4, 16);
                break;
            case 'ammo':
                ctx.fillStyle = '#ffff00';
                ctx.fillRect(-10, -5, 20, 10);
                ctx.fillRect(-5, -10, 10, 20);
                break;
        }
        
        ctx.restore();
    });
}

// Draw player with updated colors and simplified health bar
function drawPlayer() {
    const screenPos = worldToScreen(player.x, player.y);
    
    // Draw player
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(player.angle);

    // Player body with blue gradient
    const bodyGradient = ctx.createLinearGradient(-player.width/2, 0, player.width/2, 0);
    bodyGradient.addColorStop(0, '#0066ff');  // Blue
    bodyGradient.addColorStop(1, '#0044cc');  // Darker blue
    ctx.fillStyle = bodyGradient;
    ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);

    // Draw weapon
    ctx.fillStyle = '#333';
    ctx.fillRect(0, -5, 20, 10);
    
    ctx.restore();
    
    // Draw simplified health bar (only green)
    const healthBarWidth = 40;
    const healthBarHeight = 5;
    const healthBarY = screenPos.y - 25;

    // Health bar background (dark green)
    ctx.fillStyle = '#004400';
    ctx.fillRect(screenPos.x - healthBarWidth/2, healthBarY, healthBarWidth, healthBarHeight);
    
    // Health bar fill (bright green)
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(
        screenPos.x - healthBarWidth/2,
        healthBarY,
        (player.health / player.maxHealth) * healthBarWidth,
        healthBarHeight
    );
}

// Reorganized UI with better layout
function updateUI() {
    // Top bar for essential info
    const topBarHeight = 40;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, topBarHeight);

    // Score and High Score (top left)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`High Score: ${highScore}`, 20, 25);
    ctx.fillText(`Score: ${score}`, 200, 25);

    // Wave counter (top center)
    ctx.textAlign = 'center';
    ctx.fillText(`Wave ${wave}`, canvas.width / 2, 25);

    // Auto-shoot indicator (top right)
    if (player.autoShoot) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('AUTO', canvas.width - 20, 25);
    }

    // Bottom bar for player info
    const bottomBarHeight = 50;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, canvas.height - bottomBarHeight, canvas.width, bottomBarHeight);

    // Ammo counter (bottom right)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Ammo: ${player.ammo}`, canvas.width - 20, canvas.height - 20);

    // Kill streak (only show when active)
    if (killStreak > 1) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`${killStreak}x Streak!`, canvas.width / 2, canvas.height - 20);
    }

    // Draw dash charges (bottom left)
    const chargeX = 20;
    const chargeY = canvas.height - 30;
    const chargeSize = 15;
    const chargeGap = 5;

    // Draw dash charges
    for (let i = 0; i < player.abilities.dash.maxCharges; i++) {
        ctx.beginPath();
        ctx.arc(chargeX + i * (chargeSize + chargeGap), chargeY, chargeSize/2, 0, Math.PI * 2);
        
        // Available charges in blue, used charges in gray
        if (i < player.abilities.dash.charges) {
            ctx.fillStyle = '#0066ff';
        } else {
            ctx.fillStyle = '#666666';
        }
        ctx.fill();
    }

    // Reset text alignment
    ctx.textAlign = 'left';
}

// Game over
function gameOver() {
    gameRunning = false;
    audio.stopSound('backgroundMusic');  // Stop background music
    audio.playSound('gameOver');  // Play game over sound
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').textContent = score;
}

// Reset game
function resetGame() {
    player.x = MAP_WIDTH / 2;
    player.y = MAP_HEIGHT / 2;
    player.health = player.maxHealth;
    player.ammo = weapons[player.weapon].ammoCapacity;
    
    updateCamera();
    
    enemies = [];
    projectiles = [];
    powerUps = [];
    enemyProjectiles = [];
    chemicalClouds = [];
    particles = [];
    
    score = 0;
    wave = 1;
    waveCompleted = true;
    enemiesInWave = 0;
    
    gameRunning = true;
    
    document.getElementById('game-over').style.display = 'none';
    
    updateUI();
}

// Start new wave
function startNewWave() {
    waveCompleted = false;
    enemiesInWave = 120 + wave * 40; // Doubled from 60 to 120 base enemies, and from 20 to 40 per wave
}

// Event listeners for buttons
document.getElementById('restart-button').addEventListener('click', resetGame);

// Create chemical cloud
function createChemicalCloud(x, y) {
    chemicalClouds.push({
        x: x - 25,
        y: y - 25,
        width: 100,
        height: 100,
        damage: 20,
        duration: 3,
        timer: 3,
        color: 'rgba(50, 205, 50, 0.3)'
    });
}

// Update chemical clouds
function updateChemicalClouds(deltaTime) {
    for (let i = chemicalClouds.length - 1; i >= 0; i--) {
        const cloud = chemicalClouds[i];
        cloud.timer -= deltaTime;
        
        // Check if player is in cloud
        if (checkCollision(cloud, player)) {
            player.health -= cloud.damage * deltaTime;
            if (player.health <= 0) {
                gameOver();
            }
            updateUI();
        }
        
        // Remove cloud if duration is over
        if (cloud.timer <= 0) {
            chemicalClouds.splice(i, 1);
        }
    }
}

// Spawn enemy
function spawnEnemy() {
    // Spawn enemies just outside the camera view
    const buffer = 100; // Distance outside viewport to spawn
    const spawnRadius = 400; // Radius around spawn point to randomize position
    
    // Base spawn position on player's movement direction
    let baseX, baseY;
    
    // If player is moving, favor spawning in that direction
    if (Math.abs(playerMoveDirection.x) > 0.1 || Math.abs(playerMoveDirection.y) > 0.1) {
        // Project ahead of player's movement
        baseX = player.x + playerMoveDirection.x * (canvas.width + buffer);
        baseY = player.y + playerMoveDirection.y * (canvas.height + buffer);
    } else {
        // Default to random side if player isn't moving much
        const side = Math.floor(Math.random() * 4);
        switch(side) {
            case 0: // Top
                baseX = camera.x + Math.random() * camera.width;
                baseY = camera.y - buffer;
                break;
            case 1: // Right
                baseX = camera.x + camera.width + buffer;
                baseY = camera.y + Math.random() * camera.height;
                break;
            case 2: // Bottom
                baseX = camera.x + Math.random() * camera.width;
                baseY = camera.y + camera.height + buffer;
                break;
            case 3: // Left
                baseX = camera.x - buffer;
                baseY = camera.y + Math.random() * camera.height;
                break;
        }
    }
    
    // Add randomness to spawn position
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * spawnRadius;
    const x = baseX + Math.cos(angle) * distance;
    const y = baseY + Math.sin(angle) * distance;
    
    // Keep spawn position within map bounds
    const clampedX = Math.max(0, Math.min(x, MAP_WIDTH));
    const clampedY = Math.max(0, Math.min(y, MAP_HEIGHT));
    
    // Random enemy type selection with weighted probabilities
    const types = [];
    // Add multiple entries to increase probability
    for (let i = 0; i < 3; i++) types.push('normal'); // Common
    for (let i = 0; i < 2; i++) types.push('fast');   // Somewhat common
    types.push('tank');     // Rare
    types.push('shooter');  // Rare
    types.push('chemical'); // Rare
    
    const type = types[Math.floor(Math.random() * types.length)];
    const enemyType = enemyTypes[type];
    
    enemies.push({
        x: clampedX,
        y: clampedY,
        width: enemyType.width,
        height: enemyType.height,
        initialWidth: enemyType.width,    // Store initial size
        initialHeight: enemyType.height,   // Store initial size
        speed: enemyType.speed,
        health: enemyType.health,
        maxHealth: enemyType.health,       // Store max health
        damage: enemyType.damage,
        color: enemyType.color,
        points: enemyType.points,
        type: type,
        shootCooldown: 0
    });
}

// Update particle types with blue dash trail
const particleTypes = {
    blood: {
        color: '#ffffff',
        size: { min: 2, max: 4 },
        speed: { min: 100, max: 200 },
        lifetime: { min: 0.3, max: 0.6 },
        spread: Math.PI / 2,
        count: { min: 4, max: 8 }
    },
    explosion: {
        color: '#ffffff',
        size: { min: 2, max: 6 },
        speed: { min: 100, max: 200 },
        lifetime: { min: 0.2, max: 0.4 },
        spread: Math.PI * 2,
        count: { min: 8, max: 12 }
    },
    sparkle: {
        color: '#ffffff',
        size: { min: 1, max: 2 },
        speed: { min: 50, max: 100 },
        lifetime: { min: 0.1, max: 0.3 },
        spread: Math.PI * 2,
        count: { min: 3, max: 5 }
    },
    dashTrail: {
        color: '#0066ff',
        size: { min: 4, max: 6 },
        speed: { min: 0, max: 0 },
        lifetime: { min: 0.8, max: 1.0 },
        spread: 0,
        count: { min: 1, max: 1 },
        alpha: { start: 0.8, end: 0 },
        fadeOut: true,
        isTrail: true  // New flag to identify trail particles
    }
};

// Create particles
function createParticles(x, y, type, direction = 0) {
    const config = particleTypes[type];
    const count = Math.floor(Math.random() * (config.count.max - config.count.min) + config.count.min);
    
    for (let i = 0; i < count; i++) {
        const angle = direction + (Math.random() - 0.5) * config.spread;
        const speed = Math.random() * (config.speed.max - config.speed.min) + config.speed.min;
        const size = Math.random() * (config.size.max - config.size.min) + config.size.min;
        const lifetime = Math.random() * (config.lifetime.max - config.lifetime.min) + config.lifetime.min;
        
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: size,
            color: config.color,
            lifetime: lifetime,
            maxLifetime: lifetime,
            type: type,
            creationTime: Date.now(),  // Add timestamp for trail ordering
            isTrail: config.isTrail || false
        });
    }
}

// Update particles
function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        // Update position
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        
        // Apply gravity for blood particles
        if (p.type === 'blood') {
            p.vy += 500 * deltaTime; // Gravity
        }
        
        // Update lifetime
        p.lifetime -= deltaTime;
        
        // Remove dead particles
        if (p.lifetime <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Draw particles
function drawParticles() {
    // First draw non-trail particles
    particles.forEach(p => {
        if (!p.type || p.type !== 'dashTrail') {
        const screenPos = worldToScreen(p.x, p.y);
        ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Then draw dash trail as a continuous path
    const trailParticles = particles.filter(p => p.type === 'dashTrail')
        .sort((a, b) => b.creationTime - a.creationTime);

    if (trailParticles.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Start from the newest particle
        const firstPos = worldToScreen(trailParticles[0].x, trailParticles[0].y);
        ctx.moveTo(firstPos.x, firstPos.y);

        // Draw lines to each subsequent particle
        for (let i = 1; i < trailParticles.length; i++) {
            const pos = worldToScreen(trailParticles[i].x, trailParticles[i].y);
            ctx.lineTo(pos.x, pos.y);
        }

        // Create gradient for fade effect
        const gradient = ctx.createLinearGradient(
            firstPos.x, firstPos.y,
            worldToScreen(trailParticles[trailParticles.length - 1].x, 
                        trailParticles[trailParticles.length - 1].y).x,
            worldToScreen(trailParticles[trailParticles.length - 1].x, 
                        trailParticles[trailParticles.length - 1].y).y
        );
        gradient.addColorStop(0, 'rgba(0, 102, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 102, 255, 0)');
        ctx.strokeStyle = gradient;
        ctx.stroke();
    }
}

// Draw a star shape
function drawStar(cx, cy, outerRadius, innerRadius, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / points;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
} 

function gainExperience(amount) {
    player.experience += amount;
    while (player.experience >= player.experienceToNextLevel) {
        player.experience -= player.experienceToNextLevel;
        player.level++;
        player.skillPoints += 2;
        player.experienceToNextLevel = levelThresholds[player.level - 1];
        audio.playSound('levelUp');  // Add level up sound
        createFloatingText(player.x, player.y - 30, 'LEVEL UP!', '#ffff00', 24);
    }
}

function upgradeSkill(skill) {
    const cost = skillUpgradeCosts[skill];
    if (player.skillPoints >= cost) {
        player.skillPoints -= cost;
        switch (skill) {
            case 'maxHealth':
                player.stats.maxHealthBonus += 20;
                player.maxHealth = 100 + player.stats.maxHealthBonus;
                player.health = Math.min(player.health + 20, player.maxHealth);
                break;
            case 'speed':
                player.stats.speedBonus += 20;
                break;
            case 'damage':
                player.stats.damageBonus += 5;
                break;
            case 'criticalChance':
                player.stats.criticalChance += 0.05;
                break;
        }
    }
}

function createFloatingText(x, y, text, color, size) {
    particles.push({
        type: 'text',
        x: x,
        y: y,
        text: text,
        color: color,
        size: size,
        life: 1,
        velocity: { x: 0, y: -50 }
    });
}

function handleAbilities(deltaTime) {
    // Update ability cooldowns
    Object.values(player.abilities).forEach(ability => {
        if (ability.currentCooldown > 0) {
            ability.currentCooldown = Math.max(0, ability.currentCooldown - deltaTime);
        }
    });

    // Handle dash ability with chain mechanics
    if (keys[' '] && !player.abilities.dash.isActive && player.abilities.dash.charges > 0) {
        // Initialize dash
        player.abilities.dash.isActive = true;
        player.abilities.dash.charges--;
        player.abilities.dash.currentCooldown = player.abilities.dash.cooldown;
        player.abilities.dash.chainCount = 0;
        
        // Calculate initial dash direction
        const moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        const moveY = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
        
        if (moveX !== 0 || moveY !== 0) {
            const length = Math.sqrt(moveX * moveX + moveY * moveY);
            player.abilities.dash.direction = {
                x: moveX / length,
                y: moveY / length
            };
        } else {
            // If no movement keys pressed, dash toward mouse
            const dx = mouse.x - player.x;
            const dy = mouse.y - player.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            player.abilities.dash.direction = {
                x: dx / length,
                y: dy / length
            };
        }
        
        // Start chain dash sequence
        performChainDash(player.x, player.y);
    }

    // Refresh dash charges faster
    if (player.abilities.dash.charges < player.abilities.dash.maxCharges) {
        player.abilities.dash.chargeTimer += deltaTime;
        if (player.abilities.dash.chargeTimer >= player.abilities.dash.chargeRefreshTime) {
            player.abilities.dash.charges++;
            player.abilities.dash.chargeTimer = 0;
        }
    }

    // Handle shield ability (Q key)
    if (keys['q'] && !player.abilities.shield.isActive && player.abilities.shield.currentCooldown <= 0) {
        player.abilities.shield.isActive = true;
        player.abilities.shield.currentCooldown = player.abilities.shield.cooldown;
        setTimeout(() => {
            player.abilities.shield.isActive = false;
        }, player.abilities.shield.duration * 1000);
    }

    // Handle time slow ability (E key)
    if (keys['e'] && !player.abilities.timeSlow.isActive && player.abilities.timeSlow.currentCooldown <= 0) {
        player.abilities.timeSlow.isActive = true;
        player.abilities.timeSlow.currentCooldown = player.abilities.timeSlow.cooldown;
        setTimeout(() => {
            player.abilities.timeSlow.isActive = false;
        }, player.abilities.timeSlow.duration * 1000);
    }
}

// Add function to perform chain dash
function performChainDash(startX, startY) {
    if (player.abilities.dash.chainCount >= player.abilities.dash.maxChains) {
        player.abilities.dash.isActive = false;
        return;
    }
    
    const nextTarget = findNextChainTarget(startX, startY, player.abilities.dash.direction);
    
    if (nextTarget) {
        const dx = nextTarget.x - startX;
        const dy = nextTarget.y - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        player.abilities.dash.direction = {
            x: (player.abilities.dash.direction.x * 0.7 + (dx / distance) * 0.3),
            y: (player.abilities.dash.direction.y * 0.7 + (dy / distance) * 0.3)
        };
        
        const dirLength = Math.sqrt(
            player.abilities.dash.direction.x * player.abilities.dash.direction.x +
            player.abilities.dash.direction.y * player.abilities.dash.direction.y
        );
        player.abilities.dash.direction.x /= dirLength;
        player.abilities.dash.direction.y /= dirLength;
        
        addScreenShake(4);
        
        const dashDuration = 0.1;
        const startTime = Date.now();
        const initialX = startX;
        const initialY = startY;
        
        function animateDash() {
            const currentTime = Date.now();
            const progress = Math.min(1, (currentTime - startTime) / (dashDuration * 1000));
            
            player.x = initialX + dx * progress;
            player.y = initialY + dy * progress;
            
            // Create trail particles more frequently
            if (progress % 0.05 < 0.01) {
                createParticles(player.x, player.y, 'dashTrail', Math.atan2(dy, dx));
            }
            
            enemies.forEach(enemy => {
                const damageX = player.x - enemy.x;
                const damageY = player.y - enemy.y;
                const damageDistance = Math.sqrt(damageX * damageX + damageY * damageY);
                
                if (damageDistance <= player.abilities.dash.radius) {
                    const damageMultiplier = 1 - (damageDistance / player.abilities.dash.radius);
                    const damage = player.abilities.dash.damage * damageMultiplier;
                    enemy.health -= damage;
                    
                    if (enemy.health <= 0) {
                        const index = enemies.indexOf(enemy);
                        if (index > -1) {
                            enemies.splice(index, 1);
                            handleEnemyKill(enemy);
                            addScreenShake(3);
                        }
                    }
                }
            });
            
            if (progress < 1) {
                requestAnimationFrame(animateDash);
            } else {
                player.abilities.dash.chainCount++;
                setTimeout(() => {
                    performChainDash(player.x, player.y);
                }, player.abilities.dash.chainDelay * 1000);
            }
        }
        
        animateDash();
    } else {
        player.abilities.dash.isActive = false;
        createParticles(player.x, player.y, 'dashTrail', Math.atan2(
            player.abilities.dash.direction.y,
            player.abilities.dash.direction.x
        ));
    }
}

// Add function to find next chain target
function findNextChainTarget(currentX, currentY, direction) {
    let bestTarget = null;
    let bestScore = -Infinity;
    
    // Calculate the forward cone for chain targeting
    const dashAngle = Math.atan2(direction.y, direction.x);
    
    enemies.forEach(enemy => {
        const dx = enemy.x - currentX;
        const dy = enemy.y - currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if enemy is within chain range
        if (distance <= player.abilities.dash.chainRange && distance > 10) { // Avoid current target
            // Calculate angle between dash direction and enemy
            const enemyAngle = Math.atan2(dy, dx);
            let angleDiff = Math.abs(enemyAngle - dashAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            
            // Score based on distance and angle (prefer enemies in dash direction)
            const angleScore = (Math.PI - angleDiff) / Math.PI; // 1 when aligned, 0 when opposite
            const distanceScore = 1 - (distance / player.abilities.dash.chainRange);
            const score = angleScore * 2 + distanceScore; // Prioritize direction over distance
            
            // Update best target if this enemy has a better score
            if (score > bestScore && angleDiff < Math.PI / 2) { // Only target enemies within 90-degree cone
                bestScore = score;
                bestTarget = enemy;
            }
        }
    });
    
    return bestTarget;
}

// Environmental hazards
const hazards = [];

function createHazard(type, x, y) {
    const hazardTypes = {
        spikes: {
            width: 40,
            height: 40,
            damage: 30,
            color: '#8B4513',
            duration: -1 // permanent
        },
        acid: {
            width: 60,
            height: 60,
            damage: 20,
            color: '#32CD32',
            duration: 10,
            dotDamage: 5
        },
        fire: {
            width: 50,
            height: 50,
            damage: 15,
            color: '#FF4500',
            duration: 8,
            dotDamage: 8
        }
    };

    hazards.push({
        type,
        x,
        y,
        ...hazardTypes[type],
        timeLeft: hazardTypes[type].duration
    });
}

function updateHazards(deltaTime) {
    for (let i = hazards.length - 1; i >= 0; i--) {
        const hazard = hazards[i];
        
        // Update duration
        if (hazard.duration > 0) {
            hazard.timeLeft -= deltaTime;
            if (hazard.timeLeft <= 0) {
                hazards.splice(i, 1);
                continue;
            }
        }

        // Check player collision - only if not dashing
        if (checkCollision(player, hazard) && !player.abilities.dash.isActive) {
            if (player.abilities.shield.isActive) {
                // Reduced damage when shield is active
                player.health -= hazard.damage * 0.2 * deltaTime;
            } else {
                player.health -= hazard.damage * deltaTime;
            }

            // Apply DOT effects only if not dashing
            if (hazard.dotDamage) {
                createDotEffect(player, hazard.dotDamage, 3);
            }
        }
    }
}

function drawHazards() {
    hazards.forEach(hazard => {
        const screenPos = worldToScreen(hazard.x, hazard.y);
        
        ctx.fillStyle = hazard.color;
        ctx.globalAlpha = hazard.timeLeft > 0 ? 
            Math.min(1, hazard.timeLeft / hazard.duration) : 1;
        
        if (hazard.type === 'spikes') {
            // Draw spikes
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(screenPos.x + i * 10, screenPos.y + hazard.height);
                ctx.lineTo(screenPos.x + i * 10 + 5, screenPos.y);
                ctx.lineTo(screenPos.x + i * 10 + 10, screenPos.y + hazard.height);
                ctx.fill();
            }
        } else {
            // Draw other hazards
            ctx.fillRect(screenPos.x, screenPos.y, hazard.width, hazard.height);
        }
        
        ctx.globalAlpha = 1;
    });
}

function getProjectileColor(type) {
    switch (type) {
        case 'laser': return '#00ffff';
        case 'flame': return '#ff4500';
        case 'explosive': return '#ffd700';
        default: return '#ffffff';
    }
}

function createDotEffect(target, damage, duration) {
    if (!target.dotEffects) target.dotEffects = [];
    target.dotEffects.push({
        damage,
        duration,
        timeLeft: duration
    });
}

function updateDotEffects(entity, deltaTime) {
    if (!entity.dotEffects) return;

    for (let i = entity.dotEffects.length - 1; i >= 0; i--) {
        const effect = entity.dotEffects[i];
        effect.timeLeft -= deltaTime;
        
        if (effect.timeLeft <= 0) {
            entity.dotEffects.splice(i, 1);
        } else {
            entity.health -= effect.damage * deltaTime;
        }
    }
}

// Draw grid function
function drawGrid() {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    const gridSize = 100;

    // Calculate visible grid lines
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;
    const endX = camera.x + canvas.width;
    const endY = camera.y + canvas.height;

    // Draw vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
        const screenX = x - camera.x;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, canvas.height);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
        const screenY = y - camera.y;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(canvas.width, screenY);
        ctx.stroke();
    }
}

// Update enemies function
function updateEnemies(deltaTime) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Move towards player
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            enemy.x += (dx / dist) * enemy.speed * deltaTime;
            enemy.y += (dy / dist) * enemy.speed * deltaTime;
        }

        // Update shooter behavior
        if (enemy.type === 'shooter' && enemy.shootCooldown <= 0) {
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            enemyProjectiles.push({
                x: enemy.x,
                y: enemy.y,
                width: 12,          // Increased from 5 to 12
                height: 12,         // Increased from 5 to 12
                speed: enemyTypes.shooter.projectileSpeed,
                angle: angle,
                damage: enemy.damage,
                color: '#00ff00',   // Bright green color
                glowing: true       // Add glowing effect
            });
            // Create muzzle flash for enemy shots
            createParticles(enemy.x, enemy.y, 'sparkle', angle);
            enemy.shootCooldown = enemyTypes.shooter.fireRate;
        } else if (enemy.shootCooldown > 0) {
            enemy.shootCooldown -= deltaTime;
        }

        // Check collision with player - only deal damage if not dashing
        if (checkCollision(enemy, player)) {
            if (player.abilities.dash.isActive) {
                // Deal dash damage to enemy without taking damage
                enemy.health -= player.abilities.dash.damage;
                createParticles(enemy.x, enemy.y, 'explosion');
                if (enemy.health <= 0) {
                    enemies.splice(i, 1);
                    handleEnemyKill(enemy);
                    continue;
                }
            } else {
                // Normal collision damage to player (only when not dashing)
                if (player.abilities.shield.isActive) {
                    player.health -= enemy.damage * 0.2 * deltaTime;
                } else {
                    player.health -= enemy.damage * deltaTime;
                }
                
                if (player.health <= 0) {
                    gameOver();
                }
            }
        }
    }
}

// Draw enemies function
function drawEnemies() {
    enemies.forEach(enemy => {
        const screenPos = worldToScreen(enemy.x, enemy.y);
        
        // Calculate size based on current health
        const healthPercent = enemy.health / enemy.maxHealth;
        const currentWidth = enemy.initialWidth * healthPercent;
        const currentHeight = enemy.initialHeight * healthPercent;
        
        // Update enemy's current size
        enemy.width = currentWidth;
        enemy.height = currentHeight;
        
        // Draw enemy with current size
        ctx.fillStyle = enemy.color;
        ctx.fillRect(
            screenPos.x + (enemy.initialWidth - currentWidth) / 2, // Center the shrinking enemy
            screenPos.y + (enemy.initialHeight - currentHeight) / 2,
            currentWidth,
            currentHeight
        );
    });
}

// Draw projectiles function
function drawProjectiles() {
    ctx.save();
    
    // Draw player projectiles
    projectiles.forEach(projectile => {
        ctx.beginPath();
        ctx.arc(
            projectile.x - camera.x,
            projectile.y - camera.y,
            projectile.radius || 3,
            0,
            Math.PI * 2
        );
        
        if (projectile.isEnemyProjectile) {
            ctx.fillStyle = '#00ff00';
        } else {
            ctx.fillStyle = '#ffffff';
        }
        
        ctx.fill();
        ctx.closePath();
    });

    // Draw enemy projectiles with glow effect
    enemyProjectiles.forEach(projectile => {
        const screenX = projectile.x - camera.x;
        const screenY = projectile.y - camera.y;

        // Draw glow effect
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, projectile.width
        );
        gradient.addColorStop(0, '#00ff00');     // Bright green center
        gradient.addColorStop(0.6, '#00ff00');   // Bright green middle
        gradient.addColorStop(1, 'transparent'); // Fade to transparent

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(screenX, screenY, projectile.width * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw core of projectile
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';  // White core
        ctx.arc(screenX, screenY, projectile.width / 3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();
}

// Update projectiles function
function updateProjectiles(deltaTime) {
    // Update player projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        
        // Move projectile
        p.x += Math.cos(p.angle) * p.speed * deltaTime;
        p.y += Math.sin(p.angle) * p.speed * deltaTime;
        
        // Check if out of bounds
        if (p.x < 0 || p.x > MAP_WIDTH || p.y < 0 || p.y > MAP_HEIGHT) {
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (checkCollision(p, enemy)) {
                // Apply damage
                enemy.health -= p.damage;
                
                // Create hit effect
                createParticles(p.x, p.y, 'blood', p.angle);
                
                // Check for critical hit
                if (Math.random() < player.stats.criticalChance) {
                    enemy.health -= p.damage; // Double damage
                    createFloatingText(enemy.x, enemy.y - 20, 'CRIT!', '#ff0000', 20);
                }
                
                // Check if enemy dies
                if (enemy.health <= 0) {
                    createParticles(enemy.x, enemy.y, 'explosion');
                    score += enemy.points;
                    gainExperience(enemy.points);
                    
                    if (enemy.type === 'tank') {
                        achievements.tankKiller.progress++;
                    }
                    if (player.abilities.dash.isActive) {
                        achievements.speedster.progress++;
                    }
                    
                    enemies.splice(j, 1);
                }
                
                // Remove projectile if not penetrating
                if (!p.penetrating) {
                    projectiles.splice(i, 1);
                    break;
                }
            }
        }
    }
    
    // Update enemy projectiles with dash invulnerability
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const p = enemyProjectiles[i];
        
        p.x += Math.cos(p.angle) * p.speed * deltaTime;
        p.y += Math.sin(p.angle) * p.speed * deltaTime;
        
        if (p.x < 0 || p.x > MAP_WIDTH || p.y < 0 || p.y > MAP_HEIGHT) {
            enemyProjectiles.splice(i, 1);
            continue;
        }
        
        // Only check collision if player is not dashing
        if (checkCollision(p, player) && !player.abilities.dash.isActive) {
            if (player.abilities.shield.isActive) {
                player.health -= p.damage * 0.2;
            } else {
                player.health -= p.damage;
            }
            
            createParticles(p.x, p.y, 'sparkle');
            enemyProjectiles.splice(i, 1);
            
            if (player.health <= 0) {
                gameOver();
            }
        }
    }
}

// Collision detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Initialize game
function init() {
    // Initialize audio system
    audio.init();
    
    // Reset game state
    resetGame();
    
    // Start background music
    audio.playSound('backgroundMusic');
    
    // Start game loop
    lastTime = 0;
    requestAnimationFrame(gameLoop);
}

// Start the game when the window loads
window.addEventListener('load', init);

function updatePlayer(deltaTime) {
    if (!gameRunning) return;

    let wasHit = false;
    const previousHealth = player.health;
    
    // Calculate effective speed based on abilities and upgrades
    let effectiveSpeed = player.speed + player.stats.speedBonus;
    if (player.abilities.dash.isActive) {
        effectiveSpeed = player.abilities.dash.speed;
    }

    // Movement
    let moveX = 0;
    let moveY = 0;

    if (keys.w) moveY -= 1;
    if (keys.s) moveY += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= length;
        moveY /= length;
    }

    // Apply movement
    player.x += moveX * effectiveSpeed * deltaTime;
    player.y += moveY * effectiveSpeed * deltaTime;

    // Keep player in bounds
    player.x = Math.max(player.width / 2, Math.min(MAP_WIDTH - player.width / 2, player.x));
    player.y = Math.max(player.height / 2, Math.min(MAP_HEIGHT - player.height / 2, player.y));

    // Update shooting cooldown
    if (player.shootCooldown > 0) {
        player.shootCooldown -= deltaTime;
    }

    // Handle auto-shooting - SIMPLIFIED AND FIXED
    if (player.autoShoot && player.shootCooldown <= 0 && !player.isReloading && player.ammo > 0) {
        const nearestEnemy = findNearestEnemy();
        if (nearestEnemy) {
            // Update player angle to face the enemy
            const dx = nearestEnemy.x - player.x;
            const dy = nearestEnemy.y - player.y;
            player.angle = Math.atan2(dy, dx);
            shoot();
        }
    }
    
    // Handle manual shooting
    if (mouse.clicked && player.shootCooldown <= 0 && !player.isReloading && player.ammo > 0) {
        shoot();
    }

    // Handle reloading
    if (player.isReloading) {
        player.reloadProgress += deltaTime;
        if (player.reloadProgress >= player.reloadTime) {
            player.ammo = weapons[player.weapon].ammoCapacity;
            player.isReloading = false;
            player.reloadProgress = 0;
        }
    }

    // Auto-reload when out of ammo
    if (player.ammo <= 0 && !player.isReloading) {
        startReload();
    }

    // Spawn enemies if wave is not complete (increased spawn rate significantly)
    if (!waveCompleted && enemies.length < enemiesInWave) {
        if (Math.random() < 0.95) { // Increased from 0.8 to 0.95 for even more zombies
            spawnEnemy();
        }
    }

    updatePlayerDirection();

    // Update player trail
    playerTrail.push({ x: player.x, y: player.y });
    if (playerTrail.length > visualEffects.dash.trailLength) {
        playerTrail.shift();
    }

    // Check if player was hit (after all damage calculations)
    if (player.health < previousHealth) {
        audio.playSound('playerHit');
    }
}

// Create muzzle flash effect
function createMuzzleFlash(x, y, angle) {
    createParticles(
        x + Math.cos(angle) * 20,
        y + Math.sin(angle) * 20,
        'sparkle',
        angle
    );
}

// Track player trail for dash effect
let playerTrail = [];
let screenShake = 0;

// Add screen shake function
function addScreenShake(amount) {
    screenShake = Math.min(screenShake + amount, 15);  // Reduced from 30
}

// Update the scoring system in handleEnemyKill
function handleEnemyKill(enemy) {
    const currentTime = Date.now() / 1000;
    
    audio.playSound('enemyDeath');  // Add enemy death sound
    
    // Create minimal death effect
    createParticles(enemy.x, enemy.y, 'explosion');
    
    // Update kill streak
    if (currentTime - lastKillTime < MULTIKILL_TIME) {
        killStreak++;
        multiKillCount++;
        multiKillTimer = MULTIKILL_TIME;
        
        const streakBonus = Math.floor(enemy.points * (killStreak * 0.5));
        const multiKillBonus = Math.floor(enemy.points * (multiKillCount * 0.3));
        const totalPoints = enemy.points + streakBonus + multiKillBonus;
        
        // Show minimal kill messages
        if (multiKillCount >= 3) {
            createFloatingText(enemy.x, enemy.y - 40, 
                multiKillCount >= 5 ? 'MONSTER KILL!' : 
                multiKillCount === 4 ? 'QUAD KILL!' : 
                'TRIPLE KILL!', 
                '#ffffff', 24);
        }
        
        score += totalPoints;
    } else {
        killStreak = 1;
        multiKillCount = 1;
        score += enemy.points;
    }
    
    lastKillTime = currentTime;
    
    if (score > highScore) {
        highScore = score;
    }
}

// Add new special abilities
const specialAbilities = {
    blackHole: {
        cooldown: 20,
        duration: 5,
        isActive: false,
        currentCooldown: 0,
        effect: () => {
            const blackHole = {
                x: mouse.x,
                y: mouse.y,
                radius: 100,
                force: 500,
                damage: 50
            };
            
            // Pull enemies toward black hole
            enemies.forEach(enemy => {
                const dx = blackHole.x - enemy.x;
                const dy = blackHole.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < blackHole.radius) {
                    enemy.x += (dx / dist) * blackHole.force * deltaTime;
                    enemy.y += (dy / dist) * blackHole.force * deltaTime;
                    enemy.health -= blackHole.damage * deltaTime;
                    
                    if (enemy.health <= 0) {
                        createParticles(enemy.x, enemy.y, 'explosion');
                        score += enemy.points;
                    }
                }
            });
        }
    }
};

// Add experience orbs that drop from enemies
function createExperienceOrb(x, y, value) {
    powerUps.push({
        x,
        y,
        width: 15,
        height: 15,
        type: 'experience',
        value,
        collectible: true,
        color: '#00ffff'
    });
}

// Modify enemy death to drop experience orbs
function handleEnemyDeath(enemy) {
    createExperienceOrb(enemy.x, enemy.y, enemy.points);
    createParticles(enemy.x, enemy.y, 'explosion');
    handleEnemyKill(enemy);
}

// Add environmental hazards
function createLightning() {
    const x = Math.random() * MAP_WIDTH;
    const y = Math.random() * MAP_HEIGHT;
    
    createParticles(x, y, 'lightning');
    addScreenShake(5);
    
    // Damage entities in radius
    const radius = 100;
    enemies.forEach(enemy => {
        const dx = x - enemy.x;
        const dy = y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < radius) {
            enemy.health -= 50;
            if (enemy.health <= 0) {
                handleEnemyDeath(enemy);
            }
        }
    });
}

// Periodically create environmental hazards
setInterval(() => {
    if (gameRunning && Math.random() < 0.3) {
        createLightning();
    }
}, 10000);

// Audio system
const audio = {
    sounds: {
        shoot: new Audio('sounds/shoot.mp3'),
        enemyDeath: new Audio('sounds/enemy_death.mp3'),
        dash: new Audio('sounds/dash.mp3'),
        playerHit: new Audio('sounds/player_hit.mp3'),
        powerUp: new Audio('sounds/power_up.mp3'),
        reload: new Audio('sounds/reload.mp3'),
        levelUp: new Audio('sounds/level_up.mp3'),
        gameOver: new Audio('sounds/game_over.mp3'),
        backgroundMusic: new Audio('sounds/background_music.mp3')
    },
    setVolume: function(volume) {
        Object.values(this.sounds).forEach(sound => {
            sound.volume = volume;
        });
    },
    playSound: function(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            // For short sound effects, reset and play
            sound.currentTime = 0;
            sound.play().catch(e => console.log("Audio play failed:", e));
        }
    },
    stopSound: function(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    },
    init: function() {
        // Set up background music to loop
        this.sounds.backgroundMusic.loop = true;
        // Set default volumes
        this.sounds.backgroundMusic.volume = 0.3;
        this.sounds.shoot.volume = 0.4;
        this.sounds.enemyDeath.volume = 0.4;
        this.sounds.dash.volume = 0.5;
        this.sounds.playerHit.volume = 0.5;
        this.sounds.powerUp.volume = 0.6;
        this.sounds.reload.volume = 0.5;
        this.sounds.levelUp.volume = 0.6;
        this.sounds.gameOver.volume = 0.6;
    }
}; 