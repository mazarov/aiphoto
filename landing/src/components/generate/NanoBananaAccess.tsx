import { GoogleGenerationModelIcon } from "@/components/generate/GenerationModelIcon";
import {
  GF_BLOCK,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import { NANO_BANANA_ACCESS_ITEMS } from "@/lib/nano-banana-seo-copy";

export function NanoBananaAccess() {
  return (
    <section
      className="scroll-mt-20"
      aria-labelledby="nano-banana-russia-heading"
    >
      <div className={GF_BLOCK}>
        <p className={`inline-flex items-center gap-1.5 ${GF_EYEBROW}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white ring-1 ring-indigo-100">
            <GoogleGenerationModelIcon className="h-3.5 w-3.5" />
          </span>
          Доступ к Google Gemini
        </p>
        <h2
          id="nano-banana-russia-heading"
          className={`mt-2 ${GF_H2}`}
        >
          Nano Banana в России
        </h2>
        <p className={GF_LEAD}>
          AI Studio из РФ не открывается? На PromptShot модели Nano Banana
          работают без VPN.
        </p>

        <ul className={`${GF_STACK} grid gap-3 sm:grid-cols-2`}>
          {NANO_BANANA_ACCESS_ITEMS.map((item) => (
            <li key={item.title} className={`p-5 ${GF_SURFACE}`}>
              <h3 className="text-base font-semibold text-zinc-900">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
