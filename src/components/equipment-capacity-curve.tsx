import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Plus, Trash2, Wand2, Thermometer } from "lucide-react";

type CurvePoint = {
  id: string;
  marca: string | null;
  modelo: string;
  gas_refrigerante: string | null;
  temp_evaporacao_c: number;
  temp_ambiente_c: number | null;
  capacidade_kcal_h: number;
  potencia_hp: number | null;
  fonte: string;
  proposal_id: string | null;
  observacoes: string | null;
};

type SeedPoint = {
  marca: string | null;
  modelo: string;
  gas_refrigerante: string | null;
  temp_evaporacao_c: number;
  capacidade_kcal_h: number;
  potencia_hp: number | null;
  proposal_id: string | null;
};

const tt = {
  background: "oklch(0.19 0.006 260)",
  border: "1px solid oklch(0.27 0.008 260)",
  borderRadius: 8,
  fontSize: 12,
};

const GAS_COLORS: Record<string, string> = {
  R404A: "oklch(0.65 0.20 250)",
  R134A: "oklch(0.68 0.17 152)",
  R134a: "oklch(0.68 0.17 152)",
  R290: "oklch(0.72 0.18 60)",
  R407C: "oklch(0.65 0.18 320)",
  R449A: "oklch(0.70 0.15 30)",
  R448A: "oklch(0.62 0.16 180)",
  default: "oklch(0.66 0.012 260)",
};
function colorFor(gas: string) {
  return GAS_COLORS[gas] || GAS_COLORS.default;
}

export function EquipmentCapacityCurve({
  marca,
  modelo,
  seedFromProposals,
}: {
  marca: string;
  modelo: string;
  seedFromProposals: SeedPoint[];
}) {
  const qc = useQueryClient();
  const queryKey = ["capacity-curve", marca, modelo];

  const { data: points = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_capacity_curves")
        .select("*")
        .eq("modelo", modelo)
        .eq("marca", marca)
        .order("temp_evaporacao_c", { ascending: true });
      if (error) throw error;
      return (data || []) as CurvePoint[];
    },
  });

  const insertMut = useMutation({
    mutationFn: async (rows: Omit<CurvePoint, "id">[]) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const payload = rows.map((r) => ({ ...r, owner_id: u.user!.id }));
      const { error } = await supabase.from("equipment_capacity_curves").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Pontos adicionados à curva");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment_capacity_curves").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Ponto removido");
    },
  });

  // Group points by gas for multi-line chart
  const chartData = useMemo(() => {
    const byTemp = new Map<number, Record<string, number | string>>();
    points.forEach((p) => {
      const t = Number(p.temp_evaporacao_c);
      if (!byTemp.has(t)) byTemp.set(t, { temp: t });
      const row = byTemp.get(t)!;
      const gas = p.gas_refrigerante || "—";
      row[gas] = Number(p.capacidade_kcal_h);
    });
    return Array.from(byTemp.values()).sort((a, b) => Number(a.temp) - Number(b.temp));
  }, [points]);

  const gases = useMemo(
    () => Array.from(new Set(points.map((p) => p.gas_refrigerante || "—"))),
    [points]
  );

  // Manual add form
  const [form, setForm] = useState({ temp: "", capacidade: "", gas: "", obs: "" });
  function addManual() {
    const t = Number(form.temp);
    const c = Number(form.capacidade);
    if (isNaN(t) || isNaN(c) || c <= 0) {
      toast.error("Informe temperatura e capacidade válidas");
      return;
    }
    insertMut.mutate([
      {
        marca,
        modelo,
        tipo: null as any,
        gas_refrigerante: form.gas || null,
        temp_evaporacao_c: t,
        temp_ambiente_c: null,
        capacidade_kcal_h: c,
        potencia_hp: null,
        fonte: "manual",
        proposal_id: null,
        observacoes: form.obs || null,
      } as any,
    ]);
    setForm({ temp: "", capacidade: "", gas: "", obs: "" });
  }

  function seedFromBase() {
    // Filter unique points from proposals (modelo+temp+gas+capacidade combo)
    const uniq = new Map<string, SeedPoint>();
    seedFromProposals.forEach((sp) => {
      const k = `${sp.temp_evaporacao_c}::${sp.gas_refrigerante || ""}::${sp.capacidade_kcal_h}`;
      if (!uniq.has(k)) uniq.set(k, sp);
    });
    const rows = Array.from(uniq.values()).map(
      (sp) =>
        ({
          marca: sp.marca,
          modelo: sp.modelo,
          tipo: null,
          gas_refrigerante: sp.gas_refrigerante,
          temp_evaporacao_c: sp.temp_evaporacao_c,
          temp_ambiente_c: null,
          capacidade_kcal_h: sp.capacidade_kcal_h,
          potencia_hp: sp.potencia_hp,
          fonte: "proposta",
          proposal_id: sp.proposal_id,
          observacoes: "Importado automaticamente da proposta",
        }) as any
    );
    if (rows.length === 0) {
      toast.info("Nenhuma proposta tem temperatura + capacidade preenchidas para este modelo");
      return;
    }
    insertMut.mutate(rows);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
          <Thermometer className="h-3 w-3" /> Curva capacidade × temperatura
        </h4>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {points.length} ponto(s)
          </Badge>
          {seedFromProposals.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={seedFromBase}
              disabled={insertMut.isPending}
            >
              <Wand2 className="h-3 w-3 mr-1" /> Gerar das propostas ({seedFromProposals.length})
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Carregando curva...</p>
      ) : chartData.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 bg-background/30 p-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            Nenhum ponto cadastrado. Adicione manualmente abaixo ou gere a partir das propostas.
          </p>
        </div>
      ) : (
        <div className="h-56 rounded-md border border-border/40 bg-background/30 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} />
              <XAxis
                dataKey="temp"
                stroke="oklch(0.66 0.012 260)"
                fontSize={10}
                label={{
                  value: "Temp. evaporação (°C)",
                  position: "insideBottom",
                  offset: -2,
                  fontSize: 10,
                  fill: "oklch(0.66 0.012 260)",
                }}
              />
              <YAxis
                stroke="oklch(0.66 0.012 260)"
                fontSize={10}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip contentStyle={tt} formatter={(v: any) => `${Number(v).toLocaleString("pt-BR")} kcal/h`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine x={0} stroke="oklch(0.50 0.02 260)" strokeDasharray="3 3" />
              {gases.map((gas) => (
                <Line
                  key={gas}
                  type="monotone"
                  dataKey={gas}
                  name={gas}
                  stroke={colorFor(gas)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Add manual point */}
      <div className="rounded-md border border-border/40 bg-background/30 p-2.5">
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Temp. evap. (°C)</label>
            <Input
              type="number"
              step="0.5"
              value={form.temp}
              onChange={(e) => setForm((f) => ({ ...f, temp: e.target.value }))}
              className="h-7 text-xs w-24"
              placeholder="-10"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Capacidade (kcal/h)</label>
            <Input
              type="number"
              value={form.capacidade}
              onChange={(e) => setForm((f) => ({ ...f, capacidade: e.target.value }))}
              className="h-7 text-xs w-32"
              placeholder="3500"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Gás</label>
            <Input
              value={form.gas}
              onChange={(e) => setForm((f) => ({ ...f, gas: e.target.value }))}
              className="h-7 text-xs w-24"
              placeholder="R404A"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] text-muted-foreground block mb-0.5">Observação</label>
            <Input
              value={form.obs}
              onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
              className="h-7 text-xs"
              placeholder="ex: datasheet fabricante, Tamb=32°C"
            />
          </div>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            onClick={addManual}
            disabled={insertMut.isPending}
          >
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Points table */}
      {points.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground border-b border-border/40">
              <tr>
                <th className="text-left py-1 pr-2">Temp °C</th>
                <th className="text-right py-1 pr-2">kcal/h</th>
                <th className="text-left py-1 pr-2">Gás</th>
                <th className="text-left py-1 pr-2">Fonte</th>
                <th className="text-left py-1 pr-2">Observação</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.id} className="border-b border-border/20">
                  <td className="py-1 pr-2 font-mono">{Number(p.temp_evaporacao_c).toFixed(1)}</td>
                  <td className="py-1 pr-2 text-right font-mono">
                    {Number(p.capacidade_kcal_h).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-1 pr-2">{p.gas_refrigerante || "—"}</td>
                  <td className="py-1 pr-2">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {p.fonte}
                    </Badge>
                  </td>
                  <td className="py-1 pr-2 text-muted-foreground truncate max-w-[200px]">
                    {p.observacoes || "—"}
                  </td>
                  <td className="py-1">
                    <button
                      onClick={() => deleteMut.mutate(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
