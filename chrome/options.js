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
  const ESCAPE_BEHAVIOR_LABELS = {
    discardDialog: '下書き破棄ダイアログを閉じる',
    inputBlur: '入力中フォーカスを外す',
    helpClose: 'ヘルプを閉じる',
    modalClose: 'モーダルを閉じる',
    clearFocus: '投稿フォーカスを解除',
    historyBack: '前のページへ戻る',
  };

  const inlineHintsToggle   = document.getElementById('toggle-inline-hints');
  const floatingPanelToggle = document.getElementById('toggle-floating-panel');
  const escapeOrderList = document.getElementById('escape-order-list');
  const focusStatusBadgeToggle = document.getElementById('toggle-focus-status-badge');

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
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file-input');
  const importWarningBanner = document.getElementById('import-warning-banner');

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

  function normalizedEscapeOrder(order) {
    const valid = DEFAULT_SETTINGS.escapeBehaviorOrder;
    const current = Array.isArray(order) ? order.filter(name => valid.includes(name)) : [];
    const missing = valid.filter(name => !current.includes(name));
    return [...current, ...missing];
  }

  function renderEscapeOrder() {
    escapeOrderList.innerHTML = '';
    const order = normalizedEscapeOrder(currentSettings.escapeBehaviorOrder);
    currentSettings.escapeBehaviorOrder = order;

    order.forEach((name, idx) => {
      const li = document.createElement('li');
      li.className = 'escape-order-item';
      li.innerHTML = `
        <span class="escape-order-name">${ESCAPE_BEHAVIOR_LABELS[name] ?? name}</span>
        <div class="escape-order-actions">
          <button class="btn-edit escape-move-btn" data-move-escape="up" data-index="${idx}" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-edit escape-move-btn" data-move-escape="down" data-index="${idx}" ${idx === order.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
      `;
      escapeOrderList.appendChild(li);
    });
  }

  function showImportWarning(message) {
    importWarningBanner.textContent = message;
    importWarningBanner.classList.remove('hidden');
  }

  function clearImportWarning() {
    importWarningBanner.textContent = '';
    importWarningBanner.classList.add('hidden');
  }

  function normalizeKeybindings(raw) {
    const base = { ...DEFAULT_KEYBINDINGS };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { value: base, invalid: true };
    }
    let invalid = false;
    Object.keys(DEFAULT_KEYBINDINGS).forEach((key) => {
      if (!(key in raw)) return;
      if (typeof raw[key] === 'string') base[key] = raw[key];
      else invalid = true;
    });
    return { value: base, invalid };
  }

  function normalizeSettings(raw) {
    const base = { ...DEFAULT_SETTINGS };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { value: base, invalid: true };
    }
    let invalid = false;
    Object.keys(DEFAULT_SETTINGS).forEach((key) => {
      if (!(key in raw)) return;
      if (typeof raw[key] === 'boolean') base[key] = raw[key];
      else invalid = true;
    });
    return { value: base, invalid };
  }

  function normalizeReactionSlots(raw) {
    const base = DEFAULT_REACTION_SLOTS.map((slot) => ({ ...slot }));
    if (!Array.isArray(raw)) {
      return { value: base, invalid: true };
    }
    let invalid = false;
    base.forEach((slot, idx) => {
      const from = raw[idx];
      if (from === undefined) return;
      if (!from || typeof from !== 'object' || Array.isArray(from)) { invalid = true; return; }
      if ('key' in from) {
        if (typeof from.key === 'string') slot.key = from.key;
        else invalid = true;
      }
      if ('emoji' in from) {
        if (typeof from.emoji === 'string') slot.emoji = from.emoji;
        else invalid = true;
      }
    });
    return { value: base, invalid };
  }

  function normalizeUserPresets(raw) {
    if (!Array.isArray(raw)) return { value: [], invalid: true };
    const value = [];
    let invalid = false;
    raw.forEach((preset) => {
      if (!preset || typeof preset !== 'object' || Array.isArray(preset)) { invalid = true; return; }
      if (typeof preset.id !== 'string' || typeof preset.name !== 'string') { invalid = true; return; }
      const normalizedBindings = normalizeKeybindings(preset.bindings);
      if (normalizedBindings.invalid) invalid = true;
      value.push({
        id: preset.id,
        name: preset.name,
        readonly: false,
        bindings: normalizedBindings.value,
      });
    });
    return { value, invalid };
  }

  function normalizeActivePresetId(raw, userPresets) {
    if (typeof raw !== 'string') return { value: 'default', invalid: true };
    const existsBuiltin = BUILTIN_PRESETS.some((preset) => preset.id === raw);
    const existsUser = userPresets.some((preset) => preset.id === raw);
    if (existsBuiltin || existsUser) return { value: raw, invalid: false };
    return { value: 'default', invalid: true };
  }

  function exportConfig() {
    const payload = {
      keybindings: current,
      settings: currentSettings,
      reactionSlots,
      userPresets: presets.filter((preset) => !preset.readonly).map((preset) => ({
        id: preset.id,
        name: preset.name,
        bindings: preset.bindings,
      })),
      activePresetId,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const link = document.createElement('a');
    link.href = url;
    link.download = `karotter-config-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    clearImportWarning();
  }

  async function importConfig(file) {
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (_error) {
      showImportWarning('インポートに失敗しました: JSON 形式が不正です。');
      return;
    }

    const keybindings = normalizeKeybindings(parsed.keybindings);
    const settings = normalizeSettings(parsed.settings);
    const slots = normalizeReactionSlots(parsed.reactionSlots);
    const userPresets = normalizeUserPresets(parsed.userPresets);
    const activeId = normalizeActivePresetId(parsed.activePresetId, userPresets.value);
    const hasInvalid = keybindings.invalid || settings.invalid || slots.invalid || userPresets.invalid || activeId.invalid;

    current = keybindings.value;
    currentSettings = settings.value;
    reactionSlots = slots.value;
    presets = [...BUILTIN_PRESETS, ...userPresets.value];
    activePresetId = activeId.value;

    if (!presets.some((preset) => preset.id === activePresetId)) {
      activePresetId = 'default';
    }

    const activePreset = presets.find((preset) => preset.id === activePresetId);
    if (activePreset) current = { ...activePreset.bindings };

    KarotterStorage.saveKeybindings(current);
    KarotterStorage.saveSettings(currentSettings);
    KarotterStorage.saveReactionSlots(reactionSlots);
    chrome.storage.sync.set({
      userPresets: userPresets.value,
      activePresetId,
    });

    render();
    renderSettings();
    renderReactionSlots();
    if (hasInvalid) {
      showImportWarning('一部データは型不正のため破棄し、デフォルト値で補完しました。');
    } else {
      clearImportWarning();
    }

    saveBanner.classList.remove('hidden');
    setTimeout(() => saveBanner.classList.add('hidden'), 2500);
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
      showFocusStatusBadge: focusStatusBadgeToggle.checked,
      escapeBehaviorOrder: normalizedEscapeOrder(currentSettings.escapeBehaviorOrder),
    };
    KarotterStorage.saveSettings(currentSettings);
  }

  function renderSettings() {
    inlineHintsToggle.checked   = currentSettings.showInlineHints;
    floatingPanelToggle.checked = currentSettings.showFloatingPanel;
    focusStatusBadgeToggle.checked = currentSettings.showFocusStatusBadge;
    renderEscapeOrder();
  }

  function moveEscapeBehavior(index, direction) {
    const order = normalizedEscapeOrder(currentSettings.escapeBehaviorOrder);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    currentSettings.escapeBehaviorOrder = order;
    renderEscapeOrder();
    saveSettings();
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
  focusStatusBadgeToggle.addEventListener('change', saveSettings);
  tbody.addEventListener('click', handleEditClick);
  document.addEventListener('keydown', handleKeyCapture, true);
  resetBtn.addEventListener('click', reset);
  exportBtn.addEventListener('click', exportConfig);
  importBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', async () => {
    const [file] = importFileInput.files || [];
    await importConfig(file);
    importFileInput.value = '';
  });
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
  escapeOrderList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-move-escape]');
    if (!button) return;
    const idx = parseInt(button.dataset.index, 10);
    moveEscapeBehavior(idx, button.dataset.moveEscape);
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
