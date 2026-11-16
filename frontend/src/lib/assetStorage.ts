/**
 * Large-Scale Asset Storage Engine (IndexedDB + LocalStorage Fallback)
 * Capable of storing and retrieving 100 to 100,000+ asset records
 * without hitting the browser's 5MB localStorage quota limit.
 */
import type { Asset } from '@/types/asset'

const DB_NAME = 'meridian_assets_db'
const STORE_NAME = 'assets_store'
const DB_VERSION = 1
const FALLBACK_STORAGE_KEY = 'meridian_assets'

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB
  }
  return null
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIndexedDB()
    if (!idb) {
      return reject(new Error('IndexedDB not supported in this environment'))
    }

    const request = idb.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Save all assets to IndexedDB (unlimited capacity) and cache top items in localStorage
 */
export async function saveAssetsToStorage(assets: Asset[]): Promise<void> {
  // 1. Always safely cache up to 500 items in localStorage for instant synchronous startup
  try {
    const sample = assets.slice(0, 500)
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(sample))
  } catch (err) {
    console.warn('LocalStorage quota reached, using in-memory / IndexedDB storage', err)
  }

  // 2. Persist full dataset (up to 100k+ assets) in IndexedDB
  const idb = getIndexedDB()
  if (!idb) return

  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    // Clear and batch put
    store.clear()
    for (const asset of assets) {
      store.put(asset)
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('IndexedDB persistence error:', err)
  }
}

/**
 * Load all assets from IndexedDB (or fallback to localStorage)
 */
export async function loadAssetsFromStorage(): Promise<Asset[]> {
  // First attempt IndexedDB
  const idb = getIndexedDB()
  if (idb) {
    try {
      const db = await openDatabase()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      const result = await new Promise<Asset[]>((resolve, reject) => {
        request.onsuccess = () => resolve((request.result as Asset[]) || [])
        request.onerror = () => reject(request.error)
      })

      if (result.length > 0) {
        return result
      }
    } catch {
      // Fallback to localStorage if IndexedDB is empty or inaccessible
    }
  }

  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(FALLBACK_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}

  return []
}

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('null')) {
    return `${window.location.origin}${path}`
  }
  return `http://localhost:8000${path}`
}

/**
 * Fetch master asset registry from central Django backend
 */
export async function fetchBackendAssets(): Promise<Asset[]> {
  try {
    const res = await fetch(getApiUrl('/api/assets/'), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return []
    const data = await res.json()
    if (data && Array.isArray(data.assets)) {
      return data.assets
    }
  } catch (err) {
    console.warn('Backend assets fetch unavailable:', err)
  }
  return []
}

/**
 * Push bulk imported assets to central Django backend so all factory terminals see them
 */
export async function pushAssetsToBackend(
  assets: Asset[],
  user?: { userId?: string; userName?: string; role?: string }
): Promise<boolean> {
  if (!assets || assets.length === 0) return true
  try {
    const res = await fetch(getApiUrl('/api/assets/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user?.userId || 'USR-ADMIN',
        'X-User-Name': user?.userName || 'Super User',
        'X-User-Role': user?.role || 'Administrator',
      },
      body: JSON.stringify({ assets }),
    })
    return res.ok
  } catch (err) {
    console.warn('Failed to push assets to backend:', err)
    return false
  }
}

/**
 * Purge all assets from central backend SQLite
 */
export async function purgeBackendAssets(
  user?: { userId?: string; userName?: string; role?: string }
): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/api/assets/'), {
      method: 'DELETE',
      headers: {
        'X-User-Id': user?.userId || 'USR-ADMIN',
        'X-User-Name': user?.userName || 'Super User',
        'X-User-Role': user?.role || 'Administrator',
      },
    })
    return res.ok
  } catch {
    return false
  }
}
