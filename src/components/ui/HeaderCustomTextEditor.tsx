"use client";

import { useEditor, EditorContent, Extension } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import { useCallback, useEffect, useRef, useState } from "react";

/** Custom Font Size Extension */
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FONT_FAMILIES = [
  { label: "Default Font", value: "" },
  { label: "Serif", value: "serif" },
  { label: "Sans-Serif", value: "sans-serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Geist Sans", value: "var(--font-geist-sans)" },
  { label: "Geist Mono", value: "var(--font-geist-mono)" },
];

const FONT_SIZES = [
  { label: "Default Size", value: "" },
  { label: "10px", value: "10px" },
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "32px", value: "32px" },
  { label: "48px", value: "48px" },
];

// Icon helper components
function BoldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
  );
}

function ItalicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
  );
}

function UnderlineIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
  );
}

function StrikeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
  );
}

function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  );
}

function UnlinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18.84 12.71 2.12-2.12a5 5 0 0 0-7.07-7.07l-1.41 1.41"/><path d="M5.16 11.29 3.04 13.41a5 5 0 0 0 7.07 7.07l1.41-1.41"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
  );
}

function AlignLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
  );
}

function AlignRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
  );
}

function Heading1Icon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>
  );
}

function Heading2Icon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
  );
}

function ListIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  );
}

function ColorIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m19 6.12-.14-.13a8 8 0 0 0-11.44 0l-.14.13a8 8 0 0 0 0 11.44l.14.13a8 8 0 0 0 11.44 0l.14-.13a8 8 0 0 0 0-11.44Z"/><path d="m21 21-3.5-3.5"/><circle cx="12" cy="12" r="2"/></svg>
  );
}

export function HeaderCustomTextEditor({
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Smaller editor for titles / short headings. */
  compact?: boolean;
}) {
  const isInternalUpdate = useRef(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        blockquote: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Enter custom header instructions or text..." }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[color:var(--wsu-crimson)] underline cursor-pointer",
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: [
          "prose prose-sm max-w-none rounded-b-lg rounded-t-none border border-t-0 border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--wsu-crimson)]",
          compact ? "min-h-[4.5rem]" : "min-h-[150px]",
        ].join(" "),
      },
    },
    onUpdate: ({ editor }) => {
      if (isInternalUpdate.current) return;
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) return;
    const current = editor.getHTML();
    const normalized = value || "<p></p>";
    if (current !== normalized) {
      isInternalUpdate.current = true;
      editor.commands.setContent(normalized, { emitUpdate: false });
      isInternalUpdate.current = false;
    }
  }, [editor, value]);

  const openLinkMenu = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    setLinkUrl(previousUrl || "");
    setShowLinkInput(true);
  }, [editor]);

  const saveLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      let url = linkUrl;
      if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/") && !url.startsWith("mailto:")) {
        url = `https://${url}`;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 px-2 py-1.5">
        <div className="flex items-center gap-1 border-r border-[color:var(--wsu-border)] pr-1.5 mr-1">
          <select
            className="rounded border border-[color:var(--wsu-border)] bg-white px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-[color:var(--wsu-crimson)] min-w-[80px]"
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().setFontFamily(e.target.value).run();
              } else {
                editor.chain().focus().unsetFontFamily().run();
              }
            }}
            value={editor.getAttributes("textStyle").fontFamily || ""}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.label} value={f.value}>{f.label}</option>
            ))}
          </select>

          <select
            className="rounded border border-[color:var(--wsu-border)] bg-white px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-[color:var(--wsu-crimson)] w-[70px]"
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().setFontSize(e.target.value).run();
              } else {
                editor.chain().focus().unsetFontSize().run();
              }
            }}
            value={editor.getAttributes("textStyle").fontSize || ""}
          >
            {FONT_SIZES.map((s) => (
              <option key={s.label} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-0.5 border-r border-[color:var(--wsu-border)] pr-1.5 mr-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1Icon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2Icon />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-0.5 border-r border-[color:var(--wsu-border)] pr-1.5 mr-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <ItalicIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough"
          >
            <StrikeIcon />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-0.5 border-r border-[color:var(--wsu-border)] pr-1.5 mr-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            title="Align Left"
          >
            <AlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            title="Align Center"
          >
            <AlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            title="Align Right"
          >
            <AlignRightIcon />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-0.5 border-r border-[color:var(--wsu-border)] pr-1.5 mr-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <ListIcon />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-0.5 border-r border-[color:var(--wsu-border)] pr-1.5 mr-1">
          <div className="relative">
            <ToolbarButton
              onClick={openLinkMenu}
              active={editor.isActive("link") || showLinkInput}
              title="Add/Edit Link"
            >
              <LinkIcon />
            </ToolbarButton>
            
            {showLinkInput && (
              <div className="absolute left-0 top-full z-50 mt-1 flex items-center gap-1 rounded-lg border border-[color:var(--wsu-border)] bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-150">
                <input
                  autoFocus
                  type="url"
                  placeholder="Paste URL..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveLink()}
                  className="w-48 rounded border border-[color:var(--wsu-border)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--wsu-crimson)]"
                />
                <button
                  onClick={saveLink}
                  className="flex h-6 w-6 items-center justify-center rounded bg-[color:var(--wsu-crimson)] text-white hover:bg-[color:var(--wsu-crimson-dark)]"
                >
                  <CheckIcon />
                </button>
                <button
                  onClick={() => setShowLinkInput(false)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-[color:var(--wsu-border)] text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)]/30"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
            )}
          </div>
          
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={!editor.isActive("link")}
            title="Remove Link"
          >
            <UnlinkIcon />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => {
              const color = window.prompt("Color (hex or name)", "#a60f2d");
              if (color) editor.chain().focus().setColor(color).run();
            }}
            active={editor.isActive("textStyle", { color: true })}
            title="Text Color"
          >
            <ColorIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            active={editor.isActive("highlight")}
            title="Highlight"
          >
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-yellow-200 text-[8px] font-bold text-black">H</div>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              editor.chain()
                .focus()
                .unsetAllMarks()
                .clearNodes()
                .unsetColor()
                .unsetHighlight()
                .unsetFontFamily()
                .unsetFontSize()
                .run();
            }}
            title="Clear All Styles"
          >
            <span className="text-[10px] font-bold">CLR</span>
          </ToolbarButton>
        </div>
      </div>

      <EditorContent editor={editor} />

      <p className="text-[10px] font-medium text-[color:var(--wsu-muted)] italic">
        Highlight text to see inline formatting. Use the toolbar for headings, alignment, and colors.
      </p>
    </div>
  );
}

function ToolbarButton({ 
  children, 
  onClick, 
  active = false, 
  disabled = false, 
  title 
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  active?: boolean; 
  disabled?: boolean;
  title: string;
}) {
  return (
    <div className="group relative inline-block">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex h-7 w-7 items-center justify-center rounded transition hover:bg-white/60 ${
          active ? "bg-white/80 text-[color:var(--wsu-crimson)] shadow-sm" : "text-[color:var(--wsu-ink)]"
        } disabled:opacity-30`}
      >
        {children}
      </button>
      
      {/* CSS-only Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        {title}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
}
