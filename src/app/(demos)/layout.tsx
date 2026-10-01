import { Inter, JetBrains_Mono } from 'next/font/google'
import { DemoShell } from '@/components/demo/DemoShell'
import './demos.css'

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-demo-mono'
})

const title = Inter({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-demo-title'
})

// A route group: it gives the seven demos one shell and leaves their URLs alone.
export default function DemosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${mono.variable} ${title.variable}`}>
      <DemoShell>{children}</DemoShell>
    </div>
  )
}
