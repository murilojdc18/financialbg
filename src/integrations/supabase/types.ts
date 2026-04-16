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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      claim_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          created_at: string | null
          document: string | null
          document_normalized: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          portal_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          document?: string | null
          document_normalized?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          portal_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          document?: string | null
          document_normalized?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          portal_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_duplicate: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      operations: {
        Row: {
          archived_at: string | null
          cash_source: string
          client_id: string
          created_at: string | null
          fee_fixed: number | null
          fee_insurance: number | null
          id: string
          late_grace_days: number | null
          late_interest_daily_percent: number | null
          late_interest_monthly_percent: number | null
          late_penalty_percent: number | null
          notes: string | null
          owner_id: string
          principal: number
          rate_monthly: number
          start_date: string
          status: Database["public"]["Enums"]["operation_status"]
          system: Database["public"]["Enums"]["operation_system"]
          term_months: number
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          cash_source?: string
          client_id: string
          created_at?: string | null
          fee_fixed?: number | null
          fee_insurance?: number | null
          id?: string
          late_grace_days?: number | null
          late_interest_daily_percent?: number | null
          late_interest_monthly_percent?: number | null
          late_penalty_percent?: number | null
          notes?: string | null
          owner_id?: string
          principal: number
          rate_monthly: number
          start_date: string
          status?: Database["public"]["Enums"]["operation_status"]
          system?: Database["public"]["Enums"]["operation_system"]
          term_months: number
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          cash_source?: string
          client_id?: string
          created_at?: string | null
          fee_fixed?: number | null
          fee_insurance?: number | null
          id?: string
          late_grace_days?: number | null
          late_interest_daily_percent?: number | null
          late_interest_monthly_percent?: number | null
          late_penalty_percent?: number | null
          notes?: string | null
          owner_id?: string
          principal?: number
          rate_monthly?: number
          start_date?: string
          status?: Database["public"]["Enums"]["operation_status"]
          system?: Database["public"]["Enums"]["operation_system"]
          term_months?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          alloc_contract_interest: number | null
          alloc_interest: number | null
          alloc_late_interest: number | null
          alloc_penalty: number | null
          alloc_principal: number | null
          amount: number
          amount_total: number
          client_id: string | null
          created_at: string | null
          discount_contract_interest: number | null
          discount_interest: number | null
          discount_late_interest: number | null
          discount_penalty: number | null
          discount_principal: number | null
          id: string
          is_voided: boolean | null
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          notes: string | null
          operation_id: string | null
          owner_id: string
          paid_at: string
          receivable_id: string
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          alloc_contract_interest?: number | null
          alloc_interest?: number | null
          alloc_late_interest?: number | null
          alloc_penalty?: number | null
          alloc_principal?: number | null
          amount: number
          amount_total: number
          client_id?: string | null
          created_at?: string | null
          discount_contract_interest?: number | null
          discount_interest?: number | null
          discount_late_interest?: number | null
          discount_penalty?: number | null
          discount_principal?: number | null
          id?: string
          is_voided?: boolean | null
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          notes?: string | null
          operation_id?: string | null
          owner_id?: string
          paid_at?: string
          receivable_id: string
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          alloc_contract_interest?: number | null
          alloc_interest?: number | null
          alloc_late_interest?: number | null
          alloc_penalty?: number | null
          alloc_principal?: number | null
          amount?: number
          amount_total?: number
          client_id?: string | null
          created_at?: string | null
          discount_contract_interest?: number | null
          discount_interest?: number | null
          discount_late_interest?: number | null
          discount_penalty?: number | null
          discount_principal?: number | null
          id?: string
          is_voided?: boolean | null
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          notes?: string | null
          operation_id?: string | null
          owner_id?: string
          paid_at?: string
          receivable_id?: string
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_tray: {
        Row: {
          descricao_grande: string | null
          estoque_atual: number | null
          fim_promocao: string | null
          imagem_2: string | null
          imagem_3: string | null
          imagem_4: string | null
          imagem_principal: string | null
          imagens_adicionais: string | null
          inicio_promocao: string | null
          marca: string | null
          nome_categoria: string | null
          nome_produto: string | null
          preco_promocao: number | null
          preco_venda: number | null
          seo_palavra_chave: string | null
          Uid: string
          url_produto_tray: string | null
        }
        Insert: {
          descricao_grande?: string | null
          estoque_atual?: number | null
          fim_promocao?: string | null
          imagem_2?: string | null
          imagem_3?: string | null
          imagem_4?: string | null
          imagem_principal?: string | null
          imagens_adicionais?: string | null
          inicio_promocao?: string | null
          marca?: string | null
          nome_categoria?: string | null
          nome_produto?: string | null
          preco_promocao?: number | null
          preco_venda?: number | null
          seo_palavra_chave?: string | null
          Uid?: string
          url_produto_tray?: string | null
        }
        Update: {
          descricao_grande?: string | null
          estoque_atual?: number | null
          fim_promocao?: string | null
          imagem_2?: string | null
          imagem_3?: string | null
          imagem_4?: string | null
          imagem_principal?: string | null
          imagens_adicionais?: string | null
          inicio_promocao?: string | null
          marca?: string | null
          nome_categoria?: string | null
          nome_produto?: string | null
          preco_promocao?: number | null
          preco_venda?: number | null
          seo_palavra_chave?: string | null
          Uid?: string
          url_produto_tray?: string | null
        }
        Relationships: []
      }
      produtos_tray_duplicate: {
        Row: {
          altura: number | null
          caracteristicas: string | null
          codigo_categoria: number | null
          codigo_loja: number | null
          codigo_produto: number
          comprimento: number | null
          cor: string | null
          data_ativacao: string | null
          data_cadastro: string | null
          data_desativacao: string | null
          descricao_grande: string | null
          disponibilidade: string | null
          disponivel: boolean | null
          ean: string | null
          estoque_atual: number | null
          estoque_minimo: number | null
          exibir_na_loja: boolean | null
          fim_promocao: string | null
          frete: number | null
          garantia: string | null
          imagem_2: string | null
          imagem_3: string | null
          imagem_4: string | null
          imagem_principal: string | null
          imagens_adicionais: string | null
          inicio_promocao: string | null
          itens_inclusos: string | null
          largura: number | null
          marca: string | null
          mensagem_adicional: string | null
          modelo: string | null
          nome_categoria: string | null
          nome_produto: string | null
          peso: number | null
          preco_custo: number | null
          preco_custo_dolar: number | null
          preco_promocao: number | null
          preco_venda: number | null
          quantidade_vendida: number | null
          referencia: string | null
          selo_adicional: string | null
          selo_destaque: string | null
          selo_lancamento: string | null
          seo_descricao_simplificada: string | null
          seo_palavra_chave: string | null
          seo_titulo: string | null
          tamanho: string | null
          url_produto_tray: string | null
        }
        Insert: {
          altura?: number | null
          caracteristicas?: string | null
          codigo_categoria?: number | null
          codigo_loja?: number | null
          codigo_produto: number
          comprimento?: number | null
          cor?: string | null
          data_ativacao?: string | null
          data_cadastro?: string | null
          data_desativacao?: string | null
          descricao_grande?: string | null
          disponibilidade?: string | null
          disponivel?: boolean | null
          ean?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          exibir_na_loja?: boolean | null
          fim_promocao?: string | null
          frete?: number | null
          garantia?: string | null
          imagem_2?: string | null
          imagem_3?: string | null
          imagem_4?: string | null
          imagem_principal?: string | null
          imagens_adicionais?: string | null
          inicio_promocao?: string | null
          itens_inclusos?: string | null
          largura?: number | null
          marca?: string | null
          mensagem_adicional?: string | null
          modelo?: string | null
          nome_categoria?: string | null
          nome_produto?: string | null
          peso?: number | null
          preco_custo?: number | null
          preco_custo_dolar?: number | null
          preco_promocao?: number | null
          preco_venda?: number | null
          quantidade_vendida?: number | null
          referencia?: string | null
          selo_adicional?: string | null
          selo_destaque?: string | null
          selo_lancamento?: string | null
          seo_descricao_simplificada?: string | null
          seo_palavra_chave?: string | null
          seo_titulo?: string | null
          tamanho?: string | null
          url_produto_tray?: string | null
        }
        Update: {
          altura?: number | null
          caracteristicas?: string | null
          codigo_categoria?: number | null
          codigo_loja?: number | null
          codigo_produto?: number
          comprimento?: number | null
          cor?: string | null
          data_ativacao?: string | null
          data_cadastro?: string | null
          data_desativacao?: string | null
          descricao_grande?: string | null
          disponibilidade?: string | null
          disponivel?: boolean | null
          ean?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          exibir_na_loja?: boolean | null
          fim_promocao?: string | null
          frete?: number | null
          garantia?: string | null
          imagem_2?: string | null
          imagem_3?: string | null
          imagem_4?: string | null
          imagem_principal?: string | null
          imagens_adicionais?: string | null
          inicio_promocao?: string | null
          itens_inclusos?: string | null
          largura?: number | null
          marca?: string | null
          mensagem_adicional?: string | null
          modelo?: string | null
          nome_categoria?: string | null
          nome_produto?: string | null
          peso?: number | null
          preco_custo?: number | null
          preco_custo_dolar?: number | null
          preco_promocao?: number | null
          preco_venda?: number | null
          quantidade_vendida?: number | null
          referencia?: string | null
          selo_adicional?: string | null
          selo_destaque?: string | null
          selo_lancamento?: string | null
          seo_descricao_simplificada?: string | null
          seo_palavra_chave?: string | null
          seo_titulo?: string | null
          tamanho?: string | null
          url_produto_tray?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          accrual_frozen_at: string | null
          amount: number
          amount_paid: number | null
          carried_interest_amount: number | null
          carried_penalty_amount: number | null
          client_id: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          due_date: string
          id: string
          installment_number: number
          interest_accrued: number | null
          is_manual_amount: boolean
          last_interest_calc_at: string | null
          manual_adjustment_amount: number
          manual_adjustment_reason: string | null
          notes: string | null
          operation_id: string
          owner_id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          penalty_amount: number | null
          penalty_applied: boolean | null
          renegotiated_from_receivable_id: string | null
          renegotiated_to_receivable_id: string | null
          status: Database["public"]["Enums"]["receivable_status"]
          updated_at: string | null
        }
        Insert: {
          accrual_frozen_at?: string | null
          amount: number
          amount_paid?: number | null
          carried_interest_amount?: number | null
          carried_penalty_amount?: number | null
          client_id: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          due_date: string
          id?: string
          installment_number: number
          interest_accrued?: number | null
          is_manual_amount?: boolean
          last_interest_calc_at?: string | null
          manual_adjustment_amount?: number
          manual_adjustment_reason?: string | null
          notes?: string | null
          operation_id: string
          owner_id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          penalty_amount?: number | null
          penalty_applied?: boolean | null
          renegotiated_from_receivable_id?: string | null
          renegotiated_to_receivable_id?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string | null
        }
        Update: {
          accrual_frozen_at?: string | null
          amount?: number
          amount_paid?: number | null
          carried_interest_amount?: number | null
          carried_penalty_amount?: number | null
          client_id?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          interest_accrued?: number | null
          is_manual_amount?: boolean
          last_interest_calc_at?: string | null
          manual_adjustment_amount?: number
          manual_adjustment_reason?: string | null
          notes?: string | null
          operation_id?: string
          owner_id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          penalty_amount?: number | null
          penalty_applied?: boolean | null
          renegotiated_from_receivable_id?: string | null
          renegotiated_to_receivable_id?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_renegotiated_from_receivable_id_fkey"
            columns: ["renegotiated_from_receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_renegotiated_to_fkey"
            columns: ["renegotiated_to_receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      cleanup_old_claim_attempts: { Args: never; Returns: undefined }
      create_operation_with_receivables: {
        Args: {
          p_client_id: string
          p_fee_fixed?: number
          p_fee_insurance?: number
          p_notes?: string
          p_principal: number
          p_rate_monthly: number
          p_receivables?: Json
          p_start_date: string
          p_system: Database["public"]["Enums"]["operation_system"]
          p_term_months: number
        }
        Returns: string
      }
      get_my_client_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      has_role:
        | { Args: { _role: string }; Returns: boolean }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "client"
      operation_status: "ATIVA" | "QUITADA" | "CANCELADA"
      operation_system: "PRICE" | "SAC"
      payment_method:
        | "PIX"
        | "BOLETO"
        | "TRANSFERENCIA"
        | "DINHEIRO"
        | "CARTAO"
        | "OUTRO"
      receivable_status:
        | "EM_ABERTO"
        | "PAGO"
        | "ATRASADO"
        | "PARCIAL"
        | "RENEGOCIADA"
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
      app_role: ["admin", "client"],
      operation_status: ["ATIVA", "QUITADA", "CANCELADA"],
      operation_system: ["PRICE", "SAC"],
      payment_method: [
        "PIX",
        "BOLETO",
        "TRANSFERENCIA",
        "DINHEIRO",
        "CARTAO",
        "OUTRO",
      ],
      receivable_status: [
        "EM_ABERTO",
        "PAGO",
        "ATRASADO",
        "PARCIAL",
        "RENEGOCIADA",
      ],
    },
  },
} as const
