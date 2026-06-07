let gastos = JSON.parse(localStorage.getItem("gastos")) || [];

atualizarLista();
atualizarTotal();

function adicionarGasto() {
  const descricao = document.getElementById("descricao").value;
  const valor = parseFloat(document.getElementById("valor").value);
  const categoria = document.getElementById("categoria").value;

  if (!descricao || !valor) {
    alert("Preencha todos os campos.");
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
  document.getElementById("valor").value = "";
}

function atualizarLista() {
  const lista = document.getElementById("lista");

  lista.innerHTML = "";

  gastos.forEach((gasto, indice) => {
    const item = document.createElement("li");

   item.innerHTML = `
  <strong>${gasto.data}</strong> -
  ${gasto.descricao} -
  R$ ${gasto.valor.toFixed(2)}
  (${gasto.categoria})

  <button onclick="excluirGasto(${indice})">
    Excluir
  </button>
`;

    lista.appendChild(item);
  });
}

function atualizarTotal() {
  const total = gastos.reduce(
    (soma, gasto) => soma + gasto.valor,
    0
  );

  document.getElementById("total").textContent =
    total.toFixed(2);
}

function excluirGasto(indice) {
  gastos.splice(indice, 1);
  salvarDados();
}

function salvarDados() {
  localStorage.setItem(
    "gastos",
    JSON.stringify(gastos)
  );

  atualizarLista();
  atualizarTotal();
}

function filtrarCategoria() {
  const categoriaSelecionada =
    document.getElementById("filtroCategoria").value;

  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  let gastosFiltrados = gastos;

  if (categoriaSelecionada !== "todos") {
    gastosFiltrados = gastos.filter(
      gasto => gasto.categoria === categoriaSelecionada
    );
  }

  gastosFiltrados.forEach((gasto, indice) => {
    const item = document.createElement("li");

    item.innerHTML = `
      <strong>${gasto.data}</strong> -
      ${gasto.descricao} -
      R$ ${gasto.valor.toFixed(2)}
      (${gasto.categoria})

      <button onclick="excluirGasto(${indice})">
        Excluir
      </button>
    `;

    lista.appendChild(item);
  });
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
    total += gasto.valor;

    const item = document.createElement("li");

    item.textContent =
      `${gasto.data} - ${gasto.descricao} - R$ ${gasto.valor.toFixed(2)}`;

    listaFiltrada.appendChild(item);
  });

  totalFiltrado.textContent = total.toFixed(2);
}




window.onload = async () => {

  const gastosBanco =
    await window.require("electron")
      .ipcRenderer.invoke("listar-gastos");

  console.log("Gastos no banco:", gastosBanco);

};