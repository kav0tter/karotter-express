const InlineHints = (() => {
  const HINT_CLASS = 'krs-hint';

  function findReplyBtn(post) {
    const reaction = post.querySelector('.reaction-trigger');
    if (reaction) {
      let el = reaction.nextElementSibling;
      while (el) {
        if (el.tagName === 'BUTTON') return el;
        el = el.nextElementSibling;
      }
    }
    return post.querySelector(SELECTORS.REPLY_BUTTON);
  }

  function attachHint(btn, action, bindings) {
    if (!btn) return;
    const key = bindings[action];
    if (!key) return;
    // 既に同じキーのヒントが付いていればスキップ
    if (btn.dataset.krsHint === action && btn.querySelector(`.${HINT_CLASS}`)) return;
    btn.querySelectorAll(`.${HINT_CLASS}`).forEach(el => el.remove());
    btn.dataset.krsHint = action;
    btn.style.position = 'relative';
    const hint = document.createElement('kbd');
    hint.className = HINT_CLASS;
    hint.textContent = formatKeyLabel(key, { compact: true });
    btn.appendChild(hint);
  }

  function applyToPost(post, bindings) {
    attachHint(post.querySelector(SELECTORS.LIKE_BUTTON),     'like',     bindings);
    attachHint(post.querySelector(SELECTORS.REPOST_BUTTON),   'repost',   bindings);
    attachHint(post.querySelector(SELECTORS.BOOKMARK_BUTTON), 'bookmark', bindings);
    attachHint(findReplyBtn(post),                             'reply',    bindings);
    attachHint(post.querySelector(SELECTORS.QUOTED_POST),     'openQuoted', bindings);
  }

  const NAV_ACTIONS = {
    navHome:      SELECTORS.NAV_HOME,
    navSearch:    SELECTORS.NAV_SEARCH,
    navNotif:     SELECTORS.NAV_NOTIF,
    navMessages:  SELECTORS.NAV_MESSAGES,
    navBookmarks: SELECTORS.NAV_BOOKMARKS,
    navProfile:   SELECTORS.NAV_PROFILE,
    navSettings:  SELECTORS.NAV_SETTINGS,
  };

  function applyToNav(bindings) {
    for (const [action, sel] of Object.entries(NAV_ACTIONS)) {
      const el = document.querySelector(sel);
      if (el) attachHint(el, action, bindings);
    }
    // 新規投稿ボタン
    const newPostBtn = document.querySelector(SELECTORS.NEW_POST_BUTTON);
    if (newPostBtn) attachHint(newPostBtn, 'newPost', bindings);
  }

  function applyToTabs(bindings) {
    const containers = [...document.querySelectorAll('[class*="rounded-full"][class*="border"]')]
      .filter(c => [...c.querySelectorAll('button')].filter(b => b.offsetParent).length >= 2);
    const pairs = [
      ['tabOuterPrev', 'tabOuterNext'],
      ['tabPrev',      'tabNext'],
    ];
    containers.slice(0, 2).forEach((c, i) => {
      const [prevA, nextA] = pairs[i];
      const prevKey = bindings[prevA];
      const nextKey = bindings[nextA];
      if (!prevKey && !nextKey) return;
      const label = `${formatKeyLabel(prevKey, { compact: true })} ${formatKeyLabel(nextKey, { compact: true })}`;
      const hintId = `${prevA}/${nextA}`;
      if (c.dataset.krsHint === hintId && c.querySelector(`.${HINT_CLASS}`)) return;
      c.querySelectorAll(`.${HINT_CLASS}`).forEach(el => el.remove());
      c.dataset.krsHint = hintId;
      c.style.position = 'relative';
      const hint = document.createElement('kbd');
      hint.className = HINT_CLASS;
      hint.textContent = label;
      c.appendChild(hint);
    });
  }

  function applyAll(bindings) {
    document.querySelectorAll(SELECTORS.POST_ITEM).forEach(p => applyToPost(p, bindings));
    applyToNav(bindings);
    applyToTabs(bindings);
  }

  function removeAll() {
    document.querySelectorAll(`.${HINT_CLASS}`).forEach(el => el.remove());
    document.querySelectorAll('[data-krs-hint]').forEach(el => { delete el.dataset.krsHint; });
  }

  function refresh(bindings) {
    removeAll();
    applyAll(bindings);
  }

  return { applyToPost, applyAll, removeAll, refresh };
})();
