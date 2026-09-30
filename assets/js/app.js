/* ============================================================
   PRAFICAR ERP — APP PRINCIPAL (v5)
   Arquivo: assets/js/app.js
   Descrição: inicialização, menu lateral, header, ícones e
              botão da calculadora flutuante.
   ============================================================ */

const APP_PRAFICAR = (() => {

  /* ==========================================================
     1. ÍCONES SVG
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
    calculadora:  '<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>'
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
        { rota: 'encomendas', texto: 'Encomendas' }
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
     3. INICIALIZAÇÃO
     ========================================================== */

  function iniciar() {
    const navMenu = document.getElementById('sidebar-menu');
    if (navMenu) navMenu.innerHTML = renderMenu();

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

    const overlay = document.getElementById('app-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        document.querySelector('.app')?.classList.remove('sidebar-aberta');
      });
    }

    const h = document.getElementById('header-acoes');
    if (h) {
      h.innerHTML = `
        <button class="header__acao" id="btn-calculadora" title="Calculadora">
          ${ICONES.calculadora}
        </button>
        <button class="header__acao" title="Ajuda">${ICONES.ajuda}</button>
        <button class="header__acao" title="Notificações">
          ${ICONES.sino}
          <span class="header__acao-notificacao"></span>
        </button>
      `;

      document.getElementById('btn-calculadora')?.addEventListener('click', () => {
        window.CALCULADORA_PRAFICAR?.alternar();
      });
    }

    const b = document.querySelector('.header__busca');
    if (b) {
      b.innerHTML = `
        ${ICONES.busca}
        <input type="search" placeholder="Buscar produtos, clientes, encomendas..." />
      `;
    }

    if (window.ROUTER_PRAFICAR) window.ROUTER_PRAFICAR.iniciar();
  }

  return { iniciar, ICONES };

})();

document.addEventListener('DOMContentLoaded', () => {
  APP_PRAFICAR.iniciar();
});
