/* ============================================================
   PRAFICAR ERP — MÓDULO PRODUTOS & ESTOQUE (v3 com toggle)
   Arquivo: assets/js/modulos/produtos.js
   Descrição: cadastro, listagem, edição e exclusão lógica de
              produtos. Canais de venda por produto. Custo real
              e preço de venda herdados do Precificador.
              Toggle de ativo/inativo + ação em massa.
   ============================================================ */

const MODULO_PRODUTOS = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let produtos = [];
  let proximoId = 1;

  let filtroCategoria = '';
  let filtroBusca = '';
  let filtroStatus = '';
  let filtroCanal = '';

  let produtoEditandoId = null;
  let selecionados = new Set();

  /* ==========================================================
     2. CATEGORIAS (mesmas do sku.js)
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

  function nomeCanal(id) {
    const c = window.MODULO_CANAIS?._buscar(id);
    return c ? c.nome : '—';
  }

  /* ==========================================================
     3. UTILITÁRIOS
     ========================================================== */

  function formatarMoeda(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
     4. CRUD
     ========================================================== */

  function criarProduto(dados) {
    const p = {
      id: proximoId++,
      sku: dados.sku,
      nome: dados.nome,
      categoria: dados.categoria,
      descricao: dados.descricao || '',
      custo: Number(dados.custo) || 0,
      precoVarejo: Number(dados.precoVarejo) || 0,
      precoAtacado: Number(dados.precoAtacado) || 0,
      estoqueMinimo: Number(dados.estoqueMinimo) || 0,
      estoqueAtual: Number(dados.estoqueAtual) || 0,
      unidade: dados.unidade || 'un',
      canais: Array.isArray(dados.canais) ? dados.canais : [],
      status: dados.status || 'ativo',
      origemPreco: dados.origemPreco || 'manual',
      precificacaoId: dados.precificacaoId || null,
      insumos: Array.isArray(dados.insumos) ? dados.insumos : [],
      paginasImpressas: Number(dados.paginasImpressas) || 0,
      tipoImpressao: dados.tipoImpressao || '',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    produtos.push(p);
    window.SKU_PRAFICAR?.registrarExistente(p.sku);
    return p;
  }

  function _criarDoPrecificador(dados) {
    if (!dados.nome) throw new Error('Nome obrigatório.');
    if (!dados.categoria) throw new Error('Categoria obrigatória.');

    const sku = window.SKU_PRAFICAR.gerarProximo(dados.categoria);

    return criarProduto({
      sku,
      nome: dados.nome,
      categoria: dados.categoria,
      descricao: dados.descricao || '',
      custo: dados.custo,
      precoVarejo: dados.precoVarejo,
      precoAtacado: dados.precoAtacado || dados.precoVarejo,
      estoqueMinimo: dados.estoqueMinimo || 5,
      estoqueAtual: 0,
      unidade: dados.unidade || 'un',
      canais: [],
      status: 'ativo',
      origemPreco: 'precificador',
      insumos: dados.insumos || [],
      paginasImpressas: dados.paginasImpressas || 0,
      tipoImpressao: dados.tipoImpressao || ''
    });
  }

  function atualizarProduto(id, dados) {
    const idx = produtos.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const skuAntigo = produtos[idx].sku;

    produtos[idx] = {
      ...produtos[idx],
      ...dados,
      custo: Number(dados.custo) || 0,
      precoVarejo: Number(dados.precoVarejo) || 0,
      precoAtacado: Number(dados.precoAtacado) || 0,
      estoqueMinimo: Number(dados.estoqueMinimo) || 0,
      estoqueAtual: Number(dados.estoqueAtual) || 0,
      canais: Array.isArray(dados.canais) ? dados.canais : produtos[idx].canais,
      atualizadoEm: new Date().toISOString()
    };

    if (dados.sku && dados.sku !== skuAntigo) {
      window.SKU_PRAFICAR?.registrarExistente(dados.sku);
    }

    return produtos[idx];
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
     5. SELEÇÃO EM MASSA
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
      <button class="btn btn--sucesso btn--sm" onclick="MODULO_PRODUTOS.ativarSelecionados()">
        Ativar
      </button>
      <button class="btn btn--secundario btn--sm" onclick="MODULO_PRODUTOS.desativarSelecionados()">
        Desativar
      </button>
      <button class="btn btn--ghost btn--sm" onclick="MODULO_PRODUTOS.limparSelecao()">
        Cancelar
      </button>
    `;
  }

  /* ==========================================================
     6. FILTROS
     ========================================================== */

  function produtosFiltrados() {
    return produtos.filter(p => {
      if (filtroCategoria && p.categoria !== filtroCategoria) return false;
      if (filtroStatus && p.status !== filtroStatus) return false;
      if (filtroCanal && !(p.canais || []).map(String).includes(String(filtroCanal))) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${p.sku} ${p.nome} ${p.descricao}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarFiltroCategoria(v) { filtroCategoria = v; rerender(); }
  function alterarFiltroBusca(v)     { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroStatus(v)    { filtroStatus = v; rerender(); }
  function alterarFiltroCanal(v)     { filtroCanal = v; rerender(); }

  /* ==========================================================
     7. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Produtos & Estoque</h1>
          <p class="pagina-header__subtitulo">
            ${produtos.length} ${produtos.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
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
          <input
            type="search"
            placeholder="Buscar por SKU, nome ou descrição..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_PRODUTOS.alterarFiltroBusca(this.value)"
          />
        </div>

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

  /* ==========================================================
     8. RENDER — TABELA
     ========================================================== */

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
                ? 'Cadastre seu primeiro produto. O SKU é gerado automaticamente e o custo vem do Precificador.'
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
                  <input
                    type="checkbox"
                    onchange="MODULO_PRODUTOS.alternarTodos(this.checked)"
                  />
                </th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th class="tabela__numero">Estoque</th>
                <th class="tabela__numero">Custo</th>
                <th class="tabela__numero">Varejo</th>
                <th>Canais</th>
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

    const canaisProduto = (p.canais || [])
      .map(id => nomeCanal(id))
      .filter(n => n !== '—');

    return `
      <tr>
        <td>
          <input
            type="checkbox"
            ${selecionados.has(p.id) ? 'checked' : ''}
            onchange="MODULO_PRODUTOS.alternarSelecao(${p.id})"
          />
        </td>
        <td><span class="sku">${escaparHTML(p.sku)}</span></td>
        <td>
          <div class="produto-nome">${escaparHTML(p.nome)}</div>
          ${p.descricao ? `<div class="produto-desc">${escaparHTML(p.descricao)}</div>` : ''}
        </td>
        <td>${escaparHTML(nomeCategoria(p.categoria))}</td>
        <td class="tabela__numero ${classeEstoque}">
          ${p.estoqueAtual} ${escaparHTML(p.unidade)}
        </td>
        <td class="tabela__numero">${formatarMoeda(p.custo)}</td>
        <td class="tabela__numero">${formatarMoeda(p.precoVarejo)}</td>
        <td>
          ${canaisProduto.length === 0
            ? '<span class="text-secundario">—</span>'
            : canaisProduto.slice(0, 2).map(c => `<span class="badge badge--info">${escaparHTML(c)}</span>`).join(' ')
          }
          ${canaisProduto.length > 2 ? `<span class="badge badge--neutro">+${canaisProduto.length - 2}</span>` : ''}
        </td>
        <td>
          <label class="toggle-ativo">
            <input
              type="checkbox"
              ${p.status === 'ativo' ? 'checked' : ''}
              onchange="MODULO_PRODUTOS.alternarStatus(${p.id})"
            />
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
     9. MODAL DE PRODUTO
     ========================================================== */

  function abrirNovo() {
    produtoEditandoId = null;
    abrirModal();
  }

  function abrirEdicao(id) {
    produtoEditandoId = id;
    abrirModal();
  }

  function abrirModal() {
    const p = produtoEditandoId ? buscarProduto(produtoEditandoId) : null;
    const editando = !!p;
    const canaisAtivos = p ? (p.canais || []) : [];

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
                <input id="prod-nome" type="text" required value="${escaparHTML(p?.nome || '')}" placeholder="Ex: Chaveiro Coração" />
              </div>

              <div class="form-grupo">
                <label for="prod-descricao">Descrição</label>
                <textarea id="prod-descricao" placeholder="Detalhes do produto (opcional)">${escaparHTML(p?.descricao || '')}</textarea>
              </div>

              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="prod-custo">Custo real (R$)</label>
                  <input id="prod-custo" type="number" step="0.01" min="0" value="${p?.custo ?? ''}" placeholder="0,00" />
                  <span class="form-ajuda">Vem do Precificador.</span>
                </div>
                <div class="form-grupo">
                  <label for="prod-preco-varejo">Preço varejo (R$)</label>
                  <input id="prod-preco-varejo" type="number" step="0.01" min="0" value="${p?.precoVarejo ?? ''}" placeholder="0,00" />
                </div>
                <div class="form-grupo">
                  <label for="prod-preco-atacado">Preço atacado (R$)</label>
                  <input id="prod-preco-atacado" type="number" step="0.01" min="0" value="${p?.precoAtacado ?? ''}" placeholder="0,00" />
                </div>
              </div>

              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="prod-estoque">Estoque atual</label>
                  <input id="prod-estoque" type="number" step="1" min="0" value="${p?.estoqueAtual ?? 0}" />
                </div>
                <div class="form-grupo">
                  <label for="prod-estoque-min">Estoque mínimo</label>
                  <input id="prod-estoque-min" type="number" step="1" min="0" value="${p?.estoqueMinimo ?? 0}" />
                  <span class="form-ajuda">Alerta quando ficar abaixo.</span>
                </div>
                <div class="form-grupo">
                  <label for="prod-unidade">Unidade</label>
                  <select id="prod-unidade">
                    ${['un', 'kit', 'cx', 'pct', 'folha', 'm', 'kg', 'g', 'L', 'mL'].map(u => `
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
                    <div class="alerta__conteudo">
                      Nenhum canal cadastrado. Cadastre canais no módulo Canais de Venda primeiro.
                    </div>
                  </div>
                ` : `
                  <div class="prod-canais-grid">
                    ${canaisDisponiveis().map(c => `
                      <label class="cfg-check">
                        <input
                          type="checkbox"
                          value="${c.id}"
                          ${canaisAtivos.map(String).includes(String(c.id)) ? 'checked' : ''}
                          data-canal
                        />
                        <span>${escaparHTML(c.nome)}</span>
                      </label>
                    `).join('')}
                  </div>
                  <span class="form-ajuda">Marque os canais onde este produto será vendido.</span>
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

  function fecharModal() {
    document.getElementById('modal-produto')?.remove();
    produtoEditandoId = null;
  }

  /* ==========================================================
     10. SKU
     ========================================================== */

  function gerarSkuAutomatico(codigoCategoria) {
    const input = document.getElementById('prod-sku');
    if (!input) return;

    if (!codigoCategoria) {
      input.value = '';
      return;
    }

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
     11. SALVAR
     ========================================================== */

  function salvar(event) {
    event.preventDefault();

    const canaisSelecionados = Array.from(
      document.querySelectorAll('input[data-canal]:checked')
    ).map(i => Number(i.value));

    const dados = {
      categoria:    document.getElementById('prod-categoria').value,
      sku:          document.getElementById('prod-sku').value.trim(),
      nome:         document.getElementById('prod-nome').value.trim(),
      descricao:    document.getElementById('prod-descricao').value.trim(),
      custo:        document.getElementById('prod-custo').value,
      precoVarejo:  document.getElementById('prod-preco-varejo').value,
      precoAtacado: document.getElementById('prod-preco-atacado').value,
      estoqueAtual: document.getElementById('prod-estoque').value,
      estoqueMinimo:document.getElementById('prod-estoque-min').value,
      unidade:      document.getElementById('prod-unidade').value,
      canais:       canaisSelecionados,
      status:       document.getElementById('prod-status').value
    };

    if (!dados.categoria) return alert('Selecione uma categoria.');
    if (!dados.sku) return alert('SKU inválido.');
    if (!window.SKU_PRAFICAR.validar(dados.sku)) {
      return alert('SKU fora do padrão PraFicar. Use o botão de regenerar.');
    }
    if (!dados.nome) return alert('Informe o nome do produto.');

    const duplicado = produtos.find(p => p.sku === dados.sku && p.id !== produtoEditandoId);
    if (duplicado) {
      return alert(`O SKU ${dados.sku} já está em uso pelo produto "${duplicado.nome}".`);
    }

    if (produtoEditandoId) {
      atualizarProduto(produtoEditandoId, dados);
    } else {
      criarProduto(dados);
    }

    fecharModal();
    rerender();
  }

  /* ==========================================================
     12. EXCLUSÃO
     ========================================================== */

  function confirmarExclusao(id) {
    const p = buscarProduto(id);
    if (!p) return;
    const ok = confirm(
      `Deseja desativar o produto "${p.nome}" (${p.sku})?\n\n` +
      `O produto continuará no histórico, mas não aparecerá como ativo.`
    );
    if (!ok) return;
    excluirProduto(id);
    rerender();
  }

  /* ==========================================================
     13. RERENDER
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
   /* ============================================================
   PRAFICAR ERP — ESTILOS DO MÓDULO PRODUTOS (v3)
   Arquivo: assets/css/modulos/produtos.css
   ============================================================ */

/* ============================================================
   1. FILTROS
   ============================================================ */

.filtros-produtos {
  display: flex;
  align-items: center;
  gap: var(--esp-3);
  margin-bottom: var(--esp-5);
  flex-wrap: wrap;
}

.filtros-produtos__busca {
  position: relative;
  flex: 1;
  min-width: 240px;
}

.filtros-produtos__busca svg {
  position: absolute;
  left: var(--esp-3);
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  stroke: var(--cor-texto-secundario);
  fill: none;
  stroke-width: 2;
  pointer-events: none;
}

.filtros-produtos__busca input {
  padding-left: var(--esp-10);
  height: 38px;
}

.filtros-produtos__select {
  width: auto;
  min-width: 160px;
  height: 38px;
  padding: 0 var(--esp-10) 0 var(--esp-3);
}

/* ============================================================
   2. COLUNAS
   ============================================================ */

.produto-nome {
  font-weight: var(--peso-medio);
  color: var(--cor-texto-principal);
}

.produto-desc {
  font-size: var(--texto-xs);
  color: var(--cor-texto-secundario);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

/* ============================================================
   3. AÇÕES DA LINHA
   ============================================================ */

.acoes-linha {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--esp-1);
}

.btn-icone {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--raio-sm);
  color: var(--cor-texto-secundario);
  background: transparent;
  border: 1px solid transparent;
  transition: background-color var(--transicao-rapida),
              color var(--transicao-rapida),
              border-color var(--transicao-rapida);
  cursor: pointer;
}

.btn-icone:hover {
  background-color: var(--azul-suave);
  color: var(--azul-medio);
  border-color: rgba(46, 111, 168, 0.15);
}

.btn-icone--perigo:hover {
  background-color: var(--cor-critico-fundo);
  color: var(--cor-critico);
  border-color: rgba(217, 58, 58, 0.2);
}

.btn-icone svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ============================================================
   4. MODAL DE PRODUTO
   ============================================================ */

#modal-produto .modal {
  max-width: 720px;
}

#modal-produto .form-grupo:last-child {
  margin-bottom: 0;
}

#modal-produto input[readonly] {
  background-color: var(--azul-suave);
  color: var(--azul-marinho);
  cursor: default;
}

#modal-produto input[readonly]:focus {
  border-color: var(--cor-primaria);
  box-shadow: var(--sombra-foco);
}

/* ============================================================
   5. CANAIS DE VENDA NO PRODUTO
   ============================================================ */

.prod-canais-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--esp-2);
  margin-top: var(--esp-2);
}

.cfg-check {
  display: flex;
  align-items: center;
  gap: var(--esp-2);
  padding: var(--esp-2) var(--esp-3);
  background-color: var(--cinza-50);
  border: 1px solid var(--cor-borda-suave);
  border-radius: var(--raio-sm);
  font-size: var(--texto-sm);
  color: var(--cor-texto-padrao);
  cursor: pointer;
  transition: background-color var(--transicao-rapida),
              border-color var(--transicao-rapida);
  user-select: none;
}

.cfg-check:hover {
  background-color: var(--azul-suave);
  border-color: rgba(46, 111, 168, 0.2);
}

.cfg-check input[type="checkbox"] {
  margin: 0;
  flex-shrink: 0;
}

.cfg-check input[type="checkbox"]:checked + span {
  color: var(--azul-marinho);
  font-weight: var(--peso-semibold);
}

/* ============================================================
   6. TOGGLE DE ATIVO/INATIVO
   ============================================================ */

.toggle-ativo {
  display: inline-flex;
  align-items: center;
  gap: var(--esp-2);
  cursor: pointer;
  user-select: none;
}

.toggle-ativo input {
  display: none;
}

.toggle-ativo__slider {
  width: 36px;
  height: 20px;
  background-color: var(--cinza-300);
  border-radius: var(--raio-pill);
  position: relative;
  transition: background-color var(--transicao-rapida);
  flex-shrink: 0;
}

.toggle-ativo__slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background-color: var(--branco);
  border-radius: 50%;
  transition: transform var(--transicao-rapida);
  box-shadow: var(--sombra-xs);
}

.toggle-ativo input:checked + .toggle-ativo__slider {
  background-color: var(--verde);
}

.toggle-ativo input:checked + .toggle-ativo__slider::after {
  transform: translateX(16px);
}

.toggle-ativo__label {
  font-size: var(--texto-sm);
  font-weight: var(--peso-medio);
  color: var(--cor-texto-padrao);
}

/* ============================================================
   7. BARRA DE AÇÕES EM MASSA
   ============================================================ */

.barra-acoes-massa {
  position: fixed;
  bottom: var(--esp-6);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--esp-3);
  padding: var(--esp-3) var(--esp-5);
  background-color: var(--azul-marinho);
  border-radius: var(--raio-pill);
  box-shadow: 0 12px 32px rgba(27, 58, 92, 0.3);
  z-index: 700;
  animation: barra-slide-up 0.25s ease;
}

@keyframes barra-slide-up {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.barra-acoes-massa__contador {
  font-size: var(--texto-sm);
  font-weight: var(--peso-semibold);
  color: var(--branco);
  padding-right: var(--esp-3);
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.barra-acoes-massa .btn {
  height: 32px;
  padding: 0 var(--esp-4);
  font-size: var(--texto-sm);
}

.barra-acoes-massa .btn--sucesso {
  background-color: var(--verde);
  border-color: var(--verde);
  color: var(--branco);
}

.barra-acoes-massa .btn--secundario {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--branco);
}

.barra-acoes-massa .btn--secundario:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.barra-acoes-massa .btn--ghost {
  color: rgba(255, 255, 255, 0.7);
}

.barra-acoes-massa .btn--ghost:hover {
  color: var(--branco);
}

/* ============================================================
   8. RESPONSIVO
   ============================================================ */

@media (max-width: 768px) {
  .filtros-produtos {
    flex-direction: column;
    align-items: stretch;
  }

  .filtros-produtos__select {
    width: 100%;
  }

  .produto-desc {
    max-width: 160px;
  }

  .prod-canais-grid {
    grid-template-columns: 1fr;
  }

  .barra-acoes-massa {
    bottom: var(--esp-4);
    padding: var(--esp-2) var(--esp-4);
    gap: var(--esp-2);
  }

  .barra-acoes-massa__contador {
    font-size: var(--texto-xs);
  }

  .barra-acoes-massa .btn {
    padding: 0 var(--esp-3);
  }
}
