# Farmador de Aura

Jogo de webcam para macOS e Windows. Faça o movimento 6–7 e ganhe um ponto de aura cada vez que uma mão sobe da linha do cotovelo. Quanto mais rápido, mais fogo. Aos 1.000 pontos, um tigre com arco-íris comemora com você.

Curtiu? Segue lá: [@IsraelMartinsAI](https://www.instagram.com/israelmartinsai/)

## Como jogar

1. Baixe a versão do seu sistema na [página de releases](https://github.com/Xunaty/67/releases).
2. No Mac com Apple Silicon, abra **Farmador de Aura.app**. No Windows x64, extraia o ZIP inteiro e abra **Farmador de Aura.exe**.
3. Clique em **Ligar câmera** e permita o acesso quando solicitado. Deixe ombros, cotovelos e pulsos no quadro.
4. Alterne as mãos. Cada braço tem uma linha na altura do cotovelo, e conta +1 toda vez que a mão passa de baixo para cima dela. Balançar uma mão só não conta.

Clique no botão de quatro cantos na webcam para jogar em tela cheia. O MediaPipe processa a câmera no próprio computador, e o app funciona sem internet.

## O que rola durante o jogo

- **Fogo:** 3 pontos em 2 segundos esquentam, 5 pegam fogo e 7 viram aura infinita, com chamas nos pulsos, borda pegando fogo e tela tremendo.
- **SIX SEVEN:** todo número terminado em 67 (67, 167, 267…) explode na tela com buzina.
- **Títulos:** NPC, Beta, Sigma e Aura Lord, conforme a aura sobe.
- **Frases:** a cada 25 pontos pipoca uma frase. Quem fica parado 4 segundos leva um "-1000 de aura" (só de zoeira).
- **Prints:** o app tira fotos nos momentos marcantes e mostra todas na tela final. O botão **Salvar card** gera uma imagem pronta para os stories.

## Modo batalha

Clique em **Batalha** no topo, coloque o nome de cada jogador no placar e escolha:

- **Até 500:** vence quem chegar a 500 de aura primeiro.
- **30 s:** vence quem fizer mais em 30 segundos. Os melhores resultados do dia entram no ranking.

A batalha começa com uma contagem de 3, 2, 1. A câmera ganha uma linha no meio: o jogador da esquerda fica em verde e o da direita em roxo. Se tiver gente no fundo, o app fica com as duas pessoas mais perto da câmera.

## Desenvolvimento

Use Node.js 22.12 ou mais recente. Instale as dependências e abra a versão desktop.

```sh
npm ci --ignore-scripts
npx --no-install install-electron
npm start
```

- `npm test` testa a contagem, o combo e a escolha dos jogadores.
- `npm run build:mac` empacota o app para a arquitetura do Mac usado na compilação.
- `npm run build:windows` empacota o app para Windows x64.

### Publicar uma versão

Suba a versão no `package.json`, faça o commit e envie uma tag. O GitHub gera os ZIPs de Windows e Mac nos próprios servidores e publica a release sozinho ([release.yml](.github/workflows/release.yml)).

```sh
git tag v1.3.0
git push origin v1.3.0
```

Os arquivos de build locais ficam em `dist/`. O modelo Pose Landmarker Lite acompanha o app sob a [licença Apache 2.0](assets/MEDIAPIPE-LICENSE.txt). As fontes Barlow Condensed e DM Sans vêm junto sob a SIL Open Font License 1.1.
