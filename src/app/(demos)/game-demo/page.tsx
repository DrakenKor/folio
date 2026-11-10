import { Game } from '@/components/demo/game/Game'
import { demoMetadata } from '@/lib/demos'

export const metadata = demoMetadata('game')

export default function GameDemoPage() {
  return <Game />
}
