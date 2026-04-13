const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true, 
        nodeIntegration: false,
        sandbox: false,
    }
  });

  win.maximize();
  win.loadFile('index.html');

ipcMain.on('set-ignore-mouse', (event, ignore, options) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender);
  if (targetWin) {
    // 렌더러에서 시키는 대로 투과 모드를 물리적으로 제어함
    targetWin.setIgnoreMouseEvents(ignore, options || {});
  }
});
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});