// main.js

import { MotorAudio } from './MotorAudio.js';
import { MotorEntorno } from './MotorEntorno.js';
import { Rama, rnd } from './MotorBonsai.js';

// --- INICIALIZACIÓN DE MOTORES ---

// 1. Contexto DOM para los motores
const domContext = {
    layerPot: document.getElementById('layer-pot'),
    layerTree: document.getElementById('layer-tree'),
    layerLeaves: document.getElementById('layer-leaves'),
    layerFlowers: document.getElementById('layer-flowers')
};

// 2. Instanciar Motores Auxiliares
const audioMotor = new MotorAudio();
const entornoMotor = new MotorEntorno(domContext);

// Inyectar el motor de audio al contexto del DOM para que el Bonsái pueda usarlo
domContext.audioMotor = audioMotor;

// --- ESTADO GLOBAL ---
let arbolBase = null;
let animationFrameId = null;
let iteracionGlobal = 0;
let tiempoViento = 0;
let isZenMode = false;
let zenPausa = false;
let idleTimeout = null;

let showLeaves = true;
let showFlowers = true;

// --- REFERENCIAS UI ---
const statsDisplay = document.getElementById('stats');
const btnZenMain = document.getElementById('btn-zen-main');
const dashboard = document.getElementById('dashboard');

// --- LÓGICA DE LA INTERFAZ (UI) ---

// Gestión del Panel de Configuración (Drawer)
document.getElementById('btn-open-config').addEventListener('click', () => dashboard.classList.add('open'));
document.getElementById('btn-close-config').addEventListener('click', () => dashboard.classList.remove('open'));

// Ocultar stats en inactividad
function resetTimerIdle() {
    document.body.classList.remove('zen-idle');
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => { document.body.classList.add('zen-idle'); }, 2500);
}
document.body.addEventListener('mousemove', resetTimerIdle);
document.body.addEventListener('touchstart', resetTimerIdle);

// Leer valores actuales de los controles
function getParams() {
    return {
        formaHoja: document.getElementById('p-forma').value,
        tipoFlora: document.getElementById('p-flora').value,
        edadRamificacion: parseFloat(document.getElementById('p-edadRam').value),
        baseLength: parseInt(document.getElementById('p-length').value),
        lenVariance: parseInt(document.getElementById('p-lenVar').value) / 100,
        maxAngle: parseInt(document.getElementById('p-angle').value),
        branchProb: parseInt(document.getElementById('p-branch').value) / 100,
        accProb: parseInt(document.getElementById('p-acc').value) / 100,
        maxGen: parseInt(document.getElementById('p-gen').value),
        maxHojas: parseInt(document.getElementById('p-hojas').value),
        inicioFloracion: parseInt(document.getElementById('p-flor').value)
    };
}

// --- CONTROLES DE AUDIO Y ENTORNO ---

document.getElementById('btn-sfx').addEventListener('click', (e) => {
    const activado = audioMotor.toggleSfx();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🍃 SFX: ON" : "🍃 SFX: OFF";
});

document.getElementById('btn-music').addEventListener('click', (e) => {
    const activado = audioMotor.toggleMusic();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🎵 MÚSICA: ON" : "🎵 MÚSICA: OFF";
    
    // Si prendemos la música y estamos en Zen, que suene de inmediato
    if (activado && isZenMode) {
        audioMotor.resumeMusic();
    }
});

document.getElementById('btn-fondo').addEventListener('click', (e) => {
    const activado = entornoMotor.toggleSky();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🌅 CIELO: ON" : "🌅 CIELO: OFF";
});

// Listener para actualizar la maceta cuando se cambian los selects
const updatePot = () => {
    const forma = document.getElementById('p-maceta-forma').value;
    const color = document.getElementById('p-maceta-color').value;
    entornoMotor.renderizarMaceta(forma, color);
};
document.getElementById('p-maceta-forma').addEventListener('change', updatePot);
document.getElementById('p-maceta-color').addEventListener('change', updatePot);

// --- PERFILES BOTÁNICOS (PRESETS) ---

const PRESETS_BOTANICOS = {
    pino:     { mForma: 'estandar', mColor: '#c05a41', viento: 10, length: 25, lenVar: 10, angle: 20, branch: 45, acc: 10, gen: 5, hojas: 5, flor: 8, forma: 'huso', flora: 'ninguno', edadRam: 3.5 }, 
    roble:    { mForma: 'plana',    mColor: '#2c3e50', viento: 25, length: 18, lenVar: 30, angle: 50, branch: 75, acc: 35, gen: 6, hojas: 18, flor: 7, forma: 'ovalada', flora: 'ninguno', edadRam: 2.8 },
    arbusto:  { mForma: 'redonda',  mColor: '#458b74', viento: 30, length: 8,  lenVar: 50, angle: 75, branch: 95, acc: 70, gen: 4, hojas: 25, flor: 4, forma: 'circular', flora: 'baya-roja', edadRam: 1.5 },
    cipres:   { mForma: 'alta',     mColor: '#8c8c91', viento: 15, length: 15, lenVar: 15, angle: 10, branch: 80, acc: 50, gen: 6, hojas: 8, flor: 8, forma: 'larga', flora: 'ninguno', edadRam: 3.0 },
    cerezo:   { mForma: 'redonda',  mColor: '#2c3e50', viento: 40, length: 17, lenVar: 40, angle: 45, branch: 70, acc: 25, gen: 6, hojas: 4, flor: 5, forma: 'ovalada', flora: 'flor-rosa', edadRam: 2.5 },
    limonero: { mForma: 'redonda',  mColor: '#c05a41', viento: 20, length: 16, lenVar: 25, angle: 55, branch: 75, acc: 30, gen: 5, hojas: 16, flor: 5, forma: 'ovalada', flora: 'limon', edadRam: 2.8 }
};

function actualizarUI(id, valor) {
    let el = document.getElementById(id);
    if(el) el.value = valor;
    const span = document.getElementById(`val-${id.split('-')[1]}`);
    if(span) span.textContent = Number.isInteger(parseFloat(valor)) && id === 'p-edadRam' ? valor + ".0" : valor;
}

// Exponer funciones globalmente si se usan en atributos onclick en el HTML
window.aplicarPreset = function(tipo) {
    const p = PRESETS_BOTANICOS[tipo];
    actualizarUI('p-maceta-forma', p.mForma);
    actualizarUI('p-maceta-color', p.mColor);
    actualizarUI('p-forma', p.forma);
    actualizarUI('p-flora', p.flora);
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
    const formasM = ['estandar', 'redonda', 'alta', 'plana'];
    const coloresM = ['#c05a41', '#2c3e50', '#34495e', '#8c8c91', '#458b74'];
    const formas = ['huso', 'ovalada', 'circular', 'larga', 'arce'];
    const floras = ['aleatorio', 'flor-rosa', 'flor-blanca', 'flor-amarilla', 'limon', 'baya-roja', 'platano', 'ninguno'];
    
    actualizarUI('p-maceta-forma', formasM[Math.floor(Math.random() * formasM.length)]);
    actualizarUI('p-maceta-color', coloresM[Math.floor(Math.random() * coloresM.length)]);
    actualizarUI('p-forma', formas[Math.floor(Math.random() * formas.length)]);
    actualizarUI('p-flora', floras[Math.floor(Math.random() * floras.length)]);
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

// Listener para actualizar etiquetas de los sliders en tiempo real
document.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', (e) => {
        let val = e.target.value;
        if(e.target.id === 'p-edadRam') val = parseFloat(val).toFixed(1);
        document.getElementById(`val-${e.target.id.split('-')[1]}`).textContent = val;
    });
});

// --- LÓGICA DE CAPAS ---
document.getElementById('btn-hojas').addEventListener('click', (e) => { 
    showLeaves = !showLeaves; 
    e.target.classList.toggle('active-toggle', showLeaves); 
});
document.getElementById('btn-flores').addEventListener('click', (e) => { 
    showFlowers = !showFlowers; 
    e.target.classList.toggle('active-toggle', showFlowers); 
});


// --- CICLO DE VIDA DEL BONSÁI ---

function bucleAnimacion() {
    tiempoViento += 0.016; 
    
    // El Main actualiza el volumen del viento enviándole el tiempo y el valor del slider
    let intensidadVientoSlider = parseInt(document.getElementById('p-viento').value);
    audioMotor.actualizarViento(tiempoViento, intensidadVientoSlider);

    if (isZenMode && !zenPausa && arbolBase) {
        let deltaZen = 0.015; 
        
        // 1. Fase de Lógica: El árbol crece
        arbolBase.crecer(deltaZen, getParams());
        iteracionGlobal += deltaZen;
        statsDisplay.textContent = `NODOS: ${arbolBase.contarNodos()} | AÑOS: ${iteracionGlobal.toFixed(1)}`;

        // Muerte y Renacimiento automático
        if (iteracionGlobal > 18) {
            zenPausa = true;
            setTimeout(() => {
                if(isZenMode) { 
                    document.getElementById('btn-mutar').click(); 
                } 
            }, 4000); 
        }
    }

    if (arbolBase) {
        // 2. Fase de Render: El árbol se dibuja en pantalla
        arbolBase.animarYRenderizar(0, tiempoViento, intensidadVientoSlider / 100, showLeaves, showFlowers);
    }
    
    animationFrameId = requestAnimationFrame(bucleAnimacion);
}

function inicializarArbol() {
    // Limpiar SVG
    domContext.layerTree.innerHTML = ''; 
    domContext.layerLeaves.innerHTML = ''; 
    domContext.layerFlowers.innerHTML = '';
    
    // Detener bucle anterior si existe
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Plantar nueva semilla. Nota cómo le inyectamos `domContext`
    arbolBase = new Rama(0, 0, 0, -90, null, getParams(), domContext);
    
    iteracionGlobal = 0;
    zenPausa = false;
    statsDisplay.textContent = `NODOS: 1 | AÑOS: 0.0`;
    
    bucleAnimacion();
    resetTimerIdle();
}

document.getElementById('btn-reset').addEventListener('click', inicializarArbol);

// --- MODO ZEN MAIN TOGGLE ---

btnZenMain.addEventListener('click', () => {
    isZenMode = !isZenMode;
    if (isZenMode) {
        document.body.classList.add('zen-active');
        btnZenMain.classList.add('active');
        zenPausa = false;
        
        // Si el árbol ya estaba viejo al encender Zen, muta inmediatamente
        if (iteracionGlobal > 18) { 
            document.getElementById('btn-mutar').click(); 
        } 
        
        // Arrancar música si estaba activada
        audioMotor.resumeMusic();
        
    } else {
        document.body.classList.remove('zen-active');
        btnZenMain.classList.remove('active');
        
        // Pausar música al salir de Zen
        audioMotor.stopMusic();
    }
});

// --- ARRANQUE DE LA APLICACIÓN ---
window.addEventListener('DOMContentLoaded', () => {
    window.aplicarPreset('roble'); 
    
    // Auto-Start en Modo Zen
    isZenMode = true;
    document.body.classList.add('zen-active');
    btnZenMain.classList.add('active');
});
