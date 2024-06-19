import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { from, val } from 'value-enhancer'

declare const __URL__: string

const dark$ = from(() => nativeTheme.shouldUseDarkColors, (notify) => {
  nativeTheme.on('updated', notify)
  return () => nativeTheme.off('updated', notify)
})

const position$ = val<Partial<Record<'x' | 'y' | 'width' | 'height', number>>>({})
const position_file = join(app.getPath('userData'), 'position.json')
try { position$.set(JSON.parse(readFileSync(position_file, 'utf8'))) } catch {}
position$.reaction(state => { writeFileSync(position_file, JSON.stringify(state)) })

// Must use `whenReady().then(...)`, `await whenReady()` will never resolve.
// https://github.com/electron/electron/issues/40719
app.whenReady().then(() => {
  const open_devtools = (win: BrowserWindow) => {
    win.webContents.openDevTools({ mode: 'detach' })
    win.webContents.on('did-create-window', open_devtools)
  }
  const init = position$.value
  let main = new BrowserWindow({
    show: false,
    useContentSize: true,
    autoHideMenuBar: true,
    backgroundColor: dark$.value ? '#000' : '#fff',
    x: init.x, y: init.y,
    width: init.width || 17 * 32, height: init.height || 13 * 32,
    webPreferences: {
      // Must use absolute system path, `file://` is not supported.
      preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
    },
  })
  // It doesn't help much, still needs `backgroundColor` to help reducing flash.
  main.once('ready-to-show', () => {
    if (app.isPackaged) main.show(); else main.showInactive()
    // Windows: Set default fonts, which by now is too hard to read.
    // https://github.com/electron/electron/issues/42055
    open_devtools(main)
  })
  let t: NodeJS.Timeout
  const save_position = () => {
    clearTimeout(t)
    t = setTimeout(save_position_, 500)
  }
  const save_position_ = () => {
    if (main.isNormal()) position$.set(main.getBounds())
  }
  main.on('resized', save_position).on('moved', save_position)
  main.loadURL(__URL__)
  main.webContents.setWindowOpenHandler(() => {
    const [x, y] = main.getPosition()
    const [width, height] = main.getSize()
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        backgroundColor: dark$.value ? '#000' : '#fff',
        x: x + 50, y: y + 50,
        width, height,
        webPreferences: {
          preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
        }
      }
    }
  })
})

app.on('window-all-closed', () => app.quit())

ipcMain.handle('hello', (event, message = 'world') => {
  console.info('hello(%j)', message)
  let owner: BrowserWindow | null
  return (owner = BrowserWindow.fromWebContents(event.sender)) ?
    dialog.showMessageBox(owner, { message: `Hello, ${message}!` })
  : dialog.showMessageBox({ message: `Hello, ${message}!` })
})

ipcMain.handle('loadEnv', async () => {
  let text = await readFile(new URL('../.env', import.meta.url), 'utf8')
  let env = { __proto__: null } as unknown as Record<string, string>
  for (let row of text.split(/\r\n|\r|\n/g)) if (row) {
    let [k, v] = row.split('='); env[k] = v
  }
  return env
})

dark$.reaction(dark => {
  for (let win of BrowserWindow.getAllWindows()) {
    win.setBackgroundColor(dark ? '#000' : '#fff')
  }
})
