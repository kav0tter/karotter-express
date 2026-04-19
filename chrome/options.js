(function () {
  'use strict';

  let current = { ...DEFAULT_KEYBINDINGS };
  let currentSettings = { ...DEFAULT_SETTINGS };
  let presets = [];         // BUILTIN_PRESETS + ユーザープリセット
  let activePresetId = 'default';
  let capturingAction = null;
  let captureBuffer = [];   // 収録中のキー列
  let reactionSlots = DEFAULT_REACTION_SLOTS.map(s => ({ ...s }));
  let capturingReactionIdx = null;

  const inlineHintsToggle   = document.getElementById('toggle-inline-hints');
  const floatingPanelToggle = document.getElementById('toggle-floating-panel');

  const tbody         = document.getElementById('bindings-body');
  const resetBtn      = document.getElementById('reset-btn');
  const conflictBanner = document.getElementById('conflict-banner');
  const saveBanner    = document.getElementById('save-banner');
  const presetList    = document.getElementById('preset-list');
  const presetNameInput = document.getElementById('preset-name-input');
  const presetSaveBtn = document.getElementById('preset-save-btn');
  const reactionBody = document.getElementById('reaction-body');
  const reactionSaveBanner = document.getElementById('reaction-save-banner');
  const captureStatus = document.getElementById('capture-status');

  function announceCaptureStatus(message) {
    if (!captureStatus || !message) return;
    captureStatus.textContent = '';
    requestAnimationFrame(() => {
      captureStatus.textContent = message;
    });
  }

  function getActionLabel(action) {
    return ACTION_LABELS[action] || action;
  }

  // ---- ユーティリティ ----

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

      const bufLabel = captureBuffer.length ? captureBuffer.join('') : '…';
      const tr = document.createElement('tr');
      const stateAttr = isCapturing ? 'aria-busy="true" data-state="capturing"' : 'aria-busy="false" data-state="idle"';
      tr.innerHTML = `
        <td class="action-name">${label}</td>
        <td class="key-cell">
          <kbd ${stateAttr} class="${isCapturing ? 'capturing' : ''} ${isConflict && !isCapturing ? 'conflict' : ''}">
            ${isCapturing ? bufLabel : formatKeyLabel(key)}
          </kbd>
        </td>
        <td class="edit-cell">
          ${isCapturing
            ? `<div class="capture-btns">
                 <button class="btn-confirm" data-confirm="${action}">確定</button>
                 <button class="btn-edit active" data-action="${action}">×</button>
               </div>`
            : `<button class="btn-edit" data-action="${action}">変更</button>`
          }
        </td>`;
      tbody.appendChild(tr);
    });

    conflictBanner.classList.toggle('hidden', !conflicts());
  }

  // ---- リアクションスロット描画 ----
  function renderReactionSlots() {
    reactionBody.innerHTML = '';
    reactionSlots.forEach((slot, i) => {
      const isCapturing = capturingReactionIdx === i;
      const stateAttr = isCapturing ? 'aria-busy="true" data-state="capturing"' : 'aria-busy="false" data-state="idle"';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="action-name">${i + 1}</td>
        <td><input type="text" class="emoji-input" data-slot="${i}"
                   value="${slot.emoji}" placeholder="—" maxlength="8"></td>
        <td class="key-cell">
          <kbd ${stateAttr} class="${isCapturing ? 'capturing' : ''}">${isCapturing ? '…' : formatKeyLabel(slot.key)}</kbd>
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
    current = { ...preset.bindings };
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
  function startCapture(action) {
    capturingAction = action;
    captureBuffer = [];
    announceCaptureStatus(`${getActionLabel(action)} のキー収録を開始しました`);
    renderBindings();
  }
  function stopCapture() {
    if (capturingAction) {
      announceCaptureStatus(`${getActionLabel(capturingAction)} のキー収録をキャンセルしました`);
    }
    capturingAction = null;
    captureBuffer = [];
    renderBindings();
  }

  function confirmCapture(action) {
    if (!captureBuffer.length) { stopCapture(); return; }
    current[action] = captureBuffer.join('');
    announceCaptureStatus(`${getActionLabel(action)} のキー収録を確定しました`);
    captureBuffer = [];
    capturingAction = null;
    activePresetId = '';
    renderBindings();
    renderPresets();
    if (!conflicts()) {
      KarotterStorage.saveKeybindings(current, () => {
        saveBanner.classList.remove('hidden');
        setTimeout(() => saveBanner.classList.add('hidden'), 2500);
      });
    }
  }

  function handleEditClick(e) {
    const confirm = e.target.closest('[data-confirm]');
    if (confirm) { confirmCapture(confirm.dataset.confirm); return; }
    const btn = e.target.closest('.btn-edit');
    if (!btn) return;
    const action = btn.dataset.action;
    capturingAction === action ? stopCapture() : startCapture(action);
  }

  function handleKeyCapture(e) {
    if (capturingAction) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey) { stopCapture(); return; }
      // 純粋なモディファイアキーだけは無視
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      const mods = [];
      if (e.ctrlKey) mods.push('Ctrl');
      if (e.altKey)  mods.push('Alt');
      const raw = e.code.startsWith('Numpad') ? e.code : e.key;
      // Ctrl/Alt 付きはキーを小文字に正規化（Ctrl+I と Ctrl+Shift+I を同一視）
      const base = mods.length && !e.code.startsWith('Numpad') ? raw.toLowerCase() : raw;
      const part = mods.length ? [...mods, base].join('+') : base;
      captureBuffer.push(part);
      renderBindings();
    } else if (capturingReactionIdx !== null) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { capturingReactionIdx = null; renderReactionSlots(); return; }
      reactionSlots[capturingReactionIdx].key = e.code;
      capturingReactionIdx = null;
      renderReactionSlots();
      KarotterStorage.saveReactionSlots(reactionSlots, () => {
        reactionSaveBanner.classList.remove('hidden');
        setTimeout(() => reactionSaveBanner.classList.add('hidden'), 2500);
      });
    }
  }

  // ---- 表示設定 ----
  function saveSettings() {
    currentSettings = {
      showInlineHints:   inlineHintsToggle.checked,
      showFloatingPanel: floatingPanelToggle.checked,
    };
    KarotterStorage.saveSettings(currentSettings);
  }

  function renderSettings() {
    inlineHintsToggle.checked   = currentSettings.showInlineHints;
    floatingPanelToggle.checked = currentSettings.showFloatingPanel;
  }

  // ---- リセット ----
  function reset() {
    current = { ...DEFAULT_KEYBINDINGS };
    activePresetId = 'default';
    capturingAction = null;
    render();
    KarotterStorage.saveKeybindings(current, () => {
      chrome.storage.sync.set({ activePresetId: 'default' });
      saveBanner.classList.remove('hidden');
      setTimeout(() => saveBanner.classList.add('hidden'), 2500);
    });
  }

  // ---- イベント登録 ----
  inlineHintsToggle.addEventListener('change', saveSettings);
  floatingPanelToggle.addEventListener('change', saveSettings);
  tbody.addEventListener('click', handleEditClick);
  document.addEventListener('keydown', handleKeyCapture, true);
  resetBtn.addEventListener('click', reset);
  presetSaveBtn.addEventListener('click', saveAsPreset);
  presetNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAsPreset(); });

  let emojiSaveTimer = null;
  reactionBody.addEventListener('input', (e) => {
    const input = e.target.closest('.emoji-input');
    if (!input) return;
    reactionSlots[parseInt(input.dataset.slot)].emoji = input.value.trim();
    clearTimeout(emojiSaveTimer);
    emojiSaveTimer = setTimeout(() => {
      KarotterStorage.saveReactionSlots(reactionSlots, () => {
        reactionSaveBanner.classList.remove('hidden');
        setTimeout(() => reactionSaveBanner.classList.add('hidden'), 2500);
      });
    }, 800);
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

  // ---- タブ切り替え ----
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      const hadKeyCapture = Boolean(capturingAction);
      tabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', String(isActive));
      });
      panels.forEach((p) => {
        const isActive = p.dataset.panel === target;
        p.classList.toggle('active', isActive);
        p.hidden = !isActive;
      });
      if (hadKeyCapture) stopCapture();
      capturingReactionIdx = null;
      if (!hadKeyCapture) renderBindings();
      renderReactionSlots();
    });
  });

  // ---- 初期ロード ----
  KarotterStorage.loadAll().then((result) => {
    const userPresets = result.userPresets;
    presets = [...BUILTIN_PRESETS, ...userPresets];
    activePresetId = result.activePresetId;
    current = result.keybindings;
    currentSettings = result.settings;
    reactionSlots = result.reactionSlots;
    render();
    renderSettings();
    renderReactionSlots();
  });
})();
