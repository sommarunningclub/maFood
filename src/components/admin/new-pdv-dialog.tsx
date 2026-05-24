"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewPdvButton({ venueId }: { venueId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mono rounded-admin bg-palantir-blue px-3 py-2 text-xs text-white"
      >
        + NOVO PDV
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-admin border border-palantir-border bg-palantir-surface p-5"
      >
        <p className="mono text-[10px] tracking-widest text-palantir-muted">CADASTRAR PDV</p>
        <h2 className="text-lg font-semibold text-white mb-4">Novo ponto de venda</h2>

        <div className="grid grid-cols-[80px_1fr] gap-3">
          <Field label="Emoji">
            <input
              value={form.logo_url}
              onChange={(e) => set("logo_url", e.target.value.slice(0, 4))}
              className="mono rounded-admin border border-palantir-border bg-palantir-bg px-2 h-9 text-2xl text-center text-white"
            />
          </Field>
          <Field label="Nome">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              className="rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Slug (URL)" hint="ex.: smash-house">
            <input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              required
              className="mono rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
            />
          </Field>
          <Field label="Categoria">
            <input
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Hambúrgueres"
              className="rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <Field label="Comissão %">
            <input
              type="number"
              value={form.commission_pct}
              onChange={(e) => set("commission_pct", Number(e.target.value))}
              min={0} max={50} step={0.1}
              className="mono rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
            />
          </Field>
          <Field label="Gateway %">
            <input
              type="number"
              value={form.gateway_pct}
              onChange={(e) => set("gateway_pct", Number(e.target.value))}
              min={0} max={20} step={0.1}
              className="mono rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
            />
          </Field>
          <Field label="Preparo (min)">
            <input
              type="number"
              value={form.prep_time_min}
              onChange={(e) => set("prep_time_min", Number(e.target.value))}
              min={1} max={180}
              className="mono rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Instagram (@)">
            <input
              value={form.instagram_handle}
              onChange={(e) => set("instagram_handle", e.target.value)}
              placeholder="smashhousebsb"
              className="rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="contato@..."
              className="rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
            />
          </Field>
        </div>

        {error && <p className="mono text-xs text-palantir-red mt-3">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="mono text-xs text-palantir-muted px-3 py-2">
            cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-admin bg-palantir-blue px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {loading ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[11px] text-palantir-muted">{label}</span>
      {hint && <span className="mono text-[10px] text-palantir-muted/60 ml-1">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
