import type { NativeAPI } from './preload'
import './live-reload'
import { h, appendChild } from '@wopjs/dom'
import { createFastboard, createUI } from '@netless/fastboard'

declare global {
  interface Window { readonly electron?: NativeAPI }
}

async function openWhiteboard() {
  if (!window.electron) {
    throw new Error('need electron')
  }

  const env = await window.electron.loadEnv()

  const fastboard = globalThis.fastboard = await createFastboard({
    sdkConfig: {
      appIdentifier: env.VITE_APPID,
      region: 'cn-hz',
    },
    joinRoom: {
      uid: Math.random().toString(36).slice(2),
      uuid: env.VITE_ROOM_UUID,
      roomToken: env.VITE_ROOM_TOKEN,
    }
  })

  const ui = createUI(fastboard, document.getElementById('whiteboard')!)

  const dark = matchMedia('(prefers-color-scheme: dark)')
  dark.addEventListener('change', () => ui.update({ theme: dark.matches ? 'dark' : 'light' }))
  dark.dispatchEvent(new CustomEvent('change'))

  document.title = 'Whiteboard'
}

if (location.search.includes('open-whiteboard')) {
  openWhiteboard()
} else {
  appendChild(document.body, <button class="btn">Open Whiteboard</button>).onclick = function main() {
    if (window.electron)
      globalThis.w = open('/?' + Date.now() + '&open-whiteboard')
    else
      openWhiteboard()
  }
}
