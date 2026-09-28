export type GeneraciyaSeoImageMode = "current" | "src1080" | "single512" | "both";

export type GeneraciyaSeoFrameImage = {
  bucket: string;
  path: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
};

/** Present only on the first-screen frames of the 25 /generaciya URLs. */
export type GeneraciyaSeoFrame = {
  mode: GeneraciyaSeoImageMode;
  /** null keeps the existing alt builder. "" is an intentional empty alt. */
  alts: string[] | null;
  linkLabel: string | null;
  images: GeneraciyaSeoFrameImage[];
};
