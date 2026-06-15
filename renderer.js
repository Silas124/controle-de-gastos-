const { ipcRenderer } = require("electron");

let gastos = [];

window.onload = async () => {
  await carregarGastos();
};

async function carregarGastos() {

  gastos = await ipcRenderer.invoke("listar-gastos");

  atualizarLista();
  atualizarTotal();
  filtrarCategoria();
}

async function adicionarGasto() {

  const descricao = document.getElementById("descricao").value;
  const valor = parseFloat(document.getElementById("valor").value);
  const categoria = document.getElementById("categoria").value;

  if (!descricao || !valor) {
    alert("Preencha todos os campos.");
    return;
  }

  await ipcRenderer.invoke("salvar-gasto", {
    descricao,
    valor,
    categoria,
    data: new Date().toLocaleDateString("pt-BR")
  });

  document.getElementById("descricao").value = "";
  document.getElementById("valor").value = "";

  await carregarGastos();
}

function atualizarLista() {

  const lista = document.getElementById("lista");

  lista.innerHTML = "";

  gastos.forEach((gasto) => {

    const item = document.createElement("li");

    item.innerHTML = `
      <strong>${gasto.data}</strong> -
      ${gasto.descricao} -
      R$ ${Number(gasto.valor).toFixed(2)}
      (${gasto.categoria})

      <button onclick="excluirGasto(${gasto.id})">
        Excluir
      </button>
    `;

    lista.appendChild(item);
  });

}

function atualizarTotal() {

  const total = gastos.reduce(
    (soma, gasto) => soma + Number(gasto.valor),
    0
  );

  document.getElementById("total").textContent =
    total.toFixed(2);

}

async function excluirGasto(id) {

  await ipcRenderer.invoke(
    "excluir-gasto",
    id
  );

  await carregarGastos();
}

function filtrarCategoria() {

  const categoria =
    document.getElementById("filtroCategoria").value;

  const listaFiltrada =
    document.getElementById("listaFiltrada");

  const totalFiltrado =
    document.getElementById("totalFiltrado");

  listaFiltrada.innerHTML = "";

  let filtrados = gastos;

  if (categoria !== "todos") {

    filtrados = gastos.filter(
      gasto => gasto.categoria === categoria
    );

  }

  let total = 0;

  filtrados.forEach((gasto) => {

    total += Number(gasto.valor);

    const item = document.createElement("li");

    item.textContent =
      `${gasto.data} - ${gasto.descricao} - R$ ${Number(gasto.valor).toFixed(2)}`;

    listaFiltrada.appendChild(item);

  });

  totalFiltrado.textContent =
    total.toFixed(2);
}
window.selecionarComprovante = function () {

  const input = document.getElementById("comprovante");

  if (!input) {
    alert("Input comprovante não encontrado");
    return;
  }

  input.click();

  input.onchange = function (event) {

    const arquivo = event.target.files[0];

    if (!arquivo) return;

    alert("Imagem selecionada: " + arquivo.name);

    console.log(arquivo);

  };

};