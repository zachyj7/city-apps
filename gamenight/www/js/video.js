// Faces around the table. Every pair of players keeps one two-way video call (a mesh: fine for 8 people
// at small sizes). Calls start with a blank picture and silent sound; turning the camera on swaps the real
// tracks into every call, so nobody has to redial.
const CAM = {
  video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },   // all 'ideal': a hard limit makes some cameras (MacBooks in Safari) refuse to start
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
    this.want = [];             // who we should have a call with (see sync)
    this.micId = '';            // the microphone chosen in Settings ('' = the device's default)
    this.healT = 0;
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
    // Calls drop now and then (a phone sleeps, Safari gives up on one): check every few seconds and dial again.
    clearInterval(this.healT);
    this.healT = setInterval(() => this.sync(this.want), 5000);
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
    this.want = ids;
    if (!this.peer || !this.peer.id || this.peer.destroyed) return;
    const want = new Set(ids);
    for (const [id, c] of this.calls) if (!want.has(id)) this.drop(id, c);
    for (const id of want) {
      if (this.calls.has(id) || id === this.peer.id || !(this.peer.id < id)) continue;
      try { this.watchCall(this.peer.call(id, this.outStream())); } catch (e) { /* try again next time */ }
    }
  }

  // Call everyone again with what we send now. Used when the camera or microphone starts or stops: swapping the
  // picture into a call that started with the blank one leaves it black in Safari, while a fresh call works
  // everywhere. The other side answers the new call in place of the old one.
  redial() {
    if (!this.peer || !this.peer.id || this.peer.destroyed) return this.swapTracks();
    for (const [id, old] of [...this.calls]) {
      let call;
      try { call = this.peer.call(id, this.outStream()); } catch (e) { continue; }
      if (!call) continue;
      this.calls.delete(id);
      try { old.close(); } catch (e) { /* ignore */ }
      this.watchCall(call);
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
      const chosen = this.micAsk();
      this.cam = await firstThatWorks([
        ...(this.micId ? [{ video: CAM.video, audio: chosen }, { video: true, audio: chosen }] : []),   // the chosen microphone; if it's gone, the default
        CAM, { video: true, audio: CAM.audio }, { video: true, audio: true },
        { video: CAM.video }, { video: true }]);   // simpler asks if a camera won't take ours; last, a camera without a microphone
    }
    this.redial();
    return this.cam;
  }

  // What to ask the browser for: the chosen microphone, with echo cancelling and the rest.
  micAsk() { return this.micId ? { ...CAM.audio, deviceId: { exact: this.micId } } : CAM.audio; }
  // The microphone in use right now (its device id), if the camera is on.
  micInUse() {
    const t = this.cam && this.cam.getAudioTracks()[0];
    return t && t.getSettings ? t.getSettings().deviceId || '' : '';
  }

  // Switch to another microphone. With the camera on, the new one goes into every call at once.
  async useMic(id, on) {
    this.micId = id || '';
    if (!this.cam) return;   // used the next time the camera goes on
    const fresh = await navigator.mediaDevices.getUserMedia({ audio: this.micAsk() });
    const t = fresh.getAudioTracks()[0];
    if (!t) return;
    t.enabled = on;
    for (const old of this.cam.getAudioTracks()) old.stop();
    this.cam = new MediaStream([...this.cam.getVideoTracks(), t]);
    this.redial();
    if (this.onChange) this.onChange();
  }

  cameraOff() {
    if (this.cam) for (const t of this.cam.getTracks()) t.stop();
    this.cam = null;
    this.redial();
  }

  // Hang up every call and turn the camera off.
  stopAll() {
    for (const c of this.calls.values()) try { c.close(); } catch (e) { /* ignore */ }
    this.calls.clear(); this.streams.clear();
    clearInterval(this.healT); this.want = [];
    this.cameraOff();
    this.peer = null;
  }

  setMic(on) {
    if (this.cam) for (const t of this.cam.getAudioTracks()) t.enabled = on;
  }
  hasMic() { return !!(this.cam && this.cam.getAudioTracks().length); }
}

// Ask for each in turn until one works. Blocked permission or no device: stop at once, the rest would fail too.
async function firstThatWorks(asks) {
  let err;
  for (const a of asks) {
    try { return await navigator.mediaDevices.getUserMedia(a); }
    catch (e) { err = e; if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e; }
  }
  throw err;
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
