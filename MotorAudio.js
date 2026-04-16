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
        this.lastWindUpdate = 0; 

        this.chimeNotes = [1200, 1500, 1800, 2100, 2600, 3200];
        
        // --- Motor Musical Minimalista ---
        this.masterMusic = null;
        this.rootHz = 220.0; 
        this.scaleRatios = [1, 9/8, 5/4, 3/2, 5/3, 2, 9/4]; 
    }

    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Canal de SFX con Volumen Maestro Potenciado
            this.masterGainSFX = this.audioCtx.createGain();
            this.masterGainSFX.connect(this.audioCtx.destination);
            this.masterGainSFX.gain.value = 0.8; 
            
            // Canal de Música
            this.masterMusic = this.audioCtx.createGain();
            this.masterMusic.connect(this.audioCtx.destination);
            this.masterMusic.gain.value = 0.6; 

            this.crearRuidoBlanco(); 
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

    // --- EFECTOS DE SONIDO OPTIMIZADOS ---

    ecosistemaAmbiental = () => {
        if (!this.sfxEnabled || !this.audioCtx) return;
        const dado = Math.random();
        const tiempo = this.audioCtx.currentTime;
        
        if (dado > 0.85) this.playCarpintero(tiempo);
        else if (dado > 0.70) this.playCampanaViento(tiempo);
        else if (dado > 0.55) this.playAve(tiempo);
        else if (dado > 0.40) this.playAguaCorriendo(tiempo); 
        else if (dado > 0.25) this.playRana(tiempo); 
        else if (dado > 0.12) this.playHojasCrujiendo(tiempo);
        else this.playRamaSeca(tiempo);
        
        this.ambientTimeout = setTimeout(this.ecosistemaAmbiental, 3000 + Math.random() * 7000);
    }

    playPop() {
        if (!this.sfxEnabled || !this.audioCtx || !this.masterGainSFX || this.audioCtx.state !== 'running') return;
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
            gain.gain.linearRampToValueAtTime(0.4, time + 0.01); 
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15); 
            
            osc.start(time); osc.stop(time + 0.15);
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        } catch (e) {}
    }

    playCampanaViento(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state !== 'running') return;
        
        const numNotas = Math.floor(Math.random() * 3) + 2; 
        for(let i = 0; i < numNotas; i++) {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain).connect(this.masterGainSFX);
            osc.type = 'sine';
            osc.frequency.value = this.chimeNotes[Math.floor(Math.random() * this.chimeNotes.length)];
            
            let t = tiempoActual + (i * (0.05 + Math.random() * 0.15)); 
            
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 4.0); 
            osc.start(t); osc.stop(t + 4.5);
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        }
    }

    playCarpintero(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state !== 'running') return;
        
        const golpes = 8 + Math.floor(Math.random() * 6); 
        const velocidad = 0.07; 
        
        for(let i = 0; i < golpes; i++) {
            let t = tiempoActual + (i * velocidad);
            
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const filter = this.audioCtx.createBiquadFilter();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(1000, t);
            osc.frequency.exponentialRampToValueAtTime(200, t + 0.02); 
            
            filter.type = 'bandpass';
            filter.frequency.value = 800; 
            filter.Q.value = 1.0;
            
            osc.connect(filter).connect(gain).connect(this.masterGainSFX);
            
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.4, t + 0.005); 
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04); 
            
            osc.start(t);
            osc.stop(t + 0.05);
            osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch(e){} };
        }
    }

    // EL AVE PRECIOSA ORIGINAL RESTAURADA
    playAve(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state !== 'running') return;
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

    playAguaCorriendo(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state !== 'running') return;
        
        // RIACHUELO: Ruido rosa suave con sweep sutil (Sin helicópteros)
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        noise.loop = true;

        const lowpass = this.audioCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 800; // Quita el siseo molesto

        const bandpass = this.audioCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 400;
        bandpass.Q.value = 1.2;

        // LFO súper lento para simular el cambio de corriente
        const lfo = this.audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 2 + Math.random() * 3; // 2-5Hz, muy tranquilo
        
        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.value = 200; 
        
        lfo.connect(lfoGain).connect(bandpass.frequency);

        const masterGain = this.audioCtx.createGain();
        
        noise.connect(lowpass).connect(bandpass).connect(masterGain).connect(this.masterGainSFX);
        
        const duracion = 3.0 + Math.random() * 2.0;

        masterGain.gain.setValueAtTime(0, tiempoActual);
        masterGain.gain.linearRampToValueAtTime(0.5, tiempoActual + 1.0); 
        masterGain.gain.linearRampToValueAtTime(0.5, tiempoActual + duracion - 1.0); 
        masterGain.gain.exponentialRampToValueAtTime(0.001, tiempoActual + duracion); 
        
        noise.start(tiempoActual); lfo.start(tiempoActual);
        noise.stop(tiempoActual + duracion + 0.1); lfo.stop(tiempoActual + duracion + 0.1);
        
        noise.onended = () => { try { noise.disconnect(); lfo.disconnect(); lowpass.disconnect(); bandpass.disconnect(); lfoGain.disconnect(); masterGain.disconnect(); } catch(e){} };
    }

    playRana(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state !== 'running') return;
        
        // RANA REAL: Oscilador bajo con envolvente rápida para el "rrribit"
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 60 + Math.random() * 20; 
        
        const lfo = this.audioCtx.createOscillator();
        lfo.type = 'triangle'; 
        lfo.frequency.value = 20 + Math.random() * 5; // 20-25 pulsos
        
        const amGain = this.audioCtx.createGain();
        amGain.gain.value = 0; 
        
        const lfoDepth = this.audioCtx.createGain();
        lfoDepth.gain.value = 1.0; 
        lfo.connect(lfoDepth).connect(amGain.gain);
        
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass'; 
        filter.frequency.value = 1000 + Math.random() * 400; // Formante de garganta
        filter.Q.value = 3.0;
        
        const masterGain = this.audioCtx.createGain();

        osc.connect(amGain).connect(filter).connect(masterGain).connect(this.masterGainSFX);
        
        const duracion = 0.3 + Math.random() * 0.2;
        
        masterGain.gain.setValueAtTime(0, tiempoActual);
        masterGain.gain.linearRampToValueAtTime(0.8, tiempoActual + 0.05); 
        masterGain.gain.linearRampToValueAtTime(0.8, tiempoActual + duracion - 0.05);
        masterGain.gain.exponentialRampToValueAtTime(0.001, tiempoActual + duracion);
        
        // Pequeña caída en afinación para el rebote natural
        osc.frequency.exponentialRampToValueAtTime(80 + Math.random() * 30, tiempoActual + duracion);

        osc.start(tiempoActual); lfo.start(tiempoActual);
        osc.stop(tiempoActual + duracion); lfo.stop(tiempoActual + duracion);
        
        osc.onended = () => { try { osc.disconnect(); lfo.disconnect(); amGain.disconnect(); filter.disconnect(); masterGain.disconnect(); lfoDepth.disconnect(); } catch(e){} };
    }

    playRamaSeca(time) {
        if (!this.sfxEnabled || !this.audioCtx || !this.masterGainSFX || this.audioCtx.state !== 'running') return;
        try {
            const osc = this.audioCtx.createOscillator();
            const oscGain = this.audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, time);
            osc.frequency.exponentialRampToValueAtTime(30, time + 0.05);
            
            oscGain.gain.setValueAtTime(0, time);
            oscGain.gain.linearRampToValueAtTime(0.5, time + 0.01);
            oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
            
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.audioCtx.createBiquadFilter();
            const noiseGain = this.audioCtx.createGain();
            
            filter.type = 'bandpass'; 
            filter.frequency.value = 1500; 
            filter.Q.value = 1.5;
            
            noiseGain.gain.setValueAtTime(0, time);
            noiseGain.gain.linearRampToValueAtTime(0.5, time + 0.01);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            
            osc.connect(oscGain).connect(this.masterGainSFX);
            noise.connect(filter).connect(noiseGain).connect(this.masterGainSFX);
            
            osc.start(time); osc.stop(time + 0.15);
            noise.start(time); noise.stop(time + 0.2);
            
            noise.onended = () => { try { osc.disconnect(); oscGain.disconnect(); noise.disconnect(); filter.disconnect(); noiseGain.disconnect(); } catch(e){} };
        } catch(e){}
    }

    playHojasCrujiendo(tiempoActual) {
        if (!this.sfxEnabled || !this.audioCtx || !this.masterGainSFX || this.audioCtx.state !== 'running') return;
        
        const ráfagas = 4 + Math.floor(Math.random() * 4);
        for(let i = 0; i < ráfagas; i++) {
            const t = tiempoActual + (i * 0.08) + (Math.random() * 0.04);
            
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = this.noiseBuffer;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(4000 + Math.random() * 2000, t);
            filter.Q.value = 3;

            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

            noise.connect(filter).connect(gain).connect(this.masterGainSFX);
            noise.start(t);
            noise.stop(t + 0.07);
            
            noise.onended = () => { try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch(e){} };
        }
    }

    // ==========================================
    // SECCIÓN 2: MOTOR MUSICAL GENERATIVO LIGERO
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

    reseedMusicEngine(seedString) {
        let num = 0;
        for (let i = 0; i < seedString.length; i++) num += seedString.charCodeAt(i);
        const possibleRoots = [196.00, 220.00, 261.63, 293.66]; 
        this.rootHz = possibleRoots[num % possibleRoots.length];
    }

    _playZenNote(time) {
        if (!this.audioCtx || this.audioCtx.state !== 'running') return;
        
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain).connect(this.masterMusic);
            
            const ratio = this.scaleRatios[Math.floor(Math.random() * this.scaleRatios.length)];
            const multiplier = Math.random() > 0.8 ? 0.5 : (Math.random() > 0.8 ? 2 : 1);
            
            osc.type = 'sine'; 
            osc.frequency.value = this.rootHz * ratio * multiplier;
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.5); 
            gain.gain.exponentialRampToValueAtTime(0.001, time + 6.0); 
            
            osc.start(time);
            osc.stop(time + 6.5);
            
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        } catch(e) {}
    }

    _zenLoop = () => {
        if (!this.musicEnabled) return;
        
        if (this.audioCtx.state === 'suspended') {
            this.zenTimeoutId = setTimeout(this._zenLoop, 1000);
            return;
        }

        const now = this.audioCtx.currentTime;
        const notesToPlay = Math.floor(Math.random() * 3) + 1;
        
        for(let i = 0; i < notesToPlay; i++) {
            this._playZenNote(now + (i * Math.random() * 0.8));
        }

        const nextDelayMs = 4000 + Math.random() * 8000;
        this.zenTimeoutId = setTimeout(this._zenLoop, nextDelayMs);
    }

    startZenMusic() {
        if (!this.audioCtx) return;
        
        const t = this.audioCtx.currentTime;
        if (this.masterMusic) {
            this.masterMusic.gain.cancelScheduledValues(t);
            this.masterMusic.gain.setTargetAtTime(0.6, t, 1.0); 
        }

        this._zenLoop();
    }

    stopZenMusic() {
        clearTimeout(this.zenTimeoutId);
        if (!this.audioCtx || !this.masterMusic) return;

        const t = this.audioCtx.currentTime;
        this.masterMusic.gain.cancelScheduledValues(t);
        this.masterMusic.gain.setTargetAtTime(0.0, t, 0.5); 
    }
}
