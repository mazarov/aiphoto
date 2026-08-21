import { SECTION_SPEC_ORDER } from "@/lib/extension-prompt-sections";

export const REMIX_KNOWN_HEADINGS = [
  ...SECTION_SPEC_ORDER,
  "CRITICAL RULES",
] as const;

export type RemixAttemptMode = "section_edits" | "full_rewrite";

export type RemixSection = {
  heading: string | null;
  headingLine: string | null;
  body: string;
};

export type RemixEdit = {
  heading: string;
  body: string;
};

export type RemixModelPlan = {
  changeApplied: boolean;
  edits: RemixEdit[];
  prompt: string | null;
};

export type ResolvedRemixPrompt = {
  prompt: string;
  mode: RemixAttemptMode | "raw_text";
  changeApplied: boolean | null;
  appliedHeadings: string[];
  unknownHeadings: string[];
};

const HEADING_LINE_RE = /^([A-Za-z][A-Za-z0-9 /&-]{0,60}):\s*$/;

export const REMIX_EDITS_SYSTEM_INSTRUCTION = [
  "You are a precise editor of structured image-generation prompts.",
  "",
  "Apply CHANGE_REQUEST to SOURCE_PROMPT by rewriting only the affected sections.",
  "",
  "Return JSON:",
  '{ "changeApplied": true, "edits": [{ "heading": "Scene", "body": "full new section text without the heading line" }] }',
  "",
  "Rules:",
  "- CHANGE_REQUEST is the only editing instruction and has priority over conflicting source details.",
  "- Edit every section that would become inconsistent after the change, including Avoid and CRITICAL RULES when they contradict the request.",
  "- heading must match an existing SOURCE_SECTION_HEADINGS value.",
  "- body is the complete replacement for that section, without the heading line.",
  "- Do not return unchanged sections.",
  "- Do not return the full prompt.",
  "- Do not satisfy the request by appending a sentence or a final rule.",
  "- If CHANGE_REQUEST is already fully satisfied by SOURCE_PROMPT, return {\"changeApplied\": false, \"edits\": []}.",
  "- Never set changeApplied true while returning empty or no-op edits.",
].join("\n");

export const REMIX_REWRITE_SYSTEM_INSTRUCTION = [
  "You are a precise editor of image-generation prompts.",
  "",
  "Rewrite SOURCE_PROMPT using only CHANGE_REQUEST.",
  "",
  "Return JSON:",
  '{ "changeApplied": true, "prompt": "<complete final prompt>" }',
  "",
  "Rules:",
  "- CHANGE_REQUEST has priority over conflicting source details.",
  "- Integrate the change into every semantically affected sentence.",
  "- Do not append a sentence or a final rule.",
  "- Preserve every detail not affected by the change, including headings, language, names, numbers, camera settings, and negative constraints.",
  "- Keep the final prompt internally consistent and directly usable for image generation.",
  "- If SOURCE_PROMPT already fully satisfies CHANGE_REQUEST, return {\"changeApplied\": false, \"prompt\": \"\"}.",
  "- Never return a copy of SOURCE_PROMPT when changeApplied is true.",
].join("\n");

export const REMIX_EDITS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    changeApplied: { type: "BOOLEAN" },
    edits: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          heading: { type: "STRING" },
          body: { type: "STRING" },
        },
        required: ["heading", "body"],
      },
    },
  },
  required: ["changeApplied", "edits"],
} as const;

export const REMIX_REWRITE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    changeApplied: { type: "BOOLEAN" },
    prompt: { type: "STRING" },
  },
  required: ["changeApplied", "prompt"],
} as const;

export function normalizeRemixPrompt(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function remixPromptsEqual(left: string, right: string): boolean {
  return normalizeRemixPrompt(left) === normalizeRemixPrompt(right);
}

export function normalizeRemixHeading(value: string): string {
  return value.replace(/:$/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function headingFromLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const withColon = trimmed.match(HEADING_LINE_RE);
  if (withColon) return withColon[1];
  const known = REMIX_KNOWN_HEADINGS.find(
    (heading) => normalizeRemixHeading(heading) === normalizeRemixHeading(trimmed)
  );
  return known ?? null;
}

export function splitPromptSections(prompt: string): RemixSection[] {
  const lines = normalizeRemixPrompt(prompt).split("\n");
  const sections: RemixSection[] = [];
  let current: RemixSection = { heading: null, headingLine: null, body: "" };

  const flush = () => {
    const body = current.body.replace(/^\n+/, "").replace(/\n+$/, "");
    if (current.heading !== null || body) {
      sections.push({ ...current, body });
    }
  };

  for (const line of lines) {
    const heading = headingFromLine(line);
    if (heading) {
      flush();
      current = {
        heading,
        headingLine: line.trim(),
        body: "",
      };
      continue;
    }
    current.body = current.body ? `${current.body}\n${line}` : line;
  }
  flush();
  return sections;
}

export function joinPromptSections(sections: RemixSection[]): string {
  return sections
    .map((section) =>
      section.headingLine
        ? `${section.headingLine}\n${section.body}`
        : section.body
    )
    .filter((block) => block.trim().length > 0)
    .join("\n\n")
    .trim();
}

export function listRemixHeadings(prompt: string): string[] {
  return splitPromptSections(prompt)
    .map((section) => section.heading)
    .filter((heading): heading is string => Boolean(heading));
}

export function hasStructuredRemixSections(prompt: string): boolean {
  const known = new Set(REMIX_KNOWN_HEADINGS.map(normalizeRemixHeading));
  return splitPromptSections(prompt).some(
    (section) =>
      section.heading !== null && known.has(normalizeRemixHeading(section.heading))
  );
}

export function applyRemixEdits(
  source: string,
  edits: RemixEdit[]
): {
  prompt: string;
  appliedHeadings: string[];
  unknownHeadings: string[];
} {
  const sections = splitPromptSections(source);
  const indexByHeading = new Map<string, number>();
  sections.forEach((section, index) => {
    if (section.heading) {
      indexByHeading.set(normalizeRemixHeading(section.heading), index);
    }
  });

  const appliedHeadings: string[] = [];
  const unknownHeadings: string[] = [];

  for (const edit of edits) {
    const heading = String(edit.heading || "").trim();
    const body = normalizeRemixPrompt(String(edit.body || ""));
    if (!heading || !body) continue;
    const index = indexByHeading.get(normalizeRemixHeading(heading));
    if (index === undefined) {
      unknownHeadings.push(heading);
      continue;
    }
    const previous = sections[index];
    if (normalizeRemixPrompt(previous.body) === body) continue;
    sections[index] = { ...previous, body };
    appliedHeadings.push(previous.heading || heading);
  }

  if (appliedHeadings.length === 0) {
    return {
      prompt: normalizeRemixPrompt(source),
      appliedHeadings,
      unknownHeadings,
    };
  }

  return {
    prompt: joinPromptSections(sections),
    appliedHeadings,
    unknownHeadings,
  };
}

function stripJsonFences(value: string): string {
  return normalizeRemixPrompt(value)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseRemixModelJson(raw: string): RemixModelPlan | null {
  const text = stripJsonFences(raw);
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const edits = Array.isArray(record.edits)
    ? record.edits.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const edit = item as Record<string, unknown>;
        if (typeof edit.heading !== "string" || typeof edit.body !== "string") {
          return [];
        }
        return [{ heading: edit.heading.trim(), body: edit.body }];
      })
    : [];
  return {
    changeApplied: record.changeApplied === true,
    edits,
    prompt: typeof record.prompt === "string" ? record.prompt : null,
  };
}

export function resolveRemixPrompt(
  source: string,
  plan: RemixModelPlan | null,
  fallbackRawText: string
): ResolvedRemixPrompt {
  if (plan && plan.edits.length > 0) {
    const applied = applyRemixEdits(source, plan.edits);
    if (applied.appliedHeadings.length > 0) {
      return {
        prompt: applied.prompt,
        mode: "section_edits",
        changeApplied: plan.changeApplied,
        appliedHeadings: applied.appliedHeadings,
        unknownHeadings: applied.unknownHeadings,
      };
    }
    if (applied.unknownHeadings.length > 0 && !plan.prompt) {
      return {
        prompt: normalizeRemixPrompt(source),
        mode: "section_edits",
        changeApplied: false,
        appliedHeadings: [],
        unknownHeadings: applied.unknownHeadings,
      };
    }
  }

  const rewriteCandidate =
    plan?.prompt && !remixPromptsEqual(plan.prompt, source)
      ? normalizeRemixPrompt(plan.prompt)
      : "";
  if (rewriteCandidate) {
    return {
      prompt: rewriteCandidate,
      mode: "full_rewrite",
      changeApplied: plan?.changeApplied ?? true,
      appliedHeadings: [],
      unknownHeadings: [],
    };
  }

  const raw = normalizeRemixPrompt(fallbackRawText);
  return {
    prompt: raw,
    mode: "raw_text",
    changeApplied: plan?.changeApplied ?? null,
    appliedHeadings: [],
    unknownHeadings: [],
  };
}

export function buildRemixUserText(input: {
  originalPrompt: string;
  changeRequest: string;
  headings?: string[];
}): string {
  const lines = [
    "SOURCE_PROMPT:",
    "<source>",
    input.originalPrompt,
    "</source>",
    "",
    "CHANGE_REQUEST:",
    "<change>",
    input.changeRequest,
    "</change>",
  ];
  if (input.headings && input.headings.length > 0) {
    lines.push("", "SOURCE_SECTION_HEADINGS:", input.headings.join(", "));
  }
  return lines.join("\n");
}

export function remixSystemInstruction(mode: RemixAttemptMode): string {
  return mode === "section_edits"
    ? REMIX_EDITS_SYSTEM_INSTRUCTION
    : REMIX_REWRITE_SYSTEM_INSTRUCTION;
}

export function buildRemixGenerationConfig(
  mode: RemixAttemptMode,
  options?: { temperature?: number }
): {
  temperature: number;
  maxOutputTokens: number;
  responseMimeType: "application/json";
  responseSchema: typeof REMIX_EDITS_RESPONSE_SCHEMA | typeof REMIX_REWRITE_RESPONSE_SCHEMA;
  thinkingConfig: { thinkingBudget: number };
} {
  return {
    temperature: options?.temperature ?? (mode === "section_edits" ? 0.2 : 0.35),
    maxOutputTokens: mode === "section_edits" ? 4096 : 8192,
    responseMimeType: "application/json",
    responseSchema:
      mode === "section_edits"
        ? REMIX_EDITS_RESPONSE_SCHEMA
        : REMIX_REWRITE_RESPONSE_SCHEMA,
    thinkingConfig: {
      thinkingBudget: 256,
    },
  };
}
