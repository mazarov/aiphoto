import { HeaderClient } from "./HeaderClient";

type Props = {
  /** Pre-computed counts (from homepage sections). Skips ~80 RPC calls when provided. */
  counts?: Record<string, number>;
};

export async function Header({ counts: precomputedCounts }: Props = {}) {
  void precomputedCounts;
  return <HeaderClient />;
}
