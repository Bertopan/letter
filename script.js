// --- CONFIGURATION ---
// SLOW speed as requested
let speedScale = 0.0015; 
let isPaused = false;
let envelopesRead = 0;
let gamePhase = 'phase1';
let currentZoomEnv = null; // track which envelope is zoomed/opened

// --- SETUP ---
const overlay = document.getElementById('overlay');
const bossIntro = document.getElementById('boss-intro');
const finaleScreen = document.getElementById('finale-screen');

let screenW = window.innerWidth;
let screenH = window.innerHeight;
// Use math to calculate pixels based on CSS vmin
let vmin = Math.min(screenW, screenH);
let envWidth = vmin * 0.22; 
let envHeight = vmin * 0.14;

// --- ENVELOPE OBJECTS ---
let activeEnvelopes = [
    { id: 'env1', el: document.getElementById('env1'), x: 0, y: 0, vx: 1, vy: 1, state: 'moving' },
    { id: 'env2', el: document.getElementById('env2'), x: 0, y: 0, vx: -1, vy: 1, state: 'moving' },
    { id: 'env3', el: document.getElementById('env3'), x: 0, y: 0, vx: 1, vy: -1, state: 'moving' },
    { id: 'env4', el: document.getElementById('env4'), x: 0, y: 0, vx: -1, vy: -1, state: 'moving' },
    { id: 'env5', el: document.getElementById('env5'), x: 0, y: 0, vx: 1, vy: -1, state: 'moving' }
];

const goldEnv = { id: 'envGold', el: document.getElementById('envGold'), x: 0, y: 0, vx: 2, vy: 2, state: 'hidden' };

// --- PHYSICS INITIALIZATION ---
function initPhysics() {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    vmin = Math.min(screenW, screenH);
    envWidth = vmin * 0.22;
    envHeight = vmin * 0.14;

    const baseSpeed = screenW * speedScale;

    activeEnvelopes.forEach(env => {
        // Random Position
        env.x = Math.random() * (screenW - envWidth);
        env.y = Math.random() * (screenH - envHeight);
        // Random Direction
        env.vx = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
        env.vy = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
    });

    // Gold moves faster
    goldEnv.vx = baseSpeed * 2.5; 
    goldEnv.vy = baseSpeed * 2.5;
}

window.addEventListener('load', () => { initPhysics(); requestAnimationFrame(update); });
window.addEventListener('resize', initPhysics);


// --- MAIN LOOP ---
function update() {
    if (gamePhase === 'finale') { updateConfetti(); requestAnimationFrame(update); return; }
    
    // If paused, we keep drawing but we DO NOT update positions (Freeze effect)
    if (isPaused || gamePhase === 'intro') { 
        requestAnimationFrame(update); 
        return; 
    }

    // Pick which list to move
    const list = gamePhase === 'boss' ? [goldEnv] : activeEnvelopes;

    list.forEach(env => {
        // Update Math
        env.x += env.vx;
        env.y += env.vy;

        // Wall Bounce
        if (env.x + envWidth >= screenW) { env.vx = -Math.abs(env.vx); env.x = screenW - envWidth; }
        else if (env.x <= 0) { env.vx = Math.abs(env.vx); env.x = 0; }

        if (env.y + envHeight >= screenH) { env.vy = -Math.abs(env.vy); env.y = screenH - envHeight; }
        else if (env.y <= 0) { env.vy = Math.abs(env.vy); env.y = 0; }

        // Apply Transform ONLY if moving
        // If zoomed, CSS handles the position, so we don't touch it here
        if (env.state === 'moving') {
            env.el.style.transform = `translate3d(${env.x}px, ${env.y}px, 0)`;
        }
    });

    // Check collisions only in phase 1
    if (gamePhase === 'phase1') checkCollisions();
    
    requestAnimationFrame(update);
}

function checkCollisions() {
    for (let i = 0; i < activeEnvelopes.length; i++) {
        for (let j = i + 1; j < activeEnvelopes.length; j++) {
            const e1 = activeEnvelopes[i]; const e2 = activeEnvelopes[j];
            if (e1.x < e2.x + envWidth && e1.x + envWidth > e2.x && e1.y < e2.y + envHeight && e1.y + envHeight > e2.y) {
                // Bounce
                let tempVx = e1.vx; e1.vx = e2.vx; e2.vx = tempVx;
                let tempVy = e1.vy; e1.vy = e2.vy; e2.vy = tempVy;
                // Separate
                if (e1.x < e2.x) e1.x -= 2; else e1.x += 2;
                if (e1.y < e2.y) e1.y -= 2; else e1.y += 2;
            }
        }
    }
}

// --- CLICK INTERACTION ---
function handleClick(e, envObj) {
    e.preventDefault();
    e.stopPropagation(); // Don't click overlay behind it

    // If game is paused, only allow interaction with the currently zoomed/opened envelope
    if (isPaused && envObj.state !== 'zoomed' && envObj.state !== 'opened') return;

    // 1. CATCH (zoom into the clicked envelope)
    if (envObj.state === 'moving') {
        isPaused = true;
        envObj.state = 'zoomed';
        currentZoomEnv = envObj;

        // Disable pointer events on other envelopes so only the zoomed one receives input
        activeEnvelopes.forEach(env => { if (env !== envObj) env.el.style.pointerEvents = 'none'; });
        goldEnv.el.style.pointerEvents = 'none';

        // Show Dim Overlay
        overlay.classList.add('active');

        // Move the envelope element to the document body so it can appear above the overlay
        envObj._originalParent = envObj.el.parentElement;
        envObj._originalNext = envObj.el.nextSibling;
        envObj.el.style.transform = 'none';
        document.body.appendChild(envObj.el);
        // Add class to envelope (CSS handles centering)
        envObj.el.classList.add('zoomed');

    // 2. OPEN (only if this is the currently zoomed envelope)
    } else if (envObj.state === 'zoomed' && currentZoomEnv === envObj) {
        envObj.state = 'opened';
        envObj.el.classList.add('opened');

        if (gamePhase === 'phase1' && !envObj.el.classList.contains('has-been-read')) {
            envObj.el.classList.add('has-been-read');
            envelopesRead++;
        }

        if (gamePhase === 'boss') setTimeout(triggerFinale, 3000);
    }
}

// Attach listeners
// Use pointer events (covers mouse + touch) to avoid double-events and missed taps
activeEnvelopes.forEach(env => {
    env.el.addEventListener('pointerup', (e) => handleClick(e, env));
});
goldEnv.el.addEventListener('pointerup', (e) => handleClick(e, goldEnv));


// --- RESET (CLICKING OVERLAY) ---
function handleOverlayClick(e) {
    if (e.target !== overlay) return; // Only close if clicking the dark part

    // If a zoomed envelope exists, ignore overlay clicks that land inside its bounds
    if (currentZoomEnv) {
        const rect = currentZoomEnv.el.getBoundingClientRect();
        const x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        const y = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            // Click was on the zoomed envelope area — ignore overlay handler
            return;
        }
    }

    let activeEnv = null;
    if (gamePhase === 'boss') activeEnv = goldEnv;
    else activeEnv = activeEnvelopes.find(env => env.state === 'zoomed' || env.state === 'opened');

    if (activeEnv) {
        if (activeEnv.state === 'opened') {
            // Close paper first
            activeEnv.el.classList.remove('opened');
            activeEnv.state = 'zoomed';
            setTimeout(() => zoomOut(activeEnv), 600);
        } else {
            zoomOut(activeEnv);
        }
    }
}

function zoomOut(envObj) {
    envObj.el.classList.remove('zoomed');
    overlay.classList.remove('active');
    envObj.state = 'moving';
    currentZoomEnv = null;
    // Move element back into its original container so physics positioning resumes correctly
    if (envObj._originalParent) {
        if (envObj._originalNext) envObj._originalParent.insertBefore(envObj.el, envObj._originalNext);
        else envObj._originalParent.appendChild(envObj.el);
        envObj._originalParent = null;
        envObj._originalNext = null;
    }
    // Restore pointer events for all envelopes
    activeEnvelopes.forEach(env => env.el.style.pointerEvents = 'auto');
    goldEnv.el.style.pointerEvents = 'auto';
    
    // Resume physics at its last known location (JS loop picks it up)
    
    // Give it a random new direction so it feels alive
    const speed = screenW * speedScale * (gamePhase === 'boss' ? 2.5 : 1);
    envObj.vx = (Math.random() > 0.5 ? 1 : -1) * speed;
    envObj.vy = (Math.random() > 0.5 ? 1 : -1) * speed;

    setTimeout(() => {
        isPaused = false;
        if (gamePhase === 'phase1' && envelopesRead >= 5) startBossIntro();
    }, 500);
}

// Keep legacy handlers for non-pointer environments, but prefer pointer events
overlay.addEventListener('click', handleOverlayClick);
overlay.addEventListener('touchstart', handleOverlayClick, {passive: false});

// Pointer handler: if overlay gets the pointerup but the coordinates fall inside the
// zoomed envelope, forward the event to `handleClick` so the envelope opens.
overlay.addEventListener('pointerup', (e) => {
    if (!currentZoomEnv) return handleOverlayClick(e);
    const rect = currentZoomEnv.el.getBoundingClientRect();
    const x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const y = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        // Forward to envelope handler (this will run the open flow)
        handleClick(e, currentZoomEnv);
    } else {
        handleOverlayClick(e);
    }
}, {passive: false});


// --- BOSS & FINALE LOGIC ---
function startBossIntro() {
    gamePhase = 'intro';
    activeEnvelopes.forEach(env => env.el.style.display = 'none');
    bossIntro.style.display = 'flex';
    requestAnimationFrame(() => bossIntro.style.opacity = 1);
    setTimeout(() => {
        bossIntro.style.opacity = 0;
        setTimeout(() => { bossIntro.style.display = 'none'; startBossFight(); }, 1000);
    }, 3000);
}

function startBossFight() {
    gamePhase = 'boss';
    goldEnv.el.style.display = 'block';
    goldEnv.x = screenW/2 - envWidth/2; goldEnv.y = screenH/2 - envHeight/2;
    goldEnv.state = 'moving';
    isPaused = false;
}

function triggerFinale() {
    gamePhase = 'finale';
    finaleScreen.style.display = 'flex';
    requestAnimationFrame(() => finaleScreen.style.opacity = 1);
    initConfetti();
}

// Confetti Engine
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function initConfetti() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    for(let i=0; i<150; i++) particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height-canvas.height, color: `hsl(${Math.random()*360}, 100%, 50%)`, size: Math.random()*10+5, speed: Math.random()*5+2, angle: Math.random()*6.2 });
}
function updateConfetti() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
        p.y += p.speed; p.angle += 0.1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore();
        if(p.y > canvas.height) { p.y = -20; p.x = Math.random()*canvas.width; }
    });
}