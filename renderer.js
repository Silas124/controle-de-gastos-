// ─── Dados ────────────────────────────────────────────────────────────────────
let gastos = JSON.parse(localStorage.getItem("gastos")) || [];

// ─── Init ─────────────────────────────────────────────────────────────────────
window.onload = async () => {
  atualizarLista();
  atualizarTotal();

  // Detecta se está rodando dentro do Electron
  const isElectron =
    typeof window !== "undefined" &&
    typeof window.require === "function";

  if (isElectron) {
    try {
      const gastosBanco = await window
        .require("electron")
        .ipcRenderer.invoke("listar-gastos");
      console.log("Gastos no banco (Electron):", gastosBanco);
    } catch (e) {
      console.error("Erro ao carregar banco Electron:", e);
    }
  } else {
    // Android / navegador — usa localStorage normalmente
    console.log("Ambiente mobile/browser — usando localStorage.");
  }
};

// ─── Adicionar gasto ──────────────────────────────────────────────────────────
function adicionarGasto() {
  const descricao = document.getElementById("descricao").value.trim();
  const valor     = parseFloat(document.getElementById("valor").value);
  const categoria = document.getElementById("categoria").value;

  if (!descricao || isNaN(valor) || valor <= 0) {
    alert("Preencha descrição e um valor válido.");
    return;
  }

  gastos.push({
    descricao,
    valor,
    categoria,
    data: new Date().toLocaleDateString("pt-BR")
  });

  salvarDados();

  document.getElementById("descricao").value = "";
  document.getElementById("valor").value     = "";
}

// ─── Listar ───────────────────────────────────────────────────────────────────
function atualizarLista() {
  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  gastos.forEach((gasto, indice) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${gasto.data}</strong> —
      ${gasto.descricao} —
      R$ ${gasto.valor.toFixed(2)}
      (${gasto.categoria})
      <button onclick="excluirGasto(${indice})">Excluir</button>
    `;
    lista.appendChild(item);
  });
}

// ─── Total ────────────────────────────────────────────────────────────────────
function atualizarTotal() {
  const total = gastos.reduce((soma, g) => soma + g.valor, 0);
  document.getElementById("total").textContent = total.toFixed(2);
}

// ─── Excluir ──────────────────────────────────────────────────────────────────
function excluirGasto(indice) {
  gastos.splice(indice, 1);
  salvarDados();
}

// ─── Salvar ───────────────────────────────────────────────────────────────────
function salvarDados() {
  localStorage.setItem("gastos", JSON.stringify(gastos));
  atualizarLista();
  atualizarTotal();
}

// ─── Filtro por categoria ─────────────────────────────────────────────────────
function filtrarCategoria() {
  const categoria      = document.getElementById("filtroCategoria").value;
  const listaFiltrada  = document.getElementById("listaFiltrada");
  const totalFiltrado  = document.getElementById("totalFiltrado");

  listaFiltrada.innerHTML = "";

  const filtrados = categoria === "todos"
    ? gastos
    : gastos.filter(g => g.categoria === categoria);

  let total = 0;

  filtrados.forEach(gasto => {
    total += gasto.valor;
    const item = document.createElement("li");
    item.textContent =
      `${gasto.data} — ${gasto.descricao} — R$ ${gasto.valor.toFixed(2)}`;
    listaFiltrada.appendChild(item);
  });

  totalFiltrado.textContent = total.toFixed(2);
}

// ─── Ler Comprovante ──────────────────────────────────────────────────────────


function selecionarComprovante() {
  const input = document.getElementById("comprovante");

  if (!input) {
    alert("Elemento de upload não encontrado.");
    return;
  }

  input.value = "";

  input.onchange = function (event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    alert("Comprovante selecionado: " + arquivo.name);
    console.log("Arquivo:", arquivo);

    // TODO: aqui você pode enviar o arquivo para OCR,
    // fazer upload, ou processar a imagem conforme necessário
  };

  input.click();
}
