/* ============================================================
   PRAFICAR ERP — MÓDULO INÍCIO (DASHBOARD)
   Arquivo: assets/js/modulos/inicio.js
   Descrição: tela inicial com KPIs, alertas do dia e atalhos.
              Agrega dados dos outros módulos quando disponíveis.
   ============================================================ */

const MODULO_INICIO = (() => {

  /* ==========================================================
     1. ÍCONES LOCAIS
     ========================================================== */

  const ICONES = {
    dinheiro:   '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>',
    raio:       '<svg viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    pacote:     '<svg viewBox="0 0 24 24"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>',
    alerta:     '<svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    relatorios: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    vendas:     '<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    precificar: '<svg viewBox="0 0 24 24"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
    produtos:   '<svg viewBox="0 0 24 24"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>',
    encomendas: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    qrcode:     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M21 14v3M14 21h3M21 21h.01"/></svg>'
  };

  /* ==========================================================
     2. UTILITÁRIOS
     ========================================================== */

  function formatarMoeda(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function hojeISO() {
    return new Date().toISOString().split('T')[0];
  }

  /* ==========================================================
     3. AGREGAÇÃO DE DADOS
     ========================================================== */

  function calcularKPIs() {
    const hoje = hojeISO();

    let vendasHoje = 0;
    let lucroHoje = 0;
    if (window.MODULO_VENDAS) {
      const vendas = (window.MODULO_VENDAS._listar() || [])
        .filter(v => v.status !== 'cancelada' && v.criadoEm?.split('T')[0] === hoje);
      vendasHoje = vendas.reduce((a, v) => a + (Number(v.totais?.subtotal) || 0), 0);
      lucroHoje = vendas.reduce((a, v) => a + (Number(v.totais?.lucro) || 0), 0);
    }

    let encomendasAbertas = 0;
    let encomendasAtrasadas = 0;
    if (window.MODULO_ENCOMENDAS) {
      const encs = window.MODULO_ENCOMENDAS._listar() || [];
      encomendasAbertas = encs.filter(e => !['entregue', 'cancelada'].includes(e.status)).length;
      encomendasAtrasadas = encs.filter(e =>
        !['entregue', 'cancelada'].includes(e.status) &&
        e.prazo && e.prazo < hoje
      ).length;
    }

    let estoqueBaixo = 0;
    if (window.MODULO_PRODUTOS) {
      estoqueBaixo = (window.MODULO_PRODUTOS._listar() || [])
        .filter(p => p.status === 'ativo' && Number(p.estoqueAtual) <= Number(p.estoqueMinimo))
        .length;
    }

    let aReceber = 0;
    let vencidos = 0;
    if (window.MODULO_FINANCEIRO) {
      const k = window.MODULO_FINANCEIRO._calcularKPIs();
      aReceber = k.aReceber || 0;
      vencidos = k.vencidos || 0;
    }

    return {
      vendasHoje,
      lucroHoje,
      encomendasAbertas,
      encomendasAtrasadas,
      estoqueBaixo,
      aReceber,
      vencidos
    };
  }

  /* ==========================================================
     4. RENDER
     ========================================================== */

  function render() {
    const k = calcularKPIs();

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
          <div class="kpi__valor">${formatarMoeda(k.vendasHoje)}</div>
          <div class="kpi__variacao ${k.vendasHoje > 0 ? 'kpi__variacao--positiva' : 'kpi__variacao--neutra'}">
            ${k.vendasHoje > 0 ? 'Já com vendas hoje' : 'Sem vendas ainda'}
          </div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Lucro hoje</span>
            <span class="kpi__icone">${ICONES.raio}</span>
          </div>
          <div class="kpi__valor">${formatarMoeda(k.lucroHoje)}</div>
          <div class="kpi__variacao ${k.lucroHoje > 0 ? 'kpi__variacao--positiva' : 'kpi__variacao--neutra'}">
            ${k.lucroHoje > 0 ? 'Lucro líquido real' : 'Aguardando vendas'}
          </div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Encomendas</span>
            <span class="kpi__icone">${ICONES.pacote}</span>
          </div>
          <div class="kpi__valor">${k.encomendasAbertas}</div>
          <div class="kpi__variacao ${k.encomendasAtrasadas > 0 ? 'kpi__variacao--negativa' : 'kpi__variacao--neutra'}">
            ${k.encomendasAtrasadas > 0
              ? `${k.encomendasAtrasadas} atrasada${k.encomendasAtrasadas > 1 ? 's' : ''}`
              : k.encomendasAbertas > 0 ? 'Em andamento' : 'Nenhuma em aberto'}
          </div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Estoque baixo</span>
            <span class="kpi__icone">${ICONES.alerta}</span>
          </div>
          <div class="kpi__valor ${k.estoqueBaixo > 0 ? 'text-atencao' : ''}">${k.estoqueBaixo}</div>
          <div class="kpi__variacao kpi__variacao--neutra">
            ${k.estoqueBaixo > 0 ? 'Precisa repor' : 'Tudo em ordem'}
          </div>
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
            ${renderAlertas(k)}
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

  function renderAlertas(k) {
    const alertas = [];

    if (k.encomendasAtrasadas > 0) {
      alertas.push({
        tipo: 'critico',
        titulo: `${k.encomendasAtrasadas} encomenda${k.encomendasAtrasadas > 1 ? 's' : ''} atrasada${k.encomendasAtrasadas > 1 ? 's' : ''}`,
        texto: 'Verifique o prazo de entrega no módulo Encomendas.'
      });
    }

    if (k.estoqueBaixo > 0) {
      alertas.push({
        tipo: 'atencao',
        titulo: `${k.estoqueBaixo} produto${k.estoqueBaixo > 1 ? 's' : ''} com estoque baixo`,
        texto: 'Considere repor antes de novas vendas.'
      });
    }

    if (k.vencidos > 0) {
      alertas.push({
        tipo: 'critico',
        titulo: `Contas vencidas`,
        texto: `Existem lançamentos em atraso no Financeiro.`
      });
    }

    if (alertas.length === 0) {
      return `
        <div class="alerta alerta--info">
          <span class="alerta__icone">${ICONES.raio}</span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">Bem-vindo ao PraFicar</div>
            Cadastre canais e produtos para começar. Os alertas aparecem aqui automaticamente.
          </div>
        </div>
      `;
    }

    return alertas.map(a => `
      <div class="alerta alerta--${a.tipo} mb-3">
        <span class="alerta__icone">${ICONES.alerta}</span>
        <div class="alerta__conteudo">
          <div class="alerta__titulo">${a.titulo}</div>
          ${a.texto}
        </div>
      </div>
    `).join('');
  }

  /* ==========================================================
     5. API PÚBLICA
     ========================================================== */

  return {
    render
  };

})();

window.MODULO_INICIO = MODULO_INICIO;
window.renderInicio = MODULO_INICIO.render;
