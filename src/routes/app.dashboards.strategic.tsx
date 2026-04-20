import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Snowflake,
  Thermometer,
  Layers,
  ChevronDown,
  ChevronRight,
  Ruler,
  Wrench,
  Wind,
  Package,
  MapPin,
  Users,
  Phone,
  Mail,
  Route as RouteIcon,
  Loader2,
  Building2,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type CamaraEquipAlocado = {
  modelo?: string;
  marca?: string;
  tipo?: string;
  quantidade?: number;
  capacidade_unitaria_kcal_h?: number;
  potencia_hp?: number;
  gas?: string;
  compressor?: string;
};

type CamaraJson = {
  nome?: string;
  largura_m?: number;
  comprimento_m?: number;
  altura_m?: number;
  pe_direito_m?: number;
  area_m2?: number;
  volume_m3?: number;
  temperatura_alvo_c?: number;
  temperatura_min_c?: number;
  temperatura_max_c?: number;
  isolamento_tipo?: string;
  isolamento_espessura_mm?: number;
  produto_armazenado?: string;
  quantidade_unidades?: number;
  umidade_relativa_pct?: number;
  carga_termica_kcal_h?: number;
  capacidade_total_ofertada_kcal_h?: number;
  equipamentos_alocados?: CamaraEquipAlocado[];
};

type EquipResumo = {
  tipo_sistema?: string;
  tipos_compressor?: string[];
  gases_refrigerantes?: string[];
  potencia_total_hp?: number;
  capacidade_total_kcal_h?: number;
  total_evaporadores?: number;
  total_condensadores?: number;
  total_unidades_refrigeracao?: number;
};

type ProposalRow = {
  id: string;
  padrao_camara: string;
  valor_total: number | null;
  client_id: string | null;
  analise_tecnica_profunda: {
    camaras?: CamaraJson[];
    equipamentos_resumo?: EquipResumo;
  } | null;
};

type EquipmentRow = {
  proposal_id: string;
  tipo: string | null;
  modelo: string | null;
  marca: string | null;
  compressor: string | null;
  tipo_condensacao: string | null;
  gas_refrigerante: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  potencia_hp: number | null;
  capacidade_kcal: number | null;
};

type ClientRow = {
  id: string;
  nome: string;
  razao_social: string | null;
  cidade: string | null;
  estado: string | null;
  segmento: string | null;
  contato_nome: string | null;
  contato_cargo: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  cep: string | null;
  cnpj: string | null;
};

type ClientPattern = {
  client: ClientRow;
  propostas: number;
  valorTotal: number;
};

type PatternRow = {
  padrao: string;
  count: number;
  total: number;
  clientes: number;
  // representação técnica agregada
  largura_m?: number;
  comprimento_m?: number;
  altura_m?: number;
  area_m2?: number;
  volume_m3?: number;
  temperatura_alvo_c?: number;
  isolamento_tipo?: string;
  isolamento_espessura_mm?: number;
  produto?: string;
  umidade_pct?: number;
  carga_termica_kcal_h?: number;
  // distribuição de sistemas
  sistemas: Record<string, number>;
  compressores: Record<string, number>;
  gases: Record<string, number>;
  // equipamentos detalhados
  equipModelos: Record<string, { qtd: number; valorTotal: number; comAcordoValor: number }>;
  totalEquipamentos: number;
  totalCamarasFisicas: number;
  somaValorEquipamentos: number;
  countEquipamentosComValor: number;
  // médias
  ticketMedio: number;
  valorMedioPorCamara: number;
  valorMedioPorEquipamento: number;
  potenciaMediaHp?: number;
  capacidadeMediaKcal?: number;
  proposalIds: string[];
  // detalhamento por câmara (por cliente)
  camarasPorCliente: Array<{
    clientId: string | null;
    clientNome: string;
    proposalId: string;
    camaras: CamaraJson[];
  }>;
};


export const Route = createFileRoute("/app/dashboards/strategic")({
  component: Strategic,
  head: () => ({ meta: [{ title: "Painel estratégico — DocIntel" }] }),
});

function Strategic() {
  const [topN, setTopN] = useState<string>("10");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: insights } = useQuery({
    queryKey: ["dash-strategic-insights"],
    queryFn: async () =>
      (await supabase.from("insights").select("*").order("created_at", { ascending: false })).data || [],
  });

  const { data: proposals } = useQuery<ProposalRow[]>({
    queryKey: ["dash-camara-proposals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposals")
        .select("id,padrao_camara,valor_total,client_id,analise_tecnica_profunda")
        .not("padrao_camara", "is", null);
      return (data || []) as unknown as ProposalRow[];
    },
  });

  const { data: equipments } = useQuery<EquipmentRow[]>({
    queryKey: ["dash-camara-equipments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipments")
        .select(
          "proposal_id,tipo,modelo,marca,compressor,tipo_condensacao,gas_refrigerante,quantidade,valor_unitario,potencia_hp,capacidade_kcal",
        );
      return (data || []) as unknown as EquipmentRow[];
    },
  });

  const { data: clients } = useQuery<ClientRow[]>({
    queryKey: ["dash-camara-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select(
          "id,nome,razao_social,cidade,estado,segmento,contato_nome,contato_cargo,telefone,whatsapp,email,endereco,cep,cnpj",
        );
      return (data || []) as unknown as ClientRow[];
    },
  });

  const patterns: PatternRow[] = useMemo(() => {
    if (!proposals) return [];

    const equipByProposal = new Map<string, EquipmentRow[]>();
    (equipments || []).forEach((e) => {
      const arr = equipByProposal.get(e.proposal_id) || [];
      arr.push(e);
      equipByProposal.set(e.proposal_id, arr);
    });

    const clientById = new Map<string, ClientRow>();
    (clients || []).forEach((c) => clientById.set(c.id, c));

    const map = new Map<string, PatternRow>();

    proposals.forEach((p) => {
      const k = p.padrao_camara;
      const cur: PatternRow =
        map.get(k) ||
        ({
          padrao: k,
          count: 0,
          total: 0,
          clientes: 0,
          sistemas: {},
          compressores: {},
          gases: {},
          equipModelos: {},
          totalEquipamentos: 0,
          totalCamarasFisicas: 0,
          somaValorEquipamentos: 0,
          countEquipamentosComValor: 0,
          ticketMedio: 0,
          valorMedioPorCamara: 0,
          valorMedioPorEquipamento: 0,
          proposalIds: [],
          clientesDetalhe: [],
          estados: {},
          cidades: {},
        } as PatternRow);

      cur.count++;
      cur.total += Number(p.valor_total) || 0;
      cur.proposalIds.push(p.id);

      const camaras = p.analise_tecnica_profunda?.camaras || [];
      if (camaras.length && cur.largura_m === undefined) {
        const c = camaras[0];
        cur.largura_m = c.largura_m;
        cur.comprimento_m = c.comprimento_m;
        cur.altura_m = c.altura_m ?? c.pe_direito_m;
        cur.area_m2 = c.area_m2;
        cur.volume_m3 = c.volume_m3;
        cur.temperatura_alvo_c = c.temperatura_alvo_c;
        cur.isolamento_tipo = c.isolamento_tipo;
        cur.isolamento_espessura_mm = c.isolamento_espessura_mm;
        cur.produto = c.produto_armazenado;
        cur.umidade_pct = c.umidade_relativa_pct;
        cur.carga_termica_kcal_h = c.carga_termica_kcal_h;
      }
      camaras.forEach((c) => {
        cur.totalCamarasFisicas += c.quantidade_unidades || 1;
      });

      const resumo = p.analise_tecnica_profunda?.equipamentos_resumo;
      const sistemaResumo = resumo?.tipo_sistema;
      const equips = equipByProposal.get(p.id) || [];
      const tipos = new Set<string>();
      if (sistemaResumo) tipos.add(normalizeSistema(sistemaResumo));
      equips.forEach((e) => {
        if (e.tipo) tipos.add(normalizeSistema(e.tipo));
      });
      tipos.forEach((t) => {
        cur.sistemas[t] = (cur.sistemas[t] || 0) + 1;
      });

      (resumo?.tipos_compressor || []).forEach((c) => {
        cur.compressores[c] = (cur.compressores[c] || 0) + 1;
      });
      (resumo?.gases_refrigerantes || []).forEach((g) => {
        cur.gases[g] = (cur.gases[g] || 0) + 1;
      });

      equips.forEach((e) => {
        const qtd = e.quantidade || 1;
        cur.totalEquipamentos += qtd;
        const key = [e.marca, e.modelo].filter(Boolean).join(" ") || e.tipo || "—";
        const cell = cur.equipModelos[key] || { qtd: 0, valorTotal: 0, comAcordoValor: 0 };
        cell.qtd += qtd;
        if (e.valor_unitario != null) {
          cell.valorTotal += Number(e.valor_unitario) * qtd;
          cell.comAcordoValor += qtd;
          cur.somaValorEquipamentos += Number(e.valor_unitario) * qtd;
          cur.countEquipamentosComValor += qtd;
        }
        cur.equipModelos[key] = cell;
      });

      map.set(k, cur);
    });

    // segundo passo: clientes únicos + agregação geo + médias
    const clientesPorPadrao = new Map<string, Map<string, ClientPattern>>();
    proposals.forEach((p) => {
      if (!p.client_id) return;
      const padraoClients = clientesPorPadrao.get(p.padrao_camara) || new Map<string, ClientPattern>();
      const c = clientById.get(p.client_id);
      if (!c) return;
      const cur = padraoClients.get(p.client_id) || { client: c, propostas: 0, valorTotal: 0 };
      cur.propostas++;
      cur.valorTotal += Number(p.valor_total) || 0;
      padraoClients.set(p.client_id, cur);
      clientesPorPadrao.set(p.padrao_camara, padraoClients);
    });

    return Array.from(map.values())
      .map((row) => {
        const padraoClients = clientesPorPadrao.get(row.padrao);
        const detalhe = padraoClients ? Array.from(padraoClients.values()) : [];
        row.clientesDetalhe = detalhe.sort((a, b) => b.valorTotal - a.valorTotal);
        row.clientes = detalhe.length;
        detalhe.forEach((cp) => {
          const uf = cp.client.estado || "—";
          row.estados[uf] = (row.estados[uf] || 0) + 1;
          const cidadeKey = `${cp.client.cidade || "—"} / ${uf}`;
          row.cidades[cidadeKey] = (row.cidades[cidadeKey] || 0) + 1;
        });
        row.ticketMedio = row.count ? row.total / row.count : 0;
        row.valorMedioPorCamara = row.totalCamarasFisicas
          ? row.total / row.totalCamarasFisicas
          : row.ticketMedio;
        row.valorMedioPorEquipamento = row.countEquipamentosComValor
          ? row.somaValorEquipamentos / row.countEquipamentosComValor
          : 0;
        return row;
      })
      .sort((a, b) => b.count - a.count);
  }, [proposals, equipments, clients]);

  // Agregados para os cards de distribuição (mantidos)
  const aggregates = useMemo(() => {
    if (!proposals) return null;
    const tempBuckets: Record<string, number> = {
      "Congelados (≤-15°C)": 0,
      "Resfriados (-5 a 5°C)": 0,
      "Climatizados (5-15°C)": 0,
      Outros: 0,
    };
    const isolamentos: Record<string, number> = {};
    const espessuras: Record<string, number> = {};
    let totalCamaras = 0;
    proposals.forEach((p) => {
      const camaras = p.analise_tecnica_profunda?.camaras || [];
      camaras.forEach((c) => {
        totalCamaras++;
        const t = c.temperatura_alvo_c;
        if (typeof t === "number") {
          if (t <= -15) tempBuckets["Congelados (≤-15°C)"]++;
          else if (t >= -5 && t <= 5) tempBuckets["Resfriados (-5 a 5°C)"]++;
          else if (t > 5 && t <= 15) tempBuckets["Climatizados (5-15°C)"]++;
          else tempBuckets["Outros"]++;
        }
        if (c.isolamento_tipo) isolamentos[c.isolamento_tipo] = (isolamentos[c.isolamento_tipo] || 0) + 1;
        if (c.isolamento_espessura_mm) {
          const k = `${c.isolamento_espessura_mm}mm`;
          espessuras[k] = (espessuras[k] || 0) + 1;
        }
      });
    });
    return { totalCamaras, temps: tempBuckets, isolamentos, espessuras };
  }, [proposals]);

  const icons: Record<string, typeof Brain> = {
    padrao: TrendingUp,
    anomalia: AlertTriangle,
    oportunidade: Lightbulb,
  };
  const topPattern = patterns[0];
  const limit = topN === "all" ? patterns.length : Number(topN);
  const visiblePatterns = patterns.slice(0, limit);

  function toggle(padrao: string) {
    const next = new Set(expanded);
    if (next.has(padrao)) next.delete(padrao);
    else next.add(padrao);
    setExpanded(next);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Painel estratégico"
        description="Padrões de câmaras, distribuição técnica e insights automáticos da IA forense."
      />

      {/* Highlight: top pattern */}
      {topPattern && (
        <Card className="p-6 gradient-surface border-primary/30">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-md bg-primary/15 text-primary flex items-center justify-center">
              <Snowflake className="size-6" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Padrão dominante
              </div>
              <div className="text-xl font-semibold mt-0.5">{topPattern.padrao}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {topPattern.count} proposta(s) · {topPattern.clientes} cliente(s) ·{" "}
                {formatBRL(topPattern.total)} cotado · ticket médio{" "}
                {formatBRL(topPattern.ticketMedio)}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Top patterns */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Layers className="size-3.5" />
            Top padrões de câmara
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mostrar</span>
            <Select value={topN} onValueChange={setTopN}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
                <SelectItem value="all">Todas ({patterns.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!patterns.length ? (
          <EmptyState
            icon={Snowflake}
            title="Sem padrões mapeados ainda"
            description="Reprocesse documentos em /app/documents para a IA gerar a assinatura técnica de cada câmara."
          />
        ) : (
          <Card className="gradient-surface border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium w-8"></th>
                    <th className="text-left px-3 py-2.5 font-medium">Assinatura</th>
                    <th className="text-left px-3 py-2.5 font-medium">Dimensões (L×C×A)</th>
                    <th className="text-right px-3 py-2.5 font-medium">Volume</th>
                    <th className="text-right px-3 py-2.5 font-medium">Propostas</th>
                    <th className="text-right px-3 py-2.5 font-medium">Clientes</th>
                    <th className="text-right px-3 py-2.5 font-medium">Equip./câmara</th>
                    <th className="text-right px-3 py-2.5 font-medium">Valor / câmara</th>
                    <th className="text-right px-3 py-2.5 font-medium">Valor / equip.</th>
                    <th className="text-right px-3 py-2.5 font-medium">Valor total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visiblePatterns.map((p) => {
                    const isOpen = expanded.has(p.padrao);
                    const equipPorCamara = p.totalCamarasFisicas
                      ? (p.totalEquipamentos / p.totalCamarasFisicas).toFixed(1)
                      : "—";
                    return (
                      <Fragment key={p.padrao}>
                        <tr
                          className="hover:bg-muted/20 cursor-pointer"
                          onClick={() => toggle(p.padrao)}
                        >
                          <td className="px-3 py-2.5 align-top">
                            {isOpen ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <Badge variant="outline" className="border-primary/40 text-foreground">
                              {p.padrao}
                            </Badge>
                            {p.produto && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Produto: {p.produto}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top text-xs font-mono">
                            {formatDims(p)}
                            {p.area_m2 ? (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {p.area_m2} m²
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 align-top text-right font-mono text-xs">
                            {p.volume_m3 ? `${p.volume_m3.toLocaleString("pt-BR")} m³` : "—"}
                          </td>
                          <td className="px-3 py-2.5 align-top text-right font-mono">{p.count}</td>
                          <td className="px-3 py-2.5 align-top text-right font-mono">{p.clientes}</td>
                          <td className="px-3 py-2.5 align-top text-right font-mono text-xs">
                            {equipPorCamara}
                          </td>
                          <td className="px-3 py-2.5 align-top text-right font-mono text-xs">
                            {formatBRL(p.valorMedioPorCamara)}
                          </td>
                          <td className="px-3 py-2.5 align-top text-right font-mono text-xs">
                            {p.valorMedioPorEquipamento
                              ? formatBRL(p.valorMedioPorEquipamento)
                              : "—"}
                          </td>
                          <td className="px-3 py-2.5 align-top text-right font-mono">
                            {formatBRL(p.total)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/10">
                            <td></td>
                            <td colSpan={9} className="px-3 py-4">
                              <PatternDetail row={p} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* Distributions */}
      {aggregates && aggregates.totalCamaras > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <DistroCard
            title="Faixas de temperatura"
            icon={Thermometer}
            entries={Object.entries(aggregates.temps).filter(([, v]) => v > 0)}
            total={aggregates.totalCamaras}
          />
          <DistroCard
            title="Tipos de isolamento"
            icon={Layers}
            entries={Object.entries(aggregates.isolamentos)}
            total={Object.values(aggregates.isolamentos).reduce((a, b) => a + b, 0)}
          />
          <DistroCard
            title="Espessuras de painel"
            icon={Snowflake}
            entries={Object.entries(aggregates.espessuras).sort(
              (a, b) => parseInt(a[0]) - parseInt(b[0]),
            )}
            total={Object.values(aggregates.espessuras).reduce((a, b) => a + b, 0)}
          />
        </div>
      )}

      {/* IA insights */}
      <section>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Insights gerados pela IA
        </div>
        {!insights?.length ? (
          <EmptyState
            icon={Brain}
            title="Sem insights ainda"
            description="Os insights serão gerados após o processamento de mais documentos."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {insights.map((i: any) => {
              const Icon = icons[i.tipo as string] || Brain;
              return (
                <Card key={i.id} className="p-5 gradient-surface border-border">
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-9 rounded-md flex items-center justify-center ${
                        i.severidade === "alto"
                          ? "bg-warning/15 text-warning"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{i.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-1">{i.descricao}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function PatternDetail({ row }: { row: PatternRow }) {
  const sistemas = Object.entries(row.sistemas).sort((a, b) => b[1] - a[1]);
  const compressores = Object.entries(row.compressores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const gases = Object.entries(row.gases).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const modelos = Object.entries(row.equipModelos).sort((a, b) => b[1].qtd - a[1].qtd);
  const estados = Object.entries(row.estados).sort((a, b) => b[1] - a[1]);
  const cidades = Object.entries(row.cidades).sort((a, b) => b[1] - a[1]);

  const [routeLoading, setRouteLoading] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [routeText, setRouteText] = useState("");

  async function gerarRoteiro() {
    setRouteLoading(true);
    setRouteText("");
    try {
      const payload = {
        padrao: row.padrao,
        technicalContext: {
          dimensoes: formatDims(row),
          area_m2: row.area_m2,
          volume_m3: row.volume_m3,
          temperatura_c: row.temperatura_alvo_c,
          isolamento: row.isolamento_tipo,
          espessura_mm: row.isolamento_espessura_mm,
          produto: row.produto,
          sistemas: row.sistemas,
        },
        clients: row.clientesDetalhe.map((cp) => ({
          nome: cp.client.nome,
          razao_social: cp.client.razao_social,
          cnpj: cp.client.cnpj,
          cidade: cp.client.cidade,
          estado: cp.client.estado,
          endereco: cp.client.endereco,
          cep: cp.client.cep,
          segmento: cp.client.segmento,
          contato_nome: cp.client.contato_nome,
          contato_cargo: cp.client.contato_cargo,
          telefone: cp.client.telefone,
          whatsapp: cp.client.whatsapp,
          email: cp.client.email,
          propostas: cp.propostas,
          valor_total_cotado: cp.valorTotal,
        })),
      };
      const { data, error } = await supabase.functions.invoke("visit-route-planner", {
        body: payload,
      });
      if (error) throw error;
      const errorMsg = (data as { error?: string } | null)?.error;
      if (errorMsg) {
        toast.error(errorMsg);
        return;
      }
      setRouteText((data as { roteiro?: string } | null)?.roteiro || "Sem retorno do modelo.");
      setRouteOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao gerar roteiro.";
      toast.error(message);
    } finally {
      setRouteLoading(false);
    }
  }


  return (
    <div className="space-y-4 pl-2 border-l-2 border-primary/30">
      {/* Bloco 1: especificação técnica completa */}
      <div className="grid md:grid-cols-4 gap-3">
        <DetailStat icon={Ruler} label="Dimensões" value={formatDims(row)} sub={row.area_m2 ? `${row.area_m2} m² · ${row.volume_m3?.toLocaleString("pt-BR")} m³` : undefined} />
        <DetailStat icon={Thermometer} label="Temperatura" value={row.temperatura_alvo_c != null ? `${row.temperatura_alvo_c}°C` : "—"} sub={row.umidade_pct ? `UR ${row.umidade_pct}%` : undefined} />
        <DetailStat icon={Layers} label="Isolamento" value={row.isolamento_tipo || "—"} sub={row.isolamento_espessura_mm ? `Painel ${row.isolamento_espessura_mm} mm` : undefined} />
        <DetailStat icon={Snowflake} label="Carga térmica" value={row.carga_termica_kcal_h ? `${row.carga_termica_kcal_h.toLocaleString("pt-BR")} kcal/h` : "—"} sub={row.produto ? `Produto: ${row.produto}` : undefined} />
      </div>

      {/* Bloco 2: sistemas (a "escadinha" Split vs Plug-In) */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
          <Wrench className="size-3" />
          Sistemas usados nessas câmaras
        </div>
        <div className="flex flex-wrap gap-2">
          {sistemas.length === 0 && <span className="text-xs text-muted-foreground">Sem dados de sistema.</span>}
          {sistemas.map(([sis, qtd]) => (
            <Badge key={sis} variant="secondary" className="text-xs">
              {sis} · {qtd} proposta(s)
            </Badge>
          ))}
        </div>
      </div>

      {/* Bloco 3: equipamentos detalhados (modelos) */}
      {modelos.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Package className="size-3" />
            Equipamentos instalados ({row.totalEquipamentos} unid. em {row.totalCamarasFisicas} câmara(s))
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Marca / Modelo</th>
                  <th className="text-right px-3 py-1.5 font-medium">Unidades</th>
                  <th className="text-right px-3 py-1.5 font-medium">Valor médio unitário</th>
                  <th className="text-right px-3 py-1.5 font-medium">Valor total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {modelos.map(([nome, dados]) => (
                  <tr key={nome}>
                    <td className="px-3 py-1.5 font-mono">{nome}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{dados.qtd}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {dados.comAcordoValor ? formatBRL(dados.valorTotal / dados.comAcordoValor) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {dados.valorTotal ? formatBRL(dados.valorTotal) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bloco 4: compressores + gases */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Wrench className="size-3" />
            Compressores
          </div>
          <div className="flex flex-wrap gap-1.5">
            {compressores.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {compressores.map(([c, q]) => (
              <Badge key={c} variant="outline" className="text-[10px]">
                {c} · {q}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Wind className="size-3" />
            Gases refrigerantes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {gases.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {gases.map(([g, q]) => (
              <Badge key={g} variant="outline" className="text-[10px]">
                {g} · {q}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Bloco 4.5: regiões + clientes + roteiro IA (prospecção) */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <MapPin className="size-3" />
            Regiões e clientes deste padrão ({row.clientesDetalhe.length})
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={gerarRoteiro}
            disabled={routeLoading || row.clientesDetalhe.length === 0}
            className="h-7 text-xs"
          >
            {routeLoading ? (
              <>
                <Loader2 className="size-3 mr-1.5 animate-spin" /> Gerando…
              </>
            ) : (
              <>
                <RouteIcon className="size-3 mr-1.5" /> Sugerir roteiro de visitas (IA)
              </>
            )}
          </Button>
        </div>

        {/* chips de estados e cidades */}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Estados</div>
            <div className="flex flex-wrap gap-1.5">
              {estados.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              {estados.map(([uf, qtd]) => (
                <Badge key={uf} variant="secondary" className="text-[10px]">
                  {uf} · {qtd}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Cidades</div>
            <div className="flex flex-wrap gap-1.5">
              {cidades.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              {cidades.slice(0, 12).map(([cid, qtd]) => (
                <Badge key={cid} variant="outline" className="text-[10px]">
                  {cid} · {qtd}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* tabela de clientes com cadastro completo */}
        {row.clientesDetalhe.length > 0 && (
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Cliente</th>
                  <th className="text-left px-3 py-1.5 font-medium">Localização</th>
                  <th className="text-left px-3 py-1.5 font-medium">Contato</th>
                  <th className="text-left px-3 py-1.5 font-medium">Telefones</th>
                  <th className="text-right px-3 py-1.5 font-medium">Propostas</th>
                  <th className="text-right px-3 py-1.5 font-medium">Valor cotado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {row.clientesDetalhe.map((cp) => {
                  const c = cp.client;
                  return (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium flex items-center gap-1.5">
                          <Building2 className="size-3 text-muted-foreground" />
                          {c.nome}
                        </div>
                        {c.razao_social && c.razao_social !== c.nome && (
                          <div className="text-[10px] text-muted-foreground">{c.razao_social}</div>
                        )}
                        {c.segmento && (
                          <div className="text-[10px] text-muted-foreground">{c.segmento}</div>
                        )}
                        {c.cnpj && (
                          <div className="text-[10px] text-muted-foreground font-mono">{c.cnpj}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {c.cidade || c.estado ? (
                          <div>
                            {c.cidade}
                            {c.cidade && c.estado ? " / " : ""}
                            {c.estado}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {c.endereco && (
                          <div className="text-[10px] text-muted-foreground">{c.endereco}</div>
                        )}
                        {c.cep && <div className="text-[10px] text-muted-foreground">CEP {c.cep}</div>}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {c.contato_nome ? (
                          <>
                            <div>{c.contato_nome}</div>
                            {c.contato_cargo && (
                              <div className="text-[10px] text-muted-foreground">{c.contato_cargo}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="space-y-0.5">
                          {c.telefone && (
                            <div className="flex items-center gap-1">
                              <Phone className="size-2.5 text-muted-foreground" />
                              <a href={`tel:${c.telefone}`} className="hover:underline">{c.telefone}</a>
                            </div>
                          )}
                          {c.whatsapp && (
                            <div className="flex items-center gap-1">
                              <Phone className="size-2.5 text-success" />
                              <a
                                href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline"
                              >
                                {c.whatsapp}
                              </a>
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="size-2.5 text-muted-foreground" />
                              <a href={`mailto:${c.email}`} className="hover:underline">
                                {c.email}
                              </a>
                            </div>
                          )}
                          {!c.telefone && !c.whatsapp && !c.email && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right font-mono">{cp.propostas}</td>
                      <td className="px-3 py-2 align-top text-right font-mono">
                        {formatBRL(cp.valorTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bloco 5: resumo financeiro */}
      <div className="grid md:grid-cols-4 gap-3 pt-2 border-t border-border">
        <DetailStat label="Ticket médio (proposta)" value={formatBRL(row.ticketMedio)} />
        <DetailStat label="Valor médio / câmara física" value={formatBRL(row.valorMedioPorCamara)} />
        <DetailStat
          label="Valor médio / equipamento"
          value={row.valorMedioPorEquipamento ? formatBRL(row.valorMedioPorEquipamento) : "Sem preço unitário"}
        />
        <DetailStat label="Valor total cotado" value={formatBRL(row.total)} />
      </div>

      {/* Modal com roteiro IA */}
      <Dialog open={routeOpen} onOpenChange={setRouteOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RouteIcon className="size-4 text-primary" />
              Roteiro de visitas — {row.padrao}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none mt-2">
            <ReactMarkdown>{routeText}</ReactMarkdown>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function DetailStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon?: typeof Brain;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </div>
      <div className="text-sm font-medium font-mono mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function formatDims(p: PatternRow) {
  if (p.largura_m && p.comprimento_m && p.altura_m) {
    return `${p.largura_m} × ${p.comprimento_m} × ${p.altura_m} m`;
  }
  if (p.largura_m && p.comprimento_m) return `${p.largura_m} × ${p.comprimento_m} m`;
  return "—";
}

function normalizeSistema(s: string): string {
  const t = s.toLowerCase();
  if (t.includes("plug")) return "Plug-In";
  if (t.includes("split")) return "Split";
  if (t.includes("rack")) return "Rack";
  return s.trim();
}

function DistroCard({
  title,
  icon: Icon,
  entries,
  total,
}: {
  title: string;
  icon: typeof Brain;
  entries: [string, number][];
  total: number;
}) {
  return (
    <Card className="p-5 gradient-surface border-border">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-3">
        <Icon className="size-3.5" />
        {title}
      </div>
      <div className="space-y-2">
        {entries.length === 0 && <div className="text-xs text-muted-foreground">Sem dados ainda.</div>}
        {entries.map(([k, v]) => {
          const pct = total ? Math.round((v / total) * 100) : 0;
          return (
            <div key={k}>
              <div className="flex justify-between text-xs mb-0.5">
                <span>{k}</span>
                <span className="font-mono text-muted-foreground">
                  {v} · {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
