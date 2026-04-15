// main.js

import { MotorAudio } from './MotorAudio.js';
import { MotorEntorno, DICCIONARIO_ENTORNO } from './MotorEntorno.js';
import { Rama, rnd, DICCIONARIO_BOTANICO, PARAMETROS_MOTOR } from './MotorBonsai.js';

// --- 1. INICIALIZACIÓN DE CONTEXTO Y MOTORES ---

const domContext = {
    layerPot: document.getElementById('layer-pot'),
    layerTree: document.getElementById('layer-tree'),
    layerLeaves: document.getElementById('layer-leaves'),
    layerFlowers: document.getElementById('layer-flowers')
};

const audioMotor = new MotorAudio();
const entornoMotor = new MotorEntorno(domContext);

// Inyectamos el motor de audio al contexto para que el Bonsái pueda disparar el sonido de las flores
domContext.audioMotor = audioMotor;

// --- 2. ESTADO GLOBAL DEL SIMULADOR ---

let arbolBase = null;
let animationFrameId = null;
let iteracionGlobal = 0;
let tiempoViento = 0;
let isZenMode = false;
let zenPausa = false;
let idleTimeout = null;

let showLeaves = true;
let showFlowers = true;

// Referencias directas a UI estática
const statsDisplay = document.getElementById('stats');
const btnZenMain = document.getElementById('btn-zen-main');
const dashboard = document.getElementById('dashboard');

// --- 3. CONSTRUCTOR DE INTERFAZ DINÁMICA (Data-Driven UI) ---

function construirInterfaz() {
    const contenedorMorfologia = document.getElementById('ui-morfologia');
    const contenedorParametros = document.getElementById('ui-parametros');

    // Generar Selects de Entorno
    contenedorMorfologia.innerHTML += crearSelect('p-maceta-forma', 'Forma Maceta', DICCIONARIO_ENTORNO.macetas);
    contenedorMorfologia.innerHTML += crearSelect('p-maceta-color', 'Esmalte (Color)', DICCIONARIO_ENTORNO.esmaltes);

    // Generar Selects de Botánica
    contenedorMorfologia.innerHTML += crearSelect('p-forma', 'Forma Foliar', DICCIONARIO_BOTANICO.hojas);
    contenedorMorfologia.innerHTML += crearSelect('p-flora', 'Tipo de Flora', DICCIONARIO_BOTANICO.flora);

    // Generar Sliders Paramétricos desde la configuración del Motor
    PARAMETROS_MOTOR.forEach(param => {
        const isDecimal = param.step % 1 !== 0;
        const valTxt = isDecimal ? param.default.toFixed(1) : param.default;
        const colorStyle = param.color ? `style="color: ${param.color};"` : '';
        
        contenedorParametros.innerHTML += `
            <div class="control-group">
                <label><span ${colorStyle}>${param.label}</span> <span id="val-${param.id}" ${colorStyle}>${valTxt}</span></label>
                <input type="range" id="${param.id}" data-key="${param.key}" min="${param.min}" max="${param.max}" step="${param.step}" value="${param.default}">
            </div>
        `;
    });

    // Asignar Event Listeners a los elementos recién creados
    document.getElementById('p-maceta-forma').addEventListener('change', updatePot);
    document.getElementById('p-maceta-color').addEventListener('change', updatePot);

    document.querySelectorAll('#ui-parametros input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
            const isDecimal = e.target.step % 1 !== 0;
            let val = isDecimal ? parseFloat(e.target.value).toFixed(1) : e.target.value;
            // Forzar formato .0 si es entero pero el slider es decimal (ej. 3.0)
            if(isDecimal && Number.isInteger(parseFloat(val))) val += ".0";
            document.getElementById(`val-${e.target.id}`).textContent = val;
        });
    });
}

function crearSelect(id, label, opciones) {
    let html = `<div class="control-group"><label><span>${label}</span></label><select id="${id}">`;
    opciones.forEach(opt => html += `<option value="${opt.id}">${opt.nombre}</option>`);
    html += `</select></div>`;
    return html;
}

// --- 4. LECTURA Y ACTUALIZACIÓN DE PARÁMETROS ---

// Extrae todos los valores actuales de la UI
export function getParams() {
    const params = {
        formaHoja: document.getElementById('p-forma').value,
        tipoFlora: document.getElementById('p-flora').value,
    };
    
    // Lee automáticamente todos los sliders definidos en el diccionario
    PARAMETROS_MOTOR.forEach(p => {
        let rawVal = document.getElementById(p.id).value;
        // Los porcentajes en la UI (0-100) se convierten a decimales (0-1) para la matemática
        if (p.id === 'p-branch' || p.id === 'p-acc' || p.id === 'p-viento' || p.id === 'p-lenVar') {
            params[p.key] = parseFloat(rawVal) / 100;
        } else {
            params[p.key] = parseFloat(rawVal);
        }
    });
    return params;
}

function actualizarUI(id, valor) {
    let el = document.getElementById(id);
    if(el) {
        el.value = valor;
        // Disparar evento 'input' manualmente para actualizar la etiqueta de texto asociada
        el.dispatchEvent(new Event('input'));
    }
}

// Actualiza el SVG de la maceta
const updatePot = () => {
    const forma = document.getElementById('p-maceta-forma').value;
    const color = document.getElementById('p-maceta-color').value;
    entornoMotor.renderizarMaceta(forma, color);
};

// --- 5. PERFILES BOTÁNICOS (PRESETS) ---

const PRESETS_BOTANICOS = {
    pino:     { mForma: 'estandar', mColor: '#c05a41', viento: 10, length: 25, lenVar: 10, angle: 20, branch: 45, acc: 10, gen: 5, hojas: 5, flor: 8, forma: 'huso', flora: 'ninguno', edadRam: 3.5 }, 
    roble:    { mForma: 'plana',    mColor: '#2c3e50', viento: 25, length: 18, lenVar: 30, angle: 50, branch: 75, acc: 35, gen: 6, hojas: 18, flor: 7, forma: 'ovalada', flora: 'ninguno', edadRam: 2.8 },
    arbusto:  { mForma: 'redonda',  mColor: '#458b74', viento: 30, length: 8,  lenVar: 50, angle: 75, branch: 95, acc: 70, gen: 4, hojas: 25, flor: 4, forma: 'circular', flora: 'baya-roja', edadRam: 1.5 },
    cipres:   { mForma: 'alta',     mColor: '#8c8c91', viento: 15, length: 15, lenVar: 15, angle: 10, branch: 80, acc: 50, gen: 6, hojas: 8, flor: 8, forma: 'larga', flora: 'ninguno', edadRam: 3.0 },
    cerezo:   { mForma: 'redonda',  mColor: '#2c3e50', viento: 40, length: 17, lenVar: 40, angle: 45, branch: 70, acc: 25, gen: 6, hojas: 4, flor: 5, forma: 'ovalada', flora: 'flor-rosa', edadRam: 2.5 },
    limonero: { mForma: 'redonda',  mColor: '#c05a41', viento: 20, length: 16, lenVar: 25, angle: 55, branch: 75, acc: 30, gen: 5, hojas: 16, flor: 5, forma: 'ovalada', flora: 'limon', edadRam: 2.8 }
};

// Expuesto globalmente para el onclick del HTML
window.aplicarPreset = function(tipo) {
    const p = PRESETS_BOTANICOS[tipo];
    actualizarUI('p-maceta-forma', p.mForma);
    actualizarUI('p-maceta-color', p.mColor);
    actualizarUI('p-forma', p.forma);
    actualizarUI('p-flora', p.flora);
    
    // Mapeamos los valores del preset a los IDs de los sliders
    actualizarUI('p-viento', p.viento);
    actualizarUI('p-edadRam', p.edadRam);
    actualizarUI('p-length', p.length);
    actualizarUI('p-lenVar', p.lenVar);
    actualizarUI('p-angle', p.angle);
    actualizarUI('p-branch', p.branch);
    actualizarUI('p-acc', p.acc);
    actualizarUI('p-gen', p.gen);
    actualizarUI('p-hojas', p.hojas);
    actualizarUI('p-flor', p.flor);
    
    updatePot();
    inicializarArbol();
}

document.getElementById('btn-mutar').addEventListener('click', () => {
    // Selección aleatoria desde los diccionarios
    const fMaceta = DICCIONARIO_ENTORNO.macetas[Math.floor(Math.random() * DICCIONARIO_ENTORNO.macetas.length)].id;
    const cMaceta = DICCIONARIO_ENTORNO.esmaltes[Math.floor(Math.random() * DICCIONARIO_ENTORNO.esmaltes.length)].id;
    const fHoja = DICCIONARIO_BOTANICO.hojas[Math.floor(Math.random() * DICCIONARIO_BOTANICO.hojas.length)].id;
    const tFlora = DICCIONARIO_BOTANICO.flora[Math.floor(Math.random() * DICCIONARIO_BOTANICO.flora.length)].id;
    
    actualizarUI('p-maceta-forma', fMaceta);
    actualizarUI('p-maceta-color', cMaceta);
    actualizarUI('p-forma', fHoja);
    actualizarUI('p-flora', tFlora);
    
    // Mutación aleatoria de parámetros numéricos
    actualizarUI('p-viento', Math.floor(rnd(10, 80)));
    actualizarUI('p-edadRam', (rnd(1.5, 4.5)).toFixed(1));
    actualizarUI('p-length', Math.floor(rnd(10, 25)));
    actualizarUI('p-lenVar', Math.floor(rnd(0, 80)));
    actualizarUI('p-angle', Math.floor(rnd(15, 75)));
    actualizarUI('p-branch', Math.floor(rnd(40, 90)));
    actualizarUI('p-acc', Math.floor(rnd(10, 60)));
    actualizarUI('p-gen', Math.floor(rnd(4, 7)));
    actualizarUI('p-hojas', Math.floor(rnd(5, 25)));
    actualizarUI('p-flor', Math.floor(rnd(3, 8)));
    
    updatePot();
    inicializarArbol();
});


// --- 6. EVENTOS DE INTERFAZ GENERALES ---

// Ocultar estadísticas si no hay movimiento de ratón/toque
function resetTimerIdle() {
    document.body.classList.remove('zen-idle');
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => { document.body.classList.add('zen-idle'); }, 2500);
}

// Botones del Drawer (Panel lateral)
document.getElementById('btn-open-config').addEventListener('click', () => dashboard.classList.add('open'));
document.getElementById('btn-close-config').addEventListener('click', () => dashboard.classList.remove('open'));

document.getElementById('btn-reset').addEventListener('click', inicializarArbol);

document.getElementById('btn-hojas').addEventListener('click', (e) => { 
    showLeaves = !showLeaves; 
    e.target.classList.toggle('active-toggle', showLeaves); 
});
document.getElementById('btn-flores').addEventListener('click', (e) => { 
    showFlowers = !showFlowers; 
    e.target.classList.toggle('active-toggle', showFlowers); 
});

// Botones de Audio y Entorno
document.getElementById('btn-sfx').addEventListener('click', (e) => {
    const activado = audioMotor.toggleSfx();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🍃 SFX: ON" : "🍃 SFX: OFF";
});

document.getElementById('btn-music').addEventListener('click', (e) => {
    const activado = audioMotor.toggleMusic();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🎵 MÚSICA: ON" : "🎵 MÚSICA: OFF";
    if (activado && isZenMode) audioMotor.resumeMusic();
});

document.getElementById('btn-fondo').addEventListener('click', (e) => {
    const activado = entornoMotor.toggleSky();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🌅 CIELO: ON" : "🌅 CIELO: OFF";
});

// Botón Principal Zen
btnZenMain.addEventListener('click', () => {
    isZenMode = !isZenMode;
    if (isZenMode) {
        document.body.classList.add('zen-active');
        btnZenMain.classList.add('active');
        zenPausa = false;
        
        if (iteracionGlobal > 18) { 
            document.getElementById('btn-mutar').click(); 
        } 
        audioMotor.resumeMusic();
        
    } else {
        document.body.classList.remove('zen-active');
        btnZenMain.classList.remove('active');
        audioMotor.stopMusic();
    }
});


// --- 7. BUCLE DE ANIMACIÓN PRINCIPAL ---

function bucleAnimacion() {
    tiempoViento += 0.016; 
    
    let paramsActuales = getParams();
    
    // Actualizar audio del viento
    audioMotor.actualizarViento(tiempoViento, paramsActuales.viento * 100);

    if (isZenMode && !zenPausa && arbolBase) {
        let deltaZen = 0.015; 
        
        arbolBase.crecer(deltaZen, paramsActuales);
        iteracionGlobal += deltaZen;
        statsDisplay.textContent = `NODOS: ${arbolBase.contarNodos()} | AÑOS: ${iteracionGlobal.toFixed(1)}`;

        // Reinicio automático en Zen
        if (iteracionGlobal > 18) {
            zenPausa = true;
            setTimeout(() => {
                if(isZenMode) { document.getElementById('btn-mutar').click(); } 
            }, 4000); 
        }
    }

    if (arbolBase) {
        arbolBase.animarYRenderizar(0, tiempoViento, paramsActuales.viento, showLeaves, showFlowers);
    }
    
    animationFrameId = requestAnimationFrame(bucleAnimacion);
}

function inicializarArbol() {
    domContext.layerTree.innerHTML = ''; 
    domContext.layerLeaves.innerHTML = ''; 
    domContext.layerFlowers.innerHTML = '';
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    arbolBase = new Rama(0, 0, 0, -90, null, getParams(), domContext);
    iteracionGlobal = 0;
    zenPausa = false;
    statsDisplay.textContent = `NODOS: 1 | AÑOS: 0.0`;
    
    bucleAnimacion();
    resetTimerIdle();
}

// --- 8. ARRANQUE ---
window.addEventListener('DOMContentLoaded', () => {
    construirInterfaz();
    window.aplicarPreset('pino'); 
    
    // Autostart Zen
    isZenMode = true;
    document.body.classList.add('zen-active');
    btnZenMain.classList.add('active');
});
