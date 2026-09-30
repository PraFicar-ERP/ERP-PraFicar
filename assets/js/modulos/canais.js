/* ============================================================
   PRAFICAR ERP — MÓDULO CANAIS DE VENDA
   Arquivo: assets/js/modulos/canais.js
   Descrição: cadastro, listagem, edição e exclusão lógica de
              canais de venda. Cada canal define taxa percentual,
              taxa fixa, frete e prazo de repasse — que serão
              usados pela Precificação e pelas Vendas.
   ============================================================ */

const MODULO_CANAIS = (() => {

  /* ==========================================================
     1. ESTADO EM MEMÓRIA
     ========================================================== */

  let canais = [];
  let proximoId = 1;
  let filtroBusca = '';
  let filtroTipo = '';
  let filtroStatus = '';
  let canalEditandoId = null;

  /* ==========================================================
     2. TIPOS DE CANAL
     ========================================================== */

  const TIPOS = [
    { codigo: 'marketplace',  nome: 'Marketplace' },
    { codigo: 'rede-social',  nome: 'Rede social' },
    { codigo: 'site',         nome: 'Site próprio' },
    { codigo: 'presencial',   nome: 'Presencial' },
    { codigo: 'outros',       nome: 'Outros' }
  ];

  function nomeTipo(codigo) {
    const t = TIPOS.find(x => x.codigo === codigo);
    return t ? t.nome : '—';
  }

  /* ==========================================================
     3. RESPONSÁVEL PELO FRETE
     ========================================================== */

  const FRETE_OPCOES = [
    { codigo: 'vendedor',  nome: 'Vendedor paga' },
    { codigo: 'cliente',   nome: 'Cliente paga' },
    { codigo: 'dividido',  nome: 'Dividido' },
    { codigo: 'nao-aplica',nome: 'Não se aplica' }
  ];

  function nomeFrete(codigo) {
    const f = FRETE_OPCOES.find(x => x.codigo === codigo);
    return f ? f.nome : '—';
  }

  /* ==========================================================
     4. UTILITÁRIOS
     ========================================================== */

  function escaparHTML(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatarMoeda(valor) {
    const n = Number(valor) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarPercentual(valor) {
    const n = Number(valor) || 0;
    return `${n.toFixed(2).replace('.', ',')}%`;
  }

  /* ==========================================================
     5. CRUD
     ========================================================== */

  function criarCanal(dados) {
    const canal = {
      id: proximoId++,
      nome: dados.nome,
      tipo: dados.tipo,
      taxaPercentual: Number(dados.taxaPercentual) || 0,
      taxaFixa: Number(dados.taxaFixa) || 0,
      prazoRepasse: Number(dados.prazoRepasse) || 0,
      freteResponsavel: dados.freteResponsavel || 'nao-aplica',
      observacoes: dados.observacoes || '',
      status: dados.status || 'ativo',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    canais.push(canal);
    return canal;
  }

  function atualizarCanal(id, dados) {
    const idx = canais.findIndex(c => c.id === id);
    if (idx === -1) return null;

    canais[idx] = {
      ...canais[idx],
      ...dados,
      taxaPercentual: Number(dados.taxaPercentual) || 0,
      taxaFixa: Number(dados.taxaFixa) || 0,
      prazoRepasse: Number(dados.prazoRepasse) || 0,
      atualizadoEm: new Date().toISOString()
    };
    return canais[idx];
  }

  function excluirCanal(id) {
    const idx = canais.findIndex(c => c.id === id);
    if (idx === -1) return false;
    canais[idx].status = 'inativo';
    canais[idx].atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarCanal(id) {
    return canais.find(c => c.id === id) || null;
  }

  /* ==========================================================
     6. FILTROS
     ========================================================== */

  function canaisFiltrados() {
    return canais.filter(c => {
      if (filtroTipo && c.tipo !== filtroTipo) return false;
      if (filtroStatus && c.status !== filtroStatus) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${c.nome} ${c.observacoes}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarFiltroBusca(valor) { filtroBusca = valor; rerenderTabela(); }
  function alterarFiltroTipo(valor)   { filtroTipo = valor; rerender(); }
  function alterarFiltroStatus(valor) { filtroStatus = valor; rerender(); }

  /* ==========================================================
     7. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Canais de Venda</h1>
          <p class="pagina-header__subtitulo">
            ${canais.length} ${canais.length === 1 ? 'canal cadastrado' : 'canais cadastrados'} ·
            Instagram, Shopee, Mercado Livre, site, WhatsApp e mais.
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario" onclick="MODULO_CANAIS.abrirNovo()">
            + Novo canal
          </button>
        </div>
      </div>

      <div class="filtros-canais">
        <div class="filtros-canais__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por nome ou observação..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_CANAIS.alterarFiltroBusca(this.value)"
          />
        </div>

        <select class="filtros-canais__select" onchange="MODULO_CANAIS.alterarFiltroTipo(this.value)">
          <option value="">Todos os tipos</option>
          ${TIPOS.map(t => `
            <option value="${t.codigo}" ${filtroTipo === t.codigo ? 'selected' : ''}>
              ${t.nome}
            </option>
          `).join('')}
        </select>

        <select class="filtros-canais__select" onchange="MODULO_CANAIS.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          <option value="ativo"   ${filtroStatus === 'ativo'   ? 'selected' : ''}>Ativos</option>
          <option value="inativo" ${filtroStatus === 'inativo' ? 'selected' : ''}>Inativos</option>
        </select>
      </div>

      <div id="tabela-canais-wrapper">
        ${renderTabela()}
      </div>
    `;
  }

  /* ==========================================================
     8. RENDER — TABELA
     ========================================================== */

  function renderTabela() {
    const lista = canaisFiltrados();

    if (lista.length === 0) {
      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${canais.length === 0 ? 'Nenhum canal cadastrado' : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${canais.length === 0
                ? 'Cadastre seus canais de venda com taxa percentual, taxa fixa e política de frete. O lucro por canal será calculado automaticamente.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
            ${canais.length === 0 ? `
              <button class="btn btn--primario" onclick="MODULO_CANAIS.abrirNovo()">
                + Novo canal
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
                <th>Canal</th>
                <th>Tipo</th>
                <th class="tabela__numero">Taxa %</th>
                <th class="tabela__numero">Taxa fixa</th>
                <th class="tabela__numero">Repasse</th>
                <th>Frete</th>
                <th>Status</th>
                <th class="tabela__acao"></th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(c => renderLinha(c)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLinha(c) {
    return `
      <tr>
        <td>
          <div class="canal-nome">${escaparHTML(c.nome)}</div>
          ${c.observacoes ? `<div class="canal-obs">${escaparHTML(c.observacoes)}</div>` : ''}
        </td>
        <td><span class="badge badge--info">${escaparHTML(nomeTipo(c.tipo))}</span></td>
        <td class="tabela__numero">${formatarPercentual(c.taxaPercentual)}</td>
        <td class="tabela__numero">${formatarMoeda(c.taxaFixa)}</td>
        <td class="tabela__numero">${c.prazoRepasse} ${c.prazoRepasse === 1 ? 'dia' : 'dias'}</td>
        <td>${escaparHTML(nomeFrete(c.freteResponsavel))}</td>
        <td>
          ${c.status === 'ativo'
            ? '<span class="badge badge--sucesso">Ativo</span>'
            : '<span class="badge badge--neutro">Inativo</span>'}
        </td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Editar" onclick="MODULO_CANAIS.abrirEdicao(${c.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icone btn-icone--perigo" title="Excluir" onclick="MODULO_CANAIS.confirmarExclusao(${c.id})">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     9. MODAL
     ========================================================== */

  function abrirNovo() {
    canalEditandoId = null;
    abrirModal();
  }

  function abrirEdicao(id) {
    canalEditandoId = id;
    abrirModal();
  }

  function abrirModal() {
    const c = canalEditandoId ? buscarCanal(canalEditandoId) : null;
    const editando = !!c;

    const html = `
      <div class="modal-overlay ativo" id="modal-canal">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar canal' : 'Novo canal'}</h2>
            <button class="modal__fechar" onclick="MODULO_CANAIS.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <form id="form-canal" onsubmit="MODULO_CANAIS.salvar(event)">
              <div class="form-linha">
                <div class="form-grupo">
                  <label for="canal-nome">Nome do canal <span class="form-obrigatorio">*</span></label>
                  <input
                    id="canal-nome"
                    type="text"
                    required
                    value="${escaparHTML(c?.nome || '')}"
                    placeholder="Ex: Shopee"
                  />
                </div>

                <div class="form-grupo">
                  <label for="canal-tipo">Tipo <span class="form-obrigatorio">*</span></label>
                  <select id="canal-tipo" required>
                    <option value="">Selecione</option>
                    ${TIPOS.map(t => `
                      <option value="${t.codigo}" ${c?.tipo === t.codigo ? 'selected' : ''}>
                        ${t.nome}
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="canal-taxa-percentual">Taxa percentual (%)</label>
                  <input
                    id="canal-taxa-percentual"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value="${c?.taxaPercentual ?? ''}"
                    placeholder="0,00"
                  />
                  <span class="form-ajuda">Ex: 14 para Shopee.</span>
                </div>

                <div class="form-grupo">
                  <label for="canal-taxa-fixa">Taxa fixa (R$)</label>
                  <input
                    id="canal-taxa-fixa"
                    type="number"
                    step="0.01"
                    min="0"
                    value="${c?.taxaFixa ?? ''}"
                    placeholder="0,00"
                  />
                  <span class="form-ajuda">Cobrada por venda. Ex: R$ 4,00.</span>
                </div>

                <div class="form-grupo">
                  <label for="canal-prazo">Prazo de repasse (dias)</label>
                  <input
                    id="canal-prazo"
                    type="number"
                    step="1"
                    min="0"
                    value="${c?.prazoRepasse ?? 0}"
                  />
                  <span class="form-ajuda">Tempo até o dinheiro cair.</span>
                </div>
              </div>

              <div class="form-grupo">
                <label for="canal-frete">Quem paga o frete?</label>
                <select id="canal-frete">
                  ${FRETE_OPCOES.map(f => `
                    <option value="${f.codigo}" ${(c?.freteResponsavel || 'nao-aplica') === f.codigo ? 'selected' : ''}>
                      ${f.nome}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-grupo">
                <label for="canal-obs">Observações</label>
                <textarea
                  id="canal-obs"
                  placeholder="Regras, particularidades, links..."
                >${escaparHTML(c?.observacoes || '')}</textarea>
              </div>

              <div class="form-grupo">
                <label for="canal-status">Status</label>
                <select id="canal-status">
                  <option value="ativo"   ${(c?.status || 'ativo') === 'ativo'   ? 'selected' : ''}>Ativo</option>
                  <option value="inativo" ${c?.status === 'inativo' ? 'selected' : ''}>Inativo</option>
                </select>
              </div>
            </form>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_CANAIS.fecharModal()">Cancelar</button>
            <button class="btn btn--primario" onclick="document.getElementById('form-canal').requestSubmit()">
              ${editando ? 'Salvar alterações' : 'Cadastrar canal'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-canal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
      document.getElementById('canal-nome')?.focus();
    }, 50);
  }

  function fecharModal() {
    document.getElementById('modal-canal')?.remove();
    canalEditandoId = null;
  }

  /* ==========================================================
     10. SALVAR
     ========================================================== */

  function salvar(event) {
    event.preventDefault();

    const dados = {
      nome:            document.getElementById('canal-nome').value.trim(),
      tipo:            document.getElementById('canal-tipo').value,
      taxaPercentual:  document.getElementById('canal-taxa-percentual').value,
      taxaFixa:        document.getElementById('canal-taxa-fixa').value,
      prazoRepasse:    document.getElementById('canal-prazo').value,
      freteResponsavel:document.getElementById('canal-frete').value,
      observacoes:     document.getElementById('canal-obs').value.trim(),
      status:          document.getElementById('canal-status').value
    };

    if (!dados.nome) return alert('Informe o nome do canal.');
    if (!dados.tipo) return alert('Selecione o tipo do canal.');

    const duplicado = canais.find(c =>
      c.nome.toLowerCase() === dados.nome.toLowerCase() && c.id !== canalEditandoId
    );
    if (duplicado) return alert(`Já existe um canal chamado "${dados.nome}".`);

    if (canalEditandoId) {
      atualizarCanal(canalEditandoId, dados);
    } else {
      criarCanal(dados);
    }

    fecharModal();
    rerender();
  }

  /* ==========================================================
     11. EXCLUSÃO
     ========================================================== */

  function confirmarExclusao(id) {
    const c = buscarCanal(id);
    if (!c) return;
    const ok = confirm(
      `Deseja desativar o canal "${c.nome}"?\n\n` +
      `O canal continuará no histórico, mas não poderá ser usado em novas vendas.`
    );
    if (!ok) return;
    excluirCanal(id);
    rerender();
  }

  /* ==========================================================
     12. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'canais') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-canais-wrapper');
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
    alterarFiltroBusca,
    alterarFiltroTipo,
    alterarFiltroStatus,
    // Para uso futuro (Precificação e Vendas)
    _listar: () => [...canais],
    _buscar: buscarCanal,
    TIPOS,
    FRETE_OPCOES
  };

})();

window.MODULO_CANAIS = MODULO_CANAIS;
window.renderCanais = MODULO_CANAIS.render;
