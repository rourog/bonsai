// main.js

import { MotorAudio } from './MotorAudio.js';
import { MotorEntorno, DICCIONARIO_ENTORNO } from './MotorEntorno.js';
import { Rama, rnd, DICCIONARIO_BOTANICO, PARAMETROS_MOTOR } from './MotorBonsai.js';

const domContext = {
    layerPot: document.getElementById('layer-pot'),
    layerTree: document.getElementById('layer-tree'),
    layerLeaves: document.getElementById('layer-leaves'),
    layerFlowers: document.getElementById('layer-flowers')
};

const audioMotor = new MotorAudio();
const entornoMotor = new MotorEntorno(domContext);
domContext.audioMotor = audioMotor;

let arbolBase = null;
let animationFrameId = null;
let iteracionGlobal = 0;
let tiempoViento = 0;

let isZenMode = false;
let isAutoGrowing = false;
let zenPausa = false;

let wakeLock = null; 
let idleTimeout = null;
let showLeaves = true;
let showFlowers = true;
let audioIniciado = false;

const statsDisplay = document.getElementById('stats');
const btnZenMain = document.getElementById('btn-zen-main');
const dashboard = document.getElementById('dashboard');
const btnAuto = document.getElementById('btn-auto');

const ESTADO_CICLICO = {}; 

function construirInterfaz() {
    const contenedorMorfologia = document.getElementById('ui-morfologia');
    const contenedorParametros = document.getElementById('ui-parametros');

    let htmlCiclicos = `<div class="grid-2">`;
    htmlCiclicos += crearBotonCiclico('p-maceta-forma', 'Maceta', DICCIONARIO_ENTORNO.macetas);
    htmlCiclicos += crearBotonCiclico('p-maceta-color', 'Color', DICCIONARIO_ENTORNO.esmaltes);
    htmlCiclicos += crearBotonCiclico('p-forma', 'Hoja', DICCIONARIO_BOTANICO.hojas);
    htmlCiclicos += crearBotonCiclico('p-flora', 'Flora', DICCIONARIO_BOTANICO.flora);
    htmlCiclicos += `</div>`;
    
    contenedorMorfologia.innerHTML = htmlCiclicos;

    let htmlParams = '';
    PARAMETROS_MOTOR.forEach(param => {
        const isDecimal = param.step % 1 !== 0;
        const valTxt = isDecimal ? param.default.toFixed(1) : param.default;
        const colorStyle = param.color ? `style="color: ${param.color};"` : '';
        htmlParams += `
            <div class="control-group">
                <label><span ${colorStyle}>${param.label}</span> <span id="val-${param.id}" ${colorStyle}>${valTxt}</span></label>
                <input type="range" id="${param.id}" data-key="${param.key}" min="${param.min}" max="${param.max}" step="${param.step}" value="${param.default}">
            </div>
        `;
    });
    contenedorParametros.innerHTML = htmlParams;

    ['p-maceta-forma', 'p-maceta-color', 'p-forma', 'p-flora'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.addEventListener('click', (e) => {
                let state = ESTADO_CICLICO[id];
                state.index = (state.index + 1) % state.opciones.length; 
                let opt = state.opciones[state.index];
                
                e.currentTarget.setAttribute('data-value', opt.id);
                e.currentTarget.innerHTML = `${state.prefix}: <span>${opt.nombre}</span>`;
                
                if(id.startsWith('p-maceta')) updatePot();
            });
        }
    });

    document.querySelectorAll('#ui-parametros input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
            const isDecimal = e.target.step % 1 !== 0;
            let val = isDecimal ? parseFloat(e.target.value).toFixed(1) : e.target.value;
            if(isDecimal && Number.isInteger(parseFloat(val))) val += ".0";
            document.getElementById(`val-${e.target.id}`).textContent = val;
        });
    });
}

function crearBotonCiclico(id, prefix, opciones) {
    ESTADO_CICLICO[id] = { index: 0, opciones, prefix }; 
    return `<button id="${id}" class="action-btn cyclic-btn" data-value="${opciones[0].id}">${prefix}: <span>${opciones[0].nombre}</span></button>`;
}

export function getParams() {
    const params = {
        formaHoja: document.getElementById('p-forma') ? document.getElementById('p-forma').getAttribute('data-value') : 'ovalada',
        tipoFlora: document.getElementById('p-flora') ? document.getElementById('p-flora').getAttribute('data-value') : 'ninguno',
    };
    
    PARAMETROS_MOTOR.forEach(p => {
        let el = document.getElementById(p.id);
        if(el) {
            let rawVal = el.value;
            if (p.id === 'p-branch' || p.id === 'p-acc' || p.id === 'p-viento' || p.id === 'p-lenVar') {
                params[p.key] = parseFloat(rawVal) / 100;
            } else {
                params[p.key] = parseFloat(rawVal);
            }
        }
    });
    return params;
}

function actualizarUI(id, valor) {
    let el = document.getElementById(id);
    if(!el) return;
    
    if(el.classList.contains('cyclic-btn')) {
        let state = ESTADO_CICLICO[id];
        let newIndex = state.opciones.findIndex(o => o.id === valor);
        if(newIndex !== -1) {
            state.index = newIndex;
            el.setAttribute('data-value', valor);
            el.innerHTML = `${state.prefix}: <span>${state.opciones[newIndex].nombre}</span>`;
        }
    } else {
        el.value = valor;
        el.dispatchEvent(new Event('input'));
    }
}

const updatePot = () => {
    let elForma = document.getElementById('p-maceta-forma');
    let elColor = document.getElementById('p-maceta-color');
    if(elForma && elColor) {
        entornoMotor.renderizarMaceta(elForma.getAttribute('data-value'), elColor.getAttribute('data-value'));
    }
};

async function solicitarWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (err) { }
}

function liberarWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock === null && document.visibilityState === 'visible' && isZenMode) {
        solicitarWakeLock();
    }
});

// --- SOLUCIÓN: ARRANQUE SEGURO DEL AUDIO ---
function arrancarAudioSilencioso() {
    if(!audioIniciado) {
        audioIniciado = true;
        // En lugar de llamar funciones del motor directamente y arriesgar un crash,
        // forzamos el clic en los botones para que la Interfaz haga el trabajo sucio.
        let btnSfx = document.getElementById('btn-sfx');
        let btnMus = document.getElementById('btn-music');
        
        if (btnSfx && !btnSfx.classList.contains('active-toggle')) btnSfx.click();
        if (btnMus && !btnMus.classList.contains('active-toggle')) btnMus.click();
    }
}

function resetTimerIdle() {
    document.body.classList.remove('zen-idle');
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => { 
        if (isZenMode) document.body.classList.add('zen-idle'); 
    }, 5000);
}

window.addEventListener('mousemove', resetTimerIdle);
window.addEventListener('touchstart', () => {
    arrancarAudioSilencioso();
    resetTimerIdle();
}, { passive: true });
window.addEventListener('click', () => {
    arrancarAudioSilencioso();
    resetTimerIdle();
});

document.getElementById('btn-open-config').addEventListener('click', (e) => { e.stopPropagation(); dashboard.classList.add('open'); });
document.getElementById('btn-close-config').addEventListener('click', (e) => { e.stopPropagation(); dashboard.classList.remove('open'); });
document.getElementById('btn-reset').addEventListener('click', inicializarArbol);

document.getElementById('btn-step').addEventListener('click', () => {
    if(arbolBase && iteracionGlobal <= 18) {
        arbolBase.crecer(1.0, getParams());
        iteracionGlobal += 1.0;
        statsDisplay.textContent = `NODOS: ${arbolBase.contarNodos()} | AÑOS: ${iteracionGlobal.toFixed(1)}`;
    }
});

btnAuto.addEventListener('click', (e) => {
    isAutoGrowing = !isAutoGrowing;
    if(isAutoGrowing) {
        e.target.classList.add('active-toggle');
        e.target.innerHTML = "Auto-Crecer: ON";
    } else {
        e.target.classList.remove('active-toggle');
        e.target.innerHTML = "Auto-Crecer: OFF";
    }
});

document.getElementById('btn-hojas').addEventListener('click', (e) => { 
    showLeaves = !showLeaves; 
    e.target.classList.toggle('active-toggle', showLeaves); 
});
document.getElementById('btn-flores').addEventListener('click', (e) => { 
    showFlowers = !showFlowers; 
    e.target.classList.toggle('active-toggle', showFlowers); 
});

document.getElementById('btn-sfx').addEventListener('click', (e) => {
    const activado = audioMotor.toggleSfx();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🍃 SFX: ON" : "🍃 SFX: OFF";
});

document.getElementById('btn-music').addEventListener('click', (e) => {
    const activado = audioMotor.toggleMusic();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🎵 MÚSICA: ON" : "🎵 MÚSICA: OFF";
});

document.getElementById('btn-fondo').addEventListener('click', (e) => {
    const activado = entornoMotor.toggleSky();
    e.target.classList.toggle('active-toggle', activado);
    e.target.innerHTML = activado ? "🌅 CIELO: ON" : "🌅 CIELO: OFF";
});

btnZenMain.addEventListener('click', (e) => {
    e.stopPropagation(); 
    isZenMode = !isZenMode;
    if (isZenMode) {
        document.body.classList.add('zen-active');
        btnZenMain.classList.add('active');
        zenPausa = false;
        
        isAutoGrowing = true;
        btnAuto.classList.add('active-toggle');
        btnAuto.innerHTML = "Auto-Crecer: ON";
        
        if (iteracionGlobal > 18) { document.getElementById('btn-mutar').click(); } 
        if (audioIniciado) audioMotor.resumeMusic();
        
        solicitarWakeLock();
        resetTimerIdle(); 
    } else {
        document.body.classList.remove('zen-active');
        document.body.classList.remove('zen-idle');
        btnZenMain.classList.remove('active');
        audioMotor.stopMusic();
        liberarWakeLock();
    }
});

const PRESETS_BOTANICOS = {
    pino:     { mForma: 'estandar', mColor: '#c05a41', viento: 10, length: 25, lenVar: 10, angle: 20, branch: 45, acc: 10, gen: 5, hojas: 5, flor: 8, forma: 'huso', flora: 'ninguno', edadRam: 3.5 }, 
    roble:    { mForma: 'plana',    mColor: '#2c3e50', viento: 25, length: 18, lenVar: 30, angle: 50, branch: 75, acc: 35, gen: 6, hojas: 18, flor: 7, forma: 'ovalada', flora: 'ninguno', edadRam: 2.8 },
    arbusto:  { mForma: 'redonda',  mColor: '#458b74', viento: 30, length: 8,  lenVar: 50, angle: 75, branch: 95, acc: 70, gen: 4, hojas: 25, flor: 4, forma: 'circular', flora: 'baya-roja', edadRam: 1.5 },
    cipres:   { mForma: 'alta',     mColor: '#8c8c91', viento: 15, length: 15, lenVar: 15, angle: 10, branch: 80, acc: 50, gen: 6, hojas: 8, flor: 8, forma: 'larga', flora: 'ninguno', edadRam: 3.0 },
    cerezo:   { mForma: 'redonda',  mColor: '#2c3e50', viento: 40, length: 17, lenVar: 40, angle: 45, branch: 70, acc: 25, gen: 6, hojas: 4, flor: 5, forma: 'ovalada', flora: 'flor-rosa', edadRam: 2.5 },
    limonero: { mForma: 'redonda',  mColor: '#c05a41', viento: 20, length: 16, lenVar: 25, angle: 55, branch: 75, acc: 30, gen: 5, hojas: 16, flor: 5, forma: 'ovalada', flora: 'limon', edadRam: 2.8 }
};

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
    const fMaceta = DICCIONARIO_ENTORNO.macetas[Math.floor(Math.random() * DICCIONARIO_ENTORNO.macetas.length)].id;
    const cMaceta = DICCIONARIO_ENTORNO.esmaltes[Math.floor(Math.random() * DICCIONARIO_ENTORNO.esmaltes.length)].id;
    const fHoja = DICCIONARIO_BOTANICO.hojas[Math.floor(Math.random() * DICCIONARIO_BOTANICO.hojas.length)].id;
    const tFlora = DICCIONARIO_BOTANICO.flora[Math.floor(Math.random() * DICCIONARIO_BOTANICO.flora.length)].id;
    
    actualizarUI('p-maceta-forma', fMaceta);
    actualizarUI('p-maceta-color', cMaceta);
    actualizarUI('p-forma', fHoja);
    actualizarUI('p-flora', tFlora);
    
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

function bucleAnimacion() {
    tiempoViento += 0.016; 
    let paramsActuales = getParams();
    
    audioMotor.actualizarViento(tiempoViento, paramsActuales.viento * 100);

    if ((isZenMode || isAutoGrowing) && !zenPausa && arbolBase) {
        let deltaZen = 0.015; 
        arbolBase.crecer(deltaZen, paramsActuales);
        iteracionGlobal += deltaZen;
        statsDisplay.textContent = `NODOS: ${arbolBase.contarNodos()} | AÑOS: ${iteracionGlobal.toFixed(1)}`;

        if (iteracionGlobal > 18) {
            zenPausa = true;
            if(isZenMode) {
                setTimeout(() => { if(isZenMode) { document.getElementById('btn-mutar').click(); } }, 4000); 
            } else {
                isAutoGrowing = false;
                btnAuto.classList.remove('active-toggle');
                btnAuto.innerHTML = "Auto-Crecer: OFF";
            }
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
}

window.addEventListener('DOMContentLoaded', () => {
    construirInterfaz();
    window.aplicarPreset('pino'); 
    
    isZenMode = true;
    document.body.classList.add('zen-active');
    btnZenMain.classList.add('active');
    
    isAutoGrowing = true;
    btnAuto.classList.add('active-toggle');
    btnAuto.innerHTML = "Auto-Crecer: ON";
    
    solicitarWakeLock();
    resetTimerIdle();
});
