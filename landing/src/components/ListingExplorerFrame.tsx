import { type ReactNode } from "react";
import { LISTING_EXPLORER_FRAME_CLASS } from "@/lib/listing-explorer";

type Props = {
  children: ReactNode;
  id?: string;
  className?: string;
};

export function ListingExplorerFrame({ children, id, className }: Props) {
  return (
    <div
      id={id}
      className={`${LISTING_EXPLORER_FRAME_CLASS}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
