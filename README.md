# Laboratório Virtual de Dinâmica de Rotação e Momento de Inércia

Produto educacional para a disciplina **Física Experimental A** da **UNIVASF**.
Simulador web que roda inteiramente no navegador e permite explorar como a massa, a
geometria e a força aplicada afetam a rotação de corpos rígidos em torno de um eixo fixo.

- Visualização 3D interativa (Three.js) com câmera orbital.
- Quatro corpos: disco/cilindro maciço, anel fino, esfera maciça e barra fina.
- Mostradores em unidades SI, gráficos de α(t), ω(t) e θ(t), e exportação CSV.
- Comparação simultânea de disco e anel com relógio comum e roteiros guiados.
- Sem backend, banco de dados, login ou serviços externos — pode ser hospedado como site estático (ex.: GitHub Pages).

## Requisitos

- [Node.js](https://nodejs.org/) 20.19 ou superior (testado com Node 22 e npm 10).
- Navegador moderno com WebGL (Chrome, Edge, Firefox ou Safari recentes).
  Sem WebGL, a aplicação continua funcionando, mas sem a visualização 3D.

## Instalação e execução

```bash
npm ci            # instala as dependências exatas do package-lock.json
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
```

Outros comandos:

```bash
npm test          # testes do modelo físico (Vitest)
npm run build     # gera a versão de produção em dist/
npm run preview   # serve dist/ localmente (http://localhost:4173)
```

Os dados registrados na execução podem ser exportados pelo botão **Exportar dados em CSV**.
O arquivo inclui parâmetros, unidades SI, momento de inércia, torque, aceleração angular
e as amostras de tempo, velocidade e posição angular.

### Hospedagem estática / GitHub Pages

O `vite.config.js` usa `base: './'`, então todos os recursos são referenciados por
caminhos relativos e o conteúdo de `dist/` funciona em qualquer subdiretório
(por exemplo, `https://<usuario>.github.io/simulador-dinamica-rotacional/`).
Basta publicar o conteúdo da pasta `dist/`.

O repositório também contém o workflow manual `.github/workflows/deploy-pages.yml`.
Após revisar o resultado, habilite **Settings → Pages → GitHub Actions** e execute o
workflow pela aba **Actions**. Ele não é acionado automaticamente por push.

## Como usar

1. Escolha a geometria e ajuste massa, raio (ou comprimento, para a barra), força e sentido.
2. Pressione **Iniciar**. Use **Pausar/Continuar** e **Reiniciar** quando quiser.
3. Arraste sobre a cena para orbitar a câmera; use a roda do mouse para aproximar;
   **Restaurar visão** volta ao enquadramento inicial. A câmera não altera o eixo físico.
4. Ajuste a **velocidade de reprodução** (0,25×, 0,5× ou 1×) para observar giros rápidos.
5. Use **Disco × anel** para comparar duas geometrias com a mesma massa, raio, força e relógio.
6. Nos roteiros guiados, aplique os valores propostos e verifique a previsão antes de iniciar.

Observações:

- Alterar qualquer parâmetro físico pausa e reinicia o experimento em t = 0 (com aviso).
- A velocidade de reprodução muda apenas o avanço do tempo simulado — animação,
  mostradores e gráficos usam o mesmo tempo — e não reinicia o experimento.
- Cada execução dura no máximo 20 s simulados.
- Em giros rápidos, a animação pode parecer lenta, parada ou invertida (efeito
  estroboscópico causado pela amostragem dos quadros). Os valores numéricos e os
  gráficos continuam corretos; reduza a reprodução para observar melhor.

## Modelo físico

Hipóteses: corpo rígido e homogêneo, eixo fixo sem atrito, força tangencial de módulo
constante que acompanha o ponto de aplicação, braço constante, partida do repouso
(θ₀ = 0, ω₀ = 0). Sinal positivo: sentido anti-horário visto de cima.

| Corpo | Eixo | Momento de inércia | Braço b |
| --- | --- | --- | --- |
| Disco / cilindro maciço | central, perpendicular ao plano | I = M R² / 2 | R |
| Anel fino | central, perpendicular ao plano | I = M R² | R |
| Esfera maciça | um diâmetro | I = 2 M R² / 5 | R |
| Barra fina | perpendicular, pelo centro | I = M L² / 12 | L / 2 |

τ = ± b F  α = τ / I  ω = α t  θ = α t² / 2

O ângulo θ é mantido acumulado nos dados; a redução módulo 2π é feita apenas para desenhar.
O tempo simulado avança de forma independente da taxa de quadros.

Limites dos controles: massa 0,1–10 kg; raio 0,05–0,5 m; comprimento 0,1–1,5 m;
força 0–5 N. Massa e dimensões devem ser estritamente positivas; força zero é permitida.

## Estrutura

```
index.html          Estrutura da página (pt-BR, acessível)
src/physics.js      Modelo físico puro (sem DOM/Three.js) — testável
src/scene.js        Renderização 3D com Three.js
src/charts.js       Gráficos ω(t) e θ(t) em Canvas 2D
src/export.js       Geração e download do CSV com parâmetros e amostras
src/format.js       Formatação numérica pt-BR e leitura de números com vírgula
src/main.js         Controlador: estado, controles e laço único de animação
src/style.css       Estilos
tests/              Testes do modelo físico (Vitest)
```

Consulte [VALIDACAO.md](VALIDACAO.md) para a metodologia e os resultados de validação.

### Escopo da validação

Os testes automatizados verificam o modelo físico, os casos de referência e a geração
do CSV. O build verifica que os módulos são empacotados pelo Vite. A aparência, a
interação por clique, a visualização WebGL, o download acionado pelo navegador e a
responsividade devem ser conferidos manualmente em um navegador antes da publicação.
