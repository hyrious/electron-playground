import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { from } from 'value-enhancer'

declare const __URL__: string

const dark$ = from(() => nativeTheme.shouldUseDarkColors, (notify) => {
  nativeTheme.on('updated', notify)
  return () => nativeTheme.off('updated', notify)
})

// Must use `whenReady().then(...)`, `await whenReady()` will never resolve.
// https://github.com/electron/electron/issues/40719
app.whenReady().then(() => {
  const open_devtools = (win: BrowserWindow) => {
    win.webContents.openDevTools({ mode: 'detach' })
    win.webContents.on('did-create-window', open_devtools)
  }
  let main = new BrowserWindow({
    show: false,
    useContentSize: true,
    autoHideMenuBar: true,
    backgroundColor: dark$.value ? '#000' : '#fff',
    webPreferences: {
      // Must use absolute system path, `file://` is not supported.
      preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
    },
  })
  // It doesn't help much, still needs `backgroundColor` to help reducing flash.
  main.once('ready-to-show', () => {
    main.showInactive()
    // macOS: Move focus to previous app, convenient when local debugging.
    if (app.hide) app.hide()
    // Windows: Set default fonts, which by now is too hard to read.
    // https://github.com/electron/electron/issues/42055
    open_devtools(main)
  })
  main.loadURL(__URL__)
  main.webContents.setWindowOpenHandler((details) => {
    const [x, y] = BrowserWindow.getFocusedWindow()?.getPosition() || [0, 0]
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        backgroundColor: dark$.value ? '#000' : '#fff',
        width: 640, height: 480,
        x: x + 25, y: y + 20,
        webPreferences: {
          preload: fileURLToPath(new URL('./preload.js?' + Date.now(), import.meta.url)),
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
