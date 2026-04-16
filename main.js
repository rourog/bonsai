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
let muerteProgramada = false; 

let wakeLock = null; 
let idleTimeout = null;
let showLeaves = true;
let showFlowers = true;

const statsDisplay = document.getElementById('stats');
const btnZenMain = document.getElementById('btn-zen-main');
const dashboard = document.getElementById('dashboard');
const btnAuto = document.getElementById('btn-auto');

const ESTADO_CICLICO = {}; 

function guardarAjustes() {
    const state = { ui: {}, toggles: { showLeaves, showFlowers } };
    document.querySelectorAll('#ui-parametros input[type="range"]').forEach(el => state.ui[el.id] = el.value);
    ['p-maceta-forma', 'p-maceta-color', 'p-forma', 'p-flora'].forEach(id => {
        const el = document.getElementById(id);
        if(el) state.ui[id] = el.getAttribute('data-value');
    });
    localStorage.setItem('bonsai_zen_prefs', JSON.stringify(state));
}

function cargarAjustes() {
    const saved = localStorage.getItem('bonsai_zen_prefs');
    if(!saved) return false; 
    try {
        const state = JSON.parse(saved);
        for(let id in state.ui) actualizarUI(id, state.ui[id], false); 
        if (state.toggles) {
            showLeaves = state.toggles.showLeaves !== undefined ? state.toggles.showLeaves : true;
            showFlowers = state.toggles.showFlowers !== undefined ? state.toggles.showFlowers : true;
            const btnHojas = document.getElementById('btn-hojas');
            const btnFlores = document.getElementById('btn-flores');
            if(btnHojas) btnHojas.classList.toggle('active-toggle', showLeaves);
            if(btnFlores) btnFlores.classList.toggle('active-toggle', showFlowers);
        }
        updatePot();
        return true;
    } catch(e) { return false; }
}

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
                guardarAjustes(); 
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
        input.addEventListener('change', () => guardarAjustes());
    });
    
    const inputSemilla = document.getElementById('input-semilla');
    if(inputSemilla) {
        inputSemilla.addEventListener('change', () => { 
            if(arbolBase && !isDying) iniciarMuerte(inicializarArbol);
        });
    }
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

function actualizarUI(id, valor, triggerSave = true) {
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
    if(triggerSave) guardarAjustes();
}

const updatePot = () => {
    let elForma = document.getElementById('p-maceta-forma');
    let elColor = document.getElementById('p-maceta-color');
    if(elForma && elColor) {
        entornoMotor.renderizarMaceta(elForma.getAttribute('data-value'), elColor.getAttribute('data-value'));
    }
};

// --- CALIBRACIÓN DE MUTACIÓN PARA ÁRBOLES FRONDOSOS ---
function ejecutarMutacion() {
    if (isDying) return;
    iniciarMuerte(() => {
        const fMaceta = DICCIONARIO_ENTORNO.macetas[Math.floor(Math.random() * DICCIONARIO_ENTORNO.macetas.length)].id;
        const cMaceta = DICCIONARIO_ENTORNO.esmaltes[Math.floor(Math.random() * DICCIONARIO_ENTORNO.esmaltes.length)].id;
        const fHoja = DICCIONARIO_BOTANICO.hojas[Math.floor(Math.random() * DICCIONARIO_BOTANICO.hojas.length)].id;
        
        // Reducimos las posibilidades de que un árbol nazca "sin flora" (solo 10% de probabilidad)
        let poolFlora = DICCIONARIO_BOTANICO.flora;
        if (Math.random() > 0.10) poolFlora = poolFlora.filter(f => f.id !== 'ninguno');
        const tFlora = poolFlora[Math.floor(Math.random() * poolFlora.length)].id;
        
        actualizarUI('p-maceta-forma', fMaceta, false);
        actualizarUI('p-maceta-color', cMaceta, false);
        actualizarUI('p-forma', fHoja, false);
        actualizarUI('p-flora', tFlora, false);
        
        actualizarUI('p-viento', Math.floor(Math.random() * 50 + 10), false);
        
        // CLAVE 1: Edad de ramificación más rápida (1.2 a 2.6). Forma la estructura antes de morir.
        actualizarUI('p-edadRam', (Math.random() * 1.4 + 1.2).toFixed(1), false);
        
        actualizarUI('p-length', Math.floor(Math.random() * 15 + 12), false); 
        actualizarUI('p-lenVar', Math.floor(Math.random() * 50 + 10), false); 
        actualizarUI('p-angle', Math.floor(Math.random() * 45 + 25), false);
        
        // CLAVE 2: Alta probabilidad de ramificación para evitar palos pelados (65% a 95%)
        actualizarUI('p-branch', Math.floor(Math.random() * 30 + 65), false); 
        actualizarUI('p-acc', Math.floor(Math.random() * 40 + 20), false); 
        actualizarUI('p-gen', Math.floor(Math.random() * 2 + 4), false); 
        
        // CLAVE 3: Follaje denso (10 a 30 hojas por brote garantizadas)
        actualizarUI('p-hojas', Math.floor(Math.random() * 20 + 10), false); 
        
        // CLAVE 4: Floración temprana (Año 2 a 3). Garantiza que salgan antes del reseteo del año 18.
        actualizarUI('p-flor', Math.floor(Math.random() * 2 + 2), false); 
        
        let inputSemilla = document.getElementById('input-semilla');
        if(inputSemilla) inputSemilla.value = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        updatePot(); guardarAjustes(); inicializarArbol();
    });
}

function iniciarMuerte(callbackRenacer) {
    if (!arbolBase || isDying) {
        if (callbackRenacer) callbackRenacer();
        return;
    }
    
    isDying = true;
    zenPausa = true;

    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }

    let hojasF = []; let ramasPorGen = {}; let maxGenActual = 0;

    function clasificar(rama) {
        maxGenActual = Math.max(maxGenActual, rama.gen);
        if (!ramasPorGen[rama.gen]) ramasPorGen[rama.gen] = [];

        rama.brotes.forEach(b => {
            b.hojas.forEach(h => {
                let tr = h.dom.getAttribute('transform');
                if(tr) {
                    let m = tr.match(/translate\(([^,]+),\s*([^)]+)\)\s*rotate\(([^)]+)\)\s*scale\(([^)]+)\)/);
                    if(m) {
                        hojasF.push({
                            dom: h.dom, x: parseFloat(m[1]), y: parseFloat(m[2]), rot: parseFloat(m[3]), scale: parseFloat(m[4]),
                            vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 0.5, fallTime: 0,
                            startOpacity: parseFloat(h.dom.getAttribute('opacity') || 1)
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
                        vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 0.5, fallTime: 0,
                        startOpacity: parseFloat(f.dom.getAttribute('opacity') || 1)
                    });
                }
            }
        });

        let obj = { dom: rama.g, path: rama.path, joints: [rama.jointBase, rama.jointTip], x: 0, y: 0, rot: 0, vx: (Math.random() - 0.5) * 2, vy: Math.random() * -0.5, cx: rama.startX + (rama.endXAct - rama.startX)/2, cy: rama.startY + (rama.endYAct - rama.startY)/2, colorOriginal: rama.currentFill, fallTime: 0, tocandoSuelo: false, isBroken: false, isEarlySplintered: false, ramaRef: rama };
        ramasPorGen[rama.gen].push(obj); rama.hijos.forEach(clasificar);
    }

    clasificar(arbolBase); arbolBase = null; 

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
    }

    shuffle(hojasF);
    hojasF.forEach((h, i) => {
        let pct = i / hojasF.length;
        if (pct < 0.33) h.fallTime = Math.random() * 300;           
        else if (pct < 0.66) h.fallTime = 800 + Math.random() * 300;  
        else h.fallTime = 1600 + Math.random() * 300;                 
    });

    let ramasFlat = []; let tronco = []; let fallTimeCursor = 2500; let primerQuiebreTime = 0; 
    
    for (let g = maxGenActual; g >= 0; g--) {
        if (ramasPorGen[g]) {
            if (g <= 2) { tronco.push(...ramasPorGen[g]); } 
            else {
                ramasPorGen[g].forEach(r => {
                    r.fallTime = fallTimeCursor + Math.random() * 150;
                    r.breakTime = r.fallTime - 400; 
                    ramasFlat.push(r);
                });
                if (primerQuiebreTime === 0) primerQuiebreTime = fallTimeCursor;
                fallTimeCursor += 500; 
                if (audioMotor.sfxEnabled) {
                    let audioTime = fallTimeCursor - 400; 
                    setTimeout(() => audioMotor.playRamaSeca(audioMotor.audioCtx.currentTime), Math.max(0, audioTime));
                }
            }
        }
    }
    
    if (primerQuiebreTime === 0) primerQuiebreTime = 2500; 
    let trunkTime = fallTimeCursor + 400; let todasLasRamas = [...ramasFlat, ...tronco]; 
    let startTime = performance.now();
    let basePotY = entornoMotor.macetaActual ? entornoMotor.macetaActual.baseY : 35;
    let groundY = basePotY + 10; 

    function loopMuerte(now) {
        let elapsed = now - startTime; let completado = true;

        todasLasRamas.forEach(r => {
            if (elapsed > 50 && !r.isEarlySplintered && r.ramaRef.gen < maxGenActual) {
                r.isEarlySplintered = true; let ref = r.ramaRef;
                let dx = ref.endXAct - ref.startX; let dy = ref.endYAct - ref.startY; let len = Math.hypot(dx, dy);
                if (len > 0) {
                    let nxDir = dx / len; let nyDir = dy / len;
                    let currentD = r.path.getAttribute("d");
                    let regex = /M\s+([^ ]+)\s+([^ ]+)\s+Q\s+([^ ]+)\s+([^ ]+)\s+([^ ]+)\s+([^ ]+)\s+L\s+([^ ]+)\s+([^ ]+)\s+Q\s+([^ ]+)\s+([^ ]+)\s+([^ ]+)\s+([^ ]+)\s+Z/i;
                    let m = currentD.match(regex);
                    if (m) {
                        let bx1 = parseFloat(m[1]), by1 = parseFloat(m[2]); let cx1 = parseFloat(m[3]), cy1 = parseFloat(m[4]); let px1 = parseFloat(m[5]), py1 = parseFloat(m[6]); let px2 = parseFloat(m[7]), py2 = parseFloat(m[8]); let cx2 = parseFloat(m[9]), cy2 = parseFloat(m[10]); let bx2 = parseFloat(m[11]), by2 = parseFloat(m[12]);
                        let vtipX = px2 - px1; let vtipY = py2 - py1; let rFin = ref.grosorPuntaAct / 2; let spikeLen = rFin * 1.5; 
                        let s1x = px1 + vtipX*0.2 + nxDir*spikeLen*(0.8+Math.random()*0.5); let s1y = py1 + vtipY*0.2 + nyDir*spikeLen*(0.8+Math.random()*0.5);
                        let s2x = px1 + vtipX*0.5 + nxDir*spikeLen*(0.2+Math.random()*0.4); let s2y = py1 + vtipY*0.5 + nyDir*spikeLen*(0.2+Math.random()*0.4);
                        let s3x = px1 + vtipX*0.8 + nxDir*spikeLen*(0.8+Math.random()*0.5); let s3y = py1 + vtipY*0.8 + nyDir*spikeLen*(0.8+Math.random()*0.5);
                        let newD = `M ${bx1} ${by1} Q ${cx1} ${cy1} ${px1} ${py1} L ${s1x} ${s1y} L ${s2x} ${s2y} L ${s3x} ${s3y} L ${px2} ${py2} Q ${cx2} ${cy2} ${bx2} ${by2} Z`;
                        r.path.setAttribute("d", newD); r.joints[1].style.display = 'none'; 
                    }
                }
            }
        });

        hojasF.forEach(p => {
            if (p.dom.style.display !== 'none') {
                completado = false;
                if (elapsed > p.fallTime) {
                    let age = elapsed - p.fallTime; 
                    p.vy += 0.03; p.vx += Math.sin(now * 0.003 + p.y) * 0.05; p.vx *= 0.92; p.vy *= 0.95; p.x += p.vx; p.y += p.vy; p.rot += p.vx * 2;
                    let op = p.startOpacity; if (age > 700) op = Math.max(0, p.startOpacity * (1 - (age - 700) / 600));
                    p.dom.setAttribute('transform', `translate(${p.x}, ${p.y}) rotate(${p.rot}) scale(${p.scale})`);
                    p.dom.setAttribute('opacity', op); if (op <= 0) p.dom.style.display = 'none'; 
                }
            }
        });

        ramasFlat.forEach(r => {
            if (r.dom.style.display !== 'none') {
                completado = false;
                if (elapsed > r.breakTime && !r.isBroken) {
                    r.isBroken = true; let ref = r.ramaRef;
                    let dx = ref.endXAct - ref.startX; let dy = ref.endYAct - ref.startY; let len = Math.hypot(dx, dy);
                    if (len > 0) {
                        let nx = -dy / len; let ny = dx / len; let nxDir = dx / len; let nyDir = dy / len;
                        let rBase = (ref.grosorBaseAct / 2) * 0.95; let rFin = ref.grosorPuntaAct / 2;
                        let bx1 = ref.startX + nx * rBase; let by1 = ref.startY + ny * rBase; let bx2 = ref.startX - nx * rBase; let by2 = ref.startY - ny * rBase;
                        let px1 = ref.endXAct + nx * rFin; let py1 = ref.endYAct + ny * rFin; let px2 = ref.endXAct - nx * rFin; let py2 = ref.endYAct - ny * rFin;
                        let vtipX = px2 - px1; let vtipY = py2 - py1;
                        let j1x = ref.startX + dx*0.3 + nx*(Math.random()-0.5)*rBase*1.2; let j1y = ref.startY + dy*0.3 + ny*(Math.random()-0.5)*rBase*1.2;
                        let j2x = ref.startX + dx*0.7 + nx*(Math.random()-0.5)*rBase*1.2; let j2y = ref.startY + dy*0.7 + ny*(Math.random()-0.5)*rBase*1.2;

                        let sharpPath = `M ${bx1} ${by1} L ${j1x} ${j1y} L ${j2x} ${j2y} L ${px1} ${py1}`;
                        if (ref.gen < maxGenActual) {
                            let spikeLen = rFin * 1.5;
                            let s1x = px1 + vtipX*0.2 + nxDir*spikeLen*(0.8+Math.random()*0.5); let s1y = py1 + vtipY*0.2 + nyDir*spikeLen*(0.8+Math.random()*0.5);
                            let s2x = px1 + vtipX*0.5 + nxDir*spikeLen*(0.2+Math.random()*0.4); let s2y = py1 + vtipY*0.5 + nyDir*spikeLen*(0.2+Math.random()*0.4);
                            let s3x = px1 + vtipX*0.8 + nxDir*spikeLen*(0.8+Math.random()*0.5); let s3y = py1 + vtipY*0.8 + nyDir*spikeLen*(0.8+Math.random()*0.5);
                            sharpPath += ` L ${s1x} ${s1y} L ${s2x} ${s2y} L ${s3x} ${s3y}`;
                        } else { sharpPath += ` L ${ref.endXAct} ${ref.endYAct}`; }
                        sharpPath += ` L ${px2} ${py2} L ${j1x - nx*rBase} ${j1y - ny*rBase} L ${bx2} ${by2} Z`;
                        r.path.setAttribute("d", sharpPath); r.joints.forEach(j => j.style.display = 'none');
                    }
                }
                
                if (elapsed > r.fallTime) {
                    let age = elapsed - r.fallTime;
                    if (!r.tocandoSuelo) {
                        r.vy += 0.6; r.x += r.vx; r.y += r.vy; r.rot += r.vx * 1.5;
                        if (r.y + r.cy > groundY) {
                            r.y = groundY - r.cy; r.vy *= -0.3; r.vx *= 0.5;
                            let targetRot = (r.rot > 0) ? 90 : -90; r.rot += (targetRot - r.rot) * 0.2;
                            if (Math.abs(r.vy) < 1.0) r.tocandoSuelo = true;
                        }
                    }
                    let op = 1; if (age > 800) op = Math.max(0, 1 - (age - 800) / 400);
                    r.dom.setAttribute('transform', `translate(${r.x}, ${r.y}) rotate(${r.rot}, ${r.cx}, ${r.cy})`);
                    r.dom.setAttribute('opacity', op); if (op <= 0) r.dom.style.display = 'none';
                }
            }
        });

        if (elapsed > trunkTime) {
            let pProgreso = Math.min(1, (elapsed - trunkTime) / 1000); 
            tronco.forEach(r => {
                if (r.dom.style.display !== 'none') {
                    completado = false; let match = r.colorOriginal.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                    if (match) {
                        let rFill = Math.max(15, match[1] * (1 - pProgreso)); let gFill = Math.max(15, match[2] * (1 - pProgreso)); let bFill = Math.max(15, match[3] * (1 - pProgreso));
                        let newColor = `rgb(${rFill},${gFill},${bFill})`; 
                        r.path.setAttribute('fill', newColor); r.joints[0].setAttribute('fill', newColor); 
                    }
                }
            });
            if (elapsed > trunkTime + 1000) {
                let opFinal = 1 - ((elapsed - (trunkTime + 1000)) / 800); 
                domContext.layerTree.setAttribute('opacity', Math.max(0, opFinal));
                if (opFinal <= 0) tronco.forEach(r => r.dom.style.display = 'none');
            }
        } else {
            if (tronco.length > 0) completado = false; 
        }

        if (!completado) {
            deathFrameId = requestAnimationFrame(loopMuerte);
        } else {
            isDying = false; if (callbackRenacer) callbackRenacer(); 
        }
    }
    deathFrameId = requestAnimationFrame(loopMuerte);
}

// --- UTILIDADES ---
async function solicitarWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (err) { }
}

function liberarWakeLock() { if (wakeLock !== null) { wakeLock.release(); wakeLock = null; } }
document.addEventListener('visibilitychange', async () => { if (wakeLock === null && document.visibilityState === 'visible' && isZenMode) solicitarWakeLock(); });

function arrancarAudioSilencioso() {
    if (audioMotor && audioMotor.audioCtx && audioMotor.audioCtx.state === 'suspended') {
        audioMotor.audioCtx.resume();
    }
}

function resetTimerIdle() {
    document.body.classList.remove('zen-idle');
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => { if (isZenMode) document.body.classList.add('zen-idle'); }, 5000);
}

window.addEventListener('mousemove', (e) => { if (!e.isTrusted) return; arrancarAudioSilencioso(); resetTimerIdle(); });
window.addEventListener('touchstart', (e) => { if (!e.isTrusted) return; arrancarAudioSilencioso(); resetTimerIdle(); }, { passive: true });
window.addEventListener('click', (e) => { if (!e.isTrusted) return; arrancarAudioSilencioso(); resetTimerIdle(); });

const btnOpenConfig = document.getElementById('btn-open-config');
if(btnOpenConfig) btnOpenConfig.addEventListener('click', (e) => { e.stopPropagation(); dashboard.classList.add('open'); });

const btnCloseConfig = document.getElementById('btn-close-config');
if(btnCloseConfig) btnCloseConfig.addEventListener('click', (e) => { e.stopPropagation(); dashboard.classList.remove('open'); });

const btnReset = document.getElementById('btn-reset');
if(btnReset) btnReset.addEventListener('click', () => { if(!isDying) iniciarMuerte(inicializarArbol); });

const btnStep = document.getElementById('btn-step');
if(btnStep) {
    btnStep.addEventListener('click', () => {
        if(isDying) return;
        if(isAutoGrowing) {
            isAutoGrowing = false;
            if(btnAuto) { btnAuto.classList.remove('active-toggle'); btnAuto.innerHTML = '<span class="material-symbols-rounded">play_arrow</span> AUTO: OFF'; }
        }
        if(arbolBase && iteracionGlobal <= 18) {
            arbolBase.crecer(1.0, getParams()); iteracionGlobal += 1.0;
            statsDisplay.textContent = `NODOS: ${arbolBase.contarNodos()} | AÑOS: ${iteracionGlobal.toFixed(1)}`;
            arbolBase.animarYRenderizar(0, tiempoViento, getParams().viento, showLeaves, showFlowers);
        }
    });
}

if(btnAuto) btnAuto.addEventListener('click', (e) => {
    isAutoGrowing = !isAutoGrowing;
    if(isAutoGrowing) { e.currentTarget.classList.add('active-toggle'); e.currentTarget.innerHTML = '<span class="material-symbols-rounded">pause</span> AUTO: ON'; } 
    else { e.currentTarget.classList.remove('active-toggle'); e.currentTarget.innerHTML = '<span class="material-symbols-rounded">play_arrow</span> AUTO: OFF'; }
});

const btnHojas = document.getElementById('btn-hojas');
if(btnHojas) btnHojas.addEventListener('click', (e) => { showLeaves = !showLeaves; e.currentTarget.classList.toggle('active-toggle', showLeaves); guardarAjustes(); });

const btnFlores = document.getElementById('btn-flores');
if(btnFlores) btnFlores.addEventListener('click', (e) => { showFlowers = !showFlowers; e.currentTarget.classList.toggle('active-toggle', showFlowers); guardarAjustes(); });

function syncUI(idPanel, idQuick, activado, iconOn, iconOff, textOn, textOff) {
    const btnPanel = document.getElementById(idPanel); const btnQuick = document.getElementById(idQuick);
    if (btnPanel) { btnPanel.classList.toggle('active-toggle', activado); btnPanel.innerHTML = `<span class="material-symbols-rounded">${activado ? iconOn : iconOff}</span> ${activado ? textOn : textOff}`; }
    if (btnQuick) { btnQuick.classList.toggle('active', activado); btnQuick.innerHTML = `<span class="material-symbols-rounded">${activado ? iconOn : iconOff}</span>`; }
}

const toggleFondo = () => {
    const estado = entornoMotor.ciclarEntorno();
    let activado = estado !== 0; let textOn = 'CIELO: OFF'; let iconOn = 'image'; 
    if (estado === 1) { textOn = 'CIELO: NORM'; iconOn = 'cloud'; }
    if (estado === 2) { textOn = 'CIELO: COL'; iconOn = 'palette'; }
    if (estado === 3) { textOn = 'CIELO: LLUV'; iconOn = 'rainy'; }
    syncUI('btn-fondo', 'btn-fondo-quick', activado, iconOn, 'image', textOn, 'CIELO: OFF');
    guardarAjustes();
};

const toggleMusic = () => {
    const activado = audioMotor.toggleMusic();
    syncUI('btn-music', 'btn-music-quick', activado, 'music_note', 'music_off', 'MÚSICA: ON', 'MÚSICA: OFF');
    guardarAjustes();
};

const toggleSfx = () => {
    const activado = audioMotor.toggleSfx();
    syncUI('btn-sfx', 'btn-sfx-quick', activado, 'volume_up', 'volume_off', 'SFX: ON', 'SFX: OFF');
    guardarAjustes();
};

const btnFondo = document.getElementById('btn-fondo'); const btnFondoQuick = document.getElementById('btn-fondo-quick');
if (btnFondo) btnFondo.addEventListener('click', toggleFondo); if (btnFondoQuick) btnFondoQuick.addEventListener('click', toggleFondo);

const btnMusic = document.getElementById('btn-music'); const btnMusicQuick = document.getElementById('btn-music-quick');
if (btnMusic) btnMusic.addEventListener('click', toggleMusic); if (btnMusicQuick) btnMusicQuick.addEventListener('click', toggleMusic);

const btnSfx = document.getElementById('btn-sfx'); const btnSfxQuick = document.getElementById('btn-sfx-quick');
if (btnSfx) btnSfx.addEventListener('click', toggleSfx); if (btnSfxQuick) btnSfxQuick.addEventListener('click', toggleSfx);

const btnMutarMenu = document.getElementById('btn-mutar');
if(btnMutarMenu) btnMutarMenu.addEventListener('click', (e) => { 
    if (e && !e.isTrusted && isDying) return;
    ejecutarMutacion(); 
});

if(btnZenMain) btnZenMain.addEventListener('click', (e) => {
    if (!e.isTrusted) return; 
    e.stopPropagation(); 
    isZenMode = !isZenMode;
    
    if (isZenMode) {
        document.body.classList.add('zen-active');
        btnZenMain.classList.add('active');
        zenPausa = false;
        muerteProgramada = false; 
        
        isAutoGrowing = true;
        if(btnAuto) {
            btnAuto.classList.add('active-toggle');
            btnAuto.innerHTML = '<span class="material-symbols-rounded">pause</span> AUTO: ON';
        }
        
        if (iteracionGlobal >= 18) { setTimeout(() => { if (!isDying) ejecutarMutacion(); }, 500); }
        
        solicitarWakeLock(); resetTimerIdle(); 
    } else {
        document.body.classList.remove('zen-active'); document.body.classList.remove('zen-idle');
        btnZenMain.classList.remove('active'); liberarWakeLock();
    }
});

function bucleAnimacion() {
    tiempoViento += 0.016; 
    let paramsActuales = getParams();
    audioMotor.actualizarViento(tiempoViento, paramsActuales.viento * 100);
    entornoMotor.animarPasto(tiempoViento, paramsActuales.viento);

    if ((isZenMode || isAutoGrowing) && !zenPausa && !isDying && arbolBase) {
        let deltaZen = 0.015; 
        arbolBase.crecer(deltaZen, paramsActuales);
        iteracionGlobal += deltaZen;
        statsDisplay.textContent = `NODOS: ${arbolBase.contarNodos()} | AÑOS: ${iteracionGlobal.toFixed(1)}`;

        if (iteracionGlobal >= 18 && !muerteProgramada) {
            muerteProgramada = true; 
            zenPausa = true;
            
            if (isZenMode) {
                setTimeout(() => { if (!isDying && isZenMode) ejecutarMutacion(); }, 3000); 
            } else {
                isAutoGrowing = false;
                if(btnAuto) { btnAuto.classList.remove('active-toggle'); btnAuto.innerHTML = '<span class="material-symbols-rounded">play_arrow</span> AUTO: OFF'; }
            }
        }
    }

    if (arbolBase && !isDying) {
        arbolBase.animarYRenderizar(0, tiempoViento, paramsActuales.viento, showLeaves, showFlowers);
    }
    animationFrameId = requestAnimationFrame(bucleAnimacion);
}

function inicializarArbol() {
    updatePot(); 
    domContext.layerTree.innerHTML = ''; domContext.layerLeaves.innerHTML = ''; domContext.layerFlowers.innerHTML = '';
    domContext.layerTree.setAttribute('opacity', '1');
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    
    let inputSemilla = document.getElementById('input-semilla');
    if (inputSemilla) {
        let textoSemilla = inputSemilla.value.trim().toUpperCase();
        if (!textoSemilla) { textoSemilla = Math.random().toString(36).substring(2, 8).toUpperCase(); inputSemilla.value = textoSemilla; }
        
        setSeed(textoSemilla);
        if (audioMotor && typeof audioMotor.reseedMusicEngine === 'function') audioMotor.reseedMusicEngine(textoSemilla);
        
        const url = new URL(window.location); url.searchParams.set('seed', textoSemilla); window.history.replaceState({}, '', url);
    }
    
    arbolBase = new Rama(0, 0, 0, -90, null, getParams(), domContext);
    iteracionGlobal = 0; zenPausa = false; muerteProgramada = false; isDying = false;
    if (statsDisplay) statsDisplay.textContent = `NODOS: 1 | AÑOS: 0.0`;
    bucleAnimacion();
}

window.addEventListener('DOMContentLoaded', () => {
    construirInterfaz();
    const urlParams = new URLSearchParams(window.location.search);
    const semillaURL = urlParams.get('seed');
    let inputSemilla = document.getElementById('input-semilla');
    
    if (semillaURL && inputSemilla) inputSemilla.value = semillaURL.toUpperCase();
    else cargarAjustes(); 

    let btnCopiar = document.getElementById('btn-copiar-semilla');
    if (btnCopiar) {
        btnCopiar.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                btnCopiar.innerHTML = '<span class="material-symbols-rounded">check</span>'; setTimeout(() => btnCopiar.innerHTML = '<span class="material-symbols-rounded">content_copy</span>', 2000);
            });
        });
    }

    inicializarArbol();
    
    isZenMode = true; document.body.classList.add('zen-active'); document.body.classList.add('zen-idle'); 
    if(btnZenMain) btnZenMain.classList.add('active');
    
    isAutoGrowing = true;
    if(btnAuto) { btnAuto.classList.add('active-toggle'); btnAuto.innerHTML = '<span class="material-symbols-rounded">pause</span> AUTO: ON'; }

    const btnFondoMenu = document.getElementById('btn-fondo');
    if (btnFondoMenu && !btnFondoMenu.classList.contains('active-toggle')) toggleFondo(); 
    
    const btnMusMenu = document.getElementById('btn-music');
    if (btnMusMenu && !btnMusMenu.classList.contains('active-toggle')) toggleMusic(); 
    
    const btnSfxMenu = document.getElementById('btn-sfx');
    if (btnSfxMenu && !btnSfxMenu.classList.contains('active-toggle')) toggleSfx(); 
    
    solicitarWakeLock();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('PWA Error', err));
    });
}
