# Metodologia e validação

## Escopo

O laboratório implementa corpos rígidos homogêneos, eixo fixo sem atrito (central ou deslocado paralelamente de uma distância `d ≥ 0` do centro de massa pelo Teorema de Steiner, `I = Icm + Md²`) e força tangencial constante aplicada a uma distância `b = b_cm + d` do eixo de rotação (`τ = (r × F)_eixo = ±(b_cm + d)F`), além de comparação dedicada sob torque fixo. As condições iniciais são `θ₀ = 0` e `ω₀ = 0`. O tempo é calculado no modelo físico (`src/physics.js`), sem depender da taxa de quadros; a animação apenas representa o estado calculado.

## Casos de referência

### 1. Eixo central (`d = 0 m`)

Para `M = 2 kg`, `R = 0,5 m`, `d = 0 m` e `F = 1 N`:

| Corpo | I (kg·m²) | τ (N·m) | α (rad/s²) | ω em 2 s (rad/s) | θ em 2 s (rad) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Disco | 0,25 | 0,5 | 2 | 4 | 4 |
| Anel | 0,5 | 0,5 | 1 | 2 | 2 |

### 2. Teorema de Steiner (`I = Icm + Md²`)

Para disco com `M = 2 kg` e `R = 0,5 m`:

- Com `d = 0 m`: `Icm = 0,25 kg·m²`, `Md² = 0 kg·m²`, `I = 0,25 kg·m²`.
- Com `d = 0,5 m`: `Icm = 0,25 kg·m²`, `Md² = 0,50 kg·m²`, `I = 0,75 kg·m²`.
- Sob torque fixo `τ = 0,5 N·m`: `α_central = 2 rad/s²` e `α_deslocado = 2/3 ≈ 0,6667 rad/s²`.
- Na bancada acionada por força `F = 1 N` na borda oposta (`b = R + d = 1,0 m`): `τ = 1,0 N·m` e `α = 4/3 ≈ 1,333 rad/s²`.
- Ao dobrar `d` (ex.: de `0,25 m` para `0,50 m`), o termo adicional `Md²` quadruplica (de `0,125` para `0,50 kg·m²`).

Esses casos são cobertos por testes unitários em `tests/physics.test.js` e `tests/export.test.js` e podem ser reproduzidos pelos experimentos guiados no navegador.

## Validação automatizada executada

Em 03/11/2026, nesta cópia local, foram executados com sucesso:

1. `npm test` — 24 testes aprovados em 2 arquivos (`tests/physics.test.js` e `tests/export.test.js`). Cobre fórmulas de inércia no CM (`Icm`), termo de Steiner (`Md²`), inércia total (`I = Icm + Md²`) para as quatro geometrias, braço de alavanca (`b = b_cm + d`), torque no eixo (`τ = ±bF` e override de torque fixo), cinemática, proporcionalidade (dobro de força, dobro de massa, variação de raio, quadruplicação de `Md²` ao dobrar `d`), mapeamento angular para Canvas 2D (`canvasRotationAngle`), limites, integração temporal independente de FPS e de velocidade de reprodução, sincronia dos comparativos, pausa/reinício, formatação, CSV com colunas de Steiner e os casos de referência.
2. `npm run build` — build Vite concluído sem erros ou avisos. Valida a composição dos módulos, inclusive Three.js, gráficos (incluindo `I(d)`), comparações e exportação.
3. Inspeção automatizada no navegador Google Chrome (com WebGL ativo): verificação visual e funcional da bancada 3D com eixo central (`d = 0`) e deslocado (`d = 0,5 m`), das quatro geometrias, dos cinco roteiros guiados, do comparativo disco × anel e do comparativo de Steiner sob mesmo torque nos sentidos anti-horário (+) e horário (−), da duplicação de `d`, do tratamento de entradas inválidas e força/torque zero, do fallback de perda/restauração de contexto WebGL e da responsividade em desktop (1440×950) e celular (375×812).

## Limites conhecidos

- Os gráficos representam dados numéricos analíticos de corpos rígidos ideais sem atrito; não são medições de um experimento físico real.
- O deslocamento do eixo contempla apenas eixos paralelos ao eixo central original (`I = Icm + Md²`), com haste de acoplamento de massa desprezível.
- A visualização 3D requer WebGL. Sem ele, controles, valores, gráficos, CSV e comparações 2D continuam disponíveis.
- Em rotações muito rápidas, a animação pode sofrer aliasing visual; os valores e curvas permanecem calculados pelo mesmo tempo simulado.
