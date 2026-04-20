// Changelog técnico do sistema DocIntel.
// Atualize APP_VERSION + adicione uma entrada no topo a cada release/revisão relevante.

export const APP_VERSION = "1.6.0";
export const APP_BUILD_DATE = "2026-04-20";

export type ChangelogEntry = {
  version: string;
  date: string; // ISO yyyy-mm-dd
  type: "feature" | "fix" | "improvement" | "breaking";
  title: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.6.0",
    date: "2026-04-20",
    type: "feature",
    title: "Base CN Cold (empresa-casa) + Head-to-Head com concorrentes",
    changes: [
      "Novo Upload CN Cold: rota dedicada que vincula automaticamente as propostas à empresa-casa, separando-as dos concorrentes.",
      "Concorrentes ganham flag is_house: 'CN Cold' aparece como casa e é excluída da contagem de concorrência.",
      "Novo painel Head-to-Head: cruza propostas CN Cold × concorrentes para o mesmo cliente, mostrando Δ valor, Δ prazo e Δ garantia.",
      "Explicação automática por IA do provável motivo de decisão em cada disputa (cacheada no histórico de revisão da proposta).",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-04-20",
    type: "feature",
    title: "Capacidade unitária + curva e abertura de propostas",
    changes: [
      "Catálogo Técnico: capacidade unitária agora distingue valor extraído do documento vs sugestão (divisão automática), com badge visual.",
      "Curva capacidade × temperatura por modelo, alimentada manualmente ou a partir das propostas.",
      "Drill-down do catálogo: clicar no cliente/proposta abre o arquivo original do documento em nova aba.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-04-20",
    type: "feature",
    title: "Catálogo de equipamentos & changelog do sistema",
    changes: [
      "Painel Técnico: novo Catálogo de Equipamentos consolidando modelos por marca/tipo com filtros (marca, tipo, gás, faixa térmica) e drill-down de specs.",
      "Configurações → Versões & Revisões agora mostra o histórico técnico do software (changelog).",
      "Header superior exibe versão atual com botão de atualização (limpa cache e recarrega).",
      "Menu lateral: Administração consolidada dentro de Configurações.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-04-19",
    type: "feature",
    title: "Gestão de usuários & roteirização de visitas",
    changes: [
      "Settings → Usuários: cadastro com senha temporária, papéis admin/analyst/viewer, reset e exclusão.",
      "Painel Geográfico: planejador de rota com cálculo de tempo, combustível, pedágio e custo.",
      "Sugestão de roteiro com seleção de clientes e premissas (visitas/dia, tempo na cidade).",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-04-15",
    type: "feature",
    title: "Inteligência de mercado & recomendação",
    changes: [
      "Mercado & Produto: análise consolidada de posicionamento, gaps e oportunidades.",
      "Recomendação por contexto: equipamento sugerido a partir do perfil de câmara.",
      "Chat analítico no Insight Navigator com contexto de propostas e concorrentes.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-04-10",
    type: "improvement",
    title: "Análise forense & benchmarking",
    changes: [
      "Forensic Analyze: extração estruturada com taxonomia, riscos e padrões contratuais.",
      "Benchmarking de propostas com score global e comparativo lado a lado.",
      "Versionamento de análises forenses (v1, v2…) por documento.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-01",
    type: "feature",
    title: "Lançamento DocIntel",
    changes: [
      "Upload, extração e indexação de propostas (PDF, DOCX, imagens).",
      "Cadastro de clientes, concorrentes e equipamentos.",
      "Dashboards Comercial, Técnico, Contratual, Geográfico e Estratégico.",
      "Auditoria, dicionários e revisão humana de campos.",
    ],
  },
];
