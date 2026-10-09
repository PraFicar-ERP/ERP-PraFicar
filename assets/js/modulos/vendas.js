/* ============================================================
   PRAFICAR ERP — MÓDULO VENDAS (unificado)
   Arquivo: assets/js/modulos/vendas.js
   Descrição: módulo principal de Vendas. Contém 3 abas:
              - Orçamentos → chama MODULO_ORCAMENTOS
              - Pedidos    → chama MODULO_PEDIDOS
              - Vendas     → chama MODULO_VENDAS_CORE

              Este arquivo é APENAS a casca (abas + orquestração).
              Toda lógica de negócio vive nos módulos filhos.
   ============================================================ */

const MODULO_VENDAS = (() => {

  /* ==========================================================
     1. DEFINIÇÃO DAS ABAS
     ========================================================== */

  const ABAS = [
    {
      codigo: 'orcamentos',
      nome: 'Orçamentos',
      descricao: 'Cotações para clientes',
      modulo: 'MODULO_ORCAMENTOS',
      render: 'renderOrcamentos'
    },
    {
      codigo: 'pedidos',
      nome: 'Pedidos',
      descricao: 'Pedidos confirmados',
      modulo: 'MODULO_PEDIDOS',
      render: 'renderPedidos'
    },
    {
      codigo: 'vendas',
      nome: 'Vendas',
      descricao: 'Vendas efetivadas',
      modulo: 'MODULO_VENDAS_CORE',
      render: 'renderVendasCore'
    }
  ];

  const ABA_PADRAO = 'vendas';

  /* ==========================================================
     2. ESTADO
     ========================================================== */

  let abaAtiva = ABA_PADRAO;

  /* ==========================================================
     3. UTILITÁRIOS
     ========================================================== */

  function abaInfo(codigo) {
    return ABAS.find(a => a.codigo === codigo) || ABAS[2];
  }

  function moduloCarregado(codigo) {
    const aba = abaInfo(codigo);
    const m = window[aba.modulo];
    return m && typeof m === 'object';
  }

  function funcaoRenderDisponivel(aba) {
    const m = window[aba.modulo];
    if (m && typeof m.render === 'function') return m.render;
    if (typeof window[aba.render] === 'function') return window[aba.render];
    return null;
  }

  /* ==========================================================
     4. RENDER
     ========================================================== */

  function render() {
    const aba = abaInfo(abaAtiva);

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Vendas</h1>
          <p class="pagina-header__subtitulo">
            Orçamentos, pedidos e vendas em um só lugar.
          </p>
        </div>
      </div>

      <div class="vendas-abas" role="tablist">
        ${ABAS.map(a => `
          <button
            type="button"
            role="tab"
            aria-selected="${a.codigo === abaAtiva}"
            class="vendas-aba ${a.codigo === abaAtiva ? 'vendas-aba--ativa' : ''}"
            onclick="MODULO_VENDAS.trocarAba('${a.codigo}')"
          >
            <span class="vendas-aba__nome">${a.nome}</span>
            <span class="vendas-aba__desc">${a.descricao}</span>
          </button>
        `).join('')}
      </div>

      <div class="vendas-conteudo" id="vendas-conteudo" role="tabpanel">
        ${renderConteudoAba()}
      </div>
    `;
  }

  function renderConteudoAba() {
    const aba = abaInfo(abaAtiva);

    if (!moduloCarregado(aba.codigo)) {
      return renderModuloIndisponivel(aba);
    }

    const funcaoRender = funcaoRenderDisponivel(aba);

    if (typeof funcaoRender !== 'function') {
      return renderModuloIndisponivel(aba);
    }

    try {
      return funcaoRender();
    } catch (e) {
      console.error(`[PraFicar Vendas] Erro ao renderizar aba "${aba.nome}":`, e);
      return renderErroAba(aba, e.message);
    }
  }

  function renderModuloIndisponivel(aba) {
    return `
      <div class="card">
        <div class="vazio">
          <div class="vazio__icone">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </div>
          <h3 class="vazio__titulo">Módulo "${aba.nome}" não carregado</h3>
          <p class="vazio__descricao">
            O arquivo do módulo não foi carregado no <code>index.html</code> ou houve erro de sintaxe.<br>
            Módulo esperado: <code>window.${aba.modulo}</code>
          </p>
        </div>
      </div>
    `;
  }

  function renderErroAba(aba, mensagem) {
    return `
      <div class="card">
        <div class="card__body">
          <div class="alerta alerta--critico">
            <span class="alerta__icone">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </span>
            <div class="alerta__conteudo">
              <div class="alerta__titulo">Erro ao renderizar "${aba.nome}"</div>
              ${escaparHTML(mensagem || 'Erro desconhecido.')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function escaparHTML(t) {
    if (t === null || t === undefined) return '';
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ==========================================================
     5. AÇÕES
     ========================================================== */

  function trocarAba(codigo) {
    if (!ABAS.find(a => a.codigo === codigo)) return;
    if (codigo === abaAtiva) return;
    abaAtiva = codigo;
    rerender();
  }

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'vendas') {
      container.innerHTML = render();
    }
  }

  function rerenderConteudo() {
    const container = document.getElementById('vendas-conteudo');
    if (container) container.innerHTML = renderConteudoAba();
  }

  /* ==========================================================
     6. NAVEGAÇÃO EXTERNA
     ========================================================== */

  // Permite que outros módulos forcem uma aba específica
  function irParaAba(codigo) {
    if (!ABAS.find(a => a.codigo === codigo)) return;
    abaAtiva = codigo;
    // Se a rota já é vendas, só rerenderiza. Se não, muda de rota.
    if (window.ROUTER_PRAFICAR?.obterRotaAtual() === 'vendas') {
      rerender();
    } else {
      window.ROUTER_PRAFICAR?.irPara('vendas');
    }
  }

  /* ==========================================================
     7. API PÚBLICA
     ========================================================== */

  return {
    render,
    trocarAba,
    irParaAba,
    rerender,
    rerenderConteudo,
    _abaAtiva: () => abaAtiva,
    _abas: () => [...ABAS]
  };

})();

window.MODULO_VENDAS = MODULO_VENDAS;
window.renderVendas = MODULO_VENDAS.render;
