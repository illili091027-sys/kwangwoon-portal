const PORTFOLIO_CATEGORIES = ['자격증', '수상', '프로젝트', '활동', '기타'];
let portfolioDraftCategory = '자격증';
function portfolioKey() { return 'portfolio:' + (myId || 'guest'); }
function loadPortfolio() { return DB.get(portfolioKey()) || []; }
function savePortfolio(list) { DB.set(portfolioKey(), list); }
function updatePortfolioCount() {
  const el = document.getElementById('home-portfolio-count');
  if (el) el.textContent = loadPortfolio().length + '건 등록됨';
}
function showPortfolio() {
  hideAllViews();
  document.getElementById('portfolio').classList.add('active');
  window.scrollTo(0, 0);
  renderPortfolio();
}
function renderPortfolio() {
  const el = document.getElementById('portfolio-container');
  const list = loadPortfolio().slice().sort((a, b) => b.createdAt - a.createdAt);
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-title">아직 기록한 이력이 없어요</div><div class="empty-sub">자격증, 수상, 프로젝트 경험을 하나씩 기록해보세요</div></div>';
    updatePortfolioCount();
    return;
  }
  el.innerHTML = list.map(p =>
    '<div class="portfolio-card">' +
      '<div class="portfolio-top"><span class="portfolio-cat-tag">' + escHtml(p.category) + '</span>' +
      (p.date ? '<span class="portfolio-date">' + escHtml(p.date) + '</span>' : '') + '</div>' +
      '<div class="portfolio-title">' + escHtml(p.title) + '</div>' +
      (p.desc ? '<div class="portfolio-desc">' + escHtml(p.desc) + '</div>' : '') +
      '<button class="portfolio-delete-btn" onclick="deletePortfolioItem(\'' + p.id + '\')">삭제</button>' +
    '</div>'
  ).join('');
  updatePortfolioCount();
}
function renderPortfolioCategoryPicker() {
  const el = document.getElementById('portfolio-form-category');
  el.innerHTML = PORTFOLIO_CATEGORIES.map(c =>
    '<button type="button" class="auth-dept-btn' + (portfolioDraftCategory === c ? ' selected' : '') + '" onclick="pickPortfolioCategory(\'' + c + '\')">' + escHtml(c) + '</button>'
  ).join('');
}
function pickPortfolioCategory(c) { portfolioDraftCategory = c; renderPortfolioCategoryPicker(); }
function populatePortfolioDateSelects() {
  const yearSel = document.getElementById('portfolio-form-year');
  const monthSel = document.getElementById('portfolio-form-month');
  const daySel = document.getElementById('portfolio-form-day');
  if (!yearSel.options.length) {
    const nowYear = new Date().getFullYear();
    let yearHtml = '<option value="">연도 선택 안 함</option>';
    for (let y = nowYear + 1; y >= nowYear - 5; y--) yearHtml += '<option value="' + y + '">' + y + '년</option>';
    yearSel.innerHTML = yearHtml;
    let monthHtml = '<option value="">월 선택 안 함</option>';
    for (let m = 1; m <= 12; m++) monthHtml += '<option value="' + m + '">' + m + '월</option>';
    monthSel.innerHTML = monthHtml;
    let dayHtml = '<option value="">일 선택 안 함</option>';
    for (let d = 1; d <= 31; d++) dayHtml += '<option value="' + d + '">' + d + '일</option>';
    daySel.innerHTML = dayHtml;
  }
  yearSel.value = '';
  monthSel.value = '';
  daySel.value = '';
}
function openPortfolioModal() {
  portfolioDraftCategory = '자격증';
  renderPortfolioCategoryPicker();
  document.getElementById('portfolio-form-title').value = '';
  populatePortfolioDateSelects();
  document.getElementById('portfolio-form-desc').value = '';
  document.getElementById('portfolio-form-error').style.display = 'none';
  document.getElementById('portfolio-overlay').style.display = 'flex';
}
function closePortfolioModal() { document.getElementById('portfolio-overlay').style.display = 'none'; }
function closePortfolioIfOutside(e) { if (e.target === document.getElementById('portfolio-overlay')) closePortfolioModal(); }
function submitPortfolioForm() {
  const title = document.getElementById('portfolio-form-title').value.trim();
  const errEl = document.getElementById('portfolio-form-error');
  if (!title) { errEl.textContent = '제목을 입력해주세요.'; errEl.style.display = 'block'; return; }
  const year = document.getElementById('portfolio-form-year').value;
  const month = document.getElementById('portfolio-form-month').value;
  const day = document.getElementById('portfolio-form-day').value;
  let date = '';
  if (year && month && day) date = year + '.' + String(month).padStart(2, '0') + '.' + String(day).padStart(2, '0');
  else if (year && month) date = year + '.' + String(month).padStart(2, '0');
  else if (year) date = year;
  const desc = document.getElementById('portfolio-form-desc').value.trim();
  const list = loadPortfolio();
  list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2), category: portfolioDraftCategory, title, date, desc, createdAt: Date.now() });
  savePortfolio(list);
  closePortfolioModal();
  renderPortfolio();
}
function deletePortfolioItem(id) {
  savePortfolio(loadPortfolio().filter(p => p.id !== id));
  renderPortfolio();
}
function printPortfolio() {
  const list = loadPortfolio().slice().sort((a, b) => a.createdAt - b.createdAt);
  const el = document.getElementById('portfolio-print-content');
  if (!list.length) {
    el.innerHTML = '<p style="text-align:center;color:var(--slate);font-size:13px;">아직 기록한 이력이 없어요. 먼저 이력을 추가해주세요.</p>';
    document.getElementById('portfolio-print-overlay').style.display = 'flex';
    return;
  }
  let html = '<div class="pf-print-header"><div class="pf-print-name">' + escHtml(myName || '') + '</div>' +
    '<div class="pf-print-sub">광운인공지능고등학교' + (myDept ? ' · ' + escHtml(myDept) : '') + '</div></div>';
  PORTFOLIO_CATEGORIES.forEach(cat => {
    const items = list.filter(p => p.category === cat);
    if (!items.length) return;
    html += '<div class="pf-print-section-title">' + escHtml(cat) + '</div>';
    items.forEach(p => {
      html += '<div class="pf-print-item">' +
        '<div class="pf-print-item-title">' + escHtml(p.title) + (p.date ? ' <span class="pf-print-item-date">· ' + escHtml(p.date) + '</span>' : '') + '</div>' +
        (p.desc ? '<div class="pf-print-item-desc">' + escHtml(p.desc) + '</div>' : '') +
        '</div>';
    });
  });
  el.innerHTML = html;
  document.getElementById('portfolio-print-overlay').style.display = 'flex';
}
function closePortfolioPrint() { document.getElementById('portfolio-print-overlay').style.display = 'none'; }
function closePortfolioPrintIfOutside(e) { if (e.target === document.getElementById('portfolio-print-overlay')) closePortfolioPrint(); }

// School meal (from 학교급식 영양표시제, 08월 17일~23일)
