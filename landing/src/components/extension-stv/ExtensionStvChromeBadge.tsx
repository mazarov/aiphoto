function ChromeMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5C13.2 9.5 4.3 18.4 4.5 29.3L15.1 26c-.2-3.4 2.6-6.1 6-6.1H24V9.5z" />
      <path fill="#4285F4" d="M43.5 29.3c.8-8.8-4.6-17-13-19.9v11.4c3.9.8 6.6 4.4 6 8.4l7 7.1z" />
      <path fill="#34A853" d="M24 44c5.2 0 10-2 13.5-5.5l-7.8-13.5c-1.5 1.5-3.5 2.4-5.7 2.4H15.1L4.5 29.3C6.8 38.7 14.9 44 24 44z" />
      <path fill="#FBBC05" d="M43.5 29.3h-13l-6.8 11.8C26.2 41.7 25.1 41 24 40v4c10.2 0 18.2-8.2 18.5-18.4l1 3.7z" />
      <circle cx="24" cy="24" r="7" fill="#fff" />
      <circle cx="24" cy="24" r="4.5" fill="#4285F4" />
    </svg>
  );
}

export function ExtensionStvChromeBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-300 ${className ?? ""}`}
    >
      <ChromeMark className="shrink-0" />
      Chrome extension
    </span>
  );
}
