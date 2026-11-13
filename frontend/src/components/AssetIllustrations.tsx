import * as React from 'react'

export type IllustrationType =
  | 'laptop'
  | 'monitor'
  | 'tablet'
  | 'hydraulic press'
  | 'cnc mill'
  | 'chiller'
  | 'delivery van'
  | 'desk'
  | 'bearing'
  | 'label printer'
  | 'handheld scanner'
  | 'box'

export function matchIllustrationKey(name?: string, category?: string): IllustrationType {
  const text = `${name || ''} ${category || ''}`.toLowerCase()
  if (text.includes('laptop') || text.includes('macbook') || text.includes('notebook') || text.includes('thinkpad')) {
    return 'laptop'
  }
  if (text.includes('monitor') || text.includes('ultrasharp') || text.includes('display') || text.includes('screen')) {
    return 'monitor'
  }
  if (text.includes('tablet') || text.includes('ipad') || text.includes('galaxy tab')) {
    return 'tablet'
  }
  if (text.includes('press') || text.includes('hydraulic')) {
    return 'hydraulic press'
  }
  if (text.includes('cnc') || text.includes('mill') || text.includes('vmc') || text.includes('lathe')) {
    return 'cnc mill'
  }
  if (text.includes('chiller') || text.includes('hvac') || text.includes('cooling') || text.includes('50 tr')) {
    return 'chiller'
  }
  if (text.includes('van') || text.includes('tata') || text.includes('truck') || text.includes('vehicle') || text.includes('delivery')) {
    return 'delivery van'
  }
  if (text.includes('desk') || text.includes('chair') || text.includes('godrej') || text.includes('table') || text.includes('furniture')) {
    return 'desk'
  }
  if (text.includes('bearing') || text.includes('skf') || text.includes('ball bearing') || text.includes('roller')) {
    return 'bearing'
  }
  if (text.includes('printer') || text.includes('label') || text.includes('zebra')) {
    return 'label printer'
  }
  if (text.includes('scanner') || text.includes('handheld') || text.includes('barcode') || text.includes('honeywell')) {
    return 'handheld scanner'
  }
  return 'box'
}

interface AssetIllustrationProps {
  name?: string
  category?: string
  photoUrl?: string
  alt?: string
  width?: number | string
  height?: number | string
  className?: string
}

export const AssetIllustration: React.FC<AssetIllustrationProps> = ({
  name = '',
  category = '',
  photoUrl,
  alt,
  width = 120,
  height = 90,
  className = '',
}) => {
  const label = alt || `${name || 'Asset'} illustration`

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={label}
        style={{
          width,
          height,
          objectFit: 'cover',
          borderRadius: 8,
          border: '1px solid var(--line)',
        }}
        className={className}
      />
    )
  }

  const type = matchIllustrationKey(name, category)

  return (
    <svg
      viewBox="0 0 120 90"
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className={className}
      style={{
        borderRadius: 8,
        flexShrink: 0,
        display: 'block',
        background: 'var(--acc2)',
      }}
    >
      <rect width="120" height="90" rx="8" fill="var(--acc2)" />

      {type === 'laptop' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="28" y="24" width="64" height="42" rx="4" fill="var(--surf)" />
          <rect x="34" y="29" width="52" height="30" rx="2" fill="var(--acc2)" opacity="0.4" />
          <path d="M18 70h84a4 4 0 0 1 4 4v1H14v-1a4 4 0 0 1 4-4Z" fill="var(--surf)" />
          <line x1="52" y1="71" x2="68" y2="71" strokeWidth="2" />
        </g>
      )}

      {type === 'monitor' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="22" y="16" width="76" height="48" rx="4" fill="var(--surf)" />
          <rect x="28" y="22" width="64" height="36" rx="2" fill="var(--acc2)" opacity="0.4" />
          <path d="M54 64v12M66 64v12M46 76h28" />
        </g>
      )}

      {type === 'tablet' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="34" y="14" width="52" height="64" rx="6" fill="var(--surf)" />
          <rect x="39" y="22" width="42" height="46" rx="2" fill="var(--acc2)" opacity="0.4" />
          <circle cx="60" cy="18" r="1.5" fill="var(--acc)" />
          <line x1="54" y1="73" x2="66" y2="73" />
        </g>
      )}

      {type === 'hydraulic press' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="28" y="14" width="64" height="62" rx="4" fill="var(--surf)" />
          <line x1="28" y1="28" x2="92" y2="28" />
          <line x1="28" y1="62" x2="92" y2="62" />
          <rect x="42" y="32" width="36" height="12" rx="2" fill="var(--acc)" fillOpacity="0.2" />
          <rect x="52" y="44" width="16" height="18" fill="var(--acc)" fillOpacity="0.4" />
          <circle cx="60" cy="21" r="3" fill="var(--acc)" />
        </g>
      )}

      {type === 'cnc mill' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="24" y="14" width="72" height="62" rx="5" fill="var(--surf)" />
          <rect x="32" y="22" width="40" height="36" rx="3" fill="var(--acc2)" opacity="0.5" />
          <rect x="76" y="24" width="14" height="28" rx="2" fill="var(--surf)" />
          <circle cx="83" cy="32" r="2" fill="var(--acc)" />
          <circle cx="83" cy="42" r="2" fill="var(--acc)" />
          <path d="M52 22v16l-4 4h8l-4-4" fill="var(--acc)" fillOpacity="0.3" />
          <line x1="32" y1="58" x2="72" y2="58" />
        </g>
      )}

      {type === 'chiller' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="26" y="18" width="68" height="54" rx="4" fill="var(--surf)" />
          <circle cx="48" cy="45" r="16" fill="var(--acc2)" opacity="0.4" />
          <line x1="48" y1="29" x2="48" y2="61" />
          <line x1="32" y1="45" x2="64" y2="45" />
          <line x1="72" y1="28" x2="86" y2="28" />
          <line x1="72" y1="36" x2="86" y2="36" />
          <line x1="72" y1="44" x2="86" y2="44" />
          <line x1="72" y1="52" x2="86" y2="52" />
        </g>
      )}

      {type === 'delivery van' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 54V28a3 3 0 0 1 3-3h46v34l18-2 9 8v9a3 3 0 0 1-3 3H86" fill="var(--surf)" />
          <path d="M69 32h14l8 12h-22V32Z" fill="var(--acc2)" opacity="0.4" />
          <circle cx="38" cy="68" r="7" fill="var(--surf)" />
          <circle cx="38" cy="68" r="3" fill="var(--acc)" />
          <circle cx="78" cy="68" r="7" fill="var(--surf)" />
          <circle cx="78" cy="68" r="3" fill="var(--acc)" />
          <line x1="20" y1="68" x2="31" y2="68" />
          <line x1="45" y1="68" x2="71" y2="68" />
        </g>
      )}

      {type === 'desk' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="22" y="32" width="76" height="8" rx="2" fill="var(--surf)" />
          <line x1="28" y1="40" x2="28" y2="72" />
          <line x1="92" y1="40" x2="92" y2="72" />
          <rect x="68" y="40" width="22" height="24" rx="2" fill="var(--surf)" />
          <line x1="74" y1="48" x2="84" y2="48" />
          <line x1="74" y1="56" x2="84" y2="56" />
        </g>
      )}

      {type === 'bearing' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx="60" cy="45" r="26" fill="var(--surf)" />
          <circle cx="60" cy="45" r="14" fill="var(--acc2)" opacity="0.5" />
          <circle cx="60" cy="45" r="7" fill="var(--acc)" />
          <circle cx="60" cy="25" r="3.5" fill="var(--acc)" />
          <circle cx="60" cy="65" r="3.5" fill="var(--acc)" />
          <circle cx="40" cy="45" r="3.5" fill="var(--acc)" />
          <circle cx="80" cy="45" r="3.5" fill="var(--acc)" />
        </g>
      )}

      {type === 'label printer' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="28" y="32" width="64" height="38" rx="5" fill="var(--surf)" />
          <rect x="36" y="20" width="48" height="12" rx="2" fill="var(--surf)" />
          <line x1="40" y1="46" x2="80" y2="46" strokeWidth="3" />
          <rect x="44" y="48" width="32" height="14" rx="1" fill="var(--acc2)" />
          <circle cx="82" cy="60" r="2" fill="var(--ok)" />
        </g>
      )}

      {type === 'handheld scanner' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M42 22h36l-8 22H50l-8-22Z" fill="var(--surf)" />
          <rect x="52" y="44" width="16" height="30" rx="3" fill="var(--surf)" />
          <line x1="50" y1="46" x2="44" y2="52" strokeWidth="3" />
          <line x1="42" y1="18" x2="78" y2="18" stroke="var(--bad)" strokeDasharray="3 2" />
        </g>
      )}

      {type === 'box' && (
        <g stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <polygon points="60,20 92,34 60,48 28,34" fill="var(--surf)" />
          <polygon points="28,34 60,48 60,74 28,60" fill="var(--acc2)" opacity="0.6" />
          <polygon points="92,34 60,48 60,74 92,60" fill="var(--surf)" />
          <line x1="60" y1="48" x2="60" y2="74" />
        </g>
      )}
    </svg>
  )
}
