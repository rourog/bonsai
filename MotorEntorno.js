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
    ],
    // NUEVO: Paletas de gradientes para los diferentes climas
    climas: [
        {
            id: 'magico', // El atardecer espectacular original
            dia: 'linear-gradient(to bottom, #3b8d99 0%, #6b6b83 40%, #aa4b6b 100%)',
            atardecer: 'linear-gradient(to bottom, #1a1a3a 0%, #4a2b5e 40%, #a23b53 70%, #f67a4b 100%)',
            noche: 'linear-gradient(to bottom, #05070a 0%, #151b29 60%, #1d2b45 100%)',
            amanecer: 'linear-gradient(to bottom, #2c1b4d 0%, #855988 40%, #e38471 70%, #ffce8e 100%)'
        },
        {
            id: 'despejado', // Cielos azules claros y vibrantes
            dia: 'linear-gradient(to bottom, #4a90e2 0%, #7ab8f5 50%, #cde4f7 100%)',
            atardecer: 'linear-gradient(to bottom, #2980b9 0%, #6dd5ed 50%, #f1c40f 100%)',
            noche: 'linear-gradient(to bottom, #0b162c 0%, #1a2a42 60%, #2d4b73 100%)',
            amanecer: 'linear-gradient(to bottom, #1f3c5e 0%, #7ab8f5 50%, #f1c40f 100%)'
        },
        {
            id: 'nublado', // Tonos grises y melancólicos
            dia: 'linear-gradient(to bottom, #7f8c8d 0%, #95a5a6 50%, #bdc3c7 100%)',
            atardecer: 'linear-gradient(to bottom, #34495e 0%, #7f8c8d 50%, #95a5a6 100%)',
            noche: 'linear-gradient(to bottom, #111111 0%, #1a1a1a 60%, #2c3e50 100%)',
            amanecer: 'linear-gradient(to bottom, #2c3e50 0%, #7f8c8d 50%, #bdc3c7 100%)'
        },
        {
            id: 'frio', // Mañanas heladas, azules pálidos
            dia: 'linear-gradient(to bottom, #aab7b8 0%, #c5eff7 50%, #e4f1fe 100%)',
            atardecer: 'linear-gradient(to bottom, #3e5151 0%, #decba4 50%, #e4f1fe 100%)',
            noche: 'linear-gradient(to bottom, #000428 0%, #004e92 100%)',
            amanecer: 'linear-gradient(to bottom, #141e30 0%, #243b55 50%, #c5eff7 100%)'
        },
        {
            id: 'calido', // Tonos sepia, naranjas intensos
            dia: 'linear-gradient(to bottom, #e67e22 0%, #f39c12 50%, #f8e5a3 100%)',
            atardecer: 'linear-gradient(to bottom, #d35400 0%, #e74c3c 50%, #c0392b 100%)',
            noche: 'linear-gradient(to bottom, #2c3e50 0%, #34495e 100%)',
            amanecer: 'linear-gradient(to bottom, #c0392b 0%, #e67e22 50%, #f1c40f 100%)'
        }
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
            <div class="capa-cielo cielo-dia" id="cielo-dia"></div>
            <div class="capa-cielo cielo-atardecer" id="cielo-atardecer"></div>
            <div class="capa-cielo cielo-noche" id="cielo-noche"></div>
            <div class="capa-cielo cielo-amanecer" id="cielo-amanecer"></div>

            <div class="capa-estrellas" id="generador-estrellas"></div>
            <div class="capa-nubes" id="generador-nubes"></div>

            <div class="rueda-celeste">
                <div class="astro sol"></div>
                <div class="astro luna"></div>
            </div>
        `;
        
        this.skyContainer.innerHTML = htmlAtmosfera;
        this.generarNubesProcedurales();
        this.generarEstrellasProcedurales();
        this.asignarClimaAleatorio();
    }

    // --- NUEVO: ASIGNACIÓN DE CLIMA ---
    asignarClimaAleatorio() {
        if (!this.skyContainer) return;
        const clima = DICCIONARIO_ENTORNO.climas[Math.floor(Math.random() * DICCIONARIO_ENTORNO.climas.length)];
        
        document.getElementById('cielo-dia').style.background = clima.dia;
        document.getElementById('cielo-atardecer').style.background = clima.atardecer;
        document.getElementById('cielo-noche').style.background = clima.noche;
        document.getElementById('cielo-amanecer').style.background = clima.amanecer;
    }

    // --- NUEVO: ESTRELLAS PROCEDURALES ---
    generarEstrellasProcedurales() {
        const contenedorEstrellas = document.getElementById('generador-estrellas');
        if (!contenedorEstrellas) return;

        contenedorEstrellas.innerHTML = '';
        const numEstrellas = 150; // Cantidad de estrellas generadas
        let estrellasHTML = '';

        for(let i = 0; i < numEstrellas; i++) {
            // Posición X aleatoria (0 a 100vw)
            let x = Math.random() * 100;
            // Posición Y usando Math.pow para concentrarlas arriba y hacerlas escasas abajo
            let y = Math.pow(Math.random(), 1.8) * 100; 
            
            // Variación sutil de tamaño y brillo
            let size = 0.5 + Math.random() * 1.8; 
            let op = 0.2 + Math.random() * 0.8;

            estrellasHTML += `<div style="
                position: absolute; 
                left: ${x}vw; 
                top: ${y}vh; 
                width: ${size}px; 
                height: ${size}px; 
                background: #ffffff; 
                opacity: ${op}; 
                border-radius: 50%;
                box-shadow: 0 0 ${size}px rgba(255,255,255,0.8);
            "></div>`;
        }
        contenedorEstrellas.innerHTML = estrellasHTML;
    }

    // --- ESCULTOR DE NUBES CÚMULOS (PARALLAX CORREGIDO) ---
    generarNubesProcedurales() {
        const contenedorNubes = document.getElementById('generador-nubes');
        if (!contenedorNubes) return;
        
        contenedorNubes.innerHTML = '';
        const numeroNubes = 6 + Math.floor(Math.random() * 5); // 6 a 10 nubes
        
        for(let i = 0; i < numeroNubes; i++) {
            const nube = document.createElement('div');
            nube.className = 'nube procedural';
            
            // FÍSICAS DE PARALLAX (CORREGIDAS PARA REDUCIR ZOOM)
            const profundidad = Math.random(); 
            // Escala drásticamente reducida. Ahora van de 0.15x a 0.65x
            const escala = 0.15 + (profundidad * 0.5); 
            const duracionViaje = 180 - (profundidad * 140); 
            const opacidadBase = 0.15 + (profundidad * 0.7); 
            const ordenCapa = Math.floor(profundidad * 10);
            
            const alturaY = Math.random() * 50; 
            const retrasoInicial = Math.random() * -180; 

            // MORFOLOGÍA LOCA DE LA NUBE (TAMAÑO BASE REDUCIDO)
            const anchoNube = 60 + Math.random() * 100; // Base más pequeña
            nube.style.width = `${anchoNube}px`;
            nube.style.height = `${anchoNube * 0.8}px`; 
            
            const numPuffs = 4 + Math.floor(Math.random() * 6); 
            let puffsHTML = `<div class="puff base-puff" style="width: 100%; height: 25px; left: 0;"></div>`;

            for(let j = 0; j < numPuffs; j++) {
                const sizeW = 20 + Math.random() * (anchoNube * 0.7); 
                const sizeH = sizeW * (0.8 + Math.random() * 0.4); 
                
                const maxLeft = anchoNube - sizeW;
                let leftPos = Math.random() * maxLeft;

                if (j === 0) leftPos = Math.random() * (maxLeft * 0.1);
                if (j === 1) leftPos = maxLeft - (Math.random() * (maxLeft * 0.1));

                puffsHTML += `<div class="puff" style="width: ${sizeW}px; height: ${sizeH}px; left: ${leftPos}px;"></div>`;
            }

            nube.innerHTML = puffsHTML;

            nube.style.setProperty('--scale', escala);
            nube.style.top = `${alturaY}%`;
            nube.style.opacity = opacidadBase;
            nube.style.zIndex = ordenCapa;
            
            nube.style.animation = `flotar ${duracionViaje}s infinite linear ${retrasoInicial}s`;
            
            contenedorNubes.appendChild(nube);
        }
    }

    inyectarEstilosAtmosfericos() {
        if (document.getElementById('css-entorno')) return;

        const estilo = document.createElement('style');
        estilo.id = 'css-entorno';
        const cicloSegundos = 180; 

        estilo.innerHTML = `
            #sky-bg { background: none !important; overflow: hidden; }
            .atmosfera-inactiva * { animation-play-state: paused !important; opacity: 0 !important; transition: opacity 1s ease; }
            body.bg-sky-active #sky-bg * { animation-play-state: running; }

            .capa-cielo { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; z-index: 1; transition: background 2s ease; }
            
            /* Animaciones controlan la opacidad, el JS inyecta los colores */
            body.bg-sky-active .cielo-dia { animation: cicloDia ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-atardecer { animation: cicloAtardecer ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-noche { animation: cicloNoche ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-amanecer { animation: cicloAmanecer ${cicloSegundos}s infinite linear; }

            /* ESTRELLAS PROCEDURALES */
            .capa-estrellas {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; opacity: 0;
            }
            body.bg-sky-active .capa-estrellas { animation: cicloNoche ${cicloSegundos}s infinite linear, parpadeo 4s infinite alternate ease-in-out; }

            /* --- RUEDA CELESTE GIGANTE (VMAX) --- */
            .rueda-celeste { 
                position: absolute; 
                top: 50%; left: 50%; 
                width: 120vmax; height: 120vmax; 
                margin-left: -60vmax; 
                margin-top: -35vmax; 
                border-radius: 50%; z-index: 3; 
            }
            body.bg-sky-active .rueda-celeste { animation: rotacionCeleste ${cicloSegundos}s infinite linear; }

            .astro { position: absolute; left: 50%; border-radius: 50%; }
            
            .sol { 
                width: 500px; height: 500px; 
                margin-left: -250px; top: -250px; 
                background: radial-gradient(circle, rgba(255,245,200,0.9) 0%, rgba(255,235,160,0.3) 30%, rgba(255,200,100,0.1) 50%, rgba(255,255,255,0) 70%); 
            }
            
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
            
            // Cada vez que encendemos el cielo, elegimos un clima nuevo y regeneramos el entorno
            this.asignarClimaAleatorio();
            this.generarNubesProcedurales();
            this.generarEstrellasProcedurales();
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
