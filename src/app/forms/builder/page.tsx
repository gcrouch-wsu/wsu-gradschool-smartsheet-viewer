"use client";

import { FormBuilderView } from "@/components/forms/builder/FormBuilderView";
import { FormsWorkspaceChrome } from "@/components/forms/layout/FormsWorkspaceChrome";

export default function FormsBuilderPage() {
  return (
    <FormsWorkspaceChrome>
      <FormBuilderView />
    </FormsWorkspaceChrome>
  );
}
