import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from './format'

type LoadState<T> = { data: T | undefined; error: string | null; loading: boolean; reload: () => void }

/**
 * Runs an async function when the screen opens (and again when `deps` change
 * or `reload` is called) and tracks its loading and error state.
 * While reloading, the previous data stays on screen so nothing jumps.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): LoadState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    // If the screen closes or the inputs change before the answer arrives,
    // the stale answer is ignored.
    let current = true
    // oxlint-disable-next-line react/set-state-in-effect -- a new load is starting; show it right away
    setLoading(true)
    load()
      .then((result) => {
        if (!current) return
        setData(result)
        setError(null)
      })
      .catch((reason) => {
        if (current) setError(errorMessage(reason))
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
    // The caller lists what the load depends on, the same way useEffect does.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  return { data, error, loading, reload }
}

/** Returns `value` only after it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}
