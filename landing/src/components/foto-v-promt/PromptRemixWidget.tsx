"use client";

import { useCallback, useEffect, useState } from "react";
import { getAiImageDescriberChromeUrl, getPromptRemixUrl, FOTO_V_PROMT_ANALYZE_LOCALE } from "@/lib/foto-v-promt-config";
import { YM_GOAL_LEXYGPT_GENERATE_PHOTOVPROMPT } from "@/lib/yandex-metrika";
import { PROMPT_REMIX_COPY } from "@/lib/foto-v-promt-copy";
import { LexyGptGenerateButton } from "@/components/LexyGptGenerateButton";
import {
  FVP_BORDER_CARD,
  FVP_BORDER_INPUT,
  FVP_FOCUS_RING,
  FVP_SURFACE_WIDGET_INSET,
  FVP_SURFACE_WIDGET_OUTER,
} from "./foto-v-promt-tokens";

type CardState = "loading" | "ready" | "error";
type Panel = "input" | "loading" | "result" | "error";

type Props = { cardSlug: string };

export function PromptRemixWidget({ cardSlug }: Props) {
  const [cardState, setCardState] = useState<CardState>("loading");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [cardTitle, setCardTitle] = useState<string | null>(null);
  const [changeRequest, setChangeRequest] = useState("");
  const [panel, setPanel] = useState<Panel>("input");
  const [resultPrompt, setResultPrompt] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/card/${encodeURIComponent(cardSlug)}`);
        if (!res.ok) throw new Error("card_not_found");
        const json = (await res.json()) as { data?: { promptTexts?: string[]; title_ru?: string | null } };
        const texts = json.data?.promptTexts ?? [];
        if (!texts.length) throw new Error("no_prompts");
        if (cancelled) return;
        setOriginalPrompt(texts.join("\n\n"));
        setCardTitle(json.data?.title_ru ?? null);
        setCardState("ready");
      } catch {
        if (!cancelled) setCardState("error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [cardSlug]);

  const handleSubmit = useCallback(async () => {
    if (!changeRequest.trim() || panel === "loading") return;
    setPanel("loading");
    setErrorMessage("");

    try {
      const res = await fetch(getPromptRemixUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPrompt,
          changeRequest: changeRequest.trim(),
          style: "photoreal",
          locale: FOTO_V_PROMT_ANALYZE_LOCALE,
        }),
        credentials: "include",
      });

      let data: { prompt?: string; error?: string; message?: string };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setErrorMessage(PROMPT_REMIX_COPY.errorGeneric);
        setPanel("error");
        return;
      }

      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(data?.message || PROMPT_REMIX_COPY.errorRateLimited);
        } else {
          setErrorMessage(PROMPT_REMIX_COPY.errorGeneric);
        }
        setPanel("error");
        return;
      }

      if (!data?.prompt) {
        setErrorMessage(PROMPT_REMIX_COPY.errorGeneric);
        setPanel("error");
        return;
      }

      setResultPrompt(data.prompt);
      setPanel("result");
    } catch {
      setErrorMessage(PROMPT_REMIX_COPY.errorGeneric);
      setPanel("error");
    }
  }, [changeRequest, originalPrompt, panel]);

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const resetInput = () => {
    setChangeRequest("");
    setResultPrompt("");
    setErrorMessage("");
    setPanel("input");
  };

  return (
    <div
      className={`w-full max-w-3xl rounded-2xl ${FVP_BORDER_CARD} ${FVP_SURFACE_WIDGET_OUTER} p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-md shadow-zinc-200/60 sm:p-5`}
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
          {PROMPT_REMIX_COPY.title}
        </h2>
        {cardTitle ? (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{cardTitle}</p>
        ) : null}
        <p className="mt-1 text-sm text-zinc-600">{PROMPT_REMIX_COPY.subtitle}</p>
      </div>

      {/* Card loading / error */}
      {cardState === "loading" ? (
        <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
          {PROMPT_REMIX_COPY.loadingCard}
        </div>
      ) : cardState === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {PROMPT_REMIX_COPY.cardLoadError}
        </div>
      ) : (
        <>
          {/* Original prompt */}
          <div className="mb-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {PROMPT_REMIX_COPY.originalLabel}
            </div>
            <pre
              className={`max-h-36 min-h-0 overflow-auto whitespace-pre-wrap rounded-lg ${FVP_BORDER_CARD} ${FVP_SURFACE_WIDGET_INSET} p-3 text-xs leading-relaxed text-zinc-700 sm:text-sm`}
            >
              {originalPrompt}
            </pre>
          </div>

          {panel === "input" || panel === "loading" ? (
            <>
              {/* Change request */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {PROMPT_REMIX_COPY.changeLabel}
                </label>
                <textarea
                  value={changeRequest}
                  onChange={(e) => setChangeRequest(e.target.value)}
                  placeholder={PROMPT_REMIX_COPY.changePlaceholder}
                  rows={3}
                  disabled={panel === "loading"}
                  className={`w-full resize-none rounded-lg ${FVP_BORDER_INPUT} bg-white p-3 text-sm leading-relaxed text-zinc-800 placeholder-zinc-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60`}
                />
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!changeRequest.trim() || panel === "loading"}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${FVP_FOCUS_RING}`}
              >
                {panel === "loading" ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {PROMPT_REMIX_COPY.submitting}
                  </span>
                ) : (
                  PROMPT_REMIX_COPY.submit
                )}
              </button>
            </>
          ) : null}

          {panel === "result" ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {PROMPT_REMIX_COPY.resultLabel}
                </div>
                <pre
                  className={`max-h-[min(40vh,22rem)] min-h-0 overflow-auto whitespace-pre-wrap rounded-lg ${FVP_BORDER_CARD} bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800 sm:text-sm`}
                >
                  {resultPrompt}
                </pre>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void copyPrompt(resultPrompt)}
                  className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto sm:min-w-[10rem] ${FVP_FOCUS_RING}`}
                >
                  {PROMPT_REMIX_COPY.copy}
                </button>
                <LexyGptGenerateButton
                  promptText={resultPrompt}
                  variant="widget-md"
                  metricGoal={YM_GOAL_LEXYGPT_GENERATE_PHOTOVPROMPT}
                  idleLabel="Сгенерировать"
                />
                <button
                  type="button"
                  onClick={resetInput}
                  className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg px-5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 sm:w-auto sm:min-w-[10rem] ${FVP_BORDER_INPUT} ${FVP_FOCUS_RING}`}
                >
                  {PROMPT_REMIX_COPY.tryAgain}
                </button>
              </div>
            </div>
          ) : null}

          {panel === "error" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-red-600">
                {errorMessage || PROMPT_REMIX_COPY.errorGeneric}
              </p>
              <button
                type="button"
                onClick={() => setPanel("input")}
                className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto sm:min-w-[10rem] ${FVP_FOCUS_RING}`}
              >
                Попробовать ещё раз
              </button>
            </div>
          ) : null}

          {/* Extension install hint (shown when not in loading state) */}
          {panel !== "loading" ? (
            <p className="mt-5 border-t border-zinc-100 pt-4 text-center text-xs text-zinc-500">
              {PROMPT_REMIX_COPY.installHint}{" "}
              <a
                href={getAiImageDescriberChromeUrl("foto_v_promt_remix_hint")}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-medium text-indigo-600 underline-offset-2 hover:underline ${FVP_FOCUS_RING}`}
              >
                AI Image Describer для Chrome
              </a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
