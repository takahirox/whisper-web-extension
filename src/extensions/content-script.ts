import fixWebmDuration from "fix-webm-duration";
import {
  ErrorMessageData,
  Message,
  MessageType,
  RequestMessageData,
  ResponseMessageData
} from "./common";

const mimeType = (() => {
  const types = [
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/aac'
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return undefined;
})();

const blackMicIconPath = chrome.runtime.getURL('icons/mic-black.svg');
const whiteMicIconPath = chrome.runtime.getURL('icons/mic-white.svg');

const micIcon = document.createElement('img');
micIcon.src = whiteMicIconPath;
micIcon.style.border = '1px solid';
micIcon.style.borderRadius = '4px';
micIcon.style.cursor = 'default';
micIcon.style.height = '16px';
micIcon.style.opacity = '1.0';
micIcon.style.position = 'absolute';
micIcon.style.right = '0px';
micIcon.style.top = '0px';
micIcon.style.width = '16px';

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let targetElement: Element;

const sendRequest = (audioData: Float32Array): void => {
  port.postMessage({
    type: MessageType.Request,
    data: {
      url: URL.createObjectURL(new Blob([audioData.buffer]))
    } as RequestMessageData
  } as Message);
};

const handleResponse = (text: string): void => {
  // TODO: The property to store should depend on element type.
  //       Especially contenteditable element is tricky.
  targetElement.textContent = text;
  micIcon.style.opacity = '1.0';
};

const handleError = (message: string): void => {
  console.error(message);
  micIcon.style.opacity = '1.0';
};

const disableIcon = (): void => {
  micIcon.style.opacity = '0.5';
};

const enableIcon = (): void => {
  micIcon.style.opacity = '1.0';
};

const isIconEnabled = (): boolean => {
  return Number(micIcon.style.opacity) === 1.0;
};

const startRecord = async (): Promise<void> => {
  disableIcon();

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });
  } catch (error) {
    console.error(error);
	return;
  } finally {
    enableIcon();
  }

  micIcon.src = blackMicIconPath;

  recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  
  const startTime = performance.now();

  recorder.addEventListener('dataavailable', async (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }

    if (recorder.state === 'inactive') {
      let blob = new Blob(chunks, { type: mimeType });
 
      if (mimeType === 'audio/webm') {
        const duration = performance.now() - startTime;	
        blob = await fixWebmDuration(blob, duration);
      }

      // TODO: Write a comment why 16000
      const context = new AudioContext({ sampleRate: 16000 });
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());

      // TODO: Support stereo

      const audioData = decoded.getChannelData(0);

      sendRequest(audioData);

      stream.getTracks().forEach(track => {
        track.stop();
      });
      stream = null;
      recorder = null;

      micIcon.src = whiteMicIconPath;
    }
  });

  recorder.start();
};

const stopRecord = (): void => {
  recorder!.stop();
  disableIcon();
};

const port = chrome.runtime.connect();

port.onMessage.addListener((msg: Message) => {
  switch (msg.type) {
    case MessageType.Response:
    {
      const { text } = msg.data as ResponseMessageData;
      handleResponse(text);
      break;
    }

    case MessageType.Error:
    {
      const { message } = msg.data as ErrorMessageData;
      handleError(message);
      break;
    }

    default:
    {
      console.error(`Unknown message type ${msg.type}`);
    }
  }
});

micIcon.addEventListener('click', async () => {
  if (!isIconEnabled()) {
    return;
  }

  if (recorder === null) {
    startRecord();
  } else {
    stopRecord();
  }
});

document.addEventListener('focusin', () => {
  const activeElement = document.activeElement as HTMLElement;

  if (targetElement === activeElement) {
    return;
  }

  if (!activeElement.isContentEditable &&
    !(activeElement.tagName === 'TEXTAREA') &&
    !(activeElement.tagName === 'INPUT' && (activeElement as HTMLInputElement).type === 'text')) {
    return;
  }

  targetElement = document.activeElement;
  targetElement.parentElement.appendChild(micIcon);
});
