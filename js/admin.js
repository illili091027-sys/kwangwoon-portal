function refreshAdminSensitiveViews() {
  renderItems();
  renderSuggestions();
  renderSchedule();
  renderCalendar();
  renderCertList();
  renderMealContent();
  if (currentTimetableCode) renderTimetable(currentTimetableCode);
}
function toggleAdmin() {
  if (isAdmin) {
    isAdmin = false;
    updateAdminButtons();
    refreshAdminSensitiveViews();
  } else {
    document.getElementById('admin-pass').value = '';
    document.getElementById('admin-pass').type = 'password';
    document.getElementById('admin-pass-toggle').textContent = '보기';
    document.getElementById('admin-error').style.display = 'none';
    document.getElementById('admin-overlay').style.display = 'flex';
    setTimeout(() => document.getElementById('admin-pass').focus(), 100);
  }
}
function closeAdminModal() { document.getElementById('admin-overlay').style.display = 'none'; }
function closeAdminIfOutside(e) { if (e.target === document.getElementById('admin-overlay')) closeAdminModal(); }
function toggleAdminPassVisibility() {
  const input = document.getElementById('admin-pass');
  const btn = document.getElementById('admin-pass-toggle');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.textContent = showing ? '보기' : '숨기기';
}
function normalizePasscode(s) {
  // Some mobile keyboards turn "!" and "?" into full-width "！" "？" —
  // treat those the same as the regular half-width versions.
  return s.trim().replace(/！/g, '!').replace(/？/g, '?');
}
function checkAdminPass() {
  const entered = normalizePasscode(document.getElementById('admin-pass').value);
  if (entered === ADMIN_PASSCODE) {
    isAdmin = true;
    updateAdminButtons();
    closeAdminModal();
    refreshAdminSensitiveViews();
  } else {
    const errEl = document.getElementById('admin-error');
    errEl.textContent = '암호가 올바르지 않아요. 입력하신 값: "' + entered + '"';
    errEl.style.display = 'block';
  }
}
function resetAccounts() {
  if (!isAdmin) return;
  showConfirm('이 브라우저에 저장된 회원가입 기록(계정)과 로그인 세션을 전부 삭제할까요? 이 작업은 되돌릴 수 없어요.', () => {
    DB.del(USERS_KEY);
    DB.del(SESSION_KEY);
    const banner = document.getElementById('global-error-banner');
    if (banner) {
      banner.style.background = '#2E9E51';
      banner.style.display = 'block';
      banner.textContent = '계정 기록이 초기화되었어요. 새로고침 후 다시 로그인/회원가입해주세요.';
      setTimeout(() => { banner.style.display = 'none'; }, 4000);
    }
  });
}

// Lightbox
