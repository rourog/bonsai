// MotorAudio.js

export class MotorAudio {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        
        this.musicEnabled = false;
        this.sfxEnabled = false;
        
        this.masterGainSFX = this.audioCtx.createGain();
        this.masterGainSFX.connect(this.audioCtx.destination);
        this.masterGainSFX.gain.value = 0.5;

        this.iniciarViento();
        this.initZenMusicEngine();
    }

    // --- SFX (Viento y Ramas) ---
    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        if (this.sfxEnabled && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        if (!this.sfxEnabled && this.vientoGain) {
            this.vientoGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.5);
        }
        return this.sfxEnabled;
    }

    iniciarViento() {
        const bufferSize = this.audioCtx.sampleRate * 2; 
        const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        this.ruidoBlanco = this.audioCtx.createBufferSource();
        this.ruidoBlanco.buffer = noiseBuffer;
        this.ruidoBlanco.loop = true;

        this.filtroViento = this.audioCtx.createBiquadFilter();
        this.filtroViento.type = 'lowpass';
        this.filtroViento.frequency.value = 400; 
        this.filtroViento.Q.value = 1.5; 

        this.vientoGain = this.audioCtx.createGain();
        this.vientoGain.gain.value = 0; 

        this.ruidoBlanco.connect(this.filtroViento);
        this.filtroViento.connect(this.vientoGain);
        this.vientoGain.connect(this.masterGainSFX);
        this.ruidoBlanco.start();
    }

    actualizarViento(tiempo, intensidadCien) {
        if (!this.sfxEnabled || !this.vientoGain) return;
        const intensidadNorm = Math.min(100, Math.max(0, intensidadCien)) / 100;
        const rafaga = Math.sin(tiempo * 2) * Math.sin(tiempo * 0.5); 
        const targetVol = (0.05 + (intensidadNorm * 0.4)) + (rafaga * 0.1 * intensidadNorm);
        const targetFreq = 200 + (intensidadNorm * 800) + (rafaga * 300 * intensidadNorm);

        this.vientoGain.gain.setTargetAtTime(Math.max(0, targetVol), this.audioCtx.currentTime, 0.5);
        this.filtroViento.frequency.setTargetAtTime(Math.max(100, targetFreq), this.audioCtx.currentTime, 0.5);
    }

    playRamaSeca(time) {
        if (!this.sfxEnabled) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        osc.type = 'square';
        osc.frequency.setValueAtTime(150 + Math.random() * 200, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

        filter.type = 'bandpass';
        filter.frequency.value = 1000 + Math.random() * 2000;
        filter.Q.value = 2;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        osc.connect(filter).connect(gain).connect(this.masterGainSFX);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    // --- MÚSICA ZEN ---
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (this.musicEnabled) {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            this.startZenMusic();
        } else {
            this.stopZenMusic();
        }
        return this.musicEnabled;
    }

    resumeMusic() {
        if (this.musicEnabled && this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }

    initZenMusicEngine() {
        this.zenTimeoutId = null;
        this.musicMaster = this.audioCtx.createGain();
        this.musicMaster.gain.value = 0.0;

        this.musicDry = this.audioCtx.createGain();
        this.musicDry.gain.value = 0.75;

        this.musicReverbSend = this.audioCtx.createGain();
        this.musicReverbSend.gain.value = 0.35;

        this.musicCompressor = this.audioCtx.createDynamicsCompressor();
        this.musicCompressor.threshold.value = -26;
        this.musicCompressor.knee.value = 18;
        this.musicCompressor.ratio.value = 2.2;
        this.musicCompressor.attack.value = 0.02;
        this.musicCompressor.release.value = 0.45;

        this.musicReverb = this.audioCtx.createConvolver();
        this.musicReverb.buffer = this._createImpulseResponse(3.2, 2.2);

        this.musicDry.connect(this.musicMaster);
        this.musicReverbSend.connect(this.musicReverb).connect(this.musicMaster);
        this.musicMaster.connect(this.musicCompressor).connect(this.audioCtx.destination);

        this.rootHz = 220.0; 
        this.scaleRatios = [1, 9/8, 5/4, 3/2, 5/3]; 
        this.registerMultipliers = [0.5, 1, 2];
        this.currentDegree = 0;
        this.currentRegister = 1;

        this.sessionMood = { activity: 0.35, brightness: 0.28, ghostVoiceChance: 0.22, phraseNoteMin: 1, phraseNoteMax: 3 };
        this.lastPhraseEndedAt = 0;
        this._randomizeSessionIdentity();
    }

    _createImpulseResponse(seconds, decay) {
        const rate = this.audioCtx.sampleRate;
        const length = Math.floor(rate * seconds);
        const impulse = this.audioCtx.createBuffer(2, length, rate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                const t = i / length;
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
            }
        }
        return impulse;
    }

    reseedMusicEngine(seedString) {
        let num = 0;
        for (let i = 0; i < seedString.length; i++) num += seedString.charCodeAt(i);
        const possibleRoots = [196.00, 220.00, 261.63, 293.66]; 
        this.rootHz = possibleRoots[num % possibleRoots.length];
        this._randomizeSessionIdentity();
    }

    _randomizeSessionIdentity() {
        this.sessionMood.activity = 0.22 + Math.random() * 0.22;       
        this.sessionMood.brightness = 0.18 + Math.random() * 0.18;     
        this.sessionMood.ghostVoiceChance = 0.14 + Math.random() * 0.18;
        this.sessionMood.phraseNoteMax = Math.random() > 0.5 ? 2 : 3;
        this.currentDegree = 0;
        this.currentRegister = Math.random() > 0.7 ? 0 : 1;
    }

    _degreeToFreq(degree, register = 1) {
        const safeDegree = ((degree % this.scaleRatios.length) + this.scaleRatios.length) % this.scaleRatios.length;
        const ratio = this.scaleRatios[safeDegree];
        const reg = this.registerMultipliers[Math.max(0, Math.min(register, this.registerMultipliers.length - 1))];
        return this.rootHz * ratio * reg;
    }

    _weightedNextDegree() {
        const candidates = [
            { d: this.currentDegree, w: 0.38 },             
            { d: this.currentDegree - 1, w: 0.22 },         
            { d: this.currentDegree + 1, w: 0.22 },         
            { d: this.currentDegree - 2, w: 0.08 },         
            { d: this.currentDegree + 2, w: 0.08 },
            { d: 0, w: 0.18 }                               
        ];
        const total = candidates.reduce((s, c) => s + c.w, 0);
        let roll = Math.random() * total;
        for (const c of candidates) { roll -= c.w; if (roll <= 0) return c.d; }
        return this.currentDegree;
    }

    _maybeShiftRegister() {
        const r = Math.random();
        if (r < 0.80) return this.currentRegister;
        if (r < 0.90) return Math.max(0, this.currentRegister - 1);
        return Math.min(2, this.currentRegister + 1);
    }

    _scheduleNote({ time, freq, duration = 6, peak = 0.25, type = 'sine', brightness = 0.24, vibratoAmount = 2.5, vibratoRate = 0.12, reverbSendBoost = 1.0 }) {
        const osc = this.audioCtx.createOscillator();
        const amp = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        osc.type = type;
        filter.type = 'lowpass';
        filter.frequency.value = 700 + brightness * 2200; 
        filter.Q.value = 0.35;
        amp.gain.value = 0;

        osc.connect(filter).connect(amp);
        amp.connect(this.musicDry);
        amp.connect(this.musicReverbSend);

        const lfo = this.audioCtx.createOscillator();
        const lfoGain = this.audioCtx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = vibratoRate;
        lfoGain.gain.value = vibratoAmount;
        lfo.connect(lfoGain).connect(osc.frequency);

        osc.frequency.setValueAtTime(freq, time);

        // Aumentado el peak para que sea claramente audible
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.linearRampToValueAtTime(peak, time + Math.min(2.2, duration * 0.35));
        amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        const baseCutoff = 700 + brightness * 2200;
        filter.frequency.setValueAtTime(baseCutoff, time);
        filter.frequency.linearRampToValueAtTime(baseCutoff * 1.08, time + duration * 0.2);
        filter.frequency.linearRampToValueAtTime(baseCutoff * 0.92, time + duration);

        const originalSend = this.musicReverbSend.gain.value;
        this.musicReverbSend.gain.setValueAtTime(originalSend * reverbSendBoost, time);

        osc.start(time); lfo.start(time);
        osc.stop(time + duration + 0.1); lfo.stop(time + duration + 0.1);
    }

    _scheduleGhostVoice({ time, baseFreq, duration }) {
        const intervalChoices = [1, 3 / 2, 2]; 
        const ratio = intervalChoices[Math.floor(Math.random() * intervalChoices.length)];
        const ghostFreq = baseFreq * ratio;

        this._scheduleNote({
            time: time + 0.8 + Math.random() * 1.2, freq: ghostFreq,
            duration: duration * (0.7 + Math.random() * 0.5),
            peak: 0.1, type: 'triangle', brightness: this.sessionMood.brightness * 0.9,
            vibratoAmount: 1.2, vibratoRate: 0.08, reverbSendBoost: 1.25
        });
    }

    _schedulePhrase(startTime) {
        const noteCount = Math.floor(Math.random() * (this.sessionMood.phraseNoteMax - this.sessionMood.phraseNoteMin + 1)) + this.sessionMood.phraseNoteMin;
        let t = startTime;
        let firstFreq = null; let lastFreq = null;

        for (let i = 0; i < noteCount; i++) {
            this.currentDegree = this._weightedNextDegree();
            this.currentRegister = this._maybeShiftRegister();
            if (Math.random() < 0.20) { this.currentDegree = 0; if (Math.random() < 0.8) this.currentRegister = 1; }

            const freq = this._degreeToFreq(this.currentDegree, this.currentRegister);
            const duration = 4.8 + Math.random() * 4.5;
            const peak = 0.2 + Math.random() * 0.15; // Notas con buen volumen
            const type = Math.random() < 0.85 ? 'sine' : 'triangle';

            this._scheduleNote({ time: t, freq, duration, peak, type, brightness: this.sessionMood.brightness, vibratoAmount: 1.5 + Math.random() * 1.8, vibratoRate: 0.07 + Math.random() * 0.08, reverbSendBoost: 1.0 + Math.random() * 0.2 });

            if (firstFreq == null) firstFreq = freq;
            lastFreq = freq;
            t += 2.2 + Math.random() * 3.8;
        }

        if (Math.random() < this.sessionMood.ghostVoiceChance && firstFreq) {
            this._scheduleGhostVoice({ time: startTime, baseFreq: Math.random() < 0.5 ? firstFreq : lastFreq, duration: 5 + Math.random() * 3 });
        }

        const phraseDuration = t - startTime;
        const silence = (6 + Math.random() * 10) + (noteCount > 1 ? (noteCount - 1) * (2 + Math.random() * 2) : 0);
        this.lastPhraseEndedAt = startTime + phraseDuration + silence;

        return this.lastPhraseEndedAt;
    }

    _zenLoop = () => {
        if (!this.musicEnabled) return;
        
        // SEGURIDAD CRÍTICA: Si el contexto está suspendido, esperamos y no programamos nada.
        if (this.audioCtx.state === 'suspended') {
            this.zenTimeoutId = setTimeout(this._zenLoop, 500);
            return;
        }

        try {
            const now = this.audioCtx.currentTime;
            const start = Math.max(now + 0.05, this.lastPhraseEndedAt || now + 0.05);

            const drift = (v, amt, min, max) => Math.max(min, Math.min(max, v + (Math.random() * 2 - 1) * amt));
            this.sessionMood.activity = drift(this.sessionMood.activity, 0.035, 0.18, 0.45);
            this.sessionMood.brightness = drift(this.sessionMood.brightness, 0.03, 0.15, 0.38);
            this.sessionMood.ghostVoiceChance = drift(this.sessionMood.ghostVoiceChance, 0.03, 0.08, 0.28);

            const nextEnd = this._schedulePhrase(start);
            const delayMs = Math.max(1000, (nextEnd - this.audioCtx.currentTime - 1.0) * 1000);
            this.zenTimeoutId = setTimeout(this._zenLoop, delayMs);
        } catch (e) {
            this.zenTimeoutId = setTimeout(this._zenLoop, 5000);
        }
    }

    startZenMusic() {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        this.musicMaster.gain.cancelScheduledValues(t);
        // Usamos setTarget para un fade-in seguro
        this.musicMaster.gain.setTargetAtTime(0.8, t, 1.0); 

        this.lastPhraseEndedAt = this.audioCtx.currentTime + 1.0 + Math.random() * 4.0;
        this._zenLoop();
    }

    stopZenMusic() {
        clearTimeout(this.zenTimeoutId);
        if (!this.audioCtx || !this.musicMaster) return;

        const t = this.audioCtx.currentTime;
        this.musicMaster.gain.cancelScheduledValues(t);
        this.musicMaster.gain.setTargetAtTime(0.0, t, 0.5);
    }
}
