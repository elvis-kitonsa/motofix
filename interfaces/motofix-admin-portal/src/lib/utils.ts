import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// cn = "class names". Combines Tailwind CSS classes (including conditional ones) and
// resolves conflicts so the last one wins. Used throughout the UI, e.g.
//   cn("p-2", isActive && "bg-primary", "p-4")  →  "bg-primary p-4"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
