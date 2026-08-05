import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type {
  PdfCustomItem,
  PdfFieldDisplay,
  PdfFieldEntry,
  PdfMappingConfig,
  PdfTheme,
} from "@/lib/forms/pdf-mapping-types";
import { DEFAULT_PDF_FOOTER } from "@/lib/forms/pdf-mapping-types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 48;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 52;

const WSU_CRIMSON = rgb(152 / 255, 30 / 255, 50 / 255);
const INK = rgb(35 / 255, 31 / 255, 32 / 255);
const MUTED = rgb(90 / 255, 90 / 255, 90 / 255);
const BORDER = rgb(210 / 255, 210 / 255, 210 / 255);
const STONE = rgb(245 / 255, 243 / 255, 240 / 255);
const WHITE = rgb(1, 1, 1);

export class PdfMappingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PdfMappingError";
    this.status = status;
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split(/\n/).map((p) => p.trimEnd());
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            const trial = chunk + ch;
            if (font.widthOfTextAtSize(trial, size) <= maxWidth) chunk = trial;
            else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

type DrawFonts = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
};

type RichRun = { text: string; bold: boolean; italic: boolean; underline: boolean };
type RichBlock = {
  type: "p" | "h" | "li";
  ordered?: boolean;
  index?: number;
  runs: RichRun[];
};
type LaidLine = {
  runs: RichRun[];
  size: number;
  indent: number;
  bullet: string;
  gapAfter: number;
};

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
  apos: "'",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith("#")) {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? "";
  });
}

function parseRichHtml(html: string): RichBlock[] {
  const source = String(html ?? "").trim();
  if (!source) return [];
  if (!/<[a-z][\s\S]*>/i.test(source)) {
    return [{ type: "p", runs: [{ text: decodeHtmlEntities(source), bold: false, italic: false, underline: false }] }];
  }

  const blocks: RichBlock[] = [];
  let current: RichBlock = { type: "p", runs: [] };
  let bold = false;
  let italic = false;
  let underline = false;
  let listOrdered = false;
  let liIndex = 0;

  const flush = () => {
    if (current.runs.some((run) => run.text.replace(/\s+/g, "").length > 0)) {
      blocks.push(current);
    }
    current = { type: "p", runs: [] };
  };

  const pushText = (raw: string) => {
    const text = decodeHtmlEntities(raw.replace(/\s+/g, " "));
    if (!text) return;
    const last = current.runs[current.runs.length - 1];
    if (last && last.bold === bold && last.italic === italic && last.underline === underline) {
      last.text += text;
      return;
    }
    current.runs.push({ text, bold, italic, underline });
  };

  const tokenRe = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(source))) {
    if (match[3]) {
      pushText(match[3]);
      continue;
    }
    const tag = match[1].toLowerCase();
    const closing = match[0].startsWith("</");
    if (tag === "br") {
      pushText("\n");
      continue;
    }
    if (tag === "strong" || tag === "b") {
      bold = !closing;
      continue;
    }
    if (tag === "em" || tag === "i") {
      italic = !closing;
      continue;
    }
    if (tag === "u") {
      underline = !closing;
      continue;
    }
    if (tag === "p" || tag === "div" || tag === "h1" || tag === "h2" || tag === "h3") {
      flush();
      if (!closing) current = { type: tag.startsWith("h") ? "h" : "p", runs: [] };
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      flush();
      if (!closing) {
        listOrdered = tag === "ol";
        liIndex = 0;
      }
      continue;
    }
    if (tag === "li") {
      flush();
      if (!closing) {
        liIndex += 1;
        current = { type: "li", ordered: listOrdered, index: liIndex, runs: [] };
      }
    }
  }
  flush();
  return blocks;
}

function pickFont(fonts: DrawFonts, run: Pick<RichRun, "bold" | "italic">, defaultBold = false): PDFFont {
  const bold = run.bold || defaultBold;
  if (bold && run.italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
}

function wrapRichRuns(
  runs: RichRun[],
  fonts: DrawFonts,
  size: number,
  maxWidth: number,
  defaultBold = false,
): RichRun[][] {
  const lines: RichRun[][] = [];
  let line: RichRun[] = [];
  let lineWidth = 0;

  const pushRun = (run: RichRun) => {
    const last = line[line.length - 1];
    if (last && last.bold === run.bold && last.italic === run.italic && last.underline === run.underline) {
      last.text += run.text;
      return;
    }
    line.push({ ...run });
  };

  const flushLine = () => {
    if (line.length) lines.push(line);
    line = [];
    lineWidth = 0;
  };

  const appendToken = (token: string, style: Omit<RichRun, "text">) => {
    if (!token) return;
    const font = pickFont(fonts, style, defaultBold);
    const width = font.widthOfTextAtSize(token, size);
    if (lineWidth + width > maxWidth && line.length) flushLine();
    if (font.widthOfTextAtSize(token, size) <= maxWidth || !token.trim()) {
      pushRun({ text: token, ...style });
      lineWidth += font.widthOfTextAtSize(token, size);
      return;
    }
    let chunk = "";
    for (const ch of token) {
      const trial = chunk + ch;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        chunk = trial;
        continue;
      }
      if (chunk) {
        pushRun({ text: chunk, ...style });
        flushLine();
      }
      chunk = ch;
    }
    if (chunk) {
      pushRun({ text: chunk, ...style });
      lineWidth += font.widthOfTextAtSize(chunk, size);
    }
  };

  for (const run of runs) {
    for (const part of run.text.split(/(\n)/)) {
      if (part === "\n") {
        flushLine();
        continue;
      }
      for (const token of part.split(/(\s+)/)) {
        appendToken(token, { bold: run.bold, italic: run.italic, underline: run.underline });
      }
    }
  }
  flushLine();
  return lines.filter((row) => row.some((run) => run.text.length > 0));
}

function layoutRichHtml(
  html: string,
  fonts: DrawFonts,
  maxWidth: number,
  size: number,
  defaultBold = false,
  options?: { uppercase?: boolean; trailing?: string; lineGap?: number; paragraphGap?: number },
): { lines: LaidLine[]; height: number } {
  const lineGap = options?.lineGap ?? 3;
  const paragraphGap = options?.paragraphGap ?? 4;
  const lines: LaidLine[] = [];
  const blocks = parseRichHtml(html);
  for (const block of blocks) {
    let runs = block.runs.map((run) => ({ ...run }));
    if (options?.uppercase) {
      runs = runs.map((run) => ({ ...run, text: run.text.toUpperCase() }));
    }
    if (options?.trailing) {
      const joined = runs.map((run) => run.text).join("");
      if (joined && !joined.trimEnd().endsWith(options.trailing)) {
        const last = runs[runs.length - 1];
        if (last) last.text = `${last.text.replace(/:$/, "")}${options.trailing}`;
      }
    }
    const blockSize = block.type === "h" ? size + 1 : size;
    const indent = block.type === "li" ? 14 : 0;
    const bullet = block.type === "li" ? (block.ordered ? `${block.index ?? 1}. ` : "• ") : "";
    const wrapped = wrapRichRuns(runs, fonts, blockSize, Math.max(40, maxWidth - indent), defaultBold || block.type === "h");
    wrapped.forEach((row, index) => {
      lines.push({
        runs: row,
        size: blockSize,
        indent,
        bullet: index === 0 ? bullet : "",
        gapAfter: index === wrapped.length - 1 ? paragraphGap : lineGap,
      });
    });
  }
  const height = lines.reduce((sum, line) => sum + line.size + line.gapAfter, 0);
  return { lines, height };
}

function drawLaidLine(
  page: PDFPage,
  fonts: DrawFonts,
  line: LaidLine,
  x: number,
  y: number,
  color: ReturnType<typeof rgb>,
  defaultBold = false,
): void {
  let drawX = x + line.indent;
  if (line.bullet) {
    page.drawText(line.bullet, { x, y, size: line.size, font: fonts.bold, color });
    drawX = x + fonts.bold.widthOfTextAtSize(line.bullet, line.size);
  }
  for (const run of line.runs) {
    if (!run.text) continue;
    const font = pickFont(fonts, run, defaultBold);
    page.drawText(run.text, { x: drawX, y, size: line.size, font, color });
    const width = font.widthOfTextAtSize(run.text, line.size);
    if (run.underline && run.text.trim()) {
      page.drawLine({
        start: { x: drawX, y: y - 1.5 },
        end: { x: drawX + width, y: y - 1.5 },
        thickness: 0.6,
        color,
      });
    }
    drawX += width;
  }
}

function drawLaidOut(
  page: PDFPage,
  fonts: DrawFonts,
  layout: { lines: LaidLine[] },
  x: number,
  startY: number,
  color: ReturnType<typeof rgb>,
  defaultBold = false,
): number {
  let y = startY;
  for (const line of layout.lines) {
    drawLaidLine(page, fonts, line, x, y, color, defaultBold);
    y -= line.size + line.gapAfter;
  }
  return y;
}

function drawRichFlow(
  ctx: DrawCtx,
  html: string,
  x: number,
  maxWidth: number,
  size: number,
  color: ReturnType<typeof rgb>,
  defaultBold = false,
  options?: { uppercase?: boolean; trailing?: string; lineGap?: number; paragraphGap?: number },
): void {
  const layout = layoutRichHtml(html, ctxFonts(ctx), maxWidth, size, defaultBold, options);
  for (const line of layout.lines) {
    const step = line.size + line.gapAfter;
    ensureSpace(ctx, step + 2);
    drawLaidLine(ctx.page, ctxFonts(ctx), line, x, ctx.y, color, defaultBold);
    ctx.y -= step;
  }
}

type ThemeColors = {
  accent: typeof WSU_CRIMSON | typeof MUTED;
  ink: typeof INK;
  muted: typeof MUTED;
  border: typeof BORDER;
  box: typeof STONE | typeof WHITE;
};

function themeColors(theme: PdfTheme): ThemeColors {
  if (theme === "simple" || theme === "official") {
    return { accent: MUTED, ink: INK, muted: MUTED, border: rgb(0.55, 0.55, 0.55), box: WHITE };
  }
  return { accent: WSU_CRIMSON, ink: INK, muted: MUTED, border: BORDER, box: STONE };
}

type DrawCtx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;
  fontBoldItalic: PDFFont;
  colors: ThemeColors;
  compact: boolean;
  showBar: boolean;
  official: boolean;
  watermark: boolean;
  defaultDisplay: PdfFieldDisplay;
};

function ctxFonts(ctx: DrawCtx): DrawFonts {
  return {
    regular: ctx.font,
    bold: ctx.fontBold,
    italic: ctx.fontItalic,
    boldItalic: ctx.fontBoldItalic,
  };
}

function contentWidth() {
  return PAGE_WIDTH - MARGIN_X * 2;
}

function drawDraftWatermark(page: PDFPage, font: PDFFont): void {
  page.drawText("DRAFT", {
    x: 72,
    y: 220,
    size: 88,
    font,
    color: rgb(0.82, 0.82, 0.82),
    rotate: degrees(38),
    opacity: 0.35,
  });
}

function pageTop(ctx: DrawCtx): number {
  return PAGE_HEIGHT - MARGIN_TOP - (ctx.showBar ? 8 : 0);
}

function ensureSpace(ctx: DrawCtx, needed: number): void {
  const maxBlock = pageTop(ctx) - MARGIN_BOTTOM;
  const required = Math.min(Math.max(needed, 0), maxBlock);
  if (ctx.y - required >= MARGIN_BOTTOM) return;
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  if (ctx.watermark) drawDraftWatermark(ctx.page, ctx.fontBold);
  if (ctx.showBar) {
    ctx.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 6,
      width: PAGE_WIDTH,
      height: 6,
      color: ctx.colors.accent,
    });
  }
  ctx.y = pageTop(ctx);
}

async function embedLogo(doc: PDFDocument, logoSrc?: string | null): Promise<PDFImage | null> {
  if (!logoSrc?.trim()) return null;
  try {
    let bytes: Uint8Array;
    if (logoSrc.startsWith("data:")) {
      const comma = logoSrc.indexOf(",");
      if (comma < 0) return null;
      bytes = Buffer.from(logoSrc.slice(comma + 1), "base64");
    } else if (/^https?:\/\//i.test(logoSrc)) {
      const res = await fetch(logoSrc);
      if (!res.ok) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      return null;
    }
    const lower = logoSrc.toLowerCase();
    if (lower.includes("image/png") || lower.endsWith(".png")) {
      return await doc.embedPng(bytes);
    }
    return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function fieldDisplayParts(ctx: DrawCtx, entry: PdfFieldEntry) {
  const display = entry.display || ctx.defaultDisplay;
  const labelSize = ctx.compact ? 9 : ctx.official ? 10 : 10;
  const valueSize = ctx.compact ? 10 : 11;
  const rawLabel = stripHtml(entry.label) || entry.columnTitle || "Field";
  const label = ctx.official ? rawLabel.replace(/:$/, "").toUpperCase() : rawLabel;
  const value = formatPdfCellValue(entry.value);
  return { display, labelSize, valueSize, label, value };
}

/** True when a field can sit in a half-width column without colliding with its neighbor. */
function fitsTwoColumn(ctx: DrawCtx, entry: PdfFieldEntry, colWidth: number): boolean {
  const { display, labelSize, valueSize, label, value } = fieldDisplayParts(ctx, entry);
  if (display === "inline") {
    const prefixWidth = ctx.fontBold.widthOfTextAtSize(`${label}: `, labelSize);
    return prefixWidth + 56 <= colWidth;
  }
  if (display === "underline") {
    const valueWidth = ctx.font.widthOfTextAtSize(value || "", valueSize);
    const labelWidth = ctx.font.widthOfTextAtSize(label, 7);
    return valueWidth <= colWidth && labelWidth <= colWidth;
  }
  return ctx.fontBold.widthOfTextAtSize(label, labelSize) <= colWidth;
}

function estimateFieldHeight(ctx: DrawCtx, entry: PdfFieldEntry, width: number): number {
  const { display, labelSize, valueSize, label, value } = fieldDisplayParts(ctx, entry);
  if (display === "inline") {
    const prefix = `${label}: `;
    const prefixWidth = ctx.fontBold.widthOfTextAtSize(prefix, labelSize);
    const lineGap = ctx.compact ? 12 : 13;
    const pad = ctx.compact ? 4 : 6;
    if (prefixWidth > width - 56) {
      const labelLines = wrapLines(prefix, ctx.fontBold, labelSize, width);
      const valueLines = wrapLines(value || " ", ctx.font, valueSize, width);
      return (labelLines.length + Math.max(valueLines.length, 1)) * lineGap + pad;
    }
    const valueLines = wrapLines(value || " ", ctx.font, valueSize, Math.max(40, width - prefixWidth));
    return Math.max(valueLines.length, 1) * lineGap + pad;
  }
  if (display === "underline") {
    const valueLines = wrapLines(value || "", ctx.font, valueSize, width);
    const labelLines = wrapLines(label, ctx.font, 7, width);
    const lineGap = ctx.compact ? 14 : 16;
    return Math.max(valueLines.length, 1) * lineGap + 12 + Math.max(labelLines.length, 1) * 10 + (ctx.compact ? 4 : 8);
  }
  const valueLines = wrapLines(value || "—", ctx.font, valueSize, width - 16);
  const labelLines = wrapLines(label, ctx.fontBold, labelSize, width);
  const lineGap = ctx.compact ? 12 : 14;
  const boxHeight = Math.max(ctx.compact ? 22 : 28, valueLines.length * lineGap + (ctx.compact ? 10 : 14));
  return labelLines.length * (labelSize + 2) + 4 + boxHeight + (ctx.compact ? 10 : 14);
}

function drawFieldBlock(
  ctx: DrawCtx,
  entry: PdfFieldEntry,
  x: number,
  width: number,
): number {
  const { display, labelSize, valueSize, label, value } = fieldDisplayParts(ctx, entry);
  const top = ctx.y;

  if (display === "inline") {
    const prefix = `${label}: `;
    const prefixWidth = ctx.fontBold.widthOfTextAtSize(prefix, labelSize);
    const lineGap = ctx.compact ? 12 : 13;
    const stackLabel = prefixWidth > width - 56;

    if (stackLabel) {
      const labelLines = wrapLines(prefix, ctx.fontBold, labelSize, width);
      const valueLines = wrapLines(value || " ", ctx.font, valueSize, width);
      for (const line of labelLines) {
        ensureSpace(ctx, lineGap + 2);
        ctx.page.drawText(line, { x, y: ctx.y, size: labelSize, font: ctx.fontBold, color: ctx.colors.ink });
        ctx.y -= lineGap;
      }
      for (const line of valueLines) {
        ensureSpace(ctx, lineGap + 2);
        ctx.page.drawText(line, { x, y: ctx.y, size: valueSize, font: ctx.font, color: ctx.colors.ink });
        ctx.y -= lineGap;
      }
      ctx.y -= ctx.compact ? 4 : 6;
      return top - ctx.y;
    }

    const valueLines = wrapLines(value || " ", ctx.font, valueSize, Math.max(40, width - prefixWidth));
    ensureSpace(ctx, lineGap + 2);
    ctx.page.drawText(prefix, {
      x,
      y: ctx.y,
      size: labelSize,
      font: ctx.fontBold,
      color: ctx.colors.ink,
    });
    ctx.page.drawText(valueLines[0] ?? "", {
      x: x + prefixWidth,
      y: ctx.y,
      size: valueSize,
      font: ctx.font,
      color: ctx.colors.ink,
    });
    ctx.y -= lineGap;
    for (const line of valueLines.slice(1)) {
      ensureSpace(ctx, lineGap + 2);
      ctx.page.drawText(line, {
        x: x + prefixWidth,
        y: ctx.y,
        size: valueSize,
        font: ctx.font,
        color: ctx.colors.ink,
      });
      ctx.y -= lineGap;
    }
    ctx.y -= ctx.compact ? 4 : 6;
    return top - ctx.y;
  }

  if (display === "underline") {
    const valueLines = wrapLines(value || "", ctx.font, valueSize, width);
    const lineGap = ctx.compact ? 14 : 16;
    if (valueLines.length) {
      for (const line of valueLines) {
        ensureSpace(ctx, lineGap + 14);
        ctx.page.drawText(line, {
          x,
          y: ctx.y,
          size: valueSize,
          font: ctx.font,
          color: ctx.colors.ink,
        });
        ctx.y -= lineGap;
      }
      ctx.y += lineGap;
    } else {
      ensureSpace(ctx, lineGap + 14);
    }
    ctx.page.drawLine({
      start: { x, y: ctx.y - 3 },
      end: { x: x + width, y: ctx.y - 3 },
      thickness: 0.8,
      color: ctx.colors.ink,
    });
    ctx.y -= 12;
    const labelLines = wrapLines(label, ctx.font, 7, width);
    for (const line of labelLines) {
      ensureSpace(ctx, 12);
      ctx.page.drawText(line, {
        x,
        y: ctx.y,
        size: 7,
        font: ctx.font,
        color: ctx.colors.muted,
      });
      ctx.y -= 10;
    }
    ctx.y -= ctx.compact ? 4 : 8;
    return top - ctx.y;
  }

  const valueLines = wrapLines(value || "—", ctx.font, valueSize, width - 16);
  const labelLines = wrapLines(label, ctx.fontBold, labelSize, width);
  const lineGap = ctx.compact ? 12 : 14;
  const padTop = ctx.compact ? 8 : 10;
  const padBottom = ctx.compact ? 10 : 14;
  const minBox = ctx.compact ? 22 : 28;

  for (const line of labelLines) {
    ensureSpace(ctx, labelSize + 8);
    ctx.page.drawText(line, {
      x,
      y: ctx.y,
      size: labelSize,
      font: ctx.fontBold,
      color: ctx.colors.ink,
    });
    ctx.y -= labelSize + 2;
  }
  ctx.y -= 4;

  let idx = 0;
  while (idx < valueLines.length) {
    ensureSpace(ctx, minBox + padBottom + 4);
    const availableForBox = ctx.y - MARGIN_BOTTOM - padBottom;
    const usable = Math.max(minBox, availableForBox);
    const maxLinesHere = Math.max(1, Math.floor((usable - 8) / lineGap));
    const linesHere = Math.min(valueLines.length - idx, maxLinesHere);
    const boxHeight = Math.min(Math.max(minBox, linesHere * lineGap + (ctx.compact ? 10 : 14)), usable);

    ctx.page.drawRectangle({
      x,
      y: ctx.y - boxHeight + padTop,
      width,
      height: boxHeight,
      color: ctx.colors.box,
      borderColor: ctx.colors.border,
      borderWidth: 1,
    });

    let textY = ctx.y - 2;
    for (let k = 0; k < linesHere; k++) {
      ctx.page.drawText(valueLines[idx + k]!, {
        x: x + 8,
        y: textY - 4,
        size: valueSize,
        font: ctx.font,
        color: ctx.colors.ink,
      });
      textY -= lineGap;
    }
    ctx.y -= boxHeight + padBottom;
    idx += linesHere;
  }
  return top - ctx.y;
}

export async function buildSubmissionPdf(options: {
  formTitle: string;
  formDescription?: string;
  sheetName?: string;
  entries: PdfFieldEntry[];
  config?: PdfMappingConfig;
  logoSrc?: string | null;
}): Promise<Uint8Array> {
  const config = options.config;
  const theme = config?.theme ?? "official";
  const official = theme === "official";
  const colors = themeColors(theme);
  const compact = config?.density === "compact" || official;
  const showBar = config?.showCrimsonBar === true || (!official && config?.showCrimsonBar !== false && theme === "wsu");
  const twoColumn = config?.layout === "twoColumn" || (official && config?.layout !== "stacked");
  const footerText = (config?.footerText || DEFAULT_PDF_FOOTER).trim();
  const showFooter = config?.showFooter !== false;
  const showWatermark = config?.showDraftWatermark === true || (official && config?.showDraftWatermark !== false);
  const defaultDisplay: PdfFieldDisplay =
    config?.fieldStyle ?? (official ? "inline" : "boxed");

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  if (showWatermark) drawDraftWatermark(page, fontBold);
  if (showBar) {
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 6,
      width: PAGE_WIDTH,
      height: 6,
      color: colors.accent,
    });
  }

  const ctx: DrawCtx = {
    doc,
    page,
    y: PAGE_HEIGHT - MARGIN_TOP - (showBar ? 8 : 0),
    font,
    fontBold,
    fontItalic,
    fontBoldItalic,
    colors,
    compact,
    showBar,
    official,
    watermark: showWatermark,
    defaultDisplay,
  };

  const titleHtml =
    (config?.title || options.formTitle || options.sheetName || "Form submission").trim() || "Form submission";
  const titleSize = official ? 13 : compact ? 15 : 18;
  const titleWidth = official ? contentWidth() * 0.68 : contentWidth();
  const titleLayout = layoutRichHtml(titleHtml, ctxFonts(ctx), titleWidth, titleSize, true, {
    lineGap: 3,
    paragraphGap: 4,
  });
  const logo = config?.showLogo !== false ? await embedLogo(doc, options.logoSrc) : null;
  let logoH = 0;
  let logoW = 0;
  if (logo) {
    const maxH = official ? 42 : compact ? 28 : 36;
    const scale = Math.min(maxH / logo.height, (official ? 150 : 180) / logo.width);
    logoW = logo.width * scale;
    logoH = logo.height * scale;
  }

  const headerHeight = Math.max(titleLayout.height || titleSize, logoH) + 8;
  ensureSpace(ctx, headerHeight);
  const headerTop = ctx.y;
  drawLaidOut(ctx.page, ctxFonts(ctx), titleLayout, MARGIN_X, headerTop, colors.ink, true);
  if (logo) {
    ctx.page.drawImage(logo, {
      x: PAGE_WIDTH - MARGIN_X - logoW,
      y: headerTop - logoH + titleSize,
      width: logoW,
      height: logoH,
    });
  }
  ctx.y = headerTop - Math.max(titleLayout.height || titleSize, logoH) - (official ? 8 : 10);

  const banner = stripHtml(config?.bannerText || "");
  if (banner) {
    const bannerSize = 9;
    const bannerLines = wrapLines(banner, fontBold, bannerSize, contentWidth());
    for (const line of bannerLines) {
      ensureSpace(ctx, 14);
      ctx.page.drawText(line, { x: MARGIN_X, y: ctx.y, size: bannerSize, font: fontBold, color: colors.ink });
      ctx.y -= 12;
    }
    ctx.y -= 6;
  }

  const descriptionHtml = (config?.description || options.formDescription || "").trim();
  if (descriptionHtml && stripHtml(descriptionHtml)) {
    ctx.y -= 4;
    const descSize = compact ? 9 : 10;
    drawRichFlow(ctx, descriptionHtml, MARGIN_X, contentWidth(), descSize, colors.ink, false, {
      lineGap: 4,
      paragraphGap: 6,
    });
  }

  if (!official) {
    ctx.y -= compact ? 8 : 10;
    ensureSpace(ctx, 16);
    ctx.page.drawText("Submitted responses", {
      x: MARGIN_X,
      y: ctx.y,
      size: 9,
      font: fontBold,
      color: colors.muted,
    });
    ctx.y -= compact ? 14 : 18;
  } else {
    ctx.y -= 10;
  }

  const gap = 16;
  const colWidth = (contentWidth() - gap) / 2;

  let i = 0;
  while (i < options.entries.length) {
    const entry = options.entries[i]!;
    const kind = entry.kind ?? "field";

    if (kind === "divider") {
      ensureSpace(ctx, 16);
      ctx.page.drawLine({
        start: { x: MARGIN_X, y: ctx.y },
        end: { x: MARGIN_X + contentWidth(), y: ctx.y },
        thickness: 1,
        color: colors.border,
      });
      ctx.y -= 16;
      i += 1;
      continue;
    }

    if (kind === "heading" || kind === "description") {
      const html = (entry.value || entry.label || "").trim();
      if (!html || !stripHtml(html)) {
        i += 1;
        continue;
      }
      const size = kind === "heading" ? (official ? 11 : compact ? 11 : 13) : compact ? 9 : 10;
      const color = kind === "heading" ? colors.ink : official ? colors.ink : colors.muted;
      ctx.y -= 4;
      drawRichFlow(ctx, html, MARGIN_X, contentWidth(), size, color, kind === "heading", {
        uppercase: official && kind === "heading",
        trailing: official && kind === "heading" ? ":" : undefined,
        lineGap: 5,
        paragraphGap: 6,
      });
      ctx.y -= 4;
      i += 1;
      continue;
    }

    if (twoColumn) {
      const next = options.entries[i + 1];
      const nextIsField = Boolean(next && (next.kind ?? "field") === "field");
      const leftFits = fitsTwoColumn(ctx, entry, colWidth);
      const rightFits = nextIsField && next ? fitsTwoColumn(ctx, next, colWidth) : false;
      if (nextIsField && next && leftFits && rightFits) {
        const pairHeight = Math.max(
          estimateFieldHeight(ctx, entry, colWidth),
          estimateFieldHeight(ctx, next, colWidth),
        );
        // Keep short pairs together. Tall boxed fields continue on this page
        // instead of leaving a large empty region before the next page.
        ensureSpace(ctx, pairHeight <= 72 ? pairHeight : 44);
        const startPage = ctx.page;
        const startY = ctx.y;
        drawFieldBlock(ctx, entry, MARGIN_X, colWidth);
        const leftBottom = ctx.y;
        const leftPage = ctx.page;
        ctx.page = startPage;
        ctx.y = startY;
        drawFieldBlock(ctx, next, MARGIN_X + colWidth + gap, colWidth);
        const pages = ctx.doc.getPages();
        const leftIdx = pages.indexOf(leftPage);
        const rightIdx = pages.indexOf(ctx.page);
        if (leftIdx > rightIdx) {
          ctx.page = leftPage;
          ctx.y = leftBottom;
        } else if (leftIdx === rightIdx) {
          ctx.y = Math.min(leftBottom, ctx.y);
        }
        i += 2;
        continue;
      }
    }

    drawFieldBlock(ctx, entry, MARGIN_X, contentWidth());
    i += 1;
  }

  if (showFooter && footerText) {
    const pages = doc.getPages();
    for (const p of pages) {
      if (official) {
        const footerLines = wrapLines(footerText, fontBold, 8, contentWidth());
        let fy = 24 + (footerLines.length - 1) * 11;
        for (const line of footerLines) {
          p.drawText(line, { x: MARGIN_X, y: fy, size: 8, font: fontBold, color: colors.ink });
          fy -= 11;
        }
      } else {
        const footerLines = wrapLines(footerText, font, 8, contentWidth());
        let fy = 24 + (footerLines.length - 1) * 10;
        for (const line of footerLines) {
          p.drawText(line, { x: MARGIN_X, y: fy, size: 8, font, color: colors.muted });
          fy -= 10;
        }
      }
    }
  }

  return doc.save();
}

export function filterEntriesByInclude(
  entries: PdfFieldEntry[],
  includeColumns: string[] | null | undefined,
): PdfFieldEntry[] {
  if (!includeColumns || includeColumns.length === 0) return entries;
  const allow = new Set(includeColumns.map((t) => t.toLowerCase()));
  return entries.filter((e) => {
    if (e.kind && e.kind !== "field") return true;
    return allow.has(e.columnTitle.toLowerCase());
  });
}

export function applyPdfCustomization(
  baseEntries: PdfFieldEntry[],
  config: PdfMappingConfig,
): PdfFieldEntry[] {
  const labels = config.fieldLabels ?? {};

  if (config.items && config.items.length > 0) {
    const byTitle = new Map(
      baseEntries
        .filter((e) => !e.kind || e.kind === "field")
        .map((e) => [e.columnTitle.toLowerCase(), e] as const),
    );
    const out: PdfFieldEntry[] = [];
    for (const item of config.items) {
      if (item.kind === "field") {
        if (!item.included) continue;
        const base = byTitle.get(item.columnTitle.toLowerCase());
        if (!base) continue;
        out.push({
          ...base,
          label: item.label?.trim() || labels[item.columnTitle]?.trim() || base.label,
          display: item.display || base.display,
        });
        continue;
      }
      if (item.kind === "heading" || item.kind === "description") {
        out.push({
          kind: item.kind,
          label: item.text,
          columnTitle: item.id,
          value: item.text,
        });
        continue;
      }
      out.push({ kind: "divider", label: "", columnTitle: item.id, value: "" });
    }
    return out;
  }

  return filterEntriesByInclude(baseEntries, config.includeColumns).map((entry) => {
    if (entry.kind && entry.kind !== "field") return entry;
    const custom = labels[entry.columnTitle]?.trim();
    return custom ? { ...entry, label: custom } : entry;
  });
}

export function seedPdfItemsFromColumns(
  columnTitles: string[],
  fieldLabels?: Record<string, string>,
): PdfCustomItem[] {
  return columnTitles.map((columnTitle) => ({
    id: `field:${columnTitle}`,
    kind: "field" as const,
    columnTitle,
    label: fieldLabels?.[columnTitle],
    included: true,
  }));
}

export async function fillPdfFromRow(
  _bytes: Uint8Array | Buffer,
  mapping: PdfMappingConfig,
  valuesByColumnTitle: Record<string, string>,
): Promise<Uint8Array> {
  const entries: PdfFieldEntry[] = Object.entries(valuesByColumnTitle).map(([columnTitle, value]) => ({
    label: mapping.fieldLabels?.[columnTitle] || columnTitle,
    columnTitle,
    value,
  }));
  return buildSubmissionPdf({
    formTitle: mapping.title || mapping.outputFileName.replace(/\.pdf$/i, "") || "Form submission",
    formDescription: mapping.description,
    entries: applyPdfCustomization(entries, mapping),
    config: mapping,
  });
}

export async function listPdfFields(): Promise<never> {
  throw new PdfMappingError(
    "Template PDF upload is no longer used. Generate the PDF from form columns instead.",
  );
}

export function valuesByColumnFromPairs(
  pairs: Array<{ columnTitle: string; value: unknown }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const title = String(pair.columnTitle ?? "").trim();
    if (!title) continue;
    out[title] = formatPdfCellValue(pair.value);
  }
  return out;
}

export function formatPdfCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "true") return "Yes";
    if (t === "false") return "No";
    return t;
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatPdfCellValue(v)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.email === "string" || typeof obj.name === "string") {
      const name = String(obj.name ?? "").trim();
      const email = String(obj.email ?? "").trim();
      if (name && email) return `${name} <${email}>`;
      return name || email;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
}
