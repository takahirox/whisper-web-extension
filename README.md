# Whisper as Web Extension

Whisper as Web Extension is a browser extension for speech-to-text using 
[Open AI's Whisper](https://openai.com/research/whisper) speech recognition.

Whisper runs locally in web browser. No server needed.

## Demo video

[Demo video](https://twitter.com/superhoge/status/1743916698573664586)

## How to download and build

```
$ git clone --recurse-submodules https://github.com/takahirox/whisper-web-extension.git
$ cd whisper-web-extension
$ npm install
$ npm run build
```

## How to install the extension to web browser

Load the `extensions` directory as unpacked extension with Develloper mode.
Please refer to [this document](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
for the details.

## How to use

1. Click textarea, text type input, or contenteditable element in browser.
2. Mic icon appears
3. Click the mic icon to start the recording
4. Allow the mic access
5. Speak
6. Click the mic icon to stop the recording
7. Wait until the recognized text appears in the element

## Purpose

This browser extension was created as a Proof of concept for on-device and
in-browser local inference.

There is a desire to run AI inference locally without going through the server
from the standpoint of usability and privacy. In addition, if inference can be
executed on the Web browser, platform-independent AI applications can be built.

AI inference execution requires a lot of resources. It is inefficient to load
the inference engine and model on each page of the Web browser.

Therefore, we created a browser extension that executes AI inference. The
inference engine and model are loaded in the Service Worker, and each page
sends a request to the Service Worker to execute the inference. It is efficient
because the resources for inference are shared within the browser. In addition,
since everything is completed within the browser, it does not choose the
platform, there is no need to install special software, and there is no privacy
problem because it does not go through the server.

In terms of performance, it is expected that the performance will be improved
by utilizing the GPU using [WebGPU](https://www.w3.org/TR/webgpu/).
