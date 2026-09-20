import { useEffect, useRef, useState } from "react";
import { isBuiltin, profileName, type ProfileStore } from "./profiles";
type Props = { store: ProfileStore; no: boolean; colors: { input: string; text: string; border: string }; onSwitch: (id: string) => void; onCreate: (name: string, source?: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; onReset: (id: string) => void; onEditLayout: () => void; onResetLayout: () => void; confirmLayoutReset: boolean; setConfirmLayoutReset: (value: boolean) => void };
export function ProfilesPanel({ store, no, colors, onSwitch, onCreate, onRename, onDelete, onReset, onEditLayout, onResetLayout, confirmLayoutReset, setConfirmLayoutReset }: Props) {
  const t = (a: string, b: string) => no ? a : b;
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{ kind: "rename" | "duplicate"; id: string } | null>(null);
  const [deleting, setDeleting] = useState("");
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => { if (edit) nameField.current?.focus(); }, [edit]);
  const button = { background: colors.input, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "6px 10px", cursor: "pointer", font: "inherit" };
  const descriptions: Record<string, string> = {
    normal: t("Ditt opprinnelige oppsett. Tilpass det slik du vil.", "Your original setup. Customize it as you like."),
    streamer: t("Større tekst, kompakte faner til høyre og åpen innboks. OBS-oppsettet endres ikke.", "Larger text, compact tabs on the right and an open Inbox. OBS configuration stays unchanged."),
    moderator: t("Kompakt tekst, faner til venstre og åpen innboks. Mod-verktøyene bruker dine eksisterende rettigheter.", "Compact text, tabs on the left and an open Inbox. Moderation tools use your existing permissions."),
    minimal: t("Kompakte faner øverst og lukket innboks. Innstillinger, status og skrivefelt er fortsatt tilgjengelige.", "Compact tabs on top and a closed Inbox. Settings, status and message input stay available."),
  };
  return <section aria-label={t("Profiler", "Profiles")} style={{ maxWidth: 720, padding: 16, boxSizing: "border-box", fontSize: 12 }}>
    <h2>{t("Profiler", "Profiles")}</h2>
    <p>{t("Bytt visning uten å endre kontoer, kanaler eller meldinger. Endringer lagres automatisk i aktiv profil, inkludert skriftstørrelse, faner, innboks og lagret layout.", "Change your view without changing accounts, channels or messages. Changes are saved automatically to the active profile, including font size, tabs, Inbox, and saved layout.")}</p>
    <label>{t("Aktiv profil", "Active profile")} <select aria-label={t("Aktiv profil", "Active profile")} value={store.activeId} onChange={e => onSwitch(e.target.value)} style={{ ...button, maxWidth: "100%" }}>
      {store.profiles.map(p => <option key={p.id} value={p.id}>{profileName(p, no)}</option>)}
    </select></label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}><button style={button} onClick={onEditLayout}>{t("Rediger layout", "Edit layout")}</button><button style={button} onClick={() => setConfirmLayoutReset(true)}>{t("Tilbakestill profillayout", "Reset profile layout")}</button><span>{t("Layout låst utenfor redigering", "Layout locked outside editing")}</span></div>
    {confirmLayoutReset && <div role="alert"><p>{t("Tilbakestille kun layouten for aktiv profil? Kontoer og øvrige innstillinger beholdes.", "Reset only the active profile layout? Accounts and other settings are kept.")}</p><button style={button} onClick={() => { onResetLayout(); setConfirmLayoutReset(false); }}>{t("Bekreft tilbakestilling", "Confirm layout reset")}</button> <button style={button} onClick={() => setConfirmLayoutReset(false)}>{t("Avbryt", "Cancel")}</button></div>}
    <p>{t("I hovedvinduet: dra plattformnavn mot en kant for å dele chatten. Dra inn i midten for å slå sammen igjen. Dra skillelinjer for å endre størrelse, og velg Lagre. Avbryt forkaster kladden.", "In the main window: drag platform names toward an edge to split chat. Drop in the center to combine again. Drag dividers to resize, then Save. Cancel discards the draft.")}</p>
    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {store.profiles.map(p => <article key={p.id} aria-label={profileName(p, no)} style={{ border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, overflowWrap: "anywhere" }}>
        <strong>{profileName(p, no)}{store.activeId === p.id ? t(" · Aktiv", " · Active") : ""}</strong>
        <p>{descriptions[p.id] || t("Din egen profil.", "Your custom profile.")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={button} disabled={store.activeId === p.id} onClick={() => onSwitch(p.id)}>{t("Bruk", "Use")}</button>
          <button style={button} onClick={() => { setEdit({ kind: "duplicate", id: p.id }); setName(`${profileName(p, no)} ${t("kopi", "copy")}`); }}>{t("Dupliser", "Duplicate")}</button>
          {isBuiltin(p.id) ? <button style={button} onClick={() => onReset(p.id)}>{t("Tilbakestill", "Reset")}</button> : <>
            <button style={button} onClick={() => { setEdit({ kind: "rename", id: p.id }); setName(p.name); }}>{t("Gi nytt navn", "Rename")}</button>
            <button style={button} onClick={() => setDeleting(p.id)}>{t("Slett", "Delete")}</button>
          </>}
        </div>
        {deleting === p.id && <div role="alert" style={{ marginTop: 12 }}>
          <p>{t("Slette denne profilen? Hvis den er aktiv, bytter vi til Normal. Kontoer og innhold beholdes.", "Delete this profile? If active, we switch to Normal. Accounts and content are kept.")}</p>
          <button style={button} onClick={() => { onDelete(p.id); setDeleting(""); }}>{t("Bekreft sletting", "Confirm delete")}</button>{" "}
          <button style={button} onClick={() => setDeleting("")}>{t("Avbryt", "Cancel")}</button>
        </div>}
      </article>)}
    </div>
    <form onSubmit={e => { e.preventDefault(); if (!name.trim()) return; if (edit?.kind === "rename") onRename(edit.id, name); else onCreate(name, edit?.id); setName(""); setEdit(null); }} style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
      <label style={{ minWidth: 0, width: "100%" }}>{t("Profilnavn", "Profile name")} <input ref={nameField} aria-label={t("Profilnavn", "Profile name")} value={name} maxLength={60} onChange={e => setName(e.target.value)} style={{ ...button, width: "100%", boxSizing: "border-box", cursor: "text" }} /></label>
      <button style={button} disabled={!name.trim()} type="submit">{edit ? t("Lagre", "Save") : t("Opprett fra nåværende oppsett", "Create from current setup")}</button>
      {edit && <button style={button} type="button" onClick={() => { setEdit(null); setName(""); }}>{t("Avbryt", "Cancel")}</button>}
    </form>
  </section>;
}
