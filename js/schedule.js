let currentSemester = 1;
let confirmCallback = null;
function showConfirm(message, onYes) {
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onYes;
  document.getElementById('confirm-overlay').style.display = 'flex';
}
function closeConfirmModal() {
  document.getElementById('confirm-overlay').style.display = 'none';
  confirmCallback = null;
}
function confirmYes() {
  const cb = confirmCallback;
  closeConfirmModal();
  if (cb) cb();
}

// Admin-added/deleted events are stored separately and merged over the
// static EVENTS list at render time — EVENTS itself is never mutated.
const EVENTS_ADDED_KEY = 'schedule-events-added';
const EVENTS_DELETED_KEY = 'schedule-events-deleted';
function eventKey(e) { return e.y + '-' + e.m + '-' + e.d + '-' + e.name; }
function getEffectiveEvents() {
  const deleted = new Set(DB.get(EVENTS_DELETED_KEY) || []);
  const added = DB.get(EVENTS_ADDED_KEY) || [];
  return EVENTS.filter(e => !deleted.has(eventKey(e))).concat(added);
}
function adminAddEvent() {
  if (!isAdmin) return;
  document.getElementById('event-form-month').value = calMonth;
  document.getElementById('event-form-day').value = '';
  document.getElementById('event-form-end').value = '';
  document.getElementById('event-form-name').value = '';
  document.getElementById('event-form-desc').value = '';
  eventDraftTag = 'event';
  renderEventTagPicker();
  document.getElementById('event-form-error').style.display = 'none';
  document.getElementById('event-overlay').style.display = 'flex';
}
function closeEventModal() { document.getElementById('event-overlay').style.display = 'none'; }
function closeEventIfOutside(e) { if (e.target === document.getElementById('event-overlay')) closeEventModal(); }
function submitEventForm() {
  const m = parseInt(document.getElementById('event-form-month').value, 10);
  const d = parseInt(document.getElementById('event-form-day').value, 10);
  const endRaw = document.getElementById('event-form-end').value;
  const end = endRaw ? parseInt(endRaw, 10) : undefined;
  const name = document.getElementById('event-form-name').value.trim();
  const desc = document.getElementById('event-form-desc').value.trim();
  const errEl = document.getElementById('event-form-error');
  if (!m || m < 1 || m > 12 || !d || d < 1 || d > 31 || !name) {
    errEl.textContent = '월, 일, 이름을 정확히 입력해주세요.';
    errEl.style.display = 'block';
    return;
  }
  const y = m >= 3 ? 2026 : 2027; // school-year mapping: Mar–Dec 2026, Jan–Feb 2027
  const ev = { y, m, d, name, tag: eventDraftTag };
  if (end) ev.end = end;
  if (desc) ev.desc = desc;
  const added = DB.get(EVENTS_ADDED_KEY) || [];
  added.push(ev);
  DB.set(EVENTS_ADDED_KEY, added);
  closeEventModal();
  renderCalendar();
  renderSchedule();
  renderTimetableAlert();
}

// Bulk-import events from a CSV file the admin uploads — parsed entirely
// in the browser (no server needed). Expected columns, in order:
//   월,일,종료일(선택),이름,종류,설명(선택)
// 종류 can be the Korean label (시험/휴일/행사/변경됨/자격증·공모전) or the
// internal key (exam/holiday/event/changed/cert).
const TAG_KOREAN_TO_KEY = { '시험': 'exam', '휴일': 'holiday', '행사': 'event', '변경됨': 'changed', '자격증·공모전': 'cert', '자격증공모전': 'cert' };
function resolveImportTag(raw) {
  const t = (raw || '').trim();
  if (TAG_LABEL[t]) return t; // already a valid internal key
  if (TAG_KOREAN_TO_KEY[t]) return TAG_KOREAN_TO_KEY[t];
  return null;
}
function parseScheduleCsvLine(line) {
  // Minimal CSV split — good enough for simple comma-separated values
  // without embedded commas inside quotes (typical for a spreadsheet export).
  return line.split(',').map(s => s.trim());
}
function openImportModal() {
  if (!isAdmin) return;
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-result').innerHTML = '';
  document.getElementById('import-overlay').style.display = 'flex';
}
function closeImportModal() { document.getElementById('import-overlay').style.display = 'none'; }
function closeImportIfOutside(e) { if (e.target === document.getElementById('import-overlay')) closeImportModal(); }
function importScheduleRows(rows) {
  const resultEl = document.getElementById('import-result');
  if (!rows.length) {
    resultEl.innerHTML = '<div class="form-error" style="display:block">빈 파일이에요.</div>';
    return;
  }
  // Skip a header row if the first cell isn't a number (e.g. "월").
  let startIdx = 0;
  if (isNaN(parseInt(rows[0][0], 10))) startIdx = 1;

  const added = DB.get(EVENTS_ADDED_KEY) || [];
  let successCount = 0;
  const errors = [];
  for (let i = startIdx; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.every(c => c === '' || c == null)) continue; // skip blank rows
    const [monthRaw, dayRaw, endRaw, name, tagRaw, desc] = cols.map(c => (c == null ? '' : String(c).trim()));
    const m = parseInt(monthRaw, 10);
    const d = parseInt(dayRaw, 10);
    const end = endRaw ? parseInt(endRaw, 10) : undefined;
    const tag = resolveImportTag(tagRaw);
    const rowNum = i + 1;
    if (!m || m < 1 || m > 12 || !d || d < 1 || d > 31 || !name || !tag) {
      errors.push(rowNum + '행: 형식이 올바르지 않아 건너뛰었어요 (' + cols.join(',') + ')');
      continue;
    }
    const y = m >= 3 ? 2026 : 2027;
    const ev = { y, m, d, name, tag };
    if (end && !isNaN(end)) ev.end = end;
    if (desc) ev.desc = desc;
    added.push(ev);
    successCount++;
  }
  DB.set(EVENTS_ADDED_KEY, added);
  renderCalendar();
  renderSchedule();
  renderTimetableAlert();

  let html = '<div style="font-size:13px;font-weight:700;color:#2E9E51;margin-bottom:8px;">' + successCount + '개 일정을 추가했어요.</div>';
  if (errors.length) {
    html += '<div style="font-size:11px;color:#D64545;line-height:1.7;">' + errors.map(escHtml).join('<br>') + '</div>';
  }
  resultEl.innerHTML = html;
}
function handleScheduleImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const resultEl = document.getElementById('import-result');
  const isExcel = /\.xlsx?$/i.test(file.name);

  if (isExcel) {
    if (typeof XLSX === 'undefined' || window.xlsxLoadFailed) {
      resultEl.innerHTML = '<div class="form-error" style="display:block">엑셀 파일을 읽으려면 인터넷 연결이 필요한데, 지금 이 컴퓨터에서는 불러오지 못했어요. 대신 CSV 파일로 시도해주세요 (엑셀에서 "다른 이름으로 저장 → CSV").</div>';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        importScheduleRows(rows);
      } catch (err) {
        resultEl.innerHTML = '<div class="form-error" style="display:block">엑셀 파일을 읽지 못했어요: ' + escHtml(err.message || String(err)) + '</div>';
      }
    };
    reader.onerror = () => {
      resultEl.innerHTML = '<div class="form-error" style="display:block">파일을 읽지 못했어요.</div>';
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0);
    const rows = lines.map(parseScheduleCsvLine);
    importScheduleRows(rows);
  };
  reader.onerror = () => {
    resultEl.innerHTML = '<div class="form-error" style="display:block">파일을 읽지 못했어요.</div>';
  };
  reader.readAsText(file, 'UTF-8');
}
function downloadCsvTemplate() {
  const sample = '월,일,종료일,이름,종류,설명\n'
    + '4,27,30,중간고사,시험,1학기 중간고사 기간\n'
    + '5,5,,어린이날,휴일,\n'
    + '7,16,,광운제,행사,\n';
  const blob = new Blob(['\uFEFF' + sample], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '학사일정_양식.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function adminDeleteEvent(e) {
  if (!isAdmin) return;
  showConfirm('"' + e.name + '" 일정을 삭제할까요?', () => {
    const added = DB.get(EVENTS_ADDED_KEY) || [];
    const key = eventKey(e);
    const stillAdded = added.filter(a => eventKey(a) !== key);
    if (stillAdded.length !== added.length) {
      DB.set(EVENTS_ADDED_KEY, stillAdded);
    } else {
      const deleted = DB.get(EVENTS_DELETED_KEY) || [];
      deleted.push(key);
      DB.set(EVENTS_DELETED_KEY, deleted);
    }
    renderCalendar();
    renderSchedule();
    renderTimetableAlert();
  });
}
let calYear = 2026, calMonth = 3;
let selectedDate = null; // 'y-m-d'
let scheduleViewMode = 'calendar';
function showSchedule() {
  hideAllViews();
  document.getElementById('schedule').classList.add('active');
  window.scrollTo(0, 0);
  document.getElementById('schedule-notice').innerHTML =
    '<b>2026학년도 학사일정 조정 안내</b> (2026.06.23, 교육과정연구부)<br>' +
    '2학기 「체험학습」 운영일이 2027학년도 신입생 선발 면접 일정과 겹쳐 조정되었습니다. ' +
    '아래 일정에서 <b>변경됨</b> 표시를 확인해주세요.';
  // Jump the calendar to today's month (clamped to the school-year range)
  // instead of always starting back in March.
  const now = new Date();
  let ny = now.getFullYear(), nm = now.getMonth() + 1;
  const idx = (ny - CAL_MIN.y) * 12 + (nm - CAL_MIN.m);
  const maxIdx = (CAL_MAX.y - CAL_MIN.y) * 12 + (CAL_MAX.m - CAL_MIN.m);
  if (idx < 0) { ny = CAL_MIN.y; nm = CAL_MIN.m; }
  else if (idx > maxIdx) { ny = CAL_MAX.y; nm = CAL_MAX.m; }
  calYear = ny;
  calMonth = nm;
  selectedDate = null;
  setViewMode('calendar');
  renderSchedule();
  renderCalendar();
}

// Personal calendar notes — private per logged-in user, stored only in
// this browser's local storage, shown directly inside the school calendar.
function personalEventsKey() { return 'personal-events:' + (myId || 'guest'); }
function loadPersonalEvents() { return DB.get(personalEventsKey()) || {}; }
function savePersonalEvents(obj) { DB.set(personalEventsKey(), obj); }
function personalEventsOnDay(y, m, d) {
  const all = loadPersonalEvents();
  return all[y + '-' + m + '-' + d] || [];
}
function addPersonalEvent(y, m, d) {
  const input = document.getElementById('personal-note-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const all = loadPersonalEvents();
  const key = y + '-' + m + '-' + d;
  const list = all[key] || [];
  list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2), text });
  all[key] = list;
  savePersonalEvents(all);
  renderCalendar();
}
function deletePersonalEvent(y, m, d, id) {
  const all = loadPersonalEvents();
  const key = y + '-' + m + '-' + d;
  all[key] = (all[key] || []).filter(n => n.id !== id);
  if (!all[key].length) delete all[key];
  savePersonalEvents(all);
  renderCalendar();
}
function setViewMode(mode) {
  scheduleViewMode = mode;
  document.getElementById('view-list-btn').classList.toggle('active', mode === 'list');
  document.getElementById('view-cal-btn').classList.toggle('active', mode === 'calendar');
  document.getElementById('schedule-list').style.display = mode === 'list' ? '' : 'none';
  document.getElementById('schedule-calendar').style.display = mode === 'calendar' ? '' : 'none';
}
function renderSchedule() {
  const container = document.getElementById('schedule-list');
  const evs = getEffectiveEvents().slice().sort((a, b) => (a.y * 10000 + a.m * 100 + a.d) - (b.y * 10000 + b.m * 100 + b.d));
  let html = isAdmin ? '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">' +
    '<button type="button" class="tt-toggle-btn" onclick="adminAddEvent()">＋ 일정 추가</button>' +
    '<button type="button" class="tt-toggle-btn" onclick="openImportModal()">📄 파일로 가져오기</button>' +
    '</div>' : '';
  let lastMonthKey = '';
  evs.forEach(ev => {
    const monthKey = ev.y + '-' + ev.m;
    if (monthKey !== lastMonthKey) {
      html += '<div class="sched-month">' + ev.m + '월' + (ev.y === 2027 ? ' (' + ev.y + ')' : '') + '</div>';
      lastMonthKey = monthKey;
    }
    const dateLabel = ev.m + '/' + ev.d + (ev.end && ev.end !== ev.d ? '~' + ev.end : '');
    const tagHtml = ev.tag ? '<span class="sched-tag ' + ev.tag + '">' + TAG_LABEL[ev.tag] + '</span>' : '';
    const deleteHtml = isAdmin ? '<button type="button" class="suggest-delete-btn" onclick=\'adminDeleteEvent(' + JSON.stringify(ev) + ')\'>삭제</button>' : '';
    html += '<div class="sched-event">' +
      '<div class="sched-date">' + escHtml(dateLabel) + '</div>' +
      '<div class="sched-body"><div class="sched-name">' + escHtml(ev.name) + tagHtml + '</div>' +
      (ev.desc ? '<div class="sched-desc">' + escHtml(ev.desc) + '</div>' : '') +
      deleteHtml +
      '</div></div>';
  });
  container.innerHTML = html;
}

// Calendar
function eventsOnDay(y, m, d) {
  return getEffectiveEvents().filter(e => e.y === y && e.m === m && d >= e.d && d <= (e.end || e.d));
}
function shiftMonth(delta) {
  let idx = (calYear - CAL_MIN.y) * 12 + (calMonth - CAL_MIN.m) + delta;
  const maxIdx = (CAL_MAX.y - CAL_MIN.y) * 12 + (CAL_MAX.m - CAL_MIN.m);
  if (idx < 0 || idx > maxIdx) return;
  calMonth += delta;
  if (calMonth < 1) { calMonth = 12; calYear--; }
  if (calMonth > 12) { calMonth = 1; calYear++; }
  selectedDate = null;
  renderCalendar();
}
function selectDay(y, m, d) {
  selectedDate = y + '-' + m + '-' + d;
  renderCalendar();
}
function renderCalendar() {
  document.getElementById('cal-title').textContent = calYear + '년 ' + calMonth + '월';
  const curIdx = (calYear - CAL_MIN.y) * 12 + (calMonth - CAL_MIN.m);
  const maxIdx = (CAL_MAX.y - CAL_MIN.y) * 12 + (CAL_MAX.m - CAL_MIN.m);
  document.getElementById('cal-prev').disabled = curIdx <= 0;
  document.getElementById('cal-next').disabled = curIdx >= maxIdx;

  const firstDow = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const dows = ['일','월','화','수','목','금','토'];
  let html = dows.map(d => '<div class="cal-dow">' + d + '</div>').join('');
  for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const evs = eventsOnDay(calYear, calMonth, d);
    const personal = personalEventsOnDay(calYear, calMonth, d);
    const isSelected = selectedDate === (calYear + '-' + calMonth + '-' + d);
    let chips = evs.slice(0, 2).map(e => {
      const isRange = !!e.end && e.end !== e.d;
      let pos = 'single';
      if (isRange) pos = (d === e.d) ? 'start' : (d === e.end) ? 'end' : 'mid';
      const label = (pos === 'mid' || pos === 'end') ? '' : escHtml(e.name);
      return '<div class="cal-chip ' + e.tag + ' pos-' + pos + '">' + label + '</div>';
    }).join('');
    let extraCount = Math.max(0, evs.length - 2);
    if (personal.length) {
      if (chips.split('cal-chip').length - 1 < 2) {
        chips += '<div class="cal-chip personal pos-single">' + escHtml(personal[0].text) + '</div>';
        extraCount += Math.max(0, personal.length - 1);
      } else {
        extraCount += personal.length;
      }
    }
    if (extraCount > 0) chips += '<div class="cal-more">+' + extraCount + '개</div>';
    html += '<button type="button" class="cal-cell' + (isSelected ? ' selected' : '') + '" onclick="selectDay(' + calYear + ',' + calMonth + ',' + d + ')">' +
      '<div class="cal-daynum">' + d + '</div>' + chips + '</button>';
  }
  document.getElementById('cal-grid').innerHTML = html;
  renderAgenda();
}
function renderAgenda() {
  const el = document.getElementById('cal-agenda');
  if (!selectedDate) { el.innerHTML = ''; return; }
  const [y, m, d] = selectedDate.split('-').map(Number);
  const evs = eventsOnDay(y, m, d);
  const personal = personalEventsOnDay(y, m, d);
  let html = '<div class="cal-agenda-title">' + m + '월 ' + d + '일' + (evs.length || personal.length ? ' 일정' : ' · 일정 없음') + '</div>';
  evs.forEach(ev => {
    const tagHtml = '<span class="sched-tag ' + ev.tag + '">' + TAG_LABEL[ev.tag] + '</span>';
    const deleteHtml = isAdmin ? '<button type="button" class="suggest-delete-btn" onclick=\'adminDeleteEvent(' + JSON.stringify(ev) + ')\'>삭제</button>' : '';
    html += '<div class="sched-event">' +
      '<div class="sched-date">' + m + '/' + d + '</div>' +
      '<div class="sched-body"><div class="sched-name">' + escHtml(ev.name) + tagHtml + '</div>' +
      (ev.desc ? '<div class="sched-desc">' + escHtml(ev.desc) + '</div>' : '') +
      deleteHtml +
      '</div></div>';
  });
  personal.forEach(note => {
    html += '<div class="personal-note-item"><span>' + escHtml(note.text) + '</span>' +
      '<button onclick="deletePersonalEvent(' + y + ',' + m + ',' + d + ',\'' + note.id + '\')">삭제</button></div>';
  });
  html += '<div class="personal-add-row">' +
    '<input id="personal-note-input" placeholder="이 날짜에 나만 보는 일정 추가" onkeydown="if(event.key===\'Enter\')addPersonalEvent(' + y + ',' + m + ',' + d + ')" />' +
    '<button onclick="addPersonalEvent(' + y + ',' + m + ',' + d + ')">＋</button></div>';
  el.innerHTML = html;
}
