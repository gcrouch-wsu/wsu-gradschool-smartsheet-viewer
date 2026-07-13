import { FormsLayoutClient } from "@/components/forms/FormsLayoutClient";
import "./forms.css";

export default function FormsLayout({ children }: { children: React.ReactNode }) {
  return <FormsLayoutClient>{children}</FormsLayoutClient>;
}
