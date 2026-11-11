# Relatório de Auditoria, Metodologia e Validação

## 1. Escopo do Modelo Físico

O laboratório simula corpos rígidos homogêneos (disco maciço, anel fino, esfera maciça e barra fina) girando em torno de um eixo fixo sem atrito — posicionado no centro de massa ($d = 0$) ou deslocado paralelamente a uma distância $d \ge 0$ pelo **Teorema de Steiner ($I = I_{\text{cm}} + Md^2$)**.

Na bancada 3D, uma força tangencial constante $F$ é aplicada na borda oposta ao deslocamento do eixo, resultando em um braço de alavanca $b = b_{\text{cm}} + d$ e torque $\tau = \pm b \cdot F$. Nos experimentos comparativos, o simulador também permite comparar dois corpos sob o mesmo torque líquido. As condições iniciais são sempre o repouso ($\theta_0 = 0, \omega_0 = 0$).

---

## 2. Problemas Identificados na Auditoria e Correções Aplicadas

### Problema 1 — Deriva de tempo nas amostras da tabela e do CSV (`requestAnimationFrame`)
- **Causa raiz:** Anteriormente, `pushSample()` em `src/main.js` gravava amostras quando `s.t - lastDisc.t_s >= ui.sampleDt` dentro do loop de quadros do navegador (~16,7 ms). Isso gerava acúmulo de atraso a cada amostra (`0.208 s, 0.416 s, ..., 2.08 s`), fazendo com que o instante exato $t = 2{,}00\text{ s}$ não existisse no CSV ou apresentasse valores calculados em $t > 2\text{ s}$ (ex.: $\theta = 4{,}02\text{ rad}$ enquanto a tabela exibia `2,00` arredondado).
- **Correção:** Criada a função `generateDiscreteSamples()` em `src/export.js` e `syncSamplesToTime()` em `src/main.js`, que avaliam o estado analítico e as leituras com ruído exatamente na grade temporal $t_k = k \cdot \Delta t$ ($0{,}00; 0{,}20; 0{,}40; \dots; 2{,}00\text{ s}$), garantindo precisão matemática absoluta independente do FPS.

### Problema 2 — Incompatibilidade do CSV com Excel e LibreOffice Calc em Português (Brasil)
- **Causa raiz:** O exportador usava ponto e vírgula (`;`) como separador de colunas, mas ponto (`.`) como separador decimal. No Excel e no Calc configurados em `pt-BR`, números como `1.03` ou `0.250` eram interpretados incorretamente como datas (`01/mar`) ou inteiros (`250`).
- **Correção:** Adicionado suporte a `decimalSeparator: ','` em `formatCsvCell()` e `buildExperimentCsv()`. A interface agora oferece dois botões claros: **Exportar CSV (Excel / Calc BR)** (com `;` e vírgula decimal `,`) e **CSV Padrão Científico (ponto)** (com `;` e ponto decimal `.`, ideal para Python/SciDAVis/Origin).

### Problema 3 — Parâmetros iniciais incoerentes com o Experimento Guiado 02 ("Dobrar a massa")
- **Causa raiz:** Os padrões iniciais (`DEFAULTS` em `src/main.js`) usavam $M = 2\text{ kg}, R = 0{,}3\text{ m}, F = 0{,}3\text{ N}$ ($\alpha = 1\text{ rad/s}^2$). Ao clicar no Experimento Guiado 02 ("Dobrar a massa", que aplica $M = 4\text{ kg}, R = 0{,}5\text{ m}, F = 1\text{ N} \implies \alpha = 1\text{ rad/s}^2$), a aceleração permanecia em $1\text{ rad/s}^2$ antes e depois do clique.
- **Correção:** Padronizado `DEFAULTS` para o caso de referência ($M = 2\text{ kg}, R = 0{,}5\text{ m}, F = 1\text{ N} \implies \alpha = 2\text{ rad/s}^2$) e adicionado o botão **"Restaurar caso base ($M = 2\text{ kg}$)"** no cartão do Experimento 02.

### Problema 4 — Dados desatualizados ao alternar ruído ou passo $\Delta t$ e ausência de CSV nos comparativos
- **Causa raiz:** Alterar a chave de incerteza experimental, o nível de ruído ou o intervalo de coleta ($\Delta t = 0{,}20\text{ s}$ / $0{,}50\text{ s}$) com a simulação pausada/concluída não atualizava a tabela nem o CSV. Além disso, os dois experimentos comparativos não possuíam exportação CSV, e a coluna `energia_cinetica_J` no modo completo misturava valor medido com ruído e trabalho teórico `trabalho_J`.
- **Correção:**
  - `rebuildSamplesAndChart()` reconstrói imediatamente a tabela, os gráficos e o buffer CSV ao alterar configurações de amostragem/ruído.
  - No modo completo, `energia_cinetica_J` e `trabalho_J` preservam os valores teóricos exatos ($K_{\text{rot}} = W$), enquanto o modo cego exporta `energia_cinetica_medida_J`.
  - Implementadas `buildComparisonCsv()` e `buildSteinerComparisonCsv()` com botões de exportação nos dois comparativos.
  - Adicionado seletor **"Parar automaticamente em"** (`2 s`, `5 s`, `10 s`, `20 s`) para permitir parar exatamente em $t = 2{,}00\text{ s}$.

---

## 3. Verificação dos Testes Obrigatórios em $t = 2\text{ s}$ (Sem Incertezas)

Todos os cenários abaixo foram verificados nos cálculos (`src/physics.js`), na interface (`src/main.js`), nos gráficos (`src/charts.js`) e nas planilhas exportadas (`src/export.js`):

| Cenário de Teste | $M$ (kg) | $R$ (m) | $d$ (m) | $F$ (N) | $I$ ($\text{kg}\cdot\text{m}^2$) | $\tau$ ($\text{N}\cdot\text{m}$) | $\alpha$ ($\text{rad/s}^2$) | $\omega(2\text{ s})$ (rad/s) | $\theta(2\text{ s})$ (rad) | $K_{\text{rot}}(2\text{ s})$ (J) | $W(2\text{ s})$ (J) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **1. Disco maciço (obrigatório)** | 2,0 | 0,50 | 0,00 | 1,00 | **0,25** | **0,50** | **2,00** | **4,00** | **4,00** | **2,00** | **2,00** |
| **2. Anel fino** | 2,0 | 0,50 | 0,00 | 1,00 | **0,50** | **0,50** | **1,00** | **2,00** | **2,00** | **1,00** | **1,00** |
| **3. Dobrar a massa (disco)** | 4,0 | 0,50 | 0,00 | 1,00 | **0,50** | **0,50** | **1,00** | **2,00** | **2,00** | **1,00** | **1,00** |
| **4. Dobrar a força (disco)** | 2,0 | 0,50 | 0,00 | 2,00 | **0,25** | **1,00** | **4,00** | **8,00** | **8,00** | **8,00** | **8,00** |
| **5. Steiner sob mesmo torque** | 2,0 | 0,50 | 0,50 | 0,50 | **0,75** | **0,50** | **0,6667** | **1,3333** | **1,3333** | **0,6667** | **0,6667** |
| **6. Steiner na bancada 3D** | 2,0 | 0,50 | 0,50 | 1,00 | **0,75** | **1,00** | **1,3333** | **2,6667** | **2,6667** | **2,6667** | **2,6667** |
| **7. Sentido horário (disco)** | 2,0 | 0,50 | 0,00 | 1,00 | **0,25** | **−0,50** | **−2,00** | **−4,00** | **−4,00** | **2,00** | **2,00** |

---

## 4. Validação Automatizada Executada

Foram executados e aprovados nesta auditoria:

1. `npm test` — **43 testes automatizados aprovados** em 2 suítes (`tests/physics.test.js` e `tests/export.test.js`), cobrindo:
   - Fórmulas de momento de inércia ($I_{\text{cm}}$, $Md^2$, $I = I_{\text{cm}} + Md^2$) e braço ($b = b_{\text{cm}} + d$) para as 4 geometrias;
   - Teste obrigatório completo do disco em $t = 2\text{ s}$ ($I = 0{,}25$, $\tau = 0{,}5$, $\alpha = 2$, $\omega = 4$, $\theta = 4$, $K_{\text{rot}} = 2\text{ J}$, $W = 2\text{ J}$);
   - Anel fino, duplicação da massa ($K_{\text{rot}} = W = 1\text{ J}$), duplicação da força ($K_{\text{rot}} = W = 8\text{ J}$) e Teorema de Steiner sob mesmo torque e na bancada 3D;
   - Amostragem discreta analítica exata (`generateDiscreteSamples`) sem deriva de quadros;
   - Ordenação cronológica, remoção de duplicatas, preservação de sinais no sentido horário e exportação CSV nos formatos Excel/Calc BR (vírgula decimal) e Científico (ponto decimal), além dos CSVs comparativos.
2. `npm run build` — Build de produção com Vite concluído sem erros.

## Auditoria técnica independente e correções (10–11/11/2026)

Uma auditoria independente (script Node que importa o código real e o confronta com integração numérica) confirmou as fórmulas de I e b, W = K e os 5 ensaios de referência (erro ≤ 2,3×10⁻¹³ %), e apontou melhorias, todas aplicadas:

| Achado | Correção |
|---|---|
| CSV com 6 casas fixas: 7/400 células > 10⁻⁴ % em t ≤ 0,4 s | 	oPrecision(10); agora 0/400 células acima de 10⁻⁴ % (pior caso 3×10⁻⁸ %) |
| Nomes de colunas diferentes dos citados no pedido | Renomeadas: 	heta_teor_rad, 	heta_med_rad, omega_teor_rads, omega_med_rads, lfa_med_rads2, K_rot_J, W_J (modo cego: K_rot_med_J); tabela no README |
| Texto "±2 %" sugeria limite máximo | Interface e README: σ = desvio-padrão (1σ), modelo multiplicativo |
| ±0,01 s declarado mas não aplicado (inclusive com ruído desligado) | Cabeçalho:   (ruido desligado) ou "declarada; t_s nominal"; interface idem |
| Ruído em t = 0 (piso 0,05) | σ_θ = σ_ω = 0 em t = 0 |
| Math.random() sem semente | Campo "Semente do ruído"; mesmo ensaio → mesmo CSV; semente gravada no cabeçalho |
| ormatWithUncertainty com 2 casas fixas | ormatWithSigma: σ com 2 algarismos significativos, valor com as mesmas casas |
| #Modo sem espaço; nome do arquivo em UTC; <a> fora do DOM | # Modo; localTimestamp() (hora local); link anexado ao DOM e URL revogada após 1 s |
| README sem aviso sobre # no Excel/pandas | Seção "Abrindo o CSV" no README |

Novos testes (14): precisão do CSV, cabeçalho de incerteza/semente, reprodutibilidade por semente, ausência de ruído em t = 0, estatística de Box-Muller com 10⁶ amostras (média, σ, assimetria, curtose, regra 68-95-99,7), ormatWithSigma, downloadCsv (ordem DOM/click/revoke) e localTimestamp.

**Limite declarado:** o app não foi exercitado em navegador real (cliques, download efetivo, abertura no Excel/Calc); a validação é por testes de unidade e build.
