// 未視聴のみ — チャンネルの動画一覧で、見た動画（赤い再生バーが付いた動画／手動で✓を付けた動画）を隠す
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

  // ---------- 手動の「視聴済み」チェック（Edgeの拡張機能用保存領域に保存） ----------
  const KEY_MANUAL = 'csyManualWatched'; // { 動画ID: チェックした時刻 }
  let manual = {};
  const ext = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  function loadManual() {
    if (!ext) return;
    ext.get(KEY_MANUAL, (r) => {
      manual = (r && r[KEY_MANUAL]) || {};
      tick();
    });
  }
  function toggleManual(id) {
    if (manual[id]) delete manual[id];
    else manual[id] = Date.now();
    if (ext) ext.set({ [KEY_MANUAL]: manual });
    tick();
  }
  if (ext && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[KEY_MANUAL]) {
        manual = changes[KEY_MANUAL].newValue || {};
        tick();
      }
    });
  }
  function videoIdOf(el) {
    const a = el.querySelector('a[href*="/watch?v="]');
    if (!a) return null;
    try { return new URL(a.getAttribute('href'), location.origin).searchParams.get('v'); } catch (_) { return null; }
  }

  // 💬ボタンの隣に ✓ ボタンを置く
  function decorateChecks() {
    for (const chat of document.querySelectorAll('.csy-btn')) {
      const host = chat.parentElement;
      const box = chat.closest('[data-csy-done]');
      if (!host || !box) continue;
      const id = box.getAttribute('data-csy-done');
      let btn = host.querySelector(':scope > .csy-check');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'csy-check';
        btn.textContent = '✓';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (btn.dataset.vid) toggleManual(btn.dataset.vid);
        }, true);
        btn.addEventListener('mousedown', (e) => e.stopPropagation(), true);
        host.appendChild(btn);
      }
      if (btn.dataset.vid !== id) btn.dataset.vid = id;
      const marked = !!manual[id];
      if (btn.classList.contains('is-marked') !== marked) btn.classList.toggle('is-marked', marked);
      const tip = marked ? '視聴済みのチェックを外す' : '視聴済みにする';
      if (btn.title !== tip) {
        btn.title = tip;
        btn.setAttribute('aria-label', tip);
      }
    }
  }

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

  function isWatched(item) {
    const p = watchedPercent(item);
    const id = videoIdOf(item);
    return (id && !!manual[id]) || (p != null && (mode === 'any' ? p > 0 : p >= 90));
  }

  // ---------- 未視聴の連続再生 ----------
  const MAX_PLAY = 50; // YouTubeの一時再生リストに並べられる上限
  // 並び順：YouTubeの並び替えボタン（左から 新しい順・人気の動画・古い順）の位置
  const SORTS = [['oldest', '古い順', 2], ['newest', '新しい順', 0], ['popular', '人気順', 1]];
  function sortButtons() {
    return [...document.querySelectorAll('ytd-browse:not([hidden]) chip-bar-view-model chip-view-model button, ytd-browse:not([hidden]) ytd-feed-filter-chip-bar-renderer yt-chip-cloud-chip-renderer')];
  }
  function currentSortIndex() {
    return sortButtons().findIndex((b) => b.getAttribute('aria-selected') === 'true' || b.hasAttribute('selected'));
  }
  function listItems() {
    return [...document.querySelectorAll('ytd-browse:not([hidden]) ' + ITEM.split(',').join(', ytd-browse:not([hidden]) '))];
  }
  function unwatchedIds() {
    const ids = [];
    for (const item of listItems()) {
      if (isWatched(item)) continue;
      const id = videoIdOf(item);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let busy = false;
  async function playUnwatched() {
    if (busy) return;
    busy = true;
    const y = window.scrollY;
    try {
      let ids = unwatchedIds();
      // 50本に届かなければ、下の動画を読み込みながら集める（最大10回）
      for (let round = 0; ids.length < MAX_PLAY && round < 10; round++) {
        const cont = document.querySelector('ytd-browse:not([hidden]) ytd-continuation-item-renderer');
        if (!cont) break;
        setPlayLabel(`読み込み中…（未視聴 ${ids.length}本）`);
        const before = listItems().length;
        cont.scrollIntoView({ block: 'end' });
        let grew = false;
        for (let i = 0; i < 16; i++) {
          await sleep(500);
          if (listItems().length > before) { grew = true; break; }
        }
        if (!grew) break;
        ids = unwatchedIds();
      }
      window.scrollTo(0, y);
      if (!ids.length) {
        setPlayLabel('未視聴の動画はありません');
        await sleep(2000);
        return;
      }
      location.href = '/watch_videos?video_ids=' + ids.slice(0, MAX_PLAY).join(',');
    } finally {
      busy = false;
      tick();
    }
  }

  function apply() {
    const active = on && isChannelList();
    document.documentElement.classList.toggle('csy-unwatched-only', active);
    let watchedCount = 0;
    let total = 0;
    for (const item of document.querySelectorAll(ITEM)) {
      if (!item.querySelector('a[href*="/watch?v="]')) continue; // 読み込み中の枠は数えない
      total++;
      const watched = isWatched(item);
      item.toggleAttribute('data-csy-watched', watched);
      if (watched) watchedCount++;
    }
    updateChip(total - watchedCount, watchedCount, active);
  }

  // ---------- ボタン（並び替えチップの横に置く） ----------
  let chip = null;
  let label = null;
  let menu = null;
  let playBtn = null;
  let seg = null;
  function setPlayLabel(text) {
    if (playBtn && playBtn.textContent !== text) playBtn.textContent = text;
  }

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
    playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'csy-play';
    playBtn.title = '一覧の未視聴の動画を、選んだ順番で続けて再生します（最大50本）';
    playBtn.addEventListener('click', playUnwatched);

    seg = document.createElement('div');
    seg.className = 'csy-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', '再生する順番');
    for (const [key, text, idx] of SORTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.idx = String(idx);
      b.textContent = text;
      b.addEventListener('click', () => {
        const target = sortButtons()[idx];
        if (target && target.getAttribute('aria-selected') !== 'true') target.click();
      });
      seg.append(b);
    }
    wrap.append(btn, opt, menu, playBtn, seg);
    return wrap;
  }

  function btnTitle(t) {
    const b = chip && chip.querySelector('.csy-uw-btn');
    if (b && b.title !== t) b.title = t;
  }
  // 数はYouTubeが読み込み済みの動画のみ（下へスクロールすると増える）
  function updateChip(unwatched, watched, active) {
    if (!chip) return;
    chip.classList.toggle('is-on', on);
    const text = active
      ? `未視聴のみ：${unwatched}本（${watched}本を非表示）`
      : `未視聴のみ（未視聴 ${unwatched}本）`;
    if (label.textContent !== text) label.textContent = text; // 同じ内容なら書き換えない（監視の無限ループ防止）
    btnTitle(`読み込み済み ${unwatched + watched}本のうち、未視聴 ${unwatched}本・視聴済み ${watched}本。下へスクロールすると残りも数えます`);
    if (!busy) setPlayLabel(unwatched ? `▶ 未視聴を連続再生（${Math.min(unwatched, MAX_PLAY)}本〜）` : '▶ 未視聴を連続再生');
    const cur = currentSortIndex();
    for (const b of seg.querySelectorAll('button')) {
      const sel = Number(b.dataset.idx) === cur;
      if (b.classList.contains('is-sel') !== sel) b.classList.toggle('is-sel', sel);
      if (b.getAttribute('aria-pressed') !== String(sel)) b.setAttribute('aria-pressed', String(sel));
    }
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
    decorateChecks();
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
  loadManual();
})();
