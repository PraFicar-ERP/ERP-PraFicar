/* ============================================================
   PRAFICAR ERP — MÓDULO PRECIFICAÇÃO (v4 com busca automática)
   Arquivo: assets/js/modulos/precificar.js
   Descrição: calcula custo real e formação de preço.
              - Margem de Lucro, Markup e Acréscimo separados
              - Sem mão de obra, sem energia, sem canal, sem perdas
              - Insumos com rendimento (compra → uso)
              - Impressora tank com 4 tintas
              - Pesquisa de mercado automática (Mercado Livre)
              - Botão "Salvar como produto"
   ============================================================ */

const MODULO_PRECIFICAR = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let precificacoes = [];
  let proximoId = 1;

  let materiais = [];

  let impressora = carregarImpressoraPadrao();

  let form = novoForm();

  let pesquisaMercado = {
    carregando: false,
    ok: false,
    erro: null,
    economico: null,
    mercado: null,
    premium: null,
    total: 0,
    data: null,
    fonte: null,
    doCache: false,
    aviso: null
  };

  let debouncePesquisa = null;
  let ultimoTermoPesquisado = '';

  function novoForm() {
    return {
      nome: '',
      categoria: '',
      quantidadeProduzida: 1,
      insumos: [],
      paginasImpressas: 0,
      tipoImpressao: 'colorida',
      margemDesejada: 40,
      meuPrecoVenda: null
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

  /* ==========================================================
     2. UTILITÁRIOS
     ========================================================== */

  function formatarMoeda(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarMoedaFina(v) {
    const n = Number(v) || 0;
    if (n === 0) return 'R$ 0,00';
    if (n < 0.01) return `R$ ${n.toFixed(4).replace('.', ',')}`;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarPercentual(v) {
    const n = Number(v) || 0;
    return `${n.toFixed(2).replace('.', ',')}%`;
  }

  function formatarMarkup(v) {
    const n = Number(v) || 0;
    return `${n.toFixed(2).replace('.', ',')}×`;
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

  /* ==========================================================
     3. CÁLCULO DA IMPRESSORA
     ========================================================== */

  function custoPorPaginaColorida() {
    const t = impressora.tintas;
    return (
      (t.preto.preco   / t.preto.rendimento) +
      (t.ciano.preco   / t.ciano.rendimento) +
      (t.magenta.preco / t.magenta.rendimento) +
      (t.amarelo.preco / t.amarelo.rendimento)
    );
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

  /* ==========================================================
     4. CÁLCULO DO INSUMO (COM RENDIMENTO)
     ========================================================== */

  function calcularCustoInsumo(precoPago, quantidadeCompra, rendimento) {
    const preco = Number(precoPago) || 0;
    const qtd = Number(quantidadeCompra) || 0;
    const rend = Number(rendimento) > 0 ? Number(rendimento) : 1;

    if (qtd <= 0) return { custoPorUnidadeCompra: 0, custoPorUnidadeUso: 0 };

    const custoPorUnidadeCompra = preco / qtd;
    const custoPorUnidadeUso = custoPorUnidadeCompra / rend;

    return { custoPorUnidadeCompra, custoPorUnidadeUso };
  }

  /* ==========================================================
     5. MOTOR DE CÁLCULO
     ========================================================== */

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
    const precoSugerido = divisor > 0.01
      ? arredondar2(custoUnitario / divisor)
      : 0;

    const indicadoresSugerido = calcularIndicadores(custoUnitario, precoSugerido);

    let indicadoresMeuPreco = null;
    const meuPreco = Number(form.meuPrecoVenda);
    if (meuPreco > 0) {
      indicadoresMeuPreco = calcularIndicadores(custoUnitario, meuPreco);
    }

    return {
      qtdProduzida,
      custoInsumos,
      custoImpressao: custoImpressaoTotal,
      custoTotal,
      custoUnitario,
      margemDesejada: margemPct,
      precoSugerido,
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

  /* ==========================================================
     6. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const r = calcular();

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Precificar</h1>
          <p class="pagina-header__subtitulo">
            Custo real → margem → preço sugerido.
          </p>
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
                <input
                  id="prec-nome"
                  type="text"
                  value="${escaparHTML(form.nome)}"
                  placeholder="Ex: Chaveiro Coração"
                  oninput="MODULO_PRECIFICAR.atualizar('nome', this.value)"
                />
                <span class="form-ajuda">A pesquisa de mercado é feita automaticamente.</span>
              </div>

              <div class="form-grupo">
                <label for="prec-qtd">Quantidade produzida (para rateio do custo)</label>
                <input
                  id="prec-qtd"
                  type="number"
                  min="1"
                  step="1"
                  value="${form.quantidadeProduzida}"
                  oninput="MODULO_PRECIFICAR.atualizar('quantidadeProduzida', this.value)"
                />
                <span class="form-ajuda">Use este número apenas para dividir o custo total. A produção real é registrada no módulo Produção.</span>
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
                  <input
                    id="prec-paginas"
                    type="number"
                    min="0"
                    step="1"
                    value="${form.paginasImpressas}"
                    oninput="MODULO_PRECIFICAR.atualizar('paginasImpressas', this.value)"
                  />
                </div>
                <div class="form-grupo">
                  <label for="prec-tipo-imp">Tipo de impressão</label>
                  <select
                    id="prec-tipo-imp"
                    onchange="MODULO_PRECIFICAR.atualizar('tipoImpressao', this.value)"
                  >
                    <option value="colorida" ${form.tipoImpressao === 'colorida' ? 'selected' : ''}>Colorida</option>
                    <option value="preta"    ${form.tipoImpressao === 'preta' ? 'selected' : ''}>Preta</option>
                  </select>
                </div>
                <div class="form-grupo">
                  <label>Custo por página</label>
                  <div class="prec-info-calc">
                    ${formatarMoedaFina(form.tipoImpressao === 'preta' ? custoPorPaginaPreta() : custoPorPaginaColorida())}
                  </div>
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
                <input
                  id="prec-margem"
                  type="range"
                  min="0"
                  max="95"
                  step="1"
                  value="${form.margemDesejada}"
                  oninput="MODULO_PRECIFICAR.atualizar('margemDesejada', this.value)"
                />
                <button class="margem-slider__btn" onclick="MODULO_PRECIFICAR.ajustarMargem(5)">+</button>
                <span class="margem-slider__valor">${form.margemDesejada}%</span>
              </div>
              <p class="form-ajuda">Margem = Lucro ÷ Preço de Venda × 100. Máximo 95%.</p>
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">5. Meu preço de venda</h3>
            </div>
            <div class="card__body">
              <div class="form-grupo">
                <label for="prec-meu-preco">Informe seu preço (opcional)</label>
                <input
                  id="prec-meu-preco"
                  type="number"
                  min="0"
                  step="0.01"
                  value="${form.meuPrecoVenda ?? ''}"
                  placeholder="Deixe em branco para usar o sugerido"
                  oninput="MODULO_PRECIFICAR.atualizar('meuPrecoVenda', this.value)"
                />
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

    const total = form.insumos.reduce((acc, i) =>
      acc + (Number(i.custoPorUnidadeUso) || 0) * (Number(i.quantidadeUsada) || 0), 0
    );

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
                ${i.rendimento > 1
                  ? `<div class="produto-desc">${i.quantidadeCompra} ${i.unidadeCompra} × ${i.rendimento} = ${(i.quantidadeCompra * i.rendimento).toLocaleString('pt-BR')} ${i.unidadeUso}</div>`
                  : ''}
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

  /* ==========================================================
     7. RENDER — COLUNA DIREITA
     ========================================================== */

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
            <span class="resultado-card__item-valor ${ind.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">
              ${formatarMoeda(ind.lucro)}
            </span>
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

      <button
        class="btn btn--ghost btn--bloco"
        onclick="MODULO_PRECIFICAR.toggleDetalhes()"
        style="margin-top: var(--esp-3);"
      >
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
      conteudo = `
        <div class="mercado-loading">
          <div class="mercado-loading__spinner"></div>
          <span>Buscando preços no Mercado Livre...</span>
        </div>
      `;
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
        <p class="form-ajuda mt-2">
          ${p.total} ${p.total === 1 ? 'resultado' : 'resultados'} ·
          ${escaparHTML(p.fonte || 'Mercado Livre')} · ${escaparHTML(p.data || '')}
          ${p.doCache ? ' · em cache' : ''}
          ${p.aviso ? ` · ${escaparHTML(p.aviso)}` : ''}
        </p>
      `;
    } else if (p.erro) {
      conteudo = `<p class="text-secundario">${escaparHTML(p.erro)}</p>`;
    } else {
      conteudo = `
        <p class="text-secundario">
          Digite o nome do produto (mínimo 3 letras) e a busca será feita automaticamente no Mercado Livre.
        </p>
      `;
    }

    return `
      <div class="card card--compacto mt-4 card-mercado-wrapper">
        <div class="card__header">
          <h3 class="card__titulo">Pesquisa de mercado</h3>
          <button
            class="btn btn--ghost btn--sm"
            onclick="MODULO_PRECIFICAR.forcarAtualizacaoPesquisa()"
            ${!form.nome.trim() || form.nome.trim().length < 3 ? 'disabled' : ''}
          >
            Atualizar
          </button>
        </div>
        <div class="card__body">
          ${conteudo}
        </div>
      </div>
    `;
  }

  function renderDetalhesCalculo(r) {
    return `
      <div class="calculo-detalhado">
        <h4 class="calculo-detalhado__titulo">Detalhamento do cálculo</h4>

        <div class="calculo-linha">
          <span>Insumos</span>
          <span>${formatarMoedaFina(r.custoInsumos)}</span>
        </div>
        <div class="calculo-linha">
          <span>Impressão (${form.paginasImpressas} páginas)</span>
          <span>${formatarMoedaFina(r.custoImpressao)}</span>
        </div>
        <div class="calculo-linha calculo-linha--destaque">
          <span>Custo total</span>
          <span>${formatarMoedaFina(r.custoTotal)}</span>
        </div>

        <div class="calculo-linha">
          <span>Quantidade no rateio</span>
          <span>${r.qtdProduzida} un</span>
        </div>
        <div class="calculo-linha calculo-linha--destaque">
          <span>Custo real por unidade</span>
          <span>${formatarMoedaFina(r.custoUnitario)}</span>
        </div>

        <div class="calculo-linha">
          <span>Margem desejada</span>
          <span>${formatarPercentual(r.margemDesejada)}</span>
        </div>
        <div class="calculo-linha">
          <span>Fórmula</span>
          <span>Custo ÷ (1 − Margem)</span>
        </div>
        <div class="calculo-linha calculo-linha--destaque">
          <span>Preço sugerido</span>
          <span>${formatarMoeda(r.precoSugerido)}</span>
        </div>

        ${r.meuPrecoVenda ? `
          <div class="calculo-linha calculo-linha--destaque">
            <span>Meu preço de venda</span>
            <span>${formatarMoeda(r.meuPrecoVenda)}</span>
          </div>
          <div class="calculo-linha">
            <span>Diferença vs sugerido</span>
            <span>${formatarMoeda(r.meuPrecoVenda - r.precoSugerido)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /* ==========================================================
     8. AÇÕES DO FORMULÁRIO
     ========================================================== */

  function atualizar(campo, valor) {
    form[campo] = valor;

    if (campo === 'nome') {
      agendarPesquisa(valor);
    }

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

  /* ==========================================================
     9. PESQUISA DE MERCADO AUTOMÁTICA
     ========================================================== */

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

    debouncePesquisa = setTimeout(() => {
      executarPesquisa(termoLimpo, false);
    }, 1000);
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
          carregando: false,
          ok: true,
          erro: null,
          economico: r.resultado.economico,
          mercado: r.resultado.mercado,
          premium: r.resultado.premium,
          total: r.resultado.total,
          data: r.resultado.data,
          fonte: r.resultado.fonte,
          doCache: r.doCache,
          aviso: r.aviso || null
        };
        ultimoTermoPesquisado = termo;
      } else {
        pesquisaMercado = {
          carregando: false,
          ok: false,
          erro: r.mensagem || 'Sem resultados.',
          economico: null, mercado: null, premium: null,
          total: 0, data: null, fonte: null, doCache: false, aviso: null
        };
      }
    } catch (e) {
      console.error('[PraFicar] Erro na pesquisa:', e);
      pesquisaMercado = {
        carregando: false,
        ok: false,
        erro: 'Erro ao pesquisar.',
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
   /* ============================================================
   PRAFICAR ERP — ESTILOS DO MÓDULO PRECIFICAR (v4)
   Arquivo: assets/css/modulos/precificar.css
   ============================================================ */

/* ============================================================
   1. LAYOUT EM 2 COLUNAS
   ============================================================ */

.precificar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: var(--esp-5);
  align-items: start;
}

.precificar-form {
  display: flex;
  flex-direction: column;
  gap: var(--esp-4);
  min-width: 0;
}

.precificar-resultado {
  position: sticky;
  top: calc(var(--altura-header) + var(--esp-4));
}

/* ============================================================
   2. LINHAS DE FORMULÁRIO
   ============================================================ */

.form-linha-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--esp-3);
}

.prec-info-calc {
  font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
  font-size: var(--texto-base);
  font-weight: var(--peso-bold);
  color: var(--azul-marinho);
  padding: var(--esp-3) var(--esp-4);
  background-color: var(--azul-suave);
  border-radius: var(--raio-md);
  letter-spacing: 0.02em;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   3. LISTA DE INSUMOS
   ============================================================ */

.insumos-vazio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--esp-3);
  padding: var(--esp-5) var(--esp-4);
  text-align: center;
  color: var(--cor-texto-secundario);
  font-size: var(--texto-sm);
  border: 1px dashed var(--cor-borda-media);
  border-radius: var(--raio-md);
  background-color: var(--cinza-50);
}

.tabela-insumos {
  font-size: var(--texto-sm);
}

.tabela-insumos tfoot td {
  padding-top: var(--esp-3);
  padding-bottom: var(--esp-3);
  border-top: 2px solid var(--cor-borda-suave);
  border-bottom: none;
}

/* ============================================================
   4. BLOCOS DO MODAL DE INSUMO
   ============================================================ */

.ins-bloco {
  margin-top: var(--esp-5);
  padding-top: var(--esp-5);
  border-top: 1px solid var(--cor-borda-suave);
}

.ins-bloco__titulo {
  font-size: var(--texto-sm);
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  color: var(--cor-texto-principal);
  margin-bottom: var(--esp-3);
  display: flex;
  align-items: center;
  gap: var(--esp-2);
}

.ins-bloco__opcional {
  font-size: var(--texto-xs);
  font-weight: var(--peso-regular);
  color: var(--cor-texto-secundario);
  text-transform: none;
  letter-spacing: 0;
}

.ins-resultado {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--esp-3);
}

.ins-resultado__item {
  padding: var(--esp-3) var(--esp-4);
  background-color: var(--cinza-50);
  border-radius: var(--raio-md);
  display: flex;
  flex-direction: column;
  gap: var(--esp-1);
}

.ins-resultado__item--destaque {
  background-color: var(--azul-suave);
}

.ins-resultado__label {
  font-size: var(--texto-xs);
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  color: var(--cor-texto-secundario);
}

.ins-resultado__item--destaque .ins-resultado__label {
  color: var(--azul-medio);
}

.ins-resultado__valor {
  font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
  font-size: var(--texto-lg);
  font-weight: var(--peso-bold);
  color: var(--cor-texto-principal);
  font-variant-numeric: tabular-nums;
}

.ins-resultado__item--destaque .ins-resultado__valor {
  color: var(--azul-marinho);
}

/* ============================================================
   5. IMPRESSORA
   ============================================================ */

.prec-impressora-info {
  font-size: var(--texto-sm);
  color: var(--cor-texto-secundario);
}

.imp-linha {
  margin-bottom: var(--esp-4);
  padding-bottom: var(--esp-4);
  border-bottom: 1px dashed var(--cor-borda-suave);
}

.imp-linha:last-of-type {
  border-bottom: none;
}

.imp-linha__titulo {
  display: flex;
  align-items: center;
  gap: var(--esp-2);
  font-weight: var(--peso-semibold);
  color: var(--cor-texto-principal);
  margin-bottom: var(--esp-3);
}

.imp-cor {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.imp-cor--preto   { background-color: #1F2733; }
.imp-cor--ciano   { background-color: #00B8D4; }
.imp-cor--magenta { background-color: #E91E63; }
.imp-cor--amarelo { background-color: #FFC107; }

.imp-totais {
  display: flex;
  flex-direction: column;
  gap: var(--esp-2);
  padding: var(--esp-4);
  background-color: var(--azul-suave);
  border-radius: var(--raio-md);
  margin-top: var(--esp-4);
}

.imp-totais > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--texto-sm);
}

.imp-totais strong {
  font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
  font-size: var(--texto-base);
  color: var(--azul-marinho);
}

/* ============================================================
   6. SLIDER DE MARGEM
   ============================================================ */

.margem-slider {
  display: flex;
  align-items: center;
  gap: var(--esp-3);
}

.margem-slider__btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--raio-md);
  background-color: var(--cinza-100);
  border: 1px solid var(--cor-borda-suave);
  color: var(--cor-texto-padrao);
  font-size: var(--texto-lg);
  font-weight: var(--peso-bold);
  cursor: pointer;
  transition: background-color var(--transicao-rapida), color var(--transicao-rapida);
}

.margem-slider__btn:hover {
  background-color: var(--azul-suave);
  color: var(--azul-medio);
}

.margem-slider input[type="range"] {
  flex: 1;
  accent-color: var(--azul-medio);
  height: 6px;
}

.margem-slider__valor {
  font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
  font-size: var(--texto-lg);
  font-weight: var(--peso-bold);
  color: var(--azul-marinho);
  min-width: 64px;
  text-align: right;
}

/* ============================================================
   7. CARD DE RESULTADO
   ============================================================ */

.resultado-card {
  background-color: var(--cor-fundo-card);
  border: 1px solid var(--cor-borda-suave);
  border-radius: var(--raio-lg);
  box-shadow: var(--sombra-md);
  overflow: hidden;
}

.resultado-card__header {
  padding: var(--esp-5);
  background-color: var(--cinza-50);
  border-bottom: 1px solid var(--cor-borda-suave);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--esp-1);
}

.resultado-card__label {
  font-size: var(--texto-xs);
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  color: var(--cor-texto-secundario);
}

.resultado-card__valor {
  font-size: var(--texto-2xl);
  font-weight: var(--peso-bold);
  color: var(--cor-texto-principal);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.resultado-card__sub {
  font-size: var(--texto-xs);
  color: var(--cor-texto-secundario);
}

.resultado-card__destaque {
  padding: var(--esp-6) var(--esp-5);
  background: linear-gradient(180deg, var(--azul-marinho) 0%, var(--azul-medio) 100%);
  color: var(--branco);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--esp-2);
}

.resultado-card__destaque .resultado-card__label {
  color: var(--azul-claro);
  opacity: 0.9;
}

.resultado-card__preco {
  font-size: var(--texto-3xl);
  font-weight: var(--peso-bold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.resultado-card__grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 1px solid var(--cor-borda-suave);
}

.resultado-card__item {
  padding: var(--esp-4) var(--esp-3);
  display: flex;
  flex-direction: column;
  gap: var(--esp-1);
  text-align: center;
}

.resultado-card__item + .resultado-card__item {
  border-left: 1px solid var(--cor-borda-suave);
}

.resultado-card__item-label {
  font-size: var(--texto-xs);
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  color: var(--cor-texto-secundario);
}

.resultado-card__item-valor {
  font-size: var(--texto-md);
  font-weight: var(--peso-bold);
  font-variant-numeric: tabular-nums;
  color: var(--cor-texto-principal);
}

.resultado-card__acrescimo {
  padding: var(--esp-3) var(--esp-5);
  text-align: center;
  font-size: var(--texto-sm);
  color: var(--cor-texto-secundario);
  background-color: var(--cinza-50);
}

.resultado-card__acrescimo strong {
  color: var(--cor-texto-principal);
}

/* ============================================================
   8. CARD MERCADO
   ============================================================ */

.card--compacto {
  box-shadow: var(--sombra-xs);
}

.mercado-faixas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--esp-2);
}

.mercado-faixa {
  padding: var(--esp-3);
  border-radius: var(--raio-md);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--esp-1);
}

.mercado-faixa--eco     { background-color: var(--verde-suave); color: #1E6B3E; }
.mercado-faixa--mercado { background-color: var(--azul-suave); color: var(--azul-marinho); }
.mercado-faixa--premium { background-color: var(--ambar-suave); color: #8A5D0A; }

.mercado-faixa__label {
  font-size: 10px;
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  opacity: 0.8;
}

.mercado-faixa__valor {
  font-size: var(--texto-md);
  font-weight: var(--peso-bold);
  font-variant-numeric: tabular-nums;
}

.mercado-loading {
  display: flex;
  align-items: center;
  gap: var(--esp-3);
  padding: var(--esp-4);
  background-color: var(--cinza-50);
  border-radius: var(--raio-md);
  font-size: var(--texto-sm);
  color: var(--cor-texto-secundario);
}

.mercado-loading__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--cor-borda-suave);
  border-top-color: var(--azul-medio);
  border-radius: 50%;
  animation: mercado-spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes mercado-spin {
  to { transform: rotate(360deg); }
}

/* ============================================================
   9. DETALHAMENTO
   ============================================================ */

.resultado-detalhes {
  margin-top: var(--esp-3);
  padding: var(--esp-4) var(--esp-5);
  background-color: var(--cinza-50);
  border: 1px solid var(--cor-borda-suave);
  border-radius: var(--raio-lg);
}

.calculo-detalhado__titulo {
  font-size: var(--texto-xs);
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  color: var(--cor-texto-secundario);
  margin-bottom: var(--esp-3);
}

.calculo-linha {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--esp-2) 0;
  font-size: var(--texto-sm);
  color: var(--cor-texto-padrao);
  border-bottom: 1px dashed var(--cor-borda-suave);
}

.calculo-linha:last-child {
  border-bottom: none;
}

.calculo-linha--destaque {
  font-weight: var(--peso-semibold);
  color: var(--cor-texto-principal);
  border-bottom: 1px solid var(--cor-borda-media);
  padding-top: var(--esp-3);
}

.calculo-linha span:last-child {
  font-variant-numeric: tabular-nums;
}

/* ============================================================
   10. MODAL SALVAR COMO PRODUTO
   ============================================================ */

.resumo-salvar {
  background-color: var(--cinza-50);
  border: 1px solid var(--cor-borda-suave);
  border-radius: var(--raio-md);
  padding: var(--esp-4) var(--esp-5);
  margin-bottom: var(--esp-5);
}

.resumo-salvar__linha {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--esp-2) 0;
  font-size: var(--texto-sm);
  color: var(--cor-texto-padrao);
  border-bottom: 1px dashed var(--cor-borda-suave);
}

.resumo-salvar__linha:last-child {
  border-bottom: none;
}

.resumo-salvar__linha strong {
  font-variant-numeric: tabular-nums;
  color: var(--cor-texto-principal);
}

.resumo-salvar__linha--destaque {
  border-top: 1px solid var(--cor-borda-media);
  border-bottom: none;
  padding-top: var(--esp-3);
  font-size: var(--texto-base);
}

.resumo-salvar__linha--destaque strong {
  color: var(--azul-medio);
  font-size: var(--texto-lg);
}

/* ============================================================
   11. RESPONSIVO
   ============================================================ */

@media (max-width: 1024px) {
  .precificar-layout {
    grid-template-columns: 1fr;
  }

  .precificar-resultado {
    position: static;
    order: -1;
  }
}

@media (max-width: 640px) {
  .resultado-card__grid-3 {
    grid-template-columns: 1fr;
  }

  .resultado-card__item + .resultado-card__item {
    border-left: none;
    border-top: 1px solid var(--cor-borda-suave);
  }

  .mercado-faixas {
    grid-template-columns: 1fr;
  }

  .ins-resultado {
    grid-template-columns: 1fr;
  }
}
