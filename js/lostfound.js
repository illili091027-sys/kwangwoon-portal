function showLostFound() {
  hideAllViews();
  document.getElementById('lostfound').classList.add('active');
  window.scrollTo(0, 0);
  renderItems();
}

// School schedule (from 2026학년도 학사일정 조정 안내, 2026.06.23 가정통신문)
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderItems();
}
function renderItems() {
  const q = (document.getElementById('search-input').value || '').trim().toLowerCase();
  const filtered = items
    .filter(it => currentFilter === 'all' || currentFilter === 'mine' ? true : it.type === currentFilter)
    .filter(it => currentFilter !== 'mine' || it.authorId === myId)
    .filter(it => !q || (it.name||'').toLowerCase().includes(q) || (it.location||'').toLowerCase().includes(q) || (it.description||'').toLowerCase().includes(q))
    .sort((a, b) => { if (a.status !== b.status) return a.status === 'open' ? -1 : 1; return b.createdAt - a.createdAt; });

  const container = document.getElementById('items-container');
  if (filtered.length === 0) {
    const emptyTitle = currentFilter === 'mine' ? '내가 등록한 글이 없어요' : (items.length === 0 ? '아직 등록된 물건이 없어요' : '검색 결과가 없어요');
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICON.package(24) + '</div><div class="empty-title">' + emptyTitle + '</div><div class="empty-sub">가장 먼저 등록해보세요</div></div>';
    return;
  }

  let html = '<div class="items-grid">';
  filtered.forEach(item => {
    const isLost = item.type === 'lost';
    const resolved = item.status === 'resolved';
    const isMine = item.authorId === myId;
    const canDelete = isAdmin || isMine;
    const photos = DB.get(PHOTO_PREFIX + item.id) || [];
    let photoHtml = '';
    if (photos.length > 0) {
      const single = photos.length === 1;
      photoHtml = '<div class="photo-strip" style="margin-bottom:4px">';
      photos.forEach((src, i) => {
        const w = single ? '100%' : '72px';
        const h = single ? '160px' : '72px';
        photoHtml += '<div class="photo-thumb" style="width:' + w + ';height:' + h + '" onclick="openLightbox(\'' + item.id + '\',' + i + ')"><img src="' + src + '" alt="사진"/></div>';
      });
      photoHtml += '</div>';
    }
    const rStyle = resolved ? 'background:#F1F2F6;color:var(--slate)' : 'background:var(--navySoft);color:var(--navy)';
    html += '<div class="item-card' + (resolved ? ' resolved' : '') + '">'
      + photoHtml
      + '<div class="item-card-toprow"><div class="item-badges">'
      + '<span class="badge ' + (isLost ? 'badge-lost' : 'badge-found') + '">' + (isLost ? '분실물' : '습득물') + '</span>'
      + (resolved ? '<span class="badge badge-resolved">해결됨</span>' : '')
      + (isMine ? '<span class="badge badge-mine">내 글</span>' : '')
      + '</div><span class="item-time">' + timeAgo(item.createdAt) + '</span></div>'
      + '<div class="item-name' + (resolved ? ' resolved' : '') + '">' + escHtml(item.name) + '</div>'
      + '<div class="item-meta">'
      + '<div class="item-meta-row">' + ICON.mapPin(14) + ' ' + escHtml(item.location) + '</div>'
      + '<div class="item-meta-row">' + ICON.calendarDays(14) + ' ' + escHtml(item.date) + '</div>'
      + (item.contact ? '<div class="item-meta-row">' + ICON.message(14) + ' ' + escHtml(item.contact) + '</div>' : '')
      + '</div>'
      + (item.description ? '<div class="item-desc">' + escHtml(item.description) + '</div>' : '')
      + '<div class="item-actions">'
      + '<button class="resolve-btn" style="' + rStyle + '" onclick="toggleResolve(\'' + item.id + '\')">' + (resolved ? ICON.rotate(14) + ' 다시 열기' : ICON.check(14) + ' 해결됨으로 표시') + '</button>'
      + (canDelete ? '<button class="delete-btn" onclick="deleteItem(\'' + item.id + '\')" aria-label="삭제">' + ICON.trash(14) + '</button>' : '')
      + '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}
function toggleResolve(id) {
  items = items.map(it => it.id === id ? Object.assign({}, it, {status: it.status === 'open' ? 'resolved' : 'open'}) : it);
  persist(); renderItems();
}
function deleteItem(id) {
  items = items.filter(it => it.id !== id);
  DB.del(PHOTO_PREFIX + id);
  persist(); renderItems(); updateHomeCount();
}
function persist() {
  const ok = DB.set(STORAGE_KEY, items);
  document.getElementById('sync-error').style.display = ok ? 'none' : 'block';
}

// Add modal
function openAddModal() {
  formPhotos = []; formType = 'lost';
  document.getElementById('form-name').value = '';
  document.getElementById('form-location').value = '';
  document.getElementById('form-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('form-desc').value = '';
  document.getElementById('form-contact').value = '';
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('submit-btn').textContent = '등록하기';
  selectType('lost');
  renderPhotoRow();
  document.getElementById('add-overlay').style.display = 'flex';
}
function closeAddModal() { document.getElementById('add-overlay').style.display = 'none'; }
function closeAddIfOutside(e) { if (e.target === document.getElementById('add-overlay')) closeAddModal(); }
function selectType(t) {
  formType = t;
  document.getElementById('type-lost').classList.toggle('selected', t === 'lost');
  document.getElementById('type-found').classList.toggle('selected', t === 'found');
  document.getElementById('form-location-label').textContent = t === 'lost' ? '잃어버린 장소' : '주운 장소';
}
function handlePhotoFiles(input) {
  const files = Array.from(input.files || []);
  input.value = '';
  if (!files.length) return;
  const room = MAX_PHOTOS - formPhotos.length;
  if (room <= 0) { showFormError('사진은 최대 3장까지 첨부할 수 있어요'); return; }
  Promise.all(files.slice(0, room).map(compressImage))
    .then(compressed => { formPhotos = formPhotos.concat(compressed); renderPhotoRow(); })
    .catch(() => showFormError('사진을 처리하지 못했어요'));
}
function renderPhotoRow() {
  const row = document.getElementById('photo-row');
  let html = '';
  formPhotos.forEach((src, i) => {
    html += '<div class="photo-thumb-sm"><img src="' + src + '" alt="사진"/><button class="photo-remove" onclick="removeFormPhoto(' + i + ')">✕</button></div>';
  });
  if (formPhotos.length < MAX_PHOTOS) {
    html += '<label class="photo-add-label">' + ICON.image(18) + '<span>' + formPhotos.length + '/' + MAX_PHOTOS + '</span><input type="file" accept="image/*" multiple style="display:none" onchange="handlePhotoFiles(this)" /></label>';
  }
  row.innerHTML = html;
}
function removeFormPhoto(i) { formPhotos = formPhotos.filter((_,idx) => idx !== i); renderPhotoRow(); }
function showFormError(msg) { var el = document.getElementById('form-error'); el.textContent = msg; el.style.display = 'block'; }
function submitItem() {
  const name = document.getElementById('form-name').value.trim();
  const location = document.getElementById('form-location').value.trim();
  const date = document.getElementById('form-date').value;
  const description = document.getElementById('form-desc').value.trim();
  const contact = document.getElementById('form-contact').value.trim();
  if (!name || !location || !date) { showFormError('물품명, 장소, 날짜는 꼭 입력해주세요'); return; }
  document.getElementById('form-error').style.display = 'none';
  const id = 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const newItem = { id, type: formType, name, location, date, description, contact, hasPhotos: formPhotos.length > 0, authorId: myId, status: 'open', createdAt: Date.now() };
  if (formPhotos.length > 0) DB.set(PHOTO_PREFIX + id, formPhotos);
  items = [newItem].concat(items);
  persist(); updateHomeCount(); closeAddModal(); renderItems();
}

// Admin
function openLightbox(itemId, startIndex) {
  lbPhotos = DB.get(PHOTO_PREFIX + itemId) || [];
  lbIndex = startIndex;
  updateLightbox();
  document.getElementById('lightbox').style.display = 'flex';
}
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }
function updateLightbox() {
  document.getElementById('lb-img').src = lbPhotos[lbIndex];
  var multi = lbPhotos.length > 1;
  document.getElementById('lb-prev').style.display = multi ? '' : 'none';
  document.getElementById('lb-next').style.display = multi ? '' : 'none';
  document.getElementById('lb-counter').textContent = multi ? (lbIndex+1) + ' / ' + lbPhotos.length : '';
}
function lbPrev(e) { e.stopPropagation(); lbIndex = (lbIndex - 1 + lbPhotos.length) % lbPhotos.length; updateLightbox(); }
function lbNext(e) { e.stopPropagation(); lbIndex = (lbIndex + 1) % lbPhotos.length; updateLightbox(); }

// Image compress
