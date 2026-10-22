// コメント先読み — YouTubeのサムネイルに💬ボタンを付け、動画を開く前に人気コメントを表示する
(() => {
  'use strict';

  const CONTAINERS = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer',
    'yt-lockup-view-model',
  ].join(',');
  const MARK = 'data-csy-done';
  const cache = new Map(); // videoId -> { comments, count, next }

  // ---------- YouTube内部APIの準備 ----------
  function clientVersion() {
    const re = /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/;
    for (const s of document.scripts) {
      const m = re.exec(s.textContent || '');
      if (m) return m[1];
    }
    return '2.20260101.00.00';
  }
  function hl() {
    return document.documentElement.lang || 'ja';
  }
  async function innertube(body) {
    const res = await fetch('/youtubei/v1/next?prettyPrint=false', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: clientVersion(), hl: hl(), gl: 'JP' } },
        ...body,
      }),
    });
    if (!res.ok) throw new Error('通信エラー（' + res.status + '）');
    return res.json();
  }

  // オブジェクトの中から条件に合うものを深さ優先で探す
  function findAll(obj, test, out = [], depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 60) return out;
    if (test(obj)) out.push(obj);
    for (const k in obj) findAll(obj[k], test, out, depth + 1);
    return out;
  }
  function findFirst(obj, test) {
    return findAll(obj, test)[0];
  }
  function runsText(t) {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (t.simpleText) return t.simpleText;
    if (t.content) return t.content;
    if (Array.isArray(t.runs)) return t.runs.map((r) => r.text).join('');
    return '';
  }

  async function firstToken(videoId) {
    const data = await innertube({ videoId });
    const section =
      findFirst(data, (o) => o.itemSectionRenderer && (o.itemSectionRenderer.sectionIdentifier === 'comment-item-section' || o.itemSectionRenderer.targetId === 'comments-section')) ||
      findFirst(data, (o) => o.targetId === 'comments-section' || o.sectionIdentifier === 'comment-item-section');
    const cmd = section && findFirst(section, (o) => o.continuationCommand && o.continuationCommand.token);
    if (cmd) return cmd.continuationCommand.token;
    // コメントパネル側にある場合
    const panel = findFirst(data, (o) => o.engagementPanelSectionListRenderer && /comment/i.test(o.engagementPanelSectionListRenderer.panelIdentifier || o.engagementPanelSectionListRenderer.targetId || ''));
    const cmd2 = panel && findFirst(panel, (o) => o.continuationCommand && o.continuationCommand.token);
    if (cmd2) return cmd2.continuationCommand.token;
    return null;
  }

  function parseComments(data) {
    const comments = [];
    // 新しい形式（commentEntityPayload）
    const payloads = new Map();
    for (const m of findAll(data, (o) => o.payload && o.payload.commentEntityPayload)) {
      payloads.set(m.entityKey, m.payload.commentEntityPayload);
    }
    const keys = findAll(data, (o) => o.commentViewModel && typeof o.commentViewModel.commentKey === 'string').map((o) => o.commentViewModel.commentKey);
    const ordered = keys.length ? keys.map((k) => payloads.get(k)).filter(Boolean) : [...payloads.values()];
    for (const p of ordered) {
      const pr = p.properties || {};
      if (pr.replyLevel) continue; // 返信は除く
      comments.push({
        author: (p.author && p.author.displayName) || '',
        text: runsText(pr.content),
        likes: (p.toolbar && (p.toolbar.likeCountNotliked || p.toolbar.likeCountA11y)) || '',
        time: pr.publishedTime || '',
        replies: (p.toolbar && p.toolbar.replyCount) || '',
      });
    }
    // 古い形式（commentRenderer）
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
    // 次ページ用（返信の続きではなく、一覧の末尾にある続き）
    const items = findAll(data, (o) => Array.isArray(o.continuationItems)).flatMap((o) => o.continuationItems);
    const last = items.length ? items[items.length - 1] : null;
    const nextCmd = last && last.continuationItemRenderer && findFirst(last.continuationItemRenderer, (o) => o.continuationCommand && o.continuationCommand.token);
    return { comments, count, next: nextCmd ? nextCmd.continuationCommand.token : null };
  }

  async function loadComments(videoId) {
    if (cache.has(videoId)) return cache.get(videoId);
    const token = await firstToken(videoId);
    if (!token) {
      const r = { comments: [], count: '', next: null, disabled: true };
      cache.set(videoId, r);
      return r;
    }
    const r = parseComments(await innertube({ continuation: token }));
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

  // ---------- 表示 ----------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  let panel = null;
  let currentId = null;

  function closePanel() {
    if (panel) panel.remove();
    panel = null;
    currentId = null;
  }

  function openPanel(videoId, title, href, anchorRect) {
    closePanel();
    currentId = videoId;
    panel = el('div', 'csy-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'コメント先読み');

    const head = el('div', 'csy-head');
    const ttl = el('div', 'csy-title', title || '動画のコメント');
    const close = el('button', 'csy-close', '×');
    close.title = '閉じる（Esc）';
    close.addEventListener('click', closePanel);
    head.append(ttl, close);

    const meta = el('div', 'csy-meta', '人気のコメントを読み込み中…');
    const list = el('ol', 'csy-list');
    const foot = el('div', 'csy-foot');
    const more = el('button', 'csy-more', 'もっと見る');
    more.hidden = true;
    const open = el('a', 'csy-open', 'この動画を見る ▶');
    open.href = href;
    foot.append(more, open);
    panel.append(head, meta, list, foot);
    document.body.appendChild(panel);
    place(anchorRect);

    const render = (r) => {
      if (currentId !== videoId) return;
      list.textContent = '';
      if (r.disabled) {
        meta.textContent = 'この動画はコメントがオフになっているか、まだありません。';
      } else if (!r.comments.length) {
        meta.textContent = 'コメントはまだありません。';
      } else {
        meta.textContent = (r.count ? r.count + ' · ' : '') + '人気順';
      }
      for (const c of r.comments) {
        const li = el('li', 'csy-item');
        const top = el('div', 'csy-row');
        top.append(el('span', 'csy-author', c.author), el('span', 'csy-time', c.time));
        const body = el('div', 'csy-text', c.text);
        const bottom = el('div', 'csy-row csy-sub');
        if (c.likes) bottom.append(el('span', 'csy-likes', '👍 ' + c.likes));
        if (c.replies) bottom.append(el('span', 'csy-replies', '返信 ' + c.replies));
        li.append(top, body);
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
      try {
        render(await loadMore(videoId));
      } catch (e) {
        more.disabled = false;
        more.textContent = '読み込めませんでした。もう一度';
      }
    });

    loadComments(videoId).then(render).catch((e) => {
      if (currentId !== videoId) return;
      meta.textContent = 'コメントを読み込めませんでした（' + e.message + '）。少し待ってからもう一度押してください。';
      cache.delete(videoId);
    });
  }

  function place(r) {
    const w = Math.min(420, window.innerWidth - 24);
    panel.style.width = w + 'px';
    let left = r.right + 10;
    if (left + w > window.innerWidth - 12) left = r.left - w - 10;
    if (left < 12) left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    let top = r.top;
    const maxH = Math.min(560, window.innerHeight - 24);
    panel.style.maxHeight = maxH + 'px';
    if (top + maxH > window.innerHeight - 12) top = window.innerHeight - maxH - 12;
    panel.style.left = Math.max(12, left) + 'px';
    panel.style.top = Math.max(12, top) + 'px';
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });
  document.addEventListener('mousedown', (e) => {
    if (panel && !panel.contains(e.target) && !e.target.closest('.csy-btn')) closePanel();
  }, true);
  window.addEventListener('yt-navigate-start', closePanel);

  // ---------- サムネイルにボタンを付ける ----------
  function videoIdFrom(href) {
    try {
      const u = new URL(href, location.origin);
      if (u.pathname === '/watch') return u.searchParams.get('v');
    } catch (_) {}
    return null;
  }

  function decorate(box) {
    const a = box.querySelector('a[href*="/watch?v="]');
    if (!a) return; // まだ中身が描画されていない（後で再挑戦）
    const id = videoIdFrom(a.getAttribute('href'));
    if (!id) return;
    const old = box.querySelector(':scope .csy-btn');
    if (box.getAttribute(MARK) === id && old) return;
    if (old) old.remove();
    box.setAttribute(MARK, id);

    const thumb = box.querySelector('ytd-thumbnail, yt-thumbnail-view-model, a#thumbnail, .yt-lockup-view-model-wiz__content-image, a[href*="/watch?v="]') || box;
    const host = thumb.parentElement && thumb.tagName === 'A' ? thumb.parentElement : thumb;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const btn = el('button', 'csy-btn', '💬');
    btn.type = 'button';
    btn.title = 'コメントを先に見る';
    btn.setAttribute('aria-label', 'コメントを先に見る');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const link = box.querySelector('a[href*="/watch?v="]');
      const vid = videoIdFrom(link.getAttribute('href'));
      if (panel && currentId === vid) return closePanel();
      const tEl = box.querySelector('#video-title, h3, [title]');
      const title = tEl ? (tEl.getAttribute('title') || tEl.textContent || '').trim() : '';
      openPanel(vid, title, link.href, box.getBoundingClientRect());
    }, true);
    btn.addEventListener('mousedown', (e) => e.stopPropagation(), true);
    host.appendChild(btn);
  }

  function scan() {
    for (const box of document.querySelectorAll(CONTAINERS)) {
      if (box.closest('ytd-reel-shelf-renderer, ytm-shorts-lockup-view-model')) continue;
      decorate(box);
    }
  }

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      scan();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
