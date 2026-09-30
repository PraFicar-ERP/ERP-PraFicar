/* ============================================================
   PRAFICAR ERP — MÓDULO PRECIFICAÇÃO (v2 ENTERPRISE)
   Arquivo: assets/js/modulos/precificar.js
   Descrição: cálculo de custo real e formação de preço.
              Margem de Lucro, Markup e Acréscimo calculados
              SEPARADAMENTE. Sem mão de obra, sem energia, sem
              canal de venda. Insumos com embalagem/rendimento.
              Impressora tank com 4 tintas configurável.
   ============================================================ */

const MODULO_PRECIFICAR = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let precificacoes = [];
  let proximoId = 1;

  // Base de insumos reutilizáveis (em memória)
  let materiais = [];

  // Impressora (singleton — você tem uma)
  let impressora = carregarImpressoraPadrao();

  let form = novoForm();
  let pesquisaMercado = {
    economico: null,
    mercado:   null,
    premium:   null,
    resultados: 0,
    data: null
  };

  function novoForm() {
    return {
      nome: '',
      quantidadeProduzida: 1,
      quantidadePerdas: 0,
      insumos: [],              // [{materialId, nome, custoUnitario, quantidade}]
      paginasImpressas: 0,
      tipoImpressao: 'colorida',// colorida | preta
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
     4. MOTOR DE CÁLCULO
     ========================================================== */

  function calcular() {
    const qtdProduzida = Math.max(1, Number(form.quantidadeProduzida) || 1);
    const qtdPerdas    = Math.min(qtdProduzida - 1, Math.max(0, Number(form.quantidadePerdas) || 0));
    const aproveitaveis = qtdProduzida - qtdPerdas;

    const custoInsumos = form.insumos.reduce((acc, i) => {
      return acc + (Number(i.custoUnitario) || 0) * (Number(i.quantidade) || 0);
    }, 0);

    const custoImpressaoTotal = custoImpressao();
    const custoTotal = custoInsumos + custoImpressaoTotal;

    const custoUnitarioSemPerdas = custoTotal / qtdProduzida;
    const custoUnitarioReal = aproveitaveis > 0 ? custoTotal / aproveitaveis : 0;
    const custoAdicionalPorPerda = custoUnitarioReal - custoUnitarioSemPerdas;

    const perdaSobreProducao = qtdProduzida > 0 ? (qtdPerdas / qtdProduzida) * 100 : 0;
    const aumentoCustoUnitario = custoUnitarioSemPerdas > 0
      ? ((custoUnitarioReal - custoUnitarioSemPerdas) / custoUnitarioSemPerdas) * 100
      : 0;

    const margemPct = Math.min(95, Math.max(0, Number(form.margemDesejada) || 0));
    const margemDec = margemPct / 100;
    const divisor = 1 - margemDec;
    const precoSugerido = divisor > 0.01
      ? arredondar2(custoUnitarioReal / divisor)
      : 0;

    const indicadoresSugerido = calcularIndicadores(custoUnitarioReal, precoSugerido);

    let indicadoresMeuPreco = null;
    const meuPreco = Number(form.meuPrecoVenda);
    if (meuPreco > 0) {
      indicadoresMeuPreco = calcularIndicadores(custoUnitarioReal, meuPreco);
    }

    return {
      qtdProduzida,
      qtdPerdas,
      aproveitaveis,

      custoInsumos,
      custoImpressao: custoImpressaoTotal,
      custoTotal,

      custoUnitarioSemPerdas,
      custoUnitarioReal,
      custoAdicionalPorPerda,

      perdaSobreProducao,
      aumentoCustoUnitario,

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
     5. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const r = calcular();

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Precificar</h1>
          <p class="pagina-header__subtitulo">
            Custo real → margem → preço. Tudo calculado automaticamente.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.abrirConfigImpressora()">
            ⚙ Impressora
          </button>
          <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.limpar()">
            Limpar
          </button>
          <button class="btn btn--primario" onclick="MODULO_PRECIFICAR.salvar()">
            Salvar precificação
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
                  placeholder="Ex: Marca-páginas Coração"
                  oninput="MODULO_PRECIFICAR.atualizar('nome', this.value)"
                />
              </div>

              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="prec-qtd">Quantidade produzida</label>
                  <input
                    id="prec-qtd"
                    type="number"
                    min="1"
                    step="1"
                    value="${form.quantidadeProduzida}"
                    oninput="MODULO_PRECIFICAR.atualizar('quantidadeProduzida', this.value)"
                  />
                </div>

                <div class="form-grupo">
                  <label for="prec-perdas">Quantidade de perdas</label>
                  <input
                    id="prec-perdas"
                    type="number"
                    min="0"
                    step="1"
                    value="${form.quantidadePerdas}"
                    oninput="MODULO_PRECIFICAR.atualizar('quantidadePerdas', this.value)"
                  />
                  <span class="form-ajuda">Unidades perdidas na produção.</span>
                </div>

                <div class="form-grupo">
                  <label>Quantidade aproveitável</label>
                  <div class="prec-info-calc">${r.aproveitaveis} un</div>
                </div>
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
                    <option value="preta"    ${form.tipoImpressao === 'preta' ? 'selected' : ''}>Preta (só preto)</option>
                  </select>
                </div>
                <div class="form-grupo">
                  <label>Custo por página</label>
                  <div class="prec-info-calc">
                    ${formatarMoeda(form.tipoImpressao === 'preta' ? custoPorPaginaPreta() : custoPorPaginaColorida())}
                  </div>
                </div>
              </div>
              <p class="form-ajuda">
                Configure preço e rendimento das tintas em <strong>Impressora</strong>. O papel deve ser adicionado como insumo separadamente.
              </p>
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
              <p class="form-ajuda">Margem de Lucro = Lucro ÷ Preço de Venda × 100. Máximo 95%.</p>
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
                <span class="form-ajuda">Se informado, o sistema recalcula os indicadores com o seu preço.</span>
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
      acc + (Number(i.custoUnitario) || 0) * (Number(i.quantidade) || 0), 0
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
              <td>${escaparHTML(i.nome)}</td>
              <td class="tabela__numero">${formatarMoeda(i.custoUnitario)}</td>
              <td class="tabela__numero">${i.quantidade}</td>
              <td class="tabela__numero peso-semibold">${formatarMoeda((Number(i.custoUnitario) || 0) * (Number(i.quantidade) || 0))}</td>
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
            <td class="tabela__numero peso-bold text-principal">${formatarMoeda(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  /* ==========================================================
     6. RENDER — COLUNA DIREITA
     ========================================================== */

  function renderResultado(r) {
    const ind = r.indicadoresMeuPreco || r.indicadoresSugerido;
    const precoExibido = r.meuPrecoVenda || r.precoSugerido;
    const usandoMeuPreco = !!r.meuPrecoVenda;

    return `
      <div class="resultado-card">
        <div class="resultado-card__header">
          <span class="resultado-card__label">Custo real por unidade</span>
          <span class="resultado-card__valor">${formatarMoeda(r.custoUnitarioReal)}</span>
          <span class="resultado-card__sub">${r.aproveitaveis} un aproveitáveis</span>
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

      ${renderCardPerdas(r)}

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

  function renderCardPerdas(r) {
    if (r.qtdPerdas === 0) {
      return `
        <div class="card card--compacto mt-4">
          <div class="card__header">
            <h3 class="card__titulo">Impacto das perdas</h3>
          </div>
          <div class="card__body">
            <p class="text-secundario">Nenhuma perda informada. Custo unitário já é o real.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="card card--compacto mt-4">
        <div class="card__header">
          <h3 class="card__titulo">Impacto das perdas</h3>
        </div>
        <div class="card__body">
          <div class="impacto-linha">
            <span>Produção total</span>
            <strong>${r.qtdProduzida} un</strong>
          </div>
          <div class="impacto-linha">
            <span>Unidades perdidas</span>
            <strong class="text-critico">${r.qtdPerdas} un</strong>
          </div>
          <div class="impacto-linha">
            <span>Aproveitáveis</span>
            <strong>${r.aproveitaveis} un</strong>
          </div>
          <div class="impacto-linha impacto-linha--destaque">
            <span>Custo sem perdas</span>
            <strong>${formatarMoeda(r.custoUnitarioSemPerdas)}</strong>
          </div>
          <div class="impacto-linha impacto-linha--destaque">
            <span>Custo real</span>
            <strong>${formatarMoeda(r.custoUnitarioReal)}</strong>
          </div>
          <div class="impacto-linha">
            <span>Custo adicional por unidade</span>
            <strong class="text-atencao">+ ${formatarMoeda(r.custoAdicionalPorPerda)}</strong>
          </div>
          <div class="impacto-linha">
            <span>Perda sobre produção</span>
            <strong>${formatarPercentual(r.perdaSobreProducao)}</strong>
          </div>
          <div class="impacto-linha">
            <span>Aumento no custo unitário</span>
            <strong class="text-atencao">+ ${formatarPercentual(r.aumentoCustoUnitario)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  function renderCardMercado() {
    const p = pesquisaMercado;

    return `
      <div class="card card--compacto mt-4">
        <div class="card__header">
          <h3 class="card__titulo">Pesquisa de mercado</h3>
          <button class="btn btn--ghost btn--sm" onclick="MODULO_PRECIFICAR.abrirModalMercado()">
            ${p.data ? 'Editar' : 'Cadastrar referência'}
          </button>
        </div>
        <div class="card__body">
          ${p.data ? `
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
              ${p.resultados} ${p.resultados === 1 ? 'resultado' : 'resultados'} ·
              Atualizado em ${p.data}
            </p>
          ` : `
            <p class="text-secundario">
              Cadastre faixas de referência manualmente (Econômico, Mercado, Premium) para comparar seu preço com o mercado.
            </p>
          `}
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
          <span>${formatarMoeda(r.custoInsumos)}</span>
        </div>
        <div class="calculo-linha">
          <span>Impressão (${form.paginasImpressas} páginas)</span>
          <span>${formatarMoeda(r.custoImpressao)}</span>
        </div>
        <div class="calculo-linha calculo-linha--destaque">
          <span>Custo total de produção</span>
          <span>${formatarMoeda(r.custoTotal)}</span>
        </div>

        <div class="calculo-linha">
          <span>Produção total</span>
          <span>${r.qtdProduzida} un</span>
        </div>
        <div class="calculo-linha">
          <span>Perdas</span>
          <span>${r.qtdPerdas} un</span>
        </div>
        <div class="calculo-linha calculo-linha--destaque">
          <span>Custo real por unidade aproveitável</span>
          <span>${formatarMoeda(r.custoUnitarioReal)}</span>
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
     7. AÇÕES
     ========================================================== */

  function atualizar(campo, valor) {
    form[campo] = valor;
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
     8. INSUMOS — MODAL
     ========================================================== */

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
              <label>Insumo cadastrado</label>
              <select id="ins-material" onchange="MODULO_PRECIFICAR.aoEscolherMaterial()">
                <option value="">+ Cadastrar novo insumo</option>
                ${materiais.map((m, idx) => `
                  <option value="${idx}" data-nome="${escaparHTML(m.nome)}" data-custo="${m.custoUnitario}">
                    ${escaparHTML(m.nome)} — ${formatarMoeda(m.custoUnitario)}/${m.unidadeConsumo}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="ins-nome">Nome <span class="form-obrigatorio">*</span></label>
                <input id="ins-nome" type="text" placeholder="Ex: Papel A4" />
              </div>
              <div class="form-grupo">
                <label for="ins-unidade-compra">Unidade de compra</label>
                <select id="ins-unidade-compra">
                  <option value="unidade">Unidade</option>
                  <option value="pacote">Pacote</option>
                  <option value="caixa">Caixa</option>
                  <option value="rolo">Rolo</option>
                  <option value="resma">Resma</option>
                  <option value="litro">Litro</option>
                  <option value="kg">Kg</option>
                </select>
              </div>
            </div>

            <div class="form-linha-3">
              <div class="form-grupo">
                <label for="ins-qtd-comprada">Quantidade comprada</label>
                <input id="ins-qtd-comprada" type="number" min="0.01" step="0.01" value="1" oninput="MODULO_PRECIFICAR.recalcularCustoInsumo()" />
              </div>
              <div class="form-grupo">
                <label for="ins-preco-pago">Preço pago (R$)</label>
                <input id="ins-preco-pago" type="number" min="0" step="0.01" placeholder="0,00" oninput="MODULO_PRECIFICAR.recalcularCustoInsumo()" />
              </div>
              <div class="form-grupo">
                <label>Custo unitário</label>
                <div class="prec-info-calc" id="ins-custo-unitario">R$ 0,00</div>
              </div>
            </div>

            <div class="form-linha-3">
              <div class="form-grupo">
                <label for="ins-unidade-consumo">Unidade de consumo</label>
                <select id="ins-unidade-consumo">
                  <option value="unidade">Unidade</option>
                  <option value="folha">Folha</option>
                  <option value="metro">Metro</option>
                  <option value="cm">Centímetro</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                </select>
              </div>
              <div class="form-grupo">
                <label for="ins-qtd-utilizada">Quantidade utilizada</label>
                <input id="ins-qtd-utilizada" type="number" min="0" step="0.01" value="1" oninput="MODULO_PRECIFICAR.recalcularSubtotalInsumo()" />
              </div>
              <div class="form-grupo">
                <label>Subtotal</label>
                <div class="prec-info-calc" id="ins-subtotal">R$ 0,00</div>
              </div>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.fecharModalInsumo()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_PRECIFICAR.adicionarInsumo()">Adicionar</button>
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
    const opt = sel.options[sel.selectedIndex];
    document.getElementById('ins-nome').value = opt.dataset.nome || '';
  }

  function recalcularCustoInsumo() {
    const qtd = Number(document.getElementById('ins-qtd-comprada')?.value) || 0;
    const preco = Number(document.getElementById('ins-preco-pago')?.value) || 0;
    const custo = qtd > 0 ? preco / qtd : 0;
    const el = document.getElementById('ins-custo-unitario');
    if (el) el.textContent = formatarMoeda(custo);
    recalcularSubtotalInsumo();
  }

  function recalcularSubtotalInsumo() {
    const qtdComprada = Number(document.getElementById('ins-qtd-comprada')?.value) || 0;
    const preco = Number(document.getElementById('ins-preco-pago')?.value) || 0;
    const qtdUtilizada = Number(document.getElementById('ins-qtd-utilizada')?.value) || 0;
    const custo = qtdComprada > 0 ? preco / qtdComprada : 0;
    const sub = custo * qtdUtilizada;
    const el = document.getElementById('ins-subtotal');
    if (el) el.textContent = formatarMoeda(sub);
  }

  function adicionarInsumo() {
    const nome = document.getElementById('ins-nome').value.trim();
    const qtdComprada = Number(document.getElementById('ins-qtd-comprada').value) || 0;
    const preco = Number(document.getElementById('ins-preco-pago').value) || 0;
    const qtdUtilizada = Number(document.getElementById('ins-qtd-utilizada').value) || 0;
    const unidadeConsumo = document.getElementById('ins-unidade-consumo').value;
    const unidadeCompra = document.getElementById('ins-unidade-compra').value;

    if (!nome) return alert('Informe o nome do insumo.');
    if (preco <= 0) return alert('Informe o preço pago.');
    if (qtdComprada <= 0) return alert('Informe a quantidade comprada.');
    if (qtdUtilizada < 0) return alert('Quantidade utilizada inválida.');

    const custoUnitario = preco / qtdComprada;

    const idxExistente = materiais.findIndex(m => m.nome === nome);
    if (idxExistente === -1) {
      materiais.push({
        nome,
        unidadeCompra,
        quantidadeComprada: qtdComprada,
        precoPago: preco,
        unidadeConsumo,
        custoUnitario,
        atualizadoEm: new Date().toISOString()
      });
    } else {
      materiais[idxExistente] = {
        ...materiais[idxExistente],
        unidadeCompra,
        quantidadeComprada: qtdComprada,
        precoPago: preco,
        unidadeConsumo,
        custoUnitario,
        atualizadoEm: new Date().toISOString()
      };
    }

    form.insumos.push({
      nome,
      custoUnitario,
      quantidade: qtdUtilizada,
      unidadeConsumo
    });

    fecharModalInsumo();
    rerenderForm();
  }

  function removerInsumo(idx) {
    form.insumos.splice(idx, 1);
    rerenderForm();
  }

  /* ==========================================================
     9. IMPRESSORA — MODAL
     ========================================================== */

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

            <p class="form-ajuda">
              Configure preço do frasco e rendimento (em páginas) de cada tinta.
              O custo por página será calculado automaticamente.
            </p>

            ${['preto', 'ciano', 'magenta', 'amarelo'].map(cor => `
              <div class="imp-linha">
                <div class="imp-linha__titulo">
                  <span class="imp-cor imp-cor--${cor}"></span>
                  ${cor.charAt(0).toUpperCase() + cor.slice(1)}
                </div>
                <div class="form-linha-3">
                  <div class="form-grupo">
                    <label>Preço do frasco (R$)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value="${t[cor].preco}"
                      oninput="MODULO_PRECIFICAR.atualizarImpressora('${cor}', 'preco', this.value)"
                    />
                  </div>
                  <div class="form-grupo">
                    <label>Rendimento (páginas)</label>
                    <input
                      type="number" min="1" step="1"
                      value="${t[cor].rendimento}"
                      oninput="MODULO_PRECIFICAR.atualizarImpressora('${cor}', 'rendimento', this.value)"
                    />
                  </div>
                  <div class="form-grupo">
                    <label>Custo por página</label>
                    <div class="prec-info-calc" id="imp-custo-${cor}">
                      ${formatarMoeda(t[cor].preco / t[cor].rendimento)}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}

            <div class="imp-totais">
              <div>
                <span>Custo por página preta:</span>
                <strong id="imp-total-preta">${formatarMoeda(custoPorPaginaPreta())}</strong>
              </div>
              <div>
                <span>Custo por página colorida:</span>
                <strong id="imp-total-colorida">${formatarMoeda(custoPorPaginaColorida())}</strong>
              </div>
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
    const el = document.getElementById(`imp-custo-${cor}`);
    if (el) el.textContent = formatarMoeda(t.rendimento > 0 ? t.preco / t.rendimento : 0);

    const elPreta = document.getElementById('imp-total-preta');
    const elColor = document.getElementById('imp-total-colorida');
    if (elPreta) elPreta.textContent = formatarMoeda(custoPorPaginaPreta());
    if (elColor) elColor.textContent = formatarMoeda(custoPorPaginaColorida());
  }

  /* ==========================================================
     10. PESQUISA DE MERCADO — MODAL
     ========================================================== */

  function abrirModalMercado() {
    const p = pesquisaMercado;
    const html = `
      <div class="modal-overlay ativo" id="modal-mercado">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Referência de mercado</h2>
            <button class="modal__fechar" onclick="MODULO_PRECIFICAR.fecharModalMercado()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <p class="form-ajuda">
              Informe faixas de preço do mercado para comparar com seu preço.
              Estas são apenas referências — não alteram o preço automaticamente.
            </p>

            <div class="form-linha-3">
              <div class="form-grupo">
                <label for="merc-eco">Econômico (R$)</label>
                <input id="merc-eco" type="number" min="0" step="0.01" value="${p.economico ?? ''}" placeholder="0,00" />
              </div>
              <div class="form-grupo">
                <label for="merc-med">Mercado (R$)</label>
                <input id="merc-med" type="number" min="0" step="0.01" value="${p.mercado ?? ''}" placeholder="0,00" />
              </div>
              <div class="form-grupo">
                <label for="merc-prem">Premium (R$)</label>
                <input id="merc-prem" type="number" min="0" step="0.01" value="${p.premium ?? ''}" placeholder="0,00" />
              </div>
            </div>

            <div class="form-grupo">
              <label for="merc-resultados">Número de resultados pesquisados</label>
              <input id="merc-resultados" type="number" min="0" step="1" value="${p.resultados || 0}" />
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.fecharModalMercado()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_PRECIFICAR.salvarMercado()">Salvar referência</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-mercado')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharModalMercado() {
    document.getElementById('modal-mercado')?.remove();
  }

  function salvarMercado() {
    pesquisaMercado = {
      economico: Number(document.getElementById('merc-eco').value) || 0,
      mercado:   Number(document.getElementById('merc-med').value) || 0,
      premium:   Number(document.getElementById('merc-prem').value) || 0,
      resultados: Number(document.getElementById('merc-resultados').value) || 0,
      data: new Date().toLocaleString('pt-BR')
    };
    fecharModalMercado();
    rerenderForm();
  }

  /* ==========================================================
     11. LIMPAR / SALVAR
     ========================================================== */

  function limpar() {
    if (!confirm('Limpar todo o formulário?')) return;
    form = novoForm();
    rerenderForm();
  }

  function salvar() {
    const r = calcular();

    if (!form.nome.trim()) return alert('Dê um nome ao produto antes de salvar.');
    if (form.insumos.length === 0 && form.paginasImpressas === 0) {
      return alert('Adicione pelo menos um insumo ou páginas de impressão.');
    }

    const registro = {
      id: proximoId++,
      nome: form.nome.trim(),
      quantidadeProduzida: r.qtdProduzida,
      quantidadePerdas: r.qtdPerdas,
      aproveitaveis: r.aproveitaveis,
      custoTotal: r.custoTotal,
      custoUnitarioReal: r.custoUnitarioReal,
      margemDesejada: r.margemDesejada,
      precoSugerido: r.precoSugerido,
      meuPrecoVenda: r.meuPrecoVenda,
      insumos: form.insumos.map(i => ({ ...i })),
      paginasImpressas: form.paginasImpressas,
      criadoEm: new Date().toISOString()
    };

    precificacoes.push(registro);

    alert(
      `Precificação salva!\n\n` +
      `Custo real: ${formatarMoeda(r.custoUnitarioReal)}\n` +
      `Preço sugerido: ${formatarMoeda(r.precoSugerido)}\n` +
      `Margem: ${formatarPercentual(r.indicadoresSugerido.margem)}\n` +
      `Markup: ${formatarMarkup(r.indicadoresSugerido.markup)}`
    );
  }

  /* ==========================================================
     12. RERENDER
     ========================================================== */

  function rerenderForm() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'precificar') {
      container.innerHTML = render();
    }
  }

  /* ==========================================================
     13. API PÚBLICA
     ========================================================== */

  return {
    render,
    atualizar,
    ajustarMargem,
    abrirModalInsumo,
    fecharModalInsumo,
    aoEscolherMaterial,
    recalcularCustoInsumo,
    recalcularSubtotalInsumo,
    adicionarInsumo,
    removerInsumo,
    toggleDetalhes,
    abrirConfigImpressora,
    fecharModalImpressora,
    atualizarImpressora,
    abrirModalMercado,
    fecharModalMercado,
    salvarMercado,
    limpar,
    salvar,
    _listar: () => [...precificacoes],
    _materiais: () => [...materiais]
  };

})();

window.MODULO_PRECIFICAR = MODULO_PRECIFICAR;
window.renderPrecificar = MODULO_PRECIFICAR.render;
