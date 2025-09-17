const jobs = new Map();

const speak = (audio, reason) => {
  console.log('[speak]', 'reason: ' + reason);

  const o = jobs.get(audio);
  if (o.busy) {
    console.log( '[speak]', 'ignored');
    return;
  }
  o.controller.signal.throwIfAborted();

  if (o.segments.length === 0) {
    if (o.parsed) {
      jobs.delete(audio);
      chrome.runtime.sendMessage({
        command: 'of:end',
        uuid: o.meta.uuid,
        length: o.meta.length
      }, () => {
        if (jobs.size === 0) {
          window.close();
        }
      });
    }
    return;
  }
  o.busy = true;

  const segment = o.segments.shift();
  chrome.runtime.sendMessage({
    command: 'of:sentence',
    uuid: o.meta.uuid,
    index: segment.index
  });
  audio.src = URL.createObjectURL(segment.blob);
  audio.playbackRate = o.meta.rate;
  audio.volume = o.meta.volume;
  audio.play();
};

/* play a background request */
const play = async request => {
  const audio = new Audio();

  chrome.runtime.sendMessage({
    command: 'of:start',
    uuid: request.uuid
  });

  const worker = new Worker('worker.js');
  worker.onerror = e => {
    console.error(e);

    chrome.runtime.sendMessage({
      command: 'of:error',
      uuid: request.uuid,
      message: e.message
    });

    audio.pause();
    worker.terminate();
  };

  const controller = new AbortController();
  controller.signal.addEventListener('abort', () => {
    audio.pause();
    worker.terminate();

    jobs.delete(audio);
    if (jobs.size === 0) {
      window.close();
    }
  });
  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(audio.src);
    o.busy = false;

    // continue generating new audio segments
    if (o.continue) {
      o.continue();
      delete o.continue;
    }

    speak(audio, 'audio');
  });

  const segments = [];
  const o = {
    segments,
    worker,
    controller,
    busy: false,
    parsed: false,
    meta: {
      uuid: request.uuid,
      length: request.utterance.length,
      rate: request.options.rate || 1,
      volume: request.options.volume || 1
    }
  };
  jobs.set(audio, o);

  const segmenter = new Intl.Segmenter('en', {
    granularity: 'sentence'
  });
  for (const {segment, index} of segmenter.segment(request.utterance)) {
    o.controller.signal.throwIfAborted();

    console.log('[generate]', segment, index, request);
    worker.postMessage({
      command: 'tts-request',
      segment,
      options: request.options,
      device: request.device,
      dtype: request.dtype
    });
    const blob = await new Promise(resolve => worker.onmessage = e => {
      resolve(e.data.blob);
    });

    o.controller.signal.throwIfAborted();

    segments.push({
      blob,
      index
    });
    speak(audio, 'segmenter');

    console.log('[segments]', segments.length);

    // if we already have the next two parts, wait for the player
    if (segments.length > 2) {
      console.log('waiting for a new request');
      await new Promise(resolve => o.continue = resolve);
    }
    else {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  o.parsed = true;
};

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.command === 'bg:speak') {
    play(request);
  }
  else if (request.command === 'bg:stop-all') {
    for (const o of jobs.values()) {
      o.controller.abort();
    }
    jobs.clear();
  }
});

// to make sure we handle termination
chrome.runtime.connect({name: 'offscreen'});
