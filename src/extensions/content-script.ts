import fixWebmDuration from "fix-webm-duration";
import {
  ErrorMessageData,
  Message,
  MessageType,
  RequestMessageData,
  ResponseMessageData
} from "./common";

//

class WhisperExtension {
  private static requestQueue: {
    data: RequestMessageData,
    callback: (text: string) => void,
    errorCallback: (message: string) => void
  }[] = [];
  private static port = chrome.runtime.connect();

  static init(): void {
    this.port.onMessage.addListener((msg: Message) => {
      switch (msg.type) {
        case MessageType.Response:
        {
          const { text } = msg.data as ResponseMessageData;
          const request = this.requestQueue.shift();
          URL.revokeObjectURL(request.data.url);
          request.callback(text);
          break;
        }

        case MessageType.Error:
        {
          const { message } = msg.data as ErrorMessageData;
          const request = this.requestQueue.shift();
          URL.revokeObjectURL(request.data.url);
          request.errorCallback(message);
          break;
        }

        default:
        {
          console.error(`Unknown message type ${msg.type}`);
        }
      }
    });
  }

  static async request(audioData: Float32Array): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = {
        url: URL.createObjectURL(new Blob([audioData.buffer]))
      } as RequestMessageData;
      this.requestQueue.push({
        callback: resolve,
        errorCallback: reject,
        data
      });
      this.port.postMessage({
        type: MessageType.Request,
        data
      } as Message);
    });
  }
}

WhisperExtension.init();
(window as any).WhisperExtension = WhisperExtension;

//

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

const enum IconState {
  Ready,
  WaitingForUserMedia,
  Recording,
  RecordingStopRequested,
  RecordingStopped
}

let iconState: IconState = IconState.Ready;

const updateIconState = (state: IconState): void => {
  switch (state) {
    case IconState.Ready:
    {
      micIcon.src = whiteMicIconPath;
      micIcon.style.opacity = '1.0';
      break;
    }
    case IconState.WaitingForUserMedia:
    {
      micIcon.src = whiteMicIconPath;
      micIcon.style.opacity = '0.5';
      break;
    }
    case IconState.Recording:
    {
      micIcon.src = blackMicIconPath;
      micIcon.style.opacity = '1.0';
      break;
    }
    case IconState.RecordingStopRequested:
    {
      micIcon.src = blackMicIconPath;
      micIcon.style.opacity = '0.5';
      break;
    }
    case IconState.RecordingStopped:
    {
      micIcon.src = whiteMicIconPath;
      micIcon.style.opacity = '0.5';
      break;
    }
  }

  iconState = state;
};

const isIconEnabled = (): boolean => {
  return iconState === IconState.Ready || iconState === IconState.Recording;
};

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let targetElement: Element;

const startRecord = async (): Promise<void> => {
  updateIconState(IconState.WaitingForUserMedia);

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });
  } catch (error) {
    console.error(error);
    updateIconState(IconState.Ready);
	return;
  }

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

      stream.getTracks().forEach(track => {
        track.stop();
      });
      stream = null;
      recorder = null;

      updateIconState(IconState.RecordingStopped);

      // TODO: Support stereo

      const audioData = decoded.getChannelData(0);

      try {
        const text = await WhisperExtension.request(audioData);

        // TODO: The property to store should depend on element type.
        //       Especially contenteditable element is tricky.
        targetElement.textContent = text;
      } catch (error) {
        console.error(error.message);
      }

      updateIconState(IconState.Ready);
    }
  });

  recorder.start();
  updateIconState(IconState.Recording);
};

const stopRecord = (): void => {
  recorder!.stop();
  updateIconState(IconState.RecordingStopRequested);
};

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
