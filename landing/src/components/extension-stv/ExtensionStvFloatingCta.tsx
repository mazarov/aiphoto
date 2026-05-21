import { STV_CHROME_STORE_URL, STV_FOCUS_RING } from "./stv-marketing-shared";

export function ExtensionStvFloatingCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:pb-[max(2rem,env(safe-area-inset-bottom))]">
      <a
        href={STV_CHROME_STORE_URL}
        className={`pointer-events-auto inline-flex items-center justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_14px_rgba(99,102,241,0.5)] ring-1 ring-inset ring-white/20 transition hover:bg-indigo-600 hover:shadow-[0_12px_40px_rgba(0,0,0,0.55),0_4px_18px_rgba(99,102,241,0.55)] ${STV_FOCUS_RING}`}
      >
        Add to Chrome
      </a>
    </div>
  );
}
