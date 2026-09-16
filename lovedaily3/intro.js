/* 每次重新打开页面播放开屏；切后台再回来不会重置。 */
(function () {
  'use strict';
  const overlay = document.getElementById('nn-intro');
  if (!overlay) return;
  const videos = ['opening', 'booking', 'selection'].map(id => document.getElementById('nn-' + id));
  const book = document.getElementById('nn-book');
  const select = document.getElementById('nn-select');
  const help = document.getElementById('nn-help');
  const message = document.getElementById('nn-message');
  let current = 0, finished = false, timer;
  const siblings = Array.from(document.body.children).filter(el => el !== overlay && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName));
  const oldInert = siblings.map(el => el.inert);
  siblings.forEach(el => { el.inert = true; });
  function hint(text) {
    if (finished) return;
    message.textContent = text;
    help.hidden = false;
  }
  function watch() {
    clearTimeout(timer);
    timer = setTimeout(() => hint('视频加载较慢，可以重试或直接进入日程。'), 15000);
  }
  function enter() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    videos.forEach(v => v.pause());
    book.hidden = select.hidden = help.hidden = true;
    overlay.classList.add('nn-leaving');
    function clean() {
      overlay.remove();
      document.documentElement.classList.remove('nn-intro-active');
      siblings.forEach((el, i) => { el.inert = oldInert[i]; });
    }
    overlay.addEventListener('transitionend', clean, {once:true});
    setTimeout(clean, 950);
  }
  function play(index) {
    if (finished) return;
    current = index;
    book.hidden = select.hidden = help.hidden = true;
    videos.forEach((v, i) => { if (i !== index) v.pause(); });
    watch();
    const v = videos[index];
    if (v.error) v.load();
    const attempt = v.play();
    if (attempt) attempt.catch(() => {
      if (current !== index || finished) return;
      clearTimeout(timer);
      hint('点击继续播放开场动画。');
    });
  }
  videos.forEach((v, index) => {
    v.muted = true;
    v.addEventListener('playing', () => {
      if (index !== current || finished) return;
      clearTimeout(timer);
      help.hidden = true;
      // 下一段真正开始播放时才换画面，保留上一段尾帧防止白闪。
      videos.forEach((clip, i) => clip.classList.toggle('nn-visible', i === index));
      if (index === 0) book.hidden = false;
    });
    v.addEventListener('waiting', () => { if (index === current && !finished) watch(); });
    v.addEventListener('error', () => {
      if (index !== current || finished) return;
      clearTimeout(timer);
      hint('视频暂时无法播放，可以重试或直接进入日程。');
    });
    v.addEventListener('ended', () => {
      if (index !== current || finished) return;
      clearTimeout(timer);
      help.hidden = true;
      if (index === 0) { book.hidden = false; book.focus({preventScroll:true}); }
      else if (index === 1) { select.hidden = false; select.focus({preventScroll:true}); }
      else enter();
    });
  });
  book.addEventListener('click', () => { if (current === 0 && !book.hidden) play(1); });
  select.addEventListener('click', () => { if (current === 1 && !select.hidden) play(2); });
  document.getElementById('nn-retry').addEventListener('click', () => play(current));
  document.getElementById('nn-enter').addEventListener('click', enter);
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(overlay.querySelectorAll('button')).filter(el => !el.hidden && !el.closest('[hidden]'));
    if (!buttons.length) { event.preventDefault(); return; }
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // autoplay 可能在脚本加载前已结束，需要恢复对应的等待状态。
  if (videos[0].ended) { book.hidden = false; book.focus({preventScroll:true}); }
  else play(0);
})();
