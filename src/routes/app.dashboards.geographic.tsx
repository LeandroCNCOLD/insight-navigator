import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calculator } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  MapPin,
  Users,
  Phone,
  Mail,
  ChevronDown,
  ChevronRight,
  Map as MapIcon,
  Route as RouteIcon,
  Loader2,
  Building2,
  ExternalLink,
  Search,
  Navigation,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/app/dashboards/geographic")({
  component: Geo,
  head: () => ({ meta: [{ title: "Painel geográfico — DocIntel" }] }),
});

type ClientRow = {
  id: string;
  nome: string;
  estado: string | null;
  cidade: string | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  contato_nome: string | null;
  contato_cargo: string | null;
  segmento: string | null;
};

type ProposalGeo = {
  id: string;
  valor_total: number | null;
  padrao_camara: string | null;
  data_proposta: string | null;
  client: ClientRow | null;
};

type CityAgg = {
  cidade: string;
  estado: string;
  clientes: Set<string>;
  propostas: number;
  valor: number;
  padroes: Set<string>;
};

type StateAgg = {
  estado: string;
  clientes: Set<string>;
  cidades: Set<string>;
  propostas: number;
  valor: number;
  padroes: Set<string>;
};

const mapsSearch = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

const mapsRoute = (stops: string[]) => {
  if (stops.length === 0) return "#";
  // Google Maps directions multi-stop
  const enc = stops.map((s) => encodeURIComponent(s)).join("/");
  return `https://www.google.com/maps/dir/${enc}`;
};

function buildClientAddress(c: ClientRow): string {
  return [c.endereco, c.bairro, c.cidade, c.estado, c.cep]
    .filter(Boolean)
    .join(", ");
}

function Geo() {
  const [topN, setTopN] = useState(20);
  const [search, setSearch] = useState("");
  const [openState, setOpenState] = useState<string | null>(null);
  const [openCity, setOpenCity] = useState<string | null>(null);
  const [routeModal, setRouteModal] = useState<{
    open: boolean;
    title: string;
    loading: boolean;
    content: string;
  }>({ open: false, title: "", loading: false, content: "" });

  // Calculadora / premissas de viagem
  const [premissasOpen, setPremissasOpen] = useState(false);
  const [pendingScope, setPendingScope] = useState<
    { type: "state"; key: string } | { type: "city"; key: string } | null
  >(null);
  const [premissas, setPremissas] = useState({
    origem: "São Paulo - SP",
    veiculo: "Carro sedan",
    consumoKmL: 12,
    precoCombustivel: 6.0,
    pedagioPor100km: 25,
    diariaHotel: 280,
    refeicoesDia: 120,
    visitasPorDia: 2,
    maxVisitas: 10,
    diasDisponiveis: 5,
    janela: "Próximas 4 semanas",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dash-geo-v2"],
    queryFn: async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id,nome,estado,cidade,endereco,bairro,cep,telefone,whatsapp,email,contato_nome,contato_cargo,segmento",
          ),
        supabase
          .from("proposals")
          .select(
            "id,valor_total,padrao_camara,data_proposta,client:clients(id,nome,estado,cidade,endereco,bairro,cep,telefone,whatsapp,email,contato_nome,contato_cargo,segmento)",
          ),
      ]);
      return {
        clients: (c || []) as ClientRow[],
        proposals: (p || []) as unknown as ProposalGeo[],
      };
    },
  });

  const { stateMap, cityMap, clientsByState, clientsByCity } = useMemo(() => {
    const stateMap = new Map<string, StateAgg>();
    const cityMap = new Map<string, CityAgg>();
    const clientsByState = new Map<string, ClientRow[]>();
    const clientsByCity = new Map<string, ClientRow[]>();

    // From clients table — capture coverage even without proposals
    (data?.clients || []).forEach((cl) => {
      const uf = (cl.estado || "").toUpperCase().trim();
      const ci = (cl.cidade || "").trim();
      if (uf) {
        if (!stateMap.has(uf))
          stateMap.set(uf, {
            estado: uf,
            clientes: new Set(),
            cidades: new Set(),
            propostas: 0,
            valor: 0,
            padroes: new Set(),
          });
        const s = stateMap.get(uf)!;
        s.clientes.add(cl.id);
        if (ci) s.cidades.add(ci);
        const arr = clientsByState.get(uf) || [];
        if (!arr.find((x) => x.id === cl.id)) arr.push(cl);
        clientsByState.set(uf, arr);
      }
      if (uf && ci) {
        const key = `${uf}|${ci}`;
        if (!cityMap.has(key))
          cityMap.set(key, {
            cidade: ci,
            estado: uf,
            clientes: new Set(),
            propostas: 0,
            valor: 0,
            padroes: new Set(),
          });
        const cAgg = cityMap.get(key)!;
        cAgg.clientes.add(cl.id);
        const arr = clientsByCity.get(key) || [];
        if (!arr.find((x) => x.id === cl.id)) arr.push(cl);
        clientsByCity.set(key, arr);
      }
    });

    // Add proposal value/count
    (data?.proposals || []).forEach((p) => {
      const cl = p.client;
      if (!cl) return;
      const uf = (cl.estado || "").toUpperCase().trim();
      const ci = (cl.cidade || "").trim();
      const v = Number(p.valor_total) || 0;
      if (uf) {
        const s = stateMap.get(uf);
        if (s) {
          s.propostas += 1;
          s.valor += v;
          if (p.padrao_camara) s.padroes.add(p.padrao_camara);
        }
      }
      if (uf && ci) {
        const key = `${uf}|${ci}`;
        const c = cityMap.get(key);
        if (c) {
          c.propostas += 1;
          c.valor += v;
          if (p.padrao_camara) c.padroes.add(p.padrao_camara);
        }
      }
    });

    return { stateMap, cityMap, clientsByState, clientsByCity };
  }, [data]);

  const states = useMemo(() => {
    const arr = Array.from(stateMap.values()).sort(
      (a, b) => b.clientes.size - a.clientes.size,
    );
    return arr;
  }, [stateMap]);

  const cities = useMemo(() => {
    const arr = Array.from(cityMap.values())
      .filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          c.cidade.toLowerCase().includes(q) ||
          c.estado.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.clientes.size - a.clientes.size);
    return arr;
  }, [cityMap, search]);

  const topCities = cities.slice(0, topN);
  const totals = useMemo(
    () => ({
      clientes: data?.clients.length || 0,
      estados: stateMap.size,
      cidades: cityMap.size,
      valor: Array.from(stateMap.values()).reduce((s, x) => s + x.valor, 0),
    }),
    [data, stateMap, cityMap],
  );

  const stateChart = states
    .slice(0, 12)
    .map((s) => ({ k: s.estado, v: s.clientes.size }));
  const valueChart = states
    .slice(0, 12)
    .map((s) => ({ k: s.estado, v: s.valor }));

  function handleGenerateRoute(
    scope: { type: "state"; key: string } | { type: "city"; key: string },
  ) {
    const clients =
      scope.type === "state"
        ? clientsByState.get(scope.key) || []
        : clientsByCity.get(scope.key) || [];
    if (clients.length === 0) {
      toast.error("Nenhum cliente nesse recorte.");
      return;
    }
    setPendingScope(scope);
    setPremissas((p) => ({
      ...p,
      maxVisitas: Math.min(p.maxVisitas || 10, clients.length),
    }));
    setPremissasOpen(true);
  }

  async function runPlanner() {
    if (!pendingScope) return;
    const scope = pendingScope;
    let title = "";
    let clients: ClientRow[] = [];
    if (scope.type === "state") {
      title = `Roteiro para ${scope.key}`;
      clients = clientsByState.get(scope.key) || [];
    } else {
      const [uf, ci] = scope.key.split("|");
      title = `Roteiro para ${ci} / ${uf}`;
      clients = clientsByCity.get(scope.key) || [];
    }
    setPremissasOpen(false);
    setRouteModal({ open: true, title, loading: true, content: "" });
    try {
      const payload = {
        padrao: title,
        premissas,
        clients: clients.map((c) => ({
          nome: c.nome,
          cidade: c.cidade,
          estado: c.estado,
          endereco: buildClientAddress(c),
          telefone: c.telefone,
          whatsapp: c.whatsapp,
          email: c.email,
          contato_nome: c.contato_nome,
          contato_cargo: c.contato_cargo,
          segmento: c.segmento,
        })),
        technicalContext: {
          escopo: scope.type === "state" ? "estado" : "cidade",
          recorte: scope.key,
          totalClientes: clients.length,
        },
      };
      const { data: res, error } = await supabase.functions.invoke(
        "visit-route-planner",
        { body: payload },
      );
      if (error) throw error;
      setRouteModal((m) => ({
        ...m,
        loading: false,
        content: res?.roteiro || "Sem retorno.",
      }));
    } catch (e: any) {
      setRouteModal({ open: false, title: "", loading: false, content: "" });
      toast.error(e?.message || "Falha ao gerar roteiro");
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader
          title="Painel geográfico"
          description="Carregando dados de clientes e propostas..."
        />
      </div>
    );
  }

  if (!data?.clients.length) {
    return (
      <div className="p-6 space-y-5">
        <PageHeader
          title="Painel geográfico"
          description="Concentração de clientes e oportunidades por região."
        />
        <EmptyState
          title="Sem clientes cadastrados"
          description="Cadastre clientes em Clientes para começar a explorar a inteligência geográfica."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Painel geográfico"
        description="Inteligência geográfica para prospecção e roteirização de visitas comerciais."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Clientes" value={totals.clientes.toString()} icon={<Users className="h-4 w-4" />} />
        <KPI label="Estados" value={totals.estados.toString()} icon={<MapPin className="h-4 w-4" />} />
        <KPI label="Cidades" value={totals.cidades.toString()} icon={<Building2 className="h-4 w-4" />} />
        <KPI label="Valor cotado" value={formatBRL(totals.valor)} icon={<RouteIcon className="h-4 w-4" />} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Chart
          title="Top estados — clientes"
          data={stateChart}
          fill="oklch(0.65 0.20 250)"
        />
        <Chart
          title="Top estados — valor cotado"
          data={valueChart}
          fill="oklch(0.68 0.17 152)"
          money
        />
      </div>

      {/* Estados */}
      <Card className="p-5 gradient-surface border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Ranking de estados
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique em um estado para ver os clientes e gerar roteiro.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground text-xs">
                <th className="text-left py-2 pr-3 w-8" />
                <th className="text-left py-2 pr-3">UF</th>
                <th className="text-right py-2 pr-3">Clientes</th>
                <th className="text-right py-2 pr-3">Cidades</th>
                <th className="text-right py-2 pr-3">Propostas</th>
                <th className="text-right py-2 pr-3">Padrões</th>
                <th className="text-right py-2 pr-3">Valor</th>
                <th className="text-right py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {states.map((s) => {
                const open = openState === s.estado;
                return (
                  <Fragment key={s.estado}>
                    <tr
                      className="border-b border-border/40 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setOpenState(open ? null : s.estado)}
                    >
                      <td className="py-2 pr-3">
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2 pr-3 font-medium">{s.estado}</td>
                      <td className="py-2 pr-3 text-right">{s.clientes.size}</td>
                      <td className="py-2 pr-3 text-right">{s.cidades.size}</td>
                      <td className="py-2 pr-3 text-right">{s.propostas}</td>
                      <td className="py-2 pr-3 text-right">{s.padroes.size}</td>
                      <td className="py-2 pr-3 text-right">{formatBRL(s.valor)}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(mapsSearch(`clientes em ${s.estado}, Brasil`), "_blank");
                            }}
                            title="Abrir no Google Maps"
                          >
                            <MapIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateRoute({ type: "state", key: s.estado });
                            }}
                            title="Gerar roteiro IA"
                          >
                            <RouteIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-muted/10">
                        <td colSpan={8} className="p-4">
                          <ClientsBlock
                            clients={clientsByState.get(s.estado) || []}
                            onRoute={() =>
                              handleGenerateRoute({ type: "state", key: s.estado })
                            }
                            scopeLabel={s.estado}
                          />
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

      {/* Cidades */}
      <Card className="p-5 gradient-surface border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Ranking de cidades
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top cidades por concentração de clientes — clique para abrir roteiro.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar cidade/UF"
                className="pl-8 h-9 w-44"
              />
            </div>
            <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="30">Top 30</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
                <SelectItem value="999">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground text-xs">
                <th className="text-left py-2 pr-3 w-8" />
                <th className="text-left py-2 pr-3">Cidade</th>
                <th className="text-left py-2 pr-3">UF</th>
                <th className="text-right py-2 pr-3">Clientes</th>
                <th className="text-right py-2 pr-3">Propostas</th>
                <th className="text-right py-2 pr-3">Padrões</th>
                <th className="text-right py-2 pr-3">Valor</th>
                <th className="text-right py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {topCities.map((c) => {
                const key = `${c.estado}|${c.cidade}`;
                const open = openCity === key;
                return (
                  <Fragment key={key}>
                    <tr
                      className="border-b border-border/40 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setOpenCity(open ? null : key)}
                    >
                      <td className="py-2 pr-3">
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2 pr-3 font-medium">{c.cidade}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="text-xs">
                          {c.estado}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">{c.clientes.size}</td>
                      <td className="py-2 pr-3 text-right">{c.propostas}</td>
                      <td className="py-2 pr-3 text-right">{c.padroes.size}</td>
                      <td className="py-2 pr-3 text-right">{formatBRL(c.valor)}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(mapsSearch(`${c.cidade}, ${c.estado}, Brasil`), "_blank");
                            }}
                            title="Abrir no Google Maps"
                          >
                            <MapIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cls = clientsByCity.get(key) || [];
                              const stops = cls
                                .map((x) => buildClientAddress(x))
                                .filter(Boolean);
                              if (stops.length === 0) {
                                toast.error("Sem endereços cadastrados.");
                                return;
                              }
                              window.open(mapsRoute(stops), "_blank");
                            }}
                            title="Rota multi-stop no Google Maps"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateRoute({ type: "city", key });
                            }}
                            title="Gerar roteiro IA"
                          >
                            <RouteIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-muted/10">
                        <td colSpan={8} className="p-4">
                          <ClientsBlock
                            clients={clientsByCity.get(key) || []}
                            onRoute={() => handleGenerateRoute({ type: "city", key })}
                            scopeLabel={`${c.cidade} / ${c.estado}`}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {topCities.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">
              Nenhuma cidade encontrada.
            </p>
          )}
        </div>
      </Card>

      {/* Premissas modal — calculadora de viagem */}
      <Dialog open={premissasOpen} onOpenChange={setPremissasOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Calculadora de viagem & premissas do roteiro
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Origem">
              <Input
                value={premissas.origem}
                onChange={(e) => setPremissas({ ...premissas, origem: e.target.value })}
              />
            </Field>
            <Field label="Veículo">
              <Input
                value={premissas.veiculo}
                onChange={(e) => setPremissas({ ...premissas, veiculo: e.target.value })}
              />
            </Field>
            <Field label="Consumo (km/l)">
              <Input
                type="number"
                step="0.1"
                value={premissas.consumoKmL}
                onChange={(e) => setPremissas({ ...premissas, consumoKmL: Number(e.target.value) })}
              />
            </Field>
            <Field label="Combustível (R$/l)">
              <Input
                type="number"
                step="0.01"
                value={premissas.precoCombustivel}
                onChange={(e) => setPremissas({ ...premissas, precoCombustivel: Number(e.target.value) })}
              />
            </Field>
            <Field label="Pedágio médio (R$/100km)">
              <Input
                type="number"
                step="1"
                value={premissas.pedagioPor100km}
                onChange={(e) => setPremissas({ ...premissas, pedagioPor100km: Number(e.target.value) })}
              />
            </Field>
            <Field label="Diária hotel (R$)">
              <Input
                type="number"
                step="10"
                value={premissas.diariaHotel}
                onChange={(e) => setPremissas({ ...premissas, diariaHotel: Number(e.target.value) })}
              />
            </Field>
            <Field label="Refeições/dia (R$)">
              <Input
                type="number"
                step="10"
                value={premissas.refeicoesDia}
                onChange={(e) => setPremissas({ ...premissas, refeicoesDia: Number(e.target.value) })}
              />
            </Field>
            <Field label="Visitas por dia">
              <Input
                type="number"
                min={1}
                max={6}
                value={premissas.visitasPorDia}
                onChange={(e) => setPremissas({ ...premissas, visitasPorDia: Number(e.target.value) })}
              />
            </Field>
            <Field label="Máx. visitas no período">
              <Input
                type="number"
                min={1}
                value={premissas.maxVisitas}
                onChange={(e) => setPremissas({ ...premissas, maxVisitas: Number(e.target.value) })}
              />
            </Field>
            <Field label="Dias disponíveis">
              <Input
                type="number"
                min={1}
                value={premissas.diasDisponiveis}
                onChange={(e) => setPremissas({ ...premissas, diasDisponiveis: Number(e.target.value) })}
              />
            </Field>
            <Field label="Janela de execução">
              <Input
                value={premissas.janela}
                onChange={(e) => setPremissas({ ...premissas, janela: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A IA usará esses parâmetros para calcular custo de combustível, pedágio,
            hotel e refeições, e agrupar clientes por proximidade respeitando o limite
            de visitas por dia e o máximo total.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPremissasOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={runPlanner}>
              <RouteIcon className="h-3.5 w-3.5 mr-1" />
              Gerar roteiro com cálculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route modal */}
      <Dialog
        open={routeModal.open}
        onOpenChange={(o) => setRouteModal((m) => ({ ...m, open: o }))}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4" />
              {routeModal.title}
            </DialogTitle>
          </DialogHeader>
          {routeModal.loading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando roteiro inteligente com calculadora de viagem...
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{routeModal.content}</ReactMarkdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 gradient-surface border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </Card>
  );
}

function Chart({
  title,
  data,
  fill,
  money,
}: {
  title: string;
  data: { k: string; v: number }[];
  fill: string;
  money?: boolean;
}) {
  return (
    <Card className="p-5 gradient-surface border-border">
      <h3 className="font-medium text-sm mb-4">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
            <XAxis
              type="number"
              stroke="oklch(0.66 0.012 260)"
              fontSize={11}
              tickFormatter={money ? (v) => `${(v / 1000).toFixed(0)}k` : undefined}
            />
            <YAxis type="category" dataKey="k" stroke="oklch(0.66 0.012 260)" fontSize={11} width={60} />
            <Tooltip
              contentStyle={{
                background: "oklch(0.19 0.006 260)",
                border: "1px solid oklch(0.27 0.008 260)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: any) => (money ? formatBRL(Number(v)) : v)}
            />
            <Bar dataKey="v" fill={fill} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ClientsBlock({
  clients,
  onRoute,
  scopeLabel,
}: {
  clients: ClientRow[];
  onRoute: () => void;
  scopeLabel: string;
}) {
  const stops = clients.map((c) => buildClientAddress(c)).filter(Boolean);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <Users className="h-3 w-3 inline mr-1" />
          {clients.length} cliente(s) em {scopeLabel}
        </p>
        <div className="flex items-center gap-2">
          {stops.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(mapsRoute(stops), "_blank")}
            >
              <Navigation className="h-3.5 w-3.5 mr-1" />
              Rota no Google Maps
            </Button>
          )}
          <Button size="sm" onClick={onRoute}>
            <RouteIcon className="h-3.5 w-3.5 mr-1" />
            Gerar roteiro IA
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="text-left py-1.5 pr-3">Cliente</th>
              <th className="text-left py-1.5 pr-3">Cidade / UF</th>
              <th className="text-left py-1.5 pr-3">Contato</th>
              <th className="text-left py-1.5 pr-3">Telefone</th>
              <th className="text-left py-1.5 pr-3">E-mail</th>
              <th className="text-left py-1.5 pr-3">Segmento</th>
              <th className="text-right py-1.5">Mapa</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const addr = buildClientAddress(c);
              return (
                <tr key={c.id} className="border-b border-border/30">
                  <td className="py-1.5 pr-3 font-medium">{c.nome}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {c.cidade || "—"} / {c.estado || "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {c.contato_nome ? (
                      <span>
                        {c.contato_nome}
                        {c.contato_cargo && (
                          <span className="text-muted-foreground"> · {c.contato_cargo}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    {c.whatsapp || c.telefone ? (
                      <a
                        href={`tel:${c.whatsapp || c.telefone}`}
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {c.whatsapp || c.telefone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">cadastro incompleto</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{c.segmento || "—"}</td>
                  <td className="py-1.5 text-right">
                    <a
                      href={mapsSearch(addr || `${c.nome} ${c.cidade || ""} ${c.estado || ""}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
