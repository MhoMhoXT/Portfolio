// ===== STATE =====
let state = 'idle'; // idle | waking | locked | loading | home | app-{name}
let activeApp = null;
let hasUnlocked = false; // track if user has unlocked at least once

const tablet       = document.getElementById('tablet');
const tabletScreen = document.getElementById('tabletScreen');
const room         = document.getElementById('room');
const scene        = document.getElementById('scene');
const tabletGlow   = document.getElementById('tabletGlow');
const screenWake   = document.getElementById('screenWake');
const screenLock   = document.getElementById('screenLock');
const screenLoading = document.getElementById('screenLoading');
const screenHome   = document.getElementById('screenHome');
const closeBtn     = document.getElementById('closeBtn');
const roomPrompt   = document.getElementById('roomPrompt');
const notifBanner  = document.getElementById('notifBanner');
const searchOverlay = document.getElementById('searchOverlay');
const searchInput  = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('statusTime').textContent = `${h}:${m}`;
  document.getElementById('lockTime').textContent = `${h}:${m}`;

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('lockDate').textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}
updateClock();
setInterval(updateClock, 1000);

// ===== WAKE TABLET → LOCK SCREEN =====
tablet.addEventListener('click', (e) => {
  if (state !== 'idle') return;

  state = 'waking';
  tablet.classList.remove('idle');
  tablet.classList.add('zoomed');
  closeBtn.classList.add('visible');
  tabletGlow.style.opacity = '0';
  roomPrompt.classList.add('fade-out');

  if (hasUnlocked) {
    // Skip lock screen, go straight to home
    screenWake.classList.add('hidden');
    screenHome.classList.remove('hidden');
    state = 'home';
    if (pNetInited && !pIsLowEnd && pRenderer) pStartLoop();
  } else {
    // First time — show lock screen
    setTimeout(() => {
      screenWake.classList.add('hidden');
      screenLock.classList.remove('hidden');
      state = 'locked';
    }, 380);
  }
});

tablet.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && state === 'idle') {
    e.preventDefault();
    tablet.click();
  }
});

// ===== LOCK SCREEN SWIPE UP =====
let lockDragY = 0;
let lockStartY = 0;
let lockDragging = false;

screenLock.addEventListener('pointerdown', (e) => {
  if (state !== 'locked') return;
  lockDragging = true;
  lockStartY = e.clientY;
  screenLock.style.cursor = 'grabbing';
  screenLock.setPointerCapture(e.pointerId);
});

screenLock.addEventListener('pointermove', (e) => {
  if (!lockDragging) return;
  lockDragY = lockStartY - e.clientY;
  if (lockDragY < 0) lockDragY = 0;
  const pct = Math.min(lockDragY / 200, 1);
  screenLock.style.transform = `translateY(${-lockDragY * 0.6}px)`;
  screenLock.style.opacity = 1 - pct * 0.7;
  document.getElementById('lockDragOverlay').style.opacity = pct * 0.5;
});

screenLock.addEventListener('pointerup', (e) => {
  if (!lockDragging) return;
  lockDragging = false;
  screenLock.style.cursor = 'grab';

  if (lockDragY > 100) {
    // Unlock
    screenLock.style.transform = 'translateY(-100%)';
    screenLock.style.opacity = '0';
    unlockToHome();
  } else {
    // Snap back
    screenLock.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    screenLock.style.transform = 'translateY(0)';
    screenLock.style.opacity = '1';
    document.getElementById('lockDragOverlay').style.opacity = '0';
    setTimeout(() => { screenLock.style.transition = ''; }, 300);
  }
  lockDragY = 0;
});

function unlockToHome() {
  hasUnlocked = true;
  state = 'home';
  
  // Skip loading screen completely
  screenLoading.classList.add('hidden');
  screenHome.classList.remove('hidden');

  setTimeout(() => {
    screenLock.classList.add('hidden');
    screenLock.style.transform = '';
    screenLock.style.opacity = '';
    document.getElementById('lockDragOverlay').style.opacity = '0';
  }, 300);

  // Init or resume particle network
  if (!pNetInited) {
    pInitNetwork();
  } else if (!pIsLowEnd && pRenderer) {
    pStartLoop();
  }

  // Show guided notification tips
  notifStep = 0;
  setTimeout(showNextNotif, 400);
}

// ===== NOTIFICATION BANNER (guided tips) =====
const notifSteps = [
  { app: 'Welcome', text: 'Hey! Tap any app to explore my portfolio', icon: 'about', bg: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', action: null },
  { app: 'Tip', text: 'Swipe left to see more apps on page 2', icon: 'skills', bg: 'linear-gradient(145deg,#6a0dad,#380073)', action: null },
  { app: 'Try it', text: 'Use the search bar to find anything fast', icon: 'work', bg: 'linear-gradient(145deg,#2d6a4f,#1b4332)', action: null },
];
let notifStep = 0;
let notifTimer = null;

function showNextNotif() {
  if (!notifsEnabled || notifStep >= notifSteps.length) return;
  const step = notifSteps[notifStep];
  document.getElementById('notifApp').textContent = step.app;
  document.getElementById('notifText').textContent = step.text;
  document.getElementById('notifIcon').style.background = step.bg;
  document.getElementById('notifIcon').innerHTML = iconSvgs[step.icon];
  notifBanner.classList.add('visible');

  notifTimer = setTimeout(() => {
    notifBanner.classList.remove('visible');
    notifStep++;
    if (notifStep < notifSteps.length) {
      setTimeout(showNextNotif, 800);
    }
  }, 3500);
}

notifBanner.addEventListener('click', (e) => {
  e.stopPropagation();
  clearTimeout(notifTimer);
  notifBanner.classList.remove('visible');
  notifStep++;
  if (notifStep < notifSteps.length) {
    setTimeout(showNextNotif, 600);
  }
});

// ===== SWIPE PAGES =====
let currentPage = 0;
const totalPages = 2;
const pagesTrack = document.getElementById('pagesTrack');
const pagesContainer = document.getElementById('pagesContainer');
const pageDots = document.querySelectorAll('.page-dot');

let swipeStartX = 0;
let swipeDeltaX = 0;
let swipePending = false;  // pointer is down but we haven't committed to swiping yet
let swipeActive = false;   // we've exceeded threshold, this is a real swipe
let swipePointerTarget = null; // store the actual element clicked for pseudo-clicks

pagesContainer.addEventListener('pointerdown', (e) => {
  if (state !== 'home') return;
  swipePending = true;
  swipeActive = false;
  swipeStartX = e.clientX;
  swipeDeltaX = 0;
  swipePointerTarget = e.target;
  
  try {
    pagesContainer.setPointerCapture(e.pointerId);
  } catch(err) {}
});

pagesContainer.addEventListener('pointermove', (e) => {
  if (!swipePending && !swipeActive) return;
  swipeDeltaX = e.clientX - swipeStartX;

  // Only commit to swiping after 5px horizontal movement (better for mobile)
  if (!swipeActive && Math.abs(swipeDeltaX) > 5) {
    swipeActive = true;
    swipePending = false;
    pagesTrack.classList.add('dragging');
  }

  if (swipeActive) {
    e.preventDefault();
    const offset = -currentPage * 100 + (swipeDeltaX / pagesContainer.offsetWidth) * 100;
    pagesTrack.style.transform = `translateX(${offset}%)`;
  }
});

function endSwipe(e) {
  const wasSwiping = swipeActive;
  swipePending = false;
  swipeActive = false;
  pagesTrack.classList.remove('dragging');

  if (e && e.pointerId) {
    try { pagesContainer.releasePointerCapture(e.pointerId); } catch(err) {}
  }

  if (!wasSwiping) {
    // Treat as click if they didn't swipe
    if (swipePointerTarget) {
      const icon = swipePointerTarget.closest('.app-icon');
      if (icon) {
        if (icon.classList.contains('app-disabled')) {
          icon.classList.remove('shake');
          void icon.offsetWidth;
          icon.classList.add('shake');
        } else if (icon.dataset.app) {
          openApp(icon.dataset.app, icon);
        } else if (icon.dataset.link) {
          window.open(icon.dataset.link, '_blank', 'noopener');
        }
      }
    }
    swipeDeltaX = 0;
    return;
  }

  // Much smaller threshold handles quick "flicks" on mobile touchscreens
  const threshold = Math.min(pagesContainer.offsetWidth * 0.15, 40);
  if (swipeDeltaX < -threshold && currentPage < totalPages - 1) {
    currentPage++;
  } else if (swipeDeltaX > threshold && currentPage > 0) {
    currentPage--;
  }
  goToPage(currentPage);
  swipeDeltaX = 0;
}

pagesContainer.addEventListener('pointerup', endSwipe);
pagesContainer.addEventListener('pointercancel', endSwipe);
pagesContainer.addEventListener('lostpointercapture', endSwipe);

function goToPage(idx) {
  currentPage = idx;
  pagesTrack.style.transform = `translateX(${-idx * 100}%)`;
  pageDots.forEach((d, i) => d.classList.toggle('active', i === idx));
}

pageDots.forEach(dot => {
  dot.addEventListener('click', () => goToPage(parseInt(dot.dataset.dot)));
});

// ===== OPEN APP (with origin animation) =====
document.querySelectorAll('.app-icon[data-app]').forEach(icon => {
  icon.addEventListener('click', (e) => {
    if (state !== 'home') return;
    e.stopPropagation();

    // Disabled apps shake instead of opening
    if (icon.classList.contains('app-disabled')) {
      icon.classList.remove('shake');
      void icon.offsetWidth; // reflow to restart animation
      icon.classList.add('shake');
      return;
    }

    openApp(icon.dataset.app, icon);
  });
});

// Social link icons — open external URLs
document.querySelectorAll('.social-link[data-link]').forEach(icon => {
  icon.addEventListener('click', (e) => {
    if (state !== 'home') return;
    e.stopPropagation();
    window.open(icon.dataset.link, '_blank', 'noopener');
  });
});

function openApp(appName, iconEl) {
  const panel = document.getElementById(`panel-${appName}`);
  if (!panel) return;

  // Calculate origin from icon position
  if (iconEl) {
    const screenRect = tabletScreen.getBoundingClientRect();
    const iconRect = iconEl.getBoundingClientRect();
    const ox = ((iconRect.left + iconRect.width / 2) - screenRect.left) / screenRect.width * 100;
    const oy = ((iconRect.top + iconRect.height / 2) - screenRect.top) / screenRect.height * 100;
    panel.style.transformOrigin = `${ox}% ${oy}%`;
  } else {
    panel.style.transformOrigin = 'center center';
  }

  state = `app-${appName}`;
  activeApp = appName;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    panel.classList.add('visible');
  }));
}

// ===== CLOSE APP =====
document.querySelectorAll('.panel-back-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCurrentApp();
  });
});

function closeCurrentApp() {
  if (!activeApp) return;
  const panel = document.getElementById(`panel-${activeApp}`);
  if (panel) {
    panel.classList.remove('visible');
    setTimeout(() => {
      activeApp = null;
      state = 'home';
    }, 400);
  }
}

// ===== CLOSE TABLET =====
closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (state === 'idle') return;

  // Reset so it always goes back to the lock screen on next wake
  hasUnlocked = false;

  // Close any open app
  if (activeApp) {
    const panel = document.getElementById(`panel-${activeApp}`);
    if (panel) panel.classList.remove('visible');
    activeApp = null;
  }

  // Close search & control centre
  searchOverlay.classList.remove('visible');
  closeCC();

  // Close notification
  clearTimeout(notifTimer);
  notifBanner.classList.remove('visible');

  // Stop particle animation
  pStopLoop();

  // Reset screens — keep theme/wallpaper as-is
  screenHome.classList.add('hidden');
  screenLoading.classList.add('hidden');
  screenLock.classList.add('hidden');
  screenLock.style.transform = '';
  screenLock.style.opacity = '';
  screenWake.classList.remove('hidden');

  // Retreat
  tablet.classList.remove('zoomed');
  tablet.classList.add('idle');
  closeBtn.classList.remove('visible');
  tabletGlow.style.opacity = '1';
  roomPrompt.classList.remove('fade-out');
  state = 'idle';
});

// ===== SEARCH / SPOTLIGHT =====
const searchData = [
  { title: 'Aura Identity', sub: 'Brand & Web · 2025', app: 'work', category: 'Projects', bg: '#2d6a4f', icon: 'work' },
  { title: 'Oasis Platform', sub: 'Product Design · 2025', app: 'work', category: 'Projects', bg: '#2d6a4f', icon: 'work' },
  { title: 'Chronos Editor', sub: 'Desktop Software · 2024', app: 'work', category: 'Projects', bg: '#2d6a4f', icon: 'work' },
  { title: 'Prism DS', sub: 'Design System · 2024', app: 'work', category: 'Projects', bg: '#2d6a4f', icon: 'work' },
  { title: 'Fluid Type Engine', sub: 'CSS · Interactive', app: 'lab', category: 'Lab', bg: '#b5451b', icon: 'lab' },
  { title: 'Terrain Walker', sub: 'Three.js · WebGL', app: 'lab', category: 'Lab', bg: '#b5451b', icon: 'lab' },
  { title: 'Type Hallucinator', sub: 'AI · Generative', app: 'lab', category: 'Lab', bg: '#b5451b', icon: 'lab' },
  { title: 'Product Design', sub: 'Core skill', app: 'skills', category: 'Skills', bg: '#6a0dad', icon: 'skills' },
  { title: 'Brand Identity', sub: 'Core skill', app: 'skills', category: 'Skills', bg: '#6a0dad', icon: 'skills' },
  { title: 'React', sub: 'Engineering', app: 'skills', category: 'Skills', bg: '#6a0dad', icon: 'skills' },
  { title: 'TypeScript', sub: 'Engineering', app: 'skills', category: 'Skills', bg: '#6a0dad', icon: 'skills' },
  { title: 'Motion Design', sub: 'Core skill', app: 'skills', category: 'Skills', bg: '#6a0dad', icon: 'skills' },
  { title: 'Node.js', sub: 'Engineering', app: 'skills', category: 'Skills', bg: '#6a0dad', icon: 'skills' },
  { title: 'CSS / Animation', sub: 'Engineering', app: 'skills', category: 'Skills', bg: '#6a0dad', icon: 'skills' },
  { title: 'Figma', sub: 'Tool', app: 'skills', category: 'Skills', bg: '#6a0dad', icon: 'skills' },
  { title: 'Email', sub: 'hello@jamiegarland.co', app: 'contact', category: 'Contact', bg: '#c0392b', icon: 'contact' },
  { title: 'LinkedIn', sub: 'Jamie Garland', app: 'contact', category: 'Contact', bg: '#c0392b', icon: 'contact' },
  { title: 'GitHub', sub: 'jamiegarland', app: 'contact', category: 'Contact', bg: '#c0392b', icon: 'contact' },
  { title: 'Dribbble', sub: '@jamie.g', app: 'contact', category: 'Contact', bg: '#c0392b', icon: 'contact' },
  { title: 'Jamie Garland', sub: 'Designer & Developer', app: 'about', category: 'About', bg: '#1d4e89', icon: 'about' },
  { title: 'Senior Product Designer', sub: 'Nothing — London', app: 'resume', category: 'Resume', bg: '#0b6e99', icon: 'resume' },
  { title: 'Design Lead', sub: 'Monzo Bank — London', app: 'resume', category: 'Resume', bg: '#0b6e99', icon: 'resume' },
];

const iconSvgs = {
  work: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  about: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  skills: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  contact: '<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  resume: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  lab: '<svg viewBox="0 0 24 24"><path d="M9 3h6v8l4 9H5l4-9V3z"/><line x1="6" y1="15" x2="18" y2="15"/></svg>',
};

document.getElementById('searchTrigger').addEventListener('click', (e) => {
  e.stopPropagation();
  if (state !== 'home') return;
  searchOverlay.classList.add('visible');
  searchInput.value = '';
  renderSearchResults('');
  setTimeout(() => searchInput.focus(), 100);
});

document.getElementById('searchCancel').addEventListener('click', (e) => {
  e.stopPropagation();
  searchOverlay.classList.remove('visible');
});

searchInput.addEventListener('input', () => {
  renderSearchResults(searchInput.value);
});

function renderSearchResults(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    searchResults.innerHTML = '<div class="search-empty">Type to search across projects, skills, and contacts</div>';
    return;
  }

  const matches = searchData.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.sub.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    searchResults.innerHTML = `<div class="search-empty">No results for "${query}"</div>`;
    return;
  }

  // Group by category
  const groups = {};
  matches.forEach(m => {
    if (!groups[m.category]) groups[m.category] = [];
    groups[m.category].push(m);
  });

  let html = '';
  for (const [cat, items] of Object.entries(groups)) {
    html += `<div class="search-section-label">${cat}</div>`;
    items.forEach(item => {
      html += `
        <div class="search-result-item" data-app="${item.app}">
          <div class="search-result-icon" style="background:${item.bg}">${iconSvgs[item.icon]}</div>
          <div>
            <div class="search-result-title">${item.title}</div>
            <div class="search-result-sub">${item.sub}</div>
          </div>
        </div>`;
    });
  }

  searchResults.innerHTML = html;

  // Bind clicks
  searchResults.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const app = el.dataset.app;
      searchOverlay.classList.remove('visible');
      openApp(app, null);
    });
  });
}

// ===== CONTROL CENTRE =====
const ccHandle  = document.getElementById('ccHandle');
const ccPanel   = document.getElementById('ccPanel');
const ccOverlay = document.getElementById('ccOverlay');
let ccOpen = false;

function toggleCC() {
  ccOpen = !ccOpen;
  ccPanel.classList.toggle('visible', ccOpen);
  ccOverlay.classList.toggle('visible', ccOpen);
}

function closeCC() {
  if (!ccOpen) return;
  ccOpen = false;
  ccPanel.classList.remove('visible');
  ccOverlay.classList.remove('visible');
}

ccHandle.addEventListener('click', (e) => {
  e.stopPropagation();
  if (state !== 'home' && !state.startsWith('app-')) return;
  if (searchOverlay.classList.contains('visible')) return;
  toggleCC();
});

ccOverlay.addEventListener('click', (e) => {
  e.stopPropagation();
  closeCC();
});

// Toggle tiles
document.querySelectorAll('.cc-tile').forEach(tile => {
  tile.addEventListener('click', (e) => {
    e.stopPropagation();
    tile.classList.toggle('active');
    const statusEl = tile.querySelector('.cc-tile-status');
    if (statusEl) {
      const isActive = tile.classList.contains('active');
      if (tile.id === 'ccWifi') statusEl.textContent = isActive ? 'Connected' : 'Off';
      else if (tile.id === 'ccBluetooth') statusEl.textContent = isActive ? 'On' : 'Off';
      else if (tile.id === 'ccDnd') statusEl.textContent = isActive ? 'On' : 'Off';
      else if (tile.id === 'ccDarkMode') {
        statusEl.textContent = isActive ? 'On' : 'Off';
        tabletScreen.classList.toggle('light-mode', isActive);
        if (typeof pSetLightMode === 'function') pSetLightMode(isActive);
        if (settingDarkMode) settingDarkMode.checked = !isActive;
        applyWallpaper(currentWallpaper);
      }
    }
  });
});

// Brightness slider controls screen opacity
document.getElementById('ccBrightness').addEventListener('input', (e) => {
  const v = e.target.value / 100;
  tabletScreen.style.filter = `brightness(${v})`;
});

// Quick links in CC
document.querySelectorAll('.cc-link[data-app]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.stopPropagation();
    const appName = link.dataset.app;
    closeCC();
    if (state === 'home') {
      openApp(appName, null);
    }
  });
});

// ===== SETTINGS =====
const settingDarkMode  = document.getElementById('settingDarkMode');
const settingNotifs    = document.getElementById('settingNotifs');
const settingParticles = document.getElementById('settingParticles');
let notifsEnabled = true;
let particlesEnabled = true;

// Wallpaper gradients
const wallpapers = {
  default: { dark: 'linear-gradient(155deg,#1e2d29 0%,#141e1b 55%,#0f1715 100%)', light: 'linear-gradient(155deg,#f0ede6 0%,#e8e4dc 55%,#dfd9cf 100%)' },
  purple:  { dark: 'linear-gradient(155deg,#2d1e3e 0%,#1e1428 55%,#150f20 100%)', light: 'linear-gradient(155deg,#ede6f0 0%,#e4dce8 55%,#d9cfe0 100%)' },
  ocean:   { dark: 'linear-gradient(155deg,#1a2a3e 0%,#121e2a 55%,#0d1520 100%)', light: 'linear-gradient(155deg,#e6edf0 0%,#dce4e8 55%,#cfd9e0 100%)' },
  ember:   { dark: 'linear-gradient(155deg,#3e1a1a 0%,#2a1212 55%,#200d0d 100%)', light: 'linear-gradient(155deg,#f0e6e6 0%,#e8dcdc 55%,#e0cfcf 100%)' },
  black:   { dark: '#000000', light: '#ffffff' }
};
let currentWallpaper = 'black';

function applyWallpaper(name) {
  currentWallpaper = name;
  const isLight = tabletScreen.classList.contains('light-mode');
  const wp = wallpapers[name];
  const bg = isLight ? wp.light : wp.dark;
  
  document.getElementById('screenHome').style.background = bg;
  
  const notifBanner = document.getElementById('notifBanner');
  if (notifBanner) {
    notifBanner.style.background = bg;
  }

  document.querySelectorAll('.settings-wallpaper').forEach(w => {
    w.classList.toggle('active', w.dataset.wallpaper === name);
  });
}

// Initialize wallpaper on load
applyWallpaper(currentWallpaper);

// Dark mode setting sync with CC tile
if (settingDarkMode) {
  settingDarkMode.addEventListener('change', () => {
    const isDark = settingDarkMode.checked;
    const dmTile = document.getElementById('ccDarkMode');
    if (isDark) {
      tabletScreen.classList.remove('light-mode');
      dmTile.classList.remove('active');
      dmTile.querySelector('.cc-tile-status').textContent = 'Off';
    } else {
      tabletScreen.classList.add('light-mode');
      dmTile.classList.add('active');
      dmTile.querySelector('.cc-tile-status').textContent = 'On';
    }
    applyWallpaper(currentWallpaper);
    if (typeof pSetLightMode === 'function') pSetLightMode(!isDark);
  });
}

// Notifications toggle
if (settingNotifs) {
  settingNotifs.addEventListener('change', () => {
    notifsEnabled = settingNotifs.checked;
  });
}

// Particles toggle
if (settingParticles) {
  settingParticles.addEventListener('change', () => {
    particlesEnabled = settingParticles.checked;
    const canvas = document.getElementById('particleBg');
    if (!particlesEnabled) {
      if (typeof pStopLoop === 'function') pStopLoop();
      if (canvas) canvas.style.display = 'none';
    } else {
      if (canvas) canvas.style.display = 'block';
      if (typeof pStartLoop === 'function') pStartLoop();
    }
  });
}

// Wallpaper selection
document.querySelectorAll('.settings-wallpaper').forEach(wp => {
  wp.addEventListener('click', (e) => {
    e.stopPropagation();
    applyWallpaper(wp.dataset.wallpaper);
  });
});

// ===== MOUSE PARALLAX =====
let rafId = null;
document.addEventListener('mousemove', (e) => {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;

    room.style.transform = `translate(${dx * -6}px, ${dy * -4}px)`;
    scene.style.perspectiveOrigin = `${50 + dx * 4}% ${40 + dy * 2.5}%`;
  });
});

// ===== FLOATING GREETINGS =====
const greetings = [
  'Hello', 'مرحبا', '你好', 'こんにちは', 'Bonjour',
  'Hola', 'Ciao', 'Olá', 'Hallo', 'Привет',
  'Merhaba', 'Namaste', 'Salam', 'Hej', 'Sawubona',
  'Kamusta', 'Ahoj', 'Γεια σου', 'Shalom', 'Xin chào'
];

const greetTR = document.getElementById('greetingTR');
const greetBL = document.getElementById('greetingBL');
let greetIdx = 0;

function cycleGreetings() {
  // Fade out
  greetTR.classList.remove('visible');
  greetBL.classList.remove('visible');

  setTimeout(() => {
    greetTR.textContent = greetings[greetIdx % greetings.length];
    greetBL.textContent = greetings[(greetIdx + 10) % greetings.length];
    greetIdx++;

    // Fade in
    greetTR.classList.add('visible');
    greetBL.classList.add('visible');
  }, 1200);
}

// Start immediately then cycle
cycleGreetings();
setInterval(cycleGreetings, 4000);

// ===== CONTACT FORM (AJAX) =====
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('.contact-form-btn');
    const status = document.getElementById('contactFormStatus');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    status.textContent = '';
    try {
      const res = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        status.textContent = 'Message sent!';
        status.style.color = '#22c55e';
        contactForm.reset();
      } else {
        status.textContent = 'Something went wrong. Try again.';
        status.style.color = '#ef4444';
      }
    } catch {
      status.textContent = 'Network error. Try again.';
      status.style.color = '#ef4444';
    }
    btn.disabled = false;
    btn.textContent = 'Send Message';
  });
}

// ===== PARTICLE NETWORK BACKGROUND =====
const pIsLowEnd = navigator.hardwareConcurrency <= 2;
const particleBgCanvas = document.getElementById('particleBg');
let pNetInited = false;
let pNetRunning = false;
let pNetRafId = null;

let pScene, pCamera, pRenderer, pParticles, pLineMesh, pContentGroup;
let pParticleData = [];
let pFrameCount = 0;
let pViewWidth, pViewHeight;
let pDotTexture;

const P_COUNT = 150;
const P_MAX_DIST = 0.4;
const P_SPEED = 0.001;
const P_CELL = P_MAX_DIST;

// Spatial hash grid
const pGrid = {};

function pHashKey(x, y, z) {
  return ((Math.floor(x / P_CELL) * 73856093) ^ (Math.floor(y / P_CELL) * 19349663) ^ (Math.floor(z / P_CELL) * 83492791)) | 0;
}

function pUpdateGrid() {
  for (const k in pGrid) delete pGrid[k];
  for (let i = 0; i < P_COUNT; i++) {
    const p = pParticleData[i].position;
    const key = pHashKey(p.x, p.y, p.z);
    if (!pGrid[key]) pGrid[key] = [];
    pGrid[key].push(i);
  }
}

function pInitNetwork() {
  if (pNetInited) return;
  pNetInited = true;

  if (pIsLowEnd || typeof THREE === 'undefined') {
    pDrawStatic();
    return;
  }

  pScene = new THREE.Scene();
  pContentGroup = new THREE.Group();
  pScene.add(pContentGroup);

  pCamera = new THREE.PerspectiveCamera(75, particleBgCanvas.clientWidth / particleBgCanvas.clientHeight, 0.1, 1000);
  pCamera.position.z = 3;

  pRenderer = new THREE.WebGLRenderer({
    canvas: particleBgCanvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power'
  });
  pRenderer.setSize(particleBgCanvas.clientWidth, particleBgCanvas.clientHeight, false);
  pRenderer.setPixelRatio(1);

  pCalcView();

  // Generate a circle texture in-memory (no external files needed)
  const tSize = 64;
  const tCanvas = document.createElement('canvas');
  tCanvas.width = tSize;
  tCanvas.height = tSize;
  const tCtx = tCanvas.getContext('2d');
  const half = tSize / 2;
  const grad = tCtx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  tCtx.fillStyle = grad;
  tCtx.fillRect(0, 0, tSize, tSize);
  pDotTexture = new THREE.CanvasTexture(tCanvas);

  // Particles
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(P_COUNT * 3);

  for (let i = 0; i < P_COUNT; i++) {
    const x = (Math.random() - 0.5) * pViewWidth;
    const y = (Math.random() - 0.5) * pViewHeight;
    const z = (Math.random() - 0.5) * 2;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    pParticleData.push({
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * P_SPEED,
        (Math.random() - 0.5) * P_SPEED,
        (Math.random() - 0.5) * P_SPEED
      )
    });
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const isLight = tabletScreen.classList.contains('light-mode');
  const mat = new THREE.PointsMaterial({
    size: 6,
    color: isLight ? 0x1a1a18 : 0xffffff,
    map: pDotTexture,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false
  });

  pParticles = new THREE.Points(geo, mat);
  pContentGroup.add(pParticles);

  // Lines
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(P_COUNT * 50 * 6);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setDrawRange(0, 0);

  const lineMat = new THREE.LineBasicMaterial({
    color: isLight ? 0x1a1a18 : 0xffffff,
    transparent: true,
    opacity: isLight ? 0.18 : 0.3,
    blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false
  });

  pLineMesh = new THREE.LineSegments(lineGeo, lineMat);
  pContentGroup.add(pLineMesh);

  const ro = new ResizeObserver(() => {
    if (!pRenderer) return;
    const w = particleBgCanvas.clientWidth;
    const h = particleBgCanvas.clientHeight;
    pRenderer.setSize(w, h, false);
    pCamera.aspect = w / h;
    pCamera.updateProjectionMatrix();
    pCalcView();
  });
  ro.observe(particleBgCanvas.parentElement);

  pStartLoop();
}

function pCalcView() {
  const vFOV = (pCamera.fov * Math.PI) / 180;
  pViewHeight = 2 * Math.tan(vFOV / 2) * pCamera.position.z;
  pViewWidth = pViewHeight * pCamera.aspect;
}

function pStartLoop() {
  if (pNetRunning) return;
  pNetRunning = true;
  pAnimate();
}

function pStopLoop() {
  pNetRunning = false;
  if (pNetRafId) {
    cancelAnimationFrame(pNetRafId);
    pNetRafId = null;
  }
}

function pAnimate() {
  if (!pNetRunning) return;
  pNetRafId = requestAnimationFrame(pAnimate);

  const positions = pParticles.geometry.attributes.position.array;
  const hw = pViewWidth / 2;
  const hh = pViewHeight / 2;

  for (let i = 0; i < P_COUNT; i++) {
    const p = pParticleData[i];
    p.position.add(p.velocity);

    if (p.position.x > hw) p.position.x = -hw;
    if (p.position.x < -hw) p.position.x = hw;
    if (p.position.y > hh) p.position.y = -hh;
    if (p.position.y < -hh) p.position.y = hh;
    if (p.position.z > 1) p.position.z = -1;
    if (p.position.z < -1) p.position.z = 1;

    positions[i * 3] = p.position.x;
    positions[i * 3 + 1] = p.position.y;
    positions[i * 3 + 2] = p.position.z;
  }
  pParticles.geometry.attributes.position.needsUpdate = true;

  // Update lines every 3rd frame using spatial grid
  if (pFrameCount++ % 3 === 0) {
    pUpdateGrid();
    const linePos = pLineMesh.geometry.attributes.position.array;
    let li = 0;

    for (let i = 0; i < P_COUNT; i++) {
      const p = pParticleData[i].position;
      const cx = Math.floor(p.x / P_CELL);
      const cy = Math.floor(p.y / P_CELL);
      const cz = Math.floor(p.z / P_CELL);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const key = ((cx + dx) * 73856093 ^ (cy + dy) * 19349663 ^ (cz + dz) * 83492791) | 0;
            const cell = pGrid[key];
            if (!cell) continue;
            for (let c = 0; c < cell.length; c++) {
              const j = cell[c];
              if (j <= i) continue;
              const p2 = pParticleData[j].position;
              const ddx = p.x - p2.x, ddy = p.y - p2.y, ddz = p.z - p2.z;
              const distSq = ddx * ddx + ddy * ddy + ddz * ddz;
              if (distSq < P_MAX_DIST * P_MAX_DIST) {
                linePos[li++] = p.x; linePos[li++] = p.y; linePos[li++] = p.z;
                linePos[li++] = p2.x; linePos[li++] = p2.y; linePos[li++] = p2.z;
              }
            }
          }
        }
      }
    }
    pLineMesh.geometry.setDrawRange(0, li / 3);
    pLineMesh.geometry.attributes.position.needsUpdate = true;
  }

  pContentGroup.rotation.y += 0.0001;
  pContentGroup.rotation.x += 0.0001;

  pRenderer.render(pScene, pCamera);
}

function pSetLightMode(isLight) {
  if (pParticles) {
    pParticles.material.color.set(isLight ? 0x1a1a18 : 0xffffff);
    pParticles.material.needsUpdate = true;
    pLineMesh.material.color.set(isLight ? 0x1a1a18 : 0xffffff);
    pLineMesh.material.opacity = isLight ? 0.18 : 0.3;
    pLineMesh.material.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    pLineMesh.material.needsUpdate = true;
  }
  if (pIsLowEnd || typeof THREE === 'undefined') {
    pDrawStatic();
  }
}

// Static fallback for low-end devices
function pDrawStatic() {
  const canvas = particleBgCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const isLight = tabletScreen.classList.contains('light-mode');
  const dotColor = isLight ? 'rgba(40,40,40,0.6)' : 'rgba(255,255,255,0.7)';
  const lineColor = isLight ? 'rgba(40,40,40,0.12)' : 'rgba(255,255,255,0.15)';

  const dots = [];
  const count = 100;
  const maxDist = 80;

  for (let i = 0; i < count; i++) {
    dots.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height });
  }

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = dots[i].x - dots[j].x;
      const dy = dots[i].y - dots[j].y;
      if (dx * dx + dy * dy < maxDist * maxDist) {
        ctx.beginPath();
        ctx.moveTo(dots[i].x, dots[i].y);
        ctx.lineTo(dots[j].x, dots[j].y);
        ctx.stroke();
      }
    }
  }

  ctx.fillStyle = dotColor;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(dots[i].x, dots[i].y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
