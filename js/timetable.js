let eventDraftTag = 'event';
function renderEventTagPicker() {
  const el = document.getElementById('event-form-tag-picker');
  const tags = ['event', 'exam', 'holiday', 'changed', 'cert'];
  el.innerHTML = tags.map(t =>
    '<button type="button" class="auth-dept-btn' + (eventDraftTag === t ? ' selected' : '') + '" onclick="pickEventTag(\'' + t + '\')">' + TAG_LABEL[t] + '</button>'
  ).join('');
}
function pickEventTag(t) { eventDraftTag = t; renderEventTagPicker(); }
let highlightedSubjects = new Set();
let manualTimetableOpen = false;
function resolveDeptCode(deptFullName, grade) {
  if (deptFullName === '정보통신과') return grade === '1' ? '정' : '통';
  const map = { '인공지능컴퓨팅과': '컴', '전자융합과': '융', '인공지능전기과': '기', '인공지능소프트웨어과': '소' };
  return map[deptFullName] || null;
}
function classCodeFromStudentId(id) {
  // Assumes the common 5-digit format [grade][class(2)][number(2)], e.g.
  // "20401" = 2학년 04반 01번.
  if (!/^[0-9]{5}$/.test(id || '')) return null;
  const grade = id[0];
  const classIndex = parseInt(id.slice(1, 3), 10);

  // Preferred path: the student explicitly picked their department at
  // signup, so we know exactly which department + which of its two
  // classes (반 번호는 학과 안에서 홀/짝으로 교차 배정된다고 보고 계산).
  if (myDept) {
    const deptCode = resolveDeptCode(myDept, grade);
    if (deptCode) {
      const withinDeptNum = ((classIndex - 1) % 2) + 1;
      const code = deptCode + grade + withinDeptNum;
      if (TIMETABLE_STATIC[code]) return code;
    }
  }

  // Fallback for older accounts created before department selection
  // existed — guesses position in the school-wide class order.
  const order = CLASS_ORDER[grade];
  if (!order || classIndex < 1 || classIndex > order.length) return null;
  return order[classIndex - 1];
}
function showTimetable() {
  hideAllViews();
  document.getElementById('timetable').classList.add('active');
  window.scrollTo(0, 0);
  populateManualTimetableForm();
  renderTimetableAlert();
  const code = classCodeFromStudentId(myId);
  if (code) {
    renderTimetable(code);
  } else {
    document.getElementById('timetable-result').innerHTML =
      '<div class="meal-empty"><div class="empty-title">학번으로 반을 자동으로 찾지 못했어요</div>' +
      '<div class="empty-sub">아래 "다른 반 보기"에서 직접 선택해주세요</div></div>';
    toggleTimetableManual(true);
  }
}

// Pulls exam/변경 events from the school schedule (학교일정) and surfaces
// them here as a push-style alert, so a change made in the calendar is
// immediately visible from the timetable screen too.
function renderTimetableAlert() {
  const el = document.getElementById('tt-alert');
  if (!el) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  const todayNum = y * 10000 + m * 100 + d;
  const relevant = getEffectiveEvents().filter(e => e.tag === 'exam' || e.tag === 'changed');
  const ongoing = relevant.find(e => {
    const start = e.y * 10000 + e.m * 100 + e.d;
    const end = e.y * 10000 + e.m * 100 + (e.end || e.d);
    return todayNum >= start && todayNum <= end;
  });
  if (ongoing) {
    el.innerHTML = '<div class="tt-push-alert">🔔 <b>' + escHtml(ongoing.name) + '</b>' +
      (ongoing.tag === 'exam' ? ' 기간이에요' : ' — 오늘 시간표를 꼭 확인하세요') +
      (ongoing.desc ? ' · ' + escHtml(ongoing.desc) : '') + '</div>';
    return;
  }
  const upcoming = relevant
    .map(e => Object.assign({}, e, { diff: Math.round((new Date(e.y, e.m - 1, e.d) - new Date(y, m - 1, d)) / 86400000) }))
    .filter(e => e.diff > 0 && e.diff <= 7)
    .sort((a, b) => a.diff - b.diff)[0];
  if (upcoming) {
    el.innerHTML = '<div class="tt-push-alert">🔔 <b>D-' + upcoming.diff + '</b> ' + escHtml(upcoming.name) +
      (upcoming.tag === 'changed' ? ' — 시간표 변경 예정' : '') + '</div>';
  } else {
    el.innerHTML = '';
  }
}
function toggleTimetableManual(forceOpen) {
  manualTimetableOpen = forceOpen === true ? true : !manualTimetableOpen;
  document.getElementById('tt-manual-form').style.display = manualTimetableOpen ? 'flex' : 'none';
  document.getElementById('tt-manual-btn').classList.toggle('on', manualTimetableOpen);
}
function toggleSubjectHighlight(subject) {
  if (highlightedSubjects.has(subject)) highlightedSubjects.delete(subject);
  else highlightedSubjects.add(subject);
  const code = currentTimetableCode || classCodeFromStudentId(myId);
  if (code) renderTimetable(code);
}
function populateManualTimetableForm() {
  const deptSel = document.getElementById('tt-dept');
  if (!deptSel.options.length) {
    deptSel.innerHTML = Object.keys(DEPT_LABELS).map(code =>
      '<option value="' + code + '">' + escHtml(DEPT_LABELS[code]) + '</option>'
    ).join('');
  }
  const gradeSel = document.getElementById('tt-grade');
  refreshManualClassOptions();
  gradeSel.onchange = refreshManualClassOptions;
  deptSel.onchange = refreshManualClassOptions;
}
function refreshManualClassOptions() {
  const grade = document.getElementById('tt-grade').value;
  const dept = document.getElementById('tt-dept').value;
  const order = CLASS_ORDER[grade] || [];
  const matches = order.filter(code => code.startsWith(dept));
  const classSel = document.getElementById('tt-class');
  if (!matches.length) {
    classSel.innerHTML = '<option value="">해당 학년에 없음</option>';
    return;
  }
  classSel.innerHTML = matches.map((code, i) => '<option value="' + code + '">' + (i + 1) + '반</option>').join('');
}
function lookupTimetableManual() {
  const code = document.getElementById('tt-class').value;
  if (!code) return;
  renderTimetable(code);
}
let currentTimetableCode = null;
// Admin cell edits are stored as overrides keyed by class code + day +
// period and merged over TIMETABLE_STATIC at render time.
const TT_OVERRIDES_KEY = 'timetable-overrides';
function getTimetableOverrides() { return DB.get(TT_OVERRIDES_KEY) || {}; }
function getEffectiveTimetableData(code) {
  const base = TIMETABLE_STATIC[code];
  if (!base) return null;
  const overrides = getTimetableOverrides()[code];
  if (!overrides) return base;
  const days = {};
  TT_DAYS.forEach(day => {
    days[day] = (base.days[day] || []).map((cell, i) => {
      const key = day + '-' + i;
      return Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : cell;
    });
  });
  return Object.assign({}, base, { days });
}
let ttEditTarget = null; // { code, day, period }
function adminEditTimetableCell(code, day, period) {
  if (!isAdmin) return;
  ttEditTarget = { code, day, period };
  const data = getEffectiveTimetableData(code);
  const cell = (data.days[day] || [])[period];
  document.getElementById('tt-edit-title').textContent = '시간표 편집 · ' + day + '요일 ' + (period + 1) + '교시';
  document.getElementById('tt-edit-subject').value = cell ? cell.s : '';
  document.getElementById('tt-edit-teacher').value = cell ? (cell.t || '') : '';
  document.getElementById('tt-edit-overlay').style.display = 'flex';
}
function closeTtEditModal() { document.getElementById('tt-edit-overlay').style.display = 'none'; }
function closeTtEditIfOutside(e) { if (e.target === document.getElementById('tt-edit-overlay')) closeTtEditModal(); }
function submitTtEdit() {
  if (!ttEditTarget) return;
  const { code, day, period } = ttEditTarget;
  const subject = document.getElementById('tt-edit-subject').value.trim();
  const teacher = document.getElementById('tt-edit-teacher').value.trim();
  const overrides = getTimetableOverrides();
  if (!overrides[code]) overrides[code] = {};
  const key = day + '-' + period;
  overrides[code][key] = subject ? { s: subject, t: teacher } : null;
  DB.set(TT_OVERRIDES_KEY, overrides);
  closeTtEditModal();
  renderTimetable(code);
}
// Common/general-education subjects are prioritized first; department-specific
// major subjects (전공교과) are pushed to the back of the highlight button row.
function sortSubjects(subjects) {
  return subjects.slice().sort((a, b) => {
    const ia = SUBJECT_PRIORITY.indexOf(a);
    const ib = SUBJECT_PRIORITY.indexOf(b);
    const pa = ia === -1 ? SUBJECT_PRIORITY.length : ia;
    const pb = ib === -1 ? SUBJECT_PRIORITY.length : ib;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, 'ko');
  });
}
function renderTimetable(code) {
  currentTimetableCode = code;
  const data = getEffectiveTimetableData(code);
  const el = document.getElementById('timetable-result');
  const deptChar = code[0];
  const grade = code[1];
  const classNum = code[2];
  const deptName = DEPT_LABELS[deptChar] || deptChar;
  const metaHtml = '<div class="tt-meta">2026학년도 2학기 · ' + escHtml(deptName) + ' · ' + grade + '학년 ' + classNum + '반' +
    (data && data.teacher ? ' · 담임 ' + escHtml(data.teacher) + '' : '') + '</div>';
  if (!data) {
    el.innerHTML = metaHtml + '<div class="meal-empty"><div class="empty-title">아직 등록된 시간표가 없어요</div><div class="empty-sub">자료가 등록되면 이곳에 표시될 예정이에요</div></div>';
    return;
  }

  // Every subject that actually appears in this class's timetable gets its
  // own toggle button, so any subject (not just 체육) can be highlighted.
  // Common subjects (국어/영어/수학 등) come first; 전공 과목은 뒤로 밀려요.
  let subjects = [];
  TT_DAYS.forEach(day => {
    (data.days[day] || []).forEach(cell => {
      if (cell && cell.s && !subjects.includes(cell.s)) subjects.push(cell.s);
    });
  });
  subjects = sortSubjects(subjects);
  const subjectRowHtml = '<div class="tt-subject-row">' + subjects.map(s =>
    '<button type="button" class="tt-subject-btn' + (highlightedSubjects.has(s) ? ' on' : '') + '" onclick="toggleSubjectHighlight(\'' + s + '\')">' + escHtml(s) + '</button>'
  ).join('') + '</div>';

  let html = metaHtml + (isAdmin ? '<div class="tt-note">관리자 모드: 칸을 눌러 수정할 수 있어요</div>' : '') + subjectRowHtml + '<div class="tt-table-wrap"><table class="tt-table"><thead><tr><th></th>' +
    TT_DAYS.map(d => '<th>' + d + '</th>').join('') + '</tr></thead><tbody>';
  for (let p = 0; p < 7; p++) {
    html += '<tr><th>' + (p + 1) + '</th>';
    TT_DAYS.forEach(day => {
      const cell = (data.days[day] || [])[p];
      const editAttr = isAdmin ? ' onclick=\'adminEditTimetableCell("' + code + '","' + day + '",' + p + ')\' style="cursor:pointer"' : '';
      if (cell) {
        const isHighlighted = highlightedSubjects.has(cell.s);
        html += '<td class="' + (isHighlighted ? 'tt-cell-pe' : '') + '"' + editAttr + '><div class="tt-subject">' + escHtml(cell.s) + '</div>' +
          (cell.t ? '<div class="tt-teacher">' + escHtml(cell.t) + '</div>' : '') + '</td>';
      } else {
        html += '<td class="tt-empty-cell"' + editAttr + '></td>';
      }
    });
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  el.innerHTML = html;
}
function updateAdminButtons() {
  const label = isAdmin ? (ICON.shield(13) + ' 관리자 모드 · 끄기') : (ICON.shield(13) + ' 관리자');
  const toggleBtn = document.getElementById('admin-toggle-btn');
  if (toggleBtn) {
    toggleBtn.innerHTML = label;
    toggleBtn.classList.toggle('on', isAdmin);
  }
  const logoBtn = document.getElementById('home-admin-logo-btn');
  if (logoBtn) logoBtn.classList.toggle('admin-on', isAdmin);
  const resetBtn = document.getElementById('admin-reset-btn');
  if (resetBtn) resetBtn.style.display = isAdmin ? '' : 'none';
}
