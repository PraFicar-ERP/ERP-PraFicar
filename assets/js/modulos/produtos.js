/* ============================================================
   PRAFICAR ERP — MÓDULO PRODUTOS
   Arquivo: assets/js/modulos/produtos.js
   Descrição: cadastro, listagem, edição, exclusão lógica e
              filtros de produtos. SKU gerado automaticamente
              no padrão PraFicar via SKU_PRAFICAR.
   ============================================================ */

const MODULO_PRODUTOS = (() => {

  /* ==========================================================
     1. ESTADO EM MEMÓRIA
     (substituído por Supabase na fase de integração)
     ========================================================== */

  let produtos = [];
  let proximoId = 1;
  let filtroCategoria = '';
  let filtroBusca = '';
  let filtroStatus = '';

  // Produto em edição no modal (null = novo)
  let produtoEditandoId = null;

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

  /* ==========================================================
     3. UTILITÁRIOS
     ========================================================== */

  function formatarMoeda(valor) {
    const n = Number(valor) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function escaparHTML(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
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
    const produto = {
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
      status: dados.status || 'ativo',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    produtos.push(produto);

    // Registra o SKU no gerador para nunca repetir
    window.SKU_PRAFICAR?.registrarExistente(produto.sku);

    return produto;
  }

  function atualizarProduto(id, dados) {
    const idx = produtos.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const skuAntigo = produtos[idx].sku;
    const skuNovo = dados.sku;

    produtos[idx] = {
      ...produtos[idx],
      ...dados,
      custo: Number(dados.custo) || 0,
      precoVarejo: Number(dados.precoVarejo) || 0,
      precoAtacado: Number(dados.precoAtacado) || 0,
      estoqueMinimo: Number(dados.estoqueMinimo) || 0,
      estoqueAtual: Number(dados.estoqueAtual) || 0,
      atualizadoEm: new Date().toISOString()
    };

    if (skuNovo && skuNovo !== skuAntigo) {
      window.SKU_PRAFICAR?.registrarExistente(skuNovo);
    }

    return produtos[idx];
  }

  function excluirProduto(id) {
    // Exclusão lógica: marca como inativo
    const idx = produtos.findIndex(p => p.id === id);
    if (idx === -1) return false;
    produtos[idx].status = 'inativo';
    produtos[idx].atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarProduto(id) {
    return produtos.find(p => p.id === id) || null;
  }

  /* ==========================================================
     5. FILTROS E LISTAGEM
     ========================================================== */

  function produtosFiltrados() {
    return produtos.filter(p => {
      if (filtroCategoria && p.categoria !== filtroCategoria) return false;
      if (filtroStatus && p.status !== filtroStatus) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${p.sku} ${p.nome} ${p.descricao}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarFiltroCategoria(valor) {
    filtroCategoria = valor;
    rerender();
  }

  function alterarFiltroBusca(valor) {
    filtroBusca = valor;
    rerenderTabela();
  }

  function alterarFiltroStatus(valor) {
    filtroStatus = valor;
    rerender();
  }

  /* ==========================================================
     6. RENDER — TELA PRINCIPAL
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
            <option value="${c.codigo}" ${filtroCategoria === c.codigo ? 'selected' : ''}>
              ${c.nome}
            </option>
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
     7. RENDER — TABELA
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
                ? 'Cadastre seu primeiro produto e o SKU será gerado automaticamente no padrão PraFicar.'
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
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th class="tabela__numero">Estoque</th>
                <th class="tabela__numero">Custo</th>
                <th class="tabela__numero">Varejo</th>
                <th class="tabela__numero">Atacado</th>
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

    return `
      <tr>
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
        <td class="tabela__numero">${formatarMoeda(p.precoAtacado)}</td>
        <td>
          ${p.status === 'ativo'
            ? '<span class="badge badge--sucesso">Ativo</span>'
            : '<span class="badge badge--neutro">Inativo</span>'}
        </td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Editar" onclick="MODULO_PRODUTOS.abrirEdicao(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icone btn-icone--perigo" title="Excluir" onclick="MODULO_PRODUTOS.confirmarExclusao(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     8. RENDER — MODAL DE PRODUTO
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

    // SKU inicial: vazio para novo, valor atual para edição
    const skuAtual = p ? p.sku : '';

    const html = `
      <div class="modal-overlay ativo" id="modal-produto">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar produto' : 'Novo produto'}</h2>
            <button class="modal__fechar" onclick="MODULO_PRODUTOS.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <form id="form-produto" onsubmit="MODULO_PRODUTOS.salvar(event)">
              <div class="form-grupo">
                <label for="prod-categoria">Categoria <span class="form-obrigatorio">*</span></label>
                <select
                  id="prod-categoria"
                  required
                  onchange="MODULO_PRODUTOS.gerarSkuAutomatico(this.value)"
                >
                  <option value="">Selecione uma categoria</option>
                  ${categorias().map(c => `
                    <option value="${c.codigo}" ${p && p.categoria === c.codigo ? 'selected' : ''}>
                      ${c.nome}
                    </option>
                  `).join('')}
                </select>
                <span class="form-ajuda">A categoria define o prefixo do SKU.</span>
              </div>

              <div class="form-grupo">
                <label for="prod-sku">SKU <span class="form-obrigatorio">*</span></label>
                <div class="sku-campo">
                  <input
                    id="prod-sku"
                    type="text"
                    required
                    value="${escaparHTML(skuAtual)}"
                    placeholder="Ex: MP-PF-001"
                    readonly
                  />
                  <button
                    type="button"
                    class="sku-campo__regenerar"
                    title="Gerar novo SKU"
                    onclick="MODULO_PRODUTOS.regenerarSku()"
                  >
                    <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                  </button>
                </div>
                <span class="form-ajuda">Gerado automaticamente. Você pode regenerar se precisar.</span>
              </div>

              <div class="form-grupo">
                <label for="prod-nome">Nome <span class="form-obrigatorio">*</span></label>
                <input
                  id="prod-nome"
                  type="text"
                  required
                  value="${escaparHTML(p?.nome || '')}"
                  placeholder="Ex: Marca-páginas Coração"
                />
              </div>

              <div class="form-grupo">
                <label for="prod-descricao">Descrição</label>
                <textarea
                  id="prod-descricao"
                  placeholder="Detalhes do produto (opcional)"
                >${escaparHTML(p?.descricao || '')}</textarea>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="prod-custo">Custo (R$)</label>
                  <input
                    id="prod-custo"
                    type="number"
                    step="0.01"
                    min="0"
                    value="${p?.custo ?? ''}"
                    placeholder="0,00"
                  />
                </div>

                <div class="form-grupo">
                  <label for="prod-preco-varejo">Preço varejo (R$)</label>
                  <input
                    id="prod-preco-varejo"
                    type="number"
                    step="0.01"
                    min="0"
                    value="${p?.precoVarejo ?? ''}"
                    placeholder="0,00"
                  />
                </div>

                <div class="form-grupo">
                  <label for="prod-preco-atacado">Preço atacado (R$)</label>
                  <input
                    id="prod-preco-atacado"
                    type="number"
                    step="0.01"
                    min="0"
                    value="${p?.precoAtacado ?? ''}"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="prod-estoque">Estoque atual</label>
                  <input
                    id="prod-estoque"
                    type="number"
                    step="1"
                    min="0"
                    value="${p?.estoqueAtual ?? 0}"
                  />
                </div>

                <div class="form-grupo">
                  <label for="prod-estoque-min">Estoque mínimo</label>
                  <input
                    id="prod-estoque-min"
                    type="number"
                    step="1"
                    min="0"
                    value="${p?.estoqueMinimo ?? 0}"
                  />
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
                <label for="prod-status">Status</label>
                <select id="prod-status">
                  <option value="ativo"   ${(p?.status || 'ativo') === 'ativo'   ? 'selected' : ''}>Ativo</option>
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

    // Injeta no body
    let existente = document.getElementById('modal-produto');
    if (existente) existente.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    // Foca o primeiro campo vazio
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
     9. SKU — GERAÇÃO AUTOMÁTICA
     ========================================================== */

  function gerarSkuAutomatico(codigoCategoria) {
    const input = document.getElementById('prod-sku');
    if (!input) return;

    if (!codigoCategoria) {
      input.value = '';
      return;
    }

    // Se estiver editando e a categoria não mudou, mantém o SKU atual
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
    if (!categoria) {
      alert('Selecione uma categoria primeiro.');
      return;
    }
    try {
      document.getElementById('prod-sku').value =
        window.SKU_PRAFICAR.gerarProximo(categoria);
    } catch (e) {
      console.error(e);
    }
  }

  /* ==========================================================
     10. SALVAR
     ========================================================== */

  function salvar(event) {
    event.preventDefault();

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
      status:       document.getElementById('prod-status').value
    };

    // Validações
    if (!dados.categoria) return alert('Selecione uma categoria.');
    if (!dados.sku)       return alert('SKU inválido.');
    if (!window.SKU_PRAFICAR.validar(dados.sku)) {
      return alert('SKU fora do padrão PraFicar. Use o botão de regenerar.');
    }
    if (!dados.nome)      return alert('Informe o nome do produto.');

    // Verifica duplicidade de SKU
    const duplicado = produtos.find(p =>
      p.sku === dados.sku && p.id !== produtoEditandoId
    );
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
     11. EXCLUSÃO
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
     12. RERENDER
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
     13. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovo,
    abrirEdicao,
    fecharModal,
    salvar,
    confirmarExclusao,
    gerarSkuAutomatico,
    regenerarSku,
    alterarFiltroCategoria,
    alterarFiltroBusca,
    alterarFiltroStatus,
    // Para uso futuro (Supabase)
    _listar: () => [...produtos],
    _buscar: buscarProduto
  };

})();

window.MODULO_PRODUTOS = MODULO_PRODUTOS;
window.renderProdutos = MODULO_PRODUTOS.render;
