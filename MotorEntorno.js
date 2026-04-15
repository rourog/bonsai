// MotorAudio.js

export class MotorAudio {
    constructor() {
        this.audioCtx = null;
        this.sfxEnabled = false;
        this.musicEnabled = false;
        
        this.windGainNode = null;
        this.leavesGainNode = null;
        this.cricketGainNode = null;
        this.noiseBuffer = null;
        
        this.musicTimeout = null;
        this.ambientTimeout = null;
        
        this.pentatonicScale = [
            130.81, 146.83, 164.81, 196.00, 220.00,
            261.63, 293.66, 329.63, 392.00, 440.00,
            523.25, 587.33, 659.25, 783.99, 880.00
        ];

        this.chimeNotes = [1200, 1500, 1800, 2100, 2600, 3200];
    }

    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
            const filtroViento = this.audioCtx.createBiquadFilter();
            filtroViento.type = 'lowpass';
            filtroViento.frequency.value = 400;
            this.windGainNode = this.audioCtx.createGain();
            this.windGainNode.gain.value = 0;
            sourceViento.connect(filtroViento).connect(this.windGainNode).connect(this.audioCtx.destination);

            const sourceHojas = this.crearFuenteRuido();
            const filtroHojas = this.audioCtx.createBiquadFilter();
            filtroHojas.type = 'bandpass';
            filtroHojas.frequency.value = 3500;
            filtroHojas.Q.value = 1.5;
            this.leavesGainNode = this.audioCtx.createGain();
            this.leavesGainNode.gain.value = 0;
            sourceHojas.connect(filtroHojas).connect(this.leavesGainNode).connect(this.audioCtx.destination);

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

            grilloOsc.connect(tremoloGain).connect(this.cricketGainNode).connect(this.audioCtx.destination);
            grilloOsc.start();
            tremolo.start();

        } catch (e) { }
    }

    actualizarViento(tiempoViento, intensidadSlider) {
        if (this.sfxEnabled && this.windGainNode && this.audioCtx) {
            try {
                let windIntensity = intensidadSlider / 100;
                
                let volViento = windIntensity * (0.05 + 0.1 * Math.abs(Math.sin(tiempoViento * 1.2)));
                this.windGainNode.gain.setTargetAtTime(volViento, this.audioCtx.currentTime, 0.1);

                let volHojas = windIntensity * (0.02 + 0.08 * Math.abs(Math.sin(tiempoViento * 3.5)));
                this.leavesGainNode.gain.setTargetAtTime(volHojas, this.audioCtx.currentTime, 0.1);

                let volGrillos = (1.0 - windIntensity) * 0.02;
                volGrillos *= (0.5 + 0.5 * Math.sin(tiempoViento * 0.2)); 
                this.cricketGainNode.gain.setTargetAtTime(volGrillos, this.audioCtx.currentTime, 0.5);

            } catch(e) {}
        }
    }

    playCarpintero(tiempoActual) {
        const golpes = 6 + Math.floor(Math.random() * 5);
        for(let i=0; i<golpes; i++) {
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filtro = this.audioCtx.createBiquadFilter();
            filtro.type = 'bandpass';
            filtro.frequency.value = 1200; 
            
            const gain = this.audioCtx.createGain();
            noise.connect(filtro).connect(gain).connect(this.audioCtx.destination);
            
            const t = tiempoActual + (i * 0.06); 
            gain.gain.setValueAtTime(0, t);
            // VOLUMEN SUBIDO a 0.6
            gain.gain.linearRampToValueAtTime(0.6, t + 0.005); 
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03); 
            
            noise.start(t);
            noise.stop(t + 0.05);
        }
    }

    playRamaSeca(tiempoActual) {
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        const filtro = this.audioCtx.createBiquadFilter();
        filtro.type = 'highpass';
        filtro.frequency.value = 1500;
        
        const gain = this.audioCtx.createGain();
        noise.connect(filtro).connect(gain).connect(this.audioCtx.destination);
        
        gain.gain.setValueAtTime(0, tiempoActual);
        // VOLUMEN SUBIDO a 0.5
        gain.gain.linearRampToValueAtTime(0.5, tiempoActual + 0.01); 
        gain.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 0.15); 
        
        noise.start(tiempoActual);
        noise.stop(tiempoActual + 0.2);
    }

    playCampanaViento(tiempoActual) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain).connect(this.audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = this.chimeNotes[Math.floor(Math.random() * this.chimeNotes.length)];
        
        gain.gain.setValueAtTime(0, tiempoActual);
        // VOLUMEN SUBIDO a 0.2
        gain.gain.linearRampToValueAtTime(0.2, tiempoActual + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 4.0); 
        
        osc.start(tiempoActual);
        osc.stop(tiempoActual + 4.5);
    }

    playPezSplash(tiempoActual) {
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        const filtro = this.audioCtx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.setValueAtTime(800, tiempoActual);
        filtro.frequency.exponentialRampToValueAtTime(100, tiempoActual + 0.3); 
        
        const gain = this.audioCtx.createGain();
        noise.connect(filtro).connect(gain).connect(this.audioCtx.destination);
        
        gain.gain.setValueAtTime(0, tiempoActual);
        // VOLUMEN SUBIDO a 0.5
        gain.gain.linearRampToValueAtTime(0.5, tiempoActual + 0.05); 
        gain.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 0.4);
        
        noise.start(tiempoActual);
        noise.stop(tiempoActual + 0.5);
    }

    playAve(tiempoActual) {
        const trinos = Math.floor(Math.random() * 3) + 2; 
        let t = tiempoActual;
        for (let i = 0; i < trinos; i++) {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain).connect(this.audioCtx.destination);

            osc.type = 'sine';
            const baseFreq = 2000 + Math.random() * 1500; 
            osc.frequency.setValueAtTime(baseFreq, t);
            const direccion = Math.random() > 0.5 ? 800 : -800; 
            osc.frequency.exponentialRampToValueAtTime(baseFreq + direccion, t + 0.1);

            gain.gain.setValueAtTime(0, t);
            // VOLUMEN SUBIDO a 0.2
            gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

            osc.start(t);
            osc.stop(t + 0.15);
            t += 0.1 + Math.random() * 0.1; 
        }
    }

    ecosistemaAmbiental = () => {
        if (!this.sfxEnabled || !this.audioCtx) return;
        
        const dado = Math.random();
        const tiempo = this.audioCtx.currentTime;

        if (dado > 0.90) {
            this.playCarpintero(tiempo);
        } else if (dado > 0.75) {
            this.playCampanaViento(tiempo);
            if(Math.random() > 0.5) this.playCampanaViento(tiempo + 0.2); 
        } else if (dado > 0.60) {
            this.playAve(tiempo);
        } else if (dado > 0.45) {
            this.playPezSplash(tiempo);
        } else if (dado > 0.30) {
            this.playRamaSeca(tiempo);
        }
        
        this.ambientTimeout = setTimeout(this.ecosistemaAmbiental, 3000 + Math.random() * 7000);
    }

    ecosistemaMusical = () => {
        if (!this.musicEnabled || !this.audioCtx) return;
        try {
            const cantidadNotas = Math.floor(Math.random() * 3) + 1; 
            const rootIndex = 5 + Math.floor(Math.random() * 5); 
            
            for (let i = 0; i < cantidadNotas; i++) {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.connect(gain).connect(this.audioCtx.destination);
                
                osc.type = Math.random() > 0.7 ? 'triangle' : 'sine'; 
                const freq = this.pentatonicScale[rootIndex + (i * 2)];
                osc.frequency.value = freq;
                
                const retrasoEntrada = this.audioCtx.currentTime + (i * (0.3 + Math.random() * 0.4));
                const duracion = 5 + Math.random() * 4;

                gain.gain.setValueAtTime(0, retrasoEntrada);
                gain.gain.linearRampToValueAtTime(0.08, retrasoEntrada + 2);
                gain.gain.exponentialRampToValueAtTime(0.001, retrasoEntrada + duracion);
                
                osc.start(retrasoEntrada);
                osc.stop(retrasoEntrada + duracion + 1);
            }
        } catch (e) {}
        this.musicTimeout = setTimeout(this.ecosistemaMusical, 4000 + Math.random() * 6000);
    }

    playPop() {
        if (!this.sfxEnabled || !this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain).connect(this.audioCtx.destination);
            
            osc.type = 'sine';
            const freq = 600 + Math.random() * 800; 
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, this.audioCtx.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.08, this.audioCtx.currentTime + 0.01); 
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15); 
            
            osc.start(this.audioCtx.currentTime);
            osc.stop(this.audioCtx.currentTime + 0.15);
        } catch (e) {}
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

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        this.initCtx();
        if (this.musicEnabled) {
            this.ecosistemaMusical();
        } else {
            clearTimeout(this.musicTimeout);
        }
        return this.musicEnabled;
    }

    stopMusic() {
        clearTimeout(this.musicTimeout);
    }

    resumeMusic() {
        if (this.musicEnabled) {
            clearTimeout(this.musicTimeout); 
            this.ecosistemaMusical();
        }
    }
}
