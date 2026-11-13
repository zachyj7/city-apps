// Faces around the table. Every pair of players keeps one two-way video call (a mesh: fine for 8 people
// at small sizes). Calls start with a blank picture and silent sound; turning the camera on swaps the real
// tracks into every call, so nobody has to redial.
const CAM = {
  video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } },
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

export class Video {
  constructor(onChange) {
    this.onChange = onChange;
    this.calls = new Map();     // remote peer id -> call
    this.streams = new Map();   // remote peer id -> MediaStream
    this.cam = null;            // our camera + mic stream
    this.peer = null;
    this.blank = null;
  }

  // Must run inside a click so the silent audio is allowed to start.
  init() {
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 120;
    const g = cv.getContext('2d');
    const paint = () => { g.fillStyle = '#000'; g.fillRect(0, 0, 160, 120); };
    paint(); setInterval(paint, 1000);
    const vt = cv.captureStream ? cv.captureStream(1).getVideoTracks()[0] : null;
    let at = null;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      at = ac.createMediaStreamDestination().stream.getAudioTracks()[0];
    } catch (e) { /* no audio */ }
    this.blank = { video: vt, audio: at };
  }

  track(kind) {
    const real = this.cam && this.cam.getTracks().find(t => t.kind === kind && t.readyState === 'live');
    return real || this.blank[kind];
  }
  outStream() { return new MediaStream([this.track('video'), this.track('audio')].filter(Boolean)); }

  setPeer(peer) {
    for (const c of this.calls.values()) try { c.close(); } catch (e) { /* ignore */ }
    this.calls.clear(); this.streams.clear();
    this.peer = peer;
    peer.on('call', call => {
      const old = this.calls.get(call.peer);
      if (old) try { old.close(); } catch (e) { /* ignore */ }
      this.watchCall(call);
      call.answer(this.outStream());
    });
    this.onChange();
  }

  watchCall(call) {
    const id = call.peer;
    this.calls.set(id, call);
    const timer = setTimeout(() => { if (!this.streams.has(id) && this.calls.get(id) === call) this.drop(id, call); }, 20000);
    call.on('stream', s => { clearTimeout(timer); if (this.calls.get(id) === call) { this.streams.set(id, s); this.onChange(); } });
    call.on('close', () => this.drop(id, call));
    call.on('error', () => this.drop(id, call));
  }

  drop(id, call) {
    if (this.calls.get(id) !== call) return;
    this.calls.delete(id); this.streams.delete(id);
    try { call.close(); } catch (e) { /* ignore */ }
    this.onChange();
  }

  // Keep a call open to every other player at the table. The lower id dials so each pair has one call.
  sync(ids) {
    if (!this.peer || !this.peer.id || this.peer.destroyed) return;
    const want = new Set(ids);
    for (const [id, c] of this.calls) if (!want.has(id)) this.drop(id, c);
    for (const id of want) {
      if (this.calls.has(id) || id === this.peer.id || !(this.peer.id < id)) continue;
      try { this.watchCall(this.peer.call(id, this.outStream())); } catch (e) { /* try again next time */ }
    }
  }

  swapTracks() {
    for (const c of this.calls.values()) {
      const pc = c.peerConnection;
      if (!pc) continue;
      for (const s of pc.getSenders()) {
        const kind = s.track && s.track.kind;
        if (kind) s.replaceTrack(this.track(kind)).catch(() => {});
      }
    }
  }

  async cameraOn(fake) {
    if (fake) this.cam = fakeCamera();
    else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot use a camera here.');
      try { this.cam = await navigator.mediaDevices.getUserMedia(CAM); }
      catch (e) { this.cam = await navigator.mediaDevices.getUserMedia({ video: CAM.video }); }   // camera without a microphone
    }
    this.swapTracks();
    return this.cam;
  }

  cameraOff() {
    if (this.cam) for (const t of this.cam.getTracks()) t.stop();
    this.cam = null;
    this.swapTracks();
  }

  // Hang up every call and turn the camera off.
  stopAll() {
    for (const c of this.calls.values()) try { c.close(); } catch (e) { /* ignore */ }
    this.calls.clear(); this.streams.clear();
    this.cameraOff();
    this.peer = null;
  }

  setMic(on) {
    if (this.cam) for (const t of this.cam.getAudioTracks()) t.enabled = on;
  }
  hasMic() { return !!(this.cam && this.cam.getAudioTracks().length); }
}

// A moving test picture instead of a real camera (add ?fakecam to the address), for trying it out on one computer.
function fakeCamera() {
  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 240;
  const g = cv.getContext('2d');
  const hue = Math.floor(Math.random() * 360);
  let t = 0;
  setInterval(() => {
    t++;
    g.fillStyle = `hsl(${hue},60%,40%)`; g.fillRect(0, 0, 320, 240);
    g.fillStyle = '#ffe9c9';
    g.beginPath(); g.arc(160 + Math.sin(t / 8) * 30, 120, 70, 0, 7); g.fill();
    g.fillStyle = '#222';
    g.beginPath(); g.arc(135 + Math.sin(t / 8) * 30, 105, 9, 0, 7); g.arc(185 + Math.sin(t / 8) * 30, 105, 9, 0, 7); g.fill();
    g.fillRect(140 + Math.sin(t / 8) * 30, 150, 40, 8);
  }, 66);
  return cv.captureStream(15);
}
