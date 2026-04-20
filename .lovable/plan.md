

# Base CN Code + Análise Head-to-Head com Concorrentes

Hoje o sistema trata todo upload como vindo de um concorrente (default "Conela"). Vou introduzir o conceito de **propostas da casa (CN Code)** separadas das **propostas de concorrentes**, e cruzar as duas bases por cliente para descobrir onde a CN Code disputou (e perdeu/ganhou) contra cada concorrente — com explicação do porquê.

## O que muda

### 1. Marcar a CN Code como "casa" no cadastro

- Adicionar coluna `is_house boolean default false` em `competitors`.
- Seed automático: garantir um registro `competitors` com `nome = 'CN Code'` e `is_house = true` por owner (criado on-demand quando o usuário entrar em `/app/upload/cncode` pela primeira vez).
- Toda análise de "concorrência" passa a excluir `is_house = true` da lista de concorrentes.

### 2. Rota de upload dedicada `/app/upload/cncode`

- Novo arquivo `src/routes/app.upload.cncode.tsx` (mesmo dropzone do upload atual, mas com header verde "Propostas CN Code" e uma flag `kind: "house"` no item da fila).
- Reaproveita 100% do `uploadQueue`, mas com um novo método `addHouse(files)` que marca os items para forçar `competitor_id = <CN Code id>` ao salvar a proposta — ignorando o fabricante detectado pela IA.
- Item de menu novo na sidebar, seção "Documentos": **"Upload CN Code"** (ícone destacado).
- O `/app/upload` atual continua existindo para concorrentes (renomeado para "Upload Concorrentes").

### 3. Pasta da CN Code (`/app/competitors/CN%20Code`)

Já funciona pela rota existente `app.competitors.$nome.tsx` — vai listar automaticamente todos os documentos da casa, padrões técnicos, gases, compressores, valor médio etc. Sem código novo.

### 4. Nova rota `/app/dashboards/head-to-head` — o coração do pedido

Tela "Onde disputamos e o que aconteceu". Para cada cliente que aparece **tanto** em propostas CN Code **quanto** em propostas de algum concorrente:

- Linha por cliente com: nome, UF, concorrente(s) que também propuseram, valor CN Code vs valor concorrente, delta %, status conhecido (ganhamos / perdemos / indefinido).
- Drill-down: comparação lado a lado da proposta CN Code × proposta do concorrente (mesma estrutura do `/app/compare` atual, mas pré-pareada).
- **Explicação automática** gerada pelo `assistant-chat`/`market-intelligence` engine: "por que provavelmente perdemos para X neste cliente" — usa diferenças de preço, prazo, garantia, equipamentos, condições de pagamento.

Filtros: por concorrente, por UF, por faixa de valor, por status (ganhamos/perdemos).

### 5. Reforço na Inteligência de Mercado

`/app/market` ganha um modo "CN Code vs mercado": KPIs comparativos (ticket médio nosso × concorrência, prazo médio nosso × deles, gases preferidos, padrão de garantia), além das perguntas sugeridas atuais.

### 6. Seed e migração de dados existentes

- Migração SQL: adiciona `is_house`, cria/atualiza CN Code como `is_house=true`.
- Não mexe em propostas já carregadas (continuam atribuídas ao concorrente original).

## Detalhes técnicos

**Migração**

```sql
ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS is_house boolean NOT NULL DEFAULT false;

-- Garantir CN Code marcada como casa quando já existir
UPDATE public.competitors SET is_house = true WHERE lower(nome) = 'cn code';
```

(Criação on-demand do registro CN Code por owner é feita no front quando entra em `/app/upload/cncode`, igual ao fallback "Conela" de hoje.)

**Upload Queue — extensão**

Em `src/lib/upload-queue.ts`:

- Tipo `QueueItem` ganha `houseCompetitorId?: string`.
- Novo `addHouse(files, houseId)` que inclui `houseCompetitorId` em cada item.
- Em `processOne`, quando `it.houseCompetitorId` existe, pular toda a heurística de fabricante e usar esse id direto (`competitorId = it.houseCompetitorId`).

**Pareamento head-to-head (front)**

Query única: `proposals` com `client_id`, `competitor_id`, `valor_total`, `status_proposta`, `dados_tecnicos`, `prazo_entrega_dias`, `garantia_meses` + join `competitors(is_house)` + `clients(nome,estado)`.

No cliente, agrupar por `client_id` e separar por `is_house`. Cliente entra na tela quando tem ≥1 proposta house **e** ≥1 proposta não-house.

**Explicação por IA**

Reusar a edge function `market-intelligence` passando contexto resumido das duas propostas pareadas + pergunta canônica: "Compare estas duas propostas para o mesmo cliente e explique provável motivo de decisão". Resposta cacheada em `proposal_review_events` (já existente) com `action='comment'`.

**Arquivos novos / alterados**

- migração SQL — adiciona `is_house`
- `src/routes/app.upload.cncode.tsx` (novo)
- `src/routes/app.dashboards.head-to-head.tsx` (novo)
- `src/lib/upload-queue.ts` — adiciona `addHouse` + `houseCompetitorId`
- `src/components/app-shell.tsx` — novos itens de menu ("Upload CN Code" e "Head-to-Head")
- `src/lib/changelog.ts` — bump versão (v1.6.0)

## Fora do escopo (posso fazer depois se quiser)

- Marcar manualmente "ganhamos/perdemos" por proposta (hoje vem só do `status_proposta` extraído).
- Importação em lote de propostas CN Code via ZIP/pasta.
- Relatório PDF do head-to-head por cliente.

