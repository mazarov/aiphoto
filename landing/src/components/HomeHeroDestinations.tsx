import Link from "next/link";
import type { ReactNode } from "react";

type Destination = {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
};

function ImageToPromptIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
      <path d="M14 3h7v7" />
    </svg>
  );
}

function TrendsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

function PhotoshootIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M8 5l1.5-2h5L16 5" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zinc-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function HomeHeroDestinations() {
  const items: Destination[] = [
    {
      href: "/foto-v-promt",
      title: "Фото в промт",
      description: "Загрузите картинку и получите текст онлайн",
      icon: <ImageToPromptIcon />,
    },
    {
      href: "/trends",
      title: "Трендовые промты",
      description: "Свежая лента идей для ИИ-фото",
      icon: <TrendsIcon />,
    },
    {
      href: "/generaciya-foto",
      title: "Сделать фото ИИ",
      description: "По описанию или своему снимку",
      icon: <GenerateIcon />,
    },
    {
      href: "/promty-dlya-ii-fotosessii",
      title: "Промты для ИИ фотосессии",
      description: "Серия образов, не один кадр",
      icon: <PhotoshootIcon />,
    },
  ];

  return (
    <nav
      aria-label="Инструменты PromptShot"
      className="mx-auto mt-6 w-full max-w-3xl text-left sm:mt-8"
    >
      <ul
        className={`grid gap-3 ${
          items.length >= 4
            ? "sm:grid-cols-2"
            : items.length >= 3
              ? "sm:grid-cols-3"
              : "sm:grid-cols-2"
        }`}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex h-full items-start gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm shadow-zinc-900/[0.03] backdrop-blur-sm transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-md hover:shadow-indigo-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-700">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 transition-colors group-hover:text-indigo-700">
                    {item.title}
                  </span>
                  <ArrowIcon />
                </span>
                <span className="mt-1.5 block text-sm leading-snug text-zinc-500">
                  {item.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
