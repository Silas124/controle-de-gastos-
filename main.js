const { app, BrowserWindow, ipcMain } = require("electron");
const db = require("./database");
const path = require("path");

function createWindow() {

  const win = new BrowserWindow({
    width: 1000,
    height: 700,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
})

ipcMain.handle("salvar-gasto", async (event, gasto) => {

  return new Promise((resolve, reject) => {

    db.run(
      `
      INSERT INTO gastos
      (descricao, valor, categoria, data)
      VALUES (?, ?, ?, ?)
      `,
      [
        gasto.descricao,
        gasto.valor,
        gasto.categoria,
        gasto.data
      ],
      function(err) {

        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID
          });
        }

      }
    );

  });

});

ipcMain.handle("listar-gastos", async () => {

  return new Promise((resolve, reject) => {

    db.all(
      "SELECT * FROM gastos ORDER BY id DESC",
      [],
      (err, rows) => {

        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }

      }
    );

  });

});