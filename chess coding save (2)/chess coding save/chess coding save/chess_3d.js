 /**
* Classic 3D Chess - High-Fidelity WebGL Render Controller.
 * Leverages procedural wood textures, custom Lathe/Extrude piece meshes, beautiful dynamic lighting,
 * high-performance shadow mapping, and responsive camera layout class.
 */

// Global Game States
let activeEngine = new ChessEngine();
window.localBoardVersion = 0;
window.isWaitingForNetworkAck = false;
let networkSync = null;
let currentTimer = null;

let isOnline = false;
let myPlayerColor = 'w'; // 'w' or 'b'
let localPlayMode = true; // Local PvP vs Online Room
let matchTimeLimit = 600; // 10 minutes in seconds
let whiteTime = 600;
let blackTime = 600;
let isGameActive = false;

// ThreeJS scene globals
let scene, camera, renderer, controls;
let container;
let boardSquares = []; // 2D array of square meshes
let chessPiecesMap = new Map(); // UUID/instance to piece mesh
let selectedPieceCoord = null; // {row, col}
let validMoveMarkers = []; // translucent markers for valid moves
let woodLightMaterial, woodDarkMaterial;
let pieceLightMaterial, pieceDarkMaterial;
let highlightBorderMaterial;

// Selection tracking
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Pawn promotion state
let pendingPromotionMove = null;
window.moveAssistEnabled = true;
let lastMoveHighlightMeshes = [];
let checkGlowMesh = null;
let checkGlowTimer = null;
let attackLineMeshes = [];
let coachHighlightMeshes = [];
let capturedByWhite = [];
let capturedByBlack = [];
let lastAudioEventKey = '';
let sceneLights = {};
let boardPlatformMesh = null;

const PIECE_UNICODE = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

const AudioManager = {
    ctx: null,
    lastPlayed: {},
    debounceMs: 80,
    volume: 0.7,
    soundEnabled: true,

    init() {
        const resumeAudio = () => {
            const ctx = this._getCtx();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().then(() => {
                    document.removeEventListener('click', resumeAudio);
                    document.removeEventListener('touchstart', resumeAudio);
                });
            } else if (ctx) {
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('touchstart', resumeAudio);
            }
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('touchstart', resumeAudio, { passive: true });
    },

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
    },

    _getCtx() {
        if (!this.ctx) {
            try { 
                this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            } catch(e) {}
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            try { this.ctx.resume(); } catch(e) {}
        }
        return this.ctx;
    },

    _canPlay(key) {
        const now = Date.now();
        if (this.lastPlayed[key] && now - this.lastPlayed[key] < this.debounceMs) return false;
        this.lastPlayed[key] = now;
        return true;
    },

    _synthesize(soundType) {
        if (this.soundEnabled === false) return;
        if (!this._canPlay(soundType)) return;

        const ctx = this._getCtx();
        if (!ctx) return;

        const t = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        masterGain.gain.setValueAtTime(this.volume, t);

        if (soundType === 'move') {
            console.log('[SOUND_SYNTH_MOVE]');
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.exponentialRampToValueAtTime(110, t + 0.06);

            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(t);
            osc.stop(t + 0.07);
        } else if (soundType === 'capture') {
            console.log('[SOUND_SYNTH_CAPTURE]');
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

            gain.gain.setValueAtTime(0.6, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(t);
            osc.stop(t + 0.13);
        } else if (soundType === 'castle') {
            console.log('[SOUND_SYNTH_CASTLE]');
            [0, 0.09].forEach(delay => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(330 - delay * 200, t + delay);
                osc.frequency.exponentialRampToValueAtTime(160, t + delay + 0.05);

                gain.gain.setValueAtTime(0.35, t + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(t + delay);
                osc.stop(t + delay + 0.06);
            });
        } else if (soundType === 'promotion') {
            console.log('[SOUND_SYNTH_PROMOTION]');
            const freqs = [261.63, 329.63, 392.00, 523.25];
            freqs.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, t + i * 0.08);

                gain.gain.setValueAtTime(0.25, t + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.12);

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(t + i * 0.08);
                osc.stop(t + i * 0.08 + 0.13);
            });
        } else if (soundType === 'check') {
            console.log('[SOUND_SYNTH_CHECK]');
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, t);

            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(t);
            osc.stop(t + 0.25);
        } else if (soundType === 'victory') {
            console.log('[SOUND_SYNTH_VICTORY]');
            const notes = [
                { f: 261.63, start: 0, dur: 0.15 },
                { f: 329.63, start: 0.15, dur: 0.15 },
                { f: 392.00, start: 0.30, dur: 0.15 },
                { f: 523.25, start: 0.45, dur: 0.55 }
            ];
            notes.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(note.f, t + note.start);

                gain.gain.setValueAtTime(0.3, t + note.start);
                gain.gain.exponentialRampToValueAtTime(0.001, t + note.start + note.dur - 0.01);

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(t + note.start);
                osc.stop(t + note.start + note.dur);
            });
        } else if (soundType === 'defeat') {
            console.log('[SOUND_SYNTH_DEFEAT]');
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.linearRampToValueAtTime ? osc.frequency.linearRampToValueAtTime(70, t + 0.95) : osc.frequency.setValueAtTime(70, t + 0.95);

            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(t);
            osc.stop(t + 1.0);
        } else if (soundType === 'draw') {
            console.log('[SOUND_SYNTH_DRAW]');
            [440.00, 523.25, 659.25].forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, t);

                gain.gain.setValueAtTime(0.18, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(t);
                osc.stop(t + 0.5);
            });
        }
    },

    playMove() { this._synthesize('move'); },
    playCapture() { this._synthesize('capture'); },
    playCheck() { this._synthesize('check'); },
    playCheckmate() { this._synthesize('victory'); },
    playIntro() { this._synthesize('victory'); }
};

AudioManager.init();

window.playGameSound = function(type) {
    AudioManager._synthesize(type);
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializePlatform();
} else {
    window.addEventListener('DOMContentLoaded', initializePlatform);
}

function initializePlatform() {
    try {
        if (localStorage.getItem('performanceMode') === 'true') {
            document.body.classList.add('performance-mode');
            window.particleEnabled = false;
        }
    } catch(e) {}
    try {
        if (!activeEngine) {
            activeEngine = new ChessEngine();
        }
        if (typeof getChessMultiplayer === 'function') {
            networkSync = getChessMultiplayer(handleSocketMessage, handleSocketStatus);
        } else if (typeof window.ChessMultiplayer !== 'undefined') {
            networkSync = new window.ChessMultiplayer(handleSocketMessage, handleSocketStatus);
        } else {
            console.warn('initializePlatform: ChessMultiplayer not found — network features disabled.');
        }
    } catch (e) {
        console.error("Multiplayer/Engine initialization failed:", e);
    }

    try {
        setup3DScene();
    } catch (e) {
        console.error("3D Scene setup failed:", e);
        if (typeof showToast === 'function') {
            showToast("3D RENDERER INITIALIZE ERROR. CHECK WEBGL SUPPORT.");
        }
    }
   
    try {
        window.addEventListener('resize', onWindowResize, false);
        if (container) {
            container.addEventListener('click', onBoardClick, false);
            container.addEventListener('touchstart', onBoardTouch, { passive: true });
        }
    } catch (e) {
        console.error("Event binding failed:", e);
    }
   
    try {
        const statusDot = document.getElementById('status-dot');
        if (statusDot) statusDot.className = 'status-indicator error';
    } catch (e) {
        console.error("Status indicator setup failed:", e);
    }
}

function handleSocketStatus(message, styleClass) {
    const dot = document.getElementById('status-dot');
    const label = document.getElementById('status-text');
   
    if (dot && label) {
        label.innerText = message;
        dot.className = `status-indicator ${styleClass}`;
    }
}

// Network status and poor connection indicator management
window.updateNetworkWarningUI = function(isOfflineOrPoor) {
    // Never show network warnings during local/computer matches — irrelevant without online sync
    if (localPlayMode) return;
    const banner = document.getElementById('network-status-banner');
    if (!banner) return;
    const textLabel = document.getElementById('network-status-text');
    if (isOfflineOrPoor) {
        banner.classList.remove('hidden-banner');
        if (textLabel) textLabel.innerText = !navigator.onLine ? "YOU ARE OFFLINE" : "WEAK SERVER SYNC";
    } else {
        banner.classList.add('hidden-banner');
    }
};

window.updateConnectionRecoveryUI = function(state, message) {
    // Never show reconnect overlay during local/computer matches — Firebase is not required offline
    if (localPlayMode) return;
    const overlay = document.getElementById('connection-recovery-overlay');
    const text = document.getElementById('connection-recovery-text');
    if (!overlay) return;
    if (state === 'offline' || state === 'reconnecting') {
        overlay.classList.remove('hidden-banner');
        overlay.classList.remove('restored');
        if (text) text.innerText = message || 'Reconnecting...';
    } else if (state === 'online') {
        overlay.classList.add('restored');
        if (text) text.innerText = message || 'Connection Restored';
        setTimeout(() => overlay.classList.add('hidden-banner'), 1500);
    } else {
        overlay.classList.add('hidden-banner');
    }
};

window.applyServerTimers = function(wRem, bRem) {
    if (typeof wRem === 'number') whiteTime = wRem;
    if (typeof bRem === 'number') blackTime = bRem;
    updateHUDTimers();
};

window.applyCapturedPiecesFromServer = function(wCaps, bCaps) {
    capturedByWhite = wCaps || [];
    capturedByBlack = bCaps || [];
    renderCapturedTrays();
};

window.applyServerSnapshot = function(data) {
    if (!data) return;
    if (data.whiteRemaining != null) whiteTime = data.whiteRemaining;
    if (data.blackRemaining != null) blackTime = data.blackRemaining;
    updateHUDTimers();
    applyCapturedPiecesFromServer(data.capturedByWhite, data.capturedByBlack);
    if (data.events && typeof window.resynchronizeWithServer === 'function') {
        const moves = (data.events || []).filter(e => e.action === 'move');
        window.resynchronizeWithServer(data.events, moves.length);
    }
};

// Listen to standard HTML5 online/offline state (network banner only; recovery handled by multiplayer module)
window.addEventListener('online', () => {
    if (typeof window.updateNetworkWarningUI === 'function') window.updateNetworkWarningUI(false);
});

window.addEventListener('offline', () => {
    if (typeof window.updateNetworkWarningUI === 'function') window.updateNetworkWarningUI(true);
    if (typeof showToast === 'function') showToast('Connection Lost!');
});

// Board checksum calculation
function generateBoardChecksumOfEngine(engine) {
    let s = "";
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = engine.getPieceAt(r, c);
            if (piece) {
                s += piece.color + piece.type;
            } else {
                s += ".";
            }
        }
    }
    s += ":" + engine.turn;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function generateBoardChecksum() {
    return generateBoardChecksumOfEngine(activeEngine);
}

// Full move verification
function validateMovePayload(payload, senderId, currentEngineState) {
    // 1. Match ID check
    if (payload.matchId !== networkSync.roomCode) {
        console.warn(`[VALIDATION FAILED] Match ID mismatch: Expected ${networkSync.roomCode}, got ${payload.matchId}`);
        return false;
    }

    // 2. Board version check (should be exactly currentEngineState's moves count + 1)
    const expectedVersion = currentEngineState.moveHistory.length + 1;
    if (payload.boardVersion !== expectedVersion) {
        console.warn(`[VALIDATION FAILED] Board version mismatch: Expected ${expectedVersion}, got ${payload.boardVersion}`);
        return false;
    }

    // 3. Turn owner check
    // If expectedVersion is odd, White must be the mover. If expectedVersion is even, Black must be the mover.
    const roomCreator = networkSync.creatorId;
    const expectedColor = (expectedVersion % 2 !== 0) ? 'w' : 'b';
    const moverColor = (senderId === roomCreator) ? 'w' : 'b';
   
    if (expectedColor !== moverColor) {
        console.warn(`[VALIDATION FAILED] Turn owner mismatch: Expected color ${expectedColor}, got ${moverColor} (sender ID: ${senderId})`);
        return false;
    }

    // 4. Move legality check in simulated state
    const moves = currentEngineState.getValidMoves(payload.from.row, payload.from.col);
    const isValid = moves.some(m => m.row === payload.to.row && m.col === payload.to.col);
    if (!isValid) {
        console.warn(`[VALIDATION FAILED] Move is illegal in current board state: from (${payload.from.row}, ${payload.from.col}) to (${payload.to.row}, ${payload.to.col})`);
        return false;
    }

    return true;
}

// Authoritative Automatic Recovery System
window.resynchronizeWithServer = function(events, serverBoardVersion) {
    console.log(`[DESYNC RECOVERY] Hard synchronizing with Server. Version: ${serverBoardVersion}. Local version: ${window.localBoardVersion}`);
   
    // Create a temporary sandbox engine to validate and construct the state to prevent partial/broken board renderings
    const sandboxEngine = new ChessEngine();
   
    // Extract and sort all move events
    const moveEvents = events
        .filter(e => e.action === 'move')
        .sort((a, b) => (a.payload.boardVersion || 0) - (b.payload.boardVersion || 0));

    let validatedVersion = 0;
   
    // Replay with full sequential validation
    for (const ev of moveEvents) {
        const payload = ev.payload;
       
        // Validate each move before applying it sequentially
        if (validateMovePayload(payload, ev.sender, sandboxEngine)) {
            const outcome = sandboxEngine.move(payload.from.row, payload.from.col, payload.to.row, payload.to.col, payload.promotion || 'Q');
            if (outcome.success) {
                validatedVersion = payload.boardVersion;
                // Double check checksum (if available)
                if (payload.checksum) {
                    const sandboxChecksum = generateBoardChecksumOfEngine(sandboxEngine);
                    if (sandboxChecksum !== payload.checksum) {
                        console.warn(`[DESYNC RECOVERY] Checksum mismatch at version ${validatedVersion}! Server payload: ${payload.checksum}, Sandbox: ${sandboxChecksum}`);
                    }
                }
            } else {
                console.error(`[DESYNC RECOVERY] Failed to execute validated move on sandbox at version ${payload.boardVersion}`);
                break;
            }
        } else {
            console.error(`[DESYNC RECOVERY] Move validation failed for version ${payload.boardVersion}`);
            break;
        }
    }
   
    // Now that the sandbox engine was built successfully, apply it to the activeEngine!
    activeEngine.board = sandboxEngine.board;
    activeEngine.turn = sandboxEngine.turn;
    activeEngine.castlingRights = sandboxEngine.castlingRights;
    activeEngine.enPassantCol = sandboxEngine.enPassantCol;
    activeEngine.moveHistory = sandboxEngine.moveHistory;
   
    window.localBoardVersion = validatedVersion;
   
    // Draw the clean visual boards
    syncPiecesWithEngineState();
    updateHUDTimers();
   
    // Clear lock indicators
    window.isWaitingForNetworkAck = false;
   
    console.log(`[DESYNC RECOVERY] Hard sync finished. Active board set to version: ${window.localBoardVersion}`);
};

// Listen to Visibility Changes for instant App minimize/resume reconnection
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isGameActive && !localPlayMode) {
        console.log("[SYSTEM] App resumed — connection maintained via persistent onSnapshot listener.");
    }
});

// Removed watchdog listener re-subscribe loop — was freezing Firestore move payloads during active matches.
// Network healing is handled by the room onSnapshot error handler only.

let lastTurnSeen = null;

function triggerTurnNotification(force = false) {
    // Permanently disabled to adhere to strict turn notification requirements.
}

/* ========== Phase 4: Global Notification System ========== */
function showToast(text, type = 'info') {
    const textUpper = text.toUpperCase();
    if (type === 'info') {
        if (textUpper.includes('ERROR') || textUpper.includes('FAILED') || textUpper.includes('INVALID') || textUpper.includes('INCORRECT') || textUpper.includes('REJECTED') || textUpper.includes('UNREACHABLE') || textUpper.includes('BANNED') || textUpper.includes('DENIED')) {
            type = 'error';
        } else if (textUpper.includes('SUCCESS') || textUpper.includes('CREATED') || textUpper.includes('FOUND') || textUpper.includes('EQUIPPED') || textUpper.includes('CLAIMED') || textUpper.includes('ACCEPTED') || textUpper.includes('PROMOTED')) {
            type = 'success';
        } else if (textUpper.includes('WARNING') || textUpper.includes('INSUFFICIENT') || textUpper.includes('UNAVAILABLE') || textUpper.includes('LIMIT')) {
            type = 'warning';
        }
    }

    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `ftech-toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'error') icon = '❌';
    else if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
        <div class="ftech-toast-icon">${icon}</div>
        <div class="ftech-toast-msg">${text}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3500);
}

function copyRoomCode() {
    const codeEl = document.getElementById('game-room-code');
    const waitingEl = document.getElementById('v3-waiting-room-code');
    let val = codeEl ? codeEl.innerText.replace(/\s/g, '').trim() : '';
    if ((!val || val === '------') && networkSync && networkSync.roomCode) {
        val = networkSync.roomCode;
    }
    if ((!val || val === '------') && waitingEl) {
        val = waitingEl.innerText.replace(/\s/g, '').trim();
    }
    if (val && val !== '------') {
        const done = () => showToast('Room Code Copied');
        if (typeof safelyCopyText === 'function') {
            safelyCopyText(val).then(done);
        } else if (typeof fallbackCopyText === 'function') {
            fallbackCopyText(val);
            done();
        }
    }
}


/* ------------------ NETWORK EVENT HANDLING ------------------ */
function handleSocketMessage(action, payload, senderId) {
    switch (action) {
        case 'chat':
            if (typeof window.onRoomChatMessage === 'function') {
                window.onRoomChatMessage(payload, senderId);
            }
            break;

        case 'player_joined':
            if (myPlayerColor === 'w') {
                if (typeof stopWaitingRoomFriendRoster === 'function') stopWaitingRoomFriendRoster();
                if (typeof closeModal === 'function') {
                    closeModal('private-room-waiting-modal');
                }
                showToast("OPPONENT CONNECTED! DUEL COMMENCING...");
               
                transitionScreen('lobby', 'game-screen');

                const hostProfile = (typeof FtechSystem !== 'undefined' && FtechSystem.account) ? {
                    uid: FtechSystem.account.uid || networkSync.playerId,
                    name: FtechSystem.account.username || 'Host',
                    avatar: FtechSystem.account.avatar || '1',
                    rank: FtechSystem.account.rp || 0
                } : { uid: networkSync.playerId, name: 'Host', avatar: '1', rank: 0 };

                networkSync.broadcast('sync_init', {
                    whiteTime: whiteTime,
                    blackTime: blackTime,
                    playerBlackId: senderId,
                    profile: hostProfile,
                    hostSkin: (typeof FtechSystem !== 'undefined' && FtechSystem.account) ? (FtechSystem.account.equippedSkin || FtechSystem.account.skin || 'skin_default') : 'skin_default'
                });
               
                if (payload.profile) {
                    if (typeof FtechSystem !== 'undefined') {
                        FtechSystem.matchOpponentInfo = {
                            uid: payload.profile.uid,
                            username: payload.profile.name,
                            avatar: payload.profile.avatar,
                            rp: payload.profile.rank,
                            isBot: false
                        };
                    }
                    if (typeof updateMatchPlayerNames === 'function') {
                        updateMatchPlayerNames(payload.profile.name, payload.profile.rank, false);
                    }
                } else {
                    if (typeof updateMatchPlayerNames === 'function') {
                        updateMatchPlayerNames('Guest', 0, false);
                    }
                }
               
                startMatch();
            }
            break;
           
        case 'sync_init':
            if (myPlayerColor === 'b') {
                showToast("CONNECTED TO ROOM HOST!");
                whiteTime = payload.whiteTime;
                blackTime = payload.blackTime;
                if (payload.profile) {
                    if (typeof FtechSystem !== 'undefined') {
                        FtechSystem.matchOpponentInfo = {
                            uid: payload.profile.uid,
                            username: payload.profile.name,
                            avatar: payload.profile.avatar,
                            rp: payload.profile.rank,
                            isBot: false
                        };
                    }
                    if (typeof updateMatchPlayerNames === 'function') {
                        updateMatchPlayerNames(payload.profile.name, payload.profile.rank, false);
                    }
                } else {
                    const hostName = payload.hostUsername || 'Room Host';
                    if (typeof updateMatchPlayerNames === 'function') {
                        updateMatchPlayerNames(hostName, payload.hostRank ? 0 : 0, false);
                    } else {
                        document.getElementById('opponent-name').innerText = hostName;
                    }
                }
                window.opponentEquippedSkin = payload.hostSkin || 'skin_default';
               
                reverseBoardCameraAngle();
                startMatch();
            }
            break;
           
        case 'move':
            if (activeEngine.turn !== myPlayerColor) {
                // Execute move in engine
                const outcome = activeEngine.move(payload.from.row, payload.from.col, payload.to.row, payload.to.col, payload.promotion || 'Q');
                if (outcome.success) {
                    processEngineMoveSuccess(payload.from.row, payload.from.col, payload.to.row, payload.to.col, outcome);
                }
            }
            break;
           
        case 'timer_sync':
            if (myPlayerColor === 'b') {
                if (Math.abs(whiteTime - payload.whiteTime) > 2) whiteTime = payload.whiteTime;
                if (Math.abs(blackTime - payload.blackTime) > 2) blackTime = payload.blackTime;
                updateHUDTimers();
            }
            break;
           
        case 'resign':
            handleMatchTermination('resigned', payload.resignedColor === 'w' ? 'b' : 'w');
            break;
           
        case 'player_left':
            showToast("OPPONENT WALKED OUT.");
            handleMatchTermination('disconnect', myPlayerColor);
            break;
           
        case 'game_over':
            handleMatchTermination(payload.reason, payload.winnerColor);
            break;
    }
}


/* ------------------ LOBBY & SYSTEM ACTIONS ------------------ */
function createRoom() {
    if (!networkSync) {
        try {
            if (typeof getChessMultiplayer === 'function') {
                networkSync = getChessMultiplayer(handleSocketMessage, handleSocketStatus);
            } else if (typeof window.ChessMultiplayer !== 'undefined') {
                networkSync = new window.ChessMultiplayer(handleSocketMessage, handleSocketStatus);
            }
        } catch (e) {
            console.error("createRoom: Lazy initialization of networkSync failed:", e);
        }
    }

    if (!networkSync) {
        if (typeof showToast === 'function') {
            showToast("ONLINE SYSTEMS UNREACHABLE. STARTING LOCAL MATCH...");
        }
        startLocalPlay();
        return;
    }
   
    try {
        const code = networkSync.createRoom();
        if (code) {
            myPlayerColor = 'w';
            localPlayMode = false;
           
            // Show code UI element in HUD
            const roomCodeBox = document.getElementById('room-code-display-box');
            if (roomCodeBox) roomCodeBox.classList.remove('hidden-info');
            const roomCodeVal = document.getElementById('game-room-code');
            if (roomCodeVal) roomCodeVal.innerText = code;
           
            // Display waiting room modal loader with shareable properties!
            if (typeof showModal === 'function') {
                showModal('private-room-waiting-modal');
            }
            const waitingRoomCode = document.getElementById('v3-waiting-room-code');
            if (waitingRoomCode) waitingRoomCode.innerText = code;
           
            const opponentName = document.getElementById('opponent-name');
            if (opponentName) opponentName.innerText = "Waiting for challenger...";
            const opponentStatus = document.getElementById('opponent-status');
            if (opponentStatus) opponentStatus.innerText = "SHARE ROOM CODE";
            const playerName = document.getElementById('player-name');
            if (playerName && typeof FtechSystem !== 'undefined') {
                const dn = FtechSystem.formatDisplayName ? FtechSystem.formatDisplayName(FtechSystem.account.username) : FtechSystem.account.username;
                playerName.innerText = dn;
            }
            const playerStatus = document.getElementById('player-status');
            if (playerStatus) playerStatus.innerText = "HOST";
           
            // Reset local chess status
            if (activeEngine) activeEngine.reset();
            syncPiecesWithEngineState();
        }
    } catch (e) {
        console.error("Failed to create room:", e);
        if (typeof showToast === 'function') {
            showToast("ERROR PROVISIONING ROOM IN CLOUD.");
        }
    }
}

function cancelPrivateRoomWaiting() {
    if (typeof stopWaitingRoomFriendRoster === 'function') stopWaitingRoomFriendRoster();
    if (typeof closeModal === 'function') {
        closeModal('private-room-waiting-modal');
    }
    if (typeof clearPrivateRoomState === 'function') clearPrivateRoomState();
    if (networkSync) {
        try {
            networkSync.disconnectRoom();
        } catch (e) {
            console.error("Error disconnecting room on cancel:", e);
        }
    }
    if (typeof showToast === 'function') {
        showToast("ROOM DISBANDED.");
    }
}

function copyWaitingRoomCode() {
    const valEl = document.getElementById('v3-waiting-room-code');
    const val = valEl ? valEl.innerText.replace(/\s/g, '').trim() : '';
    if (val && val !== '------') {
        const doCopy = (ok) => {
            if (typeof showToast === 'function') showToast(ok ? 'Room Code Copied' : 'Copy failed');
        };
        if (typeof safelyCopyText === 'function') {
            safelyCopyText(val).then(doCopy).catch(() => {
                if (typeof fallbackCopyText === 'function' && fallbackCopyText(val)) doCopy(true);
                else doCopy(false);
            });
        } else if (typeof fallbackCopyText === 'function') {
            doCopy(fallbackCopyText(val));
        }
    }
}

function inviteFriendShareAction() {
    const valEl = document.getElementById('v3-waiting-room-code');
    const val = valEl ? valEl.innerText.trim() : '';
    if (!val || val === '------') {
        if (typeof showToast === 'function') {
            showToast("NO VALID CODE TO SHARE.");
        }
        return;
    }
    let shareUrl = window.location.href;
    if (shareUrl.startsWith("file:") || shareUrl.includes("android_asset")) {
        shareUrl = "https://ais-pre-rksi42phgt3ylmlby72vbv-1055334286301.asia-southeast1.run.app";
    }
    const inviteText = `Challenge me to a classic 3D Chess duel! Join my private lobby. Code: ${val} in Futecx Chess.\nJoin here: ${shareUrl}`;
   
    if (window.AndroidApp && window.AndroidApp.shareText) {
        try {
            window.AndroidApp.shareText(inviteText);
            return;
        } catch (e) {
            console.warn("AndroidApp shareText failed:", e);
        }
    }
   
    if (navigator.share) {
        navigator.share({
            title: 'Futecx Chess Private Duel',
            text: inviteText,
            url: shareUrl
        }).catch(err => {
            console.warn("Share API was aborted or ran into an error:", err);
            // Fallback since share aborted
            fallbackCopyAction(inviteText);
        });
    } else {
        fallbackCopyAction(inviteText);
    }
}

function fallbackCopyAction(inviteText) {
    if (typeof safelyCopyText === 'function') {
        safelyCopyText(inviteText).then(() => {
            if (typeof showToast === 'function') {
                showToast("DUEL INVITATION COPIED FOR SHARING!");
            }
        }).catch(e => {
            console.error("Clipboard copy failure:", e);
        });
    } else if (typeof fallbackCopyText === 'function') {
        if (fallbackCopyText(inviteText)) {
            if (typeof showToast === 'function') {
                showToast("DUEL INVITATION COPIED FOR SHARING!");
            }
        } else {
            console.error("All copy strategies failed");
        }
    }
}

function joinRoomFromInput() {
    const roomInput = document.getElementById('join-room-input') || document.getElementById('v3-join-input');
    const input = roomInput ? roomInput.value.toUpperCase().trim() : "";
    if (!input) {
        if (typeof showToast === 'function') {
            showToast("PLEASE INPUT A 6-CHARACTER CODE.");
        }
        return;
    }
   
    if (!networkSync) {
        try {
            if (typeof getChessMultiplayer === 'function') {
                networkSync = getChessMultiplayer(handleSocketMessage, handleSocketStatus);
            } else if (typeof window.ChessMultiplayer !== 'undefined') {
                networkSync = new window.ChessMultiplayer(handleSocketMessage, handleSocketStatus);
            }
        } catch (e) {
            console.error("joinRoomFromInput: Lazy initialization failed:", e);
        }
    }
   
    if (!networkSync) {
        if (typeof showToast === 'function') {
            showToast("ONLINE SYSTEMS UNREACHABLE. COULD NOT JOIN.");
        }
        return;
    }
   
    try {
        const outcome = networkSync.joinRoom(input);
        if (outcome) {
            myPlayerColor = 'b';
            localPlayMode = false;
           
            // Show Code UI
            const roomCodeBox = document.getElementById('room-code-display-box');
            if (roomCodeBox) roomCodeBox.classList.remove('hidden-info');
            const roomCodeVal = document.getElementById('game-room-code');
            if (roomCodeVal) roomCodeVal.innerText = input;
           
            // Transition Screen
            transitionScreen('lobby', 'game-screen');
           
            const opponentName = document.getElementById('opponent-name');
            if (opponentName) opponentName.innerText = "ESTABLISHING HANDSHAKE...";
            const opponentStatus = document.getElementById('opponent-status');
            if (opponentStatus) opponentStatus.innerText = "WAITING...";
           
            if (activeEngine) activeEngine.reset();
            syncPiecesWithEngineState();
        }
    } catch (e) {
        console.error("Failed to join room:", e);
        if (typeof showToast === 'function') {
            showToast("ERROR JOINING PRIVATE ROOM.");
        }
    }
}

function startLocalPlay() {
    if (typeof clearPrivateRoomState === 'function') clearPrivateRoomState();
    localPlayMode = true;
    myPlayerColor = 'w'; // Play both
   
    document.getElementById('room-code-display-box').classList.add('hidden-info');
    document.getElementById('opponent-name').innerText = "CHALLENGER (BLACK)";
    document.getElementById('opponent-status').innerText = "LOCAL PASS & PLAY";
    document.getElementById('player-name').innerText = "CHALLENGER (WHITE)";
    document.getElementById('player-status').innerText = "LOCAL PASS & PLAY";
   
    transitionScreen('lobby', 'game-screen');
   
    activeEngine.reset();
    syncPiecesWithEngineState();
    startMatch();
}

function transitionScreen(fromId, toId) {
    if (typeof transitionScreenV3 === 'function') {
        transitionScreenV3(toId);
    } else {
        document.getElementById(fromId).classList.remove('active-screen');
        document.getElementById(fromId).classList.add('hidden-screen');
        document.getElementById(toId).classList.remove('hidden-screen');
        document.getElementById(toId).classList.add('active-screen');
       
        // trigger size redraw in canvas
        setTimeout(() => {
            onWindowResize();
        }, 100);
    }
}

function startMatch(skipIntro) {
    dismissCoachPanel(); // Force clean up of coach popup and highlights
    window.matchHintUsage = 0;
    window.blunderShieldActive = false;
    window.matchEndSoundPlayed = false;
    if (typeof clearThreatHighlights === 'function') clearThreatHighlights();
    if (typeof updateHintButtonUI === 'function') updateHintButtonUI();

    capturedByWhite = [];
    capturedByBlack = [];
    renderCapturedTrays();
    updateCoachButtonVisibility();

    // For local/computer matches: immediately hide any leftover network overlays
    // (they can persist from a previous online session or from Firebase init)
    if (localPlayMode) {
        const recoveryOverlay = document.getElementById('connection-recovery-overlay');
        if (recoveryOverlay) {
            recoveryOverlay.classList.add('hidden-banner');
            recoveryOverlay.style.display = '';
        }
        const networkBanner = document.getElementById('network-status-banner');
        if (networkBanner) networkBanner.classList.add('hidden-banner');
    }

    const runStart = () => {
        if (typeof updateGameStateVisibility === 'function') updateGameStateVisibility('play');
        isGameActive = true;
        whiteTime = matchTimeLimit;
        blackTime = matchTimeLimit;
        window.localBoardVersion = 0;
        window.isWaitingForNetworkAck = false;
        updateHUDTimers();

        if (typeof FtechSystem !== 'undefined' && FtechSystem.acquireMatchSession) {
            FtechSystem.acquireMatchSession();
        }
        if (typeof initGameChatPanel === 'function') initGameChatPanel();

        if (!localPlayMode) {
            if (myPlayerColor === 'w') resetCameraAngle();
            else reverseBoardCameraAngle();
        } else {
            resetCameraAngle();
        }

        applyAdaptiveCameraProfile();
        if (currentTimer) clearInterval(currentTimer);
        currentTimer = setInterval(tickGameClock, 1000);

        const botModes = ['computer', 'play_online', 'ranked'];
        if (typeof FtechSystem !== 'undefined' && botModes.includes(FtechSystem.currentGameMode)) {
            const isBot = FtechSystem.matchOpponentInfo && FtechSystem.matchOpponentInfo.isBot;
            if (FtechSystem.currentGameMode === 'computer' || isBot) {
                if (activeEngine.turn !== myPlayerColor) {
                    setTimeout(triggerComputerAIMove, 800);
                }
            }
        }
        triggerTurnNotification(true);
    };

    if (!skipIntro && typeof playMatchIntro === 'function') {
        playMatchIntro(runStart);
    } else {
        runStart();
    }
}

function triggerComputerAIMove() {
    const isBotMatch = typeof FtechSystem !== 'undefined' && FtechSystem.matchOpponentInfo && FtechSystem.matchOpponentInfo.isBot;
    const aiModes = ['computer', 'play_online', 'ranked'];
    const modeOk = typeof FtechSystem !== 'undefined' && aiModes.includes(FtechSystem.currentGameMode);
    if (!localPlayMode && !isBotMatch) return;
    if (!isGameActive || typeof FtechSystem === 'undefined') return;
    if (!modeOk && !isBotMatch) return;
    if (FtechSystem.currentGameMode === 'ranked' && !isBotMatch) return;
    if (activeEngine.turn === myPlayerColor) return;

    console.log("Ftech V2: Computer is formulating algebraic move...");
    const aiMove = ChessAI.computeMove(activeEngine, FtechSystem.computerDifficulty);
    if (aiMove) {
        const { from, to } = aiMove;
        console.log("Ftech V2: Robot move calculated:", from, "to", to);
        finalizeMoveExecution(from.row, from.col, to.row, to.col, 'Q');
    } else {
        console.warn("Ftech V2: No legal branches found on state evaluation tree.");
    }
}

function tickGameClock() {
    if (!isGameActive) return;
   
    if (activeEngine.turn === 'w') {
        if (whiteTime > 0) {
            whiteTime--;
        } else {
            handleTimeoutExhaustion('w');
        }
    } else {
        if (blackTime > 0) {
            blackTime--;
        } else {
            handleTimeoutExhaustion('b');
        }
    }
   
    updateHUDTimers();
   
    // Creator synchronizes time occasionally to resolve network latency gaps
    if (!localPlayMode && myPlayerColor === 'w' && whiteTime % 5 === 0) {
        networkSync.syncTimers(whiteTime, blackTime);
    }
}

function updateHUDTimers() {
    const wEl = document.getElementById('timer-val-white');
    const bEl = document.getElementById('timer-val-black');
    if (wEl) wEl.innerText = formatTimerValue(whiteTime);
    if (bEl) bEl.innerText = formatTimerValue(blackTime);

    const isWhiteTurn = activeEngine.turn === 'w';
    const myIsWhite = myPlayerColor === 'w' || localPlayMode;
    const myTime = (myPlayerColor === 'w') ? whiteTime : blackTime;
    const oppTime = (myPlayerColor === 'w') ? blackTime : whiteTime;
    if (localPlayMode) {
        const pVal = document.getElementById('timer-val-player');
        const oVal = document.getElementById('timer-val-opponent');
        if (pVal) pVal.innerText = formatTimerValue(isWhiteTurn ? whiteTime : blackTime);
        if (oVal) oVal.innerText = formatTimerValue(isWhiteTurn ? blackTime : whiteTime);
    } else {
        const pVal = document.getElementById('timer-val-player');
        const oVal = document.getElementById('timer-val-opponent');
        if (pVal) pVal.innerText = formatTimerValue(myTime);
        if (oVal) oVal.innerText = formatTimerValue(oppTime);
    }

    const pWrap = document.getElementById('timer-player-wrap');
    const oWrap = document.getElementById('timer-opponent-wrap');
    const myTurn = localPlayMode ? true : (activeEngine.turn === myPlayerColor);
    if (pWrap) pWrap.classList.toggle('active-timer', myTurn);
    if (oWrap) oWrap.classList.toggle('active-timer', !myTurn && !localPlayMode);

    const statusLabel = document.getElementById('game-status-label');
    if (statusLabel) {
        statusLabel.innerText = isWhiteTurn ? "WHITE'S TURN" : "BLACK'S TURN";
    }
}

function formatTimerValue(totalSecs) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function handleTimeoutExhaustion(losingColor) {
    const winnerColor = losingColor === 'w' ? 'b' : 'w';
    if (!localPlayMode) {
        networkSync.claimVictory('timeout');
    }
    handleMatchTermination('timeout', winnerColor);
}

function resignGame() {
    if (!isGameActive) return;
   
    if (!localPlayMode) {
        networkSync.broadcastResignation();
        handleMatchTermination('resigned', myPlayerColor === 'w' ? 'b' : 'w');
    } else {
        // Local resigned
        handleMatchTermination('resigned', activeEngine.turn === 'w' ? 'b' : 'w');
    }
}

function returnToLobby() {
    const wasActive = isGameActive;
    const mode = (typeof FtechSystem !== 'undefined') ? FtechSystem.currentGameMode : '';
    if (wasActive && (mode === 'ranked' || (!localPlayMode && mode !== 'practice'))) {
        if (mode === 'ranked' && typeof FtechSystem !== 'undefined' && FtechSystem.handleRankedQuit) {
            FtechSystem.handleRankedQuit();
            return;
        }
        if (typeof FtechSystem !== 'undefined' && FtechSystem.awardMatchEnd) {
            FtechSystem.awardMatchEnd('forfeit', 'loss');
        }
    }
    isGameActive = false;
    if (typeof clearPrivateRoomState === 'function') clearPrivateRoomState();
    if (currentTimer) clearInterval(currentTimer);

    if (typeof FtechSystem !== 'undefined' && FtechSystem.releaseMatchSession) {
        FtechSystem.releaseMatchSession();
    }
    if (typeof stopWaitingRoomFriendRoster === 'function') stopWaitingRoomFriendRoster();
   
    if (!localPlayMode && networkSync) {
        try {
            networkSync.disconnectRoom();
        } catch (e) {
            console.error("Error disconnecting room:", e);
        }
    }
   
    // Reset inputs safely
    const roomInput = document.getElementById('join-room-input') || document.getElementById('v3-join-input');
    if (roomInput) roomInput.value = "";
   
    capturedByWhite = [];
    capturedByBlack = [];
    renderCapturedTrays();
    dismissCoachPanel();

    window.matchHintUsage = 0;
    window.blunderShieldActive = false;
    window.matchEndSoundPlayed = false;
    if (typeof clearThreatHighlights === 'function') clearThreatHighlights();
    if (typeof updateHintButtonUI === 'function') updateHintButtonUI();

    const movesList = document.getElementById('moves-list');
    if (movesList) movesList.innerHTML = `<div class="empty-moves-placeholder">Awaiting first move...</div>`;
   
    // Hide Modals safely
    const resultOverlay = document.getElementById('result-overlay');
    if (resultOverlay) resultOverlay.classList.add('hidden-modal');
   
    const promotionDialog = document.getElementById('promotion-dialog');
    if (promotionDialog) promotionDialog.classList.add('hidden-modal');
   
    // Reset standard angles safely
    try {
        resetCameraAngle();
    } catch (e) {
        console.error("Error resetting camera angle:", e);
    }
   
    // Transition back to lobby safely using V3 transitions
    if (typeof transitionScreenV3 === 'function') {
        transitionScreenV3('lobby');
    } else {
        transitionScreen('game-screen', 'lobby');
    }
}

function handleMatchTermination(reason, winnerColor) {
    isGameActive = false;
    if (currentTimer) clearInterval(currentTimer);
    dismissCoachPanel(); // Force clean up of coach popup and highlights on termination

    if (typeof FtechSystem !== 'undefined' && FtechSystem.releaseMatchSession) {
        FtechSystem.releaseMatchSession();
    }
   
    const overlay = document.getElementById('result-overlay');
    const title = document.getElementById('result-title');
    const desc = document.getElementById('result-desc');
   
    overlay.classList.remove('hidden-modal');
   
    let resultText = 'draw';
    if (winnerColor !== 'draw') {
        resultText = (winnerColor === myPlayerColor) ? 'win' : 'lose';
    }

    if (!window.matchEndSoundPlayed) {
        window.matchEndSoundPlayed = true;
        if (resultText === 'win') {
            playGameSound('victory');
        } else if (resultText === 'lose') {
            playGameSound('defeat');
        } else {
            playGameSound('draw');
        }
    }
   
    // Call V2 reward payout engine
    if (typeof FtechSystem !== 'undefined') {
        FtechSystem.awardMatchEnd(activeEngine.verifyGameOverState(), resultText);
    }
   
    if (winnerColor === 'draw') {
        title.innerText = "STALEMATE / DRAW";
        desc.innerText = "NO GENERAL SECURED ADVANTAGE";
    } else {
        const winLabel = winnerColor === 'w' ? "WHITE" : "BLACK";
        if (reason === 'timeout') {
            title.innerText = `${winLabel} WINS!`;
            desc.innerText = "VICTORY ACCRUED BY TIME EXHAUSTION";
        } else if (reason === 'resigned') {
            title.innerText = `${winLabel} WINS!`;
            desc.innerText = "OPPONENT HAS WILLINGLY RESIGNED";
        } else if (reason === 'disconnect') {
            title.innerText = "WIN BY TECHNICALITY";
            desc.innerText = "OPPONENT HAS FORFEITED BY DISCONNECTION";
        } else {
            title.innerText = "CHECKMATE";
            desc.innerText = `${winLabel} SECURES UTTER VICTORY`;
        }
    }
}

function showPermissionsOverlay() {
    const overlay = document.getElementById('permissions-overlay');
    if (overlay) {
        overlay.classList.remove('hidden-modal');
    }
}

function closePermissionsOverlay() {
    const overlay = document.getElementById('permissions-overlay');
    if (overlay) {
        overlay.classList.add('hidden-modal');
    }
}


/* ------------------ PROCEDURAL GRAPHICS ------------------ */

// Beautiful real-time procedural wood texture canvas designer
/* ------------------ PROCEDURAL GRAPHICS & GEOMETRY CACHING ------------------ */

// Pre-computed geometry cache to fully protect GPU buffers and speed up sync times to < 1ms
const geometriesCache = {};

function getCachedGeometry(key, builderFunc) {
    if (!geometriesCache[key]) {
        geometriesCache[key] = builderFunc();
    }
    return geometriesCache[key];
}

// Beautiful real-time procedural wood texture canvas designer (optimized loop counts for fast startup)
function createWoodTexture(isDarkSquare) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
   
    // Set base gradient
    const grad = ctx.createRadialGradient(256, 256, 10, 256, 256, 360);
    if (isDarkSquare) {
        grad.addColorStop(0, '#1c1c1c');
        grad.addColorStop(0.5, '#0f0f0f');
        grad.addColorStop(1, '#050505');
    } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#eaeaea');
        grad.addColorStop(1, '#d8d8d8');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
   
    // Draw fine natural wooden streaks
    ctx.strokeStyle = isDarkSquare ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
   
    // Streaks following high-quality ring paths
    const cx = 256 + (Math.random() - 0.5) * 120;
    const cy = 256 + (Math.random() - 0.5) * 120;
   
    for (let radius = 6; radius < 600; radius += 5 + Math.random() * 8) {
        ctx.beginPath();
        // Draw slightly wavy natural circle representing tree rings
        for (let angle = 0; angle <= Math.PI * 2 + 0.1; angle += 0.05) {
            const wave = Math.sin(angle * 12) * 2 + Math.cos(angle * 5) * 1.5;
            const r = radius + wave;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (angle === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
   
    // Soft noise dots for organic satin wood grain depth (optimized dot counts for startup performance)
    ctx.fillStyle = isDarkSquare ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.015)';
    for (let k = 0; k < 1200; k++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 1.5;
        ctx.fillRect(x, y, size, size);
    }
   
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}


/* ------------------ 3D SCENE ORCHESTRATION ------------------ */
function setup3DScene() {
    container = document.getElementById('canvas-container');
    const renderHost = document.getElementById('board-render-host') || container;

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#050508');
    scene.fog = new THREE.FogExp2('#050508', 0.025);

    // Perspective camera: aspect=1 initially; onWindowResize corrects it immediately after.
    // FOV and position are managed by applyAdaptiveCameraProfile() for responsive centering.
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
    // Set initial position so board (centered at origin) is visible from the start
    camera.position.set(0, 8.2, 10.5);
    camera.lookAt(0, 0, 0);
    controls = null;

    const isPerfMode = localStorage.getItem('performanceMode') === 'true';
    if (isPerfMode) document.body.classList.add('performance-mode');
    
    renderer = new THREE.WebGLRenderer({ antialias: !isPerfMode, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(isPerfMode ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isPerfMode;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderHost.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 20;
    controls.target.set(0, 0, 0);

    woodLightMaterial = new THREE.MeshStandardMaterial({
        map: createWoodTexture(false),
        roughness: 0.45,
        metalness: 0.02
    });
    woodDarkMaterial = new THREE.MeshStandardMaterial({
        map: createWoodTexture(true),
        roughness: 0.42,
        metalness: 0.02
    });
    pieceLightMaterial = new THREE.MeshStandardMaterial({
        color: 0xf0ece4,
        roughness: 0.35,
        metalness: 0.08
    });
    pieceDarkMaterial = new THREE.MeshStandardMaterial({
        color: 0x16161e,
        roughness: 0.35,
        metalness: 0.25,
        emissive: 0x282833, // Stronger emissive glow so it doesn't blend
        emissiveIntensity: 0.20
    });
    highlightBorderMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
    });

    sceneLights.ambient = new THREE.AmbientLight(0x555566, 0.65); // Brighter ambient
    scene.add(sceneLights.ambient);

    sceneLights.hemisphere = new THREE.HemisphereLight(0xffeedd, 0x1a1020, 0.55);
    scene.add(sceneLights.hemisphere);

    sceneLights.directional = new THREE.DirectionalLight(0xfff5e6, 0.95);
    sceneLights.directional.position.set(5, 12, 8);
    sceneLights.directional.castShadow = true;
    sceneLights.directional.shadow.mapSize.width = 1024;
    sceneLights.directional.shadow.mapSize.height = 1024;
    sceneLights.directional.shadow.bias = -0.0008;
    sceneLights.directional.shadow.camera.near = 1;
    sceneLights.directional.shadow.camera.far = 30;
    sceneLights.directional.shadow.camera.left = -8;
    sceneLights.directional.shadow.camera.right = 8;
    sceneLights.directional.shadow.camera.top = 8;
    sceneLights.directional.shadow.camera.bottom = -8;
    scene.add(sceneLights.directional);

    sceneLights.fill = new THREE.DirectionalLight(0xaaccff, 0.40); // Stronger fill for dark side
    sceneLights.fill.position.set(-6, 4, -6);
    scene.add(sceneLights.fill);

    sceneLights.rim = new THREE.DirectionalLight(0x88bbff, 0.35); // New rim light for piece outlines
    sceneLights.rim.position.set(0, 5, -10);
    scene.add(sceneLights.rim);

    buildChessboard3D();
    syncPiecesWithEngineState();
    applyAdaptiveCameraProfile();
    onWindowResize();
    animate3DFrame();
}

function buildChessboard3D() {
    // Elegant Black wooden surrounding platform
    const platformGeom = new THREE.BoxGeometry(8.8, 0.2, 8.8);
    const platformBackingMaterial = new THREE.MeshStandardMaterial({
        color: 0x070707,
        roughness: 0.4,
        metalness: 0.3
    });
    const platformMesh = new THREE.Mesh(platformGeom, platformBackingMaterial);
    platformMesh.position.y = -0.101;
    platformMesh.receiveShadow = true;
    scene.add(platformMesh);
    boardPlatformMesh = platformMesh;
    boardPlatformMesh = platformMesh;

    // 8x8 Tile blocks
    const tileGeom = new THREE.BoxGeometry(1.0, 0.08, 1.0);
   
    for (let r = 0; r < 8; r++) {
        boardSquares[r] = [];
        for (let c = 0; c < 8; c++) {
            const isDark = (r + c) % 2 === 1;
            const mat = isDark ? woodDarkMaterial : woodLightMaterial;
           
            const squareMesh = new THREE.Mesh(tileGeom, mat);
            // Centered layout calculations: 0 to 7 maps to -3.5 to 3.5 center
            squareMesh.position.set(c - 3.5, -0.04, r - 3.5);
            squareMesh.receiveShadow = true;
           
            // Custom properties to trace on intersections
            squareMesh.userData = { row: r, col: c, isTile: true };
           
            scene.add(squareMesh);
            boardSquares[r][c] = squareMesh;
        }
    }
    applyBoardSkin();
}

function applyBoardSkin() {
    if (!boardSquares.length || typeof FtechSystem === 'undefined') return;
    const boardId = FtechSystem.account.equippedBoard || FtechSystem.account.board || 'board_classic';
    let lightColor = 0xd4b896;
    let darkColor = 0x5c4033;
    if (boardId === 'board_obsidian') { lightColor = 0x455a64; darkColor = 0x263238; }
    else if (boardId === 'board_royal') { lightColor = 0xffd54f; darkColor = 0xb8860b; }
    else if (boardId === 'board_neon') { lightColor = 0x1565c0; darkColor = 0x0a1929; }
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const mesh = boardSquares[r][c];
            if (!mesh) continue;
            const isDark = (r + c) % 2 === 1;
            mesh.material.color.setHex(isDark ? darkColor : lightColor);
        }
    }
}

window.applyBoardSkin = applyBoardSkin;

// Beautiful custom lathe curves to represent standard professional pieces mathematically
function generatePieceGeometry(pieceType) {
    return getCachedGeometry(`lathe_${pieceType}`, () => {
        const pts = [];
       
        // Base profile common to tournament setups
        pts.push(new THREE.Vector2(0.001, 0));
        pts.push(new THREE.Vector2(0.38, 0));
        pts.push(new THREE.Vector2(0.38, 0.08));
        pts.push(new THREE.Vector2(0.30, 0.12));
        pts.push(new THREE.Vector2(0.26, 0.16));
       
        switch (pieceType) {
            case 'p': // Pawn
                pts.push(new THREE.Vector2(0.25, 0.22));
                for (let i = 0; i <= 8; i++) {
                    const t = i / 8;
                    const y = 0.22 + t * 0.45;
                    const x = 0.25 - Math.sin(t * Math.PI) * 0.07 - t * 0.09;
                    pts.push(new THREE.Vector2(x, y));
                }
                pts.push(new THREE.Vector2(0.22, 0.67));
                pts.push(new THREE.Vector2(0.24, 0.70));
                pts.push(new THREE.Vector2(0.15, 0.74));
                pts.push(new THREE.Vector2(0.001, 0.74));
                break;
               
            case 'r': // Rook
                pts.push(new THREE.Vector2(0.27, 0.20));
                for (let i = 0; i <= 8; i++) {
                    const t = i / 8;
                    const y = 0.20 + t * 0.55;
                    const x = 0.27 - t * 0.06;
                    pts.push(new THREE.Vector2(x, y));
                }
                pts.push(new THREE.Vector2(0.28, 0.75));
                pts.push(new THREE.Vector2(0.32, 0.81));
                pts.push(new THREE.Vector2(0.32, 0.94));
                pts.push(new THREE.Vector2(0.24, 0.94));
                pts.push(new THREE.Vector2(0.24, 0.81));
                pts.push(new THREE.Vector2(0.001, 0.81));
                break;
               
            case 'b': // Bishop
                pts.push(new THREE.Vector2(0.26, 0.20));
                for (let i = 0; i <= 10; i++) {
                    const t = i / 10;
                    const y = 0.20 + t * 0.65;
                    const x = 0.26 - Math.sin(t * Math.PI) * 0.08 - t * 0.09;
                    pts.push(new THREE.Vector2(x, y));
                }
                // Teardrop head collar
                pts.push(new THREE.Vector2(0.25, 0.85));
                pts.push(new THREE.Vector2(0.20, 0.95));
                pts.push(new THREE.Vector2(0.12, 1.08));
                pts.push(new THREE.Vector2(0.001, 1.10));
                break;
               
            case 'q': // Queen
                pts.push(new THREE.Vector2(0.28, 0.20));
                for (let i = 0; i <= 12; i++) {
                    const t = i / 12;
                    const y = 0.18 + t * 0.85;
                    const x = 0.28 - Math.sin(t * Math.PI) * 0.09 - t * 0.11;
                    pts.push(new THREE.Vector2(x, y));
                }
                pts.push(new THREE.Vector2(0.28, 1.03));
                pts.push(new THREE.Vector2(0.33, 1.12));
                pts.push(new THREE.Vector2(0.24, 1.22));
                pts.push(new THREE.Vector2(0.001, 1.18));
                break;
               
            case 'k': // King
                pts.push(new THREE.Vector2(0.29, 0.20));
                for (let i = 0; i <= 12; i++) {
                    const t = i / 12;
                    const y = 0.18 + t * 0.95;
                    const x = 0.29 - Math.sin(t * Math.PI) * 0.08 - t * 0.11;
                    pts.push(new THREE.Vector2(x, y));
                }
                pts.push(new THREE.Vector2(0.26, 1.13));
                pts.push(new THREE.Vector2(0.32, 1.24));
                pts.push(new THREE.Vector2(0.22, 1.35));
                pts.push(new THREE.Vector2(0.001, 1.35));
                break;
               
            case 'n': // Knight (returns base profile)
                pts.push(new THREE.Vector2(0.27, 0.18));
                pts.push(new THREE.Vector2(0.23, 0.26));
                pts.push(new THREE.Vector2(0.001, 0.26));
                break;
        }
       
        return new THREE.LatheGeometry(pts, 32);
    });
}

// Chess piece physical mesh assembler factory
function getSkinIdForPieceColor(color) {
    const mySkin = (typeof FtechSystem !== 'undefined' && FtechSystem.account)
        ? (FtechSystem.account.equippedSkin || FtechSystem.account.skin || 'skin_default')
        : 'skin_default';
    const oppSkin = window.opponentEquippedSkin || 'skin_default';
    return color === myPlayerColor ? mySkin : oppSkin;
}

function buildPieceMaterialForSkin(skinId, color) {
    if (skinId === 'skin_obsidian') {
        return color === 'w'
            ? new THREE.MeshStandardMaterial({ color: 0x55555d, roughness: 0.35, metalness: 0.5 })
            : new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.3, metalness: 0.65 });
    }
    if (skinId === 'skin_blue' || skinId === 'skin_neon') {
        return color === 'w'
            ? new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.35, metalness: 0.2, emissive: 0x1565c0, emissiveIntensity: 0.35 })
            : new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.25, metalness: 0.5, emissive: 0x0a192f, emissiveIntensity: 0.25 });
    }
    if (skinId === 'skin_royal_gold') {
        return color === 'w'
            ? new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.28, metalness: 0.75 })
            : new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.25, metalness: 0.8 });
    }
    return color === 'w' ? pieceLightMaterial : pieceDarkMaterial;
}

function create3DPieceMesh(type, color) {
    const parentGroup = new THREE.Group();
    const skinId = getSkinIdForPieceColor(color);
    let material = buildPieceMaterialForSkin(skinId, color);
   
    const latheGeom = generatePieceGeometry(type);
    const bodyMesh = new THREE.Mesh(latheGeom, material);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    parentGroup.add(bodyMesh);
   
    // Add piece-specific visual finishes
    if (type === 'p') {
        // Sphere cap on Pawn
        const sphereGeom = getCachedGeometry('sphere_pawn', () => new THREE.SphereGeometry(0.18, 20, 20));
        const sphereCap = new THREE.Mesh(sphereGeom, material);
        sphereCap.position.y = 0.84;
        sphereCap.castShadow = true;
        parentGroup.add(sphereCap);
    }
    else if (type === 'r') {
        // Cutout crenellations inside the solid castle ring
        const crownGeom = getCachedGeometry('cylinder_rook', () => new THREE.CylinderGeometry(0.28, 0.28, 0.14, 16));
        const crownRing = new THREE.Mesh(crownGeom, material);
        crownRing.position.y = 0.95;
        crownRing.castShadow = true;
        parentGroup.add(crownRing);
    }
    else if (type === 'b') {
        // Cute bead ball topped on Bishop
        const ballGeom = getCachedGeometry('sphere_bishop', () => new THREE.SphereGeometry(0.06, 12, 12));
        const ball = new THREE.Mesh(ballGeom, material);
        ball.position.y = 1.15;
        ball.castShadow = true;
        parentGroup.add(ball);
    }
    else if (type === 'n') {
        // Knight Horse body Extruded from hand-crafted 2D vector path for absolute tournament precision!
        const extrudeGeom = getCachedGeometry('extrude_knight', () => {
            const logoShape = new THREE.Shape();
            logoShape.moveTo(0, 0.2);
            logoShape.lineTo(0.16, 0.2);
            logoShape.quadraticCurveTo(0.28, 0.24, 0.28, 0.42); // Chest
            logoShape.quadraticCurveTo(0.31, 0.52, 0.18, 0.68); // Chin
            logoShape.lineTo(0.28, 0.72); // Nose start
            logoShape.lineTo(0.24, 0.81);
            logoShape.lineTo(0.12, 0.78); // Muzzle
            logoShape.lineTo(0.06, 0.92); // Ear
            logoShape.lineTo(-0.02, 0.88);
            logoShape.lineTo(-0.05, 0.72); // Back neck
            logoShape.quadraticCurveTo(-0.16, 0.45, -0.16, 0.2);
            logoShape.lineTo(0, 0.2);
           
            const extrudeSettings = {
                depth: 0.14,
                bevelEnabled: true,
                bevelSegments: 4,
                steps: 1,
                bevelSize: 0.015,
                bevelThickness: 0.02
            };
           
            const g = new THREE.ExtrudeGeometry(logoShape, extrudeSettings);
            g.center();
            return g;
        });
       
        const horseMesh = new THREE.Mesh(extrudeGeom, material);
        // Adjust and lift on top of the turn-base pedestal
        horseMesh.rotation.y = Math.PI / 2;
        horseMesh.position.set(0, 0.52, 0);
        horseMesh.castShadow = true;
        horseMesh.receiveShadow = true;
       
        // Orient horse dynamically: White faces North (+Y rotation), Black faces South
        if (color === 'b') {
            horseMesh.rotation.y = -Math.PI / 2;
        }
       
        parentGroup.add(horseMesh);
    }
    else if (type === 'q') {
        // Beautiful scalloped crown ring topped on Queen
        const beadGeom = getCachedGeometry('sphere_queen', () => new THREE.SphereGeometry(0.06, 12, 12));
        const crownBeadList = new THREE.Mesh(beadGeom, material);
        crownBeadList.position.y = 1.21;
        crownBeadList.castShadow = true;
        parentGroup.add(crownBeadList);
    }
    else if (type === 'k') {
        // Cross finial topped on King
        const crossGrp = new THREE.Group();
        const horizGeom = getCachedGeometry('box_king_h', () => new THREE.BoxGeometry(0.18, 0.05, 0.05));
        const vertGeom = getCachedGeometry('box_king_v', () => new THREE.BoxGeometry(0.05, 0.26, 0.05));
       
        const horiz = new THREE.Mesh(horizGeom, material);
        const vert = new THREE.Mesh(vertGeom, material);
       
        vert.position.y = 0.05;
        horiz.position.y = 0.12;
        crossGrp.add(horiz);
        crossGrp.add(vert);
       
        crossGrp.position.y = 1.34;
        crossGrp.castShadow = true;
        parentGroup.add(crossGrp);
    }
   
    // Scale standard pieces group slightly to seat perfectly inside 1.0 width tiles
    parentGroup.scale.set(0.85, 0.85, 0.85);
   
    return parentGroup;
}


/* ------------------ MODEL/ENGINE SYNCHING ------------------ */

// Resets positions and models to tie completely with engine state board
function disposeMeshMaterials(mesh) {
    if (!mesh) return;
    mesh.traverse(child => {
        if (child.isMesh) {
            if (child.geometry && !geometriesCache[child.geometry.uuid]) {
                /* keep cached geoms */
            }
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => {
                    if (m.map) { m.map.dispose(); m.map = null; }
                    m.dispose();
                });
            }
        }
    });
}

window.syncPiecesWithEngineState = function syncPiecesWithEngineState() {
    for (const [, mesh] of chessPiecesMap.entries()) {
        disposeMeshMaterials(mesh);
        scene.remove(mesh);
    }
    chessPiecesMap.clear();

    if (woodLightMaterial && woodLightMaterial.map) {
        woodLightMaterial.map.dispose();
        woodLightMaterial.map = createWoodTexture(false);
        woodLightMaterial.needsUpdate = true;
    }
    if (woodDarkMaterial && woodDarkMaterial.map) {
        woodDarkMaterial.map.dispose();
        woodDarkMaterial.map = createWoodTexture(true);
        woodDarkMaterial.needsUpdate = true;
    }
    applyBoardSkin();

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = activeEngine.getPieceAt(r, c);
            if (piece) {
                const mesh = create3DPieceMesh(piece.type, piece.color);
                mesh.position.set(c - 3.5, 0, r - 3.5);
                mesh.userData = { row: r, col: c, type: piece.type, color: piece.color, isPiece: true };
                scene.add(mesh);
                chessPiecesMap.set(`${r}_${c}`, mesh);
            }
        }
    }
    clearSelectedHighlights();
};


/* ------------------ INTERACTION AND RAYCASTS ------------------ */

function onBoardTouch(event) {
    if (event.touches.length > 0) {
        // Only evaluate single taps
        mouse.x = (event.touches[0].clientX / container.clientWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / container.clientHeight) * 2 + 1;
        evaluateClickIntersection();
    }
}

function onBoardClick(event) {
    // Retrieve coordinates in 2D normalized space
    const bounds = container.getBoundingClientRect();
    mouse.x = ((event.clientX - bounds.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / container.clientHeight) * 2 + 1;
    evaluateClickIntersection();
}

function evaluateClickIntersection() {
    if (!isGameActive) return;
   
    // Restrict inputs to only my turn during Online matches
    if (!localPlayMode && (activeEngine.turn !== myPlayerColor || window.isWaitingForNetworkAck)) {
        return;
    }
   
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
   
    if (intersects.length === 0) return;
   
    // Identify target object
    let targetObj = null;
    for (const hit of intersects) {
        // Resolve parent group structures down to recognized items
        let curr = hit.object;
        while (curr && curr !== scene) {
            if (curr.userData && (curr.userData.isPiece || curr.userData.isTile || curr.userData.isMarker)) {
                targetObj = curr;
                break;
            }
            curr = curr.parent;
        }
        if (targetObj) break;
    }
   
    if (!targetObj) return;
   
    // CASE A: User clicked a Valid Move Marker directly
    if (targetObj.userData && targetObj.userData.isMarker) {
        const dest = targetObj.userData;
        executeSelectedMove(dest.row, dest.col);
        return;
    }
   
    // CASE B: User clicked a piece
    if (targetObj.userData && targetObj.userData.isPiece) {
        const pieceInfo = targetObj.userData;
       
        // Is it the player's own active piece? Set selection
        if (pieceInfo.color === activeEngine.turn) {
            selectPieceOnBoard(pieceInfo.row, pieceInfo.col);
        } else {
            // Player clicked an enemy piece. Is this square marked as a valid move?
            if (selectedPieceCoord && isSquareInValidList(pieceInfo.row, pieceInfo.col)) {
                executeSelectedMove(pieceInfo.row, pieceInfo.col);
            } else {
                clearSelectedHighlights();
            }
        }
        return;
    }
   
    // CASE C: User clicked an empty tile
    if (targetObj.userData && targetObj.userData.isTile) {
        const tileInfo = targetObj.userData;
        if (selectedPieceCoord && isSquareInValidList(tileInfo.row, tileInfo.col)) {
            executeSelectedMove(tileInfo.row, tileInfo.col);
        } else {
            clearSelectedHighlights();
        }
    }
}

function selectPieceOnBoard(row, col) {
    clearSelectedHighlights();
   
    selectedPieceCoord = { row, col };
   
    // Highlight the original square
    const tileMesh = boardSquares[row][col];
    if (tileMesh) {
        // Set thin silver ring indicator or lift selected piece slightly up
        const key = `${row}_${col}`;
        const pieceMesh = chessPiecesMap.get(key);
        if (pieceMesh) {
            // Elegant vertical lift to denote selection states
            pieceMesh.position.y = 0.25;
        }
    }
   
    // Query moves and render markers (Classic mode assist only)
    const moves = activeEngine.getValidMoves(row, col);
    if (window.moveAssistEnabled !== false) {
        drawValidMoveMarkers(moves);
    }
}

function drawValidMoveMarkers(moves) {
    clearMoveMarkers();
    if (window.moveAssistEnabled === false) return;

    const discGeom = new THREE.RingGeometry(0.1, 0.22, 32);
    discGeom.rotateX(-Math.PI / 2);

    const moveMat = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide
    });

    for (const move of moves) {
        const targetPiece = activeEngine.getPieceAt(move.row, move.col);
        const isCapture = targetPiece !== null;
        const x = move.col - 3.5;
        const z = move.row - 3.5;

        if (isCapture && selectedPieceCoord) {
            const boxGeom = new THREE.PlaneGeometry(0.88, 0.88);
            boxGeom.rotateX(-Math.PI / 2);
            const box = new THREE.Mesh(boxGeom, new THREE.MeshBasicMaterial({
                color: 0xff3333,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide
            }));
            box.position.set(x, 0.06, z);
            box.userData = { row: move.row, col: move.col, isMarker: true };
            scene.add(box);
            validMoveMarkers.push(box);

            const fromX = selectedPieceCoord.col - 3.5;
            const fromZ = selectedPieceCoord.row - 3.5;
            const points = [
                new THREE.Vector3(fromX, 0.08, fromZ),
                new THREE.Vector3(x, 0.08, z)
            ];
            const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineDashedMaterial({
                color: 0xff4444,
                dashSize: 0.15,
                gapSize: 0.1,
                transparent: true,
                opacity: 0.75
            });
            const line = new THREE.Line(lineGeom, lineMat);
            line.computeLineDistances();
            scene.add(line);
            attackLineMeshes.push(line);
        } else {
            const ring = new THREE.Mesh(discGeom, moveMat);
            ring.position.set(x, 0.05, z);
            ring.userData = { row: move.row, col: move.col, isMarker: true };
            scene.add(ring);
            validMoveMarkers.push(ring);
        }
    }
}

function clearMoveMarkers() {
    for (const marker of validMoveMarkers) {
        scene.remove(marker);
        if (marker.geometry) marker.geometry.dispose();
        if (marker.material) marker.material.dispose();
    }
    validMoveMarkers = [];
    for (const line of attackLineMeshes) {
        scene.remove(line);
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
    }
    attackLineMeshes = [];
}

function isSquareInValidList(row, col) {
    return validMoveMarkers.some(m => m.userData.row === row && m.userData.col === col);
}

function clearSelectedHighlights() {
    if (selectedPieceCoord) {
        const prevKey = `${selectedPieceCoord.row}_${selectedPieceCoord.col}`;
        const prevMesh = chessPiecesMap.get(prevKey);
        if (prevMesh) {
            // Restore flat floor seating
            prevMesh.position.y = 0;
        }
    }
    selectedPieceCoord = null;
    clearMoveMarkers();
}


/* ------------------ ENGINE MOVE TRIGGERING ------------------ */

function executeSelectedMove(toRow, toCol) {
    if (!selectedPieceCoord) return;
   
    const fromRow = selectedPieceCoord.row;
    const fromCol = selectedPieceCoord.col;
   
    // Check if move is Pawn Promotion rank (White to row 0, Black to row 7)
    const movingPiece = activeEngine.getPieceAt(fromRow, fromCol);
    if (movingPiece.type === 'p' && (toRow === 0 || toRow === 7)) {
        pendingPromotionMove = { fromRow, fromCol, toRow, toCol };
        // Trigger dialog selection
        document.getElementById('promotion-dialog').classList.remove('hidden-modal');
        return;
    }
   
    // Normal move
    finalizeMoveExecution(fromRow, fromCol, toRow, toCol, 'Q');
}

function selectPromotionPiece(pieceChar) {
    document.getElementById('promotion-dialog').classList.add('hidden-modal');
    if (pendingPromotionMove) {
        const { fromRow, fromCol, toRow, toCol } = pendingPromotionMove;
        pendingPromotionMove = null;
        finalizeMoveExecution(fromRow, fromCol, toRow, toCol, pieceChar);
    }
}

function finalizeMoveExecution(fromRow, fromCol, toRow, toCol, promotionPiece) {
    // Intercept with Blunder Shield if active
    if (window.blunderShieldActive && activeEngine.turn === myPlayerColor) {
        const isSafe = checkMoveSafety(fromRow, fromCol, toRow, toCol, promotionPiece);
        if (!isSafe) {
            showBlunderWarning(() => {
                // If they proceed, temporarily bypass shield to execute the move
                window.blunderShieldActive = false;
                finalizeMoveExecution(fromRow, fromCol, toRow, toCol, promotionPiece);
                window.blunderShieldActive = true;
            });
            return;
        }
    }

    if (!localPlayMode) {
        // Online Multiplayer Processing
        if (activeEngine.turn !== myPlayerColor || window.isWaitingForNetworkAck) {
            console.warn("Input locked or not your turn!");
            clearSelectedHighlights();
            return;
        }

        // Validate legality locally before executing
        const validMoves = activeEngine.getValidMoves(fromRow, fromCol);
        const isValid = validMoves.some(m => m.row === toRow && m.col === toCol);
        if (!isValid) {
            console.warn("Invalid move attempted!");
            clearSelectedHighlights();
            return;
        }

        // Lock player input and clear highlights
        window.isWaitingForNetworkAck = true;
        clearSelectedHighlights();

        // Calculate next board version
        const nextVersion = activeEngine.moveHistory.length + 1;
        const preCapture = activeEngine.getPieceAt(toRow, toCol);
        const preEp = activeEngine.getPieceAt(fromRow, toCol);

        const outcome = activeEngine.move(fromRow, fromCol, toRow, toCol, promotionPiece);
        if (outcome.success) {
            if (outcome.isCapture) {
                outcome.capturedPiece = preCapture ? { type: preCapture.type, color: preCapture.color }
                    : (preEp ? { type: preEp.type, color: preEp.color } : null);
            }
            window.localBoardVersion = nextVersion;
            processEngineMoveSuccess(fromRow, fromCol, toRow, toCol, outcome);
           
            // Calculate state checksum of the new local state
            const futureChecksum = generateBoardChecksum();

            console.log(`[ONLINE MOVE EXECUTE] Executed locally. Sending move to Firestore. Version: ${nextVersion}, Checksum: ${futureChecksum}`);
           
            // Broadcast the move to Firestore
            networkSync.sendMoveAuthoritative(fromRow, fromCol, toRow, toCol, promotionPiece, nextVersion, futureChecksum);

            if (outcome.gameOverState !== 'active') {
                networkSync.claimVictory(outcome.gameOverState);
            }
        } else {
            window.isWaitingForNetworkAck = false;
            clearSelectedHighlights();
        }
    } else {
        const preCapture = activeEngine.getPieceAt(toRow, toCol);
        const preEp = activeEngine.getPieceAt(fromRow, toCol);
        const outcome = activeEngine.move(fromRow, fromCol, toRow, toCol, promotionPiece);
        if (outcome.success) {
            if (outcome.isCapture) {
                outcome.capturedPiece = preCapture ? { type: preCapture.type, color: preCapture.color }
                    : (preEp ? { type: preEp.type, color: preEp.color } : null);
            }
            processEngineMoveSuccess(fromRow, fromCol, toRow, toCol, outcome);
        } else {
            clearSelectedHighlights();
        }
    }
}

// Global hook to process opponent moves smoothly
window.executeOpponentMove = function(payload, expectedServerVersion) {
    console.log(`[MOVE PROCESSED] Executing opponent move from ${payload.from.row},${payload.from.col} to ${payload.to.row},${payload.to.col}`);
    if (activeEngine.turn === myPlayerColor) {
        console.warn("[MULTIPLAYER] Ignore opponent move attempt, it is currently our turn!");
        return;
    }
   
    const preCapture = activeEngine.getPieceAt(payload.to.row, payload.to.col);
    const preEp = activeEngine.getPieceAt(payload.from.row, payload.to.col);
    const outcome = activeEngine.move(payload.from.row, payload.from.col, payload.to.row, payload.to.col, payload.promotion || 'Q');
    if (outcome.success) {
        console.log(`[MOVE APPLIED] Opponent move successfully applied to local engine.`);
        if (outcome.isCapture) {
            outcome.capturedPiece = preCapture ? { type: preCapture.type, color: preCapture.color }
                : (preEp ? { type: preEp.type, color: preEp.color } : null);
        }
        window.localBoardVersion = expectedServerVersion;
        window.isWaitingForNetworkAck = false;
       
        // Execute smooth animation, play sounds, update moves log, vibrate, etc.
        processEngineMoveSuccess(payload.from.row, payload.from.col, payload.to.row, payload.to.col, outcome);
       
        console.log(`[TURN CHANGED] Local engine turn is now: ${activeEngine.turn}`);
        console.log(`[MULTIPLAYER] Opponent move successfully animated locally! New version: ${window.localBoardVersion}`);
    } else {
        console.error("[MULTIPLAYER] Opponent move failed validation in local engine! Invoking fallback hard resync...");
        // Re-request full sync
        if (typeof window.resynchronizeWithServer === 'function') {
            // We assume events are handled by the main listener, but we can trigger a hard reload here if needed.
        }
    }
};

function processEngineMoveSuccess(fromRow, fromCol, toRow, toCol, outcome) {
    highlightLastMoveSquares(fromRow, fromCol, toRow, toCol);
    updateCheckGlowOverlay();

    if (outcome.specialAction === 'castle_king' || outcome.specialAction === 'castle_queen') {
        playGameSound('castle');
    } else if (outcome.specialAction === 'promotion') {
        playGameSound('promotion');
    } else if (outcome.isCapture) {
        registerCapture(null, outcome.capturedPiece, fromRow, fromCol, toRow, toCol, outcome);
        playGameSound('capture');
    } else {
        playGameSound('move');
    }

    updateAlgebraicMovesLog(outcome.notation);
    clearSelectedHighlights();
    dismissCoachPanel();

    if (outcome.gameOverState === 'active') {
        const nextTurnColor = activeEngine.turn;
        if (activeEngine.isKingInCheck(nextTurnColor)) {
            showToast('CHECK!');
            playGameSound('check');
            if (navigator.vibrate) try { navigator.vibrate([100, 100]); } catch(e) {}
        }
    } else if (outcome.gameOverState === 'checkmate') {
        showToast('CHECKMATE!');
        if (navigator.vibrate) try { navigator.vibrate([200, 100, 200, 100, 400]); } catch(e) {}
    } else if (outcome.gameOverState === 'stalemate') {
        showToast('STALEMATE!');
        playGameSound('draw');
    }

    animatePiecesMovements(fromRow, fromCol, toRow, toCol, outcome);
    triggerTurnNotification();
}

function registerCapture(moverColor, capturedPiece, fromRow, fromCol, toRow, toCol, outcome) {
    let piece = capturedPiece;
    if (!piece && outcome.isCapture) {
        piece = outcome.capturedPiece;
    }
    if (!piece) return;
    const mover = outcome.player || moverColor;
    if (mover === 'w') capturedByWhite.push(piece);
    else capturedByBlack.push(piece);

    renderCapturedTrays();
    if (!localPlayMode && networkSync && networkSync.isMultiplayerActive) {
        networkSync.syncCapturedPieces(capturedByWhite, capturedByBlack);
    }
}

function renderCapturedTrays() {
    const playerTray = document.getElementById('player-captured-tray');
    const oppTray = document.getElementById('opponent-captured-tray');
    if (!playerTray || !oppTray) return;

    const myCaps = myPlayerColor === 'w' ? capturedByWhite : capturedByBlack;
    const oppCaps = myPlayerColor === 'w' ? capturedByBlack : capturedByWhite;
    if (localPlayMode) {
        playerTray.innerHTML = capturedByWhite.map(p => `<span class="captured-piece-icon">${PIECE_UNICODE[p.color][p.type]}</span>`).join('');
        oppTray.innerHTML = capturedByBlack.map(p => `<span class="captured-piece-icon">${PIECE_UNICODE[p.color][p.type]}</span>`).join('');
    } else {
        playerTray.innerHTML = myCaps.map(p => `<span class="captured-piece-icon">${PIECE_UNICODE[p.color][p.type]}</span>`).join('');
        oppTray.innerHTML = oppCaps.map(p => `<span class="captured-piece-icon">${PIECE_UNICODE[p.color][p.type]}</span>`).join('');
    }
}

function updateAlgebraicMovesLog(notation) {
    const list = document.getElementById('moves-list');
    if (list.querySelector('.empty-moves-placeholder')) {
        list.innerHTML = "";
    }
   
    const size = activeEngine.moveHistory.length;
    if (activeEngine.turn === 'b') {
        // White just moved -> Create a new column row
        const rowNum = Math.ceil(size / 2);
        const div = document.createElement('div');
        div.className = 'move-row';
        div.id = `move-row-${rowNum}`;
        div.innerHTML = `
            <span class="move-num">${rowNum}.</span>
            <span class="move-white">${notation}</span>
            <span class="move-black">-</span>
        `;
        list.appendChild(div);
    } else {
        // Black just moved -> Overwrite last row's second slot
        const rowNum = Math.ceil(size / 2);
        const row = document.getElementById(`move-row-${rowNum}`);
        if (row) {
            row.querySelector('.move-black').innerText = notation;
        }
    }
   
    // Auto-scroll moves box
    list.scrollTop = list.scrollHeight;
}


/* ------------------ ANIMATING SMOOTH 3D MOVEMENTS ------------------ */

function animatePiecesMovements(fromRow, fromCol, toRow, toCol, outcome) {
    // Find moving mesh
    const fromKey = `${fromRow}_${fromCol}`;
    const movingMesh = chessPiecesMap.get(fromKey);
   
    if (!movingMesh) {
        // If mesh alignment drifted, recreate entirely
        syncPiecesWithEngineState();
        return;
    }
   
    // Remove mesh on target square if capture
    const toKey = `${toRow}_${toCol}`;
    const capturedMesh = chessPiecesMap.get(toKey);
   
    if (capturedMesh) {
        // Shrink-fading capture animation
        animateCapturedPieceShrink(capturedMesh);
        chessPiecesMap.delete(toKey);
    }
   
    // If Special En Passant, captured pawn is at (fromRow, toCol)
    if (outcome.specialAction === 'en_passant') {
        const epKey = `${fromRow}_${toCol}`;
        const epMesh = chessPiecesMap.get(epKey);
        if (epMesh) {
            animateCapturedPieceShrink(epMesh);
            chessPiecesMap.delete(epKey);
        }
    }
   
    // Map keys to targets
    chessPiecesMap.delete(fromKey);
    chessPiecesMap.set(toKey, movingMesh);
   
    // Update userData
    movingMesh.userData.row = toRow;
    movingMesh.userData.col = toCol;
   
    // Interpolation Lerp Loop towards final target
    const targetX = toCol - 3.5;
    const targetZ = toRow - 3.5;
   
    const animationStart = Date.now();
    const duration = 280; // Fast smooth slide
    const startX = movingMesh.position.x;
    const startZ = movingMesh.position.z;
   
    function slide() {
        const elapsed = Date.now() - animationStart;
        const progress = Math.min(elapsed / duration, 1.0);
       
        // Sine ease-out progress curve
        const ease = Math.sin(progress * Math.PI / 2);
       
        movingMesh.position.x = startX + (targetX - startX) * ease;
        movingMesh.position.z = startZ + (targetZ - startZ) * ease;
       
        // Add tiny parabolic lift arc for realism
        movingMesh.position.y = Math.sin(progress * Math.PI) * 0.35;
       
        if (progress < 1.0) {
            requestAnimationFrame(slide);
        } else {
            // Seated flat
            movingMesh.position.y = 0;
           
            // Handle visual transformation of Pawn promotion asset
            if (outcome.specialAction === 'promotion') {
                syncPiecesWithEngineState();
            }
           
            // Check castling rook alignments manually
            if (outcome.specialAction === 'castle_king' || outcome.specialAction === 'castle_queen') {
                syncPiecesWithEngineState();
            }
           
            // Update HUD Turn structures
            updateHUDTimers();
           
            // AI / adaptive bot turn trigger after player move
            if (outcome.gameOverState === 'active' && typeof FtechSystem !== 'undefined' && activeEngine.turn !== myPlayerColor) {
                const isBot = FtechSystem.matchOpponentInfo && FtechSystem.matchOpponentInfo.isBot;
                const aiMode = FtechSystem.currentGameMode === 'computer' ||
                    ((FtechSystem.currentGameMode === 'play_online' || FtechSystem.currentGameMode === 'ranked') && isBot);
                if (aiMode) {
                    setTimeout(triggerComputerAIMove, 600);
                }
            }
           
            // Check terminal game status
            if (outcome.gameOverState !== 'active') {
                handleMatchTermination(outcome.gameOverState, outcome.winner);
            }
        }
    }
   
    slide();
}

function animateCapturedPieceShrink(mesh) {
    const animationStart = Date.now();
    const duration = 250;
   
    function shrink() {
        const elapsed = Date.now() - animationStart;
        const progress = Math.min(elapsed / duration, 1.0);
        const scale = 1.0 - progress;
       
        mesh.scale.set(scale * 0.85, scale * 0.85, scale * 0.85);
        mesh.position.y = progress * 0.5; // Float up slightly as it dies
       
        if (progress < 1.0) {
            requestAnimationFrame(shrink);
        } else {
            scene.remove(mesh);
        }
    }
    shrink();
}


/* ------------------ RENDER LOOP & CAMERA LOGICS ------------------ */

function highlightLastMoveSquares(fromRow, fromCol, toRow, toCol) {
    clearLastMoveHighlights();
    const mat = new THREE.MeshBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
    });
    const geom = new THREE.PlaneGeometry(0.92, 0.92);
    geom.rotateX(-Math.PI / 2);
    [[fromRow, fromCol], [toRow, toCol]].forEach(([r, c]) => {
        const mesh = new THREE.Mesh(geom, mat.clone());
        mesh.position.set(c - 3.5, 0.06, r - 3.5);
        scene.add(mesh);
        lastMoveHighlightMeshes.push(mesh);
    });
    setTimeout(clearLastMoveHighlights, 2500);
}

function clearLastMoveHighlights() {
    lastMoveHighlightMeshes.forEach(m => {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
    });
    lastMoveHighlightMeshes = [];
}

function updateCheckGlowOverlay() {
    if (checkGlowTimer) clearTimeout(checkGlowTimer);
    if (checkGlowMesh) {
        scene.remove(checkGlowMesh);
        if (checkGlowMesh.geometry) checkGlowMesh.geometry.dispose();
        if (checkGlowMesh.material) checkGlowMesh.material.dispose();
        checkGlowMesh = null;
    }
    const inCheckColor = activeEngine.turn;
    if (!activeEngine.isKingInCheck(inCheckColor)) return;
    let kingPos = null;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = activeEngine.getPieceAt(r, c);
            if (p && p.type === 'k' && p.color === inCheckColor) {
                kingPos = { r, c };
                break;
            }
        }
        if (kingPos) break;
    }
    if (!kingPos) return;
    const pulseMat = new THREE.MeshBasicMaterial({
        color: 0xff2222,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide
    });
    const geom = new THREE.PlaneGeometry(0.95, 0.95);
    geom.rotateX(-Math.PI / 2);
    checkGlowMesh = new THREE.Mesh(geom, pulseMat);
    checkGlowMesh.position.set(kingPos.c - 3.5, 0.07, kingPos.r - 3.5);
    scene.add(checkGlowMesh);
    let pulse = 0;
    function animateCheckPulse() {
        if (!checkGlowMesh) return;
        pulse += 0.12;
        checkGlowMesh.material.opacity = 0.35 + Math.abs(Math.sin(pulse)) * 0.35;
        checkGlowTimer = requestAnimationFrame(animateCheckPulse);
    }
    animateCheckPulse();
}

function getCameraProfile() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const landscape = w > h;
    if (w <= 480 && !landscape) {
        const factor = w < 360 ? 1.25 : (w < 400 ? 1.12 : 1.0);
        return { 
            fov: 52, 
            dist: 10.5 * factor, 
            height: 8.2 * factor, 
            minD: 7, 
            maxD: 15, 
            label: 'mobile-portrait' 
        };
    }
    if (landscape && h <= 500) return { fov: 48, dist: 11.5, height: 7.5, minD: 8, maxD: 15, label: 'mobile-landscape' };
    if (w <= 1024) return { fov: 46, dist: 10, height: 7.8, minD: 7, maxD: 16, label: 'tablet' };
    return { fov: 42, dist: 9.5, height: 7.2, minD: 6, maxD: 20, label: 'desktop' };
}

function applyAdaptiveCameraProfile() {
    if (!camera || !controls) return;
    const profile = getCameraProfile();
    camera.fov = profile.fov;
    controls.minDistance = profile.minD;
    controls.maxDistance = profile.maxD;
    // Lock orbit pivot exactly to center of the 8x8 board grid (world origin)
    controls.target.set(0, 0, 0);
    // Preserve which side of the board the camera is on when repositioning
    const zSign = camera.position.z >= 0 ? 1 : -1;
    camera.position.set(0, profile.height, profile.dist * zSign);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controls.update();
}

function resetCameraAngle() {
    const profile = getCameraProfile();
    camera.position.set(0, profile.height, profile.dist);
    if (controls) {
        controls.target.set(0, 0, 0);
        controls.minDistance = profile.minD;
        controls.maxDistance = profile.maxD;
        controls.update();
    }
    camera.updateProjectionMatrix();
}

function reverseBoardCameraAngle() {
    const profile = getCameraProfile();
    camera.position.set(0, profile.height, -profile.dist);
    if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
    }
    camera.updateProjectionMatrix();
}

function toggleSideView() {
    // Circularly pans camera 90 deg manually
    const radius = 10.5;
    const angle = Math.atan2(camera.position.z, camera.position.x) + Math.PI / 2;
   
    camera.position.x = Math.cos(angle) * radius;
    camera.position.z = Math.sin(angle) * radius;
    camera.position.y = 6.8;
}

function onWindowResize() {
    if (!camera || !renderer || !container) return;

    let w = container.clientWidth;
    let h = container.clientHeight;
    if (w <= 0 || h <= 0) {
        w = window.innerWidth;
        h = Math.max(window.innerHeight * 0.45, 200);
    }

    // Update camera aspect to match container - ensures board stays horizontally + vertically centered
    camera.aspect = w / h;
    applyAdaptiveCameraProfile();
    renderer.setPixelRatio(localStorage.getItem('performanceMode') === 'true' ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w, h);

    // Automatic Collision Detection for Ultra-Small Screens
    const hudTop = document.getElementById('hud-top');
    const hudBottom = document.getElementById('hud-bottom');
    const footerNav = document.querySelector('.bottom-nav, .lobby-footer-nav, .game-bottom-nav');
    if (hudTop && hudBottom && footerNav) {
        const totalHUDHeight = hudTop.offsetHeight + hudBottom.offsetHeight + footerNav.offsetHeight;
        if (window.innerWidth <= 320 || totalHUDHeight > window.innerHeight * 0.4) {
            document.body.classList.add('hud-compact-mode');
        } else {
            document.body.classList.remove('hud-compact-mode');
        }
    }
}

let lastRenderTime = 0;
const renderInterval = 1000 / 30; // 30 FPS target to ease software-rendering engines

function animate3DFrame(timestamp) {
    requestAnimationFrame(animate3DFrame);
   
    // Only perform WebGL rendering and updates when the game-screen is active/visible!
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen || !gameScreen.classList.contains('active-screen')) {
        return;
    }
   
    if (!timestamp) timestamp = performance.now();
    const elapsed = timestamp - lastRenderTime;
    if (elapsed < renderInterval) {
        return;
    }
    
    // Debug Monitor Updates
    if (localStorage.getItem('debugMode') === 'true' || localStorage.getItem('performanceMode') === 'true') {
        const debugBox = document.getElementById('debug-monitor');
        if (debugBox) {
            debugBox.style.display = 'block';
            const fpsCounter = document.getElementById('fps-counter');
            if (fpsCounter) fpsCounter.innerText = 'FPS: ' + Math.round(1000 / elapsed);
            if (performance.memory) {
                const memCounter = document.getElementById('mem-counter');
                const usedJSHeapSize = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
                if (memCounter) memCounter.innerText = 'MEM: ' + usedJSHeapSize + ' MB';
            }
        }
    } else {
        const debugBox = document.getElementById('debug-monitor');
        if (debugBox) debugBox.style.display = 'none';
    }

    lastRenderTime = timestamp - (elapsed % renderInterval);
   
    // Smooth Orbit damping calculations
    if (controls) controls.update();
   
    // Re-verify chess pieces selections floats (to create hover animations)
    if (selectedPieceCoord) {
        const key = `${selectedPieceCoord.row}_${selectedPieceCoord.col}`;
        const mesh = chessPiecesMap.get(key);
        if (mesh) {
            // Soft sine hover bobbing to denote selection focus
            mesh.position.y = 0.2 + Math.sin(Date.now() * 0.005) * 0.04;
        }
    }
   
    renderer.render(scene, camera);
}

/* ------------------ AI COACH (Classic Mode) ------------------ */
const COACH_COST = 200;

function updateCoachButtonVisibility() {
    const btn = document.getElementById('coach-ideas-btn');
    if (!btn) return;
    const ranked = window.moveAssistEnabled === false ||
        (typeof FtechSystem !== 'undefined' && FtechSystem.currentGameMode === 'ranked');
    if (ranked || !isGameActive) {
        btn.classList.add('hidden-info');
    } else {
        btn.classList.remove('hidden-info');
    }
}

function purchaseCoachAnalysis() {
    if (window.moveAssistEnabled === false) {
        showToast('Coach disabled in Ranked mode.');
        return;
    }
    if (typeof FtechSystem === 'undefined') return;
    if (activeEngine.turn !== myPlayerColor && !localPlayMode) {
        showToast('Wait for your turn.');
        return;
    }
    if (FtechSystem.account.coins < COACH_COST) {
        showToast('Need 200 coins for Coach analysis.');
        return;
    }
    FtechSystem.account.coins -= COACH_COST;
    if (typeof FtechSystem.saveData === 'function') FtechSystem.saveData();
    if (typeof syncLobbyHUD === 'function') syncLobbyHUD();
    runCoachAnalysis();
}

function runCoachAnalysis() {
    clearCoachHighlights();
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

    highlightCoachMove(from.row, from.col, to.row, to.col);
    const panel = document.getElementById('coach-result-panel');
    if (panel) {
        panel.classList.remove('hidden-panel');
        console.log('[BEST_MOVE_OPEN] Coach panel purchased and opened.');
        document.getElementById('coach-best-move').innerText = fromSq + ' → ' + toSq;
        document.getElementById('coach-reason').innerText = reason;
        document.getElementById('coach-advantage').innerText = 'Expected: ' + advantage;
    }
    showToast('Coach analysis ready — 200 coins spent.');
}

function highlightCoachMoveColor(fromR, fromC, toR, toC, colorVal = 0xdfb76c) {
    const mat = new THREE.MeshBasicMaterial({ color: colorVal, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const geom = new THREE.PlaneGeometry(0.9, 0.9);
    geom.rotateX(-Math.PI / 2);
    [[fromR, fromC], [toR, toC]].forEach(([r, c]) => {
        const m = new THREE.Mesh(geom, mat.clone());
        m.position.set(c - 3.5, 0.07, r - 3.5);
        scene.add(m);
        coachHighlightMeshes.push(m);
    });
}
function highlightCoachMove(fromR, fromC, toR, toC) {
    highlightCoachMoveColor(fromR, fromC, toR, toC, 0xdfb76c);
}
window.highlightCoachMoveColor = highlightCoachMoveColor;

function clearCoachHighlights() {
    coachHighlightMeshes.forEach(m => {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
    });
    coachHighlightMeshes = [];
}

function dismissCoachPanel(isExplicit = false) {
    const panel = document.getElementById('coach-result-panel');
    if (!panel || panel.classList.contains('hidden-panel')) return; // Prevent duplicate execution
    panel.classList.add('hidden-panel');
    clearCoachHighlights();
    if (isExplicit) {
        console.log('[BEST_MOVE_CLOSE] Coach panel closed explicitly by user.');
    } else {
        console.log('[BEST_MOVE_FORCE_CLEANUP] Coach panel automatically closed / cleaned up.');
    }
}

window.purchaseCoachAnalysis = purchaseCoachAnalysis;
window.dismissCoachPanel = dismissCoachPanel;
window.hideBestMovePopup = dismissCoachPanel;
window.resetBoard = function() {
    dismissCoachPanel();
    if (typeof activeEngine !== 'undefined' && activeEngine.reset) activeEngine.reset();
};
window.restartGame = function() {
    dismissCoachPanel();
    if (typeof startMatch === 'function') startMatch();
};
window.exitMatch = function() {
    dismissCoachPanel();
    if (typeof returnToLobby === 'function') returnToLobby();
};
window.initializeNewGame = function() {
    dismissCoachPanel();
    if (typeof activeEngine !== 'undefined' && activeEngine.reset) activeEngine.reset();
};

// Blunder Shield Safety Checker & Warnings Interceptor
function checkMoveSafety(fromRow, fromCol, toRow, toCol, promotionPiece) {
    if (!activeEngine) return true;
    const piece = activeEngine.getPieceAt(fromRow, fromCol);
    if (!piece) return true;

    // Simulate move on activeEngine
    const backupBoard = activeEngine.cloneBoard(activeEngine.board);
    const backupTurn = activeEngine.turn;
    const opponentColor = piece.color === 'w' ? 'b' : 'w';
    const preCapture = activeEngine.getPieceAt(toRow, toCol);

    const outcome = activeEngine.move(fromRow, fromCol, toRow, toCol, promotionPiece);
    let isSafe = true;

    if (outcome.success) {
        // 1. Check if king is in check
        if (activeEngine.isKingInCheck(piece.color)) {
            isSafe = false;
        }

        // 2. Check if moved piece is hanging (attacked by opponent and undefended/underdefended)
        const isAttacked = activeEngine.isSquareAttacked(toRow, toCol, opponentColor);
        if (isAttacked) {
            const isDefended = activeEngine.isSquareAttacked(toRow, toCol, piece.color);
            const movingVal = ChessAI.getPieceValue ? ChessAI.getPieceValue(piece.type) : 100;
            const capturedVal = preCapture ? (ChessAI.getPieceValue ? ChessAI.getPieceValue(preCapture.type) : 100) : 0;

            if (!isDefended && capturedVal < movingVal) {
                isSafe = false;
            }
        }

        // Rollback engine simulation
        activeEngine.board = backupBoard;
        activeEngine.turn = backupTurn;
        activeEngine.moveHistory.pop();
        activeEngine.gameState = 'active';
        activeEngine.winner = null;
    }

    return isSafe;
}

function showBlunderWarning(onConfirm) {
    playGameSound('check');

    const modal = document.createElement('div');
    modal.id = 'blunder-warning-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '350';

    modal.innerHTML = `
        <div class="modal-card" style="max-width:320px; padding:20px; text-align:center; border: 2px solid #ff3333; background: rgba(14, 5, 5, 0.98);">
            <h4 style="font-family:var(--font-display); font-size:12px; color:#ff3333; margin-bottom:12px; letter-spacing:1px;">⚠️ BLUNDER DETECTED</h4>
            <p style="font-size:10px; color:#fff; margin-bottom:20px; line-height:1.4;">This move is highly unsafe and may hang your piece or expose your king. Execute anyway?</p>
            
            <div style="display:flex; gap:10px; justify-content:center;">
                <button class="btn btn-primary" id="blunder-warn-confirm" style="padding:8px 16px; font-size:9.5px; background:#ff3333; border-color:#ff3333;">PLAY ANYWAY</button>
                <button class="btn btn-dark-outline" id="blunder-warn-cancel" style="padding:8px 16px; font-size:9.5px; color:#888;">CANCEL MOVE</button>
            </div>
        </div>
    `;

    document.getElementById('app').appendChild(modal);

    document.getElementById('blunder-warn-confirm').onclick = () => {
        modal.remove();
        onConfirm();
    };

    document.getElementById('blunder-warn-cancel').onclick = () => {
        modal.remove();
        clearSelectedHighlights();
    };
}

/* ------------------ UI VISIBILITY STATE MANAGEMENT ------------------ */
window.updateGameStateVisibility = function(state) {
    const topHud = document.getElementById('hud-top');
    const bottomHud = document.getElementById('hud-bottom');
    const roomCodeBox = document.getElementById('room-code-display-box');
    
    if (state === 'vs') {
        if (topHud) topHud.style.display = 'none';
        if (bottomHud) bottomHud.style.display = 'none';
        if (roomCodeBox) roomCodeBox.style.display = 'none';
    } else if (state === 'result') {
        if (topHud) topHud.style.display = 'none';
        if (bottomHud) bottomHud.style.display = 'none';
        if (roomCodeBox) roomCodeBox.style.display = 'none';
    } else if (state === 'play') {
        if (topHud) topHud.style.display = '';
        if (bottomHud) bottomHud.style.display = '';
        if (roomCodeBox) {
            const hasRoomCode = window.networkSync && window.networkSync.roomCode;
            roomCodeBox.style.display = hasRoomCode ? '' : 'none';
        }
    }
};

window.clearPrivateRoomState = function() {
    if (window.networkSync) window.networkSync.roomCode = '';
    window.currentRoomId = '';
    window.roomCode = '';
    const roomCodeBox = document.getElementById('room-code-display-box');
    if (roomCodeBox) roomCodeBox.style.display = 'none';
};

/* ------------------ MATCH INTRO CINEMATIC ------------------ */
window.playMatchIntro = function(onComplete) {
    const overlay = document.getElementById('match-intro-overlay');
    if (!overlay) {
        if (onComplete) onComplete();
        return;
    }

    const acc = typeof FtechSystem !== 'undefined' ? FtechSystem.account : {};
    const opp = FtechSystem && FtechSystem.matchOpponentInfo ? FtechSystem.matchOpponentInfo : {};
    const myAvatar = (FtechSystem && FtechSystem.catalog) ?
        (FtechSystem.catalog.avatars.find(a => a.id === acc.avatar) || { icon: '♟️' }).icon : '♔';
    const oppAvatar = opp.avatarIcon || (opp.isBot ? '🤖' : '♚');

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setText('intro-player-name', (acc.username || 'YOU').toUpperCase());
    setText('intro-opponent-name', (opp.username || document.getElementById('opponent-name')?.innerText || 'OPPONENT').toUpperCase());
    setText('intro-player-avatar', myAvatar);
    setText('intro-opponent-avatar', oppAvatar);

    if (typeof updateGameStateVisibility === 'function') updateGameStateVisibility('vs');
    overlay.classList.remove('hidden-modal');
    const flash = overlay.querySelector('.match-intro-flash');
    if (flash) {
        flash.classList.remove('flash-active');
        void flash.offsetWidth;
        flash.classList.add('flash-active');
    }
    AudioManager.playIntro();

    const boardZone = document.getElementById('canvas-container');
    if (boardZone) boardZone.style.opacity = '0';

    let startZoom = camera ? camera.position.clone() : null;
    if (camera) {
        camera.position.multiplyScalar(1.35);
        camera.updateProjectionMatrix();
    }

    setTimeout(() => {
        if (camera && startZoom) {
            camera.position.copy(startZoom);
            camera.updateProjectionMatrix();
        }
        if (boardZone) boardZone.style.opacity = '1';
        overlay.classList.add('hidden-modal');
        if (onComplete) onComplete();
    }, 2800);
};