/**
 * FUTECX CHESS V2 - ENTERPRISE SOCIAL & ANALYTICS ENGINE
 * Handles Presence, Multi-Device, Chat Security, Smart Notifications, 
 * Party Lobbies, Reconnect States, and Cloud Event Synchronization.
 */

const FtechSocial = {
    sessionId: 'sess_' + Math.random().toString(36).substring(2, 10),
    presenceInterval: null,
    listeners: {},
    cache: {
        globalDirectory: [],
        friends: [],
        requests: [],
        blocked: [],
        inbox: [],
        activities: [],
        party: null
    },

    // 1. Core Boot Sequence
    init() {
        console.log("FtechSocial: Enterprise Engine Booting...");
        this.setupWindowListeners();
        if (FtechSystem && FtechSystem.account && FtechSystem.account.uid) {
            this.bootRealtimeServices(FtechSystem.account.uid);
        }
    },

    setupWindowListeners() {
        // Multi-device protection & Presence state
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.updatePresence('Online');
            } else {
                this.updatePresence('Away');
            }
        });
        
        window.addEventListener('beforeunload', () => {
            this.updatePresence('Offline', true); // sync immediately
        });
    },

    // 2. Realtime Boot & Cleanup
    bootRealtimeServices(uid) {
        if (!uid || uid.startsWith('guest_')) return;
        
        this.stopAllServices(); // Prevent duplicate listeners
        
        console.log("FtechSocial: Syncing Cloud Services for " + uid);
        const db = firebase.firestore();

        // 2a. Multi-Device Tracking
        this.listeners['session'] = db.collection('users').doc(uid).onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                if (data.sessionId && data.sessionId !== this.sessionId) {
                    this.handleSessionCollision();
                }
            }
        });

        // 2b. Presence Heartbeat
        this.updatePresence('Online');
        this.presenceInterval = setInterval(() => {
            this.updatePresence('Online');
        }, 60000); // 1-minute heartbeat

        // 2c. Sub-Collections
        this.attachSubListeners(db, uid);
    },

    attachSubListeners(db, uid) {
        // Smart Notifications
        this.listeners['notifications'] = db.collection('users').doc(uid).collection('notifications')
            .orderBy('timestamp', 'desc').limit(20)
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        this.processIncomingNotification(change.doc.data(), change.doc.id);
                    }
                });
            });

        // Friends List
        this.listeners['friends'] = db.collection('users').doc(uid).collection('friends')
            .onSnapshot(snap => {
                this.cache.friends = snap.docs.map(d => ({id: d.id, ...d.data()}));
                if (typeof renderSocialHub === 'function') renderSocialHub();
            });

        // Party Lobby State
        this.listeners['party'] = db.collection('users').doc(uid).collection('party').doc('active')
            .onSnapshot(snap => {
                if (snap.exists) {
                    this.cache.party = snap.data();
                    if (typeof renderPartyLobby === 'function') renderPartyLobby();
                }
            });
    },

    stopAllServices() {
        Object.keys(this.listeners).forEach(key => {
            if (typeof this.listeners[key] === 'function') {
                this.listeners[key](); // unsubscribe
            }
        });
        this.listeners = {};
        if (this.presenceInterval) clearInterval(this.presenceInterval);
    },

    // 3. Multi-Device Collision
    handleSessionCollision() {
        console.warn("FtechSocial: Multiple active sessions detected!");
        this.stopAllServices(); // Immediately disconnect this client's writes
        
        // Render hard takeover modal
        const modal = document.createElement('div');
        modal.id = 'session-collision-modal';
        modal.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:999999; display:flex; align-items:center; justify-content:center;";
        modal.innerHTML = `
            <div style="background:#1a1010; border:2px solid #ff3333; padding:32px; border-radius:12px; text-align:center; max-width:400px; color:#fff;">
                <h2 style="color:#ff3333; margin-bottom:16px;">SESSION TERMINATED</h2>
                <p style="font-size:14px; margin-bottom:24px;">Your account was logged into from another device.</p>
                <button onclick="window.location.reload()" style="background:#ff3333; color:#fff; border:none; padding:12px 24px; border-radius:6px; font-weight:bold; cursor:pointer;">RECONNECT THIS DEVICE</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // 4. Presence Syncing
    updatePresence(status, syncNow = false) {
        if (!FtechSystem || !FtechSystem.account || !FtechSystem.account.uid || FtechSystem.account.uid.startsWith('guest_')) return;
        if (typeof firebase === 'undefined') return;

        const presencePayload = {
            sessionId: this.sessionId,
            presenceStatus: status,
            presenceLastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            presenceContext: FtechSystem.currentGameMode === 'practice' ? 'In Lobby' : `Playing ${FtechSystem.currentGameMode}`,
            presencePlatform: this.detectPlatform()
        };

        const db = firebase.firestore();
        const ref = db.collection('users').doc(FtechSystem.account.uid);
        
        if (syncNow) {
            // navigator.sendBeacon is better for unload, but we'll try firestore set
            ref.set(presencePayload, { merge: true }).catch(console.error);
        } else {
            ref.set(presencePayload, { merge: true }).catch(console.error);
        }
    },

    detectPlatform() {
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) return 'Android';
        if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
        return 'Desktop';
    },

    // 4.5. Search System
    searchPlayer() {
        const input = document.getElementById('add-friend-v3-input');
        if (!input || !input.value) return;
        const query = input.value.trim();
        const container = document.getElementById('search-results-container');
        if (!container) return;
        
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:11px; padding:20px;">Searching...</div>`;
        
        // Search Firestore users collection
        if (typeof firebase === 'undefined') return;
        const db = firebase.firestore();
        
        // Simple search (Player ID or exact username)
        db.collection('users').where('playerId', '==', query).limit(5).get().then(snap => {
            if (!snap.empty) {
                this.renderSearchResults(snap.docs, container);
                return;
            }
            // Fallback to username
            return db.collection('users').where('username_lowercase', '==', query.toLowerCase()).limit(10).get();
        }).then(snap2 => {
            if (snap2 && !snap2.empty) {
                this.renderSearchResults(snap2.docs, container);
            } else if (snap2 && snap2.empty) {
                container.innerHTML = `<div style="text-align:center; color:#ff4444; font-size:11px; padding:20px;">Player Not Found</div>`;
            }
        }).catch(err => {
            console.error(err);
            container.innerHTML = `<div style="text-align:center; color:#ff4444; font-size:11px; padding:20px;">Error searching directory.</div>`;
        });
    },

    renderSearchResults(docs, container) {
        container.innerHTML = '';
        docs.forEach(doc => {
            const data = doc.data();
            const card = document.createElement('div');
            card.style = "display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);";
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:36px; height:36px; border-radius:50%; background:#2a2a35; border:1px solid var(--gold);"></div>
                    <div>
                        <div style="font-weight:bold; font-size:13px; color:#fff;">${data.username} <span style="font-size:10px; color:var(--gold);">${data.level ? 'Lv.' + data.level : ''}</span></div>
                        <div style="font-size:10px; color:var(--text-muted);">${data.playerId} | ${data.presence ? data.presence.presenceStatus : 'Offline'}</div>
                    </div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-primary" onclick="FtechSocial.sendFriendRequest('${doc.id}')" style="padding:6px 12px; font-size:9px; height:26px;">ADD</button>
                </div>
            `;
            container.appendChild(card);
        });
    },
    
    sendFriendRequest(targetUid) {
        if (!FtechSystem.account.uid) return;
        const db = firebase.firestore();
        db.collection('users').doc(targetUid).collection('notifications').add({
            type: 'friend',
            title: 'Friend Request',
            message: `${FtechSystem.account.username} sent you a request!`,
            fromUid: FtechSystem.account.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: Date.now() + (120 * 1000)
        }).then(() => {
            showToast("FRIEND REQUEST SENT!");
        });
    },

    // 5. Smart Notifications Scheduler
    processIncomingNotification(data, id) {
        // Prevent duplicate rendering
        if (this.cache.inbox.includes(id)) return;
        this.cache.inbox.push(id);

        // 120s Expiry enforcement
        if (data.type === 'invite' && data.expiresAt) {
            const now = Date.now();
            if (now > data.expiresAt) {
                console.log("FtechSocial: Ignored expired invite.");
                return;
            }
        }

        // Render UI Toast
        this.renderToast(data);
    },

    renderToast(data) {
        const toast = document.createElement('div');
        toast.style = "position:fixed; bottom:20px; right:20px; background:linear-gradient(135deg, #1d1912, #0c0c10); border:1px solid var(--gold); padding:16px; border-radius:8px; color:#fff; z-index:10000; display:flex; gap:12px; align-items:center; animation: slideInRight 0.3s ease; box-shadow:0 10px 30px rgba(0,0,0,0.8);";
        
        let icon = '🔔';
        if (data.type === 'invite') icon = '⚔️';
        if (data.type === 'gift') icon = '🎁';
        if (data.type === 'friend') icon = '👥';

        toast.innerHTML = `
            <span style="font-size:24px;">${icon}</span>
            <div>
                <h4 style="margin:0; font-size:13px; color:var(--gold);">${data.title}</h4>
                <p style="margin:4px 0 0 0; font-size:11px; color:var(--text-light);">${data.message}</p>
            </div>
            <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:#888; font-size:16px; cursor:pointer; align-self:flex-start;">✖</button>
        `;

        document.body.appendChild(toast);
        
        // Auto-dismiss after 6s
        setTimeout(() => {
            if (toast && toast.parentElement) toast.remove();
        }, 6000);
    }
};

// Auto-boot if FtechSystem loads
setTimeout(() => {
    if (typeof FtechSocial !== 'undefined') {
        // Tie into FtechSystem.saveData or Auth observer
    }
}, 2000);



    // 6. Private Chat Engine
    activeChatUid: null,
    lastMessageTime: 0,
    
    openChat(uid, username, status) {
        this.activeChatUid = uid;
        document.getElementById('chat-header-name').innerText = username;
        document.getElementById('chat-header-status').innerText = status;
        document.getElementById('private-chat-modal').style.display = 'flex';
        document.getElementById('chat-messages-container').innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:11px; padding:20px;">Loading chat history...</div>`;
        
        // Unsubscribe from previous chat listener
        if (this.listeners['chat']) this.listeners['chat']();
        
        const db = firebase.firestore();
        const chatId = FtechSystem.account.uid < uid ? `${FtechSystem.account.uid}_${uid}` : `${uid}_${FtechSystem.account.uid}`;
        
        this.listeners['chat'] = db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc').limit(50)
            .onSnapshot(snap => {
                const container = document.getElementById('chat-messages-container');
                if (snap.empty) {
                    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:11px; padding:20px;">No messages yet. Say hi!</div>`;
                    return;
                }
                container.innerHTML = '';
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    const isMe = data.senderId === FtechSystem.account.uid;
                    const bubble = document.createElement('div');
                    bubble.style = `max-width:80%; padding:10px 14px; border-radius:12px; font-size:12px; line-height:1.4; word-break:break-word; ${isMe ? 'background:var(--gold); color:#000; align-self:flex-end; border-bottom-right-radius:2px;' : 'background:rgba(255,255,255,0.1); color:#fff; align-self:flex-start; border-bottom-left-radius:2px;'}`;
                    
                    let text = data.text;
                    // Strict XSS Prevention
                    text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    
                    bubble.innerHTML = text;
                    container.appendChild(bubble);
                });
                container.scrollTop = container.scrollHeight;
            });
    },

    sendChatMessage() {
        const input = document.getElementById('chat-input-box');
        if (!input || !input.value || !this.activeChatUid) return;
        
        const text = input.value.trim();
        if (text.length === 0) return;
        if (text.length > 500) {
            showToast("MESSAGE TOO LONG!");
            return;
        }
        
        // 1.5s Flood Cooldown
        const now = Date.now();
        if (now - this.lastMessageTime < 1500) {
            showToast("PLEASE WAIT BEFORE SENDING!");
            return;
        }
        this.lastMessageTime = now;
        input.value = '';
        
        // Profanity Check (Basic stub)
        const profanityList = ['fuck', 'shit', 'bitch']; // Expanded later
        const isClean = !profanityList.some(word => text.toLowerCase().includes(word));
        if (!isClean) {
            showToast("MESSAGE BLOCKED BY FILTER.");
            return;
        }
        
        const db = firebase.firestore();
        const chatId = FtechSystem.account.uid < this.activeChatUid ? `${FtechSystem.account.uid}_${this.activeChatUid}` : `${this.activeChatUid}_${FtechSystem.account.uid}`;
        
        db.collection('chats').doc(chatId).collection('messages').add({
            senderId: FtechSystem.account.uid,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => {
            console.error("Chat send error:", err);
            showToast("FAILED TO SEND MESSAGE.");
        });
    }



    // 7. Cloud Messaging & Push Notifications
    messaging: null,
    
    initCloudMessaging() {
        if (typeof firebase === 'undefined' || !firebase.messaging) {
            console.warn("FtechSocial: Firebase Messaging SDK not loaded.");
            return;
        }
        
        try {
            this.messaging = firebase.messaging();
            
            // Request Notification Permission
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log("FtechSocial: Notification permission granted.");
                    this.fetchFCMToken();
                } else {
                    console.log("FtechSocial: Notification permission denied.");
                }
            });
            
            // Handle foreground messages
            this.messaging.onMessage((payload) => {
                console.log("FtechSocial: Received FCM Message: ", payload);
                this.renderToast({
                    type: payload.data.type || 'system',
                    title: payload.notification.title,
                    message: payload.notification.body
                });
            });
        } catch (err) {
            console.error("FtechSocial: FCM Init Error - ", err);
        }
    },
    
    fetchFCMToken() {
        if (!this.messaging || !FtechSystem.account.uid) return;
        
        this.messaging.getToken({ vapidKey: 'YOUR_PUBLIC_VAPID_KEY_HERE' }).then((currentToken) => {
            if (currentToken) {
                // Save token to Firestore for backend Push Notifications
                firebase.firestore().collection('users').doc(FtechSystem.account.uid).set({
                    fcmToken: currentToken
                }, { merge: true });
            }
        }).catch((err) => {
            console.error("FtechSocial: FCM Token Error - ", err);
        });
    }



    // 8. Reputation & Audit Engine
    calculateFairPlayScore() {
        if (!FtechSystem.account) return 100;
        const totalMatches = Math.max(1, FtechSystem.account.matches || 1);
        const quits = FtechSystem.account.quitCount || 0;
        const reports = FtechSystem.account.reports || 0;
        
        // Base 100, -10 per quit, -20 per report.
        let score = 100 - ((quits / totalMatches) * 50) - (reports * 20);
        return Math.max(0, Math.min(100, score));
    },
    
    logMatchIncident(type, details) {
        if (!FtechSystem.account.uid) return;
        const db = firebase.firestore();
        db.collection('match_incidents').add({
            uid: FtechSystem.account.uid,
            type: type, // "Disconnect", "Timeout", "Report"
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error("FtechSocial: Incident Log Error -", err));
    }



    // 9. Reconnect & Admin Engine
    healthInterval: null,
    
    initHealthMonitor() {
        // Only run if admin or debug mode
        const monitor = document.getElementById('debug-monitor');
        if (!monitor) return;
        monitor.style.display = 'block';
        
        let lastTime = performance.now();
        let frames = 0;
        
        const loop = () => {
            frames++;
            const now = performance.now();
            if (now >= lastTime + 1000) {
                document.getElementById('fps-counter').innerText = `FPS: ${frames}`;
                frames = 0;
                lastTime = now;
                
                if (performance.memory) {
                    const mem = Math.round(performance.memory.usedJSHeapSize / 1048576);
                    document.getElementById('mem-counter').innerText = `MEM: ${mem}MB`;
                }
            }
            requestAnimationFrame(loop);
        };
        loop();
    },
    
    saveMatchState(matchId, fen, currentTurn, timers) {
        if (!FtechSystem.account.uid) return;
        // Save to local cache for instant boot
        localStorage.setItem('ftech_reconnect_state', JSON.stringify({
            matchId: matchId,
            fen: fen,
            turn: currentTurn,
            timers: timers,
            timestamp: Date.now()
        }));
        
        // Also save to cloud for cross-device resume
        firebase.firestore().collection('users').doc(FtechSystem.account.uid).set({
            activeMatchId: matchId,
            activeMatchState: fen
        }, { merge: true });
    },
    
    checkReconnectState() {
        const stateStr = localStorage.getItem('ftech_reconnect_state');
        if (!stateStr) return;
        
        const state = JSON.parse(stateStr);
        const age = Date.now() - state.timestamp;
        
        // Expire after 10 minutes (600,000ms)
        if (age < 600000 && state.matchId) {
            console.warn("FtechSocial: Active match detected. Prompting reconnect.");
            // Render Reconnect UI
            const modal = document.createElement('div');
            modal.style = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1a1a25; border:2px solid var(--gold); padding:24px; border-radius:12px; z-index:10000; text-align:center; box-shadow:0 10px 40px rgba(0,0,0,0.8);";
            modal.innerHTML = `
                <h3 style="color:#fff; margin-bottom:12px;">MATCH IN PROGRESS</h3>
                <p style="color:var(--text-muted); font-size:12px; margin-bottom:20px;">You disconnected from an active match.</p>
                <div style="display:flex; gap:12px;">
                    <button class="btn btn-outline" onclick="FtechSocial.clearReconnectState(); this.parentElement.parentElement.remove();" style="flex:1;">ABANDON</button>
                    <button class="btn btn-primary" onclick="FtechSocial.executeReconnect(); this.parentElement.parentElement.remove();" style="flex:2;">RECONNECT</button>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            this.clearReconnectState();
        }
    },
    
    clearReconnectState() {
        localStorage.removeItem('ftech_reconnect_state');
        if (FtechSystem.account.uid && typeof firebase !== 'undefined') {
            firebase.firestore().collection('users').doc(FtechSystem.account.uid).update({
                activeMatchId: firebase.firestore.FieldValue.delete(),
                activeMatchState: firebase.firestore.FieldValue.delete()
            }).catch(()=>{});
        }
    },
    
    executeReconnect() {
        const stateStr = localStorage.getItem('ftech_reconnect_state');
        if (!stateStr) return;
        const state = JSON.parse(stateStr);
        // Fire up multiplayer engine to rejoin room
        if (typeof joinRoom === 'function') {
            joinRoom(state.matchId);
            showToast("RECONNECTING TO MATCH...");
        }
    }
};

// Start Health Monitor automatically if debug mode
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    FtechSocial.initHealthMonitor();
}

// Hook checkReconnectState on boot
setTimeout(() => {
    if (typeof FtechSocial !== 'undefined') FtechSocial.checkReconnectState();
}, 3000);

