'use client'

import { useCallback } from 'react'
import { Stage, useDemoShell } from '@/components/demo/DemoShell'
import { Notes, NotesSection } from '@/components/demo/Notes'
import './game.css'

export function Game() {
  const { setReady } = useDemoShell()
  // Subscribe when the iframe mounts, before its first frame can arrive.
  const connect = useCallback((frame: HTMLIFrameElement | null) => {
    if (!frame) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin === location.origin && event.source === frame.contentWindow && event.data === 'ready') {
        setReady()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setReady])

  return (
    <>
      <Stage pausable={false}>
        <iframe ref={connect} className="demo-canvas game-frame" src="/play/" title="Game" allow="fullscreen; clipboard-write" />
      </Stage>
      <Notes slug="game">
        <NotesSection title="Controls">
          <p>Click the game to focus its controls. Use WASD to move and Space to dodge.</p>
        </NotesSection>
      </Notes>
    </>
  )
}
