"use client";

import type { CSSProperties } from "react";
import { useOptionalCampusBadgeStyle } from "@/components/views/shared/CampusBadgeStyleContext";
import { useDisplayTimezone } from "@/components/views/shared/DisplayTimezoneContext";
import { useViewValueLinkFlags } from "@/components/views/shared/ViewValueLinkContext";
import type { ResolvedFieldValue } from "@/lib/config/types";
import { campusChipInlineStyle } from "@/lib/campus-chip-inline-style";
import { publicCoordinatorCampusBadgeLabel } from "@/lib/coordinator-campus-badge";
import { formatDateInDisplayTimeZone } from "@/lib/display-datetime";
import { fieldValueTypographyClass } from "@/lib/field-typography";

function tx(field: ResolvedFieldValue, ...classes: string[]) {
  const t = fieldValueTypographyClass(field);
  return [t, ...classes].filter(Boolean).join(" ");
}

function EmptyValue() {
  return <span className="text-[color:var(--wsu-border)]">-</span>;
}

function PersonSummary({
  name,
  email,
  phone,
  campusBadgeLabel,
  compact = false,
  plainValueLinks = false,
}: {
  name?: string;
  email?: string;
  phone?: string;
  /** Inline chip next to the name (approved campus only). */
  campusBadgeLabel?: string;
  compact?: boolean;
  plainValueLinks?: boolean;
}) {
  const { linkEmailsInView, linkPhonesInView } = useViewValueLinkFlags();
  const campusPresentation = useOptionalCampusBadgeStyle();
  const chipInline = campusChipInlineStyle(campusPresentation);
  const linkEmail = !plainValueLinks && linkEmailsInView;
  const linkPhone = !plainValueLinks && linkPhonesInView;
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;
  const detailClass = "view-people-detail view-field-link";
  /** Matches CampusBadgeStrip: custom radius can override rounded-full when inline style sets borderRadius. */
  const campusChipClass = chipInline
    ? "view-people-campus-chip ml-1 inline-block max-w-full align-middle rounded-full border px-2 py-0.5 text-[11px] font-medium leading-normal"
    : "view-people-campus-chip ml-1 inline-block max-w-full align-middle rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none";

  const nameTrimmed = name?.trim() ?? "";
  /** R5: never show a campus badge (or print suffix) unless there is a display name. */
  const showCampusBesideName = Boolean(campusBadgeLabel && nameTrimmed);
  const stackGap = compact ? "gap-0.5" : "gap-1";

  return (
    <div className={`flex min-w-0 flex-col ${stackGap}`}>
      {/* R5: campus chip/suffix only when nameTrimmed (see showCampusBesideName). */}
      {nameTrimmed ? (
        <span
          className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${compact ? "" : "max-w-full"}`}
        >
          <span className={`view-people-name ${compact ? "" : "min-w-0"}`}>{nameTrimmed}</span>
          {showCampusBesideName ? (
            plainValueLinks ? (
              <span className="text-xs font-normal text-[color:var(--wsu-muted)]">
                {" \u2014 "}
                {campusBadgeLabel}
              </span>
            ) : (
              <span className={campusChipClass} style={chipInline ?? undefined}>
                {campusBadgeLabel}
              </span>
            )
          ) : null}
        </span>
      ) : null}
      {email ? (
        <div className="min-w-0">
          {linkEmail ? (
            <a href={`mailto:${email}`} className={`${detailClass} block`}>
              {email}
            </a>
          ) : (
            <span className="view-people-detail block text-[color:var(--wsu-ink)]">{email}</span>
          )}
        </div>
      ) : null}
      {phone ? (
        <div className="min-w-0">
          {linkPhone ? (
            <a href={telHref} className={`${detailClass} block`}>
              {phone}
            </a>
          ) : (
            <span className="view-people-detail block text-[color:var(--wsu-ink)]">{phone}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function renderLinkList(field: ResolvedFieldValue, stacked: boolean, plainValueLinks: boolean) {
  if (field.links.length === 0) {
    return <EmptyValue />;
  }

  const useInline = field.listDisplay === "inline" && field.links.length > 1;
  const delimiter = field.listDelimiter ?? ", ";
  if (useInline) {
    return (
      <span className={tx(field, "leading-6 text-[color:var(--wsu-ink)]")}>
        {field.links.map((link, i) => (
          <span key={`${link.href}-${link.label}`}>
            {i > 0 && <span className="text-[color:var(--wsu-muted)]">{delimiter}</span>}
            {plainValueLinks ? (
              <span className="text-[color:var(--wsu-ink)]">{link.label}</span>
            ) : (
              <a
                href={link.href}
                className={`view-field-link ${fieldValueTypographyClass(field)}`}
                target={/^https?:\/\//i.test(link.href) ? "_blank" : undefined}
                rel={/^https?:\/\//i.test(link.href) ? "noreferrer" : undefined}
              >
                {link.label}
              </a>
            )}
          </span>
        ))}
      </span>
    );
  }

  if (stacked || field.listDisplay === "stacked" || field.links.length > 1) {
    return (
      <ul className={tx(field, "space-y-1")}>
        {field.links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            {plainValueLinks ? (
              <span className="text-[color:var(--wsu-ink)]">{link.label}</span>
            ) : (
              <a
                href={link.href}
                className={`view-field-link ${fieldValueTypographyClass(field)}`}
                target={/^https?:\/\//i.test(link.href) ? "_blank" : undefined}
                rel={/^https?:\/\//i.test(link.href) ? "noreferrer" : undefined}
              >
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    );
  }

  const link = field.links[0]!;
  if (plainValueLinks) {
    return <span className={tx(field, "leading-6 text-[color:var(--wsu-ink)]")}>{link.label}</span>;
  }
  return (
    <a
      href={link.href}
      className={tx(field, "view-field-link leading-6")}
      target={/^https?:\/\//i.test(link.href) ? "_blank" : undefined}
      rel={/^https?:\/\//i.test(link.href) ? "noreferrer" : undefined}
    >
      {link.label}
    </a>
  );
}

export function FieldValue({
  field,
  stacked = false,
  plainValueLinks = false,
}: {
  field: ResolvedFieldValue;
  stacked?: boolean;
  /** When true (e.g. print layout), show link labels as plain text — no anchors. */
  plainValueLinks?: boolean;
}) {
  const { timeZone } = useDisplayTimezone();

  if (field.renderType === "hidden") {
    return null;
  }

  // emptyBehavior: "hide" — in table layout, render nothing (not even the dash placeholder)
  // so the cell is visually empty rather than showing "-".
  if (field.hideWhenEmpty && field.isEmpty) {
    return null;
  }

  /** Zoned dates match public/print; plainValueLinks only strips anchors (mailto/url/tel), not date formatting. */
  const zoned = field.dateSourceRaw ? formatDateInDisplayTimeZone(field.dateSourceRaw, timeZone) : "";
  const primaryText = zoned.length > 0 ? zoned : field.textValue;

  if ((field.renderType === "mailto" || field.renderType === "mailto_list" || field.renderType === "phone" || field.renderType === "phone_list" || field.renderType === "link") && field.links.length > 0) {
    return renderLinkList(field, stacked || field.renderType.endsWith("_list"), plainValueLinks);
  }

  if ((field.renderType === "text" || field.renderType === "badge") && field.links.length > 0) {
    if (field.links.length === 1) {
      const link = field.links[0]!;
      const newTab = /^https?:\/\//i.test(link.href);
      const showText = Boolean(primaryText?.trim() && primaryText.trim() !== link.label.trim());
      return (
        <span className={tx(field, "leading-6 text-[color:var(--wsu-ink)]")}>
          {showText ? <>{primaryText} </> : null}
          {plainValueLinks ? (
            <span>{link.label}</span>
          ) : (
            <a
              href={link.href}
              className={tx(field, "view-field-link")}
              target={newTab ? "_blank" : undefined}
              rel={newTab ? "noreferrer" : undefined}
            >
              {link.label}
            </a>
          )}
        </span>
      );
    }
    return renderLinkList({ ...field, renderType: "link" }, stacked, plainValueLinks);
  }

  if (field.renderType === "list") {
    if (field.listValue.length === 0) {
      return <EmptyValue />;
    }
    const listDelimiter = field.listDelimiter ?? ", ";
    if (field.listDisplay === "inline") {
      return (
        <span className={tx(field, "leading-6 text-[color:var(--wsu-ink)]")}>
          {field.listValue.map((entry, i) => (
            <span key={entry}>
              {i > 0 && <span className="text-[color:var(--wsu-muted)]">{listDelimiter}</span>}
              {entry}
            </span>
          ))}
        </span>
      );
    }
    return (
      <ul className={tx(field, "space-y-1")}>
        {field.listValue.map((entry) => (
          <li key={entry} className="leading-6 text-[color:var(--wsu-ink)]">
            {entry}
          </li>
        ))}
      </ul>
    );
  }

  if (field.renderType === "people_group") {
    const populated = field.people?.filter((p) => !p.isEmpty) ?? [];
    if (populated.length > 0) {
      const displayMode = field.listDisplay === "stacked" ? "stacked" : "inline";
      const peopleStyle = field.peopleStyle === "capsule" ? "capsule" : "plain";
      if (displayMode === "inline") {
        return (
          <ul
            className={tx(
              field,
              peopleStyle === "capsule"
                ? "grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr))]"
                : "grid grid-cols-1 gap-3 sm:gap-x-6 sm:gap-y-3 sm:[grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr))]",
            )}
          >
            {populated.map((person) => (
              <li
                key={person.slot}
                className={peopleStyle === "capsule" ? "min-w-0 rounded-2xl border px-3 py-2 leading-6 text-[color:var(--wsu-ink)]" : "min-w-0 leading-6 text-[color:var(--wsu-ink)]"}
                style={
                  peopleStyle === "capsule"
                    ? {
                        borderColor: "var(--view-control-border, var(--wsu-border))",
                        backgroundColor: "color-mix(in srgb, var(--view-surface-muted-bg, var(--wsu-stone)) 32%, white)",
                      }
                    : undefined
                }
              >
                <div className="min-w-0">
                  <PersonSummary
                    name={person.name}
                    email={person.email}
                    phone={person.phone}
                    campusBadgeLabel={publicCoordinatorCampusBadgeLabel(person.campus)}
                    plainValueLinks={plainValueLinks}
                  />
                </div>
              </li>
            ))}
          </ul>
        );
      }

      return (
        <ul className={tx(field, peopleStyle === "capsule" ? "space-y-3" : "space-y-2")}>
          {populated.map((person) => (
            <li
              key={person.slot}
              className={peopleStyle === "capsule" ? "rounded-2xl border px-3 py-2 leading-6 text-[color:var(--wsu-ink)]" : "leading-6 text-[color:var(--wsu-ink)]"}
              style={
                peopleStyle === "capsule"
                  ? {
                      borderColor: "var(--view-control-border, var(--wsu-border))",
                      backgroundColor: "color-mix(in srgb, var(--view-surface-muted-bg, var(--wsu-stone)) 24%, white)",
                    }
                  : undefined
              }
            >
              <PersonSummary
                name={person.name}
                email={person.email}
                phone={person.phone}
                campusBadgeLabel={publicCoordinatorCampusBadgeLabel(person.campus)}
                plainValueLinks={plainValueLinks}
              />
            </li>
          ))}
        </ul>
      );
    }
    if (primaryText) {
      return <span className={tx(field, "leading-6 whitespace-pre-line text-[color:var(--wsu-ink)]")}>{primaryText}</span>;
    }
  }

  if (field.renderType === "multiline_text") {
    if (field.links.length > 0) {
      return (
        <div className={tx(field, "space-y-2")}>
          {primaryText ? (
            <p className={tx(field, "whitespace-pre-line leading-6 text-[color:var(--wsu-ink)]")}>{primaryText}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {field.links.map((link) => {
              const newTab = /^https?:\/\//i.test(link.href);
              return plainValueLinks ? (
                <span key={`${link.href}-${link.label}`} className="text-[color:var(--wsu-ink)]">
                  {link.label}
                </span>
              ) : (
                <a
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  className={tx(field, "view-field-link")}
                  target={newTab ? "_blank" : undefined}
                  rel={newTab ? "noreferrer" : undefined}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      );
    }
    return primaryText ? (
      <p className={tx(field, "whitespace-pre-line leading-6 text-[color:var(--wsu-ink)]")}>{primaryText}</p>
    ) : (
      <EmptyValue />
    );
  }

  if (field.renderType === "badge") {
    const chipClass = tx(
      field,
      "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
    );
    const chipStyle: CSSProperties = {
      borderColor: "var(--view-border, var(--wsu-border))",
      backgroundColor: "var(--view-badge-bg, #f3f4f6)",
      color: "var(--view-badge-text, #374151)",
    };
    const splitFromText =
      primaryText && primaryText.includes(";")
        ? primaryText
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const badgeEntries =
      field.listValue.length > 1 ? field.listValue : splitFromText.length > 1 ? splitFromText : null;
    if (badgeEntries) {
      return (
        <span className={tx(field, "inline-flex flex-wrap items-center gap-1.5")} role="group">
          {badgeEntries.map((entry, i) => (
            <span key={`${entry}-${i}`} className={chipClass} style={chipStyle} suppressHydrationWarning={Boolean(field.dateSourceRaw)}>
              {entry}
            </span>
          ))}
        </span>
      );
    }
    return primaryText ? (
      <span
        className={chipClass}
        style={chipStyle}
        suppressHydrationWarning={Boolean(field.dateSourceRaw)}
      >
        {primaryText}
      </span>
    ) : (
      <EmptyValue />
    );
  }

  // text type with split transform: listValue has multiple items, use list display
  if (field.renderType === "text" && field.listValue.length > 1 && field.listDisplay) {
    const listDelimiter = field.listDelimiter ?? ", ";
    if (field.listDisplay === "inline") {
      return (
        <span className={tx(field, "leading-6 text-[color:var(--wsu-ink)]")}>
          {field.listValue.map((entry, i) => (
            <span key={entry}>
              {i > 0 && <span className="text-[color:var(--wsu-muted)]">{listDelimiter}</span>}
              {entry}
            </span>
          ))}
        </span>
      );
    }
    return (
      <ul className={tx(field, "space-y-1")}>
        {field.listValue.map((entry) => (
          <li key={entry} className="leading-6 text-[color:var(--wsu-ink)]">
            {entry}
          </li>
        ))}
      </ul>
    );
  }

  return primaryText ? (
    <span className={tx(field, "leading-6 text-[color:var(--wsu-ink)]")} suppressHydrationWarning={Boolean(field.dateSourceRaw)}>
      {primaryText}
    </span>
  ) : (
    <EmptyValue />
  );
}
