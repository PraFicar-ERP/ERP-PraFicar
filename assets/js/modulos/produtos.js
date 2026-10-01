/* ============================================================
   PRAFICAR ERP — MÓDULO PRODUTOS (v8)
   Arquivo: assets/js/modulos/produtos.js
   Descrição: cadastro de produtos com:
              - Custo vindo do módulo Custos
              - Especificação / Tamanho
              - Preço por canal
              - Kit (composto)
              - Toggle ativo/inativo + ação em massa
   ============================================================ */

const MODULO_PRODUTOS = (() => {

  let produtos = [];
  let proximoId = 1;

  let filtroCategoria = '';
  let filtroBusca = '';
  let filtroStatus = '';
  let filtroCanal = '';
  let filtroMargem = '';
  let filtroTipo = '';

  let produtoEditandoId = null;
  let selecionados = new Set();
  let componentesTemporarios = [];
  let precosCanalTemporarios = {};

  const MARGEM_MINIMA_PADRAO = 30;

  /* ==========================================================
     CATEGORIAS / CANAIS
     ========================================================== */

  function categorias() {
    return window.SKU_PRAFICAR ? window.SKU_PRAFICAR.listarCategorias() : [];
  }

  function nomeCategoria(codigo) {
    const c = window.SKU_PRAFICAR?.buscarCategoria(codigo);
    return c ? c.nome : '—';
  }

  function canaisDisponiveis() {
    return (window.MODULO_CANAIS?._listar() || []).filter(c => c.status === 'ativo');
  }

  function buscarCanal(id) {
    return window.MODULO_CANAIS?._buscar(id) || null;
  }

  function nomeCanal(id) {
    const c = buscarCanal(id);
    return c ? c.nome : '—';
  }

  function produtosDisponiveisComoComponente(excluirId) {
    return produtos
      .filter(p => p.status === 'ativo' && p.tipo !== 'composto' && p.id !== excluirId)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  /* ==========================================================
     UTILITÁRIOS
     ========================================================== */

  function formatarMoeda(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarMoedaFina(v) {
    const n = Number(v) || 0;
    if (n === 0) return 'R$ 0,00';
    if (n < 0.01) return 'R$ ' + n.toFixed(4).replace('.', ',');
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarPercentual(v) {
    const n = Number(v) || 0;
    return n.toFixed(1).replace('.', ',') + '%';
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

  function arredondar2(v) {
    return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  }

  function nomeCompletoProduto(p) {
    if (!p) return '';
    const espec = p.especificacao ? ' (' + p.especificacao + ')' : '';
    return p.nome + espec;
  }

  /* ==========================================================
     CÁLCULOS
     ========================================================== */

  function calcularMargem(produto) {
    const custo = Number(produto.custo) || 0;
    const preco = Number(produto.precoVarejo) || 0;
    if (preco <= 0) return { margem: 0, lucro: 0 };
    const lucro = preco - custo;
    const margem = (lucro / preco) * 100;
    return { margem, lucro };
  }

  function margemAbaixoDoMinimo(produto) {
    const { margem } = calcularMargem(produto);
    const minima = Number(produto.margemMinima) || MARGEM_MINIMA_PADRAO;
    return margem < minima && Number(produto.precoVarejo) > 0;
  }

  function calcularMargemCanal(custo, preco, canal) {
    if (!canal || preco <= 0) {
      const lucro = preco - custo;
      return { margem: preco > 0 ? (lucro / preco) * 100 : 0, lucro };
    }
    const taxaPct = Number(canal.taxaPercentual) || 0;
    const taxaFixa = Number(canal.taxaFixa) || 0;
    const taxaCanalValor = preco * (taxaPct / 100);
    const lucro = preco - custo - taxaCanalValor - taxaFixa;
    const margem = preco > 0 ? (lucro / preco) * 100 : 0;
    return { margem, lucro, taxaCanalValor, taxaFixa };
  }

  function sugerirPrecoParaCanal(custo, canal, margemMinima) {
    if (!canal) return 0;
    const taxaPct = Number(canal.taxaPercentual) || 0;
    const taxaFixa = Number(canal.taxaFixa) || 0;
    const margem = Math.min(95, Math.max(0, margemMinima)) / 100;
    const divisor = 1 - margem - (taxaPct / 100);
    if (divisor <= 0.01) return 0;
    return arredondar2((custo + taxaFixa) / divisor);
  }

  function calcularCustoComponentes(componentes) {
    return componentes.reduce((acc, c) => {
      return acc + (Number(c.custoUnitario) || 0) * (Number(c.quantidade) || 0);
    }, 0);
  }

  function sincronizarComponentes(componentes) {
    return componentes.map(c => {
      const produto = buscarProduto(c.produtoId);
      return {
        produtoId: c.produtoId,
        nome: produto ? produto.nome : c.nome,
        especificacao: produto ? (produto.especificacao || '') : (c.especificacao || ''),
        sku: produto ? produto.sku : c.sku,
        quantidade: Number(c.quantidade) || 0,
        custoUnitario: produto ? Number(produto.custo) || 0 : Number(c.custoUnitario) || 0
      };
    });
  }

  /* ==========================================================
     CRUD
     ========================================================== */

  function criarProduto(dados) {
    const tipo = dados.tipo || 'simples';
    const componentes = tipo === 'composto'
      ? sincronizarComponentes(dados.componentes || [])
      : [];

    const custo = tipo === 'composto'
      ? calcularCustoComponentes(componentes)
      : Number(dados.custo) || 0;

    const p = {
      id: proximoId++,
      sku: dados.sku,
      nome: dados.nome,
      especificacao: dados.especificacao || '',
      categoria: dados.categoria,
      descricao: dados.descricao || '',
      tipo,
      componentes,
      custo,
      precoVarejo: Number(dados.precoVarejo) || 0,
      precoAtacado: Number(dados.precoAtacado) || 0,
      precosCanal: dados.precosCanal || {},
      margemMinima: Number(dados.margemMinima) || MARGEM_MINIMA_PADRAO,
      estoqueMinimo: Number(dados.estoqueMinimo) || 0,
      estoqueAtual: Number(dados.estoqueAtual) || 0,
      unidade: dados.unidade || 'un',
      canais: Array.isArray(dados.canais) ? dados.canais : [],
      status: dados.status || 'ativo',
      origemPreco: dados.origemPreco || 'manual',
      insumos: Array.isArray(dados.insumos) ? dados.insumos : [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    produtos.push(p);
    window.SKU_PRAFICAR?.registrarExistente(p.sku);
    return p;
  }

  function _criarDoCustos(dados) {
    if (!dados.nome) throw new Error('Nome obrigatório.');
    if (!dados.categoria) throw new Error('Categoria obrigatória.');

    const sku = window.SKU_PRAFICAR.gerarProximo(dados.categoria);

    return criarProduto({
      sku,
      nome: dados.nome,
      especificacao: dados.especificacao || '',
      categoria: dados.categoria,
      descricao: dados.descricao || '',
      tipo: 'simples',
      custo: dados.custo,
      precoVarejo: dados.precoVarejo || 0,
      precoAtacado: dados.precoAtacado || dados.precoVarejo || 0,
      precosCanal: dados.precosCanal || {},
      margemMinima: dados.margemMinima || MARGEM_MINIMA_PADRAO,
      estoqueMinimo: dados.estoqueMinimo || 5,
      estoqueAtual: 0,
      unidade: dados.unidade || 'un',
      canais: dados.canais || [],
      status: 'ativo',
      origemPreco: 'custos',
      insumos: dados.insumos || []
    });
  }

  function atualizarProduto(id, dados) {
    const idx = produtos.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const skuAntigo = produtos[idx].sku;
    const tipo = dados.tipo || produtos[idx].tipo || 'simples';
    const componentes = tipo === 'composto'
      ? sincronizarComponentes(dados.componentes || [])
      : [];

    const custo = tipo === 'composto'
      ? calcularCustoComponentes(componentes)
      : Number(dados.custo) || 0;

    produtos[idx] = {
      ...produtos[idx],
      ...dados,
      tipo,
      componentes,
      custo,
      precoVarejo: Number(dados.precoVarejo) || 0,
      precoAtacado: Number(dados.precoAtacado) || 0,
      precosCanal: dados.precosCanal || produtos[idx].precosCanal || {},
      margemMinima: Number(dados.margemMinima) || MARGEM_MINIMA_PADRAO,
      estoqueMinimo: Number(dados.estoqueMinimo) || 0,
      estoqueAtual: Number(dados.estoqueAtual) || 0,
      canais: Array.isArray(dados.canais) ? dados.canais : produtos[idx].canais,
      atualizadoEm: new Date().toISOString()
    };

    if (dados.sku && dados.sku !== skuAntigo) {
      window.SKU_PRAFICAR?.registrarExistente(dados.sku);
    }

    recalcularKitsQueUsam(id);
    return produtos[idx];
  }

  function recalcularKitsQueUsam(produtoId) {
    produtos.forEach(p => {
      if (p.tipo !== 'composto') return;
      const usa = (p.componentes || []).some(c => Number(c.produtoId) === Number(produtoId));
      if (!usa) return;
      p.componentes = sincronizarComponentes(p.componentes);
      p.custo = calcularCustoComponentes(p.componentes);
      p.atualizadoEm = new Date().toISOString();
    });
  }

  function excluirProduto(id) {
    const idx = produtos.findIndex(p => p.id === id);
    if (idx === -1) return false;
    produtos[idx].status = 'inativo';
    produtos[idx].atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarProduto(id) {
    return produtos.find(p => p.id === id) || null;
  }

  function alternarStatus(id) {
    const p = buscarProduto(id);
    if (!p) return;
    p.status = p.status === 'ativo' ? 'inativo' : 'ativo';
    p.atualizadoEm = new Date().toISOString();
    rerenderTabela();
  }

  /* ==========================================================
     SELEÇÃO EM MASSA
     ========================================================== */

  function alternarSelecao(id) {
    if (selecionados.has(id)) selecionados.delete(id);
    else selecionados.add(id);
    rerenderTabela();
    renderizarBarraAcoes();
  }

  function alternarTodos(marcar) {
    const lista = produtosFiltrados();
    if (marcar) lista.forEach(p => selecionados.add(p.id));
    else selecionados.clear();
    rerenderTabela();
    renderizarBarraAcoes();
  }

  function ativarSelecionados() {
    selecionados.forEach(id => {
      const p = buscarProduto(id);
      if (p) p.status = 'ativo';
    });
    selecionados.clear();
    rerender();
    renderizarBarraAcoes();
  }

  function desativarSelecionados() {
    selecionados.forEach(id => {
      const p = buscarProduto(id);
      if (p) p.status = 'inativo';
    });
    selecionados.clear();
    rerender();
    renderizarBarraAcoes();
  }

  function limparSelecao() {
    selecionados.clear();
    rerender();
    renderizarBarraAcoes();
  }

  function renderizarBarraAcoes() {
    let barra = document.getElementById('barra-acoes-massa');
    if (selecionados.size === 0) {
      if (barra) barra.remove();
      return;
    }
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'barra-acoes-massa';
      barra.className = 'barra-acoes-massa';
      document.body.appendChild(barra);
    }
    barra.innerHTML = `
      <span class="barra-acoes-massa__contador">
        ${selecionados.size} selecionado${selecionados.size > 1 ? 's' : ''}
      </span>
      <button class="btn btn--sucesso btn--sm" onclick="MODULO_PRODUTOS.ativarSelecionados()">Ativar</button>
      <button class="btn btn--secundario btn--sm" onclick="MODULO_PRODUTOS.desativarSelecionados()">Desativar</button>
      <button class="btn btn--ghost btn--sm" onclick="MODULO_PRODUTOS.limparSelecao()">Cancelar</button>
    `;
  }

  /* ==========================================================
     FILTROS
     ========================================================== */

  function produtosFiltrados() {
    const lista = produtos.filter(p => {
      if (filtroCategoria && p.categoria !== filtroCategoria) return false;
      if (filtroStatus && p.status !== filtroStatus) return false;
      if (filtroCanal && !(p.canais || []).map(String).includes(String(filtroCanal))) return false;
      if (filtroTipo && p.tipo !== filtroTipo) return false;
      if (filtroMargem === 'abaixo' && !margemAbaixoDoMinimo(p)) return false;
      if (filtroMargem === 'ok' && margemAbaixoDoMinimo(p)) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${p.sku} ${p.nome} ${p.especificacao} ${p.descricao}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function alterarFiltroCategoria(v) { filtroCategoria = v; rerender(); }
  function alterarFiltroBusca(v)     { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroStatus(v)    { filtroStatus = v; rerender(); }
  function alterarFiltroCanal(v)     { filtroCanal = v; rerender(); }
  function alterarFiltroMargem(v)    { filtroMargem = v; rerender(); }
  function alterarFiltroTipo(v)      { filtroTipo = v; rerender(); }

  /* ==========================================================
     RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const abaixoDoMinimo = produtos.filter(p => p.status === 'ativo' && margemAbaixoDoMinimo(p)).length;
    const totalKits = produtos.filter(p => p.tipo === 'composto' && p.status === 'ativo').length;

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Produtos & Estoque</h1>
          <p class="pagina-header__subtitulo">
            ${produtos.length} ${produtos.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
            ${totalKits > 0 ? ` · ${totalKits} ${totalKits === 1 ? 'kit' : 'kits'}` : ''}
            ${abaixoDoMinimo > 0 ? ` · <span class="text-atencao">${abaixoDoMinimo} com margem abaixo do mínimo</span>` : ''}
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario" onclick="MODULO_PRODUTOS.abrirNovo()">
            + Novo produto
          </button>
        </div>
      </div>

      <div class="filtros-produtos">
        <div class="filtros-produtos__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="search" placeholder="Buscar por SKU, nome, tamanho ou descrição..." value="${escaparHTML(filtroBusca)}" oninput="MODULO_PRODUTOS.alterarFiltroBusca(this.value)" />
        </div>

        <select class="filtros-produtos__select" onchange="MODULO_PRODUTOS.alterarFiltroTipo(this.value)">
          <option value="">Todos os tipos</option>
          <option value="simples"  ${filtroTipo === 'simples'  ? 'selected' : ''}>Simples</option>
          <option value="composto" ${filtroTipo === 'composto' ? 'selected' : ''}>Kit</option>
        </select>

        <select class="filtros-produtos__select" onchange="MODULO_PRODUTOS.alterarFiltroCategoria(this.value)">
          <option value="">Todas as categorias</option>
          ${categorias().map(c => `
            <option value="${c.codigo}" ${filtroCategoria === c.codigo ? 'selected' : ''}>${c.nome}</option>
          `).join('')}
        </select>

        <select class="filtros-produtos__select" onchange="MODULO_PRODUTOS.alterarFiltroCanal(this.value)">
          <option value="">Todos os canais</option>
          ${canaisDisponiveis().map(c => `
            <option value="${c.id}" ${String(filtroCanal) === String(c.id) ? 'selected' : ''}>${escaparHTML(c.nome)}</option>
          `).join('')}
        </select>

        <select class="filtros-produtos__select" onchange="MODULO_PRODUTOS.alterarFiltroMargem(this.value)">
          <option value="">Todas as margens</option>
          <option value="abaixo" ${filtroMargem === 'abaixo' ? 'selected' : ''}>⚠️ Margem abaixo</option>
          <option value="ok"     ${filtroMargem === 'ok'     ? 'selected' : ''}>✅ Margem ok</option>
        </select>

        <select class="filtros-produtos__select" onchange="MODULO_PRODUTOS.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          <option value="ativo"   ${filtroStatus === 'ativo'   ? 'selected' : ''}>Ativos</option>
          <option value="inativo" ${filtroStatus === 'inativo' ? 'selected' : ''}>Inativos</option>
        </select>
      </div>

      <div id="tabela-produtos-wrapper">
        ${renderTabela()}
      </div>
    `;
  }

  function renderTabela() {
    const lista = produtosFiltrados();

    if (lista.length === 0) {
      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${produtos.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${produtos.length === 0
                ? 'Cadastre um produto direto aqui ou use "Enviar para Produtos" no módulo Custos.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
            ${produtos.length === 0 ? `
              <button class="btn btn--primario" onclick="MODULO_PRODUTOS.abrirNovo()">
                + Novo produto
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
                <th style="width: 40px;">
                  <input type="checkbox" onchange="MODULO_PRODUTOS.alternarTodos(this.checked)" />
                </th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th class="tabela__numero">Estoque</th>
                <th class="tabela__numero">Custo</th>
                <th class="tabela__numero">Varejo</th>
                <th class="tabela__numero">Margem</th>
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
    const baixo = p.estoqueAtual > 0 && p.estoqueAtual <= p.estoqueMinimo;
    const critico = p.estoqueAtual === 0;
    const classeEstoque = critico
      ? 'text-critico peso-semibold'
      : baixo
        ? 'text-atencao peso-semibold'
        : '';

    const { margem } = calcularMargem(p);
    const minima = Number(p.margemMinima) || MARGEM_MINIMA_PADRAO;
    const margemOk = margem >= minima;
    const isKit = p.tipo === 'composto';
    const temPrecoCanal = p.precosCanal && Object.keys(p.precosCanal).length > 0;

    return `
      <tr>
        <td>
          <input type="checkbox" ${selecionados.has(p.id) ? 'checked' : ''} onchange="MODULO_PRODUTOS.alternarSelecao(${p.id})" />
        </td>
        <td><span class="sku">${escaparHTML(p.sku)}</span></td>
        <td>
          <div class="produto-nome">
            ${escaparHTML(p.nome)}
            ${isKit ? '<span class="badge badge--info">Kit</span>' : ''}
            ${temPrecoCanal ? '<span class="badge badge--sucesso">Preço por canal</span>' : ''}
          </div>
          ${p.especificacao ? `<div class="produto-espec">${escaparHTML(p.especificacao)}</div>` : ''}
          ${p.descricao ? `<div class="produto-desc">${escaparHTML(p.descricao)}</div>` : ''}
          ${isKit && p.componentes?.length ? `
            <div class="produto-kit-info">${p.componentes.length} ${p.componentes.length === 1 ? 'componente' : 'componentes'}</div>
          ` : ''}
        </td>
        <td>${escaparHTML(nomeCategoria(p.categoria))}</td>
        <td class="tabela__numero ${classeEstoque}">
          ${p.estoqueAtual} ${escaparHTML(p.unidade)}
        </td>
        <td class="tabela__numero">${formatarMoedaFina(p.custo)}</td>
        <td class="tabela__numero">${formatarMoeda(p.precoVarejo)}</td>
        <td class="tabela__numero ${margemOk ? 'text-sucesso' : 'text-critico peso-semibold'}">
          ${formatarPercentual(margem)}
          <div class="produto-margem-min">mín: ${formatarPercentual(minima)}</div>
        </td>
        <td>
          <label class="toggle-ativo">
            <input type="checkbox" ${p.status === 'ativo' ? 'checked' : ''} onchange="MODULO_PRODUTOS.alternarStatus(${p.id})" />
            <span class="toggle-ativo__slider"></span>
            <span class="toggle-ativo__label">
              ${p.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </span>
          </label>
        </td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Editar" onclick="MODULO_PRODUTOS.abrirEdicao(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icone btn-icone--perigo" title="Desativar" onclick="MODULO_PRODUTOS.confirmarExclusao(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }
     /* ==========================================================
     MODAL DE PRODUTO
     ========================================================== */

  function abrirNovo() {
    produtoEditandoId = null;
    componentesTemporarios = [];
    precosCanalTemporarios = {};
    abrirModal();
  }

  function abrirEdicao(id) {
    produtoEditandoId = id;
    const p = buscarProduto(id);
    componentesTemporarios = p && p.tipo === 'composto'
      ? JSON.parse(JSON.stringify(p.componentes || []))
      : [];
    precosCanalTemporarios = p && p.precosCanal
      ? { ...p.precosCanal }
      : {};
    abrirModal();
  }

  function abrirModal() {
    const p = produtoEditandoId ? buscarProduto(produtoEditandoId) : null;
    const editando = !!p;
    const canaisAtivos = p ? (p.canais || []) : [];
    const margemMinima = p ? (Number(p.margemMinima) || MARGEM_MINIMA_PADRAO) : MARGEM_MINIMA_PADRAO;
    const tipo = p?.tipo || 'simples';

    const custoAtual = tipo === 'composto'
      ? calcularCustoComponentes(componentesTemporarios)
      : Number(p?.custo || 0);

    const html = `
      <div class="modal-overlay ativo" id="modal-produto">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar produto' : 'Novo produto'}</h2>
            <button class="modal__fechar" onclick="MODULO_PRODUTOS.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <form id="form-produto" onsubmit="MODULO_PRODUTOS.salvar(event)">

              <div class="prod-tipo-selector">
                <label class="prod-tipo-opcao">
                  <input type="radio" name="prod-tipo" value="simples" ${tipo === 'simples' ? 'checked' : ''} onchange="MODULO_PRODUTOS.aoMudarTipo()" />
                  <div class="prod-tipo-opcao__box">
                    <div class="prod-tipo-opcao__titulo">Produto Simples</div>
                    <div class="prod-tipo-opcao__desc">Custo vindo do módulo Custos</div>
                  </div>
                </label>
                <label class="prod-tipo-opcao">
                  <input type="radio" name="prod-tipo" value="composto" ${tipo === 'composto' ? 'checked' : ''} onchange="MODULO_PRODUTOS.aoMudarTipo()" />
                  <div class="prod-tipo-opcao__box">
                    <div class="prod-tipo-opcao__titulo">Kit (composto)</div>
                    <div class="prod-tipo-opcao__desc">Custo = soma dos componentes</div>
                  </div>
                </label>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="prod-categoria">Categoria <span class="form-obrigatorio">*</span></label>
                  <select id="prod-categoria" required onchange="MODULO_PRODUTOS.gerarSkuAutomatico(this.value)">
                    <option value="">Selecione uma categoria</option>
                    ${categorias().map(c => `
                      <option value="${c.codigo}" ${p && p.categoria === c.codigo ? 'selected' : ''}>${c.nome}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-grupo">
                  <label for="prod-sku">SKU <span class="form-obrigatorio">*</span></label>
                  <div class="sku-campo">
                    <input id="prod-sku" type="text" required value="${escaparHTML(p?.sku || '')}" readonly />
                    <button type="button" class="sku-campo__regenerar" title="Regenerar" onclick="MODULO_PRODUTOS.regenerarSku()">
                      <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-grupo">
                <label for="prod-nome">Nome <span class="form-obrigatorio">*</span></label>
                <input id="prod-nome" type="text" required value="${escaparHTML(p?.nome || '')}" placeholder="Ex: Marca-página Imantada" />
              </div>

              <div class="form-grupo">
                <label for="prod-especificacao">Especificação / Tamanho</label>
                <input id="prod-especificacao" type="text" value="${escaparHTML(p?.especificacao || '')}" placeholder="Ex: 4,10 × 6,60 cm" />
                <span class="form-ajuda">Ajuda a diferenciar quando o mesmo item tem tamanhos diferentes.</span>
              </div>

              <div class="form-grupo">
                <label for="prod-descricao">Descrição</label>
                <textarea id="prod-descricao" placeholder="Detalhes do produto (opcional)">${escaparHTML(p?.descricao || '')}</textarea>
              </div>

              <div id="prod-bloco-simples" style="${tipo === 'simples' ? '' : 'display:none;'}">
                <div class="form-linha-2">
                  <div class="form-grupo">
                    <label for="prod-custo">Custo real (R$)</label>
                    <input id="prod-custo" type="number" step="0.01" min="0" value="${p?.custo ?? ''}" placeholder="0,00" oninput="MODULO_PRODUTOS.atualizarPreviewMargem(); MODULO_PRODUTOS.atualizarPrecosCanal();" />
                    <span class="form-ajuda">Vem do módulo Custos.</span>
                  </div>
                  <div class="form-grupo">
                    <label for="prod-margem-minima">Margem mínima (%)</label>
                    <input id="prod-margem-minima" type="number" step="1" min="0" max="95" value="${margemMinima}" oninput="MODULO_PRODUTOS.atualizarPreviewMargem(); MODULO_PRODUTOS.atualizarPrecosCanal();" />
                    <span class="form-ajuda">Abaixo disso, o sistema avisa.</span>
                  </div>
                </div>
              </div>

              <div id="prod-bloco-composto" style="${tipo === 'composto' ? '' : 'display:none;'}">
                <div class="prod-kit-secao">
                  <div class="prod-kit-secao__header">
                    <h3 class="prod-kit-secao__titulo">Componentes do Kit</h3>
                    <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_PRODUTOS.abrirModalComponente()">
                      + Adicionar componente
                    </button>
                  </div>
                  <div id="prod-kit-lista">
                    ${renderListaComponentes()}
                  </div>
                </div>
              </div>

              <div class="prod-precos-secao">
                <div class="prod-precos-secao__header">
                  <div>
                    <h3 class="prod-precos-secao__titulo">Preços de venda</h3>
                    <p class="prod-precos-secao__desc">
                      Preço base + preço por canal. Preço por canal é obrigatório nos canais selecionados.
                    </p>
                  </div>
                </div>

                <div class="form-linha-2">
                  <div class="form-grupo">
                    <label for="prod-preco-varejo">Preço base varejo (R$)</label>
                    <input id="prod-preco-varejo" type="number" step="0.01" min="0" value="${p?.precoVarejo ?? ''}" placeholder="0,00" oninput="MODULO_PRODUTOS.atualizarPreviewMargem()" />
                  </div>
                  <div class="form-grupo">
                    <label for="prod-preco-atacado">Preço base atacado (R$)</label>
                    <input id="prod-preco-atacado" type="number" step="0.01" min="0" value="${p?.precoAtacado ?? ''}" placeholder="0,00" />
                  </div>
                </div>

                <div class="prod-margem-bloco">
                  <div class="prod-margem-preview" id="prod-margem-preview">
                    ${renderPreviewMargem(custoAtual, p?.precoVarejo || 0, margemMinima)}
                  </div>
                </div>

                <div class="prod-canal-secao">
                  <div class="prod-canal-secao__header">
                    <div>
                      <h4 class="prod-canal-secao__titulo">Preços por canal</h4>
                      <p class="prod-canal-secao__desc">
                        Defina o preço específico para cada canal selecionado.
                      </p>
                    </div>
                    <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_PRODUTOS.sugerirPrecosCanal()">
                      Sugerir preços
                    </button>
                  </div>
                  <div id="prod-canal-lista">
                    ${renderListaPrecosCanal(custoAtual, margemMinima, canaisAtivos)}
                  </div>
                </div>
              </div>

              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="prod-estoque">Estoque atual</label>
                  <input id="prod-estoque" type="number" step="1" min="0" value="${p?.estoqueAtual ?? 0}" readonly />
                  <span class="form-ajuda">Sobe ao registrar fabricação.</span>
                </div>
                <div class="form-grupo">
                  <label for="prod-estoque-min">Estoque mínimo</label>
                  <input id="prod-estoque-min" type="number" step="1" min="0" value="${p?.estoqueMinimo ?? 0}" />
                </div>
                <div class="form-grupo">
                  <label for="prod-unidade">Unidade</label>
                  <select id="prod-unidade">
                    ${['un', 'kit', 'cx', 'pct', 'folha'].map(u => `
                      <option value="${u}" ${(p?.unidade || 'un') === u ? 'selected' : ''}>${u}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-grupo">
                <label>Canais de venda</label>
                ${canaisDisponiveis().length === 0 ? `
                  <div class="alerta alerta--info">
                    <span class="alerta__icone">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </span>
                    <div class="alerta__conteudo">Nenhum canal cadastrado ainda.</div>
                  </div>
                ` : `
                  <div class="prod-canais-grid">
                    ${canaisDisponiveis().map(c => `
                      <label class="cfg-check">
                        <input type="checkbox" value="${c.id}" ${canaisAtivos.map(String).includes(String(c.id)) ? 'checked' : ''} data-canal onchange="MODULO_PRODUTOS.aoMudarCanais()" />
                        <span>${escaparHTML(c.nome)}</span>
                      </label>
                    `).join('')}
                  </div>
                `}
              </div>

              <div class="form-grupo">
                <label for="prod-status">Status</label>
                <select id="prod-status">
                  <option value="ativo"   ${(p?.status || 'ativo') === 'ativo' ? 'selected' : ''}>Ativo</option>
                  <option value="inativo" ${p?.status === 'inativo' ? 'selected' : ''}>Inativo</option>
                </select>
              </div>

            </form>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PRODUTOS.fecharModal()">Cancelar</button>
            <button class="btn btn--primario" onclick="document.getElementById('form-produto').requestSubmit()">
              ${editando ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-produto')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
      const foco = document.getElementById('prod-categoria');
      if (foco && !foco.value) foco.focus();
      else document.getElementById('prod-nome')?.focus();
    }, 50);
  }

  function aoMudarTipo() {
    const tipo = document.querySelector('input[name="prod-tipo"]:checked')?.value || 'simples';
    document.getElementById('prod-bloco-simples').style.display = tipo === 'simples' ? '' : 'none';
    document.getElementById('prod-bloco-composto').style.display = tipo === 'composto' ? '' : 'none';
    atualizarPreviewMargem();
    atualizarPrecosCanal();
  }

  function aoMudarCanais() {
    atualizarPrecosCanal();
  }

  /* ==========================================================
     PREÇOS POR CANAL
     ========================================================== */

  function obterCustoAtual() {
    const tipo = document.querySelector('input[name="prod-tipo"]:checked')?.value || 'simples';
    if (tipo === 'simples') {
      return Number(document.getElementById('prod-custo')?.value) || 0;
    }
    return calcularCustoComponentes(componentesTemporarios);
  }

  function obterPrecoBase() {
    return Number(document.getElementById('prod-preco-varejo')?.value) || 0;
  }

  function obterCanaisSelecionados() {
    return Array.from(document.querySelectorAll('input[data-canal]:checked'))
      .map(i => Number(i.value));
  }

  function renderListaPrecosCanal(custo, margemMinima, canaisAtivos) {
    const canais = canaisDisponiveis();
    const selecionados = canaisAtivos && canaisAtivos.length
      ? canaisAtivos
      : obterCanaisSelecionados();

    if (canais.length === 0) {
      return `<div class="prod-canal-vazio">Cadastre canais primeiro.</div>`;
    }

    if (selecionados.length === 0) {
      return `<div class="prod-canal-vazio">Selecione pelo menos um canal abaixo para definir preços.</div>`;
    }

    const canaisFiltrados = canais.filter(c => selecionados.map(String).includes(String(c.id)));

    return `
      <table class="tabela tabela-canais">
        <thead>
          <tr>
            <th>Canal</th>
            <th class="tabela__numero">Taxa</th>
            <th class="tabela__numero">Preço mínimo</th>
            <th class="tabela__numero">Meu preço</th>
            <th class="tabela__numero">Margem</th>
          </tr>
        </thead>
        <tbody>
          ${canaisFiltrados.map(c => {
            const precoMinimo = sugerirPrecoParaCanal(custo, c, margemMinima);
            const precoAtual = precosCanalTemporarios[c.id] !== undefined && precosCanalTemporarios[c.id] !== ''
              ? Number(precosCanalTemporarios[c.id])
              : 0;

            const { margem } = precoAtual > 0
              ? calcularMargemCanal(custo, precoAtual, c)
              : { margem: 0 };

            const margemOk = precoAtual > 0 && margem >= margemMinima;
            const abaixoMinimo = precoAtual > 0 && precoAtual < precoMinimo - 0.01;

            return `
              <tr>
                <td>
                  <div class="produto-nome">${escaparHTML(c.nome)}</div>
                  <div class="produto-desc">${c.taxaPercentual}% + ${formatarMoeda(c.taxaFixa)}</div>
                </td>
                <td class="tabela__numero text-secundario">${formatarMoeda(precoMinimo)}</td>
                <td class="tabela__numero">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    class="input-canal"
                    value="${precosCanalTemporarios[c.id] ?? ''}"
                    placeholder="0,00"
                    oninput="MODULO_PRODUTOS.atualizarPrecoCanal(${c.id}, this.value)"
                  />
                </td>
                <td class="tabela__numero ${precoAtual === 0 ? 'text-secundario' : margemOk ? 'text-sucesso' : 'text-critico peso-semibold'}">
                  ${precoAtual === 0 ? '—' : formatarPercentual(margem)}
                  ${abaixoMinimo ? '<div class="prod-canal-aviso">Abaixo do mínimo</div>' : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function atualizarPrecoCanal(canalId, valor) {
    if (valor === '' || valor === null) {
      delete precosCanalTemporarios[canalId];
    } else {
      precosCanalTemporarios[canalId] = Number(valor) || 0;
    }
    atualizarPrecosCanal();
  }

  function atualizarPrecosCanal() {
    const container = document.getElementById('prod-canal-lista');
    if (!container) return;
    const custo = obterCustoAtual();
    const minima = Number(document.getElementById('prod-margem-minima')?.value) || MARGEM_MINIMA_PADRAO;
    container.innerHTML = renderListaPrecosCanal(custo, minima, obterCanaisSelecionados());
  }

  function sugerirPrecosCanal() {
    const custo = obterCustoAtual();
    const minima = Number(document.getElementById('prod-margem-minima')?.value) || MARGEM_MINIMA_PADRAO;
    if (custo <= 0) {
      alert('Informe o custo do produto primeiro.');
      return;
    }
    const canais = obterCanaisSelecionados();
    if (canais.length === 0) {
      alert('Selecione pelo menos um canal.');
      return;
    }
    canais.forEach(canalId => {
      const canal = buscarCanal(canalId);
      if (!canal) return;
      const precoMin = sugerirPrecoParaCanal(custo, canal, minima);
      if (precoMin > 0) precosCanalTemporarios[canalId] = precoMin;
    });
    atualizarPrecosCanal();
  }

  /* ==========================================================
     COMPONENTES DO KIT
     ========================================================== */

  function renderListaComponentes() {
    if (componentesTemporarios.length === 0) {
      return `
        <div class="prod-kit-vazio">
          <p>Nenhum componente adicionado ainda.</p>
          <button type="button" class="btn btn--secundario btn--sm" onclick="MODULO_PRODUTOS.abrirModalComponente()">
            + Adicionar o primeiro componente
          </button>
        </div>
      `;
    }
    const total = calcularCustoComponentes(componentesTemporarios);
    return `
      <table class="tabela tabela-componentes">
        <thead>
          <tr>
            <th>Componente</th>
            <th class="tabela__numero">Qtd</th>
            <th class="tabela__numero">Custo un.</th>
            <th class="tabela__numero">Subtotal</th>
            <th class="tabela__acao"></th>
          </tr>
        </thead>
        <tbody>
          ${componentesTemporarios.map((c, idx) => `
            <tr>
              <td>
                <div class="produto-nome">${escaparHTML(c.nome)}</div>
                ${c.especificacao ? `<div class="produto-espec">${escaparHTML(c.especificacao)}</div>` : ''}
                ${c.sku ? `<span class="sku">${escaparHTML(c.sku)}</span>` : ''}
              </td>
              <td class="tabela__numero">${c.quantidade}</td>
              <td class="tabela__numero">${formatarMoedaFina(c.custoUnitario)}</td>
              <td class="tabela__numero peso-semibold">${formatarMoeda((Number(c.custoUnitario) || 0) * (Number(c.quantidade) || 0))}</td>
              <td class="tabela__acao">
                <button type="button" class="btn-icone btn-icone--perigo" title="Remover" onclick="MODULO_PRODUTOS.removerComponente(${idx})">
                  <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="text-right peso-semibold">Custo total do kit</td>
            <td class="tabela__numero peso-bold text-principal">${formatarMoeda(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  function atualizarListaComponentes() {
    const container = document.getElementById('prod-kit-lista');
    if (container) container.innerHTML = renderListaComponentes();
  }

  function abrirModalComponente() {
    const disponiveis = produtosDisponiveisComoComponente(produtoEditandoId);
    if (disponiveis.length === 0) {
      alert('Nenhum produto simples disponível para adicionar como componente.');
      return;
    }
    const html = `
      <div class="modal-overlay ativo" id="modal-componente" style="z-index: 700">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Adicionar componente</h2>
            <button class="modal__fechar" onclick="MODULO_PRODUTOS.fecharModalComponente()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal__body">
            <div class="form-grupo">
              <label for="comp-produto">Componente <span class="form-obrigatorio">*</span></label>
              <select id="comp-produto">
                <option value="">Selecione um produto</option>
                ${disponiveis.map(p => `
                  <option
                    value="${p.id}"
                    data-nome="${escaparHTML(p.nome)}"
                    data-especificacao="${escaparHTML(p.especificacao || '')}"
                    data-sku="${escaparHTML(p.sku)}"
                    data-custo="${p.custo}"
                    data-estoque="${p.estoqueAtual}"
                  >
                    ${escaparHTML(p.sku)} — ${escaparHTML(p.nome)}${p.especificacao ? ' (' + escaparHTML(p.especificacao) + ')' : ''} · ${formatarMoedaFina(p.custo)} · ${p.estoqueAtual} un
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-grupo">
              <label for="comp-qtd">Quantidade</label>
              <input id="comp-qtd" type="number" min="1" step="1" value="1" />
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PRODUTOS.fecharModalComponente()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_PRODUTOS.adicionarComponente()">Adicionar</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-componente')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('comp-produto')?.focus(), 50);
  }

  function fecharModalComponente() {
    document.getElementById('modal-componente')?.remove();
  }

  function adicionarComponente() {
    const sel = document.getElementById('comp-produto');
    const opt = sel && sel.value ? sel.options[sel.selectedIndex] : null;
    const quantidade = Number(document.getElementById('comp-qtd').value) || 0;
    if (!sel || !sel.value) return alert('Selecione um produto.');
    if (quantidade <= 0) return alert('Informe a quantidade.');

    const produtoId = Number(sel.value);
    const nome = opt.dataset.nome;
    const especificacao = opt.dataset.especificacao;
    const sku = opt.dataset.sku;
    const custoUnitario = Number(opt.dataset.custo || 0);

    const existente = componentesTemporarios.find(c => Number(c.produtoId) === produtoId);
    if (existente) existente.quantidade += quantidade;
    else componentesTemporarios.push({ produtoId, nome, especificacao, sku, quantidade, custoUnitario });

    atualizarListaComponentes();
    atualizarPreviewMargem();
    atualizarPrecosCanal();
    fecharModalComponente();
  }

  function removerComponente(idx) {
    componentesTemporarios.splice(idx, 1);
    atualizarListaComponentes();
    atualizarPreviewMargem();
    atualizarPrecosCanal();
  }

  /* ==========================================================
     PREVIEW DE MARGEM
     ========================================================== */

  function renderPreviewMargem(custo, preco, minima) {
    const c = Number(custo) || 0;
    const p = Number(preco) || 0;
    const m = Number(minima) || MARGEM_MINIMA_PADRAO;
    if (p <= 0) {
      return `<div class="prod-margem-preview__vazio">Informe custo e preço para ver a margem.</div>`;
    }
    const lucro = p - c;
    const margem = (lucro / p) * 100;
    const ok = margem >= m;
    return `
      <div class="prod-margem-preview__linha"><span>Custo</span><strong>${formatarMoedaFina(c)}</strong></div>
      <div class="prod-margem-preview__linha"><span>Preço base</span><strong>${formatarMoeda(p)}</strong></div>
      <div class="prod-margem-preview__linha"><span>Lucro</span><strong class="${lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(lucro)}</strong></div>
      <div class="prod-margem-preview__linha prod-margem-preview__linha--destaque">
        <span>Margem</span>
        <strong class="${ok ? 'text-sucesso' : 'text-critico'}">${formatarPercentual(margem)}</strong>
      </div>
      ${!ok ? `<div class="prod-margem-aviso">⚠️ Margem abaixo do mínimo de ${formatarPercentual(m)}.</div>` : ''}
    `;
  }

  function atualizarPreviewMargem() {
    const custo = obterCustoAtual();
    const preco = obterPrecoBase();
    const minima = Number(document.getElementById('prod-margem-minima')?.value) || MARGEM_MINIMA_PADRAO;
    const el = document.getElementById('prod-margem-preview');
    if (el) el.innerHTML = renderPreviewMargem(custo, preco, minima);
  }

  /* ==========================================================
     SKU
     ========================================================== */

  function gerarSkuAutomatico(codigoCategoria) {
    const input = document.getElementById('prod-sku');
    if (!input) return;
    if (!codigoCategoria) { input.value = ''; return; }
    if (produtoEditandoId) {
      const p = buscarProduto(produtoEditandoId);
      if (p && p.categoria === codigoCategoria) {
        input.value = p.sku;
        return;
      }
    }
    try {
      input.value = window.SKU_PRAFICAR.gerarProximo(codigoCategoria);
    } catch (e) {
      console.error(e);
      input.value = '';
    }
  }

  function regenerarSku() {
    const categoria = document.getElementById('prod-categoria')?.value;
    if (!categoria) return alert('Selecione uma categoria primeiro.');
    try {
      document.getElementById('prod-sku').value = window.SKU_PRAFICAR.gerarProximo(categoria);
    } catch (e) {
      console.error(e);
    }
  }

  /* ==========================================================
     SALVAR
     ========================================================== */

  function salvar(event) {
    event.preventDefault();

    const tipo = document.querySelector('input[name="prod-tipo"]:checked')?.value || 'simples';
    const canaisSelecionados = obterCanaisSelecionados();

    let custo = 0;
    let componentes = [];

    if (tipo === 'simples') {
      custo = Number(document.getElementById('prod-custo').value) || 0;
    } else {
      if (componentesTemporarios.length === 0) {
        return alert('Adicione pelo menos um componente ao kit.');
      }
      componentes = sincronizarComponentes(componentesTemporarios);
      custo = calcularCustoComponentes(componentes);
    }

    const precoVarejo = Number(document.getElementById('prod-preco-varejo').value) || 0;
    const precoAtacado = Number(document.getElementById('prod-preco-atacado').value) || 0;

    const precosCanal = {};
    canaisSelecionados.forEach(canalId => {
      const valor = Number(precosCanalTemporarios[canalId]) || 0;
      if (valor > 0) precosCanal[canalId] = valor;
    });

    const dados = {
      tipo,
      componentes,
      precosCanal,
      categoria:     document.getElementById('prod-categoria').value,
      sku:           document.getElementById('prod-sku').value.trim(),
      nome:          document.getElementById('prod-nome').value.trim(),
      especificacao: document.getElementById('prod-especificacao').value.trim(),
      descricao:     document.getElementById('prod-descricao').value.trim(),
      custo,
      precoVarejo,
      precoAtacado,
      margemMinima:  Number(document.getElementById('prod-margem-minima').value) || MARGEM_MINIMA_PADRAO,
      estoqueAtual:  Number(document.getElementById('prod-estoque').value) || 0,
      estoqueMinimo: document.getElementById('prod-estoque-min').value,
      unidade:       document.getElementById('prod-unidade').value,
      canais:        canaisSelecionados,
      status:        document.getElementById('prod-status').value
    };

    if (!dados.categoria) return alert('Selecione uma categoria.');
    if (!dados.sku) return alert('SKU inválido.');
    if (!window.SKU_PRAFICAR.validar(dados.sku)) return alert('SKU fora do padrão PraFicar.');
    if (!dados.nome) return alert('Informe o nome do produto.');

    const duplicado = produtos.find(p => p.sku === dados.sku && p.id !== produtoEditandoId);
    if (duplicado) return alert(`O SKU ${dados.sku} já está em uso por "${duplicado.nome}".`);

    // Validar preço por canal
    const canaisSemPreco = canaisSelecionados.filter(id => !precosCanal[id]);
    if (canaisSemPreco.length > 0) {
      const nomes = canaisSemPreco.map(id => nomeCanal(id)).join(', ');
      return alert(`Defina o preço para todos os canais selecionados.\n\nFaltam: ${nomes}`);
    }

    if (produtoEditandoId) atualizarProduto(produtoEditandoId, dados);
    else criarProduto(dados);

    fecharModal();
    rerender();
  }

  function fecharModal() {
    document.getElementById('modal-produto')?.remove();
    produtoEditandoId = null;
    componentesTemporarios = [];
    precosCanalTemporarios = {};
  }

  function confirmarExclusao(id) {
    const p = buscarProduto(id);
    if (!p) return;
    const ok = confirm(`Desativar o produto "${nomeCompletoProduto(p)}"?`);
    if (!ok) return;
    excluirProduto(id);
    rerender();
  }

  /* ==========================================================
     RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'produtos') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-produtos-wrapper');
    if (wrapper) wrapper.innerHTML = renderTabela();
  }

  /* ==========================================================
     API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovo,
    abrirEdicao,
    fecharModal,
    aoMudarTipo,
    aoMudarCanais,
    abrirModalComponente,
    fecharModalComponente,
    adicionarComponente,
    removerComponente,
    atualizarPrecoCanal,
    atualizarPrecosCanal,
    sugerirPrecosCanal,
    salvar,
    confirmarExclusao,
    gerarSkuAutomatico,
    regenerarSku,
    atualizarPreviewMargem,
    alterarFiltroCategoria,
    alterarFiltroBusca,
    alterarFiltroStatus,
    alterarFiltroCanal,
    alterarFiltroMargem,
    alterarFiltroTipo,
    alternarStatus,
    alternarSelecao,
    alternarTodos,
    ativarSelecionados,
    desativarSelecionados,
    limparSelecao,
    _listar: () => [...produtos],
    _buscar: buscarProduto,
    _criarDoCustos: _criarDoCustos,
    _calcularMargem: calcularMargem,
    _margemAbaixoDoMinimo: margemAbaixoDoMinimo,
    _calcularMargemCanal: calcularMargemCanal,
    _sugerirPrecoParaCanal: sugerirPrecoParaCanal,
    MARGEM_MINIMA_PADRAO
  };

})();

window.MODULO_PRODUTOS = MODULO_PRODUTOS;
window.renderProdutos = MODULO_PRODUTOS.render;
