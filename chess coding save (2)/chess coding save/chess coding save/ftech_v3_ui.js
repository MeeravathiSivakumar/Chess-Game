/**
 * FUTECX CHESS V3 - Advanced Gaming UI Bridge & Modals Controller
 * Implements high-fidelity transitions, dynamic asset generation,
 * rank badges, journey progression, daily gift calendars, inventory shop
 * and the quick match matchmaking queue.
 */

// Global current selections
let selectedColor = 'w'; // 'w' or 'b' for vs computer
let activeStoreCategory = 'avatars'; // 'avatars', 'frames', 'titles', 'skins'
let activeFriendsSubTab = 'online'; // 'online', 'requests', 'recents'
let selectedJourneyRank = 'pawn'; // 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'grandmaster', 'legend'

// Rank definitions table for V3 Journey & Badges
const V3_RANKS = [
    { id: 'pawn', name: 'Pawn', rpMin: 0, rpMax: 199, badgeColor: '#b0bec5', tiers: ['I', 'II', 'III', 'Elite'] },
    { id: 'knight', name: 'Knight', rpMin: 200, rpMax: 499, badgeColor: '#81c784', tiers: ['I', 'II', 'III', 'Elite'] },
    { id: 'bishop', name: 'Bishop', rpMin: 500, rpMax: 799, badgeColor: '#64b5f6', tiers: ['I', 'II', 'III', 'Elite'] },
    { id: 'rook', name: 'Rook', rpMin: 800, rpMax: 1099, badgeColor: '#ba68c8', tiers: ['I', 'II', 'III', 'Elite'] },
    { id: 'queen', name: 'Queen', rpMin: 1100, rpMax: 1399, badgeColor: '#f06292', tiers: ['I', 'II', 'III', 'Elite'] },
    { id: 'king', name: 'King', rpMin: 1400, rpMax: 1699, badgeColor: '#ffca28', tiers: ['I', 'II', 'III', 'Elite'] },
    { id: 'grandmaster', name: 'Grandmaster', rpMin: 1700, rpMax: 2099, badgeColor: '#00e5ff', tiers: ['I', 'II', 'III', 'Elite'] },
    { id: 'legend', name: 'Legend', rpMin: 2100, rpMax: 99999, badgeColor: '#ff9100', tiers: ['I', 'II', 'III', 'Elite'] }
];

// Journey rewards definition map
const JOURNEY_REWARDS = {
    pawn: { title: 'Pawn Elite Border', rewardCoins: 200, border: '#b0bec5', desc: 'Secure initial battle points.' },
    knight: { title: 'Knight Border & Title', rewardCoins: 1000, border: '#81c784', desc: 'Prestige tactical evolution unlocked.' },
    bishop: { title: 'Bishop Golden Title', rewardCoins: 1500, border: '#64b5f6', desc: 'Master diagonal line traps.' },
    rook: { title: 'Citadel Custom Skin', rewardCoins: 2000, border: '#ba68c8', desc: 'Solidify your defense arrays.' },
    queen: { title: 'Queen Royal Frame', rewardCoins: 3000, border: '#f06292', desc: 'Unlock royal level permissions.' },
    king: { title: 'King Golden Shroud Frame', rewardCoins: 5000, border: '#ffca28', desc: 'Claim ultimate prestige tag.' },
    grandmaster: { title: 'Grandmaster Halo Frame', rewardCoins: 7500, border: '#e0f7fa', desc: 'Enter legendary halls.' },
    legend: { title: 'The Ultimate Legend Frame', rewardCoins: 15000, border: '#ff9100', desc: 'Ascend to absolute godhood.' }
};

function filterUsernameEmojiInput(el) {
    if (!el || !FtechSystem.containsEmoji) return;
    if (FtechSystem.containsEmoji(el.value)) {
        el.value = el.value.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
        showToast('Emojis are not allowed in usernames.');
    }
}

// Start Sequence
window.addEventListener('DOMContentLoaded', () => {
    transitionScreenV3('splash-screen');
    runSplashAnimation();
    setTimeout(initXpHoldReveal, 500);
});

// Run 2.5 second Splash Screen loader
function runSplashAnimation() {
    const progressBar = document.getElementById('splash-progress');
    let percent = 0;
    const interval = setInterval(() => {
        percent += 4;
        if (progressBar) progressBar.style.width = percent + '%';
        if (percent >= 100) {
            clearInterval(interval);
            checkInitialAuth();
        }
    }, 100);
}

// Coordinate Auth check
function checkInitialAuth() {
    // Boot FtechSystem variables
    FtechSystem.init();
   
    // Periodically check if Auth initialization is completed before transitioning
    const authCheckInterval = setInterval(() => {
        if (FtechSystem.authInitialized) {
            clearInterval(authCheckInterval);
           
            // If we have an active cloud session, fetchCloudProfile was already triggered.
            // It will handle transitioning once Firestore data is fully retrieved.
            if (FtechSystem.sessionActive) {
                console.log("Ftech V3 Boot: Session found, waiting for Firestore integration...");
                return;
            }
           
            // If offline or no active cloud session, fall back to local profile cache
            const cache = localStorage.getItem('ftech_chess_v2_profile');
            if (cache) {
                const profile = JSON.parse(cache || '{}');
                const localSetupDone = (profile && profile.hasCompletedSetup === true) ||
                                       (profile && profile.username && profile.username !== 'Grandmaster Guest' && profile.country);
                if (localSetupDone) {
                    FtechSystem.account = { ...FtechSystem.account, ...profile };
                    transitionScreenV3('lobby');
                    syncLobbyHUD();
                    return;
                }
            }
            // Otherwise, route to login page
            transitionScreenV3('login-screen');
        }
    }, 50);
}

// Handle UI Screen Switches
function transitionScreenV3(screenId) {
    // Hide all main containers
    document.getElementById('splash-screen').classList.add('hidden-screen');
    document.getElementById('splash-screen').classList.remove('active-screen');
   
    document.getElementById('login-screen').classList.add('hidden-screen');
    document.getElementById('login-screen').classList.remove('active-screen');
   
    document.getElementById('setup-screen').classList.add('hidden-screen');
    document.getElementById('setup-screen').classList.remove('active-screen');
   
    document.getElementById('lobby').classList.add('hidden-screen');
    document.getElementById('lobby').classList.remove('active-screen');
   
    document.getElementById('game-screen').classList.add('hidden-screen');
    document.getElementById('game-screen').classList.remove('active-screen');
   
    // Show chosen screen
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden-screen');
        target.classList.add('active-screen');
    }

    // Explicitly trigger WebGL 3D Canvas dimension updates so piece rendering and chessboard load perfectly
    if (screenId === 'game-screen') {
        setTimeout(() => {
            if (typeof onWindowResize === 'function') {
                onWindowResize();
            }
        }, 150);
    }
}

// Show specific forms inside Login screen
function showEmailForm() {
    const box = document.createElement('div');
    box.id = 'email-form-modal';
    box.className = 'modal-overlay';
    box.innerHTML = `
        <div class="modal-card" style="max-width:380px; padding:24px; text-align:center;">
            <h3>EMAIL LOGIN</h3>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Sign in to sync your golden rating and collection.</p>
            <input type="email" id="login-email-input" placeholder="Enter Email" class="setup-input-field" style="margin-bottom:10px;">
            <input type="password" id="login-pass-input" placeholder="Enter Password" class="setup-input-field" style="margin-bottom:16px;">
            <div style="display:flex; gap:8px;">
                <button class="btn btn-outline" onclick="closeLoginEmailModal()" style="flex:1;">CANCEL</button>
                <button class="btn btn-primary" onclick="submitEmailLogin()" style="flex:1;">LOGIN</button>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(box);
}

function showEmailRegisterForm() {
    const box = document.createElement('div');
    box.id = 'email-form-modal';
    box.className = 'modal-overlay';
    box.innerHTML = `
        <div class="modal-card" style="max-width:380px; padding:24px; text-align:center;">
            <h3>CREATE ACCOUNT</h3>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Register to participate in the rated grandmaster league.</p>
            <input type="email" id="regs-email-input" placeholder="Email Address" class="setup-input-field" style="margin-bottom:10px;">
            <input type="password" id="regs-pass-input" placeholder="Password (min 6 characters)" class="setup-input-field" style="margin-bottom:16px;">
            <div style="display:flex; gap:8px;">
                <button class="btn btn-outline" onclick="closeLoginEmailModal()" style="flex:1;">CANCEL</button>
                <button class="btn btn-primary" onclick="submitEmailRegister()" style="flex:1;">REGISTER</button>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(box);
}

function closeLoginEmailModal() {
    const el = document.getElementById('email-form-modal');
    if (el) el.remove();
}

function submitEmailLogin() {
    const email = document.getElementById('login-email-input').value.trim();
    const pass = document.getElementById('login-pass-input').value;
    if (!email || !pass) {
        showToast("COMPLY BOTH EMAIL AND PASSWORD VALUES.");
        return;
    }
    if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
        showToast("OFFLINE MODE: Simulating sign-in with local data.");
        closeLoginEmailModal();
        FtechSystem.authSkipped = true;
        setTimeout(() => {
            const setupDone = FtechSystem.account.username && FtechSystem.account.username !== 'Grandmaster Guest';
            if (setupDone) {
                transitionScreenV3('lobby');
                syncLobbyHUD();
            } else {
                generateSetupUID();
                transitionScreenV3('setup-screen');
            }
        }, 500);
        return;
    }
    showToast("AUTHENTICATING IN CLOUD...");
    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then((result) => {
            closeLoginEmailModal();
            showToast("SUCCESSFULLY AUTHENTICATED! SYNCING PROFILE...");
            FtechSystem.sessionActive = true;
            if (result && result.user) {
                FtechSystem.currentUser = result.user;
                FtechSystem.loadAccountData(result.user.uid);
                FtechSystem.account.uid = result.user.uid;
                FtechSystem.account.email = result.user.email;
            }
            FtechSystem.fetchCloudProfile();
        })
        .catch(err => {
            const msg = (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential')
                ? 'Incorrect password. Please try again.'
                : ('ERROR: ' + err.message);
            showToast(msg);
        });
}

function submitEmailRegister() {
    const email = document.getElementById('regs-email-input').value.trim();
    const pass = document.getElementById('regs-pass-input').value;
    if (!email || pass.length < 6) {
        showToast("PROVIDE VALID EMAIL & 6 CHAR PASSWORD.");
        return;
    }
    if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
        showToast("OFFLINE MODE: Account simulated locally!");
        closeLoginEmailModal();
        FtechSystem.authSkipped = true;
        generateSetupUID();
        transitionScreenV3('setup-screen');
        return;
    }
    showToast("REGISTERING NEW ACCOUNT...");
    firebase.auth().createUserWithEmailAndPassword(email, pass)
        .then((result) => {
            closeLoginEmailModal();
            showToast("ACCOUNT CREATED!");
            FtechSystem.sessionActive = true;
            if (result && result.user) {
                FtechSystem.currentUser = result.user;
                FtechSystem.account.uid = result.user.uid;
                FtechSystem.account.email = result.user.email;
            }
            generateSetupUID();
            transitionScreenV3('setup-screen');
        })
        .catch(err => showToast("FAILED: " + err.message));
}

// Google Login Click Handlers
function handleGoogleLoginClick() {
    if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
        showToast("DEVELOPER: Firebase Auth unavailable. Simulating Google link...");
        setTimeout(() => {
            showToast("OFFLINE SIMULATION: Google Authorization passed!");
            generateSetupUID();
            transitionScreenV3('setup-screen');
        }, 1200);
        return;
    }
    showToast("LAUNCHING GOOGLE GATEWAY...");
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            showToast("GOOGLE ACCOUNT RETRIEVED SUCCESSFULLY!");
            FtechSystem.sessionActive = true;
            FtechSystem.currentUser = result.user;
            FtechSystem.loadAccountData(result.user.uid);
            FtechSystem.account.uid = result.user.uid;
            FtechSystem.account.email = result.user.email;
            if (!FtechSystem.account.username || FtechSystem.account.username === 'Grandmaster Guest') {
                FtechSystem.account.username = result.user.displayName || result.user.email.split('@')[0];
            }
            showToast("GOOGLE ACCOUNT LINKED! SYNCING PROFILE...");
            FtechSystem.fetchCloudProfile();
        })
        .catch(err => {
            console.warn("Google signInWithPopup failed, trying redirect...", err);
            firebase.auth().signInWithRedirect(provider)
                .catch(redirectErr => {
                    showToast("ERROR: Google Auth failed - " + redirectErr.message);
                });
        });
}

// First Time Profile Setup Actions
let currentSetupEmoji = '♟️';
function selectSetupAvatar(element, emoji) {
    const items = document.querySelectorAll('.avatar-setup-item');
    items.forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    currentSetupEmoji = emoji;
}

function generateSetupUID() {
    const pid = FtechSystem.generatePlayerId ? FtechSystem.generatePlayerId() : ('FUTX' + Math.floor(100000 + Math.random() * 900000));
    FtechSystem.account.playerId = pid;
    const el = document.getElementById('setup-generated-uid');
    if (el) el.innerText = pid;
}

async function submitUserProfile() {
    const usernameInput = document.getElementById('setup-username-input').value.trim();
    const country = document.getElementById('setup-country-select').value;
    const playerId = FtechSystem.account.playerId || (document.getElementById('setup-generated-uid') && document.getElementById('setup-generated-uid').innerText);

    if (FtechSystem.containsEmoji && FtechSystem.containsEmoji(usernameInput)) {
        showToast('Usernames cannot contain emojis or emoticons.');
        return;
    }

    let avatarId = 'avatar_pawn';
    if (currentSetupEmoji === '♞') avatarId = 'avatar_knight';
    if (currentSetupEmoji === '♝') avatarId = 'avatar_bishop';
    if (currentSetupEmoji === '♜') avatarId = 'avatar_rook';
    if (currentSetupEmoji === '♛') avatarId = 'avatar_queen';
    if (currentSetupEmoji === '♚') avatarId = 'avatar_king';

    if (FtechSystem.sessionActive && FtechSystem.currentUser) {
        FtechSystem.account.uid = FtechSystem.currentUser.uid;
    }

    showToast('VERIFYING USERNAME AVAILABILITY...');
    const result = await FtechSystem.validateAndSetProfileSetup({
        username: usernameInput,
        avatar: avatarId,
        country,
        playerId
    });

    if (!result.ok) {
        showToast(result.msg || 'Profile setup failed.');
        return;
    }

    showToast('LEGEND PROFILE COMMISSIONED SUCCESSFULLY.');
    transitionScreenV3('lobby');
    syncLobbyHUD();
}

// Synchronize top HUD indicators
function syncLobbyHUD() {
    const acc = FtechSystem.account;
    const details = FtechSystem.getRankDetails(acc.rp);
    const avatarAsset = FtechSystem.catalog.avatars.find(a => a.id === acc.avatar) || FtechSystem.catalog.avatars[0];
    const frameAsset = FtechSystem.catalog.frames.find(f => f.id === acc.frame) || FtechSystem.catalog.frames[0];
   
    // Set text displays
    const displayedName = FtechSystem.formatDisplayName ? FtechSystem.formatDisplayName(acc.username) : acc.username;
    document.getElementById('hud-username-display').innerHTML = `${displayedName.toUpperCase()} <span class="lobby-hud-level xp-hold-trigger" id="hud-level-display" data-xp-reveal>LVL ${acc.level}</span><span class="xp-hold-tooltip hidden-info" id="hud-xp-tooltip"></span>`;
    initXpHoldReveal();
    document.getElementById('hud-rank-name').innerText = `${details.rankName} ${details.subTier}`;
    document.getElementById('hud-wallet-coins-val').innerText = acc.coins;
    const gemsEl = document.getElementById('hud-wallet-gems-val');
    if (gemsEl) gemsEl.innerText = acc.gems || 0;

    const rankLabel = document.getElementById('lobby-rank-label');
    const rankRpText = document.getElementById('lobby-rank-rp-text');
    const rankBar = document.getElementById('lobby-rank-progress-bar');
    const rankBadgeWrap = document.getElementById('lobby-rank-badge-wrap');
    if (rankLabel) rankLabel.innerText = details.fullLabel.toUpperCase();
    if (rankRpText) {
        const nextTier = FtechSystem.RANK_TIERS.find(t => t.minRp > acc.rp);
        if (nextTier) {
            rankRpText.innerText = `${acc.rp} / ${nextTier.minRp} RP`;
        } else {
            rankRpText.innerText = `${acc.rp} RP — MAX TIER`;
        }
    }
    if (rankBar) rankBar.style.width = details.progress + '%';
    if (rankBadgeWrap) {
        rankBadgeWrap.innerHTML = generateRankBadgeSVG(details.rankId || 'pawn', true, details.progress);
    }
   
    // Avatar emoji
    document.getElementById('hud-avatar-emoji').innerText = avatarAsset.icon;
   
    // Frame ring color + tier styling
    const frameBox = document.getElementById('hud-avatar-frame-box');
    if (frameBox) {
        frameBox.style.borderColor = frameAsset.border || 'transparent';
        frameBox.className = 'lobby-hud-avatar-frame ' + getTierFrameClass(details.rankGroup);
    }
   
    // Link connection footer
    document.getElementById('status-text').innerText = FtechSystem.sessionActive ? "FIRESTORE ADVANCED SYNCED" : "OFFLINE GUEST CONTENDER ACTIVE";
    const dot = document.getElementById('status-dot');
    if (dot) {
        dot.className = FtechSystem.sessionActive ? "status-indicator success" : "status-indicator offline";
    }
}
window.updateTopHUD = syncLobbyHUD;

// Open Slider Navigation hamburger Drawer
function openSlideDrawer() {
    document.getElementById('left-slide-drawer').classList.add('open-drawer');
    document.getElementById('drawer-overlay-box').classList.add('open-drawer');
}

function closeSlideDrawer() {
    document.getElementById('left-slide-drawer').classList.remove('open-drawer');
    document.getElementById('drawer-overlay-box').classList.remove('open-drawer');
}

// -----------------------------------------------------
// MODALS SYSTEM (V3 POLISHED MODULES WITH SCROLLBARS)
// -----------------------------------------------------

// Helper for modal showing
function showModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.classList.remove('hidden-modal');
        el.classList.add('visible-modal');
        try {
            history.pushState({ modalId: modalId }, "");
        } catch (e) {}
    }
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.classList.add('hidden-modal');
        el.classList.remove('visible-modal');
        try {
            if (history.state && history.state.modalId === modalId) {
                history.back();
            }
        } catch (e) {}
    }
}

// 1. VS Computer Menu Actions
function openVSComputerMenu() {
    showModal('vs-computer-modal');
}

function closeVSComputerMenu() {
    closeModal('vs-computer-modal');
}

function setSelectColor(color) {
    selectedColor = color;
    const btnW = document.getElementById('color-select-white');
    const btnB = document.getElementById('color-select-black');
   
    if (color === 'w') {
        btnW.className = 'btn btn-primary';
        btnB.className = 'btn btn-outline';
        btnB.style.borderColor = '#333';
        btnB.style.color = '#888';
    } else {
        btnB.className = 'btn btn-primary';
        btnW.className = 'btn btn-outline';
        btnW.style.borderColor = '#333';
        btnW.style.color = '#888';
    }
}

function startV3ComputerMatch() {
    if (typeof clearPrivateRoomState === 'function') clearPrivateRoomState();
    const diff = document.getElementById('v3-computer-diff').value;
    FtechSystem.computerDifficulty = diff;
    FtechSystem.currentGameMode = 'computer';
    FtechSystem.matchOpponentInfo = { username: 'Adaptive Bot', isBot: true, rp: FtechSystem.account.rp };
   
    localPlayMode = true;
    window.moveAssistEnabled = true;
    myPlayerColor = selectedColor;
   
    closeVSComputerMenu();
    transitionScreenV3('game-screen');
   
    if (typeof updateMatchPlayerNames === 'function') {
        updateMatchPlayerNames('Adaptive Bot (' + diff.toUpperCase() + ')', FtechSystem.account.rp, true);
    }
   
    activeEngine.reset();
    syncPiecesWithEngineState();
    startMatch();
}

// 2. Private Room Menu Actions
function openPrivateRoomMenu() {
    showModal('private-room-modal');
}

function closePrivateRoomMenu() {
    closeModal('private-room-modal');
}

function createV3RoomGame() {
    const mode = document.getElementById('v3-room-mode').value;
    const entryTier = document.getElementById('v3-room-entry-fee')?.value || 'none';
    FtechSystem.currentEntryFeeTier = entryTier;
    if (entryTier !== 'none' && !FtechSystem.deductEntryFee(entryTier)) return;
    FtechSystem.currentGameMode = mode === 'ranked' ? 'ranked' : 'friend';
    window.moveAssistEnabled = (mode === 'classic');
   
    closePrivateRoomMenu();
    showToast('PROVISIONING ROOM IDENTIFIER IN CLOUD...');
    createRoom();
    startWaitingRoomFriendRoster();
}

function joinV3RoomGame() {
    const code = document.getElementById('v3-join-input').value.trim().toUpperCase();
    if (code.length !== 6) {
        showToast("LOBBY CODES EXCLUSIVELY RANGE 6 CHARACTERS.");
        return;
    }
    closePrivateRoomMenu();
    const inputEl = document.getElementById('join-room-input') || document.getElementById('v3-join-input');
    if (inputEl) inputEl.value = code;
    joinRoomFromInput();
}

// 3. Friends Panel System Actions
function openFriendsPanel() {
    showModal('friends-modal');
    renderFriendsRoster();
}

function closeFriendsPanel() {
    closeModal('friends-modal');
}

function setFriendsSubTab(tab) {
    activeFriendsSubTab = tab;
    const tabs = ['online', 'requests', 'search', 'recents', 'blocked'];
    
    // Toggle active classes and display block
    tabs.forEach(t => {
        const btn = document.getElementById(`friends-tab-btn-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        
        if (btn) {
            btn.className = tab === t ? 'btn active-tab' : 'btn';
            btn.style.color = tab === t ? '#fff' : 'var(--text-muted)';
        }
        if (content) {
            content.style.display = tab === t ? 'flex' : 'none';
        }
    });
    
    if (tab === 'online') renderFriendsRoster();
}

function simulateLocalFriendAddition(val) {
    showToast(`FRIEND REQUEST TRANSMITTED TO ${val.toUpperCase()}!`);
    FtechSystem.friends.push({
        id: 'f_new_' + Math.random(),
        name: val,
        level: Math.floor(Math.random() * 20) + 1,
        rank: 'Pawn III',
        online: true,
        lastSeen: 'Active'
    });
    renderFriendsRoster();
}

function sendFirestoreFriendRequest(doc) {
    const targetData = doc.data();
    const targetUid = doc.id;
    const db = firebase.firestore();
   
    const newReq = {
        id: FtechSystem.account.uid,
        name: FtechSystem.account.username,
        playerId: FtechSystem.account.playerId || 'FUTX0000',
        timestamp: Date.now()
    };
   
    // Read current friendRequests array or default to empty
    const currentReqs = targetData.friendRequests || [];
    currentReqs.push(newReq);
   
    db.collection('users').doc(targetUid).update({
        friendRequests: currentReqs
    }).then(() => {
        showToast(`FRIEND REQUEST TRANSMITTED TO ${targetData.username.toUpperCase()}!`);
    }).catch(err => {
        console.error("Failed to append friend request on Firestore", err);
        showToast("TRANSMISSIVE CORRELANCE OVERFLOW.");
    });
}

function sendV3FriendRequest() {
    const val = document.getElementById('add-friend-v3-input').value.trim().toUpperCase();
    if (!val) {
        showToast("WRITE PLAYER ID OR GAMER TAG.");
        return;
    }
   
    document.getElementById('add-friend-v3-input').value = '';
   
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && FtechSystem.sessionActive) {
        const db = firebase.firestore();
        showToast("SEARCHING COGNATE PLAYER...");
       
        db.collection('users').where('playerId', '==', val).get().then(snapshot => {
            if (snapshot.empty) {
                db.collection('users').where('username', '==', val).get().then(snapshot2 => {
                    if (snapshot2.empty) {
                        simulateLocalFriendAddition(val);
                    } else {
                        sendFirestoreFriendRequest(snapshot2.docs[0]);
                    }
                });
            } else {
                sendFirestoreFriendRequest(snapshot.docs[0]);
            }
        }).catch(err => {
            console.error("Player ID search failed", err);
            simulateLocalFriendAddition(val);
        });
    } else {
        simulateLocalFriendAddition(val);
    }
}

function renderFriendsRoster() {
    const scroller = document.getElementById('friends-list-scroller');
    if (!scroller) return;
    scroller.innerHTML = '';
   
    if (activeFriendsSubTab === 'online') {
        const onlineList = FtechSystem.friends;
        if (onlineList.length === 0) {
            scroller.innerHTML = '<div style="text-align:center; font-size:11px; color:var(--text-muted); padding:30px 0;">NO FRIENDS ENLISTED CURRENTLY</div>';
            return;
        }
        onlineList.forEach(f => {
            const card = document.createElement('div');
            card.style = "background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.04);";
            card.innerHTML = `
                <div style="text-align: left;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size: 8px; color: ${f.online ? '#4af626' : '#555'};">●</span>
                        <strong style="color:#fff; font-size:12px;">${f.name}</strong>
                        <span style="background:var(--blue-accent); color:#fff; font-size:8px; padding:1px 3px; border-radius:2px;">LVL ${f.level}</span>
                    </div>
                    <div style="font-size: 9px; color: var(--gold); margin-top:2px;">RANK: ${f.rank} &bull; ${f.lastSeen}</div>
                </div>
                <div style="display:flex; gap:6px;">
                    ${f.online ? `<button class="btn btn-primary" onclick="inviteFriendToV3Room('${f.name}')" style="font-size: 8px; padding: 6px 10px; width:auto;">VS CHALLENGE</button>` : ''}
                    <button class="btn btn-outline" onclick="deleteV3Friend('${f.id}')" style="font-size: 8px; padding: 6px; width:auto; border-color:rgba(255,51,51,0.2); color:#ff3333;">✖</button>
                </div>
            `;
            scroller.appendChild(card);
        });
    } else if (activeFriendsSubTab === 'requests') {
        const reqs = FtechSystem.friendRequests;
        if (reqs.length === 0) {
            scroller.innerHTML = '<div style="text-align:center; font-size:11px; color:var(--text-muted); padding:30px 0;">NO PENDING INVITES INBOX</div>';
            return;
        }
        reqs.forEach(r => {
            const card = document.createElement('div');
            card.style = "background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.04);";
            card.innerHTML = `
                <div style="text-align: left;">
                    <strong style="color:#fff; font-size:12px;">${r.name}</strong>
                    <div style="font-size: 9.5px; color: var(--text-muted); margin-top:2px;">Wants to connect with you</div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-primary" onclick="acceptV3Friend('${r.id}', '${r.name}')" style="font-size: 8px; padding: 6px 10px; width:auto;">ACCEPT</button>
                    <button class="btn btn-outline" onclick="rejectV3Friend('${r.id}')" style="font-size: 8px; padding: 6px; width:auto; border-color: rgba(255,255,255,0.1)">DECLINE</button>
                </div>
            `;
            scroller.appendChild(card);
        });
    } else {
        const recents = FtechSystem.recentPlayers;
        if (recents.length === 0) {
            scroller.innerHTML = '<div style="text-align:center; font-size:11px; color:var(--text-muted); padding:30px 0;">RECENT CHESS matches ARCHIVIST INACTIVE</div>';
            return;
        }
        recents.forEach(p => {
            const card = document.createElement('div');
            card.style = "background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.04);";
            card.innerHTML = `
                <div style="text-align: left;">
                    <strong style="color:#fff; font-size:12px;">${p.name}</strong>
                    <div style="font-size: 9.5px; color: var(--text-muted); margin-top:2px;">Met ${p.date}</div>
                </div>
                <button class="btn btn-outline" onclick="inviteRecentGamer('${p.name}')" style="font-size: 8px; padding: 6px 10px; width:auto;">SEND INVITE</button>
            `;
            scroller.appendChild(card);
        });
    }
}

function inviteFriendToV3Room(friendName) {
    if (typeof showToast === 'function') {
        showToast(`TRANSMITTING DUEL REQUEST TO ${friendName.toUpperCase()}...`);
    }
    closeFriendsPanel();
    setTimeout(() => {
        // Create the room
        createRoom();
       
        // After 1.5s, look up friend and send live Firestore invite if they are a real user
        setTimeout(() => {
            const rCode = networkSync ? networkSync.roomCode : null;
            if (!rCode) return;
           
            FtechSystem.currentGameMode = 'friend'; // Update game mode to friend!
           
            const friendObj = FtechSystem.friends.find(f => f.name === friendName);
            let isRealFriend = false;
           
            if (friendObj && friendObj.id && !friendObj.id.startsWith('f1') && !friendObj.id.startsWith('f2') && !friendObj.id.startsWith('f3') && !friendObj.id.startsWith('f_added_') && !friendObj.id.startsWith('f_new_')) {
                isRealFriend = true;
                if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && FtechSystem.sessionActive) {
                    const db = firebase.firestore();
                    db.collection('users').doc(friendObj.id).update({
                        incomingInvitation: {
                            hostId: FtechSystem.account.uid,
                            hostName: FtechSystem.account.username,
                            roomCode: rCode,
                            timestamp: Date.now()
                        }
                    }).then(() => {
                        showToast(`LIVE DUEL INVITATION SENT TO ${friendName.toUpperCase()}!`);
                    }).catch(err => {
                        console.error("Firestore user invitation failed", err);
                    });
                }
            }
           
            // If they are not real, or as safety fallback if offline/local, run 5s acceptance simulation so the lobby remains playable!
            if (!isRealFriend) {
                setTimeout(() => {
                    if (networkSync && networkSync.roomCode && networkSync.db && networkSync.roomCode === rCode) {
                        console.log(`Simulated friend ${friendName} is accepting invite for room code ${rCode}`);
                        if (typeof showToast === 'function') {
                            showToast(`${friendName.toUpperCase()} ACCEPTED YOUR DUEL REQUEST! JOINING...`);
                        }
                       
                        const friendId = 'friend_' + friendName.toLowerCase().replace(/\s+/g, '_');
                        const joinEvent = {
                            action: 'player_joined',
                            payload: { joinedPlayerId: friendId },
                            sender: friendId,
                            timestamp: Date.now()
                        };
                       
                        networkSync.db.collection('rooms').doc(rCode).update({
                            joinedPlayerId: friendId,
                            events: firebase.firestore.FieldValue.arrayUnion(joinEvent),
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        }).then(() => {
                            console.log(`Successfully updated Firestore for friend ${friendName} joining.`);
                        }).catch(err => {
                            console.error("Failed to push client friend join event:", err);
                        });
                    }
                }, 4000); // 4 seconds wait
            }
        }, 1500);
    }, 1000);
}

function deleteV3Friend(fid) {
    FtechSystem.friends = FtechSystem.friends.filter(f => f.id !== fid);
    showToast("FRIEND REMOVED FROM GENERAL ROSTER.");
    renderFriendsRoster();
}

function joinRoomDirectly(code) {
    if (!networkSync) {
        try {
            if (typeof getChessMultiplayer === 'function') {
                networkSync = getChessMultiplayer(handleSocketMessage, handleSocketStatus);
            } else if (typeof ChessMultiplayer !== 'undefined') {
                networkSync = new ChessMultiplayer(handleSocketMessage, handleSocketStatus);
            }
        } catch (e) {
            console.error("Failed to initialize ChessMultiplayer:", e);
        }
    }
    if (!networkSync) {
        showToast("ONLINE SYSTEMS UNREACHABLE.");
        return;
    }
    try {
        const outcome = networkSync.joinRoom(code);
        if (outcome) {
            myPlayerColor = 'b';
            localPlayMode = false;
           
            const roomCodeBox = document.getElementById('room-code-display-box');
            if (roomCodeBox) roomCodeBox.classList.remove('hidden-info');
            const roomCodeVal = document.getElementById('game-room-code');
            if (roomCodeVal) roomCodeVal.innerText = code;
           
            transitionScreenV3('game-screen');
        }
    } catch(err) {
        console.error("Failed programmatic joining", err);
    }
}

function acceptV3Friend(id, name) {
    FtechSystem.friendRequests = FtechSystem.friendRequests.filter(r => r.id !== id);
    FtechSystem.friends.push({
        id: id,
        name: name,
        level: Math.floor(Math.random() * 12) + 2,
        rank: 'Pawn III',
        online: true,
        lastSeen: 'Active'
    });
   
    // Symmetrical Firestore alignment
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && FtechSystem.sessionActive) {
        const db = firebase.firestore();
        db.collection('users').doc(FtechSystem.account.uid).update({
            friendRequests: FtechSystem.friendRequests,
            friends: FtechSystem.friends
        }).then(() => {
            const myselfFriendObj = {
                id: FtechSystem.account.uid,
                name: FtechSystem.account.username,
                level: FtechSystem.account.level,
                rank: 'Pawn III',
                online: true,
                lastSeen: 'Active'
            };
            db.collection('users').doc(id).update({
                friends: firebase.firestore.FieldValue.arrayUnion(myselfFriendObj)
            });
        }).catch(err => console.error("Firestore acceptV3Friend error", err));
    }
   
    showToast(`CONNECTED SUCCESSFULLY WITH ${name.toUpperCase()}!`);
    renderFriendsRoster();
}

function rejectV3Friend(id) {
    FtechSystem.friendRequests = FtechSystem.friendRequests.filter(r => r.id !== id);
    showToast("INVITATION DECLINED.");
    renderFriendsRoster();
}

function inviteRecentGamer(name) {
    showToast(`FRIEND REQ TRANSMITTED TO ${name.toUpperCase()}!`);
}

// 4. Customizing Store Modal
function openStorePanel() {
    showModal('store-modal');
    renderStoreGrid();
}

function closeStorePanel() {
    closeModal('store-modal');
}

function setStoreCategory(cat) {
    activeStoreCategory = cat;
    ['avatars', 'frames', 'titles', 'themes', 'skins', 'boards', 'sounds', 'emotes'].forEach(c => {
        const btn = document.getElementById(`store-cat-btn-${c}`);
        if (btn) {
            btn.className = c === cat ? 'btn active-tab' : 'btn';
            btn.style.color = c === cat ? '#fff' : 'var(--text-muted)';
        }
    });
    renderStoreGrid();
}

function renderStoreGrid() {
    const scroller = document.getElementById('store-items-scroller');
    if (!scroller) return;
    scroller.innerHTML = '';
   
    const acc = FtechSystem.account;
    const items = FtechSystem.catalog[activeStoreCategory] || [];
   
    items.forEach(item => {
        const owned = acc.inventory.includes(item.id);
        let equipped = false;
       
        if (activeStoreCategory === 'avatars') equipped = (acc.avatar === item.id);
        if (activeStoreCategory === 'frames') equipped = (acc.frame === item.id);
        if (activeStoreCategory === 'titles') equipped = (acc.title === item.id);
        if (activeStoreCategory === 'themes') equipped = (acc.theme === item.id);
        if (activeStoreCategory === 'skins') equipped = (acc.skin === item.id || acc.equippedSkin === item.id);
        if (activeStoreCategory === 'boards') equipped = (acc.board === item.id || acc.equippedBoard === item.id);
        if (activeStoreCategory === 'sounds') equipped = (acc.sound === item.id);
        if (activeStoreCategory === 'emotes') equipped = (acc.equippedEmotes && acc.equippedEmotes.includes(item.id));
       
        const rarityColors = {
            'Common': '#b0bec5',
            'Rare': '#64b5f6',
            'Epic': '#ba68c8',
            'Legendary': '#ffca28',
            'Mythic': '#ff3d00'
        };
        const rColor = rarityColors[item.rarity || 'Common'];

        const card = document.createElement('div');
        card.className = 'store-item';
        card.style = `background:#050505; border:1px solid ${equipped ? 'var(--gold)' : rColor}; box-shadow: 0 4px 15px ${rColor}15; border-radius:6px; padding:12px; text-align:center; display:flex; flex-direction:column; justify-content:space-between; gap:6px; position:relative; overflow:hidden; min-height: 120px;`;
       
        let visualHtml = '';
        if (activeStoreCategory === 'avatars') {
            visualHtml = `<div style="font-size:36px; padding: 6px 0;">${item.icon}</div>`;
        } else if (activeStoreCategory === 'frames') {
            visualHtml = `<div class="store-frame-preview" style="width:34px; height:34px; border:3px solid ${item.border}; border-radius:50%; margin:8px auto; background:#111;"></div>`;
        } else if (activeStoreCategory === 'titles') {
            visualHtml = `<div style="font-size:10px; font-weight:900; background:rgba(223,183,108,0.1); color:var(--gold); display:inline-block; margin: 10px auto; padding: 4px 10px; border-radius:4px;">${item.name.toUpperCase()}</div>`;
        } else if (activeStoreCategory === 'themes') {
            visualHtml = `<div style="font-size:28px; padding: 10px 0; color:${rColor}">🎨</div>`;
        } else if (activeStoreCategory === 'sounds') {
            visualHtml = `<div style="font-size:28px; padding: 10px 0; color:${rColor}">🔊</div>`;
        } else if (activeStoreCategory === 'emotes') {
            visualHtml = `<div style="font-size:36px; padding: 6px 0;">${item.icon || '💬'}</div>`;
        } else if (activeStoreCategory === 'boards') {
            visualHtml = `<div style="font-size:28px; padding: 10px 0;">${item.icon || '🟫'}</div>`;
        } else {
            const colorClass = item.id === 'skin_obsidian' ? '#ff3d00' : (item.id === 'skin_blue' || item.id === 'skin_neon' ? '#00b0ff' : (item.id === 'skin_royal_gold' ? '#ffca28' : '#aaaaaa'));
            visualHtml = `<div style="font-size:28px; color:${colorClass}; padding: 10px 0;">♞</div>`;
        }
       
        let actionBtnHtml = '';
        if (equipped) {
            actionBtnHtml = `<span style="background:var(--gold-dark); color:#000; font-size:8px; font-weight:800; padding:6px; border-radius:4px; letter-spacing:0.5px; width:100%; display:block; text-align:center;">EQUIPPED</span>`;
        } else if (owned) {
            actionBtnHtml = `<button class="btn" onclick="equipV3Item('${activeStoreCategory}', '${item.id}')" style="font-size:8.5px; padding:5px 0; background:#333; color:#fff; width:100%;">EQUIP</button>`;
        } else {
            actionBtnHtml = `<button class="btn btn-primary" onclick="purchaseV3Item('${activeStoreCategory}', '${item.id}', ${item.cost})" style="font-size:8.5px; padding:5px 0; width:100%;">🪙 ${item.cost}</button>`;
        }
       
        card.innerHTML = `
            <div style="position:absolute; top:4px; right:4px; font-size:7px; font-weight:800; color:${rColor}; text-transform:uppercase; background:rgba(0,0,0,0.5); padding:2px 4px; border-radius:2px;">${item.rarity || 'Common'}</div>
            <div>
                ${visualHtml}
                <div style="font-size:11px; font-weight:800; color:#fff; margin-top:2px;">${item.name}</div>
            </div>
            <div style="margin-top:6px;">
                ${actionBtnHtml}
            </div>
        `;
       
        scroller.appendChild(card);
    });
}

function equipV3Item(category, itemId) {
    FtechSystem.equipItem(category, itemId);
    showToast("ITEM EQUIPPED.");
    renderStoreGrid();
    syncLobbyHUD();
}

function purchaseV3Item(category, itemId, cost) {
    if (FtechSystem.account.coins < cost) {
        showToast("INSUFFICIENT FUNDS. BATTLE MORE ENGINE LEVELS!");
        return;
    }
    FtechSystem.purchaseItem(category, itemId, cost);
    // Success Toast handled inside FtechSystem
    renderStoreGrid();
    syncLobbyHUD();
}

// 5. Achievements Panel System
function openAchievementsPanel() {
    showModal('achievements-modal');
    renderAchievementsList();
}

function closeAchievementsPanel() {
    closeModal('achievements-modal');
}

function renderAchievementsList() {
    const scroller = document.getElementById('achievements-list-scroller');
    if (!scroller) return;
    scroller.innerHTML = '';
   
    const acc = FtechSystem.account;
   
    // Core Achievements arrays config
    const sourceAchievements = [
        { id: 'first_win', name: 'First Victory', desc: 'Secure first win under chess rules.', coins: 100, goal: 1, current: acc.wins },
        { id: 'wins_10', name: 'Commander Ten', desc: 'Slay computer or online players 10 times.', coins: 500, goal: 10, current: acc.wins },
        { id: 'wins_100', name: 'Centurion Legend', desc: 'Claim monumental milestone of 100 wins.', coins: 2500, goal: 100, current: acc.wins },
        { id: 'matches_5', name: 'Veteran Challenger', desc: 'Complete 5 matches with general rules.', coins: 200, goal: 5, current: acc.matches }
    ];
   
    sourceAchievements.forEach(ach => {
        const completed = ach.current >= ach.goal;
        const claimed = acc.achievements.includes(ach.id);
        const progressPercent = Math.min(100, Math.floor((ach.current / ach.goal) * 100));
       
        const card = document.createElement('div');
        card.style = "background:#050505; border:1px solid " + (completed ? 'rgba(223,183,108,0.2)' : 'rgba(255,255,255,0.03)') + "; border-radius:6px; padding:12px; display:flex; align-items:center; justify-content:space-between; gap:12px;";
       
        let actionHtml = '';
        if (claimed) {
            actionHtml = `<span style="color:#4af626; font-size:10px; font-weight:800;">✔️ CLAIMED</span>`;
        } else if (completed) {
            actionHtml = `<button class="btn btn-primary" onclick="claimV3AchReward('${ach.id}', ${ach.coins})" style="font-size: 8.5px; padding:6px 12px; width:auto;">CLAIM 🪙${ach.coins}</button>`;
        } else {
            actionHtml = `<span style="color:var(--text-muted); font-size:9.5px; font-weight:700;">LOCKED</span>`;
        }
       
        card.innerHTML = `
            <div style="text-align: left; flex:1;">
                <div style="font-weight:800; color:${completed ? 'var(--gold)' : '#fff'}; font-size:12px; display:flex; align-items:center; gap:6px;">
                    👑 ${ach.name} <span style="font-size:8px; background:rgba(255,255,255,0.08); color: var(--text-light); padding:1px 4px; border-radius:2px;">🪙 +${ach.coins}</span>
                </div>
                <p style="font-size: 9.5px; color: var(--text-muted); margin: 3px 0 6px 0; line-height:1.2;">${ach.desc}</p>
               
                <!-- Gauge -->
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex:1; height:3px; background:rgba(255,255,255,0.04); border-radius:2px; overflow:hidden;">
                        <div style="width: ${progressPercent}%; height:100%; background:${completed ? 'var(--gold)' : 'var(--blue-accent)'};"></div>
                    </div>
                    <span style="font-family:var(--font-mono); font-size:8px; color:var(--text-muted);">${ach.current}/${ach.goal}</span>
                </div>
            </div>
            <div>
                ${actionHtml}
            </div>
        `;
        scroller.appendChild(card);
    });
}

function claimV3AchReward(id, reward) {
    FtechSystem.account.achievements.push(id);
    FtechSystem.account.coins += reward;
    FtechSystem.saveData();
    showToast(`CLAIMED ACHIEVEMENT REWARD: 🪙+${reward}!`);
    renderAchievementsList();
    syncLobbyHUD();
}

// Helper calculation for calendar day boundaries
function getCalendarDaysDifference(timestamp1, timestamp2) {
    if (timestamp1 === 0 || timestamp2 === 0) return 0;
    const d1 = new Date(timestamp1);
    const d2 = new Date(timestamp2);
    const utcd1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utcd2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
   
    // Calculate full 24-hr unit differences
    return Math.floor((utcd2 - utcd1) / (24 * 60 * 60 * 1000));
}

// Global automated maintenance for daily rewards streaks (YYYY-MM-DD calendar)
function maintainDailyRewards() {
    const acc = FtechSystem.account;
    const today = FtechSystem.getServerDateString ? FtechSystem.getServerDateString() : new Date().toISOString().slice(0, 10);
    if (!acc.claimedDailyDays) acc.claimedDailyDays = [];
    if (!acc.lastClaimDate) acc.lastClaimDate = '';
    if (!acc.streakCount) acc.streakCount = 0;

    // V3 migration / fresh start check:
    // If the V3 claimed list is empty, make sure lastClaimDate is cleared
    // so they are not blocked by legacy V2 claims.
    if (acc.claimedDailyDays.length === 0 && acc.lastClaimDate !== '') {
        acc.lastClaimDate = '';
        acc.dailyRewardStreak = 0;
        acc.dailyRewardCalendar = [];
        FtechSystem.saveData();
    }

    if (acc.lastClaimDate && acc.lastClaimDate > today) {
        return { canClaim: false, isCheating: true, diff: 0, nextDay: 1 };
    }

    let diff = 0;
    if (acc.lastClaimDate) {
        const d1 = new Date(acc.lastClaimDate + 'T12:00:00');
        const d2 = new Date(today + 'T12:00:00');
        diff = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
    }

    if (acc.lastClaimDate && diff > 1) {
        acc.streakCount = 0;
        acc.claimedDailyDays = [];
        acc.lastClaimDate = '';
        acc.dailyRewardStreak = 0;
        acc.dailyRewardCalendar = [];
        FtechSystem.saveData();
    }

    if (acc.claimedDailyDays.length >= 7 && diff >= 1) {
        acc.claimedDailyDays = [];
        acc.streakCount = 0;
        acc.lastClaimDate = '';
        acc.dailyRewardStreak = 0;
        acc.dailyRewardCalendar = [];
        FtechSystem.saveData();
    }

    const nextDay = acc.claimedDailyDays.length + 1;
    const canClaimToday = !acc.lastClaimDate || acc.lastClaimDate !== today;
    return { canClaim: canClaimToday, isCheating: false, diff, nextDay };
}

// 6. Daily Calendar Rewards claims
function openDailyRewardsClaimPanel() {
    showModal('daily-rewards-modal');
    renderDailyRewardsGrid();
}

function closeDailyRewardsClaimPanel() {
    closeModal('daily-rewards-modal');
}

let claimInProgress = false;

function renderDailyRewardsGrid() {
    const grid = document.getElementById('v3-daily-rewards-grid');
    if (!grid) return;
    grid.innerHTML = '';
   
    const acc = FtechSystem.account;
    const rewards = [
        { day: 1, text: 'Day 1', reward: '🪙 150', icon: '🪙', coins: 150 },
        { day: 2, text: 'Day 2', reward: '🪙 250', icon: '🪙', coins: 250 },
        { day: 3, text: 'Day 3', reward: '♞ Avatar', icon: '♞', item: 'avatar_knight' },
        { day: 4, text: 'Day 4', reward: '🪙 500', icon: '🪙', coins: 500 },
        { day: 5, text: 'Day 5', reward: '⭕ Frame', icon: '⭕', item: 'frame_silver' },
        { day: 6, text: 'Day 6', reward: '🪙 1000', icon: '🪙', coins: 1000 },
        { day: 7, text: 'Day 7', reward: '👑 Pre-Pack', icon: '👑', coins: 2500, item: 'title_tactician' }
    ];
   
    // Auto-maintain rewards variables before rendering
    const integrity = maintainDailyRewards();
    const canClaimToday = integrity.canClaim && !integrity.isCheating;
   
    rewards.forEach(r => {
        const claimed = acc.claimedDailyDays.includes(r.day);
       
        // Sequential eligibility check
        const nextTargetDay = acc.claimedDailyDays.length + 1;
        const currentTarget = (r.day === nextTargetDay) && canClaimToday;
       
        const btn = document.createElement('button');
        btn.disabled = claimed || !currentTarget;
        
        // AAA Glassmorphism & Esports Premium Styling
        btn.style = `
            background: ${claimed ? 'rgba(74,246,38,0.06)' : currentTarget ? 'rgba(255,255,255,0.05)' : 'rgba(10,10,10,0.6)'};
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid ${claimed ? '#4af626' : currentTarget ? 'var(--gold)' : 'rgba(255,255,255,0.08)'};
            box-shadow: ${currentTarget ? '0 0 15px rgba(223, 183, 108, 0.4), inset 0 0 10px rgba(223, 183, 108, 0.1)' : 'none'};
            transform: ${currentTarget ? 'scale(1.02)' : 'scale(1)'};
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            border-radius: 12px;
            padding: 12px 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            height: 95px;
            cursor: ${claimed || !currentTarget ? 'default' : 'pointer'};
            position: relative;
            overflow: hidden;
        `;
        
        if (currentTarget && !claimed) {
            btn.onmouseover = () => {
                btn.style.transform = 'scale(1.08)';
                btn.style.boxShadow = '0 0 25px rgba(223, 183, 108, 0.6), inset 0 0 15px rgba(223, 183, 108, 0.2)';
            };
            btn.onmouseout = () => {
                btn.style.transform = 'scale(1.02)';
                btn.style.boxShadow = '0 0 15px rgba(223, 183, 108, 0.4), inset 0 0 10px rgba(223, 183, 108, 0.1)';
            };
        }
       
        btn.onclick = () => claimV3DailySlot(r);
       
        let statusText = claimed ? 'Claimed ✔️' : currentTarget ? 'READY 🔥' : 'Locked';
        
        // Inner content with premium glow for current target
        btn.innerHTML = `
            ${currentTarget && !claimed ? '<div style="position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:radial-gradient(circle, rgba(223,183,108,0.15) 0%, transparent 60%); animation: rotateGlow 4s linear infinite;"></div>' : ''}
            <div style="font-size:11px; font-family:var(--font-display); font-weight:800; color:${claimed ? '#4af626' : currentTarget ? 'var(--gold)' : 'rgba(255,255,255,0.4)'}; z-index:1;">${r.text}</div>
            <div style="font-size:24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); z-index:1;">${r.icon}</div>
            <div style="font-size:9px; font-weight:bold; color:${claimed ? '#4af626' : 'var(--text-muted)'}; text-transform:uppercase; z-index:1; letter-spacing:0.5px;">${statusText}</div>
        `;
        
        if (r.day === 7) {
            btn.classList.add('day-7-chest');
            btn.style.gridColumn = 'span 2';
        }
       
        grid.appendChild(btn);
    });
}

function claimV3DailySlot(rObj) {
    if (claimInProgress) {
        console.warn("Claim already in progress, ignoring double-click.");
        return;
    }
    claimInProgress = true;
    try {
        const acc = FtechSystem.account;
        const today = FtechSystem.getServerDateString ? FtechSystem.getServerDateString() : new Date().toISOString().slice(0, 10);

        const integrity = maintainDailyRewards();
        if (integrity.isCheating) {
            showToast('SECURITY ERROR: INVALID CALENDAR DATE DETECTED!');
            return;
        }
        if (!integrity.canClaim) {
            showToast('REWARD ALREADY CLAIMED TODAY.');
            return;
        }

        const expectedDay = acc.claimedDailyDays.length + 1;
        if (rObj.day !== expectedDay) {
            showToast(`CLAIM DAY ${expectedDay} IS AVAILABLE TODAY.`);
            return;
        }

        acc.claimedDailyDays.push(rObj.day);
        acc.lastClaimDate = today;
        acc.lastDailyClaimTimestamp = Date.now();
        acc.streakCount = (acc.streakCount || 0) + 1;

        if (rObj.coins) acc.coins += rObj.coins;
        if (rObj.item) {
            if (!acc.inventory) acc.inventory = [];
            if (!acc.inventory.includes(rObj.item)) acc.inventory.push(rObj.item);
        }

        FtechSystem.saveData();
        showToast(`CLAIMED Day ${rObj.day}! Streak: ${acc.streakCount}`);
        
        // Refresh grids and HUDs
        renderDailyRewardsGrid();
        if (typeof syncLobbyHUD === 'function') syncLobbyHUD();
        if (typeof updateTopHUD === 'function') updateTopHUD();
    } finally {
        claimInProgress = false;
    }
}

function resetV3DailyStreak() {
    if (!FtechSystem.account) return;
    FtechSystem.account.claimedDailyDays = [];
    FtechSystem.account.lastClaimDate = '';
    FtechSystem.account.dailyRewardStreak = 0;
    FtechSystem.account.dailyRewardCalendar = [];
    FtechSystem.account.lastDailyClaimTimestamp = 0;
    FtechSystem.account.streakCount = 0;
    
    FtechSystem.saveData();
    showToast("DAILY CALENDAR RESET COMPLETE.");
    renderDailyRewardsGrid();
    if (typeof syncLobbyHUD === 'function') syncLobbyHUD();
}

// ─── COACH ASSISTANCE & HINT SHOP SYSTEM ──────────────────────────────────────
function getUnlockedHints() {
    const acc = FtechSystem.account;
    const details = FtechSystem.getRankDetails(acc.rp);
    const rank = (details.rankId || 'pawn').toLowerCase();

    const hints = [
        { id: 'best_move', name: 'Best Move Hint', cost: 10, minRank: 'pawn', desc: 'Highlights the strongest move on the board from the coach.', badge: 'Pawn' },
        { id: 'tactical', name: 'Tactical Hint', cost: 15, minRank: 'knight', desc: 'Scans the board for positive material trades or tactical piece forks.', badge: 'Knight' },
        { id: 'threat_scanner', name: 'Threat Scanner', cost: 20, minRank: 'bishop', desc: 'Highlights attacked player pieces in red on the 3D board.', badge: 'Bishop' },
        { id: 'blunder_shield', name: 'Blunder Shield', cost: 25, minRank: 'rook', desc: 'Warns you before committing a game blunder or exposing your king.', badge: 'Rook' }
    ];

    const rankOrder = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'grandmaster', 'legend'];
    const currentRankIndex = rankOrder.indexOf(rank);

    return hints.map(h => {
        const reqIndex = rankOrder.indexOf(h.minRank);
        const unlocked = currentRankIndex >= reqIndex || currentRankIndex >= 4; // Rook and higher unlocks all hints
        return { ...h, unlocked };
    });
}

function openCoachHintStore() {
    const isRanked = FtechSystem.currentGameMode === 'ranked';
    const isTournament = FtechSystem.currentGameMode === 'tournament';
    
    if (isRanked) {
        showToast("Coach Assistance Disabled In Ranked Mode");
        return;
    }
    if (isTournament) {
        showToast("Coach Assistance Disabled in Tournament Mode");
        return;
    }
    
    if ((window.matchHintUsage || 0) >= 3) {
        showToast("Hint Limit Reached");
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'coach-hint-store-modal';
    modal.className = 'modal-overlay';
    
    const acc = FtechSystem.account;
    const unlockedHints = getUnlockedHints();
    
    let listHtml = '';
    unlockedHints.forEach(h => {
        if (h.unlocked) {
            listHtml += `
                <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(223, 183, 108, 0.25); border-radius: 8px; padding: 12px; display:flex; flex-direction:column; gap:6px; text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; font-size:12px; color:#fff;">💡 ${h.name}</span>
                        <span style="font-size:10px; color:var(--gold); font-weight:800;">${h.cost} Coins</span>
                    </div>
                    <p style="font-size:10px; color:var(--text-muted); margin:0;">${h.desc}</p>
                    <button class="btn btn-primary" onclick="confirmHintPurchase('${h.id}', ${h.cost})" style="font-size:9.5px; padding:6px 12px; align-self:flex-end; width:auto; height:auto;">BUY FOR ${h.cost} COINS</button>
                </div>
            `;
        } else {
            listHtml += `
                <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; display:flex; flex-direction:column; gap:6px; text-align:left; opacity:0.6;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; font-size:12px; color:rgba(255,255,255,0.5);">🔒 ${h.name}</span>
                        <span style="font-size:10px; color:rgba(255,255,255,0.3); font-weight:800;">${h.cost} Coins</span>
                    </div>
                    <p style="font-size:10px; color:rgba(255,255,255,0.3); margin:0;">Locked: Requires ${h.badge} Rank</p>
                </div>
            `;
        }
    });

    modal.innerHTML = `
        <div class="modal-card" style="max-width:400px; padding:20px; text-align:center;">
            <button class="modal-close-btn" onclick="closeCoachHintStore()">✖</button>
            <h3 style="font-family:var(--font-display); font-size:14px; color:var(--gold); letter-spacing:1px; margin-bottom:4px;">COACH ASSISTANCE SHOP</h3>
            <p style="font-size:10px; color:var(--text-muted); margin-bottom:16px;">Remaining Match Hints: ${3 - (window.matchHintUsage || 0)}/3 | Wallet: ${acc.coins}🪙</p>
            
            <div style="display:flex; flex-direction:column; gap:10px; max-height:300px; overflow-y:auto; margin-bottom:16px;">
                ${listHtml}
            </div>
            
            <div style="font-size:8.5px; color:var(--text-muted); text-align:center; padding: 6px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                🛡️ ASSISTANCE LIMIT PER MATCH: 3 MAXIMUM
            </div>
        </div>
    `;
    
    document.getElementById('app').appendChild(modal);
}

function closeCoachHintStore() {
    const modal = document.getElementById('coach-hint-store-modal');
    if (modal) modal.remove();
}

function confirmHintPurchase(hintId, cost) {
    const acc = FtechSystem.account;
    if (acc.coins < cost) {
        showToast("Not Enough Coins");
        return;
    }

    const confModal = document.createElement('div');
    confModal.id = 'coach-hint-confirm-modal';
    confModal.className = 'modal-overlay';
    confModal.style.zIndex = '300';
    
    confModal.innerHTML = `
        <div class="modal-card" style="max-width:300px; padding:20px; text-align:center; border: 1px solid var(--gold);">
            <h4 style="font-family:var(--font-display); font-size:12px; color:var(--gold); margin-bottom:12px;">CONFIRM ASSISTANCE</h4>
            <p style="font-size:11px; color:#fff; margin-bottom:20px;">Use ${cost} Coins?</p>
            
            <div style="display:flex; gap:10px; justify-content:center;">
                <button class="btn btn-primary" onclick="executeHintPurchase('${hintId}', ${cost})" style="padding:8px 16px; font-size:10px; width:auto; height:auto;">CONFIRM</button>
                <button class="btn btn-dark-outline" onclick="closeConfirmHintModal()" style="padding:8px 16px; font-size:10px; color:#888; width:auto; height:auto;">CANCEL</button>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(confModal);
}

function closeConfirmHintModal() {
    const m = document.getElementById('coach-hint-confirm-modal');
    if (m) m.remove();
}

function executeHintPurchase(hintId, cost) {
    const acc = FtechSystem.account;
    if (acc.coins < cost) {
        showToast("Not Enough Coins");
        closeConfirmHintModal();
        return;
    }

    acc.coins -= cost;
    if (typeof FtechSystem.saveData === 'function') FtechSystem.saveData();
    if (typeof syncLobbyHUD === 'function') syncLobbyHUD();
    if (typeof updateTopHUD === 'function') updateTopHUD();

    window.matchHintUsage = (window.matchHintUsage || 0) + 1;
    showToast("Coins spent on Coach Hint.");

    // Run specific hint action
    if (hintId === 'best_move') {
        if (typeof runBestMoveHint === 'function') runBestMoveHint();
    } else if (hintId === 'tactical') {
        if (typeof runTacticalHint === 'function') runTacticalHint();
    } else if (hintId === 'threat_scanner') {
        if (typeof runThreatScanner === 'function') runThreatScanner();
    } else if (hintId === 'blunder_shield') {
        if (typeof runBlunderShield === 'function') runBlunderShield();
    }

    closeConfirmHintModal();
    closeCoachHintStore();
    updateHintButtonUI();
}

function runBestMoveHint() {
    if (typeof clearCoachHighlights === 'function') clearCoachHighlights();
    const turn = localPlayMode ? activeEngine.turn : myPlayerColor;
    const aiMove = ChessAI.computeMove(activeEngine, 'medium');
    if (!aiMove) {
        showToast('No coach suggestion available.');
        return;
    }
    const { from, to } = aiMove;
    const files = 'abcdefgh';
    const fromSq = files[from.col] + (8 - from.row);
    const toSq = files[to.col] + (8 - to.row);
    const moving = activeEngine.getPieceAt(from.row, from.col);
    const target = activeEngine.getPieceAt(to.row, to.col);
    let reason = 'Develops piece to a stronger square.';
    let advantage = 'Balanced position';
    if (target) {
        reason = `Captures ${target.type.toUpperCase()} with favorable trade.`;
        advantage = '+' + (ChessAI.getPieceValue ? ChessAI.getPieceValue(target.type) : 100) / 100 + ' material';
    } else if (moving && moving.type === 'p' && (to.row === 0 || to.row === 7)) {
        reason = 'Promote pawn for decisive advantage.';
        advantage = '+9.0 expected';
    } else if (activeEngine.isKingInCheck(turn === 'w' ? 'b' : 'w')) {
        reason = 'Maintains initiative while king is under pressure.';
        advantage = '+1.5 tactical';
    }

    if (typeof highlightCoachMove === 'function') highlightCoachMove(from.row, from.col, to.row, to.col);
    const panel = document.getElementById('coach-result-panel');
    if (panel) {
        panel.classList.remove('hidden-panel');
        console.log('[BEST_MOVE_OPEN] Coach panel purchased and opened.');
        document.getElementById('coach-best-move').innerText = fromSq + ' → ' + toSq;
        document.getElementById('coach-reason').innerText = reason;
        document.getElementById('coach-advantage').innerText = 'Expected: ' + advantage;
    }
}

function runTacticalHint() {
    if (typeof clearCoachHighlights === 'function') clearCoachHighlights();
    const turn = activeEngine.turn;
    let bestTacticalMove = null;
    let maxCaptureVal = 0;
    
    // Scan pieces for possible high-value captures
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = activeEngine.board[r][c];
            if (piece && piece.color === turn) {
                const validMoves = activeEngine.getValidMoves(r, c);
                for (const m of validMoves) {
                    const target = activeEngine.board[m.row][m.col];
                    if (target) {
                        const targetVal = ChessAI.getPieceValue ? ChessAI.getPieceValue(target.type) : 100;
                        if (targetVal >= maxCaptureVal) {
                            maxCaptureVal = targetVal;
                            bestTacticalMove = { from: { row: r, col: c }, to: m };
                        }
                    }
                }
            }
        }
    }

    const aiMove = bestTacticalMove || ChessAI.computeMove(activeEngine, 'medium');
    if (!aiMove) {
        showToast('No tactical opportunities detected.');
        return;
    }

    const { from, to } = aiMove;
    const files = 'abcdefgh';
    const fromSq = files[from.col] + (8 - from.row);
    const toSq = files[to.col] + (8 - to.row);
    
    // Highlight with blue/cyan indicators (0x4fc3f7)
    if (typeof highlightCoachMoveColor === 'function') {
        highlightCoachMoveColor(from.row, from.col, to.row, to.col, 0x4fc3f7);
    } else if (typeof highlightCoachMove === 'function') {
        highlightCoachMove(from.row, from.col, to.row, to.col);
    }
    
    const panel = document.getElementById('coach-result-panel');
    if (panel) {
        panel.classList.remove('hidden-panel');
        console.log('[BEST_MOVE_OPEN] Tactical hint panel opened.');
        document.getElementById('coach-best-move').innerText = fromSq + ' → ' + toSq;
        document.getElementById('coach-reason').innerText = bestTacticalMove ? 'TACTICAL WIN: Positive material capture detected!' : 'Advantageous positional move detected.';
        document.getElementById('coach-advantage').innerText = bestTacticalMove ? 'Expected: Material win' : 'Expected: Tactical pressure';
    }
}

let threatScannerHighlights = [];
function runThreatScanner() {
    clearThreatHighlights();
    const myColor = localPlayMode ? activeEngine.turn : myPlayerColor;
    const opponentColor = myColor === 'w' ? 'b' : 'w';
    let threatsCount = 0;

    const mat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const geom = new THREE.PlaneGeometry(0.9, 0.9);
    geom.rotateX(-Math.PI / 2);

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = activeEngine.board[r][c];
            if (piece && piece.color === myColor) {
                if (activeEngine.isSquareAttacked(r, c, opponentColor)) {
                    const m = new THREE.Mesh(geom, mat.clone());
                    m.position.set(c - 3.5, 0.07, r - 3.5);
                    scene.add(m);
                    threatScannerHighlights.push(m);
                    threatsCount++;
                }
            }
        }
    }

    if (threatsCount > 0) {
        showToast(`Threat Scanner: ${threatsCount} pieces are under enemy attack!`);
        setTimeout(clearThreatHighlights, 6000);
    } else {
        showToast('Threat Scanner: All pieces are secure.');
    }
}

function clearThreatHighlights() {
    threatScannerHighlights.forEach(m => scene.remove(m));
    threatScannerHighlights = [];
}
window.clearThreatHighlights = clearThreatHighlights;

function runBlunderShield() {
    window.blunderShieldActive = true;
    showToast('Blunder Shield activated: Warnings enabled.');
}

function updateHintButtonUI() {
    const btn = document.getElementById('coach-ideas-btn');
    if (!btn) return;
    
    const isRanked = FtechSystem.currentGameMode === 'ranked';
    const isTournament = FtechSystem.currentGameMode === 'tournament';
    
    if (isRanked || isTournament) {
        btn.classList.add('hidden-info');
        btn.style.display = 'none';
        return;
    } else {
        btn.style.display = 'flex';
        btn.classList.remove('hidden-info');
    }
    
    const acc = FtechSystem.account;
    const currentCoins = acc.coins;
    
    const details = FtechSystem.getRankDetails(acc.rp);
    const rank = (details.rankId || 'pawn').toLowerCase();
    
    let costText = "10 Coins";
    if (rank === 'knight') costText = "15 Coins";
    else if (rank === 'bishop') costText = "20 Coins";
    else if (rank === 'rook' || rank === 'queen' || rank === 'king' || rank === 'grandmaster' || rank === 'legend') costText = "25 Coins";
    
    const remaining = 3 - (window.matchHintUsage || 0);
    
    btn.innerHTML = `
        <div style="font-size: 10px; font-weight: 800; display:flex; align-items:center; gap:2px;">💡 Coach Hint</div>
        <div style="font-size: 8px; color: var(--gold); font-weight: 700;">${costText} (Wallet: ${currentCoins}🪙)</div>
        <div style="font-size: 8px; color: var(--text-muted);">Remaining: ${remaining}/3</div>
    `;
}
window.updateHintButtonUI = updateHintButtonUI;
window.openCoachHintStore = openCoachHintStore;
window.confirmHintPurchase = confirmHintPurchase;
window.executeHintPurchase = executeHintPurchase;
window.purchaseCoachAnalysis = openCoachHintStore; // compatibility mapping

// 7. Profile Stats & Collection Modals Coordinator
function openProfilePanel() {
    showModal('profile-details-modal');
    renderProfileDetails();
}

function closeProfilePanel() {
    closeModal('profile-details-modal');
}

function renderProfileDetails() {
    const acc = FtechSystem.account;
    const details = FtechSystem.getRankDetails(acc.rp);
   
    // Map colors
    const rankTitle = `${details.rankName} ${details.subTier}`;
    document.getElementById('p3-username').innerText = acc.username.toUpperCase();
    document.getElementById('p3-level').innerText = `LVL ${acc.level}`;
   
    const titleAsset = FtechSystem.catalog.titles.find(t => t.id === acc.title) || { name: 'Novice Duelist' };
    document.getElementById('p3-title').innerText = titleAsset.name.toUpperCase();
    document.getElementById('p3-uid-display').innerText = acc.playerId || 'FUTX000000';
   
    // Avatar and Custom Frames
    const avatarAsset = FtechSystem.catalog.avatars.find(a => a.id === acc.avatar) || FtechSystem.catalog.avatars[0];
    const frameAsset = FtechSystem.catalog.frames.find(f => f.id === acc.frame) || FtechSystem.catalog.frames[0];
    document.getElementById('p3-avatar-emoji').innerText = avatarAsset.icon;
    document.getElementById('p3-avatar-frame-box').style.borderColor = frameAsset.border || 'transparent';
   
    // Stats
    document.getElementById('p3-stat-matches').innerText = acc.matches;
    document.getElementById('p3-stat-wins').innerText = acc.wins;
    document.getElementById('p3-stat-losses').innerText = acc.losses;
    document.getElementById('p3-stat-draws').innerText = acc.draws;
   
    const winrateVal = acc.matches > 0 ? Math.floor((acc.wins / acc.matches) * 100) : 0;
    document.getElementById('p3-stat-winrate').innerText = winrateVal + '%';
    document.getElementById('p3-stat-shields').innerText = acc.streakShields || 0;
   
    // Rank descriptions and completion SVG badge
    document.getElementById('p3-rank-class-name').innerText = rankTitle.toUpperCase();
    document.getElementById('p3-rp-desc').innerText = `${acc.rp} RP - LEVEL RATIO`;
    document.getElementById('p3-progress-gauge-bar').style.width = details.progress + '%';
   
    // Generate inline Rank Badge SVG dynamically based on rank progression
    const svgBox = document.getElementById('p3-badge-svg-container');
    if (svgBox) {
        svgBox.innerHTML = generateRankBadgeSVG(details.rankId, details.progress);
    }
}

// Generate Custom Dynamic Rank Progression SVG Badge! (No static icons, pure procedurally styled)
function generateRankBadgeSVG(rankId, progress) {
    let badgeColor = '#b0bec5';
    let rankSymbol = '♟️'; // Pawn
   
    if (rankId === 'pawn') { badgeColor = '#b0bec5'; rankSymbol = '♟️'; }
    else if (rankId === 'knight') { badgeColor = '#81c784'; rankSymbol = '♞'; }
    else if (rankId === 'bishop') { badgeColor = '#64b5f6'; rankSymbol = '♝'; }
    else if (rankId === 'rook') { badgeColor = '#ba68c8'; rankSymbol = '♜'; }
    else if (rankId === 'queen') { badgeColor = '#f06292'; rankSymbol = '♛'; }
    else if (rankId === 'king') { badgeColor = '#ffca28'; rankSymbol = '♚'; }
    else if (rankId === 'grandmaster') { badgeColor = '#00e5ff'; rankSymbol = '👑'; }
    else if (rankId === 'legend') { badgeColor = '#ff6d00'; rankSymbol = '🔥'; }
   
    // Dynamic evolution percentage representation
    const dashLength = 176; // (2 * pi * r => radius 28)
    const offset = Math.floor(dashLength - (dashLength * progress) / 100);
   
    return `
        <svg width="68" height="68" viewBox="0 0 64 64" style="filter: drop-shadow(0 0 4px ${badgeColor}40);">
            <!-- Background base circle -->
            <circle cx="32" cy="32" r="28" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.05)" stroke-width="3" />
            <!-- Animated Gold/Crown progression scale ring -->
            <circle cx="32" cy="32" r="28" fill="none" stroke="${badgeColor}" stroke-width="3"
                stroke-dasharray="${dashLength}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 32 32)" style="transition: stroke-dashoffset 1.2s ease-in-out;" />
            <!-- Centered piece evolution symbol representing mechanical tiers -->
            <text x="32" y="41" font-size="28" text-anchor="middle" fill="${badgeColor}" style="text-shadow: 0 0 8px ${badgeColor}">${rankSymbol}</text>
        </svg>
    `;
}

// Collection Modal Viewer
function openCollectionModal() {
    closeProfilePanel();
    showModal('collection-modal');
    renderCollectionItems();
}

function closeCollectionModal() {
    closeModal('collection-modal');
}

function renderCollectionItems() {
    const scroller = document.getElementById('collection-items-scroller');
    if (!scroller) return;
    scroller.innerHTML = '';
   
    const acc = FtechSystem.account;
    const allUnlockedIds = acc.inventory || [];
   
    // Flatten catalog items to search
    const allCatalogItems = [
        ...FtechSystem.catalog.avatars,
        ...FtechSystem.catalog.frames,
        ...FtechSystem.catalog.titles,
        ...FtechSystem.catalog.skins
    ];
   
    const ownedItems = allCatalogItems.filter(item => allUnlockedIds.includes(item.id));
   
    if (ownedItems.length === 0) {
        scroller.innerHTML = '<div style="text-anchor:center; grid-column: 1 / -1; font-size:11px; padding:30px 0; color:var(--text-muted);">INVENTORY COMPLETELY EMPTY. UNLOCK ITEMS IN SHOP!</div>';
        return;
    }
   
    ownedItems.forEach(item => {
        let isEquipped = (acc.avatar === item.id || acc.frame === item.id || acc.title === item.id || acc.skin === item.id);
       
        const card = document.createElement('div');
        card.style = "background:#050505; border:1px solid " + (isEquipped ? 'var(--gold)' : 'rgba(255,255,255,0.04)') + "; border-radius:6px; padding:10px; text-align:center; display:flex; flex-direction:column; justify-content:space-between; gap:4px;";
       
        let visual = '🏆';
        if (item.icon) visual = item.icon;
        else if (item.border) visual = `<div class="store-frame-preview" style="width:24px; height:24px; border:3px solid ${item.border}; border-radius:50%; margin:4px auto;"></div>`;
        else visual = '🏷️';
       
        card.innerHTML = `
            <div>
                <div style="font-size:22px; padding:4px 0;">${visual}</div>
                <div style="font-size:10px; font-weight:800; color:#fff;">${item.name}</div>
            </div>
            <div style="margin-top:6px;">
                ${isEquipped ? `
                    <span style="font-size:8px; color:var(--gold); font-weight:800;">ACTIVE EQUIPMENT</span>
                ` : `
                    <button class="btn btn-outline" onclick="equipCollectedV3Item('${item.id}')" style="font-size:8px; padding:4px 0; border-color: rgba(255,255,255,0.1)">EQUIP</button>
                `}
            </div>
        `;
        scroller.appendChild(card);
    });
}

function equipCollectedV3Item(id) {
    // Detect category by looking up in lists
    let category = 'avatars';
    if (FtechSystem.catalog.frames.some(f => f.id === id)) category = 'frames';
    else if (FtechSystem.catalog.titles.some(t => t.id === id)) category = 'titles';
    else if (FtechSystem.catalog.skins.some(s => s.id === id)) category = 'skins';
   
    FtechSystem.equipItem(category, id);
    showToast("EQUIPPED ACCESSORY.");
    renderCollectionItems();
    syncLobbyHUD();
}

// 8. Custom Rank Journey Board Map
function openRankJourneyPanel() {
    showModal('rank-journey-modal');
    renderRankJourneyLadder();
}

function closeRankJourneyPanel() {
    closeModal('rank-journey-modal');
}

function renderRankJourneyLadder() {
    const listMenu = document.getElementById('journey-ranks-menu');
    if (!listMenu) return;
    listMenu.innerHTML = '';
   
    const currentRp = FtechSystem.account.rp;
   
    V3_RANKS.forEach(rank => {
        const unlocked = (currentRp >= rank.rpMin);
        const active = (selectedJourneyRank === rank.id);
       
        const el = document.createElement('div');
        el.className = "drawer-item " + (active ? 'active-tab' : '');
        el.style = `
            padding: 12px; margin-bottom: 4px; border-radius: 4px; font-size:11px; cursor: pointer; text-align: left;
            border-left: 3px solid ${unlocked ? rank.badgeColor : '#333'};
            background: ${active ? 'rgba(255,255,255,0.05)' : 'transparent'};
            color: ${unlocked ? '#fff' : 'var(--text-muted)'};
        `;
       
        el.onclick = () => {
            selectedJourneyRank = rank.id;
            renderRankJourneyLadder();
        };
       
        el.innerHTML = `
            <div style="font-weight:800;">${rank.name.toUpperCase()}</div>
            <div style="font-size:8.5px; opacity: 0.8;">Min RP: ${rank.rpMin} ${unlocked ? '✔️' : '🔒'}</div>
        `;
       
        listMenu.appendChild(el);
    });
   
    renderJourneyRankRewards();
}

function renderJourneyRankRewards() {
    const scroller = document.getElementById('journey-rewards-scroller');
    if (!scroller) return;
    scroller.innerHTML = '';

    const rankId = selectedJourneyRank;
    const rankObj = V3_RANKS.find(r => r.id === rankId);
    if (!rankObj) return;

    const rewardMapping = JOURNEY_REWARDS[rankId] || { title: 'Tournament Coins Pack', rewardCoins: 200, border: '#b0bec5', desc: 'Secure rank points.' };
    const currentRp = FtechSystem.account.rp;
    const rankUnlocked = currentRp >= rankObj.rpMin;

    const tierNodes = FtechSystem.RANK_TIERS.filter(t => t.group.toLowerCase() === rankObj.name.toLowerCase());
    const chainHtml = tierNodes.map((tier, idx) => {
        const unlocked = currentRp >= tier.minRp;
        const tierLabel = tier.label;
        const claimed = (FtechSystem.account.claimedRankRewards || []).includes(tierLabel);
        const isCurrent = FtechSystem.getRankDetails(currentRp).fullLabel === tierLabel;
        return `
            <div class="journey-tier-node ${unlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}">
                <div class="journey-tier-badge">${generateRankBadgeSVG(rankId, unlocked, unlocked ? 100 : 0)}</div>
                <div class="journey-tier-label">${tierLabel}</div>
                <div class="journey-tier-rp">${tier.minRp} RP</div>
                ${unlocked ? (claimed
                    ? '<span class="journey-tier-claimed">REWARD CLAIMED</span>'
                    : `<button class="btn btn-primary journey-claim-btn" onclick="claimV3RankRewards('${tierLabel}', 200)">CLAIM +200 🪙</button>`)
                  : '<span class="journey-tier-locked">🔒 LOCKED</span>'}
                ${idx < tierNodes.length - 1 ? '<div class="journey-tier-arrow">↓</div>' : ''}
            </div>
        `;
    }).join('');

    scroller.innerHTML = `
        <div class="journey-rewards-panel">
            <h2 class="journey-panel-title" style="color:${rankObj.badgeColor}">${rankObj.name.toUpperCase()} PROGRESSION</h2>
            <p class="journey-panel-desc">${rewardMapping.desc}</p>
            <div class="journey-tier-chain">${chainHtml}</div>
            <div class="journey-reward-footer">
                <span>🎁 ${rewardMapping.title}</span>
                <span style="color:var(--gold)">🪙 ${rewardMapping.rewardCoins}</span>
            </div>
        </div>
    `;
}

function claimV3RankRewards(tierLabel, coins) {
    if (FtechSystem.claimRankTierReward(tierLabel)) {
        renderJourneyRankRewards();
        syncLobbyHUD();
    }
}

// 9. Matchmaking Radar seek Simulator
let matchmakingInterval = null;
let matchmakingSecs = 0;
function openQuickMatchRadar() {
    openRankedMatchMenu();
}

function closeQuickMatchRadar() {
    if (matchmakingInterval) {
        clearInterval(matchmakingInterval);
        matchmakingInterval = null;
    }
    closeModal('quick-match-modal');
}

// 10. Open Match History Log
function openMatchHistoryPanel() {
    showModal('match-history-modal');
    renderMatchHistoryList();
}

function closeMatchHistoryPanel() {
    closeModal('match-history-modal');
}

function renderMatchHistoryList() {
    const scroller = document.getElementById('v3-history-scroller');
    if (!scroller) return;
    scroller.innerHTML = '';
   
    const history = FtechSystem.account.history || [];
   
    if (history.length === 0) {
        scroller.innerHTML = '<div style="text-align:center; padding:30px 0; font-size:11px; color:var(--text-muted); font-style:italic;">NO TOURNAMENT matches CONCLUDED YET.</div>';
        return;
    }
   
    history.forEach(log => {
        const color = log.result === 'WIN' ? '#4af626' : (log.result === 'LOSS' ? '#ff3333' : '#aaa');
        const card = document.createElement('div');
        card.style = "background:#050505; border:1px solid var(--border-color); border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-size:11px;";
        card.innerHTML = `
            <div style="text-align: left;">
                <div style="font-weight: 800; color:#fff; font-size: 11.5px;">VS ${log.opponent.toUpperCase()}</div>
                <div style="color:var(--text-muted); font-size: 9px; margin-top: 2px;">${log.date} &bull; ${log.mode.toUpperCase()}</div>
            </div>
            <div style="text-align: right;">
                <span style="color: ${color}; font-weight:800; font-family:var(--font-mono); font-size:12px;">${log.result}</span>
                <div style="font-size: 9px; color: var(--gold); margin-top:2px;">🪙 +${log.coins} | +${log.xp} XP</div>
            </div>
        `;
        scroller.appendChild(card);
    });
}

// Game Settings Screen Modal
function openSettingsPanel() {
    const box = document.createElement('div');
    box.id = 'settings-form-modal';
    box.className = 'modal-overlay';
    
    const soundChecked = (typeof AudioManager !== 'undefined' && AudioManager.soundEnabled !== false) ? 'checked' : '';
    const volVal = (typeof AudioManager !== 'undefined' && AudioManager.volume !== undefined) ? AudioManager.volume : 0.7;
    const particleChecked = (window.particleEnabled !== false) ? 'checked' : '';
    const cameraChecked = (window.cameraTrackingEnabled !== false) ? 'checked' : '';
    const perfChecked = (localStorage.getItem('performanceMode') === 'true') ? 'checked' : '';

    const leftHandChecked = (localStorage.getItem('leftHandMode') === 'true') ? 'checked' : '';
    const hcChecked = (localStorage.getItem('highContrastMode') === 'true') ? 'checked' : '';
    const rmChecked = (localStorage.getItem('reducedMotionMode') === 'true') ? 'checked' : '';

    box.innerHTML = `
        <div class="modal-card" style="max-width:400px; padding:24px; text-align:center;">
            <button class="modal-close-btn" onclick="closeSettingsModal()">✖</button>
            <h3>SETTINGS PANEL</h3>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:16px;">Calibrate active settings parameters.</p>
           
            <div style="text-align:left; display:flex; flex-direction:column; gap:12px; margin-bottom: 24px; max-height: 50vh; overflow-y: auto; padding-right: 4px;">
                <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fff; gap: 8px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">🔊 Sound Effects SFX</span>
                    <input type="checkbox" id="settings-sfx-check" ${soundChecked} style="width:18px; height:18px; accent-color: var(--gold); flex-shrink: 0;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fff; gap: 8px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">🎚️ Master Volume</span>
                    <input type="range" id="settings-volume-range" min="0" max="1" step="0.1" value="${volVal}" style="width:90px; accent-color: var(--gold); flex-shrink: 0;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fff; gap: 8px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">💫 Move particle highlights</span>
                    <input type="checkbox" id="settings-particle-check" ${particleChecked} style="width:18px; height:18px; accent-color: var(--gold); flex-shrink: 0;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fff; gap: 8px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">🔍 Dynamic Camera Tracking</span>
                    <input type="checkbox" id="settings-camera-check" ${cameraChecked} style="width:18px; height:18px; accent-color: var(--gold); flex-shrink: 0;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fff; gap: 8px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">⚡ Performance Mode (Low-End)</span>
                    <input type="checkbox" id="settings-performance-check" ${perfChecked} style="width:18px; height:18px; accent-color: var(--gold); flex-shrink: 0;">
                </label>
                <hr style="border-color: rgba(255,255,255,0.05); margin: 4px 0;">
                <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fff; gap: 8px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">✋ Left Hand Mode</span>
                    <input type="checkbox" id="settings-lefthand-check" ${leftHandChecked} style="width:18px; height:18px; accent-color: var(--gold); flex-shrink: 0;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fff; gap: 8px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">👁️ High Contrast Mode</span>
                    <input type="checkbox" id="settings-highcontrast-check" ${hcChecked} style="width:18px; height:18px; accent-color: var(--gold); flex-shrink: 0;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fff; gap: 8px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">🐢 Reduced Motion</span>
                    <input type="checkbox" id="settings-reducedmotion-check" ${rmChecked} style="width:18px; height:18px; accent-color: var(--gold); flex-shrink: 0;">
                </label>
            </div>
           
            <button class="btn btn-primary" onclick="saveSettingsForm()" style="width:100%;">SAVE SETTINGS</button>
        </div>
    `;
    document.getElementById('app').appendChild(box);
}

function saveSettingsForm() {
    const sfxCheck = document.getElementById('settings-sfx-check');
    const volumeRange = document.getElementById('settings-volume-range');
    const particleCheck = document.getElementById('settings-particle-check');
    const cameraCheck = document.getElementById('settings-camera-check');
    const perfCheck = document.getElementById('settings-performance-check');

    if (sfxCheck && typeof AudioManager !== 'undefined') {
        AudioManager.soundEnabled = sfxCheck.checked;
    }
    if (volumeRange && typeof AudioManager !== 'undefined') {
        AudioManager.setVolume(parseFloat(volumeRange.value));
    }
    if (particleCheck) window.particleEnabled = particleCheck.checked;
    if (cameraCheck) window.cameraTrackingEnabled = cameraCheck.checked;

    if (perfCheck) {
        const isPerf = perfCheck.checked;
        localStorage.setItem('performanceMode', isPerf ? 'true' : 'false');
        if (isPerf) {
            document.body.classList.add('performance-mode');
            window.particleEnabled = false;
        } else {
            document.body.classList.remove('performance-mode');
            window.particleEnabled = particleCheck ? particleCheck.checked : true;
        }
    }

    const leftHandCheck = document.getElementById('settings-lefthand-check');
    if (leftHandCheck) {
        localStorage.setItem('leftHandMode', leftHandCheck.checked ? 'true' : 'false');
        if (leftHandCheck.checked) document.body.classList.add('left-hand-mode');
        else document.body.classList.remove('left-hand-mode');
    }

    const hcCheck = document.getElementById('settings-highcontrast-check');
    if (hcCheck) {
        localStorage.setItem('highContrastMode', hcCheck.checked ? 'true' : 'false');
        if (hcCheck.checked) document.body.classList.add('high-contrast-mode');
        else document.body.classList.remove('high-contrast-mode');
    }

    const rmCheck = document.getElementById('settings-reducedmotion-check');
    if (rmCheck) {
        localStorage.setItem('reducedMotionMode', rmCheck.checked ? 'true' : 'false');
        if (rmCheck.checked) document.body.classList.add('reduced-motion-mode');
        else document.body.classList.remove('reduced-motion-mode');
    }

    closeSettingsModal();
}

function closeSettingsModal() {
    const el = document.getElementById('settings-form-modal');
    if (el) el.remove();
}

// -----------------------------------------------------
// RANKS PROMOTION & VICTORY REWARDS OVERLAYS DRIVERS
// -----------------------------------------------------

// Open Match Result Screen overlay with progression bar refills
function triggerV3ResultPayout(state, payoutObj) {
    if (typeof updateGameStateVisibility === 'function') updateGameStateVisibility('result');
    document.getElementById('match-victory-banner').innerText = state.toUpperCase();
    document.getElementById('match-victory-subtitle').innerText = payoutObj.reason.toUpperCase();
   
    document.getElementById('match-victory-coins').innerText = `+${payoutObj.coins}`;
    document.getElementById('match-victory-xp').innerText = `+${payoutObj.xp}`;
   
    const rpCard = document.getElementById('match-result-rp-card');
    const isRanked = FtechSystem.currentGameMode === 'ranked';
    if (rpCard) rpCard.style.display = isRanked ? 'block' : 'none';
    if (!isRanked) payoutObj.rpChange = 0;
    if (payoutObj.rpChange >= 0) {
        document.getElementById('match-victory-rp').innerText = `+${payoutObj.rpChange}`;
        document.getElementById('match-victory-rp').style.color = '#4af626';
    } else {
        document.getElementById('match-victory-rp').innerText = `${payoutObj.rpChange}`;
        document.getElementById('match-victory-rp').style.color = '#ff3333';
    }
   
    const oldDetails = FtechSystem.getRankDetails(payoutObj.oldRp);
    const newDetails = FtechSystem.getRankDetails(payoutObj.newRp);
   
    document.getElementById('match-result-old-rank').innerText = `${oldDetails.rankName} ${oldDetails.subTier} (${oldDetails.progress}% RP)`;
    document.getElementById('match-result-new-rank').innerText = `${newDetails.rankName} ${newDetails.subTier} (${newDetails.progress}% RP)`;
   
    // Animate progression loading bar fill
    const progressBar = document.getElementById('match-result-rp-bar');
    progressBar.style.width = oldDetails.progress + '%';
   
    showModal('match-result-overlay');
   
    setTimeout(() => {
        progressBar.style.width = newDetails.progress + '%';
    }, 800);
}

function closeMatchResultOverlay() {
    closeModal('match-result-overlay');
    returnToLobby();
}

// Trigger Promotion Fullscreen overlay
function triggerV3PromotionCelebration(oldRankStr, newRankStr, isGrand) {
    document.getElementById('promo-old-rank-name').innerText = oldRankStr;
    document.getElementById('promo-new-rank-name').innerText = newRankStr;
    const titleEl = document.getElementById('promo-title-text');
    const subEl = document.getElementById('promo-subtitle-text');
    if (titleEl) titleEl.innerText = isGrand ? 'GRAND PROMOTION' : 'RANK UP';
    if (subEl) subEl.innerText = isGrand ? 'NEW RANK TIER UNLOCKED!' : 'SUB-TIER ADVANCED';
    spawnPromotionParticles();
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
    } catch (e) {}
    showModal('rank-promotion-overlay');
}

function showSubTierPromotionGlow(rankStr) {
    const glow = document.createElement('div');
    glow.className = 'subtier-promo-glow';
    document.body.appendChild(glow);
    showToast('PROMOTED TO ' + rankStr.toUpperCase());
    setTimeout(() => glow.remove(), 2000);
}

function spawnPromotionParticles() {
    const box = document.getElementById('promo-particles');
    if (!box) return;
    box.innerHTML = '';
    for (let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        p.className = 'promo-particle';
        p.style.left = (40 + Math.random() * 20) + '%';
        p.style.top = (40 + Math.random() * 20) + '%';
        p.style.setProperty('--tx', ((Math.random() - 0.5) * 300) + 'px');
        p.style.setProperty('--ty', ((Math.random() - 0.5) * 300) + 'px');
        p.style.animationDelay = (Math.random() * 0.3) + 's';
        box.appendChild(p);
    }
}

function closeRankPromotionOverlay() {
    closeModal('rank-promotion-overlay');
}

// -----------------------------------------------------
// BRIDGE REPLACES IN FTECH_V2_SYSTEM OVERRIDES
// -----------------------------------------------------

// Override renderDashboard to sync our beautiful HUD rather than wiping index.html!
FtechSystem.renderDashboard = function() {
    console.log("Ftech V3: Blocked renderDashboard innerHTML override. Syncing HUD details nicely.");
    syncLobbyHUD();
};

FtechSystem.renderAuthOverlay = function() {
    console.log("Ftech V3: Blocked auth overlay floating modal. Opening Login Screen.");
    transitionScreenV3('login-screen');
};

// Override awardMatchEnd to present our beautiful visual payout results overlay!
FtechSystem.awardMatchEnd = function(result, resultText) {
    console.log("Ftech V3: Concluded game match. Generating custom golden rewards payouts.");
   
    const oldCoins = this.account.coins;
    const oldRp = this.account.rp;
    const oldLvl = this.account.level;
   
    // Flatten both arguments into a lowercase space-joined string to capture values anywhere!
    const argStr = `${String(result)} ${String(resultText)}`.toLowerCase();
   
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
    let stateString = 'DRAW';

    if (outcomeStatus === 'win') {
        stateString = 'VICTORY';
        coinsEarned = 40;
        this.account.wins++;

        if (this.currentGameMode === 'play_online' || this.currentGameMode === 'classic') {
            xpEarned = 25;
            rpEarned = 0;
        } else if (this.currentGameMode === 'friend') {
            xpEarned = 20;
            rpEarned = 0;
            if (this.currentEntryFeeTier && this.currentEntryFeeTier !== 'none') {
                this.payoutEntryFeeWinner(this.currentEntryFeeTier);
                coinsEarned += (this.ENTRY_FEE_TIERS[this.currentEntryFeeTier]?.payout || 0);
            }
        } else if (this.currentGameMode === 'ranked') {
            xpEarned = 30;
            rpEarned = 25;
        } else {
            xpEarned = 30;
            rpEarned = 0;
        }
    } else if (outcomeStatus === 'loss') {
        stateString = 'DEFEAT';
        coinsEarned = 10;
        this.account.losses++;
       
        if (this.currentGameMode === 'play_online' || this.currentGameMode === 'classic') {
            xpEarned = 5;
            rpEarned = 0;
        } else if (this.currentGameMode === 'friend') {
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
        stateString = 'DRAW';
        coinsEarned = 15;
        this.account.draws++;
       
        if (this.currentGameMode === 'play_online' || this.currentGameMode === 'classic') {
            xpEarned = 10;
            rpEarned = 0;
        } else if (this.currentGameMode === 'friend') {
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
        showToast("RANK SHIELD TRIPPED! PREVENTED RP LOSS.");
    }
   
    // Update stats counters
    this.account.matches++;
    this.account.coins += coinsEarned;
   
    // Increment RP and evaluate boundaries
    const originalRp = this.account.rp;
    this.addRP(rpEarned);
    const finalRp = this.account.rp;
   
    // Increment XP and evaluate level borders
    this.addXP(xpEarned);
   
    // Check if Promotion screen is warranted (Checking old tier against new tier)
    const oldDetails = this.getRankDetails(originalRp);
    const newDetails = this.getRankDetails(finalRp);
   
    const oldRankStr = oldDetails.fullLabel || `${oldDetails.rankName} ${oldDetails.subTier}`.trim();
    const newRankStr = newDetails.fullLabel || `${newDetails.rankName} ${newDetails.subTier}`.trim();
   
    // Record to history archives log array list
    const logDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
   
    let oppName = 'ONLINE CONTENDER';
    if (FtechSystem.matchOpponentInfo && FtechSystem.matchOpponentInfo.username) {
        oppName = FtechSystem.matchOpponentInfo.username;
    } else if (this.currentGameMode === 'computer') {
        oppName = `STOCKFISH AI (${this.computerDifficulty.toUpperCase()})`;
    } else if (this.currentGameMode === 'practice') {
        oppName = 'PASS & PLAY';
    } else if (this.currentGameMode === 'friend') {
        oppName = 'FRIENDLY DUELIST';
    }
   
    this.account.history.unshift({
        opponent: oppName,
        date: logDate,
        mode: this.currentGameMode,
        result: outcomeStatus === 'win' ? 'WIN' : (outcomeStatus === 'loss' ? 'LOSS' : 'DRAW'),
        coins: coinsEarned,
        xp: xpEarned
    });
   
    this.saveData();
    syncLobbyHUD();
   
    // Show match custom overlay design
    triggerV3ResultPayout(stateString, {
        reason: resultText || "Game terminated",
        coins: coinsEarned,
        xp: xpEarned,
        rpChange: rpEarned,
        oldRp: originalRp,
        newRp: finalRp
    });
   
    if (finalRp > originalRp && oldRankStr !== newRankStr) {
        setTimeout(() => {
            const isGrand = this.getRankGroup(oldDetails.fullLabel) !== this.getRankGroup(newDetails.fullLabel);
            triggerV3PromotionCelebration(oldRankStr, newRankStr, isGrand);
        }, 3200);
    }

    if (this.releaseMatchSession) this.releaseMatchSession();
};

// Override addFriendInput to hook into inputs elegantly
FtechSystem.addFriendInput = function() {
    const el = document.getElementById('add-friend-text-field');
    if (!el) return;
    const name = el.value.trim();
    if (!name) return;
    showToast(`FRIEND REQUEST TRANSMITTED TO ${name.toUpperCase()}!`);
    el.value = '';
};

// Logout handler
FtechSystem.logout = function() {
    showToast("LOGGING OUT GAME SESSION...");
    const performLocalSignout = () => {
        // Teardown any pending live listeners and reset status flags
        if (FtechSystem.unsubUserDoc) {
            try { FtechSystem.unsubUserDoc(); } catch (e) {}
            FtechSystem.unsubUserDoc = null;
        }
        FtechSystem.isFetchingProfile = false;
       
        localStorage.removeItem('ftech_chess_v2_profile');
        FtechSystem.account = {
            uid: 'guest_' + Math.random().toString(36).substring(2, 8),
            playerId: FtechSystem.generatePlayerId ? FtechSystem.generatePlayerId() : 'FUTX000000',
            username: 'Grandmaster Guest',
            username_lowercase: '',
            avatar: 'avatar_pawn',
            frame: 'frame_none',
            title: 'Novice Duelist',
            level: 1,
            xp: 0,
            rp: 0,
            coins: 100,
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
            claimedDailyDays: [],
            lastDailyClaimTimestamp: 0,
            streakShields: 1,
            history: [],
            friendRequests: [],
            achievements: [],
            hasCompletedSetup: false,
            country: ''
        };
        FtechSystem.sessionActive = false;
        FtechSystem.authSkipped = false;
        transitionScreenV3('login-screen');
    };

    if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
        firebase.auth().signOut().then(performLocalSignout).catch(err => {
            console.error("Signout error", err);
            performLocalSignout();
        });
    } else {
        performLocalSignout();
    }
};

// Override startComputerMatch to leverage our beautiful V3 design flow!
FtechSystem.startComputerMatch = async function() {
    const isRankedBot = this.currentGameMode === 'ranked';
    this.currentGameMode = isRankedBot ? 'ranked' : 'computer';
    localPlayMode = true;
    window.moveAssistEnabled = !isRankedBot;
    myPlayerColor = 'w';

    const bot = this.matchOpponentInfo || this.getAdaptiveBotProfile(this.account.rp);
    bot.isBot = true;
    this.matchOpponentInfo = bot;

    await FtechSystem.acquireMatchSession();

    if (typeof closeVSComputerMenu === 'function') closeVSComputerMenu();
    if (typeof closeQuickMatchRadar === 'function') closeQuickMatchRadar();
    transitionScreenV3('game-screen');

    if (typeof updateMatchPlayerNames === 'function') {
        updateMatchPlayerNames(bot.username, bot.rp, true);
    }

    if (typeof initGameChatPanel === 'function') initGameChatPanel();
    if (activeEngine) activeEngine.reset();
    if (typeof syncPiecesWithEngineState === 'function') syncPiecesWithEngineState();
    if (typeof startMatch === 'function') startMatch();
};

function openRankedMatchmakingModal() {
    showModal('quick-match-modal');
    const statusEl = document.getElementById('radar-status-state');
    const titleEl = document.querySelector('#quick-match-modal h3');
    if (titleEl) titleEl.innerText = 'SEARCHING RANKED OPPONENT';
    if (statusEl) statusEl.innerText = 'SCANNING RANKED POOL...';
    FtechSystem.runSmartRankedMatchmaking().then(() => {
        closeQuickMatchRadar();
    });
}

function getTierFrameClass(rankGroup) {
    const g = (rankGroup || '').toLowerCase();
    if (g === 'elite') return 'frame-tier-elite';
    if (g === 'master') return 'frame-tier-master';
    if (g === 'grandmaster') return 'frame-tier-grandmaster';
    if (g === 'legend') return 'frame-tier-legend';
    return '';
}

// ─── In-Game Chat System ───
const QUICK_CHAT_PHRASES = ['Good luck!', 'Nice move!', 'Well played!', 'Think faster!', 'Good game!', 'Rematch?'];
const CHAT_EMOJIS = ['👍', '🔥', '👑', '⚔️', '😎', '💪', '🎯', '🏆'];

function initGameChatPanel() {
    const phrasesEl = document.getElementById('game-chat-phrases');
    const emojisEl = document.getElementById('game-chat-emojis');
    if (phrasesEl && !phrasesEl.dataset.init) {
        phrasesEl.dataset.init = '1';
        QUICK_CHAT_PHRASES.forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'game-chat-chip';
            btn.innerText = text;
            btn.onclick = () => sendGameChatMessage(text, 'text');
            phrasesEl.appendChild(btn);
        });
    }
    if (emojisEl && !emojisEl.dataset.init) {
        emojisEl.dataset.init = '1';
        CHAT_EMOJIS.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'game-chat-chip';
            btn.innerText = emoji;
            btn.style.fontSize = '18px';
            btn.onclick = () => sendGameChatMessage(emoji, 'emoji');
            emojisEl.appendChild(btn);
        });
    }
}

function toggleGameChatPanel() {
    const panel = document.getElementById('game-chat-panel');
    if (!panel) return;
    panel.classList.toggle('hidden-panel');
    if (!panel.classList.contains('hidden-panel')) initGameChatPanel();
}

function setGameChatTab(tab) {
    document.getElementById('game-chat-phrases').classList.toggle('hidden-panel', tab !== 'phrases');
    document.getElementById('game-chat-emojis').classList.toggle('hidden-panel', tab !== 'emojis');
    document.getElementById('chat-tab-phrases').classList.toggle('active', tab === 'phrases');
    document.getElementById('chat-tab-emojis').classList.toggle('active', tab === 'emojis');
}

function sendGameChatMessage(content, type) {
    if (!content) return;
    showProfileChatBubble('player', content);
    if (typeof networkSync !== 'undefined' && networkSync && networkSync.isMultiplayerActive) {
        networkSync.sendChatMessage(content, type);
    }
    toggleGameChatPanel();
}

function showProfileChatBubble(side, content) {
    const bubbleId = side === 'player' ? 'player-chat-bubble' : 'opponent-chat-bubble';
    const bubble = document.getElementById(bubbleId);
    if (!bubble) return;
    bubble.innerText = content;
    bubble.classList.remove('hidden-bubble');
    clearTimeout(bubble._fadeTimer);
    bubble._fadeTimer = setTimeout(() => bubble.classList.add('hidden-bubble'), 3000);
}

window.onRoomChatMessage = function(payload, senderId) {
    const isMe = networkSync && senderId === networkSync.playerId;
    showProfileChatBubble(isMe ? 'player' : 'opponent', payload.content || payload.text || '');
};

// ─── Waiting Room Friend Invites ───
let waitingRoomRosterTimer = null;

function startWaitingRoomFriendRoster() {
    renderWaitingRoomFriends();
    if (waitingRoomRosterTimer) clearInterval(waitingRoomRosterTimer);
    waitingRoomRosterTimer = setInterval(renderWaitingRoomFriends, 5000);
}

function stopWaitingRoomFriendRoster() {
    if (waitingRoomRosterTimer) {
        clearInterval(waitingRoomRosterTimer);
        waitingRoomRosterTimer = null;
    }
}

async function renderWaitingRoomFriends() {
    const list = document.getElementById('waiting-room-friends-list');
    if (!list) return;
    list.innerHTML = '<div style="font-size:10px;color:var(--text-muted);padding:8px;">Refreshing roster...</div>';
    const friends = FtechSystem.friends || [];
    if (!friends.length) {
        list.innerHTML = '<div style="font-size:10px;color:var(--text-muted);padding:8px;">No friends enlisted. Add contacts from Friends panel.</div>';
        return;
    }
    list.innerHTML = '';
    const roomCode = document.getElementById('v3-waiting-room-code')?.innerText?.trim() || '';
    friends.forEach(friend => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.35);padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);';
        const rankLabel = friend.rank || 'Pawn I';
        const online = friend.online && !friend.inMatch;
        const cooldownKey = friend.uid || friend.id || friend.playerId;
        const onCooldown = FtechSystem.inviteCooldowns[cooldownKey] && Date.now() < FtechSystem.inviteCooldowns[cooldownKey];
        row.innerHTML = `
            <div style="text-align:left;">
                <div style="font-size:11px;font-weight:800;color:#fff;">${(friend.name || friend.username || 'Player').toUpperCase()}</div>
                <div style="font-size:9px;color:var(--text-muted);">${rankLabel}</div>
            </div>
        `;
        const btn = document.createElement('button');
        btn.className = online && !onCooldown ? 'btn btn-primary' : 'btn btn-outline';
        btn.style.cssText = 'font-size:9px;padding:6px 10px;width:auto;opacity:' + (online && !onCooldown ? '1' : '0.45');
        btn.innerText = online ? (onCooldown ? 'WAIT...' : '+ INVITE') : 'Player is Offline';
        btn.disabled = !online || onCooldown;
        if (online && !onCooldown) {
            btn.onclick = () => inviteFriendToRoom(friend, roomCode, cooldownKey);
        }
        row.appendChild(btn);
        list.appendChild(row);
    });
}

async function inviteFriendToRoom(friend, roomCode, cooldownKey) {
    FtechSystem.inviteCooldowns[cooldownKey] = Date.now() + 30000;
    const toUid = friend.uid || friend.id;
    if (FtechSystem.sessionActive && toUid && typeof FirestoreDB !== 'undefined') {
        await FirestoreDB.sendFriendInvite(FtechSystem.account.uid, {
            username: FtechSystem.account.username,
            playerId: FtechSystem.account.playerId,
            avatar: FtechSystem.account.avatar,
            roomCode
        }, toUid);
        showToast('INVITATION SENT TO ' + (friend.name || '').toUpperCase());
    } else {
        showToast('INVITE DISPATCHED TO ' + (friend.name || '').toUpperCase());
    }
    renderWaitingRoomFriends();
}

// Ranked Match Lobby wrapper
function openRankedMatchMenu() {
    if (typeof FtechSystem !== 'undefined' && typeof FtechSystem.startRankedLobby === 'function') {
        FtechSystem.startRankedLobby();
    } else {
        showToast("RANKED SYSTEM CONNECTING...");
    }
}

function openPlayOnlineMenu() {
    if (typeof FtechSystem !== 'undefined' && typeof FtechSystem.startPlayOnlineLobby === 'function') {
        FtechSystem.startPlayOnlineLobby();
    } else {
        showToast('PLAY ONLINE CONNECTING...');
    }
}

function openPlayOnlineMatchmakingModal() {
    showModal('quick-match-modal');
    const statusEl = document.getElementById('radar-status-state');
    const titleEl = document.querySelector('#quick-match-modal h3');
    if (titleEl) titleEl.innerText = 'SEARCHING CASUAL OPPONENT';
    if (statusEl) statusEl.innerText = 'SCANNING GLOBAL LOBBY...';
    FtechSystem.runPlayOnlineMatchmaking().then(() => {
        closeQuickMatchRadar();
    });
}

function sendMidMatchFriendRequest() {
    const opp = FtechSystem.matchOpponentInfo;
    if (!opp || opp.isBot) {
        showToast('Cannot add bot opponents as friends.');
        return;
    }
    if (!opp.uid && !opp.playerId) {
        showToast('Friend request unavailable for this opponent.');
        return;
    }
    const input = document.getElementById('add-friend-v3-input');
    if (input) input.value = opp.playerId || opp.username || '';
    sendV3FriendRequest();
    const btn = document.getElementById('opponent-add-friend-btn');
    if (btn) btn.classList.add('hidden-info');
    showToast('FRIEND REQUEST SENT TO ' + (opp.username || '').toUpperCase());
}

window.updateMatchPlayerNames = function(oppName, oppRp, isBot) {
    const acc = FtechSystem.account;
    const myDisplay = FtechSystem.formatDisplayName ? FtechSystem.formatDisplayName(acc.username) : acc.username;
    const myRank = FtechSystem.getRankDetails(acc.rp);
    const oppRank = FtechSystem.getRankDetails(oppRp || 0);
    const myAvatarAsset = FtechSystem.catalog.avatars.find(a => a.id === acc.avatar) || FtechSystem.catalog.avatars[0];
    const myFrame = FtechSystem.catalog.frames.find(f => f.id === acc.frame) || FtechSystem.catalog.frames[0];

    const playerNameEl = document.getElementById('player-name');
    const opponentNameEl = document.getElementById('opponent-name');
    const playerRankEl = document.getElementById('player-rank-badge');
    const opponentRankEl = document.getElementById('opponent-rank-badge');
    const playerStatusEl = document.getElementById('player-status');
    const opponentStatusEl = document.getElementById('opponent-status');
    const addFriendBtn = document.getElementById('opponent-add-friend-btn');
    const playerAvatarEl = document.getElementById('player-avatar');
    const opponentAvatarEl = document.getElementById('opponent-avatar');
    const playerFrameEl = document.getElementById('player-avatar-frame');
    const opponentFrameEl = document.getElementById('opponent-avatar-frame');
    const onlineDot = document.getElementById('opponent-online-dot');

    if (playerNameEl) playerNameEl.innerText = myDisplay;
    if (opponentNameEl) opponentNameEl.innerText = oppName || 'Opponent';
    if (playerRankEl) playerRankEl.innerText = myRank.fullLabel;
    if (opponentRankEl) opponentRankEl.innerText = oppRank.fullLabel;
    if (playerStatusEl) playerStatusEl.innerText = `LVL ${acc.level}`;
    if (opponentStatusEl) opponentStatusEl.innerText = isBot ? 'AI OPPONENT' : 'ONLINE';
    if (playerAvatarEl) playerAvatarEl.innerText = myAvatarAsset.icon;
    if (opponentAvatarEl) opponentAvatarEl.innerText = isBot ? '🤖' : '♚';
    if (playerFrameEl) playerFrameEl.style.borderColor = myFrame.border || 'var(--gold)';
    if (opponentFrameEl) opponentFrameEl.style.borderColor = 'rgba(255,80,80,0.6)';
    if (onlineDot) {
        onlineDot.classList.toggle('offline', !!isBot);
    }

    if (addFriendBtn) {
        if (!isBot && (FtechSystem.currentGameMode === 'ranked' || FtechSystem.currentGameMode === 'play_online')) {
            addFriendBtn.classList.remove('hidden-info');
        } else {
            addFriendBtn.classList.add('hidden-info');
        }
    }

    window.opponentEquippedSkin = 'skin_default';
    if (FtechSystem.matchOpponentInfo && FtechSystem.matchOpponentInfo.equippedSkin) {
        window.opponentEquippedSkin = FtechSystem.matchOpponentInfo.equippedSkin;
    }
    if (typeof updateCoachButtonVisibility === 'function') updateCoachButtonVisibility();
};

function initXpHoldReveal() {
    const trigger = document.getElementById('hud-level-display');
    const tooltip = document.getElementById('hud-xp-tooltip');
    if (!trigger || !tooltip || trigger._xpBound) return;
    trigger._xpBound = true;

    const refreshTooltip = () => {
        const acc = FtechSystem.account;
        const needed = FtechSystem.getXPRequiredForNextLevel(acc.level);
        const remain = Math.max(0, needed - acc.xp);
        tooltip.innerText = `${acc.xp} / ${needed} XP — Need ${remain} XP for LVL ${acc.level + 1}`;
    };

    const show = () => { refreshTooltip(); tooltip.classList.remove('hidden-info'); tooltip.classList.add('visible'); };
    const hide = () => { tooltip.classList.remove('visible'); setTimeout(() => tooltip.classList.add('hidden-info'), 250); };

    trigger.addEventListener('mouseenter', show);
    trigger.addEventListener('mouseleave', hide);
    trigger.addEventListener('touchstart', (e) => { e.preventDefault(); show(); }, { passive: false });
    trigger.addEventListener('touchend', hide);
}

function copyPlayerId() {
    const id = FtechSystem.account.playerId || document.getElementById('p3-uid-display')?.innerText || '';
    if (!id) return;
    const done = () => showToast('Player ID Copied');
    if (typeof safelyCopyText === 'function') safelyCopyText(id).then(done);
    else if (typeof fallbackCopyText === 'function') { fallbackCopyText(id); done(); }
}

function sharePlayerId() {
    const id = FtechSystem.account.playerId || '';
    const name = FtechSystem.account.username || 'Player';
    const text = `Add me on FUTECX CHESS! Player: ${name} | ID: ${id}`;
    if (navigator.share) {
        navigator.share({ title: 'FUTECX Chess Profile', text }).catch(() => copyPlayerId());
    } else {
        const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(wa, '_blank');
    }
}

// ─── MOBILE GESTURE & NAVIGATION BACK LISTENERS ───
window.addEventListener('popstate', (e) => {
    ['settings-form-modal', 'blunder-warning-modal', 'coach-hint-confirm-modal', 'coach-hint-store-modal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    const openModals = document.querySelectorAll('.modal-overlay:not(.hidden-modal)');
    openModals.forEach(modal => {
        modal.classList.add('hidden-modal');
        modal.classList.remove('visible-modal');
        if (modal.id === 'private-room-waiting-modal') {
            cancelPrivateRoomWaiting();
        }
    });
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        const modalId = e.target.id;
        if (modalId) {
            if (modalId === 'settings-form-modal') {
                closeSettingsModal();
            } else if (modalId === 'blunder-warning-modal') {
                const el = document.getElementById('blunder-warning-modal');
                if (el) el.remove();
            } else if (modalId === 'coach-hint-confirm-modal') {
                closeConfirmHintModal();
            } else if (modalId === 'coach-hint-store-modal') {
                closeCoachHintStore();
            } else {
                closeModal(modalId);
                if (modalId === 'private-room-waiting-modal') {
                    cancelPrivateRoomWaiting();
                }
            }
        }
    }
});

document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
    }
});

/* ========== Ultra-Narrow Match Menu Toggle (<280px) ========== */
function toggleMatchMenu(event) {
    if (event) event.stopPropagation();
    var dropdown = document.getElementById('match-menu-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('open');
}

function closeMatchMenu() {
    var dropdown = document.getElementById('match-menu-dropdown');
    if (dropdown) dropdown.classList.remove('open');
}

// Auto-close match menu dropdown when clicking outside
document.addEventListener('click', function(e) {
    var dropdown = document.getElementById('match-menu-dropdown');
    if (!dropdown || !dropdown.classList.contains('open')) return;
    var trigger = e.target.closest('.match-menu-collapsed');
    var menu = e.target.closest('.match-menu-dropdown');
    if (!trigger && !menu) {
        closeMatchMenu();
    }
});

