/* ============================================================
   PRAFICAR ERP — MÓDULO ORÇAMENTOS
   Arquivo: assets/js/modulos/orcamentos.js
   Descrição: orçamentos para cliente. Pode ser alterado várias
              vezes antes de aprovar. Aprovado vira pedido.
              Link público permite ao cliente comentar/negociar.

   Fluxo de status:
     rascunho → enviado → negociacao → aprovado
     (e também: recusado / expirado / cancelado / virou_pedido)
   ============================================================ */

const MODULO_ORCAMENTOS = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let orcamentos = [];
  let proximoId = 1;
  let proximoNumero = 1;

  let filtroBusca = '';
  let filtroStatus = '';
  let orcamentoEditandoId = null;

  let itensTemporarios = [];

  /* ==========================================================
     2. STATUS
     ========================================================== */

  const STATUS = [
    { codigo: 'rascunho',     nome: 'Rascunho',      cor: 'neutro'  },
    { codigo: 'enviado',      nome: 'Enviado',       cor: 'info'    },
    { codigo: 'negociacao',   nome: 'Em negociação', cor: 'atencao' },
    { codigo: 'aprovado',     nome: 'Aprovado',      cor: 'sucesso' },
    { codigo: 'recusado',     nome: 'Recusado',      cor: 'critico' },
    { codigo: 'expirado',     nome: 'Expirado',      cor: 'neutro'  },
    { codigo: 'cancelado',    nome: 'Cancelado',     cor: 'neutro'  },
    { codigo: 'virou_pedido', nome: 'Virou pedido',  cor: 'sucesso' }
  ];

  function statusInfo(codigo) {
    return STATUS.find(s => s.codigo === codigo) || STATUS[0];
  }

  function podeEditar(orcamento) {
    return ['rascunho', 'enviado', 'negociacao'].includes(orcamento.status);
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

  function gerarNumero() {
    const n = String(proximoNumero).padStart(4, '0');
    proximoNumero++;
    return `ORC-${n}`;
  }

  function gerarSlug() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  /* ==========================================================
     4. CRUD
     ========================================================== */

  function criarOrcamento(dados) {
    const o = {
      id: proximoId++,
      numero: gerarNumero(),
      slug: gerarSlug(),
      cliente: dados.cliente || '',
      clienteId: dados.clienteId || null,
      whatsapp: dados.whatsapp || '',
      email: dados.email || '',
      documento: dados.documento || '',
      itens: dados.itens || [],
      descontoGeral: Number(dados.descontoGeral) || 0,
      frete: Number(dados.frete) || 0,
      validade: dados.validade || adicionarDias(hojeISO(), 15),
      prazo: dados.prazo || '',
      formaPagamento: dados.formaPagamento || 'pix',
      formaEntrega: dados.formaEntrega || '',
      observacoes: dados.observacoes || '',
      status: dados.status || 'rascunho',
      comentarios: [],
      historico: [
        { data: new Date().toISOString(), status: dados.status || 'rascunho' }
      ],
      pedidoId: null,
      pedidoNumero: null,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    orcamentos.push(o);
    return o;
  }

  function atualizarOrcamento(id, dados) {
    const idx = orcamentos.findIndex(o => o.id === id);
    if (idx === -1) return null;

    const anterior = orcamentos[idx];

    if (!podeEditar(anterior)) {
      return { erro: 'Orçamento não pode ser editado neste status.' };
    }

    if (anterior.status !== dados.status) {
      anterior.historico.push({
        data: new Date().toISOString(),
        status: dados.status
      });
    }

    orcamentos[idx] = {
      ...anterior,
      ...dados,
      descontoGeral: Number(dados.descontoGeral) || 0,
      frete: Number(dados.frete) || 0,
      atualizadoEm: new Date().toISOString()
    };
    return orcamentos[idx];
  }

  function alterarStatus(id, novoStatus) {
    const o = buscarOrcamento(id);
    if (!o) return false;
    if (o.status === 'virou_pedido') return false;
    if (o.status === novoStatus) return false;

    o.status = novoStatus;
    o.historico.push({
      data: new Date().toISOString(),
      status: novoStatus
    });
    o.atualizadoEm = new Date().toISOString();
    return true;
  }

  function cancelarOrcamento(id) {
    return alterarStatus(id, 'cancelado');
  }

  function buscarOrcamento(id) {
    return orcamentos.find(o => o.id === id) || null;
  }

  /* ==========================================================
     5. CÁLCULOS
     ========================================================== */

  function calcularTotais(o) {
    const subtotal = (o.itens || []).reduce((acc, i) => {
      const bruto = (Number(i.preco) || 0) * (Number(i.quantidade) || 0);
      const descontoItem = Number(i.desconto) || 0;
      return acc + (bruto - descontoItem);
    }, 0);

    const descontoGeral = Number(o.descontoGeral) || 0;
    const frete = Number(o.frete) || 0;
    const total = subtotal - descontoGeral + frete;

    const descontoItens = (o.itens || []).reduce((acc, i) => acc + (Number(i.desconto) || 0), 0);
    const descontoTotal = descontoItens + descontoGeral;

    return { subtotal, descontoItens, descontoGeral, descontoTotal, frete, total };
  }

  /* ==========================================================
     6. FILTROS
     ========================================================== */

  function orcamentosFiltrados() {
    return orcamentos.filter(o => {
      if (filtroStatus && o.status !== filtroStatus) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${o.numero} ${o.cliente} ${o.email}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }

  function alterarFiltroBusca(v) { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroStatus(v) { filtroStatus = v; rerender(); }

  /* ==========================================================
     7. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const total = orcamentos.length;
    const abertos = orcamentos.filter(o => ['rascunho', 'enviado', 'negociacao'].includes(o.status)).length;
    const aprovados = orcamentos.filter(o => o.status === 'aprovado').length;
    const vencidos = orcamentos.filter(o => {
      if (['aprovado', 'virou_pedido', 'cancelado', 'recusado'].includes(o.status)) return false;
      return o.validade && o.validade < hojeISO();
    }).length;

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Orçamentos</h1>
          <p class="pagina-header__subtitulo">
            Cotações para clientes. Ao aprovar, viram pedido.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario" onclick="MODULO_ORCAMENTOS.abrirNovo()">
            + Novo orçamento
          </button>
        </div>
      </div>

      ${total > 0 ? `
        <div class="grid grid--4 mb-6">
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Total</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${total}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${total === 1 ? 'orçamento' : 'orçamentos'}</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Em aberto</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${abertos}</div>
            <div class="kpi__variacao kpi__variacao--neutra">aguardando cliente</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Aprovados</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
              </span>
            </div>
            <div class="kpi__valor text-sucesso">${aprovados}</div>
            <div class="kpi__variacao kpi__variacao--neutra">prontos para pedido</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Vencidos</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              </span>
            </div>
            <div class="kpi__valor ${vencidos > 0 ? 'text-critico' : ''}">${vencidos}</div>
            <div class="kpi__variacao ${vencidos > 0 ? 'kpi__variacao--negativa' : 'kpi__variacao--neutra'}">
              ${vencidos > 0 ? 'fora da validade' : 'dentro da validade'}
            </div>
          </div>
        </div>
      ` : ''}

      <div class="filtros-orcamentos">
        <div class="filtros-orcamentos__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por número, cliente ou e-mail..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_ORCAMENTOS.alterarFiltroBusca(this.value)"
          />
        </div>

        <select class="filtros-orcamentos__select" onchange="MODULO_ORCAMENTOS.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          ${STATUS.map(s => `
            <option value="${s.codigo}" ${filtroStatus === s.codigo ? 'selected' : ''}>${s.nome}</option>
          `).join('')}
        </select>
      </div>

      <div id="tabela-orcamentos-wrapper">
        ${renderTabela()}
      </div>
    `;
  }

  function renderTabela() {
    const lista = orcamentosFiltrados();

    if (lista.length === 0) {
      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${orcamentos.length === 0 ? 'Nenhum orçamento criado' : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${orcamentos.length === 0
                ? 'Crie orçamentos para enviar aos clientes. Após aprovado, vira pedido sem redigitar.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
            ${orcamentos.length === 0 ? `
              <button class="btn btn--primario" onclick="MODULO_ORCAMENTOS.abrirNovo()">
                + Novo orçamento
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
                <th>Validade</th>
                <th>Status</th>
                <th class="tabela__acao"></th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(o => renderLinha(o)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLinha(o) {
    const s = statusInfo(o.status);
    const { total } = calcularTotais(o);
    const qtdItens = (o.itens || []).reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);
    const vencido = o.validade < hojeISO() && !['aprovado', 'virou_pedido', 'cancelado', 'recusado'].includes(o.status);

    return `
      <tr>
        <td><span class="sku">${escaparHTML(o.numero)}</span></td>
        <td>
          <div class="orc-cliente">${escaparHTML(o.cliente || '—')}</div>
          ${o.email ? `<div class="orc-email">${escaparHTML(o.email)}</div>` : ''}
        </td>
        <td>${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'}</td>
        <td class="tabela__numero peso-semibold">${formatarMoeda(total)}</td>
        <td class="${vencido ? 'text-critico peso-semibold' : ''}">
          ${formatarData(o.validade)}
          ${vencido ? '<div class="orc-vencido">Vencido</div>' : ''}
        </td>
        <td><span class="badge badge--${s.cor}">${s.nome}</span></td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Visualizar" onclick="MODULO_ORCAMENTOS.verDetalhes(${o.id})">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${podeEditar(o) ? `
              <button class="btn-icone" title="Editar" onclick="MODULO_ORCAMENTOS.abrirEdicao(${o.id})">
                <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     8. MODAL — NOVO / EDITAR
     ========================================================== */

  function abrirNovo() {
    orcamentoEditandoId = null;
    itensTemporarios = [];
    abrirModal();
  }

  function abrirEdicao(id) {
    const o = buscarOrcamento(id);
    if (!o) return;
    if (!podeEditar(o)) {
      return alert('Este orçamento não pode mais ser editado.');
    }
    orcamentoEditandoId = id;
    itensTemporarios = JSON.parse(JSON.stringify(o.itens || []));
    abrirModal();
  }

  function abrirModal() {
    const o = orcamentoEditandoId ? buscarOrcamento(orcamentoEditandoId) : null;
    const editando = !!o;

    const validade = o ? o.validade : adicionarDias(hojeISO(), 15);

    const html = `
      <div class="modal-overlay ativo" id="modal-orcamento">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar orçamento ' + escaparHTML(o.numero) : 'Novo orçamento'}</h2>
            <button class="modal__fechar" onclick="MODULO_ORCAMENTOS.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <form id="form-orcamento" onsubmit="MODULO_ORCAMENTOS.salvar(event)">

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="orc-cliente">Cliente <span class="form-obrigatorio">*</span></label>
                  <input id="orc-cliente" type="text" required value="${escaparHTML(o?.cliente || '')}" placeholder="Nome do cliente" />
                </div>
                <div class="form-grupo">
                  <label for="orc-whatsapp">WhatsApp</label>
                  <input id="orc-whatsapp" type="text" value="${escaparHTML(o?.whatsapp || '')}" placeholder="(00) 90000-0000" />
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="orc-email">E-mail</label>
                  <input id="orc-email" type="email" value="${escaparHTML(o?.email || '')}" placeholder="cliente@email.com" />
                </div>
                <div class="form-grupo">
                  <label for="orc-documento">CPF / CNPJ</label>
                  <input id="orc-documento" type="text" value="${escaparHTML(o?.documento || '')}" placeholder="000.000.000-00" />
                </div>
              </div>

              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="orc-validade">Validade</label>
                  <input id="orc-validade" type="date" value="${validade}" />
                  <span class="form-ajuda">Prazo para o cliente aprovar</span>
                </div>
                <div class="form-grupo">
                  <label for="orc-prazo">Prazo de produção</label>
                  <input id="orc-prazo" type="text" value="${escaparHTML(o?.prazo || '')}" placeholder="Ex: 5 dias úteis" />
                </div>
                <div class="form-grupo">
                  <label for="orc-pagamento">Forma de pagamento</label>
                  <select id="orc-pagamento">
                    <option value="pix"           ${(o?.formaPagamento || 'pix') === 'pix' ? 'selected' : ''}>Pix</option>
                    <option value="dinheiro"      ${o?.formaPagamento === 'dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="cartao"        ${o?.formaPagamento === 'cartao' ? 'selected' : ''}>Cartão</option>
                    <option value="transferencia" ${o?.formaPagamento === 'transferencia' ? 'selected' : ''}>Transferência</option>
                    <option value="boleto"        ${o?.formaPagamento === 'boleto' ? 'selected' : ''}>Boleto</option>
                    <option value="outros"        ${o?.formaPagamento === 'outros' ? 'selected' : ''}>Outros</option>
                  </select>
                </div>
              </div>

              <div class="form-grupo">
                <label for="orc-entrega">Forma de entrega</label>
                <input id="orc-entrega" type="text" value="${escaparHTML(o?.formaEntrega || '')}" placeholder="Ex: Retirada, Correios, motoboy..." />
              </div>

              <div class="orc-secao">
                <div class="orc-secao__header">
                  <div>
                    <h3 class="orc-secao__titulo">Itens do orçamento</h3>
                    <p class="orc-secao__desc">Produtos que o cliente está cotando.</p>
                  </div>
                  <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_ORCAMENTOS.abrirModalItem()">
                    + Adicionar item
                  </button>
                </div>
                <div id="orc-lista-itens">
                  ${renderListaItens()}
                </div>
              </div>

              <div class="form-linha-2">
                <div class="form-grupo">
                  <label for="orc-desconto">Desconto geral (R$)</label>
                  <input id="orc-desconto" type="number" min="0" step="0.01" value="${o?.descontoGeral ?? ''}" placeholder="0,00" oninput="MODULO_ORCAMENTOS.atualizarResumo()" />
                </div>
                <div class="form-grupo">
                  <label for="orc-frete">Frete (R$)</label>
                  <input id="orc-frete" type="number" min="0" step="0.01" value="${o?.frete ?? ''}" placeholder="0,00" oninput="MODULO_ORCAMENTOS.atualizarResumo()" />
                  <span class="form-ajuda">Deixe 0 se o cliente paga</span>
                </div>
              </div>

              <div class="form-grupo">
                <label for="orc-obs">Observações</label>
                <textarea id="orc-obs" placeholder="Anotações internas ou para o cliente...">${escaparHTML(o?.observacoes || '')}</textarea>
              </div>

              <div class="orc-resumo" id="orc-resumo">
                ${renderResumo()}
              </div>

            </form>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_ORCAMENTOS.fecharModal()">Cancelar</button>
            <button class="btn btn--primario" onclick="document.getElementById('form-orcamento').requestSubmit()">
              ${editando ? 'Salvar alterações' : 'Criar orçamento'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-orcamento')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('orc-cliente')?.focus(), 50);
  }

  function fecharModal() {
    document.getElementById('modal-orcamento')?.remove();
    orcamentoEditandoId = null;
    itensTemporarios = [];
  }

  /* ==========================================================
     9. LISTA DE ITENS
     ========================================================== */

  function renderListaItens() {
    if (itensTemporarios.length === 0) {
      return `
        <div class="orc-itens-vazio">
          <p>Nenhum item adicionado ainda.</p>
          <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_ORCAMENTOS.abrirModalItem()">
            + Adicionar o primeiro item
          </button>
        </div>
      `;
    }

    const subtotal = itensTemporarios.reduce((acc, i) => {
      const bruto = (Number(i.preco) || 0) * (Number(i.quantidade) || 0);
      return acc + (bruto - (Number(i.desconto) || 0));
    }, 0);

    return `
      <table class="tabela tabela-itens">
        <thead>
          <tr>
            <th>Produto</th>
            <th class="tabela__numero">Qtd</th>
            <th class="tabela__numero">Preço un.</th>
            <th class="tabela__numero">Desc.</th>
            <th class="tabela__numero">Total</th>
            <th class="tabela__acao"></th>
          </tr>
        </thead>
        <tbody>
          ${itensTemporarios.map((i, idx) => {
            const bruto = (Number(i.preco) || 0) * (Number(i.quantidade) || 0);
            const total = bruto - (Number(i.desconto) || 0);
            return `
              <tr>
                <td>
                  <div class="produto-nome">${escaparHTML(i.nome)}</div>
                  ${i.sku ? `<span class="sku">${escaparHTML(i.sku)}</span>` : ''}
                </td>
                <td class="tabela__numero">${i.quantidade}</td>
                <td class="tabela__numero">${formatarMoeda(i.preco)}</td>
                <td class="tabela__numero">${formatarMoeda(i.desconto)}</td>
                <td class="tabela__numero peso-semibold">${formatarMoeda(total)}</td>
                <td class="tabela__acao">
                  <button type="button" class="btn-icone btn-icone--perigo" title="Remover" onclick="MODULO_ORCAMENTOS.removerItem(${idx})">
                    <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-right peso-semibold">Subtotal dos itens</td>
            <td class="tabela__numero peso-bold text-principal">${formatarMoeda(subtotal)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  function atualizarListaItens() {
    const container = document.getElementById('orc-lista-itens');
    if (container) container.innerHTML = renderListaItens();
  }

  /* ==========================================================
     10. MODAL — ADICIONAR ITEM
     ========================================================== */

  function abrirModalItem() {
    const produtos = (window.MODULO_PRODUTOS?._listar() || [])
      .filter(p => p.status === 'ativo')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const html = `
      <div class="modal-overlay ativo" id="modal-item-orc" style="z-index: 700">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Adicionar item</h2>
            <button class="modal__fechar" onclick="MODULO_ORCAMENTOS.fecharModalItem()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="form-grupo">
              <label for="item-produto">Produto</label>
              <select id="item-produto" onchange="MODULO_ORCAMENTOS.preencherItem()">
                <option value="">Selecione um produto cadastrado</option>
                ${produtos.map(p => `
                  <option
                    value="${p.id}"
                    data-nome="${escaparHTML(p.nome)}"
                    data-sku="${escaparHTML(p.sku)}"
                    data-preco="${p.precoVarejo}"
                  >
                    ${escaparHTML(p.sku)} — ${escaparHTML(p.nome)} · ${formatarMoeda(p.precoVarejo)}
                  </option>
                `).join('')}
              </select>
              <span class="form-ajuda">Ou digite manualmente abaixo.</span>
            </div>

            <div class="form-grupo">
              <label for="item-nome">Nome do item <span class="form-obrigatorio">*</span></label>
              <input id="item-nome" type="text" placeholder="Nome do item" />
            </div>

            <div class="form-linha-3">
              <div class="form-grupo">
                <label for="item-qtd">Quantidade</label>
                <input id="item-qtd" type="number" min="1" step="1" value="1" />
              </div>
              <div class="form-grupo">
                <label for="item-preco">Preço unitário (R$)</label>
                <input id="item-preco" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
              <div class="form-grupo">
                <label for="item-desconto">Desconto (R$)</label>
                <input id="item-desconto" type="number" min="0" step="0.01" value="0" />
              </div>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_ORCAMENTOS.fecharModalItem()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_ORCAMENTOS.adicionarItem()">Adicionar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-item-orc')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('item-produto')?.focus(), 50);
  }

  function fecharModalItem() {
    document.getElementById('modal-item-orc')?.remove();
  }

  function preencherItem() {
    const sel = document.getElementById('item-produto');
    if (!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    document.getElementById('item-nome').value = opt.dataset.nome || '';
    document.getElementById('item-preco').value = opt.dataset.preco || '';
  }

  function adicionarItem() {
    const nome = document.getElementById('item-nome').value.trim();
    const quantidade = Number(document.getElementById('item-qtd').value) || 0;
    const preco = Number(document.getElementById('item-preco').value) || 0;
    const desconto = Number(document.getElementById('item-desconto').value) || 0;

    if (!nome) return alert('Informe o nome do item.');
    if (quantidade <= 0) return alert('Informe a quantidade.');

    const sel = document.getElementById('item-produto');
    const opt = sel && sel.value ? sel.options[sel.selectedIndex] : null;
    const sku = opt ? (opt.dataset.sku || '') : '';
    const produtoId = opt && sel.value ? Number(sel.value) : null;

    itensTemporarios.push({
      produtoId,
      nome,
      sku,
      quantidade,
      preco,
      desconto
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
     11. RESUMO
     ========================================================== */

  function atualizarResumo() {
    const container = document.getElementById('orc-resumo');
    if (container) container.innerHTML = renderResumo();
  }

  function renderResumo() {
    const descontoGeral = Number(document.getElementById('orc-desconto')?.value) || 0;
    const frete = Number(document.getElementById('orc-frete')?.value) || 0;

    const temp = {
      itens: itensTemporarios,
      descontoGeral,
      frete
    };

    const t = calcularTotais(temp);

    return `
      <div class="orc-resumo__grid">
        <div class="orc-resumo__item">
          <span class="orc-resumo__label">Subtotal</span>
          <span class="orc-resumo__valor">${formatarMoeda(t.subtotal)}</span>
        </div>
        ${t.descontoTotal > 0 ? `
          <div class="orc-resumo__item">
            <span class="orc-resumo__label">Descontos</span>
            <span class="orc-resumo__valor text-atencao">− ${formatarMoeda(t.descontoTotal)}</span>
          </div>
        ` : ''}
        ${t.frete > 0 ? `
          <div class="orc-resumo__item">
            <span class="orc-resumo__label">Frete</span>
            <span class="orc-resumo__valor">+ ${formatarMoeda(t.frete)}</span>
          </div>
        ` : ''}
        <div class="orc-resumo__item orc-resumo__item--destaque">
          <span class="orc-resumo__label">Total</span>
          <span class="orc-resumo__valor">${formatarMoeda(t.total)}</span>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     12. SALVAR
     ========================================================== */

  function salvar(event) {
    event.preventDefault();

    const cliente = document.getElementById('orc-cliente').value.trim();
    if (!cliente) return alert('Informe o cliente.');
    if (itensTemporarios.length === 0) return alert('Adicione pelo menos um item.');

    const dados = {
      cliente,
      whatsapp: document.getElementById('orc-whatsapp').value.trim(),
      email: document.getElementById('orc-email').value.trim(),
      documento: document.getElementById('orc-documento').value.trim(),
      validade: document.getElementById('orc-validade').value,
      prazo: document.getElementById('orc-prazo').value.trim(),
      formaPagamento: document.getElementById('orc-pagamento').value,
      formaEntrega: document.getElementById('orc-entrega').value.trim(),
      descontoGeral: Number(document.getElementById('orc-desconto').value) || 0,
      frete: Number(document.getElementById('orc-frete').value) || 0,
      observacoes: document.getElementById('orc-obs').value.trim(),
      itens: itensTemporarios.map(i => ({ ...i }))
    };

    if (orcamentoEditandoId) {
      const r = atualizarOrcamento(orcamentoEditandoId, dados);
      if (r && r.erro) return alert(r.erro);
    } else {
      criarOrcamento(dados);
    }

    fecharModal();
    rerender();
  }

  /* ==========================================================
     13. VER DETALHES
     ========================================================== */

  function verDetalhes(id) {
    const o = buscarOrcamento(id);
    if (!o) return;

    const s = statusInfo(o.status);
    const t = calcularTotais(o);
    const editavel = podeEditar(o);
    const aprovado = o.status === 'aprovado';

    const html = `
      <div class="modal-overlay ativo" id="modal-detalhes-orc">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Orçamento ${escaparHTML(o.numero)}</h2>
            <button class="modal__fechar" onclick="MODULO_ORCAMENTOS.fecharDetalhes()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="orc-detalhe-grid">
              <div><strong>Cliente:</strong> ${escaparHTML(o.cliente)}</div>
              <div><strong>E-mail:</strong> ${escaparHTML(o.email || '—')}</div>
              <div><strong>WhatsApp:</strong> ${escaparHTML(o.whatsapp || '—')}</div>
              <div><strong>Status:</strong> <span class="badge badge--${s.cor}">${s.nome}</span></div>
              <div><strong>Validade:</strong> ${formatarData(o.validade)}</div>
              <div><strong>Prazo:</strong> ${escaparHTML(o.prazo || '—')}</div>
            </div>

            <div class="orc-secao">
              <h3 class="orc-secao__titulo">Itens</h3>
              <table class="tabela tabela-itens">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th class="tabela__numero">Qtd</th>
                    <th class="tabela__numero">Preço un.</th>
                    <th class="tabela__numero">Desc.</th>
                    <th class="tabela__numero">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(o.itens || []).map(i => {
                    const bruto = (Number(i.preco) || 0) * (Number(i.quantidade) || 0);
                    const total = bruto - (Number(i.desconto) || 0);
                    return `
                      <tr>
                        <td>
                          <div class="produto-nome">${escaparHTML(i.nome)}</div>
                          ${i.sku ? `<span class="sku">${escaparHTML(i.sku)}</span>` : ''}
                        </td>
                        <td class="tabela__numero">${i.quantidade}</td>
                        <td class="tabela__numero">${formatarMoeda(i.preco)}</td>
                        <td class="tabela__numero">${formatarMoeda(i.desconto)}</td>
                        <td class="tabela__numero peso-semibold">${formatarMoeda(total)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="orc-secao">
              <h3 class="orc-secao__titulo">Resumo</h3>
              <div class="calculo-detalhado">
                <div class="calculo-linha"><span>Subtotal</span><span>${formatarMoeda(t.subtotal)}</span></div>
                ${t.descontoTotal > 0 ? `<div class="calculo-linha"><span>Descontos</span><span class="text-atencao">− ${formatarMoeda(t.descontoTotal)}</span></div>` : ''}
                ${t.frete > 0 ? `<div class="calculo-linha"><span>Frete</span><span>+ ${formatarMoeda(t.frete)}</span></div>` : ''}
                <div class="calculo-linha calculo-linha--destaque"><span>Total</span><span>${formatarMoeda(t.total)}</span></div>
              </div>
            </div>

            ${o.observacoes ? `
              <div class="orc-secao">
                <h3 class="orc-secao__titulo">Observações</h3>
                <p>${escaparHTML(o.observacoes)}</p>
              </div>
            ` : ''}

            ${(o.comentarios || []).length > 0 ? `
              <div class="orc-secao">
                <h3 class="orc-secao__titulo">Comentários / Negociação</h3>
                <div class="orc-comentarios">
                  ${o.comentarios.map(c => `
                    <div class="orc-comentario">
                      <div class="orc-comentario__autor">${escaparHTML(c.autor || 'Cliente')}</div>
                      <div class="orc-comentario__texto">${escaparHTML(c.texto)}</div>
                      <div class="orc-comentario__data">${formatarData(c.data)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${o.pedidoNumero ? `
              <div class="alerta alerta--sucesso mt-4">
                <span class="alerta__icone">
                  <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                <div class="alerta__conteudo">
                  <div class="alerta__titulo">Virou pedido ${escaparHTML(o.pedidoNumero)}</div>
                  Este orçamento foi convertido e não pode mais ser editado.
                </div>
              </div>
            ` : ''}
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_ORCAMENTOS.fecharDetalhes()">Fechar</button>

            ${editavel ? `
              <button class="btn btn--secundario" onclick="MODULO_ORCAMENTOS.alterarStatus(${o.id}, 'enviado')">
                Marcar como enviado
              </button>
            ` : ''}

            ${editavel ? `
              <button class="btn btn--sucesso" onclick="MODULO_ORCAMENTOS.alterarStatus(${o.id}, 'aprovado')">
                Aprovar
              </button>
            ` : ''}

            ${aprovado ? `
              <button class="btn btn--primario" onclick="MODULO_ORCAMENTOS.converterEmPedido(${o.id})">
                Converter em pedido
              </button>
            ` : ''}

            <button class="btn btn--ghost" onclick="MODULO_ORCAMENTOS.gerarLink(${o.id})">
              Gerar link
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-detalhes-orc')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharDetalhes() {
    document.getElementById('modal-detalhes-orc')?.remove();
  }

  /* ==========================================================
     14. AÇÕES DE STATUS
     ========================================================== */

  function marcarEnviado(id)  { alterarStatus(id, 'enviado');  fecharDetalhes(); rerender(); }
  function marcarAprovado(id) { alterarStatus(id, 'aprovado'); fecharDetalhes(); rerender(); }

  /* ==========================================================
     15. CONVERTER EM PEDIDO
     ========================================================== */

  function converterEmPedido(id) {
    const o = buscarOrcamento(id);
    if (!o) return;

    if (o.status !== 'aprovado') {
      return alert('Só é possível converter orçamento com status "Aprovado".');
    }

    if (!window.MODULO_PEDIDOS) {
      return alert('Módulo de Pedidos não disponível.');
    }

    if (!confirm(`Converter o orçamento ${o.numero} em pedido?`)) return;

    try {
      const t = calcularTotais(o);

      const pedido = window.MODULO_PEDIDOS._criarDoOrcamento({
        cliente: o.cliente,
        clienteId: o.clienteId,
        whatsapp: o.whatsapp,
        email: o.email,
        documento: o.documento,
        itens: o.itens.map(i => ({
          produtoId: i.produtoId,
          nome: i.nome,
          sku: i.sku,
          quantidade: i.quantidade,
          preco: i.preco,
          desconto: i.desconto
        })),
        desconto: o.descontoGeral,
        frete: o.frete,
        prazo: o.prazo,
        formaPagamento: o.formaPagamento,
        formaEntrega: o.formaEntrega,
        observacoes: `Gerado do orçamento ${o.numero}`,
        personalizacao: { tema: '', cor: '', texto: '' },
        orcamentoId: o.id,
        orcamentoNumero: o.numero
      });

      o.status = 'virou_pedido';
      o.pedidoId = pedido.id;
      o.pedidoNumero = pedido.numero;
      o.historico.push({
        data: new Date().toISOString(),
        status: 'virou_pedido'
      });

      fecharDetalhes();

      alert(
        'Orçamento convertido em pedido!\n\n' +
        'Pedido: ' + pedido.numero + '\n' +
        'Cliente: ' + o.cliente + '\n' +
        'Total: ' + formatarMoeda(t.total)
      );

      setTimeout(() => window.ROUTER_PRAFICAR?.irPara('pedidos'), 300);

    } catch (e) {
      console.error(e);
      alert('Erro ao converter: ' + e.message);
    }
  }

  /* ==========================================================
     16. GERAR LINK PÚBLICO
     ========================================================== */

  function gerarLink(id) {
    const o = buscarOrcamento(id);
    if (!o) return;

    const url = `${window.location.origin}${window.location.pathname}#/orcamento-publico/${o.slug}`;

    navigator.clipboard.writeText(url).then(() => {
      alert(
        'Link gerado e copiado!\n\n' +
        url + '\n\n' +
        'Este link abre uma página onde o cliente pode:\n' +
        '• Ver os itens e valores\n' +
        '• Comentar / negociar\n' +
        '• Aprovar o orçamento'
      );
    }).catch(() => {
      prompt('Copie o link abaixo:', url);
    });
  }

  /* ==========================================================
     17. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'orcamentos') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-orcamentos-wrapper');
    if (wrapper) wrapper.innerHTML = renderTabela();
  }

  /* ==========================================================
     18. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovo,
    abrirEdicao,
    fecharModal,
    salvar,
    verDetalhes,
    fecharDetalhes,
    marcarEnviado,
    marcarAprovado,
    alterarStatus,
    converterEmPedido,
    gerarLink,
    abrirModalItem,
    fecharModalItem,
    preencherItem,
    adicionarItem,
    removerItem,
    atualizarResumo,
    alterarFiltroBusca,
    alterarFiltroStatus,
    _listar: () => [...orcamentos],
    _buscar: buscarOrcamento,
    _calcularTotais: calcularTotais,
    _podeEditar: podeEditar,
    STATUS
  };

})();

window.MODULO_ORCAMENTOS = MODULO_ORCAMENTOS;
window.renderOrcamentos = MODULO_ORCAMENTOS.render;
