let authMode = 'login';
function hashPassword(pw) {
  // Pure-JS hash — no Web Crypto dependency, so it also works when the
  // file is opened directly (file://), where crypto.subtle can be blocked.
  const s = pw + '::gwai-salt::';
  let h1 = 0, h2 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = (Math.imul(h1, 31) + c) | 0;
    h2 = (Math.imul(h2, 131) + c) | 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
let selectedAuthDept = '';
function renderAuthDeptList() {
  const el = document.getElementById('auth-dept-list');
  if (!el || el.dataset.built === '1') return;
  el.dataset.built = '1';
  el.innerHTML = DEPT_OPTIONS.map(d =>
    '<button type="button" class="auth-dept-btn" data-dept="' + escHtml(d) + '" onclick="pickAuthDept(\'' + d + '\')">' + escHtml(d) + '</button>'
  ).join('');
}
function pickAuthDept(d) {
  selectedAuthDept = d;
  document.querySelectorAll('.auth-dept-btn').forEach(b => b.classList.toggle('selected', b.dataset.dept === d));
}
function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('auth-tab-login').classList.toggle('selected', mode === 'login');
  document.getElementById('auth-tab-signup').classList.toggle('selected', mode === 'signup');
  document.getElementById('auth-name-group').style.display = mode === 'signup' ? 'flex' : 'none';
  document.getElementById('auth-email-group').style.display = mode === 'signup' ? 'flex' : 'none';
  document.getElementById('auth-dept-group').style.display = mode === 'signup' ? 'flex' : 'none';
  if (mode === 'signup') renderAuthDeptList();
  document.getElementById('auth-submit-btn').textContent = mode === 'signup' ? '가입하고 시작하기' : '로그인';
  document.getElementById('auth-error').style.display = 'none';
}
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  // Redundant, guaranteed-visible channel — in case the inline error
  // box isn't rendering for some reason, this fixed top banner still will.
  const banner = document.getElementById('global-error-banner');
  if (banner) { banner.style.background = '#D64545'; banner.style.display = 'block'; banner.textContent = msg; }
}

async function submitAuth() {
  const btn = document.getElementById('auth-submit-btn');
  try {
    const id = document.getElementById('auth-id').value.trim();
    const pw = document.getElementById('auth-pw').value;
    if (!id || !pw) { showAuthError('학번과 비밀번호를 입력해주세요'); return; }
    if (pw.length < 6) { showAuthError('비밀번호는 6자 이상이어야 해요'); return; }

    btn.disabled = true;
    const users = DB.get(USERS_KEY) || {};
    const passHash = hashPassword(pw);
    if (authMode === 'signup') {
      const name = document.getElementById('auth-name').value.trim();
      const email = document.getElementById('auth-email').value.trim().toLowerCase();
      if (!name) { showAuthError('이름을 입력해주세요'); return; }
      if (!/^[^\s@]+@senedu\.kr$/.test(email)) { showAuthError('회원가입은 @senedu.kr 형식의 학교 이메일만 가능해요'); return; }
      if (!selectedAuthDept) { showAuthError('학과를 선택해주세요'); return; }
      if (users[id]) { showAuthError('이미 가입된 학번이에요. 로그인해주세요'); return; }
      users[id] = { name, email, dept: selectedAuthDept, passHash };
      DB.set(USERS_KEY, users);
      startSession(id, name, selectedAuthDept);
    } else {
      const user = users[id];
      if (!user) { showAuthError('가입되지 않은 학번이에요. 회원가입해주세요'); return; }
      if (passHash !== user.passHash) { showAuthError('비밀번호가 올바르지 않아요'); return; }
      startSession(id, user.name, user.dept || '');
    }
  } catch (err) {
    console.error('인증 처리 실패', err);
    showAuthError('처리 중 오류가 발생했어요: ' + (err && err.message ? err.message : String(err)));
  } finally {
    btn.disabled = false;
  }
}
function startSession(id, name, dept) {
  DB.set(SESSION_KEY, { id, name, dept: dept || '' });
  myId = id;
  myName = name;
  myDept = dept || '';
  document.getElementById('auth').classList.remove('active');
  document.getElementById('home').classList.add('active');
  window.scrollTo(0, 0);
  document.getElementById('auth-id').value = '';
  document.getElementById('auth-pw').value = '';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-name').value = '';
  selectedAuthDept = '';
  updateWelcome();
  updateHomeCount();
  updateSuggestCount();
  updateCertCount();
  updatePortfolioCount();
  renderHomeExamDday();
  startHomeTips();
}

// "내 정보" — shows department/class/number derived from the account, and
// lets the student change their password (verified with current password
// + the school email they signed up with; this app has no server, so no
// email is actually sent — the email field is just an identity check).
function logout() {
  if (homeTipTimer) { clearInterval(homeTipTimer); homeTipTimer = null; }
  closeMyInfoModal();
  DB.del(SESSION_KEY);
  myId = '';
  myName = '';
  myDept = '';
  hideAllViews();
  document.getElementById('auth').classList.add('active');
  window.scrollTo(0, 0);
  document.getElementById('auth-id').value = '';
  document.getElementById('auth-pw').value = '';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-name').value = '';
  setAuthMode('login');
}
