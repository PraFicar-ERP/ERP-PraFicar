/* ============================================================
   PRAFICAR ERP — CALCULADORA FLUTUANTE
   Arquivo: assets/js/calculadora.js
   Descrição: calculadora global, arrastável, minimizável,
              com histórico de operações, cópia de resultado
              e suporte a teclado físico.
              Permanece aberta ao trocar de módulo.
   ============================================================ */

const CALCULADORA_PRAFICAR = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let visivel = false;
  let minimizada = false;
  let expressao = '';       // o que está sendo digitado
  let resultado = '0';      // último resultado calculado
  let historico = [];
  let posicao = { x: null, y: null };
  let arrastando = false;
  let offsetArraste = { x: 0, y: 0 };

  /* ==========================================================
     2. TECLAS
     ========================================================== */

  const TECLAS = [
    { valor: 'C',  tipo: 'acao',     rotulo: 'C' },
    { valor: '⌫',  tipo: 'acao',     rotulo: '⌫' },
    { valor: '%',  tipo: 'operador', rotulo: '%' },
    { valor: '÷',  tipo: 'operador', rotulo: '÷' },

    { valor: '7',  tipo: 'numero',   rotulo: '7' },
    { valor: '8',  tipo: 'numero',   rotulo: '8' },
    { valor: '9',  tipo: 'numero',   rotulo: '9' },
    { valor: '×',  tipo: 'operador', rotulo: '×' },

    { valor: '4',  tipo: 'numero',   rotulo: '4' },
    { valor: '5',  tipo: 'numero',   rotulo: '5' },
    { valor: '6',  tipo: 'numero',   rotulo: '6' },
    { valor: '−',  tipo: 'operador', rotulo: '−' },

    { valor: '1',  tipo: 'numero',   rotulo: '1' },
    { valor: '2',  tipo: 'numero',   rotulo: '2' },
    { valor: '3',  tipo: 'numero',   rotulo: '3' },
    { valor: '+',  tipo: 'operador', rotulo: '+' },

    { valor: '±',  tipo: 'acao',     rotulo: '±' },
    { valor: '0',  tipo: 'numero',   rotulo: '0' },
    { valor: ',',  tipo: 'numero',   rotulo: ',' },
    { valor: '=',  tipo: 'igual',    rotulo: '=' }
  ];

  /* ==========================================================
     3. MOTOR DE CÁLCULO
     ========================================================== */

  function avaliar(expr) {
    if (!expr) return '0';

    // Normaliza símbolos para JavaScript
    let js = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/,/g, '.');

    // Porcentagem: "50%" → "(50/100)"
    js = js.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // Bloqueia caracteres perigosos
    if (!/^[0-9+\-*/().\s]+$/.test(js)) return 'Erro';

    try {
      // eslint-disable-next-line no-new-func
      const r = Function(`"use strict"; return (${js});`)();
      if (!isFinite(r)) return 'Erro';
      return String(parseFloat(r.toFixed(10)));
    } catch (e) {
      return 'Erro';
    }
  }

  function formatarNumero(valor) {
    if (valor === 'Erro') return valor;
    const n = Number(valor);
    if (isNaN(n)) return '0';
    if (Number.isInteger(n)) return n.toLocaleString('pt-BR');
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 10 });
  }

  /* ==========================================================
     4. AÇÕES
     ========================================================== */

  function inserir(valor) {
    if (resultado === 'Erro') {
      expressao = '';
      resultado = '0';
    }

    // Se acabou de calcular e digitou número, começa nova expressão
    if (resultado !== '0' && expressao === '' && /[0-9]/.test(valor)) {
      resultado = '0';
    }

    // Operador após operador substitui
    const ultimo = expressao.slice(-1);
    if ('+−×÷'.includes(valor) && '+−×÷'.includes(ultimo)) {
      expressao = expressao.slice(0, -1) + valor;
      atualizarDisplay();
      return;
    }

    // Bloqueia segunda vírgula no mesmo número
    if (valor === ',') {
      const partes = expressao.split(/[+−×÷]/);
      const ultimoNumero = partes[partes.length - 1];
      if (ultimoNumero.includes(',')) return;
      if (ultimoNumero === '') expressao += '0';
    }

    expressao += valor;
    atualizarDisplay();
  }

  function limpar() {
    expressao = '';
    resultado = '0';
    atualizarDisplay();
  }

  function backspace() {
    expressao = expressao.slice(0, -1);
    atualizarDisplay();
  }

  function inverterSinal() {
    if (!expressao) return;
    if (expressao.startsWith('-(') && expressao.endsWith(')')) {
      expressao = expressao.slice(2, -1);
    } else {
      expressao = `-(${expressao})`;
    }
    atualizarDisplay();
  }

  function calcular() {
    if (!expressao) return;
    const r = avaliar(expressao);
    if (r !== 'Erro') {
      adicionarHistorico(expressao, r);
    }
    resultado = r;
    if (r !== 'Erro') expressao = '';
    atualizarDisplay();
  }

  /* ==========================================================
     5. HISTÓRICO
     ========================================================== */

  function adicionarHistorico(expr, res) {
    historico.unshift({
      expressao: expr,
      resultado: res,
      data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    if (historico.length > 20) historico.length = 20;
    renderHistorico();
  }

  function limparHistorico() {
    historico = [];
    renderHistorico();
  }

  function usarResultado(valor) {
    expressao = valor;
    resultado = '0';
    atualizarDisplay();
  }

  /* ==========================================================
     6. DISPLAY
     ========================================================== */

  function atualizarDisplay() {
    const el = document.getElementById('calc-display');
    const prev = document.getElementById('calc-preview');
    if (!el) return;

    el.textContent = expressao || resultado || '0';

    if (prev) {
      if (expressao && /[+−×÷]/.test(expressao)) {
        const r = avaliar(expressao);
        prev.textContent = r === 'Erro' ? '' : `= ${formatarNumero(r)}`;
      } else {
        prev.textContent = '';
      }
    }
  }

  function renderHistorico() {
    const el = document.getElementById('calc-historico');
    if (!el) return;

    if (historico.length === 0) {
      el.innerHTML = '<div class="calc-hist-vazio">Sem histórico ainda</div>';
      return;
    }

    el.innerHTML = historico.map(h => `
      <div class="calc-hist-item" onclick="CALCULADORA_PRAFICAR.usarResultado('${h.resultado}')">
        <div class="calc-hist-item__expr">${h.expressao}</div>
        <div class="calc-hist-item__res">= ${formatarNumero(h.resultado)}</div>
      </div>
    `).join('');
  }

  /* ==========================================================
     7. RENDER
     ========================================================== */

  function render() {
    return `
      <div class="calc" id="calc-widget" style="display: none;">
        <div class="calc__header" id="calc-header">
          <span class="calc__titulo">Calculadora</span>
          <div class="calc__acoes">
            <button class="calc__btn-acao" id="calc-copiar" title="Copiar resultado">
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="calc__btn-acao" id="calc-min" title="Minimizar">
              <svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
            </button>
            <button class="calc__btn-acao" id="calc-close" title="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div class="calc__body" id="calc-body">
          <div class="calc__display">
            <div class="calc__preview" id="calc-preview"></div>
            <div class="calc__valor" id="calc-display">0</div>
          </div>

          <div class="calc__teclado">
            ${TECLAS.map(t => `
              <button class="calc__tecla calc__tecla--${t.tipo}" data-valor="${t.valor}">
                ${t.rotulo}
              </button>
            `).join('')}
          </div>

          <div class="calc__historico-header">
            <span>Histórico</span>
            <button class="calc__limpar-hist" id="calc-clear-hist" title="Limpar histórico">
              limpar
            </button>
          </div>
          <div class="calc__historico" id="calc-historico"></div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     8. INJETAR NO DOM
     ========================================================== */

  function injetar() {
    if (document.getElementById('calc-widget')) return;

    document.body.insertAdjacentHTML('beforeend', render());

    // Teclas
    document.querySelectorAll('.calc__tecla').forEach(btn => {
      btn.addEventListener('click', () => {
        const valor = btn.dataset.valor;
        if (valor === 'C') return limpar();
        if (valor === '⌫') return backspace();
        if (valor === '=') return calcular();
        if (valor === '±') return inverterSinal();
        return inserir(valor);
      });
    });

    document.getElementById('calc-min')?.addEventListener('click', alternarMinimizar);
    document.getElementById('calc-close')?.addEventListener('click', fechar);
    document.getElementById('calc-copiar')?.addEventListener('click', copiarResultado);
    document.getElementById('calc-clear-hist')?.addEventListener('click', limparHistorico);

    // Arrastar
    const header = document.getElementById('calc-header');
    if (header) {
      header.addEventListener('mousedown', iniciarArraste);
      header.addEventListener('touchstart', iniciarArraste, { passive: true });
    }

    // Teclado físico
    document.addEventListener('keydown', atalhosTeclado);

    // Redimensionar
    window.addEventListener('resize', reposicionar);

    renderHistorico();
  }

  /* ==========================================================
     9. ARRASTE
     ========================================================== */

  function iniciarArraste(e) {
    if (e.target.closest('button')) return;

    const widget = document.getElementById('calc-widget');
    if (!widget) return;

    arrastando = true;
    const rect = widget.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;

    offsetArraste = { x: cx - rect.left, y: cy - rect.top };

    document.addEventListener('mousemove', arrastar);
    document.addEventListener('touchmove', arrastar, { passive: false });
    document.addEventListener('mouseup', pararArraste);
    document.addEventListener('touchend', pararArraste);
  }

  function arrastar(e) {
    if (!arrastando) return;
    e.preventDefault();

    const widget = document.getElementById('calc-widget');
    if (!widget) return;

    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;

    let x = cx - offsetArraste.x;
    let y = cy - offsetArraste.y;

    const rect = widget.getBoundingClientRect();
    x = Math.max(0, Math.min(x, window.innerWidth - rect.width));
    y = Math.max(0, Math.min(y, window.innerHeight - rect.height));

    posicao = { x, y };
    widget.style.left = `${x}px`;
    widget.style.top = `${y}px`;
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }

  function pararArraste() {
    arrastando = false;
    document.removeEventListener('mousemove', arrastar);
    document.removeEventListener('touchmove', arrastar);
    document.removeEventListener('mouseup', pararArraste);
    document.removeEventListener('touchend', pararArraste);
  }

  function reposicionar() {
    const widget = document.getElementById('calc-widget');
    if (!widget || !posicao.x) return;

    const rect = widget.getBoundingClientRect();
    posicao.x = Math.max(0, Math.min(posicao.x, window.innerWidth - rect.width));
    posicao.y = Math.max(0, Math.min(posicao.y, window.innerHeight - rect.height));

    widget.style.left = `${posicao.x}px`;
    widget.style.top = `${posicao.y}px`;
  }

  /* ==========================================================
     10. TECLADO FÍSICO
     ========================================================== */

  function atalhosTeclado(e) {
    if (!visivel || minimizada) return;

    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const t = e.key;

    if (/^[0-9]$/.test(t)) { e.preventDefault(); inserir(t); return; }
    if (t === ',' || t === '.') { e.preventDefault(); inserir(','); return; }
    if (t === '+') { e.preventDefault(); inserir('+'); return; }
    if (t === '-') { e.preventDefault(); inserir('−'); return; }
    if (t === '*') { e.preventDefault(); inserir('×'); return; }
    if (t === '/') { e.preventDefault(); inserir('÷'); return; }
    if (t === '%') { e.preventDefault(); inserir('%'); return; }
    if (t === 'Enter' || t === '=') { e.preventDefault(); calcular(); return; }
    if (t === 'Backspace') { e.preventDefault(); backspace(); return; }
    if (t === 'Escape') { e.preventDefault(); limpar(); return; }
  }

  /* ==========================================================
     11. VISIBILIDADE
     ========================================================== */

  function alternar() {
    visivel ? fechar() : abrir();
  }

  function abrir() {
    injetar();
    const widget = document.getElementById('calc-widget');
    if (!widget) return;

    visivel = true;
    minimizada = false;
    widget.style.display = 'flex';
    widget.classList.remove('calc--minimizada');

    // Posição inicial: canto inferior direito
    if (posicao.x === null) {
      const rect = widget.getBoundingClientRect();
      posicao = {
        x: window.innerWidth - rect.width - 24,
        y: window.innerHeight - rect.height - 24
      };
      widget.style.left = `${posicao.x}px`;
      widget.style.top = `${posicao.y}px`;
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
    }

    atualizarDisplay();
    renderHistorico();
  }

  function fechar() {
    const widget = document.getElementById('calc-widget');
    if (widget) widget.style.display = 'none';
    visivel = false;
  }

  function alternarMinimizar() {
    const widget = document.getElementById('calc-widget');
    if (!widget) return;
    minimizada = !minimizada;
    widget.classList.toggle('calc--minimizada', minimizada);
  }

  function copiarResultado() {
    const texto = expressao || resultado;
    if (!texto || texto === '0') return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(() => {
        mostrarToast('Resultado copiado');
      });
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      mostrarToast('Resultado copiado');
    }
  }

  function mostrarToast(msg) {
    let toast = document.getElementById('calc-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'calc-toast';
      toast.className = 'calc-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('calc-toast--visivel');
    setTimeout(() => toast.classList.remove('calc-toast--visivel'), 1800);
  }

  /* ==========================================================
     12. API PÚBLICA
     ========================================================== */

  return {
    alternar,
    abrir,
    fechar,
    limpar,
    calcular,
    inserir,
    usarResultado,
    _estaVisivel: () => visivel
  };

})();

window.CALCULADORA_PRAFICAR = CALCULADORA_PRAFICAR;
