// Glass Bridge Game Engine - Ultra Optimized 60FPS Mobile Canvas Renderer

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimize performance
        
        this.state = 'HOME'; // 'HOME', 'PLAYING', 'JUMPING', 'RESPAWNING', 'GAMEOVER'
        this.maxLives = 10;
        this.lives = 10;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('glass_bridge_best_score') || '0', 10);
        this.isNewRecord = false;

        // Bridge & World Layout
        this.currentStep = 0;
        this.rows = [];
        this.tileWidth = 85;
        this.tileHeight = 65;
        this.tileGapX = 16;
        this.tileGapY = 50;
        
        // Perspective settings
        this.cameraY = 0;
        this.targetCameraY = 0;
        
        // Player State
        this.player = {
            row: 0,
            col: 1, // 0: Left, 1: Center, 2: Right
            lastSafeRow: 0,
            lastSafeCol: 1,
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            jumpProgress: 1,
            isFalling: false,
            fallY: 0,
            alpha: 1
        };

        // Effects
        this.particles = [];

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
        this.dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance
        
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
        this.ctx.scale(this.dpr, this.dpr);
        this.viewWidth = rect.width;
        this.viewHeight = rect.height;

        // Adjust dimensions based on screen width
        if (this.viewWidth < 400) {
            this.tileWidth = 75;
            this.tileHeight = 54;
            this.tileGapX = 12;
            this.tileGapY = 46;
        } else {
            this.tileWidth = 90;
            this.tileHeight = 64;
            this.tileGapX = 16;
            this.tileGapY = 52;
        }

        this.recalculatePositions();
    }

    generateRow(rowIndex) {
        // Exactly 3 tiles: 2 SAFE (true), 1 BREAKABLE (false)
        const tiles = [true, true, false];
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
        this.maxLives = 10;
        this.score = 0;
        this.isNewRecord = false;
        this.currentStep = 0;
        this.rows = [];
        this.particles = [];
        
        this.ensureRows(15);
        
        this.player.row = 0;
        this.player.col = 1;
        this.player.lastSafeRow = 0;
        this.player.lastSafeCol = 1;
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
        const startY = this.viewHeight - 130;
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
            
            // Check which tile was tapped
            for (let col = 0; col < 3; col++) {
                const tilePos = this.getTilePosition(targetRow, col);
                const screenY = tilePos.y + this.cameraY;
                
                const hitMarginX = this.tileWidth * 0.58;
                const hitMarginY = this.tileHeight * 0.65;

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

        // Record last safe point
        this.player.lastSafeRow = this.player.row;
        this.player.lastSafeCol = this.player.col;

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
        const rowObj = this.rows[this.player.row - 1];
        const tile = rowObj.tiles[this.player.col];
        tile.touched = true;

        if (tile.isSafe) {
            // SAFE TILE!
            if ('vibrate' in navigator) {
                try { navigator.vibrate(25); } catch(e){}
            }
            window.soundManager && window.soundManager.playGlassLanding();
            
            this.player.lastSafeRow = this.player.row;
            this.player.lastSafeCol = this.player.col;

            this.score = Math.max(this.score, this.player.row);
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
            // BREAKABLE TILE!
            tile.isBroken = true;
            if ('vibrate' in navigator) {
                try { navigator.vibrate([80, 40, 100]); } catch(e){}
            }
            window.soundManager && window.soundManager.playGlassShatter();
            this.createGlassShards(this.player.x, this.player.y);
            
            this.player.isFalling = true;
            this.player.fallY = 0;
            
            // REDUCE EXACTLY 1 LIFE
            this.lives = Math.max(0, this.lives - 1);
            window.soundManager && window.soundManager.playLifeLost();
            this.updateHUD(true); // pass lifeLost = true

            setTimeout(() => {
                if (this.lives > 0) {
                    // STILL HAS LIVES -> RESPAWN ON LAST SAFE TILE!
                    this.respawnPlayer();
                } else {
                    // ZERO LIVES LEFT -> GAME OVER!
                    this.triggerGameOver();
                }
            }, 650);
        }
    }

    respawnPlayer() {
        const safeRow = this.player.lastSafeRow || 0;
        const safeCol = this.player.lastSafeCol !== undefined ? this.player.lastSafeCol : 1;

        this.player.row = safeRow;
        this.player.col = safeCol;

        const safePos = this.getTilePosition(safeRow, safeCol);
        this.player.x = safePos.x;
        this.player.y = safePos.y;
        this.player.targetX = safePos.x;
        this.player.targetY = safePos.y;
        this.player.jumpProgress = 1;
        this.player.isFalling = false;
        this.player.fallY = 0;
        this.player.alpha = 1;

        this.targetCameraY = Math.max(0, (safeRow - 1) * (this.tileHeight + this.tileGapY));
        this.state = 'PLAYING';
    }

    triggerGameOver() {
        this.state = 'GAMEOVER';
        window.soundManager && window.soundManager.playGameOver();
        this.onGameOver && this.onGameOver(this.score, this.bestScore, this.isNewRecord);
    }

    createGlassShards(x, y) {
        // Fast lightweight particle burst
        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.particles.push({
                x: x + (Math.random() - 0.5) * this.tileWidth,
                y: y + (Math.random() - 0.5) * this.tileHeight,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: Math.random() * 8 + 4,
                rotation: Math.random() * Math.PI,
                rotSpeed: (Math.random() - 0.5) * 0.2,
                color: 'rgba(180, 240, 255, 0.85)',
                life: 1,
                decay: 0.035,
                isGlass: true
            });
        }
    }

    createSafeSparkles(x, y) {
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            this.particles.push({
                x: x,
                y: y + 8,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                size: Math.random() * 3 + 2,
                color: '#00f3ff',
                life: 1,
                decay: 0.06,
                isGlass: false
            });
        }
    }

    updateHUD(lifeLost = false) {
        this.onHUDUpdate && this.onHUDUpdate({
            lives: this.lives,
            maxLives: this.maxLives,
            score: this.score,
            bestScore: this.bestScore,
            lifeLost: lifeLost
        });
    }

    update(dt) {
        // Camera smooth follow
        this.cameraY += (this.targetCameraY - this.cameraY) * 0.15;

        // Player Jump
        if (this.state === 'JUMPING') {
            this.player.jumpProgress += dt * 4.5;
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

        // Falling
        if (this.player.isFalling) {
            this.player.fallY += dt * 750;
            this.player.alpha = Math.max(0, this.player.alpha - dt * 2.0);
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.isGlass) {
                p.vy += 0.4;
                p.rotation += p.rotSpeed;
            }
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render() {
        // Clear background
        this.ctx.fillStyle = '#070614';
        this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

        // Background subtle grid lines
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.04)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = 0; x < this.viewWidth; x += 40) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.viewHeight);
        }
        this.ctx.stroke();

        this.ctx.save();
        this.ctx.translate(0, this.cameraY);

        // Draw Start Platform
        this.drawStartPlatform();

        // Draw Visible Bridge Rows
        const startRow = Math.max(1, Math.floor(this.cameraY / (this.tileHeight + this.tileGapY)) - 1);
        const endRow = startRow + 10;

        for (let r = startRow; r <= endRow; r++) {
            this.drawBridgeRow(r);
        }

        // Draw Player
        if (this.player.alpha > 0) {
            this.drawPlayer();
        }

        // Draw Particles
        this.drawParticles();

        this.ctx.restore();
    }

    drawStartPlatform() {
        const center = this.getTilePosition(0, 1);
        const width = 3 * this.tileWidth + 2 * this.tileGapX + 30;
        const height = 45;

        this.ctx.fillStyle = 'rgba(25, 30, 60, 0.95)';
        this.ctx.strokeStyle = '#00f3ff';
        this.ctx.lineWidth = 2;

        this.roundRect(center.x - width / 2, center.y - 12, width, height, 10, true, true);

        this.ctx.fillStyle = '#00f3ff';
        this.ctx.font = 'bold 12px Vazirmatn, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('سکوی شروع (START)', center.x, center.y + 14);
    }

    drawBridgeRow(rowIndex) {
        this.ensureRows(rowIndex);
        const rowObj = this.rows[rowIndex - 1];

        for (let col = 0; col < 3; col++) {
            const pos = this.getTilePosition(rowIndex, col);
            const tile = rowObj.tiles[col];

            if (tile.isBroken) {
                this.drawEmptyFrame(pos.x, pos.y);
            } else {
                this.drawGlassTile(pos.x, pos.y, tile, rowIndex);
            }
        }
    }

    drawGlassTile(x, y, tile, rowIndex) {
        const w = this.tileWidth;
        const h = this.tileHeight;

        // Base support shadow
        this.ctx.fillStyle = 'rgba(12, 14, 28, 0.8)';
        this.ctx.fillRect(x - w / 2 + 4, y + h / 2 - 3, w - 8, 8);

        // Glass Fill
        if (tile.touched && tile.isSafe) {
            this.ctx.fillStyle = 'rgba(0, 243, 255, 0.35)';
            this.ctx.strokeStyle = '#00f3ff';
            this.ctx.lineWidth = 2.5;
        } else {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = 1.5;
        }

        this.roundRect(x - w / 2, y - h / 2, w, h, 8, true, true);

        // Glass reflection highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(x - w / 2 + 8, y - h / 2 + 3);
        this.ctx.lineTo(x + w / 2 - 8, y - h / 2 + 3);
        this.ctx.lineTo(x + w / 2 - 20, y - h / 2 + 10);
        this.ctx.lineTo(x - w / 2 + 3, y - h / 2 + 10);
        this.ctx.closePath();
        this.ctx.fill();

        // Row step number
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.font = '11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${rowIndex}`, x, y + 4);
    }

    drawEmptyFrame(x, y) {
        const w = this.tileWidth;
        const h = this.tileHeight;

        this.ctx.strokeStyle = 'rgba(255, 50, 80, 0.45)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([4, 4]);
        this.roundRect(x - w / 2, y - h / 2, w, h, 8, false, true);
        this.ctx.setLineDash([]);
    }

    drawPlayer() {
        const p = this.player;
        let drawX = p.x;
        let drawY = p.y;

        if (this.state === 'JUMPING') {
            const arc = Math.sin(p.jumpProgress * Math.PI) * 38;
            drawY -= arc;
        }

        if (p.isFalling) {
            drawY += p.fallY;
        }

        this.ctx.save();
        this.ctx.globalAlpha = p.alpha;

        // Character Shadow
        if (!p.isFalling && this.state !== 'JUMPING') {
            this.ctx.beginPath();
            this.ctx.ellipse(drawX, drawY + 10, 13, 5, 0, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            this.ctx.fill();
        }

        // Cyber Runner Character Body
        this.ctx.beginPath();
        this.ctx.arc(drawX, drawY - 12, 14, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00f3ff';
        this.ctx.fill();

        // Visor
        this.ctx.fillStyle = '#070614';
        this.ctx.beginPath();
        this.ctx.roundRect(drawX - 7, drawY - 16, 14, 6, 2);
        this.ctx.fill();

        // Eyes
        this.ctx.fillStyle = '#ff0077';
        this.ctx.beginPath();
        this.ctx.arc(drawX - 3, drawY - 13, 1.5, 0, Math.PI * 2);
        this.ctx.arc(drawX + 3, drawY - 13, 1.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Suit
        this.ctx.fillStyle = '#0088ff';
        this.ctx.beginPath();
        this.ctx.roundRect(drawX - 8, drawY + 1, 16, 10, 3);
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
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
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
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.update(dt);
        this.render();

        requestAnimationFrame(this.animate);
    }
}

window.GameEngine = GameEngine;
