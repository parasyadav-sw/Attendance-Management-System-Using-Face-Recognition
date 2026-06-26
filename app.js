/**
 * AuraScan - Face Recognition Attendance System
 * Core Application Logic
 */

// Global State
const state = {
    // Database
    users: [], // Array of { id, name, role, descriptor (Float32Array) }
    logs: [],  // Array of { id, name, role, timestamp, date, status }
    
    // UI Settings
    settings: {
        cooldown: 5,        // Attendance cooldown in minutes
        soundEnabled: true, // Audio feedback toggle
        showLandmarks: false, // Render face points toggle
        detectionModel: 'ssd', // 'ssd' or 'tiny'
        threshold: 0.50,    // Match threshold (lower = stricter)
        theme: 'light',     // UI theme ('light' or 'dark')
        shiftStart: '09:00', // Shift start time (HH:MM)
        gracePeriod: 15     // Late grace period in minutes
    },
    
    // Runtime References
    activeTab: 'dashboard',
    modelsLoaded: false,
    scannerStream: null,
    captureStream: null,
    scannerLoopId: null,
    cooldowns: new Map(), // userId -> timestamp
    registrationTimerId: null,
    isEnrolling: false,
    scannerFacingMode: 'user', // 'user' (front) or 'environment' (back)
    captureFacingMode: 'user', // 'user' (front) or 'environment' (back)
    
    // Audio Context
    audioCtx: null
};

// Web Audio API Sound Generator (Zero-dependency Audio Alert System)
function playSound(type) {
    if (!state.settings.soundEnabled) return;
    
    try {
        if (!state.audioCtx) {
            state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const ctx = state.audioCtx;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'success') {
            // Pleasant double chime: High pitches
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880.00, now + 0.1); // A5
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'fail') {
            // Low buzzer tone
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120.00, now);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'click') {
            // Soft click
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, now);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.05, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        }
    } catch (e) {
        console.warn('Audio playback failed:', e);
    }
}

// Format Helper: date & time formatting
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(date) {
    return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Theme Manager
function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    state.settings.theme = theme;
    
    // Save theme to localStorage immediately
    localStorage.setItem('parascan_theme', theme);
    
    // Update theme toggle button icon
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
        if (theme === 'dark') {
            toggleBtn.innerHTML = `
                <!-- Moon Icon -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon" id="moon-icon">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            `;
        } else {
            toggleBtn.innerHTML = `
                <!-- Sun Icon -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun" id="sun-icon">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
            `;
        }
    }
}

// ----------------------------------------------------
// DATABASE OPERATION METHODS (LocalStorage wrapper)
// ----------------------------------------------------
function saveDatabase() {
    // Serialize state.users (descriptors need to be converted to arrays)
    const serializedUsers = state.users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        descriptor: Array.from(u.descriptor),
        enrolledAt: u.enrolledAt || new Date().toISOString()
    }));
    
    localStorage.setItem('parascan_users', JSON.stringify(serializedUsers));
    localStorage.setItem('parascan_logs', JSON.stringify(state.logs));
    localStorage.setItem('parascan_settings', JSON.stringify(state.settings));
}

function loadDatabase() {
    // Load settings
    const storedSettings = localStorage.getItem('parascan_settings') || localStorage.getItem('aurascan_settings');
    if (storedSettings) {
        try {
            state.settings = { ...state.settings, ...JSON.parse(storedSettings) };
        } catch(e) { console.error('Failed to parse settings', e); }
    }

    // Load theme setting
    const storedTheme = localStorage.getItem('parascan_theme') || state.settings.theme || 'light';
    applyTheme(storedTheme);

    // Load users
    const storedUsers = localStorage.getItem('parascan_users') || localStorage.getItem('aurascan_users');
    if (storedUsers) {
        try {
            const parsed = JSON.parse(storedUsers);
            state.users = parsed.map(u => ({
                id: u.id,
                name: u.name,
                role: u.role,
                descriptor: new Float32Array(u.descriptor),
                enrolledAt: u.enrolledAt
            }));
        } catch(e) {
            console.error('Failed to load users from local storage', e);
            state.users = [];
        }
    }

    // Load logs
    const storedLogs = localStorage.getItem('parascan_logs') || localStorage.getItem('aurascan_logs');
    if (storedLogs) {
        try {
            state.logs = JSON.parse(storedLogs);
        } catch(e) {
            console.error('Failed to load logs from local storage', e);
            state.logs = [];
        }
    }
    
    // Sync Settings controls on load
    document.getElementById('setting-cooldown').value = state.settings.cooldown;
    document.getElementById('setting-shift-start').value = state.settings.shiftStart || "09:00";
    document.getElementById('setting-grace-period').value = state.settings.gracePeriod !== undefined ? state.settings.gracePeriod : 15;
    document.getElementById('setting-sound').checked = state.settings.soundEnabled;
    document.getElementById('setting-landmarks').checked = state.settings.showLandmarks;
    document.getElementById('threshold-slider').value = state.settings.threshold;
    document.getElementById('threshold-val').textContent = Number(state.settings.threshold).toFixed(2);
    
    const radioModel = document.querySelector(`input[name="detection-model"][value="${state.settings.detectionModel}"]`);
    if (radioModel) radioModel.checked = true;
    
    updateDashboardUI();
}

// ----------------------------------------------------
// FACE-API MODEL INITIALIZATION
// ----------------------------------------------------
async function initFaceAPI() {
    const statusDot = document.getElementById('system-status-dot');
    const statusText = document.getElementById('system-status-text');
    const stateVal = document.getElementById('stat-system-state');
    
    statusDot.className = 'status-dot';
    statusText.textContent = 'Models Loading...';
    stateVal.textContent = 'Loading Models';

    try {
        console.log('Loading face-api.js models...');
        // Load model weight files from our local server static "/models" directory
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        
        console.log('Models loaded successfully.');
        state.modelsLoaded = true;
        
        statusDot.classList.add('active');
        statusText.textContent = 'System Active';
        stateVal.textContent = 'Online & Active';
        
        // Populate system dashboard state details
        updateSystemStateUI();
    } catch (err) {
        console.error('Failed to load models:', err);
        statusDot.className = 'status-dot error';
        statusText.textContent = 'System Error';
        stateVal.textContent = 'Error Loading Models';
        alert('Could not load face-recognition models from "/models". Ensure your local Node server is running and models exist.');
    }
}

function updateSystemStateUI() {
    const engineType = document.getElementById('stat-engine-type');
    if (state.settings.detectionModel === 'ssd') {
        engineType.textContent = 'SSD MobileNet V1';
    } else {
        engineType.textContent = 'Tiny Face Detector';
    }
}

// ----------------------------------------------------
// CAMERA OPERATIONS (Webcam Streaming)
// ----------------------------------------------------
async function startWebcam(videoElement, captureStreamKey) {
    if (state[captureStreamKey]) {
        return state[captureStreamKey];
    }

    try {
        // Query active facingMode based on stream destination
        const facingMode = captureStreamKey === 'scannerStream' ? state.scannerFacingMode : state.captureFacingMode;
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: facingMode
            },
            audio: false
        });
        
        videoElement.srcObject = stream;
        state[captureStreamKey] = stream;
        videoElement.classList.remove('hidden');
        
        // Dynamically adjust mirroring CSS based on facing mode
        const isUser = facingMode === 'user';
        videoElement.style.transform = isUser ? 'scaleX(-1)' : 'none';
        
        const overlayCanvasId = captureStreamKey === 'scannerStream' ? 'scanner-overlay' : 'capture-overlay';
        const overlayCanvas = document.getElementById(overlayCanvasId);
        if (overlayCanvas) {
            overlayCanvas.style.transform = isUser ? 'scaleX(-1)' : 'none';
        }
        
        return stream;
    } catch (err) {
        console.error('Error accessing webcam:', err);
        alert('Webcam Access Denied or Unrecognized. Please check system permissions.');
        throw err;
    }
}

function stopWebcam(videoElement, captureStreamKey) {
    const stream = state[captureStreamKey];
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        videoElement.classList.add('hidden');
        state[captureStreamKey] = null;
    }
}

async function flipCamera(videoElement, captureStreamKey, facingModeKey) {
    // 1. Stop current stream
    stopWebcam(videoElement, captureStreamKey);
    
    // 2. Toggle state
    state[facingModeKey] = state[facingModeKey] === 'user' ? 'environment' : 'user';
    
    // 3. Restart webcam
    try {
        await startWebcam(videoElement, captureStreamKey);
        
        // If it's the scanner, make sure we renew the loop or canvas overlay elements
        if (captureStreamKey === 'scannerStream') {
            const canvas = document.getElementById('scanner-overlay');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    } catch(err) {
        console.error('Camera flip failed:', err);
        alert('Failed to switch camera. Ensure your device has multiple camera inputs.');
    }
}

// Time Checking Utility for Shift/Lateness
function evaluateAttendanceStatus(timestamp) {
    const shiftStartStr = state.settings.shiftStart || "09:00";
    const graceMinutes = state.settings.gracePeriod !== undefined ? state.settings.gracePeriod : 15;
    
    const [shiftH, shiftM] = shiftStartStr.split(':').map(Number);
    const scanTime = new Date(timestamp);
    const scanH = scanTime.getHours();
    const scanM = scanTime.getMinutes();
    
    const shiftTotalMin = shiftH * 60 + shiftM;
    const scanTotalMin = scanH * 60 + scanM;
    
    if (scanTotalMin > (shiftTotalMin + graceMinutes)) {
        return 'Late';
    }
    return 'Present';
}

// ----------------------------------------------------
// ATTENDANCE LOGGER ENGINE
// ----------------------------------------------------
function logAttendance(userId, name, role) {
    const now = Date.now();
    const cooldownMs = state.settings.cooldown * 60 * 1000;
    
    // Check cooldown to avoid logging duplicate attendance within minutes
    if (state.cooldowns.has(userId)) {
        const lastScan = state.cooldowns.get(userId);
        if (now - lastScan < cooldownMs) {
            const minutesLeft = Math.ceil((cooldownMs - (now - lastScan)) / 60000);
            return { logged: false, reason: `Cooldowned (${minutesLeft}m left)` };
        }
    }
    
    // Log new attendance record
    const dateObj = new Date();
    const status = evaluateAttendanceStatus(dateObj.getTime());
    const newRecord = {
        id: userId,
        name: name,
        role: role,
        timestamp: dateObj.getTime(),
        date: dateObj.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' }),
        time: formatTime(dateObj),
        status: status
    };
    
    state.logs.unshift(newRecord); // Add to beginning
    state.cooldowns.set(userId, now);
    
    // Play pleasant check-in chime
    playSound('success');
    
    // Save to LocalStorage
    saveDatabase();
    
    // Display check-in Toast notifications (differentiate present vs late)
    if (status === 'Late') {
        showToast(name, `Late Check-In at ${newRecord.time} (Shift: ${state.settings.shiftStart})`);
        addActivityFeedEntry(name, `Checked in Late (${role})`, 'success');
    } else {
        showToast(name, `Checked in successfully at ${newRecord.time}`);
        addActivityFeedEntry(name, `Checked in (${role})`, 'success');
    }
    
    // Refresh stats UI
    updateDashboardUI();
    
    return { logged: true };
}

// Toast Alert display helper
function showToast(title, message) {
    const toast = document.getElementById('attendance-toast');
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-message').textContent = message;
    
    toast.classList.remove('hidden');
    
    // Reset toast hide timer
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    
    toast.timeoutId = setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Scanner sidebar activity feed
function addActivityFeedEntry(name, details, status) {
    const feed = document.getElementById('live-scan-feed');
    // Remove empty placeholder message
    const emptyMsg = feed.querySelector('.empty-feed-message');
    if (emptyMsg) emptyMsg.remove();
    
    const entry = document.createElement('div');
    entry.className = 'feed-item';
    
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    entry.innerHTML = `
        <span class="feed-time">${timeStr}</span>
        <div class="feed-details">
            <strong>${name}</strong>
            <span>${details}</span>
        </div>
        <span class="feed-badge ${status}"></span>
    `;
    
    feed.insertBefore(entry, feed.firstChild);
    
    // Keep max 20 entries
    while (feed.children.length > 20) {
        feed.removeChild(feed.lastChild);
    }
}

// ----------------------------------------------------
// ATTENDANCE REAL-TIME CAMERA DETECTOR LOOP
// ----------------------------------------------------
async function runScannerLoop() {
    const video = document.getElementById('scanner-video');
    const canvas = document.getElementById('scanner-overlay');
    const statusBanner = document.getElementById('scanner-status-banner');
    
    if (video.paused || video.ended || !state.modelsLoaded) {
        state.scannerLoopId = requestAnimationFrame(runScannerLoop);
        return;
    }

    // Set canvas dimensions identical to video overlay layout
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set options based on active settings selection
    let detectorOptions;
    if (state.settings.detectionModel === 'ssd') {
        detectorOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    } else {
        detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
    }

    // Detect all faces in current canvas frame with landmarks and descriptors
    try {
        const detections = await faceapi.detectAllFaces(video, detectorOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length > 0) {
            statusBanner.textContent = `Scanning: Detected ${detections.length} face(s)`;
            statusBanner.style.color = '#34d399';

            // Resize the detection boxes to match canvas dimensions
            const resizedDetections = faceapi.resizeResults(detections, {
                width: canvas.width,
                height: canvas.height
            });

            // Iterate detections and match against enrolled users
            for (let i = 0; i < resizedDetections.length; i++) {
                const detection = resizedDetections[i];
                const descriptor = detection.descriptor;
                
                let matchName = "Unrecognized";
                let matchRole = "";
                let matchScore = 0;
                let bestMatchId = null;

                // Compare descriptor with database profiles using Euclidean Distance
                if (state.users.length > 0) {
                    let minDistance = 999.0;
                    
                    for (const user of state.users) {
                        const dist = faceapi.euclideanDistance(descriptor, user.descriptor);
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestMatchId = user.id;
                            matchName = user.name;
                            matchRole = user.role;
                        }
                    }
                    
                    // Match holds if distance is within threshold limits
                    if (minDistance <= state.settings.threshold) {
                        matchScore = (1 - minDistance) * 100;
                    } else {
                        matchName = "Unrecognized";
                        bestMatchId = null;
                    }
                }

                // Render Detection Overlays
                const { x, y, width, height } = detection.detection.box;
                
                // Draw custom box outline (purple if unrecognized, green if recognized)
                const isMatched = bestMatchId !== null;
                ctx.strokeStyle = isMatched ? '#10b981' : '#8b5cf6';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);

                // Draw solid header bar on bounding box top
                ctx.fillStyle = isMatched ? 'rgba(16, 185, 129, 0.85)' : 'rgba(139, 92, 246, 0.85)';
                ctx.fillRect(x, y - 28, width, 28);

                // Draw Text info
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Inter, sans-serif';
                const labelText = isMatched 
                    ? `${matchName} (${matchScore.toFixed(0)}%)` 
                    : 'Unrecognized';
                ctx.fillText(labelText, x + 8, y - 10);
                
                // Draw face landmarks if enabled
                if (state.settings.showLandmarks) {
                    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections[i]);
                }

                // Log Attendance on successful match detection
                if (isMatched) {
                    const logResult = logAttendance(bestMatchId, matchName, matchRole);
                    if (!logResult.logged && logResult.reason.includes('Cooldown')) {
                        // Display small overlay notice that user is checked in
                        ctx.fillStyle = '#fbbf24';
                        ctx.font = '500 10px Inter, sans-serif';
                        ctx.fillText('Already Scanned', x + 8, y + height + 16);
                    }
                } else {
                    // Periodic unrecognized sound/warning to avoid spam
                    throttleUnrecognizedScan();
                }
            }
        } else {
            statusBanner.textContent = 'Scanning: Fit your face in the bounding box...';
            statusBanner.style.color = '#9ca3af';
        }
    } catch(err) {
        console.error('Detection loop crash:', err);
    }

    state.scannerLoopId = requestAnimationFrame(runScannerLoop);
}

// Avoid buzzer blasting constantly on unregistered faces
let lastUnrecognizedTime = 0;
function throttleUnrecognizedScan() {
    const now = Date.now();
    if (now - lastUnrecognizedTime > 3000) {
        playSound('fail');
        addActivityFeedEntry('Unknown Face', 'Unrecognized scan attempt', 'failed');
        lastUnrecognizedTime = now;
    }
}

// ----------------------------------------------------
// FACE BIOMETRIC REGISTRATION ENGINE
// ----------------------------------------------------
async function enrollMember() {
    // Prevent multiple concurrent countdowns/registrations
    if (state.isEnrolling) {
        return;
    }
    state.isEnrolling = true;

    // Clear any duplicate running intervals
    if (state.registrationTimerId) {
        clearInterval(state.registrationTimerId);
        state.registrationTimerId = null;
    }

    const regIdInput = document.getElementById('reg-id');
    const regNameInput = document.getElementById('reg-name');
    const regRoleInput = document.getElementById('reg-role');
    const video = document.getElementById('capture-video');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNum = document.getElementById('countdown-number');

    const id = regIdInput.value.trim();
    const name = regNameInput.value.trim();
    const role = regRoleInput.value;

    if (!id || !name) {
        alert('Please fill out Member ID and Name before registering biometrics.');
        state.isEnrolling = false;
        return;
    }

    // Verify if ID already exists
    if (state.users.some(u => u.id.toLowerCase() === id.toLowerCase())) {
        alert(`A member with ID "${id}" is already enrolled in the system.`);
        state.isEnrolling = false;
        return;
    }

    if (!state.modelsLoaded) {
        alert('Models are not finished loading yet. Please wait.');
        state.isEnrolling = false;
        return;
    }

    if (!state.captureStream) {
        alert('Please activate the camera viewport first.');
        state.isEnrolling = false;
        return;
    }

    // Capture flow UI locking
    document.getElementById('btn-enroll-capture').disabled = true;
    regIdInput.disabled = true;
    regNameInput.disabled = true;
    regRoleInput.disabled = true;

    // Launch countdown 5, 4, 3, 2, 1
    countdownOverlay.classList.remove('hidden');
    let timer = 5;
    countdownNum.textContent = timer;
    playSound('click');

    state.registrationTimerId = setInterval(async () => {
        timer--;
        if (timer > 0) {
            countdownNum.textContent = timer;
            playSound('click');
        } else {
            // Immediately clear the interval to prevent duplicate executions
            clearInterval(state.registrationTimerId);
            state.registrationTimerId = null;
            
            // Hide the overlay immediately
            countdownOverlay.classList.add('hidden');
            
            // Run registration with a 100ms delay to allow the browser to paint the DOM
            // and hide the overlay before any blocking alert() dialogs are shown.
            setTimeout(async () => {
                try {
                    await processEnrollment(id, name, role);
                } catch (err) {
                    console.error("Biometric capture failed:", err);
                } finally {
                    // Unlock UI inputs and state guard
                    state.isEnrolling = false;
                    document.getElementById('btn-enroll-capture').disabled = false;
                    regIdInput.disabled = false;
                    regNameInput.disabled = false;
                    regRoleInput.disabled = false;
                }
            }, 100);
        }
    }, 1000);
}

async function processEnrollment(id, name, role) {
    const video = document.getElementById('capture-video');
    const banner = document.getElementById('system-status-text');
    
    try {
        // High confidence SSD detection for registration
        const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
            
        if (!detection) {
            alert('Bio Capture Failed: No face detected in frame. Make sure your face is fully visible and look directly at the camera.');
            return;
        }

        // Create new user entry
        const newUser = {
            id: id,
            name: name,
            role: role,
            descriptor: detection.descriptor, // Float32Array (128 elements)
            enrolledAt: new Date().toISOString()
        };

        state.users.push(newUser);
        saveDatabase();
        
        // Play success tone
        playSound('success');
        
        // Reset registration fields
        document.getElementById('reg-id').value = '';
        document.getElementById('reg-name').value = '';
        
        alert(`Successfully Enrolled!\nMember: ${name}\nID: ${id}\nBiometrics: face signature successfully enrolled.`);
        
        // Stop capture camera after success
        stopWebcam(document.getElementById('capture-video'), 'captureStream');
        document.getElementById('capture-placeholder').classList.remove('hidden');
        document.getElementById('btn-deactivate-capture-cam').disabled = true;
        document.getElementById('btn-enroll-capture').disabled = true;

        // Switch back to dashboard view to see the update
        switchTab('dashboard');
        updateDashboardUI();
        
    } catch (err) {
        console.error('Enrollment processing error:', err);
        alert('Bio Capture Error: An unexpected error occurred while analyzing the face. Please try again.');
    }
}

// ----------------------------------------------------
// UI RENDERING & COMPONENT SYNCS
// ----------------------------------------------------
function updateDashboardUI() {
    // 1. Total count
    document.getElementById('stat-total-users').textContent = state.users.length;
    
    // 2. Count present today
    const todayStr = new Date().toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    // Filter unique users checked in today (both Present and Late counts as present)
    const uniqueCheckedInToday = new Set(
        state.logs
            .filter(log => log.date === todayStr && (log.status === 'Present' || log.status === 'Late'))
            .map(log => log.id)
    );
    const presentToday = uniqueCheckedInToday.size;
    document.getElementById('stat-present-users').textContent = presentToday;
    
    // Count late check-ins today
    const uniqueLateToday = new Set(
        state.logs
            .filter(log => log.date === todayStr && log.status === 'Late')
            .map(log => log.id)
    );
    const lateToday = uniqueLateToday.size;
    const changeText = document.getElementById('stat-present-change');
    if (changeText) {
        changeText.textContent = lateToday > 0 ? `${lateToday} late check-ins` : "All on time today";
        changeText.className = lateToday > 0 ? "stat-trend" : "stat-trend positive";
    }
    
    // 3. Attendance Rate
    let rate = 0;
    if (state.users.length > 0) {
        rate = Math.round((presentToday / state.users.length) * 100);
    }
    document.getElementById('stat-attendance-rate').textContent = `${rate}%`;
    document.getElementById('stat-rate-text').textContent = `Out of ${state.users.length} enrolled`;

    // Render Recent logs table
    renderLogsTable();
    
    // Render enrolled members list
    renderEnrolledProfiles();
}

function renderLogsTable(searchQuery = '') {
    const tbody = document.getElementById('logs-tbody');
    tbody.innerHTML = '';
    
    const query = searchQuery.toLowerCase().trim();
    const filteredLogs = state.logs.filter(log => {
        return log.id.toLowerCase().includes(query) || 
               log.name.toLowerCase().includes(query) || 
               log.role.toLowerCase().includes(query) || 
               log.date.includes(query) || 
               log.time.includes(query);
    });

    if (filteredLogs.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">${query ? 'No records matching search query.' : 'No attendance logs found.'}</td>
            </tr>
        `;
        return;
    }

    filteredLogs.forEach(log => {
        const row = document.createElement('tr');
        const isLate = log.status === 'Late';
        row.innerHTML = `
            <td><strong>${log.id}</strong></td>
            <td>${log.name}</td>
            <td>${log.role}</td>
            <td>${log.time}</td>
            <td>${log.date}</td>
            <td><span class="status-tag ${isLate ? 'tardy' : 'present'}">${isLate ? 'Late' : 'Present'}</span></td>
        `;
        tbody.appendChild(row);
    });
}

function renderEnrolledProfiles() {
    const list = document.getElementById('enrolled-profiles-list');
    list.innerHTML = '';
    
    if (state.users.length === 0) {
        list.innerHTML = '<div class="empty-list-message">No members registered yet.</div>';
        return;
    }

    state.users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'profile-item';
        
        // Take initials for avatar
        const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        item.innerHTML = `
            <div class="profile-avatar">${initials}</div>
            <div class="profile-info">
                <strong>${user.name}</strong>
                <span>${user.role} • ID: ${user.id}</span>
            </div>
            <div class="profile-actions">
                <button title="Delete Member" onclick="deleteMember('${user.id}')">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Window scope deletion helper (since buttons are injected dynamically)
window.deleteMember = function(userId) {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    
    if (confirm(`Are you sure you want to delete member: ${user.name} (${user.id})?\nTheir biometric face print will be wiped.`)) {
        state.users = state.users.filter(u => u.id !== userId);
        
        // Also clear cooldown for this user if exists
        state.cooldowns.delete(userId);
        
        saveDatabase();
        updateDashboardUI();
        playSound('fail');
    }
};

// Tab controller switches panels
function switchTab(tabName) {
    state.activeTab = tabName;
    
    // Update Sidebar CSS class
    document.querySelectorAll('.nav-item').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update Top bar header
    const titleHeader = document.getElementById('current-page-title');
    const prettyTitles = {
        'dashboard': 'Attendance Dashboard',
        'scanner': 'Live Biometric Scanner',
        'registration': 'Register Face Profile',
        'settings': 'System Settings'
    };
    titleHeader.textContent = prettyTitles[tabName] || 'ParaScan';

    // Show/Hide Tab divs
    document.querySelectorAll('.tab-content').forEach(section => {
        if (section.id === `tab-${tabName}`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    // CAMERA LIFECYCLE MANAGEMENT ON TAB SWITCH
    // Stop scanner cameras if leaving scanner tab
    if (tabName !== 'scanner') {
        stopScannerCamera();
    } else {
        // Automatically request scanner camera on scanner page loading
        startScannerCamera();
    }

    // Stop capture camera if leaving registration tab
    if (tabName !== 'registration') {
        stopCaptureCamera();
    }
}

// Scanner tab camera starters/stoppers
async function startScannerCamera() {
    const video = document.getElementById('scanner-video');
    const placeholder = document.getElementById('scanner-placeholder');
    const hud = document.getElementById('scanner-hud');
    const overlay = document.getElementById('scanner-overlay');
    
    try {
        const stream = await startWebcam(video, 'scannerStream');
        placeholder.classList.add('hidden');
        hud.classList.remove('hidden');
        overlay.classList.remove('hidden');
        document.getElementById('btn-stop-scanner').disabled = false;
        document.getElementById('btn-flip-scanner').disabled = false;
        
        // Start recursive processing loops
        if (!state.scannerLoopId) {
            runScannerLoop();
        }
    } catch(e) {
        console.error('Failed to boot camera', e);
    }
}

function stopScannerCamera() {
    const video = document.getElementById('scanner-video');
    const placeholder = document.getElementById('scanner-placeholder');
    const hud = document.getElementById('scanner-hud');
    const overlay = document.getElementById('scanner-overlay');
    
    stopWebcam(video, 'scannerStream');
    
    placeholder.classList.remove('hidden');
    hud.classList.add('hidden');
    overlay.classList.add('hidden');
    document.getElementById('btn-stop-scanner').disabled = true;
    document.getElementById('btn-flip-scanner').disabled = true;
    
    if (state.scannerLoopId) {
        cancelAnimationFrame(state.scannerLoopId);
        state.scannerLoopId = null;
    }
    
    const canvas = document.getElementById('scanner-overlay');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    document.getElementById('scanner-status-banner').textContent = 'Scanner camera turned off.';
}

// Registration tab camera starters/stoppers
async function startCaptureCamera() {
    const video = document.getElementById('capture-video');
    const placeholder = document.getElementById('capture-placeholder');
    
    try {
        await startWebcam(video, 'captureStream');
        placeholder.classList.add('hidden');
        document.getElementById('btn-deactivate-capture-cam').disabled = false;
        document.getElementById('btn-flip-capture').disabled = false;
        document.getElementById('btn-enroll-capture').disabled = false;
    } catch(e) {}
}

function stopCaptureCamera() {
    const video = document.getElementById('capture-video');
    const placeholder = document.getElementById('capture-placeholder');
    
    stopWebcam(video, 'captureStream');
    placeholder.classList.remove('hidden');
    document.getElementById('btn-deactivate-capture-cam').disabled = true;
    document.getElementById('btn-flip-capture').disabled = true;
    document.getElementById('btn-enroll-capture').disabled = true;
}

// ----------------------------------------------------
// EXPORT AND IMPORT DATABASE CONTROLLERS
// ----------------------------------------------------
function exportLogsToCSV() {
    if (state.logs.length === 0) {
        alert('There are no logs in the history database to export.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Member ID,Full Name,Role,Scan Date,Scan Time,Status\r\n";
    
    state.logs.forEach(log => {
        // Clean names to prevent CSV corruption
        const cleanName = log.name.replace(/"/g, '""');
        csvContent += `"${log.id}","${cleanName}","${log.role}","${log.date}","${log.time}","${log.status}"\r\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `parascan_attendance_report_${today}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    playSound('success');
}

function exportDatabaseJSON() {
    // Generate serialization structure
    const data = {
        users: state.users.map(u => ({
            id: u.id,
            name: u.name,
            role: u.role,
            descriptor: Array.from(u.descriptor),
            enrolledAt: u.enrolledAt
        })),
        logs: state.logs,
        settings: state.settings,
        version: "1.0"
    };

    const str = JSON.stringify(data, null, 2);
    const blob = new Blob([str], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `parascan_database_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    playSound('success');
}

function importDatabaseJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            
            if (!data.users || !data.logs) {
                alert('Invalid file format. Ensure the json backup file is correct.');
                return;
            }

            if (confirm(`Warning: Importing this database will merge the incoming file. Duplicated profiles will be skipped. Proceed?`)) {
                // Merge users
                let addedCount = 0;
                data.users.forEach(importedUser => {
                    if (!state.users.some(u => u.id.toLowerCase() === importedUser.id.toLowerCase())) {
                        state.users.push({
                            id: importedUser.id,
                            name: importedUser.name,
                            role: importedUser.role,
                            descriptor: new Float32Array(importedUser.descriptor),
                            enrolledAt: importedUser.enrolledAt || new Date().toISOString()
                        });
                        addedCount++;
                    }
                });

                // Merge logs
                state.logs = [...state.logs, ...data.logs];
                // Sort logs by newest first
                state.logs.sort((a, b) => b.timestamp - a.timestamp);

                saveDatabase();
                updateDashboardUI();
                playSound('success');
                alert(`Import Complete!\nAdded ${addedCount} new users and merged logs.`);
            }
        } catch(err) {
            console.error(err);
            alert('Error parsing JSON backup file.');
        }
    };
    reader.readAsText(file);
}

function resetAllData() {
    if (confirm('CRITICAL WARNING: Are you sure you want to clear the entire ParaScan database?\nThis will permanently erase all registered member faces, descriptors, and attendance log history. This action cannot be undone.')) {
        if (confirm('Please confirm once more: Do you want to completely erase the database?')) {
            state.users = [];
            state.logs = [];
            state.cooldowns.clear();
            saveDatabase();
            updateDashboardUI();
            playSound('fail');
            alert('Database has been completely cleared.');
        }
    }
}

// ----------------------------------------------------
// EVENTS INITIALIZATION & MOUNTING
// ----------------------------------------------------
function bindEvents() {
    // 1. Sidebar tab switching buttons
    document.querySelectorAll('.sidebar .nav-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // 2. Dashboard shortcut buttons
    document.getElementById('btn-scan-now').addEventListener('click', () => switchTab('scanner'));
    document.getElementById('btn-add-now').addEventListener('click', () => switchTab('registration'));
    document.getElementById('btn-reset-db').addEventListener('click', resetAllData);
    document.getElementById('btn-export-csv').addEventListener('click', exportLogsToCSV);

    // 3. Scanner Controls
    document.getElementById('btn-start-scanner').addEventListener('click', startScannerCamera);
    document.getElementById('btn-stop-scanner').addEventListener('click', stopScannerCamera);
    document.getElementById('btn-flip-scanner').addEventListener('click', () => {
        flipCamera(document.getElementById('scanner-video'), 'scannerStream', 'scannerFacingMode');
        playSound('click');
    });
    
    // 4. Threshold Slider
    const slider = document.getElementById('threshold-slider');
    const valText = document.getElementById('threshold-val');
    slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        state.settings.threshold = val;
        valText.textContent = val.toFixed(2);
        saveDatabase();
    });

    // 5. Model switching radio inputs
    document.querySelectorAll('input[name="detection-model"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.settings.detectionModel = e.target.value;
            saveDatabase();
            updateSystemStateUI();
        });
    });

    // 6. Registration Controls
    document.getElementById('btn-activate-capture-cam').addEventListener('click', startCaptureCamera);
    document.getElementById('btn-deactivate-capture-cam').addEventListener('click', stopCaptureCamera);
    document.getElementById('btn-flip-capture').addEventListener('click', () => {
        flipCamera(document.getElementById('capture-video'), 'captureStream', 'captureFacingMode');
        playSound('click');
    });
    document.getElementById('btn-enroll-capture').addEventListener('click', enrollMember);

    // 7. Settings Controls
    document.getElementById('setting-cooldown').addEventListener('change', (e) => {
        const val = parseInt(e.target.value) || 5;
        state.settings.cooldown = val;
        saveDatabase();
    });

    document.getElementById('setting-shift-start').addEventListener('change', (e) => {
        state.settings.shiftStart = e.target.value || "09:00";
        saveDatabase();
        updateDashboardUI();
    });

    document.getElementById('setting-grace-period').addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        state.settings.gracePeriod = isNaN(val) ? 15 : val;
        saveDatabase();
        updateDashboardUI();
    });

    document.getElementById('setting-sound').addEventListener('change', (e) => {
        state.settings.soundEnabled = e.target.checked;
        saveDatabase();
    });

    document.getElementById('setting-landmarks').addEventListener('change', (e) => {
        state.settings.showLandmarks = e.target.checked;
        saveDatabase();
    });

    document.getElementById('btn-export-profiles').addEventListener('click', exportDatabaseJSON);
    
    // Import profile files trigger
    const fileInput = document.getElementById('input-import-profiles');
    document.getElementById('btn-import-profiles-trigger').addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', importDatabaseJSON);

    // 8. Log Table Live Search filter
    document.getElementById('log-search').addEventListener('input', (e) => {
        renderLogsTable(e.target.value);
    });

    // Theme toggle button listener
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        playSound('click');
    });

    // Live clock ticks
    setInterval(() => {
        const now = new Date();
        document.getElementById('current-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('current-date').textContent = formatDate(now);
    }, 1000);
}

// On Page Load
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize clock values
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('current-date').textContent = formatDate(now);
    
    // 2. Set event listeners
    bindEvents();
    
    // 3. Load database from LocalStorage
    loadDatabase();
    
    // 4. Initialize face-api
    await initFaceAPI();
});
