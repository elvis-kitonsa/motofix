import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// cn = "class names". A tiny helper used all over the app to combine Tailwind CSS
// classes, including conditional ones, and intelligently resolve conflicts (e.g. if
// two classes both set padding, the last one wins). Example:
//   cn("p-2", isActive && "bg-red-500", "p-4")  →  "bg-red-500 p-4"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
