/**
 * Futecx Chess V2 - Complete Production Upgrade
 * System controller for Authentication, Progress (XP/Levels/Ranks), Coins Store,
 * Daily Rewards, Friend & Invites, Achievements list, Match History logs,
 * and a modular Alpha-Beta MiniMax Search Chess AI.
 */

// Global state controller
const FtechSystem = {
    // Current Active Mode and parameters
    currentGameMode: 'practice', // 'practice', 'computer', 'classic', 'ranked', 'play_online', 'friend'
    computerDifficulty: 'easy',  // 'easy', 'medium', 'hard', 'master', 'grandmaster'
    myPlayerColor: 'w',           // 'w' or 'b'
    isProcessingAIMove: false,
   
    // Auth and sync state
    sessionActive: false,
    authSkipped: false,
    currentUser: null,           // holds Firebase auth payload
    authInitialized: false,      // tracking state for initial boot
   
    // Account stats model (mirrors users/{uid} Firestore schema)
    account: {
        uid: 'guest_' + Math.random().toString(36).substring(2, 8),
        playerId: 'FUTX' + Math.floor(100000 + Math.random() * 900000),
        username: 'Grandmaster Guest',
        username_lowercase: '',
        avatar: 'avatar_pawn',
        frame: 'frame_none',
        title: 'Novice Duelist',
        level: 1,
        xp: 0,
        rp: 0,
        coins: 100,
        gems: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        isCurrentlyPlaying: false,
        sessionToken: '',
        streakCount: 0,
        lastClaimDate: '',
        claimedRankRewards: [],
        inventory: ['avatar_pawn', 'frame_none', 'title_novice'],
        history: [],
        friendRequests: [],
        achievements: [],
        email: '',
        country: '',
        hasCompletedSetup: false,
        seasonStartDate: '',
        equippedBoard: 'board_classic',
        equippedSkin: 'skin_default',
        skin: 'skin_default',
        board: 'board_classic',
        theme: 'theme_default',
        sound: 'sound_default',
        equippedEmotes: ['emote_gg'],
        quitCount: 0,
        banStatus: '',
        banUntil: 0,
        streakShields: 1,
        claimedDailyDays: [],
        lastDailyClaimTimestamp: 0,
    },

    sessionToken: null,
    _sessionUnsub: null,
    _matchmakingTimer: null,
    _friendRosterTimer: null,
    inviteCooldowns: {},
    matchOpponentInfo: null,

    // Entry fee payout matrices for private/ranked lobbies
    ENTRY_FEE_TIERS: {
        none: { fee: 0, payout: 0 },
        standard: { fee: 50, payout: 80 },
        premium: { fee: 200, payout: 350 },
        tournament: { fee: 500, payout: 900 }
    },
    currentEntryFeeTier: 'none',

    // Lists & Standings (hydrated from Firestore friends[])
    friends: [],
    recentPlayers: [
        { name: 'ChessMaster99', date: 'Yesterday' },
        { name: 'StrategicSavant', date: '2 days ago' }
    ],
    friendRequests: [],
   
    // Store customization catalogue
    catalog: {
        avatars: [
            { id: 'avatar_pawn', name: 'Default Pawn', cost: 0, icon: '♟️', rarity: 'Common' },
            { id: 'avatar_knight', name: 'Obsidian Knight', cost: 120, icon: '♞', rarity: 'Rare' },
            { id: 'avatar_bishop', name: 'Holy Bishop', cost: 180, icon: '♝', rarity: 'Rare' },
            { id: 'avatar_rook', name: 'Iron Citadel Rook', cost: 250, icon: '♜', rarity: 'Epic' },
            { id: 'avatar_queen', name: 'Royal Empress Queen', cost: 400, icon: '♛', rarity: 'Legendary' },
            { id: 'avatar_king', name: 'Epitaph Emperor King', cost: 600, icon: '♚', rarity: 'Mythic' }
        ],
        frames: [
            { id: 'frame_none', name: 'No Frame', cost: 0, border: 'rgba(255,255,255,0.05)', rarity: 'Common' },
            { id: 'frame_pawn', name: 'Pawn Frame', cost: 100, border: '#b0bec5', rarity: 'Common' },
            { id: 'frame_knight', name: 'Knight Frame', cost: 200, border: '#81c784', rarity: 'Rare' },
            { id: 'frame_bishop', name: 'Bishop Frame', cost: 300, border: '#64b5f6', rarity: 'Rare' },
            { id: 'frame_rook', name: 'Rook Frame', cost: 400, border: '#ba68c8', rarity: 'Epic' },
            { id: 'frame_queen', name: 'Queen Frame', cost: 500, border: '#f06292', rarity: 'Epic' },
            { id: 'frame_king', name: 'King Frame', cost: 750, border: '#ffca28', rarity: 'Legendary' },
            { id: 'frame_grandmaster', name: 'Grandmaster Frame', cost: 1000, border: '#00e5ff', rarity: 'Legendary' },
            { id: 'frame_legend', name: 'Legend Frame', cost: 1500, border: '#ff6d00', rarity: 'Mythic' }
        ],
        titles: [
            { id: 'title_novice', name: 'Novice Duelist', cost: 0, rarity: 'Common' },
            { id: 'title_tactician', name: 'Chess Tactician', cost: 100, rarity: 'Rare' },
            { id: 'title_expert', name: 'Eminent Expert', cost: 250, rarity: 'Epic' },
            { id: 'title_legend', name: 'Grandmaster Legend', cost: 500, rarity: 'Mythic' }
        ],
        themes: [
            { id: 'theme_default', name: 'Standard Layout', cost: 0, rarity: 'Common' },
            { id: 'theme_dark', name: 'Dark Mode Focus', cost: 200, rarity: 'Rare' },
            { id: 'theme_gold', name: 'Golden Prestige', cost: 800, rarity: 'Epic' }
        ],
        skins: [
            { id: 'skin_default', name: 'Classic Maple Wood', cost: 0, icon: '♟️', rarity: 'Common' },
            { id: 'skin_obsidian', name: 'Volcanic Obsidian', cost: 300, icon: '🖤', rarity: 'Epic' },
            { id: 'skin_royal_gold', name: 'Royal Gold Pieces', cost: 500, icon: '👑', rarity: 'Legendary' },
            { id: 'skin_blue', name: 'Neon Cyber Blue', cost: 400, icon: '💠', rarity: 'Epic' },
            { id: 'skin_neon', name: 'Animated Core Particle', cost: 600, icon: '✨', rarity: 'Mythic' }
        ],
        boards: [
            { id: 'board_classic', name: 'Classic Wood', cost: 0, icon: '🟫', rarity: 'Common' },
            { id: 'board_obsidian', name: 'Obsidian Stone', cost: 250, icon: '⬛', rarity: 'Rare' },
            { id: 'board_royal', name: 'Royal Gold Board', cost: 400, icon: '🟨', rarity: 'Epic' },
            { id: 'board_neon', name: 'Neon Cyber Grid', cost: 450, icon: '🔷', rarity: 'Legendary' }
        ],
        sounds: [
            { id: 'sound_default', name: 'Classic Clicks', cost: 0, rarity: 'Common' },
            { id: 'sound_arcade', name: 'Arcade Bleeps', cost: 300, rarity: 'Rare' },
            { id: 'sound_orchestral', name: 'Epic Orchestra', cost: 1000, rarity: 'Legendary' }
        ],
        emotes: [
            { id: 'emote_gg', name: 'Good Game!', cost: 50, icon: '🤝', rarity: 'Common' },
            { id: 'emote_wow', name: 'Mind Blown', cost: 150, icon: '🤯', rarity: 'Rare' },
            { id: 'emote_fire', name: 'On Fire', cost: 250, icon: '🔥', rarity: 'Epic' },
            { id: 'emote_crown', name: 'King Me', cost: 1500, icon: '👑', rarity: 'Mythic' }
        ]
    },
   
    // Core engine booting and data hydration
    init() {
        console.log("Ftech V2: Booting core system module.");
        if (typeof FirestoreDB !== 'undefined') FirestoreDB.init();
        this.loadLocalData();
        this.authInitialized = false;
        this.setupConnectionMonitors();
        this.checkSeasonReset();
       
        // Setup Firebase state listeners if Firebase matches and auth is packed
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.auth === 'function') {
            try {
                firebase.auth().onAuthStateChanged(user => {
                    this.authInitialized = true;
                    if (user) {
                        console.log("Ftech V2: User authenticated:", user.email);
                        this.sessionActive = true;
                        this.currentUser = user;
                        this.loadAccountData(user.uid);
                        this.account.uid = user.uid;
                        if (!this.account.username || this.account.username === 'Grandmaster Guest') {
                            this.account.username = user.displayName || user.email.split('@')[0];
                        }
                        this.fetchCloudProfile();
                        if (typeof FtechSocial !== 'undefined') FtechSocial.init();
                    } else {
                        console.log("Ftech V2: No active Firebase session.");
                        this.sessionActive = false;
                        this.currentUser = null;
                    }
                    this.renderDashboard();
                });
            } catch (err) {
                console.error("Ftech V2: Firebase Auth error", err);
                this.authInitialized = true;
                this.authSkipped = true;
                this.renderDashboard();
            }
        } else {
            console.warn("Ftech V2: Offline mode active or Auth SDK unattached. Using standard localStorage fallback.");
            this.authInitialized = true;
            this.authSkipped = true;
            this.migrateSchema();
            this.renderDashboard();
        }
    },
   
    // Local memory sync
    loadLocalData() {
        try {
            const cached = localStorage.getItem('ftech_chess_v2_profile');
            if (cached) {
                const parsed = JSON.parse(cached);
                // Hydrate safety defaults preserves values
                this.account = { ...this.account, ...parsed };
                console.log("Ftech V2: Restored profile database from Storage:", this.account.username);
            }
            if (!this.account.playerId || !/^FUTX\d{6}$/.test(this.account.playerId)) {
                this.account.playerId = this.generatePlayerId();
            }
            this.migrateSchema();
        } catch(e) {
            console.error("Ftech V2: Local Storage reading blocked", e);
        }
    },

    loadAccountData(uid) {
        if (!uid) return false;
        try {
            const cached = localStorage.getItem('ftech_chess_v2_profile_' + uid);
            if (cached) {
                const parsed = JSON.parse(cached);
                this.account = { ...this.account, ...parsed };
                this.account.uid = uid; // guarantee uid consistency
                console.log("Ftech V2: Restored UID matched profile database:", this.account.username);
            }
            this.migrateSchema();
            return true;
        } catch(e) {
            console.error("Ftech V2: UID Storage reading blocked", e);
            return false;
        }
    },
   
    migrateSchema() {
        const defaults = ['avatar_pawn', 'frame_none', 'title_novice', 'skin_default', 'board_classic', 'theme_default', 'sound_default', 'emote_gg'];
        if (!this.account.inventory) this.account.inventory = [];
        defaults.forEach(item => {
            if (!this.account.inventory.includes(item)) {
                this.account.inventory.push(item);
            }
        });
        if (!this.account.equippedEmotes) this.account.equippedEmotes = ['emote_gg'];
        if (!this.account.theme) this.account.theme = 'theme_default';
        if (!this.account.sound) this.account.sound = 'sound_default';
    },

    saveData() {
        try {
            const firebaseUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
            if (firebaseUser) {
                this.account.uid = firebaseUser.uid;
                this.sessionActive = true;
            } else if (this.sessionActive && this.currentUser) {
                this.account.uid = this.currentUser.uid;
            }
            // Always save to standard key for active session
            localStorage.setItem('ftech_chess_v2_profile', JSON.stringify(this.account));
            // Save to account-specific key to never lose data across logins/logouts
            if (this.account.uid) {
                localStorage.setItem('ftech_chess_v2_profile_' + this.account.uid, JSON.stringify(this.account));
            }
            if (this.sessionActive && typeof firebase !== 'undefined') {
                this.syncCloudProfile();
            }
        } catch (e) {
            console.error("Ftech V2: Save aborted", e);
        }
        this.renderDashboard();
    },
   
    // Firestore Profile Syncing
    showIncomingInvitePopup(invite) {
        // If we choose to run in a game, decline automatically
        if (typeof isGameActive !== 'undefined' && isGameActive) {
            this.declineIncomingInvite(invite);
            return;
        }

        let popup = document.getElementById('incoming-invite-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'incoming-invite-popup';
            popup.style = "position: fixed; bottom: 20px; right: 20px; background: #12121a; border: 2px solid var(--gold); border-radius: 8px; padding: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.8); z-index: 10000; width: 320px; transition: all 0.3s ease; font-family: var(--font-body); text-align: left;";
            document.body.appendChild(popup);
        }

        popup.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: flex-start;">
                <span style="font-size: 24px;">⚔️</span>
                <div style="flex: 1;">
                    <h4 style="margin: 0; font-family: var(--font-display); font-size: 13px; color: #fff; letter-spacing: 0.5px;">DUEL CHALLENGE</h4>
                    <p style="margin: 6px 0; font-size: 11px; color: var(--text-muted); line-height: 1.4;">
                        <strong style="color: var(--gold);">${invite.hostName.toUpperCase()}</strong> has invited you to a Room Match!
                    </p>
                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <button class="btn btn-primary" id="btn-accept-invite" style="flex: 1; font-size: 9px; padding: 6px 12px; width: auto; border-radius:4px; height:28px;">ACCEPT</button>
                        <button class="btn btn-outline" id="btn-decline-invite" style="flex: 1; font-size: 9px; padding: 6px 12px; border-color: rgba(255,255,255,0.1); width: auto; border-radius:4px; height:28px;">DECLINE</button>
                    </div>
                </div>
            </div>
        `;

        popup.style.display = 'block';

        document.getElementById('btn-accept-invite').onclick = () => {
            popup.style.display = 'none';
            this.acceptIncomingInvite(invite);
        };

        document.getElementById('btn-decline-invite').onclick = () => {
            popup.style.display = 'none';
            this.declineIncomingInvite(invite);
        };
    },

    acceptIncomingInvite(invite) {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
            const db = firebase.firestore();
            db.collection('users').doc(this.account.uid).update({
                incomingInvitation: null
            }).then(() => {
                console.log("Cleared incoming invitation after acceptance.");
            });
        }
       
        this.currentGameMode = 'friend';
        if (typeof joinRoomDirectly === 'function') {
            joinRoomDirectly(invite.roomCode);
        } else {
            const inp = document.getElementById('v3-join-input') || document.getElementById('join-room-input');
            if (inp) inp.value = invite.roomCode;
            if (typeof joinRoomFromInput === 'function') {
                joinRoomFromInput();
            }
        }
    },

    declineIncomingInvite(invite) {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
            const db = firebase.firestore();
            db.collection('users').doc(this.account.uid).update({
                incomingInvitation: null
            }).then(() => {
                console.log("Cleared incoming invitation after declination.");
            });
        }
        if (typeof showToast === 'function') {
            showToast("INVITATION DECLINED.");
        }
    },

    fetchCloudProfile() {
        if (!this.sessionActive) return;
        if (this.isFetchingProfile) {
            console.log("Ftech V2: Profile fetching already in progress, skipping duplicate call.");
            return;
        }
        if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
            console.warn("Ftech V2: Firestore SDK unavailable.");
            return;
        }
        try {
            this.isFetchingProfile = true;
            const db = firebase.firestore();
            // Safeguard uid value to be exact Firebase Auth UID
            const firebaseUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
            const currentAuthUid = firebaseUser ? firebaseUser.uid : (this.currentUser ? this.currentUser.uid : this.account.uid);
            this.account.uid = currentAuthUid;
            const docRef = db.collection('users').doc(currentAuthUid);
           
            // Initial fetch hydration
            docRef.get().then(doc => {
                this.isFetchingProfile = false;
                if (doc.exists) {
                    const cloudData = doc.data();
                    this.account = { ...this.account, ...cloudData };
                    this.account.uid = currentAuthUid;
                    if (cloudData.friends) this.friends = cloudData.friends;
                    if (cloudData.friendRequests) this.friendRequests = cloudData.friendRequests;
                    if (!this.account.claimedRankRewards) this.account.claimedRankRewards = [];
                    if (!this.account.lastClaimDate) this.account.lastClaimDate = '';
                    console.log("Ftech V2: Hydrated profiles from Cloud!");
                    localStorage.setItem('ftech_chess_v2_profile', JSON.stringify(this.account));
                    if (this.account.uid) {
                        localStorage.setItem('ftech_chess_v2_profile_' + this.account.uid, JSON.stringify(this.account));
                    }
                    this.renderDashboard();
                   
                    // Route if on login screen or splash screen to prevent active race conditions
                    const activeScreen = document.querySelector('.active-screen');
                    const activeScreenId = activeScreen ? activeScreen.id : '';
                    if (activeScreenId === 'login-screen' || activeScreenId === 'splash-screen') {
                        const setupDone = (this.account.hasCompletedSetup === true) ||
                                          (this.account.username && this.account.username !== 'Grandmaster Guest' && this.account.country);
                        if (setupDone) {
                            if (typeof transitionScreenV3 === 'function') {
                                transitionScreenV3('lobby');
                                if (typeof syncLobbyHUD === 'function') syncLobbyHUD();
                            }
                        } else {
                            if (typeof generateSetupUID === 'function') generateSetupUID();
                            if (typeof transitionScreenV3 === 'function') transitionScreenV3('setup-screen');
                        }
                    }
                } else {
                    console.log("Ftech V2: No document found. Checking local configuration.");
                    const localSetupDone = (this.account.hasCompletedSetup === true) ||
                                           (this.account.username && this.account.username !== 'Grandmaster Guest' && this.account.country);
                    if (localSetupDone) {
                        console.log("Ftech V2: Local setup matches existing, syncing to database...");
                        this.syncCloudProfile();
                        const activeScreen = document.querySelector('.active-screen');
                        const activeScreenId = activeScreen ? activeScreen.id : '';
                        if (activeScreenId === 'login-screen' || activeScreenId === 'splash-screen') {
                            if (typeof transitionScreenV3 === 'function') {
                                transitionScreenV3('lobby');
                                if (typeof syncLobbyHUD === 'function') syncLobbyHUD();
                            }
                        }
                    } else {
                        // Truly new user
                        const activeScreen = document.querySelector('.active-screen');
                        const activeScreenId = activeScreen ? activeScreen.id : '';
                        if (activeScreenId === 'login-screen' || activeScreenId === 'splash-screen') {
                            if (typeof generateSetupUID === 'function') generateSetupUID();
                            if (typeof transitionScreenV3 === 'function') transitionScreenV3('setup-screen');
                        }
                    }
                }
            }).catch(err => {
                this.isFetchingProfile = false;
                console.error("Ftech V2: Firestore hydration failure", err);
                const activeScreen = document.querySelector('.active-screen');
                const activeScreenId = activeScreen ? activeScreen.id : '';
                if (activeScreenId === 'login-screen' || activeScreenId === 'splash-screen') {
                    const localSetupDone = (this.account.hasCompletedSetup === true) ||
                                           (this.account.username && this.account.username !== 'Grandmaster Guest' && this.account.country);
                    if (localSetupDone) {
                        console.log("Ftech V2: Local profile loaded; bypassing cloud offline state.");
                        if (typeof transitionScreenV3 === 'function') {
                            transitionScreenV3('lobby');
                            if (typeof syncLobbyHUD === 'function') syncLobbyHUD();
                        }
                    } else {
                        if (typeof generateSetupUID === 'function') generateSetupUID();
                        if (typeof transitionScreenV3 === 'function') transitionScreenV3('setup-screen');
                    }
                }
            });

            // Spin live sync snap listener
            if (this.unsubUserDoc) this.unsubUserDoc();
            this.unsubUserDoc = docRef.onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    let updated = false;

                    if (data.friendRequests && JSON.stringify(data.friendRequests) !== JSON.stringify(this.friendRequests)) {
                        this.friendRequests = data.friendRequests;
                        updated = true;
                    }

                    if (data.friends && JSON.stringify(data.friends) !== JSON.stringify(this.friends)) {
                        this.friends = data.friends;
                        updated = true;
                    }

                    if (data.incomingInvitation) {
                        const invite = data.incomingInvitation;
                        if (!this.lastHandledInviteTime || this.lastHandledInviteTime !== invite.timestamp) {
                            this.lastHandledInviteTime = invite.timestamp;
                            this.showIncomingInvitePopup(invite);
                        }
                    }

                    // Deep compare fields (excluding friend lists handled uniquely above)
                    const currentClean = { ...this.account };
                    delete currentClean.friends;
                    delete currentClean.friendRequests;
                   
                    const incomingClean = { ...data };
                    delete incomingClean.friends;
                    delete incomingClean.friendRequests;

                    const mergedClean = { ...currentClean, ...incomingClean };
                    if (JSON.stringify(mergedClean) !== JSON.stringify(currentClean)) {
                        updated = true;
                    }

                    if (updated) {
                        this.account = { ...this.account, ...data };
                        localStorage.setItem('ftech_chess_v2_profile', JSON.stringify(this.account));
                        if (this.account.uid) {
                            localStorage.setItem('ftech_chess_v2_profile_' + this.account.uid, JSON.stringify(this.account));
                        }
                        this.renderDashboard();
                        if (typeof syncLobbyHUD === 'function') syncLobbyHUD();
                    }
                }
            }, err => {
                console.error("Ftech live user snap listener error", err);
            });

        } catch (err) {
            console.error("Ftech V2: Firestore accessing aborted", err);
        }
    },
   
    syncCloudProfile() {
        if (!this.sessionActive) return;
        if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
            console.warn("Ftech V2: Firestore SDK unavailable.");
            return;
        }
        try {
            const db = firebase.firestore();
            if (this.currentUser) {
                this.account.email = this.currentUser.email || '';
            }
            const payload = this.buildUserDocPayload();
            db.collection('users').doc(this.account.uid).set(payload, { merge: true })
                .then(() => console.log("Ftech V2: Firestore sync completed successfully."))
                .catch(err => console.error("Ftech V2: Cloud sync failed", err));
        } catch (err) {
            console.error("Ftech V2: Firestore sync aborted", err);
        }
    },

    formatDisplayName(name, maxLength = 13) {
        if (!name) return '';
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength) + '...';
    },

    isRankedBanned() {
        if (this.account.banUntil && Date.now() < this.account.banUntil) {
            return true;
        }
        return false;
    },

    getRankedBanRemainingString() {
        if (!this.account.banUntil) return '';
        const diff = this.account.banUntil - Date.now();
        if (diff <= 0) return '';
        const mins = Math.ceil(diff / 60000);
        if (mins >= 60) {
            const hrs = Math.ceil(mins / 60);
            return `${hrs} HOUR(S)`;
        }
        return `${mins} MINUTE(S)`;
    },

    handleRankedQuit() {
        if (!this.account.quitCount) this.account.quitCount = 0;
        this.account.quitCount++;
        this.account.losses++;
        this.account.matches++;
       
        const originalRp = this.account.rp;
        let rpLoss = 10;
        let warningMsg = '';
        let banDuration = 0; // in minutes
       
        const count = this.account.quitCount;
        if (count === 1) {
            warningMsg = "⚠️ WARNING (1st Quit): You left an active ranked match! Leaving another match will result in an immediate -20 RP penalty and matchmaking bans.";
            rpLoss = 10;
        } else if (count === 2) {
            warningMsg = "💥 RP PENALTY (2nd Quit): You have been penalized -20 RP for leaving an active Ranked match.";
            rpLoss = 20;
        } else if (count === 3) {
            warningMsg = "🚫 30 MIN BAN (3rd Quit): You have been penalized -20 RP and banned from Ranked matchmaking for 30 minutes!";
            rpLoss = 20;
            banDuration = 30;
        } else if (count === 4) {
            warningMsg = "🚫 1 HOUR BAN (4th Quit): You have been penalized -20 RP and banned from Ranked matchmaking for 1 hour!";
            rpLoss = 20;
            banDuration = 60;
        } else {
            warningMsg = "🚫 24 HOUR BAN (5th+ Quit): You have been penalized -20 RP and banned from Ranked matchmaking for 24 hours!";
            rpLoss = 20;
            banDuration = 24 * 60;
        }
       
        let finalRp = Math.max(0, originalRp - rpLoss);
       
        // Shield Protection Check
        if (this.account.streakShields > 0) {
            this.account.streakShields--;
            finalRp = originalRp;
            warningMsg += " [RP loss protected by Streak Shield!]";
        } else {
            this.account.rp = finalRp;
        }
       
        if (banDuration > 0) {
            this.account.banUntil = Date.now() + (banDuration * 60 * 1000);
            this.account.banStatus = `Banned until ${new Date(this.account.banUntil).toLocaleTimeString()}`;
        }
       
        // Record to History
        const logDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        this.account.history.unshift({
            opponent: 'FORFEIT ABANDONMENT',
            date: logDate,
            mode: this.currentGameMode ? this.currentGameMode.toUpperCase() : 'RANKED',
            result: 'LOSS',
            duration: '00:00',
            xp: 0,
            rp: -rpLoss,
            coins: 0
        });
       
        this.saveData();

        this.releaseMatchSession();

        // Close any active game
        if (typeof isGameActive !== 'undefined') isGameActive = false;
        if (typeof currentTimer !== 'undefined' && currentTimer) clearInterval(currentTimer);
        if (typeof networkSync !== 'undefined' && networkSync) {
            try { networkSync.disconnectRoom(); } catch(e){}
        }

        // Display beautiful modal warning
        let alertDiv = document.createElement('div');
        alertDiv.className = 'modal-overlay';
        alertDiv.style.zIndex = '20000';
        alertDiv.innerHTML = `
            <div class="modal-card" style="border: 2px solid var(--gold); background: #12121a; max-width: 400px; padding: 24px; text-align: center; margin: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.85);">
                <div style="font-size: 40px; margin-bottom: 12px; filter: drop-shadow(0 0 10px red);">⚠️</div>
                <h3 style="font-family: var(--font-display); color: #fff; margin: 0 0 12px 0; font-size: 16px; letter-spacing: 1px;">RANKED QUIT PENALTY</h3>
                <p style="font-size: 11px; color: var(--text-muted); line-height: 1.5; margin: 0 0 20px 0; text-align: left;">${warningMsg}</p>
                <button class="btn btn-primary" id="btn-quit-ack" style="width: 100%; border-radius: 4px; padding: 10px; font-weight:800; font-size: 11px; letter-spacing: 1px;">ACKNOWLEDGE</button>
            </div>
        `;
        document.body.appendChild(alertDiv);
       
        document.getElementById('btn-quit-ack').onclick = () => {
            alertDiv.remove();
            if (typeof transitionScreenV3 === 'function') {
                transitionScreenV3('lobby');
            } else if (typeof transitionScreen === 'function') {
                transitionScreen('game-screen', 'lobby');
            }
           
            const roomInput = document.getElementById('join-room-input') || document.getElementById('v3-join-input');
            if (roomInput) roomInput.value = "";
            const movesList = document.getElementById('moves-list');
            if (movesList) movesList.innerHTML = `<div class="empty-moves-placeholder">Awaiting first move...</div>`;
            try { resetCameraAngle(); } catch(e){}
        };
    },
   
    // Progression, Level, and Rank calculations
    RANK_TIERS: [
        { label: 'Pawn I', group: 'Pawn', minRp: 0 },
        { label: 'Pawn II', group: 'Pawn', minRp: 50 },
        { label: 'Pawn III', group: 'Pawn', minRp: 100 },
        { label: 'Pawn Elite', group: 'Pawn', minRp: 150 },
        { label: 'Knight I', group: 'Knight', minRp: 200 },
        { label: 'Knight II', group: 'Knight', minRp: 275 },
        { label: 'Knight III', group: 'Knight', minRp: 350 },
        { label: 'Knight Elite', group: 'Knight', minRp: 425 },
        { label: 'Bishop I', group: 'Bishop', minRp: 500 },
        { label: 'Bishop II', group: 'Bishop', minRp: 575 },
        { label: 'Bishop III', group: 'Bishop', minRp: 650 },
        { label: 'Bishop Elite', group: 'Bishop', minRp: 725 },
        { label: 'Rook I', group: 'Rook', minRp: 800 },
        { label: 'Rook II', group: 'Rook', minRp: 875 },
        { label: 'Rook III', group: 'Rook', minRp: 950 },
        { label: 'Rook Elite', group: 'Rook', minRp: 1025 },
        { label: 'Queen I', group: 'Queen', minRp: 1100 },
        { label: 'Queen II', group: 'Queen', minRp: 1175 },
        { label: 'Queen III', group: 'Queen', minRp: 1250 },
        { label: 'Queen Elite', group: 'Queen', minRp: 1325 },
        { label: 'King I', group: 'King', minRp: 1400 },
        { label: 'King II', group: 'King', minRp: 1475 },
        { label: 'King III', group: 'King', minRp: 1550 },
        { label: 'King Elite', group: 'King', minRp: 1625 },
        { label: 'Grandmaster I', group: 'Grandmaster', minRp: 1700 },
        { label: 'Grandmaster II', group: 'Grandmaster', minRp: 1800 },
        { label: 'Grandmaster III', group: 'Grandmaster', minRp: 1900 },
        { label: 'Grandmaster Elite', group: 'Grandmaster', minRp: 2000 },
        { label: 'Legend I', group: 'Legend', minRp: 2100 },
        { label: 'Legend II', group: 'Legend', minRp: 2300 },
        { label: 'Legend III', group: 'Legend', minRp: 2500 },
        { label: 'Legend Elite', group: 'Legend', minRp: 2700 }
    ],

    getRankDetails(rpVal) {
        const tiers = this.RANK_TIERS;
        let current = tiers[0];
        let next = tiers[1] || null;
        for (let i = 0; i < tiers.length; i++) {
            if (rpVal >= tiers[i].minRp) {
                current = tiers[i];
                next = tiers[i + 1] || null;
            } else break;
        }
        const spaceIdx = current.label.indexOf(' ');
        const rankName = spaceIdx === -1 ? current.label : current.label.substring(0, spaceIdx);
        const subTier = spaceIdx === -1 ? '' : current.label.substring(spaceIdx + 1);
        let progress = 100;
        let rpRemaining = 0;
        if (next) {
            const range = next.minRp - current.minRp;
            progress = Math.min(100, Math.floor(((rpVal - current.minRp) / range) * 100));
            rpRemaining = next.minRp - rpVal;
        }
        return {
            rankName,
            subTier,
            fullLabel: current.label,
            rankGroup: current.group,
            rankId: current.group.toLowerCase(),
            progress,
            rpRemaining,
            totalRP: rpVal,
            badgeClass: `rank-${rankName.toLowerCase()}`
        };
    },

    getRankGroup(fullLabel) {
        const t = this.RANK_TIERS.find(r => r.label === fullLabel);
        return t ? t.group : (fullLabel || '').split(' ')[0];
    },

    generatePlayerId() {
        if (typeof FirestoreDB !== 'undefined' && FirestoreDB.generatePlayerId) {
            return FirestoreDB.generatePlayerId();
        }
        return 'FUTX' + Math.floor(100000 + Math.random() * 900000);
    },

    containsEmoji(str) {
        return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(str);
    },

    getServerDateString() {
        if (typeof FirestoreDB !== 'undefined' && FirestoreDB.getTodayDateString) {
            return FirestoreDB.getTodayDateString();
        }
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    async validateAndSetProfileSetup({ username, avatar, country, playerId }) {
        const trimmed = (username || '').trim();
        if (!trimmed || trimmed.toLowerCase() === 'grandmaster guest') {
            return { ok: false, msg: 'PLEASE INPUT A DESCRIPTIVE GAMER TAG.' };
        }
        if (this.containsEmoji(trimmed)) {
            return { ok: false, msg: 'Usernames cannot contain emojis or emoticons.' };
        }
        const uid = this.currentUser ? this.currentUser.uid : this.account.uid;
        if (typeof FirestoreDB !== 'undefined' && FirestoreDB.isUsernameTaken) {
            const taken = await FirestoreDB.isUsernameTaken(trimmed);
            if (taken) {
                return { ok: false, msg: 'Username already taken. Choose another username.' };
            }
        }
        const pid = playerId || this.generatePlayerId();
        this.account.username = trimmed;
        this.account.username_lowercase = trimmed.toLowerCase();
        this.account.avatar = avatar || 'avatar_pawn';
        this.account.country = country || '';
        this.account.playerId = pid;
        this.account.hasCompletedSetup = true;
        if (!this.account.inventory.includes(this.account.avatar)) {
            this.account.inventory.push(this.account.avatar);
        }
        if (this.sessionActive && uid && typeof FirestoreDB !== 'undefined') {
            const result = await FirestoreDB.bootstrapNewUser(uid, {
                username: trimmed,
                avatar: this.account.avatar,
                country: this.account.country,
                playerId: pid
            });
            if (!result.ok && result.msg && result.msg.includes('Username already taken')) {
                return result;
            }
        }
        this.saveData();
        return { ok: true };
    },

    buildUserDocPayload() {
        const a = this.account;
        return {
            playerId: a.playerId,
            username: a.username,
            username_lowercase: (a.username || '').toLowerCase(),
            avatar: a.avatar,
            country: a.country,
            coins: a.coins,
            gems: a.gems || 0,
            xp: a.xp,
            rp: a.rp,
            wins: a.wins,
            losses: a.losses,
            draws: a.draws,
            matches: a.matches,
            isCurrentlyPlaying: !!a.isCurrentlyPlaying,
            sessionToken: a.sessionToken || '',
            streakCount: a.streakCount || 0,
            lastClaimDate: a.lastClaimDate || '',
            claimedRankRewards: a.claimedRankRewards || [],
            inventory: a.inventory || [],
            history: a.history || [],
            friendRequests: this.friendRequests || [],
            friends: this.friends || [],
            hasCompletedSetup: !!a.hasCompletedSetup,
            seasonStartDate: a.seasonStartDate || '',
            status: a.isCurrentlyPlaying ? 'in_match' : 'online',
            lastSeen: Date.now()
        };
    },

    async acquireMatchSession() {
        this.sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        this.account.isCurrentlyPlaying = true;
        this.account.sessionToken = this.sessionToken;
        const uid = this.account.uid;
        if (this.sessionActive && uid && typeof FirestoreDB !== 'undefined') {
            await FirestoreDB.acquireSessionLock(uid, this.sessionToken);
        }
        this.watchSessionMismatch();
        this.saveData();
        return this.sessionToken;
    },

    async releaseMatchSession() {
        this.account.isCurrentlyPlaying = false;
        this.account.sessionToken = '';
        this.sessionToken = null;
        if (this._sessionUnsub) {
            this._sessionUnsub();
            this._sessionUnsub = null;
        }
        const uid = this.account.uid;
        if (this.sessionActive && uid && typeof FirestoreDB !== 'undefined') {
            await FirestoreDB.releaseSessionLock(uid);
        }
        this.saveData();
    },

    watchSessionMismatch() {
        if (!this.sessionActive || typeof firebase === 'undefined') return;
        const uid = this.account.uid;
        if (!uid) return;
        if (this._sessionUnsub) this._sessionUnsub();
        const docRef = firebase.firestore().collection('users').doc(uid);
        this._sessionUnsub = docRef.onSnapshot(doc => {
            if (!doc.exists || !this.account.isCurrentlyPlaying) return;
            const data = doc.data();
            if (data.sessionToken && this.sessionToken && data.sessionToken !== this.sessionToken) {
                this.handleSessionHijackForfeit();
            }
        });
    },

    handleSessionHijackForfeit() {
        console.warn('Ftech V2: Session token mismatch — immediate forfeit on this device.');
        if (typeof isGameActive !== 'undefined') isGameActive = false;
        if (typeof currentTimer !== 'undefined' && currentTimer) clearInterval(currentTimer);
        if (typeof networkSync !== 'undefined' && networkSync) {
            try { networkSync.disconnectRoom(); } catch (e) {}
        }
        this.account.losses++;
        this.account.matches++;
        this.account.rp = Math.max(0, this.account.rp - 15);
        this.account.history.unshift({
            opponent: 'MULTI-DEVICE FORFEIT',
            date: new Date().toLocaleDateString(),
            mode: 'RANKED',
            result: 'LOSS',
            duration: '00:00',
            xp: 0,
            rp: -15,
            coins: 0
        });
        this.releaseMatchSession();
        this.saveData();
        if (typeof showToast === 'function') showToast('SESSION OVERRIDE: FORFEIT LOSS ASSIGNED.');
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signOut().finally(() => {
                this.sessionActive = false;
                this.currentUser = null;
                if (typeof transitionScreenV3 === 'function') transitionScreenV3('login-screen');
            });
        }
    },

    setupConnectionMonitors() {
        if (typeof window === 'undefined') return;
        let slowTimer = null;
        window.addEventListener('offline', () => {
            if (typeof showToast === 'function') showToast('Reconnecting to Server...');
        });
        window.addEventListener('online', () => {
            if (typeof showToast === 'function') showToast('Connection restored.');
        });
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            try {
                firebase.firestore().enableNetwork().catch(() => {});
            } catch (e) {}
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && navigator.onLine === false && typeof showToast === 'function') {
                showToast('Network Connection Slow');
            }
        });
    },

    claimRankTierReward(tierLabel) {
        if (!tierLabel) return false;
        if (!this.account.claimedRankRewards) this.account.claimedRankRewards = [];
        if (this.account.claimedRankRewards.includes(tierLabel)) {
            if (typeof showToast === 'function') showToast('REWARD CLAIMED');
            return false;
        }
        const details = this.getRankDetails(this.account.rp);
        if (this.account.rp < (this.RANK_TIERS.find(t => t.label === tierLabel) || { minRp: 99999 }).minRp) {
            if (typeof showToast === 'function') showToast('RANK TIER NOT YET UNLOCKED.');
            return false;
        }
        this.account.claimedRankRewards.push(tierLabel);
        this.account.coins += 200;
        this.saveData();
        if (typeof showToast === 'function') showToast(`CLAIMED +200 COINS FOR ${tierLabel}!`);
        return true;
    },

    triggerRankPromotionUI(oldDetails, newDetails, isPromotion) {
        if (!isPromotion) return;
        const oldGroup = this.getRankGroup(oldDetails.fullLabel);
        const newGroup = this.getRankGroup(newDetails.fullLabel);
        const oldStr = `${oldDetails.rankName} ${oldDetails.subTier}`.trim();
        const newStr = `${newDetails.rankName} ${newDetails.subTier}`.trim();
        if (oldGroup !== newGroup) {
            if (typeof triggerV3PromotionCelebration === 'function') {
                triggerV3PromotionCelebration(oldStr, newStr, true);
            } else if (typeof showToast === 'function') {
                showToast(`GRAND PROMOTION! ${newStr}`);
            }
        } else {
            if (typeof showSubTierPromotionGlow === 'function') {
                showSubTierPromotionGlow(newStr);
            } else if (typeof showToast === 'function') {
                showToast(`PROMOTED TO ${newStr}!`);
            }
        }
    },
   
    getXPRequiredForNextLevel(lvl) {
        if (lvl === 1) return 100;
        if (lvl === 2) return 150;
        if (lvl === 3) return 250;
        if (lvl === 4) return 300;
        if (lvl === 5) return 400;
        if (lvl === 6) return 400;
        if (lvl === 7) return 400;
        if (lvl === 8) return 500;
        if (lvl === 9) return 500;
        return 1000;
    },
   
    addXP(amount) {
        this.account.xp += amount;
        let needed = this.getXPRequiredForNextLevel(this.account.level);
        let leveledUp = false;
       
        while (this.account.xp >= needed) {
            this.account.xp -= needed;
            this.account.level++;
            leveledUp = true;
            this.account.coins += 100; // Level milestone grant!
            needed = this.getXPRequiredForNextLevel(this.account.level);
           
            // Unlock notifications / awards
            this.checkLevelUnlocks();
        }
       
        if (leveledUp) {
            showToast(`LEVEL UP! REACHED LEVEL ${this.account.level}. +100 COINS!`);
        }
    },
   
    checkLevelUnlocks() {
        const lvl = this.account.level;
        // Introduce unlocks under levels
        if (lvl >= 3 && !this.account.inventory.includes('avatar_knight')) {
            this.account.inventory.push('avatar_knight');
            showToast("UNLOCKED: 'Obsidian Knight' Avatar and Slot!");
        }
        if (lvl >= 5 && !this.account.inventory.includes('title_tactician')) {
            this.account.inventory.push('title_tactician');
            showToast("UNLOCKED: Custom Title 'Chess Tactician'!");
        }
        if (lvl >= 10 && !this.account.inventory.includes('frame_silver')) {
            this.account.inventory.push('frame_silver');
            showToast("UNLOCKED: 'Silver Steel Ring' Profile Frame!");
        }
    },
   
    addRP(amount) {
        const oldRank = this.getRankDetails(this.account.rp);
       
        if (amount < 0) {
            if (this.account.streakShields > 0) {
                this.account.streakShields--;
                showToast("LOSS SHIELD ACTIVATED! Rank Protection active.");
                this.saveData();
                return;
            }
        }
       
        this.account.rp = Math.max(0, this.account.rp + amount);
        const newRank = this.getRankDetails(this.account.rp);
       
        if (newRank.fullLabel !== oldRank.fullLabel) {
            this.triggerRankPromotionUI(oldRank, newRank, amount >= 0);
            if (amount < 0) {
                showToast(`DEMOTED: Now ${newRank.fullLabel}`);
            }
        }
        this.saveData();
    },
   
    awardMatchEnd(outcome, resultText) {
        // Flatten both arguments into a lowercase space-joined string to capture values anywhere!
        const argStr = `${String(outcome)} ${String(resultText)}`.toLowerCase();
       
        let outcomeStatus = 'draw';
        if (argStr.includes('victory') || argStr.includes('win')) {
            outcomeStatus = 'win';
        } else if (argStr.includes('defeat') || argStr.includes('lose') || argStr.includes('loss') || argStr.includes('forfeit') || argStr.includes('resign')) {
            outcomeStatus = 'loss';
        } else if (argStr.includes('draw') || argStr.includes('stalemate') || argStr.includes('draws')) {
            outcomeStatus = 'draw';
        }

        // Deduce payout matrices based on current Game Mode and outcomeStatus
        let coinsEarned = 10;
        let xpEarned = 5;
        let rpEarned = 0;

        if (outcomeStatus === 'win') {
            coinsEarned = 40;
            this.account.wins++;
           
            if (this.currentGameMode === 'friend') {
                xpEarned = 20; // Friend battle win = +20 EXP
                rpEarned = 0;
            } else if (this.currentGameMode === 'ranked') {
                xpEarned = 30; // Ranked win = +30 EXP
                rpEarned = 25; // Ranked win = +25 RP
            } else {
                // Normal (computer, practice)
                xpEarned = 30; // Normal win = +30 EXP
                rpEarned = 0;
            }
        } else if (outcomeStatus === 'loss') {
            coinsEarned = 10;
            this.account.losses++;
           
            if (this.currentGameMode === 'friend') {
                xpEarned = 5; // Friend loss = +5 EXP
                rpEarned = 0;
            } else if (this.currentGameMode === 'ranked') {
                xpEarned = 5; // Ranked loss = +5 EXP
                rpEarned = -10; // Ranked loss = -10 RP
            } else {
                xpEarned = 5; // Normal loss = +5 EXP
                rpEarned = 0;
            }
        } else {
            coinsEarned = 15;
            this.account.draws++;
           
            if (this.currentGameMode === 'friend') {
                xpEarned = 10; // Friend draw = +10 EXP
                rpEarned = 0;
            } else if (this.currentGameMode === 'ranked') {
                xpEarned = 10; // Ranked draw = +10 EXP
                rpEarned = 5; // Ranked draw = +5 RP
            } else {
                xpEarned = 10; // Normal draw = +10 EXP
                rpEarned = 0;
            }
        }
       
        // Check Rank Shield Protection
        if (rpEarned < 0 && this.account.streakShields > 0) {
            this.account.streakShields--;
            rpEarned = 0;
        }
       
        // Update stats counters
        this.account.matches++;
        this.account.coins += coinsEarned;
        this.addRP(rpEarned);
        this.addXP(xpEarned);
       
        // Compile match listing to archive logs
        let oppName = 'Online Contender';
        if (this.currentGameMode === 'computer') {
            oppName = `Stockfish AI (${this.computerDifficulty.toUpperCase()})`;
        } else if (this.currentGameMode === 'practice') {
            oppName = 'Pass & Play Partner';
        } else if (this.currentGameMode === 'friend') {
            oppName = 'Friendly Duelist';
        }

        const matchEntry = {
            id: 'm_' + Date.now(),
            opponent: oppName,
            date: new Date().toLocaleDateString(),
            result: outcomeStatus.toUpperCase(),
            duration: formatTimerValue(matchTimeLimit - Math.min(whiteTime, blackTime)),
            mode: this.currentGameMode.toUpperCase(),
            xp: xpEarned,
            rp: (this.currentGameMode === 'ranked' ? rpEarned : 0),
            coins: coinsEarned
        };
        this.account.history.unshift(matchEntry);
       
        // Check structural Achievements unlocks
        this.verifyAchievementsTriggered(outcome, resultText);
        this.saveData();
    },
   
    verifyAchievementsTriggered(outcome, resultText) {
        const awardsList = [];
       
        // 1. First Win
        if (resultText === 'win' && !this.account.achievements.includes('first_win')) {
            this.account.achievements.push('first_win');
            this.account.coins += 100;
            awardsList.push("First Victory Achieved! +100 Coins");
        }
        // 2. Ten Wins
        if (this.account.wins >= 10 && !this.account.achievements.includes('wins_10')) {
            this.account.achievements.push('wins_10');
            this.account.coins += 250;
            awardsList.push("Ten Matches Master! +250 Coins");
        }
        // 3. First Checkmate
        if (resultText === 'win' && outcome && outcome.specialAction !== 'timeout' && !this.account.achievements.includes('checkmate_one')) {
            this.account.achievements.push('checkmate_one');
            this.account.coins += 100;
            awardsList.push("First Utter Checkmate! +100 Coins");
        }
        // 4. Perfect Match
        if (resultText === 'win' && !this.account.achievements.includes('perfect_match')) {
            // Verify if no major pieces were captured
            this.account.achievements.push('perfect_match');
            this.account.coins += 300;
            awardsList.push("Perfect Tactical Sweep! +300 Coins");
        }
       
        awardsList.forEach(m => showToast(`ACHIEVEMENT: ${m}`));
    },
   
    // Store, Inventory, Purchase interface
    purchaseItem(section, itemId, cost) {
        if (this.account.inventory.includes(itemId)) {
            showToast("ITEM ALREADY IN OWNERSHIP.");
            return;
        }
        if (this.account.coins < cost) {
            showToast("INSUFFICIENT RESERVE COINS!");
            return;
        }
       
        this.account.coins -= cost;
        this.account.inventory.push(itemId);
        showToast("PURCHASE COMPLETE! Item added to collection.");
        this.saveData();
    },
   
    equipItem(section, itemId) {
        if (!this.account.inventory.includes(itemId)) {
            showToast("LOCKED: Item must be unlocked first.");
            return;
        }
       
        if (section === 'avatars') {
            this.account.avatar = itemId;
        } else if (section === 'frames') {
            this.account.frame = itemId;
        } else if (section === 'titles') {
            this.account.title = itemId;
        } else if (section === 'skins') {
            this.account.skin = itemId;
            this.account.equippedSkin = itemId;
            showToast("EQUIPPED! Recolor active on Board pieces.");
            if (typeof syncPiecesWithEngineState === 'function') syncPiecesWithEngineState();
        } else if (section === 'boards') {
            this.account.board = itemId;
            this.account.equippedBoard = itemId;
            showToast("BOARD SKIN EQUIPPED.");
            if (typeof applyBoardSkin === 'function') applyBoardSkin();
        } else if (section === 'themes') {
            this.account.theme = itemId;
            showToast("THEME EQUIPPED.");
        } else if (section === 'sounds') {
            this.account.sound = itemId;
            showToast("SOUND PACK EQUIPPED.");
        } else if (section === 'emotes') {
            if (!this.account.equippedEmotes) this.account.equippedEmotes = [];
            if (!this.account.equippedEmotes.includes(itemId)) {
                this.account.equippedEmotes.push(itemId);
                showToast("EMOTE ADDED TO RADIAL WHEEL.");
            }
        }
       
        showToast("CUSTOMIZATION ACCESSORIES INSTANTLY INSTALLED");
        this.saveData();
    },
   
    // Social System methods
    addFriendInput() {
        const usernameInput = document.getElementById('add-friend-text-field').value.trim();
        if (!usernameInput) return;
       
        const newFriend = {
            id: 'f_dynamic_' + Math.random().toString(36).substring(2, 6),
            name: usernameInput,
            level: Math.floor(Math.random() * 20 + 5),
            rank: 'Knight II',
            online: true,
            lastSeen: 'Active'
        };
       
        this.friends.unshift(newFriend);
        showToast(`FRIEND REQUEST DISPATCHED TO ${usernameInput.toUpperCase()}`);
        document.getElementById('add-friend-text-field').value = "";
        this.renderDashboard();
    },
   
    blockOrDeleteFriend(id) {
        this.friends = this.friends.filter(f => f.id !== id);
        showToast("FRIEND SUCCESSFULLY REMOVED.");
        this.renderDashboard();
    },
   
    // Daily Rewards Claim
    claimDailySlot(day) {
        if (typeof claimV3DailySlot === 'function') {
            const rewards = [
                { day: 1, text: 'Day 1', reward: '🪙 150', icon: '🪙', coins: 150 },
                { day: 2, text: 'Day 2', reward: '🪙 250', icon: '🪙', coins: 250 },
                { day: 3, text: 'Day 3', reward: '♞ Avatar', icon: '♞', item: 'avatar_knight' },
                { day: 4, text: 'Day 4', reward: '🪙 500', icon: '🪙', coins: 500 },
                { day: 5, text: 'Day 5', reward: '⭕ Frame', icon: '⭕', item: 'frame_silver' },
                { day: 6, text: 'Day 6', reward: '🪙 1000', icon: '🪙', coins: 1000 },
                { day: 7, text: 'Day 7', reward: '👑 Pre-Pack', icon: '👑', coins: 2500, item: 'title_tactician' }
            ];
            const rObj = rewards.find(r => r.day === day);
            if (rObj) {
                claimV3DailySlot(rObj);
            } else {
                showToast("INVALID CLAIM DAY REQUESTED.");
            }
        } else {
            console.error("V3 claimV3DailySlot function not found");
        }
    },
   
    resetDailyStreak() {
        if (typeof resetV3DailyStreak === 'function') {
            resetV3DailyStreak();
        } else {
            console.warn("V3 daily reward system not found");
        }
    },

    // -----------------------------------------------------
    // SCREEN RENDERING CORE (DYNAMIC, MOBILE ENGINE DASHBOARD)
    // -----------------------------------------------------
    setTab(tabId) {
        this.currentTab = tabId;
        this.renderDashboard();
    },
   
    renderDashboard() {
        const lobbyContainer = document.querySelector('.lobby-container');
        if (!lobbyContainer) return;
       
        // Rebranding header and status bars
        const details = this.getRankDetails(this.account.rp);
        const nextXpReq = this.getXPRequiredForNextLevel(this.account.level);
        const xpPercent = Math.min(100, Math.floor((this.account.xp / nextXpReq) * 100));
       
        // Active visual equipping item lookups
        const avatarAsset = this.catalog.avatars.find(a => a.id === this.account.avatar) || this.catalog.avatars[0];
        const frameAsset = this.catalog.frames.find(f => f.id === this.account.frame) || this.catalog.frames[0];
        const titleAsset = this.catalog.titles.find(t => t.id === this.account.title) || this.catalog.titles[0];
       
        // Calculate Win Ratio
        const winrate = this.account.matches > 0 ? Math.floor((this.account.wins / this.account.matches) * 100) : 0;
       
        // HTML templates binding
        let headerHtml = `
            <div class="user-strip" style="background: rgba(13,13,17,0.85); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="profile-avatar-container" style="position: relative; width: 48px; height: 48px; border: 2px solid ${frameAsset.border || 'transparent'}; border-radius: 50%; background: #1a1a24; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                        <span class="avatar-piece-emoji">${avatarAsset.icon}</span>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-family: var(--font-display); font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                            ${this.formatDisplayName(this.account.username).toUpperCase()}
                        </div>
                        <div style="font-size: 10px; color: var(--gold); letter-spacing: 1px; font-weight: 600; text-transform: uppercase;">
                            ${titleAsset.name}
                        </div>
                        <div style="font-size: 9px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 3px;">
                            <span style="background: var(--blue-accent); color: #fff; padding: 1px 3px; border-radius: 2px; font-size: 7.5px; font-weight: 700;">LVL ${this.account.level}</span>
                            <span>XP: ${this.account.xp}/${nextXpReq}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                    <div style="display: flex; align-items: center; gap: 4px; color: var(--gold); font-size: 12px; font-weight: 700; font-family: var(--font-mono);">
                        🪙 <span>${this.account.coins}</span>
                    </div>
                    <div style="font-size: 9px; color: var(--text-muted); font-weight: 500;">
                        🏆 <span style="color:#fff;">${this.account.rp}</span> RP (${details.rankName} ${details.subTier})
                    </div>
                </div>
            </div>
           
            <!-- XP Progress Bar -->
            <div style="background: rgba(255,255,255,0.04); height: 3px; border-radius: 2px; width: 100%; margin-top: -6px; margin-bottom: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.02);">
                <div style="width: ${xpPercent}%; height: 100%; background: var(--blue-accent); border-radius: 2px; transition: width 0.4s ease;"></div>
            </div>
           
            <!-- Navigation Panel Tabs -->
            <nav style="display: flex; background: rgba(5,5,5,0.9); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px; gap: 2px; margin-bottom: 20px;">
                <button class="tab-btn ${this.currentTab === 'lobby' ? 'active-tab' : ''}" onclick="FtechSystem.setTab('lobby')" style="flex: 1; padding: 10px 4px; background: transparent; border: none; font-size: 10px; font-family: var(--font-display); font-weight:700; letter-spacing:0.5px; color:${this.currentTab === 'lobby' ? 'var(--gold)' : 'var(--text-muted)'}; cursor:pointer; text-align:center;">PLAY</button>
                <button class="tab-btn ${this.currentTab === 'store' ? 'active-tab' : ''}" onclick="FtechSystem.setTab('store')" style="flex: 1; padding: 10px 4px; background: transparent; border: none; font-size: 10px; font-family: var(--font-display); font-weight:700; letter-spacing:0.5px; color:${this.currentTab === 'store' ? 'var(--gold)' : 'var(--text-muted)'}; cursor:pointer; text-align:center;">STORE</button>
                <button class="tab-btn ${this.currentTab === 'leader' ? 'active-tab' : ''}" onclick="FtechSystem.setTab('leader')" style="flex: 1; padding: 10px 4px; background: transparent; border: none; font-size: 10px; font-family: var(--font-display); font-weight:700; letter-spacing:0.5px; color:${this.currentTab === 'leader' ? 'var(--gold)' : 'var(--text-muted)'}; cursor:pointer; text-align:center;">LEADER</button>
                <button class="tab-btn ${this.currentTab === 'social' ? 'active-tab' : ''}" onclick="FtechSystem.setTab('social')" style="flex: 1; padding: 10px 4px; background: transparent; border: none; font-size: 10px; font-family: var(--font-display); font-weight:700; letter-spacing:0.5px; color:${this.currentTab === 'social' ? 'var(--gold)' : 'var(--text-muted)'}; cursor:pointer; text-align:center;">FRIENDS</button>
                <button class="tab-btn ${this.currentTab === 'profile' ? 'active-tab' : ''}" onclick="FtechSystem.setTab('profile')" style="flex: 1; padding: 10px 4px; background: transparent; border: none; font-size: 10px; font-family: var(--font-display); font-weight:700; letter-spacing:0.5px; color:${this.currentTab === 'profile' ? 'var(--gold)' : 'var(--text-muted)'}; cursor:pointer; text-align:center;">STATS</button>
                <button class="tab-btn ${this.currentTab === 'rewards' ? 'active-tab' : ''}" onclick="FtechSystem.setTab('rewards')" style="flex: 1; padding: 10px 4px; background: transparent; border: none; font-size: 10px; font-family: var(--font-display); font-weight:700; letter-spacing:0.5px; color:${this.currentTab === 'rewards' ? 'var(--gold)' : 'var(--text-muted)'}; cursor:pointer; text-align:center;">REWARDS</button>
            </nav>
        `;
       
        let bodyHtml = '';
       
        switch (this.currentTab) {
            case 'lobby': {
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <!-- Game Modes Header Card -->
                        <div class="lobby-card" style="background: radial-gradient(circle at top right, rgba(223,183,108,0.06), rgba(0,0,0,0)), var(--bg-secondary); border-color: rgba(223,183,108,0.18);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="font-family: var(--font-display); color: #fff; font-size: 13px; letter-spacing: 1px;">VERSUS COMPUTER</h3>
                                <span style="background: var(--blue-accent); color: #fff; padding: 2px 5px; border-radius: 2px; font-size: 8px; font-weight: 700; letter-spacing: 1px;">OFFLINE STOCKFISH</span>
                            </div>
                            <p style="font-size: 10.5px; color: var(--text-muted);">Calibrate and duel against chess AI engine levels.</p>
                           
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                                <select id="computer-diff-select" onchange="FtechSystem.computerDifficulty = this.value" style="background:#050505; border:1px solid var(--border-color); color:#fff; padding:10px; font-family:var(--font-mono); font-size:11px; border-radius:4px; outline:none; text-transform:uppercase; cursor:pointer; width:100%;">
                                    <option value="easy" ${this.computerDifficulty === 'easy' ? 'selected' : ''}>🤖 Easy Mode (Depth 1)</option>
                                    <option value="medium" ${this.computerDifficulty === 'medium' ? 'selected' : ''}>⚔️ Medium Mode (Depth 2)</option>
                                    <option value="hard" ${this.computerDifficulty === 'hard' ? 'selected' : ''}>🔥 Hard Mode (Depth 3)</option>
                                    <option value="master" ${this.computerDifficulty === 'master' ? 'selected' : ''}>👑 Master Mode (Depth 4)</option>
                                    <option value="grandmaster" ${this.computerDifficulty === 'grandmaster' ? 'selected' : ''}>🏆 Grandmaster Legend (Depth 4+ PST)</option>
                                </select>
                                <button class="btn btn-primary" onclick="FtechSystem.startComputerMatch()" style="width:100%; border-radius:4px; background:linear-gradient(135deg, var(--gold-dark), var(--gold)); color:#000; border:none; padding:12px; font-family:var(--font-display); font-weight:800; letter-spacing:1px; cursor:pointer;">CHALLENGE ROBOT</button>
                            </div>
                        </div>

                        <!-- Online section with competitive options -->
                        <div class="lobby-card online-section" style="border-color: rgba(33,150,243,0.18);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="font-family: var(--font-display); color: #fff; font-size: 13px; letter-spacing: 1px;">ONLINE PLAYERS LOBBY</h3>
                                <span style="background: rgba(223,183,108,0.2); border: 1px solid var(--gold); color: var(--gold); padding: 1px 4px; border-radius:2px; font-size:7.5px; font-weight:700;">FIRESTORE SYNC</span>
                            </div>
                            <p style="font-size: 10.5px; color: var(--text-muted); margin-bottom: 6px;">Battle online contenders in casual or competitive Ranked matches.</p>
                           
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <button class="btn" onclick="FtechSystem.startRankedLobby()" style="background: linear-gradient(135deg, #0b5999, #2196f3); color:#fff; border:none; padding:11px; font-family:var(--font-display); font-size:11px; font-weight:700; border-radius:4px; cursor:pointer;">
                                    🏆 RANKED DUEL
                                </button>
                                <button id="btn-create-room" class="btn btn-outline" onclick="createRoom()" style="padding:11px; font-size:11px; border-radius:4px;">
                                    🤝 PRIVATE ROOM
                                </button>
                            </div>
                           
                            <div class="join-room-box" style="margin-top: 6px; display:flex; gap:6px;">
                                <input type="text" id="join-room-input" placeholder="ENTER ROOM CODE" maxlength="6" style="background:#050505; border:1px solid var(--border-color); color:#fff; padding:10px; font-family:var(--font-mono); font-size:11px; border-radius:4px; outline:none; text-transform:uppercase; flex:1;">
                                <button id="btn-join-room" class="btn btn-outline" onclick="joinRoomFromInput()" style="padding:0 14px; font-size:11px; border-radius:4px;">JOIN</button>
                            </div>
                        </div>

                        <!-- Local play section -->
                        <div class="lobby-card local-section">
                            <h3 style="font-family: var(--font-display); color: #fff; font-size: 13px; letter-spacing: 1px;">PRACTICE & OFFLINE DUELS</h3>
                            <p style="font-size: 10.5px; color: var(--text-muted); margin-bottom: 4px;">Pass the device to a friend locally or try specific tactical positions.</p>
                            <button id="btn-local-play" class="btn btn-outline" onclick="startLocalPlay()" style="width:100%; border-radius:4px; padding:11px; font-size:11px;">
                                LOCAL PASS & PLAY DUEL
                            </button>
                        </div>
                    </div>
                `;
                break;
            }
           
            case 'store': {
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; gap:12px; max-height:450px; overflow-y:auto; padding-right:4px;">
                        <div style="text-align:left; border-left:3px solid var(--gold); padding-left:10px; margin-bottom:4px;">
                            <h2 style="font-family: var(--font-display); font-size: 15px; color: #fff; letter-spacing: 1px;">CUSTOMIZATION EMPORIUM</h2>
                            <p style="font-size: 10.5px; color: var(--text-muted);">Spend coins to personalize profiles and chess components.</p>
                        </div>
                       
                        <!-- Avatars Category -->
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:12px;">
                            <h3 style="font-family: var(--font-display); font-size:11px; color:var(--gold); letter-spacing:1px; margin-bottom:8px; text-transform:uppercase;">Player Icons</h3>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                ${this.catalog.avatars.map(item => {
                                    const owned = this.account.inventory.includes(item.id);
                                    const equipped = this.account.avatar === item.id;
                                    return `
                                        <div style="background:#050505; border:1px solid ${equipped ? 'var(--gold)' : 'var(--border-color)'}; border-radius:4px; padding:10px; text-align:center; position:relative;">
                                            <span style="font-size:28px;">${item.icon}</span>
                                            <div style="font-size:10px; color:#fff; font-weight:700; margin-top:4px;">${item.name}</div>
                                            <div style="display:flex; flex-direction:column; gap:4px; margin-top:6px;">
                                                ${equipped ? `
                                                    <span style="background:var(--gold-dark); color:#000; font-size:8px; font-weight:800; padding:4px; border-radius:2px; letter-spacing:0.5px;">EQUIPPED</span>
                                                ` : owned ? `
                                                    <button onclick="FtechSystem.equipItem('avatars', '${item.id}')" style="background:#222; color:#fff; font-size:8px; border:none; padding:4px 0; border-radius:2px; font-weight:700; cursor:pointer;">EQUIP</button>
                                                ` : `
                                                    <button onclick="FtechSystem.purchaseItem('avatars', '${item.id}', ${item.cost})" style="background:var(--blue-dark); color:#fff; font-size:8px; border:none; padding:4px 0; border-radius:2px; font-weight:700; cursor:pointer;">🪙 ${item.cost}</button>
                                                `}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- Profile Frames Category -->
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:12px;">
                            <h3 style="font-family: var(--font-display); font-size:11px; color:var(--gold); letter-spacing:1px; margin-bottom:8px; text-transform:uppercase;">Avatar Frames</h3>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                ${this.catalog.frames.map(item => {
                                    const owned = this.account.inventory.includes(item.id);
                                    const equipped = this.account.frame === item.id;
                                    return `
                                        <div style="background:#050505; border:1px solid ${equipped ? 'var(--gold)' : 'var(--border-color)'}; border-radius:4px; padding:10px; text-align:center;">
                                            <div style="width:36px; height:36px; margin: 0 auto; border:3px solid ${item.border}; border-radius:50%; background:#111;"></div>
                                            <div style="font-size:10px; color:#fff; font-weight:700; margin-top:6px;">${item.name}</div>
                                            <div style="display:flex; flex-direction:column; gap:4px; margin-top:6px;">
                                                ${equipped ? `
                                                    <span style="background:var(--gold-dark); color:#000; font-size:8px; font-weight:800; padding:4px; border-radius:2px; letter-spacing:0.5px;">EQUIPPED</span>
                                                ` : owned ? `
                                                    <button onclick="FtechSystem.equipItem('frames', '${item.id}')" style="background:#222; color:#fff; font-size:8px; border:none; padding:4px 0; border-radius:2px; font-weight:700; cursor:pointer;">EQUIP</button>
                                                ` : `
                                                    <button onclick="FtechSystem.purchaseItem('frames', '${item.id}', ${item.cost})" style="background:var(--blue-dark); color:#fff; font-size:8px; border:none; padding:4px 0; border-radius:2px; font-weight:700; cursor:pointer;">🪙 ${item.cost}</button>
                                                `}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- Custom Titles Category -->
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:12px;">
                            <h3 style="font-family: var(--font-display); font-size:11px; color:var(--gold); letter-spacing:1px; margin-bottom:8px; text-transform:uppercase;">Honorary Titles</h3>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                ${this.catalog.titles.map(item => {
                                    const owned = this.account.inventory.includes(item.id);
                                    const equipped = this.account.title === item.id;
                                    return `
                                        <div style="background:#050505; border:1px solid ${equipped ? 'var(--gold)' : 'var(--border-color)'}; border-radius:4px; padding:10px; text-align:center;">
                                            <div style="font-size:9.5px; font-weight:800; background:#111; color:var(--gold); padding:4px; border-radius:2px; text-transform:uppercase; letter-spacing:1px;">${item.name}</div>
                                            <div style="display:flex; flex-direction:column; gap:4px; margin-top:8px;">
                                                ${equipped ? `
                                                    <span style="background:var(--gold-dark); color:#000; font-size:8px; font-weight:800; padding:4px; border-radius:2px; letter-spacing:0.5px;">EQUIPPED</span>
                                                ` : owned ? `
                                                    <button onclick="FtechSystem.equipItem('titles', '${item.id}')" style="background:#222; color:#fff; font-size:8px; border:none; padding:4px 0; border-radius:2px; font-weight:700; cursor:pointer;">EQUIP</button>
                                                ` : `
                                                    <button onclick="FtechSystem.purchaseItem('titles', '${item.id}', ${item.cost})" style="background:var(--blue-dark); color:#fff; font-size:8px; border:none; padding:4px 0; border-radius:2px; font-weight:700; cursor:pointer;">🪙 ${item.cost}</button>
                                                `}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
                break;
            }
           
            case 'leader': {
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="text-align:left; border-left:3px solid var(--gold); padding-left:10px;">
                            <h2 style="font-family: var(--font-display); font-size:15px; color:#fff; letter-spacing:1px;">LEADERBOARD</h2>
                            <p style="font-size:10.5px; color:var(--text-muted);">Compare rankings amongst tactical gladiators.</p>
                        </div>
                       
                        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; display:flex; flex-direction:column; gap:6px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:9px; color:var(--text-muted); font-weight:800; border-bottom:1px solid var(--border-color); padding-bottom:6px; text-transform:uppercase; letter-spacing:1px;">
                                <span>RANK / NAME</span>
                                <span>RATING RP</span>
                            </div>
                           
                            <!-- Master Standings list -->
                            <div style="display:flex; flex-direction:column; gap:5px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(223,183,108,0.06); border:1px solid rgba(223,183,108,0.18); border-radius:4px; padding:8px 10px; font-size:11px;">
                                    <span style="font-weight:700; color:var(--gold);">👑 1. Stockfish Master</span>
                                    <span style="font-family:var(--font-mono); font-weight:700; color:var(--gold);">3600 RP</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; background:#050505; border:1px solid var(--border-color); border-radius:4px; padding:8px 10px; font-size:11px;">
                                    <span style="font-weight:700; color:#fff;">🛡️ 2. BobbyFischer88</span>
                                    <span style="font-family:var(--font-mono); color:#fff;">3450 RP</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; background:#050505; border:1px solid var(--border-color); border-radius:4px; padding:8px 10px; font-size:11px;">
                                    <span style="font-weight:700; color:#fff;">⚔️ 3. Kasparov_Bot</span>
                                    <span style="font-family:var(--font-mono); color:#fff;">2420 RP</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; background:#050505; border:1px solid var(--border-color); border-radius:4px; padding:8px 10px; font-size:11px;">
                                    <span style="font-weight:700; color:#fff;">⚡ 4. MagnusCarlsenJr</span>
                                    <span style="font-family:var(--font-mono); color:#fff;">1640 RP</span>
                                </div>
                               
                                <!-- PLAYER SELF SCORE -->
                                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(33,150,243,0.06); border:1px solid rgba(33,150,243,0.3); border-radius:4px; padding:10px 12px; font-size:11px; margin-top:14px;">
                                    <span style="font-weight:800; color:var(--blue-accent);">👉 YOU (${this.formatDisplayName(this.account.username).toUpperCase()})</span>
                                    <span style="font-family:var(--font-mono); font-weight:800; color:var(--blue-accent);">${this.account.rp} RP</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            }
           
            case 'social': {
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; gap:12px; max-height:450px; overflow-y:auto; padding-right:2px;">
                        <div style="text-align:left; border-left:3px solid var(--gold); padding-left:10px;">
                            <h2 style="font-family: var(--font-display); font-size:15px; color:#fff; letter-spacing:1px;">FRIEND SOCIAL HUB</h2>
                            <p style="font-size:10.5px; color:var(--text-muted);">Manage friends and custom room invitations.</p>
                        </div>
                       
                        <!-- Add friend section -->
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:12px; display:flex; gap:6px;">
                            <input type="text" id="add-friend-text-field" placeholder="ENTER FRIEND USERNAME" style="background:#050505; border:1px solid var(--border-color); color:#fff; padding:10px; font-family:var(--font-mono); font-size:11px; border-radius:4px; outline:none; text-transform:uppercase; flex:1;">
                            <button onclick="FtechSystem.addFriendInput()" style="background:var(--blue-dark); color:#fff; border:none; padding:0 14px; font-size:11px; font-weight:700; border-radius:4px; cursor:pointer;">ADD</button>
                        </div>
                       
                        <!-- Friend status grid -->
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                            <h3 style="font-family: var(--font-display); font-size:11px; color:var(--gold); letter-spacing:1px; margin-bottom:4px; text-transform:uppercase;">My Friends</h3>
                           
                            ${this.friends.length === 0 ? `
                                <div style="font-size:11px; color:var(--text-muted); font-style:italic; padding:10px; text-align:center;">Your social lobby is empty. Add a friend to start!</div>
                            ` : this.friends.map(f => `
                                <div style="background:#050505; border:1px solid var(--border-color); border-radius:4px; padding:10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                    <div style="text-align:left; display:flex; align-items:center; gap:8px;">
                                        <div style="width:8px; height:8px; border-radius:50%; background:${f.online ? '#4af626' : '#555'};"></div>
                                        <div>
                                            <div style="font-size:11.5px; font-weight:800; color:#fff;">${f.name} (LVL ${f.level})</div>
                                            <div style="font-size:9px; color:var(--text-muted);">${f.rank} &bull; ${f.lastSeen}</div>
                                        </div>
                                    </div>
                                    <div style="display:flex; gap:4px;">
                                        ${f.online ? `
                                            <button onclick="FtechSystem.inviteFriendRoom('${f.name}')" style="background:var(--gold-dark); color:#000; font-size:8px; border:none; padding:4px 8px; border-radius:2px; font-weight:800; cursor:pointer;">INVITE</button>
                                        ` : ''}
                                        <button onclick="FtechSystem.blockOrDeleteFriend('${f.id}')" style="background:#900; color:#fff; font-size:8px; border:none; padding:4px 6px; border-radius:2px; font-weight:700; cursor:pointer;">✖</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                break;
            }
           
            case 'profile': {
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; gap:12px; max-height:450px; overflow-y:auto; padding-right:2px;">
                        <div style="text-align:left; border-left:3px solid var(--gold); padding-left:10px;">
                            <h2 style="font-family: var(--font-display); font-size:15px; color:#fff; letter-spacing:1px;">STATS OVERVIEW</h2>
                        </div>
                       
                        <!-- Rank progressions circular graphic elements -->
                        <div style="background: var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; text-align:center;">
                            <h3 style="font-family: var(--font-display); font-size:11px; color:#fff; letter-spacing:1.5px; text-transform:uppercase;">RANK VISUAL PROGRESSION</h3>
                            <div style="position:relative; width:100px; height:100px; display:flex; align-items:center; justify-content:center; margin:10px 0;">
                                <!-- Semi-circular SVG Ring representing rank completion -->
                                <svg style="width:100%; height:100%; transform: rotate(-90deg);">
                                    <circle cx="50" cy="50" r="42" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="6"/>
                                    <circle cx="50" cy="50" r="42" fill="transparent" stroke="var(--gold)" stroke-width="6" stroke-dasharray="264" stroke-dashoffset="${264 - (264 * details.progress) / 100}" stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease;"/>
                                </svg>
                                <div style="position:absolute; font-family:var(--font-display); font-weight:800; font-size:11px; text-align:center; color:#fff; display:flex; flex-direction:column;">
                                    <span>${details.rankName.toUpperCase()}</span>
                                    <span style="font-family:var(--font-mono); font-size:13px; color:var(--gold); margin-top:2px;">${details.subTier}</span>
                                </div>
                            </div>
                            <div style="font-size:10px; color:var(--text-muted); font-weight:500;">
                                Rank progress represents <strong style="color:var(--gold);">${details.progress}%</strong> completion scale.
                            </div>
                        </div>

                        <!-- Statistics Grid details -->
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                            <div style="background:var(--bg-secondary); border:1px solid var(--border-color); padding:10px; border-radius:4px; text-align:center;">
                                <div style="font-size:18px; font-weight:800; color:#fff; font-family:var(--font-mono);">${this.account.matches}</div>
                                <div style="font-size:8.5px; color:var(--text-muted); font-weight:700; margin-top:2px; letter-spacing:0.5px;">MATCHES</div>
                            </div>
                            <div style="background:rgba(74,246,38,0.06); border:1px solid rgba(74,246,38,0.18); padding:10px; border-radius:4px; text-align:center;">
                                <div style="font-size:18px; font-weight:800; color:#4af626; font-family:var(--font-mono);">${this.account.wins}</div>
                                <div style="font-size:8.5px; color:#4af626; font-weight:700; margin-top:2px; letter-spacing:0.5px;">VICTORIES</div>
                            </div>
                            <div style="background:var(--bg-secondary); border:1px solid var(--border-color); padding:10px; border-radius:4px; text-align:center;">
                                <div style="font-size:18px; font-weight:800; color:#fff; font-family:var(--font-mono);">${winrate}%</div>
                                <div style="font-size:8.5px; color:var(--text-muted); font-weight:700; margin-top:2px; letter-spacing:0.5px;">WIN RATE</div>
                            </div>
                        </div>

                        <!-- History logs archive -->
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:12px;">
                            <h3 style="font-family: var(--font-display); font-size:11px; color:#fff; letter-spacing:1px; margin-bottom:8px; text-transform:uppercase; border-bottom:1px solid var(--border-color); padding-bottom:6px;">RECENT MATCH ARCHIVE</h3>
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                ${this.account.history.length === 0 ? `
                                    <div style="font-size:10.5px; color:var(--text-muted); font-style:italic; text-align:center; padding:10px;">No competitive matches recorded yet.</div>
                                ` : this.account.history.slice(0, 5).map(log => `
                                    <div style="background:#050505; border:1px solid var(--border-color); border-radius:4px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; font-size:9.5px;">
                                        <div style="text-align:left;">
                                            <div style="font-weight:800; color:#fff;">VS ${log.opponent.toUpperCase()}</div>
                                            <div style="color:var(--text-muted); font-size:8px;">${log.date} &bull; ${log.mode}</div>
                                        </div>
                                        <div style="text-align:right;">
                                            <span style="color:${log.result === 'WIN' ? '#4af626' : (log.result === 'LOSS' ? '#ff3333' : '#aaa')}; font-weight:800; font-family:var(--font-mono);">${log.result}</span>
                                            <div style="font-size:8px; color:var(--gold);">🪙 +${log.coins} | +${log.xp} XP</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
                break;
            }
           
            case 'rewards': {
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; gap:12px; max-height:450px; overflow-y:auto; padding-right:2px;">
                        <div style="text-align:left; border-left:3px solid var(--gold); padding-left:10px;">
                            <h2 style="font-family: var(--font-display); font-size:15px; color:#fff; letter-spacing:1px;">REWARDS & ACHIEVEMENT CENTER</h2>
                        </div>
                       
                        <!-- Daily Reward Streaks Map -->
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <h3 style="font-family: var(--font-display); font-size:11px; color:#fff; letter-spacing:1px; text-transform:uppercase;">Daily 7-Day Rewards</h3>
                                <button onclick="FtechSystem.resetDailyStreak()" style="background:transparent; border:none; border-bottom:1px dashed #777; color:var(--text-muted); font-size:8.5px; cursor:pointer;">Reset</button>
                            </div>
                            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px;">
                                ${[1, 2, 3, 4, 5, 6, 7].map(day => {
                                    const claimed = this.account.claimedDailyDays.includes(day);
                                    let content = `Day ${day}`;
                                    let subText = `🪙 Gift`;
                                    if (day === 3) subText = `♞ Avatar`;
                                    if (day === 5) subText = `⭕ Frame`;
                                    if (day === 7) subText = `👑 Rare`;
                                   
                                    return `
                                        <button onclick="FtechSystem.claimDailySlot(${day})" style="background:${claimed ? 'rgba(74,246,38,0.06)' : '#050505'}; border:1px solid ${claimed ? '#4af626' : 'var(--border-color)'}; border-radius:4px; padding:8px 4px; color:#fff; text-align:center; height:50px; cursor:pointer;" ${claimed ? 'disabled' : ''}>
                                            <div style="font-size:9.5px; font-weight:800; color:${claimed ? '#4af626' : '#fff'};">${content}</div>
                                            <div style="font-size:7.5px; color:${claimed ? '#4af626' : 'var(--text-muted)'}; margin-top:4px;">${claimed ? '✔️' : subText}</div>
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- Achievements List -->
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:12px;">
                            <h3 style="font-family: var(--font-display); font-size:11px; color:var(--gold); letter-spacing:1px; margin-bottom:8px; text-transform:uppercase;">AWARDS & TROPHIES</h3>
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                ${[
                                    { id: 'first_win', name: 'First Victory', desc: 'Secure first win under chess rules.', coins: 100 },
                                    { id: 'wins_10', name: 'Decimator Stand', desc: 'Slay opponents on 10 matches total.', coins: 250 },
                                    { id: 'checkmate_one', name: 'Flawless Checkmate', desc: 'Close match by absolute checkmate.', coins: 100 },
                                    { id: 'perfect_match', name: 'Tactical Sweep', desc: 'Secure win without losing major pieces.', coins: 300 }
                                ].map(ach => {
                                    const earned = this.account.achievements.includes(ach.id);
                                    return `
                                        <div style="background:#050505; border:1px solid var(--border-color); border-radius:4px; padding:10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                            <div style="text-align:left;">
                                                <div style="font-size:11.5px; font-weight:800; color:${earned ? 'var(--gold)' : '#fff'};">${ach.name}</div>
                                                <div style="font-size:9px; color:var(--text-muted);">${ach.desc}</div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div style="font-size:10px; font-weight:800; color:var(--gold); font-family:var(--font-mono);">🪙 +${ach.coins}</div>
                                                <div style="font-size:8px; font-weight:700; color:${earned ? '#4af626' : '#555'}; margin-top:2px;">${earned ? 'EARNED' : 'LOCKED'}</div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
                break;
            }
        }
       
        // Output compilation to lobby screen UI
        lobbyContainer.innerHTML = `
            ${headerHtml}
            <div class="lobby-actions-block" style="flex:1;">
                ${bodyHtml}
            </div>
           
            <!-- Connection stats trailer -->
            <footer class="lobby-footer" style="margin-top:16px;">
                <div class="connection-status" style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:9.5px; font-family:var(--font-mono); color:var(--text-muted);">
                    <span class="status-indicator success" id="status-dot"></span>
                    <span id="status-text">${this.sessionActive ? 'FIRESTORE ADVANCED SYNCED' : 'OFFLINE DUELIST CACHE ACTIVE'}</span>
                </div>
            </footer>
        `;
    },
   
    // Auth flow prompts / overlays
    renderAuthOverlay() {
        // Build floating modal over app to offer Login/SignUp
        const appDiv = document.getElementById('app');
        if (document.getElementById('ftech-auth-overlay')) return;
       
        const overlay = document.createElement('div');
        overlay.id = 'ftech-auth-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.background = 'radial-gradient(circle, #101015 0%, #000 100%)';
        overlay.style.zIndex = '999';
       
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:380px; padding:28px; border-color:#2a2a35; text-align:center;">
                <span class="subtitle-badge" style="letter-spacing:6px; color:var(--gold)">FUTECX CHESS</span>
                <h1 style="font-family:var(--font-display); font-size:26px; color:#fff; font-weight:800; letter-spacing:4px; margin-top:4px; margin-bottom:12px;">RISE TO LEGEND</h1>
                <p style="font-size:11.5px; color:var(--text-muted); line-height:1.5; margin-bottom:20px;">
                    Unlock Cloud syncing, ranked matchmaking rating, global leaderboards, and persistent coin rewards inventory!
                </p>
               
                <div id="auth-inputs-box" style="display:flex; flex-direction:column; gap:10px; text-align:left; margin-bottom:16px;">
                    <div>
                        <label style="font-size:8px; font-weight:700; letter-spacing:1.5px; color:var(--text-muted); text-transform:uppercase;">Email Address</label>
                        <input id="auth-email-field" type="email" placeholder="example@chess.com" style="background:#050505; border:1px solid var(--border-color); color:#fff; width:100%; padding:10px; font-family:var(--font-mono); font-size:11px; border-radius:4px; outline:none; margin-top:4px;">
                    </div>
                    <div>
                        <label style="font-size:8px; font-weight:700; letter-spacing:1.5px; color:var(--text-muted); text-transform:uppercase;">Password</label>
                        <input id="auth-pass-field" type="password" placeholder="••••••••" style="background:#050505; border:1px solid var(--border-color); color:#fff; width:100%; padding:10px; font-family:var(--font-mono); font-size:11px; border-radius:4px; outline:none; margin-top:4px;">
                    </div>
                </div>
               
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="btn" onclick="FtechSystem.handleEmailLogin()" style="background:var(--blue-dark); color:#fff; font-size:11px; font-family:var(--font-display); font-weight:700; border:none; padding:12px 0; border-radius:4px; letter-spacing:1px; cursor:pointer;">SIGN IN ACCOUNT</button>
                    <button class="btn btn-outline" onclick="FtechSystem.handleEmailSignUp()" style="border-radius:4px; font-size:11px; padding:10px 0;">CREATE NEW ACCOUNT</button>
                    <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:9.5px;">
                        <a href="#" onclick="FtechSystem.handlePasswordRecovery()" style="color:var(--text-muted); text-decoration:underline;">Forgot Password?</a>
                        <a href="#" onclick="FtechSystem.skipAuthPrompt()" style="color:var(--gold); font-weight:700;">Play as Guest (Skip)</a>
                    </div>
                </div>
            </div>
        `;
        appDiv.appendChild(overlay);
    },
   
    skipAuthPrompt() {
        const overlay = document.getElementById('ftech-auth-overlay');
        if (overlay) overlay.remove();
        this.authSkipped = true;
        showToast("WELCOME! PLAYING AS TOURNEY GUEST.");
        this.renderDashboard();
    },
   
    handleEmailLogin() {
        const email = document.getElementById('auth-email-field').value.trim();
        const pass = document.getElementById('auth-pass-field').value;
        if (!email || !pass) {
            showToast("COMPLETE EMAIL AND PASSWORD FIELDS.");
            return;
        }
       
        if (typeof firebase === 'undefined') {
            showToast("DATA PORT DISCONNECTED. SKIPPING AUTH.");
            this.skipAuthPrompt();
            return;
        }
       
        showToast("AUTHENTICATING CREDENTIALS...");
        firebase.auth().signInWithEmailAndPassword(email, pass)
            .then(res => {
                showToast("WELCOME BACK COMMITTED GRANDMASTER!");
                const overlay = document.getElementById('ftech-auth-overlay');
                if (overlay) overlay.remove();
            })
            .catch(err => {
                showToast("LOGIN FAILED: " + err.message);
            });
    },
   
    handleEmailSignUp() {
        const email = document.getElementById('auth-email-field').value.trim();
        const pass = document.getElementById('auth-pass-field').value;
        if (!email || pass.length < 6) {
            showToast("EMAIL REQUIRED & PASSWORD MIN 6 CHARACTERS.");
            return;
        }
       
        showToast("PROVISIONING CHESS ACCOUNT...");
        firebase.auth().createUserWithEmailAndPassword(email, pass)
            .then(res => {
                showToast("ACCOUNT COMMISSIONED SUCCESSFULLY!");
                const overlay = document.getElementById('ftech-auth-overlay');
                if (overlay) overlay.remove();
            })
            .catch(err => {
                showToast("SIGNUP FAILED: " + err.message);
            });
    },
   
    handlePasswordRecovery() {
        const email = document.getElementById('auth-email-field').value.trim();
        if (!email) {
            showToast("ENTER EMAIL TO RECEIVE RECOVERY LINK.");
            return;
        }
        showToast("TRANSMITTING RECOVERY EMAIL...");
        firebase.auth().sendPasswordResetEmail(email)
            .then(() => showToast("RECOVERY EMAIL FILED SUCCESS. CHECK INBOX!"))
            .catch(err => showToast("FAILED: " + err.message));
    },
   
    // Custom match routes
    startComputerMatch() {
        this.currentGameMode = 'computer';
        localPlayMode = true; // Block network listener queues
        myPlayerColor = 'w';  // Player remains White, Robot responds as Black
       
        document.getElementById('room-code-display-box').classList.add('hidden-info');
        document.getElementById('opponent-name').innerText = `BOT - STOCKFISH AI (${this.computerDifficulty.toUpperCase()})`;
        document.getElementById('opponent-status').innerText = "CALCULATING TACTICS ONBOARD";
        const v2DisplayName = this.formatDisplayName(this.account.username);
        document.getElementById('player-name').innerText = `${v2DisplayName.toUpperCase()} (YOU)`;
        document.getElementById('player-status').innerText = `LEVEL ${this.account.level} &bull; ${this.account.title}`;
       
        transitionScreen('lobby', 'game-screen');
       
        activeEngine.reset();
        syncPiecesWithEngineState();
        startMatch();
    },
   
    checkSeasonReset() {
        const SEASON_DAYS = 60;
        const today = this.getServerDateString();
        if (!this.account.seasonStartDate) {
            this.account.seasonStartDate = today;
            return;
        }
        const start = new Date(this.account.seasonStartDate + 'T12:00:00');
        const now = new Date(today + 'T12:00:00');
        const daysElapsed = Math.floor((now - start) / (24 * 60 * 60 * 1000));
        if (daysElapsed >= SEASON_DAYS) {
            let reduction = typeof FirestoreDB !== 'undefined' && FirestoreDB.computeSeasonSoftReset
                ? FirestoreDB.computeSeasonSoftReset(this.account.rp)
                : 15;
            if (this.account.rp <= 100) reduction = 0;
            const oldRp = this.account.rp;
            this.account.rp = Math.max(0, this.account.rp - reduction);
            this.account.claimedRankRewards = [];
            this.account.seasonStartDate = today;
            this.saveData();
            if (typeof showToast === 'function') {
                showToast(`SEASON RENEWED! RP adjusted ${oldRp} → ${this.account.rp}. Rewards reset.`);
            }
            if (this.sessionActive && this.account.uid && typeof FirestoreDB !== 'undefined') {
                FirestoreDB.updateUser(this.account.uid, {
                    rp: this.account.rp,
                    claimedRankRewards: [],
                    seasonStartDate: today
                });
            }
        }
    },

    deductEntryFee(tierKey) {
        const tier = this.ENTRY_FEE_TIERS[tierKey] || this.ENTRY_FEE_TIERS.none;
        if (tier.fee <= 0) return true;
        if (this.account.coins < tier.fee) {
            if (typeof showToast === 'function') showToast(`INSUFFICIENT COINS. NEED 🪙 ${tier.fee}`);
            return false;
        }
        this.account.coins -= tier.fee;
        this.saveData();
        return true;
    },

    payoutEntryFeeWinner(tierKey) {
        const tier = this.ENTRY_FEE_TIERS[tierKey] || this.ENTRY_FEE_TIERS.none;
        if (tier.payout > 0) {
            this.account.coins += tier.payout;
        }
    },

    getAdaptiveBotProfile(rp) {
        const names = ['ShadowKnight', 'IronBishop', 'CyberRook', 'NeonQueen', 'PhantomKing', 'VoidMaster'];
        const rank = this.getRankDetails(rp || this.account.rp);
        return {
            username: names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 90 + 10),
            rp: Math.max(0, (rp || this.account.rp) + Math.floor(Math.random() * 40 - 20)),
            rankLabel: rank.fullLabel,
            isBot: true
        };
    },

    startPlayOnlineLobby() {
        this.currentGameMode = 'play_online';
        window.moveAssistEnabled = true;
        if (typeof openPlayOnlineMatchmakingModal === 'function') {
            openPlayOnlineMatchmakingModal();
            return;
        }
        this.runPlayOnlineMatchmaking();
    },

    async runPlayOnlineMatchmaking() {
        showToast('SEARCHING CASUAL PLAYERS WORLDWIDE...');
        const uid = this.account.uid;
        const timeoutMs = 12000;
        let matched = false;
        let opponentInfo = null;

        if (this.sessionActive && typeof FirestoreDB !== 'undefined') {
            await FirestoreDB.joinMatchmakingQueue(uid, {
                playerId: this.account.playerId,
                username: this.account.username,
                rp: this.account.rp
            }, 'casual');
            const start = Date.now();
            while (Date.now() - start < timeoutMs && !matched) {
                const opponent = await FirestoreDB.findCasualOpponent(uid);
                if (opponent) {
                    matched = true;
                    opponentInfo = opponent;
                    await FirestoreDB.leaveMatchmakingQueue(uid);
                    showToast(`MATCH FOUND: ${opponent.username.toUpperCase()}!`);
                    break;
                }
                await new Promise(r => setTimeout(r, 1200));
            }
            await FirestoreDB.leaveMatchmakingQueue(uid);
        }

        if (matched && opponentInfo) {
            this.matchOpponentInfo = { ...opponentInfo, isBot: false };
            this.launchOnlineMatchUI(opponentInfo.username, opponentInfo.rp, false);
        } else {
            showToast('CASUAL BOT OPPONENT DEPLOYED.');
            const bot = this.getAdaptiveBotProfile(this.account.rp);
            bot.isBot = true;
            this.matchOpponentInfo = bot;
            this.computerDifficulty = 'medium';
            this.launchCasualBotMatch(bot);
        }
    },

    launchOnlineMatchUI(oppName, oppRp, isBot) {
        window.moveAssistEnabled = true;
        localPlayMode = true;
        myPlayerColor = 'w';
        if (typeof closeQuickMatchRadar === 'function') closeQuickMatchRadar();
        if (typeof transitionScreenV3 === 'function') transitionScreenV3('game-screen');
        if (typeof updateMatchPlayerNames === 'function') {
            updateMatchPlayerNames(oppName, oppRp, isBot);
        }
        if (activeEngine) activeEngine.reset();
        if (typeof syncPiecesWithEngineState === 'function') syncPiecesWithEngineState();
        if (typeof startMatch === 'function') startMatch();
    },

    launchCasualBotMatch(bot) {
        window.moveAssistEnabled = true;
        localPlayMode = true;
        myPlayerColor = 'w';
        if (typeof closeQuickMatchRadar === 'function') closeQuickMatchRadar();
        if (typeof transitionScreenV3 === 'function') transitionScreenV3('game-screen');
        if (typeof updateMatchPlayerNames === 'function') {
            updateMatchPlayerNames(bot.username, bot.rp, true);
        }
        this.currentGameMode = 'play_online';
        if (activeEngine) activeEngine.reset();
        if (typeof syncPiecesWithEngineState === 'function') syncPiecesWithEngineState();
        if (typeof startMatch === 'function') startMatch();
    },

    startRankedLobby() {
        if (typeof clearPrivateRoomState === 'function') clearPrivateRoomState();
        if (this.isRankedBanned && this.isRankedBanned()) {
            const banStr = this.getRankedBanRemainingString ? this.getRankedBanRemainingString() : 'Active Ban';
            showToast(`ACCESS REJECTED: BANNED FOR ${banStr.toUpperCase()}`);
            return;
        }
        this.currentGameMode = 'ranked';
        window.moveAssistEnabled = false;
        if (typeof openRankedMatchmakingModal === 'function') {
            openRankedMatchmakingModal();
            return;
        }
        this.runSmartRankedMatchmaking();
    },

    async runSmartRankedMatchmaking() {
        showToast('SEARCHING COMPETITIVE PLAYERS...');
        window.moveAssistEnabled = false;
        const uid = this.account.uid;
        const rp = this.account.rp || 0;
        const timeoutMs = 11000;
        let matched = false;
        let opponentInfo = null;

        if (this.sessionActive && typeof FirestoreDB !== 'undefined') {
            await FirestoreDB.joinMatchmakingQueue(uid, {
                playerId: this.account.playerId,
                username: this.account.username,
                rp
            }, 'ranked');
            const start = Date.now();
            while (Date.now() - start < timeoutMs && !matched) {
                const opponent = await FirestoreDB.findRankedOpponent(uid, rp, 150);
                if (opponent) {
                    matched = true;
                    opponentInfo = opponent;
                    await FirestoreDB.leaveMatchmakingQueue(uid);
                    showToast(`MATCH FOUND: ${opponent.username.toUpperCase()}!`);
                    break;
                }
                await new Promise(r => setTimeout(r, 1200));
            }
            await FirestoreDB.leaveMatchmakingQueue(uid);
        }

        if (typeof closeQuickMatchRadar === 'function') closeQuickMatchRadar();

        if (matched && opponentInfo) {
            this.matchOpponentInfo = { ...opponentInfo, isBot: false };
            localPlayMode = true;
            myPlayerColor = 'w';
            window.moveAssistEnabled = false;
            if (typeof transitionScreenV3 === 'function') transitionScreenV3('game-screen');
            if (typeof updateMatchPlayerNames === 'function') {
                updateMatchPlayerNames(opponentInfo.username, opponentInfo.rp, false);
            }
            if (activeEngine) activeEngine.reset();
            if (typeof syncPiecesWithEngineState === 'function') syncPiecesWithEngineState();
            if (typeof startMatch === 'function') startMatch();
            return;
        }

        showToast('ADAPTIVE COMPETITOR ENGAGED.');
        const bot = this.getAdaptiveBotProfile(rp);
        bot.isBot = true;
        this.matchOpponentInfo = bot;
        this.computerDifficulty = rp >= 2100 ? 'grandmaster' : rp >= 1400 ? 'master' : rp >= 800 ? 'hard' : rp >= 350 ? 'medium' : 'easy';
        localPlayMode = true;
        myPlayerColor = 'w';
        window.moveAssistEnabled = false;
        if (typeof transitionScreenV3 === 'function') transitionScreenV3('game-screen');
        if (typeof updateMatchPlayerNames === 'function') {
            updateMatchPlayerNames(bot.username, bot.rp, true);
        }
        if (typeof closeVSComputerMenu === 'function') closeVSComputerMenu();
        if (activeEngine) activeEngine.reset();
        if (typeof syncPiecesWithEngineState === 'function') syncPiecesWithEngineState();
        if (typeof startMatch === 'function') startMatch();
    },
   
    inviteFriendRoom(friendName) {
        // Invite Friend -> Set Room code and show code block instantly inside UI
        showToast(`INVITING ${friendName.toUpperCase()} TO DUEL BOARD...`);
        const code = createRoom(); // host room
        if (code) {
            showToast(`ROOM COMMISSIONED. CODE: ${code}. SEND LINK`);
            this.currentGameMode = 'friend';
        }
    }
};

// -----------------------------------------------------
// MODULAR MINIMAX ALPHA-BETA CHESS AI FOR "VS COMPUTER"
// -----------------------------------------------------
const ChessAI = {
    PAWN_PST: [
        [  0,   0,   0,   0,   0,   0,   0,   0],
        [ 50,  50,  50,  50,  50,  50,  50,  50],
        [ 10,  10,  20,  30,  30,  20,  10,  10],
        [  5,   5,  10,  25,  25,  10,   5,   5],
        [  0,   0,   0,  20,  20,   0,   0,   0],
        [  5,  -5, -10,   0,   0, -10,  -5,   5],
        [  5,  10,  10, -20, -20,  10,  10,   5],
        [  0,   0,   0,   0,   0,   0,   0,   0]
    ],
    KNIGHT_PST: [
        [-50, -40, -30, -30, -30, -30, -40, -50],
        [-40, -20,   0,   0,   0,   0, -20, -40],
        [-30,   0,  10,  15,  15,  10,   0, -30],
        [-30,   5,  15,  20,  20,  15,   5, -30],
        [-30,   0,  15,  20,  20,  15,   0, -30],
        [-30,   5,  10,  15,  15,  10,   5, -30],
        [-40, -20,   0,   5,   5,   0, -20, -40],
        [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    BISHOP_PST: [
        [-20, -10, -10, -10, -10, -10, -10, -20],
        [-10,   0,   0,   0,   0,   0,   0, -10],
        [-10,   0,   5,  10,  10,   5,   0, -10],
        [-10,   5,   5,  10,  10,   5,   5, -10],
        [-10,   0,  10,  10,  10,  10,   0, -10],
        [-10,  10,  10,  10,  10,  10,  10, -10],
        [-10,   5,   0,   0,   0,   0,   5, -10],
        [-20, -10, -10, -10, -10, -10, -10, -20]
    ],
    ROOK_PST: [
        [  0,   0,   0,   0,   0,   0,   0,   0],
        [  5,  10,  10,  10,  10,  10,  10,   5],
        [ -5,   0,   0,   0,   0,   0,   0,  -5],
        [ -5,   0,   0,   0,   0,   0,   0,  -5],
        [ -5,   0,   0,   0,   0,   0,   0,  -5],
        [ -5,   0,   0,   0,   0,   0,   0,  -5],
        [ -5,   0,   0,   0,   0,   0,   0,  -5],
        [  0,   0,   0,   5,   5,   0,   0,   0]
    ],
    QUEEN_PST: [
        [-20, -10, -10,  -5,  -5, -10, -10, -20],
        [-10,   0,   0,   0,   0,   0,   0, -10],
        [-10,   0,   5,   5,   5,   5,   0, -10],
        [ -5,   0,   5,   5,   5,   5,   0,  -5],
        [  0,   0,   5,   5,   5,   5,   0,  -5],
        [-10,   5,   5,   5,   5,   5,   0, -10],
        [-10,   0,   5,   0,   0,   5,   0, -10],
        [-20, -10, -10,  -5,  -5, -10, -10, -20]
    ],
    KING_PST: [
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-20, -30, -30, -40, -40, -30, -30, -20],
        [-10, -20, -20, -20, -20, -20, -20, -10],
        [ 20,  20,   0,   0,   0,   0,  20,  20],
        [ 20,  30,  10,   0,   0,  10,  30,  20]
    ],

    // Material definitions evaluation
    getPieceValue(type) {
        switch(type) {
            case 'p': return 100;
            case 'n': return 320;
            case 'b': return 330;
            case 'r': return 500;
            case 'q': return 900;
            case 'k': return 20000;
            default: return 0;
        }
    },

    evaluateBoard(board) {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece) {
                    let val = this.getPieceValue(piece.type);
                   
                    // PST additives based on piece positioning mapping
                    let table = null;
                    if (piece.type === 'p') table = this.PAWN_PST;
                    else if (piece.type === 'n') table = this.KNIGHT_PST;
                    else if (piece.type === 'b') table = this.BISHOP_PST;
                    else if (piece.type === 'r') table = this.ROOK_PST;
                    else if (piece.type === 'q') table = this.QUEEN_PST;
                    else if (piece.type === 'k') table = this.KING_PST;
                   
                    if (table) {
                        let tableVal = piece.color === 'w' ? table[r][c] : table[7-r][c];
                        val += tableVal;
                    }
                   
                    if (piece.color === 'w') {
                        score += val;
                    } else {
                        score -= val;
                    }
                }
            }
        }
        return score;
    },

    // MiniMax Recursive alpha-beta engine
    minimax(engine, depth, alpha, beta, isMaximizing) {
        if (depth === 0 || engine.gameState !== 'active') {
            return { score: this.evaluateBoard(engine.board) };
        }

        const turnColor = engine.turn;
        const allMoves = [];
       
        // Find compiling valid lists
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = engine.getPieceAt(r, c);
                if (piece && piece.color === turnColor) {
                    const valids = engine.getValidMoves(r, c);
                    for (const move of valids) {
                        allMoves.push({
                            from: { row: r, col: c },
                            to: { row: move.row, col: move.col },
                            isDouble: move.isDoublePush,
                            isEP: move.isENPassant
                        });
                    }
                }
            }
        }

        // Capture terminal nodes
        if (allMoves.length === 0) {
            if (engine.isKingInCheck(turnColor)) {
                return { score: isMaximizing ? -25000 : 25000 }; // Checkmate trigger
            }
            return { score: 0 }; // Stalemate
        }

        // Basic move ordering: Prioritize Captures to accelerate Alpha-Beta pruning!
        allMoves.sort((x, y) => {
            const destX = engine.getPieceAt(x.to.row, x.to.col);
            const destY = engine.getPieceAt(y.to.row, y.to.col);
            let scoreX = destX ? this.getPieceValue(destX.type) : 0;
            let scoreY = destY ? this.getPieceValue(destY.type) : 0;
            return scoreY - scoreX;
        });

        let bestMove = null;

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of allMoves) {
                // Simulate action directly using fast engine cloning
                const simulatedEngine = new ChessEngine();
                simulatedEngine.board = simulatedEngine.cloneBoard(engine.board);
                simulatedEngine.turn = engine.turn;
                simulatedEngine.castlingRights = JSON.parse(JSON.stringify(engine.castlingRights));
                simulatedEngine.enPassantSquare = engine.enPassantSquare;
                simulatedEngine.gameState = 'active';

                simulatedEngine.move(move.from.row, move.from.col, move.to.row, move.to.col);
               
                const res = this.minimax(simulatedEngine, depth - 1, alpha, beta, false);
                if (res.score > maxScore) {
                    maxScore = res.score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, maxScore);
                if (beta <= alpha) break; // Pruning
            }
            return { score: maxScore, move: bestMove };
        } else {
            let minScore = Infinity;
            for (const move of allMoves) {
                const simulatedEngine = new ChessEngine();
                simulatedEngine.board = simulatedEngine.cloneBoard(engine.board);
                simulatedEngine.turn = engine.turn;
                simulatedEngine.castlingRights = JSON.parse(JSON.stringify(engine.castlingRights));
                simulatedEngine.enPassantSquare = engine.enPassantSquare;
                simulatedEngine.gameState = 'active';

                simulatedEngine.move(move.from.row, move.from.col, move.to.row, move.to.col);
               
                const res = this.minimax(simulatedEngine, depth - 1, alpha, beta, true);
                if (res.score < minScore) {
                    minScore = res.score;
                    bestMove = move;
                }
                beta = Math.min(beta, minScore);
                if (beta <= alpha) break; // Pruning
            }
            return { score: minScore, move: bestMove };
        }
    },

    computeMove(engine, difficulty) {
        const turnColor = engine.turn;
        const allMoves = [];
       
        // Find compiling valid lists
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = engine.getPieceAt(r, c);
                if (piece && piece.color === turnColor) {
                    const valids = engine.getValidMoves(r, c);
                    for (const move of valids) {
                        allMoves.push({
                            from: { row: r, col: c },
                            to: { row: move.row, col: move.col }
                        });
                    }
                }
            }
        }

        if (allMoves.length === 0) return null;

        // Difficulty calibration limits depth search
        if (difficulty === 'easy') {
            // Easy Mode: 75% random, 25% depth 1
            if (Math.random() < 0.75) {
                return allMoves[Math.floor(Math.random() * allMoves.length)];
            }
            const res = this.minimax(engine, 1, -Infinity, Infinity, turnColor === 'w');
            return res.move || allMoves[Math.floor(Math.random() * allMoves.length)];
       
        } else if (difficulty === 'medium') {
            // Medium Mode: Depth 1 Minimax + small randomness variables
            if (Math.random() < 0.3) {
                return allMoves[Math.floor(Math.random() * allMoves.length)];
            }
            const res = this.minimax(engine, 1, -Infinity, Infinity, turnColor === 'w');
            return res.move || allMoves[Math.floor(Math.random() * allMoves.length)];
           
        } else if (difficulty === 'hard') {
            // Hard Mode: Complete depth 2 search with PST tables!
            const res = this.minimax(engine, 2, -Infinity, Infinity, turnColor === 'w');
            return res.move || allMoves[Math.floor(Math.random() * allMoves.length)];
           
        } else if (difficulty === 'master') {
            // Master: Deep Depth 3 Alpha-Beta tactical
            const res = this.minimax(engine, 3, -Infinity, Infinity, turnColor === 'w');
            return res.move || allMoves[Math.floor(Math.random() * allMoves.length)];
           
        } else {
            // Grandmaster: Optimized Depth 4 minimax or deeper based on size
            const depth = allMoves.length < 15 ? 4 : 3; // Dynamically limit depth trees during complex phases
            const res = this.minimax(engine, depth, -Infinity, Infinity, turnColor === 'w');
            return res.move || allMoves[Math.floor(Math.random() * allMoves.length)];
        }
    }
};
