const DomHelpers = (() => {
  function findVisibleButtons(container) {
    return [...container.querySelectorAll('button')].filter(b => b.offsetParent !== null);
  }

  function findReplyButton(post) {
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

  function getTabContainers() {
    return [...document.querySelectorAll('[class*="rounded-full"][class*="border"]')]
      .filter(container => findVisibleButtons(container).length >= 2);
  }

  return { findVisibleButtons, findReplyButton, getTabContainers };
})();
