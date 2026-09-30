/* ============================================================
   PRAFICAR ERP — ROTEADOR SPA (v2 — robusto)
   Arquivo: assets/js/router.js
   Descrição: roteamento por hash (#/modulo). Controla qual
              tela é renderizada no conteúdo, atualiza o menu
              ativo e o breadcrumb.

   v2 — adiciona verificação de módulos carregados e logs de
         diagnóstico no console quando um render não existe.
   ============================================================ */

const ROUTER_PRAFICAR = (() => {

  /* ==========================================================
     1. DEFINIÇÃO DAS ROTAS
     ========================================================== */

  const ROTAS = {
    'inicio':       { titulo: 'Início',                  icone: 'inicio',     render: 'renderInicio' },
    'produtos':     { titulo: 'Produtos & Estoque',      icone: 'produtos',   render: 'renderProdutos' },
    'precificar':   { titulo: 'Precificar',              icone: 'precificar', render: 'renderPrecificar' },
    'canais':       { titulo: 'Canais de Venda',         icone: 'canais',     render: 'renderCanais' },
    'encomendas':   { titulo: 'Encomendas',              icone: 'encomendas', render: 'renderEncomendas' },
    'vendas':       { titulo: 'Vendas',                  icone: 'vendas',     render: 'renderVendas' },
    'financeiro':   { titulo: 'Financeiro',              icone: 'financeiro', render: 'renderFinanceiro' },
    'clientes':     { titulo: 'Clientes & Fornecedores', icone: 'clientes',   render: 'renderClientes' },
    'relatorios':   { titulo: 'Relatórios',              icone: 'relatorios', render: 'renderRelatorios' },
    'qrcode':       { titulo: 'QR Code',                 icone: 'qrcode',     render: 'renderQRCode' },
    'config':       { titulo: 'Configurações',           icone: 'config',     render: 'renderConfig' }
  };

  const ROTA_PADRAO = 'inicio';

  /* ==========================================================
     2. ESTADO
     ========================================================== */

  let rotaAtual = ROTA_PADRAO;
  let avisosJaEmitidos = new Set();

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
     4. VERIFICAÇÃO DE MÓDULOS
     ========================================================== */

  function verificarModulos() {
    const faltando = [];
    Object.entries(ROTAS).forEach(([rota, def]) => {
      if (typeof window[def.render] !== 'function') {
        faltando.push({ rota, funcao: def.render });
      }
    });

    if (faltando.length > 0) {
      console.warn(
        '[PraFicar Router] Módulos com render ausente:\n' +
        faltando.map(f => `  - ${f.rota} → window.${f.funcao}`).join('\n') +
        '\n\nVerifique se o <script> do módulo está incluído no index.html e se não há erro de sintaxe.'
      );
    } else {
      console.log('[PraFicar Router] Todos os módulos carregados com sucesso.');
    }

    return faltando;
  }

  /* ==========================================================
     5. RENDER
     ========================================================== */

  function executarRender(rota) {
    const definicao = ROTAS[rota];
    if (!definicao) return;

    rotaAtual = rota;

    // Título do documento
    document.title = `${definicao.titulo} · PraFicar ERP`;

    // Marca item do menu como ativo
    document.querySelectorAll('.sidebar__item').forEach(el => {
      el.classList.toggle('ativo', el.dataset.rota === rota);
    });

    // Breadcrumb
    const breadcrumbAtual = document.querySelector('.header__breadcrumb-atual');
    if (breadcrumbAtual) breadcrumbAtual.textContent = definicao.titulo;

    // Chama a função de render
    const funcaoRender = window[definicao.render];
    const container = document.getElementById('conteudo-tela');

    if (typeof funcaoRender === 'function' && container) {
      try {
        container.innerHTML = funcaoRender();
      } catch (e) {
        console.error(`[PraFicar Router] Erro ao renderizar "${rota}":`, e);
        container.innerHTML = renderErro(rota, e.message);
      }
    } else if (container) {
      // Só avisa uma vez por rota
      if (!avisosJaEmitidos.has(rota)) {
        console.warn(`[PraFicar Router] Módulo "${rota}" não carregado. Mostrando fallback.`);
        avisosJaEmitidos.add(rota);
      }
      container.innerHTML = renderEmConstrucao(definicao.titulo, definicao.render);
    }

    // Fecha sidebar no mobile
    const app = document.querySelector('.app');
    if (app && window.innerWidth <= 768) {
      app.classList.remove('sidebar-aberta');
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ==========================================================
     6. FALLBACKS
     ========================================================== */

  function renderEmConstrucao(titulo, funcaoEsperada) {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">${titulo}</h1>
          <p class="pagina-header__subtitulo">Módulo não carregado.</p>
        </div>
      </div>
      <div class="card">
        <div class="vazio">
          <div class="vazio__icone">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </div>
          <h3 class="vazio__titulo">Módulo indisponível</h3>
          <p class="vazio__descricao">
            O módulo <strong>${titulo}</strong> não foi carregado corretamente.<br>
            Função esperada: <code>window.${funcaoEsperada}</code>
          </p>
          <p class="vazio__descricao" style="font-size: 12px; opacity: 0.7;">
            Abra o console (F12) para ver detalhes.
          </p>
        </div>
      </div>
    `;
  }

  function renderErro(rota, mensagem) {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Erro ao carregar</h1>
          <p class="pagina-header__subtitulo">Módulo: ${rota}</p>
        </div>
      </div>
      <div class="card">
        <div class="card__body">
          <div class="alerta alerta--critico">
            <span class="alerta__icone">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </span>
            <div class="alerta__conteudo">
              <div class="alerta__titulo">Erro de execução</div>
              ${mensagem}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     7. INICIALIZAÇÃO
     ========================================================== */

  function iniciar() {
    // Diagnóstico
    verificarModulos();

    // Primeira renderização
    executarRender(obterRotaAtual());

    // Escuta mudanças no hash
    window.addEventListener('hashchange', () => {
      executarRender(obterRotaAtual());
    });

    // Cliques em [data-rota]
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-rota]');
      if (el) {
        e.preventDefault();
        irPara(el.dataset.rota);
      }
    });
  }

  /* ==========================================================
     8. EXPORTAÇÃO
     ========================================================== */

  return {
    iniciar,
    irPara,
    obterRotaAtual,
    verificarModulos,
    ROTAS
  };

})();

window.ROUTER_PRAFICAR = ROUTER_PRAFICAR;
