(function () {
  'use strict';

  let bindings = { ...DEFAULT_KEYBINDINGS };
  let settings = { ...DEFAULT_SETTINGS };
  let reactionSlots = DEFAULT_REACTION_SLOTS.map(s => ({ ...s }));
  let focusedIndex = -1;
  let posts = [];
  const FOCUS_CLASS = 'krs-focused';

  // コード（2ストローク）管理
  let pendingChord = null;
  let chordTimer   = null;

  // ---- 初期化 ----
  async function init() {
    const all = await KarotterStorage.loadAll();
    bindings = all.keybindings;
    settings = all.settings;
    reactionSlots = all.reactionSlots;
    applySettings();

    KarotterStorage.subscribe((patch) => {
      if (patch.keybindings) {
        bindings = patch.keybindings;
        if (settings.showInlineHints) InlineHints.refresh(bindings);
        if (settings.showFloatingPanel) FloatingPanel.refresh(bindings);
      }
      if (patch.settings) {
        settings = patch.settings;
        applySettings();
      }
      if (patch.reactionSlots) {
        reactionSlots = patch.reactionSlots;
      }
    });

    window.addEventListener('keydown', handleKeyDown, true);
    observeTimeline();
    observeRouteChange();
  }

  let hintsTimer = null;
  function scheduleHints() {
    if (!settings.showInlineHints) return;
    clearTimeout(hintsTimer);
    hintsTimer = setTimeout(() => {
      const found = Selectors.queryPostItems().length > 0;
      if (found) {
        InlineHints.applyAll(bindings);
      } else {
        scheduleHints(); // 投稿がまだなければリトライ
      }
    }, 300);
  }

  function applySettings() {
    if (settings.showInlineHints) {
      scheduleHints();
    } else {
      InlineHints.removeAll();
    }
    if (settings.showFloatingPanel) {
      FloatingPanel.show(bindings);
    } else {
      FloatingPanel.hide();
    }
    if (!settings.showFloatingPanel && settings.showFocusStatusBadge) {
      FocusStatusBadge.show();
    } else {
      FocusStatusBadge.hide();
    }
    updateFocusStatus();
  }

  // ---- 投稿リスト管理 ----
  function refreshPosts() {
    posts = Selectors.queryPostItems();
    syncFocusedIndex();
    updateFocusStatus();
  }

  function setFocus(index) {
    if (focusedIndex >= 0 && posts[focusedIndex]) {
      posts[focusedIndex].classList.remove(FOCUS_CLASS);
    }
    focusedIndex = Math.max(0, Math.min(index, posts.length - 1));
    const target = posts[focusedIndex];
    if (!target) return;
    target.classList.add(FOCUS_CLASS);
    const rect = target.getBoundingClientRect();
    const viewH = window.innerHeight;
    if (rect.top < 60 || rect.bottom > viewH - 20) {
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    updateFocusStatus();
  }

  function clearFocus() {
    if (focusedIndex >= 0 && posts[focusedIndex]) {
      posts[focusedIndex].classList.remove(FOCUS_CLASS);
    }
    focusedIndex = -1;
    updateFocusStatus();
  }

  function syncFocusedIndex() {
    if (focusedIndex < 0) return;
    const current = posts[focusedIndex];
    if (current?.classList?.contains(FOCUS_CLASS)) return;
    const nextIndex = posts.findIndex((post) => post.classList?.contains(FOCUS_CLASS));
    focusedIndex = nextIndex;
  }

  function updateFocusStatus() {
    const current = focusedIndex >= 0 && posts[focusedIndex] ? focusedIndex + 1 : null;
    const total = posts.length;
    FloatingPanel.setFocusStatus(current, total);
    FocusStatusBadge.setStatus(current, total);
  }

  // ---- 入力中チェック ----
  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute('role') === 'textbox') return true;
    return false;
  }

  function discardDialog() {
    const discardBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim() === '破棄して閉じる');
    if (!discardBtn) return false;
    discardBtn.click();
    return true;
  }

  function inputBlur() {
    if (!isInputFocused()) return false;
    document.activeElement?.blur();
    return true;
  }

  function helpClose() {
    if (!HelpOverlay.isVisible()) return false;
    HelpOverlay.hide();
    return true;
  }

  function modalClose() {
    const url = location.href;
    if (!url.includes('compose=1') && !document.querySelector('[role="dialog"]')) return false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }

  function clearFocusHandler() {
    if (focusedIndex < 0) return false;
    clearFocus();
    return true;
  }

  function historyBack() {
    history.back();
    return true;
  }

  // ---- Esc の文脈依存処理 ----
  const ESCAPE_HANDLERS = {
    discardDialog,
    inputBlur,
    helpClose,
    modalClose,
    clearFocus: clearFocusHandler,
    historyBack,
  };

  function handleEscape() {
    const configuredOrder = Array.isArray(settings.escapeBehaviorOrder)
      ? settings.escapeBehaviorOrder
      : DEFAULT_SETTINGS.escapeBehaviorOrder;
    const fallback = DEFAULT_SETTINGS.escapeBehaviorOrder.filter(name => !configuredOrder.includes(name));
    const order = [...configuredOrder, ...fallback];

    for (const name of order) {
      const handler = ESCAPE_HANDLERS[name];
      if (typeof handler === 'function' && handler()) {
        return;
      }
    }
  }

  // ---- アクション実行 ----
  function clickInPost(queryFn, label) {
    if (focusedIndex < 0 || !posts[focusedIndex]) return;
    const post = posts[focusedIndex];
    const btn = queryFn(post);
    if (btn) {
      btn.click();
    } else {
      console.warn(`[karotter-shortcut] ボタンが見つかりません: ${label}`);
    }
  }

  function openFocusedPost() {
    if (focusedIndex < 0 || !posts[focusedIndex]) return;
    const el = posts[focusedIndex];
    // <a> タグ（ボードリスト等）はそのままクリック
    if (el.tagName === 'A') { el.click(); return; }
    // cursor-pointer クラスまたは role=button（通知等）はそのままクリック
    if (el.classList.contains('cursor-pointer') || el.getAttribute('role') === 'button') {
      el.click(); return;
    }
    // それ以外は内部の主リンクを探す（フォールバックとして直接クリック）
    const link = el.querySelector('a[href]:not([href^="#"]):not([href*="/profile/"])') ??
                 el.querySelector('a[href]');
    if (link) link.click(); else el.click();
  }

  function openAuthorProfile() {
    if (focusedIndex < 0 || !posts[focusedIndex]) return;
    const link = posts[focusedIndex].querySelector('a[href*="/profile/"]');
    if (link) link.click();
  }

  function openQuotedPost() {
    if (focusedIndex < 0 || !posts[focusedIndex]) return;
    const quoted = Selectors.queryQuotedPost(posts[focusedIndex]);
    if (quoted) quoted.click();
  }

  // リポストメニューが出たら自動で選択する
  // isQuote=false → 1番目のボタン（直接リポスト）
  // isQuote=true  → 2番目のボタン（引用）
  function clickRepost(isQuote) {
    if (focusedIndex < 0 || !posts[focusedIndex]) return;
    const repostBtn = Selectors.queryRepostButton(posts[focusedIndex]);
    if (!repostBtn) return;

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.classList?.contains('w-48')) {
            const btns = n.querySelectorAll('button');
            const target = isQuote ? btns[1] : btns[0];
            target?.click();
            obs.disconnect();
            return;
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    repostBtn.click();
    setTimeout(() => obs.disconnect(), 1000);
  }

  function clickGlobal(queryFn, fallbackHref) {
    const el = queryFn(document);
    if (el) { el.click(); return; }
    if (fallbackHref) location.assign(fallbackHref);
  }



  function clickTabInContainers(containers, direction) {
    for (const container of containers) {
      const btns = DomHelpers.findVisibleButtons(container);
      const activeIdx = btns.findIndex(b =>
        b.className.includes('accent-soft') || b.className.includes('shadow-sm')
      );
      if (activeIdx < 0) continue;
      const nextIdx = direction === 'next'
        ? (activeIdx + 1) % btns.length
        : (activeIdx - 1 + btns.length) % btns.length;
      btns[nextIdx].click();
    }
  }

  // [/] → 中段タブ（2番目のグループのみ。なければ外側）
  function switchTab(direction) {
    const all = DomHelpers.getTabContainers();
    clickTabInContainers(all.length >= 2 ? [all[1]] : all, direction);
  }

  // {/} → 外側タブ（最初のグループのみ）
  function switchOuterTab(direction) {
    const all = DomHelpers.getTabContainers();
    clickTabInContainers(all.slice(0, 1), direction);
  }

  function focusSearch() {
    const el = Selectors.querySearchInput(document);
    if (el) { el.focus(); el.select(); }
  }

  const ACTION_HANDLERS = {
    focusNext:    () => { refreshPosts(); setFocus(focusedIndex < 0 ? 0 : focusedIndex + 1); },
    focusPrev:    () => { refreshPosts(); setFocus(focusedIndex < 0 ? 0 : focusedIndex - 1); },
    openPost:     () => openFocusedPost(),
    like:         () => clickInPost(Selectors.queryLikeButton,     'like'),
    repost:       () => clickRepost(false),
    quoteRepost:  () => clickRepost(true),
    bookmark:     () => clickInPost(Selectors.queryBookmarkButton, 'bookmark'),
    reply:        () => clickInPost(Selectors.queryReplyButton,    'reply'),
    openProfile:  () => openAuthorProfile(),
    openQuoted:   () => openQuotedPost(),
    newPost:      () => clickGlobal(Selectors.queryNewPostButton),
    focusSearch:  () => focusSearch(),
    toggleHelp:   () => HelpOverlay.toggle(bindings),
    tabPrev:      () => switchTab('prev'),
    tabNext:      () => switchTab('next'),
    tabOuterPrev: () => switchOuterTab('prev'),
    tabOuterNext: () => switchOuterTab('next'),
    navHome:      () => clickGlobal(Selectors.queryNavHome,      '/'),
    navSearch:    () => clickGlobal(Selectors.queryNavSearch,    '/search'),
    navNotif:     () => clickGlobal(Selectors.queryNavNotif,     '/notifications'),
    navMessages:  () => clickGlobal(Selectors.queryNavMessages,  '/dm'),
    navBookmarks: () => clickGlobal(Selectors.queryNavBookmarks, '/bookmarks'),
    navProfile:   () => clickGlobal(Selectors.queryNavProfile),
    navSettings:  () => clickGlobal(Selectors.queryNavSettings,  '/settings'),
  };

  // ---- クイックリアクション ----
  // main world の injectReactionScript が __karotter_react イベントを受けて fiber 操作する
  function reactWithEmoji(emoji) {
    const post = posts[focusedIndex];
    if (!post) return;
    document.dispatchEvent(new CustomEvent('__karotter_react', { detail: { emoji } }));
  }


  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ---- キーイベント ----
  function parseBinding(b) {
    if (!b) return { key: '', ctrl: false, alt: false };
    const parts = b.split('+');
    return { key: parts[parts.length - 1], ctrl: parts.includes('Ctrl'), alt: parts.includes('Alt') };
  }

  function keyMatches(e, action) {
    const b = bindings[action];
    if (!b) return false;
    const { key, ctrl, alt } = parseBinding(b);
    if (e.ctrlKey !== ctrl || e.altKey !== alt) return false;
    if (e.code.startsWith('Numpad')) return key === e.code;
    // Ctrl/Alt 付きはケース非感応（Ctrl+i と Ctrl+I を同一視）
    return (ctrl || alt) ? key.toLowerCase() === e.key.toLowerCase() : key === e.key;
  }

  function handleKeyDown(e) {
    if (e.metaKey) return;

    // Esc は入力中でも処理する
    if (e.key === 'Escape') {
      handleEscape();
      return;
    }

    if (isInputFocused()) return;

    // クイックリアクション（モディファイアなし・投稿フォーカス中のみ）
    if (!e.ctrlKey && !e.altKey && focusedIndex >= 0) {
      const slot = reactionSlots.find(s => s.key === e.code && s.emoji);
      if (slot) {
        e.preventDefault();
        reactWithEmoji(slot.emoji);
        return;
      }
    }
    // コード（2ストローク）の2打鍵目を処理（モディファイアが絡む場合はコードをキャンセルしてフォールスルー）
    if (pendingChord) {
      if (!e.ctrlKey && !e.altKey && e.key.length === 1) {
        clearTimeout(chordTimer);
        const chord = pendingChord + e.key;
        pendingChord = null;
        for (const [action, key] of Object.entries(bindings)) {
          if (key === chord) {
            e.preventDefault();
            executeAction(action);
            return;
          }
        }
        return;
      }
      clearTimeout(chordTimer);
      pendingChord = null;
      // モディファイアコンボはそのまま下の keyMatches へ
    }

    // コードの1打鍵目か判定
    // - e.key が単一文字のときのみ（ArrowDown 等を除外）
    // - バインド先が大文字始まりの場合はナmedキー（ArrowDown, Enter, Insert 等）とみなし除外
    const isChordStart = !e.ctrlKey && !e.altKey && e.key.length === 1 && Object.values(bindings).some(
      (k) => typeof k === 'string' && k.length > 1 && !k.includes('+')
           && !/^[A-Z]/.test(k)   // 大文字始まり = named key (Arrow/Enter/Insert 等) は除外
           && k[0] === e.key
    );
    if (isChordStart) {
      e.preventDefault();
      pendingChord = e.key;
      chordTimer = setTimeout(() => { pendingChord = null; }, 500);
      return;
    }

    for (const action of Object.keys(ACTION_HANDLERS)) {
      if (keyMatches(e, action)) {
        e.preventDefault();
        executeAction(action);
        return;
      }
    }
  }

  // コード処理から呼ばれるアクション実行（単打と共通）
  function executeAction(action) {
    ACTION_HANDLERS[action]?.();
  }

  // ---- MutationObserver ----
  function observeTimeline() {
    const container = Selectors.queryTimelineContainer(document) ?? document.body;
    new MutationObserver((mutations) => {
      const hasReal = mutations.some(m =>
        [...m.addedNodes].some(n =>
          n.nodeType === 1 && !n.classList?.contains('krs-hint')
        )
      );
      if (!hasReal) return;
      refreshPosts();
      if (settings.showInlineHints) InlineHints.applyAll(bindings);
    }).observe(container, { childList: true, subtree: true });
  }

  function observeRouteChange() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        clearFocus();
        refreshPosts();
        scheduleHints();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ページJSコンテキストからの設定変更ブリッジ（設定ページ・開発ツール連携用）
  window.addEventListener('krs-apply-settings', (e) => {
    settings = { ...DEFAULT_SETTINGS, ...e.detail };
    applySettings();
  });

  init();
})();
