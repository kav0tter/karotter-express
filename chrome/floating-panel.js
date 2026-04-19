const FloatingPanel = (() => {
  let host = null;

  function buildStyle() {
    return `
      :host { all: initial; }
      #wrap {
        position: fixed; bottom: 80px; right: 16px;
        z-index: 99997;
        font-family: system-ui, sans-serif; font-size: 13px;
      }
      #panel {
        background: var(--surface-card);
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        box-shadow: var(--surface-shadow);
        padding: 12px 16px;
        min-width: 200px;
        max-height: 70vh;
        overflow-y: auto;
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      #toggle {
        display: flex; align-items: center; justify-content: center;
        width: 36px; height: 36px;
        border-radius: 50%;
        background: var(--accent);
        color: var(--surface-card);
        border: none; cursor: pointer;
        font-size: 16px; font-weight: 700;
        box-shadow: 0 2px 8px rgba(0,0,0,.3);
        margin-left: auto;
      }
      #toggle:hover { opacity: .85; }
      section { margin-bottom: 10px; }
      h3 {
        margin: 0 0 4px; font-size: 10px; text-transform: uppercase;
        letter-spacing: .08em; color: var(--text-muted);
      }
      .row { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
      .row span { color: var(--text-secondary); font-size: 12px; }
      kbd {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 28px; padding: 1px 6px;
        background: var(--surface-soft);
        border: 1px solid var(--border-soft);
        border-radius: 5px; font-family: monospace; font-size: 11px;
        color: var(--accent);
      }`;
  }

  function buildPanelHTML(bindings) {
    const sectionsHTML = HELP_SECTIONS.map(({ title, actions }) => {
      const rows = actions.map(action => `
        <div class="row">
          <kbd>${formatKeyLabel(bindings[action] ?? DEFAULT_KEYBINDINGS[action])}</kbd>
          <span>${ACTION_LABELS[action]}</span>
        </div>`).join('');
      return `<section><h3>${title}</h3>${rows}</section>`;
    }).join('');
    return sectionsHTML;
  }

  let panelExpanded = true;

  function build(bindings) {
    host = document.createElement('div');
    host.id = 'krs-floating-host';
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = buildStyle();
    shadow.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'wrap';
    wrap.innerHTML = `
      <div id="panel" ${panelExpanded ? '' : 'style="display:none"'}>${buildPanelHTML(bindings)}</div>
      <button id="toggle" title="ショートカット一覧">?</button>`;
    shadow.appendChild(wrap);

    shadow.getElementById('toggle').addEventListener('click', () => {
      panelExpanded = !panelExpanded;
      const panel = shadow.getElementById('panel');
      panel.style.display = panelExpanded ? '' : 'none';
    });

    document.body.appendChild(host);
  }

  function show(bindings) {
    if (host) host.remove();
    build(bindings ?? DEFAULT_KEYBINDINGS);
  }

  function hide() {
    if (host) { host.remove(); host = null; }
  }

  function refresh(bindings) {
    if (host) show(bindings);
  }

  function isVisible() { return !!host; }

  return { show, hide, refresh, isVisible };
})();
