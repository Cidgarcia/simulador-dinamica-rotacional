# 🔄 Laboratório Virtual de Rotação e Momento de Inércia

**Simulador interativo de dinâmica de rotação, momento de inércia e Teorema de Steiner**

Produto educacional desenvolvido para a disciplina **Física Experimental A**, do curso de **Engenharia de Computação da UNIVASF**.

Explore de forma visual e intuitiva como a **massa**, o **formato do corpo**, o **tamanho**, a **posição do eixo de rotação ($d$)** e a **força aplicada** mudam o giro de um objeto.

[🌐 Acessar o simulador](COLE_AQUI_O_LINK_DA_VERCEL) · [📋 Consultar a validação e auditoria](./VALIDACAO.md)

---

## 💡 Conceitos Fundamentais em Linguagem Simples

- **Torque ($\tau$):** força que provoca ou modifica a rotação de um objeto ($\tau = b \cdot F$, em $\text{N}\cdot\text{m}$). *Exemplo:* empurrar uma porta perto da maçaneta gira a porta com facilidade; empurrar perto da dobradiça quase não a move.
- **Momento de inércia ($I$):** resistência do objeto a mudanças na sua velocidade de rotação (em $\text{kg}\cdot\text{m}^2$). Depende da massa e de quão longe essa massa está do eixo.
- **Aceleração angular ($\alpha$):** indica quanto a velocidade de rotação muda a cada segundo ($\alpha = \tau / I$, em $\text{rad/s}^2$).
- **Velocidade angular ($\omega$):** indica a rapidez e o sentido da rotação ($\omega = \alpha t$, em $\text{rad/s}$). Positivo ($+$) = anti-horário; negativo ($-$) = horário.
- **Posição angular ($\theta$):** indica quanto o objeto girou em relação à posição inicial ($\theta = \frac{1}{2}\alpha t^2$, em $\text{rad}$). Uma volta completa equivale a $2\pi \approx 6{,}28\text{ rad}$.
- **Centro de massa (CM):** ponto que representa o equilíbrio da massa do objeto. Nos corpos simétricos e homogêneos do simulador, fica no centro geométrico.
- **Teorema de Steiner ($I = I_{\text{cm}} + Md^2$):** explica como o momento de inércia aumenta quando deslocamos o eixo de rotação a uma distância $d$ do centro de massa.

### Diferença entre $R$, $d$ e $b$

1. **Raio ($R$) ou metade da barra ($L/2$):** tamanho físico do objeto medido a partir do seu centro de massa ($b_{\text{cm}}$).
2. **Distância do eixo ao centro de massa ($d$):** quanto o pino de rotação foi afastado do centro do objeto.
3. **Braço de alavanca ($b$):** distância perpendicular entre o eixo de rotação e a linha de ação da força. Na bancada 3D, a força atua na borda oposta ao deslocamento do eixo, logo $b = b_{\text{cm}} + d$.

---

## ✨ O que você pode fazer no laboratório

- Observar **disco maciço, anel fino, esfera maciça e barra fina** em uma bancada 3D interativa.
- Ajustar **massa ($M$)**, **raio ($R$) ou comprimento ($L$)**, **distância do eixo ($d$)**, **força tangencial ($F$)** e **sentido do giro**.
- Escolher o **tempo alvo de parada automática** (`2 s`, `5 s`, `10 s` ou `20 s`) para medir valores exatos em instantes específicos (como $t = 2{,}00\text{ s}$).
- Acompanhar em tempo real: $I_{\text{cm}}$, $Md^2$, $I$, braço $b$, torque $\tau$, $\alpha$, $\omega$, $\theta$, **Energia Cinética Rotacional ($K_{\text{rot}}$)**, **Trabalho do Torque ($W$)** e **Potência Instantânea ($P$)**.
- Ativar a **incerteza experimental (ruído de sensor)** ($\sigma_{\text{rel}} = 1\%$, $2\%$ ou $5\%$, desvio-padrão) para comparar valores teóricos ideais com leituras simuladas de laboratório.
- Analisar os **gráficos sincronizados** de $\alpha(t)$ (reta horizontal), $\omega(t)$ (reta inclinada) e $\theta(t)$ (parábola), além da curva quadrática $I(d)$ do Teorema de Steiner.
- Executar **dois experimentos comparativos lado a lado**:
  1. **Disco maciço × Anel fino** (mesma massa, raio, força e torque).
  2. **Eixo central ($d = 0$) × Eixo deslocado ($d > 0$)** sob o **mesmo torque**.
- **Exportar dados em CSV** na bancada principal e também nos dois comparativos, escolhendo entre:
  - **Excel / Calc BR (`;` e vírgula decimal `,`)**: abre direto no Excel e LibreOffice Calc em português sem desconfigurar números ou datas.
  - **Padrão Científico (`;` e ponto decimal `.`)**: ideal para Python (`pandas`/`numpy`), R, SciDAVis e Origin.

---

## 🧪 Roteiros de Experimentos Guiados

| # | Experimento | Objetivo | Conclusão pronta para apresentação |
|---|---|---|---|
| **01** | **Disco maciço vs. anel fino** | Descobrir como o formato do objeto altera a aceleração quando massa, raio e força são iguais. | *"Para mesma massa, mesmo raio e mesmo torque, o anel tem o dobro do momento de inércia do disco e, por isso, apresenta metade da aceleração angular."* |
| **02** | **Dobrar a massa** | Ver o que acontece com o giro e com a energia quando dobramos a massa mantendo o raio e a força constantes. | *"Quando dobramos a massa, mantendo o raio e o torque constantes, o momento de inércia dobra e a aceleração angular cai pela metade (e a energia acumulada no mesmo tempo também cai pela metade)."* |
| **03** | **Dobrar a força** | Descobrir como a força aplicada afeta o torque, a aceleração e a energia mantendo o corpo inalterado. | *"Quando dobramos a força tangencial mantendo o corpo e o eixo fixos, o torque dobra, a aceleração angular dobra e a energia cinética acumulada no mesmo tempo quadruplica."* |
| **04** | **Steiner sob o mesmo torque** | Isolar o efeito do deslocamento do eixo ($d$) sobre a inércia aplicando exatamente o mesmo torque nos dois corpos. | *"Pelo Teorema de Steiner ($I = I_{\text{cm}} + Md^2$), deslocar o eixo até a borda do disco triplica seu momento de inércia e reduz sua aceleração angular para um terço quando o torque é mantido constante."* |
| **05** | **Steiner na bancada 3D** | Observar na bancada 3D como o deslocamento do eixo altera ao mesmo tempo a inércia ($I$) e o braço da força ($b = R + d$). | *"Na bancada 3D com força constante na borda oposta, deslocar o eixo aumenta tanto o braço da força quanto o momento de inércia; como a inércia cresce com $d^2$, o ganho de inércia domina e a aceleração angular diminui."* |

---

## 📐 Equações Físicas e Casos de Referência

### Momento de inércia e braço de alavanca

| Corpo | Inércia no CM ($I_{\text{cm}}$) | Inércia total ($I = I_{\text{cm}} + Md^2$) | Braço na bancada 3D ($b = b_{\text{cm}} + d$) |
|---|---|---|---|
| **Disco / cilindro maciço** | $\frac{1}{2}MR^2$ | $\frac{1}{2}MR^2 + Md^2$ | $R + d$ |
| **Anel fino** | $MR^2$ | $MR^2 + Md^2$ | $R + d$ |
| **Esfera maciça** | $\frac{2}{5}MR^2$ | $\frac{2}{5}MR^2 + Md^2$ | $R + d$ |
| **Barra fina** | $\frac{1}{12}ML^2$ | $\frac{1}{12}ML^2 + Md^2$ | $L/2 + d$ |

### Cinemática e conservação de energia (partida do repouso: $\theta_0 = 0, \omega_0 = 0$)

- **Torque:** $\tau = \pm b \cdot F$ ($\text{N}\cdot\text{m}$)
- **Aceleração angular:** $\alpha = \tau / I$ ($\text{rad/s}^2$)
- **Velocidade angular:** $\omega(t) = \alpha t$ ($\text{rad/s}$)
- **Posição angular:** $\theta(t) = \frac{1}{2}\alpha t^2$ ($\text{rad}$)
- **Energia cinética rotacional e Trabalho:** $K_{\text{rot}} = \frac{1}{2}I\omega^2 = W = \tau\theta$ ($\text{J}$)
- **Potência instantânea:** $P = \tau\omega$ ($\text{W}$)

### Tabela de verificação rápida em $t = 2\text{ s}$ (sem incertezas)

| Cenário | $M$ (kg) | $R$ (m) | $d$ (m) | $F$ (N) | $I$ ($\text{kg}\cdot\text{m}^2$) | $\tau$ ($\text{N}\cdot\text{m}$) | $\alpha$ ($\text{rad/s}^2$) | $\omega(2\text{ s})$ (rad/s) | $\theta(2\text{ s})$ (rad) | $K_{\text{rot}}(2\text{ s}) = W(2\text{ s})$ (J) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **1. Disco padrão** | 2,0 | 0,50 | 0,00 | 1,00 | 0,25 | 0,50 | 2,00 | 4,00 | 4,00 | **2,00** |
| **2. Anel fino** | 2,0 | 0,50 | 0,00 | 1,00 | 0,50 | 0,50 | 1,00 | 2,00 | 2,00 | **1,00** |
| **3. Disco (massa dobrada)** | 4,0 | 0,50 | 0,00 | 1,00 | 0,50 | 0,50 | 1,00 | 2,00 | 2,00 | **1,00** |
| **4. Disco (força dobrada)** | 2,0 | 0,50 | 0,00 | 2,00 | 0,25 | 1,00 | 4,00 | 8,00 | 8,00 | **8,00** |
| **5. Disco Steiner (mesmo $\tau$)** | 2,0 | 0,50 | 0,50 | 0,50 | 0,75 | 0,50 | 0,6667 | 1,3333 | 1,3333 | **0,6667** |
| **6. Disco Steiner (bancada 3D)** | 2,0 | 0,50 | 0,50 | 1,00 | 0,75 | 1,00 | 1,3333 | 2,6667 | 2,6667 | **2,6667** |

> **Atenção sobre conservação de energia:** Dobrar a massa (Cenário 3) **não** dobra a energia cinética em $t = 2\text{ s}$. Como o momento de inércia dobra e o torque permanece $0{,}50\text{ N}\cdot\text{m}$, o disco gira metade do ângulo ($\theta = 2\text{ rad}$ em vez de $4\text{ rad}$), de modo que o trabalho realizado pelo torque ($W = \tau\theta = K_{\text{rot}}$) cai pela metade ($1{,}00\text{ J}$).

---

## 📊 Incertezas Experimentais e Exportação de Planilhas (CSV)

### Valores teóricos vs. valores simulados com incerteza
- **Valores teóricos:** seguem exatamente as equações matemáticas ideais, sem ruído.
- **Valores com incerteza:** simulam flutuações aleatórias de sensores usando distribuição normal (Box-Muller). O nível escolhido ($1\%$, $2\%$ ou $5\%$) é o **desvio-padrão relativo** $\sigma_{\text{rel}}$ (1σ), **não** um limite máximo de erro: cerca de $4{,}5\%$ das leituras ficam além de $2\sigma$.
- **Modelo multiplicativo:** o erro é proporcional ao valor lido ($\omega_{\text{med}} = \omega + Z\,\sigma_{\text{rel}}\max(|\omega|, 0{,}05)$; idem para $\theta$; $\alpha_{\text{med}} = \alpha(1 + Z\,\sigma_{\text{rel}})$). Não é um modelo de temporização de *photogate*. Em $t = 0$ **não há ruído** ($\theta_0 = \omega_0 = 0$ são condições impostas).
- **Incerteza do cronômetro ($\pm 0{,}01$ s):** apenas **declarada** (tipo B). Os instantes $t$ da tabela e do CSV são nominais ($k\,\Delta t$) e não são perturbados.
- **Semente do ruído (opcional):** informe um inteiro ≥ 0 no campo *Semente do ruído* e o mesmo ensaio gerará sempre as mesmas leituras e o mesmo CSV (reprodutível). Vazio = aleatório.
- **Algarismos significativos:** na tela, a incerteza é arredondada a 2 algarismos significativos e o valor usa as mesmas casas decimais (critério GUM/ABNT).
- **Importante:** o ruído afeta **apenas as leituras do sensor simulado**. O movimento físico real do corpo 3D e as equações fundamentais não são distorcidos. Não existem limites fixos universais (como 5% ou 10%) para decidir se um erro experimental é aceitável: a avaliação depende da precisão do instrumento e do método de análise empregado.

### Precisão da amostragem e formatos de CSV
- As amostras da tabela e do CSV são calculadas nos **instantes exatos** múltiplos de $\Delta t$ ($0{,}00\text{ s}; 0{,}20\text{ s}; 0{,}40\text{ s}; \dots; 2{,}00\text{ s}$), sem atraso ou deriva da taxa de quadros do monitor.
- As linhas são ordenadas cronologicamente, sem duplicatas, preservando o sinal negativo quando o sentido é horário ($-$).
- Os números do CSV são gravados com **10 algarismos significativos** (erro de arredondamento < $5\times10^{-8}\%$).
- Você pode exportar em **Excel / Calc BR** (separador `;` e vírgula decimal `,`) ou **CSV Padrão Científico** (separador `;` e ponto decimal `.`), além do **Modo Cego para Relatório** (que oculta as colunas teóricas para atividades de regressão linear).
- Nomes dos arquivos usam a **hora local** (`AAAA-MM-DDTHH-MM-SS`).

#### Colunas do CSV da bancada principal
| Modo completo | Significado | Modo cego |
|---|---|---|
| `t_s` | tempo nominal (s) | `t_s` |
| `theta_teor_rad` / `theta_med_rad` | θ teórico / medido (rad) | `theta_med_rad` |
| `omega_teor_rads` / `omega_med_rads` | ω teórico / medido (rad/s) | `omega_med_rads` |
| `alfa_med_rads2` | α medido (rad/s²); o α teórico está no cabeçalho | `alfa_med_rads2` |
| `K_rot_J` | energia cinética rotacional teórica (J) | `K_rot_med_J` (medida) |
| `W_J` | trabalho do torque teórico (J) | — |

#### Abrindo o CSV
- As linhas iniciais começam com `#` (metadados: corpo, M, R/L, d, I, F, torque, ruído, semente...). **O Excel/Calc não trata `#` como comentário**: elas aparecem como linhas da planilha; apague-as antes de gerar gráficos, ou importe a partir da linha do cabeçalho `t_s`.
- Em Python/pandas: `pd.read_csv(arquivo, sep=';', comment='#', encoding='utf-8-sig', decimal=',')` (use `decimal='.'` para o CSV padrão científico).

---

## 💻 Executar no computador

```bash
git clone https://github.com/Cidgarcia/simulador-dinamica-rotacional.git
cd simulador-dinamica-rotacional
npm ci
npm run dev
```

| Comando | Função |
|---|---|
| `npm test` | Executa os 43 testes automatizados do modelo físico e da exportação CSV. |
| `npm run build` | Gera a versão de produção na pasta `dist/`. |
| `npm run preview` | Abre uma prévia local da versão de produção após o build. |

## 🎓 Equipe

**Universidade Federal do Vale do São Francisco — UNIVASF**  
Engenharia de Computação · Física Experimental A · Turma 3C

**Docente:** Mariele Regina Pinheiro Gonçalves

**Integrantes:**
- Isaac Emanuel de Sá Nascimento
- Kayk Souza Calixto
- Felipe de Oliveira Leite
- Cid Augusto Garcia de Souza Junior
