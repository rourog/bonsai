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

// --- NUEVO: ALGORITMO PROCEDURAL DE NUBES CON PARALLAX 3D ---
    generarNubesProcedurales() {
        const contenedorNubes = document.getElementById('generador-nubes');
        if (!contenedorNubes) return;
        
        // Limpiamos nubes anteriores por si el usuario apaga y enciende el cielo
        contenedorNubes.innerHTML = '';
        
        // Genera entre 5 y 8 nubes para un cielo con buena profundidad
        const numeroNubes = 5 + Math.floor(Math.random() * 4);
        
        for(let i = 0; i < numeroNubes; i++) {
            const nube = document.createElement('div');
            nube.className = 'nube procedural';
            
            // 1. LA VARIABLE MAESTRA DE PROFUNDIDAD (0.0 es muy lejos, 1.0 es frente a la cámara)
            const profundidad = Math.random();
            
            // 2. FÍSICAS ATADAS A LA PROFUNDIDAD:
            // Tamaño: Lejos = pequeñas (0.2x), Cerca = enormes (1.2x)
            const escala = 0.2 + (profundidad * 1.0);
            
            // Velocidad: Lejos = cruzan lentísimo (150s), Cerca = cruzan rápido (40s)
            const duracionViaje = 150 - (profundidad * 110);
            
            // Opacidad (Perspectiva Atmosférica): Lejos = tenues (15%), Cerca = densas (70%)
            const opacidadBase = 0.15 + (profundidad * 0.55);
            
            // Z-Index: Las nubes cercanas deben tapar visualmente a las lejanas
            const ordenCapa = Math.floor(profundidad * 10);

            // Altura y esparcimiento en la pantalla
            const alturaY = Math.random() * 45; // 0% a 45% del alto del cielo
            const retrasoInicial = Math.random() * -150; // Para que ya estén flotando al abrir
            
            // Aplicamos las físicas al CSS
            nube.style.top = `${alturaY}%`;
            nube.style.transform = `scale(${escala})`;
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
        
        const cicloSegundos = 120; 

        estilo.innerHTML = `
            #sky-bg {
                background: none !important;
                overflow: hidden;
            }

            .atmosfera-inactiva * {
                animation-play-state: paused !important;
                opacity: 0 !important;
                transition: opacity 1s ease;
            }

            body.bg-sky-active #sky-bg * {
                animation-play-state: running;
            }

            .capa-cielo {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                opacity: 0; z-index: 1;
            }
            body.bg-sky-active .cielo-dia { background: linear-gradient(to bottom, #54b1f5 0%, #e0f2fe 80%); animation: cicloDia ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-atardecer { background: linear-gradient(to bottom, #4c3b71 0%, #f68989 60%, #ffc371 100%); animation: cicloAtardecer ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-noche { background: linear-gradient(to bottom, #0b1320 0%, #1a2a42 100%); animation: cicloNoche ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-amanecer { background: linear-gradient(to bottom, #8ab3d9 0%, #ffb07c 80%); animation: cicloAmanecer ${cicloSegundos}s infinite linear; }

            .capa-estrellas {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2;
                background-image: 
                    radial-gradient(1px 1px at 10% 20%, #fff, rgba(0,0,0,0)),
                    radial-gradient(1px 1px at 30% 60%, #fff, rgba(0,0,0,0)),
                    radial-gradient(2px 2px at 40% 30%, #fff, rgba(0,0,0,0)),
                    radial-gradient(1px 1px at 70% 80%, #fff, rgba(0,0,0,0)),
                    radial-gradient(2px 2px at 80% 10%, #fff, rgba(0,0,0,0)),
                    radial-gradient(1px 1px at 90% 40%, #fff, rgba(0,0,0,0));
                background-size: 200px 200px;
                opacity: 0;
            }
            body.bg-sky-active .capa-estrellas {
                animation: cicloNoche ${cicloSegundos}s infinite linear, parpadeo 4s infinite alternate ease-in-out;
            }

            /* --- FÍSICA CELESTE MEJORADA --- */
            .rueda-celeste {
                position: absolute;
                top: 50%; left: 50%;
                /* Aumentamos enormemente la rueda para que el eje esté lejanísimo */
                width: 150vh; height: 150vh; 
                margin-left: -75vh; 
                margin-top: -25vh; /* Bajamos el eje para que los astros rocen el borde superior */
                border-radius: 50%;
                z-index: 3;
            }
            body.bg-sky-active .rueda-celeste {
                animation: rotacionCeleste ${cicloSegundos}s infinite linear;
            }

            .astro { position: absolute; left: 50%; border-radius: 50%; }
            
            /* SOL: Solo un aura etérea enorme */
            .sol {
                width: 400px; height: 400px;
                margin-left: -200px;
                top: -200px; 
                background: radial-gradient(circle, rgba(255,245,200,0.8) 0%, rgba(255,235,160,0.2) 40%, rgba(255,255,255,0) 70%);
                /* Sin box-shadow duro, todo suave */
            }
            
            /* LUNA: Opacidad controlada por animación */
            .luna {
                width: 60px; height: 60px;
                margin-left: -30px;
                bottom: -30px; 
                background: #f4f6f0;
                box-shadow: 0 0 30px rgba(255, 255, 255, 0.6), inset -10px -10px 15px rgba(0,0,0,0.2);
            }
            body.bg-sky-active .luna {
                animation: opacidadLuna ${cicloSegundos}s infinite linear;
            }

            /* --- CSS PARA NUBES PROCEDURALES --- */
            .capa-nubes { position: absolute; top: 0; left: 0; width: 100%; height: 60%; z-index: 4; }
            .nube.procedural {
                position: absolute; background: white; border-radius: 50px;
                width: 150px; height: 45px;
                filter: blur(5px);
            }
            .nube.procedural::before {
                content: ''; position: absolute; background: white; border-radius: 50%;
                width: 80px; height: 80px; top: -35px; left: 25px;
            }
            .nube.procedural::after {
                content: ''; position: absolute; background: white; border-radius: 50%;
                width: 60px; height: 60px; top: -20px; left: 85px;
            }

            body.bg-sky-active .nube.procedural {
                animation-play-state: running;
            }

            /* --- KEYFRAMES --- */
            @keyframes rotacionCeleste {
                0% { transform: rotate(0deg); }    /* Mediodía */
                25% { transform: rotate(90deg); }  /* Atardecer */
                50% { transform: rotate(180deg); } /* Medianoche */
                75% { transform: rotate(270deg); } /* Amanecer */
                100% { transform: rotate(360deg); }
            }

            /* La luna solo es visible de noche (entre el 35% y 65% de la rotación) */
            @keyframes opacidadLuna {
                0%, 30% { opacity: 0; }
                40%, 60% { opacity: 0.85; }
                70%, 100% { opacity: 0; }
            }

            @keyframes cicloDia {
                0%, 25% { opacity: 1; }
                35%, 85% { opacity: 0; }
                95%, 100% { opacity: 1; }
            }
            @keyframes cicloAtardecer {
                0%, 15% { opacity: 0; }
                25%, 35% { opacity: 1; }
                45%, 100% { opacity: 0; }
            }
            @keyframes cicloNoche {
                0%, 35% { opacity: 0; }
                45%, 75% { opacity: 1; }
                85%, 100% { opacity: 0; }
            }
            @keyframes cicloAmanecer {
                0%, 75% { opacity: 0; }
                85%, 95% { opacity: 1; }
                100% { opacity: 0; }
            }

            @keyframes flotar {
                0% { transform: translateX(-20vw) scale(var(--scale, 1)); }
                100% { transform: translateX(120vw) scale(var(--scale, 1)); }
            }
            @keyframes parpadeo {
                0% { filter: opacity(0.3); }
                100% { filter: opacity(1); }
            }
        `;
        document.head.appendChild(estilo);
    }

    toggleSky() {
        this.skyEnabled = !this.skyEnabled;
        
        if (this.skyEnabled) {
            document.body.classList.add('bg-sky-active');
            this.skyContainer.classList.remove('atmosfera-inactiva'); 
            
            // Regenerar nubes nuevas si se apaga y vuelve a encender para dar frescura
            this.generarNubesProcedurales();
        } else {
            document.body.classList.remove('bg-sky-active');
            setTimeout(() => {
                if(!this.skyEnabled) {
                    this.skyContainer.classList.add('atmosfera-inactiva');
                    // Limpia las nubes para no saturar el DOM cuando está apagado
                    document.getElementById('generador-nubes').innerHTML = ''; 
                }
            }, 1000);
        }
        return this.skyEnabled;
    }
}
