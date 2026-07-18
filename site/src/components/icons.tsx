type IconProps = { size?: number };

const base = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false" {...base}>
      <path d="M16.667 5L7.5 14.167 3.333 10" />
    </svg>
  );
}

export function DocumentIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-6Z" />
      <path d="M14 3v5a1 1 0 0 0 1 1h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

export function EditIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function TranslateIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <path d="M4 5h9M7.5 3v2M4 9c1.5 3 4 5 8 6M13 5c-1 4-4 8-9 10" />
      <path d="M14 21l4-9 4 9M15.3 18h5.4" />
    </svg>
  );
}

export function SummarizeIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <path d="M4 6h16M4 12h10M4 18h16" />
    </svg>
  );
}

export function ChatIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.3A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

export function CompareIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <path d="M8 3v18M16 3v18M4 8h4M16 8h4M4 16h4M16 16h4" />
    </svg>
  );
}

export function ShieldIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    </svg>
  );
}

export function WordIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l2 6 2-6 2 6 2-6" />
    </svg>
  );
}

export function MenuIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...base}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
