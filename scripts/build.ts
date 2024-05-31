import { build } from 'esbuild'
import { readFile, rm, writeFile } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })

const panic = () => process.exit(1)

await build({
  entryPoints: ['./src/renderer'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/renderer.js',
  sourcemap: true,
  external: ['electron'],
  define: { __DEV__: 'false' },
})

await build({
  entryPoints: ['./src/preload'],
  bundle: true,
  format: 'cjs',
  outfile: 'dist/preload.js',
  external: ['electron'],
}).catch(panic)

await build({
  entryPoints: ['./src/main'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'dist/main.js',
  packages: 'external',
}).catch(panic)

let main = await readFile('dist/main.js', 'utf8')
main = main.replace('__URL__', 'new URL("../index.html", import.meta.url).toString()')
await writeFile('dist/main.js', main)
