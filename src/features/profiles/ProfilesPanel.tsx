import { useEffect, useMemo, useRef, useState } from "react";
import { isBuiltin, profileName, type ProfileStore } from "./profiles";

type Props = {
  store: ProfileStore;
  no: boolean;
  colors: { input: string; text: string; border: string };
  onSwitch: (id: string) => void;
  onCreate: (name: string, source?: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onEditLayout: () => void;
  onResetLayout: () => void;
  confirmLayoutReset: boolean;
  setConfirmLayoutReset: (value: boolean) => void;
};

export function ProfilesPanel({ store, no, colors, onSwitch, onCreate, onRename, onDelete, onEditLayout, onResetLayout, confirmLayoutReset, setConfirmLayoutReset }: Props) {
  const t = (a: string, b: string) => no ? a : b;
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{ kind: "rename" | "duplicate"; id: string } | null>(null);
  const [deleting, setDeleting] = useState("");
  const nameField = useRef<HTMLInputElement>(null);
  const customProfiles = useMemo(() => store.profiles.filter((profile) => !isBuiltin(profile.id)), [store.profiles]);
  const activeCustom = customProfiles.find((profile) => profile.id === store.activeId);
  useEffect(() => { if (edit) nameField.current?.focus(); }, [edit]);
  const button = { background: colors.input, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "6px 10px", cursor: "pointer", font: "inherit" };

  return <section aria-label={t("Profiler", "Profiles")} style={{ maxWidth: 720, padding: 16, boxSizing: "border-box", fontSize: 12 }}>
    <h2>{t("Dine profiler", "Your profiles")}</h2>
    <p>{t("Her vises bare profiler du lagrer selv. En profil husker utseende, faner, innboks og ditt flyttbare chat-oppsett – aldri innlogging eller meldinger.", "Only profiles you save yourself appear here. A profile remembers appearance, tabs, Inbox, and your movable chat layout – never sign-in details or messages.")}</p>

    <form onSubmit={e => { e.preventDefault(); if (!name.trim()) return; if (edit?.kind === "rename") onRename(edit.id, name); else onCreate(name, edit?.id); setName(""); setEdit(null); }} style={{ marginTop: 14, padding: 12, border: `1px solid ${colors.border}`, borderRadius: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
      <label style={{ minWidth: 0, width: "100%" }}>{edit?.kind === "rename" ? t("Nytt profilnavn", "New profile name") : t("Navn på oppsettet", "Layout name")} <input ref={nameField} aria-label={t("Profilnavn", "Profile name")} value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder={t("For eksempel Streaming", "For example Streaming")} style={{ ...button, width: "100%", marginTop: 5, boxSizing: "border-box", cursor: "text" }} /></label>
      <button style={button} disabled={!name.trim()} type="submit">{edit ? t("Lagre", "Save") : t("Lagre nåværende oppsett", "Save current setup")}</button>
      {edit && <button style={button} type="button" onClick={() => { setEdit(null); setName(""); }}>{t("Avbryt", "Cancel")}</button>}
    </form>

    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      <button style={button} onClick={onEditLayout}>{t("Flytt og rediger layout", "Move and edit layout")}</button>
      <button style={button} onClick={() => setConfirmLayoutReset(true)}>{t("Tilbakestill aktiv layout", "Reset active layout")}</button>
    </div>
    <p>{t("I layoutredigering kan du dra chattene fra hele fanehodet, slippe dem mot en kant for å dele, dra skillelinjer for størrelse og slippe i midten for å samle dem igjen.", "In layout editing, drag chats by the whole tab header, drop near an edge to split, drag dividers to resize, and drop in the center to combine them again.")}</p>

    {confirmLayoutReset && <div role="alert" style={{ padding: 10, border: `1px solid ${colors.border}`, borderRadius: 6 }}><p>{t("Tilbakestille den aktive layouten? Kontoer og andre innstillinger beholdes.", "Reset the active layout? Accounts and other settings are kept.")}</p><button style={button} onClick={() => { onResetLayout(); setConfirmLayoutReset(false); }}>{t("Bekreft", "Confirm")}</button>{" "}<button style={button} onClick={() => setConfirmLayoutReset(false)}>{t("Avbryt", "Cancel")}</button></div>}

    {customProfiles.length === 0 ? (
      <div style={{ marginTop: 18, padding: "28px 14px", border: `1px dashed ${colors.border}`, borderRadius: 6, textAlign: "center" }}>
        <strong>{t("Ingen lagrede profiler", "No saved profiles")}</strong>
        <p>{t("FyFlade bruker oppsettet ditt som det er. Skriv et navn over når du vil lagre en egen profil.", "FyFlade uses your layout as it is. Enter a name above whenever you want to save your own profile.")}</p>
      </div>
    ) : (
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {customProfiles.map(profile => <article key={profile.id} aria-label={profileName(profile, no)} style={{ border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, overflowWrap: "anywhere" }}>
          <strong>{profileName(profile, no)}{activeCustom?.id === profile.id ? t(" · Aktiv", " · Active") : ""}</strong>
          <p>{t("Ditt lagrede FyFlade-oppsett.", "Your saved FyFlade setup.")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button style={button} disabled={activeCustom?.id === profile.id} onClick={() => onSwitch(profile.id)}>{t("Bruk", "Use")}</button>
            <button style={button} onClick={() => { setEdit({ kind: "duplicate", id: profile.id }); setName(`${profileName(profile, no)} ${t("kopi", "copy")}`); }}>{t("Dupliser", "Duplicate")}</button>
            <button style={button} onClick={() => { setEdit({ kind: "rename", id: profile.id }); setName(profile.name); }}>{t("Gi nytt navn", "Rename")}</button>
            <button style={button} onClick={() => setDeleting(profile.id)}>{t("Slett", "Delete")}</button>
          </div>
          {deleting === profile.id && <div role="alert" style={{ marginTop: 12 }}><p>{t("Slette denne profilen? Kontoer og innhold beholdes.", "Delete this profile? Accounts and content are kept.")}</p><button style={button} onClick={() => { onDelete(profile.id); setDeleting(""); }}>{t("Bekreft sletting", "Confirm delete")}</button>{" "}<button style={button} onClick={() => setDeleting("")}>{t("Avbryt", "Cancel")}</button></div>}
        </article>)}
      </div>
    )}
  </section>;
}
