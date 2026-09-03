let mealDay = MEAL_DATA.findIndex(d => d.menu); // fallback default

// Admin edits are stored as overrides keyed by date and merged over the
// static MEAL_DATA at render time — the original array is never mutated.
const MEAL_OVERRIDES_KEY = 'meal-overrides';
function getMealOverrides() { return DB.get(MEAL_OVERRIDES_KEY) || {}; }
function getMealDay(i) {
  const base = MEAL_DATA[i];
  const override = getMealOverrides()[base.date];
  return override ? Object.assign({}, base, override) : base;
}
let mealEditIndex = null;
function adminEditMeal(i) {
  if (!isAdmin) return;
  mealEditIndex = i;
  const day = getMealDay(i);
  document.getElementById('meal-edit-title').textContent = '급식 메뉴 편집 · ' + day.date + '(' + day.dow + ')';
  document.getElementById('meal-edit-text').value = (day.menu || []).join('\n');
  document.getElementById('meal-edit-overlay').style.display = 'flex';
}
function closeMealEditModal() { document.getElementById('meal-edit-overlay').style.display = 'none'; }
function closeMealEditIfOutside(e) { if (e.target === document.getElementById('meal-edit-overlay')) closeMealEditModal(); }
function submitMealEdit() {
  if (mealEditIndex === null) return;
  const menu = document.getElementById('meal-edit-text').value.split('\n').map(s => s.trim()).filter(Boolean);
  const overrides = getMealOverrides();
  overrides[MEAL_DATA[mealEditIndex].date] = Object.assign({}, overrides[MEAL_DATA[mealEditIndex].date], { menu });
  DB.set(MEAL_OVERRIDES_KEY, overrides);
  closeMealEditModal();
  renderMealTabs();
  renderMealContent();
}
function todayMealIndex() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = mm + '/' + dd;
  return MEAL_DATA.findIndex(d => d.date === todayStr);
}
function showMeal() {
  hideAllViews();
  document.getElementById('meal').classList.add('active');
  window.scrollTo(0, 0);
  const todayIdx = todayMealIndex();
  mealDay = todayIdx !== -1 ? todayIdx : (MEAL_DATA.findIndex(d => d.menu) !== -1 ? MEAL_DATA.findIndex(d => d.menu) : 0);
  renderMealTabs();
  renderMealContent();
}
function setMealDay(i) {
  mealDay = i;
  renderMealTabs();
  renderMealContent();
}
function renderMealTabs() {
  const el = document.getElementById('meal-daytabs');
  let html = '';
  MEAL_DATA.forEach((base, i) => {
    const day = getMealDay(i);
    const dowClass = day.dow === '토' ? ' sat' : day.dow === '일' ? ' sun' : '';
    html += '<button type="button" class="meal-day-btn' + (i === mealDay ? ' active' : '') + (day.menu ? ' has-menu' : '') + '" onclick="setMealDay(' + i + ')">' +
      '<span class="dow' + dowClass + '">' + day.dow + '</span><span class="num' + dowClass + '">' + day.date.split('/')[1] + '</span></button>';
  });
  el.innerHTML = html;
}
function renderMealContent() {
  const day = getMealDay(mealDay);
  const el = document.getElementById('meal-content');
  const adminEditHtml = isAdmin ? '<button type="button" class="tt-toggle-btn" onclick="adminEditMeal(' + mealDay + ')" style="margin-bottom:12px">관리자 편집</button>' : '';
  if (!day.menu) {
    el.innerHTML = adminEditHtml + '<div class="meal-empty"><div class="empty-icon">' + ICON.calendarDays(24) + '</div>' +
      '<div class="empty-title">' + day.date + '(' + day.dow + ') 급식 정보가 아직 등록되지 않았어요</div>' +
      '<div class="empty-sub">등록되면 이곳에 표시될 예정이에요</div></div>';
    return;
  }
  let html = adminEditHtml + '<div class="meal-section-title">중식 메뉴 · ' + day.date + '(' + day.dow + ')</div>';
  html += '<div class="meal-menu-card">' + day.menu.map(m => '<div class="meal-menu-item">' + escHtml(m) + '</div>').join('') + '</div>';

  html += '<div class="meal-section-title">영양 정보</div>';
  html += '<div class="meal-table-wrap"><table class="meal-table"><thead><tr><th>영양소</th><th>영양량</th></tr></thead><tbody>' +
    NUTRI_LABELS.map((label, i) => '<tr><td>' + escHtml(label) + '</td><td>' + day.nutrition[i] + '</td></tr>').join('') +
    '</tbody></table></div>';

  html += '<div class="meal-note">' + escHtml(
    '* 에너지는 권장섭취량의 ±10%, 구성비는 탄수화물(55~65%) : 단백질(7~20%) : 지방(15~30%)\n' +
    '* 1g당 에너지(kcal)는 탄수화물 4, 단백질 4, 지방 9kcal로 환산\n' +
    '* 알레르기 정보: 01.난류 02.우유 03.메밀 04.땅콩 05.대두 06.밀 07.고등어 08.게 09.새우 10.돼지고기 11.복숭아 12.토마토 13.아황산류 14.호두 15.닭고기 16.쇠고기 17.오징어 18.조개류(굴,전복,홍합 포함) 19.잣'
  ) + '</div>';

  el.innerHTML = html;
}

// Timetable data — extracted from the school-provided 2026학년도 2학기
// 학반별 시간표 file and embedded directly.
