# 🔄 Laboratório Virtual de Rotação

**Simulador interativo de dinâmica de rotação, momento de inércia e Teorema dos Eixos Paralelos (Steiner)**

Produto educacional desenvolvido para a disciplina **Física Experimental A**, do curso de **Engenharia de Computação da UNIVASF**.

Explore como a **massa**, a **forma do corpo**, o **tamanho**, a **distância do eixo de rotação ao centro de massa ($d$)** e a **força aplicada** influenciam o movimento de rotação.

[🌐 Acessar o simulador](COLE_AQUI_O_LINK_DA_VERCEL) · [📋 Consultar a validação](./VALIDACAO.md)

## ✨ O que você pode fazer

- Observar **disco, anel, esfera e barra** em uma cena 3D interativa com acoplamento mecânico realista para eixos deslocados ($d > 0$).
- Alterar massa, raio ou comprimento, distância $d$ entre o eixo de rotação e o centro de massa (Teorema de Steiner), força e sentido de rotação.
- Acompanhar momento de inércia no centro de massa ($I_{\text{cm}}$), termo de Steiner ($Md^2$), inércia total ($I = I_{\text{cm}} + Md^2$), braço de alavanca ($b = b_{\text{cm}} + d$), torque ($\tau$), grandezas angulares ($\alpha, \omega, \theta$), **Energia Cinética Rotacional ($K_{\text{rot}}$)**, **Trabalho do Torque ($W$)** e **Potência Instantânea ($P$)** com resolução instrumental padronizada (ABNT/Metrologia).
- Ativar o modo **"Simular incerteza experimental (ruído de sensor)"** com ruído gaussiano via **Transformada de Box-Muller** ($\sigma_{\text{rel}} \in \{1\%, 2\%, 5\%\}$) e incerteza instrumental de tempo ($\pm 0{,}01\text{ s}$).
- Visualizar gráficos de **aceleração, velocidade e posição angular** com dispersão experimental sobreposta à curva teórica tracejada.
- Comparar **disco e anel** simultaneamente e **eixo central ($d = 0$) × eixo deslocado ($d > 0$)** sob o **mesmo torque**, incluindo a evolução comparativa de $K_{\text{rot}}$ e $W$.
- Coletar dados amostrados ($\Delta t = 0{,}20\text{ s}$ ou $0{,}50\text{ s}$) em tabela interativa e exportar em **CSV** (em modo completo ou **Modo Cego para Relatório**, contendo apenas leituras brutas de sensor para linearização em SciDAVis, Origin, Python ou Excel).

A aplicação executa os cálculos no próprio navegador. **Não exige cadastro nem banco de dados.** Os dados da execução são temporários; para guardá-los, exporte o CSV antes de recarregar a página.

## 🚀 Como usar o simulador

**Para usar a versão publicada, basta abrir o link do site. Não é necessário instalar nada.**

1. **Escolha o corpo:** disco, anel, esfera ou barra.
2. **Ajuste os valores:** massa, tamanho, distância $d$ do eixo ao centro de massa (`d = 0` por padrão), força e sentido.
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

### Comparar eixo central e eixo deslocado (Teorema de Steiner)

Abra a seção **Eixo central ($d = 0$) × eixo deslocado ($d > 0$) sob o mesmo torque**. Os dois sistemas utilizam a mesma geometria, massa, dimensão e o mesmo torque líquido $\tau$, permitindo isolar o efeito do aumento quadrático do momento de inércia ($I = I_{\text{cm}} + Md^2$) sobre a aceleração angular ($\alpha = \tau / I$).

### Salvar os dados

Clique em **Exportar dados em CSV**.

O arquivo reúne os parâmetros do experimento (incluindo $d$, $I_{\text{cm}}$, $Md^2$ e $I$), as unidades e os valores calculados. Ele pode ser aberto em programas de planilha para análise.

> **Durante o uso:** alterar um parâmetro físico reinicia o experimento em zero. Cada execução dura até 20 segundos simulados. A reprodução em 0,25× ou 0,5× facilita observar o movimento.

## 🧪 Experimentos guiados

| Experimento | O que comparar | Resultado previsto |
|---|---|---|
| 01 · Disco × anel | Mesma massa, raio, $d = 0$ e força | O disco tem o dobro da aceleração angular do anel. |
| 02 · Dobrar a massa | Mesmo corpo, tamanho, $d = 0$ e força | A aceleração angular cai pela metade. |
| 03 · Dobrar a força | Mesmo corpo, massa, tamanho e $d = 0$ | A aceleração angular dobra. |
| 04 · Steiner sob mesmo torque | Mesmo corpo ($M = 2\text{ kg}, R = 0{,}5\text{ m}$) com $d = 0$ vs. $d = 0{,}5\text{ m}$ sob $\tau = 0{,}5\text{ N}\cdot\text{m}$ | $I$ sobe de $0{,}25$ para $0{,}75\text{ kg}\cdot\text{m}^2$ e $\alpha$ cai de $2$ para $\approx 0{,}667\text{ rad/s}^2$. |
| 05 · Steiner na bancada 3D | Disco ($M = 2\text{ kg}, R = 0{,}5\text{ m}, F = 1\text{ N}$) com $d = 0{,}5\text{ m}$ | Eixo deslocado visível em 3D, $I = 0{,}75\text{ kg}\cdot\text{m}^2$, braço $b = R + d = 1{,}0\text{ m}$ e $\tau = 1{,}0\text{ N}\cdot\text{m}$. |

Faça uma previsão antes de executar e depois confira os valores e as curvas.

## 📐 Física utilizada

O modelo considera:

- Corpos rígidos e homogêneos.
- Eixo de rotação fixo e sem atrito, paralelo ao eixo central que passa pelo centro de massa (CM), situado a uma distância $d \ge 0$ do CM.
- Teorema dos Eixos Paralelos (Steiner): $I = I_{\text{cm}} + Md^2$.
- Ponto de aplicação da força na borda/extremidade oposta ao deslocamento do eixo, a uma distância $b = |\vec{r}| = b_{\text{cm}} + d$ do eixo de rotação; força $\vec{F}$ sempre perpendicular ao vetor posição $\vec{r}$ relativo ao eixo ($\phi = 90^\circ$), acompanhando a trajetória circular do ponto.
- Partida do repouso: posição e velocidade angular iniciais iguais a zero.

O sentido positivo é o **anti-horário visto de cima** (lado positivo do eixo de rotação).

### Momento de inércia e braço da força

| Corpo | Direção do eixo paralelo | Inércia no CM ($I_{\text{cm}}$) | Inércia total ($I = I_{\text{cm}} + Md^2$) | Braço em relação ao eixo ($b = b_{\text{cm}} + d$) |
|---|---|---|---|---|
| Disco / cilindro maciço | Perpendicular ao plano | `MR²/2` | `MR²/2 + Md²` | `R + d` |
| Anel fino | Perpendicular ao plano | `MR²` | `MR² + Md²` | `R + d` |
| Esfera maciça | Paralelo a um diâmetro | `2MR²/5` | `2MR²/5 + Md²` | `R + d` |
| Barra fina | Perpendicular à barra | `ML²/12` | `ML²/12 + Md²` | `L/2 + d` |

**Símbolos:** `M` = massa; `R` = raio; `L` = comprimento; `d` = distância entre o eixo de rotação e o CM; `b` = braço da força em relação ao eixo de rotação.

### Equações do movimento e conservação de energia

| Grandeza | Equação | Unidade |
|---|---|---|
| Momento de inércia | `I = Icm + Md²` | kg·m² |
| Torque no eixo | `τ = (r × F)_eixo = ±(b_cm + d)F` | N·m |
| Aceleração angular | `α = τ/I` | rad/s² |
| Velocidade angular | `ω = αt` | rad/s |
| Posição angular | `θ = αt²/2` | rad |
| Energia cinética rotacional | `K_rot = ½ I ω²` | J |
| Trabalho do torque | `W = τ Δθ = ΔK_rot` | J |
| Potência instantânea | `P = dW/dt = τ ω` | W |

### Equivalência Mecânica do Atuador Tangencial

A expressão vetorial do torque em relação ao eixo de rotação é $\vec{\tau} = \vec{r} \times \vec{F}$, com módulo $|\tau| = rF\operatorname{sen}(\phi)$. No simulador, a força tangencial contínua de módulo constante $\vec{F} \perp \vec{r}$ mantém $\phi = 90^\circ$ ao longo de múltiplas revoluções com braço efetivo $b = b_{\text{cm}} + d$. Fisicamente, esse vínculo representa um **atuador tangencial ideal solidário à borda** — ou o equivalente dinâmico exato de um sistema de **fio inextensível tracionado em tambor cilíndrico concêntrico de raio efetivo $b = b_{\text{cm}} + d$ acoplado rigidamente ao sistema sem massa adicional**.

Quando o eixo é deslocado ($d > 0$, inclusive para $d > R$ onde o eixo de rotação situa-se fora do corpo), uma haste rígida de massa desprezível conecta estruturalmente o eixo fixo $(0,0,0)$ ao centro de massa $(0,0,d)$ e ao ponto de aplicação da força $(0,0,b)$.

Sob o mesmo torque líquido $\tau$ aplicado durante um mesmo intervalo de tempo $t$, um corpo de **menor momento de inércia $I$** adquire maior aceleração angular ($\alpha = \tau/I$), percorre um deslocamento angular maior ($\theta = \frac{\tau t^2}{2I}$) e, consequentemente, recebe **maior trabalho ($W = \tau \theta$)** e acumula **maior energia cinética rotacional ($K_{\text{rot}} = \frac{\tau^2 t^2}{2I}$)** — propriedade demonstrada em tempo real nos Experimentos Comparativos 1 e 2.

---

## 📊 Modelagem de Incerteza Estocástica e Exportação de Dados

### 1. Ruído Gaussiano via Transformada de Box-Muller

Para reproduzir a flutuação estatística real de sensores ópticos (*photogates*) e encoders rotativos sem introduzir tremores visuais na malha 3D, a arquitetura separa estritamente o **estado físico determinístico** ($\theta_{\text{real}}, \omega_{\text{real}}, \alpha_{\text{real}}$) da **leitura experimental amostrada** ($\theta_{\text{med}}, \omega_{\text{med}}, \alpha_{\text{med}}$).

A cada instante amostrado, variáveis normais padrão independentes $Z \sim \mathcal{N}(0, 1)$ são geradas pela **Transformada de Box-Muller**:

$$Z = \sqrt{-2 \ln(u_1)} \cos(2\pi u_2), \quad u_1, u_2 \sim \mathcal{U}(0, 1)$$

As leituras experimentais e a energia cinética medida são calculadas com propagação coerente de incertezas ($\sigma_{\text{rel}} \in \{1\%, 2\%, 5\%\}$ e incerteza instrumental de tempo $\sigma_t = \pm 0{,}01\text{ s}$):

- $\omega_{\text{med}}(t) = \omega_{\text{real}}(t) + Z_\omega \cdot \sigma_\omega$, onde $\sigma_\omega = \sigma_{\text{rel}} \cdot \max(|\omega_{\text{real}}(t)|, 0{,}05)$
- $\theta_{\text{med}}(t) = \theta_{\text{real}}(t) + Z_\theta \cdot \sigma_\theta$, onde $\sigma_\theta = \sigma_{\text{rel}} \cdot \max(|\theta_{\text{real}}(t)|, 0{,}05)$
- $\alpha_{\text{med}}(t) = \alpha_{\text{real}} \cdot (1 + Z_\alpha \cdot \sigma_{\text{rel}})$, onde $\sigma_\alpha = |\alpha_{\text{real}}| \cdot \sigma_{\text{rel}}$
- $K_{\text{rot,med}}(t) = \frac{1}{2} I \omega_{\text{med}}^2(t)$, com incerteza propagada $\sigma_K = I |\omega_{\text{real}}| \sigma_\omega$

### 2. Formato de Exportação CSV e Modo Cego para Relatório

O buffer de amostragem discreta registra pares ordenados a cada $\Delta t = 0{,}20\text{ s}$ ou $0{,}50\text{ s}$ simulados. O arquivo `.csv` (`dados_rotacao_<corpo>_<timestamp>.csv`) inclui cabeçalho comentado com `#` (compatível com `numpy.loadtxt`, `pandas.read_csv(comment='#', sep=';')`, **SciDAVis** e **Origin**) seguido pelas colunas separadas por `;`:

- **Modo Completo (padrão):**
  `t_s;theta_teorico_rad;theta_medido_rad;omega_teorico_rads;omega_medido_rads;alfa_medido_rads2;energia_cinetica_J;trabalho_J`
- **Modo Cego para Relatório (`Ocultar valores teóricos na tabela/CSV`):**
  Exporta apenas as grandezas lidas pelo sensor (`t_s;theta_medido_rad;omega_medido_rads;alfa_medido_rads2;energia_cinetica_medida_J`), permitindo que o estudante realize de forma autônoma a regressão linear de $\omega \times t$ e a linearização da parábola $\theta \times t^2$.

### Limites dos controles

| Parâmetro | Intervalo |
|---|---|
| Massa $M$ | 0,1 a 10 kg |
| Raio $R$ | 0,05 a 0,5 m |
| Comprimento da barra $L$ | 0,1 a 1,5 m |
| Distância do eixo ao CM $d$ | 0 a 1 m (padrão: 0 m) |
| Força $F$ | 0 a 5 N |
| Torque na comparação de Steiner $|\tau|$ | 0 a 10 N·m |

Massa e dimensões precisam ser positivas. Distância $d = 0$ e força/torque zero são permitidos.

## ✅ Casos de referência

### 1. Disco × anel no eixo central ($d = 0$)

**Massa = 2 kg · Raio = 0,5 m · Distância $d$ = 0 m · Força = 1 N**

| Resultado | Disco | Anel |
|---|---:|---:|
| Momento de inércia ($I = I_{\text{cm}}$) | 0,25 kg·m² | 0,50 kg·m² |
| Torque ($\tau = RF$) | 0,50 N·m | 0,50 N·m |
| Aceleração angular ($\alpha$) | 2 rad/s² | 1 rad/s² |
| Velocidade em 2 s ($\omega$) | 4 rad/s | 2 rad/s |
| Posição angular em 2 s ($\theta$) | 4 rad | 2 rad |

### 2. Teorema de Steiner sob torque fixo ($\tau = 0{,}5\text{ N}\cdot\text{m}$)

**Disco · Massa = 2 kg · Raio = 0,5 m · Torque fixo = 0,5 N·m**

| Resultado | Eixo central ($d = 0\text{ m}$) | Eixo deslocado ($d = 0{,}5\text{ m}$) |
|---|---:|---:|
| Momento de inércia no CM ($I_{\text{cm}}$) | 0,25 kg·m² | 0,25 kg·m² |
| Termo adicional de Steiner ($Md^2$) | 0 kg·m² | 0,50 kg·m² |
| Momento de inércia total ($I$) | 0,25 kg·m² | 0,75 kg·m² |
| Torque ($\tau$) | 0,50 N·m | 0,50 N·m |
| Aceleração angular ($\alpha = \tau/I$) | 2 rad/s² | ≈ 0,6667 rad/s² |

Na bancada 3D acionada por força constante $F = 1\text{ N}$ aplicada na borda oposta ($b = R + d$), o deslocamento $d = 0{,}5\text{ m}$ resulta em $I = 0{,}75\text{ kg}\cdot\text{m}^2$, braço $b = 1{,}0\text{ m}$, torque $\tau = 1{,}0\text{ N}\cdot\text{m}$ e $\alpha = 4/3 \approx 1{,}333\text{ rad/s}^2$.

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
- **Canvas 2D:** gráficos e animações comparativas.
- **Vite:** desenvolvimento e build.
- **Vitest:** testes automatizados.
- **HTML e CSS:** estrutura e interface responsiva.

## 📁 Organização do projeto

| Arquivo ou pasta | Responsabilidade |
|---|---|
| `index.html` | Estrutura da página. |
| `src/physics.js` | Modelo físico independente da interface (incluindo Teorema de Steiner). |
| `src/scene.js` | Cena 3D, representação do eixo deslocado e câmera. |
| `src/charts.js` | Gráficos de $\alpha(t)$, $\omega(t)$, $\theta(t)$ e curva quadrática $I(d)$. |
| `src/export.js` | Geração e download do CSV. |
| `src/format.js` | Formatação numérica e leitura de valores. |
| `src/main.js` | Controles, estado e animações. |
| `src/style.css` | Aparência e responsividade. |
| `tests/` | Testes automatizados. |
| `VALIDACAO.md` | Metodologia e registros de validação. |

## ⚠️ Limitações

- O modelo não inclui atrito nos mancais, resistência do ar, rolamento com contato ou deformações elásticas.
- O deslocamento do eixo considera apenas eixos paralelos ao eixo central original ($I = I_{\text{cm}} + Md^2$), sem inclinação do eixo ou precessão giroscópica; a haste rígida de acoplamento tem massa desprezível.
- A força e o torque são constantes em cada execução, com partida sempre do repouso ($\theta_0 = 0$, $\omega_0 = 0$) e janela máxima de 20 s simulados.
- A visualização 3D exige WebGL; sem ele, permanecem disponíveis os cálculos numéricos, os gráficos e as comparações 2D.
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
