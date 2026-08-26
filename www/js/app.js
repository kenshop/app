// Main App Initialization & UI Controller

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Managers
    const streakMgr = window.streakManager;
    const soundMgr = window.soundManager;
    const engine = new window.GameEngine('gameCanvas');

    // 2. DOM Elements
    const homeScreen = document.getElementById('homeScreen');
    const hudOverlay = document.getElementById('hudOverlay');
    const gameOverModal = document.getElementById('gameOverModal');
    const howToModal = document.getElementById('howToModal');

    const streakBadge = document.getElementById('streakBadge');
    const homeBestScore = document.getElementById('homeBestScore');
    
    const btnPlay = document.getElementById('btnPlay');
    const btnHowTo = document.getElementById('btnHowTo');
    const btnCloseHowTo = document.getElementById('btnCloseHowTo');
    const btnSoundToggle = document.getElementById('btnSoundToggle');

    const hudScore = document.getElementById('hudScore');
    const hudLivesText = document.getElementById('hudLivesText');
    const hudLivesDots = document.getElementById('hudLivesDots');
    const hudToast = document.getElementById('hudToast');
    const btnPause = document.getElementById('btnPause');

    const finalCurrentScore = document.getElementById('finalCurrentScore');
    const finalBestScore = document.getElementById('finalBestScore');
    const newRecordBadge = document.getElementById('newRecordBadge');
    const btnRestart = document.getElementById('btnRestart');
    const btnHome = document.getElementById('btnHome');

    let toastTimeout = null;

    // 3. Render Initial State
    function renderHome() {
        streakMgr.checkStreakStatus();
        streakBadge.textContent = streakMgr.getFormattedStreakText();
        
        const best = parseInt(localStorage.getItem('glass_bridge_best_score') || '0', 10);
        homeBestScore.textContent = best;

        homeScreen.classList.remove('hidden');
        hudOverlay.classList.add('hidden');
        gameOverModal.classList.add('hidden');
        howToModal.classList.add('hidden');
    }

    // 4. Update HUD
    function updateHUD(data) {
        hudScore.textContent = data.score;
        hudLivesText.textContent = `❤️ ${data.lives} / ${data.maxLives} جان`;
        
        // Render 10 mini dots
        hudLivesDots.innerHTML = '';
        for (let i = 0; i < data.maxLives; i++) {
            const dot = document.createElement('span');
            dot.className = 'mini-dot ' + (i < data.lives ? 'active' : 'lost');
            hudLivesDots.appendChild(dot);
        }

        // Show Toast Notification on Life Lost
        if (data.lifeLost) {
            hudToast.textContent = `💔 ۱ جان کم شد! (${data.lives} جان باقی‌مانده)`;
            hudToast.classList.add('visible');
            if (toastTimeout) clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                hudToast.classList.remove('visible');
            }, 1800);
        }
    }

    // 5. Engine Event Hooks
    engine.onHUDUpdate = (data) => {
        updateHUD(data);
    };

    engine.onGameOver = (currentScore, bestScore, isNewRecord) => {
        finalCurrentScore.textContent = currentScore;
        finalBestScore.textContent = bestScore;

        if (isNewRecord) {
            newRecordBadge.classList.remove('hidden');
        } else {
            newRecordBadge.classList.add('hidden');
        }

        setTimeout(() => {
            gameOverModal.classList.remove('hidden');
        }, 400);
    };

    // 6. UI Button Event Listeners
    btnPlay.addEventListener('click', () => {
        soundMgr.playClick();
        streakMgr.recordPlaySession();
        streakBadge.textContent = streakMgr.getFormattedStreakText();

        homeScreen.classList.add('hidden');
        hudOverlay.classList.remove('hidden');
        gameOverModal.classList.add('hidden');

        engine.startNewGame();
    });

    btnHowTo.addEventListener('click', () => {
        soundMgr.playClick();
        howToModal.classList.remove('hidden');
    });

    btnCloseHowTo.addEventListener('click', () => {
        soundMgr.playClick();
        howToModal.classList.add('hidden');
    });

    btnSoundToggle.addEventListener('click', () => {
        const isMuted = soundMgr.toggleMute();
        btnSoundToggle.innerHTML = isMuted ? '🔇' : '🔊';
        btnSoundToggle.classList.toggle('muted', isMuted);
    });

    btnPause.addEventListener('click', () => {
        soundMgr.playClick();
        renderHome();
    });

    btnRestart.addEventListener('click', () => {
        soundMgr.playClick();
        gameOverModal.classList.add('hidden');
        engine.startNewGame();
    });

    btnHome.addEventListener('click', () => {
        soundMgr.playClick();
        renderHome();
    });

    // 7. Initial startup
    renderHome();
});
