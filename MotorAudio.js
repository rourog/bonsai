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
        this.rootHz = 220.0; // Tonalidad base (A3)
        // Escala Pentatónica (Siempre suena armónica y relajante)
        this.scaleRatios = [1, 9/8, 5/4, 3/2, 5/3, 2, 9/4]; 
    }

    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Canal de SFX
            this.masterGainSFX = this.audioCtx.createGain();
            this.masterGainSFX.connect(this.audioCtx.destination);
            this.masterGainSFX.gain.value = 0.5;
            
            // Canal de Música
            this.masterMusic = this.audioCtx.createGain();
            this.masterMusic.connect(this.audioCtx.destination);
            this.masterMusic.gain.value = 0.6; // Volumen general de la música

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
        
        if (dado > 0.90) this.playCarpintero(tiempo);
        else if (dado > 0.75) {
            this.playCampanaViento(tiempo);
            if(Math.random() > 0.5) this.playCampanaViento(tiempo + 0.2); 
        } else if (dado > 0.60) this.playAve(tiempo);
        else if (dado > 0.45) this.playPezSplash(tiempo);
        else if (dado > 0.30) this.playRamaSeca(tiempo);
        
        this.ambientTimeout = setTimeout(this.ecosistemaAmbiental, 3000 + Math.random() * 7000);
    }

    playCarpintero(tiempoActual) {
        if (!this.sfxEnabled || !this.masterGainSFX || this.audioCtx.state === 'suspended') return;
        const golpes = 6 + Math.floor(Math.random() * 5);
        for(let i=0; i<golpes; i++) {
            const noise = this.crearFuenteRuido();
            const filtro = this.audioCtx.createBiquadFilter();
            filtro.type = 'bandpass'; 
            filtro.frequency.value = 800 + (Math.random() * 200); 
            filtro.Q.value = 3; 
            
            const gain = this.audioCtx.createGain();
            noise.connect(filtro).connect(gain).connect(this.masterGainSFX);
            const t = tiempoActual + (i * 0.06); 
            gain.gain.setValueAtTime(0, t);
            
            gain.gain.linearRampToValueAtTime(0.12, t + 0.005); 
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03); 
            
            noise.stop(t + 0.05);
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
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(400, tiempoActual); 
        osc.frequency.exponentialRampToValueAtTime(150, tiempoActual + 0.15); 
        gainBloop.gain.setValueAtTime(0, tiempoActual); 
        gainBloop.gain.linearRampToValueAtTime(0.3, tiempoActual + 0.02); 
        gainBloop.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 0.25);
        osc.connect(gainBloop).connect(this.masterGainSFX);

        const noise = this.crearFuenteRuido();
        const filtroNoise = this.audioCtx.createBiquadFilter();
        filtroNoise.type = 'bandpass'; 
        filtroNoise.frequency.value = 1200; 
        const gainNoise = this.audioCtx.createGain();
        gainNoise.gain.setValueAtTime(0, tiempoActual); 
        gainNoise.gain.linearRampToValueAtTime(0.1, tiempoActual + 0.02); 
        gainNoise.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 0.2);
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
            
            filter.type = 'bandpass'; 
            filter.frequency.value = 1000 + Math.random() * 2000; 
            filter.Q.value = 2;
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.08, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            
            osc.connect(filter).connect(gain).connect(this.masterGainSFX);
            osc.start(time); osc.stop(time + 0.2);
            osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch(e){} };
        } catch(e){}
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
            gain.gain.linearRampToValueAtTime(0.06, time + 0.01); 
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15); 
            
            osc.start(time); osc.stop(time + 0.15);
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        } catch (e) {}
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
        // La semilla define la tonalidad del árbol
        let num = 0;
        for (let i = 0; i < seedString.length; i++) num += seedString.charCodeAt(i);
        // Tonalidades relajantes (G3, A3, C4, D4)
        const possibleRoots = [196.00, 220.00, 261.63, 293.66]; 
        this.rootHz = possibleRoots[num % possibleRoots.length];
    }

    // Toca una nota pura con un eco simulado muy largo
    _playZenNote(time) {
        if (!this.audioCtx || this.audioCtx.state !== 'running') return;
        
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain).connect(this.masterMusic);
            
            // Selección aleatoria dentro de la escala pentatónica
            const ratio = this.scaleRatios[Math.floor(Math.random() * this.scaleRatios.length)];
            // Ocasionalmente subimos o bajamos una octava
            const multiplier = Math.random() > 0.8 ? 0.5 : (Math.random() > 0.8 ? 2 : 1);
            
            osc.type = 'sine'; // Onda pura, cero coste de CPU
            osc.frequency.value = this.rootHz * ratio * multiplier;
            
            // Simulación de "Cuenco" o "Campana" (Ataque suave, caída larguísima)
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.5); // Sube suavemente
            gain.gain.exponentialRampToValueAtTime(0.001, time + 6.0); // Eco de 6 segundos
            
            osc.start(time);
            osc.stop(time + 6.5);
            
            // Limpieza inmediata al terminar el eco
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        } catch(e) {}
    }

    _zenLoop = () => {
        if (!this.musicEnabled) return;
        
        if (this.audioCtx.state === 'suspended') {
            this.zenTimeoutId = setTimeout(this._zenLoop, 1000);
            return;
        }

        // Tocamos de 1 a 3 notas casi al mismo tiempo (como un arpegio muy abierto)
        const now = this.audioCtx.currentTime;
        const notesToPlay = Math.floor(Math.random() * 3) + 1;
        
        for(let i = 0; i < notesToPlay; i++) {
            // Separadas por fracciones de segundo
            this._playZenNote(now + (i * Math.random() * 0.8));
        }

        // El siguiente evento musical ocurrirá entre 4 y 12 segundos después
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

        // Inicia el bucle infinito
        this._zenLoop();
    }

    stopZenMusic() {
        clearTimeout(this.zenTimeoutId);
        if (!this.audioCtx || !this.masterMusic) return;

        const t = this.audioCtx.currentTime;
        this.masterMusic.gain.cancelScheduledValues(t);
        this.masterMusic.gain.setTargetAtTime(0.0, t, 0.5); // Apaga suavemente
    }
}
