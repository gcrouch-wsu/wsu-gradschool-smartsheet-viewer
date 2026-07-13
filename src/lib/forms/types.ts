export interface SmartsheetColumn {
  id: number;
  title: string;
  type: string;
  options?: string[];
  validation?: boolean;
  primary?: boolean;
  systemColumnType?: string;
}

export interface SmartsheetRow {
  id: number;
  rowNumber?: number;
  createdAt?: string;
  modifiedAt?: string;
  cells?: { columnId: number; value?: string | boolean; displayValue?: string }[];
}

export interface Attachment {
  id: number;
  name: string;
  attachmentType?: string;
  mimeType?: string;
  sizeInKb?: number;
  url?: string;
  urlExpiresInMillis?: number;
}

export interface DiscussionComment {
  id: number;
  text: string;
  createdAt?: string;
  createdBy?: { name?: string; email?: string };
}

export interface Discussion {
  id: number;
  title?: string;
  comments?: DiscussionComment[];
}

export interface Share {
  id: string;
  type: string;
  email?: string;
  name?: string;
  accessLevel: string;
}

export interface Workspace {
  id: number;
  name: string;
  permalink?: string;
}

export interface FolderItem {
  id: number;
  name: string;
  type: "sheet" | "folder" | "report" | "sight" | string;
}

export interface PathNode {
  id: number;
  name: string;
  type: string;
}

export interface SearchResult {
  objectId: number;
  objectType: string;
  text: string;
  parentObjectName?: string;
}

export interface WebhookEvent {
  id: number;
  objectType: string;
  eventType: string;
  objectId: number;
  userId?: number;
  timestamp?: string;
}

export interface SmartsheetUser {
  id: number;
  email: string;
  name: string;
  admin?: boolean;
}

export interface SmartsheetGroup {
  id: number;
  name: string;
}

export interface SmartsheetReport {
  id: number;
  name: string;
  permalink?: string;
}

export interface SmartsheetDashboard {
  id: number;
  name: string;
  permalink?: string;
}

export interface SmartsheetForm {
  id: number;
  name: string;
  url?: string;
  accessLevel?: string;
}

/**
 * A field-level show/hide rule, mirroring Smartsheet form conditional logic.
 * Columns are matched by their TITLE so the same rule file works across cloned sheets.
 */
export interface ConditionalRule {
  whenColumn: string;
  equals: string[];
  showColumns: string[];
}
