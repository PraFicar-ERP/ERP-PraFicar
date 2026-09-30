/* ============================================================
   PRAFICAR ERP — APP PRINCIPAL
   Arquivo: assets/js/app.js
   Descrição: inicialização, menu lateral, header, ícones,
              telas (render) dos módulos.
   ============================================================ */

const APP_PRAFICAR = (() => {

  /* ==========================================================
     1. ÍCONES SVG (inline, sem dependências externas)
     ========================================================== */

  const ICONES = {
    inicio:       '<svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>',
    produtos:     '<svg viewBox="0 0 24 24"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>',
    precificar:   '<svg viewBox="0 0 24 24"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
    canais:       '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>',
    encomendas:   '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    vendas:       '<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    financeiro:   '<svg viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    clientes:     '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    relatorios:   '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    qrcode:       '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M21 14v3M14 21h3M21 21h.01"/></svg>',
    config:       '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    busca:        '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    menu:         '<svg viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>',
    sino:         '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    ajuda:        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    raio:         '<svg viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    seta_baixo:   '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    seta_cima:    '<svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>',
    dinheiro:     '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>',
    pacote:       '<svg viewBox="0 0 24 24"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>',
    alerta:       '<svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    relogio:      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    user:         '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  };

  /* ==========================================================
     2. MENU LATERAL
     ========================================================== */

  const MENU = [
    {
      grupo: 'Operação',
      itens: [
        { rota: 'inicio',     texto: 'Início' },
        { rota: 'vendas',     texto: 'Vendas' },
        { rota: 'encomendas', texto: 'Encomendas', badge: '3' }
      ]
    },
    {
      grupo: 'Catálogo',
      itens: [
        { rota: 'produtos',   texto: 'Produtos & Estoque' },
        { rota: 'precificar', texto: 'Precificar' },
        { rota: 'canais',     texto: 'Canais de Venda' }
      ]
    },
    {
      grupo: 'Gestão',
      itens: [
        { rota: 'financeiro', texto: 'Financeiro' },
        { rota: 'clientes',   texto: 'Clientes & Fornecedores' },
        { rota: 'relatorios', texto: 'Relatórios' }
      ]
    },
    {
      grupo: 'Ferramentas',
      itens: [
        { rota: 'qrcode', texto: 'QR Code' },
        { rota: 'config', texto: 'Configurações' }
      ]
    }
  ];

  function renderMenu() {
    return MENU.map(grupo => `
      <div class="sidebar__grupo">
        <div class="sidebar__grupo-titulo">${grupo.grupo}</div>
        ${grupo.itens.map(item => `
          <div class="sidebar__item" data-rota="${item.rota}">
            <span class="sidebar__icone">${ICONES[item.rota] || ''}</span>
            <span class="sidebar__texto">${item.texto}</span>
            ${item.badge ? `<span class="sidebar__badge">${item.badge}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  /* ==========================================================
     3. TELAS (RENDER DE CADA MÓDULO)
     ========================================================== */

  /* ---------- INÍCIO (DASHBOARD) ---------- */

  function renderInicio() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Bom dia 👋</h1>
          <p class="pagina-header__subtitulo">Aqui está o resumo do seu negócio hoje.</p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario" data-rota="relatorios">
            ${ICONES.relatorios} Ver relatórios
          </button>
          <button class="btn btn--primario" data-rota="vendas">
            ${ICONES.vendas} Nova venda
          </button>
        </div>
      </div>

      <div class="grid grid--4 mb-6">
        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Vendas hoje</span>
            <span class="kpi__icone">${ICONES.dinheiro}</span>
          </div>
          <div class="kpi__valor">R$ 0,00</div>
          <div class="kpi__variacao kpi__variacao--neutra">Sem vendas ainda</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Lucro hoje</span>
            <span class="kpi__icone">${ICONES.raio}</span>
          </div>
          <div class="kpi__valor">R$ 0,00</div>
          <div class="kpi__variacao kpi__variacao--neutra">Aguardando vendas</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Encomendas</span>
            <span class="kpi__icone">${ICONES.pacote}</span>
          </div>
          <div class="kpi__valor">0</div>
          <div class="kpi__variacao kpi__variacao--neutra">Nenhuma em aberto</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Estoque baixo</span>
            <span class="kpi__icone">${ICONES.alerta}</span>
          </div>
          <div class="kpi__valor">0</div>
          <div class="kpi__variacao kpi__variacao--neutra">Tudo em ordem</div>
        </div>
      </div>

      <div class="grid grid--2">
        <div class="card">
          <div class="card__header">
            <div>
              <h3 class="card__titulo">Alertas do dia</h3>
              <p class="card__subtitulo">O que precisa da sua atenção.</p>
            </div>
          </div>
          <div class="card__body">
            <div class="alerta alerta--info">
              <span class="alerta__icone">${ICONES.raio}</span>
              <div class="alerta__conteudo">
                <div class="alerta__titulo">Bem-vindo ao PraFicar</div>
                Comece cadastrando seus insumos e produtos para ver os alertas aparecerem aqui.
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__header">
            <div>
              <h3 class="card__titulo">Atalhos rápidos</h3>
              <p class="card__subtitulo">Ações mais usadas no dia a dia.</p>
            </div>
          </div>
          <div class="card__body">
            <div class="grid grid--2">
              <button class="btn btn--secundario btn--bloco" data-rota="precificar">
                ${ICONES.precificar} Precificar
              </button>
              <button class="btn btn--secundario btn--bloco" data-rota="produtos">
                ${ICONES.produtos} Produtos
              </button>
              <button class="btn btn--secundario btn--bloco" data-rota="encomendas">
                ${ICONES.encomendas} Encomendas
              </button>
              <button class="btn btn--secundario btn--bloco" data-rota="qrcode">
                ${ICONES.qrcode} QR Code
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- PRODUTOS & ESTOQUE ---------- */

  function renderProdutos() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Produtos & Estoque</h1>
          <p class="pagina-header__subtitulo">Cadastro, saldo e movimentações.</p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario">${ICONES.busca} Buscar</button>
          <button class="btn btn--primario">+ Novo produto</button>
        </div>
      </div>

      <div class="tabela-wrapper">
        <div class="tabela-scroll">
          <table class="tabela">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th class="tabela__numero">Estoque</th>
                <th class="tabela__numero">Custo</th>
                <th class="tabela__numero">Preço</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="7">
                  <div class="vazio">
                    <div class="vazio__icone">${ICONES.produtos}</div>
                    <h3 class="vazio__titulo">Nenhum produto cadastrado</h3>
                    <p class="vazio__descricao">
                      Cadastre seu primeiro produto e o SKU será gerado automaticamente
                      no padrão PraFicar (ex.: <strong>MP-PF-001</strong>).
                    </p>
                    <button class="btn btn--primario">+ Novo produto</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ---------- PRECIFICAR ---------- */

  function renderPrecificar() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Precificar</h1>
          <p class="pagina-header__subtitulo">Calcule custo real e preço de venda.</p>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div class="vazio">
            <div class="vazio__icone">${ICONES.precificar}</div>
            <h3 class="vazio__titulo">Precificação inteligente</h3>
            <p class="vazio__descricao">
              Informe insumos, mão de obra, perdas, embalagem, taxa do canal e frete.
              O PraFicar calcula o custo real e sugere o preço ideal.
            </p>
            <button class="btn btn--primario">+ Nova precificação</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- CANAIS DE VENDA ---------- */

  function renderCanais() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Canais de Venda</h1>
          <p class="pagina-header__subtitulo">Instagram, Shopee, Mercado Livre, site, WhatsApp e mais.</p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario">+ Novo canal</button>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div class="vazio">
            <div class="vazio__icone">${ICONES.canais}</div>
            <h3 class="vazio__titulo">Nenhum canal cadastrado</h3>
            <p class="vazio__descricao">
              Cadastre seus canais de venda com taxa percentual, taxa fixa e política de frete.
              O lucro será calculado automaticamente por canal.
            </p>
            <button class="btn btn--primario">+ Novo canal</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- ENCOMENDAS ---------- */

  function renderEncomendas() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Encomendas</h1>
          <p class="pagina-header__subtitulo">Orçamentos, produção e entrega.</p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario">+ Nova encomenda</button>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div class="vazio">
            <div class="vazio__icone">${ICONES.encomendas}</div>
            <h3 class="vazio__titulo">Nenhuma encomenda em aberto</h3>
            <p class="vazio__descricao">
              Crie orçamentos, acompanhe produção e registre aprovação de arte.
            </p>
            <button class="btn btn--primario">+ Nova encomenda</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- VENDAS ---------- */

  function renderVendas() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Vendas</h1>
          <p class="pagina-header__subtitulo">Registre vendas com lucro real por canal.</p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario">+ Nova venda</button>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div class="vazio">
            <div class="vazio__icone">${ICONES.vendas}</div>
            <h3 class="vazio__titulo">Nenhuma venda registrada</h3>
            <p class="vazio__descricao">
              O lucro líquido é calculado automaticamente considerando a taxa do canal
              e o frete pago pelo vendedor.
            </p>
            <button class="btn btn--primario">+ Nova venda</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- FINANCEIRO ---------- */

  function renderFinanceiro() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Financeiro</h1>
          <p class="pagina-header__subtitulo">Contas a receber, a pagar e fluxo de caixa.</p>
        </div>
      </div>

      <div class="grid grid--3 mb-6">
        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">A receber</span>
            <span class="kpi__icone">${ICONES.dinheiro}</span>
          </div>
          <div class="kpi__valor">R$ 0,00</div>
        </div>
        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">A pagar</span>
            <span class="kpi__icone">${ICONES.dinheiro}</span>
          </div>
          <div class="kpi__valor">R$ 0,00</div>
        </div>
        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Saldo do período</span>
            <span class="kpi__icone">${ICONES.dinheiro}</span>
          </div>
          <div class="kpi__valor">R$ 0,00</div>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div class="vazio">
            <div class="vazio__icone">${ICONES.financeiro}</div>
            <h3 class="vazio__titulo">Sem lançamentos</h3>
            <p class="vazio__descricao">
              As vendas por marketplace geram contas a receber com prazo de repasse.
              Cadastre um canal para começar.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- CLIENTES & FORNECEDORES ---------- */

  function renderClientes() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Clientes & Fornecedores</h1>
          <p class="pagina-header__subtitulo">Contatos, histórico e origem.</p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario">+ Fornecedor</button>
          <button class="btn btn--primario">+ Cliente</button>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div class="vazio">
            <div class="vazio__icone">${ICONES.clientes}</div>
            <h3 class="vazio__titulo">Nenhum cliente cadastrado</h3>
            <p class="vazio__descricao">
              Cadastre clientes com origem (Instagram, WhatsApp, Shopee...) para
              descobrir de onde vêm suas vendas.
            </p>
            <button class="btn btn--primario">+ Novo cliente</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- RELATÓRIOS ---------- */

  function renderRelatorios() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Relatórios</h1>
          <p class="pagina-header__subtitulo">Vendas, lucro, estoque e encomendas.</p>
        </div>
      </div>

      <div class="grid grid--3">
        ${[
          { titulo: 'Vendas por período', desc: 'Faturamento e ticket médio.' },
          { titulo: 'Lucro por canal',    desc: 'Qual canal dá mais lucro.' },
          { titulo: 'Produtos vendidos',  desc: 'Mais vendidos e sazonalidade.' },
          { titulo: 'Estoque baixo',      desc: 'O que precisa repor.' },
          { titulo: 'Encomendas',         desc: 'Prazo e status.' },
          { titulo: 'Clientes',           desc: 'Origem e recompra.' }
        ].map(r => `
          <div class="card">
            <div class="card__body">
              <h3 class="card__titulo">${r.titulo}</h3>
              <p class="card__subtitulo">${r.desc}</p>
              <button class="btn btn--secundario btn--sm mt-3">Abrir</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ---------- QR CODE ---------- */

  function renderQRCode() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">QR Code</h1>
          <p class="pagina-header__subtitulo">Gere códigos para produtos, Pix, catálogo e mais.</p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario">+ Novo QR Code</button>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <div class="vazio">
            <div class="vazio__icone">${ICONES.qrcode}</div>
            <h3 class="vazio__titulo">Nenhum QR Code gerado</h3>
            <p class="vazio__descricao">
              QR Codes dinâmicos continuam funcionando mesmo se o destino mudar.
              Imprima, baixe em PNG, SVG ou PDF.
            </p>
            <button class="btn btn--primario">+ Novo QR Code</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- CONFIGURAÇÕES ---------- */

  function renderConfig() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Configurações</h1>
          <p class="pagina-header__subtitulo">Usuários, auditoria, backup e preferências.</p>
        </div>
      </div>

      <div class="grid grid--2">
        ${[
          { titulo: 'Usuários',    desc: 'Quem acessa e quais módulos cada um vê.' },
          { titulo: 'Auditoria',   desc: 'Histórico de ações por usuário.' },
          { titulo: 'Backup',      desc: 'Exportação e status do backup.' },
          { titulo: 'Preferências',desc: 'Categorias de SKU, unidades e margens padrão.' }
        ].map(c => `
          <div class="card">
            <div class="card__body">
              <h3 class="card__titulo">${c.titulo}</h3>
              <p class="card__subtitulo">${c.desc}</p>
              <button class="btn btn--secundario btn--sm mt-3">Abrir</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ==========================================================
     4. EXPORTA AS TELAS PARA O ROUTER
     ========================================================== */

  window.renderInicio      = renderInicio;
  window.renderProdutos    = renderProdutos;
  window.renderPrecificar  = renderPrecificar;
  window.renderCanais      = renderCanais;
  window.renderEncomendas  = renderEncomendas;
  window.renderVendas      = renderVendas;
  window.renderFinanceiro  = renderFinanceiro;
  window.renderClientes    = renderClientes;
  window.renderRelatorios  = renderRelatorios;
  window.renderQRCode      = renderQRCode;
  window.renderConfig      = renderConfig;

  /* ==========================================================
     5. INICIALIZAÇÃO
     ========================================================== */

  function iniciar() {
    // Injeta o menu lateral
    const navMenu = document.getElementById('sidebar-menu');
    if (navMenu) navMenu.innerHTML = renderMenu();

    // Botão de recolher sidebar (desktop)
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const app = document.querySelector('.app');
        if (!app) return;
        if (window.innerWidth <= 768) {
          app.classList.toggle('sidebar-aberta');
        } else {
          app.classList.toggle('sidebar-recolhida');
        }
      });
    }

    // Overlay (mobile)
    const overlay = document.getElementById('app-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        document.querySelector('.app')?.classList.remove('sidebar-aberta');
      });
    }

    // Inicia o router
    if (window.ROUTER_PRAFICAR) window.ROUTER_PRAFICAR.iniciar();

    // Ícones do header
    const h = document.getElementById('header-acoes');
    if (h) {
      h.innerHTML = `
        <button class="header__acao" title="Ajuda">${ICONES.ajuda}</button>
        <button class="header__acao" title="Notificações">
          ${ICONES.sino}
          <span class="header__acao-notificacao"></span>
        </button>
      `;
    }

    const b = document.querySelector('.header__busca');
    if (b) {
      b.innerHTML = `
        ${ICONES.busca}
        <input type="search" placeholder="Buscar produtos, clientes, encomendas..." />
      `;
    }
  }

  return { iniciar, ICONES };

})();

document.addEventListener('DOMContentLoaded', () => {
  APP_PRAFICAR.iniciar();
});
