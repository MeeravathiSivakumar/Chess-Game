/**
 * Classic 3D Chess - Multiplayer Networking Module (Firebase Edition).
 * Leverages Cloud Firestore to orchestrate serverless, premium real-time lobbies,
 * presence synchronization, chess move queues, checkmates, and live timers-sync.
 */

window.firebaseConfig = window.firebaseConfig || {
    apiKey: "AIzaSyCeAsOzVgxSMuDuTZEXJbihhKW0l-h_wTg",
    authDomain: "d-chess-93c79.firebaseapp.com",
    projectId: "d-chess-93c79",
    storageBucket: "d-chess-93c79.firebasestorage.app",
    appId: "1:626616850612:android:a9ccabb5bf86092b9c1fe1"
};

class ChessMultiplayer {
    constructor(onMessageCallback, onStatusChangeCallback) {
        this.onMessage = onMessageCallback;
        this.onStatusChange = onStatusChangeCallback;
        this.db = null;
        this.roomCode = null;
        this.playerId = 'player_' + Math.random().toString(36).substring(2, 9);
        this.myColor = 'w'; // 'w' (room creator) or 'b' (room joiner)
        this.isConnected = false;
        this.isMultiplayerActive = false;
        this.processedEventCount = 0;
        this.processedEventIds = new Set();
        this.unsubscribe = null;
        this.creatorId = null;

        // Auto-Reconnect Watchdog
        window.addEventListener('online', () => {
            if (this.isMultiplayerActive && this.roomCode) {
                console.log("Multiplayer: Network online detected. Forcing listener reconnect...");
                this.forceListenerReconnect();
            }
        });

        this.initFirebase();
    }

    initFirebase() {
        console.log("Multiplayer: Initializing Cloud Firestore interface...");
        this.updateStatus('CONNECTING...', 'error');

        // Check availability of the Firebase JS library from HTML CDN imports
        if (typeof firebase === 'undefined') {
            console.warn("Multiplayer: Firebase SDK not loaded yet. Retrying in 2s...");
            setTimeout(() => this.initFirebase(), 2000);
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
            }
            this.db = firebase.firestore();
            
            // Force HTTP long polling instead of WebSockets to bypass Android WebView file:// socket blocks
            try {
                this.db.settings({
                    experimentalForceLongPolling: true
                });
                console.log("Multiplayer: Firestore configured with experimentalForceLongPolling = true");
            } catch (settingsError) {
                console.warn("Multiplayer: Firestore settings already active/locked, ignoring modification:", settingsError);
            }

            this.isConnected = true;
            this.updateStatus('FIRESTORE ACTIVE', 'connected');
            console.log("Multiplayer: Firebase app and Firestore successfully initialized.");
            
            // Sync pending room in the background once connected
            if (this.roomCode && this.myColor === 'w') {
                this.writeRoomToFirestore();
            } else if (this.roomCode && this.myColor === 'b') {
                this.listenToRoom();
            }
        } catch (e) {
            console.error("Multiplayer: Failed to boot Firebase core.", e);
            this.updateStatus('OFFLINE/DISCONNECTED', 'error');
            setTimeout(() => this.initFirebase(), 6000);
        }
    }

    updateStatus(message, styleClass) {
        if (this.onStatusChange) {
            this.onStatusChange(message, styleClass);
        }
    }

    // Generate isolated, human-readable 6-character room codes
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid indistinguishable characters like 1/I/O/0
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Host room action
    createRoom() {
        this.roomCode = this.generateRoomCode();
        this.myColor = 'w';
        this.isMultiplayerActive = true;
        this.processedEventCount = 0;
        this.processedEventIds = new Set();

        console.log(`Multiplayer: Structuring room [${this.roomCode}] as White.`);
        
        if (this.isConnected && this.db) {
            this.writeRoomToFirestore();
        } else {
            console.warn("Multiplayer: Firebase/Firestore not connected yet. Will sync Room when available.");
            if (typeof showToast === 'function') {
                showToast("CREATING OFFLINE PROTOCOL WORKSPACE...");
            }
        }

        return this.roomCode;
    }

    writeRoomToFirestore() {
        if (!this.db || !this.roomCode) return;
        
        try {
            const hostInfo = (typeof FtechSystem !== 'undefined' && FtechSystem.account) ? {
                uid: FtechSystem.account.uid || this.playerId,
                name: FtechSystem.account.username || 'Host',
                avatar: FtechSystem.account.avatar || '1',
                rank: FtechSystem.account.rp || 0
            } : {
                uid: this.playerId,
                name: 'Host',
                avatar: '1',
                rank: 0
            };

            const initialDoc = {
                creatorId: this.playerId,
                joinedPlayerId: null,
                players: {
                    white: hostInfo,
                    black: null
                },
                events: [],
                gameState: 'waiting',
                timers: {
                    whiteTime: 600,
                    blackTime: 600,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                },
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };

            this.db.collection('rooms').doc(this.roomCode).set(initialDoc)
                .then(() => {
                    console.log(`Multiplayer: Room ${this.roomCode} created/synced in Firestore.`);
                    this.listenToRoom();
                })
                .catch(err => {
                    console.error("Multiplayer: Room set failure", err);
                    if (typeof showToast === 'function') {
                        showToast(`CLOUD ERROR: ${err.message || 'Permission Denied'}`);
                    }
                    const msg = (err.message || "").toLowerCase();
                    const code = (err.code || "").toLowerCase();
                    if (msg.includes('permission') || msg.includes('denied') || msg.includes('insufficient') || code.includes('permission')) {
                        if (typeof showPermissionsOverlay === 'function') {
                            showPermissionsOverlay();
                        }
                    }
                });
        } catch (e) {
            console.error("Multiplayer: Exception writing room to Firestore:", e);
        }
    }

    // Guest room action
    joinRoom(code) {
        if (!this.isConnected || !this.db) {
            showToast("DATA PORT BUSY. RETRYING...");
            return false;
        }

        const cleanCode = code.trim().toUpperCase();
        if (cleanCode.length !== 6) {
            showToast("INVALID ROOM CODE.");
            return false;
        }

        console.log(`Multiplayer: Querying lobby code [${cleanCode}] as Black.`);
        
        this.db.collection('rooms').doc(cleanCode).get().then(doc => {
            if (!doc.exists) {
                showToast("ROOM CODE NOT FOUND IN FIRESTORE.");
                if (typeof returnToLobby === 'function') returnToLobby();
                return;
            }

            const data = doc.data();
            if (data.joinedPlayerId && data.joinedPlayerId !== this.playerId) {
                showToast("ROOM ALREADY PACKED.");
                if (typeof returnToLobby === 'function') returnToLobby();
                return;
            }

            this.roomCode = cleanCode;
            this.myColor = 'b';
            this.isMultiplayerActive = true;
            this.processedEventCount = 0;
            this.processedEventIds = new Set();

            const guestInfo = (typeof FtechSystem !== 'undefined' && FtechSystem.account) ? {
                uid: FtechSystem.account.uid || this.playerId,
                name: FtechSystem.account.username || 'Guest',
                avatar: FtechSystem.account.avatar || '1',
                rank: FtechSystem.account.rp || 0
            } : {
                uid: this.playerId,
                name: 'Guest',
                avatar: '1',
                rank: 0
            };

            const joinEvent = {
                id: this.playerId + '_' + Date.now() + '_join',
                action: 'player_joined',
                payload: { joinedPlayerId: this.playerId, profile: guestInfo },
                sender: this.playerId,
                timestamp: Date.now()
            };

            return this.db.collection('rooms').doc(this.roomCode).update({
                joinedPlayerId: this.playerId,
                'players.black': guestInfo,
                events: firebase.firestore.FieldValue.arrayUnion(joinEvent),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }).then(() => {
            console.log(`Multiplayer: Join acknowledged in ${this.roomCode}`);
            this.listenToRoom();
        }).catch(err => {
            console.error("Multiplayer: Room link error", err);
            showToast("JOIN FAILED: " + err.message);
            const msg = (err.message || "").toLowerCase();
            const code = (err.code || "").toLowerCase();
            if (msg.includes('permission') || msg.includes('denied') || msg.includes('insufficient') || code.includes('permission')) {
                if (typeof showPermissionsOverlay === 'function') {
                    showPermissionsOverlay();
                }
            }
            if (typeof returnToLobby === 'function') returnToLobby();
        });

        // Return true to allow UI screen transition, handling fallback within asynchronously
        return true;
    }

    // Real-time server-push listener
    listenToRoom() {
        if (this.unsubscribe) {
            console.log(`[FIRESTORE_LISTENER_CLOSED] Room listener explicitly cleaned up for ${this.roomCode}`);
            this.unsubscribe();
            this.unsubscribe = null;
        }

        if (!this.processedEventIds) {
            this.processedEventIds = new Set();
        }

        console.log(`[FIRESTORE_LISTENER_START] Room listener initialized for ${this.roomCode}`);
        let lastFromCache = false;
        let isFirstFetch = true;

        this.unsubscribe = this.db.collection('rooms').doc(this.roomCode).onSnapshot({ includeMetadataChanges: true }, doc => {
            const currentFromCache = doc.metadata.fromCache;
            if (isFirstFetch) {
                isFirstFetch = false;
            } else if (lastFromCache && !currentFromCache) {
                console.log(`[FIRESTORE_LISTENER_RECONNECTED] Firestore connection re-established for room ${this.roomCode}`);
            }
            lastFromCache = currentFromCache;

            if (!doc.exists) {
                console.warn(`Multiplayer: Room ${this.roomCode} got deleted on host side.`);
                return;
            }

            const data = doc.data();
            this.creatorId = data.creatorId;
            this.joinedPlayerId = data.joinedPlayerId;
            const events = data.events || [];

            // Process isolated timers for non-host
            if (this.myColor === 'b' && data.timers) {
                this.onMessage('timer_sync', {
                    whiteTime: data.timers.whiteTime,
                    blackTime: data.timers.blackTime
                }, 'host');
            }

            // Detect offline mode in Firestore
            if (typeof window.updateNetworkWarningUI === 'function') {
                window.updateNetworkWarningUI(!navigator.onLine);
            }

            // Extract and sort server-validated Moves to handle version checks
            const serverMoves = events
                .filter(e => e.action === 'move')
                .sort((a, b) => (a.payload.boardVersion || 0) - (b.payload.boardVersion || 0));
            const expectedServerVersion = serverMoves.length; // Each move increments version by exactly 1
            const currentLocalVersion = window.localBoardVersion || 0;

            if (expectedServerVersion > currentLocalVersion) {
                // There are new move(s) on the server!
                const diff = expectedServerVersion - currentLocalVersion;
                if (diff === 1) {
                    const lastMoveEvent = serverMoves[serverMoves.length - 1];
                    if (lastMoveEvent.sender !== this.playerId) {
                        console.log(`[MOVE RECEIVED] Opponent move received: Version ${expectedServerVersion}`);
                        if (typeof window.executeOpponentMove === 'function') {
                            window.executeOpponentMove(lastMoveEvent.payload, expectedServerVersion);
                        } else {
                            if (typeof window.resynchronizeWithServer === 'function') {
                                window.resynchronizeWithServer(events, expectedServerVersion);
                            }
                        }
                    } else {
                        console.log(`[MULTIPLAYER] Confirming our own move: Version ${expectedServerVersion}`);
                        window.localBoardVersion = expectedServerVersion;
                        window.isWaitingForNetworkAck = false;
                    }
                } else {
                    console.log(`[MULTIPLAYER RECOVER] State discrepancy! Server moves: ${expectedServerVersion}, Local moves: ${currentLocalVersion}. Invoking hard resync...`);
                    if (typeof window.resynchronizeWithServer === 'function') {
                        window.resynchronizeWithServer(events, expectedServerVersion);
                    }
                }
            } else if (expectedServerVersion < currentLocalVersion) {
                console.log(`[MULTIPLAYER RECOVER] Local version is ahead! Server: ${expectedServerVersion}, Local: ${currentLocalVersion}. Invoking hard resync...`);
                if (typeof window.resynchronizeWithServer === 'function') {
                    window.resynchronizeWithServer(events, expectedServerVersion);
                }
            } else {
                // Perfectly synced
                window.isWaitingForNetworkAck = false;
            }

            // Parse non-move sync packets (like game_over, resign, user disconnects) sequentially
            for (const ev of events) {
                if (ev.action !== 'move') {
                    const evId = ev.id || (ev.sender + '_' + ev.timestamp + '_' + ev.action);
                    if (!this.processedEventIds.has(evId)) {
                        this.processedEventIds.add(evId);
                        if (ev.sender !== this.playerId) {
                            console.log(`Multiplayer Recv non-move event: [${ev.action}]`, ev.payload);
                            this.onMessage(ev.action, ev.payload, ev.sender);
                        }
                    }
                }
            }

            this.processedEventCount = events.length;
        }, err => {
            console.error("Multiplayer: Snapshot update listener intercepted error", err);
            if (typeof window.updateNetworkWarningUI === 'function') {
                window.updateNetworkWarningUI(true);
            }
        });
    }

    forceListenerReconnect() {
        console.log("Multiplayer Watchdog: Reviving Firestore room listeners...");
        this.listenToRoom();
    }

    // Direct Firestore action queue dispatcher
    broadcast(action, payload) {
        if (!this.isConnected || !this.db || !this.roomCode) {
            console.warn("Multiplayer: Client not ready. Broadcast skipped:", action);
            return;
        }

        const packet = {
            id: this.playerId + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + action,
            action: action,
            payload: payload,
            sender: this.playerId,
            timestamp: Date.now()
        };

        this.db.collection('rooms').doc(this.roomCode).update({
            events: firebase.firestore.FieldValue.arrayUnion(packet),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => {
            console.error("Multiplayer: Update push failed", err);
        });
    }

    sendMoveAuthoritative(fromRow, fromCol, toRow, toCol, promotionPiece = 'Q', expectedVersion, checksum) {
        if (!this.isMultiplayerActive) return;

        console.log(`[MOVE SENT] Sending authoritative move to server. expectedVersion: ${expectedVersion}`);

        const packet = {
            id: this.playerId + '_' + Date.now() + '_move_' + expectedVersion,
            action: 'move',
            payload: {
                from: { row: fromRow, col: fromCol },
                to: { row: toRow, col: toCol },
                promotion: promotionPiece,
                boardVersion: expectedVersion,
                checksum: checksum,
                matchId: this.roomCode
            },
            sender: this.playerId,
            timestamp: Date.now()
        };

        // Atomically update active turn and board version on Firebase host document
        this.db.collection('rooms').doc(this.roomCode).update({
            boardVersion: expectedVersion,
            turn: this.myColor === 'w' ? 'b' : 'w',
            events: firebase.firestore.FieldValue.arrayUnion(packet),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log(`[MOVE WRITTEN] Move successfully written to Firestore. expectedVersion: ${expectedVersion}`);
        }).catch(err => {
            console.error("Multiplayer: Authoritative move push failed", err);
            if (typeof showToast === 'function') {
                showToast("SYNC ERROR - PLEASE RETRY");
            }
            window.isWaitingForNetworkAck = false;
        });
    }

    sendMove(fromRow, fromCol, toRow, toCol, promotionPiece = 'Q') {
        // Fallback for standard moves; normally sendMoveAuthoritative is utilized
        if (!this.isMultiplayerActive) return;
        
        this.broadcast('move', {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            promotion: promotionPiece
        });
    }

    syncTimers(whiteTimeRemaining, blackTimeRemaining) {
        if (!this.isMultiplayerActive || this.myColor !== 'w') return; // White acts as authoritative host time provider
        
        // Push simple broadcast event via timers object rather than polluting events array
        this.db.collection('rooms').doc(this.roomCode).update({
            timers: {
                whiteTime: whiteTimeRemaining,
                blackTime: blackTimeRemaining,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }
        }).catch(err => {
            console.warn("Multiplayer: Timer sync update dropped", err);
        });
    }

    claimVictory(reason) {
        if (!this.isMultiplayerActive) return;
        
        this.broadcast('game_over', {
            winnerColor: this.myColor,
            reason: reason
        });
    }

    broadcastResignation() {
        if (!this.isMultiplayerActive) return;
        
        this.broadcast('resign', {
            resignedColor: this.myColor
        });
    }

    disconnectRoom() {
        if (this.roomCode) {
            this.broadcast('player_left', {
                color: this.myColor
            });
            if (this.unsubscribe) {
                console.log(`[FIRESTORE_LISTENER_CLOSED] Room listener explicitly closed for ${this.roomCode}`);
                this.unsubscribe();
                this.unsubscribe = null;
            }
        }
        this.roomCode = null;
        this.isMultiplayerActive = false;
        this.myColor = 'w';
    }
}

// ─── Global scope binding ────────────────────────────────────────────────────
// Expose ChessMultiplayer on window so chess_3d.js and ftech_v3_ui.js can
// safely reference it regardless of script module isolation.
window.ChessMultiplayer = ChessMultiplayer;

/**
 * Singleton factory — returns the shared instance, creating it once.
 * chess_3d.js always calls this first; the class constructor is a fallback.
 */
function getChessMultiplayer(onMessage, onStatus) {
    if (!window._chessMultiplayerInstance) {
        window._chessMultiplayerInstance = new window.ChessMultiplayer(onMessage, onStatus);
    }
    return window._chessMultiplayerInstance;
}

window.getChessMultiplayer = getChessMultiplayer;

