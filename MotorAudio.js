// MotorAudio.js

export class MotorAudio {
    constructor() {
        this.audioCtx = null;
        this.sfxEnabled = false;
        this.musicEnabled = false;
        
        // Nodos SFX Continuos
        this.windGainNode = null;
        this.leavesGainNode = null;
        this.cricketGainNode = null;
        this.noiseBuffer = null;
        this.masterGainSFX = null;
        
        // Timers y Limitadores
        this.ambientTimeout = null;
        this.zenTimeoutId = null;
        this.lastPopTime = 0; 
        
        // NUEVO: Limitador de CPU para el viento
        this.lastWindUpdate = 0; 

        this.chimeNotes = [1200, 1500, 1800, 2100, 2600, 3200];
        
        this.musicMaster = null;
        this.musicDry = null;
        this.musicReverbSend = null;
        this.musicCompressor = null;
        this.musicReverb = null;

        this.rootHz = 220.0; 
        this.scaleRatios = [1, 9/8, 5/4, 3/2, 5/3]; 
        this.registerMultipliers = [0.5, 1, 2];
        this.currentDegree = 0;
        this.currentRegister = 1;

        this.sessionMood = { activity: 0.35, brightness: 0.28, ghostVoiceChance: 0.22, phraseNoteMin: 1, phraseNoteMax: 3 };
        this.lastPhraseEndedAt = 0;
    }

    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGainSFX = this.audioCtx.createGain();
            this.masterGainSFX.connect(this.audioCtx.destination);
            this.masterGainSFX.gain.value = 0.5;
            this.crearRuidoBlanco(); 
            this.initZenMusicEngine(); 
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    crearRuidoBlanco() {
        const bufferSize = this.audioCtx.sampleRate * 2; 
        this.noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    crearFuenteRuido() {
        const noiseSource = this.audioCtx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;
        noiseSource.loop = true;
        noiseSource.start();
        return noiseSource;
    }

    initCapasContinuas() {
        if (this.windGainNode || !this.audioCtx) return;
        try {
            const sourceViento = this.crearFuenteRuido();
            this.filtroViento = this.audioCtx.createBiquadFilter();
            this.filtroViento.type = 'lowpass';
            this.filtroViento.frequency.value = 400;
            this.windGainNode = this.audioCtx.createGain();
            this.windGainNode.gain.value = 0;
            sourceViento.connect(this.filtroViento).connect(this.windGainNode).connect(this.masterGainSFX);

            const sourceHojas = this.crearFuenteRuido();
            const filtroHojas = this.audioCtx.createBiquadFilter();
            filtroHojas.type = 'bandpass';
            filtroHojas.frequency.value = 3500;
            filtroHojas.Q.value = 1.5;
            this.leavesGainNode = this.audioCtx.createGain();
            this.leavesGainNode.gain.value = 0;
            sourceHojas.connect(filtroHojas).connect(this.leavesGainNode).connect(this.masterGainSFX);

            const grilloOsc = this.audioCtx.createOscillator();
            grilloOsc.type = 'sawtooth';
            grilloOsc.frequency.value = 4500; 

            const tremolo = this.audioCtx.createOscillator(); 
            tremolo.type = 'square';
            tremolo.frequency.value = 30;
            const tremoloGain = this.audioCtx.createGain();
            tremoloGain.gain.value = 1;
            tremolo.connect(tremoloGain.gain);

            this.cricketGainNode = this.audioCtx.createGain();
            this.cricketGainNode.gain.value = 0; 

            grilloOsc.connect(tremoloGain).connect(this.cricketGainNode).connect(this.masterGainSFX);
            grilloOsc.start();
            tremolo.start();
        } catch (e) { }
    }

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        this.initCtx();
        
        if (this.sfxEnabled) {
            this.initCapasContinuas();
            this.ecosistemaAmbiental(); 
        } else {
            clearTimeout(this.ambientTimeout);
            if (this.windGainNode) this.windGainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
            if (this.leavesGainNode) this.leavesGainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
            if (this.cricketGainNode) this.cricketGainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
        }
        return this.sfxEnabled;
    }

    actualizarViento(tiempoViento, intensidadCien) {
        if (!this.sfxEnabled || !this.windGainNode || !this.audioCtx) return;
        
        // OPTIMIZACIÓN 1: Limitador de CPU. 
        // En lugar de calcular esto 60 veces por segundo, lo hacemos solo 10 veces.
        const now = performance.now();
        if (now - this.lastWindUpdate < 100) return; 
        this.lastWindUpdate = now;

        try {
            let windIntensity = Math.min(100, Math.max(0, intensidadCien)) / 100;
            let volViento = windIntensity * (0.05 + 0.1 * Math.abs(Math.sin(tiempoViento * 1.2)));
            this.windGainNode.gain.setTargetAtTime(volViento, this.audioCtx.currentTime, 0.1);
            
            const targetFreq = 200 + (windIntensity * 800) + (Math.sin(tiempoViento * 2) * 300 * windIntensity);
            this.filtroViento.frequency.setTargetAtTime(Math.max(100, targetFreq), this.audioCtx.currentTime, 0.5);

            let volHojas = windIntensity * (0.02 + 0.08 * Math.abs(Math.sin(tiempoViento * 3.5)));
            this.leavesGainNode.gain.setTargetAtTime(volHojas, this.audioCtx.currentTime, 0.1);
            
            let volGrillos = (1.0 - windIntensity) * 0.02;
            volGrillos *= (0.5 + 0.5 * Math.sin(tiempoViento * 0.2)); 
            this.cricketGainNode.gain.setTargetAtTime(volGrillos, this.audioCtx.currentTime, 0.5);
        } catch(e) {}
    }

    ecosistemaAmbiental = () => {
        if (!this.sfxEnabled || !this.audioCtx) return;
        const dado = Math.random();
        const tiempo = this.audioCtx.currentTime;
        
        if (dado > 0.90) this.playCarpintero(tiempo);
        else if (dado > 0.75) {
            this.playCampanaViento(tiempo);
            if(Math.random() > 0.5) this.playCampanaViento(tiempo + 0.2); 
        } else if (dado > 0.60) this.playAve(tiempo);
        else if (dado > 0.45) this.playPezSplash(tiempo);
        else if (dado > 0.30) this.playRamaSeca(tiempo);
        
        this.ambientTimeout = setTimeout(this.ecosistemaAmbiental, 3000 + Math.random() * 7000);
    }

    // A partir de aquí, todas las funciones de sonido efímero incluyen .onended = disconnect
    // para destruir los nodos y liberar memoria RAM al instante.

    playCarpintero(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state === 'suspended') return;
        const golpes = 6 + Math.floor(Math.random() * 5);
        for(let i=0; i<golpes; i++) {
            const noise = this.crearFuenteRuido();
            const filtro = this.audioCtx.createBiquadFilter();
            filtro.type = 'bandpass'; filtro.frequency.value = 1200; 
            const gain = this.audioCtx.createGain();
            noise.connect(filtro).connect(gain).connect(this.masterGainSFX);
            const t = tiempoActual + (i * 0.06); 
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.6, t + 0.005); 
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03); 
            noise.stop(t + 0.05);
            // OPTIMIZACIÓN 2: Recolector de basura agresivo
            noise.onended = () => { try { noise.disconnect(); filtro.disconnect(); gain.disconnect(); } catch(e){} };
        }
    }

    playCampanaViento(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state === 'suspended') return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain).connect(this.masterGainSFX);
        osc.type = 'sine';
        osc.frequency.value = this.chimeNotes[Math.floor(Math.random() * this.chimeNotes.length)];
        gain.gain.setValueAtTime(0, tiempoActual);
        gain.gain.linearRampToValueAtTime(0.2, tiempoActual + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 4.0); 
        osc.start(tiempoActual); osc.stop(tiempoActual + 4.5);
        osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
    }

    playPezSplash(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state === 'suspended') return;
        const osc = this.audioCtx.createOscillator();
        const gainBloop = this.audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, tiempoActual); osc.frequency.exponentialRampToValueAtTime(150, tiempoActual + 0.15); 
        gainBloop.gain.setValueAtTime(0, tiempoActual); gainBloop.gain.linearRampToValueAtTime(0.3, tiempoActual + 0.02); gainBloop.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 0.25);
        osc.connect(gainBloop).connect(this.masterGainSFX);

        const noise = this.crearFuenteRuido();
        const filtroNoise = this.audioCtx.createBiquadFilter();
        filtroNoise.type = 'bandpass'; filtroNoise.frequency.value = 1200; 
        const gainNoise = this.audioCtx.createGain();
        gainNoise.gain.setValueAtTime(0, tiempoActual); gainNoise.gain.linearRampToValueAtTime(0.1, tiempoActual + 0.02); gainNoise.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 0.2);
        noise.connect(filtroNoise).connect(gainNoise).connect(this.masterGainSFX);

        osc.start(tiempoActual); osc.stop(tiempoActual + 0.3); noise.stop(tiempoActual + 0.25);
        osc.onended = () => { try { osc.disconnect(); gainBloop.disconnect(); noise.disconnect(); filtroNoise.disconnect(); gainNoise.disconnect(); } catch(e){} };
    }

    playAve(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state === 'suspended') return;
        const trinos = Math.floor(Math.random() * 3) + 2; 
        let t = tiempoActual;
        for (let i = 0; i < trinos; i++) {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain).connect(this.masterGainSFX);
            osc.type = 'sine';
            const baseFreq = 2000 + Math.random() * 1500; 
            osc.frequency.setValueAtTime(baseFreq, t);
            const direccion = Math.random() > 0.5 ? 800 : -800; 
            osc.frequency.exponentialRampToValueAtTime(baseFreq + direccion, t + 0.1);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.start(t); osc.stop(t + 0.15);
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
            t += 0.1 + Math.random() * 0.1; 
        }
    }

    playRamaSeca(time) {
        if (!this.sfxEnabled || !this.audioCtx || !this.masterGainSFX || this.audioCtx.state === 'suspended') return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const filter = this.audioCtx.createBiquadFilter();
            osc.type = 'square';
            osc.frequency.setValueAtTime(150 + Math.random() * 200, time);
            osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
            filter.type = 'bandpass'; filter.frequency.value = 1000 + Math.random() * 2000; filter.Q.value = 2;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            osc.connect(filter).connect(gain).connect(this.masterGainSFX);
            osc.start(time); osc.stop(time + 0.2);
            osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch(e){} };
        } catch(e){}
    }

    playPop() {
        if (!this.sfxEnabled || !this.audioCtx || !this.masterGainSFX || this.audioCtx.state === 'suspended') return;
        if (this.audioCtx.currentTime - this.lastPopTime < 0.1) return;
        this.lastPopTime = this.audioCtx.currentTime;

        try {
            const time = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain).connect(this.masterGainSFX);
            osc.type = 'sine';
            const freq = 600 + Math.random() * 800; 
            osc.frequency.setValueAtTime(freq, time);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, time + 0.1);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.06, time + 0.01); 
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15); 
            osc.start(time); osc.stop(time + 0.15);
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        } catch (e) {}
    }


    // ==========================================
    // SECCIÓN 2: MOTOR MUSICAL GENERATIVO (ZEN)
    // ==========================================

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        this.initCtx(); 
        if (this.musicEnabled) {
            this.startZenMusic();
        } else {
            this.stopZenMusic();
        }
        return this.musicEnabled;
    }

    resumeMusic() {
        if (this.musicEnabled && this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    initZenMusicEngine() {
        if (this.musicMaster) return; 

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
            { d: this.currentDegree, w: 0.38 }, { d: this.currentDegree - 1, w: 0.22 }, { d: this.currentDegree + 1, w: 0.22 },         
            { d: this.currentDegree - 2, w: 0.08 }, { d: this.currentDegree + 2, w: 0.08 }, { d: 0, w: 0.18 }                               
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

    _scheduleNote({ time, freq, duration = 6, peak = 0.35, type = 'sine', brightness = 0.24, vibratoAmount = 2.5, vibratoRate = 0.12, reverbSendBoost = 1.0 }) {
        if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
        try {
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

            // Destrucción profunda de sintetizador
            osc.onended = () => { try { osc.disconnect(); filter.disconnect(); amp.disconnect(); lfo.disconnect(); lfoGain.disconnect(); } catch(e){} };
        } catch(e) {}
    }

    _scheduleGhostVoice({ time, baseFreq, duration }) {
        const intervalChoices = [1, 3 / 2, 2]; 
        const ratio = intervalChoices[Math.floor(Math.random() * intervalChoices.length)];
        const ghostFreq = baseFreq * ratio;

        this._scheduleNote({
            time: time + 0.8 + Math.random() * 1.2, freq: ghostFreq,
            duration: duration * (0.7 + Math.random() * 0.5),
            peak: 0.12, type: 'triangle', brightness: this.sessionMood.brightness * 0.9,
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
            const peak = 0.25 + Math.random() * 0.15; 
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
