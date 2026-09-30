/* ============================================================
   PRAFICAR ERP — MÓDULO FINANCEIRO
   Arquivo: assets/js/modulos/financeiro.js
   Descrição: contas a receber, contas a pagar e fluxo de caixa.
              Integra com Vendas (gera recebíveis automaticamente
              a partir das vendas por marketplace, respeitando o
              prazo de repasse do canal).
   ============================================================ */

const MODULO_FINANCEIRO = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let lancamentos = [];
  let proximoId = 1;

  let filtroStatus = '';
  let filtroBusca = '';
  let abaAtiva = 'receber';

  let lancamentoEditandoId = null;

  /* ==========================================================
     2. TIPOS E STATUS
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
    const d = new Date(iso + 'T00:00:00');
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

  /* ==========================================================
     4. CRUD
     ========================================================== */

  function criarLancamento(dados) {
    const lanc = {
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
    lancamentos.push(lanc);
    return lanc;
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
    if (!window.MODULO_VENDAS) return;

    const vendas = window.MODULO_VENDAS._listar() || [];

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
        valor: v.totais?.subtotal || 0,
        vencimento,
        status: v.status === 'pago' ? 'pago' : 'pendente',
        categoria: 'Vendas',
        origem: 'venda',
        vendaId: v.id
      });
    });
  }

  /* ==========================================================
     6. ATUALIZA STATUS "VENCIDO"
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
     7. KPIs
     ========================================================== */

  function calcularKPIs() {
    const ativos = lancamentos.filter(l => l.status !== 'cancelado');

    const aReceber = ativos
      .filter(l => l.tipo === 'receber' && l.status !== 'pago')
      .reduce((acc, l) => acc + l.valor, 0);

    const aPagar = ativos
      .filter(l => l.tipo === 'pagar' && l.status !== 'pago')
      .reduce((acc, l) => acc + l.valor, 0);

    const recebido = ativos
      .filter(l => l.tipo === 'receber' && l.status === 'pago')
      .reduce((acc, l) => acc + l.valor, 0);

    const pago = ativos
      .filter(l => l.tipo === 'pagar' && l.status === 'pago')
      .reduce((acc, l) => acc + l.valor, 0);

    const vencidos = ativos
      .filter(l => l.status === 'vencido')
      .reduce((acc, l) => acc + l.valor, 0);

    const saldo = recebido - pago;

    return { aReceber, aPagar, recebido, pago, vencidos, saldo };
  }

  /* ==========================================================
     8. FILTROS
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

  /* ==========================================================
     9. RENDER — TELA PRINCIPAL
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
            Contas a receber, contas a pagar e fluxo de caixa.
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
          <div class="kpi__variacao kpi__variacao--neutra">Pendente</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">A pagar</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </span>
          </div>
          <div class="kpi__valor text-critico">${formatarMoeda(k.aPagar)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Pendente</div>
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
        <button class="fin-aba ${abaAtiva === 'receber' ? 'fin-aba--ativa' : ''}" onclick="MODULO_FINANCEIRO.alterarAba('receber')">
          A receber
        </button>
        <button class="fin-aba ${abaAtiva === 'pagar' ? 'fin-aba--ativa' : ''}" onclick="MODULO_FINANCEIRO.alterarAba('pagar')">
          A pagar
        </button>
        <button class="fin-aba ${abaAtiva === 'fluxo' ? 'fin-aba--ativa' : ''}" onclick="MODULO_FINANCEIRO.alterarAba('fluxo')">
          Fluxo de caixa
        </button>
      </div>

      ${abaAtiva === 'fluxo' ? renderFluxoCaixa() : renderAbaLancamentos()}
    `;
  }

  function renderAbaLancamentos() {
    return `
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
      const titulo = abaAtiva === 'receber'
        ? 'Nenhuma conta a receber'
        : 'Nenhuma conta a pagar';

      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3 class="vazio__titulo">${titulo}</h3>
            <p class="vazio__descricao">
              ${abaAtiva === 'receber'
                ? 'Vendas por marketplace geram contas a receber automaticamente, respeitando o prazo de repasse do canal.'
                : 'Cadastre contas a pagar para acompanhar seus custos e despesas.'}
            </p>
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

  function renderFluxoCaixa() {
    const hoje = hojeISO();
    const em30 = adicionarDias(hoje, 30);

    const ativos = lancamentos.filter(l => l.status !== 'cancelado');

    const entradas30 = ativos
      .filter(l => l.tipo === 'receber' && l.status !== 'pago' && l.vencimento >= hoje && l.vencimento <= em30)
      .reduce((acc, l) => acc + l.valor, 0);

    const saidas30 = ativos
      .filter(l => l.tipo === 'pagar' && l.status !== 'pago' && l.vencimento >= hoje && l.vencimento <= em30)
      .reduce((acc, l) => acc + l.valor, 0);

    const saldo30 = entradas30 - saidas30;

    const semanas = [];
    for (let i = 0; i < 4; i++) {
      const inicio = adicionarDias(hoje, i * 7);
      const fim = adicionarDias(hoje, i * 7 + 6);

      const entradas = ativos
        .filter(l => l.tipo === 'receber' && l.status !== 'pago' && l.vencimento >= inicio && l.vencimento <= fim)
        .reduce((acc, l) => acc + l.valor, 0);

      const saidas = ativos
        .filter(l => l.tipo === 'pagar' && l.status !== 'pago' && l.vencimento >= inicio && l.vencimento <= fim)
        .reduce((acc, l) => acc + l.valor, 0);

      semanas.push({ inicio, fim, entradas, saidas, saldo: entradas - saidas });
    }

    return `
      <div class="grid grid--3 mb-6">
        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Entradas 30 dias</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
            </span>
          </div>
          <div class="kpi__valor text-sucesso">${formatarMoeda(entradas30)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Previsto</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Saídas 30 dias</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
            </span>
          </div>
          <div class="kpi__valor text-critico">${formatarMoeda(saidas30)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Previsto</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Saldo 30 dias</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            </span>
          </div>
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
     10. MODAL
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
              ${editando
                ? 'Editar lançamento'
                : tipo === 'receber'
                  ? 'Nova conta a receber'
                  : 'Nova conta a pagar'}
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
                    <option value="${t.codigo}" ${(l?.tipo || tipo) === t.codigo ? 'selected' : ''}>
                      ${t.nome}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-grupo">
                <label for="fin-descricao">Descrição <span class="form-obrigatorio">*</span></label>
                <input
                  id="fin-descricao"
                  type="text"
                  required
                  value="${escaparHTML(l?.descricao || '')}"
                  placeholder="Ex: Compra de papel fotográfico"
                />
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="fin-valor">Valor (R$) <span class="form-obrigatorio">*</span></label>
                  <input
                    id="fin-valor"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value="${l?.valor ?? ''}"
                    placeholder="0,00"
                  />
                </div>

                <div class="form-grupo">
                  <label for="fin-vencimento">Vencimento <span class="form-obrigatorio">*</span></label>
                  <input
                    id="fin-vencimento"
                    type="date"
                    required
                    value="${l?.vencimento || hojeISO()}"
                  />
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="fin-categoria">Categoria</label>
                  <input
                    id="fin-categoria"
                    type="text"
                    value="${escaparHTML(l?.categoria || '')}"
                    placeholder="Ex: Insumos, Frete, Marketing..."
                  />
                </div>

                <div class="form-grupo">
                  <label for="fin-status">Status</label>
                  <select id="fin-status">
                    ${STATUS.filter(s => s.codigo !== 'vencido').map(s => `
                      <option value="${s.codigo}" ${(l?.status || 'pendente') === s.codigo ? 'selected' : ''}>
                        ${s.nome}
                      </option>
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

  /* ==========================================================
     11. SALVAR
     ========================================================== */

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
     12. AÇÕES
     ========================================================== */

  function marcarPago(id) {
    marcarComoPago(id);
    rerender();
  }

  function confirmarExclusao(id) {
    const l = buscarLancamento(id);
    if (!l) return;
    const ok = confirm(
      `Cancelar o lançamento "${l.descricao}"?\n\n` +
      `Ele continuará no histórico como cancelado.`
    );
    if (!ok) return;
    excluirLancamento(id);
    rerender();
  }

  /* ==========================================================
     13. RERENDER
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
     14. API PÚBLICA
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
    _listar: () => [...lancamentos],
    _buscar: buscarLancamento,
    _calcularKPIs: calcularKPIs,
    TIPOS,
    STATUS
  };

})();

window.MODULO_FINANCEIRO = MODULO_FINANCEIRO;
window.renderFinanceiro = MODULO_FINANCEIRO.render;
