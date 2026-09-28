import { rename, rm } from "node:fs/promises";
import path from "node:path";

// Next.js 16 can persist generated files under .next/dev that interfere with production builds.
// Prefer deleting; if a running `next dev` locks the folder, rename it aside.
const devDir = path.join(process.cwd(), ".next", "dev");

try {
  await rm(devDir, { recursive: true, force: true });
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "ENOENT") {
    // nothing to clear
  } else if (code === "ENOTEMPTY" || code === "EPERM" || code === "EBUSY") {
    const stale = path.join(process.cwd(), ".next", `dev-stale-${Date.now()}`);
    try {
      await rename(devDir, stale);
    } catch {
      console.warn(
        "[prepare-build] Could not clear .next/dev (is `npm run dev` running?). Production typecheck excludes .next/dev via tsconfig.",
      );
    }
  } else {
    throw error;
  }
}
