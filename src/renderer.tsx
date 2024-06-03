import type { NativeAPI } from './preload'
import './live-reload'
import { h, appendChild } from '@wopjs/dom'

declare global {
  interface Window { readonly electron?: NativeAPI }
}

const ws: Window[] = [window]

appendChild(document.body, <button>Hello</button>).onclick = function hello() {
  let w = window.open('about:blank')!
  let meta = w.document.head.appendChild(document.createElement('meta'))
  meta.name = 'color-scheme'
  meta.content = 'light dark'
  w.document.body.append(this)
  w.onbeforeunload = () => {
    ws.pop()
    ws.at(-1)?.document.body.append(this)
    console.log('depth:', ws.length + 1, '->', ws.length)
  }
  ws.push(w)
  console.log('depth:', ws.length - 1, '->', ws.length)
}
