/* ==========================================================================
   AEROTOON — app.js (BİRLEŞTİRİLMİŞ TEK DOSYA)
   İçerik: config + utils + auth + data + ui + tasks + profile + achievements
           + admin + oyunlar (çark / mayın tarlası / xox) + dükkan + coin
           transfer sistemi + main
   ========================================================================== */

/* ==========================================================================
   1) FIREBASE + GLOBAL STATE
   ========================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBshDncu6q2q19vPn7Y-P9zi8IkSRXYaPY",
  authDomain: "webtoon-tracker-deneme.firebaseapp.com",
  projectId: "webtoon-tracker-deneme",
  storageBucket: "webtoon-tracker-deneme.firebasestorage.app",
  messagingSenderId: "554806755485",
  appId: "1:554806755485:web:7b4afa6defc6a1ccd19474",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const FieldValue = firebase.firestore.FieldValue;

const STATE = {
  currentUser: null,
  profile: null,
  users: {},
  usersByUsername: {},
  series: {},
  chapters: {},
  tasks: {},
  achievements: {},
  userAchievements: {},
  uiConfig: {},
  unsub: {},
  currentView: 'dashboard-view',
  currentSeriesDetailId: null
};

// --------------------------------------------------
// 🎖️ ROLLER (öncelik sırasına göre — navbar'da SADECE en üstteki rol gösterilir)
// --------------------------------------------------
const ROLES = {
  admin:        { label: 'Admin',          icon: 'fa-crown',            color: '#ffd166' },
  translator:   { label: 'Çevirmen',       icon: 'fa-language',         color: '#ffb703' },
  editor:       { label: 'Redaktör',       icon: 'fa-pen-nib',          color: '#3fd0f0' },
  typesetter:   { label: 'Dizgici',        icon: 'fa-layer-group',      color: '#ff9f6e' },
  qc:           { label: 'Kalite Kontrol', icon: 'fa-magnifying-glass', color: '#ff6b9d' },
  cleaner:      { label: 'Temizlikçi',     icon: 'fa-eraser',           color: '#7c9aff' },
  rawfinder:    { label: 'Raw Bulucu',     icon: 'fa-satellite-dish',   color: '#c9a8ff' },
  member:       { label: 'Üye',            icon: 'fa-user',             color: '#a9b7cf' }
};
const ROLE_PRIORITY = ['admin', 'translator', 'editor', 'typesetter', 'qc', 'cleaner', 'rawfinder', 'member'];
const ASSIGNABLE_ROLES = ['translator', 'cleaner', 'editor', 'typesetter', 'qc', 'rawfinder'];
const STAFF_ROLES = ['admin', 'translator', 'cleaner', 'editor', 'typesetter', 'qc', 'rawfinder'];

function getTopRole(profile) {
  const roles = (profile && profile.roles && profile.roles.length) ? profile.roles : ['member'];
  for (const r of ROLE_PRIORITY) { if (roles.includes(r)) return r; }
  return 'member';
}
function hasStaffRole(profile) {
  return !!(profile && STAFF_ROLES.some(r => (profile.roles || []).includes(r)));
}

// --------------------------------------------------
// ✈️ BÖLÜM İŞ AKIŞI
// --------------------------------------------------
const CHAPTER_STAGES = [
  { key: 'Ham Bulundu',        label: 'Ham Bulundu',        icon: 'fa-satellite-dish',   cls: 'status-raw' },
  { key: 'Çeviride',           label: 'Çeviride',           icon: 'fa-language',         cls: 'status-ceviri' },
  { key: 'Temizlikte',         label: 'Temizlikte',         icon: 'fa-eraser',           cls: 'status-temizlik' },
  { key: 'Redaksiyonda',       label: 'Redaksiyonda',       icon: 'fa-pen-nib',          cls: 'status-redaksiyon' },
  { key: 'Dizgide',            label: 'Dizgide',            icon: 'fa-layer-group',      cls: 'status-dizgi' },
  { key: 'Kalite Kontrolde',   label: 'Kalite Kontrolde',   icon: 'fa-magnifying-glass', cls: 'status-kalite' },
  { key: 'Tamamlandı',         label: 'Yayında (Tamamlandı)', icon: 'fa-circle-check',   cls: 'status-tamamlandi' }
];
function stageIndex(status) { const i = CHAPTER_STAGES.findIndex(s => s.key === status); return i === -1 ? 0 : i; }
function stageMeta(status) { return CHAPTER_STAGES.find(s => s.key === status) || CHAPTER_STAGES[0]; }

// --------------------------------------------------
// 📋 GÖREV SİSTEMİ
// --------------------------------------------------
const TASK_TYPES = {
  'Çeviri':        { icon: 'fa-language',         points: 15, color: '#ffb703' },
  'Temizlik':       { icon: 'fa-eraser',           points: 10, color: '#7c9aff' },
  'Redaksiyon':     { icon: 'fa-pen-nib',          points: 10, color: '#3fd0f0' },
  'Dizgi':          { icon: 'fa-layer-group',      points: 10, color: '#ff9f6e' },
  'Kalite Kontrol': { icon: 'fa-magnifying-glass', points: 8,  color: '#ff6b9d' },
  'Raw Bulma':      { icon: 'fa-satellite-dish',   points: 5,  color: '#c9a8ff' },
  'Diğer':          { icon: 'fa-list-check',       points: 5,  color: '#a9b7cf' }
};
const TASK_STATUSES = ['Bekliyor', 'Yapılıyor', 'Tamamlandı'];
const TASK_PRIORITIES = {
  'Düşük':  { color: '#a9b7cf' },
  'Normal': { color: '#3fd0f0' },
  'Yüksek': { color: '#ffb703' },
  'Acil':   { color: '#ff6b6b' }
};

// --------------------------------------------------
// 🏅 RÜTBE SİSTEMİ (puana göre)
// --------------------------------------------------
const RANKS = [
  { min: 0,    name: 'Acemi Yolcu',      icon: 'fa-suitcase-rolling', color: '#a9b7cf' },
  { min: 80,   name: 'İkinci Pilot',     icon: 'fa-plane',            color: '#3fd0f0' },
  { min: 250,  name: 'Kaptan Pilot',     icon: 'fa-plane-up',         color: '#ffb703' },
  { min: 600,  name: 'Filo Komutanı',    icon: 'fa-tower-broadcast',  color: '#ff9f6e' },
  { min: 1200, name: 'Hava Sahası Efsanesi', icon: 'fa-star',         color: '#ffd166' }
];
function getRank(points) { let rank = RANKS[0]; for (const r of RANKS) { if (points >= r.min) rank = r; } return rank; }
function nextRank(points) { return RANKS.find(r => r.min > points) || null; }

// --------------------------------------------------
// 🖼️ PROFİL ÇERÇEVELERİ (rütbeye göre — ücretsiz)
// --------------------------------------------------
const FRAMES = [
  { key: 'none',      label: 'Yok',       min: 0 },
  { key: 'bronze',    label: 'Bronz',     min: 0 },
  { key: 'silver',    label: 'Gümüş',     min: 100 },
  { key: 'gold',      label: 'Altın',     min: 300 },
  { key: 'neon',      label: 'Neon Jet',  min: 800 },
  { key: 'legendary', label: 'Efsanevi',  min: 1500 }
];
function unlockedFrames(points) { return FRAMES.filter(f => points >= f.min); }

function defaultAvatar(username) {
  const seed = encodeURIComponent(username || 'pilot');
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}&backgroundColor=0f2040,142a52`;
}
function defaultBanner(seed) {
  const s = encodeURIComponent(seed || 'aerotoon');
  return `https://api.dicebear.com/7.x/rings/svg?seed=${s}&backgroundColor=0f2040,142a52,1c3a6e`;
}

/* ==========================================================================
   2) DÜKKAN — 30 ürün (15 çerçeve + 15 isim efekti), coin ile satın alınır
   ========================================================================== */
const FRAME_TEMPLATES = [
  { key: 'metallic', label: 'Metalik', basePrice: 150 },
  { key: 'pulse',    label: 'Nabız',   basePrice: 250 },
  { key: 'spin',     label: 'Dönen',   basePrice: 400 },
  { key: 'dashed',   label: 'Kesikli', basePrice: 600 },
  { key: 'crystal',  label: 'Kristal', basePrice: 900 }
];
const EFFECT_TEMPLATES = [
  { key: 'gradient', label: 'Gradyan',      basePrice: 150 },
  { key: 'neon',     label: 'Neon',         basePrice: 250 },
  { key: 'shimmer',  label: 'Parıltı',      basePrice: 400 },
  { key: 'glitch',   label: 'Glitch',       basePrice: 600 },
  { key: 'rainbow',  label: 'Gökkuşağı',    basePrice: 900 }
];
const SHOP_COLOR_SETS = [
  { slug: 'crimson', name: 'Kızıl Alev', c1: '#ff6b6b', c2: '#c92a2a', tier: 1 },
  { slug: 'ocean',   name: 'Okyanus',    c1: '#3fd0f0', c2: '#1c6fa0', tier: 1.3 },
  { slug: 'emerald', name: 'Zümrüt',     c1: '#3ddc97', c2: '#1f7a52', tier: 1.6 }
];
function buildShopItems() {
  const items = [];
  FRAME_TEMPLATES.forEach(t => {
    SHOP_COLOR_SETS.forEach(c => {
      items.push({
        id: `frame_${t.key}_${c.slug}`, type: 'frame', template: t.key,
        label: `${c.name} ${t.label} Çerçeve`, price: Math.round(t.basePrice * c.tier),
        c1: c.c1, c2: c.c2
      });
    });
  });
  EFFECT_TEMPLATES.forEach(t => {
    SHOP_COLOR_SETS.forEach(c => {
      items.push({
        id: `effect_${t.key}_${c.slug}`, type: 'effect', template: t.key,
        label: `${c.name} ${t.label} İsim Efekti`, price: Math.round(t.basePrice * c.tier),
        c1: c.c1, c2: c.c2
      });
    });
  });
  return items;
}
const SHOP_ITEMS = buildShopItems();
function getShopItem(id) { return SHOP_ITEMS.find(i => i.id === id); }

// Avatar çerçevesini (rütbe VEYA dükkan eşyası) HTML'e çevirir
function avatarFrameHtml(user, size = 40) {
  const avatar = (user && user.avatarUrl) || defaultAvatar(user ? user.username : 'pilot');
  const equipped = user && user.equippedFrame && user.equippedFrame !== 'none' ? getShopItem(user.equippedFrame) : null;
  if (equipped) {
    return `<span class="avatar-wrap frame-shop-${equipped.template}" style="width:${size}px;height:${size}px;--fc1:${equipped.c1};--fc2:${equipped.c2}">
        <img src="${avatar}" class="avatar-img" style="width:100%;height:100%" onerror="this.src='${defaultAvatar('x')}'">
      </span>`;
  }
  const frame = (user && user.frame) || 'none';
  return `<span class="avatar-wrap frame-${frame}" style="width:${size}px;height:${size}px">
      <img src="${avatar}" class="avatar-img" style="width:100%;height:100%" onerror="this.src='${defaultAvatar('x')}'">
    </span>`;
}
// Kullanıcı adını (dükkan isim efektiyle) HTML'e çevirir
function usernameFxHtml(user) {
  const name = escapeHtml(user ? user.username : '');
  const equipped = user && user.equippedNameEffect && user.equippedNameEffect !== 'none' ? getShopItem(user.equippedNameEffect) : null;
  if (equipped) {
    return `<span class="name-fx-${equipped.template}" style="--ec1:${equipped.c1};--ec2:${equipped.c2}">${name}</span>`;
  }
  return name;
}

/* ==========================================================================
   3) UTILS
   ========================================================================== */
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function showToast(message, type = 'info', icon = null) {
  const container = document.getElementById('toast-container');
  if (!container) { console.log(message); return; }
  const icons = { success: 'fa-circle-check', error: 'fa-triangle-exclamation', info: 'fa-tower-broadcast' };
  const colors = { success: '#3ddc97', error: '#ff6b6b', info: '#3fd0f0' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icon || icons[type] || icons.info}" style="color:${colors[type] || colors.info}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease, transform .3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

function friendlyError(err) {
  const map = {
    'auth/invalid-email': 'E-posta adresi geçersiz görünüyor.',
    'auth/user-not-found': 'Bu bilgilerle bir hesap bulunamadı.',
    'auth/wrong-password': 'Şifre hatalı.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı, biraz sonra tekrar dene.'
  };
  return map[err.code] || err.message || 'Beklenmeyen bir hata oluştu.';
}

function openModal(html, opts = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal-overlay';
  overlay.innerHTML = `<div class="modal-box ${opts.wide ? 'max-w-4xl' : 'max-w-lg'} w-full my-auto">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay && !opts.persistent) closeModal(); });
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  return overlay;
}
function closeModal() {
  const existing = document.getElementById('active-modal-overlay');
  if (existing) existing.remove();
  document.body.style.overflow = '';
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return Math.floor(diff / 60) + ' dk önce';
  if (diff < 86400) return Math.floor(diff / 3600) + ' sa önce';
  return Math.floor(diff / 86400) + ' gün önce';
}

function fileToCompressedBase64(file, maxSize = 300) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height *= maxSize / width; width = maxSize; }
        else if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function rankBadgeHtml(points) {
  const rank = getRank(points || 0);
  return `<span class="rank-badge" style="background:${rank.color}22;color:${rank.color};border:1px solid ${rank.color}55">
      <i class="fa-solid ${rank.icon}"></i> ${rank.label}
    </span>`;
}

// Tüm rolleri gösterir (profil modalında kullanılır)
function roleBadgesHtml(user) {
  const roles = (user && user.roles && user.roles.length) ? user.roles : ['member'];
  return roles.map(r => {
    const meta = ROLES[r] || ROLES.member;
    return `<span class="rank-badge" style="background:${meta.color}22;color:${meta.color};border:1px solid ${meta.color}55">
        <i class="fa-solid ${meta.icon}"></i> ${meta.label}
      </span>`;
  }).join(' ');
}

function coinBadgeHtml(coins) {
  return `<span class="rank-badge" style="background:#ffd16622;color:#ffd166;border:1px solid #ffd16655">
      <i class="fa-solid fa-coins"></i> ${coins || 0}
    </span>`;
}

function debounce(fn, wait = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function byId(id) { return document.getElementById(id); }

/* ==========================================================================
   4) AUTH — Giriş / Kayıt / Çıkış + oturum takibi
   ========================================================================== */
function toggleAuthMode() {
  const modeInput = byId('auth-mode');
  const mode = modeInput.value;
  const title = byId('auth-wall-title');
  const usernameField = byId('username-field');
  const submitBtn = byId('auth-submit-btn');
  const toggleText = byId('modal-toggle-text');
  const toggleBtn = byId('modal-toggle-btn');

  if (mode === 'login') {
    modeInput.value = 'register';
    title.innerText = 'Ekibe Katıl';
    usernameField.classList.remove('hidden');
    submitBtn.innerText = 'Kayıt Ol ve Uçuşa Geç';
    toggleText.innerText = 'Zaten bir hesabın var mı?';
    toggleBtn.innerText = 'Giriş Yap';
  } else {
    modeInput.value = 'login';
    title.innerText = 'Kokpite Hoş Geldin';
    usernameField.classList.add('hidden');
    submitBtn.innerText = 'Giriş Yap';
    toggleText.innerText = 'Hesabın yok mu?';
    toggleBtn.innerText = 'Ekibe Katıl';
  }
}

function freshProfileData(uid, username, email) {
  return {
    uid, username, email,
    role: 'member',
    roles: ['member'],
    avatarUrl: defaultAvatar(username),
    bannerUrl: '',
    frame: 'none',
    bio: '',
    points: 0,
    completedTasks: 0,
    coins: 100, // 🪙 başlangıç coin'i
    equippedFrame: 'none',
    equippedNameEffect: 'none',
    inventory: [],
    favoriteSeries: [],
    gameStats: { xoxPlayed: 0, xoxWins: 0, xoxLosses: 0, xoxDraws: 0 },
    createdAt: FieldValue.serverTimestamp()
  };
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const mode = byId('auth-mode').value;
  const email = byId('auth-email').value.trim();
  const password = byId('auth-password').value;
  const username = byId('auth-username').value.trim();
  const submitBtn = byId('auth-submit-btn');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> İşleniyor...';

  try {
    if (mode === 'register') {
      if (!username) throw { message: 'Lütfen bir kullanıcı adı gir.' };
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const user = cred.user;
      const profile = freshProfileData(user.uid, username, email);
      await db.collection('users').doc(user.uid).set(profile);
      showToast(`Aramıza hoş geldin, ${username}! ✈️ 100 coin hediye edildi 🪙`, 'success');
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    showToast(friendlyError(error), 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = mode === 'register' ? 'Kayıt Ol ve Uçuşa Geç' : 'Giriş Yap';
  }
}

function logout() {
  Object.values(STATE.unsub).forEach(u => { try { u(); } catch (e) {} });
  STATE.unsub = {};
  localStorage.removeItem('aerotoon_profile_cache');
  auth.signOut().then(() => location.reload());
}

// Navbar rol rozeti — SADECE en yüksek öncelikli rolü gösterir (spam engellenir)
function renderRoleBadge(profile) {
  const roleBadge = byId('current-user-role');
  if (!roleBadge) return;
  const roles = (profile.roles && profile.roles.length) ? profile.roles : [profile.role || 'member'];
  const topRole = getTopRole(profile);
  const meta = ROLES[topRole] || ROLES.member;
  const extra = roles.length > 1 ? ` <span class="opacity-60">+${roles.length - 1}</span>` : '';
  roleBadge.innerHTML = `<span class="rank-badge ml-1" style="background:${meta.color}22;color:${meta.color};border:1px solid ${meta.color}55" title="${roles.map(r => (ROLES[r] || ROLES.member).label).join(', ')}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}${extra}</span>`;
}

function applyProfileToNav(profile) {
  const nameEl = byId('current-username');
  if (nameEl) nameEl.innerHTML = usernameFxHtml(profile) || 'Pilot';
  renderRoleBadge(profile);
  byId('nav-avatar').innerHTML = avatarFrameHtml(profile, 36);
  const isAdmin = (profile.roles || [profile.role]).includes('admin');
  byId('admin-panel-btn').classList.toggle('hidden', !isAdmin);
  const navTasks = byId('nav-tasks-badge');
  if (navTasks) navTasks.classList.toggle('hidden', !STAFF_ROLES.some(r => (profile.roles || []).includes(r)));
  const coinEl = byId('nav-coin-balance');
  if (coinEl) coinEl.innerText = profile.coins || 0;
}

// --------------------------------------------------
// 🔒 OTURUM İZLEYİCİ
// --------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  const authWall = byId('auth-wall');
  const appArea = byId('app-area');

  if (user) {
    STATE.currentUser = user;
    authWall.classList.add('hidden');
    appArea.classList.remove('hidden');
    appArea.classList.add('flex');

    try {
      const cached = JSON.parse(localStorage.getItem('aerotoon_profile_cache') || 'null');
      if (cached && cached.uid === user.uid) applyProfileToNav(cached);
    } catch (e) {}

    let userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      const fallbackProfile = freshProfileData(user.uid, user.email.split('@')[0], user.email);
      await db.collection('users').doc(user.uid).set(fallbackProfile);
      userDoc = await db.collection('users').doc(user.uid).get();
    }

    const profile = { id: userDoc.id, ...userDoc.data() };
    if (!profile.roles) profile.roles = [profile.role || 'member'];
    if (profile.coins === undefined) profile.coins = 100;
    if (!profile.gameStats) profile.gameStats = { xoxPlayed: 0, xoxWins: 0, xoxLosses: 0, xoxDraws: 0 };
    if (!profile.favoriteSeries) profile.favoriteSeries = [];
    if (!profile.inventory) profile.inventory = [];
    STATE.profile = profile;
    localStorage.setItem('aerotoon_profile_cache', JSON.stringify(profile));
    applyProfileToNav(profile);

    initAllData();
  } else {
    STATE.currentUser = null;
    STATE.profile = null;
    Object.values(STATE.unsub).forEach(u => { try { u(); } catch (e) {} });
    STATE.unsub = {};
    authWall.classList.remove('hidden');
    appArea.classList.add('hidden');
  }
});

/* ==========================================================================
   5) DATA — Firestore gerçek zamanlı dinleyiciler
   ========================================================================== */
function initAllData() {
  listenUsers();
  listenSeries();
  listenChapters();
  listenTasks();
  listenAchievements();
  listenUserAchievements();
  listenUiConfig();
}

function listenUsers() {
  if (STATE.unsub.users) STATE.unsub.users();
  STATE.unsub.users = db.collection('users').onSnapshot(snap => {
    STATE.users = {};
    STATE.usersByUsername = {};
    snap.forEach(doc => {
      const d = { id: doc.id, ...doc.data() };
      if (!d.roles) d.roles = [d.role || 'member'];
      if (d.coins === undefined) d.coins = 0;
      STATE.users[doc.id] = d;
      STATE.usersByUsername[d.username] = d;
      if (STATE.currentUser && doc.id === STATE.currentUser.uid) {
        STATE.profile = d;
        applyProfileToNav(d);
        localStorage.setItem('aerotoon_profile_cache', JSON.stringify(d));
      }
    });
    refreshCurrentView('users');
  }, err => console.error('users listener:', err));
}

function listenSeries() {
  if (STATE.unsub.series) STATE.unsub.series();
  STATE.unsub.series = db.collection('series').orderBy('createdAt', 'desc').onSnapshot(snap => {
    STATE.series = {};
    snap.forEach(doc => { STATE.series[doc.id] = { id: doc.id, ...doc.data() }; });
    refreshCurrentView('series');
  }, err => console.error('series listener:', err));
}

function listenChapters() {
  if (STATE.unsub.chapters) STATE.unsub.chapters();
  STATE.unsub.chapters = db.collection('chapters').orderBy('lastUpdated', 'desc').onSnapshot(snap => {
    STATE.chapters = {};
    snap.forEach(doc => { STATE.chapters[doc.id] = { id: doc.id, ...doc.data() }; });
    refreshCurrentView('chapters');
  }, err => console.error('chapters listener:', err));
}

function listenTasks() {
  if (STATE.unsub.tasks) STATE.unsub.tasks();
  STATE.unsub.tasks = db.collection('tasks').orderBy('createdAt', 'desc').onSnapshot(snap => {
    STATE.tasks = {};
    snap.forEach(doc => { STATE.tasks[doc.id] = { id: doc.id, ...doc.data() }; });
    refreshCurrentView('tasks');
  }, err => console.error('tasks listener:', err));
}

function listenAchievements() {
  if (STATE.unsub.achievements) STATE.unsub.achievements();
  STATE.unsub.achievements = db.collection('achievements').onSnapshot(snap => {
    STATE.achievements = {};
    snap.forEach(doc => { STATE.achievements[doc.id] = { id: doc.id, ...doc.data() }; });
    if (snap.empty) seedDefaultAchievements();
    refreshCurrentView('achievements');
  }, err => console.error('achievements listener:', err));
}

function listenUserAchievements() {
  if (STATE.unsub.userAch) STATE.unsub.userAch();
  STATE.unsub.userAch = db.collection('userAchievements').onSnapshot(snap => {
    STATE.userAchievements = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (!STATE.userAchievements[d.uid]) STATE.userAchievements[d.uid] = new Set();
      STATE.userAchievements[d.uid].add(d.achievementId);
    });
    refreshCurrentView('userAchievements');
  }, err => console.error('userAchievements listener:', err));
}

function listenUiConfig() {
  if (STATE.unsub.ui) STATE.unsub.ui();
  STATE.unsub.ui = db.collection('settings').doc('ui_config').onSnapshot(doc => {
    STATE.uiConfig = doc.exists ? doc.data() : {};
    applyUiConfig();
  }, err => console.error('uiConfig listener:', err));
}

function refreshCurrentView(source) {
  calculateStats();
  const view = STATE.currentView;
  if (view === 'dashboard-view') { renderChaptersTable(); }
  if (view === 'series-view') { renderSeriesGrid(); }
  if (view === 'tasks-view') { renderMyTasks(); }
  if (view === 'leaderboard-view') { renderLeaderboard(); }
  if (view === 'achievements-view') { renderAchievementsGrid(); }
  if (view === 'shop-view') { renderShopGrid(); }
  if (view === 'admin-view' && typeof refreshActiveAdminTab === 'function') { refreshActiveAdminTab(source); }
  populateSeriesSelectors();
  if (STATE.currentSeriesDetailId) renderSeriesDetailModalContent(STATE.currentSeriesDetailId);
  if (typeof checkAutoAchievements === 'function') checkAutoAchievements();
}

function calculateStats() {
  const seriesCount = Object.keys(STATE.series).length;
  const chapters = Object.values(STATE.chapters);
  const active = chapters.filter(c => c.status !== 'Tamamlandı').length;
  const done = chapters.filter(c => c.status === 'Tamamlandı').length;
  const tasks = Object.values(STATE.tasks);
  const pendingTasks = tasks.filter(t => t.status !== 'Tamamlandı').length;

  if (byId('stat-total-series')) byId('stat-total-series').innerText = seriesCount;
  if (byId('stat-active-chapters')) byId('stat-active-chapters').innerText = active;
  if (byId('stat-completed-chapters')) byId('stat-completed-chapters').innerText = done;
  if (byId('stat-pending-tasks')) byId('stat-pending-tasks').innerText = pendingTasks;
}

async function seedDefaultAchievements() {
  const isAdmin = STATE.profile && (STATE.profile.roles || []).includes('admin');
  if (!isAdmin) return;
  const already = await db.collection('achievements').limit(1).get();
  if (!already.empty) return;
  const defaults = [
    { name: 'İlk Uçuş', description: 'İlk görevini tamamladın.', icon: 'fa-plane-departure', color: '#3fd0f0', type: 'auto', metric: 'completedTasks', threshold: 1 },
    { name: 'Yol Aşinası', description: '10 görev tamamladın.', icon: 'fa-route', color: '#ffb703', type: 'auto', metric: 'completedTasks', threshold: 10 },
    { name: 'Kıdemli Mürettebat', description: '50 görev tamamladın.', icon: 'fa-user-astronaut', color: '#ff9f6e', type: 'auto', metric: 'completedTasks', threshold: 50 },
    { name: 'Hava Sahası Efsanesi', description: '1200 puana ulaştın.', icon: 'fa-star', color: '#ffd166', type: 'auto', metric: 'points', threshold: 1200 },
    { name: 'Takım Ruhu', description: 'Ekibe olan katkısı için özel olarak takdir edildi.', icon: 'fa-hand-holding-heart', color: '#3ddc97', type: 'manual' },
    { name: 'Mükemmeliyetçi', description: 'Kalite kontrolde gösterdiği titizlik için ödüllendirildi.', icon: 'fa-gem', color: '#c9a8ff', type: 'manual' },
    { name: 'Kumarbaz Pilot', description: 'Oyunlardan ilk kez coin kazandın.', icon: 'fa-dice', color: '#ff9f6e', type: 'manual' }
  ];
  const batch = db.batch();
  defaults.forEach(a => {
    const ref = db.collection('achievements').doc();
    batch.set(ref, { ...a, createdAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
}

function populateSeriesSelectors() {
  const seriesList = Object.values(STATE.series).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  document.querySelectorAll('.series-select-target').forEach(sel => {
    const currentVal = sel.value;
    const keepAll = sel.dataset.keepAll === 'true';
    sel.innerHTML = (keepAll ? '<option value="all">Tüm Seriler</option>' : '') +
      seriesList.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    if ([...sel.options].some(o => o.value === currentVal)) sel.value = currentVal;
  });
}

/* ==========================================================================
   6) UI — Görünüm geçişleri, bölüm tablosu, seri kartları, seri detay modalı
   ========================================================================== */
const VIEW_IDS = ['dashboard-view', 'series-view', 'tasks-view', 'leaderboard-view', 'achievements-view', 'games-view', 'shop-view', 'admin-view'];

function toggleView(viewId) {
  VIEW_IDS.forEach(v => byId(v) && byId(v).classList.add('hidden'));
  byId(viewId).classList.remove('hidden');
  STATE.currentView = viewId;

  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector(`.nav-link[data-view="${viewId}"]`);
  if (navEl) navEl.classList.add('active');

  if (viewId === 'series-view') renderSeriesGrid();
  if (viewId === 'dashboard-view') renderChaptersTable();
  if (viewId === 'tasks-view') renderMyTasks();
  if (viewId === 'leaderboard-view') renderLeaderboard();
  if (viewId === 'achievements-view') renderAchievementsGrid();
  if (viewId === 'shop-view') renderShopGrid();
  if (viewId === 'games-view') renderGamesHub();
  if (viewId === 'admin-view') { initAdminPanel(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyUiConfig() {
  const cfg = STATE.uiConfig || {};
  byId('nav-site-title').innerText = cfg.siteTitle || 'AEROTOON';
  byId('footer-site-title').innerText = cfg.siteTitle || 'AEROTOON';
  byId('dashboard-welcome-title').innerText = cfg.welcomeTitle || 'Uçuş Kontrol Kulesi';
  byId('dashboard-welcome-desc').innerText = cfg.welcomeDesc || 'Ekibin tüm bölüm durumları ve görev dağılımları burada.';
  document.title = (cfg.siteTitle || 'AEROTOON') + ' | Ekip Kontrol Paneli';

  const logoWrap = byId('nav-logo-wrap');
  if (cfg.logoUrl) {
    logoWrap.innerHTML = `<img src="${cfg.logoUrl}" class="w-10 h-10 rounded-xl object-cover">`;
  } else {
    logoWrap.innerHTML = `<span class="theme-primary-bg p-2.5 rounded-xl text-white text-lg font-bold"><i class="fa-solid fa-plane"></i></span>`;
  }
  if (cfg.accentColor) document.documentElement.style.setProperty('--accent-cyan', cfg.accentColor);

  if (byId('ui-site-title')) {
    byId('ui-site-title').value = cfg.siteTitle || '';
    byId('ui-welcome-title').value = cfg.welcomeTitle || '';
    byId('ui-welcome-desc').value = cfg.welcomeDesc || '';
    if (byId('ui-accent-color')) byId('ui-accent-color').value = cfg.accentColor || '#3fd0f0';
    if (byId('ui-logo-preview') && cfg.logoUrl) byId('ui-logo-preview').src = cfg.logoUrl;
  }
}

// --------------------------------------------------
// 📊 BÖLÜM TABLOSU (Dashboard) — rol yoksa KİLİTLİ
// --------------------------------------------------
function renderChaptersTable() {
  const tbody = byId('chapters-table-body');
  if (!tbody) return;

  if (!hasStaffRole(STATE.profile)) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-400">
        <i class="fa-solid fa-lock text-2xl mb-3 block text-amber-300"></i>
        Henüz bir ekip rolün yok.<br>
        <span class="text-xs text-gray-500">Bölümleri ve serileri görebilmen için bir yöneticinin sana rol atamasını bekle. ✈️</span></td></tr>`;
    const filterSel = byId('filter-series'); if (filterSel) filterSel.classList.add('hidden');
    return;
  }
  const filterSel = byId('filter-series'); if (filterSel) filterSel.classList.remove('hidden');

  const filterVal = byId('filter-series') ? byId('filter-series').value : 'all';
  let chapters = Object.values(STATE.chapters);
  if (filterVal && filterVal !== 'all') chapters = chapters.filter(c => c.seriesId === filterVal);

  if (!chapters.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-500">
        <i class="fa-solid fa-cloud text-2xl mb-2 block"></i> Henüz kayıtlı bölüm yok.</td></tr>`;
    return;
  }

  const canEdit = STATE.profile && STAFF_ROLES.some(r => (STATE.profile.roles || []).includes(r));

  tbody.innerHTML = chapters.map(ch => {
    const meta = stageMeta(ch.status);
    const linkBtn = ch.folderUrl
      ? `<a href="${ch.folderUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:underline"><i class="fa-solid fa-folder-open"></i> Aç</a>`
      : `<span class="text-xs text-gray-600">—</span>`;

    let actionCell = `<span class="text-xs text-gray-600">—</span>`;
    if (canEdit) {
      actionCell = `<select class="input-field text-xs rounded-lg p-1.5" onchange="updateChapterStatus('${ch.id}', this.value)">
          ${CHAPTER_STAGES.map(s => `<option value="${s.key}" ${ch.status === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>`;
    }

    return `<tr class="hover:bg-white/[0.02] transition cursor-pointer" onclick="if(event.target.tagName!=='SELECT' && event.target.tagName!=='A') openSeriesDetail('${ch.seriesId}')">
        <td class="p-4 font-bold text-white">${escapeHtml(ch.seriesName)}</td>
        <td class="p-4 font-mono">#${ch.chapterNumber}</td>
        <td class="p-4 text-gray-300 text-xs">${escapeHtml(ch.translator || 'Atanmadı')}</td>
        <td class="p-4 text-gray-300 text-xs">${escapeHtml(ch.editor || 'Atanmadı')}</td>
        <td class="p-4"><span class="status-pill ${meta.cls}"><span class="dot"></span>${meta.label}</span></td>
        <td class="p-4">${linkBtn}</td>
        <td class="p-4 text-right" onclick="event.stopPropagation()">${actionCell}</td>
      </tr>`;
  }).join('');
}

async function updateChapterStatus(chapterId, newStatus) {
  try {
    await db.collection('chapters').doc(chapterId).update({ status: newStatus, lastUpdated: FieldValue.serverTimestamp() });
    showToast(`Bölüm durumu güncellendi: ${newStatus}`, 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

// --------------------------------------------------
// 🖼️ SERİ KARTLARI — rol yoksa KİLİTLİ
// --------------------------------------------------
function renderSeriesGrid() {
  const container = byId('series-grid-container');
  if (!container) return;

  if (!hasStaffRole(STATE.profile)) {
    container.innerHTML = `<div class="col-span-full glass-panel rounded-2xl p-12 text-center text-gray-400">
        <i class="fa-solid fa-lock text-3xl mb-4 block text-amber-300"></i>
        <p class="font-bold text-white mb-1">Bu alan ekip üyelerine özel</p>
        <p class="text-xs text-gray-500">Herhangi bir ekip rolün (çevirmen, dizgici, editör vb.) bulunmuyor.<br>
        Serileri görebilmen için lütfen bir yöneticinin sana rol atamasını bekle. Rol atandığında burası otomatik açılacak. ✈️</p>
      </div>`;
    return;
  }

  const seriesList = Object.values(STATE.series);
  if (!seriesList.length) {
    container.innerHTML = `<div class="col-span-full text-center text-gray-500 py-16">
        <i class="fa-solid fa-cloud-sun text-3xl mb-3 block"></i> Henüz seri eklenmedi.</div>`;
    return;
  }

  const myFavs = STATE.profile ? (STATE.profile.favoriteSeries || []) : [];

  container.innerHTML = seriesList.map(s => {
    const chapters = Object.values(STATE.chapters).filter(c => c.seriesId === s.id);
    const doneCount = chapters.filter(c => c.status === 'Tamamlandı').length;
    const pct = chapters.length ? Math.round((doneCount / chapters.length) * 100) : 0;
    const statusColor = { 'Devam Ediyor': '#3ddc97', 'Durduruldu': '#ff6b6b', 'Beklemede': '#ffb703', 'Tamamlandı': '#3fd0f0' }[s.status] || '#a9b7cf';
    const isFav = myFavs.includes(s.id);

    return `<div class="glass-panel rounded-2xl overflow-hidden panel-elevated hover-lift flex flex-col h-full cursor-pointer" onclick="openSeriesDetail('${s.id}')">
        <div class="h-56 overflow-hidden relative">
          <img src="${s.coverUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500'}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500'">
          <div class="absolute inset-0 bg-gradient-to-t from-[#050b18] via-transparent to-transparent"></div>
          <span class="absolute top-3 right-3 status-pill" style="color:${statusColor};border-color:${statusColor}55;background:${statusColor}18"><span class="dot"></span>${escapeHtml(s.status || 'Devam Ediyor')}</span>
          <button onclick="event.stopPropagation(); toggleFavoriteSeries('${s.id}')" class="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-sm ${isFav ? 'text-red-400' : 'text-white/70'}" title="Favorilere ekle/çıkar">
            <i class="fa-solid fa-heart"></i>
          </button>
          <h3 class="absolute bottom-3 left-4 right-4 text-lg font-bold text-white font-display leading-tight">${escapeHtml(s.name)}</h3>
        </div>
        <div class="p-5 flex-grow flex flex-col justify-between gap-4">
          <p class="text-xs text-gray-400 line-clamp-2">${escapeHtml(s.description || 'Açıklama girilmedi.')}</p>
          <div>
            <div class="flex justify-between text-[11px] text-gray-400 mb-1 font-mono"><span>İLERLEME</span><span>${doneCount}/${chapters.length} · %${pct}</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="border-t border-white/5 pt-3 text-[11px] text-gray-300 grid grid-cols-2 gap-y-1.5">
            <div class="flex items-center gap-1.5"><i class="fa-solid fa-language text-amber-400 w-3.5"></i> ${escapeHtml(s.team?.translator || 'Atanmadı')}</div>
            <div class="flex items-center gap-1.5"><i class="fa-solid fa-eraser text-indigo-300 w-3.5"></i> ${escapeHtml(s.team?.cleaner || 'Atanmadı')}</div>
            <div class="flex items-center gap-1.5"><i class="fa-solid fa-pen-nib text-cyan-400 w-3.5"></i> ${escapeHtml(s.team?.editor || 'Atanmadı')}</div>
            <div class="flex items-center gap-1.5"><i class="fa-solid fa-layer-group text-orange-400 w-3.5"></i> ${escapeHtml(s.team?.typesetter || 'Atanmadı')}</div>
            <div class="flex items-center gap-1.5"><i class="fa-solid fa-magnifying-glass text-pink-400 w-3.5"></i> ${escapeHtml(s.team?.qc || 'Atanmadı')}</div>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function toggleFavoriteSeries(seriesId) {
  if (!STATE.profile) return;
  const favs = new Set(STATE.profile.favoriteSeries || []);
  const willAdd = !favs.has(seriesId);
  try {
    await db.collection('users').doc(STATE.profile.id).update({
      favoriteSeries: willAdd ? FieldValue.arrayUnion(seriesId) : FieldValue.arrayRemove(seriesId)
    });
    showToast(willAdd ? 'Favorilere eklendi ❤️' : 'Favorilerden çıkarıldı', 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

// --------------------------------------------------
// 🔍 SERİ DETAY MODALI
// --------------------------------------------------
function openSeriesDetail(seriesId) {
  if (!hasStaffRole(STATE.profile)) { showToast('Bu alanı görüntülemek için bir ekip rolüne ihtiyacın var.', 'error'); return; }
  STATE.currentSeriesDetailId = seriesId;
  openModal(`<div id="series-detail-modal-body"></div>`, { wide: true, persistent: false });
  renderSeriesDetailModalContent(seriesId);
}

function renderSeriesDetailModalContent(seriesId) {
  const body = byId('series-detail-modal-body');
  if (!body) { STATE.currentSeriesDetailId = null; return; }
  const s = STATE.series[seriesId];
  if (!s) { body.innerHTML = `<div class="glass-panel rounded-2xl p-8 text-center text-gray-400">Bu seri artık mevcut değil.</div>`; return; }

  const chapters = Object.values(STATE.chapters)
    .filter(c => c.seriesId === seriesId)
    .sort((a, b) => b.chapterNumber - a.chapterNumber);
  const doneCount = chapters.filter(c => c.status === 'Tamamlandı').length;
  const pct = chapters.length ? Math.round((doneCount / chapters.length) * 100) : 0;

  const teamRows = ASSIGNABLE_ROLES.map(r => {
    const meta = ROLES[r];
    const name = s.team?.[r] || 'Atanmadı';
    return `<div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
        <span class="flex items-center gap-2 text-xs text-gray-300"><i class="fa-solid ${meta.icon}" style="color:${meta.color}"></i> ${meta.label}</span>
        <span class="text-xs font-semibold text-white">${escapeHtml(name)}</span>
      </div>`;
  }).join('');

  const isFav = STATE.profile && (STATE.profile.favoriteSeries || []).includes(seriesId);

  body.innerHTML = `
    <div class="glass-panel rounded-2xl overflow-hidden panel-elevated">
      <div class="h-64 relative">
        <img src="${s.coverUrl || ''}" class="w-full h-full object-cover" onerror="this.style.display='none'">
        <div class="absolute inset-0 bg-gradient-to-t from-[#050b18] to-transparent"></div>
        <button class="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center" onclick="closeModal(); STATE.currentSeriesDetailId=null;"><i class="fa-solid fa-xmark"></i></button>
        <button class="absolute top-4 right-16 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center ${isFav ? 'text-red-400' : 'text-white'}" onclick="toggleFavoriteSeries('${s.id}')"><i class="fa-solid fa-heart"></i></button>
        <div class="absolute bottom-4 left-6 right-6">
          <h2 class="text-2xl font-black font-display text-white">${escapeHtml(s.name)}</h2>
          <p class="text-xs text-gray-300 mt-1">${escapeHtml(s.genre || 'Tür belirtilmedi')} · ${escapeHtml(s.status || 'Devam Ediyor')}</p>
        </div>
      </div>
      <div class="p-6 space-y-6">
        <p class="text-sm text-gray-300 leading-relaxed">${escapeHtml(s.description || 'Açıklama girilmedi.')}</p>
        <div>
          <div class="flex justify-between text-[11px] text-gray-400 mb-1.5 font-mono"><span>SERİ İLERLEMESİ</span><span>${doneCount}/${chapters.length} bölüm · %${pct}</span></div>
          <div class="progress-track h-2"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Ekip</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${teamRows}</div>
        </div>
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Bölümler</h4>
          <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
            ${chapters.length ? chapters.map(ch => {
              const meta = stageMeta(ch.status);
              const idx = stageIndex(ch.status);
              return `<div class="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-mono font-bold text-sm">Bölüm #${ch.chapterNumber}</span>
                    <span class="status-pill ${meta.cls}"><span class="dot"></span>${meta.label}</span>
                  </div>
                  <div class="stage-track gap-1 mb-2">
                    ${CHAPTER_STAGES.map((st, i) => `<div class="stage-line"><div class="fill" style="width:${i <= idx ? 100 : 0}%"></div></div>`).join('')}
                  </div>
                  ${ch.folderUrl ? `<a href="${ch.folderUrl}" target="_blank" class="text-xs text-cyan-300 hover:underline inline-flex items-center gap-1"><i class="fa-solid fa-folder-open"></i> Çalışma klasörünü aç</a>` : `<span class="text-xs text-gray-600">Klasör bağlantısı yok</span>`}
                </div>`;
            }).join('') : `<p class="text-xs text-gray-500 text-center py-6">Bu seri için henüz bölüm eklenmedi.</p>`}
          </div>
        </div>
      </div>
    </div>`;
}

/* ==========================================================================
   7) TASKS — "Görevlerim" paneli
   ========================================================================== */
function myTasks() {
  if (!STATE.profile) return [];
  return Object.values(STATE.tasks).filter(t => t.assignedToUid === STATE.profile.id);
}

function renderMyTasks() {
  const root = byId('tasks-view');
  if (!root || root.classList.contains('hidden')) return;
  const profile = STATE.profile;
  if (!profile) return;

  const tasks = myTasks();
  const todo = tasks.filter(t => t.status === 'Bekliyor');
  const doing = tasks.filter(t => t.status === 'Yapılıyor');
  const done = tasks.filter(t => t.status === 'Tamamlandı');

  byId('tasks-stat-todo').innerText = todo.length;
  byId('tasks-stat-doing').innerText = doing.length;
  byId('tasks-stat-done').innerText = done.length;
  byId('tasks-stat-points').innerText = profile.points || 0;

  const renderCard = (t) => {
    const typeMeta = TASK_TYPES[t.taskType] || TASK_TYPES['Diğer'];
    const prMeta = TASK_PRIORITIES[t.priority] || TASK_PRIORITIES['Normal'];
    return `<div class="glass-panel rounded-xl p-4 space-y-2.5 hover-lift">
        <div class="flex items-start justify-between gap-2">
          <span class="flex items-center gap-2 text-xs font-bold" style="color:${typeMeta.color}"><i class="fa-solid ${typeMeta.icon}"></i>${escapeHtml(t.taskType)}</span>
          <span class="rank-badge" style="background:${prMeta.color}22;color:${prMeta.color};border:1px solid ${prMeta.color}55">${escapeHtml(t.priority || 'Normal')}</span>
        </div>
        <p class="text-sm font-semibold text-white">${escapeHtml(t.seriesName)} ${t.chapterNumber ? '· Bölüm #' + t.chapterNumber : ''}</p>
        ${t.description ? `<p class="text-xs text-gray-400">${escapeHtml(t.description)}</p>` : ''}
        <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-white/5">
          <span><i class="fa-solid fa-star text-amber-400"></i> ${t.points || 0} puan</span>
          <span>${t.dueDate ? 'Son tarih: ' + t.dueDate : timeAgo(t.createdAt)}</span>
        </div>
        <div class="flex gap-2 pt-1">
          ${t.status !== 'Bekliyor' ? `<button class="btn-ghost text-xs px-3 py-1.5 rounded-lg flex-1" onclick="setTaskStatus('${t.id}','Bekliyor')">Beklet</button>` : ''}
          ${t.status !== 'Yapılıyor' ? `<button class="btn-ghost text-xs px-3 py-1.5 rounded-lg flex-1" onclick="setTaskStatus('${t.id}','Yapılıyor')"><i class="fa-solid fa-play mr-1"></i>Başla</button>` : ''}
          ${t.status !== 'Tamamlandı' ? `<button class="btn-primary text-xs px-3 py-1.5 rounded-lg flex-1" onclick="setTaskStatus('${t.id}','Tamamlandı')"><i class="fa-solid fa-check mr-1"></i>Tamamla</button>` : `<span class="text-xs text-emerald-400 flex items-center gap-1 flex-1 justify-center"><i class="fa-solid fa-circle-check"></i> Tamamlandı</span>`}
        </div>
      </div>`;
  };

  const fillCol = (id, list, emptyText) => {
    byId(id).innerHTML = list.length ? list.map(renderCard).join('') : `<p class="text-xs text-gray-600 text-center py-8 col-span-full">${emptyText}</p>`;
  };
  fillCol('tasks-col-todo', todo, 'Yapılması gereken görev yok. Hava sakin. 🌤️');
  fillCol('tasks-col-doing', doing, 'Şu anda aktif bir görev yok.');
  fillCol('tasks-col-done', done, 'Henüz tamamlanan görev yok.');
}

async function setTaskStatus(taskId, newStatus) {
  const task = STATE.tasks[taskId];
  if (!task) return;
  try {
    const update = { status: newStatus };
    if (newStatus === 'Tamamlandı') update.completedAt = FieldValue.serverTimestamp();
    await db.collection('tasks').doc(taskId).update(update);

    if (newStatus === 'Tamamlandı' && task.status !== 'Tamamlandı') {
      const userRef = db.collection('users').doc(task.assignedToUid);
      await userRef.update({
        points: FieldValue.increment(task.points || 0),
        completedTasks: FieldValue.increment(1)
      });
      showToast(`Görev tamamlandı! +${task.points || 0} puan kazandın 🎉`, 'success', 'fa-star');
    } else {
      showToast('Görev durumu güncellendi.', 'info');
    }
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

/* ==========================================================================
   8) PROFILE — Profil özelleştirme (banner / avatar / çerçeve / bio /
      favoriler / coin transferi) + Sıralama (leaderboard)
   ========================================================================== */
function openProfileModal(uid = null) {
  const targetId = uid || (STATE.profile ? STATE.profile.id : null);
  if (!targetId) return;
  const user = STATE.users[targetId] || STATE.profile;
  const isSelf = STATE.profile && targetId === STATE.profile.id;
  const rank = getRank(user.points || 0);
  const next = nextRank(user.points || 0);
  const unlocked = unlockedFrames(user.points || 0);
  const myAchIds = STATE.userAchievements[targetId] || new Set();
  const achList = Object.values(STATE.achievements);
  const ownedFrames = (user.inventory || []).map(id => getShopItem(id)).filter(i => i && i.type === 'frame');
  const ownedEffects = (user.inventory || []).map(id => getShopItem(id)).filter(i => i && i.type === 'effect');
  const favSeries = (user.favoriteSeries || []).map(id => STATE.series[id]).filter(Boolean);

  openModal(`
    <div class="glass-panel rounded-2xl panel-elevated overflow-hidden">
      <div class="profile-banner" style="background-image:url('${user.bannerUrl || defaultBanner(user.username)}')">
        <div class="profile-banner-fade"></div>
        <button class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button>
        <div class="profile-banner-avatar">${avatarFrameHtml(user, 84)}</div>
      </div>
      <div class="p-6 pt-12 space-y-5">
        <div>
          <p class="text-lg font-bold text-white">${usernameFxHtml(user)}</p>
          <div class="flex flex-wrap gap-1.5 mt-1.5">${roleBadgesHtml(user)}</div>
          <div class="mt-1.5 flex items-center gap-2 flex-wrap">${rankBadgeHtml(user.points || 0)}${coinBadgeHtml(user.coins)}</div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="glass-panel rounded-xl p-3"><p class="text-lg font-bold font-mono text-cyan-300">${user.points || 0}</p><p class="text-[10px] text-gray-500 uppercase">Puan</p></div>
          <div class="glass-panel rounded-xl p-3"><p class="text-lg font-bold font-mono text-emerald-300">${user.completedTasks || 0}</p><p class="text-[10px] text-gray-500 uppercase">Tamamlanan Görev</p></div>
          <div class="glass-panel rounded-xl p-3"><p class="text-lg font-bold font-mono text-amber-300">${myAchIds.size}</p><p class="text-[10px] text-gray-500 uppercase">Başarım</p></div>
        </div>

        ${next ? `<div>
            <div class="flex justify-between text-[11px] text-gray-400 mb-1 font-mono"><span>SONRAKİ RÜTBE: ${next.name}</span><span>${user.points || 0}/${next.min}</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.round(((user.points || 0) / next.min) * 100))}%"></div></div>
          </div>` : `<p class="text-xs text-center text-amber-300"><i class="fa-solid fa-star"></i> En üst rütbeye ulaştı!</p>`}

        ${!isSelf ? `<button class="btn-primary w-full py-2.5 rounded-xl font-bold text-sm" onclick="openTransferModal('${user.username}')"><i class="fa-solid fa-money-bill-transfer mr-1.5"></i>Coin Gönder</button>` : ''}

        ${favSeries.length ? `<div class="border-t border-white/5 pt-4">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2"><i class="fa-solid fa-heart text-red-400"></i> Favori Seriler</h4>
            <div class="flex flex-wrap gap-2">
              ${favSeries.map(s => `<span class="rank-badge cursor-pointer" style="background:rgba(255,255,255,0.05);border:1px solid var(--line)" onclick="closeModal(); openSeriesDetail('${s.id}')">${escapeHtml(s.name)}</span>`).join('')}
            </div>
          </div>` : ''}

        ${isSelf ? `
        <form onsubmit="saveProfileEdits(event)" class="space-y-3 border-t border-white/5 pt-4">
          <div>
            <label class="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Banner URL</label>
            <input type="url" id="profile-banner-url" value="${escapeHtml(user.bannerUrl || '')}" placeholder="https://..." class="input-field w-full rounded-xl p-2.5 text-sm">
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Avatar URL</label>
            <input type="url" id="profile-avatar-url" value="${escapeHtml(user.avatarUrl || '')}" placeholder="https://..." class="input-field w-full rounded-xl p-2.5 text-sm">
          </div>
          <div>
            <label class="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Profil Çerçevesi (Rütbe)</label>
            <div class="flex flex-wrap gap-2">
              ${FRAMES.map(f => {
                const isUnlocked = unlocked.some(u => u.key === f.key);
                const isActive = (user.frame || 'none') === f.key && (!user.equippedFrame || user.equippedFrame === 'none');
                return `<button type="button" ${isUnlocked ? '' : 'disabled'} onclick="selectFrame('${f.key}')"
                    class="frame-choice px-3 py-2 rounded-xl text-xs border ${isActive ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 bg-white/[0.02]'} ${isUnlocked ? '' : 'opacity-30 cursor-not-allowed'}"
                    data-frame="${f.key}">
                    ${f.label}${isUnlocked ? '' : ' 🔒 ' + f.min}
                  </button>`;
              }).join('')}
            </div>
            <input type="hidden" id="profile-frame-value" value="${user.frame || 'none'}">
          </div>
          ${ownedFrames.length ? `<div>
            <label class="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Dükkan Çerçeveleri</label>
            <div class="flex flex-wrap gap-2">
              ${ownedFrames.map(f => `<button type="button" onclick="selectShopFrame('${f.id}')" class="shop-frame-choice px-3 py-2 rounded-xl text-xs border ${user.equippedFrame === f.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 bg-white/[0.02]'}" data-shop-frame="${f.id}">${escapeHtml(f.label)}</button>`).join('')}
              <button type="button" onclick="selectShopFrame('none')" class="shop-frame-choice px-3 py-2 rounded-xl text-xs border ${(!user.equippedFrame || user.equippedFrame === 'none') ? '' : 'border-white/10 bg-white/[0.02]'}" data-shop-frame="none">Kullanma</button>
            </div>
            <input type="hidden" id="profile-shop-frame-value" value="${user.equippedFrame || 'none'}">
          </div>` : `<p class="text-[11px] text-gray-500">Dükkandan çerçeve satın alarak profilini daha havalı yapabilirsin. <button type="button" class="text-cyan-300 hover:underline" onclick="closeModal(); toggleView('shop-view')">Dükkana git →</button></p>`}
          ${ownedEffects.length ? `<div>
            <label class="block text-[11px] font-semibold uppercase text-gray-400 mb-1">İsim Efekti</label>
            <div class="flex flex-wrap gap-2">
              ${ownedEffects.map(f => `<button type="button" onclick="selectShopEffect('${f.id}')" class="shop-effect-choice px-3 py-2 rounded-xl text-xs border ${user.equippedNameEffect === f.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 bg-white/[0.02]'}" data-shop-effect="${f.id}"><span class="name-fx-${f.template}" style="--ec1:${f.c1};--ec2:${f.c2}">Aa</span></button>`).join('')}
              <button type="button" onclick="selectShopEffect('none')" class="shop-effect-choice px-3 py-2 rounded-xl text-xs border ${(!user.equippedNameEffect || user.equippedNameEffect === 'none') ? '' : 'border-white/10 bg-white/[0.02]'}" data-shop-effect="none">Kullanma</button>
            </div>
            <input type="hidden" id="profile-shop-effect-value" value="${user.equippedNameEffect || 'none'}">
          </div>` : ''}
          <div>
            <label class="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Biyografi</label>
            <textarea id="profile-bio" rows="2" class="input-field w-full rounded-xl p-2.5 text-sm" placeholder="Kendinden kısaca bahset...">${escapeHtml(user.bio || '')}</textarea>
          </div>
          <button type="submit" class="btn-primary w-full py-2.5 rounded-xl font-bold text-sm">Kaydet</button>
        </form>` : ''}

        <div class="border-t border-white/5 pt-4">
          <h4 class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Başarımlar</h4>
          <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
            ${achList.length ? achList.map(a => {
              const unlockedAch = myAchIds.has(a.id);
              return `<div class="badge-tile ${unlockedAch ? 'unlocked' : 'locked'}" title="${escapeHtml(a.description || '')}">
                  <div class="badge-icon-circle" style="color:${a.color || '#ffb703'}"><i class="fa-solid ${a.icon || 'fa-medal'}"></i></div>
                  <p class="text-[10px] font-semibold text-white leading-tight">${escapeHtml(a.name)}</p>
                </div>`;
            }).join('') : `<p class="text-xs text-gray-500 col-span-full text-center py-4">Henüz başarım tanımlanmadı.</p>`}
          </div>
        </div>
      </div>
    </div>
  `, { wide: false });
}

function selectFrame(frameKey) {
  byId('profile-frame-value').value = frameKey;
  if (byId('profile-shop-frame-value')) byId('profile-shop-frame-value').value = 'none';
  document.querySelectorAll('.frame-choice').forEach(btn => {
    const active = btn.dataset.frame === frameKey;
    btn.classList.toggle('border-cyan-400', active);
    btn.classList.toggle('bg-cyan-400/10', active);
  });
  document.querySelectorAll('.shop-frame-choice').forEach(btn => btn.classList.remove('border-cyan-400', 'bg-cyan-400/10'));
}
function selectShopFrame(itemId) {
  byId('profile-shop-frame-value').value = itemId;
  document.querySelectorAll('.shop-frame-choice').forEach(btn => {
    const active = btn.dataset.shopFrame === itemId;
    btn.classList.toggle('border-cyan-400', active);
    btn.classList.toggle('bg-cyan-400/10', active);
  });
}
function selectShopEffect(itemId) {
  byId('profile-shop-effect-value').value = itemId;
  document.querySelectorAll('.shop-effect-choice').forEach(btn => {
    const active = btn.dataset.shopEffect === itemId;
    btn.classList.toggle('border-cyan-400', active);
    btn.classList.toggle('bg-cyan-400/10', active);
  });
}

async function saveProfileEdits(e) {
  e.preventDefault();
  if (!STATE.profile) return;
  const avatarUrl = byId('profile-avatar-url').value.trim();
  const bannerUrl = byId('profile-banner-url').value.trim();
  const frame = byId('profile-frame-value').value;
  const equippedFrame = byId('profile-shop-frame-value') ? byId('profile-shop-frame-value').value : (STATE.profile.equippedFrame || 'none');
  const equippedNameEffect = byId('profile-shop-effect-value') ? byId('profile-shop-effect-value').value : (STATE.profile.equippedNameEffect || 'none');
  const bio = byId('profile-bio').value.trim();
  try {
    await db.collection('users').doc(STATE.profile.id).update({
      avatarUrl: avatarUrl || defaultAvatar(STATE.profile.username),
      bannerUrl, frame, equippedFrame, equippedNameEffect, bio
    });
    showToast('Profil güncellendi ✈️', 'success');
    closeModal();
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

// --------------------------------------------------
// 🪙 COIN TRANSFER SİSTEMİ
// --------------------------------------------------
function openTransferModal(prefillUsername = '') {
  if (!STATE.profile) return;
  openModal(`
    <div class="glass-panel rounded-2xl panel-elevated p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold font-display flex items-center gap-2"><i class="fa-solid fa-money-bill-transfer text-cyan-400"></i> Coin Gönder</h3>
        <button class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p class="text-xs text-gray-400 mb-4">Bakiyen: ${coinBadgeHtml(STATE.profile.coins)}</p>
      <form onsubmit="sendCoins(event)" class="space-y-3.5">
        <div>
          <label class="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Alıcı Kullanıcı Adı</label>
          <input type="text" id="transfer-username" required value="${escapeHtml(prefillUsername)}" class="input-field w-full rounded-xl p-2.5 text-sm" placeholder="kullanici_adi">
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Miktar (🪙)</label>
          <input type="number" id="transfer-amount" required min="1" class="input-field w-full rounded-xl p-2.5 text-sm" placeholder="50">
        </div>
        <button type="submit" class="btn-primary w-full py-2.5 rounded-xl font-bold text-sm">Gönder</button>
      </form>
    </div>
  `, { wide: false });
}

async function sendCoins(e) {
  e.preventDefault();
  const username = byId('transfer-username').value.trim();
  const amount = parseInt(byId('transfer-amount').value, 10);
  if (!amount || amount <= 0) { showToast('Geçerli bir miktar gir.', 'error'); return; }
  const receiver = STATE.usersByUsername[username];
  if (!receiver) { showToast('Bu kullanıcı adı bulunamadı.', 'error'); return; }
  if (receiver.id === STATE.profile.id) { showToast('Kendine coin gönderemezsin.', 'error'); return; }
  if ((STATE.profile.coins || 0) < amount) { showToast('Yetersiz coin bakiyesi.', 'error'); return; }

  try {
    await db.runTransaction(async (tx) => {
      const senderRef = db.collection('users').doc(STATE.profile.id);
      const receiverRef = db.collection('users').doc(receiver.id);
      const senderDoc = await tx.get(senderRef);
      const receiverDoc = await tx.get(receiverRef);
      const senderCoins = senderDoc.data().coins || 0;
      if (senderCoins < amount) throw { message: 'Yetersiz coin bakiyesi.' };
      tx.update(senderRef, { coins: senderCoins - amount });
      tx.update(receiverRef, { coins: (receiverDoc.data().coins || 0) + amount });
    });
    await db.collection('coinTransfers').add({
      fromUid: STATE.profile.id, fromUsername: STATE.profile.username,
      toUid: receiver.id, toUsername: receiver.username,
      amount, createdAt: FieldValue.serverTimestamp()
    });
    showToast(`${amount} 🪙 ${receiver.username} kullanıcısına gönderildi!`, 'success');
    closeModal();
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

// --------------------------------------------------
// 🏆 SIRALAMA (LEADERBOARD)
// --------------------------------------------------
function renderLeaderboard() {
  const root = byId('leaderboard-list');
  if (!root) return;
  const users = Object.values(STATE.users).sort((a, b) => (b.points || 0) - (a.points || 0));
  if (!users.length) { root.innerHTML = `<p class="text-center text-gray-500 py-10">Henüz üye yok.</p>`; return; }

  const medalColors = ['#ffd166', '#c0c0c0', '#cd7f32'];
  root.innerHTML = users.map((u, i) => {
    const rank = getRank(u.points || 0);
    const isMedal = i < 3;
    const topRole = getTopRole(u);
    const roleMeta = ROLES[topRole] || ROLES.member;
    return `<div class="glass-panel rounded-xl p-4 flex items-center gap-4 hover-lift cursor-pointer" onclick="openProfileModal('${u.id}')">
        <div class="w-8 text-center font-mono font-black text-lg ${isMedal ? '' : 'text-gray-500'}" style="${isMedal ? `color:${medalColors[i]}` : ''}">
          ${isMedal ? `<i class="fa-solid fa-medal"></i>` : '#' + (i + 1)}
        </div>
        ${avatarFrameHtml(u, 48)}
        <div class="flex-grow min-w-0">
          <p class="font-bold text-white truncate">${usernameFxHtml(u)}</p>
          <div class="flex flex-wrap gap-1 mt-1">
            <span class="rank-badge" style="background:${roleMeta.color}22;color:${roleMeta.color};border:1px solid ${roleMeta.color}55"><i class="fa-solid ${roleMeta.icon}"></i> ${roleMeta.label}</span>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="font-mono font-bold text-cyan-300">${u.points || 0} <span class="text-[10px] text-gray-500">puan</span></p>
          <p class="text-[10px]" style="color:${rank.color}">${rank.name}</p>
        </div>
      </div>`;
  }).join('');
}

/* ==========================================================================
   9) ACHIEVEMENTS — Otomatik başarım kontrolü + Galeri
   ========================================================================== */
let _achCheckInFlight = false;

async function checkAutoAchievements() {
  if (_achCheckInFlight || !STATE.profile) return;
  _achCheckInFlight = true;
  try {
    const myAchIds = STATE.userAchievements[STATE.profile.id] || new Set();
    const autos = Object.values(STATE.achievements).filter(a => a.type === 'auto');
    for (const a of autos) {
      if (myAchIds.has(a.id)) continue;
      const value = a.metric === 'points' ? (STATE.profile.points || 0) : (STATE.profile.completedTasks || 0);
      if (value >= (a.threshold || Infinity)) {
        await db.collection('userAchievements').add({ uid: STATE.profile.id, achievementId: a.id, earnedAt: FieldValue.serverTimestamp() });
        showToast(`Yeni başarım kazandın: ${a.name}! 🏅`, 'success', a.icon || 'fa-medal');
      }
    }
  } catch (err) { console.warn('achievement check:', err); }
  finally { _achCheckInFlight = false; }
}

function renderAchievementsGrid() {
  const root = byId('achievements-grid');
  if (!root || byId('achievements-view').classList.contains('hidden')) return;
  const achList = Object.values(STATE.achievements);
  const myAchIds = STATE.profile ? (STATE.userAchievements[STATE.profile.id] || new Set()) : new Set();

  if (!achList.length) {
    root.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">Henüz başarım tanımlanmadı.</p>`;
    return;
  }
  root.innerHTML = achList.map(a => {
    const unlockedCount = Object.values(STATE.userAchievements).filter(set => set.has(a.id)).length;
    const isUnlocked = myAchIds.has(a.id);
    return `<div class="badge-tile ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="badge-icon-circle" style="color:${a.color || '#ffb703'}"><i class="fa-solid ${a.icon || 'fa-medal'}"></i></div>
        <p class="text-xs font-bold text-white leading-tight">${escapeHtml(a.name)}</p>
        <p class="text-[10px] text-gray-400 mt-1 leading-tight">${escapeHtml(a.description || '')}</p>
        <p class="text-[10px] text-gray-600 mt-2 font-mono">${unlockedCount} pilot kazandı</p>
      </div>`;
  }).join('');
}

/* ==========================================================================
   10) DÜKKAN (SHOP) — 30 çerçeve/isim efekti, coin ile satın alma
   ========================================================================== */
function renderShopGrid() {
  const root = byId('shop-grid');
  if (!root) return;
  const tab = STATE._shopTab || 'frame';
  const owned = new Set(STATE.profile ? (STATE.profile.inventory || []) : []);
  const items = SHOP_ITEMS.filter(i => i.type === tab);

  document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.shopTab === tab));

  root.innerHTML = items.map(item => {
    const isOwned = owned.has(item.id);
    const isEquipped = STATE.profile && ((item.type === 'frame' && STATE.profile.equippedFrame === item.id) || (item.type === 'effect' && STATE.profile.equippedNameEffect === item.id));
    const preview = item.type === 'frame'
      ? `<span class="avatar-wrap frame-shop-${item.template}" style="width:56px;height:56px;--fc1:${item.c1};--fc2:${item.c2}"><span style="width:100%;height:100%;border-radius:999px;background:#0f2040;display:flex;align-items:center;justify-content:center;color:#fff"><i class="fa-solid fa-user"></i></span></span>`
      : `<span class="name-fx-${item.template} text-lg" style="--ec1:${item.c1};--ec2:${item.c2}">Aa Bb</span>`;
    return `<div class="glass-panel rounded-2xl p-5 flex flex-col items-center text-center gap-3 hover-lift">
        <div class="h-16 flex items-center justify-center">${preview}</div>
        <p class="text-xs font-bold text-white leading-tight">${escapeHtml(item.label)}</p>
        ${isOwned
          ? (isEquipped
            ? `<span class="rank-badge" style="background:#3ddc9722;color:#3ddc97;border:1px solid #3ddc9755"><i class="fa-solid fa-check"></i> Kullanılıyor</span>`
            : `<button class="btn-ghost text-xs px-3 py-1.5 rounded-lg w-full" onclick="equipShopItem('${item.id}')">Kullan</button>`)
          : `<button class="btn-gold text-xs px-3 py-1.5 rounded-lg w-full font-bold" onclick="buyShopItem('${item.id}')"><i class="fa-solid fa-coins mr-1"></i>${item.price}</button>`}
      </div>`;
  }).join('');
}

function switchShopTab(tab) {
  STATE._shopTab = tab;
  renderShopGrid();
}

async function buyShopItem(itemId) {
  const item = getShopItem(itemId);
  if (!item || !STATE.profile) return;
  if ((STATE.profile.inventory || []).includes(itemId)) { showToast('Bu ürüne zaten sahipsin.', 'info'); return; }
  if ((STATE.profile.coins || 0) < item.price) { showToast('Yetersiz coin! Oyunlardan coin kazanabilirsin. 🎰', 'error'); return; }
  try {
    await db.collection('users').doc(STATE.profile.id).update({
      coins: FieldValue.increment(-item.price),
      inventory: FieldValue.arrayUnion(itemId)
    });
    showToast(`${item.label} satın alındı! 🎉`, 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

async function equipShopItem(itemId) {
  const item = getShopItem(itemId);
  if (!item || !STATE.profile) return;
  try {
    const field = item.type === 'frame' ? 'equippedFrame' : 'equippedNameEffect';
    await db.collection('users').doc(STATE.profile.id).update({ [field]: itemId, ...(item.type === 'frame' ? {} : {}) });
    showToast(`${item.label} kullanılıyor.`, 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

/* ==========================================================================
   11) OYUNLAR — Çark, Mayın Tarlası, XOX (yapay zekaya karşı)
   ========================================================================== */
function renderGamesHub() {
  renderWheelUI();
  renderMinesUI();
  renderXoxUI();
  const coinEl = byId('games-coin-balance');
  if (coinEl) coinEl.innerText = STATE.profile ? (STATE.profile.coins || 0) : 0;
}

async function grantCoins(delta) {
  if (!STATE.profile) return;
  await db.collection('users').doc(STATE.profile.id).update({ coins: FieldValue.increment(delta) });
}

// -------------------- 🎡 ÇARK --------------------
const WHEEL_SEGMENTS = [
  { label: '0x',   mult: 0,   weight: 28, color: '#ff6b6b' },
  { label: '0.5x', mult: 0.5, weight: 22, color: '#ffb703' },
  { label: '1x',   mult: 1,   weight: 20, color: '#a9b7cf' },
  { label: '1.5x', mult: 1.5, weight: 12, color: '#3fd0f0' },
  { label: '2x',   mult: 2,   weight: 9,  color: '#3ddc97' },
  { label: '3x',   mult: 3,   weight: 5,  color: '#7c9aff' },
  { label: '5x',   mult: 5,   weight: 3,  color: '#c9a8ff' },
  { label: '10x',  mult: 10,  weight: 1,  color: '#ffd166' }
];
let wheelRotation = 0;
let wheelSpinning = false;
let wheelBet = 50;

function wheelGradient() {
  let cumulative = 0;
  const stops = [];
  WHEEL_SEGMENTS.forEach(seg => {
    const start = cumulative;
    cumulative += seg.weight;
    stops.push(`${seg.color} ${start}%, ${seg.color} ${cumulative}%`);
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function renderWheelUI() {
  const disc = byId('wheel-disc');
  if (!disc) return;
  disc.style.background = wheelGradient();
  disc.style.transform = `rotate(${wheelRotation}deg)`;
  const betEl = byId('wheel-bet-display');
  if (betEl) betEl.innerText = wheelBet;
  const legend = byId('wheel-legend');
  if (legend) legend.innerHTML = WHEEL_SEGMENTS.map(s => `<span class="rank-badge" style="background:${s.color}22;color:${s.color};border:1px solid ${s.color}55">${s.label}</span>`).join(' ');
}

function setWheelBet(delta) {
  wheelBet = Math.max(10, Math.min(1000, wheelBet + delta));
  renderWheelUI();
}

function pickWeighted(segments) {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const seg of segments) {
    cumulative += seg.weight;
    if (roll <= cumulative) return seg;
  }
  return segments[segments.length - 1];
}

async function spinWheel() {
  if (wheelSpinning) return;
  if (!STATE.profile) return;
  if ((STATE.profile.coins || 0) < wheelBet) { showToast('Yetersiz coin bakiyesi.', 'error'); return; }
  wheelSpinning = true;
  byId('wheel-spin-btn').disabled = true;

  try { await grantCoins(-wheelBet); } catch (err) { showToast(friendlyError(err), 'error'); wheelSpinning = false; byId('wheel-spin-btn').disabled = false; return; }

  const result = pickWeighted(WHEEL_SEGMENTS);
  // sonucun açı aralığının ortasını bul
  let cumulative = 0;
  for (const seg of WHEEL_SEGMENTS) {
    if (seg === result) break;
    cumulative += seg.weight;
  }
  const segCenterPct = cumulative + result.weight / 2;
  const segAngle = segCenterPct * 3.6;
  const spins = 5 + Math.floor(Math.random() * 3);
  const target = spins * 360 + (360 - segAngle);
  wheelRotation += (target - (wheelRotation % 360));

  const disc = byId('wheel-disc');
  disc.style.transition = 'transform 4s cubic-bezier(0.16, 0.9, 0.15, 1)';
  disc.style.transform = `rotate(${wheelRotation}deg)`;

  setTimeout(async () => {
    const winAmount = Math.round(wheelBet * result.mult);
    if (winAmount > 0) {
      await grantCoins(winAmount);
      showToast(`Çark ${result.label} geldi! +${winAmount} 🪙 kazandın!`, 'success', 'fa-trophy');
    } else {
      showToast(`Çark ${result.label} geldi. Bu sefer olmadı, tekrar dene! 🍀`, 'error');
    }
    wheelSpinning = false;
    byId('wheel-spin-btn').disabled = false;
  }, 4100);
}

// -------------------- 💣 MAYIN TARLASI --------------------
const MINES_TOTAL = 36;
const MINES_COUNT = 6;
let minesField = null;      // 36 boolean (true = mayın)
let minesRevealed = null;   // 36 boolean
let minesActive = false;
let minesBet = 50;
let minesRevealedCount = 0;

function mineMultiplier(k) {
  let m = 1;
  for (let i = 0; i < k; i++) m *= (MINES_TOTAL - i) / (MINES_TOTAL - i - MINES_COUNT);
  return 0.96 * m; // %4 kulübe payı
}

function renderMinesUI() {
  const grid = byId('mines-grid');
  if (!grid) return;
  const betEl = byId('mines-bet-display'); if (betEl) betEl.innerText = minesBet;
  const startBtn = byId('mines-start-btn');
  const cashoutBtn = byId('mines-cashout-btn');
  if (startBtn) startBtn.classList.toggle('hidden', minesActive);
  if (cashoutBtn) cashoutBtn.classList.toggle('hidden', !minesActive);

  if (!minesField) {
    grid.innerHTML = Array.from({ length: MINES_TOTAL }).map((_, i) =>
      `<div class="mine-tile hidden-tile" onclick="revealMine(${i})"><i class="fa-solid fa-question opacity-20"></i></div>`).join('');
    const multEl = byId('mines-multiplier'); if (multEl) multEl.innerText = '1.00x';
    return;
  }

  grid.innerHTML = minesField.map((isMine, i) => {
    if (minesRevealed[i]) {
      return isMine
        ? `<div class="mine-tile revealed-mine"><i class="fa-solid fa-bomb"></i></div>`
        : `<div class="mine-tile revealed-safe"><i class="fa-solid fa-plane"></i></div>`;
    }
    return `<div class="mine-tile hidden-tile" onclick="revealMine(${i})"><i class="fa-solid fa-question opacity-20"></i></div>`;
  }).join('');

  const currentMult = mineMultiplier(minesRevealedCount);
  const multEl = byId('mines-multiplier');
  if (multEl) multEl.innerText = currentMult.toFixed(2) + 'x';
  const potentialEl = byId('mines-potential');
  if (potentialEl) potentialEl.innerText = Math.round(minesBet * currentMult);
}

function setMinesBet(delta) {
  if (minesActive) return;
  minesBet = Math.max(10, Math.min(1000, minesBet + delta));
  renderMinesUI();
}

async function startMines() {
  if (minesActive) return;
  if (!STATE.profile) return;
  if ((STATE.profile.coins || 0) < minesBet) { showToast('Yetersiz coin bakiyesi.', 'error'); return; }
  try { await grantCoins(-minesBet); } catch (err) { showToast(friendlyError(err), 'error'); return; }

  minesField = Array(MINES_TOTAL).fill(false);
  let placed = 0;
  while (placed < MINES_COUNT) {
    const idx = Math.floor(Math.random() * MINES_TOTAL);
    if (!minesField[idx]) { minesField[idx] = true; placed++; }
  }
  minesRevealed = Array(MINES_TOTAL).fill(false);
  minesRevealedCount = 0;
  minesActive = true;
  renderMinesUI();
  showToast(`Mayın tarlasına ${minesBet} 🪙 yatırdın. Bol şans! 💣`, 'info');
}

async function revealMine(idx) {
  if (!minesActive || minesRevealed[idx]) return;
  minesRevealed[idx] = true;

  if (minesField[idx]) {
    // BOOM — tüm mayınları göster, oyunu kaybet
    minesRevealed = minesRevealed.map((r, i) => r || minesField[i]);
    minesActive = false;
    renderMinesUI();
    showToast('💥 Mayına bastın! Bahsi kaybettin.', 'error');
    setTimeout(() => { minesField = null; minesRevealed = null; renderMinesUI(); }, 1800);
    return;
  }

  minesRevealedCount++;
  renderMinesUI();

  if (minesRevealedCount === MINES_TOTAL - MINES_COUNT) {
    // Tüm güvenli kareler açıldı — otomatik nakit çıkışı
    await cashoutMines();
  }
}

async function cashoutMines() {
  if (!minesActive || minesRevealedCount === 0) return;
  const mult = mineMultiplier(minesRevealedCount);
  const winAmount = Math.round(minesBet * mult);
  minesActive = false;
  try {
    await grantCoins(winAmount);
    showToast(`Nakit çıkışı! ${minesRevealedCount} kare açtın, +${winAmount} 🪙 kazandın! (${mult.toFixed(2)}x)`, 'success', 'fa-trophy');
  } catch (err) { showToast(friendlyError(err), 'error'); }
  setTimeout(() => { minesField = null; minesRevealed = null; minesRevealedCount = 0; renderMinesUI(); }, 1200);
}

// -------------------- ❌⭕ XOX (Yapay Zekaya Karşı) --------------------
// Bot uzun vadede oyuncunun kademeli olarak daha çok kazanmasına izin verir:
// oynadıkça "hata yapma" ihtimali yavaşça artar (asla ne %0 ne de %100 olmaz).
let xoxBoard = Array(9).fill(null);
let xoxActive = false;
let xoxBet = 20;
const XOX_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function xoxWinner(board) {
  for (const [a,b,c] of XOX_LINES) { if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]; }
  if (board.every(c => c)) return 'draw';
  return null;
}

function xoxBotMistakeChance() {
  const played = (STATE.profile && STATE.profile.gameStats && STATE.profile.gameStats.xoxPlayed) || 0;
  return Math.min(0.65, 0.15 + played * 0.01); // %15 taban, oyun başına +%1, tavan %65
}

function xoxMinimax(board, player) {
  const winner = xoxWinner(board);
  if (winner === 'O') return { score: 1 };
  if (winner === 'X') return { score: -1 };
  if (winner === 'draw') return { score: 0 };

  const moves = [];
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = player;
      const result = xoxMinimax(board, player === 'O' ? 'X' : 'O');
      moves.push({ index: i, score: result.score });
      board[i] = null;
    }
  }
  if (player === 'O') {
    let best = moves[0];
    for (const m of moves) if (m.score > best.score) best = m;
    return best;
  } else {
    let best = moves[0];
    for (const m of moves) if (m.score < best.score) best = m;
    return best;
  }
}

function xoxBotMove() {
  const empty = xoxBoard.map((v, i) => v ? null : i).filter(v => v !== null);
  if (!empty.length) return;
  if (Math.random() < xoxBotMistakeChance()) {
    // kasıtlı hata — rastgele hamle
    const idx = empty[Math.floor(Math.random() * empty.length)];
    xoxBoard[idx] = 'O';
  } else {
    const best = xoxMinimax([...xoxBoard], 'O');
    xoxBoard[best.index] = 'O';
  }
}

function renderXoxUI() {
  const grid = byId('xox-grid');
  if (!grid) return;
  const betEl = byId('xox-bet-display'); if (betEl) betEl.innerText = xoxBet;
  const startBtn = byId('xox-start-btn');
  if (startBtn) startBtn.classList.toggle('hidden', xoxActive);

  grid.innerHTML = xoxBoard.map((v, i) => `<div class="xox-cell ${v ? 'filled' : ''}" onclick="xoxPlayerMove(${i})">
      ${v === 'X' ? '<i class="fa-solid fa-plane text-cyan-300"></i>' : v === 'O' ? '<i class="fa-solid fa-bomb text-red-400"></i>' : ''}
    </div>`).join('');

  if (STATE.profile && STATE.profile.gameStats) {
    const s = STATE.profile.gameStats;
    const statsEl = byId('xox-stats');
    if (statsEl) statsEl.innerText = `${s.xoxWins || 0}G / ${s.xoxLosses || 0}K / ${s.xoxDraws || 0}B`;
  }
}

function setXoxBet(delta) {
  if (xoxActive) return;
  xoxBet = Math.max(10, Math.min(500, xoxBet + delta));
  renderXoxUI();
}

async function startXox() {
  if (xoxActive) return;
  if (!STATE.profile) return;
  if ((STATE.profile.coins || 0) < xoxBet) { showToast('Yetersiz coin bakiyesi.', 'error'); return; }
  try { await grantCoins(-xoxBet); } catch (err) { showToast(friendlyError(err), 'error'); return; }
  xoxBoard = Array(9).fill(null);
  xoxActive = true;
  renderXoxUI();
}

async function xoxPlayerMove(idx) {
  if (!xoxActive || xoxBoard[idx]) return;
  xoxBoard[idx] = 'X';
  renderXoxUI();

  let winner = xoxWinner(xoxBoard);
  if (winner) { await finishXox(winner); return; }

  setTimeout(async () => {
    xoxBotMove();
    renderXoxUI();
    winner = xoxWinner(xoxBoard);
    if (winner) await finishXox(winner);
  }, 450);
}

async function finishXox(winner) {
  xoxActive = false;
  const statUpdate = { 'gameStats.xoxPlayed': FieldValue.increment(1) };
  if (winner === 'X') {
    const winAmount = xoxBet * 2;
    statUpdate['gameStats.xoxWins'] = FieldValue.increment(1);
    try {
      await db.collection('users').doc(STATE.profile.id).update({ ...statUpdate, coins: FieldValue.increment(winAmount) });
      showToast(`Kazandın! ✈️ +${winAmount} 🪙`, 'success', 'fa-trophy');
    } catch (err) { showToast(friendlyError(err), 'error'); }
  } else if (winner === 'O') {
    statUpdate['gameStats.xoxLosses'] = FieldValue.increment(1);
    try { await db.collection('users').doc(STATE.profile.id).update(statUpdate); showToast('Kaybettin. Tekrar dene! 💣', 'error'); }
    catch (err) { showToast(friendlyError(err), 'error'); }
  } else {
    statUpdate['gameStats.xoxDraws'] = FieldValue.increment(1);
    try {
      await db.collection('users').doc(STATE.profile.id).update({ ...statUpdate, coins: FieldValue.increment(xoxBet) });
      showToast('Berabere! Bahsin iade edildi.', 'info');
    } catch (err) { showToast(friendlyError(err), 'error'); }
  }
  setTimeout(renderXoxUI, 600);
}

/* ==========================================================================
   12) ADMIN — Yönetim Paneli
   ========================================================================== */
let currentAdminTab = 'users';
const ADMIN_TABS = ['users', 'series', 'chapters', 'tasks', 'achievements', 'ui'];

function isAdminUser() { return STATE.profile && (STATE.profile.roles || []).includes('admin'); }

function initAdminPanel() {
  const guard = byId('admin-guard');
  const content = byId('admin-panel-content');
  if (!isAdminUser()) { guard.classList.remove('hidden'); content.classList.add('hidden'); return; }
  guard.classList.add('hidden');
  content.classList.remove('hidden');
  switchAdminTab(currentAdminTab);
}

function switchAdminTab(tab) {
  currentAdminTab = tab;
  ADMIN_TABS.forEach(t => {
    byId(`admin-tab-${t}`).classList.toggle('hidden', t !== tab);
    byId(`tab-btn-${t}`).classList.toggle('active', t === tab);
  });
  refreshActiveAdminTab(tab);
}

function refreshActiveAdminTab(source) {
  if (!isAdminUser()) return;
  if (currentAdminTab === 'users') renderAdminUsers();
  if (currentAdminTab === 'series') { renderAdminSeriesList(); populateTeamAssignForm(); }
  if (currentAdminTab === 'chapters') { renderAdminChaptersList(); populateChapterSeriesSelect(); }
  if (currentAdminTab === 'tasks') { renderAdminTasksList(); populateTaskForm(); }
  if (currentAdminTab === 'achievements') renderAdminAchievementsList();
}

// ==================================================
// 👤 KULLANICILAR / ROLLER / PUAN / COIN
// ==================================================
function renderAdminUsers() {
  const table = byId('admin-users-table');
  if (!table) return;
  const users = Object.values(STATE.users).sort((a, b) => (a.username || '').localeCompare(b.username || ''));

  table.innerHTML = users.map(u => {
    const isSelf = STATE.currentUser && STATE.currentUser.uid === u.id;
    const roleChips = STAFF_ROLES.map(r => {
      const meta = ROLES[r];
      const active = (u.roles || []).includes(r);
      return `<button type="button" onclick="toggleUserRole('${u.id}','${r}')" ${isSelf && r === 'admin' ? 'disabled title="Kendi admin rolünü kaldıramazsın"' : ''}
          class="rank-badge transition" style="background:${active ? meta.color + '33' : 'rgba(255,255,255,0.04)'};color:${active ? meta.color : '#5b6b8a'};border:1px solid ${active ? meta.color + '66' : 'rgba(255,255,255,0.08)'}">
          <i class="fa-solid ${meta.icon}"></i> ${meta.label}
        </button>`;
    }).join(' ');

    return `<tr class="align-top">
        <td class="p-3">
          <div class="flex items-center gap-2">${avatarFrameHtml(u, 32)}<div><p class="font-bold text-white">${usernameFxHtml(u)}</p><p class="text-[11px] text-gray-500">${escapeHtml(u.email || '')}</p></div></div>
        </td>
        <td class="p-3"><div class="flex flex-wrap gap-1.5">${roleChips}</div></td>
        <td class="p-3">
          <div class="flex items-center gap-1.5">
            <button class="btn-ghost w-7 h-7 rounded-lg text-xs" onclick="adjustUserPoints('${u.id}', -10)">-10</button>
            <span class="font-mono font-bold text-cyan-300 w-14 text-center">${u.points || 0}</span>
            <button class="btn-ghost w-7 h-7 rounded-lg text-xs" onclick="adjustUserPoints('${u.id}', 10)">+10</button>
          </div>
        </td>
        <td class="p-3">
          <div class="flex items-center gap-1.5">
            <button class="btn-ghost w-7 h-7 rounded-lg text-xs" onclick="adjustUserCoins('${u.id}', -50)">-50</button>
            <span class="font-mono font-bold text-amber-300 w-14 text-center"><i class="fa-solid fa-coins text-[10px]"></i> ${u.coins || 0}</span>
            <button class="btn-ghost w-7 h-7 rounded-lg text-xs" onclick="adjustUserCoins('${u.id}', 50)">+50</button>
          </div>
        </td>
        <td class="p-3 text-right">
          <button class="btn-ghost text-xs px-3 py-1.5 rounded-lg" onclick="openProfileModal('${u.id}')"><i class="fa-solid fa-eye mr-1"></i>Profil</button>
        </td>
      </tr>`;
  }).join('');
}

async function toggleUserRole(uid, role) {
  const user = STATE.users[uid];
  if (!user) return;
  if (STATE.currentUser && STATE.currentUser.uid === uid && role === 'admin') { showToast('Kendi admin rolünü kaldıramazsın.', 'error'); return; }
  let roles = [...(user.roles || [])];
  if (roles.includes(role)) roles = roles.filter(r => r !== role);
  else roles.push(role);
  if (!roles.length) roles = ['member'];
  try {
    await db.collection('users').doc(uid).update({ roles, role: roles[0] });
    showToast(`${user.username} için roller güncellendi.`, 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

async function adjustUserPoints(uid, delta) {
  try { await db.collection('users').doc(uid).update({ points: FieldValue.increment(delta) }); }
  catch (err) { showToast(friendlyError(err), 'error'); }
}
async function adjustUserCoins(uid, delta) {
  try { await db.collection('users').doc(uid).update({ coins: FieldValue.increment(delta) }); }
  catch (err) { showToast(friendlyError(err), 'error'); }
}

// ==================================================
// 📚 SERİLER
// ==================================================
async function addSeries(e) {
  e.preventDefault();
  const name = byId('series-name').value.trim();
  const cover = byId('series-cover').value.trim();
  const desc = byId('series-desc').value.trim();
  const genre = byId('series-genre').value.trim();
  const status = byId('series-status').value;
  try {
    await db.collection('series').add({
      name, coverUrl: cover, description: desc, genre, status,
      team: { translator: 'Atanmadı', cleaner: 'Atanmadı', editor: 'Atanmadı', typesetter: 'Atanmadı', qc: 'Atanmadı', rawfinder: 'Atanmadı' },
      createdAt: FieldValue.serverTimestamp()
    });
    byId('add-series-form').reset();
    showToast('Seri eklendi!', 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

function renderAdminSeriesList() {
  const tbody = byId('admin-series-list');
  if (!tbody) return;
  const seriesList = Object.values(STATE.series);
  const userOptions = ['<option value="Atanmadı">Seçilmedi</option>']
    .concat(Object.values(STATE.users).map(u => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.username)}</option>`)).join('');

  tbody.innerHTML = seriesList.map(s => {
    const roleSelects = ASSIGNABLE_ROLES.map(r => {
      const meta = ROLES[r];
      const opts = userOptions.replace(`value="${s.team?.[r]}"`, `value="${s.team?.[r]}" selected`);
      return `<td class="p-2"><select class="input-field text-xs rounded-lg p-1.5 w-full" onchange="assignTeamRole('${s.id}','${r}', this.value)" title="${meta.label}">${opts}</select></td>`;
    }).join('');
    return `<tr>
        <td class="p-2"><img src="${s.coverUrl}" class="w-9 h-12 object-cover rounded-lg" onerror="this.style.opacity=0"></td>
        <td class="p-2 font-bold text-white text-sm">${escapeHtml(s.name)}</td>
        ${roleSelects}
        <td class="p-2 text-right"><button class="btn-danger text-xs px-2 py-1 rounded-lg" onclick="deleteSeries('${s.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`;
  }).join('');
}

async function assignTeamRole(seriesId, role, username) {
  try {
    await db.collection('series').doc(seriesId).update({ [`team.${role}`]: username });
    if (role === 'translator' || role === 'editor') {
      const chSnap = await db.collection('chapters').where('seriesId', '==', seriesId).get();
      const batch = db.batch();
      chSnap.forEach(doc => batch.update(doc.ref, { [role]: username }));
      if (!chSnap.empty) await batch.commit();
    }
    showToast('Ekip ataması güncellendi.', 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

async function deleteSeries(id) {
  if (!confirm('Bu seriyi ve tüm bölüm kayıtlarını silmek istediğine emin misin?')) return;
  try {
    const chSnap = await db.collection('chapters').where('seriesId', '==', id).get();
    const batch = db.batch();
    chSnap.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('series').doc(id));
    await batch.commit();
    showToast('Seri silindi.', 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

function populateTeamAssignForm() {}

// ==================================================
// 📖 BÖLÜMLER
// ==================================================
function populateChapterSeriesSelect() {}

async function addChapter(e) {
  e.preventDefault();
  const seriesId = byId('chapter-series-select').value;
  const series = STATE.series[seriesId];
  if (!series) { showToast('Lütfen bir seri seçin.', 'error'); return; }
  const chapterNum = parseInt(byId('chapter-num').value, 10);
  const folderUrl = byId('chapter-folder').value.trim();
  const status = byId('chapter-status').value;

  try {
    await db.collection('chapters').add({
      seriesId, seriesName: series.name, chapterNumber: chapterNum,
      folderUrl, status,
      translator: series.team?.translator || 'Atanmadı',
      editor: series.team?.editor || 'Atanmadı',
      lastUpdated: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    });
    byId('add-chapter-form').reset();
    showToast('Bölüm eklendi!', 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

function renderAdminChaptersList() {
  const tbody = byId('admin-chapters-list');
  if (!tbody) return;
  const chapters = Object.values(STATE.chapters).sort((a, b) => (b.lastUpdated?.seconds || 0) - (a.lastUpdated?.seconds || 0));
  tbody.innerHTML = chapters.length ? chapters.map(ch => {
    const meta = stageMeta(ch.status);
    return `<tr>
        <td class="p-3 font-bold text-white text-sm">${escapeHtml(ch.seriesName)}</td>
        <td class="p-3 font-mono text-sm">#${ch.chapterNumber}</td>
        <td class="p-3"><span class="status-pill ${meta.cls}"><span class="dot"></span>${meta.label}</span></td>
        <td class="p-3 text-right"><button class="btn-danger text-xs px-2 py-1 rounded-lg" onclick="deleteChapter('${ch.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`;
  }).join('') : `<tr><td colspan="4" class="p-6 text-center text-gray-500">Henüz bölüm eklenmedi.</td></tr>`;
}

async function deleteChapter(id) {
  if (!confirm('Bu bölümü kaldırmak istediğine emin misin?')) return;
  try { await db.collection('chapters').doc(id).delete(); showToast('Bölüm kaldırıldı.', 'success'); }
  catch (err) { showToast(friendlyError(err), 'error'); }
}

// ==================================================
// 📋 GÖREVLER
// ==================================================
function populateTaskForm() {
  const userSelect = byId('task-assignee-select');
  if (!userSelect) return;
  const staff = Object.values(STATE.users);
  const current = userSelect.value;
  userSelect.innerHTML = staff.map(u => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join('');
  if ([...userSelect.options].some(o => o.value === current)) userSelect.value = current;

  const typeSelect = byId('task-type-select');
  if (typeSelect && !typeSelect.dataset.filled) {
    typeSelect.innerHTML = Object.keys(TASK_TYPES).map(t => `<option value="${t}">${t} (${TASK_TYPES[t].points} puan)</option>`).join('');
    typeSelect.dataset.filled = 'true';
  }
}

function onTaskTypeChange() {
  const type = byId('task-type-select').value;
  byId('task-points').value = TASK_TYPES[type]?.points || 5;
}

async function addTask(e) {
  e.preventDefault();
  const uid = byId('task-assignee-select').value;
  const user = STATE.users[uid];
  const seriesId = byId('task-series-select').value;
  const series = STATE.series[seriesId];
  const chapterNumber = byId('task-chapter-num').value.trim();
  const taskType = byId('task-type-select').value;
  const priority = byId('task-priority-select').value;
  const points = parseInt(byId('task-points').value, 10) || TASK_TYPES[taskType]?.points || 5;
  const dueDate = byId('task-due-date').value;
  const description = byId('task-description').value.trim();

  if (!user) { showToast('Lütfen bir ekip üyesi seç.', 'error'); return; }

  try {
    await db.collection('tasks').add({
      assignedToUid: uid, assignedToUsername: user.username,
      seriesId: seriesId || null,
      seriesName: series ? series.name : (byId('task-series-select').selectedOptions[0]?.text || 'Genel'),
      chapterNumber: chapterNumber || null,
      taskType, priority, points, dueDate, description,
      status: 'Bekliyor', createdAt: FieldValue.serverTimestamp()
    });
    byId('add-task-form').reset();
    showToast(`Görev ${user.username} kullanıcısına atandı!`, 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

function renderAdminTasksList() {
  const tbody = byId('admin-tasks-list');
  if (!tbody) return;
  const filter = byId('admin-task-filter') ? byId('admin-task-filter').value : 'all';
  let tasks = Object.values(STATE.tasks).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (filter !== 'all') tasks = tasks.filter(t => t.status === filter);

  tbody.innerHTML = tasks.length ? tasks.map(t => {
    const typeMeta = TASK_TYPES[t.taskType] || TASK_TYPES['Diğer'];
    const statusColor = { 'Bekliyor': '#a9b7cf', 'Yapılıyor': '#3fd0f0', 'Tamamlandı': '#3ddc97' }[t.status];
    return `<tr>
        <td class="p-3"><span class="font-semibold text-white text-sm">${escapeHtml(t.assignedToUsername)}</span></td>
        <td class="p-3 text-xs"><span style="color:${typeMeta.color}"><i class="fa-solid ${typeMeta.icon}"></i> ${escapeHtml(t.taskType)}</span></td>
        <td class="p-3 text-xs text-gray-300">${escapeHtml(t.seriesName)} ${t.chapterNumber ? '#' + t.chapterNumber : ''}</td>
        <td class="p-3"><span class="rank-badge" style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}55">${t.status}</span></td>
        <td class="p-3 text-xs font-mono">${t.points || 0}</td>
        <td class="p-3 text-right"><button class="btn-danger text-xs px-2 py-1 rounded-lg" onclick="deleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`;
  }).join('') : `<tr><td colspan="6" class="p-6 text-center text-gray-500">Görev bulunamadı.</td></tr>`;
}

async function deleteTask(id) {
  if (!confirm('Bu görevi silmek istediğine emin misin?')) return;
  try { await db.collection('tasks').doc(id).delete(); showToast('Görev silindi.', 'success'); }
  catch (err) { showToast(friendlyError(err), 'error'); }
}

// ==================================================
// 🏅 BAŞARIMLAR
// ==================================================
async function addAchievement(e) {
  e.preventDefault();
  const name = byId('ach-name').value.trim();
  const description = byId('ach-desc').value.trim();
  const icon = byId('ach-icon').value.trim() || 'fa-medal';
  const color = byId('ach-color').value;
  const type = byId('ach-type').value;
  const metric = byId('ach-metric').value;
  const threshold = parseInt(byId('ach-threshold').value, 10) || 0;
  try {
    const data = { name, description, icon, color, type, createdAt: FieldValue.serverTimestamp() };
    if (type === 'auto') { data.metric = metric; data.threshold = threshold; }
    await db.collection('achievements').add(data);
    byId('add-achievement-form').reset();
    onAchTypeChange();
    showToast('Başarım oluşturuldu!', 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

function onAchTypeChange() {
  const type = byId('ach-type').value;
  byId('ach-auto-fields').classList.toggle('hidden', type !== 'auto');
}

function renderAdminAchievementsList() {
  const tbody = byId('admin-achievements-list');
  if (!tbody) return;
  const list = Object.values(STATE.achievements);
  const userOptions = Object.values(STATE.users).map(u => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join('');

  tbody.innerHTML = list.length ? list.map(a => {
    const unlockedCount = Object.values(STATE.userAchievements).filter(set => set.has(a.id)).length;
    return `<tr>
        <td class="p-3"><i class="fa-solid ${a.icon || 'fa-medal'}" style="color:${a.color || '#ffb703'}"></i></td>
        <td class="p-3"><p class="font-bold text-white text-sm">${escapeHtml(a.name)}</p><p class="text-[11px] text-gray-500">${escapeHtml(a.description || '')}</p></td>
        <td class="p-3 text-xs">${a.type === 'auto' ? `Oto: ${a.metric} ≥ ${a.threshold}` : 'Manuel'}</td>
        <td class="p-3 text-xs font-mono text-center">${unlockedCount}</td>
        <td class="p-3 text-right">
          ${a.type === 'manual' ? `
          <div class="flex items-center gap-1.5 justify-end">
            <select class="input-field text-xs rounded-lg p-1.5" id="award-select-${a.id}">${userOptions}</select>
            <button class="btn-gold text-xs px-2 py-1.5 rounded-lg" onclick="awardAchievement('${a.id}')"><i class="fa-solid fa-award"></i></button>
          </div>` : ''}
        </td>
        <td class="p-3 text-right"><button class="btn-danger text-xs px-2 py-1 rounded-lg" onclick="deleteAchievement('${a.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`;
  }).join('') : `<tr><td colspan="6" class="p-6 text-center text-gray-500">Henüz başarım tanımlanmadı.</td></tr>`;
}

async function awardAchievement(achId) {
  const uid = byId(`award-select-${achId}`).value;
  if (!uid) return;
  try {
    const existing = await db.collection('userAchievements').where('uid', '==', uid).where('achievementId', '==', achId).limit(1).get();
    if (!existing.empty) { showToast('Bu üye bu başarıma zaten sahip.', 'info'); return; }
    await db.collection('userAchievements').add({ uid, achievementId: achId, earnedAt: FieldValue.serverTimestamp() });
    showToast(`Başarım ${STATE.users[uid]?.username || ''} adlı üyeye verildi! 🏅`, 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

async function deleteAchievement(id) {
  if (!confirm('Bu başarımı silmek istediğine emin misin?')) return;
  try { await db.collection('achievements').doc(id).delete(); showToast('Başarım silindi.', 'success'); }
  catch (err) { showToast(friendlyError(err), 'error'); }
}

// ==================================================
// 🎨 TEMA / SİTE AYARLARI
// ==================================================
async function saveUIConfig(e) {
  e.preventDefault();
  const siteTitle = byId('ui-site-title').value.trim();
  const welcomeTitle = byId('ui-welcome-title').value.trim();
  const welcomeDesc = byId('ui-welcome-desc').value.trim();
  const accentColor = byId('ui-accent-color').value;
  try {
    await db.collection('settings').doc('ui_config').set({ siteTitle, welcomeTitle, welcomeDesc, accentColor, logoUrl: STATE.uiConfig.logoUrl || '' }, { merge: true });
    showToast('Site teması güncellendi!', 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

async function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const base64 = await fileToCompressedBase64(file, 200);
    await db.collection('settings').doc('ui_config').set({ logoUrl: base64 }, { merge: true });
    byId('ui-logo-preview').src = base64;
    showToast('Logo güncellendi!', 'success');
  } catch (err) { showToast('Logo yüklenemedi: ' + err.message, 'error'); }
}

async function removeLogo() {
  try {
    await db.collection('settings').doc('ui_config').set({ logoUrl: '' }, { merge: true });
    showToast('Logo kaldırıldı.', 'success');
  } catch (err) { showToast(friendlyError(err), 'error'); }
}

/* ==========================================================================
   13) MAIN — Sayfa açılış: gökyüzü arka planı + genel kablolama
   ========================================================================== */
function buildSkyBackground() {
  const sky = byId('sky-bg');
  if (!sky) return;
  let html = '';
  for (let i = 0; i < 60; i++) {
    const top = Math.random() * 100;
    const left = Math.random() * 100;
    const delay = (Math.random() * 4).toFixed(2);
    html += `<div class="star" style="top:${top}%;left:${left}%;animation-delay:${delay}s"></div>`;
  }
  const cloudSvg = (w, h) => `<svg viewBox="0 0 400 100" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="60" rx="70" ry="30" fill="#ffffff"/>
      <ellipse cx="160" cy="45" rx="90" ry="38" fill="#ffffff"/>
      <ellipse cx="260" cy="60" rx="75" ry="28" fill="#ffffff"/>
      <ellipse cx="330" cy="50" rx="55" ry="24" fill="#ffffff"/>
    </svg>`;
  html += `<div class="cloud-layer" style="--cy:6%;--co:0.05;--cd:110s">${cloudSvg(700, 160)}</div>`;
  html += `<div class="cloud-layer" style="--cy:34%;--co:0.04;--cd:150s">${cloudSvg(600, 140)}</div>`;
  html += `<div class="cloud-layer" style="--cy:60%;--co:0.03;--cd:190s">${cloudSvg(500, 120)}</div>`;
  html += `<div class="plane-track"><span class="contrail"></span><i class="fa-solid fa-plane plane-icon"></i></div>`;
  html += `<div class="plane-track alt"><span class="contrail"></span><i class="fa-solid fa-plane plane-icon"></i></div>`;
  sky.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  buildSkyBackground();
  const yearEl = byId('footer-year');
  if (yearEl) yearEl.innerText = new Date().getFullYear();
});
