let total = 0

function adicionarGasto() {

    const descricao =
        document.getElementById('descricao').value

    const valor = Number(
        document.getElementById('valor').value
    )

    const categoria =
        document.getElementById('categoria').value

    if (!descricao || !valor) {
        return
    }

    const lista =
        document.getElementById('lista')

    const item =
        document.createElement('li')

    item.innerHTML = `
        ${descricao} | ${categoria} | R$ ${valor.toFixed(2)}
        <button onclick="removerGasto(this, ${valor})">
            X
        </button>
    `

    lista.appendChild(item)

    total += valor

    atualizarTotal()

    document.getElementById('descricao').value = ''

    document.getElementById('valor').value = ''
}

function removerGasto(botao, valor) {

    const item =
        botao.parentElement

    item.remove()

    total -= valor

    atualizarTotal()
}

function atualizarTotal() {

    document.getElementById('total')
        .textContent = total.toFixed(2)
}