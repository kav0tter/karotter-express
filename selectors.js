// DOM selectors for karotter.com (surveyed 2026-04-17, Tailwind CSS)
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
