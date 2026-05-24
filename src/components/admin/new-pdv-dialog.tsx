"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { X, Plus } from "lucide-react";

export function NewPdvButton({ venueId }: { venueId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mono inline-flex items-center gap-1.5 rounded-admin bg-palantir-blue px-3 min-h-touch text-xs text-white focus-ring-admin"
      >
        <Plus className="size-3.5" /> NOVO PDV
      </button>
      {open && <Dialog venueId={venueId} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({ venueId, onClose }: { venueId: string; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    category: "",
    logo_url: "🍽",
    prep_time_min: 10,
    commission_pct: 15,
    gateway_pct: 3.6,
    instagram_handle: "",
    email: "",
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/admin/pdvs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        venue_id: venueId,
        instagram_handle: form.instagram_handle.replace(/^@/, "").trim() || null,
        email: form.email.trim() || null,
      }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "Erro ao cadastrar");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cadastrar PDV"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full sm:max-w-lg max-h-[90dvh] sm:max-h-[85dvh] overflow-y-auto rounded-t-xl sm:rounded-admin border border-palantir-border bg-palantir-surface p-4 sm:p-5 pb-safe"
      >
        <div className="flex items-start justify-between -mb-1">
          <div>
            <p className="mono text-[10px] tracking-widest text-palantir-muted">CADASTRAR PDV</p>
            <h2 className="text-base sm:text-lg font-semibold text-white">Novo ponto de venda</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-touch -mr-2 -mt-1 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[72px_1fr] gap-3">
          <Field label="Emoji">
            <input
              value={form.logo_url}
              onChange={(e) => set("logo_url", e.target.value.slice(0, 4))}
              className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-2 min-h-touch text-2xl text-center text-white focus-ring-admin"
            />
          </Field>
          <Field label="Nome">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Field label="Slug (URL)" hint="ex.: smash-house">
            <input
              value={form.slug}
              onChange={(e) =>
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
              required
              autoCapitalize="none"
              autoCorrect="off"
              className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
          </Field>
          <Field label="Categoria">
            <input
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Hambúrgueres"
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Field label="Comissão %">
            <input
              type="number"
              inputMode="decimal"
              value={form.commission_pct}
              onChange={(e) => set("commission_pct", Number(e.target.value))}
              min={0}
              max={50}
              step={0.1}
              className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
          </Field>
          <Field label="Gateway %">
            <input
              type="number"
              inputMode="decimal"
              value={form.gateway_pct}
              onChange={(e) => set("gateway_pct", Number(e.target.value))}
              min={0}
              max={20}
              step={0.1}
              className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
          </Field>
          <Field label="Preparo (min)">
            <input
              type="number"
              inputMode="numeric"
              value={form.prep_time_min}
              onChange={(e) => set("prep_time_min", Number(e.target.value))}
              min={1}
              max={180}
              className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Field label="Instagram (@)">
            <input
              value={form.instagram_handle}
              onChange={(e) => set("instagram_handle", e.target.value)}
              placeholder="smashhousebsb"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="contato@..."
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
          </Field>
        </div>

        {error && <p className="mono text-xs text-palantir-red mt-3">{error}</p>}

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-admin bg-palantir-blue px-4 min-h-touch text-sm text-white disabled:opacity-40 focus-ring-admin"
          >
            {loading ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mono text-[11px] text-palantir-muted">{label}</span>
      {hint && <span className="mono text-[10px] text-palantir-muted/60 ml-1">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
