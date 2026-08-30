/** Цветная иконка Chrome — три сектора 120° и синий центр, как у браузера. */
export function ChromeMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#fff" />
      <path fill="#EA4335" d="M24 24H2A22 22 0 0 1 35 4.95Z" />
      <path fill="#FBBC05" d="M24 24L35 4.95A22 22 0 0 1 35 43.05Z" />
      <path fill="#34A853" d="M24 24L35 43.05A22 22 0 0 1 2 24Z" />
      <circle cx="24" cy="24" r="9.5" fill="#fff" />
      <circle cx="24" cy="24" r="7.25" fill="#4285F4" />
    </svg>
  );
}
