/* ============================================================
   PRAFICAR ERP — MÓDULO ESTOQUE
   Arquivo: assets/js/modulos/estoque.js
   Descrição: controle de estoque dos produtos acabados.
              - Lista com status por cor (ok / atenção / crítico)
              - Produção com quantidade feita e falhas
              - Consumo de componentes
              - Histórico de movimentações

   Conceito:
   - Produtos SIMPLES: só entrada manual (compra) e saída (venda)
   - Produtos COMPOSTOS: podem ser produzidos
     → Consomem itens/componentes
     → Geram produto no estoque
     → Falhas entram no custo real
   ============================================================ */

const MODULO_ESTOQUE = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let filtroBusca = '';
  let filtroStatus = '';
  let filtroCategoria = '';

  // Histórico de movimentações
  let movimentacoes = [];
  let proximoMovId = 1;

  /* ==========================================================
     2. UTILITÁRIOS
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

  function formatarMoedaFina(v) {
    const n = Number(v) || 0;
    if (n === 0) return 'R$ 0,00';
    if (n < 0.01) return 'R$ ' + n.toFixed(4).replace('.', ',');
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarDataHora(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function agora() {
    return new Date().toISOString();
  }

  /* ==========================================================
     3. ACESSO AOS PRODUTOS
     ========================================================== */

  function listarProdutos() {
    return window.MODULO_PRODUTOS?._listar() || [];
  }

  function buscarProduto(id) {
    return window.MODULO_PRODUTOS?._buscar(id) || null;
  }

  function atualizarProduto(id, dados) {
    if (!window.MODULO_PRODUTOS?._atualizarEstoque) {
      // Fallback: acesso direto
      const p = buscarProduto(id);
      if (!p) return null;
      Object.assign(p, dados);
      return p;
    }
    return window.MODULO_PRODUTOS._atualizarEstoque(id, dados);
  }

  /* ==========================================================
     4. CLASSIFICAÇÃO DE ESTOQUE
     ========================================================== */

  // Regras:
  //   zerado  → estoque = 0
  //   critico → estoque <= mínimo
  //   atencao → estoque <= mínimo × 2
  //   ok      → estoque > mínimo × 2
  function classificarEstoque(produto) {
    const atual = Number(produto.estoqueAtual) || 0;
    const minimo = Number(produto.estoqueMinimo) || 0;

    if (atual === 0) return 'zerado';
    if (atual <= minimo) return 'critico';
    if (minimo > 0 && atual <= minimo * 2) return 'atencao';
    return 'ok';
  }

  function nomeStatus(status) {
    if (status === 'zerado')  return 'Zerado';
    if (status === 'critico') return 'Crítico';
    if (status === 'atencao') return 'Atenção';
    return 'OK';
  }

  function corStatus(status) {
    if (status === 'zerado')  return 'critico';
    if (status === 'critico') return 'critico';
    if (status === 'atencao') return 'atencao';
    return 'sucesso';
  }

  function iconeStatus(status) {
    if (status === 'zerado')  return '🔴';
    if (status === 'critico') return '🔴';
    if (status === 'atencao') return '🟡';
    return '🟢';
  }

  /* ==========================================================
     5. FILTROS
     ========================================================== */

  function produtosFiltrados() {
    return listarProdutos()
      .filter(p => p.status === 'ativo')
      .filter(p => {
        if (filtroStatus && classificarEstoque(p) !== filtroStatus) return false;
        if (filtroCategoria && p.categoria !== filtroCategoria) return false;
        if (filtroBusca) {
          const t = filtroBusca.toLowerCase();
          const alvo = `${p.sku} ${p.nome} ${p.especificacao} ${p.descricao}`.toLowerCase();
          if (!alvo.includes(t)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Ordena por criticidade (zerado → critico → atencao → ok)
        const ordem = { zerado: 0, critico: 1, atencao: 2, ok: 3 };
        const oa = ordem[classificarEstoque(a)];
        const ob = ordem[classificarEstoque(b)];
        if (oa !== ob) return oa - ob;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }

  function categorias() {
    return window.SKU_PRAFICAR?.listarCategorias() || [];
  }

  function nomeCategoria(codigo) {
    const c = window.SKU_PRAFICAR?.buscarCategoria(codigo);
    return c ? c.nome : '—';
  }

  function alterarFiltroBusca(v)     { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroStatus(v)    { filtroStatus = v; rerender(); }
  function alterarFiltroCategoria(v) { filtroCategoria = v; rerender(); }

  /* ==========================================================
     6. KPIs DO ESTOQUE
     ========================================================== */

  function calcularKPIs() {
    const produtos = listarProdutos().filter(p => p.status === 'ativo');

    const zerados = produtos.filter(p => classificarEstoque(p) === 'zerado').length;
    const criticos = produtos.filter(p => classificarEstoque(p) === 'critico').length;
    const atencao = produtos.filter(p => classificarEstoque(p) === 'atencao').length;

    const valorTotal = produtos.reduce((acc, p) => {
      const qtd = Number(p.estoqueAtual) || 0;
      const custo = Number(p.custo) || 0;
      return acc + qtd * custo;
    }, 0);

    return {
      total: produtos.length,
      zerados,
      criticos,
      atencao,
      precisaRepor: zerados + criticos,
      valorTotal
    };
  }

  /* ==========================================================
     7. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const k = calcularKPIs();

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Estoque</h1>
          <p class="pagina-header__subtitulo">
            Controle de estoque dos produtos acabados. Produza e acompanhe.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario" onclick="MODULO_ESTOQUE.verMovimentacoes()">
            📋 Movimentações
          </button>
        </div>
      </div>

      ${k.total > 0 ? `
        <div class="grid grid--4 mb-6">
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Produtos ativos</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${k.total}</div>
            <div class="kpi__variacao kpi__variacao--neutra">no catálogo</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Precisa repor</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              </span>
            </div>
            <div class="kpi__valor ${k.precisaRepor > 0 ? 'text-critico' : ''}">${k.precisaRepor}</div>
            <div class="kpi__variacao ${k.precisaRepor > 0 ? 'kpi__variacao--negativa' : 'kpi__variacao--neutra'}">
              ${k.precisaRepor > 0 ? 'abaixo do mínimo' : 'tudo em ordem'}
            </div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Atenção</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </span>
            </div>
            <div class="kpi__valor ${k.atencao > 0 ? 'text-atencao' : ''}">${k.atencao}</div>
            <div class="kpi__variacao kpi__variacao--neutra">próximos do mínimo</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Valor em estoque</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${formatarMoeda(k.valorTotal)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">a preço de custo</div>
          </div>
        </div>
      ` : ''}

      <div class="filtros-estoque">
        <div class="filtros-estoque__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por SKU, nome, tamanho ou descrição..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_ESTOQUE.alterarFiltroBusca(this.value)"
          />
        </div>

        <select class="filtros-estoque__select" onchange="MODULO_ESTOQUE.alterarFiltroCategoria(this.value)">
          <option value="">Todas as categorias</option>
          ${categorias().map(c => `
            <option value="${c.codigo}" ${filtroCategoria === c.codigo ? 'selected' : ''}>${escaparHTML(c.nome)}</option>
          `).join('')}
        </select>

        <select class="filtros-estoque__select" onchange="MODULO_ESTOQUE.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          <option value="zerado"  ${filtroStatus === 'zerado' ? 'selected' : ''}>🔴 Zerado</option>
          <option value="critico" ${filtroStatus === 'critico' ? 'selected' : ''}>🔴 Crítico</option>
          <option value="atencao" ${filtroStatus === 'atencao' ? 'selected' : ''}>🟡 Atenção</option>
          <option value="ok"      ${filtroStatus === 'ok' ? 'selected' : ''}>🟢 OK</option>
        </select>
      </div>

      <div id="tabela-estoque-wrapper">
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
              <svg viewBox="0 0 24 24"><path d="M3 3h18v4H3z"/><path d="M5 7v14h14V7"/><path d="M9 11h6"/><path d="M9 15h6"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${listarProdutos().length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${listarProdutos().length === 0
                ? 'Cadastre produtos em "Produtos & Estoque" para começar a produzir.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
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
                <th class="tabela__numero">Mínimo</th>
                <th>Status</th>
                <th class="tabela__numero">Custo un.</th>
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
    const status = classificarEstoque(p);
    const cor = corStatus(status);

    return `
      <tr>
        <td><span class="sku">${escaparHTML(p.sku)}</span></td>
        <td>
          <div class="produto-nome">${escaparHTML(p.nome)}</div>
          ${p.especificacao ? `<div class="produto-espec">${escaparHTML(p.especificacao)}</div>` : ''}
        </td>
        <td>${escaparHTML(nomeCategoria(p.categoria))}</td>
        <td class="tabela__numero peso-semibold ${status !== 'ok' ? 'text-' + cor : ''}">
          ${p.estoqueAtual} ${escaparHTML(p.unidade || 'un')}
        </td>
        <td class="tabela__numero text-secundario">${p.estoqueMinimo}</td>
        <td>
          <span class="badge badge--${cor}">${iconeStatus(status)} ${nomeStatus(status)}</span>
        </td>
        <td class="tabela__numero">${formatarMoedaFina(p.custo)}</td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Produzir" onclick="MODULO_ESTOQUE.abrirProducao(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20"/></svg>
            </button>
            <button class="btn-icone" title="Ajustar estoque" onclick="MODULO_ESTOQUE.abrirAjuste(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     9. MODAL — PRODUZIR
     ========================================================== */

  function abrirProducao(produtoId) {
    const produto = buscarProduto(produtoId);
    if (!produto) return;

    const componentes = produto.itens || [];
    const temComponentes = componentes.length > 0;

    const html = `
      <div class="modal-overlay ativo" id="modal-producao">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Produzir ${escaparHTML(produto.nome)}</h2>
            <button class="modal__fechar" onclick="MODULO_ESTOQUE.fecharProducao()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="estoque-prod-info">
              <div class="estoque-prod-info__linha">
                <span>Estoque atual</span>
                <strong>${produto.estoqueAtual} ${escaparHTML(produto.unidade || 'un')}</strong>
              </div>
              <div class="estoque-prod-info__linha">
                <span>Custo unitário</span>
                <strong>${formatarMoedaFina(produto.custo)}</strong>
              </div>
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="prod-qtd-produzida">Quantidade produzida <span class="form-obrigatorio">*</span></label>
                <input
                  id="prod-qtd-produzida"
                  type="number"
                  min="1"
                  step="1"
                  value="1"
                  oninput="MODULO_ESTOQUE.recalcularProducao(${produtoId})"
                />
                <span class="form-ajuda">Total de unidades feitas (antes de descontar falhas).</span>
              </div>

              <div class="form-grupo">
                <label for="prod-qtd-falhas">Quantidade de falhas</label>
                <input
                  id="prod-qtd-falhas"
                  type="number"
                  min="0"
                  step="1"
                  value="0"
                  oninput="MODULO_ESTOQUE.recalcularProducao(${produtoId})"
                />
                <span class="form-ajuda">Peças que saíram com defeito ou quebraram.</span>
              </div>
            </div>

            ${temComponentes ? `
              <div class="estoque-componentes">
                <div class="estoque-componentes__titulo">
                  Componentes que serão consumidos
                </div>
                <table class="tabela tabela-itens">
                  <thead>
                    <tr>
                      <th>Componente</th>
                      <th class="tabela__numero">Qtd por un.</th>
                      <th class="tabela__numero">Total</th>
                      <th class="tabela__numero">Estoque</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody id="prod-componentes-lista">
                    ${renderComponentes(produto, 1)}
                  </tbody>
                </table>
              </div>
            ` : `
              <div class="alerta alerta--info">
                <span class="alerta__icone">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </span>
                <div class="alerta__conteudo">
                  <div class="alerta__titulo">Produto simples</div>
                  Este produto não tem componentes cadastrados. A produção só vai somar ao estoque.
                </div>
              </div>
            `}

            <div class="estoque-prod-resumo" id="prod-resumo">
              ${renderResumoProducao(produto, 1, 0)}
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_ESTOQUE.fecharProducao()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_ESTOQUE.confirmarProducao(${produtoId})">
              Confirmar produção
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-producao')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => document.getElementById('prod-qtd-produzida')?.focus(), 50);
  }

  function fecharProducao() {
    document.getElementById('modal-producao')?.remove();
  }

  function renderComponentes(produto, qtdProduzida) {
    return (produto.itens || []).map(item => {
      const compProduto = item.produtoId ? buscarProduto(item.produtoId) : null;
      const estoqueComp = compProduto ? Number(compProduto.estoqueAtual) || 0 : 0;
      const qtdNecessaria = (Number(item.quantidade) || 1) * qtdProduzida;

      let situacao = 'ok';
      if (compProduto && qtdNecessaria > estoqueComp) {
        situacao = estoqueComp > 0 ? 'misto' : 'critico';
      }

      const cor = situacao === 'ok' ? 'sucesso' : situacao === 'misto' ? 'atencao' : 'critico';
      const texto = situacao === 'ok' ? '✅ OK' : situacao === 'misto' ? '⚠️ Insuficiente' : '🔴 Sem estoque';

      return `
        <tr>
          <td>
            <div class="produto-nome">${escaparHTML(item.nome)}</div>
            ${item.especificacao ? `<div class="produto-espec">${escaparHTML(item.especificacao)}</div>` : ''}
            ${compProduto ? `<span class="sku">${escaparHTML(compProduto.sku)}</span>` : ''}
          </td>
          <td class="tabela__numero">${item.quantidade}</td>
          <td class="tabela__numero peso-semibold">${qtdNecessaria}</td>
          <td class="tabela__numero ${situacao !== 'ok' ? 'text-' + cor + ' peso-semibold' : ''}">
            ${compProduto ? estoqueComp : '—'}
          </td>
          <td><span class="badge badge--${cor}">${texto}</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderResumoProducao(produto, qtdProduzida, qtdFalhas) {
    const unidadeBoa = Math.max(0, qtdProduzida - qtdFalhas);
    const custoUnitario = Number(produto.custo) || 0;
    const custoTotal = custoUnitario * qtdProduzida;
    const custoReal = unidadeBoa > 0 ? custoTotal / unidadeBoa : 0;

    return `
      <div class="estoque-prod-resumo__grid">
        <div class="estoque-prod-resumo__item">
          <span class="estoque-prod-resumo__label">Produzidas</span>
          <span class="estoque-prod-resumo__valor">${qtdProduzida}</span>
        </div>
        <div class="estoque-prod-resumo__item">
          <span class="estoque-prod-resumo__label">Falhas</span>
          <span class="estoque-prod-resumo__valor ${qtdFalhas > 0 ? 'text-critico' : ''}">${qtdFalhas}</span>
        </div>
        <div class="estoque-prod-resumo__item">
          <span class="estoque-prod-resumo__label">Boas</span>
          <span class="estoque-prod-resumo__valor text-sucesso">${unidadeBoa}</span>
        </div>
        <div class="estoque-prod-resumo__item">
          <span class="estoque-prod-resumo__label">Custo total</span>
          <span class="estoque-prod-resumo__valor">${formatarMoedaFina(custoTotal)}</span>
        </div>
        <div class="estoque-prod-resumo__item estoque-prod-resumo__item--destaque">
          <span class="estoque-prod-resumo__label">Custo por unidade boa</span>
          <span class="estoque-prod-resumo__valor">${formatarMoedaFina(custoReal)}</span>
        </div>
      </div>

      ${qtdFalhas > 0 ? `
        <div class="alerta alerta--atencao mt-4">
          <span class="alerta__icone">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">Falhas aumentam o custo real</div>
            Sem falhas, o custo seria ${formatarMoedaFina(custoUnitario)}.
            Com ${qtdFalhas} falha${qtdFalhas > 1 ? 's' : ''}, o custo sobe para ${formatarMoedaFina(custoReal)}.
          </div>
        </div>
      ` : ''}
    `;
  }

  function recalcularProducao(produtoId) {
    const produto = buscarProduto(produtoId);
    if (!produto) return;

    const qtdProd = Number(document.getElementById('prod-qtd-produzida')?.value) || 0;
    const qtdFalhas = Number(document.getElementById('prod-qtd-falhas')?.value) || 0;

    const listaComp = document.getElementById('prod-componentes-lista');
    if (listaComp) listaComp.innerHTML = renderComponentes(produto, qtdProd);

    const resumo = document.getElementById('prod-resumo');
    if (resumo) resumo.innerHTML = renderResumoProducao(produto, qtdProd, qtdFalhas);
  }

  /* ==========================================================
     10. CONFIRMAR PRODUÇÃO
     ========================================================== */

  function confirmarProducao(produtoId) {
    const produto = buscarProduto(produtoId);
    if (!produto) return;

    const qtdProd = Number(document.getElementById('prod-qtd-produzida')?.value) || 0;
    const qtdFalhas = Number(document.getElementById('prod-qtd-falhas')?.value) || 0;

    if (qtdProd <= 0) return alert('Informe a quantidade produzida.');
    if (qtdFalhas > qtdProd) return alert('Falhas não podem ser maiores que a produção.');
    if (qtdFalhas < 0) return alert('Falhas não podem ser negativas.');

    const unidadeBoa = qtdProd - qtdFalhas;
    const componentes = produto.itens || [];

    // Verifica se tem componentes suficientes
    const faltando = [];
    componentes.forEach(item => {
      if (!item.produtoId) return;
      const comp = buscarProduto(item.produtoId);
      if (!comp) return;
      const necessaria = (Number(item.quantidade) || 1) * qtdProd;
      const disponivel = Number(comp.estoqueAtual) || 0;
      if (necessaria > disponivel) {
        faltando.push({
          nome: comp.nome,
          sku: comp.sku,
          necessaria,
          disponivel,
          faltam: necessaria - disponivel
        });
      }
    });

    // Avisa se faltam componentes, mas deixa continuar
    if (faltando.length > 0) {
      const lista = faltando.map(f =>
        `• ${f.nome}: precisa ${f.necessaria}, tem ${f.disponivel} (faltam ${f.faltam})`
      ).join('\n');

      const ok = confirm(
        `⚠️ ATENÇÃO\n\n` +
        `Os seguintes componentes não têm estoque suficiente:\n\n` +
        `${lista}\n\n` +
        `Deseja continuar mesmo assim?`
      );
      if (!ok) return;
    }

    try {
      // 1. Baixa componentes
      componentes.forEach(item => {
        if (!item.produtoId) return;
        const comp = buscarProduto(item.produtoId);
        if (!comp) return;
        const qtd = (Number(item.quantidade) || 1) * qtdProd;
        comp.estoqueAtual = Math.max(0, Number(comp.estoqueAtual || 0) - qtd);

        registrarMovimentacao({
          tipo: 'producao_saida',
          produtoId: comp.id,
          produtoNome: comp.nome,
          produtoSku: comp.sku,
          quantidade: qtd,
          motivo: `Consumo para produzir ${qtdProd}× ${produto.nome}`
        });
      });

      // 2. Entra produto no estoque (só unidades boas)
      produto.estoqueAtual = Number(produto.estoqueAtual || 0) + unidadeBoa;

      registrarMovimentacao({
        tipo: 'producao_entrada',
        produtoId: produto.id,
        produtoNome: produto.nome,
        produtoSku: produto.sku,
        quantidade: unidadeBoa,
        quantidadeProduzida: qtdProd,
        falhas: qtdFalhas,
        motivo: `Produção: ${qtdProd} feitas, ${qtdFalhas} falha${qtdFalhas === 1 ? '' : 's'}, ${unidadeBoa} boas`
      });

      fecharProducao();

      // Feedback visual
      const msg = qtdFalhas > 0
        ? `Produção registrada!\n\n` +
          `• Feitas: ${qtdProd}\n` +
          `• Falhas: ${qtdFalhas}\n` +
          `• Adicionadas ao estoque: ${unidadeBoa}\n\n` +
          `O custo real por unidade foi recalculado.`
        : `Produção registrada!\n\n` +
          `• Adicionadas ao estoque: ${unidadeBoa}`;

      alert(msg);
      rerender();

    } catch (e) {
      console.error(e);
      alert('Erro ao registrar produção: ' + e.message);
    }
  }

  /* ==========================================================
     11. MODAL — AJUSTAR ESTOQUE
     ========================================================== */

  function abrirAjuste(produtoId) {
    const produto = buscarProduto(produtoId);
    if (!produto) return;

    const html = `
      <div class="modal-overlay ativo" id="modal-ajuste">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Ajustar estoque</h2>
            <button class="modal__fechar" onclick="MODULO_ESTOQUE.fecharAjuste()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="estoque-prod-info">
              <div class="estoque-prod-info__linha">
                <span>Produto</span>
                <strong>${escaparHTML(produto.nome)}</strong>
              </div>
              <div class="estoque-prod-info__linha">
                <span>Estoque atual</span>
                <strong>${produto.estoqueAtual} ${escaparHTML(produto.unidade || 'un')}</strong>
              </div>
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="ajuste-tipo">Tipo de ajuste</label>
                <select id="ajuste-tipo">
                  <option value="entrada">Entrada manual (compra, achado)</option>
                  <option value="saida">Saída manual (perda, defeito)</option>
                  <option value="definir">Definir valor exato (inventário)</option>
                </select>
              </div>
              <div class="form-grupo">
                <label for="ajuste-qtd">Quantidade</label>
                <input id="ajuste-qtd" type="number" min="0" step="1" value="1" />
              </div>
            </div>

            <div class="form-grupo">
              <label for="ajuste-motivo">Motivo <span class="form-obrigatorio">*</span></label>
              <input id="ajuste-motivo" type="text" placeholder="Ex: Contagem, defeito, brinde..." />
              <span class="form-ajuda">Fica registrado no histórico.</span>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_ESTOQUE.fecharAjuste()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_ESTOQUE.confirmarAjuste(${produtoId})">
              Confirmar ajuste
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-ajuste')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('ajuste-tipo')?.focus(), 50);
  }

  function fecharAjuste() {
    document.getElementById('modal-ajuste')?.remove();
  }

  function confirmarAjuste(produtoId) {
    const produto = buscarProduto(produtoId);
    if (!produto) return;

    const tipo = document.getElementById('ajuste-tipo').value;
    const qtd = Number(document.getElementById('ajuste-qtd').value) || 0;
    const motivo = document.getElementById('ajuste-motivo').value.trim();

    if (qtd < 0) return alert('Quantidade inválida.');
    if (!motivo) return alert('Informe o motivo do ajuste.');

    const anterior = Number(produto.estoqueAtual) || 0;
    let novo = anterior;
    let delta = 0;

    if (tipo === 'entrada') {
      novo = anterior + qtd;
      delta = qtd;
    } else if (tipo === 'saida') {
      novo = Math.max(0, anterior - qtd);
      delta = -(anterior - novo);
    } else if (tipo === 'definir') {
      novo = qtd;
      delta = novo - anterior;
    }

    produto.estoqueAtual = novo;

    registrarMovimentacao({
      tipo: 'ajuste',
      produtoId: produto.id,
      produtoNome: produto.nome,
      produtoSku: produto.sku,
      quantidade: delta,
      motivo,
      anterior,
      novo
    });

    fecharAjuste();
    alert(`Estoque ajustado!\n\n• Antes: ${anterior}\n• Agora: ${novo}`);
    rerender();
  }

  /* ==========================================================
     12. HISTÓRICO DE MOVIMENTAÇÕES
     ========================================================== */

  function registrarMovimentacao(dados) {
    movimentacoes.push({
      id: proximoMovId++,
      tipo: dados.tipo,
      produtoId: dados.produtoId,
      produtoNome: dados.produtoNome,
      produtoSku: dados.produtoSku,
      quantidade: dados.quantidade,
      quantidadeProduzida: dados.quantidadeProduzida,
      falhas: dados.falhas,
      motivo: dados.motivo,
      anterior: dados.anterior,
      novo: dados.novo,
      data: agora()
    });
  }

  function nomeTipoMov(tipo) {
    if (tipo === 'producao_entrada') return 'Produção (entrada)';
    if (tipo === 'producao_saida')   return 'Produção (consumo)';
    if (tipo === 'ajuste')           return 'Ajuste';
    if (tipo === 'venda')            return 'Venda';
    return tipo;
  }

  function corTipoMov(tipo) {
    if (tipo === 'producao_entrada') return 'sucesso';
    if (tipo === 'producao_saida')   return 'info';
    if (tipo === 'ajuste')           return 'atencao';
    if (tipo === 'venda')            return 'sucesso';
    return 'neutro';
  }

  function verMovimentacoes() {
    const lista = [...movimentacoes].sort((a, b) => b.data.localeCompare(a.data));

    const html = `
      <div class="modal-overlay ativo" id="modal-movimentacoes">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Movimentações de estoque</h2>
            <button class="modal__fechar" onclick="MODULO_ESTOQUE.fecharMovimentacoes()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            ${lista.length === 0 ? `
              <div class="vazio">
                <div class="vazio__icone">
                  <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                </div>
                <h3 class="vazio__titulo">Nenhuma movimentação ainda</h3>
                <p class="vazio__descricao">
                  As produções, ajustes e vendas aparecem aqui.
                </p>
              </div>
            ` : `
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Produto</th>
                    <th class="tabela__numero">Qtd</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  ${lista.map(m => `
                    <tr>
                      <td class="text-secundario">${formatarDataHora(m.data)}</td>
                      <td><span class="badge badge--${corTipoMov(m.tipo)}">${nomeTipoMov(m.tipo)}</span></td>
                      <td>
                        <div class="produto-nome">${escaparHTML(m.produtoNome)}</div>
                        ${m.produtoSku ? `<span class="sku">${escaparHTML(m.produtoSku)}</span>` : ''}
                      </td>
                      <td class="tabela__numero peso-semibold ${m.quantidade > 0 ? 'text-sucesso' : 'text-critico'}">
                        ${m.quantidade > 0 ? '+' : ''}${m.quantidade}
                      </td>
                      <td class="text-secundario">${escaparHTML(m.motivo || '—')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_ESTOQUE.fecharMovimentacoes()">Fechar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-movimentacoes')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharMovimentacoes() {
    document.getElementById('modal-movimentacoes')?.remove();
  }

  /* ==========================================================
     13. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'estoque') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-estoque-wrapper');
    if (wrapper) wrapper.innerHTML = renderTabela();
  }

  /* ==========================================================
     14. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirProducao,
    fecharProducao,
    recalcularProducao,
    confirmarProducao,
    abrirAjuste,
    fecharAjuste,
    confirmarAjuste,
    verMovimentacoes,
    fecharMovimentacoes,
    alterarFiltroBusca,
    alterarFiltroStatus,
    alterarFiltroCategoria,
    _classificarEstoque: classificarEstoque,
    _movimentacoes: () => [...movimentacoes]
  };

})();

window.MODULO_ESTOQUE = MODULO_ESTOQUE;
window.renderEstoque = MODULO_ESTOQUE.render;
