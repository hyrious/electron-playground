import type { NativeAPI } from './preload'
import './live-reload'
import { h, appendChild } from '@wopjs/dom'

declare global {
  interface Window { readonly electron?: NativeAPI }
}

appendChild(document.body, <button>Hello</button>).onclick = function hello() {
  if (window.electron) window.electron.hello('world').then(console.log)
  else alert('Hello, world!')
}
