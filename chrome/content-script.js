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
  function init() {
    loadBindings();
    window.addEventListener('keydown', handleKeyDown, true);
    observeTimeline();
    observeRouteChange();
  }

  function loadBindings() {
    chrome.storage.sync.get(['keybindings', 'settings', 'reactionSlots'], (result) => {
      if (result.keybindings)   bindings = { ...DEFAULT_KEYBINDINGS, ...result.keybindings };
      if (result.settings)      settings = { ...DEFAULT_SETTINGS,   ...result.settings };
      if (result.reactionSlots) reactionSlots = result.reactionSlots;
      applySettings();
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.reactionSlots) reactionSlots = changes.reactionSlots.newValue ?? [];
    });
  }

  let hintsTimer = null;
  function scheduleHints() {
    if (!settings.showInlineHints) return;
    clearTimeout(hintsTimer);
    hintsTimer = setTimeout(() => {
      const found = SELECTORS.POST_ITEM_VARIANTS.some(s => document.querySelector(s));
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
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.keybindings) {
      bindings = { ...DEFAULT_KEYBINDINGS, ...changes.keybindings.newValue };
      if (settings.showInlineHints) InlineHints.refresh(bindings);
      if (settings.showFloatingPanel) FloatingPanel.refresh(bindings);
    }
    if (changes.settings) {
      settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
      applySettings();
    }
  });

  // ---- 投稿リスト管理 ----
  function refreshPosts() {
    for (const sel of SELECTORS.POST_ITEM_VARIANTS) {
      const items = Array.from(document.querySelectorAll(sel));
      if (items.length > 0) { posts = items; return; }
    }
    posts = [];
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
  }

  function clearFocus() {
    if (focusedIndex >= 0 && posts[focusedIndex]) {
      posts[focusedIndex].classList.remove(FOCUS_CLASS);
    }
    focusedIndex = -1;
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

  // ---- Esc の文脈依存処理 ----
  function handleEscape() {
    // 0. 下書き保存確認ダイアログが表示中なら「破棄して閉じる」をクリック（isInputFocused より先に判定）
    const discardBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim() === '破棄して閉じる');
    if (discardBtn) { discardBtn.click(); return; }
    // 1. 入力欄にフォーカスがあれば blur して終了
    if (isInputFocused()) {
      document.activeElement.blur();
      return;
    }
    // 2. ヘルプオーバーレイが開いていれば閉じる
    if (HelpOverlay.isVisible()) {
      HelpOverlay.hide();
      return;
    }
    // 3. モーダルが開いていれば閉じる（karotter は Esc でネイティブに閉じる）
    const url = location.href;
    if (url.includes('compose=1') || document.querySelector('[role="dialog"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    // 3. 投稿フォーカスを外す
    if (focusedIndex >= 0) {
      clearFocus();
      return;
    }
    // 4. 前のページへ戻る
    history.back();
  }

  // ---- アクション実行 ----
  function clickInPost(selector) {
    if (focusedIndex < 0 || !posts[focusedIndex]) return;
    const post = posts[focusedIndex];
    const btn = selector === SELECTORS.REPLY_BUTTON
      ? findReplyButton(post)
      : post.querySelector(selector);
    if (btn) {
      btn.click();
    } else {
      console.warn(`[karotter-shortcut] ボタンが見つかりません: ${selector}`);
    }
  }

  // リプライボタンは reaction-trigger の直後のボタンを使う
  // （画像付き投稿でも -ml-1 クラスの有無に左右されない）
  function findReplyButton(post) {
    const reaction = post.querySelector('.reaction-trigger');
    if (reaction) {
      let el = reaction.nextElementSibling;
      while (el) {
        if (el.tagName === 'BUTTON') return el;
        el = el.nextElementSibling;
      }
    }
    // フォールバック: 元のセレクタ
    return post.querySelector(SELECTORS.REPLY_BUTTON);
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
    const quoted = posts[focusedIndex].querySelector(SELECTORS.QUOTED_POST);
    if (quoted) quoted.click();
  }

  // リポストメニューが出たら自動で選択する
  // isQuote=false → 1番目のボタン（直接リポスト）
  // isQuote=true  → 2番目のボタン（引用）
  function clickRepost(isQuote) {
    if (focusedIndex < 0 || !posts[focusedIndex]) return;
    const repostBtn = posts[focusedIndex].querySelector(SELECTORS.REPOST_BUTTON);
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

  function clickGlobal(selector) {
    const el = document.querySelector(selector);
    if (el) { el.click(); return; }
    // メニュー内など非表示リンクは href から直接ナビゲート
    const m = selector.match(/^a\[href="([^"]+)"\]$/);
    if (m) location.assign(m[1]);
  }

  function getTabContainers() {
    return [...document.querySelectorAll('[class*="rounded-full"][class*="border"]')]
      .filter(c => {
        const btns = [...c.querySelectorAll('button')].filter(b => b.offsetParent !== null);
        return btns.length >= 2;
      });
  }

  function clickTabInContainers(containers, direction) {
    for (const container of containers) {
      const btns = [...container.querySelectorAll('button')].filter(b => b.offsetParent !== null);
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
    const all = getTabContainers();
    clickTabInContainers(all.length >= 2 ? [all[1]] : all, direction);
  }

  // {/} → 外側タブ（最初のグループのみ）
  function switchOuterTab(direction) {
    const all = getTabContainers();
    clickTabInContainers(all.slice(0, 1), direction);
  }

  function focusSearch() {
    const el = document.querySelector(SELECTORS.SEARCH_INPUT);
    if (el) { el.focus(); el.select(); }
  }

  const ACTION_HANDLERS = {
    focusNext:    () => { refreshPosts(); setFocus(focusedIndex < 0 ? 0 : focusedIndex + 1); },
    focusPrev:    () => { refreshPosts(); setFocus(focusedIndex < 0 ? 0 : focusedIndex - 1); },
    openPost:     () => openFocusedPost(),
    like:         () => clickInPost(SELECTORS.LIKE_BUTTON),
    repost:       () => clickRepost(false),
    quoteRepost:  () => clickRepost(true),
    bookmark:     () => clickInPost(SELECTORS.BOOKMARK_BUTTON),
    reply:        () => clickInPost(SELECTORS.REPLY_BUTTON),
    openProfile:  () => openAuthorProfile(),
    openQuoted:   () => openQuotedPost(),
    newPost:      () => clickGlobal(SELECTORS.NEW_POST_BUTTON),
    focusSearch:  () => focusSearch(),
    toggleHelp:   () => HelpOverlay.toggle(bindings),
    tabPrev:      () => switchTab('prev'),
    tabNext:      () => switchTab('next'),
    tabOuterPrev: () => switchOuterTab('prev'),
    tabOuterNext: () => switchOuterTab('next'),
    navHome:      () => clickGlobal(SELECTORS.NAV_HOME),
    navSearch:    () => clickGlobal(SELECTORS.NAV_SEARCH),
    navNotif:     () => clickGlobal(SELECTORS.NAV_NOTIF),
    navMessages:  () => clickGlobal(SELECTORS.NAV_MESSAGES),
    navBookmarks: () => clickGlobal(SELECTORS.NAV_BOOKMARKS),
    navProfile:   () => clickGlobal(SELECTORS.NAV_PROFILE),
    navSettings:  () => clickGlobal(SELECTORS.NAV_SETTINGS),
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
    const container = document.querySelector(SELECTORS.TIMELINE_CONTAINER) ?? document.body;
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
