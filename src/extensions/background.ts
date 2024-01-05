import { env } from "onnxruntime-web";
import {
  AutomaticSpeechRecognitionPipeline,
  pipeline
} from "@xenova/transformers";
import {
  ErrorMessageData,
  Message,
  MessageType,
  RequestMessageData,
  ResponseMessageData
} from "./common";

// Hack for avoiding to use URL.createObjectURL that is
// not available in Service worker.
// https://github.com/microsoft/onnxruntime/issues/14445
env.wasm.numThreads = 1;

type Port = chrome.runtime.Port;

let pipe: AutomaticSpeechRecognitionPipeline | null = null;
let processing: boolean = false;

type ProgressCallbackArg = {
  file: string,
  loaded: number,
  name: string,
  progress: number,
  status: string,
  total: number
};

const progresses: Record<string, {
  loaded: number,
  progress: number,
  total: number
}> = {};

const requestQueue: {
  port: Port,
  url: string
}[] = [];

(async (): Promise<void> => {
  pipe = await pipeline(
    'automatic-speech-recognition',
    'whisper-base.en',
    {
      local_files_only: true,
      progress_callback: (arg: ProgressCallbackArg) => {
        if (arg.status === 'progress') {
          if (progresses[arg.file] === undefined) {
            progresses[arg.file] = {
              loaded: 0,
              progress: 0,
              total: 0
            };
          }
          progresses[arg.file].loaded = arg.loaded;
          progresses[arg.file].progress = arg.progress;
          progresses[arg.file].total = arg.total;
        }
      }
    }
  );
  handleHeadRequest();
})();

const handleHeadRequest = async (): Promise<void> => {
  if (pipe === null || processing === true || requestQueue.length === 0) {
    return;
  }

  const { port, url } = requestQueue.shift();

  // TODO: Skip if port is already disconnected

  processing = true;

  try {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const array = new Float32Array(buffer);
    const result = await pipe(array);
    port.postMessage({
      type: MessageType.Response,
      data: {
        // TODO: What if result has two or more elements?
        text: Array.isArray(result) ? result[0].text : result.text
      } as ResponseMessageData
    } as Message);
  } catch (error) {
    console.error(error);
    port.postMessage({
      type: MessageType.Error,
      data: {
        message: error.message
      } as ErrorMessageData
    } as Message);
  }

  processing = false;

  handleHeadRequest();
};

chrome.runtime.onConnect.addListener((port: Port) => {
  port.onMessage.addListener(async (message: Message, port: Port) => {
    switch (message.type) {
      case MessageType.Request:
      {
        const { url } = message.data as RequestMessageData;
        requestQueue.push({ port, url });
        handleHeadRequest();
        break;
      }

      default:
      {
        const error = new Error(`Unknown message type ${message.type}`);
        console.error(error);
        port.postMessage({
          type: MessageType.Error,
          data: {
            message: error.message
          } as ErrorMessageData
        } as Message);
      }
    }
  });

  port.onDisconnect.addListener(() => {
  });
});
