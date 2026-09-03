let certTab = 'cert';
// Admin-added/deleted entries are stored separately and merged over the
// static CERT_DATA at render time — CERT_DATA itself is never mutated.
const CERT_ADDED_KEY = 'cert-added';
const CERT_DELETED_KEY = 'cert-deleted';
function certKey(tab, c) { return tab + '::' + c.name; }
function getEffectiveCertList(tab) {
  const deleted = new Set(DB.get(CERT_DELETED_KEY) || []);
  const added = (DB.get(CERT_ADDED_KEY) || {})[tab] || [];
  return (CERT_DATA[tab] || []).filter(c => !deleted.has(certKey(tab, c))).concat(added);
}
function updateCertCount() {
  const el = document.getElementById('home-cert-count');
  if (el) el.textContent = (getEffectiveCertList('cert').length + getEffectiveCertList('contest').length) + '건 안내';
}
function showCert() {
  hideAllViews();
  document.getElementById('cert').classList.add('active');
  window.scrollTo(0, 0);
  setCertTab('cert');
}
function setCertTab(tab) {
  certTab = tab;
  document.getElementById('cert-tab-cert').classList.toggle('active', tab === 'cert');
  document.getElementById('cert-tab-contest').classList.toggle('active', tab === 'contest');
  renderCertList();
}
function adminAddCert() {
  if (!isAdmin) return;
  document.getElementById('cert-form-name').value = '';
  document.getElementById('cert-form-org').value = '';
  document.getElementById('cert-form-level').value = '';
  document.getElementById('cert-form-period').value = '';
  document.getElementById('cert-form-desc').value = '';
  document.getElementById('cert-form-error').style.display = 'none';
  document.getElementById('cert-overlay').style.display = 'flex';
}
function closeCertModal() { document.getElementById('cert-overlay').style.display = 'none'; }
function closeCertIfOutside(e) { if (e.target === document.getElementById('cert-overlay')) closeCertModal(); }
function submitCertForm() {
  const name = document.getElementById('cert-form-name').value.trim();
  const errEl = document.getElementById('cert-form-error');
  if (!name) { errEl.textContent = '이름을 입력해주세요.'; errEl.style.display = 'block'; return; }
  const org = document.getElementById('cert-form-org').value.trim();
  const level = document.getElementById('cert-form-level').value.trim();
  const period = document.getElementById('cert-form-period').value.trim();
  const desc = document.getElementById('cert-form-desc').value.trim();
  const allAdded = DB.get(CERT_ADDED_KEY) || {};
  const list = allAdded[certTab] || [];
  list.push({ name, org, level, period, desc });
  allAdded[certTab] = list;
  DB.set(CERT_ADDED_KEY, allAdded);
  closeCertModal();
  renderCertList();
  updateCertCount();
  updatePortfolioCount();
}
function adminDeleteCert(tab, c) {
  if (!isAdmin) return;
  showConfirm('"' + c.name + '"을(를) 삭제할까요?', () => {
    const allAdded = DB.get(CERT_ADDED_KEY) || {};
    const key = certKey(tab, c);
    const list = allAdded[tab] || [];
    const stillAdded = list.filter(a => certKey(tab, a) !== key);
    if (stillAdded.length !== list.length) {
      allAdded[tab] = stillAdded;
      DB.set(CERT_ADDED_KEY, allAdded);
    } else {
      const deleted = DB.get(CERT_DELETED_KEY) || [];
      deleted.push(key);
      DB.set(CERT_DELETED_KEY, deleted);
    }
    renderCertList();
    updateCertCount();
  updatePortfolioCount();
  });
}
function renderCertList() {
  const container = document.getElementById('cert-list');
  const list = getEffectiveCertList(certTab);
  const addHtml = isAdmin ? '<button type="button" class="tt-toggle-btn" onclick="adminAddCert()" style="margin-bottom:14px">＋ 추가</button>' : '';
  container.innerHTML = addHtml + list.map(c =>
    '<div class="item-card">' +
      '<div class="item-card-toprow">' +
        '<div class="item-badges">' +
          '<span class="badge badge-found">' + escHtml(c.level) + '</span>' +
        '</div>' +
        '<span class="item-time">' + escHtml(c.period) + '</span>' +
      '</div>' +
      '<div class="item-name">' + escHtml(c.name) + '</div>' +
      '<div class="item-meta"><div class="item-meta-row">🏢 ' + escHtml(c.org) + '</div></div>' +
      '<div class="item-desc">' + escHtml(c.desc) + '</div>' +
      (isAdmin ? '<button type="button" class="suggest-delete-btn" onclick=\'adminDeleteCert("' + certTab + '",' + JSON.stringify(c) + ')\'>삭제</button>' : '') +
    '</div>'
  ).join('');
}

// Anonymous suggestion box — the author's name/id is never shown to other
// students. It IS stored (authorId) so an admin account can look it up if
// a report needs to be traced back for safety reasons.
