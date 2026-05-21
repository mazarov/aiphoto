/**
 * Социальное доказательство в духе imageprompt.org — вымышленные имена и рерайт отзывов.
 */
const ITEMS = [
  {
    name: "Maya K.",
    role: "Brand designer",
    quote:
      "I stopped screenshotting Pinterest into Notes. The overlay hands me vocabulary I would’ve forgotten—lighting, texture, palette—in one pass.",
  },
  {
    name: "Jonas P.",
    role: "Indie game artist",
    quote:
      "My first draft prompts used to be ‘cinematic, 8k, detailed.’ Now I start from what the reference actually does with color and composition.",
  },
  {
    name: "Elena V.",
    role: "Photographer",
    quote:
      "The structured breakdown reads like a shot list. I tweak two chips, paste into my generator, and I’m already closer than hours of trial and error.",
  },
  {
    name: "Chris L.",
    role: "Creative director",
    quote:
      "We share references in Slack all day. Image to Prompt is the fastest way to turn a link into language the team can reuse across tools.",
  },
  {
    name: "Amira H.",
    role: "Content lead",
    quote:
      "It’s not magic—it still needs judgment—but it cut our ‘almost right’ loops way down for campaign visuals.",
  },
  {
    name: "Tom W.",
    role: "Hobbyist",
    quote:
      "Free tier is enough to learn how prompts map to what I see. When I need more runs, pricing is clear.",
  },
];

export function ExtensionStvTestimonials() {
  return (
    <section className="border-t border-white/[0.06] py-12 sm:py-14" aria-labelledby="extension-stv-testimonials-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2
          id="extension-stv-testimonials-heading"
          className="text-center text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl"
        >
          What our users say
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-500">
          Short notes from people who live in reference boards, mood films, and iteration-heavy AI workflows.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:mt-12">
          {ITEMS.map((item) => (
            <li
              key={item.name}
              className="flex flex-col rounded-xl border border-white/[0.08] bg-[rgb(24_24_27/0.4)] p-5 text-left"
            >
              <p className="text-sm leading-relaxed text-zinc-300">&ldquo;{item.quote}&rdquo;</p>
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <p className="text-sm font-semibold text-zinc-100">{item.name}</p>
                <p className="text-xs text-zinc-500">{item.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
