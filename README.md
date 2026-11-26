# Farmador de Aura

Jogo de webcam para macOS e Windows. Faça o movimento 6–7 e ganhe um ponto de aura a cada troca de mão. Aos 1.000 pontos, um tigre com arco-íris comemora com você.

## Como jogar

1. Baixe a versão do seu sistema na [página de releases](https://github.com/Xunaty/67/releases).
2. No Mac com Apple Silicon, abra **Farmador de Aura.app**. No Windows x64, extraia o ZIP inteiro e abra **Farmador de Aura.exe**.
3. Clique em **Ligar câmera** e permita o acesso quando solicitado. Deixe ombros, cotovelos e pulsos no quadro.
4. Com as palmas viradas para cima, suba uma mão enquanto a outra desce. A primeira posição serve de referência para o contador.

Clique no botão de quatro cantos na webcam para jogar em tela cheia. O placar fica no alto da imagem, e o traçado mostra onde o detector vê cada braço. O MediaPipe processa a câmera no próprio computador.

## Desenvolvimento

Use Node.js 22.12 ou mais recente. Instale as dependências e abra a versão desktop.

```sh
npm ci --ignore-scripts
npx --no-install install-electron
npm start
```

- `npm test` testa a lógica da contagem.
- `npm run build:mac` empacota o app para a arquitetura do Mac usado na compilação.
- `npm run build:windows` empacota o app para Windows x64.

Os arquivos de build ficam em `dist/`. O modelo Pose Landmarker Lite acompanha o app sob a [licença Apache 2.0](assets/MEDIAPIPE-LICENSE.txt).
