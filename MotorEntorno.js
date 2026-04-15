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
            <div class="capa-nubes">
                <div class="nube n1"></div>
                <div class="nube n2"></div>
                <div class="nube n3"></div>
            </div>
            <div class="rueda-celeste">
                <div class="astro sol"></div>
                <div class="astro luna"></div>
            </div>
        `;
        this.skyContainer.innerHTML = htmlAtmosfera;
    }

    inyectarEstilosAtmosfericos() {
        if (document.getElementById('css-entorno')) return;

        const estilo = document.createElement('style');
        estilo.id = 'css-entorno';
        const cicloSegundos = 120; 

        estilo.innerHTML = `
            #sky-bg { background: none !important; overflow: hidden; }
            .atmosfera-inactiva * { animation-play-state: paused !important; opacity: 0 !important; transition: opacity 1s ease; }
            body.bg-sky-active #sky-bg * { animation-play-state: running; }

            .capa-cielo { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; z-index: 1; }
            body.bg-sky-active .cielo-dia { background: linear-gradient(to bottom, #54b1f5 0%, #e0f2fe 80%); animation: cicloDia ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-atardecer { background: linear-gradient(to bottom, #4c3b71 0%, #f68989 60%, #ffc371 100%); animation: cicloAtardecer ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-noche { background: linear-gradient(to bottom, #0b1320 0%, #1a2a42 100%); animation: cicloNoche ${cicloSegundos}s infinite linear; }
            body.bg-sky-active .cielo-amanecer { background: linear-gradient(to bottom, #8ab3d9 0%, #ffb07c 80%); animation: cicloAmanecer ${cicloSegundos}s infinite linear; }

            .capa-estrellas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; background-image: radial-gradient(1px 1px at 10% 20%, #fff, rgba(0,0,0,0)), radial-gradient(1px 1px at 30% 60%, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 40% 30%, #fff, rgba(0,0,0,0)), radial-gradient(1px 1px at 70% 80%, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 80% 10%, #fff, rgba(0,0,0,0)), radial-gradient(1px 1px at 90% 40%, #fff, rgba(0,0,0,0)); background-size: 200px 200px; opacity: 0; }
            body.bg-sky-active .capa-estrellas { animation: cicloNoche ${cicloSegundos}s infinite linear, parpadeo 4s infinite alternate ease-in-out; }

            .rueda-celeste { position: absolute; top: 50%; left: 50%; width: 100vh; height: 100vh; margin-left: -50vh; margin-top: -30vh; border-radius: 50%; z-index: 3; }
            body.bg-sky-active .rueda-celeste { animation: rotacionCeleste ${cicloSegundos}s infinite linear; }

            .astro { position: absolute; width: 80px; height: 80px; border-radius: 50%; left: 50%; margin-left: -40px; }
            .sol { top: -40px; background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,235,160,0.8) 40%, rgba(255,255,255,0) 70%); box-shadow: 0 0 60px rgba(255, 235, 160, 0.6); }
            .luna { bottom: -40px; background: #f4f6f0; box-shadow: 0 0 40px rgba(255, 255, 255, 0.4), inset -10px -10px 15px rgba(0,0,0,0.2); }

            .capa-nubes { position: absolute; top: 0; left: 0; width: 100%; height: 50%; z-index: 4; }
            .nube { position: absolute; background: white; border-radius: 50px; filter: blur(4px); opacity: 0.6; }
            .nube::before, .nube::after { content: ''; position: absolute; background: white; border-radius: 50%; }
            .n1 { width: 120px; height: 40px; top: 20%; left: -150px; animation: flotar 45s infinite linear; }
            .n1::before { width: 60px; height: 60px; top: -30px; left: 20px; }
            .n2 { width: 180px; height: 50px; top: 40%; left: -200px; animation: flotar 65s infinite linear 15s; opacity: 0.4; }
            .n2::before { width: 80px; height: 80px; top: -40px; left: 30px; }
            .n2::after { width: 60px; height: 60px; top: -20px; left: 90px; }
            .n3 { width: 90px; height: 30px; top: 10%; left: -100px; animation: flotar 35s infinite linear 5s; opacity: 0.5; }
            .n3::before { width: 40px; height: 40px; top: -20px; left: 15px; }

            body.bg-sky-active .nube { animation-play-state: running; }

            @keyframes rotacionCeleste { 0% { transform: rotate(0deg); } 25% { transform: rotate(90deg); } 50% { transform: rotate(180deg); } 75% { transform: rotate(270deg); } 100% { transform: rotate(360deg); } }
            @keyframes cicloDia { 0%, 25% { opacity: 1; } 35%, 85% { opacity: 0; } 95%, 100% { opacity: 1; } }
            @keyframes cicloAtardecer { 0%, 15% { opacity: 0; } 25%, 35% { opacity: 1; } 45%, 100% { opacity: 0; } }
            @keyframes cicloNoche { 0%, 35% { opacity: 0; } 45%, 75% { opacity: 1; } 85%, 100% { opacity: 0; } }
            @keyframes cicloAmanecer { 0%, 75% { opacity: 0; } 85%, 95% { opacity: 1; } 100% { opacity: 0; } }
            @keyframes flotar { 0% { transform: translateX(0vw); } 100% { transform: translateX(120vw); } }
            @keyframes parpadeo { 0% { filter: opacity(0.3); } 100% { filter: opacity(1); } }
        `;
        document.head.appendChild(estilo);
    }

    toggleSky() {
        this.skyEnabled = !this.skyEnabled;
        if (this.skyEnabled) {
            document.body.classList.add('bg-sky-active');
            this.skyContainer.classList.remove('atmosfera-inactiva'); 
        } else {
            document.body.classList.remove('bg-sky-active');
            setTimeout(() => {
                if(!this.skyEnabled) this.skyContainer.classList.add('atmosfera-inactiva');
            }, 1000);
        }
        return this.skyEnabled;
    }
}
