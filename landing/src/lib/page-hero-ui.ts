export type HeroTileMode = "pin" | "remove";

export type HeroTileAction = {
  op: "pin" | "unpin";
  label: string;
  title: string;
  tone: "add" | "active" | "remove";
};

export function heroTileAction(input: { mode: HeroTileMode; pinned: boolean }): HeroTileAction {
  if (input.mode === "remove") {
    return {
      op: "unpin",
      label: "Убрать",
      title: "Убрать из шапки этой страницы",
      tone: "remove",
    };
  }
  if (input.pinned) {
    return {
      op: "unpin",
      label: "В шапке",
      title: "Убрать из шапки этой страницы",
      tone: "active",
    };
  }
  return {
    op: "pin",
    label: "В шапку",
    title: "Поставить первой в шапку этой страницы",
    tone: "add",
  };
}
