"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { brl } from "@/lib/utils";
import type { Pdv } from "@/types";

export interface AdminPdvRow extends Pdv {
  pin_set_at: string | null;
  instagram_handle: string | null;
  email?: string | null;
}

const COLS = "24px_1fr_110px_80px_110px_140px_70px_90px";

export function PdvsTable({ initial }: { initial: AdminPdvRow[] }) {
  const router = useRouter();
  const [pdvs, setPdvs] = useState<AdminPdvRow[]>(
    [...initial].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [pinTarget, setPinTarget] = useState<AdminPdvRow | null>(null);
  const [editTarget, setEditTarget] = useState<AdminPdvRow | null>(null);
  const [justSavedPin, setJustSavedPin] = useState<AdminPdvRow | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setPdvs((items) => {
        const oldI = items.findIndex((i) => i.id === active.id);
        const newI = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldI, newI);
      });
    }
  }

  function toggle(id: string) {
    setPdvs((items) =>
      items.map((p) => (p.id === id ? { ...p, is_open: !p.is_open } : p))
    );
  }

  function markPinSet(id: string) {
    setPdvs((items) =>
      items.map((p) =>
        p.id === id ? { ...p, pin_set_at: new Date().toISOString() } : p
      )
    );
  }
  function markPinCleared(id: string) {
    setPdvs((items) =>
      items.map((p) => (p.id === id ? { ...p, pin_set_at: null } : p))
    );
  }

  return (
    <>
      <div className="border border-palantir-border bg-palantir-surface">
        <div
          className="mono grid gap-4 border-b border-palantir-border px-4 py-2 text-[10px] uppercase tracking-wider text-palantir-muted"
          style={{ gridTemplateColumns: `${COLS.replaceAll("_", " ")}` }}
        >
          <span></span>
          <span>PDV</span>
          <span>Comissão</span>
          <span>Preparo</span>
          <span>Carteira</span>
          <span>PIN</span>
          <span>Status</span>
          <span>Ações</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={pdvs.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {pdvs.map((p) => (
              <Row
                key={p.id}
                pdv={p}
                onToggle={toggle}
                onSetPin={() => setPinTarget(p)}
                onEdit={() => setEditTarget(p)}
                onClearPin={async () => {
                  if (!confirm(`Remover PIN de ${p.name}?`)) return;
                  const r = await fetch(`/api/admin/pdvs/${p.id}/pin`, { method: "DELETE" });
                  if (r.ok) markPinCleared(p.id);
                }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {pinTarget && (
        <PinDialog
          pdv={pinTarget}
          onClose={() => setPinTarget(null)}
          onSaved={() => {
            markPinSet(pinTarget.id);
            const saved = pinTarget;
            setPinTarget(null);
            setJustSavedPin(saved);
            // Refresh do server-side data (lê pin_set_at atualizado do banco)
            router.refresh();
          }}
        />
      )}

      {justSavedPin && (
        <PinSavedDialog
          pdv={justSavedPin}
          onClose={() => setJustSavedPin(null)}
        />
      )}

      {editTarget && (
        <EditPdvDialog
          pdv={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Row({
  pdv,
  onToggle,
  onSetPin,
  onClearPin,
  onEdit,
}: {
  pdv: AdminPdvRow;
  onToggle: (id: string) => void;
  onSetPin: () => void;
  onClearPin: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pdv.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridTemplateColumns: `${COLS.replaceAll("_", " ")}`,
      }}
      className={`grid items-center gap-4 border-t border-palantir-border px-4 py-3 text-sm ${
        isDragging ? "bg-palantir-surface2 opacity-80" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-palantir-muted hover:text-palantir-text active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="flex items-center gap-2 text-palantir-text min-w-0">
        <span className="text-lg shrink-0">{pdv.logo_url}</span>
        <span className="truncate">{pdv.name}</span>
        <span className="mono text-[10px] text-palantir-muted shrink-0">{pdv.category}</span>
        {pdv.instagram_handle && (
          <a
            href={`https://instagram.com/${pdv.instagram_handle}`}
            target="_blank"
            rel="noreferrer"
            className="mono text-[10px] text-palantir-blue hover:underline shrink-0"
          >
            @{pdv.instagram_handle}
          </a>
        )}
      </span>
      <span className="mono text-palantir-text">{pdv.commission_pct}%</span>
      <span className="mono text-palantir-muted">{pdv.prep_time_min} min</span>
      <span className="mono text-palantir-green">{brl(pdv.wallet_balance)}</span>
      <div className="flex items-center gap-2 min-w-0">
        {pdv.pin_set_at ? (
          <>
            <span className="mono text-[10px] text-palantir-green">✓</span>
            <button onClick={onSetPin} className="mono text-[10px] text-palantir-blue hover:underline">
              trocar
            </button>
            <button onClick={onClearPin} className="mono text-[10px] text-palantir-red hover:underline">
              ×
            </button>
          </>
        ) : (
          <button
            onClick={onSetPin}
            className="mono rounded-admin border border-palantir-blue px-2 py-1 text-[10px] text-palantir-blue"
          >
            DEFINIR PIN
          </button>
        )}
      </div>
      <button
        onClick={() => onToggle(pdv.id)}
        className={`mono rounded-admin px-2 py-1 text-[10px] font-bold ${
          pdv.is_open ? "bg-palantir-green/15 text-palantir-green" : "bg-palantir-red/15 text-palantir-red"
        }`}
      >
        {pdv.is_open ? "ABERTO" : "FECHADO"}
      </button>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          title="Editar PDV"
          className="rounded-admin border border-palantir-border px-2 py-1 text-xs text-palantir-text hover:bg-palantir-surface2"
        >
          ✎
        </button>
        <a
          href={`/loja/${pdv.slug}`}
          target="_blank"
          rel="noreferrer"
          title="Abrir painel do PDV"
          className="rounded-admin border border-palantir-border px-2 py-1 text-xs text-palantir-text hover:bg-palantir-surface2"
        >
          ↗
        </a>
      </div>
    </div>
  );
}

// ── PIN Dialog ────────────────────────────────────────────────────

function PinDialog({
  pdv,
  onClose,
  onSaved,
}: {
  pdv: AdminPdvRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setError(null);
    if (pin.length < 4 || pin.length > 8) return setError("PIN entre 4 e 8 digitos");
    if (pin !== confirm) return setError("Confirmacao diferente");
    setLoading(true);
    const r = await fetch(`/api/admin/pdvs/${pdv.id}/pin`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setLoading(false);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? "Erro");
      return;
    }
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <p className="mono text-[10px] tracking-widest text-palantir-muted">DEFINIR PIN</p>
      <h2 className="text-lg font-semibold text-white">{pdv.name}</h2>
      <p className="mono text-[11px] text-palantir-muted mb-4">
        slug: <span className="text-palantir-blue">{pdv.slug}</span>
      </p>

      <Field label="PIN (4-8 digitos)">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          maxLength={8}
          autoFocus
          className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-xl tracking-[0.5em] text-white"
        />
      </Field>
      <Field label="Confirmar">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          maxLength={8}
          className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-xl tracking-[0.5em] text-white"
        />
      </Field>

      {error && <p className="mono text-xs text-palantir-red mb-3">{error}</p>}

      <DialogActions onCancel={onClose} onSave={save} loading={loading} />
    </Modal>
  );
}

// ── PIN Saved confirmation ───────────────────────────────────────

function PinSavedDialog({ pdv, onClose }: { pdv: AdminPdvRow; onClose: () => void }) {
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/loja/${pdv.slug}` : `/loja/${pdv.slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 mb-3">
        <div className="size-10 rounded-full bg-palantir-green/15 flex items-center justify-center text-palantir-green text-xl">
          ✓
        </div>
        <div>
          <p className="mono text-[10px] tracking-widest text-palantir-green">PIN CRIADO</p>
          <h2 className="text-lg font-semibold text-white">{pdv.name}</h2>
        </div>
      </div>

      <p className="text-sm text-palantir-text mb-3">
        O PDV agora pode entrar no painel. Compartilhe o link abaixo no WhatsApp do operador.
      </p>

      <div className="rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 flex items-center gap-2">
        <code className="mono text-xs text-palantir-blue flex-1 truncate">{url}</code>
        <button
          onClick={copyLink}
          className="mono text-[10px] uppercase text-palantir-muted hover:text-palantir-text"
        >
          Copiar
        </button>
      </div>

      <div className="mt-5 flex justify-between items-center">
        <button onClick={onClose} className="mono text-xs text-palantir-muted px-3 py-2">
          Fechar
        </button>
        <a
          href={`/loja/${pdv.slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-admin bg-palantir-blue px-4 py-2 text-sm text-white inline-flex items-center gap-2"
        >
          Abrir painel do PDV
          <span>↗</span>
        </a>
      </div>
    </Modal>
  );
}

// ── Edit PDV Dialog ──────────────────────────────────────────────

function EditPdvDialog({
  pdv,
  onClose,
  onSaved,
}: {
  pdv: AdminPdvRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: pdv.name,
    category: pdv.category ?? "",
    logo_url: pdv.logo_url ?? "🍽",
    prep_time_min: pdv.prep_time_min,
    commission_pct: pdv.commission_pct,
    gateway_pct: pdv.gateway_pct,
    instagram_handle: pdv.instagram_handle ?? "",
    email: pdv.email ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setLoading(true);
    setError(null);
    const r = await fetch(`/api/admin/pdvs/${pdv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        instagram_handle: form.instagram_handle.replace(/^@/, "").trim() || null,
        email: form.email.trim() || null,
      }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "Erro");
      return;
    }
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <p className="mono text-[10px] tracking-widest text-palantir-muted">EDITAR PDV</p>
      <h2 className="text-lg font-semibold text-white mb-1">{pdv.name}</h2>
      <p className="mono text-[11px] text-palantir-muted mb-4">
        slug: <span className="text-palantir-blue">{pdv.slug}</span>
        <span className="ml-2 text-palantir-muted/60">(slug não pode ser alterado)</span>
      </p>

      <div className="grid grid-cols-[80px_1fr] gap-3">
        <Field label="Emoji">
          <input
            value={form.logo_url}
            onChange={(e) => set("logo_url", e.target.value.slice(0, 4))}
            className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-2 h-9 text-2xl text-center text-white"
          />
        </Field>
        <Field label="Nome">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
          />
        </Field>
      </div>

      <Field label="Categoria">
        <input
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
          className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Comissão %">
          <input
            type="number"
            value={form.commission_pct}
            onChange={(e) => set("commission_pct", Number(e.target.value))}
            min={0}
            max={50}
            step={0.1}
            className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
          />
        </Field>
        <Field label="Gateway %">
          <input
            type="number"
            value={form.gateway_pct}
            onChange={(e) => set("gateway_pct", Number(e.target.value))}
            min={0}
            max={20}
            step={0.1}
            className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
          />
        </Field>
        <Field label="Preparo (min)">
          <input
            type="number"
            value={form.prep_time_min}
            onChange={(e) => set("prep_time_min", Number(e.target.value))}
            min={1}
            max={180}
            className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Instagram (@)">
          <input
            value={form.instagram_handle}
            onChange={(e) => set("instagram_handle", e.target.value)}
            className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
          />
        </Field>
      </div>

      {error && <p className="mono text-xs text-palantir-red mt-2">{error}</p>}

      <DialogActions onCancel={onClose} onSave={save} loading={loading} label="Salvar" />
    </Modal>
  );
}

// ── shared ────────────────────────────────────────────────────────

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-admin border border-palantir-border bg-palantir-surface p-5 space-y-3"
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[11px] text-palantir-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DialogActions({
  onCancel,
  onSave,
  loading,
  label = "Salvar",
}: {
  onCancel: () => void;
  onSave: () => void;
  loading: boolean;
  label?: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button onClick={onCancel} className="mono text-xs text-palantir-muted px-3 py-2">
        cancelar
      </button>
      <button
        onClick={onSave}
        disabled={loading}
        className="rounded-admin bg-palantir-blue px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {loading ? "Salvando..." : label}
      </button>
    </div>
  );
}
