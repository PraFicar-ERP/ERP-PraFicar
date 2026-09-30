/* ============================================================
   PRAFICAR ERP — MÓDULO VENDAS (v4 com preço por canal)
   Arquivo: assets/js/modulos/vendas.js
   Descrição: vendas com desconto, bonificação e preço por canal.
              Ao escolher produto, puxa automaticamente o preço
              específico do canal selecionado.
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

  let itensVendaTemporarios = [];

  /* ==========================================================
     2. CONSTANTES
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

  const MOTIVOS_BONIFICACAO = [
    { codigo: 'brinde',        nome: 'Brinde' },
    { codigo: 'cortesia',      nome: 'Cortesia' },
    { codigo: 'amostra',       nome: 'Amostra grátis' },
    { codigo: 'agradecimento', nome: 'Agradecimento' },
    { codigo: 'outro',         nome: 'Outro' }
  ];

  function nomeFormaPagamento(codigo) {
    const f = FORMAS_PAGAMENTO.find(x => x.codigo === codigo);
    return f ? f.nome : '—';
  }

  function statusInfo(codigo) {
    return STATUS_VENDA.find(s => s.codigo === codigo) || STATUS_VENDA[0];
  }

  function nomeMotivoBonificacao(codigo) {
    const m = MOTIVOS_BONIFICACAO.find(x => x.codigo === codigo);
    return m ? m.nome : '—';
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
    const lista = (window.MODULO_PRODUTOS?._listar() || []).filter(p => p.status === 'ativo');
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function buscarCanal(id) {
    return window.MODULO_CANAIS?._buscar(id) || null;
  }

  function buscarProduto(id) {
    return window.MODULO_PRODUTOS?._buscar(id) || null;
  }

  /* ==========================================================
     5. PREÇO POR CANAL
     ========================================================== */

  // Retorna o preço do produto para um canal específico
  function precoDoProdutoNoCanal(produto, canalId) {
    if (!produto) return { preco: 0, origem: 'sem produto' };

    // Se tem preço específico para o canal, usa
    if (canalId && produto.precosCanal && produto.precosCanal[canalId] > 0) {
      return {
        preco: Number(produto.precosCanal[canalId]),
        origem: 'preco-canal'
      };
    }

    // Senão, usa o preço base de varejo
    return {
      preco: Number(produto.precoVarejo) || 0,
      origem: 'preco-base'
    };
  }

  function nomeOrigemPreco(origem, canalNome) {
    if (origem === 'preco-canal') return `Preço ${canalNome || 'do canal'}`;
    if (origem === 'preco-base') return 'Preço base';
    return '—';
  }

  /* ==========================================================
     6. CÁLCULO DA VENDA
     ========================================================== */

  function calcularVenda(itens, canalId, freteVendedor) {
    const canal = buscarCanal(canalId);
    const taxaPct = canal ? Number(canal.taxaPercentual) || 0 : 0;
    const taxaFixa = canal ? Number(canal.taxaFixa) || 0 : 0;
    const frete = Number(freteVendedor) || 0;

    let subtotalTabela = 0;
    let subtotalPraticado = 0;
    let descontoTotal = 0;
    let custoTotal = 0;
    let bonificacoes = 0;

    itens.forEach(item => {
      const qtd = Number(item.quantidade) || 0;
      const precoTabela = Number(item.preco) || 0;
      const desconto = Number(item.desconto) || 0;
      const bonificacao = item.bonificacao === true;

      const precoPraticado = bonificacao ? 0 : Math.max(0, precoTabela - desconto);

      subtotalTabela += precoTabela * qtd;
      subtotalPraticado += precoPraticado * qtd;
      descontoTotal += (precoTabela - precoPraticado) * qtd;
      custoTotal += (Number(item.custo) || 0) * qtd;

      if (bonificacao) bonificacoes += qtd;
    });

    const taxaCanalValor = subtotalPraticado * (taxaPct / 100);
    const lucro = subtotalPraticado - custoTotal - taxaCanalValor - taxaFixa - frete;
    const margem = subtotalPraticado > 0 ? (lucro / subtotalPraticado) * 100 : 0;

    const precoMinimoParaLucro = calcularPrecoMinimo(custoTotal, taxaPct, taxaFixa, frete);

    return {
      subtotalTabela,
      subtotalPraticado,
      descontoTotal,
      custoTotal,
      taxaPct,
      taxaFixa,
      taxaCanalValor,
      frete,
      lucro,
      margem,
      bonificacoes,
      precoMinimoParaLucro,
      canal
    };
  }

  function calcularPrecoMinimo(custoTotal, taxaPct, taxaFixa, frete) {
    const divisor = 1 - (taxaPct / 100);
    if (divisor <= 0.01) return 0;
    return Math.round(((custoTotal + taxaFixa + frete) / divisor) * 100) / 100;
  }

  /* ==========================================================
     7. CRUD
     ========================================================== */

  function criarVenda(dados) {
    const v = {
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
    vendas.push(v);
    baixarEstoque(v);
    return v;
  }

  function atualizarVenda(id, dados) {
    const idx = vendas.findIndex(v => v.id === id);
    if (idx === -1) return null;

    estornarEstoque(vendas[idx]);

    vendas[idx] = {
      ...vendas[idx],
      ...dados,
      freteVendedor: Number(dados.freteVendedor) || 0,
      atualizadoEm: new Date().toISOString()
    };

    if (vendas[idx].status !== 'cancelada') {
      baixarEstoque(vendas[idx]);
    }

    return vendas[idx];
  }

  function cancelarVenda(id) {
    const v = vendas.find(x => x.id === id);
    if (!v) return false;
    if (v.status !== 'cancelada') estornarEstoque(v);
    v.status = 'cancelada';
    v.atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarVenda(id) {
    return vendas.find(v => v.id === id) || null;
  }

  /* ==========================================================
     8. BAIXA E ESTORNO DE ESTOQUE
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
     9. FILTROS
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
    }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }

  function alterarFiltroBusca(v) { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroCanal(v)  { filtroCanal = v; rerender(); }
  function alterarFiltroStatus(v) { filtroStatus = v; rerender(); }

  /* ==========================================================
     10. KPIs
     ========================================================== */

  function calcularKPIs() {
    const ativas = vendas.filter(v => v.status !== 'cancelada');
    const faturamento = ativas.reduce((acc, v) => acc + (Number(v.totais?.subtotalPraticado) || 0), 0);
    const lucro = ativas.reduce((acc, v) => acc + (Number(v.totais?.lucro) || 0), 0);
    const descontos = ativas.reduce((acc, v) => acc + (Number(v.totais?.descontoTotal) || 0), 0);
    const bonificacoes = ativas.reduce((acc, v) => acc + (Number(v.totais?.bonificacoes) || 0), 0);
    const qtd = ativas.length;
    const ticket = qtd > 0 ? faturamento / qtd : 0;
    return { faturamento, lucro, descontos, bonificacoes, qtd, ticket };
  }

  /* ==========================================================
     11. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const k = calcularKPIs();

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Vendas</h1>
          <p class="pagina-header__subtitulo">Registre vendas com lucro líquido real por canal.</p>
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
          <div class="kpi__valor">${formatarMoeda(k.faturamento)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">${k.qtd} ${k.qtd === 1 ? 'venda' : 'vendas'}</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Lucro líquido</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </span>
          </div>
          <div class="kpi__valor ${k.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(k.lucro)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Taxas descontadas</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Descontos</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/><path d="M20 4 4 20"/></svg>
            </span>
          </div>
          <div class="kpi__valor text-atencao">${formatarMoeda(k.descontos)}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Concedidos</div>
        </div>

        <div class="kpi">
          <div class="kpi__topo">
            <span class="kpi__label">Bonificações</span>
            <span class="kpi__icone">
              <svg viewBox="0 0 24 24"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
            </span>
          </div>
          <div class="kpi__valor">${k.bonificacoes}</div>
          <div class="kpi__variacao kpi__variacao--neutra">Unidades doadas</div>
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
            <option value="${c.id}" ${String(filtroCanal) === String(c.id) ? 'selected' : ''}>${escaparHTML(c.nome)}</option>
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
     12. RENDER — TABELA
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
                ? 'Registre a primeira venda. O preço é puxado automaticamente do canal.'
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
    const temBonificacao = (Number(v.totais?.bonificacoes) || 0) > 0;
    const temDesconto = (Number(v.totais?.descontoTotal) || 0) > 0;

    return `
      <tr>
        <td><span class="sku">${escaparHTML(v.numero)}</span></td>
        <td>${escaparHTML(v.cliente || '—')}</td>
        <td><span class="badge badge--info">${escaparHTML(v.canalNome)}</span></td>
        <td class="tabela__numero peso-semibold">${formatarMoeda(v.totais?.subtotalPraticado)}</td>
        <td class="tabela__numero ${lucro >= 0 ? 'text-sucesso peso-semibold' : 'text-critico peso-semibold'}">
          ${formatarMoeda(lucro)}
        </td>
        <td class="tabela__numero">${margem.toFixed(1).replace('.', ',')}%</td>
        <td>${escaparHTML(nomeFormaPagamento(v.formaPagamento))}</td>
        <td>
          <div class="venda-badges">
            <span class="badge badge--${s.cor}">${s.nome}</span>
            ${temDesconto ? '<span class="badge badge--atencao">Desconto</span>' : ''}
            ${temBonificacao ? '<span class="badge badge--info">Brinde</span>' : ''}
          </div>
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
     13. MODAL — NOVA VENDA
     ========================================================== */

  function abrirNovo() {
    vendaEditandoId = null;
    itensVendaTemporarios = [];
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
     14. FORMULÁRIO DA VENDA
     ========================================================== */

  function renderFormVenda() {
    return `
      <div class="form-linha">
        <div class="form-grupo">
          <label for="venda-cliente">Cliente</label>
          <input id="venda-cliente" type="text" placeholder="Nome do cliente" />
        </div>

        <div class="form-grupo">
          <label for="venda-canal">Canal de venda <span class="form-obrigatorio">*</span></label>
          <select id="venda-canal" onchange="MODULO_VENDAS.aoMudarCanal()">
            <option value="">Venda direta (sem canal)</option>
            ${listarCanaisAtivos().map(c => `
              <option value="${c.id}">
                ${escaparHTML(c.nome)} — ${c.taxaPercentual}% + ${formatarMoeda(c.taxaFixa)}
              </option>
            `).join('')}
          </select>
          <span class="form-ajuda">O canal define a taxa e o preço do produto.</span>
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

  function aoMudarCanal() {
    // Recalcula o preço de todos os itens já adicionados
    const canalId = document.getElementById('venda-canal')?.value || '';

    itensVendaTemporarios = itensVendaTemporarios.map(item => {
      const produto = buscarProduto(item.produtoId);
      if (!produto) return item;
      const { preco, origem } = precoDoProdutoNoCanal(produto, canalId);
      return {
        ...item,
        preco,
        origemPreco: origem
      };
    });

    atualizarListaItensForm();
    atualizarResumoVenda();
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

    const canalId = document.getElementById('venda-canal')?.value || '';
    const canal = buscarCanal(canalId);
    const canalNome = canal ? canal.nome : '';

    return `
      <table class="tabela tabela-itens">
        <thead>
          <tr>
            <th>Produto</th>
            <th class="tabela__numero">Qtd</th>
            <th class="tabela__numero">Preço</th>
            <th class="tabela__numero">Desconto</th>
            <th class="tabela__numero">Praticado</th>
            <th class="tabela__numero">Subtotal</th>
            <th class="tabela__acao"></th>
          </tr>
        </thead>
        <tbody>
          ${itens.map((i, idx) => {
            const precoPraticado = i.bonificacao ? 0 : Math.max(0, (Number(i.preco) || 0) - (Number(i.desconto) || 0));
            const subtotal = precoPraticado * (Number(i.quantidade) || 0);
            return `
              <tr>
                <td>
                  <div class="enc-item-nome">${escaparHTML(i.nome)}</div>
                  ${i.sku ? `<span class="sku">${escaparHTML(i.sku)}</span>` : ''}
                  ${i.origemPreco ? `<div class="venda-item-origem">${nomeOrigemPreco(i.origemPreco, canalNome)}</div>` : ''}
                  ${i.bonificacao ? `<span class="badge badge--info mt-1">${escaparHTML(nomeMotivoBonificacao(i.motivoBonificacao))}</span>` : ''}
                </td>
                <td class="tabela__numero">${i.quantidade}</td>
                <td class="tabela__numero">${formatarMoeda(i.preco)}</td>
                <td class="tabela__numero ${i.desconto > 0 ? 'text-atencao' : ''}">
                  ${i.bonificacao ? '—' : formatarMoeda(i.desconto)}
                </td>
                <td class="tabela__numero peso-semibold">${formatarMoeda(precoPraticado)}</td>
                <td class="tabela__numero peso-semibold">${formatarMoeda(subtotal)}</td>
                <td class="tabela__acao">
                  <button type="button" class="btn-icone btn-icone--perigo" title="Remover" onclick="MODULO_VENDAS.removerItem(${idx})">
                    <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function atualizarListaItensForm() {
    const container = document.getElementById('venda-lista-itens');
    if (container) container.innerHTML = renderListaItens(itensVendaTemporarios);
  }

  /* ==========================================================
     15. MODAL DE ITEM
     ========================================================== */

  function abrirModalItem() {
    const canalId = document.getElementById('venda-canal')?.value || '';
    const canal = buscarCanal(canalId);

    if (!canalId) {
      const ok = confirm(
        'Nenhum canal selecionado.\n\n' +
        'Sem canal, o preço será o base (varejo). Deseja continuar?'
      );
      if (!ok) return;
    }

    const produtos = listarProdutosAtivos();

    const html = `
      <div class="modal-overlay ativo" id="modal-item-venda" style="z-index: 700">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Adicionar item</h2>
            <button class="modal__fechar" onclick="MODULO_VENDAS.fecharModalItem()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            ${canal ? `
              <div class="venda-item-canal-info">
                <strong>Canal:</strong> ${escaparHTML(canal.nome)}
                <span class="text-secundario">· ${canal.taxaPercentual}% + ${formatarMoeda(canal.taxaFixa)}</span>
              </div>
            ` : `
              <div class="alerta alerta--atencao">
                <span class="alerta__icone">
                  <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                </span>
                <div class="alerta__conteudo">
                  <div class="alerta__titulo">Sem canal selecionado</div>
                  O preço base será usado. Sem taxa de canal.
                </div>
              </div>
            `}

            <div class="form-grupo">
              <label for="venda-item-produto">Produto</label>
              <select id="venda-item-produto" onchange="MODULO_VENDAS.preencherItemProduto()">
                <option value="">Selecione um produto</option>
                ${produtos.map(p => `
                  <option
                    value="${p.id}"
                    data-nome="${escaparHTML(p.nome)}"
                    data-sku="${escaparHTML(p.sku)}"
                    data-custo="${p.custo}"
                    data-estoque="${p.estoqueAtual}"
                  >
                    ${escaparHTML(p.sku)} — ${escaparHTML(p.nome)} · ${p.estoqueAtual} un
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="venda-item-qtd">Quantidade</label>
                <input id="venda-item-qtd" type="number" min="1" step="1" value="1" />
                <span class="form-ajuda" id="venda-item-estoque-aviso"></span>
              </div>
              <div class="form-grupo">
                <label for="venda-item-preco">Preço tabela (R$)</label>
                <input id="venda-item-preco" type="number" min="0" step="0.01" placeholder="0,00" oninput="MODULO_VENDAS.recalcularPreviewItem()" />
                <span class="form-ajuda" id="venda-item-preco-origem"></span>
              </div>
            </div>

            <div class="venda-item-tipo">
              <label class="venda-item-tipo__opcao">
                <input type="radio" name="venda-item-tipo" value="normal" checked onchange="MODULO_VENDAS.aoMudarTipoItem()" />
                <span>Venda normal</span>
              </label>
              <label class="venda-item-tipo__opcao">
                <input type="radio" name="venda-item-tipo" value="desconto" onchange="MODULO_VENDAS.aoMudarTipoItem()" />
                <span>Com desconto</span>
              </label>
              <label class="venda-item-tipo__opcao">
                <input type="radio" name="venda-item-tipo" value="bonificacao" onchange="MODULO_VENDAS.aoMudarTipoItem()" />
                <span>Bonificação (brinde)</span>
              </label>
            </div>

            <div class="form-linha" id="venda-item-desconto-wrapper" style="display:none;">
              <div class="form-grupo">
                <label for="venda-item-desconto">Desconto (R$)</label>
                <input id="venda-item-desconto" type="number" min="0" step="0.01" value="0" oninput="MODULO_VENDAS.recalcularPreviewItem()" />
              </div>
              <div class="form-grupo">
                <label for="venda-item-desconto-pct">Desconto (%)</label>
                <input id="venda-item-desconto-pct" type="number" min="0" max="100" step="1" value="0" oninput="MODULO_VENDAS.aplicarDescontoPorPct()" />
              </div>
            </div>

            <div class="form-grupo" id="venda-item-bonificacao-wrapper" style="display:none;">
              <label for="venda-item-motivo">Motivo da bonificação</label>
              <select id="venda-item-motivo">
                ${MOTIVOS_BONIFICACAO.map(m => `
                  <option value="${m.codigo}">${m.nome}</option>
                `).join('')}
              </select>
            </div>

            <div class="venda-item-preview" id="venda-item-preview">
              ${renderPreviewItem(0, 0, 0)}
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
    const produto = buscarProduto(Number(sel.value));
    const canalId = document.getElementById('venda-canal')?.value || '';
    const canal = buscarCanal(canalId);

    // Puxa o preço do canal automaticamente
    const { preco, origem } = precoDoProdutoNoCanal(produto, canalId);
    document.getElementById('venda-item-preco').value = preco.toFixed(2);

    // Mostra a origem do preço
    const elOrigem = document.getElementById('venda-item-preco-origem');
    if (elOrigem) {
      if (origem === 'preco-canal') {
        elOrigem.textContent = `Preço ${canal ? canal.nome : 'do canal'}`;
        elOrigem.style.color = 'var(--azul-medio)';
        elOrigem.style.fontWeight = '600';
      } else {
        elOrigem.textContent = 'Preço base (varejo)';
        elOrigem.style.color = 'var(--cor-texto-secundario)';
        elOrigem.style.fontWeight = '';
      }
    }

    const aviso = document.getElementById('venda-item-estoque-aviso');
    const estoque = Number(opt.dataset.estoque || 0);
    if (aviso) {
      aviso.textContent = `Estoque disponível: ${estoque} un`;
      aviso.style.color = estoque <= 0 ? 'var(--cor-critico)' : 'var(--cor-texto-secundario)';
    }

    recalcularPreviewItem();
  }

  function aoMudarTipoItem() {
    const tipo = document.querySelector('input[name="venda-item-tipo"]:checked')?.value || 'normal';
    document.getElementById('venda-item-desconto-wrapper').style.display = tipo === 'desconto' ? 'grid' : 'none';
    document.getElementById('venda-item-bonificacao-wrapper').style.display = tipo === 'bonificacao' ? 'block' : 'none';
    recalcularPreviewItem();
  }

  function aplicarDescontoPorPct() {
    const preco = Number(document.getElementById('venda-item-preco')?.value) || 0;
    const pct = Number(document.getElementById('venda-item-desconto-pct')?.value) || 0;
    const desconto = Math.round(preco * (pct / 100) * 100) / 100;
    document.getElementById('venda-item-desconto').value = desconto.toFixed(2);
    recalcularPreviewItem();
  }

  function recalcularPreviewItem() {
    const preco = Number(document.getElementById('venda-item-preco')?.value) || 0;
    const tipo = document.querySelector('input[name="venda-item-tipo"]:checked')?.value || 'normal';
    const desconto = tipo === 'desconto' ? Number(document.getElementById('venda-item-desconto')?.value) || 0 : 0;
    const bonificacao = tipo === 'bonificacao';

    const precoPraticado = bonificacao ? 0 : Math.max(0, preco - desconto);

    document.getElementById('venda-item-preview').innerHTML =
      renderPreviewItem(preco, precoPraticado, desconto);
  }

  function renderPreviewItem(preco, praticado, desconto) {
    return `
      <div class="venda-item-preview__linha">
        <span>Preço tabela</span>
        <strong>${formatarMoeda(preco)}</strong>
      </div>
      ${desconto > 0 ? `
        <div class="venda-item-preview__linha">
          <span>Desconto</span>
          <strong class="text-atencao">− ${formatarMoeda(desconto)}</strong>
        </div>
      ` : ''}
      <div class="venda-item-preview__linha venda-item-preview__linha--destaque">
        <span>Preço praticado</span>
        <strong>${formatarMoeda(praticado)}</strong>
      </div>
    `;
  }

  function adicionarItem() {
    const sel = document.getElementById('venda-item-produto');
    const opt = sel && sel.value ? sel.options[sel.selectedIndex] : null;

    const quantidade = Number(document.getElementById('venda-item-qtd').value) || 0;
    const preco = Number(document.getElementById('venda-item-preco').value) || 0;
    const tipo = document.querySelector('input[name="venda-item-tipo"]:checked')?.value || 'normal';
    const desconto = tipo === 'desconto' ? Number(document.getElementById('venda-item-desconto').value) || 0 : 0;
    const bonificacao = tipo === 'bonificacao';
    const motivoBonificacao = bonificacao ? document.getElementById('venda-item-motivo').value : null;

    if (!sel || !sel.value) return alert('Selecione um produto.');
    if (quantidade <= 0) return alert('Informe a quantidade.');

    const produtoId = Number(sel.value);
    const nome = opt.dataset.nome;
    const sku = opt.dataset.sku;
    const custo = Number(opt.dataset.custo || 0);
    const estoque = Number(opt.dataset.estoque || 0);

    if (quantidade > estoque) {
      return alert(`Estoque insuficiente. Disponível: ${estoque} un.`);
    }

    if (desconto > preco) {
      return alert('Desconto maior que o preço.');
    }

    const canalId = document.getElementById('venda-canal')?.value || '';
    const produto = buscarProduto(produtoId);
    const { origem } = precoDoProdutoNoCanal(produto, canalId);

    itensVendaTemporarios.push({
      produtoId,
      nome,
      sku,
      quantidade,
      preco,
      custo,
      desconto,
      bonificacao,
      motivoBonificacao,
      origemPreco: origem
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

  /* ==========================================================
     16. RESUMO E ALERTA DE PREJUÍZO
     ========================================================== */

  function atualizarResumoVenda() {
    const container = document.getElementById('venda-resumo');
    if (container) container.innerHTML = renderResumoVenda();
  }

  function renderResumoVenda() {
    const canalId = document.getElementById('venda-canal')?.value || '';
    const frete = Number(document.getElementById('venda-frete')?.value) || 0;
    const r = calcularVenda(itensVendaTemporarios, canalId, frete);

    const temPrejuizo = r.lucro < 0 && itensVendaTemporarios.length > 0;
    const margemBaixa = r.margem < 30 && r.lucro >= 0 && itensVendaTemporarios.length > 0;

    return `
      <div class="venda-resumo__grid">
        <div class="venda-resumo__item">
          <span class="venda-resumo__label">Subtotal</span>
          <span class="venda-resumo__valor">${formatarMoeda(r.subtotalPraticado)}</span>
        </div>
        ${r.descontoTotal > 0 ? `
          <div class="venda-resumo__item">
            <span class="venda-resumo__label">Descontos</span>
            <span class="venda-resumo__valor text-atencao">− ${formatarMoeda(r.descontoTotal)}</span>
          </div>
        ` : ''}
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

      ${temPrejuizo ? `
        <div class="alerta alerta--critico mt-4">
          <span class="alerta__icone">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">⚠️ Esta venda vai dar prejuízo de ${formatarMoeda(Math.abs(r.lucro))}</div>
            Para não ter prejuízo, o preço mínimo seria <strong>${formatarMoeda(r.precoMinimoParaLucro)}</strong>.
          </div>
        </div>
      ` : ''}

      ${margemBaixa ? `
        <div class="alerta alerta--atencao mt-4">
          <span class="alerta__icone">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">Margem abaixo de 30%</div>
            Considere revisar o preço ou o canal.
          </div>
        </div>
      ` : ''}
    `;
  }

  /* ==========================================================
     17. SALVAR VENDA
     ========================================================== */

  function salvar() {
    const canalId = document.getElementById('venda-canal').value;
    const frete = Number(document.getElementById('venda-frete').value) || 0;

    if (itensVendaTemporarios.length === 0) {
      return alert('Adicione pelo menos um item à venda.');
    }

    const r = calcularVenda(itensVendaTemporarios, canalId, frete);
    const canal = buscarCanal(canalId);

    if (r.lucro < 0) {
      const continuar = confirm(
        `⚠️ ATENÇÃO\n\n` +
        `Esta venda vai dar PREJUÍZO de ${formatarMoeda(Math.abs(r.lucro))}.\n\n` +
        `Preço mínimo para não ter prejuízo: ${formatarMoeda(r.precoMinimoParaLucro)}\n\n` +
        `Deseja continuar mesmo assim?`
      );
      if (!continuar) return;
    }

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
        subtotalTabela: r.subtotalTabela,
        subtotalPraticado: r.subtotalPraticado,
        descontoTotal: r.descontoTotal,
        custoTotal: r.custoTotal,
        taxaPct: r.taxaPct,
        taxaFixa: r.taxaFixa,
        taxaCanalValor: r.taxaCanalValor,
        frete: r.frete,
        lucro: r.lucro,
        margem: r.margem,
        bonificacoes: r.bonificacoes
      }
    };

    criarVenda(dados);

    itensVendaTemporarios = [];
    fecharModal();
    rerender();
  }

  /* ==========================================================
     18. DETALHES DA VENDA
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
                    <th class="tabela__numero">Tabela</th>
                    <th class="tabela__numero">Desconto</th>
                    <th class="tabela__numero">Praticado</th>
                    <th class="tabela__numero">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${v.itens.map(i => {
                    const precoPraticado = i.bonificacao ? 0 : Math.max(0, (Number(i.preco) || 0) - (Number(i.desconto) || 0));
                    const subtotal = precoPraticado * (Number(i.quantidade) || 0);
                    return `
                      <tr>
                        <td>
                          <div class="enc-item-nome">${escaparHTML(i.nome)}</div>
                          ${i.sku ? `<span class="sku">${escaparHTML(i.sku)}</span>` : ''}
                          ${i.bonificacao ? `<span class="badge badge--info mt-1">${escaparHTML(nomeMotivoBonificacao(i.motivoBonificacao))}</span>` : ''}
                        </td>
                        <td class="tabela__numero">${i.quantidade}</td>
                        <td class="tabela__numero">${formatarMoeda(i.preco)}</td>
                        <td class="tabela__numero">${i.bonificacao ? '—' : formatarMoeda(i.desconto)}</td>
                        <td class="tabela__numero peso-semibold">${formatarMoeda(precoPraticado)}</td>
                        <td class="tabela__numero peso-semibold">${formatarMoeda(subtotal)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="enc-secao">
              <h3 class="enc-secao__titulo">Resumo financeiro</h3>
              <div class="calculo-detalhado">
                <div class="calculo-linha">
                  <span>Subtotal</span>
                  <span>${formatarMoeda(v.totais?.subtotalPraticado)}</span>
                </div>
                ${Number(v.totais?.descontoTotal) > 0 ? `
                  <div class="calculo-linha">
                    <span>Descontos</span>
                    <span class="text-atencao">− ${formatarMoeda(v.totais?.descontoTotal)}</span>
                  </div>
                ` : ''}
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
     19. CANCELAMENTO
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
     20. RERENDER
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
     21. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovo,
    abrirModal,
    fecharModal,
    aoMudarCanal,
    abrirModalItem,
    fecharModalItem,
    preencherItemProduto,
    aoMudarTipoItem,
    aplicarDescontoPorPct,
    recalcularPreviewItem,
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
    _listar: () => [...vendas],
    _buscar: buscarVenda,
    _calcularVenda: calcularVenda,
    _precoDoProdutoNoCanal: precoDoProdutoNoCanal,
    FORMAS_PAGAMENTO,
    STATUS_VENDA,
    MOTIVOS_BONIFICACAO
  };

})();

window.MODULO_VENDAS = MODULO_VENDAS;
window.renderVendas = MODULO_VENDAS.render;
