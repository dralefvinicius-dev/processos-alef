'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Processo, FASES, AREAS, STATUS } from '@/lib/supabase'

const NAVY = '#0D1B2E'
const GOLD = '#C9A84C'

const FASE_COR: Record<string, { bg: string; color: string }> = {
  'Inicial': { bg: '#dbeafe', color: '#1e40af' },
  'Em andamento': { bg: '#d1fae5', color: '#065f46' },
  'Aguardando sentença': { bg: '#fef3c7', color: '#92400e' },
  'Recurso': { bg: '#ede9fe', color: '#5b21b6' },
  'Transitado em julgado': { bg: '#ccfbf1', color: '#134e4a' },
  'Execução': { bg: '#fee2e2', color: '#991b1b' },
  'Encerrado': { bg: '#f3f4f6', color: '#6b7280' },
}

const PROC_VAZIO: Processo = {
  numero: '', cliente: '', wa: '', vara: '', tribunal: '',
  area: 'Cível', fase: 'Inicial', valor_causa: null,
  honorarios_exito_pct: null, honorarios_sucumbencia: null,
  proxima_movimentacao: null, proxima_movimentacao_desc: '', obs: '', status: 'Ativo'
}

function fmt(v: number | null | undefined) {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function calcExito(p: Processo & { condenacao_prevista?: number | null }): number {
  const base = p.condenacao_prevista || 0
  if (!base || !p.honorarios_exito_pct) return 0
  return (base * p.honorarios_exito_pct) / 100
}

function calcTotal(p: Processo & { condenacao_prevista?: number | null }): number {
  return calcExito(p) + (p.honorarios_sucumbencia || 0)
}

function Initials({ nome }: { nome: string }) {
  const parts = nome.trim().split(' ')
  const ini = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
  return (
    <div style={{ background: NAVY, color: GOLD, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
      {ini.toUpperCase()}
    </div>
  )
}

type ProcessoExt = Processo & { condenacao_prevista?: number | null }

export default function Home() {
  const [aba, setAba] = useState<'dashboard' | 'processos' | 'honorarios'>('dashboard')
  const [processos, setProcessos] = useState<ProcessoExt[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<ProcessoExt>(PROC_VAZIO)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroFase, setFiltroFase] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Ativo')

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    const { data, error } = await supabase.from('processos').select('*').order('criado_em', { ascending: false })
    if (error) setErro('Erro: ' + error.message)
    setProcessos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const ativos = processos.filter(p => p.status === 'Ativo')
  const totalExito = ativos.reduce((acc, p) => acc + calcExito(p), 0)
  const totalSucumbencia = ativos.reduce((acc, p) => acc + (p.honorarios_sucumbencia || 0), 0)
  const totalGeral = totalExito + totalSucumbencia
  const totalCausa = ativos.reduce((acc, p) => acc + (p.valor_causa || 0), 0)

  const hoje = new Date()
  const proximosVencimentos = processos.filter(p => {
    if (!p.proxima_movimentacao || p.status !== 'Ativo') return false
    const diff = (new Date(p.proxima_movimentacao).getTime() - hoje.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  }).sort((a, b) => new Date(a.proxima_movimentacao!).getTime() - new Date(b.proxima_movimentacao!).getTime())

  const filtrados = processos.filter(p => {
    if (busca && !`${p.cliente} ${p.numero} ${p.vara}`.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroFase && p.fase !== filtroFase) return false
    if (filtroStatus && p.status !== filtroStatus) return false
    return true
  })

  const salvar = async () => {
    if (!form.cliente.trim()) return alert('Nome do cliente é obrigatório.')
    setSaving(true)
    const payload = {
      ...form,
      valor_causa: form.valor_causa || null,
      condenacao_prevista: (form as any).condenacao_prevista || null,
      honorarios_exito_pct: form.honorarios_exito_pct || null,
      honorarios_sucumbencia: form.honorarios_sucumbencia || null,
      proxima_movimentacao: form.proxima_movimentacao || null,
      atualizado_em: new Date().toISOString()
    }
    const { error } = editId
      ? await supabase.from('processos').update(payload).eq('id', editId)
      : await supabase.from('processos').insert(payload)
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setModal(false); carregar()
  }

  const excluir = async (id: string, cliente: string) => {
    if (!confirm(`Excluir processo de "${cliente}"?`)) return
    await supabase.from('processos').delete().eq('id', id); carregar()
  }

  const abrirEditar = (p: ProcessoExt) => { setForm({ ...p }); setEditId(p.id || null); setModal(true) }
  const abrirNovo = () => { setForm({ ...PROC_VAZIO }); setEditId(null); setModal(true) }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '▦' },
    { id: 'processos', label: 'Processos', icon: '◎' },
    { id: 'honorarios', label: 'Honorários', icon: '◈' },
  ] as const

  const inp: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }
  const sublbl: React.CSSProperties = { fontSize: 11, color: '#9ca3af', display: 'block', marginTop: 2 }

  const barChart = (campo: keyof Processo) => {
    const m: Record<string, number> = {}
    ativos.forEach(p => { const v = (p[campo] as string) || 'Não informado'; m[v] = (m[v] || 0) + 1 })
    const items = Object.entries(m).sort((a, b) => b[1] - a[1])
    const max = items[0]?.[1] || 1
    return items.map(([k, v]) => (
      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 130, fontSize: 12, color: '#6b7280', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
        <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(v / max * 100)}%`, background: GOLD, height: '100%', borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 16, color: NAVY }}>{v}</span>
      </div>
    ))
  }

  const exitoPreview = calcExito(form)
  const totalPreview = calcTotal(form)

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .layout { display: flex; min-height: 100vh; }
        .sidebar { width: 220px; background: ${NAVY}; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 20; }
        .main { margin-left: 220px; flex: 1; padding: 28px 32px; padding-bottom: 40px; }
        .bottomnav { display: none; }
        .stats4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
        .stats2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; margin-bottom: 24px; }
        .charts2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .topbar { display: none; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .hon-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .hon-exito { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .bottomnav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: ${NAVY}; z-index: 20; border-top: 1px solid rgba(201,168,76,0.2); padding-bottom: env(safe-area-inset-bottom); }
          .bottomnav button { flex: 1; background: none; border: none; color: rgba(255,255,255,0.6); padding: 10px 4px 8px; font-size: 10px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; }
          .bottomnav button.active { color: ${GOLD}; }
          .bottomnav button span.icon { font-size: 18px; }
          .main { margin-left: 0; padding: 16px; padding-bottom: 90px; }
          .topbar { display: flex !important; }
          .stats4 { grid-template-columns: repeat(2,1fr); gap: 10px; }
          .stats2 { grid-template-columns: 1fr; gap: 10px; }
          .charts2 { grid-template-columns: 1fr; }
          .desktop-header { display: none !important; }
          .table-wrap { overflow-x: auto; }
          .hon-grid { grid-template-columns: 1fr; }
          .hon-exito { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div style={{ padding: '24px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>AV</span>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>ALEF VINICIUS</div>
                <div style={{ color: GOLD, fontSize: 9, letterSpacing: 2 }}>ADVOCACIA</div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid rgba(201,168,76,0.25)`, margin: '0 16px 8px' }} />
          <div style={{ padding: '8px 20px 12px' }}>
            <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>Gestão de Processos</div>
          </div>
          <nav style={{ flex: 1, padding: '0 12px' }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setAba(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 4, fontSize: 13, fontWeight: aba === item.id ? 600 : 400, background: aba === item.id ? 'rgba(201,168,76,0.18)' : 'transparent', color: aba === item.id ? GOLD : 'rgba(255,255,255,0.65)', textAlign: 'left' }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: '16px 20px', borderTop: `1px solid rgba(255,255,255,0.07)` }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.8 }}>OAB/PA 35.567</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Parauapebas/PA</div>
          </div>
        </div>

        {/* Main */}
        <div className="main">
          <div className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${GOLD}`, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: GOLD, fontWeight: 700, fontSize: 12 }}>AV</span>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>PROCESSOS</div>
                <div style={{ fontSize: 10, color: GOLD }}>ALEF VINICIUS</div>
              </div>
            </div>
            <button onClick={abrirNovo} style={{ background: NAVY, color: GOLD, border: `1px solid ${GOLD}`, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Processo</button>
          </div>

          <div className="desktop-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: 0 }}>
                {aba === 'dashboard' ? 'Dashboard' : aba === 'processos' ? 'Processos' : 'Honorários'}
              </h1>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '3px 0 0' }}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button onClick={abrirNovo} style={{ background: NAVY, color: GOLD, border: `1px solid ${GOLD}`, padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Novo processo</button>
          </div>

          {erro && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{erro}</div>}
          {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Carregando...</div>}

          {/* DASHBOARD */}
          {!loading && aba === 'dashboard' && (
            <div>
              <div className="stats4">
                {[
                  { label: 'Processos ativos', val: ativos.length, cor: NAVY, tipo: 'num' },
                  { label: 'Valor total em causa', val: totalCausa, cor: '#2563eb', tipo: 'money' },
                  { label: 'Previsão total', val: totalGeral, cor: GOLD, tipo: 'money' },
                  { label: 'Honorários de êxito', val: totalExito, cor: '#059669', tipo: 'money' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: 16, borderLeft: `4px solid ${s.cor}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                    <div style={{ fontSize: s.tipo === 'money' ? 17 : 30, fontWeight: 700, color: s.cor }}>{s.tipo === 'money' ? fmt(s.val as number) : s.val}</div>
                  </div>
                ))}
              </div>
              <div className="stats2">
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, borderLeft: `4px solid #7c3aed`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Honorários de sucumbência</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#7c3aed' }}>{fmt(totalSucumbencia)}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, borderLeft: `4px solid ${GOLD}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total previsto (êxito + sucumbência)</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: GOLD }}>{fmt(totalGeral)}</div>
                </div>
              </div>
              {proximosVencimentos.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>⚠️ Próximas movimentações (7 dias)</div>
                  {proximosVencimentos.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#92400e', marginBottom: 4 }}>
                      <span><strong>{p.cliente}</strong>{p.proxima_movimentacao_desc ? ` — ${p.proxima_movimentacao_desc}` : ''}</span>
                      <span style={{ fontWeight: 600 }}>{new Date(p.proxima_movimentacao! + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="charts2">
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 14, borderBottom: `2px solid ${GOLD}`, paddingBottom: 8, display: 'inline-block' }}>Por fase</div>
                  {ativos.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Sem dados.</div> : barChart('fase')}
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 14, borderBottom: `2px solid ${GOLD}`, paddingBottom: 8, display: 'inline-block' }}>Por área</div>
                  {ativos.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Sem dados.</div> : barChart('area')}
                </div>
              </div>
            </div>
          )}

          {/* PROCESSOS */}
          {!loading && aba === 'processos' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, nº processo ou vara..." style={{ ...inp, flex: 1, minWidth: 140 }} />
                <select value={filtroFase} onChange={e => setFiltroFase(e.target.value)} style={{ ...inp, width: 'auto', flex: 'none' }}>
                  <option value="">Todas as fases</option>{FASES.map(f => <option key={f}>{f}</option>)}
                </select>
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inp, width: 'auto', flex: 'none' }}>
                  <option value="">Todos</option>{STATUS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="table-wrap">
                <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', minWidth: 560 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                        {['Cliente / Processo', 'Fase', 'Valor da causa', 'Condenação prevista', 'Previsão honorários', 'Próx. movimentação', ''].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Nenhum processo encontrado.</td></tr>}
                      {filtrados.map(p => {
                        const fc = FASE_COR[p.fase || ''] || { bg: '#f3f4f6', color: '#6b7280' }
                        const total = calcTotal(p)
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Initials nome={p.cliente} />
                                <div>
                                  <div style={{ fontWeight: 600, color: NAVY }}>{p.cliente}</div>
                                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.numero || 'Sem número'}{p.vara ? ` · ${p.vara}` : ''}</div>
                                  {p.wa && <a href={`https://wa.me/${p.wa.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#16a34a', textDecoration: 'none' }}>↗ WhatsApp</a>}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: fc.bg, color: fc.color, whiteSpace: 'nowrap' }}>{p.fase}</span>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#374151' }}>{fmt(p.valor_causa)}</td>
                            <td style={{ padding: '12px 14px', color: '#2563eb', fontWeight: 500 }}>{fmt((p as any).condenacao_prevista)}</td>
                            <td style={{ padding: '12px 14px' }}>
                              {total > 0 ? (
                                <div>
                                  <div style={{ fontWeight: 700, color: GOLD, fontSize: 13 }}>{fmt(total)}</div>
                                  <div style={{ fontSize: 10, color: '#9ca3af' }}>
                                    {calcExito(p) > 0 ? `Êxito: ${fmt(calcExito(p))}` : ''}
                                    {p.honorarios_sucumbencia ? `${calcExito(p) > 0 ? ' · ' : ''}Suc.: ${fmt(p.honorarios_sucumbencia)}` : ''}
                                  </div>
                                </div>
                              ) : <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12 }}>
                              {p.proxima_movimentacao ? (
                                <div>
                                  <div style={{ fontWeight: 500, color: NAVY }}>{new Date(p.proxima_movimentacao + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                  {p.proxima_movimentacao_desc && <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.proxima_movimentacao_desc}</div>}
                                </div>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => abrirEditar(p)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Editar</button>
                                <button onClick={() => excluir(p.id!, p.cliente)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Excluir</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* HONORÁRIOS */}
          {!loading && aba === 'honorarios' && (
            <div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 16, borderBottom: `2px solid ${GOLD}`, paddingBottom: 8, display: 'inline-block' }}>Resumo de honorários previstos</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                  {[
                    { label: 'Êxito (previsto)', val: totalExito, cor: '#059669' },
                    { label: 'Sucumbência (previsto)', val: totalSucumbencia, cor: '#7c3aed' },
                    { label: 'Total previsto', val: totalGeral, cor: GOLD },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#f8f9fa', borderRadius: 10, padding: 16, borderLeft: `4px solid ${s.cor}` }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.cor }}>{fmt(s.val)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                        {['Cliente', 'Valor da causa', 'Condenação prevista', '% Êxito', 'Hon. êxito', 'Sucumbência', 'Total previsto'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ativos.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Nenhum processo ativo.</td></tr>}
                      {ativos.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: NAVY }}>{p.cliente}</td>
                          <td style={{ padding: '12px 14px', color: '#374151' }}>{fmt(p.valor_causa)}</td>
                          <td style={{ padding: '12px 14px', color: '#2563eb', fontWeight: 500 }}>{fmt((p as any).condenacao_prevista)}</td>
                          <td style={{ padding: '12px 14px', color: '#374151' }}>{p.honorarios_exito_pct ? `${p.honorarios_exito_pct}%` : '—'}</td>
                          <td style={{ padding: '12px 14px', color: '#059669', fontWeight: 500 }}>{calcExito(p) > 0 ? fmt(calcExito(p)) : '—'}</td>
                          <td style={{ padding: '12px 14px', color: '#7c3aed', fontWeight: 500 }}>{fmt(p.honorarios_sucumbencia)}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: GOLD, fontSize: 14 }}>{fmt(calcTotal(p))}</td>
                        </tr>
                      ))}
                      {ativos.length > 0 && (
                        <tr style={{ borderTop: `2px solid ${GOLD}`, background: '#fffbeb' }}>
                          <td colSpan={4} style={{ padding: '12px 14px', fontWeight: 700, color: NAVY }}>TOTAL</td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#059669' }}>{fmt(totalExito)}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#7c3aed' }}>{fmt(totalSucumbencia)}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: GOLD, fontSize: 15 }}>{fmt(totalGeral)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav mobile */}
        <div className="bottomnav">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setAba(item.id)} className={aba === item.id ? 'active' : ''}>
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: 640, maxHeight: '93vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: `2px solid ${GOLD}` }}>
              <div style={{ width: 4, height: 20, background: GOLD, borderRadius: 4 }} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: NAVY }}>{editId ? 'Editar processo' : 'Novo processo'}</h2>
            </div>

            {/* Dados do processo */}
            <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Dados do processo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Cliente *</label>
                <input value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} placeholder="Nome completo do cliente" style={inp} />
              </div>
              <div>
                <label style={lbl}>WhatsApp</label>
                <input value={form.wa || ''} onChange={e => setForm(p => ({ ...p, wa: e.target.value }))} placeholder="+55 94 99999-0000" style={inp} />
              </div>
              <div>
                <label style={lbl}>Número do processo</label>
                <input value={form.numero || ''} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} placeholder="0000000-00.0000.0.00.0000" style={inp} />
              </div>
              <div>
                <label style={lbl}>Vara / Juízo</label>
                <input value={form.vara || ''} onChange={e => setForm(p => ({ ...p, vara: e.target.value }))} placeholder="Ex: 1ª Vara Cível" style={inp} />
              </div>
              <div>
                <label style={lbl}>Tribunal</label>
                <input value={form.tribunal || ''} onChange={e => setForm(p => ({ ...p, tribunal: e.target.value }))} placeholder="Ex: TJPA, TRT8, TRF1" style={inp} />
              </div>
              <div>
                <label style={lbl}>Área</label>
                <select value={form.area || 'Cível'} onChange={e => setForm(p => ({ ...p, area: e.target.value }))} style={inp}>
                  {AREAS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Fase</label>
                <select value={form.fase || 'Inicial'} onChange={e => setForm(p => ({ ...p, fase: e.target.value }))} style={inp}>
                  {FASES.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status || 'Ativo'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={inp}>
                  {STATUS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Valor da causa (R$)</label>
                <input type="number" value={form.valor_causa || ''} onChange={e => setForm(p => ({ ...p, valor_causa: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Referência geral do processo" style={inp} />
                <span style={sublbl}>Referência geral — não é base dos honorários</span>
              </div>
            </div>

            {/* Honorários de êxito */}
            <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Honorários de êxito</div>
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div className="hon-exito" style={{ gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Condenação prevista (R$)</label>
                  <input type="number" value={(form as any).condenacao_prevista || ''} onChange={e => setForm(p => ({ ...p, condenacao_prevista: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Valor que você estima ganhar" style={inp} />
                  <span style={sublbl}>Sua estimativa do que o juiz irá condenar</span>
                </div>
                <div>
                  <label style={lbl}>% de êxito combinado</label>
                  <input type="number" value={form.honorarios_exito_pct || ''} onChange={e => setForm(p => ({ ...p, honorarios_exito_pct: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Ex: 20" style={inp} />
                  <span style={sublbl}>Percentual contratado com o cliente</span>
                </div>
              </div>
              {exitoPreview > 0 && (
                <div style={{ background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Êxito previsto:</span>
                  <span style={{ fontWeight: 700, color: '#059669', fontSize: 15 }}>{fmt(exitoPreview)}</span>
                  {(form as any).condenacao_prevista && form.honorarios_exito_pct && (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>({form.honorarios_exito_pct}% × {fmt((form as any).condenacao_prevista)})</span>
                  )}
                </div>
              )}
            </div>

            {/* Honorários de sucumbência */}
            <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Honorários de sucumbência</div>
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Valor de sucumbência (R$)</label>
                <input type="number" value={form.honorarios_sucumbencia || ''} onChange={e => setForm(p => ({ ...p, honorarios_sucumbencia: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Valor fixado ou estimado" style={inp} />
                <span style={sublbl}>Lance o valor já fixado pelo juiz, ou sua estimativa caso ainda não haja decisão</span>
              </div>
            </div>

            {/* Preview total */}
            {totalPreview > 0 && (
              <div style={{ background: '#fffbeb', border: `1px solid ${GOLD}`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#92400e' }}>Êxito: <strong>{fmt(exitoPreview)}</strong></div>
                <div style={{ fontSize: 12, color: '#92400e' }}>Sucumbência: <strong>{fmt(form.honorarios_sucumbencia)}</strong></div>
                <div style={{ fontSize: 14, color: NAVY, fontWeight: 700 }}>Total previsto: <span style={{ color: GOLD }}>{fmt(totalPreview)}</span></div>
              </div>
            )}

            {/* Próxima movimentação */}
            <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Próxima movimentação</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Data</label>
                <input type="date" value={form.proxima_movimentacao || ''} onChange={e => setForm(p => ({ ...p, proxima_movimentacao: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Descrição</label>
                <input value={form.proxima_movimentacao_desc || ''} onChange={e => setForm(p => ({ ...p, proxima_movimentacao_desc: e.target.value }))} placeholder="Ex: Audiência de instrução" style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Observações</label>
              <textarea value={form.obs || ''} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} placeholder="Anotações relevantes sobre o processo..." style={{ ...inp, resize: 'vertical', minHeight: 80 }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: '12px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={saving} style={{ flex: 2, padding: '12px', fontSize: 14, background: NAVY, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 10, cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar processo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
