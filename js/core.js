const DB = {
  get(key) { try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : null; } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  del(key) { try { localStorage.removeItem(key); return true; } catch { return false; } }
};
const STORAGE_KEY = 'lostfound-items';
const PHOTO_PREFIX = 'lostfound-photo:';
const MAX_PHOTOS = 3;
const ADMIN_PASSCODE = 'kwai2026!?';
const USERS_KEY = 'gwai-users';
const SESSION_KEY = 'gwai-session';
let items = [];
let currentFilter = 'all';
let isAdmin = false;
let myId = '';
let myName = '';
let myDept = '';
let formPhotos = [];
let formType = 'lost';
let lbPhotos = [];
let lbIndex = 0;
function updateWelcome() {
  const el = document.getElementById('home-welcome');
  if (el) el.textContent = myName ? (myName + '님, 필요한 메뉴를 눌러 시작하세요') : '필요한 메뉴를 눌러 시작하세요';
}
function init() {
  const raw = DB.get(STORAGE_KEY);
  items = Array.isArray(raw) ? raw : [];
  const session = DB.get(SESSION_KEY);
  if (session && session.id) {
    myId = session.id;
    myName = session.name || '';
    myDept = session.dept || '';
    document.getElementById('auth').classList.remove('active');
    document.getElementById('home').classList.add('active');
    updateWelcome();
    startHomeTips();
  }
  updateHomeCount();
  updateSuggestCount();
  updateCertCount();
  updatePortfolioCount();
  renderHomeExamDday();
}
// init() is called at the bottom of this script, after EVENTS/MEAL_DATA/
// TIMETABLE_STATIC are declared, since it (and functions it calls) read them.
function hideAllViews() {
  ['home', 'lostfound', 'suggest', 'schedule', 'cert', 'meal', 'timetable', 'portfolio'].forEach(id => document.getElementById(id).classList.remove('active'));
}
function showHome() {
  hideAllViews();
  document.getElementById('home').classList.add('active');
  window.scrollTo(0, 0);
  updateHomeCount();
  updateSuggestCount();
  updateCertCount();
  updatePortfolioCount();
  renderHomeExamDday();
  startHomeTips();
}

// Rotating "오늘의 AI 상식 · 코딩 팁" card on the home screen.
let homeTipIndex = 0;
let homeTipTimer = null;
function renderHomeTip() {
  const el = document.getElementById('home-tip-text');
  if (!el) return;
  el.classList.add('fade');
  setTimeout(() => {
    el.textContent = HOME_TIPS[homeTipIndex];
    el.classList.remove('fade');
  }, 300);
}
function startHomeTips() {
  homeTipIndex = Math.floor(Math.random() * HOME_TIPS.length);
  renderHomeTip();
  if (homeTipTimer) clearInterval(homeTipTimer);
  homeTipTimer = setInterval(() => {
    homeTipIndex = (homeTipIndex + 1) % HOME_TIPS.length;
    renderHomeTip();
  }, 10000);
}

// D-day for the nearest upcoming exam (수능/기말고사/중간고사/모의고사 —
// whichever comes first), shown on the home screen separately from the
// full schedule page's D-day widget.
function renderHomeExamDday() {
  const el = document.getElementById('home-exam-dday');
  if (!el) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  const todayNum = y * 10000 + m * 100 + d;
  const examEvents = getEffectiveEvents().filter(e => e.tag === 'exam');
  const ongoing = examEvents.find(e => {
    const start = e.y * 10000 + e.m * 100 + e.d;
    const end = e.y * 10000 + e.m * 100 + (e.end || e.d);
    return todayNum >= start && todayNum <= end;
  });
  if (ongoing) {
    el.innerHTML = '<div class="home-exam-widget"><span class="home-exam-num">D-DAY</span><span class="home-exam-name">' + escHtml(ongoing.name) + ' 진행 중</span></div>';
    return;
  }
  const upcoming = examEvents
    .map(e => Object.assign({}, e, { start: e.y * 10000 + e.m * 100 + e.d }))
    .filter(e => e.start > todayNum)
    .sort((a, b) => a.start - b.start)[0];
  if (!upcoming) { el.innerHTML = ''; return; }
  const diffDays = Math.round((new Date(upcoming.y, upcoming.m - 1, upcoming.d) - new Date(y, m - 1, d)) / 86400000);
  el.innerHTML = '<div class="home-exam-widget"><span class="home-exam-num">D-' + diffDays + '</span><span class="home-exam-name">' + escHtml(upcoming.name) + '</span></div>';
}
function updateHomeCount() {
  document.getElementById('home-count').textContent = items.length + '건 등록됨';
}

// Recommended certifications & contests — curated, static reference list
// (not user-submitted). Exact schedules change every year, so dates are
// kept general; students are pointed to the school notice / official site
// for the confirmed application period.
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return min + '분 전';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + '시간 전';
  return Math.floor(hr / 24) + '일 전';
}
function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function compressImage(file, maxDim, quality) {
  maxDim = maxDim || 640; quality = quality || 0.6;
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
        else if (h >= w && h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
// Lucky star easter egg — a twinkling star appears every 30 seconds on
// whichever screen the student is on; tapping it pops up a fun surprise.
