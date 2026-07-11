"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  LogOut,
  Mail,
  Phone,
  ShoppingBag,
  User as UserIcon,
} from "lucide-react";

interface CustomerData {
  id: string;
  name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
  is_vip: boolean;
  created_at: string;
}

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function AccountView({
  venue,
  customer: initial,
  ordersCount,
}: {
  venue: string;
  customer: CustomerData;
  ordersCount: number;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ? maskPhone(initial.phone) : "");

  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name.trim() !== customer.name ||
    email.trim() !== (customer.email ?? "") ||
    phone.replace(/\D/g, "") !== (customer.phone ?? "");

  const initials = customer.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const memberSince = new Date(customer.created_at).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  async function save() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Informe seu nome completo");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/customer/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        phone: phone.replace(/\D/g, ""),
      }),
    });
    setSaving(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.error ?? "Não foi possível salvar");
      return;
    }
    setCustomer(data.customer);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  async function logout() {
    if (!window.confirm("Deseja sair da sua conta?")) return;
    setLoggingOut(true);
    await fetch("/api/customer/logout", { method: "POST" });
    router.push(`/${venue}/login`);
    router.refresh();
  }

  return (
    <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe somma-grain">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link
          href={`/${venue}`}
          aria-label="Voltar à praça"
          className="grid size-touch -ml-2 place-items-center text-somma-muted hover:text-white focus-ring"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-fluid-2xl text-white font-display uppercase tracking-wide">
          Minha conta
        </h1>
      </header>

      {/* Identidade */}
      <section className="mt-6 flex items-center gap-4">
        <div className="size-16 shrink-0 grid place-items-center rounded-full bg-somma-orange/15 border border-somma-orange/30 text-somma-orange font-display text-xl">
          {initials || <UserIcon className="size-7" />}
        </div>
        <div className="min-w-0">
          <p className="text-white text-lg font-medium truncate">{customer.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {customer.is_vip && (
              <span className="num text-[9px] uppercase bg-somma-orange/15 text-somma-orange px-1.5 py-0.5 rounded">
                VIP
              </span>
            )}
            <span className="num text-[11px] text-somma-muted">
              Cliente desde {memberSince}
            </span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href={`/${venue}/history`}
          className="rounded-client border border-somma-border bg-somma-surface p-4 active:scale-[0.98] transition-transform focus-ring"
        >
          <div className="flex items-center gap-2 text-somma-muted">
            <ShoppingBag className="size-4" />
            <span className="num text-[10px] uppercase tracking-wider">Pedidos</span>
          </div>
          <p className="num text-2xl text-white mt-1">{ordersCount}</p>
          <p className="num text-[10px] text-somma-orange mt-1">Ver histórico →</p>
        </Link>
        <div className="rounded-client border border-somma-border bg-somma-surface p-4">
          <div className="flex items-center gap-2 text-somma-muted">
            <UserIcon className="size-4" />
            <span className="num text-[10px] uppercase tracking-wider">CPF</span>
          </div>
          <p className="num text-base text-white mt-2 tracking-wide">
            {maskCpf(customer.cpf)}
          </p>
          <p className="num text-[10px] text-somma-muted mt-1">não editável</p>
        </div>
      </section>

      {/* Formulário de dados */}
      <section className="mt-6 space-y-3">
        <p className="num text-[11px] text-somma-muted uppercase tracking-wider">
          Dados pessoais
        </p>

        <Field label="Nome completo" icon={<UserIcon className="size-4" />}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="w-full bg-transparent text-white text-sm outline-none placeholder:text-somma-muted/60"
          />
        </Field>

        <Field label="E-mail" icon={<Mail className="size-4" />}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="seu@email.com"
            className="w-full bg-transparent text-white text-sm outline-none placeholder:text-somma-muted/60"
          />
        </Field>

        <Field label="Telefone" icon={<Phone className="size-4" />}>
          <input
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            inputMode="numeric"
            placeholder="(00) 00000-0000"
            className="w-full bg-transparent text-white text-sm outline-none placeholder:text-somma-muted/60"
          />
        </Field>

        {error && (
          <p
            role="alert"
            className="text-sm text-somma-red border border-somma-red/30 bg-somma-red/10 px-3 py-2 rounded-client"
          >
            {error}
          </p>
        )}

        <button
          onClick={() => void save()}
          disabled={!dirty || saving}
          className={`w-full rounded-client min-h-touch h-12 font-display uppercase tracking-wide transition-colors focus-ring disabled:opacity-40 ${
            saved
              ? "bg-somma-green/90 text-black"
              : "bg-somma-orange text-white"
          }`}
        >
          {saving ? (
            "Salvando…"
          ) : saved ? (
            <span className="inline-flex items-center gap-2">
              <Check className="size-4" /> Salvo
            </span>
          ) : (
            "Salvar alterações"
          )}
        </button>
      </section>

      {/* Sair */}
      <section className="mt-8 border-t border-somma-border pt-5">
        <button
          onClick={() => void logout()}
          disabled={loggingOut}
          className="w-full inline-flex items-center justify-center gap-2 rounded-client border border-somma-border min-h-touch h-12 text-somma-muted hover:text-somma-red hover:border-somma-red/40 num text-xs uppercase tracking-widest transition-colors disabled:opacity-50 focus-ring"
        >
          <LogOut className="size-4" />
          {loggingOut ? "Saindo…" : "Sair da conta"}
        </button>
      </section>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-client border border-somma-border bg-somma-surface px-3 py-2.5 focus-within:border-somma-orange transition-colors">
      <span className="num text-[10px] text-somma-muted uppercase tracking-wider flex items-center gap-1.5">
        <span className="text-somma-orange/70">{icon}</span>
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
