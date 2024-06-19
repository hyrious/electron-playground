import type { NativeAPI } from './preload'
import './live-reload'
import { h, appendChild } from '@wopjs/dom'

declare global {
  interface Window { readonly electron?: NativeAPI }
}

appendChild(document.body, <h1>Hello, world!</h1>)
