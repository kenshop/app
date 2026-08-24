// Glass Bridge Game Engine - HTML5 Canvas 2.5D Renderer

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.state = 'HOME'; // 'HOME', 'PLAYING', 'JUMPING', 'RESPAWNING', 'GAMEOVER'
        this.lives = 10;
        this.maxLives = 10;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('glass_bridge_best_score') || '0', 10);
        this.isNewRecord = false;

        // Bridge & World Layout
        this.currentStep = 0; // 0 means starting platform
        this.rows = []; // Store tile safety data for each row
        this.tileWidth = 85;
        this.tileHeight = 65;
        this.tileGapX = 18;
        this.tileGapY = 55;
        
        // Perspective settings
        this.cameraY = 0;
        this.targetCameraY = 0;
        
        // Player State
        this.player = {
            row: 0,
            col: 1, // 0: Left, 1: Center, 2: Right
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            jumpProgress: 1, // 0 to 1
            isFalling: false,
            fallY: 0,
            alpha: 1,
            scale: 1
        };

        // Effects
        this.particles = [];
        this.bgParticles = [];
        this.initBgParticles();

        // Bind events & resize
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
        this.handleResize();

        // Input listeners
        this.setupInput();

        // Start animation loop
        this.lastTime = performance.now();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    handleResize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        
        this.ctx.scale(this.dpr, this.dpr);
        this.viewWidth = rect.width;
        this.viewHeight = rect.height;

        // Adjust dimensions based on screen width
        if (this.viewWidth < 400) {
            this.tileWidth = 70;
            this.tileHeight = 52;
            this.tileGapX = 12;
            this.tileGapY = 48;
        } else {
            this.tileWidth = 88;
            this.tileHeight = 65;
            this.tileGapX = 18;
            this.tileGapY = 55;
        }

        this.recalculatePositions();
    }

    initBgParticles() {
        this.bgParticles = [];
        for (let i = 0; i < 40; i++) {
            this.bgParticles.push({
                x: Math.random() * 800,
                y: Math.random() * 1000,
                radius: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.5 + 0.2,
                speedY: -(Math.random() * 0.4 + 0.1),
                speedX: (Math.random() - 0.5) * 0.2
            });
        }
    }

    generateRow(rowIndex) {
        // Each row has 3 tiles: 2 SAFE (true), 1 BREAKABLE (false)
        const tiles = [true, true, false];
        // Shuffle tiles randomly
        for (let i = tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }

        return {
            index: rowIndex,
            tiles: tiles.map((isSafe) => ({
                isSafe: isSafe,
                isBroken: false,
                touched: false
            }))
        };
    }

    ensureRows(upToRow) {
        while (this.rows.length <= upToRow + 10) {
            this.rows.push(this.generateRow(this.rows.length + 1));
        }
    }

    startNewGame() {
        this.lives = 10;
        this.score = 0;
        this.isNewRecord = false;
        this.currentStep = 0;
        this.rows = [];
        this.particles = [];
        
        this.ensureRows(15);
        
        this.player.row = 0;
        this.player.col = 1;
        this.player.jumpProgress = 1;
        this.player.isFalling = false;
        this.player.fallY = 0;
        this.player.alpha = 1;
        
        const startPos = this.getTilePosition(0, 1);
        this.player.x = startPos.x;
        this.player.y = startPos.y;
        this.player.targetX = startPos.x;
        this.player.targetY = startPos.y;
        
        this.cameraY = 0;
        this.targetCameraY = 0;
        
        this.state = 'PLAYING';
        this.onStateChange && this.onStateChange(this.state);
        this.updateHUD();
    }

    getTilePosition(row, col) {
        const centerX = this.viewWidth / 2;
        const totalWidth = 3 * this.tileWidth + 2 * this.tileGapX;
        const startX = centerX - totalWidth / 2 + this.tileWidth / 2;
        
        const x = startX + col * (this.tileWidth + this.tileGapX);
        const startY = this.viewHeight - 140;
        const y = startY - row * (this.tileHeight + this.tileGapY);
        
        return { x, y };
    }

    recalculatePositions() {
        if (!this.player) return;
        const pos = this.getTilePosition(this.player.row, this.player.col);
        if (this.player.jumpProgress >= 1) {
            this.player.x = pos.x;
            this.player.y = pos.y;
        }
        this.targetCameraY = Math.max(0, (this.player.row - 1) * (this.tileHeight + this.tileGapY));
    }

    setupInput() {
        const handleTap = (clientX, clientY) => {
            if (this.state !== 'PLAYING' || this.player.jumpProgress < 1) return;

            const rect = this.canvas.getBoundingClientRect();
            const tapX = clientX - rect.left;
            const tapY = clientY - rect.top;

            const targetRow = this.player.row + 1;
            
            // Check which tile (0, 1, 2) was tapped
            for (let col = 0; col < 3; col++) {
                const tilePos = this.getTilePosition(targetRow, col);
                const screenY = tilePos.y + this.cameraY;
                
                // Expand tap area for comfortable touch target
                const hitMarginX = this.tileWidth * 0.6;
                const hitMarginY = this.tileHeight * 0.7;

                if (Math.abs(tapX - tilePos.x) < hitMarginX && Math.abs(tapY - screenY) < hitMarginY) {
                    this.makeStep(col);
                    break;
                }
            }
        };

        this.canvas.addEventListener('click', (e) => {
            handleTap(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                handleTap(touch.clientX, touch.clientY);
            }
        }, { passive: true });
    }

    makeStep(colIndex) {
        if (this.state !== 'PLAYING' || this.player.jumpProgress < 1) return;

        const targetRowIndex = this.player.row + 1;
        this.ensureRows(targetRowIndex);

        this.player.prevX = this.player.x;
        this.player.prevY = this.player.y;

        const targetPos = this.getTilePosition(targetRowIndex, colIndex);
        this.player.targetX = targetPos.x;
        this.player.targetY = targetPos.y;
        
        this.player.row = targetRowIndex;
        this.player.col = colIndex;
        this.player.jumpProgress = 0;
        this.state = 'JUMPING';

        window.soundManager && window.soundManager.playJump();
    }

    onJumpComplete() {
        const rowObj = this.rows[this.player.row - 1]; // index offset
        const tile = rowObj.tiles[this.player.col];
        tile.touched = true;

        if (tile.isSafe) {
            // SAFE TILE!
            if ('vibrate' in navigator) navigator.vibrate(30);
            window.soundManager && window.soundManager.playGlassLanding();
            this.score = this.player.row;
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                this.isNewRecord = true;
                localStorage.setItem('glass_bridge_best_score', this.bestScore.toString());
            }

            this.targetCameraY = (this.player.row - 1) * (this.tileHeight + this.tileGapY);
            this.state = 'PLAYING';
            this.createSafeSparkles(this.player.x, this.player.y);
            this.updateHUD();
        } else {
            // FRAIL GLASS BREAKS!
            tile.isBroken = true;
            if ('vibrate' in navigator) navigator.vibrate([100, 50, 150]);
            window.soundManager && window.soundManager.playGlassShatter();
            this.createGlassShards(this.player.x, this.player.y);
            
            this.player.isFalling = true;
            this.player.fallY = 0;
            this.lives--;
            window.soundManager && window.soundManager.playLifeLost();
            this.updateHUD();

            setTimeout(() => {
                if (this.lives > 0) {
                    this.respawnPlayer();
                } else {
                    this.triggerGameOver();
                }
            }, 900);
        }
    }

    respawnPlayer() {
        // Reset player to platform (row 0), refresh bridge path
        this.player.row = 0;
        this.player.col = 1;
        this.rows = [];
        this.ensureRows(15);

        const startPos = this.getTilePosition(0, 1);
        this.player.x = startPos.x;
        this.player.y = startPos.y;
        this.player.targetX = startPos.x;
        this.player.targetY = startPos.y;
        this.player.jumpProgress = 1;
        this.player.isFalling = false;
        this.player.fallY = 0;
        this.player.alpha = 1;

        this.targetCameraY = 0;
        this.state = 'PLAYING';
    }

    triggerGameOver() {
        this.state = 'GAMEOVER';
        window.soundManager && window.soundManager.playGameOver();
        if (this.isNewRecord) {
            setTimeout(() => {
                window.soundManager && window.soundManager.playNewRecord();
            }, 400);
        }
        this.onGameOver && this.onGameOver(this.score, this.bestScore, this.isNewRecord);
    }

    createGlassShards(x, y) {
        for (let i = 0; i < 28; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 7 + 2;
            this.particles.push({
                x: x + (Math.random() - 0.5) * this.tileWidth,
                y: y + (Math.random() - 0.5) * this.tileHeight,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: Math.random() * 9 + 4,
                rotation: Math.random() * Math.PI,
                rotSpeed: (Math.random() - 0.5) * 0.3,
                color: `rgba(180, 240, 255, ${Math.random() * 0.5 + 0.5})`,
                life: 1,
                decay: Math.random() * 0.02 + 0.015,
                isGlass: true
            });
        }
    }

    createSafeSparkles(x, y) {
        for (let i = 0; i < 14; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            this.particles.push({
                x: x,
                y: y + 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                size: Math.random() * 4 + 2,
                color: `rgba(0, 243, 255, ${Math.random() * 0.7 + 0.3})`,
                life: 1,
                decay: Math.random() * 0.05 + 0.03,
                isGlass: false
            });
        }
    }

    updateHUD() {
        this.onHUDUpdate && this.onHUDUpdate({
            lives: this.lives,
            score: this.score,
            bestScore: this.bestScore
        });
    }

    update(dt) {
        // Camera smooth interpolation
        this.cameraY += (this.targetCameraY - this.cameraY) * 0.1;

        // Player Jump Animation
        if (this.state === 'JUMPING') {
            this.player.jumpProgress += dt * 4.2; // Jump speed
            if (this.player.jumpProgress >= 1) {
                this.player.jumpProgress = 1;
                this.player.x = this.player.targetX;
                this.player.y = this.player.targetY;
                this.onJumpComplete();
            } else {
                const p = this.player.jumpProgress;
                this.player.x = this.player.prevX + (this.player.targetX - this.player.prevX) * p;
                this.player.y = this.player.prevY + (this.player.targetY - this.player.prevY) * p;
            }
        }

        // Falling physics
        if (this.player.isFalling) {
            this.player.fallY += dt * 700;
            this.player.alpha = Math.max(0, this.player.alpha - dt * 1.5);
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.isGlass) {
                p.vy += 0.35; // gravity for glass
                p.rotation += p.rotSpeed;
            }
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update floating background particles
        for (let bgP of this.bgParticles) {
            bgP.y += bgP.speedY;
            bgP.x += bgP.speedX;
            if (bgP.y < 0) {
                bgP.y = this.viewHeight;
                bgP.x = Math.random() * this.viewWidth;
            }
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

        // Draw Deep Space / Neon Cyber Grid Background
        this.drawBackground();

        this.ctx.save();
        this.ctx.translate(0, this.cameraY);

        // Draw Start Platform
        this.drawStartPlatform();

        // Draw Bridge Rows
        const startRow = Math.max(1, Math.floor(this.cameraY / (this.tileHeight + this.tileGapY)) - 1);
        const endRow = startRow + 14;

        for (let r = startRow; r <= endRow; r++) {
            this.drawBridgeRow(r);
        }

        // Draw Player (if not falling or still visible)
        if (this.player.alpha > 0) {
            this.drawPlayer();
        }

        // Draw Particles
        this.drawParticles();

        this.ctx.restore();
    }

    drawBackground() {
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.viewHeight);
        grad.addColorStop(0, '#0a091a');
        grad.addColorStop(0.5, '#120f30');
        grad.addColorStop(1, '#050311');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

        // Draw subtle floating glow lights
        for (let p of this.bgParticles) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(138, 180, 248, ${p.alpha})`;
            this.ctx.fill();
        }
    }

    drawStartPlatform() {
        const center = this.getTilePosition(0, 1);
        const width = 3 * this.tileWidth + 2 * this.tileGapX + 40;
        const height = 50;

        this.ctx.save();
        
        // Base metallic glow shadow
        this.ctx.shadowColor = 'rgba(0, 243, 255, 0.3)';
        this.ctx.shadowBlur = 20;

        const grad = this.ctx.createLinearGradient(center.x - width/2, center.y, center.x + width/2, center.y + height);
        grad.addColorStop(0, 'rgba(40, 45, 80, 0.85)');
        grad.addColorStop(0.5, 'rgba(60, 70, 120, 0.9)');
        grad.addColorStop(1, 'rgba(30, 35, 65, 0.85)');

        this.ctx.fillStyle = grad;
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)';
        this.ctx.lineWidth = 2;

        this.roundRect(center.x - width / 2, center.y - 15, width, height, 12, true, true);

        // Platform label
        this.ctx.fillStyle = '#00f3ff';
        this.ctx.font = 'bold 13px Vazirmatn, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('سکوی شروع (START)', center.x, center.y + 14);

        this.ctx.restore();
    }

    drawBridgeRow(rowIndex) {
        this.ensureRows(rowIndex);
        const rowObj = this.rows[rowIndex - 1];

        for (let col = 0; col < 3; col++) {
            const pos = this.getTilePosition(rowIndex, col);
            const tile = rowObj.tiles[col];

            if (tile.isBroken) {
                // Draw broken metal frame only
                this.drawEmptyFrame(pos.x, pos.y);
            } else {
                this.drawGlassTile(pos.x, pos.y, tile, rowIndex);
            }
        }
    }

    drawGlassTile(x, y, tile, rowIndex) {
        const w = this.tileWidth;
        const h = this.tileHeight;

        this.ctx.save();

        // Tile base shadow & support beam under
        this.ctx.fillStyle = 'rgba(10, 15, 35, 0.7)';
        this.ctx.fillRect(x - w / 2 + 6, y + h / 2 - 4, w - 12, 10);

        // Glass gradient fill
        const glassGrad = this.ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);

        if (tile.touched && tile.isSafe) {
            glassGrad.addColorStop(0, 'rgba(0, 243, 255, 0.45)');
            glassGrad.addColorStop(0.5, 'rgba(0, 180, 255, 0.25)');
            glassGrad.addColorStop(1, 'rgba(0, 243, 255, 0.45)');
            this.ctx.shadowColor = '#00f3ff';
            this.ctx.shadowBlur = 15;
        } else {
            glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
            glassGrad.addColorStop(0.5, 'rgba(150, 200, 255, 0.08)');
            glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.18)');
            this.ctx.shadowColor = 'rgba(120, 200, 255, 0.25)';
            this.ctx.shadowBlur = 8;
        }

        this.ctx.fillStyle = glassGrad;
        this.ctx.strokeStyle = tile.touched ? '#00f3ff' : 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = tile.touched ? 2.5 : 1.5;

        this.roundRect(x - w / 2, y - h / 2, w, h, 8, true, true);

        // Specular Glass Reflection Highlight (Diagonal sheen)
        this.ctx.beginPath();
        this.ctx.moveTo(x - w / 2 + 10, y - h / 2 + 4);
        this.ctx.lineTo(x + w / 2 - 10, y - h / 2 + 4);
        this.ctx.lineTo(x + w / 2 - 25, y - h / 2 + 14);
        this.ctx.lineTo(x - w / 2 + 4, y - h / 2 + 14);
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.fill();

        // Row step indicator number
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.font = '11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${rowIndex}`, x, y + 4);

        this.ctx.restore();
    }

    drawEmptyFrame(x, y) {
        const w = this.tileWidth;
        const h = this.tileHeight;

        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 50, 80, 0.4)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([4, 4]);
        this.roundRect(x - w / 2, y - h / 2, w, h, 8, false, true);
        this.ctx.restore();
    }

    drawPlayer() {
        const p = this.player;
        let drawX = p.x;
        let drawY = p.y;

        // Add jump arc parabola when jumping
        if (this.state === 'JUMPING') {
            const jumpHeight = 42;
            const arc = Math.sin(p.jumpProgress * Math.PI) * jumpHeight;
            drawY -= arc;
        }

        if (p.isFalling) {
            drawY += p.fallY;
        }

        this.ctx.save();
        this.ctx.globalAlpha = p.alpha;

        // Shadow under character
        if (!p.isFalling && this.state !== 'JUMPING') {
            this.ctx.beginPath();
            this.ctx.ellipse(drawX, drawY + 12, 14, 6, 0, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.fill();
        }

        // Cute Glowing Cyber Runner Avatar
        this.ctx.shadowColor = '#00f3ff';
        this.ctx.shadowBlur = 18;

        // Outer Glow Body
        this.ctx.beginPath();
        this.ctx.arc(drawX, drawY - 14, 16, 0, Math.PI * 2);
        const headGrad = this.ctx.createRadialGradient(drawX - 4, drawY - 18, 2, drawX, drawY - 14, 16);
        headGrad.addColorStop(0, '#ffffff');
        headGrad.addColorStop(0.4, '#00f3ff');
        headGrad.addColorStop(1, '#0077ff');
        this.ctx.fillStyle = headGrad;
        this.ctx.fill();

        // Visor / Eyes
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#050311';
        this.ctx.beginPath();
        this.ctx.roundRect(drawX - 8, drawY - 18, 16, 7, 3);
        this.ctx.fill();

        this.ctx.fillStyle = '#ff0077';
        this.ctx.beginPath();
        this.ctx.arc(drawX - 3, drawY - 15, 2, 0, Math.PI * 2);
        this.ctx.arc(drawX + 3, drawY - 15, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Torso / Suit
        this.ctx.beginPath();
        this.ctx.moveTo(drawX - 10, drawY - 2);
        this.ctx.lineTo(drawX + 10, drawY - 2);
        this.ctx.lineTo(drawX + 7, drawY + 10);
        this.ctx.lineTo(drawX - 7, drawY + 10);
        this.ctx.closePath();
        this.ctx.fillStyle = '#00d2ff';
        this.ctx.fill();

        this.ctx.restore();
    }

    drawParticles() {
        for (let p of this.particles) {
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.life);

            if (p.isGlass) {
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation);
                this.ctx.fillStyle = p.color;
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.lineWidth = 1;

                this.ctx.beginPath();
                this.ctx.moveTo(0, -p.size / 2);
                this.ctx.lineTo(p.size / 2, p.size / 2);
                this.ctx.lineTo(-p.size / 2, p.size / 3);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
            } else {
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }
    }

    roundRect(x, y, width, height, radius, fill, stroke) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        if (fill) this.ctx.fill();
        if (stroke) this.ctx.stroke();
    }

    animate(now) {
        const dt = Math.min(0.1, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.update(dt);
        this.render();

        requestAnimationFrame(this.animate);
    }
}

window.GameEngine = GameEngine;
