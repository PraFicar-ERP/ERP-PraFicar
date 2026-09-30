/* ============================================================
   PRAFICAR ERP — MÓDULO PRECIFICAÇÃO (v4)
   Arquivo: assets/js/modulos/precificar.js
   ============================================================ */

const MODULO_PRECIFICAR = (() => {

  let precificacoes = [];
  let proximoId = 1;
  let materiais = [];
  let impressora = carregarImpressoraPadrao();
  let form = novoForm();
  let pesquisaMercado = {
    carregando: false, ok: false, erro: null,
    economico: null, mercado: null, premium: null,
    total: 0, data: null, fonte: null, doCache: false, aviso: null
  };
  let debouncePesquisa = null;
  let ultimoTermoPesquisado = '';

  function novoForm() {
    return {
      nome: '', categoria: '', quantidadeProduzida: 1, insumos: [],
      paginasImpressas: 0, tipoImpressao: 'colorida',
      margemDesejada: 40, meuPrecoVenda: null
    };
  }

  function carregarImpressoraPadrao() {
    return {
      modelo: 'Epson EcoTank (colorida)',
      tintas: {
        preto:   { preco: 60, rendimento: 4500 },
        ciano:   { preco: 45, rendimento: 7500 },
        magenta: { preco: 45, rendimento: 7500 },
        amarelo: { preco: 45, rendimento: 7500 }
      }
    };
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

  function formatarPercentual(v) {
    const n = Number(v) || 0;
    return n.toFixed(2).replace('.', ',') + '%';
  }

  function formatarMarkup(v) {
    const n = Number(v) || 0;
    return n.toFixed(2).replace('.', ',') + '×';
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

  function custoPorPaginaColorida() {
    const t = impressora.tintas;
    return (t.preto.preco / t.preto.rendimento) +
           (t.ciano.preco / t.ciano.rendimento) +
           (t.magenta.preco / t.magenta.rendimento) +
           (t.amarelo.preco / t.amarelo.rendimento);
  }

  function custoPorPaginaPreta() {
    const t = impressora.tintas;
    return t.preto.preco / t.preto.rendimento;
  }

  function custoImpressao() {
    const paginas = Number(form.paginasImpressas) || 0;
    if (paginas <= 0) return 0;
    const custoPag = form.tipoImpressao === 'preta'
      ? custoPorPaginaPreta()
      : custoPorPaginaColorida();
    return paginas * custoPag;
  }

  function calcularCustoInsumo(precoPago, quantidadeCompra, rendimento) {
    const preco = Number(precoPago) || 0;
    const qtd = Number(quantidadeCompra) || 0;
    const rend = Number(rendimento) > 0 ? Number(rendimento) : 1;
    if (qtd <= 0) return { custoPorUnidadeCompra: 0, custoPorUnidadeUso: 0 };
    const custoPorUnidadeCompra = preco / qtd;
    const custoPorUnidadeUso = custoPorUnidadeCompra / rend;
    return { custoPorUnidadeCompra, custoPorUnidadeUso };
  }

  function calcular() {
    const qtdProduzida = Math.max(1, Number(form.quantidadeProduzida) || 1);
    const custoInsumos = form.insumos.reduce((acc, i) => {
      return acc + (Number(i.custoPorUnidadeUso) || 0) * (Number(i.quantidadeUsada) || 0);
    }, 0);
    const custoImpressaoTotal = custoImpressao();
    const custoTotal = custoInsumos + custoImpressaoTotal;
    const custoUnitario = custoTotal / qtdProduzida;
    const margemPct = Math.min(95, Math.max(0, Number(form.margemDesejada) || 0));
    const margemDec = margemPct / 100;
    const divisor = 1 - margemDec;
    const precoSugerido = divisor > 0.01 ? arredondar2(custoUnitario / divisor) : 0;
    const indicadoresSugerido = calcularIndicadores(custoUnitario, precoSugerido);
    let indicadoresMeuPreco = null;
    const meuPreco = Number(form.meuPrecoVenda);
    if (meuPreco > 0) {
      indicadoresMeuPreco = calcularIndicadores(custoUnitario, meuPreco);
    }
    return {
      qtdProduzida, custoInsumos, custoImpressao: custoImpressaoTotal,
      custoTotal, custoUnitario, margemDesejada: margemPct, precoSugerido,
      indicadoresSugerido,
      meuPrecoVenda: meuPreco > 0 ? meuPreco : null,
      indicadoresMeuPreco
    };
  }

  function calcularIndicadores(custo, preco) {
    if (custo <= 0 || preco <= 0) {
      return { custo, preco, lucro: 0, margem: 0, markup: 0, acrescimo: 0 };
    }
    const lucro = preco - custo;
    const margem = (lucro / preco) * 100;
    const markup = preco / custo;
    const acrescimo = (lucro / custo) * 100;
    return { custo, preco, lucro, margem, markup, acrescimo };
  }

  function render() {
    const r = calcular();
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Precificar</h1>
          <p class="pagina-header__subtitulo">Custo real → margem → preço sugerido.</p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.abrirConfigImpressora()">
            ⚙ Impressora
          </button>
          <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.limpar()">
            Limpar
          </button>
          <button class="btn btn--primario" onclick="MODULO_PRECIFICAR.salvarComoProduto()">
            Salvar como produto
          </button>
        </div>
      </div>

      <div class="precificar-layout">
        <div class="precificar-form">

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">1. Produto</h3>
            </div>
            <div class="card__body">
              <div class="form-grupo">
                <label for="prec-nome">Nome do produto</label>
                <input id="prec-nome" type="text" value="${escaparHTML(form.nome)}" placeholder="Ex: Chaveiro Coração" oninput="MODULO_PRECIFICAR.atualizar('nome', this.value)" />
                <span class="form-ajuda">A pesquisa de mercado é feita automaticamente.</span>
              </div>
              <div class="form-grupo">
                <label for="prec-qtd">Quantidade produzida</label>
                <input id="prec-qtd" type="number" min="1" step="1" value="${form.quantidadeProduzida}" oninput="MODULO_PRECIFICAR.atualizar('quantidadeProduzida', this.value)" />
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">2. Insumos</h3>
              <button class="btn btn--secundario btn--sm" onclick="MODULO_PRECIFICAR.abrirModalInsumo()">
                + Adicionar insumo
              </button>
            </div>
            <div class="card__body">
              ${renderListaInsumos()}
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">3. Impressão</h3>
              <span class="prec-impressora-info">${escaparHTML(impressora.modelo)}</span>
            </div>
            <div class="card__body">
              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="prec-paginas">Páginas impressas</label>
                  <input id="prec-paginas" type="number" min="0" step="1" value="${form.paginasImpressas}" oninput="MODULO_PRECIFICAR.atualizar('paginasImpressas', this.value)" />
                </div>
                <div class="form-grupo">
                  <label for="prec-tipo-imp">Tipo de impressão</label>
                  <select id="prec-tipo-imp" onchange="MODULO_PRECIFICAR.atualizar('tipoImpressao', this.value)">
                    <option value="colorida" ${form.tipoImpressao === 'colorida' ? 'selected' : ''}>Colorida</option>
                    <option value="preta" ${form.tipoImpressao === 'preta' ? 'selected' : ''}>Preta</option>
                  </select>
                </div>
                <div class="form-grupo">
                  <label>Custo por página</label>
                  <div class="prec-info-calc">${formatarMoedaFina(form.tipoImpressao === 'preta' ? custoPorPaginaPreta() : custoPorPaginaColorida())}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">4. Margem desejada</h3>
            </div>
            <div class="card__body">
              <div class="margem-slider">
                <button class="margem-slider__btn" onclick="MODULO_PRECIFICAR.ajustarMargem(-5)">−</button>
                <input id="prec-margem" type="range" min="0" max="95" step="1" value="${form.margemDesejada}" oninput="MODULO_PRECIFICAR.atualizar('margemDesejada', this.value)" />
                <button class="margem-slider__btn" onclick="MODULO_PRECIFICAR.ajustarMargem(5)">+</button>
                <span class="margem-slider__valor">${form.margemDesejada}%</span>
              </div>
              <p class="form-ajuda">Margem = Lucro ÷ Preço × 100. Máximo 95%.</p>
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">5. Meu preço de venda</h3>
            </div>
            <div class="card__body">
              <div class="form-grupo">
                <label for="prec-meu-preco">Informe seu preço (opcional)</label>
                <input id="prec-meu-preco" type="number" min="0" step="0.01" value="${form.meuPrecoVenda ?? ''}" placeholder="Deixe em branco para usar o sugerido" oninput="MODULO_PRECIFICAR.atualizar('meuPrecoVenda', this.value)" />
              </div>
            </div>
          </div>

        </div>

        <div class="precificar-resultado">
          ${renderResultado(r)}
        </div>
      </div>
    `;
  }

  function renderListaInsumos() {
    if (form.insumos.length === 0) {
      return `
        <div class="insumos-vazio">
          <p>Nenhum insumo adicionado ainda.</p>
          <button class="btn btn--secundario btn--sm" onclick="MODULO_PRECIFICAR.abrirModalInsumo()">
            + Adicionar o primeiro insumo
          </button>
        </div>
      `;
    }
    const total = form.insumos.reduce((acc, i) => {
      return acc + (Number(i.custoPorUnidadeUso) || 0) * (Number(i.quantidadeUsada) || 0);
    }, 0);
    return `
      <table class="tabela tabela-insumos">
        <thead>
          <tr>
            <th>Insumo</th>
            <th class="tabela__numero">Custo un.</th>
            <th class="tabela__numero">Qtd</th>
            <th class="tabela__numero">Subtotal</th>
            <th class="tabela__acao"></th>
          </tr>
        </thead>
        <tbody>
          ${form.insumos.map((i, idx) => `
            <tr>
              <td>
                <div class="produto-nome">${escaparHTML(i.nome)}</div>
                ${i.rendimento > 1 ? '<div class="produto-desc">' + i.quantidadeCompra + ' ' + i.unidadeCompra + ' × ' + i.rendimento + ' = ' + (i.quantidadeCompra * i.rendimento) + ' ' + i.unidadeUso + '</div>' : ''}
              </td>
              <td class="tabela__numero">${formatarMoedaFina(i.custoPorUnidadeUso)}</td>
              <td class="tabela__numero">${i.quantidadeUsada} ${i.unidadeUso || ''}</td>
              <td class="tabela__numero peso-semibold">${formatarMoedaFina((Number(i.custoPorUnidadeUso) || 0) * (Number(i.quantidadeUsada) || 0))}</td>
              <td class="tabela__acao">
                <button class="btn-icone btn-icone--perigo" title="Remover" onclick="MODULO_PRECIFICAR.removerInsumo(${idx})">
                  <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="text-right peso-semibold">Total de insumos</td>
            <td class="tabela__numero peso-bold text-principal">${formatarMoedaFina(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  function renderResultado(r) {
    const ind = r.indicadoresMeuPreco || r.indicadoresSugerido;
    const precoExibido = r.meuPrecoVenda || r.precoSugerido;
    const usandoMeuPreco = !!r.meuPrecoVenda;
    return `
      <div class="resultado-card">
        <div class="resultado-card__header">
          <span class="resultado-card__label">Custo real por unidade</span>
          <span class="resultado-card__valor">${formatarMoedaFina(r.custoUnitario)}</span>
          <span class="resultado-card__sub">${r.qtdProduzida} un no rateio</span>
        </div>
        <div class="resultado-card__destaque">
          <span class="resultado-card__label">${usandoMeuPreco ? 'Meu preço de venda' : 'Preço sugerido'}</span>
          <span class="resultado-card__preco">${formatarMoeda(precoExibido)}</span>
        </div>
        <div class="resultado-card__grid-3">
          <div class="resultado-card__item">
            <span class="resultado-card__item-label">Lucro</span>
            <span class="resultado-card__item-valor ${ind.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(ind.lucro)}</span>
          </div>
          <div class="resultado-card__item">
            <span class="resultado-card__item-label">Margem</span>
            <span class="resultado-card__item-valor">${formatarPercentual(ind.margem)}</span>
          </div>
          <div class="resultado-card__item">
            <span class="resultado-card__item-label">Markup</span>
            <span class="resultado-card__item-valor">${formatarMarkup(ind.markup)}</span>
          </div>
        </div>
        <div class="resultado-card__acrescimo">
          Acréscimo sobre custo: <strong>${formatarPercentual(ind.acrescimo)}</strong>
        </div>
      </div>

      ${renderCardMercado()}

      <button class="btn btn--ghost btn--bloco" onclick="MODULO_PRECIFICAR.toggleDetalhes()" style="margin-top: var(--esp-3);">
        Ver cálculo completo
      </button>

      <div class="resultado-detalhes hidden" id="resultado-detalhes">
        ${renderDetalhesCalculo(r)}
      </div>
    `;
  }

  function renderCardMercado() {
    const p = pesquisaMercado;
    let conteudo = '';
    if (p.carregando) {
      conteudo = '<div class="mercado-loading"><div class="mercado-loading__spinner"></div><span>Buscando preços no Mercado Livre...</span></div>';
    } else if (p.ok) {
      conteudo = `
        <div class="mercado-faixas">
          <div class="mercado-faixa mercado-faixa--eco">
            <span class="mercado-faixa__label">Econômico</span>
            <span class="mercado-faixa__valor">${formatarMoeda(p.economico)}</span>
          </div>
          <div class="mercado-faixa mercado-faixa--mercado">
            <span class="mercado-faixa__label">Mercado</span>
            <span class="mercado-faixa__valor">${formatarMoeda(p.mercado)}</span>
          </div>
          <div class="mercado-faixa mercado-faixa--premium">
            <span class="mercado-faixa__label">Premium</span>
            <span class="mercado-faixa__valor">${formatarMoeda(p.premium)}</span>
          </div>
        </div>
        <p class="form-ajuda mt-2">${p.total} resultados · ${escaparHTML(p.fonte || '')} · ${escaparHTML(p.data || '')}${p.doCache ? ' · em cache' : ''}</p>
      `;
    } else if (p.erro) {
      conteudo = '<p class="text-secundario">' + escaparHTML(p.erro) + '</p>';
    } else {
      conteudo = '<p class="text-secundario">Digite o nome do produto (mínimo 3 letras) e a busca será feita automaticamente no Mercado Livre.</p>';
    }
    return `
      <div class="card card--compacto mt-4 card-mercado-wrapper">
        <div class="card__header">
          <h3 class="card__titulo">Pesquisa de mercado</h3>
          <button class="btn btn--ghost btn--sm" onclick="MODULO_PRECIFICAR.forcarAtualizacaoPesquisa()" ${!form.nome.trim() || form.nome.trim().length < 3 ? 'disabled' : ''}>
            Atualizar
          </button>
        </div>
        <div class="card__body">${conteudo}</div>
      </div>
    `;
  }

  function renderDetalhesCalculo(r) {
    return `
      <div class="calculo-detalhado">
        <h4 class="calculo-detalhado__titulo">Detalhamento do cálculo</h4>
        <div class="calculo-linha"><span>Insumos</span><span>${formatarMoedaFina(r.custoInsumos)}</span></div>
        <div class="calculo-linha"><span>Impressão (${form.paginasImpressas} páginas)</span><span>${formatarMoedaFina(r.custoImpressao)}</span></div>
        <div class="calculo-linha calculo-linha--destaque"><span>Custo total</span><span>${formatarMoedaFina(r.custoTotal)}</span></div>
        <div class="calculo-linha"><span>Quantidade no rateio</span><span>${r.qtdProduzida} un</span></div>
        <div class="calculo-linha calculo-linha--destaque"><span>Custo real por unidade</span><span>${formatarMoedaFina(r.custoUnitario)}</span></div>
        <div class="calculo-linha"><span>Margem desejada</span><span>${formatarPercentual(r.margemDesejada)}</span></div>
        <div class="calculo-linha"><span>Fórmula</span><span>Custo ÷ (1 − Margem)</span></div>
        <div class="calculo-linha calculo-linha--destaque"><span>Preço sugerido</span><span>${formatarMoeda(r.precoSugerido)}</span></div>
        ${r.meuPrecoVenda ? `
          <div class="calculo-linha calculo-linha--destaque"><span>Meu preço de venda</span><span>${formatarMoeda(r.meuPrecoVenda)}</span></div>
          <div class="calculo-linha"><span>Diferença vs sugerido</span><span>${formatarMoeda(r.meuPrecoVenda - r.precoSugerido)}</span></div>
        ` : ''}
      </div>
    `;
  }
     function atualizar(campo, valor) {
    form[campo] = valor;
    if (campo === 'nome') agendarPesquisa(valor);
    atualizarResultado();
  }

  function ajustarMargem(delta) {
    let m = Number(form.margemDesejada) + delta;
    m = Math.min(95, Math.max(0, m));
    form.margemDesejada = m;
    rerenderForm();
  }

  function atualizarResultado() {
    const coluna = document.querySelector('.precificar-resultado');
    if (!coluna) return;
    const r = calcular();
    coluna.innerHTML = renderResultado(r);
  }

  function toggleDetalhes() {
    const d = document.getElementById('resultado-detalhes');
    if (d) d.classList.toggle('hidden');
  }

  function agendarPesquisa(termo) {
    if (debouncePesquisa) clearTimeout(debouncePesquisa);
    const termoLimpo = String(termo || '').trim();
    if (termoLimpo.length < 3) {
      pesquisaMercado = {
        carregando: false, ok: false, erro: null,
        economico: null, mercado: null, premium: null,
        total: 0, data: null, fonte: null, doCache: false, aviso: null
      };
      atualizarCardMercado();
      return;
    }
    if (termoLimpo === ultimoTermoPesquisado && pesquisaMercado.ok) return;
    debouncePesquisa = setTimeout(() => executarPesquisa(termoLimpo, false), 1000);
  }

  async function executarPesquisa(termo, forcar) {
    if (!window.PESQUISA_MERCADO) return;
    pesquisaMercado.carregando = true;
    pesquisaMercado.erro = null;
    atualizarCardMercado();
    try {
      const r = await window.PESQUISA_MERCADO.pesquisar(termo, forcar);
      if (r.ok) {
        pesquisaMercado = {
          carregando: false, ok: true, erro: null,
          economico: r.resultado.economico, mercado: r.resultado.mercado,
          premium: r.resultado.premium, total: r.resultado.total,
          data: r.resultado.data, fonte: r.resultado.fonte,
          doCache: r.doCache, aviso: r.aviso || null
        };
        ultimoTermoPesquisado = termo;
      } else {
        pesquisaMercado = {
          carregando: false, ok: false, erro: r.mensagem || 'Sem resultados.',
          economico: null, mercado: null, premium: null,
          total: 0, data: null, fonte: null, doCache: false, aviso: null
        };
      }
    } catch (e) {
      console.error('[PraFicar] Erro na pesquisa:', e);
      pesquisaMercado = {
        carregando: false, ok: false, erro: 'Erro ao pesquisar.',
        economico: null, mercado: null, premium: null,
        total: 0, data: null, fonte: null, doCache: false, aviso: null
      };
    }
    atualizarCardMercado();
  }

  function forcarAtualizacaoPesquisa() {
    const termo = form.nome.trim();
    if (termo.length < 3) return;
    executarPesquisa(termo, true);
  }

  function atualizarCardMercado() {
    const container = document.querySelector('.card-mercado-wrapper');
    if (container) container.outerHTML = renderCardMercado();
  }

  function abrirModalInsumo() {
    const html = `
      <div class="modal-overlay ativo" id="modal-insumo">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Adicionar insumo</h2>
            <button class="modal__fechar" onclick="MODULO_PRECIFICAR.fecharModalInsumo()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal__body">
            <div class="form-grupo">
              <label>Insumo já cadastrado</label>
              <select id="ins-material" onchange="MODULO_PRECIFICAR.aoEscolherMaterial()">
                <option value="">+ Cadastrar novo insumo</option>
                ${materiais.map((m, idx) => '<option value="' + idx + '" data-nome="' + escaparHTML(m.nome) + '">' + escaparHTML(m.nome) + ' — ' + formatarMoedaFina(m.custoPorUnidadeUso) + '/' + m.unidadeUso + '</option>').join('')}
              </select>
            </div>

            <div class="form-grupo">
              <label for="ins-nome">Nome do insumo <span class="form-obrigatorio">*</span></label>
              <input id="ins-nome" type="text" placeholder="Ex: Adesivo Personalizado" />
            </div>

            <div class="ins-bloco">
              <div class="ins-bloco__titulo">Compra</div>
              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="ins-preco-pago">Preço pago (R$)</label>
                  <input id="ins-preco-pago" type="number" min="0" step="0.01" placeholder="0,00" oninput="MODULO_PRECIFICAR.recalcularCustoInsumo()" />
                </div>
                <div class="form-grupo">
                  <label for="ins-qtd-comprada">Quantidade comprada</label>
                  <input id="ins-qtd-comprada" type="number" min="0.01" step="0.01" value="1" oninput="MODULO_PRECIFICAR.recalcularCustoInsumo()" />
                </div>
                <div class="form-grupo">
                  <label for="ins-unidade-compra">Unidade de compra</label>
                  <select id="ins-unidade-compra" onchange="MODULO_PRECIFICAR.recalcularCustoInsumo()">
                    <option value="unidade">Unidade</option>
                    <option value="pacote">Pacote</option>
                    <option value="caixa">Caixa</option>
                    <option value="rolo">Rolo</option>
                    <option value="resma">Resma</option>
                    <option value="folha">Folha</option>
                    <option value="litro">Litro</option>
                    <option value="kg">Kg</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="ins-bloco">
              <div class="ins-bloco__titulo">Rendimento <span class="ins-bloco__opcional">(opcional)</span></div>
              <p class="form-ajuda">Use quando 1 unidade de compra rende várias unidades de uso. Ex: 1 folha rende 100 adesivos.</p>
              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="ins-rendimento">Cada unidade rende</label>
                  <input id="ins-rendimento" type="number" min="1" step="1" value="1" oninput="MODULO_PRECIFICAR.recalcularCustoInsumo()" />
                </div>
                <div class="form-grupo">
                  <label for="ins-unidade-uso">Unidade de uso</label>
                  <select id="ins-unidade-uso" onchange="MODULO_PRECIFICAR.recalcularCustoInsumo()">
                    <option value="unidade">Unidade</option>
                    <option value="adesivo">Adesivo</option>
                    <option value="folha">Folha</option>
                    <option value="foto">Foto</option>
                    <option value="metro">Metro</option>
                    <option value="cm">Centímetro</option>
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                  </select>
                </div>
                <div class="form-grupo">
                  <label>Total de unidades</label>
                  <div class="prec-info-calc" id="ins-total-uso">1 unidade</div>
                </div>
              </div>
            </div>

            <div class="ins-bloco">
              <div class="ins-bloco__titulo">Custo calculado</div>
              <div class="ins-resultado">
                <div class="ins-resultado__item">
                  <span class="ins-resultado__label">Custo por unidade de compra</span>
                  <span class="ins-resultado__valor" id="ins-custo-compra">R$ 0,00</span>
                </div>
                <div class="ins-resultado__item ins-resultado__item--destaque">
                  <span class="ins-resultado__label">Custo por unidade de uso</span>
                  <span class="ins-resultado__valor" id="ins-custo-uso">R$ 0,00</span>
                </div>
              </div>
            </div>

            <div class="ins-bloco">
              <div class="ins-bloco__titulo">Uso nesta produção</div>
              <div class="form-linha">
                <div class="form-grupo">
                  <label for="ins-qtd-usada">Quantidade usada</label>
                  <input id="ins-qtd-usada" type="number" min="0" step="0.01" value="1" oninput="MODULO_PRECIFICAR.recalcularSubtotalInsumo()" />
                </div>
                <div class="form-grupo">
                  <label>Subtotal</label>
                  <div class="prec-info-calc" id="ins-subtotal">R$ 0,00</div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.fecharModalInsumo()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_PRECIFICAR.adicionarInsumo()">Adicionar insumo</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-insumo')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('ins-nome')?.focus(), 50);
  }

  function fecharModalInsumo() {
    document.getElementById('modal-insumo')?.remove();
  }

  function aoEscolherMaterial() {
    const sel = document.getElementById('ins-material');
    if (!sel || !sel.value) return;
    const material = materiais[Number(sel.value)];
    if (!material) return;
    document.getElementById('ins-nome').value = material.nome;
    document.getElementById('ins-preco-pago').value = material.precoPago;
    document.getElementById('ins-qtd-comprada').value = material.quantidadeCompra;
    document.getElementById('ins-unidade-compra').value = material.unidadeCompra || 'unidade';
    document.getElementById('ins-rendimento').value = material.rendimento || 1;
    document.getElementById('ins-unidade-uso').value = material.unidadeUso || 'unidade';
    recalcularCustoInsumo();
  }

  function recalcularCustoInsumo() {
    const preco = Number(document.getElementById('ins-preco-pago')?.value) || 0;
    const qtdCompra = Number(document.getElementById('ins-qtd-comprada')?.value) || 0;
    const rendimento = Number(document.getElementById('ins-rendimento')?.value) || 1;
    const r = calcularCustoInsumo(preco, qtdCompra, rendimento);
    const elCompra = document.getElementById('ins-custo-compra');
    const elUso = document.getElementById('ins-custo-uso');
    const elTotalUso = document.getElementById('ins-total-uso');
    if (elCompra) elCompra.textContent = formatarMoedaFina(r.custoPorUnidadeCompra);
    if (elUso) elUso.textContent = formatarMoedaFina(r.custoPorUnidadeUso);
    if (elTotalUso) elTotalUso.textContent = (qtdCompra * rendimento).toLocaleString('pt-BR') + ' unidades';
    recalcularSubtotalInsumo();
  }

  function recalcularSubtotalInsumo() {
    const preco = Number(document.getElementById('ins-preco-pago')?.value) || 0;
    const qtdCompra = Number(document.getElementById('ins-qtd-comprada')?.value) || 0;
    const rendimento = Number(document.getElementById('ins-rendimento')?.value) || 1;
    const qtdUsada = Number(document.getElementById('ins-qtd-usada')?.value) || 0;
    const r = calcularCustoInsumo(preco, qtdCompra, rendimento);
    const subtotal = r.custoPorUnidadeUso * qtdUsada;
    const el = document.getElementById('ins-subtotal');
    if (el) el.textContent = formatarMoedaFina(subtotal);
  }

  function adicionarInsumo() {
    const nome = document.getElementById('ins-nome').value.trim();
    const preco = Number(document.getElementById('ins-preco-pago').value) || 0;
    const qtdCompra = Number(document.getElementById('ins-qtd-comprada').value) || 0;
    const unidadeCompra = document.getElementById('ins-unidade-compra').value;
    const rendimento = Number(document.getElementById('ins-rendimento').value) || 1;
    const unidadeUso = document.getElementById('ins-unidade-uso').value;
    const qtdUsada = Number(document.getElementById('ins-qtd-usada').value) || 0;
    if (!nome) return alert('Informe o nome do insumo.');
    if (preco <= 0) return alert('Informe o preço pago.');
    if (qtdCompra <= 0) return alert('Informe a quantidade comprada.');
    if (rendimento < 1) return alert('O rendimento deve ser pelo menos 1.');
    if (qtdUsada <= 0) return alert('Informe a quantidade usada.');

    const calc = calcularCustoInsumo(preco, qtdCompra, rendimento);
    const idxExistente = materiais.findIndex(m => m.nome === nome);
    const material = {
      nome, precoPago: preco, quantidadeCompra: qtdCompra, unidadeCompra,
      rendimento, unidadeUso,
      custoPorUnidadeCompra: calc.custoPorUnidadeCompra,
      custoPorUnidadeUso: calc.custoPorUnidadeUso,
      atualizadoEm: new Date().toISOString()
    };
    if (idxExistente === -1) materiais.push(material);
    else materiais[idxExistente] = material;

    form.insumos.push({
      nome, precoPago: preco, quantidadeCompra: qtdCompra, unidadeCompra,
      rendimento, unidadeUso,
      custoPorUnidadeCompra: calc.custoPorUnidadeCompra,
      custoPorUnidadeUso: calc.custoPorUnidadeUso,
      quantidadeUsada: qtdUsada
    });

    fecharModalInsumo();
    rerenderForm();
  }

  function removerInsumo(idx) {
    form.insumos.splice(idx, 1);
    rerenderForm();
  }

  function abrirConfigImpressora() {
    const t = impressora.tintas;
    const html = `
      <div class="modal-overlay ativo" id="modal-impressora">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Configurar impressora</h2>
            <button class="modal__fechar" onclick="MODULO_PRECIFICAR.fecharModalImpressora()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal__body">
            <div class="form-grupo">
              <label for="imp-modelo">Modelo da impressora</label>
              <input id="imp-modelo" type="text" value="${escaparHTML(impressora.modelo)}" />
            </div>
            <p class="form-ajuda">Configure preço e rendimento de cada tinta.</p>
            ${['preto', 'ciano', 'magenta', 'amarelo'].map(cor => `
              <div class="imp-linha">
                <div class="imp-linha__titulo">
                  <span class="imp-cor imp-cor--${cor}"></span>
                  ${cor.charAt(0).toUpperCase() + cor.slice(1)}
                </div>
                <div class="form-linha-3">
                  <div class="form-grupo">
                    <label>Preço do frasco (R$)</label>
                    <input type="number" min="0" step="0.01" value="${t[cor].preco}" oninput="MODULO_PRECIFICAR.atualizarImpressora('${cor}', 'preco', this.value)" />
                  </div>
                  <div class="form-grupo">
                    <label>Rendimento (páginas)</label>
                    <input type="number" min="1" step="1" value="${t[cor].rendimento}" oninput="MODULO_PRECIFICAR.atualizarImpressora('${cor}', 'rendimento', this.value)" />
                  </div>
                  <div class="form-grupo">
                    <label>Custo por página</label>
                    <div class="prec-info-calc" id="imp-custo-${cor}">${formatarMoedaFina(t[cor].preco / t[cor].rendimento)}</div>
                  </div>
                </div>
              </div>
            `).join('')}
            <div class="imp-totais">
              <div><span>Custo por página preta:</span><strong id="imp-total-preta">${formatarMoedaFina(custoPorPaginaPreta())}</strong></div>
              <div><span>Custo por página colorida:</span><strong id="imp-total-colorida">${formatarMoedaFina(custoPorPaginaColorida())}</strong></div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.fecharModalImpressora()">Fechar</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-impressora')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharModalImpressora() {
    document.getElementById('modal-impressora')?.remove();
    atualizarResultado();
  }

  function atualizarImpressora(cor, campo, valor) {
    impressora.tintas[cor][campo] = Number(valor) || 0;
    const t = impressora.tintas[cor];
    const el = document.getElementById('imp-custo-' + cor);
    if (el) el.textContent = formatarMoedaFina(t.rendimento > 0 ? t.preco / t.rendimento : 0);
    const elPreta = document.getElementById('imp-total-preta');
    const elColor = document.getElementById('imp-total-colorida');
    if (elPreta) elPreta.textContent = formatarMoedaFina(custoPorPaginaPreta());
    if (elColor) elColor.textContent = formatarMoedaFina(custoPorPaginaColorida());
  }

  function salvarComoProduto() {
    const r = calcular();
    if (!form.nome.trim()) return alert('Informe o nome do produto antes de salvar.');
    if (form.insumos.length === 0 && form.paginasImpressas === 0) {
      return alert('Adicione pelo menos um insumo ou páginas de impressão.');
    }
    if (!window.MODULO_PRODUTOS?._criarDoPrecificador) {
      return alert('Módulo de Produtos não está disponível.');
    }
    const categorias = window.SKU_PRAFICAR?.listarCategorias() || [];
    if (categorias.length === 0) return alert('Nenhuma categoria disponível.');
    const precoFinal = r.meuPrecoVenda || r.precoSugerido;
    const html = `
      <div class="modal-overlay ativo" id="modal-salvar-produto">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Salvar como produto</h2>
            <button class="modal__fechar" onclick="MODULO_PRECIFICAR.fecharModalSalvar()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal__body">
            <div class="resumo-salvar">
              <div class="resumo-salvar__linha"><span>Nome</span><strong>${escaparHTML(form.nome)}</strong></div>
              <div class="resumo-salvar__linha"><span>Custo real</span><strong>${formatarMoedaFina(r.custoUnitario)}</strong></div>
              <div class="resumo-salvar__linha"><span>Preço sugerido</span><strong>${formatarMoeda(r.precoSugerido)}</strong></div>
              <div class="resumo-salvar__linha resumo-salvar__linha--destaque"><span>Preço a salvar</span><strong>${formatarMoeda(precoFinal)}</strong></div>
            </div>
            <div class="form-grupo">
              <label for="salvar-categoria">Categoria <span class="form-obrigatorio">*</span></label>
              <select id="salvar-categoria" required>
                <option value="">Selecione uma categoria</option>
                ${categorias.map(c => '<option value="' + c.codigo + '">' + c.nome + '</option>').join('')}
              </select>
            </div>
            <div class="form-grupo">
              <label for="salvar-estoque-min">Estoque mínimo</label>
              <input id="salvar-estoque-min" type="number" min="0" step="1" value="5" />
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.fecharModalSalvar()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_PRECIFICAR.confirmarSalvarProduto()">Criar produto</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-salvar-produto')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharModalSalvar() {
    document.getElementById('modal-salvar-produto')?.remove();
  }

  function confirmarSalvarProduto() {
    const categoria = document.getElementById('salvar-categoria').value;
    const estoqueMin = Number(document.getElementById('salvar-estoque-min').value) || 0;
    if (!categoria) return alert('Selecione uma categoria.');
    const r = calcular();
    const precoFinal = r.meuPrecoVenda || r.precoSugerido;
    try {
      const produto = window.MODULO_PRODUTOS._criarDoPrecificador({
        nome: form.nome.trim(), categoria, descricao: '',
        custo: r.custoUnitario, precoVarejo: precoFinal, precoAtacado: precoFinal,
        estoqueMinimo: estoqueMin, insumos: form.insumos.map(i => ({ ...i })),
        paginasImpressas: form.paginasImpressas, tipoImpressao: form.tipoImpressao
      });
      fecharModalSalvar();
      alert('Produto criado com sucesso!\n\nSKU: ' + produto.sku + '\nCusto: ' + formatarMoedaFina(produto.custo) + '\nPreço: ' + formatarMoeda(produto.precoVarejo));
      setTimeout(() => window.ROUTER_PRAFICAR?.irPara('produtos'), 300);
    } catch (e) {
      console.error(e);
      alert('Erro ao criar produto: ' + e.message);
    }
  }

  function limpar() {
    if (!confirm('Limpar todo o formulário?')) return;
    form = novoForm();
    pesquisaMercado = {
      carregando: false, ok: false, erro: null,
      economico: null, mercado: null, premium: null,
      total: 0, data: null, fonte: null, doCache: false, aviso: null
    };
    ultimoTermoPesquisado = '';
    rerenderForm();
  }

  function rerenderForm() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'precificar') {
      container.innerHTML = render();
    }
  }

  return {
    render, atualizar, ajustarMargem,
    abrirModalInsumo, fecharModalInsumo, aoEscolherMaterial,
    recalcularCustoInsumo, recalcularSubtotalInsumo,
    adicionarInsumo, removerInsumo, toggleDetalhes,
    abrirConfigImpressora, fecharModalImpressora, atualizarImpressora,
    forcarAtualizacaoPesquisa,
    salvarComoProduto, fecharModalSalvar, confirmarSalvarProduto,
    limpar,
    _listar: () => [...precificacoes],
    _materiais: () => [...materiais]
  };

})();

window.MODULO_PRECIFICAR = MODULO_PRECIFICAR;
window.renderPrecificar = MODULO_PRECIFICAR.render;
