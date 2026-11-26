const VISION_URL = new URL('./node_modules/@mediapipe/tasks-vision', import.meta.url).href;
const MODEL_URL = new URL('./assets/pose-landmarker-lite.task', import.meta.url).href;

function cameraError(cause) {
  switch (cause.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new Error('Permita o acesso à câmera nas configurações de privacidade e tente novamente.', { cause });
    case 'NotFoundError':
      return new Error('Conecte uma câmera para começar.', { cause });
    case 'NotReadableError':
      return new Error('Feche os outros apps que estão usando a câmera e tente novamente.', { cause });
    default:
      return new Error('Não foi possível abrir a câmera. Confira se ela está conectada e tente novamente.', { cause });
  }
}

export async function startCamera(video, { onFrame, onError }, signal) {
  signal?.throwIfAborted();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Abra o app por HTTPS ou localhost em um navegador com acesso à câmera.');
  }

  let stream;
  let cameraTrack;
  let landmarker;
  let frameContext;
  let frameRequest;
  let running = false;
  let startupError;
  let lastVideoTime = -1;
  let lastDetection = -Infinity;

  function stop() {
    signal?.removeEventListener('abort', stop);
    cancelAnimationFrame(frameRequest);
    cameraTrack?.removeEventListener('ended', handleEnded);
    cameraTrack = undefined;
    stream?.getTracks().forEach(track => track.stop());
    if (stream && video.srcObject === stream) video.srcObject = null;
    stream = undefined;
    frameContext = undefined;
    const activeLandmarker = landmarker;
    landmarker = undefined;
    try {
      activeLandmarker?.close();
    } catch {
      // Release the camera even if the model fails during teardown.
    }
  }

  function handleEnded() {
    const error = new Error('A câmera foi desconectada. Confira a conexão e tente novamente.');
    stop();
    if (running) onError(error);
    else startupError = error;
  }

  function checkStartup() {
    signal?.throwIfAborted();
    if (startupError) throw startupError;
  }

  function detect(now) {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime && now - lastDetection >= 40) {
      lastVideoTime = video.currentTime;
      lastDetection = now;
      let result;
      try {
        // Give MediaPipe the same dimensions as the pixels it reads from resized camera streams.
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.round(video.videoWidth * scale);
        const height = Math.round(video.videoHeight * scale);
        const frame = frameContext.canvas;
        if (frame.width !== width) frame.width = width;
        if (frame.height !== height) frame.height = height;
        frameContext.drawImage(video, 0, 0, width, height);
        result = landmarker.detectForVideo(frame, now);
      } catch (cause) {
        stop();
        onError(new Error('O rastreamento parou. Ligue a câmera novamente para continuar.', { cause }));
        return;
      }
      onFrame(result.landmarks[0], now);
    }
    if (landmarker) frameRequest = requestAnimationFrame(detect);
  }

  signal?.addEventListener('abort', stop, { once: true });
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (cause) {
      throw cameraError(cause);
    }
    checkStartup();

    cameraTrack = stream.getVideoTracks()[0];
    cameraTrack.addEventListener('ended', handleEnded, { once: true });
    if (cameraTrack.readyState === 'ended') handleEnded();
    checkStartup();

    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (cause) {
      throw new Error('Não foi possível exibir a câmera. Ligue a câmera novamente para continuar.', { cause });
    }
    checkStartup();

    frameContext = document.createElement('canvas').getContext('2d', { alpha: false });
    if (!frameContext) throw new Error('Não foi possível preparar a câmera. Tente abrir o app em outro navegador.');

    try {
      const { FilesetResolver, PoseLandmarker } = await import(`${VISION_URL}/vision_bundle.mjs`);
      const files = await FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
      checkStartup();
      landmarker = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'VIDEO',
      });
    } catch (cause) {
      throw new Error('Não foi possível carregar o rastreamento. Feche o aplicativo e abra de novo.', { cause });
    }
    checkStartup();

    running = true;
    frameRequest = requestAnimationFrame(detect);
    return stop;
  } catch (error) {
    stop();
    checkStartup();
    throw error;
  }
}
