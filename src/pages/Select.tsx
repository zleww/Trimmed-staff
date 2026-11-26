import type { SelectHTMLAttributes } from 'react'

/** A labelled dropdown that matches the text fields. */
export function Select({ label, children, ...rest }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium">{label}</span>
      <select className="h-12 w-full rounded-[10px] border border-line bg-card px-3 text-[16px] text-ink" {...rest}>
        {children}
      </select>
    </label>
  )
}
