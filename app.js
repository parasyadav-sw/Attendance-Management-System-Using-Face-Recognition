/**
 * AuraScan - Face Recognition Attendance System
 * Core Application Logic
 */

// Global Helper: Format to Title Case
function toTitleCase(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => {
            if (word.length === 0) return '';
            // If it starts with a parenthesis, capitalize the next letter
            if (word.startsWith('(')) {
                return '(' + word.charAt(1).toUpperCase() + word.slice(2);
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

function applyGlobalTitleCase() {
    const selectors = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'button', '.btn', 'label', 'th',
        '.sidebar-menu span', '.tab-content h3',
        '.status-banner', '.modal-header h3', '.toast',
        '.camera-placeholder p', '.camera-placeholder h3',
        '.alert'
    ];
    
    document.querySelectorAll(selectors.join(',')).forEach(el => {
        if (el.children.length === 0) {
            el.textContent = toTitleCase(el.textContent);
        } else {
            el.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
                    node.nodeValue = toTitleCase(node.nodeValue);
                }
            });
        }
    });
}

function initGlobalInputTitleCase() {
    document.addEventListener('input', (e) => {
        const input = e.target;
        if (input.tagName === 'INPUT' && (input.type === 'text' || !input.type)) {
            const id = input.id.toLowerCase();
            const name = (input.name || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            
            const isExcluded = 
                id.includes('id') || id.includes('roll') || id.includes('hall') || 
                id.includes('reg') || id.includes('email') || id.includes('username') || 
                id.includes('password') || id.includes('url') || id.includes('token') || 
                id.includes('phone') || id.includes('date') || id.includes('time') || 
                id.includes('search') || id.includes('subject') ||
                name.includes('id') || name.includes('roll') || name.includes('hall') || 
                name.includes('reg') || name.includes('email') || name.includes('username') || 
                name.includes('password') || name.includes('url') || name.includes('token') || 
                name.includes('phone') || name.includes('date') || name.includes('time') || 
                name.includes('search') || name.includes('subject') ||
                placeholder.includes('roll') || placeholder.includes('hall') || 
                placeholder.includes('reg') || placeholder.includes('email') || 
                placeholder.includes('subjects');
                
            if (!isExcluded) {
                const selectionStart = input.selectionStart;
                const selectionEnd = input.selectionEnd;
                
                const originalValue = input.value;
                const titleCasedValue = toTitleCase(originalValue);
                
                if (originalValue !== titleCasedValue) {
                    input.value = titleCasedValue;
                    input.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        }
    });
}

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
        shiftStart: '09:00', // Shift start time (HH:MM) - backward compatibility
        gracePeriod: 15,     // Late grace period in minutes
        shifts: [
            { name: 'General Shift', time: '09:00' }
        ]
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
            if (!state.settings.shifts || state.settings.shifts.length === 0) {
                state.settings.shifts = [
                    { name: 'General Shift', time: state.settings.shiftStart || '09:00' }
                ];
            }
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
                name: toTitleCase(u.name),
                role: toTitleCase(u.role),
                descriptor: new Float32Array(u.descriptor),
                enrolledAt: u.enrolledAt,
                shift: u.shift ? toTitleCase(u.shift) : undefined
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
            state.logs = JSON.parse(storedLogs).map(log => ({
                ...log,
                name: toTitleCase(log.name),
                role: toTitleCase(log.role),
                status: toTitleCase(log.status),
                shift: log.shift ? toTitleCase(log.shift) : undefined
            }));
        } catch(e) {
            console.error('Failed to load logs from local storage', e);
            state.logs = [];
        }
    }
    
    // Sync Settings controls on load
    document.getElementById('setting-cooldown').value = state.settings.cooldown;
    document.getElementById('setting-grace-period').value = state.settings.gracePeriod !== undefined ? state.settings.gracePeriod : 15;
    document.getElementById('setting-sound').checked = state.settings.soundEnabled;
    document.getElementById('setting-landmarks').checked = state.settings.showLandmarks;
    
    // Draw daily shifts list
    renderShiftsList();
    
    // Sync Threshold Sliders
    document.getElementById('threshold-slider').value = state.settings.threshold;
    document.getElementById('threshold-val').textContent = Number(state.settings.threshold).toFixed(2);
    const settingsThreshold = document.getElementById('settings-threshold-slider');
    if (settingsThreshold) {
        settingsThreshold.value = state.settings.threshold;
        document.getElementById('settings-threshold-val').textContent = Number(state.settings.threshold).toFixed(2);
    }
    
    // Sync Model Radios (Scanner tab)
    const radioModel = document.querySelector(`input[name="detection-model"][value="${state.settings.detectionModel}"]`);
    if (radioModel) radioModel.checked = true;
    
    // Sync Model Radios (Settings tab)
    const settingsRadioModel = document.querySelector(`input[name="settings-detection-model"][value="${state.settings.detectionModel}"]`);
    if (settingsRadioModel) settingsRadioModel.checked = true;
    
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
        let facingMode;
        if (captureStreamKey === 'scannerStream') {
            facingMode = state.scannerFacingMode;
        } else if (captureStreamKey === 'examScannerStream') {
            facingMode = state.examScannerFacingMode;
        } else {
            facingMode = state.captureFacingMode;
        }
        
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
        
        let overlayCanvasId;
        if (captureStreamKey === 'scannerStream') {
            overlayCanvasId = 'scanner-overlay';
        } else if (captureStreamKey === 'examScannerStream') {
            overlayCanvasId = 'exam-scanner-overlay';
        } else {
            overlayCanvasId = 'capture-overlay';
        }
        
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
// Time Checking Utility for Shift/Lateness (Supports Dynamic Closest Shift Evaluation)
function evaluateAttendanceStatus(timestamp, user = null) {
    const graceMinutes = state.settings.gracePeriod !== undefined ? state.settings.gracePeriod : 15;
    
    // Get shifts list (fallback to General Shift if empty)
    const shifts = state.settings.shifts && state.settings.shifts.length > 0 
        ? state.settings.shifts 
        : [{ name: 'General Shift', time: state.settings.shiftStart || '09:00' }];
        
    const scanTime = new Date(timestamp);
    const scanH = scanTime.getHours();
    const scanM = scanTime.getMinutes();
    const scanTotalMin = scanH * 60 + scanM;
    
    let matchedShift = null;
    
    // Prioritize user's assigned shift if available
    if (user && user.shift) {
        matchedShift = shifts.find(s => s.name.toLowerCase() === user.shift.toLowerCase());
    }
    
    // Fallback: If no assigned shift or shift is not found, match the closest shift in start time
    if (!matchedShift) {
        let minDistance = Infinity;
        shifts.forEach(shift => {
            const [shiftH, shiftM] = shift.time.split(':').map(Number);
            const shiftTotalMin = shiftH * 60 + shiftM;
            
            // Circular distance in 1440 minutes (24 hours)
            const diff = Math.abs(scanTotalMin - shiftTotalMin);
            const distance = Math.min(diff, 1440 - diff);
            
            if (distance < minDistance) {
                minDistance = distance;
                matchedShift = shift;
            }
        });
    }
    
    const [shiftH, shiftM] = matchedShift.time.split(':').map(Number);
    const shiftTotalMin = shiftH * 60 + shiftM;
    
    // Relative minutes evaluation (takes care of midnight crossings)
    let relativeMinutes = scanTotalMin - shiftTotalMin;
    if (relativeMinutes < -720) {
        relativeMinutes += 1440;
    } else if (relativeMinutes > 720) {
        relativeMinutes -= 1440;
    }
    
    if (relativeMinutes > graceMinutes) {
        return { status: 'Late', shift: matchedShift };
    }
    return { status: 'Present', shift: matchedShift };
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
    const user = state.users.find(u => u.id === userId);
    const statusInfo = evaluateAttendanceStatus(dateObj.getTime(), user);
    const status = statusInfo.status;
    const matchingShift = statusInfo.shift;
    
    const newRecord = {
        id: userId,
        name: name,
        role: role,
        timestamp: dateObj.getTime(),
        date: dateObj.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' }),
        time: formatTime(dateObj),
        status: status,
        shift: matchingShift.name
    };
    
    state.logs.unshift(newRecord); // Add to beginning
    state.cooldowns.set(userId, now);
    
    // Play pleasant check-in chime
    playSound('success');
    
    // Save to LocalStorage
    saveDatabase();
    
    // Display check-in Toast notifications (differentiate present vs late)
    if (status === 'Late') {
        showToast(name, `Late Check-In at ${newRecord.time} (${matchingShift.name}: ${matchingShift.time})`);
        addActivityFeedEntry(name, `Checked in Late for ${matchingShift.name} (${role})`, 'success');
    } else {
        showToast(name, `Checked in successfully at ${newRecord.time} (${matchingShift.name})`);
        addActivityFeedEntry(name, `Checked in for ${matchingShift.name} (${role})`, 'success');
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
    const regShiftInput = document.getElementById('reg-assigned-shift');
    const video = document.getElementById('capture-video');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNum = document.getElementById('countdown-number');

    const id = regIdInput.value.trim();
    const name = regNameInput.value.trim();
    const role = regRoleInput.value;
    const shift = regShiftInput ? regShiftInput.value : '';

    if (!id || !name || !shift) {
        alert('Please fill out Member ID, Name, and assign a Work Shift before registering biometrics.');
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
                    await processEnrollment(id, name, role, shift);
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

async function processEnrollment(id, name, role, shift) {
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
            shift: shift,
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
        const regShiftInput = document.getElementById('reg-assigned-shift');
        if (regShiftInput) {
            regShiftInput.selectedIndex = 0;
        }
        
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

    // Sync shift filter dropdown
    syncShiftFilterDropdown();

    // Render Recent logs table with current active filters
    const searchVal = document.getElementById('log-search') ? document.getElementById('log-search').value : '';
    const shiftVal = document.getElementById('log-shift-filter') ? document.getElementById('log-shift-filter').value : '';
    renderLogsTable(searchVal, shiftVal);
    
    // Render enrolled members list
    renderEnrolledProfiles();
}

function syncShiftFilterDropdown() {
    const filterSelect = document.getElementById('log-shift-filter');
    if (!filterSelect) return;
    
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Shifts</option>';
    
    const shifts = state.settings.shifts || [];
    shifts.forEach(shift => {
        const option = document.createElement('option');
        option.value = shift.name;
        option.textContent = shift.name;
        filterSelect.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (shifts.some(s => s.name === currentVal)) {
        filterSelect.value = currentVal;
    }
}

function renderLogsTable(searchQuery = '', shiftFilter = '') {
    const tbody = document.getElementById('logs-tbody');
    tbody.innerHTML = '';
    
    const query = searchQuery.toLowerCase().trim();
    const activeShiftFilter = shiftFilter ? shiftFilter.toLowerCase().trim() : '';
    
    const filteredLogs = state.logs.filter(log => {
        const matchesQuery = !query || 
                             log.id.toLowerCase().includes(query) || 
                             log.name.toLowerCase().includes(query) || 
                             log.role.toLowerCase().includes(query) || 
                             log.date.includes(query) || 
                             log.time.includes(query);
                             
        const matchesShift = !activeShiftFilter || (log.shift && log.shift.toLowerCase() === activeShiftFilter);
        
        return matchesQuery && matchesShift;
    });

    if (filteredLogs.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">${(query || activeShiftFilter) ? 'No records matching search/filter criteria.' : 'No attendance logs found.'}</td>
            </tr>
        `;
        return;
    }

    filteredLogs.forEach(log => {
        const row = document.createElement('tr');
        const isLate = log.status === 'Late';
        row.innerHTML = `
            <td><strong>${log.id}</strong></td>
            <td>${toTitleCase(log.name)}</td>
            <td>${toTitleCase(log.role)}</td>
            <td>${log.time}${log.shift ? `<br><small style="color: var(--text-muted); font-size: 0.72rem; font-weight: 500;">${toTitleCase(log.shift)}</small>` : ''}</td>
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
                <strong>${toTitleCase(user.name)}</strong>
                <span>${toTitleCase(user.role)} • ID: ${user.id}${user.shift ? ` • Shift: ${toTitleCase(user.shift)}` : ''}</span>
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

function renderShiftsList() {
    const container = document.getElementById('shifts-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    const shifts = state.settings.shifts || [];
    
    if (shifts.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px; border: 1px dashed var(--border-color); border-radius: var(--radius-sm); text-align: center;">No shifts defined. Add one below.</div>';
        return;
    }
    
    shifts.forEach((shift, index) => {
        const item = document.createElement('div');
        item.className = 'shift-list-item';
        item.innerHTML = `
            <div class="shift-item-left">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="shift-clock-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span class="shift-item-name">${toTitleCase(shift.name)}</span>
                <span class="shift-item-time">(Starts: ${shift.time})</span>
            </div>
            <button class="btn-delete-shift" data-index="${index}" title="Delete Shift">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        container.appendChild(item);
    });
}

function syncRegistrationShiftsDropdown() {
    const select = document.getElementById('reg-assigned-shift');
    if (!select) return;
    
    // Save current selected value
    const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>-- Select a Shift --</option>';
    
    const shifts = state.settings.shifts || [];
    shifts.forEach(shift => {
        const option = document.createElement('option');
        option.value = shift.name;
        option.textContent = `${toTitleCase(shift.name)} (Starts: ${shift.time})`;
        select.appendChild(option);
    });
    
    // Restore selection if it still exists
    if (shifts.some(s => s.name === currentVal)) {
        select.value = currentVal;
    }
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
    } else {
        // Sync shifts dropdown when entering registration
        syncRegistrationShiftsDropdown();
    }

    // Stop exam scanner camera if leaving exam-scanner tab
    if (tabName !== 'exam-scanner') {
        stopExamScannerCamera();
    } else {
        startExamScannerCamera();
    }

    // Load data from API endpoints when entering respective list tabs
    if (tabName === 'registered-students') {
        fetchExamStudents();
    } else if (tabName === 'exam-reports') {
        fetchExamReports();
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
    csvContent += "Member ID,Full Name,Role,Scan Date,Scan Time,Shift,Status\r\n";
    
    state.logs.forEach(log => {
        // Clean names to prevent CSV corruption
        const cleanName = log.name.replace(/"/g, '""');
        const cleanShift = (log.shift || "").replace(/"/g, '""');
        csvContent += `"${log.id}","${cleanName}","${log.role}","${log.date}","${log.time}","${cleanShift}","${log.status}"\r\n`;
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
    const btnScan = document.getElementById('btn-scan-now');
    if (btnScan) btnScan.addEventListener('click', () => switchTab('scanner'));
    const btnAdd = document.getElementById('btn-add-now');
    if (btnAdd) btnAdd.addEventListener('click', () => switchTab('registration'));
    const btnReset = document.getElementById('btn-reset-db');
    if (btnReset) btnReset.addEventListener('click', resetAllData);
    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) btnExport.addEventListener('click', exportLogsToCSV);

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

    // Add Daily Shift Event Listener
    const addShiftBtn = document.getElementById('btn-add-shift');
    if (addShiftBtn) {
        addShiftBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('new-shift-name');
            const timeInput = document.getElementById('new-shift-time');
            const name = nameInput.value.trim();
            const time = timeInput.value;
            
            if (!name || !time) {
                alert('Please enter a shift name and time.');
                return;
            }
            
            // Check for duplicate names
            if (state.settings.shifts.some(s => s.name.toLowerCase() === name.toLowerCase())) {
                alert(`A shift named "${name}" already exists.`);
                return;
            }
            
            state.settings.shifts.push({ name, time });
            state.settings.shiftStart = state.settings.shifts[0].time; // backward compatibility
            
            saveDatabase();
            renderShiftsList();
            updateDashboardUI();
            
            // Clear inputs
            nameInput.value = '';
            timeInput.value = '09:00';
            playSound('success');
        });
    }

    // Delete Daily Shift Event Listener via delegation
    const shiftsContainer = document.getElementById('shifts-list-container');
    if (shiftsContainer) {
        shiftsContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-shift');
            if (deleteBtn) {
                const index = parseInt(deleteBtn.getAttribute('data-index'));
                
                if (state.settings.shifts.length <= 1) {
                    alert('You must maintain at least one work shift.');
                    return;
                }
                
                if (confirm(`Are you sure you want to delete the shift "${state.settings.shifts[index].name}"?`)) {
                    state.settings.shifts.splice(index, 1);
                    state.settings.shiftStart = state.settings.shifts[0].time; // backward compatibility
                    
                    saveDatabase();
                    renderShiftsList();
                    updateDashboardUI();
                    playSound('click');
                }
            }
        });
    }

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
    const importBtn = document.getElementById('btn-import-profiles-trigger');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }
    if (fileInput) {
        fileInput.addEventListener('change', importDatabaseJSON);
    }

    // Settings Match Threshold Slider Sync
    const settingsThreshold = document.getElementById('settings-threshold-slider');
    if (settingsThreshold) {
        settingsThreshold.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state.settings.threshold = val;
            
            // Sync scanner tab slider
            const scannerThreshold = document.getElementById('threshold-slider');
            if (scannerThreshold) {
                scannerThreshold.value = val;
            }
            
            // Update value text labels
            const settingsVal = document.getElementById('settings-threshold-val');
            if (settingsVal) settingsVal.textContent = val.toFixed(2);
            
            const scannerVal = document.getElementById('threshold-val');
            if (scannerVal) scannerVal.textContent = val.toFixed(2);
            
            saveDatabase();
        });
    }

    // Settings Detection Model Radio Sync
    document.querySelectorAll('input[name="settings-detection-model"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            state.settings.detectionModel = val;
            
            // Sync scanner tab radio buttons
            const scannerRadio = document.querySelector(`input[name="detection-model"][value="${val}"]`);
            if (scannerRadio) scannerRadio.checked = true;
            
            saveDatabase();
            updateSystemStateUI();
        });
    });

    // Settings Database Reset Button
    const settingsBtnReset = document.getElementById('settings-btn-reset-db');
    if (settingsBtnReset) {
        settingsBtnReset.addEventListener('click', resetAllData);
    }

    // Bind settings left sidebar tabs
    bindSettingsTabs();

    // 8. Log Table Live Search & Shift filters
    const logSearchInput = document.getElementById('log-search');
    const logShiftFilter = document.getElementById('log-shift-filter');
    
    const updateLogsTableFilter = () => {
        const searchVal = logSearchInput ? logSearchInput.value : '';
        const shiftVal = logShiftFilter ? logShiftFilter.value : '';
        renderLogsTable(searchVal, shiftVal);
    };

    if (logSearchInput) {
        logSearchInput.addEventListener('input', updateLogsTableFilter);
    }
    if (logShiftFilter) {
        logShiftFilter.addEventListener('change', updateLogsTableFilter);
    }

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

// ----------------------------------------------------
// GLOBAL KEYBOARD NAVIGATION FOR FORMS
// ----------------------------------------------------
function initGlobalFormNavigation() {
    document.addEventListener('keydown', (event) => {
        // We only care about Enter key
        if (event.key !== 'Enter') return;

        const target = event.target;
        // Check if the target is an input control
        const isInputControl = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';
        if (!isInputControl) return;

        // Find the parent form
        const form = target.closest('form');
        if (!form) return;

        // If it's a textarea, standard Enter should add newlines, unless Ctrl+Enter is pressed.
        if (target.tagName === 'TEXTAREA') {
            if (!event.ctrlKey) {
                // Let the textarea behave normally
                return;
            }
        }

        // Get all potential navigable controls in this form
        const allElements = Array.from(form.elements);
        
        // Filter to only include interactive, visible form controls
        const navigableFields = allElements.filter(el => {
            // Must be input, select, textarea
            const tagName = el.tagName;
            if (tagName !== 'INPUT' && tagName !== 'SELECT' && tagName !== 'TEXTAREA') {
                return false;
            }

            // Exclude hidden inputs
            if (el.type === 'hidden') return false;

            // Exclude buttons (some inputs can be submit/button/reset/image/checkbox/radio in navigation context, but let's allow checkboxes and radios to be traversed)
            if (el.type === 'submit' || el.type === 'button' || el.type === 'reset' || el.type === 'image') {
                return false;
            }

            // Skip disabled and read-only
            if (el.disabled || el.readOnly) return false;

            // Skip visually hidden fields
            const isVisible = el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
            if (!isVisible) return false;

            // Check style display/visibility
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }

            return true;
        });

        // Find index of current target
        const currentIndex = navigableFields.indexOf(target);
        if (currentIndex === -1) return;

        // Prevent default form submission or normal Enter behavior
        event.preventDefault();

        // If it is not the last navigable field, focus the next one
        if (currentIndex < navigableFields.length - 1) {
            const nextField = navigableFields[currentIndex + 1];
            nextField.focus();
            if (typeof nextField.select === 'function') {
                nextField.select();
            }
        } else {
            // It is the last field. Validate the form.
            if (form.reportValidity()) {
                // Trigger the primary action of the form.
                triggerPrimaryAction(form);
            }
        }
    });
}

function triggerPrimaryAction(form) {
    // 1. Try to find a submit button inside the form
    let submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    
    // 2. Try to find any button inside the form (which defaults to type="submit" in HTML forms)
    if (!submitBtn) {
        submitBtn = form.querySelector('button');
    }
    
    // 3. Try to find an external submit button linked to this form via the 'form' attribute
    if (!submitBtn && form.id) {
        submitBtn = document.querySelector(`button[form="${form.id}"], input[form="${form.id}"]`);
    }

    // 4. Try to find the primary action button associated with this form container/card/tab
    if (!submitBtn) {
        // Search inside the closest parent section/layout/tab or card
        const containers = ['.registration-layout', '.registration-capture-card', '.card', '.tab-content'];
        for (const selector of containers) {
            const parent = form.closest(selector);
            if (parent) {
                // Look for btn-primary or primary buttons
                submitBtn = parent.querySelector('.btn-primary, .btn-submit, [id*="enroll"], [id*="submit"], [id*="save"]');
                if (submitBtn) break;
            }
        }
    }

    // 5. If we found a button, trigger its click
    if (submitBtn) {
        submitBtn.click();
    } else {
        // Fallback: request standard form submission if no button is found
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
        } else {
            form.submit();
        }
    }
}

// ----------------------------------------------------
// SETTINGS DIAGNOSTICS & SIDEBAR TAB BINDINGS
// ----------------------------------------------------
function bindSettingsTabs() {
    const tabButtons = document.querySelectorAll('.settings-nav-item');
    const panels = document.querySelectorAll('.settings-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-settings-tab');
            
            // Deactivate all buttons and panels
            tabButtons.forEach(btn => btn.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            
            // Activate selected
            button.classList.add('active');
            const targetPanel = document.getElementById(`settings-panel-${targetTab}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
            
            // If diagnostic panel is loaded, update diagnostics metrics
            if (targetTab === 'diagnostics') {
                updateDiagnosticsUI();
            }
        });
    });
}

function getLocalStorageSize() {
    let totalBytes = 0;
    const keys = ['parascan_users', 'parascan_settings', 'parascan_logs'];
    keys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) {
            totalBytes += val.length * 2; // UTF-16 characters take 2 bytes
        }
    });
    
    if (totalBytes < 1024) {
        return totalBytes + " Bytes";
    } else if (totalBytes < 1024 * 1024) {
        return (totalBytes / 1024).toFixed(2) + " KB";
    } else {
        return (totalBytes / (1024 * 1024)).toFixed(2) + " MB";
    }
}

function getLocalStoragePercentage() {
    let totalBytes = 0;
    const keys = ['parascan_users', 'parascan_settings', 'parascan_logs'];
    keys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) {
            totalBytes += val.length * 2;
        }
    });
    const limit = 5242880; // 5MB standard limit
    return Math.min((totalBytes / limit) * 100, 100);
}

function getBrowserPlatform() {
    const ua = navigator.userAgent;
    let browser = "Unknown Browser";
    let os = "Unknown OS";
    
    if (ua.indexOf("Win") !== -1) os = "Windows";
    else if (ua.indexOf("Mac") !== -1) os = "macOS";
    else if (ua.indexOf("Linux") !== -1) os = "Linux";
    else if (ua.indexOf("Android") !== -1) os = "Android";
    else if (ua.indexOf("like Mac") !== -1) os = "iOS";
    
    if (ua.indexOf("Firefox") !== -1) browser = "Mozilla Firefox";
    else if (ua.indexOf("SamsungBrowser") !== -1) browser = "Samsung Internet";
    else if (ua.indexOf("Opera") !== -1 || ua.indexOf("OPR") !== -1) browser = "Opera";
    else if (ua.indexOf("Trident") !== -1) browser = "Internet Explorer";
    else if (ua.indexOf("Edge") !== -1 || ua.indexOf("Edg") !== -1) browser = "Microsoft Edge";
    else if (ua.indexOf("Chrome") !== -1) browser = "Google Chrome";
    else if (ua.indexOf("Safari") !== -1) browser = "Apple Safari";
    
    return `${browser} on ${os}`;
}

function updateDiagnosticsUI() {
    // 1. Models Status
    const ssdBadge = document.getElementById('diag-model-ssd');
    const tinyBadge = document.getElementById('diag-model-tiny');
    const landmarkBadge = document.getElementById('diag-model-landmark');
    const recognitionBadge = document.getElementById('diag-model-recognition');
    
    const isLoaded = state.modelsLoaded;
    const statusText = isLoaded ? 'Active' : 'Pending...';
    const badgeClass = isLoaded ? 'status-badge-new loaded' : 'status-badge-new loading';
    
    if (ssdBadge) {
        ssdBadge.textContent = statusText;
        ssdBadge.className = badgeClass;
    }
    if (tinyBadge) {
        tinyBadge.textContent = statusText;
        tinyBadge.className = badgeClass;
    }
    if (landmarkBadge) {
        landmarkBadge.textContent = statusText;
        landmarkBadge.className = badgeClass;
    }
    if (recognitionBadge) {
        recognitionBadge.textContent = statusText;
        recognitionBadge.className = badgeClass;
    }
    
    // 2. Database Metrics
    const countEl = document.getElementById('diag-metric-count');
    if (countEl) countEl.textContent = state.users.length;
    
    const sizeEl = document.getElementById('diag-metric-size');
    if (sizeEl) sizeEl.textContent = getLocalStorageSize();
    
    const percentEl = document.getElementById('diag-metric-percent');
    const fillEl = document.getElementById('diag-metric-fill');
    
    const percent = getLocalStoragePercentage();
    if (percentEl) percentEl.textContent = `${percent.toFixed(2)}% used`;
    if (fillEl) fillEl.style.width = `${percent.toFixed(2)}%`;
    
    // 3. Platform info
    const platformEl = document.getElementById('diag-info-platform');
    if (platformEl) platformEl.textContent = getBrowserPlatform();
}

// On Page Load
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize clock values
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('current-date').textContent = formatDate(now);
    
    // 2. Set event listeners
    bindEvents();
    initGlobalFormNavigation();
    initExamSystem(); // Initialize the new exam modules
    applyGlobalTitleCase();
    initGlobalInputTitleCase();
    
    // 3. Load database from LocalStorage
    loadDatabase();
    
    // 4. Initialize face-api
    await initFaceAPI();
});

// ============================================================================
// EXAM MODE MODULES (OCR, HALL TICKETS, STUDENT DATABASE & SCANNERS)
// ============================================================================

// State additions for Exam Mode
state.examStudents = [];
state.examScannerStream = null;
state.examScannerLoopId = null;
state.examScannerFacingMode = 'user';
state.socket = null;
state.currentExtractedFaceDescriptor = null;
state.currentExtractedFaceBase64 = '';
state.loggedExamAttendanceIds = new Set(); // Prevent duplicate scan submits locally

function initExamSystem() {
    // 1. Initialize Socket.IO connection
    try {
        state.socket = io();
        state.socket.on('connect', () => {
            console.log('Real-time Socket.IO link established.');
        });
        state.socket.on('new-attendance', (data) => {
            addExamCheckInToFeed(data);
        });
    } catch (e) {
        console.warn('Socket.IO connection failed. Real-time log sync will fall back to polling.', e);
    }

    // 2. Configure PDF.js Worker
    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // 3. Bind Hall Ticket Drag-and-Drop Dropzone Listeners
    const dropzone = document.getElementById('ticket-dropzone');
    const fileInput = document.getElementById('ticket-file-input');
    const browseLink = document.getElementById('browse-ticket-link');

    if (dropzone && fileInput) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                processUploadedTicket(files[0]);
            }
        });
        
        // Clicking anywhere in the purple dotted box triggers file browser
        dropzone.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    if (browseLink && fileInput) {
        browseLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Avoid double click bubble trigger on dropzone
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                processUploadedTicket(files[0]);
            }
        });
    }

    // 4. Bind Manual Passport Photo Upload Trigger
    const btnBrowsePhoto = document.getElementById('btn-browse-manual-photo');
    const manualPhotoInput = document.getElementById('manual-photo-input');
    if (btnBrowsePhoto && manualPhotoInput) {
        btnBrowsePhoto.addEventListener('click', () => {
            manualPhotoInput.click();
        });
        manualPhotoInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                processManualPhoto(files[0]);
            }
        });
    }

    // 5. Bind Verify Form Submit
    const btnRegister = document.getElementById('btn-register-student');
    if (btnRegister) {
        btnRegister.addEventListener('click', registerStudent);
    }

    // 6. Bind Registered Students Page Listeners
    const searchStudent = document.getElementById('student-search');
    const courseFilter = document.getElementById('student-course-filter');
    const semFilter = document.getElementById('student-sem-filter');

    const updateStudentFilter = () => {
        fetchExamStudents(
            searchStudent ? searchStudent.value : '',
            courseFilter ? courseFilter.value : '',
            semFilter ? semFilter.value : ''
        );
    };

    if (searchStudent) searchStudent.addEventListener('input', updateStudentFilter);
    if (courseFilter) courseFilter.addEventListener('change', updateStudentFilter);
    if (semFilter) semFilter.addEventListener('change', updateStudentFilter);

    // 7. Bind Edit Student Form Submit & Modal Close
    const btnCloseModal = document.getElementById('btn-close-edit-student-modal');
    const modalOverlay = document.getElementById('edit-student-modal-overlay');
    const editForm = document.getElementById('edit-student-form');

    const closeModal = () => {
        document.getElementById('edit-student-modal').classList.add('hidden');
    };

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveEditedStudent();
        });
    }

    // 8. Bind Exam Scanner Buttons
    const btnScannerOn = document.getElementById('btn-exam-scanner-on');
    const btnScannerOnPlaceholder = document.getElementById('btn-exam-scanner-on-placeholder');
    const btnScannerOff = document.getElementById('btn-exam-scanner-off');
    const btnScannerFlip = document.getElementById('btn-exam-scanner-flip');

    if (btnScannerOn) btnScannerOn.addEventListener('click', startExamScannerCamera);
    if (btnScannerOnPlaceholder) btnScannerOnPlaceholder.addEventListener('click', startExamScannerCamera);
    if (btnScannerOff) btnScannerOff.addEventListener('click', stopExamScannerCamera);
    if (btnScannerFlip) {
        btnScannerFlip.addEventListener('click', () => {
            state.examScannerFacingMode = state.examScannerFacingMode === 'user' ? 'environment' : 'user';
            if (state.examScannerStream) {
                stopExamScannerCamera();
                startExamScannerCamera();
            }
        });
    }

    // 9. Bind Exam Reports Page Filters & Export
    const searchReport = document.getElementById('report-search');
    const reportCourseFilter = document.getElementById('report-course-filter');
    const reportSemFilter = document.getElementById('report-sem-filter');
    const btnExportReports = document.getElementById('btn-export-reports');

    const updateReportFilter = () => {
        fetchExamReports(
            searchReport ? searchReport.value : '',
            reportCourseFilter ? reportCourseFilter.value : '',
            reportSemFilter ? reportSemFilter.value : ''
        );
    };

    if (searchReport) searchReport.addEventListener('input', updateReportFilter);
    if (reportCourseFilter) reportCourseFilter.addEventListener('change', reportReportFilters);
    if (reportSemFilter) reportSemFilter.addEventListener('change', reportReportFilters);
    if (btnExportReports) btnExportReports.addEventListener('click', exportReportsToCSV);
    initClockPicker(); // Initialize interactive clock face time picker
}

function reportReportFilters() {
    const searchReport = document.getElementById('report-search');
    const reportCourseFilter = document.getElementById('report-course-filter');
    const reportSemFilter = document.getElementById('report-sem-filter');
    fetchExamReports(
        searchReport ? searchReport.value : '',
        reportCourseFilter ? reportCourseFilter.value : '',
        reportSemFilter ? reportSemFilter.value : ''
    );
}

// ----------------------------------------------------
// OCR TEXT & BIOMETRICS EXTRACTION PIPELINE
// ----------------------------------------------------

function processUploadedTicket(file) {
    if (!file) return;

    // Reset UI State
    document.getElementById('ticket-progress-container').classList.remove('hidden');
    document.getElementById('ocr-progress-bar').style.width = '0%';
    document.getElementById('ocr-percentage').textContent = '0%';
    document.getElementById('face-progress-bar').style.width = '0%';
    document.getElementById('face-status').textContent = 'Pending...';
    
    document.getElementById('step-ocr').className = 'progress-step-item';
    document.getElementById('step-face').className = 'progress-step-item';
    document.getElementById('face-preview-card').classList.add('hidden');
    document.getElementById('face-failure-alert').classList.add('hidden');
    document.getElementById('btn-register-student').disabled = true;
    
    state.currentExtractedFaceBase64 = '';
    state.currentExtractedFaceDescriptor = null;

    const fileReader = new FileReader();

    if (file.type === 'application/pdf') {
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument({ data: typedarray }).promise.then(pdf => {
                // Fetch page 1
                pdf.getPage(1).then(page => {
                    const canvas = document.createElement('canvas');
                    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for high resolution OCR & crop
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    
                    const renderContext = {
                        canvasContext: ctx,
                        viewport: viewport
                    };
                    page.render(renderContext).promise.then(() => {
                        // Document page is rendered on canvas, run text and face extractions
                        runOCR(canvas);
                        runFaceDetectionAndCrop(canvas);
                    });
                });
            }).catch(err => {
                console.error("PDF Parsing error:", err);
                alert("Failed to render PDF document. Make sure it is not password protected.");
            });
        };
        fileReader.readAsArrayBuffer(file);
    } else if (file.type.startsWith('image/')) {
        fileReader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Run pipeline
                runOCR(canvas);
                runFaceDetectionAndCrop(canvas);
            };
            img.src = event.target.result;
        };
        fileReader.readAsDataURL(file);
    } else {
        alert('Unsupported file format. Please upload a PDF file or an image.');
    }
}

// Client Side OCR Engine
function runOCR(canvas) {
    if (!window.Tesseract) {
        alert('OCR Engine (Tesseract) CDN is not loaded.');
        return;
    }

    Tesseract.recognize(
        canvas,
        'eng',
        {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round(m.progress * 100);
                    document.getElementById('ocr-progress-bar').style.width = `${pct}%`;
                    document.getElementById('ocr-percentage').textContent = `${pct}%`;
                }
            }
        }
    ).then(({ data: { text } }) => {
        document.getElementById('ocr-progress-bar').style.width = '100%';
        document.getElementById('ocr-percentage').textContent = '100%';
        document.getElementById('step-ocr').classList.add('success');
        
        console.log("OCR Extracted Text:\n", text);
        
        // Parse metadata using regex heuristics
        const details = extractStudentDetails(text);
        fillVerifyForm(details);
    }).catch(err => {
        console.error("OCR Execution failed:", err);
        document.getElementById('ocr-percentage').textContent = 'Failed';
    });
}

// Face Detection and Cropping Engine
function runFaceDetectionAndCrop(canvas) {
    if (!state.modelsLoaded) {
        alert('Face recognition models are still loading. Please wait.');
        return;
    }

    document.getElementById('face-status').textContent = 'Detecting...';
    document.getElementById('face-progress-bar').style.width = '50%';

    // Run high confidence SSD detector on high res canvas
    faceapi.detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
        .then(detection => {
            if (detection) {
                document.getElementById('face-progress-bar').style.width = '100%';
                document.getElementById('face-status').textContent = 'Success';
                document.getElementById('step-face').classList.add('success');

                // Compute crop coordinates with passport photo padding
                const { x, y, width, height } = detection.detection.box;
                const padding = Math.min(width, height) * 0.35; // 35% margin padding
                
                const cx = Math.max(0, x - padding);
                const cy = Math.max(0, y - padding * 1.2); // Squeeze up slightly
                const cw = Math.min(canvas.width - cx, width + padding * 2);
                const ch = Math.min(canvas.height - cy, height + padding * 2.5);

                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cw;
                cropCanvas.height = ch;
                const cctx = cropCanvas.getContext('2d');
                cctx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);

                const faceBase64 = cropCanvas.toDataURL('image/jpeg', 0.90);
                state.currentExtractedFaceBase64 = faceBase64;
                state.currentExtractedFaceDescriptor = Array.from(detection.descriptor);

                // Show Preview UI
                document.getElementById('extracted-face-img').src = faceBase64;
                document.getElementById('face-preview-card').classList.remove('hidden');
                document.getElementById('face-failure-alert').classList.add('hidden');

                // Toggle Register button if form validity passes
                checkVerifyFormValidation();
            } else {
                throw new Error("No clear face found in hall ticket.");
            }
        })
        .catch(err => {
            console.warn("Face Extraction Failed:", err.message);
            document.getElementById('face-progress-bar').style.width = '0%';
            document.getElementById('face-status').textContent = 'Failed';
            
            document.getElementById('face-preview-card').classList.add('hidden');
            document.getElementById('face-failure-alert').classList.remove('hidden');
            document.getElementById('btn-register-student').disabled = true;
        });
}

// Passport Photo Manual Fallback Upload
function processManualPhoto(file) {
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Run detection on manually uploaded photo
            document.getElementById('face-failure-alert').classList.add('hidden');
            document.getElementById('ticket-progress-container').classList.remove('hidden');
            document.getElementById('face-status').textContent = 'Detecting...';
            document.getElementById('face-progress-bar').style.width = '60%';

            faceapi.detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor()
                .then(detection => {
                    if (detection) {
                        document.getElementById('face-progress-bar').style.width = '100%';
                        document.getElementById('face-status').textContent = 'Success';
                        document.getElementById('step-face').classList.add('success');

                        const faceBase64 = canvas.toDataURL('image/jpeg', 0.90);
                        state.currentExtractedFaceBase64 = faceBase64;
                        state.currentExtractedFaceDescriptor = Array.from(detection.descriptor);

                        document.getElementById('extracted-face-img').src = faceBase64;
                        document.getElementById('face-preview-card').classList.remove('hidden');
                        
                        checkVerifyFormValidation();
                        playSound('success');
                    } else {
                        alert('Face could not be detected from the passport photograph. Please upload a clear portrait photo.');
                        document.getElementById('face-failure-alert').classList.remove('hidden');
                    }
                })
                .catch(err => {
                    console.error("Manual face detection error:", err);
                    alert("Face detection crashed. Try a smaller/clearer picture.");
                });
        };
        img.src = event.target.result;
    };
    fileReader.readAsDataURL(file);
}

// Regex text heuristic parses
function extractStudentDetails(text) {
    const details = {
        name: '',
        rollNumber: '',
        hallTicketNumber: '',
        registrationNumber: '',
        course: '',
        branch: '',
        semester: '',
        subjectCodes: '',
        examDate: '',
        examTime: '',
        examCenter: '',
        collegeName: ''
    };

    // Normalize OCR text
    const cleanText = text.replace(/\r?\n|\r/g, '\n');

    // Roll Number Matcher
    const rollMatches = [
        /roll\s*(?:no|number)?\s*[:\-\s]+([a-z0-9\-]+)/i,
        /roll\s*(?:no|number)\s*[:\-\s]*\s*([a-z0-9\-]+)/i,
        /id\s*(?:no|number)?\s*[:\-\s]+([a-z0-9\-]+)/i
    ];
    for (const r of rollMatches) {
        const m = cleanText.match(r);
        if (m) {
            details.rollNumber = m[1].trim();
            break;
        }
    }

    // Name Matcher
    const nameMatches = [
        /name\s*[:\-\s]+([a-z\s]+)/i,
        /candidate\s*(?:name)?\s*[:\-\s]+([a-z\s]+)/i,
        /student\s*(?:name)?\s*[:\-\s]+([a-z\s]+)/i
    ];
    for (const r of nameMatches) {
        const m = cleanText.match(r);
        if (m) {
            const nameCandidate = m[1].trim().replace(/\n/g, ' ');
            // Validate name doesn't contain field keywords
            if (nameCandidate.length > 2 && !/roll|hall|reg|semester|course|exam/i.test(nameCandidate)) {
                details.name = nameCandidate;
                break;
            }
        }
    }

    // Hall Ticket Number
    const htMatch = cleanText.match(/(?:hall\s*ticket|admission\s*card|ticket)\s*(?:no|number)?\s*[:\-\s]+([a-z0-9\-]+)/i);
    if (htMatch) details.hallTicketNumber = htMatch[1].trim();

    // Registration Number
    const regMatch = cleanText.match(/(?:registration|reg)\s*(?:no|number)?\s*[:\-\s]+([a-z0-9\-]+)/i);
    if (regMatch) details.registrationNumber = regMatch[1].trim();

    // Course
    const courseMatch = cleanText.match(/course\s*[:\-\s]+([a-z0-9\.\-\s]+)/i);
    if (courseMatch) details.course = courseMatch[1].trim();

    // Branch
    const branchMatch = cleanText.match(/(?:branch|discipline|specialization|dept)\s*[:\-\s]+([a-z\s]+)/i);
    if (branchMatch) details.branch = branchMatch[1].trim();

    // Semester
    const semMatch = cleanText.match(/(?:semester|sem|year)\s*[:\-\s]+([a-z0-9\s]+)/i);
    if (semMatch) details.semester = semMatch[1].trim();

    // Exam Date (matches formats e.g. 25/06/2026 or 2026-06-25)
    const dateMatch = cleanText.match(/(?:exam\s*)?date\s*[:\-\s]+([0-9\-\/]+)/i);
    if (dateMatch) details.examDate = dateMatch[1].trim();

    // Exam Time
    const timeMatch = cleanText.match(/(?:exam\s*)?time\s*[:\-\s]+([0-9\:\s]+(?:am|pm|a\.m\.|p\.m\.)?)/i);
    if (timeMatch) details.examTime = timeMatch[1].trim();

    // Exam Center
    const centerMatch = cleanText.match(/(?:exam\s*)?center\s*(?:name)?\s*[:\-\s]+([a-z0-9\s,\.\-]+)/i);
    if (centerMatch) details.examCenter = centerMatch[1].trim().replace(/\n/g, ' ');

    // College Name
    const collegeMatch = cleanText.match(/(?:college|institution|school)\s*(?:name)?\s*[:\-\s]+([a-z0-9\s,\.\-]+)/i);
    if (collegeMatch) details.collegeName = collegeMatch[1].trim().replace(/\n/g, ' ');

    // Subject codes
    const subjectsMatch = cleanText.match(/(?:subject\s*codes|subjects|papers|courses)\s*[:\-\s]+([a-z0-9\s,\-\/]+)/i);
    if (subjectsMatch) details.subjectCodes = subjectsMatch[1].trim().replace(/\n/g, ' ');

    return details;
}

function fillVerifyForm(details) {
    document.getElementById('student-name').value = details.name;
    document.getElementById('student-roll').value = details.rollNumber;
    document.getElementById('student-hall-no').value = details.hallTicketNumber;
    document.getElementById('student-reg-no').value = details.registrationNumber;
    document.getElementById('student-course').value = details.course;
    document.getElementById('student-branch').value = details.branch;
    document.getElementById('student-semester').value = details.semester;
    document.getElementById('student-subjects').value = details.subjectCodes;
    document.getElementById('student-exam-date').value = details.examDate;
    document.getElementById('student-exam-time').value = details.examTime;
    document.getElementById('student-exam-center').value = details.examCenter;
    document.getElementById('student-college').value = details.collegeName;

    checkVerifyFormValidation();
}

function checkVerifyFormValidation() {
    const name = document.getElementById('student-name').value.trim();
    const roll = document.getElementById('student-roll').value.trim();
    const hallNo = document.getElementById('student-hall-no').value.trim();
    
    const hasDescriptor = state.currentExtractedFaceDescriptor !== null;
    const isValid = name && roll && hallNo && hasDescriptor;

    document.getElementById('btn-register-student').disabled = !isValid;
}

// Enable live listener triggers on manual form changes
['student-name', 'student-roll', 'student-hall-no'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', checkVerifyFormValidation);
    }
});

// ----------------------------------------------------
// REST CRUD STUDENT ENDPOINTS CALLS
// ----------------------------------------------------

async function registerStudent() {
    const btn = document.getElementById('btn-register-student');
    btn.disabled = true;

    const subjectsRaw = document.getElementById('student-subjects').value.trim();
    const subjectCodes = subjectsRaw ? subjectsRaw.split(',').map(s => s.trim()) : [];

    const studentData = {
        name: document.getElementById('student-name').value.trim(),
        rollNumber: document.getElementById('student-roll').value.trim(),
        hallTicketNumber: document.getElementById('student-hall-no').value.trim(),
        registrationNumber: document.getElementById('student-reg-no').value.trim(),
        course: document.getElementById('student-course').value.trim(),
        branch: document.getElementById('student-branch').value.trim(),
        semester: document.getElementById('student-semester').value.trim(),
        subjectCodes: subjectCodes,
        examDate: document.getElementById('student-exam-date').value.trim(),
        examTime: document.getElementById('student-exam-time').value.trim(),
        examCenter: document.getElementById('student-exam-center').value.trim(),
        collegeName: document.getElementById('student-college').value.trim(),
        photo: state.currentExtractedFaceBase64,
        descriptor: state.currentExtractedFaceDescriptor
    };

    try {
        const response = await fetch('/api/exam-students', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(studentData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Server error saving student.');
        }

        alert(`Registration Success!\nStudent "${studentData.name}" has been enrolled using hall ticket photo.`);
        
        // Reset verify UI
        document.getElementById('student-verify-form').reset();
        document.getElementById('ticket-progress-container').classList.add('hidden');
        document.getElementById('face-preview-card').classList.add('hidden');
        state.currentExtractedFaceBase64 = '';
        state.currentExtractedFaceDescriptor = null;
        
        playSound('success');
    } catch (e) {
        console.error("Save Student Error:", e);
        alert(`Registration Failed: ${e.message}`);
        btn.disabled = false;
    }
}

async function fetchExamStudents(search = '', course = '', semester = '') {
    const tbody = document.getElementById('student-list-tbody');
    if (!tbody) return;

    try {
        let url = `/api/exam-students?search=${encodeURIComponent(search)}`;
        if (course) url += `&course=${encodeURIComponent(course)}`;
        if (semester) url += `&semester=${encodeURIComponent(semester)}`;

        const response = await fetch(url);
        const students = await response.json();
        
        // Save to global state for biometric scanner matching
        state.examStudents = students;

        tbody.innerHTML = '';
        
        // Dynamic filter options builder
        const courseFilter = document.getElementById('student-course-filter');
        const semFilter = document.getElementById('student-sem-filter');
        const reportCourseFilter = document.getElementById('report-course-filter');
        const reportSemFilter = document.getElementById('report-sem-filter');
        
        const courses = new Set();
        const semesters = new Set();

        if (students.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8">No registered students found.</td>
                </tr>
            `;
            return;
        }

        students.forEach(student => {
            if (student.course) courses.add(student.course);
            if (student.semester) semesters.add(student.semester);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="width: 42px; height: 42px; border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-main); border: 1px solid var(--border-color);">
                        <img src="${student.photo || 'https://via.placeholder.com/150'}" style="width: 100%; height: 100%; object-fit: cover;" alt="${toTitleCase(student.name)}">
                    </div>
                </td>
                <td><strong>${toTitleCase(student.name)}</strong></td>
                <td><code>${student.rollNumber}</code></td>
                <td>${student.hallTicketNumber}</td>
                <td>${student.course ? toTitleCase(student.course) : '-'} (${student.semester ? toTitleCase(student.semester) : '-'})</td>
                <td><span class="status-tag present">Registered</span></td>
                <td><span class="status-tag present" style="background-color: var(--primary-glow); color: var(--primary);">Embedding Ready</span></td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="openEditStudentModal('${student._id}')" style="padding: 6px 10px;">Edit</button>
                        <button class="btn btn-secondary btn-sm" onclick="deleteStudent('${student._id}')" style="padding: 6px 10px; color: var(--danger); hover:background: var(--danger-glow);">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Populate options in dropdowns if empty (only first load)
        if (courseFilter && courseFilter.options.length <= 1) {
            courses.forEach(c => {
                const opt = new Option(c, c);
                courseFilter.add(opt);
                if (reportCourseFilter) reportCourseFilter.add(opt.cloneNode(true));
            });
        }
        if (semFilter && semFilter.options.length <= 1) {
            semesters.forEach(s => {
                const opt = new Option(s, s);
                semFilter.add(opt);
                if (reportSemFilter) reportSemFilter.add(opt.cloneNode(true));
            });
        }

    } catch (e) {
        console.error("Fetch Students Error:", e);
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8" style="color: var(--danger);">Error loading student data from MongoDB server.</td></tr>`;
    }
}

// Window scoped triggers for table action buttons
window.openEditStudentModal = async function(id) {
    try {
        const student = state.examStudents.find(s => s._id === id);
        if (!student) return;

        document.getElementById('edit-student-id').value = student._id;
        document.getElementById('edit-student-name').value = student.name;
        document.getElementById('edit-student-roll').value = student.rollNumber;
        document.getElementById('edit-student-hall-no').value = student.hallTicketNumber;
        document.getElementById('edit-student-reg-no').value = student.registrationNumber || '';
        document.getElementById('edit-student-course').value = student.course || '';
        document.getElementById('edit-student-branch').value = student.branch || '';
        document.getElementById('edit-student-semester').value = student.semester || '';
        document.getElementById('edit-student-subjects').value = student.subjectCodes ? student.subjectCodes.join(', ') : '';
        document.getElementById('edit-student-exam-date').value = student.examDate || '';
        document.getElementById('edit-student-exam-time').value = student.examTime || '';
        document.getElementById('edit-student-exam-center').value = student.examCenter || '';
        document.getElementById('edit-student-college').value = student.collegeName || '';

        // Display Modal
        document.getElementById('edit-student-modal').classList.remove('hidden');
    } catch (e) {
        alert("Failed to read student details.");
    }
};

async function saveEditedStudent() {
    const id = document.getElementById('edit-student-id').value;
    const subjectsRaw = document.getElementById('edit-student-subjects').value.trim();
    const subjectCodes = subjectsRaw ? subjectsRaw.split(',').map(s => s.trim()) : [];

    const studentData = {
        name: document.getElementById('edit-student-name').value.trim(),
        rollNumber: document.getElementById('edit-student-roll').value.trim(),
        hallTicketNumber: document.getElementById('edit-student-hall-no').value.trim(),
        registrationNumber: document.getElementById('edit-student-reg-no').value.trim(),
        course: document.getElementById('edit-student-course').value.trim(),
        branch: document.getElementById('edit-student-branch').value.trim(),
        semester: document.getElementById('edit-student-semester').value.trim(),
        subjectCodes: subjectCodes,
        examDate: document.getElementById('edit-student-exam-date').value.trim(),
        examTime: document.getElementById('edit-student-exam-time').value.trim(),
        examCenter: document.getElementById('edit-student-exam-center').value.trim(),
        collegeName: document.getElementById('edit-student-college').value.trim()
    };

    try {
        const response = await fetch(`/api/exam-students/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(studentData)
        });

        if (!response.ok) {
            throw new Error('Server returned error status on PUT.');
        }

        document.getElementById('edit-student-modal').classList.add('hidden');
        
        // Refresh Table
        const searchStudent = document.getElementById('student-search');
        fetchExamStudents(searchStudent ? searchStudent.value : '');
        playSound('success');
    } catch (e) {
        alert(`Update Failed: ${e.message}`);
    }
}

window.deleteStudent = async function(id) {
    if (!confirm('Are you sure you want to delete this student profile?\nAll their associated exam check-in records will be wiped from MongoDB.')) {
        return;
    }

    try {
        const response = await fetch(`/api/exam-students/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete student.');
        }

        // Refresh List
        const searchStudent = document.getElementById('student-search');
        fetchExamStudents(searchStudent ? searchStudent.value : '');
        playSound('click');
    } catch (e) {
        alert(`Delete Failed: ${e.message}`);
    }
};

// ----------------------------------------------------
// EXAM SCANNER ENGINE (BIOMETRICS VERIFICATION)
// ----------------------------------------------------

async function startExamScannerCamera() {
    const video = document.getElementById('exam-scanner-video');
    const placeholder = document.getElementById('exam-scanner-placeholder');
    const overlay = document.getElementById('exam-scanner-overlay');
    const btnOn = document.getElementById('btn-exam-scanner-on');
    const btnOff = document.getElementById('btn-exam-scanner-off');

    try {
        // Query registered student database on starting camera
        await fetchExamStudents();

        const stream = await startWebcam(video, 'examScannerStream');
        state.examScannerStream = stream;
        
        placeholder.classList.add('hidden');
        overlay.classList.remove('hidden');
        const hud = document.getElementById('exam-scanner-hud');
        if (hud) hud.classList.remove('hidden');
        btnOn.disabled = true;
        btnOff.disabled = false;

        document.getElementById('exam-scanner-status-banner').textContent = 'Camera active. Fetching descriptors...';
        
        // Run Scanner loop recursion
        if (!state.examScannerLoopId) {
            runExamScannerLoop();
        }
    } catch (err) {
        console.error("Camera scan start error:", err);
    }
}

function stopExamScannerCamera() {
    const video = document.getElementById('exam-scanner-video');
    const placeholder = document.getElementById('exam-scanner-placeholder');
    const overlay = document.getElementById('exam-scanner-overlay');
    const btnOn = document.getElementById('btn-exam-scanner-on');
    const btnOff = document.getElementById('btn-exam-scanner-off');

    if (state.examScannerLoopId) {
        cancelAnimationFrame(state.examScannerLoopId);
        state.examScannerLoopId = null;
    }

    stopWebcam(video, 'examScannerStream');

    placeholder.classList.remove('hidden');
    overlay.classList.add('hidden');
    const hud = document.getElementById('exam-scanner-hud');
    if (hud) hud.classList.add('hidden');
    btnOn.disabled = false;
    btnOff.disabled = true;

    // Clear overlay canvas
    if (overlay) {
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
    
    document.getElementById('exam-scanner-status-banner').textContent = 'Webcam stream deactivated.';
}

async function runExamScannerLoop() {
    const video = document.getElementById('exam-scanner-video');
    const canvas = document.getElementById('exam-scanner-overlay');
    const statusBanner = document.getElementById('exam-scanner-status-banner');

    if (!state.examScannerStream) {
        // Exit loop recursion if camera has been deactivated
        return;
    }

    if (video.paused || video.ended || !state.modelsLoaded) {
        state.examScannerLoopId = requestAnimationFrame(runExamScannerLoop);
        return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let detectorOptions = state.settings.detectionModel === 'ssd'
        ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
        : new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });

    try {
        const detections = await faceapi.detectAllFaces(video, detectorOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length > 0) {
            statusBanner.textContent = `Detections: ${detections.length} face(s) in frame`;
            statusBanner.style.color = '#34d399';

            const resizedDetections = faceapi.resizeResults(detections, {
                width: canvas.width,
                height: canvas.height
            });

            for (let i = 0; i < resizedDetections.length; i++) {
                const detection = resizedDetections[i];
                const descriptor = detection.descriptor;

                let minDistance = 999.0;
                let matchedStudent = null;

                // Compare live descriptor against DB exam student descriptors
                state.examStudents.forEach(student => {
                    if (student.descriptor) {
                        const dist = faceapi.euclideanDistance(descriptor, new Float32Array(student.descriptor));
                        if (dist < minDistance) {
                            minDistance = dist;
                            matchedStudent = student;
                        }
                    }
                });

                let isRecognized = false;
                let matchScore = 0;
                
                if (matchedStudent && minDistance <= state.settings.threshold) {
                    isRecognized = true;
                    matchScore = (1 - minDistance) * 100;
                    
                    // Trigger attendance check-in
                    triggerExamAttendance(matchedStudent);
                }

                // Render overlays
                const { x, y, width, height } = detection.detection.box;
                ctx.strokeStyle = isRecognized ? '#10b981' : '#8b5cf6';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);

                ctx.fillStyle = isRecognized ? 'rgba(16, 185, 129, 0.85)' : 'rgba(139, 92, 246, 0.85)';
                ctx.fillRect(x, y - 28, width, 28);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Inter, sans-serif';
                const label = isRecognized 
                    ? `${matchedStudent.name} (${matchScore.toFixed(0)}%)` 
                    : 'Student not recognized.';
                ctx.fillText(label, x + 8, y - 10);
            }
        } else {
            statusBanner.textContent = 'Active: Align face to scan...';
            statusBanner.style.color = 'var(--text-muted)';
        }
    } catch (err) {
        console.error("Scanner loop error:", err);
    }

    state.examScannerLoopId = requestAnimationFrame(runExamScannerLoop);
}

// Mark attendance and prevent double clicks
async function triggerExamAttendance(student) {
    // Check local session block to avoid duplicate API requests in scanner frame recursion
    if (state.loggedExamAttendanceIds.has(student._id)) {
        return;
    }
    state.loggedExamAttendanceIds.add(student._id);

    // Format current date matching today e.g. "30/06/2026"
    const today = new Date();
    const examDateStr = today.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    // Auto resolve paper code matching list
    const subjectCode = student.subjectCodes && student.subjectCodes.length > 0 
        ? student.subjectCodes[0] 
        : 'EXAM-GEN';

    try {
        const response = await fetch('/api/exam-attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentId: student._id,
                examDate: examDateStr,
                subjectCode: subjectCode
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            // Update Student Verification Panel HUD details
            updateExamStudentHUD(student, 'verified');
            showToast(student.name, `Attendance Marked Successfully (${subjectCode})`);
            playSound('success');
        } else {
            // Check if duplicate error
            if (response.status === 400) {
                updateExamStudentHUD(student, 'duplicate');
                showToast(student.name, `Attendance Already Logged!`);
            } else {
                throw new Error(data.error || 'Server error logging attendance.');
            }
        }
    } catch (e) {
        console.error("API error logging attendance:", e);
        // Clear local guard to allow retry on transient connection failures
        state.loggedExamAttendanceIds.delete(student._id);
    }
}

function updateExamStudentHUD(student, status) {
    const card = document.getElementById('student-hud-card');
    if (!card) return;

    if (status === 'verified' || status === 'duplicate') {
        const badgeColor = status === 'verified' ? 'var(--success)' : 'var(--danger)';
        const statusLabel = status === 'verified' ? 'PRESENT' : 'DUPLICATE LOG';

        card.innerHTML = `
            <div style="display: flex; gap: 16px; align-items: center;">
                <div style="width: 72px; height: 72px; border-radius: 50%; overflow: hidden; border: 3px solid ${badgeColor}; flex-shrink: 0;">
                    <img src="${student.photo || 'https://via.placeholder.com/150'}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="flex: 1;">
                    <h4 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 4px; color: var(--text-main);">${toTitleCase(student.name)}</h4>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
                        Roll No: <code>${student.rollNumber}</code> • HT: ${student.hallTicketNumber}<br>
                        Course: ${student.course ? toTitleCase(student.course) : '-'} (${student.semester ? toTitleCase(student.semester) : '-'})<br>
                        Center: ${student.examCenter ? toTitleCase(student.examCenter) : '-'}
                    </div>
                    <span class="status-tag" style="background-color: ${badgeColor}20; color: ${badgeColor}; border: 1px solid ${badgeColor}40; font-weight:700;">${statusLabel}</span>
                </div>
            </div>
        `;
    }
}

// ----------------------------------------------------
// SOCKET.IO REAL-TIME CHECK-IN FEED
// ----------------------------------------------------

function addExamCheckInToFeed(record) {
    const feed = document.getElementById('exam-checkin-feed');
    if (!feed) return;

    const emptyMsg = document.getElementById('empty-checkin-msg');
    if (emptyMsg) emptyMsg.remove();

    const timeStr = new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const student = record.studentId || {};

    const item = document.createElement('div');
    item.className = 'checkin-feed-item';
    item.style.cssText = `
        display: flex; 
        align-items: center; 
        gap: 12px; 
        padding: 10px 14px; 
        border-bottom: 1px solid var(--border-color); 
        background: var(--card-bg-subtle);
        animation: scaleIn 0.3s var(--ease-out);
    `;

    item.innerHTML = `
        <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: var(--bg-main); border: 1px solid var(--border-color); flex-shrink: 0;">
            <img src="${student.photo || 'https://via.placeholder.com/150'}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-main);">${toTitleCase(record.name)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">Roll: ${record.rollNumber} • Paper: ${record.subjectCode}</div>
        </div>
        <div style="text-align: right;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--success);">${timeStr}</div>
            <span class="status-tag present" style="font-size: 0.65rem; padding: 1px 4px;">Present</span>
        </div>
    `;

    feed.insertBefore(item, feed.firstChild);
}

// ----------------------------------------------------
// EXAM DAY REPORTING & CSV EXPORT
// ----------------------------------------------------

state.currentReportLogs = [];

async function fetchExamReports(search = '', course = '', semester = '') {
    const tbody = document.getElementById('report-list-tbody');
    if (!tbody) return;

    try {
        let url = '/api/exam-attendance';
        
        const response = await fetch(url);
        const logs = await response.json();
        
        let filteredLogs = logs;
        if (search || course || semester) {
            const queryLower = search.toLowerCase().trim();
            filteredLogs = logs.filter(log => {
                const student = log.studentId || {};
                const matchesSearch = !search || 
                    log.name.toLowerCase().includes(queryLower) ||
                    log.rollNumber.toLowerCase().includes(queryLower) ||
                    log.hallTicketNumber.toLowerCase().includes(queryLower);
                
                const matchesCourse = !course || (student.course && student.course === course);
                const matchesSemester = !semester || (student.semester && student.semester === semester);
                
                return matchesSearch && matchesCourse && matchesSemester;
            });
        }

        // Cache filtered logs for CSV Export
        state.currentReportLogs = filteredLogs;

        tbody.innerHTML = '';
        if (filteredLogs.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8">No exam attendance records found matching filters.</td>
                </tr>
            `;
            return;
        }

        filteredLogs.forEach(record => {
            const student = record.studentId || {};
            const timeStr = new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-main); border: 1px solid var(--border-color);">
                        <img src="${student.photo || 'https://via.placeholder.com/150'}" style="width: 100%; height: 100%; object-fit: cover;" alt="${toTitleCase(record.name)}">
                    </div>
                </td>
                <td><code>${record.rollNumber}</code></td>
                <td><strong>${toTitleCase(record.name)}</strong></td>
                <td>${student.course ? toTitleCase(student.course) : '-'} (${student.semester ? toTitleCase(student.semester) : '-'})</td>
                <td>${record.examDate}</td>
                <td><span style="font-weight: 550; color: var(--primary);">${record.subjectCode}</span></td>
                <td>${timeStr}</td>
                <td><span class="status-tag present">Present</span></td>
            `;
            tbody.appendChild(row);
        });

    } catch (e) {
        console.error("Fetch Reports Error:", e);
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8" style="color: var(--danger);">Error loading report history.</td></tr>`;
    }
}

function exportReportsToCSV() {
    if (state.currentReportLogs.length === 0) {
        alert('There are no filtered reports to export. Refresh details.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Roll Number,Student Name,Hall Ticket,Course,Semester,Exam Date,Subject Code,Check-In Time,Status\r\n";

    state.currentReportLogs.forEach(record => {
        const student = record.studentId || {};
        const timeStr = new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const cleanName = record.name.replace(/"/g, '""');
        const course = (student.course || '').replace(/"/g, '""');
        const semester = (student.semester || '').replace(/"/g, '""');
        const subjectCode = record.subjectCode.replace(/"/g, '""');

        csvContent += `"${record.rollNumber}","${cleanName}","${record.hallTicketNumber}","${course}","${semester}","${record.examDate}","${subjectCode}","${timeStr}","${record.status}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `exam_attendance_report_${today}.csv`);
    document.body.appendChild(link);

    link.click();
    document.body.removeChild(link);
    playSound('success');
}

// ----------------------------------------------------
// CUSTOM INTERACTIVE CLOCK PICKER CONTROLLER
// ----------------------------------------------------

const clockState = {
    targetInput: null,
    selectedHour: 9,
    selectedMinute: 0,
    isPm: false,
    currentMode: 'hour', // 'hour' or 'minute'
    isDragging: false
};

function initClockPicker() {
    const inputTime = document.getElementById('new-shift-time');
    if (inputTime) {
        inputTime.addEventListener('click', () => {
            openClockPicker(inputTime);
        });
    }

    // Header values trigger view mode switch
    const dispHour = document.getElementById('clock-display-hour');
    const dispMinute = document.getElementById('clock-display-minute');
    if (dispHour) dispHour.addEventListener('click', () => setClockPickerMode('hour'));
    if (dispMinute) dispMinute.addEventListener('click', () => setClockPickerMode('minute'));

    // AM/PM Buttons
    const btnAm = document.getElementById('clock-ampm-am');
    const btnPm = document.getElementById('clock-ampm-pm');
    if (btnAm) btnAm.addEventListener('click', () => setAmPm(false));
    if (btnPm) btnPm.addEventListener('click', () => setAmPm(true));

    // Dial Click/Drag Listeners
    const clockFace = document.getElementById('clock-face');
    if (clockFace) {
        clockFace.addEventListener('mousedown', (e) => {
            clockState.isDragging = true;
            handleClockFaceInteraction(e);
        });
        document.addEventListener('mousemove', (e) => {
            if (clockState.isDragging) {
                handleClockFaceInteraction(e);
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (clockState.isDragging) {
                clockState.isDragging = false;
                // Auto switch from Hour to Minute mode after selecting hour
                if (clockState.currentMode === 'hour') {
                    setTimeout(() => {
                        setClockPickerMode('minute');
                    }, 250);
                }
            }
        });
        // Touch events for mobile compatibility
        clockFace.addEventListener('touchstart', (e) => {
            clockState.isDragging = true;
            handleClockFaceInteraction(e.touches[0]);
        });
        clockFace.addEventListener('touchmove', (e) => {
            if (clockState.isDragging) {
                handleClockFaceInteraction(e.touches[0]);
            }
        });
        clockFace.addEventListener('touchend', () => {
            if (clockState.isDragging) {
                clockState.isDragging = false;
                if (clockState.currentMode === 'hour') {
                    setTimeout(() => {
                        setClockPickerMode('minute');
                    }, 250);
                }
            }
        });
    }

    // Modal Control buttons
    const btnCancel = document.getElementById('btn-clock-cancel');
    const btnOk = document.getElementById('btn-clock-ok');
    const overlay = document.getElementById('clock-picker-overlay');

    const closeModal = () => {
        document.getElementById('clock-picker-modal').classList.add('hidden');
    };

    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);
    if (btnOk) {
        btnOk.addEventListener('click', () => {
            applyClockPickerTime();
            closeModal();
        });
    }
}

function openClockPicker(inputElement) {
    clockState.targetInput = inputElement;
    
    // Parse current value (expects e.g. "09:00" or "21:50")
    const val = inputElement.value || "09:00";
    const parts = val.split(':');
    let rawHours = parseInt(parts[0]) || 9;
    clockState.selectedMinute = parseInt(parts[1]) || 0;
    
    clockState.isPm = rawHours >= 12;
    clockState.selectedHour = rawHours % 12;
    if (clockState.selectedHour === 0) clockState.selectedHour = 12;

    // Reset view
    setClockPickerMode('hour');
    updateClockAMPMDisplay();
    updateClockTextDisplay();
    
    // Display Modal
    document.getElementById('clock-picker-modal').classList.remove('hidden');
    playSound('click');
}

function setClockPickerMode(mode) {
    clockState.currentMode = mode;
    
    const dispHour = document.getElementById('clock-display-hour');
    const dispMinute = document.getElementById('clock-display-minute');
    const modeLabel = document.getElementById('clock-mode-label');

    if (mode === 'hour') {
        dispHour.classList.add('active');
        dispMinute.classList.remove('active');
        modeLabel.textContent = "Select Hour";
    } else {
        dispHour.classList.remove('active');
        dispMinute.classList.add('active');
        modeLabel.textContent = "Select Minute";
    }

    renderClockNumbers();
    rotateClockHand();
}

function setAmPm(isPm) {
    clockState.isPm = isPm;
    updateClockAMPMDisplay();
    playSound('click');
}

function updateClockAMPMDisplay() {
    const btnAm = document.getElementById('clock-ampm-am');
    const btnPm = document.getElementById('clock-ampm-pm');
    if (clockState.isPm) {
        btnAm.classList.remove('active');
        btnPm.classList.add('active');
    } else {
        btnAm.classList.add('active');
        btnPm.classList.remove('active');
    }
}

function updateClockTextDisplay() {
    const dispHour = document.getElementById('clock-display-hour');
    const dispMinute = document.getElementById('clock-display-minute');
    
    if (dispHour) dispHour.textContent = String(clockState.selectedHour).padStart(2, '0');
    if (dispMinute) dispMinute.textContent = String(clockState.selectedMinute).padStart(2, '0');
}

function renderClockNumbers() {
    const container = document.getElementById('clock-numbers');
    if (!container) return;
    
    container.innerHTML = '';
    
    const isHour = clockState.currentMode === 'hour';
    const R = 70; // Radius in pixels
    
    if (isHour) {
        // Arrange numbers 1 to 12
        for (let i = 1; i <= 12; i++) {
            const angle = (i - 3) * (Math.PI / 6);
            const x = 90 + R * Math.cos(angle);
            const y = 90 + R * Math.sin(angle);
            
            const numDiv = document.createElement('div');
            numDiv.className = 'clock-number';
            numDiv.style.left = `${x}px`;
            numDiv.style.top = `${y}px`;
            numDiv.textContent = i;
            
            if (i === clockState.selectedHour) {
                numDiv.classList.add('selected');
            }
            
            container.appendChild(numDiv);
        }
    } else {
        // Arrange minutes (00, 05, 10, 15, ..., 55)
        for (let i = 0; i < 12; i++) {
            const val = i * 5;
            const angle = (i - 3) * (Math.PI / 6);
            const x = 90 + R * Math.cos(angle);
            const y = 90 + R * Math.sin(angle);
            
            const numDiv = document.createElement('div');
            numDiv.className = 'clock-number';
            numDiv.style.left = `${x}px`;
            numDiv.style.top = `${y}px`;
            numDiv.textContent = String(val).padStart(2, '0');
            
            // Highlight selected minute if it's a multiple of 5
            const nearestMultiple = Math.round(clockState.selectedMinute / 5) * 5 % 60;
            if (val === nearestMultiple) {
                numDiv.classList.add('selected');
            }
            
            container.appendChild(numDiv);
        }
    }
}

function rotateClockHand() {
    const hand = document.getElementById('clock-hand');
    if (!hand) return;
    
    let deg = 0;
    if (clockState.currentMode === 'hour') {
        deg = (clockState.selectedHour % 12) * 30;
    } else {
        deg = clockState.selectedMinute * 6;
    }
    
    hand.style.transform = `translate(-50%) rotate(${deg}deg)`;
}

function handleClockFaceInteraction(e) {
    const face = document.getElementById('clock-face');
    if (!face) return;
    
    const rect = face.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    
    // Calculate angle in degrees (0 deg is top, goes clockwise)
    let angleRad = Math.atan2(dy, dx);
    let deg = (angleRad * 180 / Math.PI + 90 + 360) % 360;
    
    if (clockState.currentMode === 'hour') {
        // Map degrees to nearest hour (1-12)
        let hour = Math.round(deg / 30);
        if (hour === 0) hour = 12;
        
        if (hour !== clockState.selectedHour) {
            clockState.selectedHour = hour;
            updateClockTextDisplay();
            renderClockNumbers();
            rotateClockHand();
            playSound('click');
        }
    } else {
        // Map degrees to nearest minute (0-59)
        let minute = Math.round(deg / 6) % 60;
        
        if (minute !== clockState.selectedMinute) {
            clockState.selectedMinute = minute;
            updateClockTextDisplay();
            renderClockNumbers();
            rotateClockHand();
            playSound('click');
        }
    }
}

function applyClockPickerTime() {
    if (!clockState.targetInput) return;
    
    let hours = clockState.selectedHour % 12;
    if (clockState.isPm) hours += 12;
    
    const formattedTime = `${String(hours).padStart(2, '0')}:${String(clockState.selectedMinute).padStart(2, '0')}`;
    clockState.targetInput.value = formattedTime;
    
    // Dispatch input event to trigger form change updates in original app
    const event = new Event('input', { bubbles: true });
    clockState.targetInput.dispatchEvent(event);
    
    playSound('success');
}
