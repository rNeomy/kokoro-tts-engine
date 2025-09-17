const map = {
  'Kokoro Heart': 'af_heart',
  'Kokoro Alloy': 'af_alloy',
  'Kokoro Aoede': 'af_aoede',
  'Kokoro Bella': 'af_bella',
  'Kokoro Jessica': 'af_jessica',
  'Kokoro Kore': 'af_kore',
  'Kokoro Nicole': 'af_nicole',
  'Kokoro Nova': 'af_nova',
  'Kokoro River': 'af_river',
  'Kokoro Sarah': 'af_sarah',
  'Kokoro Sky': 'af_sky',
  'Kokoro Adam': 'am_adam',
  'Kokoro Echo': 'am_echo',
  'Kokoro Eric': 'am_eric',
  'Kokoro Fenrir': 'am_fenrir',
  'Kokoro Liam': 'am_liam',
  'Kokoro Michael': 'am_michael',
  'Kokoro Onyx': 'am_onyx',
  'Kokoro Puck': 'am_puck',
  'Kokoro Santa': 'am_santa',
  'Kokoro Emma': 'bf_emma',
  'Kokoro Isabella': 'bf_isabella',
  'Kokoro George': 'bm_george',
  'Kokoro Lewis': 'bm_lewis',
  'Kokoro Alice': 'bf_alice',
  'Kokoro Lily': 'bf_lily',
  'Kokoro Daniel': 'bm_daniel',
  'Kokoro Fable': 'bm_fable'
};

const prepare = async ({device = 'webgpu', dtype = 'q8'}) => {
  if (typeof self.tts === 'undefined') {
    const {env, KokoroTTS} = await import('/offscreen/kokoro/kokoro.web.js');
    env.wasmPaths = {
      wasm: '/offscreen/ort/ort-wasm-simd-threaded.jsep.wasm',
      mjs: '/offscreen/ort/ort-wasm-simd-threaded.jsep.mjs'
    };
    env.telemetry = false;
    env.useNetwork = false;

    self.tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype,
      device
    });
  }
};

onmessage = async e => {
  const {data} = e;

  if (data.command === 'tts-request') {
    await prepare(data);

    const r = await self.tts.generate(data.segment, {
      voice: map[data.options.voiceName] || 'am_adam'
    });

    postMessage({
      command: 'tts-response',
      uuid: data.uuid,
      blob: r.toBlob()
    });
  }
};
