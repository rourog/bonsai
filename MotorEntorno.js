// MotorEntorno.js

export const DICCIONARIO_ENTORNO = {
    macetas: [
        { id: 'estandar', nombre: 'Rectangular' },
        { id: 'redonda', nombre: 'Tazón Suave' },
        { id: 'alta', nombre: 'Alta Cascada' },
        { id: 'plana', nombre: 'Plana Bosque' }
    ],
    esmaltes: [
        { id: '#c05a41', nombre: 'Terracota' },
        { id: '#2c3e50', nombre: 'Azul Cobalto' },
        { id: '#34495e', nombre: 'Negro Mate' },
        { id: '#8c8c91', nombre: 'Gris Concreto' },
        { id: '#458b74', nombre: 'Verde Jade' }
    ]
};

export class MotorEntorno {
    constructor(ctx) {
        this.ctx = ctx; 
        this.skyEnabled = false;
        this.skyContainer = document.getElementById('sky-bg');
        
        this.inyectarEstilosAtmosfericos();
        this.construirCielo();
    }

    renderizarMaceta(forma, color) {
        let svg = '';
        switch(forma) {
            case 'estandar':
                svg = `<rect x="-45" y="0" width="90" height="18" fill="${color}" rx="2"/>
                       <polygon points="-40,18 40,18 30,35 -30,35" fill="${color}" opacity="0.85"/>
                       <rect x="-35" y="35" width="8" height="4" fill="${color}" opacity="0.6"/>
                       <rect x="27" y="35" width="8" height="4" fill="${color}" opacity="0.6"/>`;
                break;
            case 'redonda':
                svg = `<path d="M -50 5 L 50 5 C 50 40 -50 40 -50 5 Z" fill="${color}" opacity="0.9"/>
                       <rect x="-53" y="0" width="106" height="6" fill="${color}" rx="2"/>
                       <rect x="-20" y="30" width="40" height="4" fill="${color}" opacity="0.6"/>`;
                break;
            case 'alta':
                svg = `<polygon points="-35,6 35,6 22,70 -22,70" fill="${color}" opacity="0.85"/>
                       <rect x="-40" y="0" width="80" height="6" fill="${color}" rx="1"/>
                       <rect x="-22" y="70" width="44" height="4" fill="${color}" opacity="0.6"/>`;
                break;
            case 'plana':
                svg = `<rect x="-80" y="0" width="160" height="10" fill="${color}" rx="1"/>
                       <polygon points="-75,10 75,10 70,20 -70,20" fill="${color}" opacity="0.85"/>
                       <rect x="-65" y="20" width="12" height="4" fill="${color}" opacity="0.6"/>
                       <rect x="53" y="20" width="12" height="4" fill="${color}" opacity="0.6"/>`;
                break;
        }
        this.ctx.layerPot.innerHTML = svg;
    }

    construirCielo() {
        if (!this.skyContainer) return;
        
        this.skyContainer.innerHTML = '';
        this.skyContainer.className = 'atmosfera-inactiva'; 

        const htmlAtmosfera = `
            <div class="capa-cielo cielo-dia"></div>
            <div class="capa-cielo cielo-atardecer"></div>
            <div class="capa-cielo cielo-noche"></div>
            <div class="capa-cielo cielo-amanecer"></div>

            <div class="capa-estrellas"></div>
            <div class="capa-nubes" id="generador-nubes"></div>

            <div class="rueda-celeste">
                <div class="astro sol"></div>
                <div class="astro luna"></div>
            </div>
        `;
        
        this.skyContainer.innerHTML = htmlAtmosfera;
        this.generarNubesProcedurales();
    }

    // --- ESCULTOR DE NUBES CÚMULOS (PARALLAX + CAOS MORFOLÓGICO) ---
    generarNubesProcedurales() {
        const contenedorNubes = document.getElementById('generador-nubes');
        if (!contenedorNubes) return;
        
        contenedorNubes.innerHTML = '';
        const numeroNubes = 6 + Math.floor(Math.random() * 5); // 6 a 10 nubes
        
        for(let i = 0; i < numeroNubes; i++) {
            const nube = document.createElement('div');
            nube.className = 'nube procedural';
            
            // FÍSICAS DE PARALLAX
            const profundidad = Math.random(); 
            const escala = 0.2 + (profundidad * 1.5); // Nubes frontales mucho más grandes
            const duracionViaje = 180 - (profundidad * 140); // 40s (rápidas/cerca) a 180s (lentas/lejos)
            const opacidadBase = 0.15 + (profundidad * 0.7); // 15% a 85%
            const ordenCapa = Math.floor(profundidad * 10);
            
            // Posición inicial
            const alturaY = Math.random() * 50; 
            const retrasoInicial = Math.random() * -180; 

            // MORFOLOGÍA LOCA DE LA NUBE
            const anchoNube = 120 + Math.random() * 200; 
            nube.style.width = `${anchoNube}px`;
            nube.style.height = `${anchoNube * 0.8}px`; 
            
            // Más cantidad de círculos y variación extrema de tamaño
            const numPuffs = 5 + Math.floor(Math.random() * 8); 
            let puffsHTML = `<div class="puff base-puff" style="width: 100%; height: 25px; left: 0;"></div>`;

            for(let j = 0; j < numPuffs; j++) {
                // Diámetro caótico (algunos enormes, otros pequeñitos para romper la uniformidad)
                const sizeW = 20 + Math.random() * (anchoNube * 0.7); 
                const sizeH = sizeW * (0.8 + Math.random() * 0.4); // Círculos ligeramente ovalados
                
                const maxLeft = anchoNube - sizeW;
                let leftPos = Math.random() * maxLeft;

                // Estructura base para no dejar huecos en los extremos
                if (j === 0) leftPos = Math.random() * (maxLeft * 0.1);
                if (j === 1) leftPos = maxLeft - (Math.random() * (maxLeft * 0.1));

                puffsHTML += `<div class="puff" style="width: ${sizeW}px; height: ${sizeH}px; left: ${leftPos}px;"></div>`;
            }

            nube.innerHTML = puffsHTML;

            // SOLUCIÓN AL BUG DEL PARALLAX: Pasamos la escala como una Variable CSS (--scale)
            nube.style.setProperty('--scale', escala);
            nube.style.top = `${alturaY}%`;
            nube.style.opacity = opacidadBase;
            nube.style.zIndex = ordenCapa;
            
            // La animación ahora respeta la variable CSS
            nube.style.animation = `flotar ${duracionViaje}s infinite linear ${retrasoInicial}s`;
            
            contenedorNubes.appendChild(nube);
        }
    }

    inyectarEstilosAtmosfericos() {
        if (document.getElementById('css-entorno')) return;

        const estilo = document.createElement('style');
        estilo.id = 'css-entorno';
        const cicloSegundos = 180; // Aumentado a 3 minutos para transiciones más majestuosas

        estilo.innerHTML = `
            #sky-bg { background: none !important; overflow: hidden; }
            .atmosfera-inactiva * { animation-play-state: paused !important; opacity: 0 !important; transition: opacity 1s ease; }
            body.bg-sky-active #sky-bg * { animation-play-state: running; }

            .capa-cielo { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; z-index: 1; }
            
            /* --- COLORES VIBRANTES DE LA VIDA REAL --- */
            body.bg-sky-active .cielo-dia { 
                background: linear-gradient(to bottom, #3b8d99 0%, #6b6b83 40%, #aa4b6b 100%); 
                animation: cicloDia ${cicloSegundos}s infinite linear; 
            }
            body.bg-sky-active .cielo-atardecer { 
                background: linear-gradient(to bottom, #1a1a3a 0%, #4a2b5e 40%, #a23b53 70%, #f67a4b 100%); 
                animation: cicloAtardecer ${cicloSegundos}s infinite linear; 
            }
            body.bg-sky-active .cielo-noche { 
                background: linear-gradient(to bottom, #05070a 0%, #151b29 60%, #1d2b45 100%); 
                animation: cicloNoche ${cicloSegundos}s infinite linear; 
            }
            body.bg-sky-active .cielo-amanecer { 
                background: linear-gradient(to bottom, #2c1b4d 0%, #855988 40%, #e38471 70%, #ffce8e 100%); 
                animation: cicloAmanecer ${cicloSegundos}s infinite linear; 
            }

            .capa-estrellas {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2;
                background-image: 
                    radial-gradient(1px 1px at 10% 20%, #fff, rgba(0,0,0,0)),
                    radial-gradient(1px 1px at 30% 60%, #fff, rgba(0,0,0,0)),
                    radial-gradient(2px 2px at 40% 30%, #fff, rgba(0,0,0,0)),
                    radial-gradient(1px 1px at 70% 80%, #fff, rgba(0,0,0,0)),
                    radial-gradient(2px 2px at 80% 10%, #fff, rgba(0,0,0,0)),
                    radial-gradient(1px 1px at 90% 40%, #fff, rgba(0,0,0,0));
                background-size: 200px 200px; opacity: 0;
            }
            body.bg-sky-active .capa-estrellas { animation: cicloNoche ${cicloSegundos}s infinite linear, parpadeo 4s infinite alternate ease-in-out; }

            /* --- RUEDA CELESTE GIGANTE (VMAX) --- */
            .rueda-celeste { 
                position: absolute; 
                top: 50%; left: 50%; 
                width: 120vmax; height: 120vmax; 
                margin-left: -60vmax; 
                margin-top: -35vmax; /* Eje ligeramente por debajo del centro para aplanar el arco */
                border-radius: 50%; z-index: 3; 
            }
            body.bg-sky-active .rueda-celeste { animation: rotacionCeleste ${cicloSegundos}s infinite linear; }

            .astro { position: absolute; left: 50%; border-radius: 50%; }
            
            /* Sol etéreo */
            .sol { 
                width: 500px; height: 500px; 
                margin-left: -250px; top: -250px; 
                background: radial-gradient(circle, rgba(255,245,200,0.9) 0%, rgba(255,235,160,0.3) 30%, rgba(255,200,100,0.1) 50%, rgba(255,255,255,0) 70%); 
            }
            
            /* Luna fantasmal */
            .luna { 
                width: 80px; height: 80px; 
                margin-left: -40px; bottom: -40px; 
                background: #f4f6f0; 
                box-shadow: 0 0 50px rgba(255, 255, 255, 0.5), inset -12px -12px 18px rgba(0,0,0,0.2); 
            }
            body.bg-sky-active .luna { animation: opacidadLuna ${cicloSegundos}s infinite linear; }

            /* --- NUBES --- */
            .capa-nubes { position: absolute; top: 0; left: 0; width: 100%; height: 70%; z-index: 4; }
            
            .nube.procedural {
                position: absolute;
                filter: blur(5px); 
                /* Se elimina el transform fijo aquí, la animación toma el control usando var(--scale) */
            }
            
            .puff {
                position: absolute;
                background: white;
                border-radius: 50%;
                bottom: 0; 
            }
            
            .base-puff { border-radius: 15px !important; }

            body.bg-sky-active .nube.procedural { animation-play-state: running; }

            /* --- KEYFRAMES --- */
            @keyframes rotacionCeleste { 0% { transform: rotate(0deg); } 25% { transform: rotate(90deg); } 50% { transform: rotate(180deg); } 75% { transform: rotate(270deg); } 100% { transform: rotate(360deg); } }
            @keyframes opacidadLuna { 0%, 35% { opacity: 0; } 45%, 55% { opacity: 0.9; } 65%, 100% { opacity: 0; } }
            
            @keyframes cicloDia { 0%, 25% { opacity: 1; } 35%, 85% { opacity: 0; } 95%, 100% { opacity: 1; } }
            @keyframes cicloAtardecer { 0%, 15% { opacity: 0; } 25%, 35% { opacity: 1; } 45%, 100% { opacity: 0; } }
            @keyframes cicloNoche { 0%, 35% { opacity: 0; } 45%, 75% { opacity: 1; } 85%, 100% { opacity: 0; } }
            @keyframes cicloAmanecer { 0%, 75% { opacity: 0; } 85%, 95% { opacity: 1; } 100% { opacity: 0; } }

            /* EL TRUCO MAESTRO: Transform lee la variable inyectada por JS */
            @keyframes flotar {
                0% { transform: translateX(-30vw) scale(var(--scale, 1)); }
                100% { transform: translateX(120vw) scale(var(--scale, 1)); }
            }
            
            @keyframes parpadeo { 0% { filter: opacity(0.3); } 100% { filter: opacity(1); } }
        `;
        document.head.appendChild(estilo);
    }

    toggleSky() {
        this.skyEnabled = !this.skyEnabled;
        
        if (this.skyEnabled) {
            document.body.classList.add('bg-sky-active');
            this.skyContainer.classList.remove('atmosfera-inactiva'); 
            this.generarNubesProcedurales();
        } else {
            document.body.classList.remove('bg-sky-active');
            setTimeout(() => {
                if(!this.skyEnabled) {
                    this.skyContainer.classList.add('atmosfera-inactiva');
                    document.getElementById('generador-nubes').innerHTML = ''; 
                }
            }, 1000);
        }
        return this.skyEnabled;
    }
}
