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
        // Reset time component to ensure pure calendar day diff
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
                // Played today
                this.streak = Math.max(1, savedStreak);
            } else if (diffDays === 1) {
                // Played yesterday, ready for today's streak increment
                this.streak = Math.max(1, savedStreak);
            } else if (diffDays > 1) {
                // Missed one or more days -> reset to Day 1
                this.streak = 1;
                localStorage.setItem(this.STORAGE_KEY_STREAK, '1');
            } else {
                // Date in future or clock issue
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
                // Consecutive day play! Increment streak!
                this.streak = savedStreak + 1;
            } else if (diffDays > 1) {
                // Missed day -> reset
                this.streak = 1;
            } else if (diffDays === 0) {
                // Already played today -> keep current streak
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

    getPersianStreakText() {
        return `روز ${this.streak}`;
    }
}

window.streakManager = new StreakManager();
