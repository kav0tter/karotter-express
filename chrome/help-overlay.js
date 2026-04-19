const HelpOverlay = (() => {
  let host = null;
  let visible = false;

  const SECTIONS = HELP_SECTIONS;

  function buildHTML(bindings) {
    const sectionsHTML = SECTIONS.map(({ title, actions }) => {
      const rows = actions.map((action) => `
        <div class="row">
          <kbd>${formatKeyLabel(bindings[action] ?? DEFAULT_KEYBINDINGS[action])}</kbd>
          <span>${ACTION_LABELS[action]}</span>
        </div>`).join('');
      return `<section><h3>${title}</h3>${rows}</section>`;
    }).join('');

    return `
      <div id="backdrop"></div>
      <div id="panel" role="dialog" aria-modal="true" aria-label="キーボードショートカット一覧">
        <div id="header">
          <h2>キーボードショートカット</h2>
          <button id="close" aria-label="閉じる">✕</button>
        </div>
        <div id="body">${sectionsHTML}</div>
        <p id="footer">設定から変更できます</p>
      </div>`;
  }

  function buildStyle() {
    return `
      :host { all: initial; }
      #backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,.45);
        z-index: 99998;
      }
      #panel {
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        z-index: 99999;
        background: var(--surface-card);
        color: var(--text-primary);
        border-radius: 16px; padding: 24px 28px;
        min-width: 320px; max-width: 440px; width: 90vw;
        box-shadow: var(--surface-shadow);
        border: 1px solid var(--border-soft);
        font-family: system-ui, sans-serif; font-size: 14px;
      }
      #header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 16px;
      }
      h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--accent); }
      #close {
        background: none; border: none; color: var(--text-muted);
        font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 6px;
      }
      #close:hover { background: var(--surface-soft); color: var(--text-primary); }
      section { margin-bottom: 14px; }
      h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase;
           letter-spacing: .08em; color: var(--text-muted); }
      .row {
        display: flex; align-items: center; gap: 12px;
        padding: 4px 0;
      }
      .row span { color: var(--text-secondary); }
      kbd {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 36px; padding: 2px 8px;
        background: var(--surface-soft);
        border: 1px solid var(--border-soft);
        border-radius: 6px; font-family: monospace; font-size: 13px;
        color: var(--accent);
      }
      #footer {
        margin: 12px 0 0; font-size: 11px; color: var(--text-muted); text-align: center;
      }`;
  }

  function build(bindings) {
    host = document.createElement('div');
    host.id = 'krs-help-host';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = buildStyle();
    shadow.appendChild(style);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildHTML(bindings);
    shadow.appendChild(wrapper);

    shadow.getElementById('close').addEventListener('click', hide);
    shadow.getElementById('backdrop').addEventListener('click', hide);
    document.body.appendChild(host);
  }

  function show(bindings) {
    if (host) host.remove();
    build(bindings ?? DEFAULT_KEYBINDINGS);
    visible = true;
  }

  function hide() {
    if (host) { host.remove(); host = null; }
    visible = false;
  }

  function toggle(bindings) {
    visible ? hide() : show(bindings);
  }

  function isVisible() { return visible; }

  return { show, hide, toggle, isVisible };
})();
