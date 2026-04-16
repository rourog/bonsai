// MotorBonsai.js

// --- SISTEMA DE SEMILLAS (PRNG MULBERRY32 + XMUR3) ---
let semillaActual = 0;

function xmur3(str) {
    for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    return function() {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}

export function setSeed(textoSemilla) {
    const generadorHash = xmur3(textoSemilla);
    semillaActual = generadorHash(); 
}

export function seededRandom() {
    let t = semillaActual += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

export function rnd(min, max) { 
    return seededRandom() * (max - min) + min; 
}
// ---------------------------------------------

export const DICCIONARIO_BOTANICO = {
    hojas: [
        { id: 'huso', nombre: 'Huso Afilado' },
        { id: 'ovalada', nombre: 'Oval Estándar' },
        { id: 'circular', nombre: 'Circular Brote' },
        { id: 'larga', nombre: 'Larga Sauce' },
        { id: 'arce', nombre: 'Arce Lobulada' }
    ],
    flora: [
        { id: 'aleatorio', nombre: 'Caos' },
        { id: 'flor-rosa', nombre: 'Flores Rosas' },
        { id: 'flor-blanca', nombre: 'Flores Blancas' },
        { id: 'flor-amarilla', nombre: 'Flores Amarillas' },
        { id: 'limon', nombre: 'Limones' },
        { id: 'baya-roja', nombre: 'Baya Roja' },
        { id: 'platano', nombre: 'Plátanos' },
        { id: 'ninguno', nombre: 'Ninguno' }
    ]
};

export const PARAMETROS_MOTOR = [
    { key: 'viento', id: 'p-viento', label: 'Intensidad Viento (%)', min: 0, max: 100, step: 1, default: 15, color: '#3498db' },
    { key: 'edadRamificacion', id: 'p-edadRam', label: 'Edad de Ramificación', min: 1.5, max: 5.0, step: 0.1, default: 3.0 },
    { key: 'baseLength', id: 'p-length', label: 'Longitud Base', min: 5, max: 30, step: 1, default: 18 },
    { key: 'lenVariance', id: 'p-lenVar', label: 'Varianza Longitud (%)', min: 0, max: 100, step: 1, default: 20 },
    { key: 'maxAngle', id: 'p-angle', label: 'Ángulo Nacimiento (°)', min: 5, max: 80, step: 1, default: 45 },
    { key: 'branchProb', id: 'p-branch', label: 'Prob. Ramificación (%)', min: 0, max: 100, step: 1, default: 65 },
    { key: 'accProb', id: 'p-acc', label: 'Prob. Rama Media (%)', min: 0, max: 100, step: 1, default: 30 },
    { key: 'maxGen', id: 'p-gen', label: 'Límite Generacional', min: 3, max: 8, step: 1, default: 6 },
    { key: 'maxHojas', id: 'p-hojas', label: 'Densidad Follaje (Max)', min: 0, max: 30, step: 1, default: 12 },
    { key: 'inicioFloracion', id: 'p-flor', label: 'Inicio Floración (Edad)', min: 2, max: 8, step: 1, default: 6 }
];

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_AGE = 8;
const TENSION_ANIMACION = 0.08; 

const C_YOUNG = { r: 93,  g: 125, b: 60 };
const BARK_PALETTE = [
    { r: 70, g: 50, b: 40 }, { r: 90, g: 70, b: 50 }, { r: 110, g: 90, b: 70 }, 
    { r: 50, g: 50, b: 50 }, { r: 80, g: 80, b: 80 }, { r: 100, g: 80, b: 60 }  
];

const LEAF_COLORS = ['#1f362a', '#2c4c3b', '#3e6e5a', '#5d7d3c'];

export function generarPathHoja(forma, w, l) {
    switch(forma) {
        case 'huso': return `M 0 0 Q ${w} ${l/2} 0 ${l} Q ${-w} ${l/2} 0 0 Z`;
        case 'ovalada': return `M 0 0 C ${w*1.5} ${l*0.2} ${w*1.5} ${l*0.8} 0 ${l} C ${-w*1.5} ${l*0.8} ${-w*1.5} ${l*0.2} 0 0 Z`;
        case 'larga': return `M 0 0 Q ${w*0.8} ${l} 0 ${l*2.5} Q ${-w*0.8} ${l} 0 0 Z`;
        case 'circular': return `M 0 ${w*1.2} A ${w*1.2} ${w*1.2} 0 1 0 0 ${-w*1.2+0.01} Z`; 
        case 'arce': return `M 0 0 L ${w} ${l*0.3} L ${w*2.5} 0 L ${w*1.2} ${l*0.6} L 0 ${l} L ${-w*1.2} ${l*0.6} L ${-w*2.5} 0 L ${-w} ${l*0.3} Z`;
        default: return `M 0 0 Q ${w} ${l/2} 0 ${l} Q ${-w} ${l/2} 0 0 Z`; 
    }
}

export class FrutoFlor {
    constructor(tipo, startX, startY, ctx) { 
        this.ctx = ctx; 
        this.offsetX = rnd(-15, 15);
        this.offsetY = rnd(-15, 15);
        this.escalaTarget = rnd(0.8, 1.4);
        this.escalaActual = 0;
        this.podado = false;
        
        if (tipo === 'aleatorio') {
            const tipos = ['flor-rosa', 'flor-blanca', 'flor-amarilla', 'limon', 'baya-roja', 'platano'];
            tipo = tipos[Math.floor(seededRandom() * tipos.length)];
        }
        
        const data = this.obtenerDatosMorfologicos(tipo);
        this.anguloCae = (tipo === 'limon' || tipo === 'platano') ? rnd(10, 45) * (seededRandom() > 0.5 ? 1 : -1) : rnd(-15, 15);

        this.dom = document.createElementNS(SVG_NS, "path");
        this.dom.setAttribute("d", data.path);
        this.dom.setAttribute("fill", data.fill);
        this.dom.setAttribute("opacity", "0.95");
        this.dom.setAttribute("class", "flora-activa");
        
        this.dom.setAttribute("transform", `translate(${startX + this.offsetX}, ${startY + this.offsetY}) scale(0)`);
        this.dom.addEventListener('click', (e) => { e.stopPropagation(); this.cortar(); });
        this.ctx.layerFlowers.appendChild(this.dom);
        
        if(this.ctx.audioMotor && typeof this.ctx.audioMotor.playPop === 'function') {
            this.ctx.audioMotor.playPop();
        }
    }

    obtenerDatosMorfologicos(tipo) {
        switch(tipo) {
            case 'flor-rosa': return { fill: '#e8a0bf', path: "M 0 -4 Q 3 -3 4 0 Q 3 3 0 4 Q -3 3 -4 0 Q -3 -3 0 -4 Z" };
            case 'flor-blanca': return { fill: '#f8f9fa', path: "M 0 -4 Q 3 -3 4 0 Q 3 3 0 4 Q -3 3 -4 0 Q -3 -3 0 -4 Z" };
            case 'flor-amarilla': return { fill: '#fadd4b', path: "M 0 -4 Q 3 -3 4 0 Q 3 3 0 4 Q -3 3 -4 0 Q -3 -3 0 -4 Z" };
            case 'limon': return { fill: '#fadd4b', path: "M 0 -5 C 4 -5 5 -2 5 0 C 5 3 3 5 0 6 C -3 5 -5 3 -5 0 C -5 -2 -4 -5 0 -5 Z" };
            case 'baya-roja': return { fill: '#e74c3c', path: "M 0 -3 A 3 3 0 1 0 0 3 A 3 3 0 1 0 0 -3 Z M 3 2 A 2.5 2.5 0 1 0 3 -3 A 2.5 2.5 0 1 0 3 2 Z" };
            case 'platano': return { fill: '#f1c40f', path: "M 2 -5 Q 5 0 2 5 Q 0 4 -1 0 Q 0 -4 2 -5 Z" };
            default: return { fill: '#e8a0bf', path: "M 0 -4 Q 3 -3 4 0 Q 3 3 0 4 Q -3 3 -4 0 Q -3 -3 0 -4 Z" };
        }
    }

    cortar() { this.podado = true; this.dom.remove(); }
    
    animar(padreX, padreY, parentWindAngle, tiempoViento, windIntensity, showFlowers) {
        if(this.podado) return;
        this.escalaActual += (this.escalaTarget - this.escalaActual) * TENSION_ANIMACION;
        let swing = Math.sin(tiempoViento * 2.5 + this.offsetX) * windIntensity * 20; 
        let windRotDeg = (parentWindAngle * 180 / Math.PI) + swing;

        this.dom.setAttribute("transform", `translate(${padreX + this.offsetX}, ${padreY + this.offsetY}) rotate(${this.anguloCae + windRotDeg}) scale(${Math.max(0, this.escalaActual)})`);
        this.dom.style.display = showFlowers ? "block" : "none";
    }
}

export class Brote {
    constructor(x, y, anguloRama, ctx) {
        this.ctx = ctx;
        this.x = x; 
        this.y = y;
        
        let anguloDeseado = anguloRama + rnd(-70, 70);
        this.angulo = anguloDeseado + (-90 - anguloDeseado) * 0.2;
        
        this.longitud = rnd(8, 20);
        this.hojas = [];
        this.podado = false;
        
        this.g = document.createElementNS(SVG_NS, "g");
        this.g.setAttribute("class", "brote-activo");
        this.g.addEventListener('click', (e) => { e.stopPropagation(); this.cortar(); });
        
        this.tallo = document.createElementNS(SVG_NS, "line");
        this.tallo.setAttribute("stroke-width", "0.5"); 
        this.tallo.setAttribute("stroke", `rgb(${C_YOUNG.r}, ${C_YOUNG.g}, ${C_YOUNG.b})`); 
        this.g.appendChild(this.tallo);
        
        this.ctx.layerLeaves.appendChild(this.g);
    }
    
    crecer(delta, params) {
        if (this.podado) return;
        let probHoja = 1 - Math.pow(1 - 0.85, delta);
        
        if (this.hojas.length < params.maxHojas && seededRandom() < probHoja) {
            let variabilidadCae = rnd(10, 45);
            let direccionCae = seededRandom() > 0.5 ? 1 : -1;

            const hojaObj = {
                offsetX: rnd(-10, 10), offsetY: rnd(-10, 10),
                escalaTarget: rnd(0.7, 1.3), escalaActual: 0,
                anguloCae: variabilidadCae * direccionCae,
                color: LEAF_COLORS[Math.floor(seededRandom() * LEAF_COLORS.length)],
                dom: document.createElementNS(SVG_NS, "path")
            };
            
            let w = rnd(2.0, 4.0); let l = rnd(8.0, 14.0);
            hojaObj.dom.setAttribute("d", generarPathHoja(params.formaHoja, w, l));
            hojaObj.dom.setAttribute("fill", hojaObj.color);
            hojaObj.dom.setAttribute("opacity", "0.95");
            
            this.hojas.push(hojaObj);
            this.g.appendChild(hojaObj.dom);
        }
    }

    cortar() { this.podado = true; this.g.remove(); }
    
    animar(padreX, padreY, parentWindAngle, tiempoViento, windIntensity, showLeaves) {
        if (this.podado) return;
        this.x = padreX; this.y = padreY;
        
        let finalStemAngleRad = (this.angulo * Math.PI / 180) + parentWindAngle;
        const endX = this.x + Math.cos(finalStemAngleRad) * this.longitud;
        const endY = this.y + Math.sin(finalStemAngleRad) * this.longitud;
        
        this.g.style.display = showLeaves ? "block" : "none";
        this.tallo.setAttribute("x1", this.x); this.tallo.setAttribute("y1", this.y);
        this.tallo.setAttribute("x2", endX); this.tallo.setAttribute("y2", endY);

        let flutter = Math.sin(tiempoViento * 4.0 + this.x) * windIntensity * 15; 

        this.hojas.forEach(h => {
            h.escalaActual += (h.escalaTarget - h.escalaActual) * TENSION_ANIMACION;
            let windRotDeg = (parentWindAngle * 180 / Math.PI) + flutter;
            h.dom.setAttribute("transform", `translate(${endX + h.offsetX}, ${endY + h.offsetY}) rotate(${h.anguloCae + windRotDeg}) scale(${Math.max(0, h.escalaActual)})`);
        });
    }
}

export class Rama {
    constructor(gen, startX, startY, anguloInicial, padre, params, ctx) {
        this.padre = padre;
        this.gen = gen;
        this.age = 0; 
        this.podada = false; 
        this.seed = seededRandom() * 1000; 
        this.ctx = ctx; 
        this.esAccesoria = false; 
        
        this.nxMid = 0; this.nyMid = 0;
        this.nxFin = 0; this.nyFin = 0;
        
        // --- 1. ADN DEL ÁRBOL ---
        if (this.padre) {
            this.adn = this.padre.adn;
            this.baseBarkColor = this.padre.baseBarkColor;
        } else {
            this.adn = {
                estilo: seededRandom(), // 0.0 a 1.0 (Silueta principal)
                fuerza: rnd(0.1, 0.4)   // Elasticidad hacia la luz
            };
            this.baseBarkColor = BARK_PALETTE[Math.floor(this.seed % BARK_PALETTE.length)];
        }
        
        this.startX = startX; 
        this.startY = startY;
        
        let anguloNormalizado = anguloInicial;
        while (anguloNormalizado <= -180) anguloNormalizado += 360;
        while (anguloNormalizado > 180) anguloNormalizado -= 360;
        
        // ¡LA CLAVE! Respetamos el ángulo inicial de bifurcación para evitar ramas paralelas.
        // El fototropismo actuará sobre la curvatura más adelante.
        this.angulo = anguloNormalizado; 

        let targetLuz = -90; 
        let preferenciaUp = 1.0; 
        let preferenciaOut = 1.0;
        let bonoLongitud = 1.0;

        // --- 2. VIGOR ORGÁNICO Y FOTOTROPISMO ---
        if (this.gen > 0) {
            let lado = (anguloNormalizado >= -90 && anguloNormalizado <= 90) ? 1 : -1; 
            
            // Definir preferencias según el ADN
            if (this.adn.estilo < 0.20) {
                targetLuz = -90 + (110 * lado) + (this.gen * 25 * lado); // Cascada
                preferenciaUp = -1.0; 
                preferenciaOut = 1.2;
            } else if (this.adn.estilo < 0.70) {
                targetLuz = -90 + (70 * lado); // Aparasolado
                preferenciaUp = 0.2; 
                preferenciaOut = 1.5;
            } else {
                targetLuz = -90 + (20 * lado); // Vertical
                preferenciaUp = 1.5; 
                preferenciaOut = 0.2;
            }

            // Cálculo de Vectores
            let vecY = -Math.sin(this.angulo * Math.PI / 180); // +1 si va arriba, -1 si va abajo
            let vecX = Math.cos(this.angulo * Math.PI / 180);  // +1 si va derecha, -1 si va izq
            
            // Determinar si crece "hacia afuera" del tronco central (0)
            let xSign = this.startX > 5 ? 1 : (this.startX < -5 ? -1 : (vecX >= 0 ? 1 : -1));
            let outwardness = vecX * xSign; // +1 huye del tronco, -1 va hacia el tronco
            let upwardness = vecY; 

            // Evaluar vigor comparando vectores con el ADN
            let vigor = (outwardness * preferenciaOut) + (upwardness * preferenciaUp);
            vigor = vigor / (Math.abs(preferenciaOut) + Math.abs(preferenciaUp)); 

            let bonoDir = 0;
            if (vigor > 0) {
                // Boost agresivo y altamante aleatorio para ramas ganadoras (hasta +180% de largo)
                bonoDir = vigor * rnd(0.2, 1.8); 
            } else {
                // Castigo para ramas que apuntan mal (hasta -80% de largo)
                bonoDir = vigor * rnd(0.2, 0.8); 
            }
            
            bonoLongitud = 1.0 + bonoDir;
            bonoLongitud = Math.max(0.2, Math.min(2.8, bonoLongitud)); // Topes de seguridad física

            // Curvatura hacia la meta de luz (En lugar de pellizcar la base)
            let diffAtraccion = targetLuz - this.angulo;
            while (diffAtraccion <= -180) diffAtraccion += 360;
            while (diffAtraccion > 180) diffAtraccion -= 360;
            
            let atraccion = this.adn.fuerza + (this.gen * 0.05);
            atraccion = Math.min(atraccion, 0.85); 
            this.curvatura = rnd(-10, 10) + (diffAtraccion * atraccion);

        } else {
            // El tronco tiene curvatura orgánica pura
            this.curvatura = (seededRandom() > 0.5 ? 1 : -1) * rnd(5, params.maxAngle * 0.5) + ((-90 - this.angulo) * 0.1); 
        }

        let v = params.lenVariance;
        this.lenMultiplier = (1.0 + rnd(-v, v)) * bonoLongitud;
        if (this.gen === 0) this.lenMultiplier = (1.0 + rnd(-v * 0.5, v * 0.5));
        
        // -------------------------------------------------------------
        
        this.lenObj = 0; this.lenAct = 0; 
        this.grosorBaseAct = 0; this.grosorPuntaAct = 0;
        
        this.grosorBrutoObj = 2.0; 
        this.grosorBaseObj = this.padre ? Math.min(this.grosorBrutoObj, this.padre.grosorPuntaObj) : this.grosorBrutoObj; 
        this.grosorPuntaObj = this.grosorBaseObj * 0.5;
        
        this.hijos = []; this.brotes = []; this.flora = [];
        this.haBifurcado = false; this.tieneAccesoria = false;
        this.currentFill = `rgb(${C_YOUNG.r}, ${C_YOUNG.g}, ${C_YOUNG.b})`;
        
        this.g = document.createElementNS(SVG_NS, "g");
        this.g.setAttribute("class", "rama-activa");
        this.g.addEventListener('click', (e) => { e.stopPropagation(); this.cortar(); });
        
        this.path = document.createElementNS(SVG_NS, "path");
        this.jointBase = document.createElementNS(SVG_NS, "circle");
        this.jointTip = document.createElementNS(SVG_NS, "circle");
        
        this.g.appendChild(this.jointBase);
        this.g.appendChild(this.path);
        this.g.appendChild(this.jointTip);
        
        this.ctx.layerTree.appendChild(this.g);
    }

    crecer(delta, params) {
        if (this.podada) return;

        if (this.age < MAX_AGE) {
            let prevAge = this.age;
            this.age = Math.min(MAX_AGE, this.age + delta);
            let growthFraction = this.age - prevAge; 

            let incremento = Math.max(0, (MAX_AGE - this.age) * (params.baseLength * 0.1)) * growthFraction * this.lenMultiplier;
            this.lenObj += incremento;
            this.grosorBrutoObj += (params.maxGen - this.gen) * 0.4 * growthFraction; 
        }

        this.grosorBaseObj = this.grosorBrutoObj;
        if (this.padre) this.grosorBaseObj = Math.min(this.grosorBaseObj, this.padre.grosorPuntaObj);
        
        let ratioMadurez = Math.min(1, this.age / MAX_AGE);
        let taper = 0.5 + (0.5 * ratioMadurez); 
        this.grosorPuntaObj = this.grosorBaseObj * taper;

        this.brotes.forEach(b => b.crecer(delta, params));
        this.hijos.forEach(h => h.crecer(delta, params));

        if (this.gen > 0 && params.maxHojas > 0) { 
            let maxBrotes = (this.hijos.length === 0) ? 5 : 2; 
            let probBrote = 1 - Math.pow(1 - 0.75, delta);
            if (this.brotes.length < maxBrotes && seededRandom() < probBrote) {
                if (this.lenAct > 2) {
                    this.brotes.push(new Brote(this.endXAct || this.startX, this.endYAct || this.startY, this.angulo, this.ctx));
                }
            }
        }

        if (params.tipoFlora !== 'ninguno' && this.lenAct > 5 && this.endXAct !== undefined) {
            let esRamaTerminal = this.gen >= params.maxGen - 2;
            let probFlora = 1 - Math.pow(1 - 0.60, delta);
            if (this.age >= params.inicioFloracion && esRamaTerminal) {
                if (this.flora.length < 6 && seededRandom() < probFlora) {
                    this.flora.push(new FrutoFlor(params.tipoFlora, this.endXAct, this.endYAct, this.ctx));
                }
            }
        }

        let edadBifurcacion = params.edadRamificacion;

        if (this.age >= edadBifurcacion && this.gen < params.maxGen - 1 && !this.haBifurcado) {
            let prob = this.gen === 0 ? 0.90 : params.branchProb;
            if (seededRandom() < prob) {
                // SEGURIDAD ANTI-PARALELISMO: Aseguramos un mínimo de 20° de separación siempre
                let spread = rnd(20, params.maxAngle);
                this.crearHijo(this.angulo + spread, params, false);
                this.crearHijo(this.angulo - spread, params, false);
            } else {
                // RAMA DE CONTINUACIÓN: Damos un quiebre mínimo para que no se vea como un palo recto
                let kink = rnd(10, 25) * (seededRandom() > 0.5 ? 1 : -1);
                this.crearHijo(this.angulo + kink, params, false);
            }
            this.haBifurcado = true;
        }

        if (this.age >= edadBifurcacion + 1.0 && this.gen > 1 && this.gen < params.maxGen - 1 && !this.tieneAccesoria) {
            if (seededRandom() < params.accProb) {
                let direccion = seededRandom() > 0.5 ? 1 : -1;
                this.crearHijo(this.angulo + rnd(30, params.maxAngle) * direccion, params, true); 
                this.tieneAccesoria = true;
            }
        }
    }

    crearHijo(angulo, params, esAcc = false) {
        let hijo = new Rama(this.gen + 1, this.endXAct || this.startX, this.endYAct || this.startY, angulo, this, params, this.ctx);
        hijo.esAccesoria = esAcc; 
        this.hijos.push(hijo);
    }

    cortar() {
        this.brotes.forEach(b => b.cortar()); this.brotes = [];
        this.flora.forEach(f => f.cortar()); this.flora = [];
        
        const destruirDescendencia = (rama) => {
            rama.hijos.forEach(h => destruirDescendencia(h));
            rama.brotes.forEach(b => b.cortar());
            rama.flora.forEach(f => f.cortar());
            rama.g.remove();
        };
        
        if (this.hijos.length > 0) {
            this.hijos.forEach(h => destruirDescendencia(h));
            this.hijos = []; this.haBifurcado = false; this.tieneAccesoria = false; this.age = 2; 
        } else if (this.padre) {
            this.g.remove();
            this.padre.hijos = this.padre.hijos.filter(h => h !== this);
        }
    }

    lerpColor(f) {
        const bark = this.baseBarkColor;
        return {
            r: Math.round(C_YOUNG.r + (bark.r - C_YOUNG.r) * f),
            g: Math.round(C_YOUNG.g + (bark.g - C_YOUNG.g) * f),
            b: Math.round(C_YOUNG.b + (bark.b - C_YOUNG.b) * f)
        };
    }

    animarYRenderizar(parentWindAngle = 0, tiempoViento, windIntensity, showLeaves, showFlowers) {
        this.lenAct += (this.lenObj - this.lenAct) * TENSION_ANIMACION;
        this.grosorBaseAct += (this.grosorBaseObj - this.grosorBaseAct) * TENSION_ANIMACION;
        this.grosorPuntaAct += (this.grosorPuntaObj - this.grosorPuntaAct) * TENSION_ANIMACION;

        let ratioMadurez = Math.min(1, this.age / MAX_AGE);
        let c = this.lerpColor(ratioMadurez);
        this.currentFill = `rgb(${c.r}, ${c.g}, ${c.b})`;
        
        this.path.setAttribute("fill", this.currentFill);
        this.jointTip.setAttribute("fill", this.currentFill);

        if (this.padre && this.padre.currentFill) {
            this.jointBase.setAttribute("fill", this.padre.currentFill);
        } else {
            this.jointBase.setAttribute("fill", this.currentFill);
        }

        let flex = 1.0 / (this.grosorBaseAct * 0.5 + 1.0); 
        let localWind = Math.sin(tiempoViento * 1.5 + this.seed) * windIntensity * flex * 0.15; 
        let totalWind = parentWindAngle + localWind;

        let angRadInicio = (this.angulo * Math.PI / 180) + totalWind;
        let angRadFin = ((this.angulo + this.curvatura) * Math.PI / 180) + totalWind;
        let angRadMid = (angRadInicio + angRadFin) / 2;

        let midX = this.startX + Math.cos(angRadInicio) * (this.lenAct * 0.5);
        let midY = this.startY + Math.sin(angRadInicio) * (this.lenAct * 0.5);
        this.endXAct = midX + Math.cos(angRadFin) * (this.lenAct * 0.5);
        this.endYAct = midY + Math.sin(angRadFin) * (this.lenAct * 0.5);

        let rBase = this.grosorBaseAct / 2; 
        let rFin = this.grosorPuntaAct / 2; 
        
        let amplitudRugosidad = (ratioMadurez > 0.5) ? (rBase * 0.15) * (ratioMadurez - 0.5) : 0;
        let perturbBase = Math.sin(this.seed) * amplitudRugosidad;
        let perturbMid = Math.sin(this.seed + midX * 0.1) * amplitudRugosidad;
        let perturbFin = Math.sin(this.seed + midY * 0.1) * amplitudRugosidad;

        rBase += perturbBase; let rMid = (rBase + rFin) / 2 + perturbMid; rFin += perturbFin;

        let nInicioX = Math.cos(angRadInicio - Math.PI/2); let nInicioY = Math.sin(angRadInicio - Math.PI/2);
        this.nxMid = Math.cos(angRadMid - Math.PI/2); this.nyMid = Math.sin(angRadMid - Math.PI/2);
        this.nxFin = Math.cos(angRadFin - Math.PI/2); this.nyFin = Math.sin(angRadFin - Math.PI/2);

        let bx1 = this.startX + nInicioX * rBase; let by1 = this.startY + nInicioY * rBase;
        let bx2 = this.startX - nInicioX * rBase; let by2 = this.startY - nInicioY * rBase;
        let cx1 = midX + this.nxMid * rMid; let cy1 = midY + this.nyMid * rMid;
        let cx2 = midX - this.nxMid * rMid; let cy2 = midY - this.nyMid * rMid;
        let px1 = this.endXAct + this.nxFin * rFin; let py1 = this.endYAct + this.nyFin * rFin;
        let px2 = this.endXAct - this.nxFin * rFin; let py2 = this.endYAct - this.nyFin * rFin;

        let polyPath = `M ${bx1} ${by1} Q ${cx1} ${cy1} ${px1} ${py1} L ${px2} ${py2} Q ${cx2} ${cy2} ${bx2} ${by2} Z`;
        this.path.setAttribute("d", polyPath);

        if (this.padre) {
            this.jointBase.setAttribute("cx", this.startX); 
            this.jointBase.setAttribute("cy", this.startY);
            this.jointBase.setAttribute("r", Math.max(0, rBase));
        }

        this.jointTip.setAttribute("cx", this.endXAct); 
        this.jointTip.setAttribute("cy", this.endYAct);
        this.jointTip.setAttribute("r", Math.max(0, rFin));
        this.jointTip.style.display = "block"; 

        this.hijos.forEach(hijo => {
            if (hijo.esAccesoria) {
                let diff = hijo.angulo - this.angulo;
                while (diff <= -180) diff += 360;
                while (diff > 180) diff -= 360;
                let direccionHijo = (diff > 0) ? 1 : -1;
                
                hijo.startX = midX + (this.nxMid * rMid * 0.2 * direccionHijo);
                hijo.startY = midY + (this.nyMid * rMid * 0.2 * direccionHijo);
            } else {
                hijo.startX = this.endXAct;
                hijo.startY = this.endYAct;
            }
            hijo.animarYRenderizar(totalWind, tiempoViento, windIntensity, showLeaves, showFlowers);
        });

        this.brotes.forEach(brote => brote.animar(this.endXAct, this.endYAct, totalWind, tiempoViento, windIntensity, showLeaves));
        this.flora.forEach(f => f.animar(this.endXAct, this.endYAct, totalWind, tiempoViento, windIntensity, showFlowers));
    }

    contarNodos() { return 1 + this.hijos.reduce((acc, h) => acc + h.contarNodos(), 0); }

    verificarMadurez(maxGen) {
        if (this.gen >= maxGen - 1) return true;
        if (!this.haBifurcado) return false;
        if (this.hijos.length === 0) return true;
        return this.hijos.every(h => h.verificarMadurez(maxGen));
    }
}
