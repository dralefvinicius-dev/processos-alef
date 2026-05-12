import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Processos — Dr. Alef Vinicius', description: 'CRM de Processos · OAB/PA 35.567' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body style={{ margin: 0 }}>{children}</body></html>
}
