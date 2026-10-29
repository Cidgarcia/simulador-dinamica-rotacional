# Metodologia e validação

## Escopo

O laboratório implementa corpos rígidos homogêneos, eixo fixo sem atrito e força
tangencial constante. As condições iniciais são `θ₀ = 0` e `ω₀ = 0`. O tempo é
calculado no modelo físico (`src/physics.js`), sem depender da taxa de quadros; a
animação apenas representa o estado calculado.

## Caso de referência

Para `M = 2 kg`, `R = 0,5 m` e `F = 1 N`:

| Corpo | I (kg·m²) | τ (N·m) | α (rad/s²) | ω em 2 s (rad/s) | θ em 2 s (rad) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Disco | 0,25 | 0,5 | 2 | 4 | 4 |
| Anel | 0,5 | 0,5 | 1 | 2 | 2 |

Esse caso é coberto por teste unitário em `tests/physics.test.js` e pode ser
reproduzido pela comparação guiada no navegador.

## Validação automatizada executada

Em 28/10/2026, nesta cópia local, foram executados com sucesso:

1. `npm test` — 18 testes aprovados. Cobre fórmulas de inércia, braço, torque,
   cinemática, limites, integração temporal, pausa/reinício, formatação, CSV e o
   caso de referência.
2. `npm run build` — build Vite concluído. Valida a composição dos módulos,
   inclusive Three.js, gráficos, comparação e exportação.

Esses comandos não equivalem a uma inspeção visual no navegador.

## Verificações manuais ainda necessárias

- Abrir o laboratório em navegador com WebGL e confirmar iluminação, eixo, seta
  tangencial e rotação das quatro geometrias.
- Testar iniciar, pausar, continuar, reiniciar, velocidades de reprodução e
  controles em desktop e celular.
- Na comparação, confirmar os dois desenhos, o relógio comum e as três curvas
  comparativas α(t), ω(t) e θ(t), com disco em ciano e anel em âmbar.
- Acionar o download CSV e abrir o arquivo em um leitor compatível com UTF-8.
- Executar o workflow manual de GitHub Pages e abrir a URL fornecida pelo GitHub.

## Limites conhecidos

- Os gráficos representam dados numéricos analíticos; não são medições de um
  experimento físico real.
- A visualização 3D requer WebGL. Sem ele, controles, valores, gráficos, CSV e
  comparação continuam disponíveis.
- Em rotações muito rápidas, a animação pode sofrer aliasing visual; os valores e
  curvas permanecem calculados pelo mesmo tempo simulado.
