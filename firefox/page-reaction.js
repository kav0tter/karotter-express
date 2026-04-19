// main world で実行: isolated world から発火される __karotter_react イベントを受け
// React fiber の useRef から React Query の mutate を探して直接呼ぶ
// 見つからない場合はピッカーを非表示で開いて onEmojiClick(Jr) を呼ぶ
(function () {
  // ピッカー要素を隠すための CSS（フォールバック用）
  var hideStyle = document.createElement('style');
  hideStyle.textContent = '.karotter-picker-hide { display: none !important; }';
  document.head.appendChild(hideStyle);

  document.addEventListener('__karotter_react', function (e) {
    var emoji = e.detail && e.detail.emoji;
    if (!emoji) return;

    var post = document.querySelector('.krs-focused');
    if (!post) return;

    var trigger = post.querySelector('button.reaction-trigger');
    if (!trigger) return;

    var unified = Array.from(emoji).map(function (c) {
      return c.codePointAt(0).toString(16);
    }).join('-');
    var emojiObj = { emoji: emoji, unified: unified };

    // fiber キーを取得
    var keys = Object.keys(trigger);
    var fk = null;
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].startsWith('__reactFiber')) { fk = keys[i]; break; }
    }
    if (!fk) return;

    // --- 戦略1: useRef に格納された React Query MutationObserver から mutate を探す ---
    var mutateFn = findMutateInFiber(trigger[fk]);
    if (mutateFn) {
      try {
        mutateFn(emoji);
        return;
      } catch (err) {
        console.warn('[karotter] mutate call failed:', err);
      }
    }

  });

  function findMutateInFiber(startFiber) {
    var node = startFiber;
    for (var d = 0; d < 20 && node; d++) {
      node = node.return;
      if (!node) break;

      var hook = node.memoizedState;
      var hi = 0;
      while (hook && hi < 80) {
        var ms = hook.memoizedState;
        // useRef: memoizedState = { current: <value> }
        if (ms !== null && ms !== undefined &&
            typeof ms === 'object' && !Array.isArray(ms) &&
            'current' in ms) {
          var cur = ms.current;
          // React Query MutationObserver は .mutate() と .options を持つ
          if (cur && typeof cur.mutate === 'function' && cur.options !== undefined) {
            console.log('[karotter] found mutate via useRef at depth', d, 'hook', hi);
            return cur.mutate.bind(cur);
          }
        }
        hook = hook.next;
        hi++;
      }
    }
    return null;
  }

  function findJrInNode(el) {
    var keys = Object.keys(el);
    var fk = null;
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].startsWith('__reactFiber')) { fk = keys[i]; break; }
    }
    if (!fk) return null;
    var node = el[fk];
    for (var d = 0; d < 30 && node; d++) {
      if (node.memoizedProps && typeof node.memoizedProps.onEmojiClick === 'function') {
        return node.memoizedProps.onEmojiClick;
      }
      node = node.return;
    }
    return null;
  }
})();
