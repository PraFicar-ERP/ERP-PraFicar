/* ============================================================
   PRAFICAR ERP — MÓDULO PRECIFICAÇÃO
   Arquivo: assets/js/modulos/precificar.js
   Descrição: calcula custo real e preço sugerido de um produto,
              considerando insumos, perdas, mão de obra, energia,
              embalagem, taxa do canal e frete.

   Regra: o usuário vê apenas CUSTO / PREÇO / LUCRO / MARGEM.
          O detalhamento fica em "Ver cálculo".

   Não persiste em banco. Salva em memória durante a sessão.
   ============================================================ */

const MODULO_PRECIFICAR = (() => {

  /* ==========================================================
     1. ESTADO EM MEMÓRIA
     ========================================================== */

  let precificacoes = [];   // histórico em memória
  let proximoId = 1;

  // Estado do formulário em construção
  let form = novoForm();

  function novoForm() {
    return {
      nome: '',
      categoria: '',
      quantidadeProduzida: 1,
      perdaPercentual: 0,
      insumos: [],               // [{nome, custoUnitario, quantidade}]
      maoDeObra: { valorHora: 0, minutos: 0 },
      energia: 0,
      embalagem: 0,
      outrosCustos: 0,
      canalId: '',
      freteVendedor: 0,
      margemDesejada: 40
    };
  }

  /* ==========================================================
     2. UTILITÁRIOS
     ========================================================== */

  function formatarMoeda(valor) {
    const n = Number(valor) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarPercentual(valor) {
    const n = Number(valor) || 0;
    return `${n.toFixed(1).replace('.', ',')}%`;
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

  function arredondar2(v) {
    return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  }

  /* ==========================================================
     3. MOTOR DE CÁLCULO
     ========================================================== */

  function calcular() {
    const qtd = Math.max(1, Number(form.quantidadeProduzida) || 1);

    // --- Insumos ---
    const custoInsumos = form.insumos.reduce((acc, i) => {
      return acc + (Number(i.custoUnitario) || 0) * (Number(i.quantidade) || 0);
    }, 0);

    // --- Mão de obra ---
    const custoMaoDeObra =
      (Number(form.maoDeObra.valorHora) || 0) *
      ((Number(form.maoDeObra.minutos) || 0) / 60);

    // --- Outros custos diretos ---
    const custoEnergia   = Number(form.energia) || 0;
    const custoEmbalagem = Number(form.embalagem) || 0;
    const custoOutros    = Number(form.outrosCustos) || 0;

    // --- Custo base de produção (lote) ---
    const custoBaseLote =
      custoInsumos +
      custoMaoDeObra +
      custoEnergia +
      custoEmbalagem +
      custoOutros;

    // --- Perdas ---
    const perdaPct = Math.min(99, Math.max(0, Number(form.perdaPercentual) || 0));
    const producaoUtil = qtd * (1 - perdaPct / 100);
    const fatorPerda = producaoUtil > 0 ? (qtd / producaoUtil) : 1;

    const custoLoteComPerda = custoBaseLote * fatorPerda;
    const custoUnitario = custoLoteComPerda / qtd;

    // --- Canal ---
    const canal = window.MODULO_CANAIS?._buscar(form.canalId);
    const taxaPct = canal ? Number(canal.taxaPercentual) || 0 : 0;
    const taxaFixa = canal ? Number(canal.taxaFixa) || 0 : 0;
    const freteVendedor = Number(form.freteVendedor) || 0;

    // --- Preço sugerido ---
    // preco = (custoUnitario + taxaFixa + frete) / (1 - margem - taxaPct)
    const margem = Math.min(95, Math.max(0, Number(form.margemDesejada) || 0)) / 100;
    const divisor = 1 - margem - (taxaPct / 100);
    const custoFixoPorUnidade = taxaFixa + freteVendedor;

    let precoSugerido = 0;
    if (divisor > 0.01) {
      precoSugerido = (custoUnitario + custoFixoPorUnidade) / divisor;
    } else {
      // Margem + taxa inviáveis — evita divisão por zero
      precoSugerido = (custoUnitario + custoFixoPorUnidade) * 3;
    }
    precoSugerido = arredondar2(precoSugerido);

    // --- Lucro líquido real no preço sugerido ---
    const taxaCanalValor = precoSugerido * (taxaPct / 100);
    const lucroLiquido = precoSugerido - custoUnitario - taxaCanalValor - taxaFixa - freteVendedor;
    const margemReal = precoSugerido > 0 ? (lucroLiquido / precoSugerido) * 100 : 0;

    return {
      qtd,
      custoInsumos,
      custoMaoDeObra,
      custoEnergia,
      custoEmbalagem,
      custoOutros,
      custoBaseLote,
      perdaPct,
      producaoUtil,
      fatorPerda,
      custoLoteComPerda,
      custoUnitario,
      canal,
      taxaPct,
      taxaFixa,
      freteVendedor,
      margemDesejada: Number(form.margemDesejada) || 0,
      precoSugerido,
      taxaCanalValor,
      lucroLiquido,
      margemReal
    };
  }

  /* ==========================================================
     4. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const r = calcular();

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Precificar</h1>
          <p class="pagina-header__subtitulo">
            Informe os custos e o PraFicar calcula o preço ideal automaticamente.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario" onclick="MODULO_PRECIFICAR.limpar()">
            Limpar
          </button>
          <button class="btn btn--primario" onclick="MODULO_PRECIFICAR.salvar()">
            Salvar precificação
          </button>
        </div>
      </div>

      <div class="precificar-layout">

        <!-- =============================================
             COLUNA ESQUERDA — FORMULÁRIO
             ============================================= -->
        <div class="precificar-form">

          <!-- 1. Produto -->
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

              <div class="form-linha">
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
                  <label for="prec-perda">Perda estimada (%)</label>
                  <input
                    id="prec-perda"
                    type="number"
                    min="0"
                    max="99"
                    step="0.1"
                    value="${form.perdaPercentual}"
                    oninput="MODULO_PRECIFICAR.atualizar('perdaPercentual', this.value)"
                  />
                  <span class="form-ajuda">Ex: 5% de perda na produção.</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Insumos -->
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

          <!-- 3. Custos adicionais -->
          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">3. Mão de obra e outros custos</h3>
            </div>
            <div class="card__body">
              <div class="form-linha">
                <div class="form-grupo">
                  <label for="prec-valor-hora">Valor da hora (R$)</label>
                  <input
                    id="prec-valor-hora"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${form.maoDeObra.valorHora}"
                    oninput="MODULO_PRECIFICAR.atualizarMaoDeObra('valorHora', this.value)"
                  />
                </div>
                <div class="form-grupo">
                  <label for="prec-minutos">Tempo gasto (min)</label>
                  <input
                    id="prec-minutos"
                    type="number"
                    min="0"
                    step="1"
                    value="${form.maoDeObra.minutos}"
                    oninput="MODULO_PRECIFICAR.atualizarMaoDeObra('minutos', this.value)"
                  />
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="prec-energia">Energia (R$)</label>
                  <input
                    id="prec-energia"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${form.energia}"
                    oninput="MODULO_PRECIFICAR.atualizar('energia', this.value)"
                  />
                </div>
                <div class="form-grupo">
                  <label for="prec-embalagem">Embalagem (R$)</label>
                  <input
                    id="prec-embalagem"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${form.embalagem}"
                    oninput="MODULO_PRECIFICAR.atualizar('embalagem', this.value)"
                  />
                </div>
                <div class="form-grupo">
                  <label for="prec-outros">Outros custos (R$)</label>
                  <input
                    id="prec-outros"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${form.outrosCustos}"
                    oninput="MODULO_PRECIFICAR.atualizar('outrosCustos', this.value)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Canal e margem -->
          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">4. Canal de venda e margem</h3>
            </div>
            <div class="card__body">
              <div class="form-grupo">
                <label for="prec-canal">Canal</label>
                <select
                  id="prec-canal"
                  onchange="MODULO_PRECIFICAR.atualizar('canalId', this.value)"
                >
                  <option value="">Sem canal (venda direta)</option>
                  ${(window.MODULO_CANAIS?._listar() || []).filter(c => c.status === 'ativo').map(c => `
                    <option value="${c.id}" ${String(form.canalId) === String(c.id) ? 'selected' : ''}>
                      ${escaparHTML(c.nome)} — ${formatarPercentual(c.taxaPercentual)} + ${formatarMoeda(c.taxaFixa)}
                    </option>
                  `).join('')}
                </select>
                <span class="form-ajuda">A taxa do canal será descontada do lucro.</span>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="prec-frete">Frete pago por você (R$)</label>
                  <input
                    id="prec-frete"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${form.freteVendedor}"
                    oninput="MODULO_PRECIFICAR.atualizar('freteVendedor', this.value)"
                  />
                  <span class="form-ajuda">Deixe 0 se o cliente paga.</span>
                </div>

                <div class="form-grupo">
                  <label for="prec-margem">Margem desejada (%)</label>
                  <input
                    id="prec-margem"
                    type="number"
                    min="0"
                    max="95"
                    step="1"
                    value="${form.margemDesejada}"
                    oninput="MODULO_PRECIFICAR.atualizar('margemDesejada', this.value)"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- =============================================
             COLUNA DIREITA — RESULTADO
             ============================================= -->
        <div class="precificar-resultado">
          <div class="resultado-card">

            <div class="resultado-card__header">
              <span class="resultado-card__label">Custo real</span>
              <span class="resultado-card__valor">${formatarMoeda(r.custoUnitario)}</span>
              <span class="resultado-card__sub">por unidade</span>
            </div>

            <div class="resultado-card__destaque">
              <span class="resultado-card__label">Preço sugerido</span>
              <span class="resultado-card__preco">${formatarMoeda(r.precoSugerido)}</span>
            </div>

            <div class="resultado-card__grid">
              <div class="resultado-card__item">
                <span class="resultado-card__item-label">Lucro</span>
                <span class="resultado-card__item-valor ${r.lucroLiquido >= 0 ? 'text-sucesso' : 'text-critico'}">
                  ${formatarMoeda(r.lucroLiquido)}
                </span>
              </div>
              <div class="resultado-card__item">
                <span class="resultado-card__item-label">Margem</span>
                <span class="resultado-card__item-valor ${r.margemReal >= Number(form.margemDesejada) - 1 ? 'text-sucesso' : 'text-atencao'}">
                  ${formatarPercentual(r.margemReal)}
                </span>
              </div>
            </div>

            <button
              class="btn btn--ghost btn--bloco resultado-card__detalhes"
              onclick="MODULO_PRECIFICAR.toggleDetalhes()"
              id="btn-ver-calculo"
            >
              Ver cálculo
            </button>

            <div class="resultado-detalhes hidden" id="resultado-detalhes">
              ${renderDetalhesCalculo(r)}
            </div>

          </div>

          ${r.margemReal < Number(form.margemDesejada) - 1 ? `
            <div class="alerta alerta--atencao mt-4">
              <span class="alerta__icone">
                <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              </span>
              <div class="alerta__conteudo">
                <div class="alerta__titulo">Margem abaixo do desejado</div>
                O preço sugerido não atinge a margem de ${form.margemDesejada}% por causa da taxa do canal. Considere aumentar o preço ou reduzir custos.
              </div>
            </div>
          ` : ''}

          ${r.lucroLiquido < 0 ? `
            <div class="alerta alerta--critico mt-4">
              <span class="alerta__icone">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              </span>
              <div class="alerta__conteudo">
                <div class="alerta__titulo">Prejuízo neste canal</div>
                O preço está abaixo do custo + taxa + frete. Ajuste a margem ou mude o canal.
              </div>
            </div>
          ` : ''}

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

  function renderDetalhesCalculo(r) {
    return `
      <div class="calculo-detalhado">
        <h4 class="calculo-detalhado__titulo">Detalhamento do cálculo</h4>

        <div class="calculo-linha">
          <span>Insumos (lote)</span>
          <span>${formatarMoeda(r.custoInsumos)}</span>
        </div>
        <div class="calculo-linha">
          <span>Mão de obra</span>
          <span>${formatarMoeda(r.custoMaoDeObra)}</span>
        </div>
        <div class="calculo-linha">
          <span>Energia</span>
          <span>${formatarMoeda(r.custoEnergia)}</span>
        </div>
        <div class="calculo-linha">
          <span>Embalagem</span>
          <span>${formatarMoeda(r.custoEmbalagem)}</span>
        </div>
        <div class="calculo-linha">
          <span>Outros custos</span>
          <span>${formatarMoeda(r.custoOutros)}</span>
        </div>
        <div class="calculo-linha calculo-linha--destaque">
          <span>Custo base do lote</span>
          <span>${formatarMoeda(r.custoBaseLote)}</span>
        </div>

        <div class="calculo-linha">
          <span>Perda aplicada</span>
          <span>${formatarPercentual(r.perdaPct)}</span>
        </div>
        <div class="calculo-linha">
          <span>Produção útil</span>
          <span>${r.producaoUtil.toFixed(2)} un</span>
        </div>
        <div class="calculo-linha calculo-linha--destaque">
          <span>Custo real por unidade</span>
          <span>${formatarMoeda(r.custoUnitario)}</span>
        </div>

        ${r.canal ? `
          <div class="calculo-linha">
            <span>Taxa do canal (${formatarPercentual(r.taxaPct)})</span>
            <span>− ${formatarMoeda(r.taxaCanalValor)}</span>
          </div>
          <div class="calculo-linha">
            <span>Taxa fixa do canal</span>
            <span>− ${formatarMoeda(r.taxaFixa)}</span>
          </div>
        ` : ''}

        ${r.freteVendedor > 0 ? `
          <div class="calculo-linha">
            <span>Frete pago por você</span>
            <span>− ${formatarMoeda(r.freteVendedor)}</span>
          </div>
        ` : ''}

        <div class="calculo-linha calculo-linha--destaque">
          <span>Preço sugerido</span>
          <span>${formatarMoeda(r.precoSugerido)}</span>
        </div>
        <div class="calculo-linha">
          <span>Lucro líquido</span>
          <span class="${r.lucroLiquido >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(r.lucroLiquido)}</span>
        </div>
        <div class="calculo-linha">
          <span>Margem real</span>
          <span>${formatarPercentual(r.margemReal)}</span>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     5. AÇÕES DO FORMULÁRIO
     ========================================================== */

  function atualizar(campo, valor) {
    form[campo] = valor;
    atualizarResultado();
  }

  function atualizarMaoDeObra(campo, valor) {
    form.maoDeObra[campo] = valor;
    atualizarResultado();
  }

  function atualizarResultado() {
    const coluna = document.querySelector('.precificar-resultado');
    if (!coluna) return;
    const r = calcular();
    coluna.innerHTML = renderResultado(r);
  }

  function renderResultado(r) {
    return `
      <div class="resultado-card">
        <div class="resultado-card__header">
          <span class="resultado-card__label">Custo real</span>
          <span class="resultado-card__valor">${formatarMoeda(r.custoUnitario)}</span>
          <span class="resultado-card__sub">por unidade</span>
        </div>

        <div class="resultado-card__destaque">
          <span class="resultado-card__label">Preço sugerido</span>
          <span class="resultado-card__preco">${formatarMoeda(r.precoSugerido)}</span>
        </div>

        <div class="resultado-card__grid">
          <div class="resultado-card__item">
            <span class="resultado-card__item-label">Lucro</span>
            <span class="resultado-card__item-valor ${r.lucroLiquido >= 0 ? 'text-sucesso' : 'text-critico'}">
              ${formatarMoeda(r.lucroLiquido)}
            </span>
          </div>
          <div class="resultado-card__item">
            <span class="resultado-card__item-label">Margem</span>
            <span class="resultado-card__item-valor ${r.margemReal >= Number(form.margemDesejada) - 1 ? 'text-sucesso' : 'text-atencao'}">
              ${formatarPercentual(r.margemReal)}
            </span>
          </div>
        </div>

        <button
          class="btn btn--ghost btn--bloco resultado-card__detalhes"
          onclick="MODULO_PRECIFICAR.toggleDetalhes()"
        >
          Ver cálculo
        </button>

        <div class="resultado-detalhes hidden" id="resultado-detalhes">
          ${renderDetalhesCalculo(r)}
        </div>
      </div>

      ${r.margemReal < Number(form.margemDesejada) - 1 ? `
        <div class="alerta alerta--atencao mt-4">
          <span class="alerta__icone">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">Margem abaixo do desejado</div>
            O preço sugerido não atinge a margem de ${form.margemDesejada}% por causa da taxa do canal.
          </div>
        </div>
      ` : ''}

      ${r.lucroLiquido < 0 ? `
        <div class="alerta alerta--critico mt-4">
          <span class="alerta__icone">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">Prejuízo neste canal</div>
            Ajuste a margem, reduza custos ou mude o canal.
          </div>
        </div>
      ` : ''}
    `;
  }

  function toggleDetalhes() {
    const d = document.getElementById('resultado-detalhes');
    if (d) d.classList.toggle('hidden');
  }

  /* ==========================================================
     6. INSUMOS — MODAL
     ========================================================== */

  function abrirModalInsumo() {
    const html = `
      <div class="modal-overlay ativo" id="modal-insumo">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Adicionar insumo</h2>
            <button class="modal__fechar" onclick="MODULO_PRECIFICAR.fecharModalInsumo()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="form-grupo">
              <label for="ins-nome">Nome do insumo <span class="form-obrigatorio">*</span></label>
              <input id="ins-nome" type="text" placeholder="Ex: Papel fotográfico A4" />
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="ins-custo">Custo unitário (R$)</label>
                <input id="ins-custo" type="number" min="0" step="0.0001" placeholder="0,0000" />
                <span class="form-ajuda">Custo por unidade de uso.</span>
              </div>
              <div class="form-grupo">
                <label for="ins-qtd">Quantidade usada</label>
                <input id="ins-qtd" type="number" min="0" step="0.01" value="1" />
              </div>
            </div>

            <div class="form-grupo">
              <label>Subtotal</label>
              <div class="insumo-subtotal" id="ins-subtotal">R$ 0,00</div>
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

    // Atualiza subtotal em tempo real
    const campos = ['ins-custo', 'ins-qtd'];
    campos.forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        const custo = Number(document.getElementById('ins-custo').value) || 0;
        const qtd = Number(document.getElementById('ins-qtd').value) || 0;
        const sub = document.getElementById('ins-subtotal');
        if (sub) sub.textContent = formatarMoeda(custo * qtd);
      });
    });
  }

  function fecharModalInsumo() {
    document.getElementById('modal-insumo')?.remove();
  }

  function adicionarInsumo() {
    const nome = document.getElementById('ins-nome').value.trim();
    const custoUnitario = Number(document.getElementById('ins-custo').value) || 0;
    const quantidade = Number(document.getElementById('ins-qtd').value) || 0;

    if (!nome) return alert('Informe o nome do insumo.');
    if (custoUnitario <= 0) return alert('Informe o custo unitário.');

    form.insumos.push({ nome, custoUnitario, quantidade });
    fecharModalInsumo();
    rerenderForm();
  }

  function removerInsumo(idx) {
    form.insumos.splice(idx, 1);
    rerenderForm();
  }

  /* ==========================================================
     7. LIMPAR E SALVAR
     ========================================================== */

  function limpar() {
    if (!confirm('Limpar todo o formulário?')) return;
    form = novoForm();
    rerenderForm();
  }

  function salvar() {
    const r = calcular();

    if (!form.nome.trim()) return alert('Dê um nome ao produto antes de salvar.');
    if (form.insumos.length === 0) return alert('Adicione pelo menos um insumo.');

    const registro = {
      id: proximoId++,
      nome: form.nome.trim(),
      categoria: form.categoria,
      quantidadeProduzida: r.qtd,
      custoUnitario: r.custoUnitario,
      precoSugerido: r.precoSugerido,
      lucroLiquido: r.lucroLiquido,
      margemReal: r.margemReal,
      canalId: form.canalId,
      canalNome: r.canal ? r.canal.nome : 'Venda direta',
      criadoEm: new Date().toISOString()
    };

    precificacoes.push(registro);

    alert(`Precificação salva!\n\nPreço
