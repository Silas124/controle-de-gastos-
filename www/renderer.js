// ─── Detecção de ambiente ─────────────────────────────────────────────────────
const isElectron =
  typeof window !== "undefined" &&
  typeof window.require === "function";

// ─── Camada de banco de dados universal ──────────────────────────────────────
const DB = {
  _db: null,

  init() {
    if (isElectron) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const request = indexedDB.open("gastos", 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("gastos")) {
          const store = db.createObjectStore("gastos", {
            keyPath: "id",
            autoIncrement: true
          });
          store.createIndex("categoria", "categoria", { unique: false });
          store.createIndex("data",      "data",      { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(new Error("Erro ao abrir IndexedDB: " + event.target.error));
      };
    });
  },

  salvar(gasto) {
    if (isElectron) {
      return window.require("electron")
        .ipcRenderer.invoke("salvar-gasto", gasto);
    }

    return new Promise((resolve, reject) => {
      const tx    = this._db.transaction("gastos", "readwrite");
      const store = tx.objectStore("gastos");
      const { id, ...gastoSemId } = gasto;
      const req   = store.add(gastoSemId);

      req.onsuccess = () => resolve({ id: req.result });
      req.onerror   = () => reject(req.error);
    });
  },

  listar() {
    if (isElectron) {
      return window.require("electron")
        .ipcRenderer.invoke("listar-gastos");
    }

    return new Promise((resolve, reject) => {
      const tx    = this._db.transaction("gastos", "readonly");
      const store = tx.objectStore("gastos");
      const req   = store.getAll();

      req.onsuccess = () => resolve(req.result.reverse());
      req.onerror   = () => reject(req.error);
    });
  },

  excluir(id) {
    if (isElectron) {
      return window.require("electron")
        .ipcRenderer.invoke("excluir-gasto", id);
    }

    return new Promise((resolve, reject) => {
      const tx    = this._db.transaction("gastos", "readwrite");
      const store = tx.objectStore("gastos");
      const req   = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }
};

// ─── Migração localStorage → IndexedDB ───────────────────────────────────────
async function migrarLocalStorage() {
  if (isElectron) return;

  const jaMigrou = localStorage.getItem("migrado_indexeddb");
  if (jaMigrou) return;

  const dadosAntigos = JSON.parse(localStorage.getItem("gastos") || "[]");

  if (dadosAntigos.length === 0) {
    localStorage.setItem("migrado_indexeddb", "1");
    return;
  }

  for (const gasto of dadosAntigos) {
    await DB.salvar(gasto);
  }

  localStorage.setItem("migrado_indexeddb", "1");
  localStorage.removeItem("gastos");
}

// ─── Estado local ─────────────────────────────────────────────────────────────
let gastos = [];

// ─── Init ─────────────────────────────────────────────────────────────────────
window.onload = async () => {
  try {
    await DB.init();
    await migrarLocalStorage();
    gastos = await DB.listar();
    atualizarLista();
    atualizarTotal();
  } catch (e) {
    console.error("Erro ao inicializar banco:", e);
    alert("Erro ao carregar banco de dados: " + e.message);
  }
};

// ─── Analisar imagem ──────────────────────────────────────────────────────────
// Electron: usa IPC → main.js → net.request (sem bloqueio)
// Android:  usa fetch direto (WebView não bloqueia)
async function analisarImagemComVision(base64, mimeType) {
  if (isElectron) {
    // Chama o main.js via IPC — contorna o bloqueio de rede do Electron
    const texto = await window.require("electron")
      .ipcRenderer.invoke("analisar-imagem", base64, mimeType);
    return texto;
  }

  // Android / browser — fetch direto funciona normalmente
  const GOOGLE_API_KEY = "AIza_SUA_CHAVE_COMPLETA_AQUI";

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
          }
        ]
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error("Erro Vision API: " + data.error.message);
  }

  const anotacoes = data.responses[0];
  if (!anotacoes || !anotacoes.fullTextAnnotation) {
    throw new Error("Nenhum texto encontrado na imagem.");
  }

  return anotacoes.fullTextAnnotation.text;
}

function extrairDadosDoTexto(texto) {
  // ─── Extrai valor ─────────────────────────────────────────────────────────
  let valor = 0;
  const regexValor = [
    /total[\s\S]{0,30}?R?\$?\s*([\d]{1,6}[.,][\d]{2})/im,
    /valor[\s\S]{0,30}?R?\$?\s*([\d]{1,6}[.,][\d]{2})/im,
    /R\$\s*([\d]{1,6}[.,][\d]{2})/im,
    /([\d]{1,6}[.,][\d]{2})/im
  ];

  for (const regex of regexValor) {
    const match = texto.match(regex);
    if (match) {
      valor = parseFloat(match[1].replace(".", "").replace(",", "."));
      if (valor > 0) break;
    }
  }

  // ─── Extrai descrição ─────────────────────────────────────────────────────
  const linhas = texto
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 3 && !/^\d+$/.test(l));

  const descricao = linhas[0] || "Comprovante";

  // ─── Detecta categoria ────────────────────────────────────────────────────
  const textoLower = texto.toLowerCase();
  let categoria = "Outros";

  if (/combustivel|gasolina|etanol|posto|shell|ipiranga|petrobras/i.test(textoLower)) {
    categoria = "gasolina";
  } else if (/tecido|malha|algodão|poliester|ziper/i.test(textoLower)) {
    categoria = "tecido";
  } else if (/espuma|foam/i.test(textoLower)) {
    categoria = "espuma";
  } else if (/flocos|fibra/i.test(textoLower)) {
    categoria = "flocos";
  } else if (/cola|adesivo/i.test(textoLower)) {
    categoria = "cola";
  } else if (/linha|fio|barbante/i.test(textoLower)) {
    categoria = "linha";
  }

  return { descricao, valor, categoria };
}

// ─── Ler Comprovante ──────────────────────────────────────────────────────────
function selecionarComprovante() {
  const input = document.getElementById("comprovante");
  if (!input) {
    alert("Elemento de upload não encontrado.");
    return;
  }

  input.value = "";

  input.onchange = async function (event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const btn = document.getElementById("btnComprovante");
    const textoOriginal = btn.textContent;
    btn.textContent = "⏳ Analisando...";
    btn.disabled = true;

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsDataURL(arquivo);
      });

      console.log("Enviando para Google Vision...");
      const textoExtraido = await analisarImagemComVision(base64, arquivo.type);
      console.log("Texto extraído:", textoExtraido);

      const { descricao, valor, categoria } = extrairDadosDoTexto(textoExtraido);

      document.getElementById("descricao").value = descricao;
      if (valor > 0) {
        document.getElementById("valor").value = valor.toFixed(2);
      }

      const select = document.getElementById("categoria");
      for (let opt of select.options) {
        if (opt.value.toLowerCase() === categoria.toLowerCase()) {
          select.value = opt.value;
          break;
        }
      }

      alert(
        `✅ Comprovante lido!\n\n` +
        `Descrição: ${descricao}\n` +
        `Valor: R$ ${valor.toFixed(2)}\n` +
        `Categoria: ${categoria}\n\n` +
        `Confira os dados e clique em Adicionar.`
      );

    } catch (e) {
      console.error("Erro ao analisar comprovante:", e);
      alert("Não foi possível ler o comprovante.\nErro: " + e.message);
    } finally {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }
  };

  input.click();
}

// ─── Adicionar gasto ──────────────────────────────────────────────────────────
async function adicionarGasto() {
  const descricao = document.getElementById("descricao").value.trim();
  const valor     = parseFloat(document.getElementById("valor").value);
  const categoria = document.getElementById("categoria").value;

  if (!descricao || isNaN(valor) || valor <= 0) {
    alert("Preencha descrição e um valor válido.");
    return;
  }

  const gasto = {
    descricao,
    valor,
    categoria,
    data: new Date().toLocaleDateString("pt-BR")
  };

  try {
    await DB.salvar(gasto);
    gastos = await DB.listar();
    atualizarLista();
    atualizarTotal();
    document.getElementById("descricao").value = "";
    document.getElementById("valor").value     = "";
  } catch (e) {
    console.error("Erro ao salvar:", e);
    alert("Erro ao salvar gasto: " + e.message);
  }
}

// ─── Excluir gasto ────────────────────────────────────────────────────────────
async function excluirGasto(id) {
  try {
    await DB.excluir(id);
    gastos = await DB.listar();
    atualizarLista();
    atualizarTotal();
  } catch (e) {
    console.error("Erro ao excluir:", e);
    alert("Erro ao excluir gasto: " + e.message);
  }
}

// ─── Renderização ─────────────────────────────────────────────────────────────
function atualizarLista() {
  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  gastos.forEach((gasto) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${gasto.data}</strong> —
      ${gasto.descricao} —
      R$ ${parseFloat(gasto.valor).toFixed(2)}
      (${gasto.categoria})
      <button onclick="excluirGasto(${gasto.id})">Excluir</button>
    `;
    lista.appendChild(item);
  });
}

function atualizarTotal() {
  const total = gastos.reduce((soma, g) => soma + parseFloat(g.valor), 0);
  document.getElementById("total").textContent = total.toFixed(2);
}

// ─── Filtro por categoria ─────────────────────────────────────────────────────
function filtrarCategoria() {
  const categoria     = document.getElementById("filtroCategoria").value;
  const listaFiltrada = document.getElementById("listaFiltrada");
  const totalFiltrado = document.getElementById("totalFiltrado");

  listaFiltrada.innerHTML = "";

  const filtrados = categoria === "todos"
    ? gastos
    : gastos.filter(g => g.categoria === categoria);

  let total = 0;

  filtrados.forEach(gasto => {
    total += parseFloat(gasto.valor);
    const item = document.createElement("li");
    item.textContent =
      `${gasto.data} — ${gasto.descricao} — R$ ${parseFloat(gasto.valor).toFixed(2)}`;
    listaFiltrada.appendChild(item);
  });

  totalFiltrado.textContent = total.toFixed(2);
}
