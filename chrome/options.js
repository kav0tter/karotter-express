(function () {
  'use strict';

  let current = { ...DEFAULT_KEYBINDINGS };
  let currentSettings = { ...DEFAULT_SETTINGS };
  let presets = [];         // BUILTIN_PRESETS + ユーザープリセット
  let activePresetId = 'default';
  let capturingAction = null;
  let reactionSlots = DEFAULT_REACTION_SLOTS.map(s => ({ ...s }));
  let capturingReactionIdx = null;

  const inlineHintsToggle   = document.getElementById('toggle-inline-hints');
  const floatingPanelToggle = document.getElementById('toggle-floating-panel');

  const tbody         = document.getElementById('bindings-body');
  const saveBtn       = document.getElementById('save-btn');
  const resetBtn      = document.getElementById('reset-btn');
  const conflictBanner = document.getElementById('conflict-banner');
  const saveBanner    = document.getElementById('save-banner');
  const presetList    = document.getElementById('preset-list');
  const presetNameInput = document.getElementById('preset-name-input');
  const presetSaveBtn = document.getElementById('preset-save-btn');
  const reactionBody = document.getElementById('reaction-body');
  const reactionSaveBtn = document.getElementById('reaction-save-btn');
  const reactionSaveBanner = document.getElementById('reaction-save-banner');

  // ---- ユーティリティ ----
  function keyLabel(key) {
    const map = { ArrowDown: '↓', ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→',
                  Enter: 'Enter', Escape: 'Esc', ' ': 'Space' };
    if (key in map) return map[key];
    const numpad = key.match(/^Numpad(\w+)$/);
    if (numpad) return `テンキー${numpad[1]}`;
    return key;
  }

  function conflicts() {
    const vals = Object.values(current);
    return vals.length !== new Set(vals).size;
  }

  function dupKeys() {
    const vals = Object.values(current);
    const dups = new Set();
    vals.forEach((v, i) => { if (vals.indexOf(v) !== i) dups.add(v); });
    return dups;
  }

  // ---- プリセット描画 ----
  function renderPresets() {
    presetList.innerHTML = '';
    presets.forEach((preset) => {
      const item = document.createElement('div');
      item.className = 'preset-item' + (preset.id === activePresetId ? ' active' : '');

      const label = document.createElement('button');
      label.className = 'preset-label';
      label.textContent = preset.name;
      if (preset.readonly) {
        const badge = document.createElement('span');
        badge.className = 'preset-badge';
        badge.textContent = '組み込み';
        label.appendChild(badge);
      }
      label.addEventListener('click', () => applyPreset(preset.id));

      item.appendChild(label);

      if (!preset.readonly) {
        const del = document.createElement('button');
        del.className = 'preset-delete';
        del.textContent = '削除';
        del.setAttribute('aria-label', `${preset.name} を削除`);
        del.addEventListener('click', () => deletePreset(preset.id));
        item.appendChild(del);
      }

      presetList.appendChild(item);
    });
  }

  // ---- キーバインド描画 ----
  function renderBindings() {
    tbody.innerHTML = '';
    const dups = dupKeys();

    Object.entries(ACTION_LABELS).forEach(([action, label]) => {
      const key = current[action] ?? DEFAULT_KEYBINDINGS[action];
      const isConflict  = dups.has(key);
      const isCapturing = capturingAction === action;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="action-name">${label}</td>
        <td class="key-cell">
          <kbd class="${isCapturing ? 'capturing' : ''} ${isConflict && !isCapturing ? 'conflict' : ''}">
            ${isCapturing ? '…' : keyLabel(key)}
          </kbd>
        </td>
        <td class="edit-cell">
          <button class="btn-edit ${isCapturing ? 'active' : ''}" data-action="${action}">
            ${isCapturing ? 'キャンセル' : '変更'}
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    conflictBanner.classList.toggle('hidden', !conflicts());
    saveBtn.disabled = conflicts();
  }

  // ---- リアクションスロット描画 ----
  function renderReactionSlots() {
    reactionBody.innerHTML = '';
    reactionSlots.forEach((slot, i) => {
      const isCapturing = capturingReactionIdx === i;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="action-name">${i + 1}</td>
        <td><input type="text" class="emoji-input" data-slot="${i}"
                   value="${slot.emoji}" placeholder="—" maxlength="8"></td>
        <td class="key-cell">
          <kbd class="${isCapturing ? 'capturing' : ''}">${isCapturing ? '…' : keyLabel(slot.key)}</kbd>
        </td>
        <td class="edit-cell">
          <button class="btn-edit ${isCapturing ? 'active' : ''}" data-reaction-slot="${i}">
            ${isCapturing ? 'キャンセル' : '変更'}
          </button>
        </td>`;
      reactionBody.appendChild(tr);
    });
  }

  function render() {
    renderPresets();
    renderBindings();
  }

  // ---- プリセット操作 ----
  function applyPreset(id) {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    activePresetId = id;
    current = { ...DEFAULT_KEYBINDINGS, ...preset.bindings };
    capturingAction = null;
    chrome.storage.sync.set({ activePresetId: id });
    render();
  }

  function saveAsPreset() {
    const name = presetNameInput.value.trim();
    if (!name) { presetNameInput.focus(); return; }

    const id = 'user-' + Date.now();
    const newPreset = { id, name, readonly: false, bindings: { ...current } };
    const userPresets = presets.filter((p) => !p.readonly);
    const updated = [...userPresets, newPreset];

    chrome.storage.sync.set({ userPresets: updated, activePresetId: id }, () => {
      presets = [...BUILTIN_PRESETS, ...updated];
      activePresetId = id;
      presetNameInput.value = '';
      render();
    });
  }

  function deletePreset(id) {
    const userPresets = presets.filter((p) => !p.readonly && p.id !== id);
    const nextId = activePresetId === id ? 'default' : activePresetId;
    chrome.storage.sync.set({ userPresets, activePresetId: nextId }, () => {
      presets = [...BUILTIN_PRESETS, ...userPresets];
      if (activePresetId === id) applyPreset('default');
      else { activePresetId = nextId; render(); }
    });
  }

  // ---- キーキャプチャ ----
  function startCapture(action) { capturingAction = action; renderBindings(); }
  function stopCapture()        { capturingAction = null;   renderBindings(); }

  function handleEditClick(e) {
    const btn = e.target.closest('.btn-edit');
    if (!btn) return;
    const action = btn.dataset.action;
    capturingAction === action ? stopCapture() : startCapture(action);
  }

  function handleKeyCapture(e) {
    if (capturingAction) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { stopCapture(); return; }
      current[capturingAction] = e.code.startsWith('Numpad') ? e.code : e.key;
      capturingAction = null;
      activePresetId = '';
      renderBindings();
      renderPresets();
    } else if (capturingReactionIdx !== null) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { capturingReactionIdx = null; renderReactionSlots(); return; }
      reactionSlots[capturingReactionIdx].key = e.code;
      capturingReactionIdx = null;
      renderReactionSlots();
    }
  }

  // ---- 表示設定 ----
  function saveSettings() {
    currentSettings = {
      showInlineHints:   inlineHintsToggle.checked,
      showFloatingPanel: floatingPanelToggle.checked,
    };
    chrome.storage.sync.set({ settings: currentSettings });
  }

  function renderSettings() {
    inlineHintsToggle.checked   = currentSettings.showInlineHints;
    floatingPanelToggle.checked = currentSettings.showFloatingPanel;
  }

  // ---- 保存 ----
  function save() {
    if (conflicts()) return;
    chrome.storage.sync.set({ keybindings: current }, () => {
      saveBanner.classList.remove('hidden');
      setTimeout(() => saveBanner.classList.add('hidden'), 2500);
    });
  }

  function reset() {
    current = { ...DEFAULT_KEYBINDINGS };
    activePresetId = 'default';
    capturingAction = null;
    render();
  }

  // ---- イベント登録 ----
  inlineHintsToggle.addEventListener('change', saveSettings);
  floatingPanelToggle.addEventListener('change', saveSettings);
  tbody.addEventListener('click', handleEditClick);
  document.addEventListener('keydown', handleKeyCapture, true);
  saveBtn.addEventListener('click', save);
  resetBtn.addEventListener('click', reset);
  presetSaveBtn.addEventListener('click', saveAsPreset);
  presetNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAsPreset(); });

  reactionBody.addEventListener('input', (e) => {
    const input = e.target.closest('.emoji-input');
    if (!input) return;
    reactionSlots[parseInt(input.dataset.slot)].emoji = input.value.trim();
  });
  reactionBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reaction-slot]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.reactionSlot);
    capturingReactionIdx = capturingReactionIdx === idx ? null : idx;
    capturingAction = null;
    renderReactionSlots();
    renderBindings();
  });
  reactionSaveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({ reactionSlots }, () => {
      reactionSaveBanner.classList.remove('hidden');
      setTimeout(() => reactionSaveBanner.classList.add('hidden'), 2500);
    });
  });

  // ---- タブ切り替え ----
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === target));
      capturingAction = null;
      capturingReactionIdx = null;
      renderBindings();
      renderReactionSlots();
    });
  });

  // ---- 初期ロード ----
  chrome.storage.sync.get(['keybindings', 'userPresets', 'activePresetId', 'settings', 'reactionSlots'], (result) => {
    const userPresets = result.userPresets ?? [];
    presets = [...BUILTIN_PRESETS, ...userPresets];
    activePresetId = result.activePresetId ?? 'default';
    if (result.keybindings)    current = { ...DEFAULT_KEYBINDINGS, ...result.keybindings };
    if (result.settings)       currentSettings = { ...DEFAULT_SETTINGS, ...result.settings };
    if (result.reactionSlots)  reactionSlots = result.reactionSlots;
    render();
    renderSettings();
    renderReactionSlots();
  });
})();
