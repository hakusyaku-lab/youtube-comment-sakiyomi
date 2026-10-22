// 未視聴のみ — チャンネルの動画一覧で、見た動画（赤い再生バーが付いた動画）を隠す
(() => {
  'use strict';

  const KEY_ON = 'csy-unwatched-on';
  const KEY_MODE = 'csy-unwatched-mode'; // 'any' = 少しでも見たら隠す / 'done' = 9割以上見たら隠す
  const ITEM = 'ytd-rich-item-renderer, ytd-grid-video-renderer';
  const BAR = [
    'ytd-thumbnail-overlay-resume-playback-renderer #progress',
    'yt-thumbnail-overlay-progress-bar-view-model [class*="Segment"]',
    '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
  ].join(',');

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  let on = store.get(KEY_ON, '0') === '1';
  let mode = store.get(KEY_MODE, 'any');

  function isChannelList() {
    return /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/(videos|streams|podcasts)\/?$/.test(location.pathname);
  }

  // 再生バーの割合（0〜100）。バーが無ければ null
  function watchedPercent(item) {
    const bar = item.querySelector(BAR);
    if (!bar) return null;
    const w = parseFloat(bar.style.width);
    return isNaN(w) ? 100 : w;
  }

  function apply() {
    const active = on && isChannelList();
    document.documentElement.classList.toggle('csy-unwatched-only', active);
    let watchedCount = 0;
    let total = 0;
    for (const item of document.querySelectorAll(ITEM)) {
      if (!item.querySelector('a[href*="/watch?v="]')) continue; // 読み込み中の枠は数えない
      total++;
      const p = watchedPercent(item);
      const watched = p != null && (mode === 'any' ? p > 0 : p >= 90);
      item.toggleAttribute('data-csy-watched', watched);
      if (watched) watchedCount++;
    }
    updateChip(total - watchedCount, watchedCount, active);
  }

  // ---------- ボタン（並び替えチップの横に置く） ----------
  let chip = null;
  let label = null;
  let menu = null;

  function findChipBar() {
    const list = [...document.querySelectorAll('ytd-browse[role="main"] ytd-feed-filter-chip-bar-renderer #chips, ytd-browse[role="main"] chip-bar-view-model, ytd-browse:not([hidden]) ytd-feed-filter-chip-bar-renderer #chips, ytd-browse:not([hidden]) chip-bar-view-model')];
    return list.find((e) => e.offsetParent !== null) || null;
  }

  function buildChip() {
    const wrap = document.createElement('div');
    wrap.className = 'csy-uw';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'csy-uw-btn';
    label = document.createElement('span');
    btn.append(label);
    btn.addEventListener('click', () => {
      on = !on;
      store.set(KEY_ON, on ? '1' : '0');
      apply();
    });

    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'csy-uw-opt';
    opt.textContent = '▾';
    opt.title = '隠す条件を選ぶ';
    opt.setAttribute('aria-label', '隠す条件を選ぶ');
    menu = document.createElement('div');
    menu.className = 'csy-uw-menu';
    menu.hidden = true;
    for (const [val, text] of [['any', '少しでも見た動画を隠す'], ['done', '最後まで見た動画だけ隠す（9割以上）']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.mode = val;
      b.textContent = text;
      b.addEventListener('click', () => {
        mode = val;
        store.set(KEY_MODE, mode);
        menu.hidden = true;
        if (!on) { on = true; store.set(KEY_ON, '1'); }
        apply();
      });
      menu.append(b);
    }
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', (e) => {
      if (menu && !menu.hidden && !wrap.contains(e.target)) menu.hidden = true;
    });
    wrap.append(btn, opt, menu);
    return wrap;
  }

  // 数はYouTubeが読み込み済みの動画のみ（下へスクロールすると増える）
  function updateChip(unwatched, watched, active) {
    if (!chip) return;
    chip.classList.toggle('is-on', on);
    const text = active
      ? `未視聴のみ：${unwatched}本（${watched}本を非表示）`
      : `未視聴のみ（未視聴 ${unwatched}本）`;
    if (label.textContent !== text) label.textContent = text; // 同じ内容なら書き換えない（監視の無限ループ防止）
    chip.title = `読み込み済み ${unwatched + watched}本のうち、未視聴 ${unwatched}本・視聴済み ${watched}本。下へスクロールすると残りも数えます`;
    for (const b of menu.querySelectorAll('button')) b.classList.toggle('is-sel', b.dataset.mode === mode);
  }

  function ensureChip() {
    if (!isChannelList()) {
      if (chip) chip.remove();
      return;
    }
    const bar = findChipBar();
    if (!chip) chip = buildChip();
    if (bar) {
      if (chip.parentElement !== bar) bar.append(chip);
      chip.classList.remove('is-floating');
    } else if (!chip.isConnected || !chip.classList.contains('is-floating')) {
      // 並び替えボタンが見つからない場合は右下に浮かせて置く
      chip.classList.add('is-floating');
      document.body.append(chip);
    }
  }

  function tick() {
    ensureChip();
    apply();
  }

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; tick(); }, 250);
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', () => setTimeout(tick, 300));
  tick();
})();
