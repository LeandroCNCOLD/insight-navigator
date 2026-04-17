export const formatBRL = (v?: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export const formatNumber = (v?: number | null, digits = 0) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(v);

export const formatDate = (v?: string | null) =>
  v == null
    ? "—"
    : (() => {
        const date = new Date(v);
        if (Number.isNaN(date.getTime())) return "—";
        return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
      })();

export const formatBytes = (bytes?: number | null) => {
  if (!bytes) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

export const statusLabel: Record<string, string> = {
  uploaded: "Carregado",
  queued: "Na fila",
  processing: "Processando",
  extracted: "Extraído",
  failed: "Falhou",
  archived: "Arquivado",
};
