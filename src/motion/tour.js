// O tour virtual: desenha a panorâmica 360° da unidade num canvas WebGL2, sem biblioteca.
// Arrastar olha em volta (no toque, o gesto vertical continua rolando a página); a roda do mouse nunca é capturada.
// Só desenha enquanto o visor está na tela. Sem WebGL2, fica a foto da fachada.
import { unidadeAtual } from './unidade.js';

const TAU = Math.PI * 2;
const VISTAS = {
  1: { src: './tour/unidade-1.webp', olhar: (1560 / 2000 - 0.5) * TAU, altura: 0.12 },
  2: { src: './tour/unidade-2.webp', olhar: (1480 / 2000 - 0.5) * TAU, altura: 0.04 },
};
const FOV_MIN = 40, FOV_MAX = 100, FOV_INICIO = 78;
const LIM = 1.25;

const VS = `#version 300 es
out vec2 v;
void main() { vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); v = p; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 v; out vec4 cor;
uniform sampler2D foto; uniform float yaw, pitch, foco, razao;
void main() {
  vec3 d = normalize(vec3(v.x * razao, v.y, foco));
  float cp = cos(pitch), sp = sin(pitch), cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x, d.y * cp + d.z * sp, -d.y * sp + d.z * cp);
  d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
  vec2 uv = vec2(atan(d.x, d.z) / 6.2831853 + .5, .5 - asin(clamp(d.y, -1., 1.)) / 3.1415927);
  cor = vec4(textureGrad(foto, uv, dFdx(v) * .0, dFdy(v) * .0).rgb, 1.);
}`;

function programa(gl) {
  const p = gl.createProgram();
  for (const [tipo, txt] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, txt);
    gl.compileShader(s);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

export function tour({ reduzido }) {
  const visor = document.querySelector('[data-visor]');
  if (!visor) return;
  const tela = visor.querySelector('canvas');
  const gl = tela.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) return;

  let prog;
  try { prog = programa(gl); } catch (erro) { console.warn('Power Fitness: tour 360 indisponível.', erro); return; }
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  const un = Object.fromEntries(['yaw', 'pitch', 'foco', 'razao'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const est = { yaw: 0, pitch: 0, fov: FOV_INICIO, alvoYaw: 0, alvoPitch: 0, alvoFov: FOV_INICIO };
  const cache = {};
  let visivel = false, raf = 0, sujo = true, tocou = false, pedido = 0, ultimo = 0;

  const limita = (v, a, b) => Math.min(b, Math.max(a, v));
  function imagem(n) {
    return (cache[n] ??= new Promise((ok, falha) => {
      const i = new Image();
      i.decoding = 'async';
      i.onload = () => ok(i);
      i.onerror = falha;
      i.src = VISTAS[n].src;
    }));
  }
  function irPara(n, imediato) {
    const { olhar, altura } = VISTAS[n];
    // o caminho mais curto até a fachada
    est.alvoYaw = est.yaw + Math.atan2(Math.sin(olhar - est.yaw), Math.cos(olhar - est.yaw));
    est.alvoPitch = altura;
    est.alvoFov = FOV_INICIO;
    if (imediato) { est.yaw = est.alvoYaw; est.pitch = altura; est.fov = FOV_INICIO; }
    sujo = true;
    ligar();
  }
  async function carregar(n) {
    const meu = ++pedido;
    try {
      const i = await imagem(n);
      if (meu !== pedido) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, i);
      irPara(n, true);
      visor.classList.add('is-viva');
    } catch {
      visor.classList.remove('is-viva');
    }
  }
  function medir() {
    const r = visor.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (tela.width !== w || tela.height !== h) { tela.width = w; tela.height = h; sujo = true; ligar(); }
  }
  function desenhar() {
    gl.viewport(0, 0, tela.width, tela.height);
    gl.uniform1f(un.yaw, est.yaw);
    gl.uniform1f(un.pitch, est.pitch);
    gl.uniform1f(un.foco, 1 / Math.tan((est.fov * Math.PI) / 360));
    gl.uniform1f(un.razao, tela.width / tela.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function quadro(agora) {
    raf = 0;
    if (!visivel) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000 || 0.016);
    ultimo = agora;
    const giro = !tocou && !reduzido && visor.classList.contains('is-viva');
    if (giro) { est.alvoYaw += dt * 0.035; sujo = true; }
    const k = reduzido ? 1 : 1 - Math.exp(-dt * 12);
    for (const [a, b] of [['yaw', 'alvoYaw'], ['pitch', 'alvoPitch'], ['fov', 'alvoFov']]) {
      const d = est[b] - est[a];
      if (Math.abs(d) > 0.0004) { est[a] += d * k; sujo = true; } else est[a] = est[b];
    }
    if (sujo) { desenhar(); sujo = false; }
    const parado = !giro && est.yaw === est.alvoYaw && est.pitch === est.alvoPitch && est.fov === est.alvoFov;
    if (!parado) raf = requestAnimationFrame(quadro);
  }
  function ligar() {
    if (visivel && !raf) { ultimo = performance.now(); raf = requestAnimationFrame(quadro); }
  }
  const usar = () => { tocou = true; visor.classList.add('is-usado'); };
  const zoom = (d) => { usar(); est.alvoFov = limita(est.alvoFov + d, FOV_MIN, FOV_MAX); ligar(); };
  const olhar = (dy, dp) => { usar(); est.alvoYaw += dy; est.alvoPitch = limita(est.alvoPitch + dp, -LIM, LIM); ligar(); };

  // arrastar: mouse nos dois eixos; no toque, só o giro lateral (o vertical é a rolagem da página)
  let arrasto = null;
  visor.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY, toque: e.pointerType !== 'mouse' };
    visor.setPointerCapture(e.pointerId);
    visor.classList.add('is-arrastando');
  });
  visor.addEventListener('pointermove', (e) => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    arrasto.x = e.clientX; arrasto.y = e.clientY;
    const escala = ((est.fov * Math.PI) / 180) / Math.max(1, visor.clientHeight);
    olhar(-dx * escala, arrasto.toque ? 0 : dy * escala);
  });
  const soltar = (e) => {
    if (arrasto && e.pointerId === arrasto.id) { arrasto = null; visor.classList.remove('is-arrastando'); }
  };
  visor.addEventListener('pointerup', soltar);
  visor.addEventListener('pointercancel', soltar);

  visor.addEventListener('keydown', (e) => {
    if (e.target !== visor) return;
    const passo = 0.14;
    const acoes = { ArrowLeft: () => olhar(-passo, 0), ArrowRight: () => olhar(passo, 0), ArrowUp: () => olhar(0, passo), ArrowDown: () => olhar(0, -passo), '+': () => zoom(-8), '=': () => zoom(-8), '-': () => zoom(8) };
    if (acoes[e.key]) { e.preventDefault(); acoes[e.key](); }
  });
  visor.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor-acao]');
    if (!b) return;
    const acao = b.dataset.visorAcao;
    if (acao === 'mais') zoom(-10);
    if (acao === 'menos') zoom(10);
    if (acao === 'frente') { usar(); irPara(unidadeAtual()); }
    if (acao === 'cheia') {
      if (document.fullscreenElement) document.exitFullscreen();
      else visor.requestFullscreen?.();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const cheia = visor.querySelector('[data-visor-acao="cheia"]');
    cheia.textContent = document.fullscreenElement ? 'Sair' : 'Tela cheia';
    cheia.setAttribute('aria-label', document.fullscreenElement ? 'Sair da tela cheia' : 'Abrir em tela cheia');
  });

  new ResizeObserver(medir).observe(visor);
  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting;
    if (visivel) { sujo = true; if (!cache[unidadeAtual()]) carregar(unidadeAtual()); ligar(); }
  }, { rootMargin: '300px 0px' }).observe(visor);

  document.addEventListener('unidade', () => {
    tocou = false;
    visor.classList.remove('is-usado');
    if (visivel) carregar(unidadeAtual());
    else { cache[unidadeAtual()] = null; }
  });
  medir();
}
