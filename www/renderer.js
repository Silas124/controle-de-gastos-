// ─── Firebase via CDN ─────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query
  
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const fs = require('fs');
const firebaseConfig = {
  apiKey:            "AIzaSyDsYurM0CY51HwFqaV9jDMUoeQg36nsQdc",
  authDomain:        "controle-de-gastos-501515.firebaseapp.com",
  projectId:         "controle-de-gastos-501515",
  storageBucket:     "controle-de-gastos-501515.firebasestorage.app",
  messagingSenderId: "1091317628584",
  appId:             "1:1091317628584:web:325df371a1fb189e534c9d"
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);
const gastosRef   = collection(db, "gastos");

// ─── Detecção de ambiente ─────────────────────────────────────────────────────
const isElectron =
  typeof window !== "undefined" &&
  typeof window.require === "function";

const isAndroid =
  !isElectron &&
  typeof window.Capacitor !== "undefined" &&
  window.Capacitor.getPlatform() === "android";

// ─── Camada Firebase ──────────────────────────────────────────────────────────
const DB = {
  async salvar(gasto) {
    const docRef = await addDoc(gastosRef, gasto);
    return { id: docRef.id };
  },

  async listar() {
    const q        = query(gastosRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async excluir(id) {
    await deleteDoc(doc(db, "gastos", id));
  }
};

// ─── Estado local ─────────────────────────────────────────────────────────────
let gastos = [];

// ─── Init ─────────────────────────────────────────────────────────────────────
window.onload = async () => {
  try {
    gastos = await DB.listar();
    atualizarLista();
    atualizarTotal();
  } catch (e) {
    console.error("Erro ao carregar dados:", e);
    alert("Erro ao carregar banco de dados: " + e.message);
  }
};

// Ordena categorias alfabeticamente em todos os selects
document.querySelectorAll("select#categoria, select#filtroCategoria").forEach(select => {
  const opcoes = Array.from(select.options);
  
  // Separa "Todas" e "Outros" para manter fixos
  const fixas   = opcoes.filter(o => o.value === "todos" || o.value === "Outros");
  const demais  = opcoes.filter(o => o.value !== "todos" && o.value !== "Outros");
  
  // Ordena as demais alfabeticamente
  demais.sort((a, b) => a.text.localeCompare(b.text, "pt-BR"));
  
  // Reconstrói o select
  select.innerHTML = "";
  fixas.filter(o => o.value === "todos").forEach(o => select.appendChild(o));
  demais.forEach(o => select.appendChild(o));
  fixas.filter(o => o.value === "Outros").forEach(o => select.appendChild(o));
});

// ─── Google Vision ────────────────────────────────────────────────────────────
const GOOGLE_API_KEY = "AIzaSyB1-FzebPHU-xS-kM6zYJrPMz_ba3GVVdE";

async function analisarImagemComVision(base64) {
  if (isElectron) {
    return window.require("electron")
      .ipcRenderer.invoke("analisar-imagem", base64, "image/jpeg");
  }

  console.log("Enviando para Vision, tamanho base64:", base64.length);

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
        }]
      })
    }
  );

  console.log("Status Vision:", response.status);
  const data = await response.json();
  console.log("Resposta Vision:", JSON.stringify(data).substring(0, 200));

  if (data.error) throw new Error("Erro Vision API: " + data.error.message);

  const anotacoes = data.responses[0];
  if (!anotacoes || !anotacoes.fullTextAnnotation) {
    throw new Error("Nenhum texto encontrado na imagem.");
  }

  return anotacoes.fullTextAnnotation.text;
}

function extrairDadosDoTexto(texto) {
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

  const linhas = texto
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 3 && !/^\d+$/.test(l));

  const descricao = linhas[0] || "Comprovante";

  let categoria = "Outros";
  if (/combustivel|gasolina|etanol|posto|shell|ipiranga|petrobras/i.test(texto)) categoria = "gasolina";
  else if (/tecido|malha|algodão|poliester|ziper/i.test(texto)) categoria = "tecido";
  else if (/espuma|foam/i.test(texto)) categoria = "espuma";
  else if (/flocos|fibra/i.test(texto)) categoria = "flocos";
  else if (/cola|adesivo/i.test(texto)) categoria = "cola";
  else if (/linha|fio|barbante/i.test(texto)) categoria = "linha";
  else if (/luz|edp/i.test(texto)) categoria = "luz";
  else if (/Aluguel/i.test(texto)) categoria = "aluguel";
  else if (/agua|sabesp/i.test(texto)) categoria = "sabesp";

  return { descricao, valor, categoria };
}

function exportarDados() {
  const textoJSON = JSON.stringify(gastos, null, 2);
  fs.writeFileSync('dados_gastos.json', textoJSON)
  ; alert('Dados exportados!'); 
}



// ─── Ler Comprovante ──────────────────────────────────────────────────────────
async function selecionarComprovante() {
  const btn = document.getElementById("btnComprovante");
  const textoOriginal = btn.textContent;

  try {
    let base64 = null;

    if (isAndroid) {
      // Android: usa Capacitor Camera API — não perde o foco do app
      const { Camera } = window.Capacitor.Plugins;

      const foto = await Camera.getPhoto({
        quality:           90,
        allowEditing:      false,
        resultType:        "base64",   // retorna base64 direto
        source:            "CAMERA",   // abre câmera
        correctOrientation: true
      });

      base64 = foto.base64String;
      console.log("Foto capturada, tamanho:", base64.length);

    } else {
      // Electron/Windows: usa input file normal
      base64 = await new Promise((resolve, reject) => {
        const input = document.getElementById("comprovante");
        input.value = "";

        input.onchange = function (event) {
          const arquivo = event.target.files[0];
          if (!arquivo) { reject(new Error("Nenhum arquivo selecionado")); return; }

          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result.split(",")[1]);
          reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
          reader.readAsDataURL(arquivo);
        };

        input.click();
      });
    }

    if (!base64) return;

    btn.textContent = "⏳ Analisando...";
    btn.disabled = true;

    const textoExtraido = await analisarImagemComVision(base64);
    console.log("Texto extraído:", textoExtraido);

    const { descricao, valor, categoria } = extrairDadosDoTexto(textoExtraido);

    document.getElementById("descricao").value = descricao;
    if (valor > 0) document.getElementById("valor").value = valor.toFixed(2);

    const select = document.getElementById("categoria");
    for (let opt of select.options) {
      if (opt.value.toLowerCase() === categoria.toLowerCase()) {
        select.value = opt.value;
        break;
      }
    }

    alert(`✅ Deu certo !\n\nDescrição: ${descricao}\nValor: R$ ${valor.toFixed(2)}\nCategoria: ${categoria}\n\nConfira e clique em Adicionar.`);

  } catch (e) {
    console.error("Erro:", e);
    alert("Deu erro ixi.\nErro: " + e.message);
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
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
    data:      new Date().toLocaleDateString("pt-BR"),
    timestamp: Date.now()
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
      <button onclick="excluirGasto('${gasto.id}')">Excluir</button>
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

// ─── Expõe funções para o HTML ────────────────────────────────────────────────
window.adicionarGasto        = adicionarGasto;
window.excluirGasto          = excluirGasto;
window.filtrarCategoria      = filtrarCategoria;
window.selecionarComprovante = selecionarComprovante;
window.exportarDados = exportarDados;