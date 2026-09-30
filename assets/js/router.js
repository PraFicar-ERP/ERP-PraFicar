/* ============================================================
   PRAFICAR ERP — ROTEADOR SPA
   Arquivo: assets/js/router.js
   Descrição: roteamento por hash (#/modulo). Controla qual
              tela é renderizada no conteúdo, atualiza o menu
              ativo e o breadcrumb.
   ============================================================ */

const ROUTER_PRAFICAR = (() => {

  /* ==========================================================
     1. DEFINIÇÃO DAS ROTAS
     ========================================================== */

  const ROTAS = {
    'inicio':       { titulo: 'Início',                icone: 'inicio',    render: 'renderInicio' },
    'produtos':     { titulo: 'Produtos & Estoque',    icone: 'produtos',  render: 'renderProdutos' },
    'precificar':   { titulo: 'Precificar',            icone: 'precificar',render: 'renderPrecificar' },
    'canais':       { titulo: 'Canais de Venda',       icone: 'canais',    render: 'renderCanais' },
    'encomendas':   { titulo: 'Encomendas',            icone: 'encomendas',render: 'renderEncomendas' },
    'vendas':       { titulo: 'Vendas',                icone: 'vendas',    render: 'renderVendas' },
    'financeiro':   { titulo: 'Financeiro',            icone: 'financeiro',render: 'renderFinanceiro' },
    'clientes':     { titulo: 'Clientes & Fornecedores',icone:'clientes',  render: 'renderClientes' },
    'relatorios':   { titulo: 'Relatórios',            icone: 'relatorios',render: 'renderRelatorios' },
    'qrcode':       { titulo: 'QR Code',               icone: 'qrcode',    render: 'renderQRCode' },
    'config':       { titulo: 'Configurações',         icone: 'config',    render: 'renderConfig' }
  };

  const ROTA_PADRAO = 'inicio';

  /* ==========================================================
     2. ESTADO
     ========================================================== */

  let rotaAtual = ROTA_PADRAO;

  /* ==========================================================
     3. NAVEGAÇÃO
     ========================================================== */

  function irPara(rota) {
    if (!ROTAS[rota]) rota = ROTA_PADRAO;
    window.location.hash = `#/${rota}`;
  }

  function obterRotaAtual() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return ROTAS[hash] ? hash : ROTA_PADRAO;
  }

  /* ==========================================================
     4. RENDER
     ========================================================== */

  function executarRender(rota) {
    const definicao = ROTAS[rota];
    if (!definicao) return;

    rotaAtual = rota;

    // Atualiza título da página no documento
    document.title = `${definicao.titulo} · PraFicar ERP`;

    // Marca item do menu como ativo
    document.querySelectorAll('.sidebar__item').forEach(el => {
      el.classList.toggle('ativo', el.dataset.rota === rota);
    });

    // Atualiza breadcrumb
    const breadcrumbAtual = document.querySelector('.header__breadcrumb-atual');
    if (breadcrumbAtual) breadcrumbAtual.textContent = definicao.titulo;

    // Chama a função de render da tela (definida em app.js)
    const funcaoRender = window[definicao.render];
    const container = document.getElementById('conteudo-tela');
    if (typeof funcaoRender === 'function' && container) {
      container.innerHTML = funcaoRender();
    } else if (container) {
      container.innerHTML = renderEmConstrucao(definicao.titulo);
    }

    // Fecha sidebar no mobile após navegar
    const app = document.querySelector('.app');
    if (app && window.innerWidth <= 768) {
      app.classList.remove('sidebar-aberta');
    }

    // Rola para o topo
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ==========================================================
     5. TELA EM CONSTRUÇÃO (fallback)
     ========================================================== */

  function renderEmConstrucao(titulo) {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">${titulo}</h1>
          <p class="pagina-header__subtitulo">Módulo em construção.</p>
        </div>
      </div>
      <div class="card">
        <div class="vazio">
          <div class="vazio__icone">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </div>
          <h3 class="vazio__titulo">Em breve</h3>
          <p class="vazio__descricao">
            Este módulo está sendo construído. Em breve você poderá usá-lo aqui.
          </p>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     6. INICIALIZAÇÃO
     ========================================================== */

  function iniciar() {
    // Primeira renderização
    executarRender(obterRotaAtual());

    // Escuta mudanças no hash
    window.addEventListener('hashchange', () => {
      executarRender(obterRotaAtual());
    });

    // Cliques em qualquer elemento com [data-rota]
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-rota]');
      if (el) {
        e.preventDefault();
        irPara(el.dataset.rota);
      }
    });
  }

  /* ==========================================================
     7. EXPORTAÇÃO
     ========================================================== */

  return {
    iniciar,
    irPara,
    obterRotaAtual,
    ROTAS
  };

})();

window.ROUTER_PRAFICAR = ROUTER_PRAFICAR;
