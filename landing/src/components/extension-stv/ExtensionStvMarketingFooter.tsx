import Link from "next/link";
import { STV_CHROME_STORE_URL, STV_FOCUS_RING } from "./stv-marketing-shared";

export function ExtensionStvMarketingFooter() {
  return (
    <footer className="bg-[#09090b] py-8">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <p className="text-sm font-semibold text-zinc-50">Image To Prompt</p>
        <p className="mx-auto mt-2 max-w-md text-xs text-zinc-500">
          PromptShot’s Chrome image-to-prompt assistant—turn browsing into structured AI image prompts you can refine
          anywhere.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-zinc-500">
          <Link href="/" className={`hover:text-zinc-300 ${STV_FOCUS_RING} rounded-sm`}>
            PromptShot home
          </Link>
          <Link href="/extension-stv/pricing" className={`hover:text-zinc-300 ${STV_FOCUS_RING} rounded-sm`}>
            Pricing
          </Link>
          <a href={STV_CHROME_STORE_URL} className={`hover:text-zinc-300 ${STV_FOCUS_RING} rounded-sm`}>
            Chrome Web Store
          </a>
          <Link href="/privacy" className={`hover:text-zinc-300 ${STV_FOCUS_RING} rounded-sm`}>
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
