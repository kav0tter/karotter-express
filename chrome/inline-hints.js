const InlineHints = (() => {
  const HINT_CLASS = 'krs-hint';

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
    attachHint(Selectors.queryLikeButton(post),      'like',       bindings);
    attachHint(Selectors.queryRepostButton(post),    'repost',     bindings);
    attachHint(Selectors.queryBookmarkButton(post),  'bookmark',   bindings);
    attachHint(Selectors.queryReplyButton(post),     'reply',      bindings);
    attachHint(Selectors.queryQuotedPost(post),      'openQuoted', bindings);
  }

  const NAV_ACTIONS = {
    navHome:      Selectors.queryNavHome,
    navSearch:    Selectors.queryNavSearch,
    navNotif:     Selectors.queryNavNotif,
    navMessages:  Selectors.queryNavMessages,
    navBookmarks: Selectors.queryNavBookmarks,
    navProfile:   Selectors.queryNavProfile,
    navSettings:  Selectors.queryNavSettings,
  };

  function applyToNav(bindings) {
    for (const [action, queryFn] of Object.entries(NAV_ACTIONS)) {
      const el = queryFn(document);
      if (el) attachHint(el, action, bindings);
    }
    // 新規投稿ボタン
    const newPostBtn = Selectors.queryNewPostButton(document);
    if (newPostBtn) attachHint(newPostBtn, 'newPost', bindings);
  }

  function applyToTabs(bindings) {
    const containers = DomHelpers.getTabContainers();
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
    Selectors.queryPostItems().forEach(p => applyToPost(p, bindings));
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
