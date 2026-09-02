"use client";

import { useEffect } from "react";
import { returnFromRobokassaCheckout } from "@/lib/robokassa-return-browser";

export function RobokassaReturnScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  useEffect(() => {
    returnFromRobokassaCheckout();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-zinc-950">{title}</h1>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
        <button
          type="button"
          onClick={() => returnFromRobokassaCheckout()}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white"
        >
          Вернуться в PromptShot
        </button>
      </div>
    </main>
  );
}
