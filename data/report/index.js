const port = chrome.runtime.connect({
  name: 'report'
});

const entries = document.getElementById('entries');
const progresses = new Map();

port.onMessage.addListener(request => {
  if (request.command !== 'fetch') {
    console.log(request);
  }

  if (request.command === 'fetch') {
    if (progresses.has(request.href) === false) {
      const t = document.getElementById('entry');
      const clone = document.importNode(t.content, true);
      progresses.set(request.href, {
        progress: clone.querySelector('progress'),
        counter: clone.querySelector('span.counter')
      });
      clone.querySelector('span.address').title =
      clone.querySelector('span.address').textContent = request.href;
      entries.append(clone);
    }

    const e = progresses.get(request.href);
    if (request.total) {
      const percent = request.loaded / request.total * 100;
      e.progress.value = percent;
      e.counter.textContent = percent.toFixed(1) + '%';
    }
  }
  else if (request.command === 'done') {
    const e = progresses.get(request.href);
    e.progress.value = 100;
    e.counter.textContent = '100%';
  }
  else if (request.command === 'close') {
    window.close();
  }
});
port.postMessage({
  command: 'ready'
});
