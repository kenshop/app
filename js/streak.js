// Daily Streak Manager with LocalStorage Persistence

class StreakManager {
    constructor() {
        this.STORAGE_KEY_DATE = 'glass_bridge_last_play_date';
        this.STORAGE_KEY_STREAK = 'glass_bridge_streak_count';
        this.streak = 1;
        this.checkStreakStatus();
    }

    getTodayDateString() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getDaysDifference(dateStr1, dateStr2) {
        const d1 = new Date(dateStr1);
        const d2 = new Date(dateStr2);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        const diffMs = d2.getTime() - d1.getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    checkStreakStatus() {
        const lastDate = localStorage.getItem(this.STORAGE_KEY_DATE);
        const savedStreak = parseInt(localStorage.getItem(this.STORAGE_KEY_STREAK) || '1', 10);
        const today = this.getTodayDateString();

        if (!lastDate) {
            this.streak = 1;
        } else {
            const diffDays = this.getDaysDifference(lastDate, today);

            if (diffDays === 0) {
                this.streak = Math.max(1, savedStreak);
            } else if (diffDays === 1) {
                this.streak = Math.max(1, savedStreak);
            } else if (diffDays > 1) {
                this.streak = 1;
                localStorage.setItem(this.STORAGE_KEY_STREAK, '1');
            } else {
                this.streak = Math.max(1, savedStreak);
            }
        }
    }

    recordPlaySession() {
        const lastDate = localStorage.getItem(this.STORAGE_KEY_DATE);
        const savedStreak = parseInt(localStorage.getItem(this.STORAGE_KEY_STREAK) || '1', 10);
        const today = this.getTodayDateString();

        if (!lastDate) {
            this.streak = 1;
        } else {
            const diffDays = this.getDaysDifference(lastDate, today);
            if (diffDays === 1) {
                this.streak = savedStreak + 1;
            } else if (diffDays > 1) {
                this.streak = 1;
            } else if (diffDays === 0) {
                this.streak = Math.max(1, savedStreak);
            }
        }

        localStorage.setItem(this.STORAGE_KEY_DATE, today);
        localStorage.setItem(this.STORAGE_KEY_STREAK, this.streak.toString());
        return this.streak;
    }

    getFormattedStreakText() {
        return `Day ${this.streak}`;
    }
}

window.streakManager = new StreakManager();
