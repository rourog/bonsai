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
        this.ctx = ctx; // Recibe las capas del DOM (layerPot, skyBg, etc.)
        this.skyEnabled = false;
    }

    /**
     * Renderiza la maceta basada en la forma y color seleccionados.
     * @param {string} forma - 'estandar', 'redonda', 'alta', 'plana'
     * @param {string} color - Código hexadecimal del esmalte
     */
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

    /**
     * Alterna la visibilidad del fondo de cielo azul.
     */
    toggleSky() {
        this.skyEnabled = !this.skyEnabled;
        if (this.skyEnabled) {
            document.body.classList.add('bg-sky-active');
        } else {
            document.body.classList.remove('bg-sky-active');
        }
        return this.skyEnabled;
    }
}
