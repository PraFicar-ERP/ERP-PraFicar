/* ============================================================
   PRAFICAR ERP — MÓDULO CUSTOS E FABRICAÇÃO (v2)
   Arquivo: assets/js/modulos/custos.js
   Descrição: calcula o custo real de um item e registra a
              fabricação (entrada no estoque com custo).
   v2: corrigido — não reconstrói a tela a cada tecla digitada.
   ============================================================ */

const MODULO_CUSTOS = (() => {

  let calculos = [];
  let fabricacoes = [];
  let proximoIdCalculo = 1;
  let proximoIdFabricacao = 1;

  let materiais = [];
  let impressora = carregarImpressoraPadrao();

  let abaAtiva = 'calculos';
  let form = novoForm();
  let insumoEditandoIdx = null;

  function novoForm() {
    return {
      nome: '',
      tamanhoLote: 1,
      insumos: [],
      paginasImpressas: 0,
      tipoImpressao: 'colorida'
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

  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
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
    const lote = Math.max(1, Number(form.tamanhoLote) || 1);
    const custoInsumos = form.insumos.reduce((acc, i) => {
      return acc + (Number(i.custoPorUnidadeUso) || 0) * (Number(i.quantidadeUsada) || 0);
    }, 0);
    const custoImpressaoTotal = custoImpressao();
    const custoTotalLote = custoInsumos + custoImpressaoTotal;
    const custoUnitario = custoTotalLote / lote;
    return {
      lote,
      custoInsumos,
      custoImpressao: custoImpressaoTotal,
      custoTotalLote,
      custoUnitario
    };
  }

  function render() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Custos e Fabricação</h1>
          <p class="pagina-header__subtitulo">
            Calcule o custo real dos seus itens e registre a produção.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--secundario" onclick="MODULO_CUSTOS.abrirConfigImpressora()">
            ⚙ Impressora
          </button>
          ${abaAtiva === 'calculos' ? `
            <button class="btn btn--primario" onclick="MODULO_CUSTOS.novoCalculo()">
              + Novo cálculo
            </button>
          ` : `
            <button class="btn btn--primario" onclick="MODULO_CUSTOS.novaFabricacao()">
              + Nova fabricação
            </button>
          `}
        </div>
      </div>

      <div class="custos-abas">
        <button class="custos-aba ${abaAtiva === 'calculos' ? 'custos-aba--ativa' : ''}" onclick="MODULO_CUSTOS.alterarAba('calculos')">
          Cálculos de custo
        </button>
        <button class="custos-aba ${abaAtiva === 'fabricacoes' ? 'custos-aba--ativa' : ''}" onclick="MODULO_CUSTOS.alterarAba('fabricacoes')">
          Fabricações
        </button>
      </div>

      ${abaAtiva === 'calculos' ? renderAbaCalculos() : renderAbaFabricacoes()}
    `;
  }

  /* ==========================================================
     ABA CÁLCULOS
     ========================================================== */

  function renderAbaCalculos() {
    return `
      <div class="custos-layout">

        <div class="custos-form">

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">1. Item</h3>
            </div>
            <div class="card__body">
              <div class="form-grupo">
                <label for="custo-nome">Qual o nome do item?</label>
                <input id="custo-nome" type="text" value="${escaparHTML(form.nome)}" placeholder="Ex: Marca-página Imantada" oninput="MODULO_CUSTOS.atualizar('nome', this.value)" />
              </div>
              <div class="form-grupo">
                <label for="custo-lote">Quantas unidades você fabrica por lote?</label>
                <input id="custo-lote" type="number" min="1" step="1" value="${form.tamanhoLote}" oninput="MODULO_CUSTOS.atualizar('tamanhoLote', this.value)" />
                <span class="form-ajuda">O custo total será dividido por este número.</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">2. Insumos usados no lote</h3>
              <button class="btn btn--secundario btn--sm" onclick="MODULO_CUSTOS.abrirModalInsumo()">
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
                  <label for="custo-paginas">Quantas páginas você imprimiu?</label>
                  <input id="custo-paginas" type="number" min="0" step="1" value="${form.paginasImpressas}" oninput="MODULO_CUSTOS.atualizar('paginasImpressas', this.value)" />
                </div>
                <div class="form-grupo">
                  <label for="custo-tipo">Tipo de impressão</label>
                  <select id="custo-tipo" onchange="MODULO_CUSTOS.atualizar('tipoImpressao', this.value)">
                    <option value="colorida" ${form.tipoImpressao === 'colorida' ? 'selected' : ''}>Colorida</option>
                    <option value="preta" ${form.tipoImpressao === 'preta' ? 'selected' : ''}>Preta</option>
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
            <div class="card__body">
              <button class="btn btn--primario btn--bloco" onclick="MODULO_CUSTOS.salvarCalculo()">
                Salvar cálculo
              </button>
            </div>
          </div>

        </div>

        <div class="custos-resultado">
          ${renderResultado(calcular())}
        </div>

      </div>
    `;
  }

  function renderResultado(r) {
    return `
      <div class="resultado-card">
        <div class="resultado-card__header">
          <span class="resultado-card__label">Custo de cada unidade</span>
          <span class="resultado-card__valor">${formatarMoedaFina(r.custoUnitario)}</span>
          <span class="resultado-card__sub">${r.lote} un no lote</span>
        </div>

        <div class="resultado-card__grid-2">
          <div class="resultado-card__item">
            <span class="resultado-card__item-label">Insumos</span>
            <span class="resultado-card__item-valor">${formatarMoedaFina(r.custoInsumos)}</span>
          </div>
          <div class="resultado-card__item">
            <span class="resultado-card__item-label">Impressão</span>
            <span class="resultado-card__item-valor">${formatarMoedaFina(r.custoImpressao)}</span>
          </div>
        </div>

        <div class="resultado-card__acrescimo">
          Custo total do lote: <strong>${formatarMoedaFina(r.custoTotalLote)}</strong>
        </div>
      </div>
    `;
  }

  function renderListaInsumos() {
    if (form.insumos.length === 0) {
      return `
        <div class="insumos-vazio">
          <p>Nenhum insumo adicionado ainda.</p>
          <button class="btn btn--secundario btn--sm" onclick="MODULO_CUSTOS.abrirModalInsumo()">
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
            <th class="tabela__numero">Custo unitário</th>
            <th class="tabela__numero">Qtd usada</th>
            <th class="tabela__numero">Custo no lote</th>
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
                <div class="acoes-linha">
                  <button class="btn-icone" title="Visualizar" onclick="MODULO_CUSTOS.abrirModalVisualizarInsumo(${idx})">
                    <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button class="btn-icone" title="Editar" onclick="MODULO_CUSTOS.abrirModalEditarInsumo(${idx})">
                    <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                  </button>
                  <button class="btn-icone btn-icone--perigo" title="Remover" onclick="MODULO_CUSTOS.removerInsumo(${idx})">
                    <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
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
     ABA FABRICAÇÕES
     ========================================================== */

  function renderAbaFabricacoes() {
    const listaOrdenada = fabricacoes.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

    return `
      <div class="custos-layout">

        <div class="custos-form">

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">Registrar fabricação</h3>
            </div>
            <div class="card__body">
              <p class="form-ajuda" style="margin-bottom: var(--esp-4);">
                Escolha um cálculo salvo para usar como base. O custo unitário será aplicado ao estoque.
              </p>

              ${calculos.length === 0 ? `
                <div class="insumos-vazio">
                  <p>Nenhum cálculo salvo ainda.</p>
                  <button class="btn btn--secundario btn--sm" onclick="MODULO_CUSTOS.alterarAba('calculos')">
                    Ir para Cálculos
                  </button>
                </div>
              ` : `
                <div class="form-grupo">
                  <label for="fab-calculo">Item a fabricar</label>
                  <select id="fab-calculo">
                    <option value="">Selecione um cálculo</option>
                    ${calculos.map(c => `
                      <option value="${c.id}">
                        ${escaparHTML(c.nome)} — custo ${formatarMoedaFina(c.custoUnitario)}/un
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div class="form-linha-2">
                  <div class="form-grupo">
                    <label for="fab-qtd">Quantidade produzida</label>
                    <input id="fab-qtd" type="number" min="1" step="1" value="1" />
                  </div>
                  <div class="form-grupo">
                    <label for="fab-perdas">Perdas</label>
                    <input id="fab-perdas" type="number" min="0" step="1" value="0" />
                    <span class="form-ajuda">Unidades perdidas na produção.</span>
                  </div>
                </div>

                <div class="form-grupo">
                  <label for="fab-obs">Observações</label>
                  <textarea id="fab-obs" placeholder="Opcional"></textarea>
                </div>

                <button class="btn btn--primario btn--bloco" onclick="MODULO_CUSTOS.confirmarFabricacao()">
                  Registrar fabricação
                </button>
              `}
            </div>
          </div>

        </div>

        <div class="custos-resultado">

          <div class="card">
            <div class="card__header">
              <h3 class="card__titulo">Histórico de fabricações</h3>
            </div>
            <div class="card__body" style="padding-top: 0;">
              ${listaOrdenada.length === 0 ? `
                <div class="insumos-vazio">
                  <p>Nenhuma fabricação registrada ainda.</p>
                </div>
              ` : `
                <div class="tabela-wrapper" style="border: none; box-shadow: none;">
                  <div class="tabela-scroll">
                    <table class="tabela">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Item</th>
                          <th class="tabela__numero">Qtd</th>
                          <th class="tabela__numero">Perdas</th>
                          <th class="tabela__numero">Custo un.</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${listaOrdenada.map(f => `
                          <tr>
                            <td>${formatarData(f.criadoEm)}</td>
                            <td>
                              <div class="produto-nome">${escaparHTML(f.nome)}</div>
                            </td>
                            <td class="tabela__numero peso-semibold">${f.quantidade}</td>
                            <td class="tabela__numero ${f.perdas > 0 ? 'text-critico' : ''}">${f.perdas}</td>
                            <td class="tabela__numero">${formatarMoedaFina(f.custoUnitario)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              `}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  /* ==========================================================
     AÇÕES DO FORMULÁRIO
     CORREÇÃO: não reconstrói a tela ao digitar
     ========================================================== */

  function atualizar(campo, valor) {
    if (campo === 'tamanhoLote' || campo === 'paginasImpressas') {
      form[campo] = Number(valor) || 0;
    } else {
      form[campo] = valor;
    }
    atualizarResultado();
  }

  function atualizarResultado() {
    const coluna = document.querySelector('.custos-resultado');
    if (!coluna) return;
    coluna.innerHTML = renderResultado(calcular());
  }

  function alterarAba(aba) {
    abaAtiva = aba;
    rerenderForm();
  }

  function novoCalculo() {
    if (form.insumos.length > 0 || form.nome) {
      if (!confirm('Limpar o formulário atual e começar um novo cálculo?')) return;
    }
    form = novoForm();
    rerenderForm();
  }

  function novaFabricacao() {
    abaAtiva = 'fabricacoes';
    rerenderForm();
  }

  function rerenderForm() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'custos') {
      container.innerHTML = render();
    }
  }

  /* ==========================================================
     SALVAR CÁLCULO
     ========================================================== */

  function salvarCalculo() {
    const r = calcular();

    if (!form.nome.trim()) return alert('Informe o nome do item.');
    if (form.insumos.length === 0 && form.paginasImpressas === 0) {
      return alert('Adicione pelo menos um insumo ou páginas de impressão.');
    }

    const registro = {
      id: proximoIdCalculo++,
      nome: form.nome.trim(),
      tamanhoLote: r.lote,
      insumos: form.insumos.map(i => ({ ...i })),
      paginasImpressas: form.paginasImpressas,
      tipoImpressao: form.tipoImpressao,
      custoInsumos: r.custoInsumos,
      custoImpressao: r.custoImpressao,
      custoTotalLote: r.custoTotalLote,
      custoUnitario: r.custoUnitario,
      criadoEm: new Date().toISOString()
    };

    calculos.push(registro);

    alert(
      'Cálculo salvo!\n\n' +
      'Item: ' + registro.nome + '\n' +
      'Custo unitário: ' + formatarMoedaFina(registro.custoUnitario)
    );

    form = novoForm();
    rerenderForm();
  }

  /* ==========================================================
     REGISTRAR FABRICAÇÃO
     ========================================================== */

  function confirmarFabricacao() {
    const calculoId = Number(document.getElementById('fab-calculo').value);
    const quantidade = Number(document.getElementById('fab-qtd').value) || 0;
    const perdas = Number(document.getElementById('fab-perdas').value) || 0;
    const obs = document.getElementById('fab-obs').value.trim();

    if (!calculoId) return alert('Selecione um cálculo.');
    if (quantidade <= 0) return alert('Informe a quantidade produzida.');
    if (perdas >= quantidade) return alert('As perdas devem ser menores que a quantidade produzida.');

    const calculo = calculos.find(c => c.id === calculoId);
    if (!calculo) return alert('Cálculo não encontrado.');

    const aproveitaveis = quantidade - perdas;

    const fabricacao = {
      id: proximoIdFabricacao++,
      calculoId: calculo.id,
      nome: calculo.nome,
      quantidade: quantidade,
      perdas: perdas,
      aproveitaveis: aproveitaveis,
      custoUnitario: calculo.custoUnitario,
      observacoes: obs,
      criadoEm: new Date().toISOString()
    };

    fabricacoes.push(fabricacao);

    darEntradaNoEstoque(calculo.nome, aproveitaveis, calculo.custoUnitario);

    alert(
      'Fabricação registrada!\n\n' +
      'Item: ' + calculo.nome + '\n' +
      'Produzido: ' + quantidade + ' un\n' +
      'Perdas: ' + perdas + ' un\n' +
      'Aproveitáveis: ' + aproveitaveis + ' un\n' +
      'Entrada no estoque: +' + aproveitaveis + ' un'
    );

    rerenderForm();
  }

  function darEntradaNoEstoque(nomeItem, quantidade, custoUnitario) {
    if (!window.MODULO_PRODUTOS) return;

    const produtos = window.MODULO_PRODUTOS._listar() || [];
    const produto = produtos.find(p =>
      p.nome.toLowerCase() === nomeItem.toLowerCase()
    );

    if (!produto) return;

    const produtoAtual = window.MODULO_PRODUTOS._buscar(produto.id);
    if (produtoAtual) {
      produtoAtual.estoqueAtual = Number(produtoAtual.estoqueAtual || 0) + quantidade;
      if (custoUnitario > 0) {
        produtoAtual.custo = custoUnitario;
      }
      produtoAtual.atualizadoEm = new Date().toISOString();
    }
  }

  /* ==========================================================
     MODAL DE INSUMO — NOVO / EDITAR
     ========================================================== */

  function abrirModalInsumo() {
    insumoEditandoIdx = null;
    renderModalInsumo(null);
  }

  function abrirModalEditarInsumo(idx) {
    const insumo = form.insumos[idx];
    if (!insumo) return;
    insumoEditandoIdx = idx;
    renderModalInsumo(insumo);
  }

  function renderModalInsumo(insumo) {
    const editando = insumo !== null;
    const titulo = editando ? 'Editar insumo' : 'Adicionar insumo';
    const labelBotao = editando ? 'Salvar alterações' : 'Adicionar insumo';
    const acaoConfirmar = editando
      ? 'MODULO_CUSTOS.confirmarEdicaoInsumo()'
      : 'MODULO_CUSTOS.adicionarInsumo()';

    const v = insumo || {
      nome: '', precoPago: '', quantidadeCompra: 1, unidadeCompra: 'Folha',
      rendimento: 1, unidadeUso: 'Unidade', quantidadeUsada: 1
    };

    const html = `
      <div class="modal-overlay ativo" id="modal-insumo">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${titulo}</h2>
            <button class="modal__fechar" onclick="MODULO_CUSTOS.fecharModalInsumo()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            ${!editando ? `
              <div class="form-grupo">
                <label>Escolher um insumo já cadastrado</label>
                <select id="ins-material" onchange="MODULO_CUSTOS.aoEscolherMaterial()">
                  <option value="">+ Cadastrar novo insumo</option>
                  ${materiais.map((m, idx) => '<option value="' + idx + '" data-nome="' + escaparHTML(m.nome) + '">' + escaparHTML(m.nome) + ' — ' + formatarMoedaFina(m.custoPorUnidadeUso) + '/' + m.unidadeUso + '</option>').join('')}
                </select>
              </div>
            ` : ''}

            <div class="form-grupo">
              <label for="ins-nome">Qual o nome deste insumo?</label>
              <input id="ins-nome" type="text" value="${escaparHTML(v.nome)}" placeholder="Ex: Adesivo Vinil" />
            </div>

            <div class="ins-bloco">
              <div class="ins-bloco__titulo">Compra</div>
              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="ins-preco-pago">Quanto você pagou? (R$)</label>
                  <input id="ins-preco-pago" type="number" min="0" step="0.01" value="${v.precoPago || ''}" placeholder="0,00" oninput="MODULO_CUSTOS.recalcularCustoInsumo()" />
                </div>
                <div class="form-grupo">
                  <label for="ins-qtd-comprada">Quantas unidades vieram?</label>
                  <input id="ins-qtd-comprada" type="number" min="0.01" step="0.01" value="${v.quantidadeCompra}" oninput="MODULO_CUSTOS.recalcularCustoInsumo()" />
                </div>
                <div class="form-grupo">
                  <label for="ins-unidade-compra">Qual unidade veio?</label>
                  <select id="ins-unidade-compra" onchange="MODULO_CUSTOS.recalcularCustoInsumo()">
                    ${['Folha','Unidade','Pacote','Caixa','Rolo','Resma','Litro','Kg'].map(u => '<option value="' + u + '"' + ((v.unidadeCompra || '').toLowerCase() === u.toLowerCase() ? ' selected' : '') + '>' + u + '</option>').join('')}
                  </select>
                </div>
              </div>
              <p class="form-ajuda" id="ins-ajuda-compra">Preencha os dados da compra.</p>
            </div>

            <div class="ins-bloco">
              <div class="ins-bloco__titulo">Rendimento <span class="ins-bloco__opcional">(opcional)</span></div>
              <p class="form-ajuda">
                Use só quando 1 unidade de compra gera várias unidades menores.
                Ex: 1 folha rende 8 fotos.
              </p>
              <div class="form-linha-3">
                <div class="form-grupo">
                  <label for="ins-rendimento" id="ins-label-rendimento">Cada unidade rende quantas?</label>
                  <input id="ins-rendimento" type="number" min="1" step="1" value="${v.rendimento}" oninput="MODULO_CUSTOS.recalcularCustoInsumo()" />
                </div>
                <div class="form-grupo">
                  <label for="ins-unidade-uso">Qual unidade você usa?</label>
                  <select id="ins-unidade-uso" onchange="MODULO_CUSTOS.recalcularCustoInsumo()">
                    ${['Unidade','Adesivo','Foto','Folha','Metro','Centímetro','ml','g'].map(u => '<option value="' + u + '"' + ((v.unidadeUso || '').toLowerCase() === u.toLowerCase() ? ' selected' : '') + '>' + u + '</option>').join('')}
                  </select>
                </div>
                <div class="form-grupo">
                  <label>Total de unidades de uso</label>
                  <div class="prec-info-calc" id="ins-total-uso">${(v.quantidadeCompra * v.rendimento).toLocaleString('pt-BR')} unidades</div>
                </div>
              </div>
            </div>

            <div class="ins-bloco">
              <div class="ins-bloco__titulo">Custo calculado</div>
              <div class="ins-resultado">
                <div class="ins-resultado__item">
                  <span class="ins-resultado__label" id="ins-label-custo-compra">Custo por unidade de compra</span>
                  <span class="ins-resultado__valor" id="ins-custo-compra">R$ 0,00</span>
                </div>
                <div class="ins-resultado__item ins-resultado__item--destaque">
                  <span class="ins-resultado__label" id="ins-label-custo-uso">Custo por unidade de uso</span>
                  <span class="ins-resultado__valor" id="ins-custo-uso">R$ 0,00</span>
                </div>
              </div>
            </div>

            <div class="ins-bloco">
              <div class="ins-bloco__titulo">Uso neste lote</div>
              <div class="form-linha">
                <div class="form-grupo">
                  <label for="ins-qtd-usada" id="ins-label-qtd-usada">Quantas você usou?</label>
                  <input id="ins-qtd-usada" type="number" min="0" step="0.01" value="${v.quantidadeUsada}" oninput="MODULO_CUSTOS.recalcularSubtotalInsumo()" />
                </div>
                <div class="form-grupo">
                  <label>Custo neste lote</label>
                  <div class="prec-info-calc" id="ins-subtotal">R$ 0,00</div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_CUSTOS.fecharModalInsumo()">Cancelar</button>
            <button class="btn btn--primario" onclick="${acaoConfirmar}">${labelBotao}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-insumo')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
      recalcularCustoInsumo();
      document.getElementById('ins-nome')?.focus();
    }, 50);
  }

  function fecharModalInsumo() {
    document.getElementById('modal-insumo')?.remove();
    insumoEditandoIdx = null;
  }

  function aoEscolherMaterial() {
    const sel = document.getElementById('ins-material');
    if (!sel || !sel.value) return;
    const material = materiais[Number(sel.value)];
    if (!material) return;
    document.getElementById('ins-nome').value = material.nome;
    document.getElementById('ins-preco-pago').value = material.precoPago;
    document.getElementById('ins-qtd-comprada').value = material.quantidadeCompra;
    document.getElementById('ins-unidade-compra').value = material.unidadeCompra || 'Unidade';
    document.getElementById('ins-rendimento').value = material.rendimento || 1;
    document.getElementById('ins-unidade-uso').value = material.unidadeUso || 'Unidade';
    recalcularCustoInsumo();
  }

  function recalcularCustoInsumo() {
    const preco = Number(document.getElementById('ins-preco-pago')?.value) || 0;
    const qtdCompra = Number(document.getElementById('ins-qtd-comprada')?.value) || 0;
    const rendimento = Number(document.getElementById('ins-rendimento')?.value) || 1;
    const unidadeCompra = document.getElementById('ins-unidade-compra')?.value || 'unidade';
    const unidadeUso = document.getElementById('ins-unidade-uso')?.value || 'unidade';

    const r = calcularCustoInsumo(preco, qtdCompra, rendimento);

    const labelRend = document.getElementById('ins-label-rendimento');
    if (labelRend) labelRend.textContent = 'Cada ' + unidadeCompra.toLowerCase() + ' rende quantas?';

    const labelCustoCompra = document.getElementById('ins-label-custo-compra');
    if (labelCustoCompra) labelCustoCompra.textContent = 'Custo por ' + unidadeCompra.toLowerCase();

    const labelCustoUso = document.getElementById('ins-label-custo-uso');
    if (labelCustoUso) labelCustoUso.textContent = 'Custo por ' + unidadeUso.toLowerCase();

    const labelQtdUsada = document.getElementById('ins-label-qtd-usada');
    if (labelQtdUsada) labelQtdUsada.textContent = 'Quantas ' + unidadeUso.toLowerCase() + '(s) você usou?';

    const ajudaCompra = document.getElementById('ins-ajuda-compra');
    if (ajudaCompra) {
      if (qtdCompra > 0) {
        ajudaCompra.textContent = 'Você comprou ' + qtdCompra + ' ' + unidadeCompra.toLowerCase() + '(s).';
      } else {
        ajudaCompra.textContent = 'Preencha os dados da compra.';
      }
    }

    const elCompra = document.getElementById('ins-custo-compra');
    const elUso = document.getElementById('ins-custo-uso');
    const elTotalUso = document.getElementById('ins-total-uso');

    if (elCompra) elCompra.textContent = formatarMoedaFina(r.custoPorUnidadeCompra);
    if (elUso) elUso.textContent = formatarMoedaFina(r.custoPorUnidadeUso);
    if (elTotalUso) elTotalUso.textContent = (qtdCompra * rendimento).toLocaleString('pt-BR') + ' ' + unidadeUso.toLowerCase() + '(s)';

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

  function capturarDadosInsumo() {
    return {
      nome: document.getElementById('ins-nome').value.trim(),
      precoPago: Number(document.getElementById('ins-preco-pago').value) || 0,
      quantidadeCompra: Number(document.getElementById('ins-qtd-comprada').value) || 0,
      unidadeCompra: document.getElementById('ins-unidade-compra').value,
      rendimento: Number(document.getElementById('ins-rendimento').value) || 1,
      unidadeUso: document.getElementById('ins-unidade-uso').value,
      quantidadeUsada: Number(document.getElementById('ins-qtd-usada').value) || 0
    };
  }

  function validarInsumo(dados) {
    if (!dados.nome) return 'Informe o nome do insumo.';
    if (dados.precoPago <= 0) return 'Informe o preço pago.';
    if (dados.quantidadeCompra <= 0) return 'Informe a quantidade comprada.';
    if (dados.rendimento < 1) return 'O rendimento deve ser pelo menos 1.';
    if (dados.quantidadeUsada <= 0) return 'Informe a quantidade usada.';
    return null;
  }

  function salvarMaterial(dados, calc) {
    const idxExistente = materiais.findIndex(m => m.nome === dados.nome);
    const material = {
      nome: dados.nome,
      precoPago: dados.precoPago,
      quantidadeCompra: dados.quantidadeCompra,
      unidadeCompra: dados.unidadeCompra,
      rendimento: dados.rendimento,
      unidadeUso: dados.unidadeUso,
      custoPorUnidadeCompra: calc.custoPorUnidadeCompra,
      custoPorUnidadeUso: calc.custoPorUnidadeUso,
      atualizadoEm: new Date().toISOString()
    };
    if (idxExistente === -1) materiais.push(material);
    else materiais[idxExistente] = material;
  }

  function adicionarInsumo() {
    const dados = capturarDadosInsumo();
    const erro = validarInsumo(dados);
    if (erro) return alert(erro);

    const calc = calcularCustoInsumo(dados.precoPago, dados.quantidadeCompra, dados.rendimento);
    salvarMaterial(dados, calc);

    form.insumos.push({
      ...dados,
      custoPorUnidadeCompra: calc.custoPorUnidadeCompra,
      custoPorUnidadeUso: calc.custoPorUnidadeUso
    });

    fecharModalInsumo();
    rerenderForm();
  }

  function confirmarEdicaoInsumo() {
    if (insumoEditandoIdx === null) return;
    const dados = capturarDadosInsumo();
    const erro = validarInsumo(dados);
    if (erro) return alert(erro);

    const calc = calcularCustoInsumo(dados.precoPago, dados.quantidadeCompra, dados.rendimento);
    salvarMaterial(dados, calc);

    form.insumos[insumoEditandoIdx] = {
      ...dados,
      custoPorUnidadeCompra: calc.custoPorUnidadeCompra,
      custoPorUnidadeUso: calc.custoPorUnidadeUso
    };

    fecharModalInsumo();
    rerenderForm();
  }

  function removerInsumo(idx) {
    if (!confirm('Remover este insumo do cálculo?')) return;
    form.insumos.splice(idx, 1);
    rerenderForm();
  }

  /* ==========================================================
     MODAL VISUALIZAR INSUMO
     ========================================================== */

  function abrirModalVisualizarInsumo(idx) {
    const i = form.insumos[idx];
    if (!i) return;

    const subtotal = (Number(i.custoPorUnidadeUso) || 0) * (Number(i.quantidadeUsada) || 0);

    const html = `
      <div class="modal-overlay ativo" id="modal-insumo-visualizar">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${escaparHTML(i.nome)}</h2>
            <button class="modal__fechar" onclick="MODULO_CUSTOS.fecharModalVisualizar()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="vis-secao">
              <div class="vis-secao__titulo">Compra</div>
              <div class="vis-linha"><span>Quanto pagou</span><strong>${formatarMoeda(i.precoPago)}</strong></div>
              <div class="vis-linha"><span>Quantas unidades vieram</span><strong>${i.quantidadeCompra} ${escaparHTML(i.unidadeCompra || '')}</strong></div>
            </div>

            <div class="vis-secao">
              <div class="vis-secao__titulo">Rendimento</div>
              <div class="vis-linha"><span>Cada ${escaparHTML((i.unidadeCompra || 'unidade').toLowerCase())} rende</span><strong>${i.rendimento} ${escaparHTML(i.unidadeUso || '')}</strong></div>
              ${i.rendimento > 1 ? '<div class="vis-linha"><span>Total de unidades de uso</span><strong>' + (i.quantidadeCompra * i.rendimento).toLocaleString('pt-BR') + ' ' + escaparHTML(i.unidadeUso || '') + '</strong></div>' : ''}
            </div>

            <div class="vis-secao">
              <div class="vis-secao__titulo">Custo calculado</div>
              <div class="vis-linha"><span>Custo por ${escaparHTML((i.unidadeCompra || 'unidade').toLowerCase())}</span><strong>${formatarMoedaFina(i.custoPorUnidadeCompra)}</strong></div>
              <div class="vis-linha vis-linha--destaque"><span>Custo por ${escaparHTML((i.unidadeUso || 'unidade').toLowerCase())}</span><strong>${formatarMoedaFina(i.custoPorUnidadeUso)}</strong></div>
            </div>

            <div class="vis-secao">
              <div class="vis-secao__titulo">Uso neste lote</div>
              <div class="vis-linha"><span>Quantas ${escaparHTML((i.unidadeUso || 'unidade').toLowerCase())}(s) usou</span><strong>${i.quantidadeUsada}</strong></div>
              <div class="vis-linha vis-linha--destaque"><span>Custo no lote</span><strong>${formatarMoedaFina(subtotal)}</strong></div>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_CUSTOS.fecharModalVisualizar()">Fechar</button>
            <button class="btn btn--primario" onclick="MODULO_CUSTOS.fecharModalVisualizar(); MODULO_CUSTOS.abrirModalEditarInsumo(${idx});">Editar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-insumo-visualizar')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharModalVisualizar() {
    document.getElementById('modal-insumo-visualizar')?.remove();
  }

  /* ==========================================================
     IMPRESSORA
     ========================================================== */

  function abrirConfigImpressora() {
    const t = impressora.tintas;
    const html = `
      <div class="modal-overlay ativo" id="modal-impressora">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">Configurar impressora</h2>
            <button class="modal__fechar" onclick="MODULO_CUSTOS.fecharModalImpressora()" aria-label="Fechar">
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
                    <input type="number" min="0" step="0.01" value="${t[cor].preco}" oninput="MODULO_CUSTOS.atualizarImpressora('${cor}', 'preco', this.value)" />
                  </div>
                  <div class="form-grupo">
                    <label>Rendimento (páginas)</label>
                    <input type="number" min="1" step="1" value="${t[cor].rendimento}" oninput="MODULO_CUSTOS.atualizarImpressora('${cor}', 'rendimento', this.value)" />
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
            <button class="btn btn--secundario" onclick="MODULO_CUSTOS.fecharModalImpressora()">Fechar</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-impressora')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function fecharModalImpressora() {
    document.getElementById('modal-impressora')?.remove();
    rerenderForm();
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

  /* ==========================================================
     API PÚBLICA
     ========================================================== */

  return {
    render,
    alterarAba,
    atualizar,
    atualizarResultado,
    novoCalculo,
    novaFabricacao,
    salvarCalculo,
    confirmarFabricacao,
    abrirModalInsumo,
    abrirModalEditarInsumo,
    abrirModalVisualizarInsumo,
    fecharModalInsumo,
    fecharModalVisualizar,
    aoEscolherMaterial,
    recalcularCustoInsumo,
    recalcularSubtotalInsumo,
    adicionarInsumo,
    confirmarEdicaoInsumo,
    removerInsumo,
    abrirConfigImpressora,
    fecharModalImpressora,
    atualizarImpressora,
    _listarCalculos: () => [...calculos],
    _listarFabricacoes: () => [...fabricacoes],
    _materiais: () => [...materiais]
  };

})();

window.MODULO_CUSTOS = MODULO_CUSTOS;
window.renderCustos = MODULO_CUSTOS.render;
