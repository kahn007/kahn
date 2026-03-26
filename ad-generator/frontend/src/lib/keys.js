// ── Key storage (localStorage) ────────────────────────────────
const STORAGE_KEY = 'brayne_ai_keys'

export function getKeys() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveKeys(keys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

export function getKey(name) {
  return getKeys()[name] || ''
}
