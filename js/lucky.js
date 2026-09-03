let luckyStarTimer = null;
function scheduleLuckyStar() {
  if (luckyStarTimer) clearTimeout(luckyStarTimer);
  luckyStarTimer = setTimeout(() => {
    const btn = document.getElementById('lucky-star-btn');
    if (!btn) return;
    // Appear at a random spot on screen, staying clear of the edges.
    const topPct = 8 + Math.random() * 74;
    const leftPct = 8 + Math.random() * 78;
    btn.style.top = topPct + 'vh';
    btn.style.left = leftPct + 'vw';
    btn.style.display = 'flex';
  }, 10000);
}
function clickLuckyStar() {
  const btn = document.getElementById('lucky-star-btn');
  if (btn) btn.style.display = 'none';
  const img = document.getElementById('lucky-popup-img');
  if (img && !img.src) img.src = LUCKY_IMG_DATA;
  document.getElementById('lucky-popup-overlay').style.display = 'flex';
  scheduleLuckyStar();
}
function closeLuckyPopup() {
  document.getElementById('lucky-popup-overlay').style.display = 'none';
}
