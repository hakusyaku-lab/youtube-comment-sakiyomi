// ==UserScript==
// @name         コメント先読み＆未視聴のみ（スマホ版）
// @namespace    https://github.com/hakusyaku-lab/youtube-comment-sakiyomi
// @version      1.2.0
// @description  スマホ版YouTubeで、動画を開く前に人気コメントを確認し、チャンネルの動画一覧を未視聴だけに絞り込めます。
// @match        https://m.youtube.com/*
// @run-at       document-end
// @noframes
// @updateURL    https://raw.githubusercontent.com/hakusyaku-lab/youtube-comment-sakiyomi/main/mobile/comment-sakiyomi.user.js
// @downloadURL  https://raw.githubusercontent.com/hakusyaku-lab/youtube-comment-sakiyomi/main/mobile/comment-sakiyomi.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__csyMobile) return;
  window.__csyMobile = true;

  // ================= 見た目 =================
  const CSS = `
.csy-btn, .csy-check {
  position: absolute; top: 6px; z-index: 20;
  width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%;
  background: rgba(15, 15, 20, 0.72); color: #fff;
  font: 700 15px/30px -apple-system, "Hiragino Sans", sans-serif; text-align: center;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.csy-btn { left: 6px; }
.csy-check { left: 42px; }
.csy-btn:active { background: #f2b705; }
.csy-check.is-marked { background: #2f9e5b; }

.csy-veil { position: fixed; inset: 0; z-index: 3999; background: rgba(0, 0, 0, 0.45); }
.csy-panel {
  --csy-bg: #ffffff; --csy-fg: #17171c; --csy-sub: #5f6170; --csy-line: #e4e4ea; --csy-accent: #f2b705; --csy-chip: #fff3c4;
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 4000;
  max-height: 72vh; display: flex; flex-direction: column;
  background: var(--csy-bg); color: var(--csy-fg);
  border-radius: 16px 16px 0 0; box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.3);
  font: 14px/1.5 -apple-system, "Hiragino Sans", sans-serif;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
html[dark] .csy-panel, html[darker-dark-theme] .csy-panel {
  --csy-bg: #1d1d23; --csy-fg: #f1f1f4; --csy-sub: #a6a7b4; --csy-line: #34343e; --csy-chip: #3a3220;
}
@media (prefers-color-scheme: dark) {
  .csy-panel { --csy-bg: #1d1d23; --csy-fg: #f1f1f4; --csy-sub: #a6a7b4; --csy-line: #34343e; --csy-chip: #3a3220; }
}
.csy-grip { width: 40px; height: 4px; border-radius: 2px; background: var(--csy-line); margin: 8px auto 2px; }
.csy-head { display: flex; gap: 8px; align-items: flex-start; padding: 8px 12px 6px 16px; }
.csy-title { flex: 1; min-width: 0; font-weight: 700; font-size: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.csy-close { flex: none; width: 34px; height: 34px; border: 0; border-radius: 50%; background: var(--csy-line); color: var(--csy-fg); font-size: 18px; }
.csy-meta { padding: 0 16px 8px; color: var(--csy-sub); font-size: 12.5px; border-bottom: 1px solid var(--csy-line); }
.csy-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; flex: 1; }
.csy-item { padding: 10px 16px; border-bottom: 1px solid var(--csy-line); }
.csy-row { display: flex; gap: 10px; align-items: baseline; }
.csy-author { font-weight: 700; font-size: 12.5px; }
.csy-time, .csy-sub { color: var(--csy-sub); font-size: 12px; }
.csy-text { margin: 3px 0; white-space: pre-wrap; word-break: break-word; }
.csy-likes { background: var(--csy-chip); border-radius: 999px; padding: 0 8px; color: var(--csy-fg); }
.csy-foot { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--csy-line); }
.csy-more, .csy-open {
  flex: 1; border: 1px solid var(--csy-line); border-radius: 999px; padding: 10px 12px;
  font: 600 14px -apple-system, "Hiragino Sans", sans-serif; background: transparent; color: var(--csy-fg);
  text-align: center; text-decoration: none;
}
.csy-open { background: var(--csy-accent); border-color: var(--csy-accent); color: #17171c; }
.csy-more:disabled { opacity: 0.6; }

html.csy-unwatched-only ytm-rich-item-renderer[data-csy-watched] { display: none !important; }
.csy-uw { display: flex; flex-wrap: wrap; gap: 8px; position: relative; align-items: stretch; margin: 4px 12px 8px; font: 500 14px -apple-system, "Hiragino Sans", sans-serif; }
.csy-uw-pair { display: flex; }
.csy-play {
  flex: 1 1 100%; height: 38px; border: 0; border-radius: 8px; background: #2f9e5b; color: #fff;
  font: 600 14px -apple-system, "Hiragino Sans", sans-serif; -webkit-tap-highlight-color: transparent;
}
.csy-play:active { background: #268a4e; }
.csy-seg { display: flex; flex: 1 1 100%; border-radius: 8px; overflow: hidden; background: rgba(128, 128, 128, 0.16); }
.csy-seg button {
  flex: 1; height: 34px; border: 0; background: transparent; color: inherit;
  font: 500 13px -apple-system, "Hiragino Sans", sans-serif; -webkit-tap-highlight-color: transparent; white-space: nowrap;
}
.csy-seg button + button { border-left: 1px solid rgba(128, 128, 128, 0.3); }
.csy-seg button.is-sel { background: #17171c; color: #fff; }
html[dark] .csy-seg button.is-sel, html[darker-dark-theme] .csy-seg button.is-sel { background: #f1f1f4; color: #17171c; }
.csy-uw.is-floating { position: fixed; left: 12px; right: 12px; bottom: calc(64px + env(safe-area-inset-bottom, 0px)); z-index: 3000; margin: 0; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25); border-radius: 8px; }
.csy-uw-btn, .csy-uw-opt {
  height: 34px; border: 0; background: rgba(128, 128, 128, 0.16); color: inherit;
  font: inherit; -webkit-tap-highlight-color: transparent;
}
.csy-uw-btn { padding: 0 14px; border-radius: 8px 0 0 8px; }
.csy-uw-opt { padding: 0 12px; border-radius: 0 8px 8px 0; border-left: 1px solid rgba(128, 128, 128, 0.3); }
.csy-uw.is-on .csy-uw-btn, .csy-uw.is-on .csy-uw-opt { background: #f2b705; color: #17171c; }
.csy-uw-menu {
  position: absolute; top: 40px; left: 0; z-index: 3001; min-width: 250px;
  display: flex; flex-direction: column; padding: 6px; border-radius: 10px;
  background: #fff; color: #17171c; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
}
.csy-uw.is-floating .csy-uw-menu { top: auto; bottom: 40px; left: auto; right: 0; }
.csy-uw-menu button { text-align: left; border: 0; background: transparent; color: inherit; padding: 11px 12px; border-radius: 6px; font: inherit; }
.csy-uw-menu button.is-sel::before { content: "✓ "; color: #b07d00; font-weight: 700; }
`;
  const style = document.createElement('style');
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);

  // ================= 共通 =================
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function videoIdFrom(href) {
    try {
      const u = new URL(href, location.origin);
      if (u.pathname === '/watch') return u.searchParams.get('v');
    } catch (_) {}
    return null;
  }

  // ================= コメント取得（YouTube内部の仕組み） =================
  const cache = new Map();
  function cfg(name, fallback) {
    const re = new RegExp('"' + name + '":"([^"]+)"');
    for (const s of document.scripts) {
      const m = re.exec(s.textContent || '');
      if (m) return m[1];
    }
    return fallback;
  }
  async function innertube(body) {
    const res = await fetch('/youtubei/v1/next?prettyPrint=false', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: cfg('INNERTUBE_CLIENT_NAME', 'MWEB'), clientVersion: cfg('INNERTUBE_CLIENT_VERSION', '2.20261020.00.00'), hl: 'ja', gl: 'JP' } },
        ...body,
      }),
    });
    if (!res.ok) throw new Error('通信エラー（' + res.status + '）');
    return res.json();
  }
  function findAll(obj, test, out = [], depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 60) return out;
    if (test(obj)) out.push(obj);
    for (const k in obj) findAll(obj[k], test, out, depth + 1);
    return out;
  }
  const findFirst = (o, t) => findAll(o, t)[0];
  function runsText(t) {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (t.simpleText) return t.simpleText;
    if (t.content) return t.content;
    if (Array.isArray(t.runs)) return t.runs.map((r) => r.text).join('');
    return '';
  }
  const hasToken = (o) => o.continuationCommand && o.continuationCommand.token;

  async function firstToken(videoId) {
    const data = await innertube({ videoId });
    const section = findFirst(data, (o) => o.itemSectionRenderer && (o.itemSectionRenderer.sectionIdentifier === 'comment-item-section' || o.itemSectionRenderer.targetId === 'comments-section'));
    let cmd = section && findFirst(section, hasToken);
    if (!cmd) {
      const panel = findFirst(data, (o) => o.engagementPanelSectionListRenderer && /comment/i.test(o.engagementPanelSectionListRenderer.panelIdentifier || o.engagementPanelSectionListRenderer.targetId || ''));
      cmd = panel && findFirst(panel, hasToken);
    }
    return cmd ? cmd.continuationCommand.token : null;
  }
  function parseComments(data) {
    const comments = [];
    const payloads = new Map();
    for (const m of findAll(data, (o) => o.payload && o.payload.commentEntityPayload)) payloads.set(m.entityKey, m.payload.commentEntityPayload);
    const keys = findAll(data, (o) => o.commentViewModel && typeof o.commentViewModel.commentKey === 'string').map((o) => o.commentViewModel.commentKey);
    const ordered = keys.length ? keys.map((k) => payloads.get(k)).filter(Boolean) : [...payloads.values()];
    for (const p of ordered) {
      const pr = p.properties || {};
      if (pr.replyLevel) continue;
      comments.push({
        author: (p.author && p.author.displayName) || '',
        text: runsText(pr.content),
        likes: (p.toolbar && p.toolbar.likeCountNotliked) || '',
        time: pr.publishedTime || '',
        replies: (p.toolbar && p.toolbar.replyCount) || '',
      });
    }
    if (!comments.length) {
      for (const t of findAll(data, (o) => o.commentThreadRenderer)) {
        const c = findFirst(t, (o) => o.commentRenderer);
        if (!c) continue;
        const r = c.commentRenderer;
        comments.push({
          author: runsText(r.authorText),
          text: runsText(r.contentText),
          likes: runsText(r.voteCount),
          time: runsText(r.publishedTimeText),
          replies: r.replyCount ? String(r.replyCount) : '',
        });
      }
    }
    const header = findFirst(data, (o) => o.commentsHeaderRenderer);
    const count = header ? runsText(header.commentsHeaderRenderer.countText) || runsText(header.commentsHeaderRenderer.commentsCount) : '';
    const items = findAll(data, (o) => Array.isArray(o.continuationItems)).flatMap((o) => o.continuationItems);
    const last = items.length ? items[items.length - 1] : null;
    const nextCmd = last && last.continuationItemRenderer && findFirst(last.continuationItemRenderer, hasToken);
    return { comments, count, next: nextCmd ? nextCmd.continuationCommand.token : null };
  }
  async function loadComments(videoId) {
    if (cache.has(videoId)) return cache.get(videoId);
    const token = await firstToken(videoId);
    const r = token ? parseComments(await innertube({ continuation: token })) : { comments: [], count: '', next: null, disabled: true };
    cache.set(videoId, r);
    return r;
  }
  async function loadMore(videoId) {
    const cur = cache.get(videoId);
    if (!cur || !cur.next) return cur;
    const r = parseComments(await innertube({ continuation: cur.next }));
    cur.comments = cur.comments.concat(r.comments);
    cur.next = r.next;
    return cur;
  }

  // ================= コメントパネル（画面下から出る） =================
  let panel = null;
  let veil = null;
  let currentId = null;
  function closePanel() {
    if (panel) panel.remove();
    if (veil) veil.remove();
    panel = veil = currentId = null;
  }
  function openPanel(videoId, title, href) {
    closePanel();
    currentId = videoId;
    veil = el('div', 'csy-veil');
    veil.addEventListener('click', closePanel);
    panel = el('div', 'csy-panel');
    panel.setAttribute('role', 'dialog');
    const head = el('div', 'csy-head');
    const close = el('button', 'csy-close', '×');
    close.setAttribute('aria-label', '閉じる');
    close.addEventListener('click', closePanel);
    head.append(el('div', 'csy-title', title || '動画のコメント'), close);
    const meta = el('div', 'csy-meta', '人気のコメントを読み込み中…');
    const list = el('ol', 'csy-list');
    const foot = el('div', 'csy-foot');
    const more = el('button', 'csy-more', 'もっと見る');
    more.hidden = true;
    const open = el('a', 'csy-open', 'この動画を見る ▶');
    open.href = href;
    foot.append(more, open);
    panel.append(el('div', 'csy-grip'), head, meta, list, foot);
    document.body.append(veil, panel);

    const render = (r) => {
      if (currentId !== videoId) return;
      list.textContent = '';
      if (r.disabled) meta.textContent = 'この動画はコメントがオフになっているか、まだありません。';
      else if (!r.comments.length) meta.textContent = 'コメントはまだありません。';
      else meta.textContent = (r.count ? r.count + ' · ' : '') + '人気順';
      for (const c of r.comments) {
        const li = el('li', 'csy-item');
        const top = el('div', 'csy-row');
        top.append(el('span', 'csy-author', c.author), el('span', 'csy-time', c.time));
        li.append(top, el('div', 'csy-text', c.text));
        const bottom = el('div', 'csy-row csy-sub');
        if (c.likes) bottom.append(el('span', 'csy-likes', '👍 ' + c.likes));
        if (c.replies) bottom.append(el('span', null, '返信 ' + c.replies));
        if (bottom.childNodes.length) li.append(bottom);
        list.append(li);
      }
      more.hidden = !r.next;
      more.disabled = false;
      more.textContent = 'もっと見る';
    };
    more.addEventListener('click', async () => {
      more.disabled = true;
      more.textContent = '読み込み中…';
      try { render(await loadMore(videoId)); } catch (_) { more.disabled = false; more.textContent = 'もう一度読み込む'; }
    });
    loadComments(videoId).then(render).catch((e) => {
      if (currentId !== videoId) return;
      meta.textContent = 'コメントを読み込めませんでした（' + e.message + '）。少し待ってからもう一度押してください。';
      cache.delete(videoId);
    });
  }

  // ================= 視聴済みチェック（このスマホのSafariに保存） =================
  const KEY_MANUAL = 'csy-manual-watched';
  let manual = {};
  try { manual = JSON.parse(store.get(KEY_MANUAL, '{}')) || {}; } catch (_) { manual = {}; }
  function toggleManual(id) {
    if (manual[id]) delete manual[id];
    else manual[id] = Date.now();
    store.set(KEY_MANUAL, JSON.stringify(manual));
    schedule();
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY_MANUAL) {
      try { manual = JSON.parse(e.newValue || '{}') || {}; } catch (_) { manual = {}; }
      schedule();
    }
  });

  // ================= サムネイルにボタンを付ける =================
  const CONTAINERS = 'ytm-rich-item-renderer, ytm-compact-video-renderer, ytm-video-with-context-renderer, ytm-playlist-video-renderer';

  function tapGuard(btn, fn) {
    // サムネイルのリンクが反応しないように、押した瞬間からイベントを止める
    for (const t of ['touchstart', 'touchend', 'mousedown', 'pointerdown']) btn.addEventListener(t, (e) => e.stopPropagation(), true);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    }, true);
  }

  function decorate(box) {
    // 入れ子（rich-item の中の compact-video）は内側だけを使う
    if (box.matches('ytm-rich-item-renderer') && box.querySelector('ytm-compact-video-renderer, ytm-video-with-context-renderer')) return;
    const link = box.querySelector('a[href*="/watch?v="]');
    if (!link) return;
    const id = videoIdFrom(link.getAttribute('href'));
    if (!id) return;
    const thumb = box.querySelector('ytm-compact-thumbnail, ytm-media-item .media-item-thumbnail-container, .video-thumbnail-container-large, .video-thumbnail-container-compact, a.YtmCompactMediaItemImage') || link;
    if (getComputedStyle(thumb).position === 'static') thumb.style.position = 'relative';

    let chat = thumb.querySelector(':scope > .csy-btn');
    let check = thumb.querySelector(':scope > .csy-check');
    if (!chat) {
      chat = el('button', 'csy-btn', '💬');
      chat.type = 'button';
      chat.setAttribute('aria-label', 'コメントを先に見る');
      tapGuard(chat, () => {
        const vid = chat.dataset.vid;
        const a = box.querySelector('a[href*="/watch?v="]');
        const tEl = box.querySelector('h3, .media-item-headline, [aria-label]');
        const title = tEl ? (tEl.textContent || '').trim() : '';
        openPanel(vid, title, a ? a.href : '/watch?v=' + vid);
      });
      thumb.appendChild(chat);
    }
    if (!check) {
      check = el('button', 'csy-check', '✓');
      check.type = 'button';
      tapGuard(check, () => toggleManual(check.dataset.vid));
      thumb.appendChild(check);
    }
    if (chat.dataset.vid !== id) chat.dataset.vid = id;
    if (check.dataset.vid !== id) check.dataset.vid = id;
    const marked = !!manual[id];
    if (check.classList.contains('is-marked') !== marked) check.classList.toggle('is-marked', marked);
    const tip = marked ? '視聴済みのチェックを外す' : '視聴済みにする';
    if (check.getAttribute('aria-label') !== tip) check.setAttribute('aria-label', tip);
  }

  // ================= 未視聴のみ =================
  const KEY_ON = 'csy-unwatched-on';
  const KEY_MODE = 'csy-unwatched-mode';
  let on = store.get(KEY_ON, '0') === '1';
  let mode = store.get(KEY_MODE, 'any');
  const BAR = [
    '.ytwThumbnailOverlayResumePlaybackRendererThumbnailOverlayResumePlaybackProgress',
    'ytm-thumbnail-overlay-resume-playback-renderer .thumbnail-overlay-resume-playback-progress',
    '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
  ].join(',');

  function isWatched(item) {
    const link = item.querySelector('a[href*="/watch?v="]');
    const id = link && videoIdFrom(link.getAttribute('href'));
    const p = watchedPercent(item);
    return (id && !!manual[id]) || (p != null && (mode === 'any' ? p > 0 : p >= 90));
  }

  // ---------- 未視聴の連続再生 ----------
  const MAX_PLAY = 50; // YouTubeの一時再生リストに並べられる上限
  // 並び順：YouTubeの並び替えボタン（左から 新しい順・人気の動画・古い順）の位置
  const SORTS = [['oldest', '古い順', 2], ['newest', '新しい順', 0], ['popular', '人気順', 1]];
  // 並べ方：選ばれた（最大50本の）未視聴を、再生時間で並べ替えるかどうか
  const LENGTHS = [['', 'そのまま'], ['short', '短い順'], ['long', '長い順']];
  const KEY_ORDER = 'csy-play-order'; // '' = そのまま / 'short' / 'long'
  let lengthOrder = store.get(KEY_ORDER, '');
  if (lengthOrder !== 'short' && lengthOrder !== 'long') lengthOrder = '';
  // サムネイルの「32:10」などの表示から再生時間（秒）を読む。無ければ null
  const TIME_RE = /^\d{1,2}(:\d{2}){1,2}$/;
  function durationOf(item) {
    for (const e of item.querySelectorAll('ytm-thumbnail-overlay-time-status-renderer, badge-shape, span, div')) {
      if (e.childElementCount) continue;
      const t = (e.textContent || '').trim();
      if (!TIME_RE.test(t)) continue;
      return t.split(':').reduce((a, n) => a * 60 + Number(n), 0);
    }
    return null;
  }
  function sortButtons() {
    return [...document.querySelectorAll('ytm-browse chip-bar-view-model chip-view-model button')];
  }
  function currentSortIndex() {
    return sortButtons().findIndex((b) => b.getAttribute('aria-selected') === 'true');
  }
  function unwatchedIds() {
    const ids = [];
    for (const item of document.querySelectorAll('ytm-rich-item-renderer')) {
      if (isWatched(item)) continue;
      const id = (() => { const a = item.querySelector('a[href*="/watch?v="]'); return a && videoIdFrom(a.getAttribute('href')); })();
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }
  // 選ばれた動画を再生時間で並べ替える（再生時間が読めない動画＝ライブなどは最後）
  function sortByLength(ids) {
    if (!lengthOrder) return ids;
    const sec = new Map();
    for (const item of document.querySelectorAll('ytm-rich-item-renderer')) {
      const id = (() => { const a = item.querySelector('a[href*="/watch?v="]'); return a && videoIdFrom(a.getAttribute('href')); })();
      if (id && ids.includes(id) && !sec.has(id)) sec.set(id, durationOf(item));
    }
    const dir = lengthOrder === 'short' ? 1 : -1;
    return ids
      .map((id, i) => ({ id, i, s: sec.get(id) }))
      .sort((a, b) => (a.s == null) - (b.s == null) || (a.s == null || b.s == null ? a.i - b.i : (a.s - b.s) * dir || a.i - b.i))
      .map((v) => v.id);
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let busy = false;
  let playBtn = null;
  let seg = null;
  let seg2 = null;
  function setPlayLabel(text) {
    if (playBtn && playBtn.textContent !== text) playBtn.textContent = text;
  }
  async function playUnwatched() {
    if (busy) return;
    busy = true;
    const y = window.scrollY;
    try {
      let ids = unwatchedIds();
      // 50本に届かなければ、下の動画を読み込みながら集める（最大10回）
      for (let round = 0; ids.length < MAX_PLAY && round < 10; round++) {
        setPlayLabel(`読み込み中…（未視聴 ${ids.length}本）`);
        const before = document.querySelectorAll('ytm-rich-item-renderer').length;
        const cont = document.querySelector('ytm-browse ytm-continuation-item-renderer');
        if (cont) cont.scrollIntoView({ block: 'end' });
        else window.scrollTo(0, document.documentElement.scrollHeight);
        let grew = false;
        for (let i = 0; i < 16; i++) {
          await sleep(500);
          if (document.querySelectorAll('ytm-rich-item-renderer').length > before) { grew = true; break; }
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
      // 選び方の順で先頭50本を選んでから、必要なら再生時間で並べ替える
      location.href = '/watch_videos?video_ids=' + sortByLength(ids.slice(0, MAX_PLAY)).join(',');
    } finally {
      busy = false;
      schedule();
    }
  }

  function isChannelList() {
    return /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/(videos|streams|podcasts)\/?$/.test(location.pathname);
  }
  function watchedPercent(item) {
    const bar = item.querySelector(BAR);
    if (!bar) return null;
    const w = parseFloat(bar.style.width);
    return isNaN(w) ? 100 : w;
  }

  let chip = null;
  let label = null;
  let menu = null;
  function buildChip() {
    const wrap = el('div', 'csy-uw');
    const btn = el('button', 'csy-uw-btn');
    btn.type = 'button';
    label = el('span');
    btn.append(label);
    btn.addEventListener('click', () => {
      on = !on;
      store.set(KEY_ON, on ? '1' : '0');
      schedule();
    });
    const opt = el('button', 'csy-uw-opt', '▾');
    opt.type = 'button';
    opt.setAttribute('aria-label', '隠す条件を選ぶ');
    menu = el('div', 'csy-uw-menu');
    menu.hidden = true;
    for (const [val, text] of [['any', '少しでも見た動画を隠す'], ['done', '最後まで見た動画だけ隠す（9割以上）']]) {
      const b = el('button', null, text);
      b.type = 'button';
      b.dataset.mode = val;
      b.addEventListener('click', () => {
        mode = val;
        store.set(KEY_MODE, mode);
        menu.hidden = true;
        if (!on) { on = true; store.set(KEY_ON, '1'); }
        schedule();
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
    const pair = el('div', 'csy-uw-pair');
    pair.append(btn, opt);

    playBtn = el('button', 'csy-play');
    playBtn.type = 'button';
    playBtn.addEventListener('click', playUnwatched);

    // 選び方（YouTubeの並び替えと連動）
    seg = el('div', 'csy-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', '選び方');
    for (const [, text, idx] of SORTS) {
      const b = el('button', null, text);
      b.type = 'button';
      b.dataset.idx = String(idx);
      b.addEventListener('click', () => {
        const target = sortButtons()[idx];
        if (target && target.getAttribute('aria-selected') !== 'true') target.click();
      });
      seg.append(b);
    }
    // 並べ方（選んだ50本を再生時間で並べ替える）
    seg2 = el('div', 'csy-seg');
    seg2.setAttribute('role', 'group');
    seg2.setAttribute('aria-label', '並べ方');
    for (const [key, text] of LENGTHS) {
      const b = el('button', null, text);
      b.type = 'button';
      b.dataset.key = key;
      b.addEventListener('click', () => {
        lengthOrder = key;
        store.set(KEY_ORDER, lengthOrder);
        schedule();
      });
      seg2.append(b);
    }
    wrap.append(pair, menu, playBtn, seg, seg2);
    return wrap;
  }

  function ensureChip() {
    if (!isChannelList()) {
      if (chip && chip.isConnected) chip.remove();
      return;
    }
    if (!chip) chip = buildChip();
    const bars = [...document.querySelectorAll('ytm-browse chip-bar-view-model, ytm-browse ytm-feed-filter-chip-bar-renderer')].filter((e) => e.offsetParent !== null);
    const bar = bars[0];
    if (bar) {
      if (chip.previousElementSibling !== bar || chip.parentElement !== bar.parentElement) bar.after(chip);
      chip.classList.remove('is-floating');
    } else if (!chip.isConnected || !chip.classList.contains('is-floating')) {
      chip.classList.add('is-floating');
      document.body.append(chip);
    }
  }

  function applyFilter() {
    const active = on && isChannelList();
    document.documentElement.classList.toggle('csy-unwatched-only', active);
    let total = 0;
    let watchedCount = 0;
    for (const item of document.querySelectorAll('ytm-rich-item-renderer')) {
      const link = item.querySelector('a[href*="/watch?v="]');
      if (!link) continue;
      total++;
      const watched = isWatched(item);
      if (item.hasAttribute('data-csy-watched') !== watched) item.toggleAttribute('data-csy-watched', watched);
      if (watched) watchedCount++;
    }
    if (!chip || !label) return;
    if (chip.classList.contains('is-on') !== on) chip.classList.toggle('is-on', on);
    const unwatched = total - watchedCount;
    const text = active ? `未視聴のみ：${unwatched}本（${watchedCount}本を非表示）` : `未視聴のみ（未視聴 ${unwatched}本）`;
    if (label.textContent !== text) label.textContent = text;
    for (const b of menu.querySelectorAll('button')) {
      const sel = b.dataset.mode === mode;
      if (b.classList.contains('is-sel') !== sel) b.classList.toggle('is-sel', sel);
    }
    const orderName = lengthOrder === 'short' ? '・短い順' : lengthOrder === 'long' ? '・長い順' : '';
    if (!busy) setPlayLabel(unwatched ? `▶ 未視聴を連続再生（${Math.min(unwatched, MAX_PLAY)}本〜${orderName}）` : '▶ 未視聴を連続再生');
    const cur = currentSortIndex();
    const mark = (b, sel) => {
      if (b.classList.contains('is-sel') !== sel) b.classList.toggle('is-sel', sel);
      if (b.getAttribute('aria-pressed') !== String(sel)) b.setAttribute('aria-pressed', String(sel));
    };
    for (const b of seg.querySelectorAll('button')) mark(b, Number(b.dataset.idx) === cur);
    for (const b of seg2.querySelectorAll('button')) mark(b, b.dataset.key === lengthOrder);
  }

  // ================= 監視 =================
  let pending = false;
  function tick() {
    pending = false;
    for (const box of document.querySelectorAll(CONTAINERS)) {
      if (box.closest('ytm-shorts-lockup-view-model, ytm-reel-shelf-renderer')) continue;
      decorate(box);
    }
    ensureChip();
    applyFilter();
  }
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(tick, 200);
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => { closePanel(); schedule(); });
  window.addEventListener('state-navigateend', () => { closePanel(); schedule(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  tick();
})();
