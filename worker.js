const offscreen = async () => {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: 'offscreen/index.html',
      reasons: ['AUDIO_PLAYBACK', 'BLOBS'],
      justification: 'Needed to play synthesized TTS audio'
    });
  }
};

const activeEvents = new Map();
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'offscreen') {
    port.onDisconnect.addListener(() => {
      for (const sendTtsEvent of activeEvents.values()) {
        sendTtsEvent({
          type: 'error',
          errorMessage: 'Unexpected termination of the offscreen page'
        });
      }
      activeEvents.clear();
    });
  }
  else if (port.name === 'report') {
    self.reporter = port;
    port.onMessage.addListener(request => {
      if (request.command === 'ready') {
        for (const request of report.stack) {
          port.postMessage(request);
        }
        report.stack.length = 0;
        self.reporter.ready = true;
      }
    });
    port.onDisconnect.addListener(() => {
      delete self.reporter;
    });
  }
});

chrome.ttsEngine.onSpeak.addListener(async (utterance, options, sendTtsEvent) => {
  const uuid = Date.now();
  activeEvents.set(uuid, sendTtsEvent);

  await offscreen();

  const prefs = await chrome.storage.local.get({
    'dtype': 'q8', // "fp32", "fp16", "q8", "q4", "q4f16"
    'device': 'webgpu' // "wasm", "webgpu", "cpu"
  });

  chrome.runtime.sendMessage({
    command: 'bg:speak',
    utterance,
    options,
    ...prefs,
    uuid
  });
});
chrome.ttsEngine.onStop.addListener(() => chrome.runtime.sendMessage({
  command: 'bg:stop-all'
}));

chrome.runtime.onMessage.addListener(request => {
  // handle offscreen responses
  if (request.command.startsWith('of:')) {
    const sendTtsEvent = activeEvents.get(request.uuid);
    if (sendTtsEvent) {
      if (request.command === 'of:start') {
        sendTtsEvent({type: 'start'});
      }
      else if (request.command === 'of:end') {
        sendTtsEvent({type: 'end', charIndex: request.length});
      }
      else if (request.command === 'of:sentence') {
        if (self.reporter) {
          self.reporter.postMessage({
            command: 'close'
          });
        }
        sendTtsEvent({type: 'sentence', charIndex: request.index});
      }
      else if (request.command === 'of:error') {
        sendTtsEvent({type: 'error', errorMessage: request.message});
      }
    }
  }
});

// report server requests to the user
const report = request => {
  if (self.reporter?.ready) {
    self.reporter.postMessage(request);
  }
  else {
    if (report.stack.length === 0) {
      chrome.tabs.create({
        url: 'data/report/index.html'
      });
    }
    report.stack.push(request);
  }
};
report.stack = [];

const remote = async request => {
  const response = await fetch(request);

  // Get total size if provided by server
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  if (!response.body) {
    return response;
  }

  const reader = response.body.getReader();

  const stream = new ReadableStream({
    async pull(controller) {
      const {done, value} = await reader.read();
      if (done) {
        report({
          command: 'done',
          href: request.url
        });
        controller.close();
        return;
      }

      loaded += value.byteLength;
      report({
        command: 'fetch',
        href: request.url,
        loaded,
        total
      });

      controller.enqueue(value);
    }
  });

  return new Response(stream, {
    headers: response.headers
  });
};

self.addEventListener('fetch', e => {
  const href = e.request.url;
  if (href.startsWith('https://')) {
    e.respondWith(remote(e.request));
  }
  else {
    e.respondWith(fetch(e.request));
  }
});
