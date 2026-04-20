import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, KpiCard, EmptyState } from "@/components/dashboard-bits";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  Wrench,
  Zap,
  Snowflake,
  ChevronDown,
  ChevronRight,
  Search,
  Thermometer,
  Gauge,
  Factory,
  Layers,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { EquipmentCapacityCurve } from "@/components/equipment-capacity-curve";

export const Route = createFileRoute("/app/dashboards/technical")({
  component: Tech,
  head: () => ({ meta: [{ title: "Painel técnico — DocIntel" }] }),
});

type EquipRow = {
  id: string;
  proposal_id: string;
  tipo: string | null;
  modelo: string | null;
  marca: string | null;
  capacidade_kcal: number | null;
  potencia_hp: number | null;
  gas_refrigerante: string | null;
  compressor: string | null;
  tipo_condensacao: string | null;
  tipo_degelo: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  observacoes: string | null;
};

type ProposalCtx = {
  id: string;
  numero: string | null;
  data_proposta: string | null;
  valor_total: number | null;
  dados_tecnicos: any;
  client: { id: string; nome: string; cidade: string | null; estado: string | null } | null;
  competitor: { id: string; nome: string } | null;
};

type ModelGroup = {
  key: string;
  modelo: string;
  marca: string;
  tipo: string;
  occurrences: Array<EquipRow & { ctx: ProposalCtx | null; capacidadeUnitaria: number | null; tempEvap: number | null }>;
  totalQty: number;
  capacidadeKcal: { min: number; max: number; avg: number } | null;
  capacidadeKcalUnit: { min: number; max: number; avg: number } | null;
  potenciaHp: { min: number; max: number; avg: number } | null;
  valorUnit: { min: number; max: number; avg: number } | null;
  gases: string[];
  compressores: string[];
  condensacoes: string[];
  degelos: string[];
  temperaturas: { min: number; max: number } | null;
  cargasTermicas: { min: number; max: number; avg: number } | null;
  tensoes: string[];
  aplicacoes: string[];
  fluidosArmazenados: string[];
  clientes: string[];
};

// Heuristic: infer unit capacity from registered total when value seems aggregated.
// If quantidade > 1 and capacidade_kcal divides cleanly OR is suspiciously large
// (>= 4x quantidade), assume it's a total and divide. Otherwise treat as unitary.
function inferUnitCapacity(
  rawCapacidade: number | null | undefined,
  qty: number | null | undefined
): number | null {
  const c = Number(rawCapacidade);
  const q = Math.max(1, Number(qty) || 1);
  if (!c || isNaN(c) || c <= 0) return null;
  if (q <= 1) return c;
  // If capacity divides evenly by quantity AND quotient is plausible (>=200 kcal/h), treat as total.
  if (c % q === 0 && c / q >= 200) return c / q;
  // If capacity is "very large" relative to a single unit (heuristic ratio), divide.
  if (c >= q * 1000) return c / q;
  // Otherwise assume already unitary.
  return c;
}

function Tech() {
  const { data, isLoading } = useQuery({
    queryKey: ["dash-tech-catalog"],
    queryFn: async () => {
      const [{ data: equips }, { data: props }] = await Promise.all([
        supabase.from("equipments").select("*"),
        supabase
          .from("proposals")
          .select(
            "id, numero, data_proposta, valor_total, dados_tecnicos, client:clients(id, nome, cidade, estado), competitor:competitors(id, nome)"
          ),
      ]);
      return { equips: (equips || []) as EquipRow[], props: (props || []) as any[] };
    },
  });

  const propMap = useMemo(() => {
    const m = new Map<string, ProposalCtx>();
    (data?.props || []).forEach((p: any) => m.set(p.id, p as ProposalCtx));
    return m;
  }, [data]);

  // Aggregate equipments by model+brand+type
  const groups: ModelGroup[] = useMemo(() => {
    const map = new Map<string, ModelGroup>();
    (data?.equips || []).forEach((e) => {
      const modelo = (e.modelo || "Sem modelo").trim();
      const marca = (e.marca || "Sem marca").trim();
      const tipo = (e.tipo || "Não informado").trim();
      const key = `${marca}::${modelo}::${tipo}`.toLowerCase();
      const ctx = propMap.get(e.proposal_id) || null;
      const dt = ctx?.dados_tecnicos || {};

      let g = map.get(key);
      if (!g) {
        g = {
          key,
          modelo,
          marca,
          tipo,
          occurrences: [],
          totalQty: 0,
          capacidadeKcal: null,
          capacidadeKcalUnit: null,
          potenciaHp: null,
          valorUnit: null,
          gases: [],
          compressores: [],
          condensacoes: [],
          degelos: [],
          temperaturas: null,
          cargasTermicas: null,
          tensoes: [],
          aplicacoes: [],
          fluidosArmazenados: [],
          clientes: [],
        };
        map.set(key, g);
      }
      const grp = g;
      const tempEvap = pickNum(dt, [
        "temperatura_evaporacao",
        "temp_evaporacao",
        "temperatura_c",
        "temperatura",
        "temp_camara",
        "temp_operacao",
      ]);
      const capacidadeUnitaria = inferUnitCapacity(e.capacidade_kcal, e.quantidade);
      grp.occurrences.push({ ...e, ctx, capacidadeUnitaria, tempEvap });
      grp.totalQty += Number(e.quantidade) || 1;

      pushUniq(grp.gases, e.gas_refrigerante);
      pushUniq(grp.compressores, e.compressor);
      pushUniq(grp.condensacoes, e.tipo_condensacao);
      pushUniq(grp.degelos, e.tipo_degelo);

      // Pull context from dados_tecnicos JSON (varies per extraction)
      pushUniq(grp.tensoes, pickStr(dt, ["tensao", "voltagem", "alimentacao"]));
      pushUniq(grp.aplicacoes, pickStr(dt, ["aplicacao", "uso", "finalidade", "tipo_camara"]));
      pushUniq(grp.fluidosArmazenados, pickStr(dt, ["produto_armazenado", "fluido", "carga"]));
      if (ctx?.client?.nome) pushUniq(grp.clientes, ctx.client.nome);

      if (tempEvap != null) {
        if (!grp.temperaturas) grp.temperaturas = { min: tempEvap, max: tempEvap };
        else {
          grp.temperaturas.min = Math.min(grp.temperaturas.min, tempEvap);
          grp.temperaturas.max = Math.max(grp.temperaturas.max, tempEvap);
        }
      }
      const carga = pickNum(dt, ["carga_termica_kcal", "carga_termica", "kcal"]);
      if (carga != null) {
        const cur = grp.cargasTermicas;
        if (!cur) grp.cargasTermicas = { min: carga, max: carga, avg: carga };
        else {
          cur.min = Math.min(cur.min, carga);
          cur.max = Math.max(cur.max, carga);
          cur.avg = (cur.avg * (grp.occurrences.length - 1) + carga) / grp.occurrences.length;
        }
      }
    });

    // Compute min/max/avg numeric ranges
    map.forEach((g) => {
      g.capacidadeKcal = rangeOf(g.occurrences.map((o) => Number(o.capacidade_kcal)));
      g.capacidadeKcalUnit = rangeOf(
        g.occurrences.map((o) => Number(o.capacidadeUnitaria)).filter((n) => n > 0)
      );
      g.potenciaHp = rangeOf(g.occurrences.map((o) => Number(o.potencia_hp)));
      g.valorUnit = rangeOf(g.occurrences.map((o) => Number(o.valor_unitario)));
    });


    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [data, propMap]);

  // Filters
  const [search, setSearch] = useState("");
  const [marcaFilter, setMarcaFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [gasFilter, setGasFilter] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const marcas = useMemo(
    () => Array.from(new Set(groups.map((g) => g.marca))).sort(),
    [groups]
  );
  const tipos = useMemo(
    () => Array.from(new Set(groups.map((g) => g.tipo))).sort(),
    [groups]
  );
  const gases = useMemo(
    () => Array.from(new Set(groups.flatMap((g) => g.gases))).sort(),
    [groups]
  );

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      if (marcaFilter !== "all" && g.marca !== marcaFilter) return false;
      if (tipoFilter !== "all" && g.tipo !== tipoFilter) return false;
      if (gasFilter !== "all" && !g.gases.includes(gasFilter)) return false;
      if (tempFilter !== "all" && g.temperaturas) {
        const { min, max } = g.temperaturas;
        if (tempFilter === "congelados" && min > -10) return false;
        if (tempFilter === "resfriados" && (min < -5 || max > 12)) return false;
        if (tempFilter === "climatizado" && max < 12) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay =
          `${g.modelo} ${g.marca} ${g.tipo} ${g.gases.join(" ")} ${g.aplicacoes.join(" ")} ${g.fluidosArmazenados.join(" ")} ${g.clientes.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [groups, search, marcaFilter, tipoFilter, gasFilter, tempFilter]);

  // Stats
  const totalEquips = data?.equips.length || 0;
  const avgHp =
    data?.equips.length
      ? data.equips.reduce((s, e) => s + (Number(e.potencia_hp) || 0), 0) / data.equips.length
      : 0;
  const avgKcal =
    data?.props.length
      ? data.props.reduce(
          (s: number, p: any) => s + (Number(p.dados_tecnicos?.carga_termica_kcal) || 0),
          0
        ) / data.props.length
      : 0;
  const cargaVsValor = (data?.props || [])
    .filter((p: any) => p.dados_tecnicos?.carga_termica_kcal && p.valor_total)
    .map((p: any) => ({
      carga: Number(p.dados_tecnicos.carga_termica_kcal),
      valor: Number(p.valor_total),
    }));
  const byCamara: Record<string, number> = {};
  (data?.props || []).forEach((p: any) => {
    const t = p.dados_tecnicos?.tipo_camara;
    if (t) byCamara[t] = (byCamara[t] || 0) + 1;
  });
  const camaraData = Object.entries(byCamara).map(([k, v]) => ({ k, v }));

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Painel técnico"
        description="Cargas térmicas, equipamentos e catálogo consolidado de modelos."
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Equipamentos" value={totalEquips} icon={Wrench} />
        <KpiCard label="Modelos únicos" value={groups.length} icon={Layers} />
        <KpiCard label="Marcas" value={marcas.length} icon={Factory} />
        <KpiCard label="HP médio" value={avgHp.toFixed(1)} icon={Zap} />
        <KpiCard label="Carga média" value={`${avgKcal.toFixed(0)} kcal/h`} icon={Snowflake} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 gradient-surface border-border">
          <h3 className="font-medium text-sm mb-4">Tipos de câmara</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={camaraData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                <XAxis dataKey="k" stroke="oklch(0.66 0.012 260)" fontSize={11} />
                <YAxis stroke="oklch(0.66 0.012 260)" fontSize={11} />
                <Tooltip contentStyle={tt} />
                <Bar dataKey="v" fill="oklch(0.65 0.20 250)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 gradient-surface border-border">
          <h3 className="font-medium text-sm mb-4">Carga térmica × Valor</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis dataKey="carga" name="kcal/h" stroke="oklch(0.66 0.012 260)" fontSize={11} />
                <YAxis
                  dataKey="valor"
                  name="R$"
                  stroke="oklch(0.66 0.012 260)"
                  fontSize={11}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip contentStyle={tt} />
                <Scatter data={cargaVsValor} fill="oklch(0.68 0.17 152)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Catálogo */}
      <Card className="p-5 gradient-surface border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-medium text-sm">Catálogo de equipamentos</h3>
            <p className="text-xs text-muted-foreground">
              {filtered.length} modelo(s) consolidado(s) · {totalEquips} unidade(s) total
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar modelo, marca, gás, cliente..."
                className="pl-7 h-8 text-xs w-64"
              />
            </div>
            <FilterSelect
              value={marcaFilter}
              onChange={setMarcaFilter}
              options={marcas}
              placeholder="Marca"
            />
            <FilterSelect
              value={tipoFilter}
              onChange={setTipoFilter}
              options={tipos}
              placeholder="Tipo"
            />
            <FilterSelect
              value={gasFilter}
              onChange={setGasFilter}
              options={gases}
              placeholder="Gás"
            />
            <Select value={tempFilter} onValueChange={setTempFilter}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Faixa térmica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas faixas</SelectItem>
                <SelectItem value="congelados">Congelados (≤ −10°C)</SelectItem>
                <SelectItem value="resfriados">Resfriados (−5 a 12°C)</SelectItem>
                <SelectItem value="climatizado">Climatizado (&gt; 12°C)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setMarcaFilter("all");
                setTipoFilter("all");
                setGasFilter("all");
                setTempFilter("all");
              }}
            >
              Limpar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Carregando catálogo...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wrench} title="Nenhum equipamento encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-8"></th>
                  <th className="text-left px-3 py-2 font-medium">Modelo / Marca</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-right px-3 py-2 font-medium">Qtd</th>
                  <th className="text-left px-3 py-2 font-medium">Capacidade unit.</th>
                  <th className="text-left px-3 py-2 font-medium">Capac. total</th>
                  <th className="text-left px-3 py-2 font-medium">Potência</th>
                  <th className="text-left px-3 py-2 font-medium">Temperatura</th>
                  <th className="text-left px-3 py-2 font-medium">Gás</th>
                  <th className="text-left px-3 py-2 font-medium">Aplicação</th>
                  <th className="text-right px-3 py-2 font-medium">Valor unit.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const open = expanded.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <tr
                        className="border-b border-border/40 hover:bg-muted/20 cursor-pointer"
                        onClick={() => {
                          const n = new Set(expanded);
                          n.has(g.key) ? n.delete(g.key) : n.add(g.key);
                          setExpanded(n);
                        }}
                      >
                        <td className="px-3 py-2">
                          {open ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{g.modelo}</div>
                          <div className="text-[10px] text-muted-foreground">{g.marca}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">{g.tipo}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{g.totalQty}</td>
                        <td className="px-3 py-2">{rangeText(g.capacidadeKcal, "kcal/h")}</td>
                        <td className="px-3 py-2">{rangeText(g.potenciaHp, "HP")}</td>
                        <td className="px-3 py-2">
                          {g.temperaturas
                            ? `${g.temperaturas.min.toFixed(0)}° a ${g.temperaturas.max.toFixed(0)}°C`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">{g.gases.join(", ") || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[160px]">
                          {g.aplicacoes.join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {g.valorUnit?.avg
                            ? formatBRL(g.valorUnit.avg)
                            : "—"}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-muted/10 border-b border-border/40">
                          <td colSpan={10} className="p-4">
                            <ModelDetail group={g} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ModelDetail({ group }: { group: ModelGroup }) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3 text-xs">
        <Stat icon={Gauge} label="Capacidade frigorífica" value={rangeFull(group.capacidadeKcal, "kcal/h")} />
        <Stat icon={Zap} label="Potência" value={rangeFull(group.potenciaHp, "HP")} />
        <Stat
          icon={Thermometer}
          label="Faixa térmica"
          value={
            group.temperaturas
              ? `${group.temperaturas.min.toFixed(1)}°C a ${group.temperaturas.max.toFixed(1)}°C`
              : "—"
          }
        />
        <Stat
          icon={Snowflake}
          label="Carga térmica média"
          value={
            group.cargasTermicas
              ? `${group.cargasTermicas.avg.toFixed(0)} kcal/h (${group.cargasTermicas.min.toFixed(0)}–${group.cargasTermicas.max.toFixed(0)})`
              : "—"
          }
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Especificações técnicas
          </h4>
          <SpecRow label="Compressor" values={group.compressores} />
          <SpecRow label="Gás refrigerante" values={group.gases} />
          <SpecRow label="Condensação" values={group.condensacoes} />
          <SpecRow label="Degelo" values={group.degelos} />
          <SpecRow label="Tensão / Alimentação" values={group.tensoes} />
        </div>
        <div className="space-y-2">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Aplicação & Comercial
          </h4>
          <SpecRow label="Aplicações" values={group.aplicacoes} />
          <SpecRow label="Produtos armazenados" values={group.fluidosArmazenados} />
          <SpecRow
            label="Valor unitário"
            values={[
              group.valorUnit
                ? `min ${formatBRL(group.valorUnit.min)} · médio ${formatBRL(group.valorUnit.avg)} · máx ${formatBRL(group.valorUnit.max)}`
                : "—",
            ]}
          />
          <SpecRow label="Quantidade total instalada" values={[`${group.totalQty} unidades`]} />
          <SpecRow label="Clientes" values={group.clientes.slice(0, 8)} />
        </div>
      </div>

      <div>
        <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Ocorrências em propostas ({group.occurrences.length})
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground border-b border-border/40">
              <tr>
                <th className="text-left py-1.5 pr-3">Proposta</th>
                <th className="text-left py-1.5 pr-3">Cliente</th>
                <th className="text-left py-1.5 pr-3">Concorrente</th>
                <th className="text-right py-1.5 pr-3">Qtd</th>
                <th className="text-left py-1.5 pr-3">Capac.</th>
                <th className="text-left py-1.5 pr-3">HP</th>
                <th className="text-left py-1.5 pr-3">Gás</th>
                <th className="text-right py-1.5">Valor unit.</th>
              </tr>
            </thead>
            <tbody>
              {group.occurrences.map((o) => (
                <tr key={o.id} className="border-b border-border/20">
                  <td className="py-1.5 pr-3 font-mono text-[10px]">
                    {o.ctx?.numero || o.proposal_id.slice(0, 8)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {o.ctx?.client?.nome || "—"}
                    {o.ctx?.client?.cidade && (
                      <span className="text-muted-foreground"> · {o.ctx.client.cidade}/{o.ctx.client.estado}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {o.ctx?.competitor?.nome || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono">{o.quantidade ?? 1}</td>
                  <td className="py-1.5 pr-3">
                    {o.capacidade_kcal ? `${o.capacidade_kcal} kcal/h` : "—"}
                  </td>
                  <td className="py-1.5 pr-3">{o.potencia_hp ? `${o.potencia_hp} HP` : "—"}</td>
                  <td className="py-1.5 pr-3">{o.gas_refrigerante || "—"}</td>
                  <td className="py-1.5 text-right">
                    {o.valor_unitario ? formatBRL(Number(o.valor_unitario)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function SpecRow({ label, values }: { label: string; values: string[] }) {
  const filtered = values.filter(Boolean);
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground min-w-[140px]">{label}:</span>
      <span className="font-medium flex-1">
        {filtered.length === 0 ? <span className="text-muted-foreground">—</span> : filtered.join(", ")}
      </span>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs w-32">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas {placeholder.toLowerCase()}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// helpers
function pushUniq(arr: string[], v: any) {
  const s = (v ?? "").toString().trim();
  if (s && !arr.includes(s)) arr.push(s);
}
function pickStr(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return null;
}
function pickNum(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj?.[k];
    const n = Number(v);
    if (!isNaN(n) && v != null && v !== "") return n;
  }
  return null;
}
function rangeOf(nums: number[]): { min: number; max: number; avg: number } | null {
  const valid = nums.filter((n) => !isNaN(n) && n > 0);
  if (valid.length === 0) return null;
  const sum = valid.reduce((s, n) => s + n, 0);
  return { min: Math.min(...valid), max: Math.max(...valid), avg: sum / valid.length };
}
function rangeText(r: { min: number; max: number; avg: number } | null, unit: string) {
  if (!r) return "—";
  if (r.min === r.max) return `${formatNum(r.min)} ${unit}`;
  return `${formatNum(r.min)}–${formatNum(r.max)} ${unit}`;
}
function rangeFull(r: { min: number; max: number; avg: number } | null, unit: string) {
  if (!r) return "—";
  if (r.min === r.max) return `${formatNum(r.min)} ${unit}`;
  return `${formatNum(r.min)} a ${formatNum(r.max)} ${unit} (média ${formatNum(r.avg)})`;
}
function formatNum(n: number) {
  if (n >= 1000) return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

const tt = {
  background: "oklch(0.19 0.006 260)",
  border: "1px solid oklch(0.27 0.008 260)",
  borderRadius: 8,
  fontSize: 12,
};
