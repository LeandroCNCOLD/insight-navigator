export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          entidade: string | null
          entidade_id: string | null
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          owner_id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          owner_id: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          owner_id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          contato_cargo: string | null
          contato_nome: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          notas: string | null
          owner_id: string
          razao_social: string | null
          segmento: string | null
          site: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato_cargo?: string | null
          contato_nome?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          notas?: string | null
          owner_id: string
          razao_social?: string | null
          segmento?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato_cargo?: string | null
          contato_nome?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          notas?: string | null
          owner_id?: string
          razao_social?: string | null
          segmento?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      competitors: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_house: boolean
          logo_url: string | null
          nome: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_house?: boolean
          logo_url?: string | null
          nome: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_house?: boolean
          logo_url?: string | null
          nome?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dictionaries: {
        Row: {
          categoria: string
          created_at: string
          id: string
          owner_id: string
          sinonimos: string[] | null
          termo: string
          valor_canonico: string
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          owner_id: string
          sinonimos?: string[] | null
          termo: string
          valor_canonico: string
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          owner_id?: string
          sinonimos?: string[] | null
          termo?: string
          valor_canonico?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          ano: number | null
          client_id: string | null
          competitor_id: string | null
          created_at: string
          error_message: string | null
          file_hash: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          owner_id: string
          raw_text: string | null
          resumo_executivo: string | null
          status: Database["public"]["Enums"]["document_status"]
          tags: string[] | null
          tem_analise_forense: boolean | null
          tipo_documental: string | null
          updated_at: string
        }
        Insert: {
          ano?: number | null
          client_id?: string | null
          competitor_id?: string | null
          created_at?: string
          error_message?: string | null
          file_hash?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          owner_id: string
          raw_text?: string | null
          resumo_executivo?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          tags?: string[] | null
          tem_analise_forense?: boolean | null
          tipo_documental?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number | null
          client_id?: string | null
          competitor_id?: string | null
          created_at?: string
          error_message?: string | null
          file_hash?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          owner_id?: string
          raw_text?: string | null
          resumo_executivo?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          tags?: string[] | null
          tem_analise_forense?: boolean | null
          tipo_documental?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_capacity_curves: {
        Row: {
          capacidade_kcal_h: number
          created_at: string
          fonte: string
          gas_refrigerante: string | null
          id: string
          marca: string | null
          modelo: string
          observacoes: string | null
          owner_id: string
          potencia_hp: number | null
          proposal_id: string | null
          temp_ambiente_c: number | null
          temp_evaporacao_c: number
          tipo: string | null
          updated_at: string
        }
        Insert: {
          capacidade_kcal_h: number
          created_at?: string
          fonte?: string
          gas_refrigerante?: string | null
          id?: string
          marca?: string | null
          modelo: string
          observacoes?: string | null
          owner_id: string
          potencia_hp?: number | null
          proposal_id?: string | null
          temp_ambiente_c?: number | null
          temp_evaporacao_c: number
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          capacidade_kcal_h?: number
          created_at?: string
          fonte?: string
          gas_refrigerante?: string | null
          id?: string
          marca?: string | null
          modelo?: string
          observacoes?: string | null
          owner_id?: string
          potencia_hp?: number | null
          proposal_id?: string | null
          temp_ambiente_c?: number | null
          temp_evaporacao_c?: number
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      equipments: {
        Row: {
          capacidade_kcal: number | null
          compressor: string | null
          created_at: string
          gas_refrigerante: string | null
          id: string
          marca: string | null
          modelo: string | null
          observacoes: string | null
          owner_id: string
          potencia_hp: number | null
          proposal_id: string
          quantidade: number | null
          tipo: string | null
          tipo_condensacao: string | null
          tipo_degelo: string | null
          valor_unitario: number | null
        }
        Insert: {
          capacidade_kcal?: number | null
          compressor?: string | null
          created_at?: string
          gas_refrigerante?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          observacoes?: string | null
          owner_id: string
          potencia_hp?: number | null
          proposal_id: string
          quantidade?: number | null
          tipo?: string | null
          tipo_condensacao?: string | null
          tipo_degelo?: string | null
          valor_unitario?: number | null
        }
        Update: {
          capacidade_kcal?: number | null
          compressor?: string | null
          created_at?: string
          gas_refrigerante?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          observacoes?: string | null
          owner_id?: string
          potencia_hp?: number | null
          proposal_id?: string
          quantidade?: number | null
          tipo?: string | null
          tipo_condensacao?: string | null
          tipo_degelo?: string | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      evidences: {
        Row: {
          campo: string
          created_at: string
          document_id: string
          id: string
          owner_id: string
          pagina: number | null
          proposal_id: string | null
          score_confianca: number | null
          status: string | null
          trecho: string | null
          validado_em: string | null
          validado_por: string | null
          valor_extraido: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          document_id: string
          id?: string
          owner_id: string
          pagina?: number | null
          proposal_id?: string | null
          score_confianca?: number | null
          status?: string | null
          trecho?: string | null
          validado_em?: string | null
          validado_por?: string | null
          valor_extraido?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          document_id?: string
          id?: string
          owner_id?: string
          pagina?: number | null
          proposal_id?: string | null
          score_confianca?: number | null
          status?: string | null
          trecho?: string | null
          validado_em?: string | null
          validado_por?: string | null
          valor_extraido?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidences_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      forensic_analyses: {
        Row: {
          cabecalhos: Json | null
          campos_literais: Json | null
          conflitos_documentais: Json | null
          created_at: string
          document_id: string
          id: string
          indice_paginas: Json | null
          inferencias: Json | null
          insights_benchmarking: string | null
          modelo_ia: string | null
          owner_id: string
          padrao_garantia: string | null
          padrao_pagamento: string | null
          padrao_posicionamento: string | null
          padrao_tecnico: string | null
          padrao_transferencia_risco: string | null
          proposal_id: string | null
          resumo_comercial: string | null
          resumo_contratual: string | null
          resumo_executivo: string | null
          resumo_tecnico: string | null
          riscos_juridicos: string | null
          riscos_operacionais: string | null
          rodapes: Json | null
          score_global: number | null
          secoes: Json | null
          taxonomia_blocos: Json | null
          tem_assinatura: boolean | null
          tem_carimbo: boolean | null
          tem_docusign: boolean | null
          tem_formulario: boolean | null
          tem_tabelas: boolean | null
          tipo_documento: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          cabecalhos?: Json | null
          campos_literais?: Json | null
          conflitos_documentais?: Json | null
          created_at?: string
          document_id: string
          id?: string
          indice_paginas?: Json | null
          inferencias?: Json | null
          insights_benchmarking?: string | null
          modelo_ia?: string | null
          owner_id: string
          padrao_garantia?: string | null
          padrao_pagamento?: string | null
          padrao_posicionamento?: string | null
          padrao_tecnico?: string | null
          padrao_transferencia_risco?: string | null
          proposal_id?: string | null
          resumo_comercial?: string | null
          resumo_contratual?: string | null
          resumo_executivo?: string | null
          resumo_tecnico?: string | null
          riscos_juridicos?: string | null
          riscos_operacionais?: string | null
          rodapes?: Json | null
          score_global?: number | null
          secoes?: Json | null
          taxonomia_blocos?: Json | null
          tem_assinatura?: boolean | null
          tem_carimbo?: boolean | null
          tem_docusign?: boolean | null
          tem_formulario?: boolean | null
          tem_tabelas?: boolean | null
          tipo_documento?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          cabecalhos?: Json | null
          campos_literais?: Json | null
          conflitos_documentais?: Json | null
          created_at?: string
          document_id?: string
          id?: string
          indice_paginas?: Json | null
          inferencias?: Json | null
          insights_benchmarking?: string | null
          modelo_ia?: string | null
          owner_id?: string
          padrao_garantia?: string | null
          padrao_pagamento?: string | null
          padrao_posicionamento?: string | null
          padrao_tecnico?: string | null
          padrao_transferencia_risco?: string | null
          proposal_id?: string | null
          resumo_comercial?: string | null
          resumo_contratual?: string | null
          resumo_executivo?: string | null
          resumo_tecnico?: string | null
          riscos_juridicos?: string | null
          riscos_operacionais?: string | null
          rodapes?: Json | null
          score_global?: number | null
          secoes?: Json | null
          taxonomia_blocos?: Json | null
          tem_assinatura?: boolean | null
          tem_carimbo?: boolean | null
          tem_docusign?: boolean | null
          tem_formulario?: boolean | null
          tem_tabelas?: boolean | null
          tipo_documento?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "forensic_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forensic_analyses_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          created_at: string
          dados: Json | null
          descricao: string | null
          id: string
          owner_id: string
          severidade: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          owner_id: string
          severidade?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          owner_id?: string
          severidade?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      processing_queue: {
        Row: {
          attempts: number | null
          created_at: string
          document_id: string
          error_message: string | null
          finished_at: string | null
          id: string
          owner_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          document_id: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          owner_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          document_id?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          owner_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_queue_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposal_review_events: {
        Row: {
          action: string
          comment: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          field_name: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          proposal_id: string
        }
        Insert: {
          action: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          field_name?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          proposal_id: string
        }
        Update: {
          action?: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          field_name?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_review_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_review_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          analise_tecnica_profunda: Json | null
          camaras: Json | null
          clausulas: Json | null
          client_id: string | null
          competitor_id: string | null
          condicao_pagamento: string | null
          created_at: string
          dados_tecnicos: Json | null
          data_proposta: string | null
          document_id: string
          exclusoes_garantia: string | null
          fornecimento_cliente: string | null
          frete_incluso: boolean | null
          frete_tipo: string | null
          garantia_limitacoes: string | null
          garantia_meses: number | null
          id: string
          indicio_fechamento: string | null
          insights_benchmarking: string | null
          instalacao_inclusa: boolean | null
          numero: string | null
          observacoes: string | null
          owner_id: string
          padrao_camara: string | null
          palavras_chave: string[] | null
          parcelas: number | null
          porte_projeto: string | null
          prazo_entrega_dias: number | null
          prazo_fabricacao_dias: number | null
          prazo_instalacao_dias: number | null
          representante_legal: string | null
          resumo_comercial: string | null
          resumo_executivo: string | null
          resumo_tecnico: string | null
          riscos: string | null
          score_confianca: number | null
          segmentacao_cliente: string | null
          status_proposta: string | null
          tem_assinatura: boolean | null
          updated_at: string
          valor_total: number | null
          vendedor: string | null
        }
        Insert: {
          analise_tecnica_profunda?: Json | null
          camaras?: Json | null
          clausulas?: Json | null
          client_id?: string | null
          competitor_id?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          dados_tecnicos?: Json | null
          data_proposta?: string | null
          document_id: string
          exclusoes_garantia?: string | null
          fornecimento_cliente?: string | null
          frete_incluso?: boolean | null
          frete_tipo?: string | null
          garantia_limitacoes?: string | null
          garantia_meses?: number | null
          id?: string
          indicio_fechamento?: string | null
          insights_benchmarking?: string | null
          instalacao_inclusa?: boolean | null
          numero?: string | null
          observacoes?: string | null
          owner_id: string
          padrao_camara?: string | null
          palavras_chave?: string[] | null
          parcelas?: number | null
          porte_projeto?: string | null
          prazo_entrega_dias?: number | null
          prazo_fabricacao_dias?: number | null
          prazo_instalacao_dias?: number | null
          representante_legal?: string | null
          resumo_comercial?: string | null
          resumo_executivo?: string | null
          resumo_tecnico?: string | null
          riscos?: string | null
          score_confianca?: number | null
          segmentacao_cliente?: string | null
          status_proposta?: string | null
          tem_assinatura?: boolean | null
          updated_at?: string
          valor_total?: number | null
          vendedor?: string | null
        }
        Update: {
          analise_tecnica_profunda?: Json | null
          camaras?: Json | null
          clausulas?: Json | null
          client_id?: string | null
          competitor_id?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          dados_tecnicos?: Json | null
          data_proposta?: string | null
          document_id?: string
          exclusoes_garantia?: string | null
          fornecimento_cliente?: string | null
          frete_incluso?: boolean | null
          frete_tipo?: string | null
          garantia_limitacoes?: string | null
          garantia_meses?: number | null
          id?: string
          indicio_fechamento?: string | null
          insights_benchmarking?: string | null
          instalacao_inclusa?: boolean | null
          numero?: string | null
          observacoes?: string | null
          owner_id?: string
          padrao_camara?: string | null
          palavras_chave?: string[] | null
          parcelas?: number | null
          porte_projeto?: string | null
          prazo_entrega_dias?: number | null
          prazo_fabricacao_dias?: number | null
          prazo_instalacao_dias?: number | null
          representante_legal?: string | null
          resumo_comercial?: string | null
          resumo_executivo?: string | null
          resumo_tecnico?: string | null
          riscos?: string | null
          score_confianca?: number | null
          segmentacao_cliente?: string | null
          status_proposta?: string | null
          tem_assinatura?: boolean | null
          updated_at?: string
          valor_total?: number | null
          vendedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analyst" | "viewer"
      document_status:
        | "uploaded"
        | "queued"
        | "processing"
        | "extracted"
        | "failed"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "analyst", "viewer"],
      document_status: [
        "uploaded",
        "queued",
        "processing",
        "extracted",
        "failed",
        "archived",
      ],
    },
  },
} as const
