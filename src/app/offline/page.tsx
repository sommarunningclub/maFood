export const metadata = { title: "Sem conexão — SommaFood" };

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-somma-bg px-6 text-center">
      <div className="max-w-sm">
        <p className="text-6xl mb-4">📡</p>
        <h1 className="text-2xl font-display uppercase tracking-wide text-white mb-2">
          Sem conexão
        </h1>
        <p className="text-sm text-somma-muted">
          Você está offline. Assim que voltar à rede, recarregue a página para continuar.
        </p>
      </div>
    </div>
  );
}
