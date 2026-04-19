// DOM selectors for karotter.com (surveyed 2026-04-17, Tailwind CSS)
const Selectors = (() => {
  const SELECTORS = {
    POST_ITEM:        '.relative.w-full.border-b',
    QUOTED_POST:      '[class*="rounded-2xl"][class*="border-gray-200"]',
    // ページ別アイテムセレクタ（refreshPosts が順に試す）
    POST_ITEM_VARIANTS: [
      '.relative.w-full.border-b',                  // TL・検索・ブックマーク・プロフィール・投稿詳細
      '.divide-y > div[role="button"]',             // 通知
      'a.block.border-b',                           // ボードチャンネルリスト
    ],
    // hover: なしでも一致させる → アクティブ状態（取り消し）でも動く
    REPLY_BUTTON:     'button[class*="-ml-1"][class*="text-blue-600"]',
    REPOST_BUTTON:    'button[class*="text-green-600"]',
    LIKE_BUTTON:      'button[class*="text-red-600"]',
    BOOKMARK_BUTTON:  'button[class*="text-amber"]',
    NEW_POST_BUTTON:  'button[class*="bg-blue-600"][class*="rounded-full"]',
    SEARCH_INPUT:     'input[type="search"], input[placeholder*="検索"]',
    TIMELINE_CONTAINER: '.timeline-main-column',
    // サイドバーナビ（nav 内に限定してロゴ等との誤マッチを防ぐ）
    NAV_HOME:      'nav a[href="/"]',
    NAV_SEARCH:    'nav a[href="/search"]',
    NAV_NOTIF:     'nav a[href="/notifications"]',
    NAV_MESSAGES:  'nav a[href="/dm"]',
    NAV_BOOKMARKS: 'nav a[href="/bookmarks"]',
    NAV_PROFILE:   'nav a[href^="/profile/"]',
    NAV_SETTINGS:  'a[href="/settings"]',
  };

  function queryPostItems(root = document) {
    for (const sel of SELECTORS.POST_ITEM_VARIANTS) {
      const items = Array.from(root.querySelectorAll(sel));
      if (items.length > 0) return items;
    }
    return [];
  }

  function queryReplyButton(post) {
    const reaction = post?.querySelector('.reaction-trigger');
    if (reaction) {
      let el = reaction.nextElementSibling;
      while (el) {
        if (el.tagName === 'BUTTON') return el;
        el = el.nextElementSibling;
      }
    }
    return post?.querySelector(SELECTORS.REPLY_BUTTON) ?? null;
  }

  function queryLikeButton(post) {
    return post?.querySelector(SELECTORS.LIKE_BUTTON) ?? null;
  }

  function queryRepostButton(post) {
    return post?.querySelector(SELECTORS.REPOST_BUTTON) ?? null;
  }

  function queryBookmarkButton(post) {
    return post?.querySelector(SELECTORS.BOOKMARK_BUTTON) ?? null;
  }

  function queryQuotedPost(post) {
    return post?.querySelector(SELECTORS.QUOTED_POST) ?? null;
  }

  function queryNewPostButton(root = document) {
    return root.querySelector(SELECTORS.NEW_POST_BUTTON);
  }

  function querySearchInput(root = document) {
    return root.querySelector(SELECTORS.SEARCH_INPUT);
  }

  function queryTimelineContainer(root = document) {
    return root.querySelector(SELECTORS.TIMELINE_CONTAINER);
  }

  function queryNavHome(root = document) {
    return root.querySelector(SELECTORS.NAV_HOME);
  }

  function queryNavSearch(root = document) {
    return root.querySelector(SELECTORS.NAV_SEARCH);
  }

  function queryNavNotif(root = document) {
    return root.querySelector(SELECTORS.NAV_NOTIF);
  }

  function queryNavMessages(root = document) {
    return root.querySelector(SELECTORS.NAV_MESSAGES);
  }

  function queryNavBookmarks(root = document) {
    return root.querySelector(SELECTORS.NAV_BOOKMARKS);
  }

  function queryNavProfile(root = document) {
    return root.querySelector(SELECTORS.NAV_PROFILE);
  }

  function queryNavSettings(root = document) {
    return root.querySelector(SELECTORS.NAV_SETTINGS);
  }

  return {
    queryPostItems,
    queryReplyButton,
    queryLikeButton,
    queryRepostButton,
    queryBookmarkButton,
    queryQuotedPost,
    queryNewPostButton,
    querySearchInput,
    queryTimelineContainer,
    queryNavHome,
    queryNavSearch,
    queryNavNotif,
    queryNavMessages,
    queryNavBookmarks,
    queryNavProfile,
    queryNavSettings,
  };
})();
