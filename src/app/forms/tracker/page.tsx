import { redirect } from "next/navigation";

/** Tracker UI moved into Grid; keep this route as a redirect for old links. */
export default function TrackerPage() {
  redirect("/forms/sheet");
}
