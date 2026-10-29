# 🔄 Laboratório Virtual de Rotação

**Simulador interativo de dinâmica de rotação e momento de inércia**

Produto educacional desenvolvido para a disciplina **Física Experimental A**, do curso de **Engenharia de Computação da UNIVASF**.

Explore como a **massa**, a **forma do corpo**, o **tamanho** e a **força aplicada** influenciam o movimento de rotação.

[🌐 Acessar o simulador](COLE_AQUI_O_LINK_DA_VERCEL) · [📋 Consultar a validação](./VALIDACAO.md)

## ✨ O que você pode fazer

- Observar **disco, anel, esfera e barra** em uma cena 3D interativa.
- Alterar massa, raio ou comprimento, força e sentido de rotação.
- Acompanhar torque, momento de inércia e grandezas angulares.
- Visualizar gráficos de **aceleração, velocidade e posição angular**.
- Comparar **disco e anel** simultaneamente, nas mesmas condições.
- Realizar três experimentos guiados.
- Exportar os dados do experimento em **CSV**.

A aplicação executa os cálculos no próprio navegador. **Não exige cadastro nem banco de dados.** Os dados da execução são temporários; para guardá-los, exporte o CSV antes de recarregar a página.

## 🚀 Como usar o simulador

**Para usar a versão publicada, basta abrir o link do site. Não é necessário instalar nada.**

1. **Escolha o corpo:** disco, anel, esfera ou barra.
2. **Ajuste os valores:** massa, tamanho, força e sentido.
3. Clique em **Iniciar** para observar o movimento.
4. Use **Pausar/Continuar** para analisar um instante e **Reiniciar** para começar novamente.
5. Acompanhe os valores e os gráficos abaixo da simulação.

### Movimentar a câmera

- **Arraste o mouse:** gire a visão da cena.
- **Use a roda do mouse:** aproxime ou afaste.
- **Clique em Restaurar visão:** retorne ao enquadramento inicial.

A câmera muda apenas a visualização, sem alterar o eixo físico do experimento.

### Comparar disco e anel

Abra a seção **Disco × anel** e inicie a comparação. Os corpos usam a mesma massa, raio, força e tempo simulado.

Observe qual ganha velocidade mais rapidamente e compare os gráficos.

### Salvar os dados

Clique em **Exportar dados em CSV**.

O arquivo reúne os parâmetros do experimento, as unidades e os valores calculados. Ele pode ser aberto em programas de planilha para análise.

> **Durante o uso:** alterar um parâmetro físico reinicia o experimento em zero. Cada execução dura até 20 segundos simulados. A reprodução em 0,25× ou 0,5× facilita observar o movimento.

## 🧪 Experimentos guiados

| Experimento | O que comparar | Resultado previsto |
|---|---|---|
| Disco × anel | Mesma massa, raio e força | O disco tem o dobro da aceleração angular do anel. |
| Dobrar a massa | Mesmo corpo, tamanho e força | A aceleração angular cai pela metade. |
| Dobrar a força | Mesmo corpo, massa e tamanho | A aceleração angular dobra. |

Faça uma previsão antes de executar e depois confira os valores e as curvas.

## 📐 Física utilizada

O modelo considera:

- Corpos rígidos e homogêneos.
- Eixos fixos passando pelo centro de massa.
- Ausência de atrito.
- Força tangencial constante acompanhando o ponto de aplicação.
- Partida do repouso: posição e velocidade angular iniciais iguais a zero.

O sentido positivo é o **anti-horário visto de cima**.

### Momento de inércia

| Corpo | Eixo de rotação | Momento de inércia | Braço da força |
|---|---|---|---|
| Disco / cilindro maciço | Central, perpendicular ao plano | `I = MR²/2` | `b = R` |
| Anel fino | Central, perpendicular ao plano | `I = MR²` | `b = R` |
| Esfera maciça | Ao longo de um diâmetro | `I = 2MR²/5` | `b = R` |
| Barra fina | Perpendicular à barra, pelo centro | `I = ML²/12` | `b = L/2` |

**Símbolos:** `M` = massa; `R` = raio; `L` = comprimento; `b` = braço da força.

### Equações do movimento

| Grandeza | Equação | Unidade |
|---|---|---|
| Torque | `τ = ±bF` | N·m |
| Aceleração angular | `α = τ/I` | rad/s² |
| Velocidade angular | `ω = αt` | rad/s |
| Posição angular | `θ = αt²/2` | rad |

A expressão geral do módulo do torque é `|τ| = rF sen(φ)`. Como a força é tangencial, `φ = 90°`, e a expressão se reduz a `|τ| = bF`. O sinal indica o sentido de rotação.

O simulador utiliza **soluções analíticas para aceleração constante**, avaliadas no tempo simulado. A posição angular permanece acumulada nos dados; o módulo `2π` é usado somente no desenho do objeto.

### Limites dos controles

| Parâmetro | Intervalo |
|---|---|
| Massa | 0,1 a 10 kg |
| Raio | 0,05 a 0,5 m |
| Comprimento da barra | 0,1 a 1,5 m |
| Força | 0 a 5 N |

Massa e dimensões precisam ser positivas. Força zero é permitida.

## ✅ Caso de referência

Para conferir o modelo, considere:

**Massa = 2 kg · Raio = 0,5 m · Força = 1 N**

| Resultado | Disco | Anel |
|---|---:|---:|
| Momento de inércia | 0,25 kg·m² | 0,50 kg·m² |
| Torque | 0,50 N·m | 0,50 N·m |
| Aceleração angular | 2 rad/s² | 1 rad/s² |
| Velocidade em 2 s | 4 rad/s | 2 rad/s |
| Posição angular em 2 s | 4 rad | 2 rad |

Esses valores são referências para a validação dos cálculos. A validação numérica não comprova, por si só, a eficácia pedagógica do produto.

## 💻 Executar no computador

Esta seção é para quem deseja desenvolver ou modificar o projeto.

### 1. Preparar o ambiente

Instale o **Node.js compatível com as dependências do projeto** e o **Git**.

### 2. Baixar o repositório

```bash
git clone https://github.com/Cidgarcia/simulador-dinamica-rotacional.git
```

### 3. Entrar na pasta

```bash
cd simulador-dinamica-rotacional
```

### 4. Instalar as dependências

```bash
npm ci
```

### 5. Iniciar o projeto

```bash
npm run dev
```

Abra o endereço exibido no terminal, normalmente:

**http://localhost:5173**

### Outros comandos

| Comando | Função |
|---|---|
| `npm test` | Executa os testes do modelo físico e da exportação CSV. |
| `npm run build` | Gera a versão de produção na pasta `dist/`. |
| `npm run preview` | Abre uma prévia local da versão de produção após o build. |

## 🌐 Publicação

O projeto pode ser hospedado como site estático.

### Vercel

Ao importar o repositório, utilize:

| Configuração | Valor |
|---|---|
| Framework | Vite |
| Diretório raiz | `./` |
| Comando de build | `npm run build` |
| Diretório de saída | `dist` |
| Variáveis de ambiente | Nenhuma necessária |

### GitHub Pages

O repositório também inclui um workflow de publicação manual:

1. Acesse **Settings → Pages**.
2. Selecione **GitHub Actions** como origem.
3. Abra **Actions → Publicar no GitHub Pages**.
4. Clique em **Run workflow** e selecione `main`.
5. Aguarde a conclusão e abra o endereço indicado no deployment.

Esse workflow não é executado automaticamente por push.

## 🛠️ Tecnologias

- **JavaScript:** lógica e cálculos.
- **Three.js:** visualização 3D.
- **Canvas 2D:** gráficos.
- **Vite:** desenvolvimento e build.
- **Vitest:** testes automatizados.
- **HTML e CSS:** estrutura e interface responsiva.

## 📁 Organização do projeto

| Arquivo ou pasta | Responsabilidade |
|---|---|
| `index.html` | Estrutura da página. |
| `src/physics.js` | Modelo físico independente da interface. |
| `src/scene.js` | Cena 3D e câmera. |
| `src/charts.js` | Gráficos de α(t), ω(t) e θ(t). |
| `src/export.js` | Geração e download do CSV. |
| `src/format.js` | Formatação numérica e leitura de valores. |
| `src/main.js` | Controles, estado e animação. |
| `src/style.css` | Aparência e responsividade. |
| `tests/` | Testes automatizados. |
| `VALIDACAO.md` | Metodologia e registros de validação. |

## ⚠️ Limitações

- O modelo não inclui atrito, resistência do ar ou deformações.
- Não contempla deslocamento do eixo pelo teorema de Steiner.
- A visualização 3D exige WebGL; sem ele, permanece disponível a parte numérica e gráfica.
- Giros rápidos podem parecer lentos, parados ou invertidos por amostragem dos quadros. Reduza a velocidade de reprodução para facilitar a observação.

Os testes automatizados verificam os cálculos e a geração do CSV. A verificação visual e dos controles deve ser registrada separadamente, conforme o ambiente efetivamente testado.

## 🎓 Equipe

**Universidade Federal do Vale do São Francisco — UNIVASF**  
Engenharia de Computação · Física Experimental A · Turma 3C

**Docente:** Mariele Regina Pinheiro Gonçalves

**Integrantes:**

- Isaac Emanuel de Sá Nascimento
- Kayk Souza Calixto
- Felipe de Oliveira Leite
- Cid Augusto Garcia de Souza Junior
