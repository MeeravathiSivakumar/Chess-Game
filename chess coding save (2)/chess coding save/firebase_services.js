/**
 * FUTECX CHESS V2 - Firestore Service Layer
 * Monolithic users/{uid} document schema (single source of truth)
 */

const FirestoreDB = {
    db: null,
    auth: null,
    currentUid: null,

    init() {
        if (typeof firebase === 'undefined') return;
        try {
            this.db = firebase.firestore();
            this.auth = firebase.auth();
        } catch (e) {
            console.error('[DB] Init failed:', e);
        }
    },

    uid() {
        return this.currentUid
            || (this.auth && this.auth.currentUser && this.auth.currentUser.uid)
            || null;
    },

    col(name) { return this.db.collection(name); },

    generatePlayerId() {
        return 'FUTX' + Math.floor(100000 + Math.random() * 900000);
    },

    getTodayDateString() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    buildDefaultUserDoc({ username, avatar, country, playerId }) {
        const now = this.getTodayDateString();
        return {
            playerId: playerId || this.generatePlayerId(),
            username,
            username_lowercase: (username || '').toLowerCase(),
            avatar: avatar || 'avatar_pawn',
            country: country || '',
            coins: 100,
            gems: 0,
            xp: 0,
            rp: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            matches: 0,
            isCurrentlyPlaying: false,
            sessionToken: '',
            streakCount: 0,
            lastClaimDate: '',
            claimedRankRewards: [],
            inventory: ['avatar_pawn', 'frame_none', 'title_novice'],
            history: [],
            friendRequests: [],
            friends: [],
            hasCompletedSetup: true,
            seasonStartDate: '',
            status: 'online',
            lastSeen: Date.now(),
            incomingInvitation: null
        };
    },

    async isUsernameTaken(username) {
        if (!this.db || !username) return false;
        try {
            const lower = username.toLowerCase();
            const snap = await this.col('users').where('username_lowercase', '==', lower).limit(1).get();
            return !snap.empty;
        } catch (e) {
            console.error('[DB] isUsernameTaken failed:', e);
            return false;
        }
    },

    async reserveUsername(username, uid) {
        if (!this.db) return;
        await this.col('usernames').doc(username.toLowerCase()).set({ uid, createdAt: Date.now() }, { merge: false });
    },

    async bootstrapNewUser(uid, profileData) {
        if (!this.db || !uid) return { ok: false, msg: 'DB unavailable' };
        const doc = this.buildDefaultUserDoc(profileData);
        try {
            const taken = await this.isUsernameTaken(profileData.username);
            if (taken) return { ok: false, msg: 'Username already taken. Choose another username.' };
            await this.col('users').doc(uid).set(doc);
            await this.reserveUsername(profileData.username, uid);
            return { ok: true, data: doc };
        } catch (e) {
            console.error('[DB] bootstrapNewUser failed:', e);
            return { ok: false, msg: e.message };
        }
    },

    async loadUser(uid) {
        if (!this.db || !uid) return null;
        this.currentUid = uid;
        try {
            const snap = await this.col('users').doc(uid).get();
            return snap.exists ? snap.data() : null;
        } catch (e) {
            console.error('[DB] loadUser failed:', e);
            return null;
        }
    },

    async saveUser(uid, data) {
        if (!this.db || !uid) return;
        try {
            await this.col('users').doc(uid).set(data, { merge: true });
        } catch (e) {
            console.error('[DB] saveUser failed:', e);
        }
    },

    async updateUser(uid, partial) {
        if (!this.db || !uid) return;
        try {
            await this.col('users').doc(uid).update(partial);
        } catch (e) {
            try { await this.col('users').doc(uid).set(partial, { merge: true }); } catch (e2) {
                console.error('[DB] updateUser failed:', e2);
            }
        }
    },

    listenUser(uid, callback) {
        if (!this.db || !uid) return () => {};
        return this.col('users').doc(uid).onSnapshot(snap => {
            if (snap.exists) callback(snap.data());
        }, e => console.error('[DB] listenUser error:', e));
    },

    /** Multi-device session lock via Firestore transaction */
    async acquireSessionLock(uid, sessionToken) {
        if (!this.db || !uid) return { ok: true, token: sessionToken };
        const ref = this.col('users').doc(uid);
        try {
            await this.db.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                tx.set(ref, {
                    isCurrentlyPlaying: true,
                    sessionToken,
                    status: 'in_match',
                    lastSeen: Date.now()
                }, { merge: true });
                if (!snap.exists) {
                    throw new Error('User doc missing');
                }
            });
            return { ok: true, token: sessionToken };
        } catch (e) {
            console.error('[DB] acquireSessionLock failed:', e);
            return { ok: false, msg: e.message };
        }
    },

    async releaseSessionLock(uid) {
        if (!this.db || !uid) return;
        await this.updateUser(uid, {
            isCurrentlyPlaying: false,
            sessionToken: '',
            status: 'online',
            lastSeen: Date.now()
        });
    },

    /** Ranked matchmaking queue */
    async joinMatchmakingQueue(uid, playerData, mode = 'ranked') {
        if (!this.db || !uid) return null;
        const entry = {
            uid,
            playerId: playerData.playerId,
            username: playerData.username,
            rp: playerData.rp || 0,
            mode: mode || 'ranked',
            joinedAt: Date.now(),
            status: 'searching'
        };
        await this.col('matchmaking').doc(uid).set(entry);
        return entry;
    },

    async leaveMatchmakingQueue(uid) {
        if (!this.db || !uid) return;
        try { await this.col('matchmaking').doc(uid).delete(); } catch (e) {}
    },

    async findRankedOpponent(uid, rp, range = 150) {
        if (!this.db) return null;
        const minRp = Math.max(0, rp - range);
        const maxRp = rp + range;
        try {
            const snap = await this.col('matchmaking')
                .where('status', '==', 'searching')
                .where('mode', '==', 'ranked')
                .where('rp', '>=', minRp)
                .where('rp', '<=', maxRp)
                .limit(10)
                .get();
            for (const doc of snap.docs) {
                if (doc.id !== uid) return doc.data();
            }
        } catch (e) {
            console.warn('[DB] findRankedOpponent query fallback:', e);
            const snap = await this.col('matchmaking').limit(20).get();
            for (const doc of snap.docs) {
                const d = doc.data();
                if (doc.id !== uid && d.status === 'searching' && (d.mode === 'ranked' || !d.mode) && Math.abs((d.rp || 0) - rp) <= range) {
                    return d;
                }
            }
        }
        return null;
    },

    /** Casual Play Online — match any active searching player worldwide */
    async findCasualOpponent(uid) {
        if (!this.db) return null;
        try {
            const snap = await this.col('matchmaking')
                .where('status', '==', 'searching')
                .where('mode', '==', 'casual')
                .limit(15)
                .get();
            for (const doc of snap.docs) {
                if (doc.id !== uid) return doc.data();
            }
        } catch (e) {
            console.warn('[DB] findCasualOpponent query fallback:', e);
            const snap = await this.col('matchmaking').limit(30).get();
            for (const doc of snap.docs) {
                const d = doc.data();
                if (doc.id !== uid && d.status === 'searching' && (d.mode === 'casual' || !d.mode)) {
                    return d;
                }
            }
        }
        return null;
    },

    /** 60-day ranked season soft reset */
    computeSeasonSoftReset(rp) {
        if (rp <= 100) return 0;
        const details = typeof FtechSystem !== 'undefined' && FtechSystem.getRankDetails
            ? FtechSystem.getRankDetails(rp)
            : { rankGroup: 'Pawn' };
        const group = (details.rankGroup || '').toLowerCase();
        if (group === 'grandmaster' || group === 'legend') return 400;
        if (group === 'master' || group === 'king' || group === 'queen') return 45;
        if (group === 'elite' || group === 'rook' || group === 'bishop') return 45;
        return 15;
    },

    async applySeasonSoftReset(uid, currentData) {
        if (!this.db || !uid || !currentData) return currentData;
        const rp = currentData.rp || 0;
        const reduction = this.computeSeasonSoftReset(rp);
        const newRp = Math.max(0, rp - reduction);
        const now = this.getTodayDateString();
        const patch = {
            rp: newRp,
            claimedRankRewards: [],
            seasonStartDate: now,
            lastSeasonReset: Date.now()
        };
        await this.updateUser(uid, patch);
        return { ...currentData, ...patch };
    },

    async sendFriendInvite(fromUid, fromData, toUid) {
        if (!this.db || !fromUid || !toUid || fromUid === toUid) return { ok: false, msg: 'Invalid target' };
        const payload = {
            uid: fromUid,
            name: fromData.username,
            playerId: fromData.playerId,
            avatar: fromData.avatar,
            timestamp: Date.now()
        };
        try {
            await this.col('users').doc(toUid).update({
                incomingInvitation: {
                    type: 'friend_duel',
                    hostUid: fromUid,
                    hostName: fromData.username,
                    hostPlayerId: fromData.playerId,
                    roomCode: fromData.roomCode || '',
                    timestamp: Date.now()
                }
            });
            return { ok: true };
        } catch (e) {
            return { ok: false, msg: e.message };
        }
    },

    async appendMatchHistory(uid, entry) {
        if (!this.db || !uid) return;
        await this.col('users').doc(uid).update({
            history: firebase.firestore.FieldValue.arrayUnion(entry),
            matches: firebase.firestore.FieldValue.increment(1)
        });
    },

    async refreshFriendsStatus(friendUids) {
        if (!this.db || !friendUids || !friendUids.length) return [];
        const results = [];
        for (const fUid of friendUids.slice(0, 30)) {
            try {
                const snap = await this.col('users').doc(fUid).get();
                if (snap.exists) {
                    const d = snap.data();
                    results.push({
                        uid: fUid,
                        name: d.username,
                        playerId: d.playerId,
                        avatar: d.avatar,
                        rp: d.rp || 0,
                        online: d.status === 'online' || d.status === 'in_lobby',
                        inMatch: !!d.isCurrentlyPlaying,
                        lastSeen: d.lastSeen
                    });
                }
            } catch (e) {}
        }
        return results;
    }
};
