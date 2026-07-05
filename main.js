const { app, BrowserWindow, ipcMain, net } = require("electron");
const db = require("./database");
const path = require("path");

// ─── Chave Google Cloud Vision ────────────────────────────────────────────────
const GOOGLE_API_KEY = "AIzaSyB1-FzebPHU-xS-kM6zYJrPMz_ba3GVVdE";

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, "www", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
});

// ─── Google Vision via IPC (evita bloqueio do Electron no renderer) ───────────
ipcMain.handle("analisar-imagem", async (event, base64, mimeType) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
        }
      ]
    });

    const request = net.request({
      method: "POST",
      url: `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`
    });

    request.setHeader("Content-Type", "application/json");

    let responseData = "";

    request.on("response", (response) => {
      response.on("data", (chunk) => {
        responseData += chunk.toString();
      });

      response.on("end", () => {
        try {
          const data = JSON.parse(responseData);

          if (data.error) {
            reject(new Error("Erro Vision API: " + data.error.message));
            return;
          }

          const anotacoes = data.responses[0];
          if (!anotacoes || !anotacoes.fullTextAnnotation) {
            reject(new Error("Nenhum texto encontrado na imagem."));
            return;
          }

          resolve(anotacoes.fullTextAnnotation.text);
        } catch (e) {
          reject(new Error("Erro ao processar resposta: " + e.message));
        }
      });
    });

    request.on("error", (err) => {
      reject(new Error("Erro de rede: " + err.message));
    });

    request.write(body);
    request.end();
  });
});

// ─── Salvar ───────────────────────────────────────────────────────────────────
ipcMain.handle("salvar-gasto", async (event, gasto) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO gastos (descricao, valor, categoria, data)
       VALUES (?, ?, ?, ?)`,
      [gasto.descricao, gasto.valor, gasto.categoria, gasto.data],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
});

// ─── Listar ───────────────────────────────────────────────────────────────────
ipcMain.handle("listar-gastos", async () => {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM gastos ORDER BY id DESC",
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
});

// ─── Excluir ──────────────────────────────────────────────────────────────────
ipcMain.handle("excluir-gasto", async (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(
      "DELETE FROM gastos WHERE id = ?",
      [id],
      function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
});