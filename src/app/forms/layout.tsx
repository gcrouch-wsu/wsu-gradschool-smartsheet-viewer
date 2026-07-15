import { FormsLayoutClient } from "@/components/forms/layout/FormsLayoutClient";
import "./forms.css";

export default function FormsLayout({ children }: { children: React.ReactNode }) {
  return <FormsLayoutClient>{children}</FormsLayoutClient>;
}
