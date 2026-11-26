import { useState } from 'react'
import { popupsSupported } from '../lib/alerts'
import { Alert } from './icons'
import { Button } from './ui'

/** Asks this browser for pop-up alerts. Hidden once allowed, or where pop-ups don't exist. */
export function AlertsButton() {
  const [state, setState] = useState(() => (popupsSupported() ? Notification.permission : 'denied'))
  if (state === 'granted') return null
  if (state === 'denied') {
    return popupsSupported() ? <p className="text-[13px] text-ink-3">Pop-up alerts are blocked in this browser's site settings.</p> : null
  }
  return (
    <Button variant="ghost" className="h-11" onClick={async () => setState(await Notification.requestPermission())}>
      <Alert size={16} />
      Turn on pop-up alerts
    </Button>
  )
}
