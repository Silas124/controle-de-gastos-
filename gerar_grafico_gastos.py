import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  
import matplotlib.pyplot as plt

def carregar_dados(caminho):
    if caminho and Path(caminho).exists():
        with open(caminho, "r", encoding="utf-8") as f:
            return json.load(f)
    raise FileNotFoundError(f"Arquivo não encontrado: {caminho}")

def gerar_graficos(dados, saida_prefixo="grafico_gastos"):
    categorias = [d["categoria"] for d in dados]
    valores = [d["valor"] for d in dados]
    total = sum(valores)

    # --- Gráfico de barras ---
    fig, ax = plt.subplots(figsize=(8, 5))
    barras = ax.bar(categorias, valores, color="#4C72B0")
    ax.set_title("Gastos por Categoria")
    ax.set_ylabel("Valor (R$)")
    ax.bar_label(barras, fmt="R$ %.0f")
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()
    caminho_barras = f"{saida_prefixo}_barras.png"
    plt.savefig(caminho_barras, dpi=150)
    plt.close(fig)

    # --- Gráfico de pizza ---
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.pie(
        valores,
        labels=categorias,
        autopct=lambda p: f"{p:.1f}%\n(R$ {p/100*total:.0f})",
        startangle=90,
    )
    ax.set_title("Distribuição dos Gastos")
    plt.tight_layout()
    caminho_pizza = f"{saida_prefixo}_pizza.png"
    plt.savefig(caminho_pizza, dpi=150)
    plt.close(fig)

    print(f"Total de gastos: R$ {total:.2f}")
    print(f"Gráfico de barras salvo em: {caminho_barras}")
    print(f"Gráfico de pizza salvo em: {caminho_pizza}")


if __name__ == "__main__":
    caminho_arquivo = sys.argv[1] if len(sys.argv) > 1 else None
    dados = carregar_dados(caminho_arquivo)
    gerar_graficos(dados)


