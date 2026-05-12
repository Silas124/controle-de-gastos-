 let total = 0

function adicionarGasto(){

    const descricao =
        document.getElementById('descricao').value

    const valor = Number(
        document.getElementById('valor').value
    )
    const categoria = 
        document.getElementById("categoria").value

    if(!descricao || !valor){
        return
    }

    const lista =
        document.getElementById('lista')

    const item =
        document.createElement('li')

    item.textContent =
        `${descricao} - R$ ${valor}`

    lista.appendChild(item)

    total += valor

    document.getElementById('total')
        .textContent = total.toFixed(2)

    document.getElementById('descricao').value = ''

    document.getElementById('valor').value = ''
}
