import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, type LinkProps } from 'react-router'
import { initials } from '../lib/format'
import type { BookingStatus } from '../lib/types'
import { Alert, Ban, CheckCircle, Clock, Eye, EyeOff, Info, Scissors, User, X } from './icons'

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none'

const variants: Record<Variant, string> = {
  // one per screen: the light pill, like the reference dashboard
  primary: 'bg-accent text-on-accent shadow-[0_8px_24px_-10px_var(--glow)] hover:brightness-105',
  secondary: 'glass text-ink hover:border-ink-3',
  ghost: 'text-ink-2 hover:text-ink hover:bg-[var(--glass)]',
  danger: 'border border-bad/40 text-bad hover:bg-bad-bg',
}

export function buttonClass(variant: Variant = 'primary', extra = '') {
  return `${base} ${variants[variant]} ${extra}`
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }

export function Button({ variant = 'primary', loading, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, className)} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function ButtonLink({ variant = 'primary', className = '', ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...rest} />
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Surfaces and text
// ---------------------------------------------------------------------------

export function Glass({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`glass rounded-3xl ${className}`}>{children}</div>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold tracking-[0.2em] text-accent-ink uppercase">{children}</p>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[var(--glass)] ${className}`} aria-hidden="true" />
}

const tones = {
  info: { box: 'border-glass-line text-ink-2', Icon: Info },
  good: { box: 'border-good/30 bg-good-bg text-good', Icon: CheckCircle },
  warn: { box: 'border-warn/30 bg-warn-bg text-warn', Icon: Alert },
  bad: { box: 'border-bad/30 bg-bad-bg text-bad', Icon: Alert },
}

export function Notice({ tone = 'info', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  const { box, Icon } = tones[tone]
  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3 text-[14px] leading-relaxed ${box}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string | null
  trailing?: ReactNode
}

export function Field({ label, hint, error, trailing, className = '', ...rest }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? hintId : undefined}
          className={
            'h-12 w-full rounded-2xl border bg-[var(--glass)] px-4 text-[16px] text-ink placeholder:text-ink-3 ' +
            'outline-none transition focus:border-ink-2 ' +
            (error ? 'border-bad/60 ' : 'border-glass-line ') +
            (trailing ? 'pr-12' : '')
          }
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {(error || hint) && (
        <p id={hintId} className={`mt-1.5 text-[13px] ${error ? 'text-bad' : 'text-ink-3'}`}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

/** A password box with an eye button that shows or hides what you typed. */
export function PasswordField(props: Omit<FieldProps, 'type' | 'trailing'>) {
  const [shown, setShown] = useState(false)
  return (
    <Field
      {...props}
      type={shown ? 'text' : 'password'}
      // phones shouldn't "fix" a password while you type it
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:text-ink"
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  )
}

/** A row of options where exactly one is picked, like Dark / Light / System. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="glass inline-flex w-full rounded-full p-1 sm:w-auto">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={
              'flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 text-[14px] font-medium transition sm:flex-none sm:px-4 ' +
              (selected ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink')
            }
          >
            {/* icons drop off on the narrowest phones so the words still fit */}
            {option.icon && <span className="hidden min-[360px]:contents">{option.icon}</span>}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[15px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[14px] text-ink-2">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition ' +
          (checked ? 'border-transparent bg-accent' : 'border-glass-line bg-[var(--glass)]')
        }
      >
        <span
          className={
            'absolute top-1/2 left-1 size-5 -translate-y-1/2 rounded-full transition-transform ' +
            (checked ? 'translate-x-5 bg-on-accent' : 'bg-ink-2')
          }
        />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// People and status
// ---------------------------------------------------------------------------

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  return url ? (
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-glass-line bg-raised font-semibold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name) || <User size={size * 0.5} />}
    </span>
  )
}

// status is always icon + text + color, never color alone
const statusLook: Record<BookingStatus, { label: string; className: string; Icon: typeof Clock }> = {
  requested: { label: 'Waiting for the shop', className: 'text-warn bg-warn-bg', Icon: Clock },
  declined: { label: 'Declined', className: 'text-bad bg-bad-bg', Icon: Ban },
  booked: { label: 'Confirmed', className: 'text-good bg-good-bg', Icon: CheckCircle },
  checked_in: { label: 'Checked in', className: 'text-good bg-good-bg', Icon: CheckCircle },
  in_chair: { label: 'In the chair', className: 'text-good bg-good-bg', Icon: Scissors },
  done: { label: 'Done', className: 'text-ink-2 bg-[var(--glass)]', Icon: CheckCircle },
  cancelled: { label: 'Cancelled', className: 'text-ink-2 bg-[var(--glass)]', Icon: Ban },
  no_show: { label: 'Missed', className: 'text-warn bg-warn-bg', Icon: Alert },
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, className, Icon } = statusLook[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${className}`}>
      <Icon size={14} />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

/** A centered confirm box using the browser's own <dialog>, which handles focus and Esc. */
export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // the latest onClose, so the key listener below doesn't need re-adding
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  // Esc closes it ourselves: the browser's own Esc is skipped sometimes
  // (Chrome after a second press, or while a video has the focus)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // a tap on the dark area around the box closes it
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-glass-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="dialog-title" className="pt-2 text-[19px] font-semibold tracking-tight">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-raised hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  )
}
