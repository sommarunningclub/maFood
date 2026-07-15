"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/customer/ui/confirm-sheet";
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
  postal_code: string | null;
  address_number: string | null;
  address_complement: string | null;
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
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
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
  const { confirm, confirmElement } = useConfirm();
  const [customer, setCustomer] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ? maskPhone(initial.phone) : "");
  const [postalCode, setPostalCode] = useState(initial.postal_code ?? "");
  const [addressNumber, setAddressNumber] = useState(initial.address_number ?? "");
  const [addressComplement, setAddressComplement] = useState(
    initial.address_complement ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name.trim() !== customer.name ||
    email.trim() !== (customer.email ?? "") ||
    phone.replace(/\D/g, "") !== (customer.phone ?? "") ||
    postalCode.replace(/\D/g, "") !== (customer.postal_code ?? "") ||
    addressNumber.trim() !== (customer.address_number ?? "") ||
    addressComplement.trim() !== (customer.address_complement ?? "");

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
        postal_code: postalCode.replace(/\D/g, ""),
        address_number: addressNumber.trim(),
        address_complement: addressComplement.trim() || null,
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
    const ok = await confirm({
      title: "Sair da conta?",
      description: "Você precisará se identificar novamente para pedir.",
      confirmLabel: "Sair",
      destructive: true,
    });
    if (!ok) return;
    setLoggingOut(true);
    await fetch("/api/customer/logout", { method: "POST" });
    router.push(`/${venue}/login`);
    router.refresh();
  }

  return (
    <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe pb-safe">
      {confirmElement}
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link
          href={`/${venue}`}
          aria-label="Voltar à praça"
          className="grid size-touch -ml-2 place-items-center text-mafood-text-secondary hover:text-mafood-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="mafood-display text-fluid-2xl text-mafood-text-primary">
          Minha conta
        </h1>
      </header>

      {/* Identidade */}
      <section className="mt-6 flex items-center gap-4">
        <div className="size-16 shrink-0 grid place-items-center rounded-full bg-mafood-primary/15 border border-mafood-primary/30 text-mafood-primary-strong mafood-display text-xl">
          {initials || <UserIcon className="size-7" />}
        </div>
        <div className="min-w-0">
          <p className="text-mafood-text-primary text-lg font-medium truncate">{customer.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {customer.is_vip && (
              <span className="num text-[9px] uppercase bg-mafood-primary/15 text-mafood-primary-strong px-1.5 py-0.5 rounded">
                VIP
              </span>
            )}
            <span className="num text-[11px] text-mafood-text-secondary">
              Cliente desde {memberSince}
            </span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href={`/${venue}/history`}
          className="rounded-mafood-md border border-mafood-border bg-mafood-surface-strong p-4 active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        >
          <div className="flex items-center gap-2 text-mafood-text-secondary">
            <ShoppingBag className="size-4" />
            <span className="num text-[10px] uppercase tracking-wider">Pedidos</span>
          </div>
          <p className="num text-2xl text-mafood-text-primary mt-1">{ordersCount}</p>
          <p className="num text-[10px] text-mafood-primary-strong mt-1">Ver histórico →</p>
        </Link>
        <div className="rounded-mafood-md border border-mafood-border bg-mafood-surface-strong p-4">
          <div className="flex items-center gap-2 text-mafood-text-secondary">
            <UserIcon className="size-4" />
            <span className="num text-[10px] uppercase tracking-wider">CPF</span>
          </div>
          <p className="num text-base text-mafood-text-primary mt-2 tracking-wide">
            {maskCpf(customer.cpf)}
          </p>
          <p className="num text-[10px] text-mafood-text-secondary mt-1">não editável</p>
        </div>
      </section>

      {/* Formulário de dados */}
      <section className="mt-6 space-y-3">
        <p className="num text-[11px] text-mafood-text-secondary uppercase tracking-wider">
          Dados pessoais
        </p>

        <Field label="Nome completo" icon={<UserIcon className="size-4" />}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            className="w-full bg-transparent text-mafood-text-primary text-base outline-none placeholder:text-mafood-text-secondary/60"
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
            autoComplete="email"
            placeholder="seu@email.com"
            className="w-full bg-transparent text-mafood-text-primary text-base outline-none placeholder:text-mafood-text-secondary/60"
          />
        </Field>

        <Field label="Telefone" icon={<Phone className="size-4" />}>
          <input
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            className="w-full bg-transparent text-mafood-text-primary text-base outline-none placeholder:text-mafood-text-secondary/60"
          />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="CEP" icon={<Mail className="size-4" />}>
            <input
              value={maskCep(postalCode)}
              onChange={(e) =>
                setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              className="w-full bg-transparent text-mafood-text-primary text-base outline-none placeholder:text-mafood-text-secondary/60"
            />
          </Field>
          <Field label="Nº" icon={<UserIcon className="size-4" />}>
            <input
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value.slice(0, 20))}
              inputMode="numeric"
              placeholder="123"
              className="w-full bg-transparent text-mafood-text-primary text-base outline-none placeholder:text-mafood-text-secondary/60"
            />
          </Field>
        </div>

        <Field label="Complemento" icon={<UserIcon className="size-4" />}>
          <input
            value={addressComplement}
            onChange={(e) => setAddressComplement(e.target.value)}
            placeholder="Apto, bloco… (opcional)"
            className="w-full bg-transparent text-mafood-text-primary text-base outline-none placeholder:text-mafood-text-secondary/60"
          />
        </Field>

        {error && (
          <p
            role="alert"
            className="text-sm text-mafood-accent-dark border border-mafood-accent-dark/30 bg-mafood-accent-dark/10 px-3 py-2 rounded-mafood-md"
          >
            {error}
          </p>
        )}

        <button
          onClick={() => void save()}
          disabled={!dirty || saving}
          className={`w-full rounded-mafood-md min-h-touch h-12 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary disabled:opacity-40 ${
            saved
              ? "bg-mafood-success-strong text-white"
              : "bg-mafood-primary-strong text-white"
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
      <section className="mt-8 border-t border-mafood-border pt-5">
        <button
          onClick={() => void logout()}
          disabled={loggingOut}
          className="w-full inline-flex items-center justify-center gap-2 rounded-mafood-md border border-mafood-border min-h-touch h-12 text-mafood-text-secondary hover:text-mafood-accent-dark hover:border-mafood-accent-dark/40 num text-xs uppercase tracking-widest transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
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
    <label className="block rounded-mafood-md border border-mafood-border bg-mafood-surface-strong px-3 py-2.5 focus-within:border-mafood-primary transition-colors">
      <span className="num text-[10px] text-mafood-text-secondary uppercase tracking-wider flex items-center gap-1.5">
        <span className="text-mafood-primary-strong/70">{icon}</span>
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
