import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent, ReactNode } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/Button";
import api from "../../api";
import { tone, display } from "../lib/ui";

const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const FEATURES = [
  "Manager role and teams", "Two-step approval", "Leave portal", "File sharing", "Team chat",
  "AI assistant", "Calendar", "Time tracking", "Other",
];
const CONTACT_METHODS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
];

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

export type InquiryValues = {
  name: string; work_email: string; company: string; job_title: string; team_size: string; requirements: string;
  required_features: string[]; contact_method: string; phone: string; budget: string; message: string; website: string;
};
const EMPTY: InquiryValues = {
  name: "", work_email: "", company: "", job_title: "", team_size: "", requirements: "", required_features: [],
  contact_method: "email", phone: "", budget: "", message: "", website: "",
};

/** Same rules as the server (which re-checks everything); this only gives people quick feedback. */
export function validateBusinessForm(v: InquiryValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.name.trim().length < 2) e.name = "Please enter your name.";
  if (!EMAIL.test(v.work_email.trim())) e.work_email = "Please enter a valid work email.";
  if (v.company.trim().length < 2) e.company = "Please enter your company.";
  if (v.job_title.trim().length < 2) e.job_title = "Please enter your job title.";
  if (!TEAM_SIZES.includes(v.team_size)) e.team_size = "Please choose your team size.";
  if (v.requirements.trim().length < 10) e.requirements = "Please tell us a little about what you need (at least 10 characters).";
  if (!CONTACT_METHODS.some((m) => m.value === v.contact_method)) e.contact_method = "Please choose how we should contact you.";
  const phone = v.phone.trim();
  if (phone && !/^[+()\d][\d\s().-]{5,28}$/.test(phone)) e.phone = "Please enter a valid phone number.";
  if ((v.contact_method === "phone" || v.contact_method === "whatsapp") && !phone) e.phone = "Please enter a phone number so we can reach you.";
  return e;
}

const input: CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${tone.border}`,
  background: tone.bg, color: tone.fg, fontSize: 14, fontFamily: "inherit", outline: "none",
};

function Field({ id, label, error, optional, children }: { id: string; label: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: tone.fg }}>
        {label}{optional && <span style={{ color: tone.muted, fontWeight: 400 }}> (optional)</span>}
      </label>
      {children}
      {error && <span id={`${id}-error`} role="alert" style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>}
    </div>
  );
}

export default function BusinessInquiryModal({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState<InquiryValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const set = <K extends keyof InquiryValues>(key: K, value: InquiryValues[K]) => setV((s) => ({ ...s, [key]: value }));
  const bind = (key: Exclude<keyof InquiryValues, "required_features">) => ({
    id: `biz-${key}`,
    value: v[key],
    style: input,
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `biz-${key}-error` : undefined,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value),
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateBusinessForm(v);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setSending(true);
    try {
      await api.post("/public/business-inquiry", v);
      setDone(true);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; fields?: Record<string, string> } } })?.response?.data;
      if (data?.fields) setErrors(data.fields);
      setFormError(data?.error || "We could not send your request. Please email info@unimisk.com.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(2,6,23,0.7)", display: "grid", placeItems: "center", padding: 16, overflowY: "auto" }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="biz-title"
        style={{ width: "min(640px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: tone.card, border: `1px solid ${tone.border}`, borderRadius: 20, padding: 28 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div>
            <h2 id="biz-title" style={{ ...display, fontSize: 22, fontWeight: 600, margin: 0, color: tone.fg }}>Contact Team Unimisk</h2>
            <p style={{ fontSize: 14, color: tone.muted, margin: "6px 0 0", lineHeight: 1.5 }}>Tell us about your team and what you need. We will get back to you about a Business plan.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: 0, color: tone.muted, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        {done ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0", textAlign: "center" }}>
            <CheckCircle2 size={40} color="#10b981" />
            <h3 style={{ ...display, fontSize: 18, margin: 0, color: tone.fg }}>Thank you, we have your request</h3>
            <p style={{ fontSize: 14, color: tone.muted, margin: 0 }}>Team Unimisk will contact you by {CONTACT_METHODS.find((m) => m.value === v.contact_method)?.label.toLowerCase()}.</p>
            <Button variant="outline" type="button" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate style={{ display: "grid", gap: 14 }}>
            {/* Hidden from people; only bots fill it in. */}
            <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} /></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <Field id="biz-name" label="Name" error={errors.name}><input {...bind("name")} ref={firstRef} autoComplete="name" maxLength={100} /></Field>
              <Field id="biz-work_email" label="Work email" error={errors.work_email}><input {...bind("work_email")} type="email" autoComplete="email" maxLength={254} /></Field>
              <Field id="biz-company" label="Company" error={errors.company}><input {...bind("company")} autoComplete="organization" maxLength={150} /></Field>
              <Field id="biz-job_title" label="Job title" error={errors.job_title}><input {...bind("job_title")} autoComplete="organization-title" maxLength={100} /></Field>
            </div>
            <Field id="biz-team_size" label="Team size" error={errors.team_size}>
              <select {...bind("team_size")}>
                <option value="">Select team size</option>
                {TEAM_SIZES.map((s) => <option key={s} value={s}>{s} people</option>)}
              </select>
            </Field>
            <Field id="biz-requirements" label="What do you need?" error={errors.requirements}>
              <textarea {...bind("requirements")} rows={4} maxLength={2000} placeholder="Tell us about your team's needs" />
            </Field>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 500, color: tone.fg, marginBottom: 8 }}>Features you need <span style={{ color: tone.muted, fontWeight: 400 }}>(optional)</span></legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FEATURES.map((f) => {
                  const on = v.required_features.includes(f);
                  return (
                    <label key={f} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: tone.fg, padding: "6px 10px", borderRadius: 999, border: `1px solid ${on ? "#8B5CF6" : tone.border}`, cursor: "pointer" }}>
                      <input type="checkbox" checked={on} onChange={() => set("required_features", on ? v.required_features.filter((x) => x !== f) : [...v.required_features, f])} />
                      {f}
                    </label>
                  );
                })}
              </div>
              {errors.required_features && <span role="alert" style={{ fontSize: 12, color: "#ef4444" }}>{errors.required_features}</span>}
            </fieldset>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <Field id="biz-contact_method" label="Preferred contact method" error={errors.contact_method}>
                <select {...bind("contact_method")}>
                  {CONTACT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field id="biz-phone" label="Phone number" optional={v.contact_method === "email"} error={errors.phone}>
                <input {...bind("phone")} type="tel" autoComplete="tel" maxLength={30} />
              </Field>
            </div>
            <Field id="biz-budget" label="Budget" optional error={errors.budget}><input {...bind("budget")} maxLength={100} placeholder="e.g. a monthly range" /></Field>
            <Field id="biz-message" label="Anything else?" optional error={errors.message}><textarea {...bind("message")} rows={3} maxLength={2000} /></Field>
            {formError && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>{formError}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send request"}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
