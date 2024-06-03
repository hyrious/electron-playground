import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
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
    main.webContents.openDevTools({ mode: 'detach' })
    // macOS: Move focus to previous app, convenient when local debugging.
    if (app.hide) app.hide()
    // Windows: Set default fonts, which by now is too hard to read.
    // https://github.com/electron/electron/issues/42055
  })
  main.loadURL(__URL__)
  main.webContents.setWindowOpenHandler((details) => {
    const [x, y] = BrowserWindow.getFocusedWindow()?.getPosition() || [0, 0]
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        backgroundColor: dark$.value ? '#000' : '#fff',
        width: 400, height: 250,
        x: x + 25,
        y: y + 20,
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
