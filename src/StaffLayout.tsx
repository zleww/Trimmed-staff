import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router'
import { Calendar, CheckCircle, Clock, Grid, List, LogOut, Mail, MapPin, Menu, Moon, Scissors, Settings, Sun, User, Users, Wallet, X } from './components/icons'
import { LogoMark } from './components/Logo'
import { ShiftBar } from './components/ShiftBar'
import { useAlerts } from './lib/alerts'
import { Skeleton } from './components/ui'
import { isDemo } from './lib/api'
import { useAuth } from './lib/auth'
import { initials } from './lib/format'
import { applyStaffTheme, savedStaffTheme } from './theme'

const today = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })

// The staff app shell: left panel + top bar from tablet size up, tab bar on phones.
// This only hides screens; the database checks the role on every call.
export function StaffLayout() {
  const { session, profile, staffRole, needsCode, signOut } = useAuth()
  const [sheet, setSheet] = useState(false)
  const alerts = useAlerts(staffRole, session?.userId)
  const navigate = useNavigate()
  // Esc closes the More sheet
  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet])

  if (session === null || staffRole === null || needsCode) return <Navigate to="/signin" replace />
  if (session === undefined || staffRole === undefined) return <Skeleton className="m-6 h-64" />
  // grouped so the panel scans: the day's work first, then the owner's tools
  const desk: NavItem[] = [
    { to: '/today', label: 'Today', icon: Users },
    { to: '/requests', label: 'Requests', icon: Calendar, badge: alerts.requests },
    { to: '/messages', label: 'Messages', icon: Mail },
    { to: '/close', label: 'Close day', icon: CheckCircle },
  ]
  const owner: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: Grid, end: true },
    { to: '/branches', label: 'Branches', icon: MapPin },
    { to: '/staff', label: 'Staff', icon: User },
    { to: '/attendance', label: 'Attendance', icon: Clock },
    { to: '/inventory', label: 'Inventory', icon: List },
  ]
  const barber: NavItem[] = [
    { to: '/chair', label: 'My chair', icon: Scissors },
    { to: '/bookings', label: 'Bookings', icon: Calendar, badge: alerts.bookings },
    { to: '/earnings', label: 'Earnings', icon: Wallet },
  ]
  const groups =
    staffRole === 'owner'
      ? [{ title: 'Owner', items: owner }, { title: 'Front desk', items: desk }]
      : staffRole === 'barber'
        ? [{ title: 'Barber', items: barber }]
        : [{ title: 'Front desk', items: desk }]
  const security: NavItem = { to: '/security', label: 'Security', icon: Settings }
  const all = groups.flatMap((g) => g.items)
  // phones: up to four tabs; when there are more pages, three tabs + More
  const tabs = all.length + 1 <= 4 ? [...all, security] : all.slice(0, 3)
  const more = all.length + 1 <= 4 ? [] : [...all.slice(tabs.length), security]
  const leave = () => void signOut()
  const role = staffRole === 'owner' ? 'Owner' : staffRole === 'barber' ? 'Barber' : 'Front desk'
  const name = profile?.full_name ?? role

  return (
    <div className="min-h-dvh">
      {/* left panel with the page buttons (tablet and up) */}
      <aside className="fixed inset-y-4 left-4 z-20 hidden w-56 flex-col rounded-[14px] border border-line bg-card p-3 shadow-[inset_0_1px_0_var(--sheen)] md:flex">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-1.5">
          <LogoMark size={36} />
          <span className="text-[17px] font-medium">Trimmed</span>
        </Link>
        <nav aria-label="Staff" className="mt-5 flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="label px-3 pb-1.5 text-[11px]">{group.title}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <PanelLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        {/* pinned to the bottom, like settings */}
        <div className="mt-auto">
          <PanelLink item={{ to: '/security', label: 'Security', icon: Settings }} />
        </div>
        <button onClick={leave} className="flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-[15px] text-ink-2 hover:bg-raised/60 hover:text-ink">
          <LogOut size={19} />
          Sign out
        </button>
      </aside>

      <div className="px-4 pt-4 pb-28 sm:px-6 md:ml-[256px] md:pr-6 md:pb-8 md:pl-0">
        {/* top bar */}
        <header className="flex items-center justify-between gap-3">
          <Link to="/" className="md:hidden" aria-label="Home">
            <LogoMark size={34} />
          </Link>
          <TodayLine />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="flex h-12 items-center gap-2.5 rounded-[10px] border border-line bg-card pr-4 pl-1.5">
              <span className="grid size-9 place-items-center rounded-lg bg-raised text-[13px] font-medium">{initials(name)}</span>
              <span className="leading-tight">
                <span className="block max-w-[10rem] truncate text-[14px]">{name}</span>
                {name !== role && <span className="block text-[12px] text-ink-3">{role}</span>}
              </span>
            </div>
            <button onClick={leave} aria-label="Sign out" className="grid size-12 place-items-center rounded-[10px] border border-line bg-card text-ink-2 md:hidden">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main id="main" className="mt-6">
          {isDemo && <p className="mb-4 rounded-full bg-warn-bg px-4 py-1.5 text-center text-[13px] text-warn">Sample data (development only)</p>}
          {/* barbers and desk clock in and out here; the owner doesn't */}
          {staffRole !== 'owner' && <ShiftBar />}
          <Outlet />
        </main>
      </div>

      {/* the newest alert: a new request (desk) or a new booking (barber) */}
      {alerts.banner && (
        <div
          key={alerts.banner.id}
          role="status"
          aria-live="polite"
          className="rise fixed inset-x-3 top-3 z-40 mx-auto flex max-w-md items-start gap-3 rounded-[14px] border border-gold/40 bg-card p-4 shadow-2xl md:top-6"
        >
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-gold text-bg">
            <Calendar size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{alerts.banner.title}</span>
            <span className="block text-[14px] text-ink-2">{alerts.banner.body}</span>
            <button
              onClick={() => {
                navigate(alerts.banner!.to)
                alerts.dismiss()
              }}
              className="mt-2 min-h-10 text-[14px] font-medium text-gold underline-offset-4 hover:underline"
            >
              Open
            </button>
          </span>
          <button onClick={alerts.dismiss} aria-label="Close" className="grid size-10 shrink-0 place-items-center text-ink-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
      )}

      {/* tab bar (phone) */}
      <nav aria-label="Staff" className="fixed inset-x-3 bottom-3 z-20 flex rounded-[14px] border border-line bg-card p-1.5 md:hidden">
        {tabs.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[12px] ${isActive ? 'bg-raised text-ink' : 'text-ink-3'}`
            }
          >
            <span className="relative">
              <Icon size={18} />
              <Badge count={badge} className="absolute -top-2 -right-3" />
            </span>
            {label}
          </NavLink>
        ))}
        {more.length > 0 && (
          <button
            onClick={() => setSheet(true)}
            aria-expanded={sheet}
            className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[12px] text-ink-3"
          >
            <span className="relative">
              <Menu size={18} />
              <Badge count={more.reduce((sum, m) => sum + (m.badge ?? 0), 0)} className="absolute -top-2 -right-3" />
            </span>
            More
          </button>
        )}
      </nav>

      {/* the rest of the pages, as a sheet over the tab bar (phone) */}
      {sheet && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setSheet(false)}>
          <nav
            aria-label="More pages"
            className="rise absolute inset-x-3 bottom-3 rounded-[14px] border border-line bg-card p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-1">
              <p className="label">More</p>
              <button onClick={() => setSheet(false)} aria-label="Close" className="grid size-11 place-items-center text-ink-2">
                <X size={18} />
              </button>
            </div>
            {more.map((item) => (
              <PanelLink key={item.to} item={item} onPick={() => setSheet(false)} />
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}

/** The home page: the owner gets the dashboard, the desk today's list, a barber their chair. */
export function StaffHome({ owner }: { owner: ReactNode }) {
  const { staffRole } = useAuth()
  return staffRole === 'owner' ? owner : <Navigate to={staffRole === 'barber' ? '/chair' : '/today'} replace />
}

/** Owner pages: anyone else goes back to their home. */
export function OwnerOnly({ page }: { page: ReactNode }) {
  const { staffRole } = useAuth()
  return staffRole === 'owner' ? page : <Navigate to="/" replace />
}

/** Front desk pages (owner and desk): a barber goes back to their chair. */
export function DeskOnly({ page }: { page: ReactNode }) {
  const { staffRole } = useAuth()
  return staffRole === 'barber' ? <Navigate to="/chair" replace /> : page
}

/** Barber pages: owner and desk have no chair of their own. */
export function BarberOnly({ page }: { page: ReactNode }) {
  const { staffRole } = useAuth()
  return staffRole === 'barber' ? page : <Navigate to="/" replace />
}

// the date at the top left, worked out once when the screen opens
function TodayLine() {
  const [text] = useState(() => today.format(new Date()))
  return <p className="hidden text-[14px] text-ink-3 md:block">{text}</p>
}

function ThemeToggle() {
  const [theme, setTheme] = useState(savedStaffTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      onClick={() => {
        applyStaffTheme(next)
        setTheme(next)
      }}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="grid size-12 place-items-center rounded-[10px] border border-line bg-card text-ink-2 hover:text-ink"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

type NavItem = { to: string; label: string; icon: typeof Grid; end?: boolean; badge?: number }

function PanelLink({ item, onPick }: { item: NavItem; onPick?: () => void }) {
  const { to, label, icon: Icon, end, badge } = item
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onPick}
      className={({ isActive }) =>
        `relative flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors ${
          isActive ? 'bg-raised text-ink' : 'text-ink-2 hover:bg-raised/60 hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* the gold marker on the current page */}
          {isActive && <span aria-hidden="true" className="absolute -left-3 h-5 w-[3px] rounded-r bg-gold" />}
          <Icon size={19} />
          {label}
          <Badge count={badge} className="ml-auto" />
        </>
      )}
    </NavLink>
  )
}

// a small gold number on a menu item; nothing when it's zero
function Badge({ count, className = '' }: { count?: number; className?: string }) {
  if (!count) return null
  return (
    <span aria-label={`${count} new`} className={`num grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-bg ${className}`}>
      {count > 9 ? '9+' : count}
    </span>
  )
}
