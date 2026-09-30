/* ============================================================
   PRAFICAR ERP — MÓDULO INÍCIO / DASHBOARD (v2)
   Arquivo: assets/js/modulos/inicio.js
   Descrição: Dashboard com KPIs, ponto de equilíbrio,
              ranking de produtos, reposição de estoque
              e alertas inteligentes.
   ============================================================ */

const MODULO_INICIO = (() => {

  /* ==========================================================
     1. ÍCONES
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
    qrcode:     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M21 14v3M14 21h3M21 21h.01"/></svg>',
    seta_cima:  '<svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>',
    seta_baixo: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    alvo:       '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
  };

  /* ==========================================================
     2. ESTADO
     ========================================================== */

  let periodoRanking = 30;

  /* ==========================================================
     3. UTILITÁRIOS
     ========================================================== */

  function formatarMoeda(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarPercentual(v) {
    const n = Number(v) || 0;
    return `${n.toFixed(1).replace('.', ',')}%`;
  }

  function hojeISO() {
    return new Date().toISOString().split('T')[0];
  }

  function adicionarDias(dataISO, dias) {
    const d = new Date(dataISO + 'T00:00:00');
    d.setDate(d.getDate() + Number(dias || 0));
    return d.toISOString().split('T')[0];
  }

  function diasNoMes() {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  }

  function diaAtual() {
    return new Date().getDate();
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
     4. CONFIGURAÇÕES
     ========================================================== */

  function obterCustosFixos() {
    try {
      const raw = localStorage.getItem('praficar_custos_fixos');
      return raw ? Number(raw) || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  /* ==========================================================
     5. AGREGAÇÃO DE DADOS
     ========================================================== */

  function calcularKPIs() {
    const hoje = hojeISO();

    let vendasHoje = 0;
    let lucroHoje = 0;
    if (window.MODULO_VENDAS) {
      const vendas = (window.MODULO_VENDAS._listar() || [])
        .filter(v => v.status !== 'cancelada' && v.criadoEm?.split('T')[0] === hoje);
      vendasHoje = vendas.reduce((a, v) => a + (Number(v.totais?.subtotalPraticado) || 0), 0);
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

    let produtosMargemBaixa = 0;
    if (window.MODULO_PRODUTOS?._margemAbaixoDoMinimo) {
      produtosMargemBaixa = (window.MODULO_PRODUTOS._listar() || [])
        .filter(p => p.status === 'ativo' && window.MODULO_PRODUTOS._margemAbaixoDoMinimo(p))
        .length;
    }

    let contasVencidas = 0;
    let aReceber = 0;
    if (window.MODULO_FINANCEIRO) {
      const k = window.MODULO_FINANCEIRO._calcularKPIs();
      aReceber = k.aReceber || 0;
      contasVencidas = k.vencidos || 0;
    }

    return {
      vendasHoje,
      lucroHoje,
      encomendasAbertas,
      encomendasAtrasadas,
      estoqueBaixo,
      produtosMargemBaixa,
      contasVencidas,
      aReceber
    };
  }

  /* ==========================================================
     6. PONTO DE EQUILÍBRIO
     ========================================================== */

  function calcularPontoEquilibrio() {
    const custosFixos = obterCustosFixos();

    // Vendas do mês atual
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const inicioMes = `${ano}-${mes}-01`;
    const fimMes = hojeISO();

    const vendas = (window.MODULO_VENDAS?._listar() || []).filter(v => {
      const data = v.criadoEm?.split('T')[0];
      return data >= inicioMes && data <= fimMes && v.status !== 'cancelada';
    });

    const faturamento = vendas.reduce((a, v) => a + (Number(v.totais?.subtotalPraticado) || 0), 0);
    const lucro = vendas.reduce((a, v) => a + (Number(v.totais?.lucro) || 0), 0);
    const margemMedia = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

    // Meta = custos fixos ÷ margem média
    let meta = 0;
    if (custosFixos > 0 && margemMedia > 0) {
      meta = custosFixos / (margemMedia / 100);
    } else if (custosFixos > 0) {
      // Se não tem margem ainda, usa 50% como padrão
      meta = custosFixos / 0.5;
    }

    const atingido = meta > 0 ? Math.min(100, (faturamento / meta) * 100) : 0;
    const falta = Math.max(0, meta - faturamento);

    const totalDiasMes = diasNoMes();
    const diaHoje = diaAtual();
    const diasRestantes = totalDiasMes - diaHoje + 1;
    const metaDiaria = diasRestantes > 0 ? falta / diasRestantes : 0;

    return {
      custosFixos,
      faturamento,
      lucro,
      margemMedia,
      meta,
      atingido,
      falta,
      diasRestantes,
      metaDiaria,
      totalDiasMes,
      diaHoje
    };
  }

  /* ==========================================================
     7. RANKING DE PRODUTOS
     ========================================================== */

  function rankingProdutos() {
    if (!window.MODULO_VENDAS) return { mais: [], menos: [], total: 0 };

    const hoje = hojeISO();
    const inicio = adicionarDias(hoje, -periodoRanking);

    const vendas = (window.MODULO_VENDAS._listar() || []).filter(v => {
      const data = v.criadoEm?.split('T')[0];
      return data >= inicio && data <= hoje && v.status !== 'cancelada';
    });

    const mapa = {};
    vendas.forEach(v => {
      (v.itens || []).forEach(item => {
        const chave = item.sku || item.nome;
        if (!mapa[chave]) {
          mapa[chave] = { sku: item.sku || '', nome: item.nome, quantidade: 0, faturamento: 0 };
        }
        mapa[chave].quantidade += Number(item.quantidade) || 0;
        mapa[chave].faturamento += (Number(item.preco) || 0) * (Number(item.quantidade) || 0);
      });
    });

    const lista = Object.values(mapa);
    const mais = [...lista].sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
    const menos = [...lista].sort((a, b) => a.quantidade - b.quantidade).slice(0, 5);

    return { mais, menos, total: lista.length };
  }

  /* ==========================================================
     8. PRODUTOS PARA REPOR
     ========================================================== */

  function produtosParaRepor() {
    if (!window.MODULO_PRODUTOS) return [];

    return (window.MODULO_PRODUTOS._listar() || [])
      .filter(p => p.status === 'ativo')
      .map(p => {
        const atual = Number(p.estoqueAtual) || 0;
        const minimo = Number(p.estoqueMinimo) || 0;
        let status = 'ok';
        if (atual === 0) status = 'zerado';
        else if (atual <= minimo) status = 'critico';
        else if (atual <= minimo * 2) status = 'atencao';
        return { ...p, atual, minimo, status };
      })
      .filter(p => p.status !== 'ok')
      .sort((a, b) => {
        const ordem = { zerado: 0, critico: 1, atencao: 2 };
        return ordem[a.status] - ordem[b.status];
      });
  }

  /* ==========================================================
     9. PRODUTOS COM MARGEM BAIXA
     ========================================================== */

  function produtosMargemBaixa() {
    if (!window.MODULO_PRODUTOS?._margemAbaixoDoMinimo) return [];

    return (window.MODULO_PRODUTOS._listar() || [])
      .filter(p => p.status === 'ativo' && window.MODULO_PRODUTOS._margemAbaixoDoMinimo(p))
      .map(p => {
        const { margem } = window.MODULO_PRODUTOS._calcularMargem(p);
        return { ...p, margemCalculada: margem };
      })
      .sort((a, b) => a.margemCalculada - b.margemCalculada);
  }

  /* ==========================================================
     10. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const k = calcularKPIs();
    const pe = calcularPontoEquilibrio();

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

      ${renderAlertasCriticos(k)}

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
            <span class="kpi__label">A receber</span>
            <span class="kpi__icone">${ICONES.dinheiro}</span>
          </div>
          <div class="kpi__valor">${formatarMoeda(k.aReceber)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Contas pendentes</div>
        </div>
      </div>

      ${renderPontoEquilibrio(pe)}

      ${renderRanking()}

      ${renderReposicao()}

      ${renderMargemBaixa()}

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

  /* ==========================================================
     11. RENDER — PONTO DE EQUILÍBRIO
     ========================================================== */

  function renderPontoEquilibrio(pe) {
    if (pe.custosFixos === 0) {
      return `
        <div class="card mb-6">
          <div class="card__header">
            <div>
              <h3 class="card__titulo">Ponto de equilíbrio</h3>
              <p class="card__subtitulo">Configure seus custos fixos para ver a meta.</p>
            </div>
          </div>
          <div class="card__body">
            <div class="alerta alerta--info">
              <span class="alerta__icone">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </span>
              <div class="alerta__conteudo">
                <div class="alerta__titulo">Custos fixos não configurados</div>
                Vá em <strong>Configurações → Preferências</strong> e informe seus custos fixos mensais (aluguel, internet, energia, etc.) para o sistema calcular quanto você precisa vender.
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const atingidoArred = Math.round(pe.atingido);
    const cor = pe.atingido >= 100 ? 'sucesso' : pe.atingido >= 60 ? 'atencao' : 'critico';

    return `
      <div class="card mb-6 pe-card">
        <div class="card__header">
          <div>
            <h3 class="card__titulo">Ponto de equilíbrio — Outubro</h3>
            <p class="card__subtitulo">Meta do mês baseada nos custos fixos e na margem média</p>
          </div>
        </div>
        <div class="card__body">
          <div class="pe-grid">
            <div class="pe-coluna pe-coluna--esquerda">
              <div class="pe-linha">
                <span>Custos fixos mensais</span>
                <strong>${formatarMoeda(pe.custosFixos)}</strong>
              </div>
              <div class="pe-linha">
                <span>Margem média</span>
                <strong>${formatarPercentual(pe.margemMedia)}</strong>
              </div>
              <div class="pe-linha pe-linha--destaque">
                <span>Meta mensal</span>
                <strong>${formatarMoeda(pe.meta)}</strong>
              </div>
            </div>

            <div class="pe-coluna pe-coluna--direita">
              <div class="pe-progresso">
                <div class="pe-progresso__topo">
                  <span>${formatarMoeda(pe.faturamento)} vendidos</span>
                  <span class="pe-progresso__pct pe-progresso__pct--${cor}">${atingidoArred}%</span>
                </div>
                <div class="pe-progresso__barra">
                  <div class="pe-progresso__preenchimento pe-progresso__preenchimento--${cor}" style="width: ${Math.min(100, atingidoArred)}%"></div>
                </div>
              </div>

              <div class="pe-restante">
                ${pe.falta > 0 ? `
                  <div class="pe-restante__linha">
                    <span>Falta vender</span>
                    <strong>${formatarMoeda(pe.falta)}</strong>
                  </div>
                  <div class="pe-restante__linha">
                    <span>Dias restantes</span>
                    <strong>${pe.diasRestantes}</strong>
                  </div>
                  <div class="pe-restante__linha pe-restante__linha--destaque">
                    <span>Meta diária</span>
                    <strong>${formatarMoeda(pe.metaDiaria)}</strong>
                  </div>
                ` : `
                  <div class="pe-conquista">
                    🎉 <strong>Meta atingida!</strong> Você já cobriu todos os custos fixos deste mês.
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     12. RENDER — ALERTAS CRÍTICOS (topo)
     ========================================================== */

  function renderAlertasCriticos(k) {
    const alertas = [];

    if (k.produtosMargemBaixa > 0) {
      alertas.push({
        tipo: 'atencao',
        texto: `${k.produtosMargemBaixa} produto${k.produtosMargemBaixa > 1 ? 's' : ''} com margem abaixo do mínimo`,
        rota: 'produtos'
      });
    }

    if (k.encomendasAtrasadas > 0) {
      alertas.push({
        tipo: 'critico',
        texto: `${k.encomendasAtrasadas} encomenda${k.encomendasAtrasadas > 1 ? 's' : ''} atrasada${k.encomendasAtrasadas > 1 ? 's' : ''}`,
        rota: 'encomendas'
      });
    }

    if (k.contasVencidas > 0) {
      alertas.push({
        tipo: 'critico',
        texto: `${k.contasVencidas} conta${k.contasVencidas > 1 ? 's' : ''} vencida${k.contasVencidas > 1 ? 's' : ''}`,
        rota: 'financeiro'
      });
    }

    if (alertas.length === 0) return '';

    return `
      <div class="alertas-topo">
        ${alertas.map(a => `
          <div class="alerta-topo alerta-topo--${a.tipo}" data-rota="${a.rota}">
            ${ICONES.alerta}
            <span>${a.texto}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ==========================================================
     13. RENDER — RANKING
     ========================================================== */

  function renderRanking() {
    const { mais, menos, total } = rankingProdutos();

    return `
      <div class="card mb-6">
        <div class="card__header">
          <div>
            <h3 class="card__titulo">Desempenho de produtos</h3>
            <p class="card__subtitulo">Últimos ${periodoRanking} dias · ${total} ${total === 1 ? 'produto vendido' : 'produtos vendidos'}</p>
          </div>
          <div class="rank-periodo">
            <button class="rank-periodo__btn ${periodoRanking === 7 ? 'rank-periodo__btn--ativo' : ''}" onclick="MODULO_INICIO.alterarPeriodoRanking(7)">7 dias</button>
            <button class="rank-periodo__btn ${periodoRanking === 30 ? 'rank-periodo__btn--ativo' : ''}" onclick="MODULO_INICIO.alterarPeriodoRanking(30)">30 dias</button>
            <button class="rank-periodo__btn ${periodoRanking === 90 ? 'rank-periodo__btn--ativo' : ''}" onclick="MODULO_INICIO.alterarPeriodoRanking(90)">90 dias</button>
          </div>
        </div>
        <div class="card__body">
          <div class="rank-grid">
            <div class="rank-coluna">
              <div class="rank-coluna__titulo">${ICONES.seta_cima} Mais vendidos</div>
              ${mais.length === 0 ? `<div class="rank-vazio">Sem vendas no período</div>` : mais.map((p, i) => `
                <div class="rank-item rank-item--topo">
                  <div class="rank-item__pos">${i + 1}</div>
                  <div class="rank-item__info">
                    <div class="rank-item__nome">${escaparHTML(p.nome)}</div>
                    ${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : ''}
                  </div>
                  <div class="rank-item__num">
                    <div class="rank-item__qtd">${p.quantidade}</div>
                    <div class="rank-item__fat">${formatarMoeda(p.faturamento)}</div>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="rank-coluna">
              <div class="rank-coluna__titulo">${ICONES.seta_baixo} Menos vendidos</div>
              ${menos.length === 0 ? `<div class="rank-vazio">Sem vendas no período</div>` : menos.map((p, i) => `
                <div class="rank-item rank-item--base">
                  <div class="rank-item__pos">${i + 1}</div>
                  <div class="rank-item__info">
                    <div class="rank-item__nome">${escaparHTML(p.nome)}</div>
                    ${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : ''}
                  </div>
                  <div class="rank-item__num">
                    <div class="rank-item__qtd">${p.quantidade}</div>
                    <div class="rank-item__fat">${formatarMoeda(p.faturamento)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     14. RENDER — REPOSIÇÃO
     ========================================================== */

  function renderReposicao() {
    const lista = produtosParaRepor();
    const listaCurta = lista.slice(0, 6);

    return `
      <div class="card mb-6">
        <div class="card__header">
          <div>
            <h3 class="card__titulo">Precisa repor</h3>
            <p class="card__subtitulo">
              ${lista.length === 0
                ? 'Nenhum produto abaixo do mínimo'
                : `${lista.length} ${lista.length === 1 ? 'produto' : 'produtos'} abaixo do estoque mínimo`}
            </p>
          </div>
          ${lista.length > 6 ? `<button class="btn btn--ghost btn--sm" data-rota="produtos">Ver todos</button>` : ''}
        </div>
        <div class="card__body">
          ${lista.length === 0 ? `
            <div class="alerta alerta--sucesso">
              <span class="alerta__icone"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>
              <div class="alerta__conteudo">
                <div class="alerta__titulo">Estoque em ordem</div>
                Todos os produtos estão acima do estoque mínimo.
              </div>
            </div>
          ` : `
            <table class="tabela tabela-reposicao">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th class="tabela__numero">Atual</th>
                  <th class="tabela__numero">Mínimo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${listaCurta.map(p => `
                  <tr>
                    <td>
                      <div class="produto-nome">${escaparHTML(p.nome)}</div>
                      ${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : ''}
                    </td>
                    <td class="tabela__numero peso-semibold">${p.atual} ${escaparHTML(p.unidade || 'un')}</td>
                    <td class="tabela__numero text-secundario">${p.minimo}</td>
                    <td>${renderBadgeStatus(p.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  function renderBadgeStatus(status) {
    if (status === 'zerado')  return '<span class="badge badge--critico">Zerado</span>';
    if (status === 'critico') return '<span class="badge badge--critico">Crítico</span>';
    if (status === 'atencao') return '<span class="badge badge--atencao">Atenção</span>';
    return '<span class="badge badge--sucesso">OK</span>';
  }

  /* ==========================================================
     15. RENDER — MARGEM BAIXA
     ========================================================== */

  function renderMargemBaixa() {
    const lista = produtosMargemBaixa();
    const listaCurta = lista.slice(0, 6);

    if (lista.length === 0) return '';

    return `
      <div class="card mb-6">
        <div class="card__header">
          <div>
            <h3 class="card__titulo">Produtos com margem abaixo do mínimo</h3>
            <p class="card__subtitulo">
              ${lista.length} ${lista.length === 1 ? 'produto precisa' : 'produtos precisam'} de reajuste de preço
            </p>
          </div>
          ${lista.length > 6 ? `<button class="btn btn--ghost btn--sm" data-rota="produtos">Ver todos</button>` : ''}
        </div>
        <div class="card__body">
          <table class="tabela tabela-margem">
            <thead>
              <tr>
                <th>Produto</th>
                <th class="tabela__numero">Custo</th>
                <th class="tabela__numero">Preço</th>
                <th class="tabela__numero">Margem</th>
                <th class="tabela__numero">Mínima</th>
              </tr>
            </thead>
            <tbody>
              ${listaCurta.map(p => `
                <tr>
                  <td>
                    <div class="produto-nome">${escaparHTML(p.nome)}</div>
                    ${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : ''}
                  </td>
                  <td class="tabela__numero">${formatarMoeda(p.custo)}</td>
                  <td class="tabela__numero">${formatarMoeda(p.precoVarejo)}</td>
                  <td class="tabela__numero text-critico peso-semibold">${formatarPercentual(p.margemCalculada)}</td>
                  <td class="tabela__numero text-secundario">${formatarPercentual(p.margemMinima || 30)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     16. RENDER — ALERTAS DO DIA
     ========================================================== */

  function renderAlertas(k) {
    const alertas = [];

    if (k.encomendasAtrasadas > 0) {
      alertas.push({
        tipo: 'critico',
        titulo: `${k.encomendasAtrasadas} encomenda${k.encomendasAtrasadas > 1 ? 's' : ''} atrasada${k.encomendasAtrasadas > 1 ? 's' : ''}`,
        texto: 'Verifique o prazo no módulo Encomendas.'
      });
    }

    if (k.contasVencidas > 0) {
      alertas.push({
        tipo: 'critico',
        titulo: 'Contas vencidas',
        texto: 'Existem lançamentos em atraso no Financeiro.'
      });
    }

    if (k.produtosMargemBaixa > 0) {
      alertas.push({
        tipo: 'atencao',
        titulo: `${k.produtosMargemBaixa} produto${k.produtosMargemBaixa > 1 ? 's' : ''} com margem baixa`,
        texto: 'Reveja o preço ou reduza custos.'
      });
    }

    if (k.estoqueBaixo > 0) {
      alertas.push({
        tipo: 'atencao',
        titulo: `${k.estoqueBaixo} produto${k.estoqueBaixo > 1 ? 's' : ''} para repor`,
        texto: 'Veja a lista de reposição acima.'
      });
    }

    if (alertas.length === 0) {
      return `
        <div class="alerta alerta--info">
          <span class="alerta__icone">${ICONES.raio}</span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">Tudo em ordem</div>
            Nenhum alerta crítico no momento.
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
     17. AÇÕES
     ========================================================== */

  function alterarPeriodoRanking(dias) {
    periodoRanking = dias;
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'inicio') {
      container.innerHTML = render();
    }
  }

  /* ==========================================================
     18. API PÚBLICA
     ========================================================== */

  return {
    render,
    alterarPeriodoRanking
  };

})();

window.MODULO_INICIO = MODULO_INICIO;
window.renderInicio = MODULO_INICIO.render;
