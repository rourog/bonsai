// MotorAudio.js

export class MotorAudio {
    constructor() {
        this.audioCtx = null;
        this.sfxEnabled = false;
        this.musicEnabled = false;
        
        // Nodos persistentes
        this.windGainNode = null;
        this.noiseSource = null;
        
        // Temporizadores para bucles infinitos
        this.musicTimeout = null;
        this.ambientTimeout = null;
        
        // Escala pentatónica expandida a múltiples octavas para mayor riqueza
        this.pentatonicScale = [
            130.81, 146.83, 164.81, 196.00, 220.00, // Graves
            261.63, 293.66, 329.63, 392.00, 440.00, // Medios
            523.25, 587.33, 659.25, 783.99, 880.00  // Agudos
        ];
    }

    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // --- 1. SISTEMA DE VIENTO CONTINUO ---
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
            filter.frequency.value = 600; 
            filter.Q.value = 0.5;

            this.windGainNode = this.audioCtx.createGain();
            this.windGainNode.gain.value = 0;

            this.noiseSource.connect(filter);
            filter.connect(this.windGainNode);
            this.windGainNode.connect(this.audioCtx.destination);
            this.noiseSource.start();
        } catch (e) { console.warn("Error viento:", e); }
    }

    actualizarViento(tiempoViento, intensidadSlider) {
        if (this.sfxEnabled && this.windGainNode && this.audioCtx) {
            try {
                let windIntensity = intensidadSlider / 100;
                let vol = windIntensity * (0.02 + 0.08 * Math.abs(Math.sin(tiempoViento * 1.2)));
                this.windGainNode.gain.setTargetAtTime(vol, this.audioCtx.currentTime, 0.1);
            } catch(e) {}
        }
    }

    // --- 2. SISTEMA DE EVENTOS ESPECÍFICOS (POPS) ---
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

    // --- 3. SÍNTESIS PROCEDURAL DE NATURALEZA (SFX) ---
    playAve() {
        if (!this.sfxEnabled || !this.audioCtx) return;
        try {
            // Un ave hace entre 2 y 4 trinos cortos
            const trinos = Math.floor(Math.random() * 3) + 2; 
            let tiempoActual = this.audioCtx.currentTime;

            for (let i = 0; i < trinos; i++) {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc.type = 'sine';
                const baseFreq = 2000 + Math.random() * 1500; // Frecuencia alta (pájaro)
                
                osc.frequency.setValueAtTime(baseFreq, tiempoActual);
                // El trino sube o baja de tono rápidamente
                const direccion = Math.random() > 0.5 ? 800 : -800; 
                osc.frequency.exponentialRampToValueAtTime(baseFreq + direccion, tiempoActual + 0.1);

                gain.gain.setValueAtTime(0, tiempoActual);
                gain.gain.linearRampToValueAtTime(0.05, tiempoActual + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, tiempoActual + 0.1);

                osc.start(tiempoActual);
                osc.stop(tiempoActual + 0.15);

                // Pequeña pausa entre cada trino
                tiempoActual += 0.1 + Math.random() * 0.1; 
            }
        } catch (e) {}
    }

    playGotaAgua() {
        if (!this.sfxEnabled || !this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.type = 'sine';
            
            // Frecuencia que cae en picada simula el hueco del agua al ser golpeada
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.08);

            gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.05, this.audioCtx.currentTime + 0.01); // Impacto
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1); // Absorción rápida

            osc.start(this.audioCtx.currentTime);
            osc.stop(this.audioCtx.currentTime + 0.15);
        } catch (e) {}
    }

    // El orquestador de SFX decide al azar si canta un ave, cae agua, o hay silencio
    ecosistemaAmbiental = () => {
        if (!this.sfxEnabled) return;
        
        const dado = Math.random();
        if (dado > 0.7) {
            this.playAve();
        } else if (dado > 0.4) {
            this.playGotaAgua();
        }
        
        // Se ejecuta esporádicamente cada 4 a 12 segundos
        this.ambientTimeout = setTimeout(this.ecosistemaAmbiental, 4000 + Math.random() * 8000);
    }

    // --- 4. SÍNTESIS MUSICAL GENERATIVA (Acordes y Arpegios) ---
    ecosistemaMusical = () => {
        if (!this.musicEnabled || !this.audioCtx) return;
        try {
            // Decide si tocará una nota sola (0), un acorde de dos notas (1), o de tres (2)
            const cantidadNotas = Math.floor(Math.random() * 3) + 1; 
            
            // Escoger una nota base de los medios
            const rootIndex = 5 + Math.floor(Math.random() * 5); 
            
            for (let i = 0; i < cantidadNotas; i++) {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                
                // Mezcla de texturas: senoidal para pureza, triangular para calidez analógica
                osc.type = Math.random() > 0.7 ? 'triangle' : 'sine'; 
                
                // Selecciona notas armónicas (saltando índices en la escala para crear intervalos bonitos)
                const freq = this.pentatonicScale[rootIndex + (i * 2)];
                osc.frequency.value = freq;
                
                // Arpegio: Cada nota entra un poquito después de la anterior
                const retrasoEntrada = this.audioCtx.currentTime + (i * (0.3 + Math.random() * 0.4));
                const duracion = 5 + Math.random() * 4;

                gain.gain.setValueAtTime(0, retrasoEntrada);
                // Ataque extremadamente suave
                gain.gain.linearRampToValueAtTime(0.08, retrasoEntrada + 2);
                // Decaimiento natural y prolongado
                gain.gain.exponentialRampToValueAtTime(0.001, retrasoEntrada + duracion);
                
                osc.start(retrasoEntrada);
                osc.stop(retrasoEntrada + duracion + 1);
            }
        } catch (e) {}
        
        // La música respira: los silencios son tan importantes como las notas (3 a 8 segundos)
        this.musicTimeout = setTimeout(this.ecosistemaMusical, 3000 + Math.random() * 5000);
    }

    // --- 5. CONTROLES DE INTERFAZ ---
    
    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        this.initCtx();
        if (this.sfxEnabled) {
            this.initWind();
            this.ecosistemaAmbiental(); // Arranca los sonidos de naturaleza
        } else {
            clearTimeout(this.ambientTimeout);
            if (this.windGainNode && this.audioCtx) {
                try { this.windGainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1); } catch(e){}
            }
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
            clearTimeout(this.musicTimeout); // Evita duplicar el bucle si ya estaba corriendo
            this.ecosistemaMusical();
        }
    }
}
