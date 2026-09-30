/* ============================================================
   PRAFICAR ERP — MÓDULO VENDAS
   Arquivo: assets/js/modulos/vendas.js
   Descrição: registro de vendas por canal, com cálculo do
              lucro líquido real (descontando taxa % do canal,
              taxa fixa, frete pago pelo vendedor) e baixa de
              estoque dos produtos.

   Fórmula do lucro líquido:
     lucro = preco_venda
           - custo_real_do_produto
           - (preco_venda * taxa_percentual_canal)
           - taxa_fixa_canal
           - frete_pago_pelo_vendedor
   ============================================================ */

const MODULO_VENDAS = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let vendas = [];
  let proximoId = 1;
  let proximoNumero = 1;

  let filtroBusca = '';
  let filtroCanal = '';
  let filtroStatus = '';
  let vendaEditandoId = null;

  /* ==========================================================
     2. FORMAS DE PAGAMENTO E STATUS
     ========================================================== */

  const FORMAS_PAGAMENTO = [
    { codigo: 'pix',           nome: 'Pix' },
    { codigo: 'dinheiro',      nome: 'Dinheiro' },
    { codigo: 'cartao',        nome: 'Cartão' },
    { codigo: 'transferencia', nome: 'Transferência' },
    { codigo: 'boleto',        nome: 'Boleto' },
    { codigo: 'outros',        nome: 'Outros' }
  ];

  const STATUS_VENDA = [
    { codigo: 'pendente',  nome: 'Pendente',  cor: 'atencao' },
    { codigo: 'pago',      nome: 'Pago',      cor: 'sucesso' },
    { codigo: 'enviado',   nome: 'Enviado',   cor: 'info' },
    { codigo: 'entregue',  nome: 'Entregue',  cor: 'sucesso' },
    { codigo: 'cancelada', nome: 'Cancelada', cor: 'critico' }
  ];

  function nomeFormaPagamento(codigo) {
    const f = FORMAS_PAGAMENTO.find(x => x.codigo === codigo);
    return f ? f.nome : '—';
  }

  function statusInfo(codigo) {
    return STATUS_VENDA.find(s => s.codigo === codigo) || STATUS_VENDA[0];
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
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
  }

  function gerarNumero() {
    const n = String(proximoNumero).padStart(4, '0');
    proximoNumero++;
    return `VEN-${n}`;
  }

  /* ==========================================================
     4. CANAIS E PRODUTOS
     ========================================================== */

  function listarCanaisAtivos() {
    return (window.MODULO_CANAIS?._listar() || []).filter(c => c.status === 'ativo');
  }

  function listarProdutosAtivos() {
    return (window.MODULO_PRODUTOS?._listar() || []).filter(p => p.status === 'ativo');
  }

  function buscarCanal(id) {
    return window.MODULO_CANAIS?._buscar(id) || null;
  }

  function buscarProduto(id) {
    return window.MODULO_PRODUTOS?._buscar(id) || null;
  }

  /* ==========================================================
     5. CÁLCULO DO LUCRO LÍQUIDO
     ========================================================== */

  function calcularVenda(itens, canalId, freteVendedor) {
    const canal = buscarCanal(canalId);
    const taxaPct = canal ? Number(canal.taxaPercentual) || 0 : 0;
    const taxaFixa = canal ? Number(canal.taxaFixa) || 0 : 0;
    const frete = Number(freteVendedor) || 0;

    let subtotal = 0;
    let custoTotal = 0;

    itens.forEach(item => {
      const sub = (Number(item.preco) || 0) * (Number(item.quantidade) || 0);
      const custo = (Number(item.custo) || 0) * (Number(item.quantidade) || 0);
      subtotal += sub;
      custoTotal += custo;
    });

    const taxaCanalValor = subtotal * (taxaPct / 100);
    const lucro = subtotal - custoTotal - taxaCanalValor - taxaFixa - frete;
    const margem = subtotal > 0 ? (lucro / subtotal) * 100 : 0;

    return {
      subtotal,
      custoTotal,
      taxaPct,
      taxaFixa,
      taxaCanalValor,
      frete,
      lucro,
      margem,
      canal
    };
  }

  /* ==========================================================
     6. CRUD
     ========================================================== */

  function criarVenda(dados) {
    const venda = {
      id: proximoId++,
      numero: gerarNumero(),
      cliente: dados.cliente || '',
      canalId: dados.canalId || '',
      canalNome: dados.canalNome || 'Venda direta',
      itens: dados.itens || [],
      formaPagamento: dados.formaPagamento || 'pix',
      status: dados.status || 'pago',
      freteVendedor: Number(dados.freteVendedor) || 0,
      observacoes: dados.observacoes || '',
      totais: dados.totais || {},
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    vendas.push(venda);

    // Baixa de estoque
    baixarEstoque(venda);

    return venda;
  }

  function atualizarVenda(id, dados) {
    const idx = vendas.findIndex(v => v.id === id);
    if (idx === -1) return null;

    // Reverte a baixa anterior
    estornarEstoque(vendas[idx]);

    vendas[idx] = {
      ...vendas[idx],
      ...dados,
      freteVendedor: Number(dados.freteVendedor) || 0,
      atualizadoEm: new Date().toISOString()
    };

    // Reaplica baixa se não estiver cancelada
    if (vendas[idx].status !== 'cancelada') {
      baixarEstoque(vendas[idx]);
    }

    return vendas[idx];
  }

  function cancelarVenda(id) {
    const v = vendas.find(x => x.id === id);
    if (!v) return false;

    // Se não estava cancelada, estorna estoque
    if (v.status !== 'cancelada') {
      estornarEstoque(v);
    }

    v.status = 'cancelada';
    v.atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarVenda(id) {
    return vendas.find(v => v.id === id) || null;
  }

  /* ==========================================================
     7. BAIXA E ESTORNO DE ESTOQUE
     (mexe diretamente no array em memória de MODULO_PRODUTOS)
     ========================================================== */

  function baixarEstoque(venda) {
    venda.itens.forEach(item => {
      if (!item.produtoId) return;
      const prod = buscarProduto(item.produtoId);
      if (!prod) return;
      prod.estoqueAtual = Math.max(0, Number(prod.estoqueAtual || 0) - Number(item.quantidade || 0));
    });
  }

  function estornarEstoque(venda) {
    venda.itens.forEach(item => {
      if (!item.produtoId) return;
      const prod = buscarProduto(item.produtoId);
      if (!prod) return;
      prod.estoqueAtual = Number(prod.estoqueAtual || 0) + Number(item.quantidade || 0);
    });
  }

  /* ==========================================================
     8. FILTROS
     ========================================================== */

  function vendasFiltradas() {
    return vendas.filter(v => {
      if (filtroCanal && String(v.canalId) !== String(filtroCanal)) return false;
      if (filtroStatus && v.status !== filtroStatus) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${v.numero} ${v.cliente} ${v.canalNome}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarFiltroBusca(v) { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroCanal(v)  { filtroCanal = v; rerender(); }
  function alterarFiltroStatus(v) { filtroStatus = v; rerender(); }

  /* ==========================================================
     9. KPIs DO TOPO
     ========================================================== */

  function calcularKPIs() {
    const ativas = vendas.filter(v => v.status !== 'cancelada');
    const faturamento = ativas.reduce((acc, v) => acc + (Number(v.totais?.subtotal) || 0), 0);
    const lucro = ativas.reduce((acc, v) => acc + (Number(v.totais?.lucro) || 0), 0);
    const qtd = ativas.length;
    const ticket = qtd > 0 ? faturamento / qtd : 0;
    return { faturamento, lucro, qtd, ticket };
  }

  /* ==========================================================
     10. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const kpis = calcularKPIs();

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Vendas</h1>
          <p class="pagina-header__subtitulo">
            Registre vendas com lucro líquido real por canal.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario" onclick="MODULO_VENDAS.abrirNovo()">
            + Nova venda
          </button>
        </div>
      </div>

      <div class="grid grid--4 mb-6">
        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Faturamento</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
            </span>
          </div>
          <div class="kpi__valor">${formatarMoeda(kpis.faturamento)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">${kpis.qtd} ${kpis.qtd === 1 ? 'venda' : 'vendas'}</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Lucro líquido</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </span>
          </div>
          <div class="kpi__valor">${formatarMoeda(kpis.lucro)}</div>
          <div class="kpi__variacao kpi__variacao--positiva">Já com taxas descontadas</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Ticket médio</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            </span>
          </div>
          <div class="kpi__valor">${formatarMoeda(kpis.ticket)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Por venda</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Canceladas</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
            </span>
          </div>
          <div class="kpi__valor">${vendas.filter(v => v.status === 'cancelada').length}</div>
          <div class="kpi__variacao kpi__variacao--neutra">No período</div>
        </div>
      </div>

      <div class="filtros-vendas">
        <div class="filtros-vendas__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por número, cliente ou canal..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_VENDAS.alterarFiltroBusca(this.value)"
          />
        </div>

        <select class="filtros-vendas__select" onchange="MODULO_VENDAS.alterarFiltroCanal(this.value)">
          <option value="">Todos os canais</option>
          ${listarCanaisAtivos().map(c => `
            <option value="${c.id}" ${String(filtroCanal) === String(c.id) ? 'selected' : ''}>
              ${escaparHTML(c.nome)}
            </option>
          `).join('')}
        </select>

        <select class="filtros-vendas__select" onchange="MODULO_VENDAS.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          ${STATUS_VENDA.map(s => `
            <option value="${s.codigo}" ${filtroStatus === s.codigo ? 'selected' : ''}>${s.nome}</option>
          `).join('')}
        </select>
      </div>

      <div id="tabela-vendas-wrapper">
        ${renderTabela()}
      </div>
    `;
  }

  /* ==========================================================
     11. RENDER — TABELA
     ========================================================== */

  function renderTabela() {
    const lista = vendasFiltradas();

    if (lista.length === 0) {
      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${vendas.length === 0 ? 'Nenhuma venda registrada' : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${vendas.length === 0
                ? 'Registre a primeira venda. O lucro é calculado automaticamente considerando a taxa do canal, taxa fixa e frete pago por você.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
            ${vendas.length === 0 ? `
              <button class="btn btn--primario" onclick="MODULO_VENDAS.abrirNovo()">
                + Nova venda
              </button>
            ` : ''}
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
                <th>Número</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th class="tabela__numero">Total</th>
                <th class="tabela__numero">Lucro</th>
                <th class="tabela__numero">Margem</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th class="tabela__acao"></th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(v => renderLinha(v)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLinha(v) {
    const s = statusInfo(v.status);
    const lucro = Number(v.totais?.lucro) || 0;
    const margem = Number(v.totais?.margem) || 0;

    return `
      <tr>
        <td><span class="sku">${escaparHTML(v.numero)}</span></td>
        <td>${escaparHTML(v.cliente || '—')}</td>
        <td>
          <span class="badge badge--info">${escaparHTML(v.canalNome)}</span>
        </td>
        <td class="tabela__numero peso-semibold">${formatarMoeda(v.totais?.subtotal)}</td>
        <td class="tabela__numero ${lucro >= 0 ? 'text-sucesso peso-semibold' : 'text-critico peso-semibold'}">
          ${formatarMoeda(lucro)}
        </td>
        <td class="tabela__numero">${margem.toFixed(1).replace('.', ',')}%</td>
        <td>${escaparHTML(nomeFormaPagamento(v.formaPagamento))}</td>
        <td>
          <span class="badge badge--${s.cor}">${s.nome}</span>
        </td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Ver detalhes" onclick="MODULO_VENDAS.verDetalhes(${v.id})">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${v.status !== 'cancelada' ? `
              <button class="btn-icone btn-icone--perigo" title="Cancelar" onclick="MODULO_VENDAS.confirmarCancelamento(${v.id})">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     12. MODAL — NOVA VENDA
     ========================================================== */

  function abrirNovo() {
    vendaEditandoId = null;
    abrirModal();
  }

  function abrirModal() {
    const html = `
      <div class="modal-overlay ativo" id="modal-venda">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Nova venda</h2>
            <button class="modal__fechar" onclick="MODULO_VENDAS.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body" id="venda-modal-body">
            ${renderFormVenda()}
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_VENDAS.fecharModal()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_VENDAS.salvar()">Registrar venda</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-venda')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => document.getElementById('venda-cliente')?.focus(), 50);
    atualizarResumoVenda();
  }

  function fecharModal() {
    document.getElementById('modal-venda')?.remove();
    vendaEditandoId = null;
    itensVendaTemporarios = [];
  }

  /* ==========================================================
     13. FORMULÁRIO DA VENDA
     ========================================================== */

  function renderFormVenda() {
    return `
      <div class="form-linha">
        <div class="form-grupo">
          <label for="venda-cliente">Cliente</label>
          <input
            id="venda-cliente"
            type="text"
            placeholder="Nome do cliente"
          />
        </div>

        <div class="form-grupo">
          <label for="venda-canal">Canal de venda <span class="form-obrigatorio">*</span></label>
          <select
            id="venda-canal"
            required
            onchange="MODULO_VENDAS.atualizarResumoVenda()"
          >
            <option value="">Venda direta (sem canal)</option>
            ${listarCanaisAtivos().map(c => `
              <option value="${c.id}" data-taxa="${c.taxaPercentual}" data-fixa="${c.taxaFixa}" data-frete="${c.freteResponsavel}">
                ${escaparHTML(c.nome)} — ${c.taxaPercentual}% + ${formatarMoeda(c.taxaFixa)}
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="form-linha">
        <div class="form-grupo">
          <label for="venda-pagamento">Forma de pagamento</label>
          <select id="venda-pagamento">
            ${FORMAS_PAGAMENTO.map(f => `
              <option value="${f.codigo}">${f.nome}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-grupo">
          <label for="venda-status">Status</label>
          <select id="venda-status">
            ${STATUS_VENDA.map(s => `
              <option value="${s.codigo}" ${s.codigo === 'pago' ? 'selected' : ''}>${s.nome}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-grupo">
          <label for="venda-frete">Frete pago por você (R$)</label>
          <input
            id="venda-frete"
            type="number"
            min="0"
            step="0.01"
            value="0"
            oninput="MODULO_VENDAS.atualizarResumoVenda()"
          />
          <span class="form-ajuda">Deixe 0 se o cliente paga.</span>
        </div>
      </div>

      <div class="enc-secao">
        <div class="enc-secao__header">
          <h3 class="enc-secao__titulo">Itens da venda</h3>
          <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_VENDAS.abrirModalItem()">
            + Adicionar item
          </button>
        </div>
        <div id="venda-lista-itens">
          ${renderListaItens(itensVendaTemporarios)}
        </div>
      </div>

      <div class="form-grupo">
        <label for="venda-obs">Observações</label>
        <textarea id="venda-obs" placeholder="Detalhes adicionais..."></textarea>
      </div>

      <div class="venda-resumo" id="venda-resumo">
        ${renderResumoVenda()}
      </div>
    `;
  }

  function renderListaItens(itens) {
    if (itens.length === 0) {
      return `
        <div class="enc-itens-vazio">
          <p>Nenhum item adicionado ainda.</p>
          <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_VENDAS.abrirModalItem()">
            + Adicionar o primeiro item
          </button>
        </div>
      `;
    }

    return `
      <table class="tabela tabela-itens">
        <thead>
          <tr>
            <th>Produto</th>
            <th class="tabela__numero">Qtd</th>
            <th class="tabela__numero">Preço un.</th>
            <th class="tabela__numero">Subtotal</th>
            <th class="tabela__acao"></th>
          </tr>
        </thead>
        <tbody>
          ${itens.map((i, idx) => `
            <tr>
              <td>
                <div class="enc-item-nome">${escaparHTML(i.nome)}</div>
                ${i.sku ? `<span class="sku">${escaparHTML(i.sku)}</span>` : ''}
              </td>
              <td class="tabela__numero">${i.quantidade}</td>
              <td class="tabela__numero">${formatarMoeda(i.preco)}</td>
              <td class="tabela__numero peso-semibold">${formatarMoeda((Number(i.preco) || 0) * (Number(i.quantidade) || 0))}</td>
              <td class="tabela__acao">
                <button type="button" class="btn-icone btn-icone--perigo" title="Remover" onclick="MODULO_VENDAS.removerItem(${idx})">
                  <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /* ==========================================================
     14. MODAL DE ITEM
     ========================================================== */

  function abrirModalItem() {
    const produtos = listarProdutosAtivos();

    const html = `
      <div class="modal-overlay ativo" id="modal-item-venda" style="z-index: 700">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Adicionar item</h2>
            <button class="modal__fechar" onclick="MODULO_VENDAS.fecharModalItem()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="form-grupo">
              <label for="venda-item-produto">Produto</label>
              <select id="venda-item-produto" onchange="MODULO_VENDAS.preencherItemProduto()">
                <option value="">Selecione um produto</option>
                ${produtos.map(p => `
                  <option
                    value="${p.id}"
                    data-nome="${escaparHTML(p.nome)}"
                    data-sku="${escaparHTML(p.sku)}"
                    data-preco="${p.precoVarejo}"
                    data-custo="${p.custo}"
                    data-estoque="${p.estoqueAtual}"
                  >
                    ${escaparHTML(p.sku)} — ${escaparHTML(p.nome)} · ${p.estoqueAtual} un
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-grupo">
              <label for="venda-item-nome">Nome <span class="form-obrigatorio">*</span></label>
              <input id="venda-item-nome" type="text" placeholder="Nome do item" />
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="venda-item-qtd">Quantidade</label>
                <input id="venda-item-qtd" type="number" min="1" step="1" value="1" />
                <span class="form-ajuda" id="venda-item-estoque-aviso"></span>
              </div>
              <div class="form-grupo">
                <label for="venda-item-preco">Preço unitário (R$)</label>
                <input id="venda-item-preco" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_VENDAS.fecharModalItem()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_VENDAS.adicionarItem()">Adicionar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-item-venda')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('venda-item-produto')?.focus(), 50);
  }

  function fecharModalItem() {
    document.getElementById('modal-item-venda')?.remove();
  }

  function preencherItemProduto() {
    const sel = document.getElementById('venda-item-produto');
    if (!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    document.getElementById('venda-item-nome').value = opt.dataset.nome || '';
    document.getElementById('venda-item-preco').value = opt.dataset.preco || '';

    const aviso = document.getElementById('venda-item-estoque-aviso');
    const estoque = Number(opt.dataset.estoque || 0);
    if (aviso) {
      aviso.textContent = `Estoque disponível: ${estoque} un`;
      aviso.style.color = estoque <= 0 ? 'var(--cor-critico)' : 'var(--cor-texto-secundario)';
    }
  }

  let itensVendaTemporarios = [];

  function adicionarItem() {
    const sel = document.getElementById('venda-item-produto');
    const opt = sel && sel.value ? sel.options[sel.selectedIndex] : null;

    const nome = document.getElementById('venda-item-nome').value.trim();
    const quantidade = Number(document.getElementById('venda-item-qtd').value) || 0;
    const preco = Number(document.getElementById('venda-item-preco').value) || 0;

    if (!nome) return alert('Informe o nome do item.');
    if (quantidade <= 0) return alert('Informe a quantidade.');

    const produtoId = opt && sel.value ? Number(sel.value) : null;
    const sku = opt ? opt.dataset.sku : '';
    const custo = opt ? Number(opt.dataset.custo || 0) : 0;
    const estoque = opt ? Number(opt.dataset.estoque || 0) : null;

    // Bloqueia venda acima do estoque disponível
    if (estoque !== null && quantidade > estoque) {
      return alert(`Estoque insuficiente. Disponível: ${estoque} un.`);
    }

    itensVendaTemporarios.push({
      produtoId, nome, sku, quantidade, preco, custo
    });

    atualizarListaItensForm();
    atualizarResumoVenda();
    fecharModalItem();
  }

  function removerItem(idx) {
    itensVendaTemporarios.splice(idx, 1);
    atualizarListaItensForm();
    atualizarResumoVenda();
  }

  function atualizarListaItensForm() {
    const container = document.getElementById('venda-lista-itens');
    if (container) container.innerHTML = renderListaItens(itensVendaTemporarios);
  }

  /* ==========================================================
     15. RESUMO EM TEMPO REAL
     ========================================================== */

  function atualizarResumoVenda() {
    const container = document.getElementById('venda-resumo');
    if (container) container.innerHTML = renderResumoVenda();
  }

  function renderResumoVenda() {
    const canalId = document.getElementById('venda-canal')?.value || '';
    const frete = Number(document.getElementById('venda-frete')?.value) || 0;
    const r = calcularVenda(itensVendaTemporarios, canalId, frete);

    return `
      <div class="venda-resumo__grid">
        <div class="venda-resumo__item">
          <span class="venda-resumo__label">Subtotal</span>
          <span class="venda-resumo__valor">${formatarMoeda(r.subtotal)}</span>
        </div>
        <div class="venda-resumo__item">
          <span class="venda-resumo__label">Custo dos produtos</span>
          <span class="venda-resumo__valor">− ${formatarMoeda(r.custoTotal)}</span>
        </div>
        ${r.taxaPct > 0 || r.taxaFixa > 0 ? `
          <div class="venda-resumo__item">
            <span class="venda-resumo__label">Taxa do canal (${r.taxaPct}% + ${formatarMoeda(r.taxaFixa)})</span>
            <span class="venda-resumo__valor">− ${formatarMoeda(r.taxaCanalValor + r.taxaFixa)}</span>
          </div>
        ` : ''}
        ${r.frete > 0 ? `
          <div class="venda-resumo__item">
            <span class="venda-resumo__label">Frete pago por você</span>
            <span class="venda-resumo__valor">− ${formatarMoeda(r.frete)}</span>
          </div>
        ` : ''}
        <div class="venda-resumo__item venda-resumo__item--destaque">
          <span class="venda-resumo__label">Lucro líquido</span>
          <span class="venda-resumo__valor ${r.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">
            ${formatarMoeda(r.lucro)}
          </span>
        </div>
        <div class="venda-resumo__item">
          <span class="venda-resumo__label">Margem</span>
          <span class="venda-resumo__valor">${r.margem.toFixed(1).replace('.', ',')}%</span>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     16. SALVAR VENDA
     ========================================================== */

  function salvar() {
    const canalId = document.getElementById('venda-canal').value;
    const frete = Number(document.getElementById('venda-frete').value) || 0;

    if (itensVendaTemporarios.length === 0) {
      return alert('Adicione pelo menos um item à venda.');
    }

    const r = calcularVenda(itensVendaTemporarios, canalId, frete);
    const canal = buscarCanal(canalId);

    const dados = {
      cliente: document.getElementById('venda-cliente').value.trim(),
      canalId: canalId || '',
      canalNome: canal ? canal.nome : 'Venda direta',
      itens: itensVendaTemporarios.map(i => ({ ...i })),
      formaPagamento: document.getElementById('venda-pagamento').value,
      status: document.getElementById('venda-status').value,
      freteVendedor: frete,
      observacoes: document.getElementById('venda-obs').value.trim(),
      totais: {
        subtotal: r.subtotal,
        custoTotal: r.custoTotal,
        taxaPct: r.taxaPct,
        taxaFixa: r.taxaFixa,
        taxaCanalValor: r.taxaCanalValor,
        frete: r.frete,
        lucro: r.lucro,
        margem: r.margem
      }
    };

    criarVenda(dados);

    // Limpa estado
    itensVendaTemporarios = [];

    fecharModal();
    rerender();
  }

  /* ==========================================================
     17. DETALHES DA VENDA
     ========================================================== */

  function verDetalhes(id) {
    const v = buscarVenda(id);
    if (!v) return;

    const s = statusInfo(v.status);

    const html = `
      <div class="modal-overlay ativo" id="modal-detalhes-venda">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Venda ${escaparHTML(v.numero)}</h2>
            <button class="modal__fechar" onclick="MODULO_VENDAS.fecharDetalhes()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="venda-detalhe-grid">
              <div><strong>Cliente:</strong> ${escaparHTML(v.cliente || '—')}</div>
              <div><strong>Canal:</strong> ${escaparHTML(v.canalNome)}</div>
              <div><strong>Pagamento:</strong> ${escaparHTML(nomeFormaPagamento(v.formaPagamento))}</div>
              <div><strong>Status:</strong> <span class="badge badge--${s.cor}">${s.nome}</span></div>
              <div><strong>Data:</strong> ${formatarData(v.criadoEm)}</div>
            </div>

            <div class="enc-secao">
              <h3 class="enc-secao__titulo">Itens</h3>
              <table class="tabela tabela-itens">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th class="tabela__numero">Qtd</th>
                    <th class="tabela__numero">Preço un.</th>
                    <th class="tabela__numero">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${v.itens.map(i => `
                    <tr>
                      <td>
                        <div class="enc-item-nome">${escaparHTML(i.nome)}</div>
                        ${i.sku ? `<span class="sku">${escaparHTML(i.sku)}</span>` : ''}
                      </td>
                      <td class="tabela__numero">${i.quantidade}</td>
                      <td class="tabela__numero">${formatarMoeda(i.preco)}</td>
                      <td class="tabela__numero peso-semibold">${formatarMoeda((Number(i.preco) || 0) * (Number(i.quantidade) || 0))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="enc-secao">
              <h3 class="enc-secao__titulo">Resumo financeiro</h3>
              <div class="calculo-detalhado">
                <div class="calculo-linha">
                  <span>Subtotal</span>
                  <span>${formatarMoeda(v.totais?.subtotal)}</span>
                </div>
                <div class="calculo-linha">
                  <span>Custo dos produtos</span>
                  <span>− ${formatarMoeda(v.totais?.custoTotal)}</span>
                </div>
                <div class="calculo-linha">
                  <span>Taxa do canal (${v.totais?.taxaPct}% + ${formatarMoeda(v.totais?.taxaFixa)})</span>
                  <span>− ${formatarMoeda((Number(v.totais?.taxaCanalValor) || 0) + (Number(v.totais?.taxaFixa) || 0))}</span>
                </div>
                ${v.freteVendedor > 0 ? `
                  <div class="calculo-linha">
                    <span>Frete pago por você</span>
                    <span>− ${formatarMoeda(v.freteVendedor)}</span>
                  </div>
                ` : ''}
                <div class="calculo-linha calculo-linha--destaque">
                  <span>Lucro líquido</span>
                  <span class="${Number(v.totais?.lucro) >= 0 ? 'text-sucesso' : 'text-critico'}">
                    ${formatarMoeda(v.totais?.lucro)}
                  </span>
                </div>
                <div class="calculo-linha">
                  <span>Margem</span>
                  <span>${(Number(v.totais?.margem) || 0).toFixed(1).replace('.', ',')}%</span>
                </div>
              </div>
            </div>

            ${v.observacoes ? `
              <div class="enc-secao">
                <h3 class="enc-secao__titulo">Observações</h3>
                <p>${escaparHTML(v.observacoes)}</p>
              </div>
            ` : ''}
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_VENDAS.fecharDetalhes()">Fechar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-detalhes-venda')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharDetalhes() {
    document.getElementById('modal-detalhes-venda')?.remove();
  }

  /* ==========================================================
     18. CANCELAMENTO
     ========================================================== */

  function confirmarCancelamento(id) {
    const v = buscarVenda(id);
    if (!v) return;
    const ok = confirm(
      `Cancelar a venda ${v.numero} de "${v.cliente || 'sem cliente'}"?\n\n` +
      `O estoque dos produtos será estornado.`
    );
    if (!ok) return;
    cancelarVenda(id);
    rerender();
  }

  /* ==========================================================
     19. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'vendas') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-vendas-wrapper');
    if (wrapper) wrapper.innerHTML = renderTabela();
  }

  /* ==========================================================
     20. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovo,
    abrirModal,
    fecharModal,
    abrirModalItem,
    fecharModalItem,
    preencherItemProduto,
    adicionarItem,
    removerItem,
    atualizarResumoVenda,
    salvar,
    verDetalhes,
    fecharDetalhes,
    confirmarCancelamento,
    alterarFiltroBusca,
    alterarFiltroCanal,
    alterarFiltroStatus,
    // Uso futuro
    _listar: () => [...vendas],
    _buscar: buscarVenda,
    _calcularVenda: calcularVenda,
    FORMAS_PAGAMENTO,
    STATUS_VENDA
  };

})();

window.MODULO_VENDAS = MODULO_VENDAS;
window.renderVendas = MODULO_VENDAS.render;
