/// <reference types="electron" />
import { contextBridge, ipcRenderer } from 'electron/renderer'

const api = {
  hello(world: string) {
    return ipcRenderer.invoke('hello', world)
  }
}

contextBridge.exposeInMainWorld('electron', api)

console.info('[preload] ready')

export type NativeAPI = typeof api
