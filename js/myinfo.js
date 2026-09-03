function openMyInfoModal() {
  const users = DB.get(USERS_KEY) || {};
  const user = users[myId] || {};
  const code = classCodeFromStudentId(myId);
  let classInfo = myDept || '정보 없음';
  if (code) {
    const deptChar = code[0], grade = code[1], classNum = code[2];
    classInfo = (DEPT_LABELS[deptChar] || deptChar) + ' ' + grade + '학년 ' + classNum + '반';
  }
  const numberMatch = /^[0-9]{5}$/.test(myId || '') ? parseInt(myId.slice(3), 10) : null;
  let summary = '<div class="myinfo-row"><span>이름</span><b>' + escHtml(myName || '-') + '</b></div>' +
    '<div class="myinfo-row"><span>학번</span><b>' + escHtml(myId || '-') + '</b></div>' +
    '<div class="myinfo-row"><span>학과 · 반</span><b>' + escHtml(classInfo) + '</b></div>';
  if (numberMatch !== null) summary += '<div class="myinfo-row"><span>번호</span><b>' + numberMatch + '번</b></div>';
  if (user.email) summary += '<div class="myinfo-row"><span>이메일</span><b>' + escHtml(user.email) + '</b></div>';
  document.getElementById('myinfo-summary').innerHTML = summary;
  document.getElementById('myinfo-current-pw').value = '';
  document.getElementById('myinfo-new-pw').value = '';
  document.getElementById('myinfo-new-pw2').value = '';
  document.getElementById('myinfo-error').style.display = 'none';
  document.getElementById('myinfo-success').style.display = 'none';
  document.getElementById('myinfo-overlay').style.display = 'flex';
}
function closeMyInfoModal() { document.getElementById('myinfo-overlay').style.display = 'none'; }
function closeMyInfoIfOutside(e) { if (e.target === document.getElementById('myinfo-overlay')) closeMyInfoModal(); }
function submitPasswordChange() {
  const errEl = document.getElementById('myinfo-error');
  const okEl = document.getElementById('myinfo-success');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  const currentPw = document.getElementById('myinfo-current-pw').value;
  const newPw = document.getElementById('myinfo-new-pw').value;
  const newPw2 = document.getElementById('myinfo-new-pw2').value;
  const users = DB.get(USERS_KEY) || {};
  const user = users[myId];
  if (!user) { errEl.textContent = '계정 정보를 찾을 수 없어요.'; errEl.style.display = 'block'; return; }
  if (hashPassword(currentPw) !== user.passHash) { errEl.textContent = '현재 비밀번호가 올바르지 않아요.'; errEl.style.display = 'block'; return; }
  if (newPw.length < 6) { errEl.textContent = '새 비밀번호는 6자 이상이어야 해요.'; errEl.style.display = 'block'; return; }
  if (newPw !== newPw2) { errEl.textContent = '새 비밀번호가 서로 일치하지 않아요.'; errEl.style.display = 'block'; return; }
  user.passHash = hashPassword(newPw);
  users[myId] = user;
  DB.set(USERS_KEY, users);
  document.getElementById('myinfo-current-pw').value = '';
  document.getElementById('myinfo-new-pw').value = '';
  document.getElementById('myinfo-new-pw2').value = '';
  okEl.textContent = '비밀번호가 변경되었어요.';
  okEl.style.display = 'block';
}
