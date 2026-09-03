const SUGGEST_KEY = 'suggestions';
const SUGGEST_CATEGORIES = ['전체', '학교시설', '급식', '학사', '동아리', '기타'];
let suggestFilter = '전체';
let suggestDraftCategory = '기타';
function loadSuggestions() { return DB.get(SUGGEST_KEY) || []; }
function saveSuggestions(list) { DB.set(SUGGEST_KEY, list); }
function updateSuggestCount() {
  const el = document.getElementById('home-suggest-count');
  if (el) el.textContent = loadSuggestions().length + '건 등록됨';
}
function showSuggest() {
  hideAllViews();
  document.getElementById('suggest').classList.add('active');
  window.scrollTo(0, 0);
  renderSuggestCategoryTabs();
  renderSuggestions();
}
function renderSuggestCategoryTabs() {
  const el = document.getElementById('suggest-category-tabs');
  if (!el) return;
  el.innerHTML = SUGGEST_CATEGORIES.map(c =>
    '<button type="button" class="tab-btn' + (suggestFilter === c ? ' active' : '') + '" onclick="setSuggestFilter(\'' + c + '\')">' + escHtml(c) + '</button>'
  ).join('');
}
function setSuggestFilter(c) {
  suggestFilter = c;
  renderSuggestCategoryTabs();
  renderSuggestions();
}
function renderSuggestions() {
  const el = document.getElementById('suggest-container');
  const list = loadSuggestions()
    .filter(s => suggestFilter === '전체' || (s.category || '기타') === suggestFilter)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (!list.length) {
    const msg = suggestFilter === '전체' ? '아직 등록된 건의가 없어요' : ('아직 "' + suggestFilter + '" 카테고리에 등록된 건의가 없어요');
    el.innerHTML = '<div class="empty-state"><div class="empty-title">' + escHtml(msg) + '</div><div class="empty-sub">가장 먼저 익명으로 건의해보세요</div></div>';
    updateSuggestCount();
    return;
  }
  el.innerHTML = list.map(s => {
    const d = new Date(s.createdAt);
    const dateLabel = d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const authorHtml = isAdmin ? '<span class="suggest-author-tag">작성자: ' + escHtml(s.authorId || '알 수 없음') + '</span>' : '<span class="suggest-author-tag">익명</span>';
    const catHtml = '<span class="suggest-cat-tag">' + escHtml(s.category || '기타') + '</span>';
    return '<div class="suggest-card">' +
      '<div class="suggest-top">' + authorHtml + catHtml + '<span class="suggest-date">' + dateLabel + '</span></div>' +
      '<div class="suggest-text">' + escHtml(s.text) + '</div>' +
      (isAdmin ? '<button class="suggest-delete-btn" onclick="deleteSuggestion(\'' + s.id + '\')">삭제</button>' : '') +
      '</div>';
  }).join('');
  updateSuggestCount();
}
function renderSuggestDraftCategoryPicker() {
  const el = document.getElementById('suggest-form-category');
  if (!el) return;
  el.innerHTML = SUGGEST_CATEGORIES.filter(c => c !== '전체').map(c =>
    '<button type="button" class="auth-dept-btn' + (suggestDraftCategory === c ? ' selected' : '') + '" onclick="pickSuggestCategory(\'' + c + '\')">' + escHtml(c) + '</button>'
  ).join('');
}
function pickSuggestCategory(c) {
  suggestDraftCategory = c;
  renderSuggestDraftCategoryPicker();
}
function openSuggestModal() {
  document.getElementById('suggest-form-text').value = '';
  document.getElementById('suggest-form-error').style.display = 'none';
  suggestDraftCategory = '기타';
  renderSuggestDraftCategoryPicker();
  document.getElementById('suggest-overlay').style.display = 'flex';
}
function closeSuggestModal() { document.getElementById('suggest-overlay').style.display = 'none'; }
function closeSuggestIfOutside(e) { if (e.target === document.getElementById('suggest-overlay')) closeSuggestModal(); }
function submitSuggest() {
  const text = document.getElementById('suggest-form-text').value.trim();
  const errEl = document.getElementById('suggest-form-error');
  if (!text) { errEl.textContent = '내용을 입력해주세요.'; errEl.style.display = 'block'; return; }
  const list = loadSuggestions();
  list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2), text, category: suggestDraftCategory, authorId: myId, createdAt: Date.now() });
  saveSuggestions(list);
  closeSuggestModal();
  renderSuggestions();
}
function deleteSuggestion(id) {
  if (!isAdmin) return;
  saveSuggestions(loadSuggestions().filter(s => s.id !== id));
  renderSuggestions();
}

// Personal portfolio — private per logged-in user, stored only in this
// browser's local storage. Compiles the student's own recorded
// achievements into a single printable page for self-introduction essays.
