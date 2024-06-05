/// <reference types="node" />
/// <reference lib="esnext" />
import { context } from 'esbuild'
import { spawn, ChildProcess } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { seq } from '@wopjs/async-seq'
import { NetworkInterfaceInfo, networkInterfaces } from 'node:os'
import { rm } from 'node:fs/promises'

let child: ChildProcess | null
let spawning = seq({ dropHead: true, window: 1 })

await rm('dist', { recursive: true, force: true })

const log = (...args: any[]) => {
  console.info(...args)
}

const kill = async () => {
  if (child) {
    child.kill()
    await setTimeout(200)
  }
  while (child && !child.killed) {
    child.kill('SIGKILL')
    await setTimeout(100)
  }
}

let electron = './node_modules/.bin/electron'
if (process.platform === 'win32') {
  electron = electron.replaceAll('/', '\\') + '.cmd'
}

const run = async (respawn = true) => {
  await kill()
  if (respawn) {
    // Make sure the main process loads latest preload script.
    await preload.rebuild()
    log('[main] spawning', electron)
    // `shell: true` -- https://github.com/nodejs/node/issues/52554
    child = spawn(electron, ['.'], { stdio: 'overlapped', shell: process.platform === 'win32' })
    child.on('close', on_close)
    child.stdout?.on('data', (chunk: Buffer) => {
      let text = chunk.toString().trimEnd()
      if (text && !text.includes('source: devtools:')) log('[main]', text)
    })
  }
}

const on_close = (code: number | null) => {
  log('[main] electron stopped with code', code)
  process.exitCode = Number(code)
  child = null
}

let renderer = await context({
  entryPoints: ['./src/renderer'],
  bundle: true,
  format: 'esm',
  outdir: 'dist',
  sourcemap: true,
  external: ['electron', 'jspdf'],
  define: { __DEV__: 'true' },
  write: false,
})
let renderer_server = await renderer.serve({ host: '0.0.0.0', port: 3000, servedir: '.', fallback: 'index.html' })
await renderer.watch()

let preload = await context({
  entryPoints: ['./src/preload'],
  bundle: true,
  // It is not actually commonjs, but we want to keep `require('electron')`.
  // Caveats: you must make sure preload.js does not export any name.
  format: 'cjs',
  outfile: 'dist/preload.js',
  external: ['electron'],
})
await preload.watch()

const loopback = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0000:0000:0000:0000:0000:0000:0000:0001',
])

const wildcard = new Set([
  '0.0.0.0',
  '::',
  '0000:0000:0000:0000:0000:0000:0000:0000',
])

const isLan = (x: NetworkInterfaceInfo) => x.family === 'IPv4' && !x.internal

const resolve_host = async (host: string): Promise<string> => {
  if (loopback.has(host)) return 'localhost'
  if (wildcard.has(host)) {
    let nets = networkInterfaces(), k: string, tmp: NetworkInterfaceInfo | undefined
    for (k in nets) if (tmp = nets[k]!.find(isLan)) {
      return tmp.address
    }
  }
  return host
}

const renderer_url = `http://${await resolve_host(renderer_server.host)}:${renderer_server.port}`
log('[renderer] serving', renderer_url)

let main = await context({
  entryPoints: ['./src/main'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'dist/main.js',
  define: {
    __URL__: `"http://localhost:${renderer_server.port}"`,
  },
  plugins: [{
    name: 'respawn',
    setup({ onEnd }) {
      onEnd(({ errors }) => spawning.add(() => run(errors.length === 0)))
    }
  }],
  packages: 'external',
})
await main.watch()

const stop = () => {
  kill()
  preload.dispose()
  renderer.dispose()
  main.dispose()
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)
