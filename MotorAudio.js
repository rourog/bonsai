// MotorAudio.js

export class MotorAudio {
    constructor() {
        this.audioCtx = null;
        this.sfxEnabled = false;
        this.musicEnabled = false;
        this.windGainNode = null;
        this.noiseSource = null;
        this.chimeTimeout = null;
        
        // Escala pentatónica clásica
        this.pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];
    }

    // Inicializa el contexto de audio (requerido por los navegadores)
    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // --- SISTEMA DE VIENTO ---
    initWind() {
        if (this.windGainNode || !this.audioCtx) return;
        try {
            const bufferSize = this.audioCtx.sampleRate * 2;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            
            this.noiseSource = this.audioCtx.createBufferSource();
            this.noiseSource.buffer = buffer;
            this.noiseSource.loop = true;
            
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 800; 
            filter.Q.value = 0.5;

            this.windGainNode = this.audioCtx.createGain();
            this.windGainNode.gain.value = 0;

            this.noiseSource.connect(filter);
            filter.connect(this.windGainNode);
            this.windGainNode.connect(this.audioCtx.destination);
            this.noiseSource.start();
        } catch (e) {
            console.warn("Error iniciando viento:", e);
        }
    }

    actualizarViento(tiempoViento, intensidadSlider) {
        if (this.sfxEnabled && this.windGainNode && this.audioCtx) {
            try {
                let windIntensity = intensidadSlider / 100;
                let vol = windIntensity * (0.05 + 0.15 * Math.abs(Math.sin(tiempoViento * 1.5)));
                this.windGainNode.gain.setTargetAtTime(vol, this.audioCtx.currentTime, 0.1);
            } catch(e) {}
        }
    }

    // --- SISTEMA DE EFECTOS (SFX) ---
    playPop() {
        if (!this.sfxEnabled || !this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.type = 'sine';
            
            const freq = 600 + Math.random() * 800; 
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, this.audioCtx.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.04, this.audioCtx.currentTime + 0.01); 
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15); 
            
            osc.start(this.audioCtx.currentTime);
            osc.stop(this.audioCtx.currentTime + 0.15);
        } catch (e) {}
    }

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        this.initCtx();
        if (this.sfxEnabled) {
            this.initWind();
        } else {
            if (this.windGainNode && this.audioCtx) {
                try { this.windGainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1); } catch(e){}
            }
        }
        return this.sfxEnabled;
    }

    // --- SISTEMA DE MÚSICA GENERATIVA ---
    playGenerativeChime = () => {
        // Necesitamos usar función flecha (= () =>) para no perder el contexto de 'this' en el setTimeout
        if (!this.musicEnabled || !this.audioCtx) return;
        try {
            const freq = this.pentatonicScale[Math.floor(Math.random() * this.pentatonicScale.length)] * (Math.random() > 0.5 ? 1 : 0.5);
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.type = 'sine'; 
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, this.audioCtx.currentTime + 2);
            gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 6);
            
            osc.start(this.audioCtx.currentTime);
            osc.stop(this.audioCtx.currentTime + 6);
        } catch (e) {}
        
        this.chimeTimeout = setTimeout(this.playGenerativeChime, Math.random() * 4000 + 2000);
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        this.initCtx();
        if (this.musicEnabled) {
            this.playGenerativeChime();
        } else {
            clearTimeout(this.chimeTimeout);
        }
        return this.musicEnabled;
    }

    stopMusic() {
        clearTimeout(this.chimeTimeout);
    }

    resumeMusic() {
        if (this.musicEnabled) {
            this.playGenerativeChime();
        }
    }
}
