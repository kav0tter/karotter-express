(function (global) {
  'use strict';

  function mergeKeybindings(raw) {
    return { ...DEFAULT_KEYBINDINGS, ...(raw ?? {}) };
  }

  function mergeSettings(raw) {
    const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
    const valid = DEFAULT_SETTINGS.escapeBehaviorOrder;
    const stored = Array.isArray(merged.escapeBehaviorOrder)
      ? merged.escapeBehaviorOrder.filter(name => valid.includes(name))
      : [];
    merged.escapeBehaviorOrder = [...stored, ...valid.filter(name => !stored.includes(name))];
    return merged;
  }

  function mergeReactionSlots(raw) {
    const slots = Array.isArray(raw) ? raw : [];
    return DEFAULT_REACTION_SLOTS.map((defaults, idx) => ({
      ...defaults,
      ...(slots[idx] ?? {}),
    }));
  }

  function loadAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ['keybindings', 'settings', 'reactionSlots', 'userPresets', 'activePresetId'],
        (result) => {
          resolve({
            keybindings: mergeKeybindings(result.keybindings),
            settings: mergeSettings(result.settings),
            reactionSlots: mergeReactionSlots(result.reactionSlots),
            userPresets: Array.isArray(result.userPresets) ? result.userPresets : [],
            activePresetId: result.activePresetId ?? 'default',
          });
        }
      );
    });
  }

  function saveKeybindings(keybindings, callback) {
    chrome.storage.sync.set({ keybindings: mergeKeybindings(keybindings) }, callback);
  }

  function saveSettings(settings, callback) {
    chrome.storage.sync.set({ settings: mergeSettings(settings) }, callback);
  }

  function saveReactionSlots(reactionSlots, callback) {
    chrome.storage.sync.set({ reactionSlots: mergeReactionSlots(reactionSlots) }, callback);
  }

  function subscribe(onChange) {
    const listener = (changes, areaName) => {
      if (areaName !== 'sync') return;

      const patch = {};
      if (changes.keybindings) {
        patch.keybindings = mergeKeybindings(changes.keybindings.newValue);
      }
      if (changes.settings) {
        patch.settings = mergeSettings(changes.settings.newValue);
      }
      if (changes.reactionSlots) {
        patch.reactionSlots = mergeReactionSlots(changes.reactionSlots.newValue);
      }

      if (Object.keys(patch).length > 0) onChange(patch);
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  global.KarotterStorage = {
    loadAll,
    saveKeybindings,
    saveSettings,
    saveReactionSlots,
    subscribe,
  };
})(globalThis);
