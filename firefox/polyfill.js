// Firefox 用：chrome.storage を browser.storage にマップするポリフィル
(function() {
  if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
    window.chrome = {
      storage: browser.storage
    };
  }
})();
