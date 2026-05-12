import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(url, key)

export type Processo = {
  id?: string
  numero?: string
  cliente: string
  wa?: string
  vara?: string
  tribunal?: string
  area?: string
  fase?: string
  valor_causa?: number | null
  honorarios_exito_pct?: number | null
  honorarios_sucumbencia?: number | null
  proxima_movimentacao?: string | null
  proxima_movimentacao_desc?: string
  obs?: string
  status?: string
  criado_em?: string
  atualizado_em?: string
}

export const FASES = ['Inicial','Em andamento','Aguardando sentença','Recurso','Transitado em julgado','Execução','Encerrado']
export const AREAS = ['Cível','Família e Sucessões','Trabalhista','Previdenciário','Administrativo','Bancário','Consumidor','Criminal']
export const STATUS = ['Ativo','Suspenso','Encerrado']
