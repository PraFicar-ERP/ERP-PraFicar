/* ============================================================
   PRAFICAR ERP — MÓDULO FINANCEIRO (v3)
   Arquivo: assets/js/modulos/financeiro.js
   Descrição: contas a receber, contas a pagar, fluxo de caixa
              e aba SANGRIA calculada sobre a Margem de
              Contribuição (Faturamento − CMV − Taxas − Frete).

   v3:
   - Correção: MODULO_VENDAS → MODULO_VENDAS_CORE
   - Correção: totais.subtotal → totais.subtotalPraticado
   - Visual ERP enterprise premium
   - Subtítulos didáticos em todas as abas
   ============================================================ */

const MODULO_FINANCEIRO = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let lancamentos = [];
  let sangrias = [];
  let proximoId = 1;
  let proximoIdSangria = 1;

  let filtroStatus = '';
  let filtroBusca = '';
  let abaAtiva = 'receber';       // receber | pagar | fluxo | sangria

  let lancamentoEditandoId = null;

  let periodoSangria = { inicio: '', fim: '' };

  /* ==========================================================
     2. CONSTANTES
     ========================================================== */

  const TIPOS = [
    { codigo: 'receber', nome: 'A receber' },
    { codigo: 'pagar',   nome: 'A pagar' }
  ];

  const STATUS = [
    { codigo: 'pendente',  nome: 'Pendente',  cor: 'atencao' },
    { codigo: 'pago',      nome: 'Pago',      cor: 'sucesso' },
    { codigo: 'vencido',   nome: 'Vencido',   cor: 'critico' },
    { codigo: 'cancelado', nome: 'Cancelado', cor: 'neutro' }
  ];

  const CATEGORIAS_SANGRIA = [
    { chave: 'lucro_retido',   nome: 'Lucro Retido',   percentual: 10, descricao: 'Reserva para imprevistos e crescimento' },
    { chave: 'pro_labore',     nome: 'Pró-labore',     percentual: 50, descricao: 'Sua retirada pelo trabalho' },
    { chave: 'impostos',       nome: 'Impostos',       percentual: 18, descricao: 'Reserva para tributos' },
    { chave: 'reinvestimento', nome: 'Reinvestimento', percentual: 22, descricao: 'Compra de insumos e equipamentos' }
  ];

  function statusInfo(codigo) {
    return STATUS.find(s => s.codigo === codigo) || STATUS[0];
  }

  /* ==========================================================
     3. UTILITÁRIOS
     ========================================================== */

  function escaparHTML(t) {
    if (t === null || t === undefined) return '';
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatarMoeda(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
  }

  function hojeISO() {
    return new Date().toISOString().split('T')[0];
  }

  function adicionarDias(dataISO, dias) {
    const d = new Date(dataISO + 'T00:00:00');
    d.setDate(d.getDate() + Number(dias || 0));
    return d.toISOString().split('T')[0];
  }

  function inicioDoMes() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }

  /* ==========================================================
     4. CRUD DE LANÇAMENTOS
     ========================================================== */

  function criarLancamento(dados) {
    const l = {
      id: proximoId++,
      tipo: dados.tipo,
      descricao: dados.descricao || '',
      valor: Number(dados.valor) || 0,
      vencimento: dados.vencimento || hojeISO(),
      status: dados.status || 'pendente',
      categoria: dados.categoria || '',
      origem: dados.origem || 'manual',
      vendaId: dados.vendaId || null,
      observacoes: dados.observacoes || '',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    lancamentos.push(l);
    return l;
  }

  function atualizarLancamento(id, dados) {
    const idx = lancamentos.findIndex(l => l.id === id);
    if (idx === -1) return null;
    lancamentos[idx] = {
      ...lancamentos[idx],
      ...dados,
      valor: Number(dados.valor) || 0,
      atualizadoEm: new Date().toISOString()
    };
    return lancamentos[idx];
  }

  function excluirLancamento(id) {
    const idx = lancamentos.findIndex(l => l.id === id);
    if (idx === -1) return false;
    lancamentos[idx].status = 'cancelado';
    lancamentos[idx].atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarLancamento(id) {
    return lancamentos.find(l => l.id === id) || null;
  }

  function marcarComoPago(id) {
    const l = buscarLancamento(id);
    if (!l) return false;
    l.status = 'pago';
    l.atualizadoEm = new Date().toISOString();
    return true;
  }

  /* ==========================================================
     5. SINCRONIZAÇÃO COM VENDAS
     ========================================================== */

  function sincronizarComVendas() {
    if (!window.MODULO_VENDAS_CORE) return;

    const vendas = window.MODULO_VENDAS_CORE._listar() || [];

    vendas.forEach(v => {
      if (v.status === 'cancelada') return;

      const existente = lancamentos.find(l => l.origem === 'venda' && l.vendaId === v.id);
      if (existente) return;

      const canal = window.MODULO_CANAIS?._buscar(v.canalId);
      const prazo = canal ? Number(canal.prazoRepasse) || 0 : 0;

      const vencimento = prazo > 0
        ? adicionarDias(v.criadoEm.split('T')[0], prazo)
        : v.criadoEm.split('T')[0];

      criarLancamento({
        tipo: 'receber',
        descricao: `Venda ${v.numero} · ${v.cliente || 'sem cliente'} · ${v.canalNome}`,
        valor: v.totais?.subtotalPraticado || 0,
        vencimento,
        status: v.status === 'pago' ? 'pago' : 'pendente',
        categoria: 'Vendas',
        origem: 'venda',
        vendaId: v.id
      });
    });
  }

  /* ==========================================================
     6. ATUALIZA VENCIDOS
     ========================================================== */

  function atualizarVencidos() {
    const hoje = hojeISO();
    lancamentos.forEach(l => {
      if (l.status === 'pendente' && l.vencimento < hoje) {
        l.status = 'vencido';
      }
    });
  }

  /* ==========================================================
     7. KPIs DO TOPO
     ========================================================== */

  function calcularKPIs() {
    const ativos = lancamentos.filter(l => l.status !== 'cancelado');

    const aReceber = ativos.filter(l => l.tipo === 'receber' && l.status !== 'pago')
      .reduce((a, l) => a + l.valor, 0);
    const aPagar = ativos.filter(l => l.tipo === 'pagar' && l.status !== 'pago')
      .reduce((a, l) => a + l.valor, 0);
    const recebido = ativos.filter(l => l.tipo === 'receber' && l.status === 'pago')
      .reduce((a, l) => a + l.valor, 0);
    const pago = ativos.filter(l => l.tipo === 'pagar' && l.status === 'pago')
      .reduce((a, l) => a + l.valor, 0);
    const vencidos = ativos.filter(l => l.status === 'vencido')
      .reduce((a, l) => a + l.valor, 0);

    return { aReceber, aPagar, recebido, pago, vencidos, saldo: recebido - pago };
  }

  /* ==========================================================
     8. MOTOR DA SANGRIA — BASE: MARGEM DE CONTRIBUIÇÃO
     ========================================================== */

  function baseSangria() {
    const inicio = periodoSangria.inicio || inicioDoMes();
    const fim = periodoSangria.fim || hojeISO();

    const vendas = (window.MODULO_VENDAS_CORE?._listar() || []).filter(v => {
      const data = v.criadoEm?.split('T')[0];
      return data >= inicio && data <= fim && v.status !== 'cancelada';
    });

    const faturamentoBruto = vendas.reduce((a, v) => a + (Number(v.totais?.subtotalPraticado) || 0), 0);
    const cmv = vendas.reduce((a, v) => a + (Number(v.totais?.custoTotal) || 0), 0);
    const taxasCanal = vendas.reduce((a, v) => a + (Number(v.totais?.taxaCanalValor) || 0) + (Number(v.totais?.taxaFixa) || 0), 0);
    const freteVendedor = vendas.reduce((a, v) => a + (Number(v.freteVendedor) || 0), 0);

    const margemContribuicao = faturamentoBruto - cmv - taxasCanal - freteVendedor;

    const distribuicao = CATEGORIAS_SANGRIA.map(cat => ({
      ...cat,
      valor: margemContribuicao * (cat.percentual / 100)
    }));

    return {
      inicio, fim,
      vendas: vendas.length,
      faturamentoBruto,
      cmv,
      taxasCanal,
      freteVendedor,
      margemContribuicao,
      distribuicao
    };
  }

  /* ==========================================================
     9. SANGRIA — CRUD
     ========================================================== */

  function registrarSangria(categoria, dados) {
    const s = {
      id: proximoIdSangria++,
      categoria,
      categoriaNome: dados.categoriaNome,
      percentual: Number(dados.percentual) || 0,
      planejado: Number(dados.planejado) || 0,
      realizado: Number(dados.realizado) || 0,
      diferenca: (Number(dados.realizado) || 0) - (Number(dados.planejado) || 0),
      status: dados.status,
      data: dados.data || hojeISO(),
      responsavel: dados.responsavel || 'Administrador',
      observacao: dados.observacao || '',
      periodoInicio: dados.periodoInicio,
      periodoFim: dados.periodoFim,
      criadoEm: new Date().toISOString()
    };
    sangrias.push(s);
    return s;
  }

  function buscarSangria(categoria, periodoInicio, periodoFim) {
    return sangrias.find(s =>
      s.categoria === categoria &&
      s.periodoInicio === periodoInicio &&
      s.periodoFim === periodoFim
    ) || null;
  }

  /* ==========================================================
     10. FILTROS DE LANÇAMENTOS
     ========================================================== */

  function lancamentosFiltrados() {
    return lancamentos.filter(l => {
      if (l.tipo !== abaAtiva && abaAtiva !== 'fluxo') return false;
      if (filtroStatus && l.status !== filtroStatus) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${l.descricao} ${l.categoria}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarAba(aba) {
    abaAtiva = aba;
    filtroStatus = '';
    filtroBusca = '';
    rerender();
  }

  function alterarFiltroBusca(v) { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroStatus(v) { filtroStatus = v; rerender(); }

  function alterarPeriodoSangria(campo, valor) {
    periodoSangria[campo] = valor;
    rerender();
  }

  /* ==========================================================
     11. RENDER — PRINCIPAL
     ========================================================== */

  function render() {
    sincronizarComVendas();
    atualizarVencidos();

    const k = calcularKPIs();

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Financeiro</h1>
          <p class="pagina-header__subtitulo">
            Contas a receber, contas a pagar, fluxo de caixa e sangria.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario" onclick="MODULO_FINANCEIRO.abrirNovo('pagar')">
            + Conta a pagar
          </button>
          <button class="btn btn--primario" onclick="MODULO_FINANCEIRO.abrirNovo('receber')">
            + Conta a receber
          </button>
        </div>
      </div>

      <div class="grid grid--4 mb-6">
        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">A receber</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </span>
          </div>
          <div class="kpi__valor text-sucesso">${formatarMoeda(k.aReceber)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Pendente de recebimento</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">A pagar</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </span>
          </div>
          <div class="kpi__valor text-critico">${formatarMoeda(k.aPagar)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Pendente de pagamento</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Vencidos</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </span>
          </div>
          <div class="kpi__valor ${k.vencidos > 0 ? 'text-critico' : ''}">${formatarMoeda(k.vencidos)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Em atraso</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Saldo realizado</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            </span>
          </div>
          <div class="kpi__valor ${k.saldo >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(k.saldo)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Recebido − Pago</div>
        </div>
      </div>

      <div class="fin-abas">
        <button class="fin-aba ${abaAtiva === 'receber' ? 'fin-aba--ativa' : ''}" onclick="MODULO_FINANCEIRO.alterarAba('receber')">A receber</button>
        <button class="fin-aba ${abaAtiva === 'pagar' ? 'fin-aba--ativa' : ''}" onclick="MODULO_FINANCEIRO.alterarAba('pagar')">A pagar</button>
        <button class="fin-aba ${abaAtiva === 'fluxo' ? 'fin-aba--ativa' : ''}" onclick="MODULO_FINANCEIRO.alterarAba('fluxo')">Fluxo de caixa</button>
        <button class="fin-aba ${abaAtiva === 'sangria' ? 'fin-aba--ativa' : ''}" onclick="MODULO_FINANCEIRO.alterarAba('sangria')">Sangria</button>
      </div>

      ${abaAtiva === 'fluxo' ? renderFluxoCaixa() : ''}
      ${abaAtiva === 'sangria' ? renderSangria() : ''}
      ${abaAtiva !== 'fluxo' && abaAtiva !== 'sangria' ? renderAbaLancamentos() : ''}
    `;
  }

  /* ==========================================================
     12. ABA LANÇAMENTOS
     ========================================================== */

  function renderAbaLancamentos() {
    return `
      <div class="fin-info">
        ${abaAtiva === 'receber'
          ? 'Vendas geram contas a receber automaticamente, respeitando o prazo de repasse do canal.'
          : 'Cadastre contas a pagar para acompanhar custos e despesas.'}
      </div>

      <div class="filtros-financeiro">
        <div class="filtros-financeiro__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por descrição ou categoria..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_FINANCEIRO.alterarFiltroBusca(this.value)"
          />
        </div>

        <select class="filtros-financeiro__select" onchange="MODULO_FINANCEIRO.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          ${STATUS.map(s => `
            <option value="${s.codigo}" ${filtroStatus === s.codigo ? 'selected' : ''}>${s.nome}</option>
          `).join('')}
        </select>
      </div>

      <div id="tabela-financeiro-wrapper">
        ${renderTabela()}
      </div>
    `;
  }

  function renderTabela() {
    const lista = lancamentosFiltrados();

    if (lista.length === 0) {
      const titulo = abaAtiva === 'receber' ? 'Nenhuma conta a receber' : 'Nenhuma conta a pagar';
      const desc = abaAtiva === 'receber'
        ? 'Vendas por marketplace geram contas a receber automaticamente.'
        : 'Cadastre contas a pagar para acompanhar seus custos.';

      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3 class="vazio__titulo">${titulo}</h3>
            <p class="vazio__descricao">${desc}</p>
            <button class="btn btn--primario" onclick="MODULO_FINANCEIRO.abrirNovo('${abaAtiva}')">
              + Nova conta
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="tabela-wrapper">
        <div class="tabela-scroll">
          <table class="tabela">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th class="tabela__numero">Valor</th>
                <th>Origem</th>
                <th>Status</th>
                <th class="tabela__acao"></th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(l => renderLinha(l)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLinha(l) {
    const s = statusInfo(l.status);

    return `
      <tr>
        <td>
          <div class="fin-descricao">${escaparHTML(l.descricao)}</div>
          ${l.observacoes ? `<div class="fin-obs">${escaparHTML(l.observacoes)}</div>` : ''}
        </td>
        <td>${escaparHTML(l.categoria || '—')}</td>
        <td class="${l.status === 'vencido' ? 'text-critico peso-semibold' : ''}">${formatarData(l.vencimento)}</td>
        <td class="tabela__numero peso-semibold ${l.tipo === 'receber' ? 'text-sucesso' : 'text-critico'}">
          ${formatarMoeda(l.valor)}
        </td>
        <td>
          ${l.origem === 'venda'
            ? `<span class="badge badge--info">Venda</span>`
            : l.origem === 'sangria'
              ? `<span class="badge badge--atencao">Sangria</span>`
              : `<span class="badge badge--neutro">Manual</span>`}
        </td>
        <td><span class="badge badge--${s.cor}">${s.nome}</span></td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            ${l.status !== 'pago' && l.status !== 'cancelado' ? `
              <button class="btn-icone" title="Marcar como pago" onclick="MODULO_FINANCEIRO.marcarPago(${l.id})">
                <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
              </button>
            ` : ''}
            ${l.origem === 'manual' ? `
              <button class="btn-icone" title="Editar" onclick="MODULO_FINANCEIRO.abrirEdicao(${l.id})">
                <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              </button>
            ` : ''}
            ${l.status !== 'cancelado' ? `
              <button class="btn-icone btn-icone--perigo" title="Cancelar" onclick="MODULO_FINANCEIRO.confirmarExclusao(${l.id})">
                <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     13. ABA FLUXO DE CAIXA
     ========================================================== */

  function renderFluxoCaixa() {
    const hoje = hojeISO();
    const em30 = adicionarDias(hoje, 30);

    const ativos = lancamentos.filter(l => l.status !== 'cancelado');

    const entradas30 = ativos.filter(l => l.tipo === 'receber' && l.status !== 'pago' && l.vencimento >= hoje && l.vencimento <= em30)
      .reduce((a, l) => a + l.valor, 0);
    const saidas30 = ativos.filter(l => l.tipo === 'pagar' && l.status !== 'pago' && l.vencimento >= hoje && l.vencimento <= em30)
      .reduce((a, l) => a + l.valor, 0);
    const saldo30 = entradas30 - saidas30;

    const semanas = [];
    for (let i = 0; i < 4; i++) {
      const inicio = adicionarDias(hoje, i * 7);
      const fim = adicionarDias(hoje, i * 7 + 6);
      const entradas = ativos.filter(l => l.tipo === 'receber' && l.status !== 'pago' && l.vencimento >= inicio && l.vencimento <= fim)
        .reduce((a, l) => a + l.valor, 0);
      const saidas = ativos.filter(l => l.tipo === 'pagar' && l.status !== 'pago' && l.vencimento >= inicio && l.vencimento <= fim)
        .reduce((a, l) => a + l.valor, 0);
      semanas.push({ inicio, fim, entradas, saidas, saldo: entradas - saidas });
    }

    return `
      <div class="fin-info">
        Previsão de entradas e saídas para os próximos 30 dias.
      </div>

      <div class="grid grid--3 mb-6">
        <div class="kpi">
          <div class="kpi__topo"><span class="kpi__label">Entradas 30 dias</span></div>
          <div class="kpi__valor text-sucesso">${formatarMoeda(entradas30)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Previsto</div>
        </div>
        <div class="kpi">
          <div class="kpi__topo"><span class="kpi__label">Saídas 30 dias</span></div>
          <div class="kpi__valor text-critico">${formatarMoeda(saidas30)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Previsto</div>
        </div>
        <div class="kpi">
          <div class="kpi__topo"><span class="kpi__label">Saldo 30 dias</span></div>
          <div class="kpi__valor ${saldo30 >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(saldo30)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Previsto</div>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <div>
            <h3 class="card__titulo">Próximas 4 semanas</h3>
            <p class="card__subtitulo">Entradas e saídas previstas por semana.</p>
          </div>
        </div>
        <div class="card__body">
          <div class="fluxo-semanas">
            ${semanas.map((s, i) => `
              <div class="fluxo-semana">
                <div class="fluxo-semana__titulo">Semana ${i + 1}</div>
                <div class="fluxo-semana__periodo">${formatarData(s.inicio)} → ${formatarData(s.fim)}</div>
                <div class="fluxo-semana__linha">
                  <span class="fluxo-semana__label">Entradas</span>
                  <span class="fluxo-semana__valor text-sucesso">${formatarMoeda(s.entradas)}</span>
                </div>
                <div class="fluxo-semana__linha">
                  <span class="fluxo-semana__label">Saídas</span>
                  <span class="fluxo-semana__valor text-critico">${formatarMoeda(s.saidas)}</span>
                </div>
                <div class="fluxo-semana__linha fluxo-semana__linha--saldo">
                  <span class="fluxo-semana__label">Saldo</span>
                  <span class="fluxo-semana__valor ${s.saldo >= 0 ? 'text-sucesso' : 'text-critico'}">
                    ${formatarMoeda(s.saldo)}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     14. ABA SANGRIA
     ========================================================== */

  function renderSangria() {
    const b = baseSangria();

    return `
      <div class="fin-info">
        Sangria distribui a <strong>margem de contribuição</strong> (faturamento − custos − taxas − frete)
        entre pró-labore, impostos, reserva e reinvestimento.
      </div>

      <div class="sangria">

        <div class="sangria__filtros">
          <div class="sangria__filtros-titulo">Período da sangria</div>
          <div class="sangria__filtros-campos">
            <input
              type="date"
              value="${b.inicio}"
              onchange="MODULO_FINANCEIRO.alterarPeriodoSangria('inicio', this.value)"
            />
            <span class="rel-custom__sep">até</span>
            <input
              type="date"
              value="${b.fim}"
              onchange="MODULO_FINANCEIRO.alterarPeriodoSangria('fim', this.value)"
            />
          </div>
        </div>

        <div class="sangria__composicao">
          <div class="sangria__composicao-titulo">Composição da base</div>
          <div class="sangria__composicao-linhas">
            <div class="sangria__linha">
              <span>Faturamento bruto (${b.vendas} ${b.vendas === 1 ? 'venda' : 'vendas'})</span>
              <strong>${formatarMoeda(b.faturamentoBruto)}</strong>
            </div>
            <div class="sangria__linha">
              <span>− CMV (custo dos produtos)</span>
              <strong class="text-critico">− ${formatarMoeda(b.cmv)}</strong>
            </div>
            <div class="sangria__linha">
              <span>− Taxas de marketplace</span>
              <strong class="text-critico">− ${formatarMoeda(b.taxasCanal)}</strong>
            </div>
            <div class="sangria__linha">
              <span>− Frete pago por você</span>
              <strong class="text-critico">− ${formatarMoeda(b.freteVendedor)}</strong>
            </div>
            <div class="sangria__linha sangria__linha--destaque">
              <span>Margem de contribuição</span>
              <strong>${formatarMoeda(b.margemContribuicao)}</strong>
            </div>
          </div>
        </div>

        <div class="sangria__cards">
          ${b.distribuicao.map(d => renderCardCategoriaSangria(d, b)).join('')}
        </div>

        <div class="sangria__historico">
          <div class="sangria__historico-header">
            <h3 class="card__titulo">Histórico de sangrias</h3>
          </div>
          ${renderHistoricoSangria()}
        </div>

      </div>
    `;
  }

  function renderCardCategoriaSangria(d, b) {
    const registro = buscarSangria(d.chave, b.inicio, b.fim);

    const realizado = registro ? registro.realizado : 0;
    const diferenca = registro ? registro.diferenca : 0;
    const status = registro ? registro.status : 'pendente';

    const statusLabel = {
      pendente: 'Pendente',
      realizada: 'Realizada',
      divergente: 'Divergente'
    }[status];

    const statusCor = {
      pendente: 'atencao',
      realizada: 'sucesso',
      divergente: 'critico'
    }[status];

    return `
      <div class="sangria-card">
        <div class="sangria-card__header">
          <div class="sangria-card__nome">${escaparHTML(d.nome)}</div>
          <div class="sangria-card__pct">${d.percentual}%</div>
        </div>

        ${d.descricao ? `<div class="sangria-card__desc">${escaparHTML(d.descricao)}</div>` : ''}

        <div class="sangria-card__valor-principal">
          ${formatarMoeda(d.valor)}
        </div>
        <div class="sangria-card__valor-label">planejado</div>

        <div class="sangria-card__detalhes">
          <div class="sangria-card__linha">
            <span>Realizado</span>
            <strong>${formatarMoeda(realizado)}</strong>
          </div>
          <div class="sangria-card__linha">
            <span>Diferença</span>
            <strong class="${diferenca === 0 ? '' : diferenca > 0 ? 'text-sucesso' : 'text-critico'}">
              ${diferenca >= 0 ? '+' : ''}${formatarMoeda(diferenca)}
            </strong>
          </div>
        </div>

        <div class="sangria-card__footer">
          <span class="badge badge--${statusCor}">${statusLabel}</span>
          <button class="btn btn--secundario btn--sm" onclick="MODULO_FINANCEIRO.abrirModalSangria('${d.chave}')">
            ${registro ? 'Editar' : 'Registrar'}
          </button>
        </div>
      </div>
    `;
  }

  function renderHistoricoSangria() {
    if (sangrias.length === 0) {
      return `
        <div class="vazio">
          <div class="vazio__icone">
            <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          </div>
          <h3 class="vazio__titulo">Nenhuma sangria registrada</h3>
          <p class="vazio__descricao">
            Registre uma sangria para acompanhar o que foi efetivamente distribuído.
          </p>
        </div>
      `;
    }

    return `
      <div class="tabela-wrapper">
        <div class="tabela-scroll">
          <table class="tabela">
            <thead>
              <tr>
                <th>Período</th>
                <th>Categoria</th>
                <th class="tabela__numero">%</th>
                <th class="tabela__numero">Planejado</th>
                <th class="tabela__numero">Realizado</th>
                <th class="tabela__numero">Diferença</th>
                <th>Status</th>
                <th>Data</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              ${sangrias.slice().reverse().map(s => {
                const statusCor = {
                  pendente: 'atencao',
                  realizada: 'sucesso',
                  divergente: 'critico'
                }[s.status];
                const statusLabel = {
                  pendente: 'Pendente',
                  realizada: 'Realizada',
                  divergente: 'Divergente'
                }[s.status];
                return `
                  <tr>
                    <td>${formatarData(s.periodoInicio)} → ${formatarData(s.periodoFim)}</td>
                    <td>${escaparHTML(s.categoriaNome)}</td>
                    <td class="tabela__numero">${s.percentual}%</td>
                    <td class="tabela__numero">${formatarMoeda(s.planejado)}</td>
                    <td class="tabela__numero">${formatarMoeda(s.realizado)}</td>
                    <td class="tabela__numero ${s.diferenca === 0 ? '' : s.diferenca > 0 ? 'text-sucesso' : 'text-critico'}">
                      ${s.diferenca >= 0 ? '+' : ''}${formatarMoeda(s.diferenca)}
                    </td>
                    <td><span class="badge badge--${statusCor}">${statusLabel}</span></td>
                    <td>${formatarData(s.data)}</td>
                    <td>${escaparHTML(s.responsavel)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     15. MODAL DE SANGRIA
     ========================================================== */

  function abrirModalSangria(chaveCategoria) {
    const cat = CATEGORIAS_SANGRIA.find(c => c.chave === chaveCategoria);
    if (!cat) return;

    const b = baseSangria();
    const planejado = b.margemContribuicao * (cat.percentual / 100);
    const registro = buscarSangria(chaveCategoria, b.inicio, b.fim);

    const html = `
      <div class="modal-overlay ativo" id="modal-sangria">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Registrar ${escaparHTML(cat.nome)}</h2>
            <button class="modal__fechar" onclick="MODULO_FINANCEIRO.fecharModalSangria()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="sangria-resumo">
              <div class="sangria-resumo__linha">
                <span>Margem de contribuição do período</span>
                <strong>${formatarMoeda(b.margemContribuicao)}</strong>
              </div>
              <div class="sangria-resumo__linha">
                <span>Percentual</span>
                <strong>${cat.percentual}%</strong>
              </div>
              <div class="sangria-resumo__linha sangria-resumo__linha--destaque">
                <span>Valor planejado</span>
                <strong>${formatarMoeda(planejado)}</strong>
              </div>
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="sang-valor">Valor realizado (R$)</label>
                <input
                  id="sang-valor"
                  type="number"
                  min="0"
                  step="0.01"
                  value="${registro?.realizado ?? ''}"
                  placeholder="0,00"
                  oninput="MODULO_FINANCEIRO.atualizarDiferencaSangria(${planejado})"
                />
              </div>
              <div class="form-grupo">
                <label>Diferença</label>
                <div class="prec-info-calc" id="sang-diferenca">R$ 0,00</div>
              </div>
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="sang-data">Data</label>
                <input id="sang-data" type="date" value="${registro?.data || hojeISO()}" />
              </div>
              <div class="form-grupo">
                <label for="sang-responsavel">Responsável</label>
                <input id="sang-responsavel" type="text" value="${escaparHTML(registro?.responsavel || 'Administrador')}" />
              </div>
            </div>

            <div class="form-grupo">
              <label for="sang-obs">Observação</label>
              <textarea id="sang-obs" placeholder="Observações sobre esta sangria...">${escaparHTML(registro?.observacao || '')}</textarea>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_FINANCEIRO.fecharModalSangria()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_FINANCEIRO.salvarSangria('${chaveCategoria}', ${planejado})">
              Confirmar sangria
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-sangria')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
      document.getElementById('sang-valor')?.focus();
      if (registro) {
        document.getElementById('sang-diferenca').textContent =
          formatarMoeda(registro.realizado - planejado);
      }
    }, 50);
  }

  function fecharModalSangria() {
    document.getElementById('modal-sangria')?.remove();
  }

  function atualizarDiferencaSangria(planejado) {
    const v = Number(document.getElementById('sang-valor')?.value) || 0;
    const el = document.getElementById('sang-diferenca');
    if (!el) return;
    const dif = v - planejado;
    el.textContent = formatarMoeda(dif);
    el.style.color = dif === 0 ? '' : dif > 0 ? 'var(--cor-sucesso)' : 'var(--cor-critico)';
  }

  function salvarSangria(chaveCategoria, planejado) {
    const cat = CATEGORIAS_SANGRIA.find(c => c.chave === chaveCategoria);
    if (!cat) return;

    const valorRealizado = Number(document.getElementById('sang-valor').value) || 0;
    const data = document.getElementById('sang-data').value || hojeISO();
    const responsavel = document.getElementById('sang-responsavel').value.trim() || 'Administrador';
    const observacao = document.getElementById('sang-obs').value.trim();

    if (valorRealizado < 0) return alert('Valor inválido.');

    const b = baseSangria();
    const diferenca = valorRealizado - planejado;

    let status = 'pendente';
    if (valorRealizado > 0) {
      status = Math.abs(diferenca) < 0.01 ? 'realizada' : 'divergente';
    }

    sangrias = sangrias.filter(s =>
      !(s.categoria === chaveCategoria && s.periodoInicio === b.inicio && s.periodoFim === b.fim)
    );

    registrarSangria(chaveCategoria, {
      categoriaNome: cat.nome,
      percentual: cat.percentual,
      planejado,
      realizado: valorRealizado,
      status,
      data,
      responsavel,
      observacao,
      periodoInicio: b.inicio,
      periodoFim: b.fim
    });

    if (status !== 'pendente') {
      registrarMovimentacoesDaSangria(cat, valorRealizado, data, b);
    }

    fecharModalSangria();
    rerender();
  }

  function registrarMovimentacoesDaSangria(cat, valor, data, b) {
    lancamentos = lancamentos.filter(l =>
      !(l.origem === 'sangria' && l.categoria === cat.nome &&
        l.descricao.includes(b.inicio) && l.descricao.includes(b.fim))
    );

    if (valor <= 0) return;

    criarLancamento({
      tipo: 'pagar',
      descricao: `Sangria ${cat.nome} · ${b.inicio} a ${b.fim}`,
      valor,
      vencimento: data,
      status: 'pago',
      categoria: 'Sangria',
      origem: 'sangria',
      observacoes: `Destinação: ${cat.nome} (${cat.percentual}%)`
    });
  }

  /* ==========================================================
     16. MODAL DE LANÇAMENTO
     ========================================================== */

  function abrirNovo(tipo) {
    lancamentoEditandoId = null;
    abrirModal(tipo);
  }

  function abrirEdicao(id) {
    lancamentoEditandoId = id;
    const l = buscarLancamento(id);
    abrirModal(l ? l.tipo : 'receber');
  }

  function abrirModal(tipo) {
    const l = lancamentoEditandoId ? buscarLancamento(lancamentoEditandoId) : null;
    const editando = !!l;

    const html = `
      <div class="modal-overlay ativo" id="modal-financeiro">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">
              ${editando ? 'Editar lançamento' : tipo === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'}
            </h2>
            <button class="modal__fechar" onclick="MODULO_FINANCEIRO.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <form id="form-financeiro" onsubmit="MODULO_FINANCEIRO.salvar(event)">
              <div class="form-grupo">
                <label for="fin-tipo">Tipo <span class="form-obrigatorio">*</span></label>
                <select id="fin-tipo" required>
                  ${TIPOS.map(t => `
                    <option value="${t.codigo}" ${(l?.tipo || tipo) === t.codigo ? 'selected' : ''}>${t.nome}</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-grupo">
                <label for="fin-descricao">Descrição <span class="form-obrigatorio">*</span></label>
                <input id="fin-descricao" type="text" required value="${escaparHTML(l?.descricao || '')}" placeholder="Ex: Compra de papel fotográfico" />
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="fin-valor">Valor (R$) <span class="form-obrigatorio">*</span></label>
                  <input id="fin-valor" type="number" min="0.01" step="0.01" required value="${l?.valor ?? ''}" placeholder="0,00" />
                </div>
                <div class="form-grupo">
                  <label for="fin-vencimento">Vencimento <span class="form-obrigatorio">*</span></label>
                  <input id="fin-vencimento" type="date" required value="${l?.vencimento || hojeISO()}" />
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="fin-categoria">Categoria</label>
                  <input id="fin-categoria" type="text" value="${escaparHTML(l?.categoria || '')}" placeholder="Ex: Insumos, Frete, Marketing..." />
                </div>
                <div class="form-grupo">
                  <label for="fin-status">Status</label>
                  <select id="fin-status">
                    ${STATUS.filter(s => s.codigo !== 'vencido').map(s => `
                      <option value="${s.codigo}" ${(l?.status || 'pendente') === s.codigo ? 'selected' : ''}>${s.nome}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-grupo">
                <label for="fin-obs">Observações</label>
                <textarea id="fin-obs" placeholder="Detalhes adicionais...">${escaparHTML(l?.observacoes || '')}</textarea>
              </div>
            </form>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_FINANCEIRO.fecharModal()">Cancelar</button>
            <button class="btn btn--primario" onclick="document.getElementById('form-financeiro').requestSubmit()">
              ${editando ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-financeiro')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('fin-descricao')?.focus(), 50);
  }

  function fecharModal() {
    document.getElementById('modal-financeiro')?.remove();
    lancamentoEditandoId = null;
  }

  function salvar(event) {
    event.preventDefault();

    const dados = {
      tipo:        document.getElementById('fin-tipo').value,
      descricao:   document.getElementById('fin-descricao').value.trim(),
      valor:       document.getElementById('fin-valor').value,
      vencimento:  document.getElementById('fin-vencimento').value,
      categoria:   document.getElementById('fin-categoria').value.trim(),
      status:      document.getElementById('fin-status').value,
      observacoes: document.getElementById('fin-obs').value.trim()
    };

    if (!dados.descricao) return alert('Informe a descrição.');
    if (Number(dados.valor) <= 0) return alert('Informe um valor maior que zero.');

    if (lancamentoEditandoId) {
      atualizarLancamento(lancamentoEditandoId, dados);
    } else {
      criarLancamento({ ...dados, origem: 'manual' });
    }

    fecharModal();
    rerender();
  }

  /* ==========================================================
     17. AÇÕES
     ========================================================== */

  function marcarPago(id) {
    marcarComoPago(id);
    rerender();
  }

  function confirmarExclusao(id) {
    const l = buscarLancamento(id);
    if (!l) return;
    const ok = confirm(`Cancelar o lançamento "${l.descricao}"?\n\nEle continuará no histórico como cancelado.`);
    if (!ok) return;
    excluirLancamento(id);
    rerender();
  }

  /* ==========================================================
     18. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'financeiro') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-financeiro-wrapper');
    if (wrapper) wrapper.innerHTML = renderTabela();
  }

  /* ==========================================================
     19. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovo,
    abrirEdicao,
    fecharModal,
    salvar,
    marcarPago,
    confirmarExclusao,
    alterarAba,
    alterarFiltroBusca,
    alterarFiltroStatus,
    alterarPeriodoSangria,
    abrirModalSangria,
    fecharModalSangria,
    atualizarDiferencaSangria,
    salvarSangria,
    _listar: () => [...lancamentos],
    _listarSangrias: () => [...sangrias],
    _buscar: buscarLancamento,
    _calcularKPIs: calcularKPIs,
    _baseSangria: baseSangria,
    TIPOS,
    STATUS,
    CATEGORIAS_SANGRIA
  };

})();

window.MODULO_FINANCEIRO = MODULO_FINANCEIRO;
window.renderFinanceiro = MODULO_FINANCEIRO.render;
