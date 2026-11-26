import { Link } from 'react-router'

/**
 * The mark: a serif T on indigo black, an amber hairline frame and a small
 * amber diamond, like a razor maker's stamp. Same drawing as public/favicon.svg.
 * Fixed colors on purpose, so it looks the same in both themes.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="15" fill="#0b0a14" />
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#d6a54e" strokeOpacity=".5" strokeWidth="1.5" />
      <path
        fill="#ece5d6"
        d="M17 14h30v9.5h-1.2c-.6-3.1-2.2-4.5-5.2-4.5h-5.7v22.2c0 1.4.7 2 2.3 2.3l1.8.3V46H25v-2.2l1.8-.3c1.6-.3 2.3-.9 2.3-2.3V19h-5.7c-3 0-4.6 1.4-5.2 4.5H17z"
      />
      <path fill="#d6a54e" d="m32 49.5 2.5 2.5-2.5 2.5-2.5-2.5z" />
    </svg>
  )
}

export function Logo() {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2.5 rounded-full" aria-label="Trimmed, home">
      <LogoMark size={32} />
      {/* a touch smaller on the narrowest phones so the header buttons still fit */}
      <span className="font-display text-[19px] font-medium tracking-[-0.01em] min-[360px]:text-[21px]">Trimmed</span>
    </Link>
  )
}
