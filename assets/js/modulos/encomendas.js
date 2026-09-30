/* ============================================================
   PRAFICAR ERP — MÓDULO ENCOMENDAS
   Arquivo: assets/js/modulos/encomendas.js
   Descrição: cadastro, listagem, edição e fluxo de status de
              encomendas. Cada encomenda possui itens, cliente,
              personalização, aprovação de arte, prazo, pagamento
              e reserva de estoque.

   Fluxo de status:
     orcamento → aprovada → aguardando_pagamento
     → em_producao → pronta → entregue
     (e também: pausada / cancelada)
   ============================================================ */

const MODULO_ENCOMENDAS = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let encomendas = [];
  let proximoNumero = 1;
  let proximoId = 1;

  let filtroBusca = '';
  let filtroStatus = '';
  let encomendaEditandoId = null;

  /* ==========================================================
     2. STATUS OFICIAIS
     ========================================================== */

  const STATUS = [
    { codigo: 'orcamento',            nome: 'Orçamento',            cor: 'info' },
    { codigo: 'aprovada',             nome: 'Aprovada',             cor: 'info' },
    { codigo: 'aguardando_pagamento', nome: 'Aguardando pagamento', cor: 'atencao' },
    { codigo: 'em_producao',          nome: 'Em produção',          cor: 'atencao' },
    { codigo: 'pronta',               nome: 'Pronta',               cor: 'sucesso' },
    { codigo: 'entregue',             nome: 'Entregue',             cor: 'sucesso' },
    { codigo: 'pausada',              nome: 'Pausada',              cor: 'neutro' },
    { codigo: 'cancelada',            nome: 'Cancelada',            cor: 'critico' }
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

  function gerarNumero() {
    const n = String(proximoNumero).padStart(4, '0');
    proximoNumero++;
    return `ENC-${n}`;
  }

  /* ==========================================================
     4. CRUD
     ========================================================== */

  function criarEncomenda(dados) {
    const encomenda = {
      id: proximoId++,
      numero: gerarNumero(),
      cliente: dados.cliente || '',
      clienteId: dados.clienteId || null,
      itens: dados.itens || [],
      desconto: Number(dados.desconto) || 0,
      prazo: dados.prazo || '',
      observacoes: dados.observacoes || '',
      personalizacao: dados.personalizacao || { tema: '', cor: '', texto: '' },
      status: dados.status || 'orcamento',
      historico: [
        { data: new Date().toISOString(), status: dados.status || 'orcamento', usuario: 'Administrador' }
      ],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    encomendas.push(encomenda);
    return encomenda;
  }

  function atualizarEncomenda(id, dados) {
    const idx = encomendas.findIndex(e => e.id === id);
    if (idx === -1) return null;

    encomendas[idx] = {
      ...encomendas[idx],
      ...dados,
      desconto: Number(dados.desconto) || 0,
      atualizadoEm: new Date().toISOString()
    };
    return encomendas[idx];
  }

  function excluirEncomenda(id) {
    const idx = encomendas.findIndex(e => e.id === id);
    if (idx === -1) return false;
    encomendas[idx].status = 'cancelada';
    encomendas[idx].historico.push({
      data: new Date().toISOString(),
      status: 'cancelada',
      usuario: 'Administrador'
    });
    encomendas[idx].atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarEncomenda(id) {
    return encomendas.find(e => e.id === id) || null;
  }

  function alterarStatus(id, novoStatus) {
    const enc = buscarEncomenda(id);
    if (!enc) return false;
    enc.status = novoStatus;
    enc.historico.push({
      data: new Date().toISOString(),
      status: novoStatus,
      usuario: 'Administrador'
    });
    enc.atualizadoEm = new Date().toISOString();
    return true;
  }

  /* ==========================================================
     5. CÁLCULOS
     ========================================================== */

  function calcularTotais(enc) {
    const subtotal = enc.itens.reduce((acc, i) => {
      return acc + (Number(i.preco) || 0) * (Number(i.quantidade) || 0);
    }, 0);
    const total = subtotal - (Number(enc.desconto) || 0);
    return { subtotal, total };
  }

  /* ==========================================================
     6. FILTROS
     ========================================================== */

  function encomendasFiltradas() {
    return encomendas.filter(e => {
      if (filtroStatus && e.status !== filtroStatus) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${e.numero} ${e.cliente} ${e.observacoes}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarFiltroBusca(v) { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroStatus(v) { filtroStatus = v; rerender(); }

  /* ==========================================================
     7. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Encomendas</h1>
          <p class="pagina-header__subtitulo">
            ${encomendas.length} ${encomendas.length === 1 ? 'encomenda cadastrada' : 'encomendas cadastradas'} ·
            orçamento, produção e entrega
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario" onclick="MODULO_ENCOMENDAS.abrirNovo()">
            + Nova encomenda
          </button>
        </div>
      </div>

      <div class="filtros-encomendas">
        <div class="filtros-encomendas__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por número, cliente ou observação..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_ENCOMENDAS.alterarFiltroBusca(this.value)"
          />
        </div>

        <select class="filtros-encomendas__select" onchange="MODULO_ENCOMENDAS.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          ${STATUS.map(s => `
            <option value="${s.codigo}" ${filtroStatus === s.codigo ? 'selected' : ''}>${s.nome}</option>
          `).join('')}
        </select>
      </div>

      <div id="tabela-encomendas-wrapper">
        ${renderTabela()}
      </div>
    `;
  }

  /* ==========================================================
     8. RENDER — TABELA
     ========================================================== */

  function renderTabela() {
    const lista = encomendasFiltradas();

    if (lista.length === 0) {
      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${encomendas.length === 0 ? 'Nenhuma encomenda cadastrada' : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${encomendas.length === 0
                ? 'Cadastre uma encomenda para acompanhar orçamento, produção, aprovação de arte e entrega.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
            ${encomendas.length === 0 ? `
              <button class="btn btn--primario" onclick="MODULO_ENCOMENDAS.abrirNovo()">
                + Nova encomenda
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
                <th>Itens</th>
                <th class="tabela__numero">Total</th>
                <th>Prazo</th>
                <th>Status</th>
                <th class="tabela__acao"></th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(e => renderLinha(e)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLinha(e) {
    const s = statusInfo(e.status);
    const { total } = calcularTotais(e);
    const qtdItens = e.itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);

    const prazoVencido =
      e.prazo && e.prazo < hojeISO() &&
      !['entregue', 'cancelada'].includes(e.status);

    return `
      <tr>
        <td><span class="sku">${escaparHTML(e.numero)}</span></td>
        <td>
          <div class="enc-cliente">${escaparHTML(e.cliente || '—')}</div>
          ${e.personalizacao?.tema ? `<div class="enc-tema">${escaparHTML(e.personalizacao.tema)}</div>` : ''}
        </td>
        <td>${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'}</td>
        <td class="tabela__numero peso-semibold">${formatarMoeda(total)}</td>
        <td class="${prazoVencido ? 'text-critico peso-semibold' : ''}">
          ${formatarData(e.prazo)}
          ${prazoVencido ? '<div class="enc-atraso">Atrasada</div>' : ''}
        </td>
        <td>
          <span class="badge badge--${s.cor}">${s.nome}</span>
        </td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Editar" onclick="MODULO_ENCOMENDAS.abrirEdicao(${e.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icone btn-icone--perigo" title="Cancelar" onclick="MODULO_ENCOMENDAS.confirmarExclusao(${e.id})">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     9. MODAL DE ENCOMENDA
     ========================================================== */

  function abrirNovo() {
    encomendaEditandoId = null;
    abrirModal();
  }

  function abrirEdicao(id) {
    encomendaEditandoId = id;
    abrirModal();
  }

  function abrirModal() {
    const e = encomendaEditandoId ? buscarEncomenda(encomendaEditandoId) : null;
    const editando = !!e;

    const itens = e ? [...e.itens] : [];
    const personalizacao = e ? { ...e.personalizacao } : { tema: '', cor: '', texto: '' };

    const html = `
      <div class="modal-overlay ativo" id="modal-encomenda">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar encomenda ' + escaparHTML(e.numero) : 'Nova encomenda'}</h2>
            <button class="modal__fechar" onclick="MODULO_ENCOMENDAS.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body" id="enc-modal-body">
            ${renderFormEncomenda(e, itens, personalizacao)}
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_ENCOMENDAS.fecharModal()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_ENCOMENDAS.salvar()">
              ${editando ? 'Salvar alterações' : 'Cadastrar encomenda'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-encomenda')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => document.getElementById('enc-cliente')?.focus(), 50);
  }

  function fecharModal() {
    document.getElementById('modal-encomenda')?.remove();
    encomendaEditandoId = null;
  }

  /* ==========================================================
     10. FORMULÁRIO DA ENCOMENDA
     ========================================================== */

  function renderFormEncomenda(e, itens, personalizacao) {
    return `
      <div class="form-linha">
        <div class="form-grupo">
          <label for="enc-cliente">Cliente <span class="form-obrigatorio">*</span></label>
          <input
            id="enc-cliente"
            type="text"
            required
            value="${escaparHTML(e?.cliente || '')}"
            placeholder="Nome do cliente"
          />
        </div>

        <div class="form-grupo">
          <label for="enc-prazo">Prazo de entrega</label>
          <input
            id="enc-prazo"
            type="date"
            value="${e?.prazo || ''}"
          />
        </div>
      </div>

      <div class="form-linha">
        <div class="form-grupo">
          <label for="enc-status">Status</label>
          <select id="enc-status">
            ${STATUS.map(s => `
              <option value="${s.codigo}" ${(e?.status || 'orcamento') === s.codigo ? 'selected' : ''}>
                ${s.nome}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-grupo">
          <label for="enc-desconto">Desconto (R$)</label>
          <input
            id="enc-desconto"
            type="number"
            min="0"
            step="0.01"
            value="${e?.desconto ?? ''}"
            placeholder="0,00"
          />
        </div>
      </div>

      <div class="enc-secao">
        <div class="enc-secao__header">
          <h3 class="enc-secao__titulo">Itens da encomenda</h3>
          <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_ENCOMENDAS.abrirModalItem()">
            + Adicionar item
          </button>
        </div>
        <div id="enc-lista-itens">
          ${renderListaItens(itens)}
        </div>
      </div>

      <div class="enc-secao">
        <div class="enc-secao__header">
          <h3 class="enc-secao__titulo">Personalização</h3>
        </div>
        <div class="form-linha">
          <div class="form-grupo">
            <label for="enc-tema">Tema</label>
            <input id="enc-tema" type="text" value="${escaparHTML(personalizacao.tema)}" placeholder="Ex: Coração" />
          </div>
          <div class="form-grupo">
            <label for="enc-cor">Cor</label>
            <input id="enc-cor" type="text" value="${escaparHTML(personalizacao.cor)}" placeholder="Ex: Azul-marinho" />
          </div>
        </div>
        <div class="form-grupo">
          <label for="enc-texto">Texto personalizado</label>
          <input id="enc-texto" type="text" value="${escaparHTML(personalizacao.texto)}" placeholder="Ex: Para a Ana, com amor" />
        </div>
      </div>

      <div class="form-grupo">
        <label for="enc-obs">Observações</label>
        <textarea id="enc-obs" placeholder="Detalhes adicionais...">${escaparHTML(e?.observacoes || '')}</textarea>
      </div>
    `;
  }

  function renderListaItens(itens) {
    if (itens.length === 0) {
      return `
        <div class="enc-itens-vazio">
          <p>Nenhum item adicionado ainda.</p>
          <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_ENCOMENDAS.abrirModalItem()">
            + Adicionar o primeiro item
          </button>
        </div>
      `;
    }

    const subtotal = itens.reduce((acc, i) => acc + (Number(i.preco) || 0) * (Number(i.quantidade) || 0), 0);

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
                <button type="button" class="btn-icone btn-icone--perigo" title="Remover" onclick="MODULO_ENCOMENDAS.removerItem(${idx})">
                  <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="text-right peso-semibold">Subtotal</td>
            <td class="tabela__numero peso-bold text-principal">${formatarMoeda(subtotal)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  /* ==========================================================
     11. MODAL DE ITEM
     ========================================================== */

  function abrirModalItem() {
    const produtos = window.MODULO_PRODUTOS?._listar() || [];

    const html = `
      <div class="modal-overlay ativo" id="modal-item-enc" style="z-index: 700">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Adicionar item</h2>
            <button class="modal__fechar" onclick="MODULO_ENCOMENDAS.fecharModalItem()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="form-grupo">
              <label for="enc-item-produto">Produto</label>
              <select id="enc-item-produto" onchange="MODULO_ENCOMENDAS.preencherItemProduto()">
                <option value="">Selecione um produto cadastrado</option>
                ${produtos.filter(p => p.status === 'ativo').map(p => `
                  <option value="${p.id}" data-nome="${escaparHTML(p.nome)}" data-sku="${escaparHTML(p.sku)}" data-preco="${p.precoVarejo}">
                    ${escaparHTML(p.sku)} — ${escaparHTML(p.nome)}
                  </option>
                `).join('')}
              </select>
              <span class="form-ajuda">Ou digite manualmente abaixo.</span>
            </div>

            <div class="form-grupo">
              <label for="enc-item-nome">Nome <span class="form-obrigatorio">*</span></label>
              <input id="enc-item-nome" type="text" placeholder="Nome do item" />
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="enc-item-qtd">Quantidade</label>
                <input id="enc-item-qtd" type="number" min="1" step="1" value="1" />
              </div>
              <div class="form-grupo">
                <label for="enc-item-preco">Preço unitário (R$)</label>
                <input id="enc-item-preco" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_ENCOMENDAS.fecharModalItem()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_ENCOMENDAS.adicionarItem()">Adicionar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-item-enc')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('enc-item-produto')?.focus(), 50);
  }

  function fecharModalItem() {
    document.getElementById('modal-item-enc')?.remove();
  }

  function preencherItemProduto() {
    const sel = document.getElementById('enc-item-produto');
    if (!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    document.getElementById('enc-item-nome').value = opt.dataset.nome || '';
    document.getElementById('enc-item-preco').value = opt.dataset.preco || '';
  }

  function adicionarItem() {
    const sel = document.getElementById('enc-item-produto');
    const opt = sel && sel.value ? sel.options[sel.selectedIndex] : null;

    const nome = document.getElementById('enc-item-nome').value.trim();
    const quantidade = Number(document.getElementById('enc-item-qtd').value) || 0;
    const preco = Number(document.getElementById('enc-item-preco').value) || 0;
    const sku = opt ? (opt.dataset.sku || '') : '';

    if (!nome) return alert('Informe o nome do item.');
    if (quantidade <= 0) return alert('Informe a quantidade.');

    // Pega itens atuais do form (se o modal já estiver aberto)
    const itens = obterItensFormAtual();
    itens.push({ nome, quantidade, preco, sku });

    // Refaz o form preservando o que o usuário já digitou
    const e = encomendaEditandoId ? buscarEncomenda(encomendaEditandoId) : null;
    const personalizacao = {
      tema: document.getElementById('enc-tema')?.value || '',
      cor: document.getElementById('enc-cor')?.value || '',
      texto: document.getElementById('enc-texto')?.value || ''
    };

    const dadosAtuais = {
      cliente: document.getElementById('enc-cliente')?.value || '',
      prazo: document.getElementById('enc-prazo')?.value || '',
      status: document.getElementById('enc-status')?.value || 'orcamento',
      desconto: document.getElementById('enc-desconto')?.value || 0,
      observacoes: document.getElementById('enc-obs')?.value || ''
    };

    document.getElementById('enc-modal-body').innerHTML = renderFormEncomenda(
      { ...dadosAtuais, itens, personalizacao },
      itens,
      personalizacao
    );

    // Guarda os itens no estado temporário
    salvarItensTemporarios(itens);

    fecharModalItem();
  }

  function removerItem(idx) {
    const itens = obterItensFormAtual();
    itens.splice(idx, 1);

    const personalizacao = {
      tema: document.getElementById('enc-tema')?.value || '',
      cor: document.getElementById('enc-cor')?.value || '',
      texto: document.getElementById('enc-texto')?.value || ''
    };

    const dadosAtuais = {
      cliente: document.getElementById('enc-cliente')?.value || '',
      prazo: document.getElementById('enc-prazo')?.value || '',
      status: document.getElementById('enc-status')?.value || 'orcamento',
      desconto: document.getElementById('enc-desconto')?.value || 0,
      observacoes: document.getElementById('enc-obs')?.value || ''
    };

    document.getElementById('enc-modal-body').innerHTML = renderFormEncomenda(
      { ...dadosAtuais, itens, personalizacao },
      itens,
      personalizacao
    );

    salvarItensTemporarios(itens);
  }

  // Controle temporário dos itens dentro do modal
  let itensTemporarios = [];

  function salvarItensTemporarios(itens) {
    itensTemporarios = itens;
  }

  function obterItensFormAtual() {
    // Primeiro tenta pegar do DOM da tabela (mais confiável)
    const tabela = document.querySelector('#enc-lista-itens .tabela-itens tbody');
    if (!tabela) return [...itensTemporarios];

    const itens = [];
    tabela.querySelectorAll('tr').forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 5) return;
      const nome = tds[0].querySelector('.enc-item-nome')?.textContent?.trim() || '';
      const sku  = tds[0].querySelector('.sku')?.textContent?.trim() || '';
      const qtd  = Number(tds[1].textContent.trim()) || 0;
      const preco = parsearMoeda(tds[2].textContent.trim());
      itens.push({ nome, sku, quantidade: qtd, preco });
    });
    return itens;
  }

  function parsearMoeda(str) {
    if (!str) return 0;
    const limpo = str.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return Number(limpo) || 0;
  }

  /* ==========================================================
     12. SALVAR
     ========================================================== */

  function salvar() {
    const cliente = document.getElementById('enc-cliente').value.trim();
    if (!cliente) return alert('Informe o nome do cliente.');

    const itens = obterItensFormAtual();
    if (itens.length === 0) return alert('Adicione pelo menos um item.');

    const dados = {
      cliente,
      prazo: document.getElementById('enc-prazo').value,
      status: document.getElementById('enc-status').value,
      desconto: document.getElementById('enc-desconto').value,
      observacoes: document.getElementById('enc-obs').value.trim(),
      itens,
      personalizacao: {
        tema: document.getElementById('enc-tema').value.trim(),
        cor: document.getElementById('enc-cor').value.trim(),
        texto: document.getElementById('enc-texto').value.trim()
      }
    };

    if (encomendaEditandoId) {
      const enc = buscarEncomenda(encomendaEditandoId);
      const statusMudou = enc && enc.status !== dados.status;

      atualizarEncomenda(encomendaEditandoId, dados);

      if (statusMudou) {
        enc.historico.push({
          data: new Date().toISOString(),
          status: dados.status,
          usuario: 'Administrador'
        });
      }
    } else {
      criarEncomenda(dados);
    }

    fecharModal();
    itensTemporarios = [];
    rerender();
  }

  /* ==========================================================
     13. EXCLUSÃO
     ========================================================== */

  function confirmarExclusao(id) {
    const e = buscarEncomenda(id);
    if (!e) return;
    const ok = confirm(
      `Deseja cancelar a encomenda ${e.numero} de "${e.cliente}"?\n\n` +
      `Ela continuará no histórico como cancelada.`
    );
    if (!ok) return;
    excluirEncomenda(id);
    rerender();
  }

  /* ==========================================================
     14. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'encomendas') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-encomendas-wrapper');
    if (wrapper) wrapper.innerHTML = renderTabela();
  }

  /* ==========================================================
     15. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovo,
    abrirEdicao,
    fecharModal,
    abrirModalItem,
    fecharModalItem,
    preencherItemProduto,
    adicionarItem,
    removerItem,
    salvar,
    confirmarExclusao,
    alterarFiltroBusca,
    alterarFiltroStatus,
    alterarStatus,
    // Uso futuro
    _listar: () => [...encomendas],
    _buscar: buscarEncomenda,
    _calcularTotais: calcularTotais,
    STATUS
  };

})();

window.MODULO_ENCOMENDAS = MODULO_ENCOMENDAS;
window.renderEncomendas = MODULO_ENCOMENDAS.render;
