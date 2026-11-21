// As duas abas (Unidade 1 e Unidade 2): trocam o conteúdo da mesma página, sem recarregar.
// O que é de uma unidade só leva data-so="1" ou "2"; o CSS esconde a outra. O endereço guarda a aba (?unidade=2).
import { CONFIG } from '../config.js';

export const unidadeAtual = () => document.documentElement.dataset.unidade === '2' ? '2' : '1';

export function unidades() {
  const html = document.documentElement;
  const abas = [...document.querySelectorAll('.unidades__aba')];
  function marcar(n, focar) {
    abas.forEach((a) => {
      const sim = a.dataset.unidade === n;
      a.setAttribute('aria-selected', sim);
      a.tabIndex = sim ? 0 : -1;
      if (sim && focar) a.focus();
    });
    document.title = `Power Fitness Academia · ${CONFIG.unidades[n].nome} · Sarandi`;
  }
  function abrir(n, focar) {
    if (n === unidadeAtual()) { marcar(n, focar); return; }
    html.dataset.unidade = n;
    marcar(n, focar);
    const url = new URL(location.href);
    url.searchParams.set('unidade', n);
    history.replaceState(null, '', url);
    // as fotos e os blocos que acabaram de aparecer não ficam esperando o observador
    document.querySelectorAll(`[data-so="${n}"] .marco`).forEach((el) => el.classList.add('is-visto'));
    document.dispatchEvent(new CustomEvent('unidade'));
    dispatchEvent(new Event('resize'));
  }
  abas.forEach((a) => a.addEventListener('click', () => abrir(a.dataset.unidade)));
  document.querySelector('.unidades')?.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    abrir(unidadeAtual() === '1' ? '2' : '1', true);
  });
  marcar(unidadeAtual());
}
