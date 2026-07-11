"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, ExternalLink, Check, X } from "lucide-react";
import { brl } from "@/lib/utils";
import type { Pdv } from "@/types";
import { PdvLogo, isImageLogo } from "@/components/pdv-logo";

export interface AdminPdvRow extends Pdv {
  pin_set_at: string | null;
  instagram_handle: string | null;
  email?: string | null;
}

const COLS = "32px 1fr 110px 80px 110px 140px 80px 96px";

export function PdvsTable({ initial }: { initial: AdminPdvRow[] }) {
  const router = useRouter();
  const [pdvs, setPdvs] = useState<AdminPdvRow[]>(
    [...initial].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [pinTarget, setPinTarget] = useState<AdminPdvRow | null>(null);
  const [editTarget, setEditTarget] = useState<AdminPdvRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminPdvRow | null>(null);
  const [justSavedPin, setJustSavedPin] = useState<AdminPdvRow | null>(null);

  // TouchSensor com delay evita conflito com scroll vertical em mobile
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pdvs.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {/* ─── Tabela lg+ ───────────────────────────────────────── */}
          <div className="hidden lg:block border border-palantir-border bg-palantir-surface">
            <div
              className="mono grid gap-4 border-b border-palantir-border px-4 py-2 text-[10px] uppercase tracking-wider text-palantir-muted"
              style={{ gridTemplateColumns: COLS }}
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
            {pdvs.map((p) => (
              <RowDesktop
                key={p.id}
                pdv={p}
                onToggle={toggle}
                onDetail={() => setDetailTarget(p)}
                onSetPin={() => setPinTarget(p)}
                onEdit={() => setEditTarget(p)}
                onClearPin={async () => {
                  if (!confirm(`Remover PIN de ${p.name}?`)) return;
                  const r = await fetch(`/api/admin/pdvs/${p.id}/pin`, { method: "DELETE" });
                  if (r.ok) markPinCleared(p.id);
                }}
              />
            ))}
          </div>

          {/* ─── Cards <lg ─────────────────────────────────────────── */}
          <ul className="lg:hidden space-y-2">
            {pdvs.map((p) => (
              <CardMobile
                key={p.id}
                pdv={p}
                onToggle={toggle}
                onDetail={() => setDetailTarget(p)}
                onSetPin={() => setPinTarget(p)}
                onEdit={() => setEditTarget(p)}
                onClearPin={async () => {
                  if (!confirm(`Remover PIN de ${p.name}?`)) return;
                  const r = await fetch(`/api/admin/pdvs/${p.id}/pin`, { method: "DELETE" });
                  if (r.ok) markPinCleared(p.id);
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {pinTarget && (
        <PinDialog
          pdv={pinTarget}
          onClose={() => setPinTarget(null)}
          onSaved={() => {
            markPinSet(pinTarget.id);
            const saved = pinTarget;
            setPinTarget(null);
            setJustSavedPin(saved);
            router.refresh();
          }}
        />
      )}

      {justSavedPin && (
        <PinSavedDialog pdv={justSavedPin} onClose={() => setJustSavedPin(null)} />
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

      {detailTarget && (
        <PdvDetailDialog
          pdv={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            setDetailTarget(null);
            setEditTarget(detailTarget);
          }}
        />
      )}
    </>
  );
}

// ── Linha desktop ──────────────────────────────────────────────────

function RowDesktop({
  pdv,
  onToggle,
  onDetail,
  onSetPin,
  onClearPin,
  onEdit,
}: {
  pdv: AdminPdvRow;
  onToggle: (id: string) => void;
  onDetail: () => void;
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
        gridTemplateColumns: COLS,
      }}
      className={`grid items-center gap-4 border-t border-palantir-border px-4 py-3 text-sm ${
        isDragging ? "bg-palantir-surface2 opacity-80" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="grid size-touch place-items-center cursor-grab text-palantir-muted hover:text-palantir-text active:cursor-grabbing focus-ring-admin"
        aria-label={`Mover ${pdv.name}`}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        onClick={onDetail}
        className="flex items-center gap-2 text-palantir-text min-w-0 text-left hover:text-white focus-ring-admin rounded-admin px-1 -ml-1"
      >
        <PdvLogo logoUrl={pdv.logo_url} size={24} />
        <span className="truncate hover:underline underline-offset-2">{pdv.name}</span>
        <span className="mono text-[10px] text-palantir-muted shrink-0">{pdv.category}</span>
        {pdv.instagram_handle && (
          <a
            href={`https://instagram.com/${pdv.instagram_handle}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mono text-[10px] text-palantir-blue hover:underline shrink-0"
          >
            @{pdv.instagram_handle}
          </a>
        )}
      </button>
      <span className="mono text-palantir-text">{pdv.commission_pct}%</span>
      <span className="mono text-palantir-muted">{pdv.prep_time_min} min</span>
      <span className="mono text-palantir-green">{brl(pdv.wallet_balance)}</span>
      <div className="flex items-center gap-2 min-w-0">
        {pdv.pin_set_at ? (
          <>
            <Check className="size-3 text-palantir-green shrink-0" />
            <button onClick={onSetPin} className="mono text-[10px] text-palantir-blue hover:underline">
              trocar
            </button>
            <button onClick={onClearPin} className="mono text-[10px] text-palantir-red hover:underline">
              remover
            </button>
          </>
        ) : (
          <button
            onClick={onSetPin}
            className="mono rounded-admin border border-palantir-blue px-2 py-1 text-[10px] text-palantir-blue focus-ring-admin"
          >
            DEFINIR PIN
          </button>
        )}
      </div>
      <button
        onClick={() => onToggle(pdv.id)}
        className={`mono rounded-admin px-2 py-1 text-[10px] font-bold focus-ring-admin ${
          pdv.is_open ? "bg-palantir-green/15 text-palantir-green" : "bg-palantir-red/15 text-palantir-red"
        }`}
      >
        {pdv.is_open ? "ABERTO" : "FECHADO"}
      </button>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          title="Editar PDV"
          aria-label="Editar PDV"
          className="grid size-9 place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
        >
          <Pencil className="size-3.5" />
        </button>
        <a
          href={`/loja/${pdv.slug}`}
          target="_blank"
          rel="noreferrer"
          title="Abrir painel"
          aria-label="Abrir painel do PDV"
          className="grid size-9 place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

// ── Card mobile/tablet ─────────────────────────────────────────────

function CardMobile({
  pdv,
  onToggle,
  onDetail,
  onSetPin,
  onClearPin,
  onEdit,
}: {
  pdv: AdminPdvRow;
  onToggle: (id: string) => void;
  onDetail: () => void;
  onSetPin: () => void;
  onClearPin: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pdv.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border border-palantir-border bg-palantir-surface ${
        isDragging ? "opacity-80 bg-palantir-surface2" : ""
      }`}
    >
      <div className="flex items-start gap-2 p-3">
        <button
          {...attributes}
          {...listeners}
          className="grid size-touch place-items-center -mt-1 -ml-1 cursor-grab text-palantir-muted hover:text-palantir-text active:cursor-grabbing touch-none focus-ring-admin"
          aria-label={`Mover ${pdv.name}`}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <button onClick={onDetail} className="flex items-center gap-2 text-left w-full focus-ring-admin rounded-admin">
            <PdvLogo logoUrl={pdv.logo_url} size={28} />
            <div className="min-w-0">
              <p className="text-palantir-text font-medium truncate hover:underline underline-offset-2">{pdv.name}</p>
              <p className="mono text-[10px] text-palantir-muted truncate">
                {pdv.category}
                {pdv.instagram_handle && (
                  <>
                    {" · "}
                    <a
                      href={`https://instagram.com/${pdv.instagram_handle}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-palantir-blue"
                    >
                      @{pdv.instagram_handle}
                    </a>
                  </>
                )}
              </p>
            </div>
          </button>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <Stat label="Comissão" value={`${pdv.commission_pct}%`} />
            <Stat label="Preparo" value={`${pdv.prep_time_min} min`} />
            <Stat label="Carteira" value={brl(pdv.wallet_balance)} className="text-palantir-green" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onToggle(pdv.id)}
              className={`mono min-h-touch rounded-admin px-3 text-[10px] font-bold focus-ring-admin ${
                pdv.is_open
                  ? "bg-palantir-green/15 text-palantir-green"
                  : "bg-palantir-red/15 text-palantir-red"
              }`}
              aria-pressed={pdv.is_open}
            >
              {pdv.is_open ? "ABERTO" : "FECHADO"}
            </button>
            {pdv.pin_set_at ? (
              <>
                <span className="mono inline-flex items-center gap-1 min-h-touch px-2 text-[10px] text-palantir-green">
                  <Check className="size-3" /> PIN
                </span>
                <button
                  onClick={onSetPin}
                  className="mono min-h-touch rounded-admin border border-palantir-blue px-3 text-[10px] text-palantir-blue focus-ring-admin"
                >
                  TROCAR
                </button>
                <button
                  onClick={onClearPin}
                  className="mono min-h-touch rounded-admin border border-palantir-red px-3 text-[10px] text-palantir-red focus-ring-admin"
                >
                  REMOVER
                </button>
              </>
            ) : (
              <button
                onClick={onSetPin}
                className="mono min-h-touch rounded-admin border border-palantir-blue px-3 text-[10px] text-palantir-blue focus-ring-admin"
              >
                DEFINIR PIN
              </button>
            )}
            <div className="ml-auto flex gap-1">
              <button
                onClick={onEdit}
                aria-label="Editar PDV"
                className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
              >
                <Pencil className="size-4" />
              </button>
              <a
                href={`/loja/${pdv.slug}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir painel do PDV"
                className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="mono text-palantir-muted uppercase tracking-wide">{label}</p>
      <p className={`mono ${className ?? "text-palantir-text"} truncate`}>{value}</p>
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
  const [confirmVal, setConfirmVal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setError(null);
    if (pin.length < 4 || pin.length > 8) return setError("PIN entre 4 e 8 dígitos");
    if (pin !== confirmVal) return setError("Confirmação diferente");
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
    <Modal onClose={onClose} title={`Definir PIN — ${pdv.name}`}>
      <p className="mono text-[11px] text-palantir-muted mb-4">
        slug: <span className="text-palantir-blue">{pdv.slug}</span>
      </p>

      <Field label="PIN (4-8 dígitos)">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          autoFocus
          className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-3 text-xl tracking-[0.5em] text-white focus-ring-admin"
        />
      </Field>
      <Field label="Confirmar">
        <input
          value={confirmVal}
          onChange={(e) => setConfirmVal(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-3 text-xl tracking-[0.5em] text-white focus-ring-admin"
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
    <Modal onClose={onClose} title={`PIN criado — ${pdv.name}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="size-10 rounded-full bg-palantir-green/15 grid place-items-center text-palantir-green">
          <Check className="size-5" />
        </div>
        <div>
          <p className="mono text-[10px] tracking-widest text-palantir-green">PIN CRIADO</p>
          <p className="text-sm text-palantir-text">O PDV agora pode entrar no painel.</p>
        </div>
      </div>

      <p className="text-sm text-palantir-text mb-3">
        Compartilhe o link abaixo no WhatsApp do operador.
      </p>

      <div className="rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 flex items-center gap-2">
        <code className="mono text-xs text-palantir-blue flex-1 truncate">{url}</code>
        <button
          onClick={copyLink}
          className="mono min-h-touch text-[10px] uppercase text-palantir-muted hover:text-palantir-text px-2 focus-ring-admin"
        >
          Copiar
        </button>
      </div>

      <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2">
        <button
          onClick={onClose}
          className="mono text-xs text-palantir-muted px-3 min-h-touch focus-ring-admin"
        >
          Fechar
        </button>
        <a
          href={`/loja/${pdv.slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-admin bg-palantir-blue px-4 min-h-touch text-sm text-white inline-flex items-center justify-center gap-2 focus-ring-admin"
        >
          Abrir painel do PDV
          <ExternalLink className="size-4" />
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
  const [logoMode, setLogoMode] = useState<"emoji" | "image">(
    isImageLogo(pdv.logo_url) ? "image" : "emoji"
  );
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("pdv_id", pdv.id);
    fd.append("kind", "logo");
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "Falha no upload");
      return;
    }
    const data = await r.json();
    set("logo_url", data.url);
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
    <Modal onClose={onClose} title={`Editar PDV — ${pdv.name}`}>
      <p className="mono text-[11px] text-palantir-muted mb-4">
        slug: <span className="text-palantir-blue">{pdv.slug}</span>
        <span className="ml-2 text-palantir-muted/60">(não editável)</span>
      </p>

      <Field label="Logo">
        <div className="flex items-center gap-3">
          <div className="size-16 shrink-0 rounded-admin border border-palantir-border bg-palantir-bg overflow-hidden grid place-items-center">
            <PdvLogo logoUrl={form.logo_url} size={64} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex gap-1 rounded-admin border border-palantir-border p-1 bg-palantir-bg w-fit">
              <button
                type="button"
                onClick={() => {
                  setLogoMode("emoji");
                  if (isImageLogo(form.logo_url)) set("logo_url", "🍽");
                }}
                className={`mono px-3 py-1 text-[10px] uppercase rounded ${
                  logoMode === "emoji"
                    ? "bg-palantir-blue text-white"
                    : "text-palantir-muted hover:text-palantir-text"
                }`}
              >
                Emoji
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogoMode("image");
                  if (!isImageLogo(form.logo_url)) set("logo_url", "");
                }}
                className={`mono px-3 py-1 text-[10px] uppercase rounded ${
                  logoMode === "image"
                    ? "bg-palantir-blue text-white"
                    : "text-palantir-muted hover:text-palantir-text"
                }`}
              >
                Imagem
              </button>
            </div>
            {logoMode === "emoji" ? (
              <input
                value={isImageLogo(form.logo_url) ? "" : form.logo_url}
                onChange={(e) => set("logo_url", e.target.value.slice(0, 4))}
                placeholder="🍽"
                className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-2xl text-white focus-ring-admin"
              />
            ) : (
              <div className="flex items-center gap-2">
                <label className="mono cursor-pointer rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch grid place-items-center text-[10px] uppercase text-palantir-text hover:bg-palantir-surface2 focus-within:outline focus-within:outline-2 focus-within:outline-palantir-blue">
                  {uploading ? "Enviando..." : form.logo_url ? "Trocar imagem" : "Enviar imagem"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFile}
                    disabled={uploading}
                  />
                </label>
                {isImageLogo(form.logo_url) && (
                  <button
                    type="button"
                    onClick={() => set("logo_url", "")}
                    className="mono min-h-touch px-2 text-[10px] uppercase text-palantir-red focus-ring-admin"
                  >
                    Remover
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Field>

      <Field label="Nome">
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
        />
      </Field>

      <Field label="Categoria">
        <input
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
          className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Instagram (@)">
          <input
            value={form.instagram_handle}
            onChange={(e) => set("instagram_handle", e.target.value)}
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
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
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
  title,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-h-[90dvh] sm:max-h-[85dvh] overflow-y-auto rounded-t-xl sm:rounded-admin border border-palantir-border bg-palantir-surface p-4 sm:p-5 space-y-3 pb-safe ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
      >
        <div className="flex items-start justify-between gap-3 -mb-1">
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-touch -mr-2 -mt-1 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
          >
            <X className="size-5" />
          </button>
        </div>
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
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3">
      <button
        onClick={onCancel}
        className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
      >
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={loading}
        className="rounded-admin bg-palantir-blue min-h-touch px-4 text-sm text-white disabled:opacity-40 focus-ring-admin"
      >
        {loading ? "Salvando..." : label}
      </button>
    </div>
  );
}

// ── PDV Detail Dialog ────────────────────────────────────────────

interface ProductLite {
  id: string;
  name: string;
  category: string | null;
  price: number;
  status: string;
  stock_quantity: number | null;
  image_url: string | null;
}

const STATUS_CLS: Record<string, string> = {
  active: "text-palantir-green",
  paused: "text-palantir-yellow",
  out_of_stock: "text-palantir-red",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  out_of_stock: "Esgotado",
};

function PdvDetailDialog({
  pdv,
  onClose,
  onEdit,
}: {
  pdv: AdminPdvRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/products?pdv_id=${pdv.id}`)
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pdv.id]);

  const active = products.filter((p) => p.status === "active").length;
  const totalStock = products.reduce((s, p) => s + (p.stock_quantity ?? 0), 0);
  const saleValue = products.reduce(
    (s, p) => s + (p.stock_quantity != null ? p.price * p.stock_quantity : 0),
    0
  );

  return (
    <Modal onClose={onClose} title={pdv.name} wide>
      {/* PDV info header */}
      <div className="flex items-center gap-4 -mt-1 pb-3 border-b border-palantir-border">
        <div className="size-16 shrink-0 rounded-admin border border-palantir-border bg-palantir-bg overflow-hidden grid place-items-center">
          <PdvLogo logoUrl={pdv.logo_url} size={56} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mono text-[10px] text-palantir-blue">{pdv.slug}</p>
          {pdv.category && (
            <p className="mono text-[10px] text-palantir-muted">{pdv.category}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span className="mono text-palantir-muted">
              Comissão: <span className="text-palantir-text">{pdv.commission_pct}%</span>
            </span>
            <span className="mono text-palantir-muted">
              Preparo: <span className="text-palantir-text">{pdv.prep_time_min} min</span>
            </span>
            <span className="mono text-palantir-muted">
              Carteira: <span className="text-palantir-green">{brl(pdv.wallet_balance)}</span>
            </span>
            <span className={`mono font-semibold ${pdv.is_open ? "text-palantir-green" : "text-palantir-red"}`}>
              {pdv.is_open ? "● ABERTO" : "● FECHADO"}
            </span>
          </div>
        </div>
        <button
          onClick={onEdit}
          title="Editar PDV"
          className="grid size-9 place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 shrink-0 focus-ring-admin"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      {/* Stats */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-3 gap-2 py-2 border-b border-palantir-border">
          <MiniStat label="Produtos" value={`${products.length}`} sub={`${active} ativos`} />
          <MiniStat label="Estoque total" value={`${totalStock} un`} />
          <MiniStat label="Prev. venda" value={brl(saleValue)} tone="blue" />
        </div>
      )}

      {/* Products list */}
      <div className="space-y-1 max-h-80 overflow-y-auto term-scroll">
        {loading && (
          <p className="mono text-[11px] text-palantir-muted py-4 text-center">Carregando produtos...</p>
        )}
        {!loading && products.length === 0 && (
          <p className="mono text-[11px] text-palantir-muted py-4 text-center">Nenhum produto cadastrado.</p>
        )}
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-admin border border-palantir-border bg-palantir-bg px-2 py-1.5"
          >
            <div className="size-8 shrink-0 rounded bg-palantir-surface2 border border-palantir-border overflow-hidden grid place-items-center">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-palantir-muted text-[10px]">—</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-palantir-text truncate">{p.name}</p>
              {p.category && (
                <p className="mono text-[9px] text-palantir-muted">{p.category}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="mono text-sm text-palantir-text">{brl(p.price)}</p>
              {p.stock_quantity != null && (
                <p className={`mono text-[9px] ${p.stock_quantity === 0 ? "text-palantir-red" : "text-palantir-muted"}`}>
                  {p.stock_quantity} un
                </p>
              )}
            </div>
            <span className={`mono text-[9px] uppercase w-14 text-right shrink-0 ${STATUS_CLS[p.status] ?? "text-palantir-muted"}`}>
              {STATUS_LABEL[p.status] ?? p.status}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 pt-2 border-t border-palantir-border">
        <button
          onClick={onClose}
          className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
        >
          Fechar
        </button>
        <a
          href={`/loja/${pdv.slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-admin bg-palantir-blue min-h-touch px-4 text-sm text-white inline-flex items-center justify-center gap-2 focus-ring-admin"
        >
          Abrir painel do PDV
          <ExternalLink className="size-4" />
        </a>
      </div>
    </Modal>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "blue" | "green";
}) {
  const cls = tone === "blue" ? "text-palantir-blue" : tone === "green" ? "text-palantir-green" : "text-palantir-text";
  return (
    <div className="rounded-admin border border-palantir-border bg-palantir-bg p-2 text-center">
      <p className="mono text-[9px] uppercase text-palantir-muted">{label}</p>
      <p className={`mono text-sm font-semibold ${cls}`}>{value}</p>
      {sub && <p className="mono text-[9px] text-palantir-muted">{sub}</p>}
    </div>
  );
}
