import type { ReactNode } from "react";
import Link from "next/link";

/**
 * FAQ для /extension-stv — образовательные темы (роль промпта, состав, приватность)
 * в духе публичных лендингов про image-to-prompt, с рерайтом под PromptShot.
 */

const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: "What is an image prompt?",
    a: "It is the written brief you give an AI image model: who or what is in frame, where the scene happens, which stylistic lane you want, and how light and color should feel. The clearer that brief, the less guesswork the model needs.",
  },
  {
    q: "Why does prompt quality matter for AI photos?",
    a: "Models follow statistical patterns from your words. Vague language spreads probability across many looks; specific cues for camera, materials, and atmosphere narrow the distribution so outputs land nearer to the picture in your head.",
  },
  {
    q: "What should a strong prompt include?",
    a: "Most effective prompts blend a clear subject, environment or backdrop, palette or grading notes, lighting direction, lens or format hints when relevant, and stylistic references. Image To Prompt is built to surface those layers from a reference instead of asking you to invent them from memory.",
  },
  {
    q: "What does Image To Prompt do in the browser?",
    a: "It reads the reference image you are looking at and drafts structured language—light, palette, composition, texture, stylistic signals—so you copy a starting brief rather than a handful of generic adjectives.",
  },
  {
    q: "Where does the Chrome extension work?",
    a: "Any site where you can hover an image: inspiration grids, social feeds, editorials, shops, and galleries. Open the overlay on the frame you care about, then continue in PromptShot when you want the full extract → expand path or generation.",
  },
  {
    q: "Do I need a PromptShot account?",
    a: "Lightweight browsing and copying a draft may work without signing in. Running the full upload → extract → expand pipeline and on-site generation expects an active PromptShot session (cookies on promptshot.ru), matching the web panel experience.",
  },
  {
    q: "Can I paste the prompt into other AI image tools?",
    a: "Yes. Treat the text as a starting point. Different engines prefer different emphasis—some react strongly to camera tokens, others to painterly adjectives—so expect to tweak wording to match the generator you use.",
  },
  {
    q: "Do prompts behave the same in every AI image generator?",
    a: "The fundamentals overlap, but each platform has its own sensitivities: token limits, banned terms, and which descriptors move the needle. Image To Prompt gives you a rich baseline; fine-tune per tool the way you would adapt a creative brief for different studios.",
  },
  {
    q: "How does PromptShot handle privacy for uploads?",
    a: (
      <>
        The extension activates when you use it—there is no always-on scraping of every page. For what the site stores,
        how long media is retained, and third parties, read our{" "}
        <Link href="/privacy" className="text-indigo-300 underline-offset-2 hover:underline">
          Privacy
        </Link>{" "}
        policy and keep sensitive references off shared machines.
      </>
    ),
  },
  {
    q: "Will my output look identical to the reference?",
    a: "No honest tool promises a pixel-perfect clone. Model choice, seed, safety filters, and your own source photo all move the result. The goal here is a stronger first prompt so you spend fewer cycles chasing the same vibe.",
  },
];

export function ExtensionStvFaq() {
  return (
    <section className="py-12 sm:py-14" aria-labelledby="extension-stv-faq-heading">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2
          id="extension-stv-faq-heading"
          className="text-center text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl"
        >
          Frequently asked questions
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-500">
          Image prompts, Chrome workflow, and how PromptShot fits your AI art stack—plain-language answers.
        </p>

        <div className="mt-8 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-white/[0.08] bg-[rgb(24_24_27/0.35)] transition-colors open:border-indigo-500/25 open:bg-[rgb(24_24_27/0.5)] open:ring-1 open:ring-indigo-500/15"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-zinc-100 sm:text-[15px] [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span
                  className="shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="stroke-current">
                    <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-4 pt-0 text-sm leading-relaxed text-zinc-400 [&_a]:text-indigo-300 [&_a]:underline-offset-2 [&_a]:hover:underline">
                <div className="pt-2">{item.a}</div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
