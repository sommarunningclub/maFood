import { NextResponse } from "next/server";

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
};

function safeErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { type: typeof error };
  }

  const value = error as ErrorLike;
  return {
    name: typeof value.name === "string" ? value.name : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
    code:
      typeof value.code === "string" || typeof value.code === "number"
        ? value.code
        : undefined,
  };
}

/**
 * Registra detalhes técnicos apenas no servidor e devolve uma referência
 * segura para suporte. Nunca passe payloads, CPF, cartão ou tokens em context.
 */
export function logServerError(context: string, error: unknown): string {
  const requestId = crypto.randomUUID();
  console.error(`[${context}]`, {
    requestId,
    error: safeErrorDetails(error),
  });
  return requestId;
}

export function internalErrorResponse(
  context: string,
  error: unknown,
  publicMessage = "Não foi possível concluir a operação"
) {
  const requestId = logServerError(context, error);
  return NextResponse.json(
    { error: publicMessage, request_id: requestId },
    { status: 500 }
  );
}

export function upstreamErrorResponse(
  context: string,
  error: unknown,
  publicMessage = "Serviço temporariamente indisponível"
) {
  const requestId = logServerError(context, error);
  return NextResponse.json(
    { error: publicMessage, request_id: requestId },
    { status: 502 }
  );
}
