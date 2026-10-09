/* ============================================================
   PRAFICAR ERP — MÓDULO PEDIDOS
   Arquivo: assets/js/modulos/pedidos.js
   Descrição: substitui o antigo "encomendas.js".
              Pedido é o compromisso confirmado do cliente.
              Pode vir de um orçamento aprovado ou ser criado direto.
              Ao ser entregue, vira Venda.

   Fluxo de status:
     aguardando_producao → em_producao → pronto → entregue
     (e também: aguardando_pagamento / pausado / cancelado)

   Verificação de estoque:
     Cada item é classificado como:
       OK       → tem estoque suficiente
       MISTO    → parte tem, parte precisa produzir
       PRODUCAO → precisa produzir tudo
   ============================================================ */

const MODULO_PEDIDOS = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let pedidos = [];
  let proximoId = 1;
  let proximoNumero = 1;

  let filtroBusca = '';
  let filtroStatus = '';
  let filtroEstoque = '';
  let pedidoEditandoId = null;

  let itensTemporarios = [];

  /* ==========================================================
     2. STATUS OFICIAIS
     ========================================================== */

  const STATUS = [
    { codigo: 'aguardando_producao',  nome: 'Aguardando produção',  cor: 'atencao' },
    { codigo: 'em_producao',          nome: 'Em produção',          cor: 'atencao' },
    { codigo: 'aguardando_pagamento', nome: 'Aguardando pagamento', cor: 'info' },
    { codigo: 'pronto',               nome: 'Pronto',               cor: 'sucesso' },
    { codigo: 'entregue',             nome: 'Entregue',             cor: 'sucesso' },
    { codigo: 'pausado',              nome: 'Pausado',              cor: 'neutro' },
    { codigo: 'cancelado',            nome: 'Cancelado',            cor: 'critico' }
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

  function gerarNumero() {
    const n = String(proximoNumero).padStart(4, '0');
    proximoNumero++;
    return `PED-${n}`;
  }

  /* ==========================================================
     4. PRODUTOS
     ========================================================== */

  function listarProdutos() {
    return (window.MODULO_PRODUTOS?._listar() || [])
      .filter(p => p.status === 'ativo')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function buscarProduto(id) {
    return window.MODULO_PRODUTOS?._buscar(id) || null;
  }

  /* ==========================================================
     5. CRUD
     ========================================================== */

  function criarPedido(dados) {
    const p = {
      id: proximoId++,
      numero: gerarNumero(),
      cliente: dados.cliente || '',
      clienteId: dados.clienteId || null,
      whatsapp: dados.whatsapp || '',
      email: dados.email || '',
      documento: dados.documento || '',
      itens: dados.itens || [],
      desconto: Number(dados.desconto) || 0,
      frete: Number(dados.frete) || 0,
      prazo: dados.prazo || '',
      formaPagamento: dados.formaPagamento || 'pix',
      formaEntrega: dados.formaEntrega || '',
      observacoes: dados.observacoes || '',
      personalizacao: dados.personalizacao || { tema: '', cor: '', texto: '' },
      status: dados.status || 'aguardando_producao',
      orcamentoId: dados.orcamentoId || null,
      orcamentoNumero: dados.orcamentoNumero || null,
      vendaId: null,
      vendaNumero: null,
      historico: [
        {
          data: new Date().toISOString(),
          status: dados.status || 'aguardando_producao',
          usuario: 'Administrador'
        }
      ],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    pedidos.push(p);
    return p;
  }

  // Criado a partir de um orçamento aprovado
  function _criarDoOrcamento(dados) {
    return criarPedido({
      cliente: dados.cliente,
      clienteId: dados.clienteId,
      whatsapp: dados.whatsapp,
      email: dados.email,
      documento: dados.documento,
      itens: dados.itens || [],
      desconto: Number(dados.desconto) || 0,
      frete: Number(dados.frete) || 0,
      prazo: dados.prazo || '',
      formaPagamento: dados.formaPagamento || 'pix',
      formaEntrega: dados.formaEntrega || '',
      observacoes: dados.observacoes || '',
      personalizacao: dados.personalizacao || { tema: '', cor: '', texto: '' },
      status: 'aguardando_producao',
      orcamentoId: dados.orcamentoId || null,
      orcamentoNumero: dados.orcamentoNumero || null
    });
  }

  function atualizarPedido(id, dados) {
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const anterior = pedidos[idx];
    const statusMudou = anterior.status !== dados.status;

    pedidos[idx] = {
      ...anterior,
      ...dados,
      desconto: Number(dados.desconto) || 0,
      frete: Number(dados.frete) || 0,
      atualizadoEm: new Date().toISOString()
    };

    if (statusMudou) {
      pedidos[idx].historico.push({
        data: new Date().toISOString(),
        status: dados.status,
        usuario: 'Administrador'
      });
    }

    return pedidos[idx];
  }

  function alterarStatus(id, novoStatus) {
    const p = buscarPedido(id);
    if (!p) return false;
    if (p.status === novoStatus) return false;

    p.status = novoStatus;
    p.historico.push({
      data: new Date().toISOString(),
      status: novoStatus,
      usuario: 'Administrador'
    });
    p.atualizadoEm = new Date().toISOString();
    return true;
  }

  function cancelarPedido(id) {
    return alterarStatus(id, 'cancelado');
  }

  function buscarPedido(id) {
    return pedidos.find(p => p.id === id) || null;
  }

  /* ==========================================================
     6. CÁLCULOS
     ========================================================== */

  function calcularTotais(p) {
    const subtotal = (p.itens || []).reduce((acc, i) => {
      return acc + (Number(i.preco) || 0) * (Number(i.quantidade) || 0);
    }, 0);
    const desconto = Number(p.desconto) || 0;
    const frete = Number(p.frete) || 0;
    const total = subtotal - desconto + frete;
    return { subtotal, desconto, frete, total };
  }

  /* ==========================================================
     7. VERIFICAÇÃO DE ESTOQUE
     ========================================================== */

  // Para cada item do pedido, verifica se tem estoque
  // Retorna:
  //   { itens: [...], total: { ok, misto, producao } }
  function verificarEstoque(p) {
    const itens = (p.itens || []).map(item => {
      const produto = item.produtoId ? buscarProduto(item.produtoId) : null;
      const estoque = produto ? Number(produto.estoqueAtual) || 0 : 0;
      const qtd = Number(item.quantidade) || 0;

      let situacao = 'producao';
      let faltam = qtd;

      if (estoque >= qtd) {
        situacao = 'ok';
        faltam = 0;
      } else if (estoque > 0) {
        situacao = 'misto';
        faltam = qtd - estoque;
      } else {
        situacao = 'producao';
        faltam = qtd;
      }

      return {
        ...item,
        estoque,
        qtd,
        faltam,
        situacao
      };
    });

    const resumo = {
      ok: itens.filter(i => i.situacao === 'ok').length,
      misto: itens.filter(i => i.situacao === 'misto').length,
      producao: itens.filter(i => i.situacao === 'producao').length
    };

    let total = 'ok';
    if (resumo.producao > 0 && resumo.ok === 0 && resumo.misto === 0) total = 'producao';
    else if (resumo.misto > 0 || resumo.producao > 0) total = 'misto';

    return { itens, resumo, total };
  }

  function nomeSituacaoEstoque(situacao) {
    if (situacao === 'ok') return 'Pronto';
    if (situacao === 'misto') return 'Misto';
    return 'Produzir';
  }

  function corSituacaoEstoque(situacao) {
    if (situacao === 'ok') return 'sucesso';
    if (situacao === 'misto') return 'atencao';
    return 'critico';
  }

  /* ==========================================================
     8. FILTROS
     ========================================================== */

  function pedidosFiltrados() {
    return pedidos.filter(p => {
      if (filtroStatus && p.status !== filtroStatus) return false;
      if (filtroEstoque) {
        const v = verificarEstoque(p);
        if (filtroEstoque !== v.total) return false;
      }
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${p.numero} ${p.cliente} ${p.email} ${p.observacoes}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }

  function alterarFiltroBusca(v)   { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroStatus(v)  { filtroStatus = v; rerender(); }
  function alterarFiltroEstoque(v) { filtroEstoque = v; rerender(); }

  /* ==========================================================
     9. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const total = pedidos.length;
    const emAberto = pedidos.filter(p => !['entregue', 'cancelado'].includes(p.status)).length;
    const atrasados = pedidos.filter(p => {
      if (['entregue', 'cancelado'].includes(p.status)) return false;
      if (!p.prazo) return false;
      return p.prazo < hojeISO();
    }).length;
    const semEstoque = pedidos.filter(p => verificarEstoque(p).total !== 'ok').length;

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Pedidos</h1>
          <p class="pagina-header__subtitulo">
            Acompanhe produção, prazo e entrega dos pedidos confirmados.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario" onclick="MODULO_PEDIDOS.abrirNovo()">
            + Novo pedido
          </button>
        </div>
      </div>

      ${total > 0 ? `
        <div class="grid grid--4 mb-6">
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Total</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${total}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${total === 1 ? 'pedido' : 'pedidos'}</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Em aberto</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${emAberto}</div>
            <div class="kpi__variacao kpi__variacao--neutra">aguardando</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Atrasados</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              </span>
            </div>
            <div class="kpi__valor ${atrasados > 0 ? 'text-critico' : ''}">${atrasados}</div>
            <div class="kpi__variacao ${atrasados > 0 ? 'kpi__variacao--negativa' : 'kpi__variacao--neutra'}">
              ${atrasados > 0 ? 'precisa atenção' : 'tudo no prazo'}
            </div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Precisa produzir</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20"/></svg>
              </span>
            </div>
            <div class="kpi__valor ${semEstoque > 0 ? 'text-atencao' : ''}">${semEstoque}</div>
            <div class="kpi__variacao kpi__variacao--neutra">
              ${semEstoque > 0 ? 'sem estoque total' : 'estoque ok'}
            </div>
          </div>
        </div>
      ` : ''}

      <div class="filtros-pedidos">
        <div class="filtros-pedidos__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por número, cliente ou observação..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_PEDIDOS.alterarFiltroBusca(this.value)"
          />
        </div>

        <select class="filtros-pedidos__select" onchange="MODULO_PEDIDOS.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          ${STATUS.map(s => `
            <option value="${s.codigo}" ${filtroStatus === s.codigo ? 'selected' : ''}>${s.nome}</option>
          `).join('')}
        </select>

        <select class="filtros-pedidos__select" onchange="MODULO_PEDIDOS.alterarFiltroEstoque(this.value)">
          <option value="">Todas as situações de estoque</option>
          <option value="ok"       ${filtroEstoque === 'ok' ? 'selected' : ''}>✅ Pronto</option>
          <option value="misto"    ${filtroEstoque === 'misto' ? 'selected' : ''}>⚠️ Misto</option>
          <option value="producao" ${filtroEstoque === 'producao' ? 'selected' : ''}>🔴 Produzir</option>
        </select>
      </div>

      <div id="tabela-pedidos-wrapper">
        ${renderTabela()}
      </div>
    `;
  }

  /* ==========================================================
     10. RENDER — TABELA
     ========================================================== */

  function renderTabela() {
    const lista = pedidosFiltrados();

    if (lista.length === 0) {
      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${pedidos.length === 0 ? 'Nenhum pedido cadastrado' : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${pedidos.length === 0
                ? 'Pedidos podem vir de um orçamento aprovado ou ser criados direto. Ao entregar, viram venda.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
            ${pedidos.length === 0 ? `
              <button class="btn btn--primario" onclick="MODULO_PEDIDOS.abrirNovo()">
                + Novo pedido
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
                <th>Origem</th>
                <th class="tabela__numero">Total</th>
                <th>Prazo</th>
                <th>Estoque</th>
                <th>Status</th>
                <th class="tabela__acao"></th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(p => renderLinha(p)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLinha(p) {
    const s = statusInfo(p.status);
    const { total } = calcularTotais(p);
    const v = verificarEstoque(p);
    const prazoVencido = p.prazo && p.prazo < hojeISO() && !['entregue', 'cancelado'].includes(p.status);

    return `
      <tr>
        <td><span class="sku">${escaparHTML(p.numero)}</span></td>
        <td>
          <div class="pedido-cliente">${escaparHTML(p.cliente || '—')}</div>
          ${p.personalizacao?.tema ? `<div class="pedido-tema">${escaparHTML(p.personalizacao.tema)}</div>` : ''}
        </td>
        <td>
          ${p.orcamentoNumero
            ? `<span class="badge badge--info">Orçamento ${escaparHTML(p.orcamentoNumero)}</span>`
            : `<span class="badge badge--neutro">Direto</span>`}
        </td>
        <td class="tabela__numero peso-semibold">${formatarMoeda(total)}</td>
        <td class="${prazoVencido ? 'text-critico peso-semibold' : ''}">
          ${formatarData(p.prazo)}
          ${prazoVencido ? '<div class="pedido-atraso">Atrasado</div>' : ''}
        </td>
        <td>
          <span class="badge badge--${corSituacaoEstoque(v.total)}">
            ${nomeSituacaoEstoque(v.total)}
          </span>
        </td>
        <td><span class="badge badge--${s.cor}">${s.nome}</span></td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Ver detalhes" onclick="MODULO_PEDIDOS.verDetalhes(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-icone" title="Editar" onclick="MODULO_PEDIDOS.abrirEdicao(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            ${!['entregue', 'cancelado'].includes(p.status) ? `
              <button class="btn-icone btn-icone--perigo" title="Cancelar" onclick="MODULO_PEDIDOS.confirmarCancelamento(${p.id})">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     11. MODAL DE PEDIDO
     ========================================================== */

  function abrirNovo() {
    pedidoEditandoId = null;
    itensTemporarios = [];
    abrirModal();
  }

  function abrirEdicao(id) {
    const p = buscarPedido(id);
    if (!p) return;
    if (p.status === 'entregue' || p.status === 'cancelado') {
      return alert('Este pedido não pode mais ser editado.');
    }
    pedidoEditandoId = id;
    itensTemporarios = JSON.parse(JSON.stringify(p.itens || []));
    abrirModal();
  }

  function abrirModal() {
    const p = pedidoEditandoId ? buscarPedido(pedidoEditandoId) : null;
    const editando = !!p;

    const html = `
      <div class="modal-overlay ativo" id="modal-pedido">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar pedido ' + escaparHTML(p.numero) : 'Novo pedido'}</h2>
            <button class="modal__fechar" onclick="MODULO_PEDIDOS.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body" id="ped-modal-body">
            ${renderFormPedido(p)}
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PEDIDOS.fecharModal()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_PEDIDOS.salvar()">
              ${editando ? 'Salvar alterações' : 'Cadastrar pedido'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-pedido')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => document.getElementById('ped-cliente')?.focus(), 50);
  }

  function fecharModal() {
    document.getElementById('modal-pedido')?.remove();
    pedidoEditandoId = null;
    itensTemporarios = [];
  }

  /* ==========================================================
     12. FORMULÁRIO DO PEDIDO
     ========================================================== */

  function renderFormPedido(p) {
    const personalizacao = p?.personalizacao || { tema: '', cor: '', texto: '' };
    const status = p?.status || 'aguardando_producao';

    return `
      <div class="form-linha">
        <div class="form-grupo">
          <label for="ped-cliente">Cliente <span class="form-obrigatorio">*</span></label>
          <input
            id="ped-cliente"
            type="text"
            required
            value="${escaparHTML(p?.cliente || '')}"
            placeholder="Nome do cliente"
          />
        </div>

        <div class="form-grupo">
          <label for="ped-prazo">Prazo de entrega</label>
          <input
            id="ped-prazo"
            type="date"
            value="${p?.prazo || ''}"
          />
        </div>
      </div>

      <div class="form-linha">
        <div class="form-grupo">
          <label for="ped-whatsapp">WhatsApp</label>
          <input
            id="ped-whatsapp"
            type="text"
            value="${escaparHTML(p?.whatsapp || '')}"
            placeholder="(00) 90000-0000"
          />
        </div>
        <div class="form-grupo">
          <label for="ped-email">E-mail</label>
          <input
            id="ped-email"
            type="email"
            value="${escaparHTML(p?.email || '')}"
            placeholder="cliente@email.com"
          />
        </div>
      </div>

      <div class="form-linha">
        <div class="form-grupo">
          <label for="ped-status">Status</label>
          <select id="ped-status">
            ${STATUS.map(s => `
              <option value="${s.codigo}" ${status === s.codigo ? 'selected' : ''}>
                ${s.nome}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="form-grupo">
          <label for="ped-pagamento">Forma de pagamento</label>
          <select id="ped-pagamento">
            ${['pix','dinheiro','cartao','transferencia','boleto','outros'].map(f => `
              <option value="${f}" ${(p?.formaPagamento || 'pix') === f ? 'selected' : ''}>
                ${f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="form-linha">
        <div class="form-grupo">
          <label for="ped-desconto">Desconto (R$)</label>
          <input
            id="ped-desconto"
            type="number"
            min="0"
            step="0.01"
            value="${p?.desconto ?? ''}"
            placeholder="0,00"
            oninput="MODULO_PEDIDOS.atualizarResumo()"
          />
        </div>
        <div class="form-grupo">
          <label for="ped-frete">Frete (R$)</label>
          <input
            id="ped-frete"
            type="number"
            min="0"
            step="0.01"
            value="${p?.frete ?? ''}"
            placeholder="0,00"
            oninput="MODULO_PEDIDOS.atualizarResumo()"
          />
          <span class="form-ajuda">Deixe 0 se o cliente paga.</span>
        </div>
      </div>

      <div class="form-grupo">
        <label for="ped-entrega">Forma de entrega</label>
        <input
          id="ped-entrega"
          type="text"
          value="${escaparHTML(p?.formaEntrega || '')}"
          placeholder="Ex: Retirada, Correios, motoboy..."
        />
      </div>

      <div class="enc-secao">
        <div class="enc-secao__header">
          <div>
            <h3 class="enc-secao__titulo">Itens do pedido</h3>
            <p class="enc-secao__desc">Produtos que o cliente vai receber.</p>
          </div>
          <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_PEDIDOS.abrirModalItem()">
            + Adicionar item
          </button>
        </div>
        <div id="ped-lista-itens">
          ${renderListaItens()}
        </div>
      </div>

      <div class="enc-secao">
        <div class="enc-secao__header">
          <div>
            <h3 class="enc-secao__titulo">Personalização</h3>
            <p class="enc-secao__desc">Detalhes do produto personalizado.</p>
          </div>
        </div>
        <div class="form-linha">
          <div class="form-grupo">
            <label for="ped-tema">Tema</label>
            <input id="ped-tema" type="text" value="${escaparHTML(personalizacao.tema)}" placeholder="Ex: Coração" />
          </div>
          <div class="form-grupo">
            <label for="ped-cor">Cor</label>
            <input id="ped-cor" type="text" value="${escaparHTML(personalizacao.cor)}" placeholder="Ex: Azul-marinho" />
          </div>
        </div>
        <div class="form-grupo">
          <label for="ped-texto">Texto personalizado</label>
          <input id="ped-texto" type="text" value="${escaparHTML(personalizacao.texto)}" placeholder="Ex: Para a Ana, com amor" />
        </div>
      </div>

      <div class="form-grupo">
        <label for="ped-obs">Observações</label>
        <textarea id="ped-obs" placeholder="Detalhes adicionais...">${escaparHTML(p?.observacoes || '')}</textarea>
      </div>

      <div class="ped-resumo" id="ped-resumo">
        ${renderResumo()}
      </div>
    `;
  }

  function renderListaItens() {
    if (itensTemporarios.length === 0) {
      return `
        <div class="enc-itens-vazio">
          <p>Nenhum item adicionado ainda.</p>
          <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_PEDIDOS.abrirModalItem()">
            + Adicionar o primeiro item
          </button>
        </div>
      `;
    }

    const subtotal = itensTemporarios.reduce(
      (acc, i) => acc + (Number(i.preco) || 0) * (Number(i.quantidade) || 0),
      0
    );

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
          ${itensTemporarios.map((i, idx) => {
            const produto = i.produtoId ? buscarProduto(i.produtoId) : null;
            const estoque = produto ? Number(produto.estoqueAtual) || 0 : 0;
            const qtd = Number(i.quantidade) || 0;
            let situacao = 'producao';
            if (estoque >= qtd) situacao = 'ok';
            else if (estoque > 0) situacao = 'misto';
            const cor = situacao === 'ok' ? 'sucesso' : situacao === 'misto' ? 'atencao' : 'critico';

            return `
              <tr>
                <td>
                  <div class="enc-item-nome">${escaparHTML(i.nome)}</div>
                  ${i.sku ? `<span class="sku">${escaparHTML(i.sku)}</span>` : ''}
                  ${produto ? `
                    <div class="ped-item-estoque">
                      <span class="badge badge--${cor}">${nomeSituacaoEstoque(situacao)}</span>
                      <span class="ped-item-estoque__qtd">${estoque} em estoque</span>
                    </div>
                  ` : ''}
                </td>
                <td class="tabela__numero">${i.quantidade}</td>
                <td class="tabela__numero">${formatarMoeda(i.preco)}</td>
                <td class="tabela__numero peso-semibold">${formatarMoeda((Number(i.preco) || 0) * (Number(i.quantidade) || 0))}</td>
                <td class="tabela__acao">
                  <button type="button" class="btn-icone btn-icone--perigo" title="Remover" onclick="MODULO_PEDIDOS.removerItem(${idx})">
                    <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="text-right peso-semibold">Subtotal dos itens</td>
            <td class="tabela__numero peso-bold text-principal">${formatarMoeda(subtotal)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  function atualizarListaItens() {
    const container = document.getElementById('ped-lista-itens');
    if (container) container.innerHTML = renderListaItens();
  }

  /* ==========================================================
     13. MODAL DE ITEM
     ========================================================== */

  function abrirModalItem() {
    const produtos = listarProdutos();

    const html = `
      <div class="modal-overlay ativo" id="modal-item-ped" style="z-index: 700">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Adicionar item</h2>
            <button class="modal__fechar" onclick="MODULO_PEDIDOS.fecharModalItem()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="form-grupo">
              <label for="ped-item-produto">Produto</label>
              <select id="ped-item-produto" onchange="MODULO_PEDIDOS.preencherItemProduto()">
                <option value="">Selecione um produto cadastrado</option>
                ${produtos.map(p => `
                  <option
                    value="${p.id}"
                    data-nome="${escaparHTML(p.nome)}"
                    data-sku="${escaparHTML(p.sku)}"
                    data-preco="${p.precoVarejo}"
                    data-estoque="${p.estoqueAtual}"
                  >
                    ${escaparHTML(p.sku)} — ${escaparHTML(p.nome)} · ${p.estoqueAtual} un
                  </option>
                `).join('')}
              </select>
              <span class="form-ajuda">Ou digite manualmente abaixo.</span>
            </div>

            <div class="form-grupo">
              <label for="ped-item-nome">Nome <span class="form-obrigatorio">*</span></label>
              <input id="ped-item-nome" type="text" placeholder="Nome do item" />
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="ped-item-qtd">Quantidade</label>
                <input id="ped-item-qtd" type="number" min="1" step="1" value="1" oninput="MODULO_PEDIDOS.atualizarPreviewEstoque()" />
                <span class="form-ajuda" id="ped-item-estoque-aviso"></span>
              </div>
              <div class="form-grupo">
                <label for="ped-item-preco">Preço unitário (R$)</label>
                <input id="ped-item-preco" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PEDIDOS.fecharModalItem()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_PEDIDOS.adicionarItem()">Adicionar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-item-ped')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('ped-item-produto')?.focus(), 50);
  }

  function fecharModalItem() {
    document.getElementById('modal-item-ped')?.remove();
  }

  function preencherItemProduto() {
    const sel = document.getElementById('ped-item-produto');
    if (!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    document.getElementById('ped-item-nome').value = opt.dataset.nome || '';
    document.getElementById('ped-item-preco').value = opt.dataset.preco || '';
    atualizarPreviewEstoque();
  }

  function atualizarPreviewEstoque() {
    const sel = document.getElementById('ped-item-produto');
    const aviso = document.getElementById('ped-item-estoque-aviso');
    if (!sel || !sel.value || !aviso) return;

    const opt = sel.options[sel.selectedIndex];
    const estoque = Number(opt.dataset.estoque || 0);
    const qtd = Number(document.getElementById('ped-item-qtd')?.value) || 0;

    if (estoque >= qtd) {
      aviso.textContent = `✅ Tem ${estoque} em estoque`;
      aviso.style.color = 'var(--cor-sucesso)';
    } else if (estoque > 0) {
      aviso.textContent = `⚠️ Só tem ${estoque}. Faltam ${qtd - estoque} para produzir.`;
      aviso.style.color = 'var(--cor-atencao)';
    } else {
      aviso.textContent = `🔴 Sem estoque. Precisa produzir ${qtd}.`;
      aviso.style.color = 'var(--cor-critico)';
    }
  }

  function adicionarItem() {
    const sel = document.getElementById('ped-item-produto');
    const opt = sel && sel.value ? sel.options[sel.selectedIndex] : null;

    const nome = document.getElementById('ped-item-nome').value.trim();
    const quantidade = Number(document.getElementById('ped-item-qtd').value) || 0;
    const preco = Number(document.getElementById('ped-item-preco').value) || 0;

    if (!nome) return alert('Informe o nome do item.');
    if (quantidade <= 0) return alert('Informe a quantidade.');

    const produtoId = sel && sel.value ? Number(sel.value) : null;
    const sku = opt ? (opt.dataset.sku || '') : '';

    itensTemporarios.push({
      produtoId,
      nome,
      sku,
      quantidade,
      preco
    });

    atualizarListaItens();
    atualizarResumo();
    fecharModalItem();
  }

  function removerItem(idx) {
    itensTemporarios.splice(idx, 1);
    atualizarListaItens();
    atualizarResumo();
  }

  /* ==========================================================
     14. RESUMO
     ========================================================== */

  function atualizarResumo() {
    const container = document.getElementById('ped-resumo');
    if (container) container.innerHTML = renderResumo();
  }

  function renderResumo() {
    const desconto = Number(document.getElementById('ped-desconto')?.value) || 0;
    const frete = Number(document.getElementById('ped-frete')?.value) || 0;

    const subtotal = itensTemporarios.reduce(
      (acc, i) => acc + (Number(i.preco) || 0) * (Number(i.quantidade) || 0),
      0
    );
    const total = subtotal - desconto + frete;

    // Resumo de estoque dos itens
    const itensComProduto = itensTemporarios.filter(i => i.produtoId);
    const semEstoque = itensComProduto.filter(i => {
      const prod = buscarProduto(i.produtoId);
      if (!prod) return false;
      return (Number(prod.estoqueAtual) || 0) < (Number(i.quantidade) || 0);
    });

    return `
      <div class="ped-resumo__grid">
        <div class="ped-resumo__item">
          <span class="ped-resumo__label">Subtotal</span>
          <span class="ped-resumo__valor">${formatarMoeda(subtotal)}</span>
        </div>
        ${desconto > 0 ? `
          <div class="ped-resumo__item">
            <span class="ped-resumo__label">Desconto</span>
            <span class="ped-resumo__valor text-atencao">− ${formatarMoeda(desconto)}</span>
          </div>
        ` : ''}
        ${frete > 0 ? `
          <div class="ped-resumo__item">
            <span class="ped-resumo__label">Frete</span>
            <span class="ped-resumo__valor">+ ${formatarMoeda(frete)}</span>
          </div>
        ` : ''}
        <div class="ped-resumo__item ped-resumo__item--destaque">
          <span class="ped-resumo__label">Total</span>
          <span class="ped-resumo__valor">${formatarMoeda(total)}</span>
        </div>
      </div>

      ${semEstoque.length > 0 ? `
        <div class="alerta alerta--atencao mt-4">
          <span class="alerta__icone">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">${semEstoque.length} ${semEstoque.length === 1 ? 'item precisa' : 'itens precisam'} de produção</div>
            Estes itens não têm estoque suficiente e vão entrar na fila de produção.
          </div>
        </div>
      ` : ''}
    `;
  }

  /* ==========================================================
     15. SALVAR
     ========================================================== */

  function salvar() {
    const cliente = document.getElementById('ped-cliente').value.trim();
    if (!cliente) return alert('Informe o nome do cliente.');
    if (itensTemporarios.length === 0) return alert('Adicione pelo menos um item.');

    const dados = {
      cliente,
      whatsapp: document.getElementById('ped-whatsapp').value.trim(),
      email: document.getElementById('ped-email').value.trim(),
      prazo: document.getElementById('ped-prazo').value,
      status: document.getElementById('ped-status').value,
      formaPagamento: document.getElementById('ped-pagamento').value,
      desconto: Number(document.getElementById('ped-desconto').value) || 0,
      frete: Number(document.getElementById('ped-frete').value) || 0,
      formaEntrega: document.getElementById('ped-entrega').value.trim(),
      observacoes: document.getElementById('ped-obs').value.trim(),
      itens: itensTemporarios.map(i => ({ ...i })),
      personalizacao: {
        tema: document.getElementById('ped-tema').value.trim(),
        cor: document.getElementById('ped-cor').value.trim(),
        texto: document.getElementById('ped-texto').value.trim()
      }
    };

    if (pedidoEditandoId) {
      atualizarPedido(pedidoEditandoId, dados);
    } else {
      criarPedido(dados);
    }

    fecharModal();
    rerender();
  }

  /* ==========================================================
     16. VER DETALHES
     ========================================================== */

  function verDetalhes(id) {
    const p = buscarPedido(id);
    if (!p) return;

    const s = statusInfo(p.status);
    const t = calcularTotais(p);
    const v = verificarEstoque(p);

    const html = `
      <div class="modal-overlay ativo" id="modal-detalhes-ped">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Pedido ${escaparHTML(p.numero)}</h2>
            <button class="modal__fechar" onclick="MODULO_PEDIDOS.fecharDetalhes()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="ped-detalhe-grid">
              <div><strong>Cliente:</strong> ${escaparHTML(p.cliente)}</div>
              <div><strong>WhatsApp:</strong> ${escaparHTML(p.whatsapp || '—')}</div>
              <div><strong>E-mail:</strong> ${escaparHTML(p.email || '—')}</div>
              <div><strong>Status:</strong> <span class="badge badge--${s.cor}">${s.nome}</span></div>
              <div><strong>Prazo:</strong> ${formatarData(p.prazo)}</div>
              <div><strong>Situação estoque:</strong> <span class="badge badge--${corSituacaoEstoque(v.total)}">${nomeSituacaoEstoque(v.total)}</span></div>
              ${p.orcamentoNumero ? `<div><strong>Origem:</strong> Orçamento ${escaparHTML(p.orcamentoNumero)}</div>` : `<div><strong>Origem:</strong> Direto</div>`}
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
                    <th>Estoque</th>
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
                      <td>
                        <span class="badge badge--${corSituacaoEstoque(i.situacao)}">
                          ${nomeSituacaoEstoque(i.situacao)}
                        </span>
                        ${i.faltam > 0 ? `<div class="ped-item-falta">Faltam ${i.faltam}</div>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="enc-secao">
              <h3 class="enc-secao__titulo">Resumo</h3>
              <div class="calculo-detalhado">
                <div class="calculo-linha"><span>Subtotal</span><span>${formatarMoeda(t.subtotal)}</span></div>
                ${t.desconto > 0 ? `<div class="calculo-linha"><span>Desconto</span><span class="text-atencao">− ${formatarMoeda(t.desconto)}</span></div>` : ''}
                ${t.frete > 0 ? `<div class="calculo-linha"><span>Frete</span><span>+ ${formatarMoeda(t.frete)}</span></div>` : ''}
                <div class="calculo-linha calculo-linha--destaque"><span>Total</span><span>${formatarMoeda(t.total)}</span></div>
              </div>
            </div>

            ${p.observacoes ? `
              <div class="enc-secao">
                <h3 class="enc-secao__titulo">Observações</h3>
                <p>${escaparHTML(p.observacoes)}</p>
              </div>
            ` : ''}

            ${p.historico?.length > 0 ? `
              <div class="enc-secao">
                <h3 class="enc-secao__titulo">Histórico</h3>
                <div class="ped-historico">
                  ${p.historico.map(h => `
                    <div class="ped-historico__item">
                      <span class="ped-historico__data">${formatarData(h.data)}</span>
                      <span class="badge badge--${statusInfo(h.status).cor}">${statusInfo(h.status).nome}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PEDIDOS.fecharDetalhes()">Fechar</button>

            ${p.status === 'pronto' ? `
              <button class="btn btn--primario" onclick="MODULO_PEDIDOS.converterEmVenda(${p.id})">
                Converter em venda
              </button>
            ` : ''}

            ${p.status === 'aguardando_producao' ? `
              <button class="btn btn--secundario" onclick="MODULO_PEDIDOS.marcarEmProducao(${p.id})">
                Marcar em produção
              </button>
            ` : ''}

            ${p.status === 'em_producao' ? `
              <button class="btn btn--sucesso" onclick="MODULO_PEDIDOS.marcarPronto(${p.id})">
                Marcar pronto
              </button>
            ` : ''}

            ${p.status === 'pronto' ? `
              <button class="btn btn--sucesso" onclick="MODULO_PEDIDOS.marcarEntregue(${p.id})">
                Marcar entregue
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-detalhes-ped')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharDetalhes() {
    document.getElementById('modal-detalhes-ped')?.remove();
  }

  /* ==========================================================
     17. AÇÕES DE STATUS
     ========================================================== */

  function marcarEmProducao(id) {
    alterarStatus(id, 'em_producao');
    fecharDetalhes();
    rerender();
  }

  function marcarPronto(id) {
    alterarStatus(id, 'pronto');
    fecharDetalhes();
    rerender();
  }

  function marcarEntregue(id) {
    alterarStatus(id, 'entregue');
    fecharDetalhes();
    rerender();
  }

  function confirmarCancelamento(id) {
    const p = buscarPedido(id);
    if (!p) return;
    const ok = confirm(
      `Cancelar o pedido ${p.numero} de "${p.cliente}"?\n\n` +
      `Ele continuará no histórico como cancelado.`
    );
    if (!ok) return;
    cancelarPedido(id);
    rerender();
  }

  /* ==========================================================
     18. CONVERTER EM VENDA
     ========================================================== */

  function converterEmVenda(id) {
    const p = buscarPedido(id);
    if (!p) return;

    if (p.status !== 'pronto' && p.status !== 'entregue') {
      return alert('Só é possível converter pedido "Pronto" ou "Entregue" em venda.');
    }

    if (!window.MODULO_VENDAS_CORE) {
      return alert('Módulo de Vendas não disponível.');
    }

    if (!confirm(`Converter o pedido ${p.numero} em venda?`)) return;

    try {
      const t = calcularTotais(p);

      const venda = window.MODULO_VENDAS_CORE._criarDoPedido({
        cliente: p.cliente,
        itens: p.itens.map(i => ({
          produtoId: i.produtoId,
          nome: i.nome,
          sku: i.sku,
          quantidade: i.quantidade,
          preco: i.preco,
          desconto: 0,
          custo: buscarProduto(i.produtoId)?.custo || 0
        })),
        freteVendedor: p.frete || 0,
        observacoes: `Gerado do pedido ${p.numero}`,
        pedidoId: p.id,
        pedidoNumero: p.numero
      });

      p.status = 'entregue';
      p.vendaId = venda.id;
      p.vendaNumero = venda.numero;
      p.historico.push({
        data: new Date().toISOString(),
        status: 'entregue',
        usuario: 'Administrador'
      });

      fecharDetalhes();

      alert(
        'Pedido convertido em venda!\n\n' +
        'Venda: ' + venda.numero + '\n' +
        'Cliente: ' + p.cliente + '\n' +
        'Total: ' + formatarMoeda(t.total)
      );

      setTimeout(() => window.ROUTER_PRAFICAR?.irPara('vendas'), 300);

    } catch (e) {
      console.error(e);
      alert('Erro ao converter: ' + e.message);
    }
  }

  /* ==========================================================
     19. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'pedidos') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-pedidos-wrapper');
    if (wrapper) wrapper.innerHTML = renderTabela();
  }

  /* ==========================================================
     20. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovo,
    abrirEdicao,
    fecharModal,
    abrirModalItem,
    fecharModalItem,
    preencherItemProduto,
    atualizarPreviewEstoque,
    adicionarItem,
    removerItem,
    atualizarResumo,
    salvar,
    verDetalhes,
    fecharDetalhes,
    marcarEmProducao,
    marcarPronto,
    marcarEntregue,
    confirmarCancelamento,
    converterEmVenda,
    alterarStatus,
    alterarFiltroBusca,
    alterarFiltroStatus,
    alterarFiltroEstoque,
    _listar: () => [...pedidos],
    _buscar: buscarPedido,
    _criarDoOrcamento,
    _calcularTotais: calcularTotais,
    _verificarEstoque: verificarEstoque,
    STATUS
  };

})();

window.MODULO_PEDIDOS = MODULO_PEDIDOS;
window.renderPedidos = MODULO_PEDIDOS.render;
