// main.js

import { MotorAudio } from './MotorAudio.js';
import { MotorEntorno, DICCIONARIO_ENTORNO } from './MotorEntorno.js';
import { Rama, rnd, setSeed, seededRandom, DICCIONARIO_BOTANICO, PARAMETROS_MOTOR } from './MotorBonsai.js';

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
let isDying = false; 
let deathFrameId = null;

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

// --- ORQUESTADOR CINEMATOGRÁFICO: EL OCASO DEL BONSÁI ---
function iniciarMuerte(callbackRenacer) {
    if (!arbolBase || isDying) {
        if (callbackRenacer) callbackRenacer();
        return;
    }
    
    isDying = true;
    zenPausa = true;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    let hojasF = []; 
    let ramas1 = []; 
    let ramas2 = []; 
    let tronco = []; 

    let maxGen = getParams().maxGen;

    // 1. Escáner recursivo de coordenadas SVG
    function clasificar(rama) {
        rama.brotes.forEach(b => {
            b.hojas.forEach(h => {
                let tr = h.dom.getAttribute('transform');
                if(tr) {
                    let m = tr.match(/translate\(([^,]+),\s*([^)]+)\)\s*rotate\(([^)]+)\)\s*scale\(([^)]+)\)/);
                    if(m) {
                        hojasF.push({
                            dom: h.dom, x: parseFloat(m[1]), y: parseFloat(m[2]), rot: parseFloat(m[3]), scale: parseFloat(m[4]),
                            vx: (Math.random() - 0.5) * 3, vy: Math.random() * -1 - 1, fallTime: 0
                        });
                    }
                }
            });
            b.tallo.style.display = 'none'; 
        });

        rama.flora.forEach(f => {
            let tr = f.dom.getAttribute('transform');
            if(tr) {
                let m = tr.match(/translate\(([^,]+),\s*([^)]+)\)\s*rotate\(([^)]+)\)\s*scale\(([^)]+)\)/);
                if(m) {
                    hojasF.push({
                        dom: f.dom, x: parseFloat(m[1]), y: parseFloat(m[2]), rot: parseFloat(m[3]), scale: parseFloat(m[4]),
                        vx: (Math.random() - 0.5) * 2, vy: Math.random() * -2 - 1, fallTime: 0
                    });
                }
            }
        });

        let obj = {
            dom: rama.g, path: rama.path, joints: [rama.jointBase, rama.jointTip],
            x: 0, y: 0, rot: 0, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * -1 - 1,
            cx: rama.startX + (rama.endXAct - rama.startX)/2, cy: rama.startY + (rama.endYAct - rama.startY)/2,
            colorOriginal: rama.currentFill, fallTime: 0, tocandoSuelo: false
        };

        if (rama.gen >= maxGen - 2) ramas1.push(obj);
        else if (rama.gen >= maxGen - 4) ramas2.push(obj);
        else tronco.push(obj);

        rama.hijos.forEach(clasificar);
    }

    clasificar(arbolBase);
    arbolBase = null; 

    // 2. Función auxiliar para barajar arreglos (Algoritmo Fisher-Yates)
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 3. Coreografía de Tiempos (Staggering)
    shuffle(hojasF);
    hojasF.forEach((h, index) => {
        let pct = index / hojasF.length;
        // 10% caen de inmediato, 20% a los 2s, 30% a los 4s, el resto a los 5s
        if (pct < 0.10) h.fallTime = Math.random() * 500; 
        else if (pct < 0.30) h.fallTime = 2000 + Math.random() * 500; 
        else if (pct < 0.60) h.fallTime = 4000 + Math.random() * 500; 
        else h.fallTime = 5000 + Math.random() * 1000; 
    });

    shuffle(ramas1);
    ramas1.forEach((r, index) => {
        let pct = index / ramas1.length;
        // Empiezan a caer tras 7.5 segundos (cuando las hojas ya van desapareciendo)
        if (pct < 0.3) r.fallTime = 7500 + Math.random() * 500;
        else if (pct < 0.6) r.fallTime = 8500 + Math.random() * 500;
        else r.fallTime = 9000 + Math.random() * 800;
    });

    shuffle(ramas2);
    ramas2.forEach((r, index) => {
        let pct = index / ramas2.length;
        // Las ramas medianas caen entre el segundo 10 y 11.5
        if (pct < 0.5) r.fallTime = 10000 + Math.random() * 500;
        else r.fallTime = 11000 + Math.random() * 800;
    });

    // Orquestación del Sonido Acústico
    if (audioMotor.sfxEnabled) {
        setTimeout(() => audioMotor.playRamaSeca(audioMotor.audioCtx.currentTime), 7500);
        setTimeout(() => audioMotor.playRamaSeca(audioMotor.audioCtx.currentTime), 8500);
        setTimeout(() => audioMotor.playRamaSeca(audioMotor.audioCtx.currentTime), 10000);
        setTimeout(() => audioMotor.playRamaSeca(audioMotor.audioCtx.currentTime), 11000);
    }

    let startTime = performance.now();
    let groundY = 25; // Coordenada del suelo de la maceta

    // 4. Bucle Físico de Muerte
    function loopMuerte(now) {
        let elapsed = now - startTime;
        let completado = true; // Se mantendrá true solo si TODOS los elementos desaparecieron
        
        // Mantener viva la animación durante al menos 15 segundos
        if (elapsed < 15500) completado = false; 

        // FASE 1: HOJAS EN VAIVÉN
        hojasF.forEach(p => {
            if (elapsed > p.fallTime) {
                // Comienza a caer
                p.vy += 0.05; // Gravedad suave
                p.vx += Math.sin(now * 0.005 + p.y) * 0.06; // Viento oscilante (Vaivén)
                p.vx *= 0.90; // Fricción
                p.vy *= 0.95;
                
                p.x += p.vx; p.y += p.vy; p.rot += p.vx * 3;

                // Faded out visual: Desaparecen justo ANTES de tocar el suelo
                let op = parseFloat(p.dom.getAttribute('opacity') || 1);
                if (p.y > groundY - 60) { // Comienzan a volverse transparentes 60px antes del suelo
                    op = Math.max(0, (groundY - p.y) / 60); 
                }
                
                p.dom.setAttribute('transform', `translate(${p.x}, ${p.y}) rotate(${p.rot}) scale(${p.scale})`);
                p.dom.setAttribute('opacity', op);
                
                if (op <= 0) p.dom.style.display = 'none';
            }
        });

        // FASES 2 y 3: RAMAS CAYENDO, REBOTANDO Y ACOSTÁNDOSE
        function animarRamas(ramas) {
            ramas.forEach(r => {
                if (elapsed > r.fallTime) {
                    if (!r.tocandoSuelo) {
                        r.vy += 0.5; // Gravedad pesada (Madera)
                        r.x += r.vx; r.y += r.vy; r.rot += r.vx * 1.5; 

                        // Choque con el suelo
                        if (r.y + r.cy > groundY) { 
                            r.y = groundY - r.cy;
                            r.vy *= -0.4; // Rebote
                            r.vx *= 0.6;  // Fricción en el suelo
                            
                            // Gira tendiendo a la horizontalidad (90 o -90 grados)
                            let targetRot = (r.rot > 0) ? 90 : -90; 
                            r.rot += (targetRot - r.rot) * 0.15;
                            
                            // Si ya casi no tiene energía, marcamos que yace en el suelo
                            if (Math.abs(r.vy) < 1.0) r.tocandoSuelo = true;
                        }
                    }

                    let op = parseFloat(r.dom.getAttribute('opacity') || 1);
                    
                    // Cuando ya yace en el suelo, se desvanece
                    if (r.tocandoSuelo) {
                        op -= 0.02; // Fade out rápido
                    }

                    r.dom.setAttribute('transform', `translate(${r.x}, ${r.y}) rotate(${r.rot}, ${r.cx}, ${r.cy})`);
                    r.dom.setAttribute('opacity', Math.max(0, op));
                    
                    if (op <= 0) r.dom.style.display = 'none';
                }
            });
        }

        animarRamas(ramas1);
        animarRamas(ramas2);

        // FASE 4: NECROSIS DEL TRONCO Y FADE OUT
        if (elapsed > 12500) {
            let pProgreso = Math.min(1, (elapsed - 12500) / 2500); // Tarda 2.5s en ennegrecerse
            
            tronco.forEach(r => {
                let match = r.colorOriginal.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (match) {
                    // Transición suave hacia casi negro (RGB 10,10,10)
                    let rFill = Math.max(10, match[1] * (1 - pProgreso));
                    let gFill = Math.max(10, match[2] * (1 - pProgreso));
                    let bFill = Math.max(10, match[3] * (1 - pProgreso));
                    let newColor = `rgb(${rFill},${gFill},${bFill})`; 
                    r.path.setAttribute('fill', newColor);
                    r.joints.forEach(j => j.setAttribute('fill', newColor));
                }
                
                // Desvanecimiento final al último segundo
                if (elapsed > 14500) { 
                    let opFinal = 1 - ((elapsed - 14500) / 1000);
                    r.dom.setAttribute('opacity', Math.max(0, opFinal));
                    if (opFinal <= 0) r.dom.style.display = 'none';
                }
            });
        }

        if (!completado) {
            deathFrameId = requestAnimationFrame(loopMuerte);
        } else {
            isDying = false;
            if (callbackRenacer) callbackRenacer(); 
        }
    }
    
    deathFrameId = requestAnimationFrame(loopMuerte);
}
// ---------------------------------------------


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

function arrancarAudioSilencioso() {
    if(!audioIniciado) {
        audioIniciado = true;
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

document.getElementById('btn-reset').addEventListener('click', () => {
    if(isDying) return;
    iniciarMuerte(inicializarArbol);
});

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

document.getElementById('btn-hojas').addEventListener('click', (e) => { showLeaves = !showLeaves; e.target.classList.toggle('active-toggle', showLeaves); });
document.getElementById('btn-flores').addEventListener('click', (e) => { showFlowers = !showFlowers; e.target.classList.toggle('active-toggle', showFlowers); });
document.getElementById('btn-sfx').addEventListener('click', (e) => { const activado = audioMotor.toggleSfx(); e.target.classList.toggle('active-toggle', activado); e.target.innerHTML = activado ? "🍃 SFX: ON" : "🍃 SFX: OFF"; });
document.getElementById('btn-music').addEventListener('click', (e) => { const activado = audioMotor.toggleMusic(); e.target.classList.toggle('active-toggle', activado); e.target.innerHTML = activado ? "🎵 MÚSICA: ON" : "🎵 MÚSICA: OFF"; });
document.getElementById('btn-fondo').addEventListener('click', (e) => { const activado = entornoMotor.toggleSky(); e.target.classList.toggle('active-toggle', activado); e.target.innerHTML = activado ? "🌅 CIELO: ON" : "🌅 CIELO: OFF"; });

document.getElementById('btn-mutar').addEventListener('click', () => {
    if (isDying) return;
    
    iniciarMuerte(() => {
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
        
        let inputSemilla = document.getElementById('input-semilla');
        if(inputSemilla) inputSemilla.value = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        updatePot();
        inicializarArbol();
    });
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
    if(isDying) return;
    iniciarMuerte(() => {
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
        
        let inputSemilla = document.getElementById('input-semilla');
        if(inputSemilla) inputSemilla.value = tipo.toUpperCase() + "-" + Math.floor(Math.random()*99);
        
        updatePot();
        inicializarArbol();
    });
}

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
                setTimeout(() => { if(isZenMode) document.getElementById('btn-mutar').click(); }, 2000); 
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
    
    let inputSemilla = document.getElementById('input-semilla');
    if (inputSemilla) {
        let textoSemilla = inputSemilla.value.trim().toUpperCase();
        if (!textoSemilla) {
            textoSemilla = Math.random().toString(36).substring(2, 8).toUpperCase();
            inputSemilla.value = textoSemilla;
        }
        setSeed(textoSemilla);
        
        const url = new URL(window.location);
        url.searchParams.set('seed', textoSemilla);
        window.history.replaceState({}, '', url);
    }
    
    arbolBase = new Rama(0, 0, 0, -90, null, getParams(), domContext);
    iteracionGlobal = 0;
    zenPausa = false;
    statsDisplay.textContent = `NODOS: 1 | AÑOS: 0.0`;
    
    bucleAnimacion();
}

window.addEventListener('DOMContentLoaded', () => {
    construirInterfaz();
    
    const urlParams = new URLSearchParams(window.location.search);
    const semillaURL = urlParams.get('seed');
    let inputSemilla = document.getElementById('input-semilla');
    if (semillaURL && inputSemilla) {
        inputSemilla.value = semillaURL.toUpperCase();
    }

    let btnCopiar = document.getElementById('btn-copiar-semilla');
    if (btnCopiar) {
        btnCopiar.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                btnCopiar.innerHTML = "✓";
                setTimeout(() => btnCopiar.innerHTML = "🔗", 2000);
            });
        });
    }

    window.aplicarPreset('pino'); 
    
    isZenMode = true;
    document.body.classList.add('zen-active');
    btnZenMain.classList.add('active');
    
    isAutoGrowing = true;
    btnAuto.classList.add('active-toggle');
    btnAuto.innerHTML = "Auto-Crecer: ON";

    let btnFondo = document.getElementById('btn-fondo');
    if (btnFondo && !btnFondo.classList.contains('active-toggle')) {
        btnFondo.click();
    }
    
    solicitarWakeLock();
    resetTimerIdle();
});
