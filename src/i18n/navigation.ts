import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation primitives. Use these everywhere instead of the
// bare next/link and next/navigation so locale and direction stay correct.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
