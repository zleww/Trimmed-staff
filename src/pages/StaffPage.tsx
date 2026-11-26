import { useState } from 'react'
import { Ban, CheckCircle, Plus } from '../components/icons'
import { Button, Dialog, Field, Notice, PasswordField, Segmented, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/format'
import type { Branch, StaffMember } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { Select } from './Select'

const roleName = { owner: 'Owner', desk: 'Front desk', barber: 'Barber' } as const

type Open = { kind: 'add' } | { kind: 'edit'; member: StaffMember } | { kind: 'password'; member: StaffMember } | null

/** The owner adds staff logins, moves people between branches, resets passwords, turns accounts off. */
export function StaffPage() {
  const { session } = useAuth()
  const staff = useLoad(() => api.staffList(), [])
  const branches = useLoad(() => api.listBranches(), [])
  const [open, setOpen] = useState<Open>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  function done(text: string) {
    setOpen(null)
    setMessage({ tone: 'good', text })
    staff.reload()
  }

  async function toggle(member: StaffMember) {
    setBusyId(member.id)
    setMessage(null)
    try {
      await api.setStaffActive(member.id, !member.active)
      setMessage({ tone: 'good', text: member.active ? `${member.full_name} can no longer sign in.` : `${member.full_name} can sign in again.` })
    } catch (reason) {
      setMessage({ tone: 'bad', text: errorMessage(reason) })
    } finally {
      setBusyId(null)
      staff.reload()
    }
  }

  const list = staff.data ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight sm:text-[34px]">Staff</h1>
          <p className="text-[15px] text-ink-3">Each person gets their own login. Turned-off accounts can't sign in.</p>
        </div>
        <Button className="h-12 px-5" onClick={() => setOpen({ kind: 'add' })} disabled={!branches.data}>
          <Plus size={18} />
          Add staff
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {staff.error && <Notice tone="bad">{staff.error}</Notice>}
        {staff.loading && !staff.data && <Skeleton className="h-64" />}

        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.id} className={`rounded-[14px] border border-line bg-card px-4 py-3 ${m.active ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px]">{m.full_name}</span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {roleName[m.role]}
                    {m.branch_name && ` · ${m.branch_name}`} · {m.email}
                  </span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${
                    m.active ? 'bg-good-bg text-good' : 'bg-raised text-ink-3'
                  }`}
                >
                  {m.active ? <CheckCircle size={14} /> : <Ban size={14} />}
                  {m.active ? 'Active' : 'Turned off'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="ghost" className="h-11" onClick={() => setOpen({ kind: 'edit', member: m })}>
                  Edit
                </Button>
                <Button variant="ghost" className="h-11" onClick={() => setOpen({ kind: 'password', member: m })}>
                  Set password
                </Button>
                {m.role !== 'owner' && m.id !== session?.userId && (
                  <Button variant={m.active ? 'ghost' : 'secondary'} className="h-11" loading={busyId === m.id} onClick={() => toggle(m)}>
                    {m.active ? 'Turn off' : 'Turn on'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {open?.kind === 'add' && branches.data && (
        <AddDialog branches={branches.data} onClose={() => setOpen(null)} onDone={(name) => done(`${name} can sign in now. Give them their email and password.`)} />
      )}
      {open?.kind === 'edit' && branches.data && (
        <EditDialog member={open.member} branches={branches.data} onClose={() => setOpen(null)} onDone={() => done(`Saved ${open.member.full_name}.`)} />
      )}
      {open?.kind === 'password' && (
        <PasswordDialog member={open.member} onClose={() => setOpen(null)} onDone={() => done(`New password set for ${open.member.full_name}. Tell them in person.`)} />
      )}
    </div>
  )
}

function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

function DialogButtons({ busy, label, onClose }: { busy: boolean; label: string; onClose: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <Button type="button" variant="ghost" className="h-12 flex-1" onClick={onClose}>
        Back
      </Button>
      <Button type="submit" className="h-12 flex-1" loading={busy}>
        {label}
      </Button>
    </div>
  )
}

function AddDialog({ branches, onClose, onDone }: { branches: Branch[]; onClose: () => void; onDone: (name: string) => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'desk' | 'barber'>('desk')
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useSubmit()

  return (
    <Dialog open title="Add staff" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await api.createStaff({ fullName: fullName.trim(), email: email.trim(), role, branchId, password })
            onDone(fullName.trim())
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Full name" placeholder="Maria Santos" autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Field label="Email" type="email" placeholder="maria@example.com" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <p className="mb-1.5 text-[14px] font-medium">Job</p>
          <Segmented
            label="Job"
            value={role}
            onChange={setRole}
            options={[
              { value: 'desk', label: 'Front desk' },
              { value: 'barber', label: 'Barber' },
            ]}
          />
        </div>
        <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <PasswordField
          label="First password"
          hint="At least 10 characters. Tell them in person, not by chat."
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <DialogButtons busy={busy} label="Add staff" onClose={onClose} />
      </form>
    </Dialog>
  )
}

function EditDialog({ member, branches, onClose, onDone }: { member: StaffMember; branches: Branch[]; onClose: () => void; onDone: () => void }) {
  const [fullName, setFullName] = useState(member.full_name)
  const [branchId, setBranchId] = useState(member.branch_id ?? '')
  const { busy, error, run } = useSubmit()

  return (
    <Dialog open title={`Edit ${member.full_name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await api.updateStaff(member.id, fullName.trim(), branchId || null)
            onDone()
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        {member.role !== 'owner' && (
          <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
        <p className="text-[13px] text-ink-3">
          {roleName[member.role]} · {member.email}
        </p>
        <DialogButtons busy={busy} label="Save" onClose={onClose} />
      </form>
    </Dialog>
  )
}

function PasswordDialog({ member, onClose, onDone }: { member: StaffMember; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const { busy, error, run } = useSubmit()

  return (
    <Dialog open title={`New password for ${member.full_name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await api.setStaffPassword(member.id, password)
            onDone()
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <PasswordField label="New password" hint="At least 10 characters." autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <DialogButtons busy={busy} label="Set password" onClose={onClose} />
      </form>
    </Dialog>
  )
}
