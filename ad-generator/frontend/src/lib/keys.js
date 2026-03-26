// ── Key storage (localStorage) ────────────────────────────────
const KEYS_KEY    = 'brayne_ai_keys'
const SETTINGS_KEY = 'brayne_ai_settings'

export function getKeys() {
  try {
    return JSON.parse(localStorage.getItem(KEYS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveKeys(keys) {
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys))
}

export function getKey(name) {
  return getKeys()[name] || ''
}

// ── Settings storage (brand + campaign) ──────────────────────
export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
