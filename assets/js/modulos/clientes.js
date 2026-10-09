/* ============================================================
   PRAFICAR ERP — MÓDULO CLIENTES & FORNECEDORES (v2)
   Arquivo: assets/js/modulos/clientes.js
   Descrição: cadastro de clientes (com origem para análise de
              canal) e de fornecedores (com histórico de preços).

   v2:
   - Correção: MODULO_VENDAS → MODULO_VENDAS_CORE
   - Correção: totais.subtotal → totais.subtotalPraticado
   - Visual ERP enterprise premium
   ============================================================ */

const MODULO_CLIENTES = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let clientes = [];
  let fornecedores = [];
  let proximoIdCliente = 1;
  let proximoIdFornecedor = 1;

  let abaAtiva = 'clientes';       // clientes | fornecedores
  let filtroBusca = '';
  let filtroOrigem = '';
  let filtroStatus = '';

  let clienteEditandoId = null;
  let fornecedorEditandoId = null;

  /* ==========================================================
     2. ORIGENS DO CLIENTE
     ========================================================== */

  const ORIGENS = [
    { codigo: 'instagram',    nome: 'Instagram' },
    { codigo: 'whatsapp',     nome: 'WhatsApp' },
    { codigo: 'facebook',     nome: 'Facebook' },
    { codigo: 'shopee',       nome: 'Shopee' },
    { codigo: 'mercado-livre',nome: 'Mercado Livre' },
    { codigo: 'google',       nome: 'Google' },
    { codigo: 'indicacao',    nome: 'Indicação' },
    { codigo: 'site',         nome: 'Site' },
    { codigo: 'loja-fisica',  nome: 'Loja física' },
    { codigo: 'evento',       nome: 'Evento / feira' },
    { codigo: 'outros',       nome: 'Outros' }
  ];

  function nomeOrigem(codigo) {
    const o = ORIGENS.find(x => x.codigo === codigo);
    return o ? o.nome : '—';
  }

  /* ==========================================================
     3. UTILITÁRIOS
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

  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
  }

  /* ==========================================================
     4. CRUD — CLIENTES
     ========================================================== */

  function criarCliente(dados) {
    const c = {
      id: proximoIdCliente++,
      nome: dados.nome,
      documento: dados.documento || '',
      telefone: dados.telefone || '',
      whatsapp: dados.whatsapp || '',
      email: dados.email || '',
      endereco: dados.endereco || '',
      cidade: dados.cidade || '',
      estado: dados.estado || '',
      chavePix: dados.chavePix || '',
      instagram: dados.instagram || '',
      origem: dados.origem || 'outros',
      observacoes: dados.observacoes || '',
      status: dados.status || 'ativo',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    clientes.push(c);
    return c;
  }

  function atualizarCliente(id, dados) {
    const idx = clientes.findIndex(c => c.id === id);
    if (idx === -1) return null;
    clientes[idx] = {
      ...clientes[idx],
      ...dados,
      atualizadoEm: new Date().toISOString()
    };
    return clientes[idx];
  }

  function excluirCliente(id) {
    const idx = clientes.findIndex(c => c.id === id);
    if (idx === -1) return false;
    clientes[idx].status = 'inativo';
    clientes[idx].atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarCliente(id) {
    return clientes.find(c => c.id === id) || null;
  }

  /* ==========================================================
     5. CRUD — FORNECEDORES
     ========================================================== */

  function criarFornecedor(dados) {
    const f = {
      id: proximoIdFornecedor++,
      nome: dados.nome,
      documento: dados.documento || '',
      telefone: dados.telefone || '',
      whatsapp: dados.whatsapp || '',
      email: dados.email || '',
      endereco: dados.endereco || '',
      produtosFornecidos: dados.produtosFornecidos || '',
      observacoes: dados.observacoes || '',
      status: dados.status || 'ativo',
      historicoPrecos: [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    fornecedores.push(f);
    return f;
  }

  function atualizarFornecedor(id, dados) {
    const idx = fornecedores.findIndex(f => f.id === id);
    if (idx === -1) return null;
    fornecedores[idx] = {
      ...fornecedores[idx],
      ...dados,
      atualizadoEm: new Date().toISOString()
    };
    return fornecedores[idx];
  }

  function excluirFornecedor(id) {
    const idx = fornecedores.findIndex(f => f.id === id);
    if (idx === -1) return false;
    fornecedores[idx].status = 'inativo';
    fornecedores[idx].atualizadoEm = new Date().toISOString();
    return true;
  }

  function buscarFornecedor(id) {
    return fornecedores.find(f => f.id === id) || null;
  }

  /* ==========================================================
     6. HISTÓRICO DO CLIENTE
     ========================================================== */

  function historicoCliente(cliente) {
    if (!window.MODULO_VENDAS_CORE) return { compras: 0, total: 0, ultima: null };

    const vendas = (window.MODULO_VENDAS_CORE._listar() || [])
      .filter(v =>
        v.status !== 'cancelada' &&
        v.cliente &&
        v.cliente.toLowerCase() === cliente.nome.toLowerCase()
      );

    const total = vendas.reduce((acc, v) => acc + (Number(v.totais?.subtotalPraticado) || 0), 0);
    const ultima = vendas.length > 0
      ? vendas.reduce((a, b) => (a.criadoEm > b.criadoEm ? a : b)).criadoEm
      : null;

    return { compras: vendas.length, total, ultima };
  }

  /* ==========================================================
     7. FILTROS
     ========================================================== */

  function itensFiltrados() {
    const lista = abaAtiva === 'clientes' ? clientes : fornecedores;

    return lista.filter(item => {
      if (filtroStatus && item.status !== filtroStatus) return false;
      if (abaAtiva === 'clientes' && filtroOrigem && item.origem !== filtroOrigem) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${item.nome} ${item.documento} ${item.telefone} ${item.email} ${item.cidade}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarAba(aba) {
    abaAtiva = aba;
    filtroBusca = '';
    filtroOrigem = '';
    filtroStatus = '';
    rerender();
  }

  function alterarFiltroBusca(v) { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroOrigem(v) { filtroOrigem = v; rerender(); }
  function alterarFiltroStatus(v) { filtroStatus = v; rerender(); }

  /* ==========================================================
     8. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    const totalClientes = clientes.filter(c => c.status === 'ativo').length;
    const totalFornecedores = fornecedores.filter(f => f.status === 'ativo').length;

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Clientes & Fornecedores</h1>
          <p class="pagina-header__subtitulo">
            ${totalClientes} ${totalClientes === 1 ? 'cliente ativo' : 'clientes ativos'} ·
            ${totalFornecedores} ${totalFornecedores === 1 ? 'fornecedor ativo' : 'fornecedores ativos'}
          </p>
        </div>
        <div class="pagina-header__acoes">
          ${abaAtiva === 'clientes'
            ? `<button class="btn btn--primario" onclick="MODULO_CLIENTES.abrirNovoCliente()">+ Novo cliente</button>`
            : `<button class="btn btn--primario" onclick="MODULO_CLIENTES.abrirNovoFornecedor()">+ Novo fornecedor</button>`}
        </div>
      </div>

      <div class="cli-abas">
        <button class="cli-aba ${abaAtiva === 'clientes' ? 'cli-aba--ativa' : ''}" onclick="MODULO_CLIENTES.alterarAba('clientes')">
          Clientes
        </button>
        <button class="cli-aba ${abaAtiva === 'fornecedores' ? 'cli-aba--ativa' : ''}" onclick="MODULO_CLIENTES.alterarAba('fornecedores')">
          Fornecedores
        </button>
      </div>

      <div class="filtros-clientes">
        <div class="filtros-clientes__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por nome, documento, telefone ou cidade..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_CLIENTES.alterarFiltroBusca(this.value)"
          />
        </div>

        ${abaAtiva === 'clientes' ? `
          <select class="filtros-clientes__select" onchange="MODULO_CLIENTES.alterarFiltroOrigem(this.value)">
            <option value="">Todas as origens</option>
            ${ORIGENS.map(o => `
              <option value="${o.codigo}" ${filtroOrigem === o.codigo ? 'selected' : ''}>${o.nome}</option>
            `).join('')}
          </select>
        ` : ''}

        <select class="filtros-clientes__select" onchange="MODULO_CLIENTES.alterarFiltroStatus(this.value)">
          <option value="">Todos os status</option>
          <option value="ativo"   ${filtroStatus === 'ativo'   ? 'selected' : ''}>Ativos</option>
          <option value="inativo" ${filtroStatus === 'inativo' ? 'selected' : ''}>Inativos</option>
        </select>
      </div>

      <div id="tabela-clientes-wrapper">
        ${renderTabela()}
      </div>
    `;
  }

  /* ==========================================================
     9. RENDER — TABELA
     ========================================================== */

  function renderTabela() {
    const lista = itensFiltrados();
    const total = abaAtiva === 'clientes' ? clientes.length : fornecedores.length;

    if (lista.length === 0) {
      const titulo = abaAtiva === 'clientes' ? 'Nenhum cliente cadastrado' : 'Nenhum fornecedor cadastrado';
      const desc = abaAtiva === 'clientes'
        ? 'Cadastre clientes com origem (Instagram, WhatsApp, Shopee...) para descobrir de onde vêm suas vendas.'
        : 'Cadastre fornecedores para acompanhar produtos e preços de compra.';

      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${total === 0 ? titulo : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${total === 0 ? desc : 'Tente ajustar a busca ou os filtros.'}
            </p>
            ${total === 0 ? `
              <button class="btn btn--primario" onclick="${abaAtiva === 'clientes' ? 'MODULO_CLIENTES.abrirNovoCliente()' : 'MODULO_CLIENTES.abrirNovoFornecedor()'}">
                + Cadastrar
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    return abaAtiva === 'clientes' ? renderTabelaClientes(lista) : renderTabelaFornecedores(lista);
  }

  function renderTabelaClientes(lista) {
    return `
      <div class="tabela-wrapper">
        <div class="tabela-scroll">
          <table class="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contato</th>
                <th>Cidade</th>
                <th>Origem</th>
                <th class="tabela__numero">Compras</th>
                <th class="tabela__numero">Total</th>
                <th>Status</th>
                <th class="tabela__acao"></th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(c => renderLinhaCliente(c)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLinhaCliente(c) {
    const h = historicoCliente(c);

    return `
      <tr>
        <td>
          <div class="cli-nome">${escaparHTML(c.nome)}</div>
          ${c.documento ? `<div class="cli-doc">${escaparHTML(c.documento)}</div>` : ''}
        </td>
        <td>
          ${c.telefone ? `<div>${escaparHTML(c.telefone)}</div>` : ''}
          ${c.email ? `<div class="cli-email">${escaparHTML(c.email)}</div>` : ''}
        </td>
        <td>${escaparHTML(c.cidade || '—')}${c.estado ? '/' + escaparHTML(c.estado) : ''}</td>
        <td>
          <span class="badge badge--info">${escaparHTML(nomeOrigem(c.origem))}</span>
        </td>
        <td class="tabela__numero">${h.compras}</td>
        <td class="tabela__numero peso-semibold">${formatarMoeda(h.total)}</td>
        <td>
          ${c.status === 'ativo'
            ? '<span class="badge badge--sucesso">Ativo</span>'
            : '<span class="badge badge--neutro">Inativo</span>'}
        </td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Editar" onclick="MODULO_CLIENTES.abrirEdicaoCliente(${c.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icone btn-icone--perigo" title="Desativar" onclick="MODULO_CLIENTES.confirmarExclusaoCliente(${c.id})">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderTabelaFornecedores(lista) {
    return `
      <div class="tabela-wrapper">
        <div class="tabela-scroll">
          <table class="tabela">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Contato</th>
                <th>Produtos fornecidos</th>
                <th>Status</th>
                <th class="tabela__acao"></th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(f => renderLinhaFornecedor(f)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLinhaFornecedor(f) {
    return `
      <tr>
        <td>
          <div class="cli-nome">${escaparHTML(f.nome)}</div>
          ${f.documento ? `<div class="cli-doc">${escaparHTML(f.documento)}</div>` : ''}
        </td>
        <td>
          ${f.telefone ? `<div>${escaparHTML(f.telefone)}</div>` : ''}
          ${f.email ? `<div class="cli-email">${escaparHTML(f.email)}</div>` : ''}
        </td>
        <td>${escaparHTML(f.produtosFornecidos || '—')}</td>
        <td>
          ${f.status === 'ativo'
            ? '<span class="badge badge--sucesso">Ativo</span>'
            : '<span class="badge badge--neutro">Inativo</span>'}
        </td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Editar" onclick="MODULO_CLIENTES.abrirEdicaoFornecedor(${f.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icone btn-icone--perigo" title="Desativar" onclick="MODULO_CLIENTES.confirmarExclusaoFornecedor(${f.id})">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     10. MODAL — CLIENTE
     ========================================================== */

  function abrirNovoCliente() {
    clienteEditandoId = null;
    abrirModalCliente();
  }

  function abrirEdicaoCliente(id) {
    clienteEditandoId = id;
    abrirModalCliente();
  }

  function abrirModalCliente() {
    const c = clienteEditandoId ? buscarCliente(clienteEditandoId) : null;
    const editando = !!c;

    const html = `
      <div class="modal-overlay ativo" id="modal-cliente">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar cliente' : 'Novo cliente'}</h2>
            <button class="modal__fechar" onclick="MODULO_CLIENTES.fecharModalCliente()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <form id="form-cliente" onsubmit="MODULO_CLIENTES.salvarCliente(event)">
              <div class="form-grupo">
                <label for="cli-nome">Nome <span class="form-obrigatorio">*</span></label>
                <input id="cli-nome" type="text" required value="${escaparHTML(c?.nome || '')}" placeholder="Nome completo ou razão social" />
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="cli-documento">CPF / CNPJ</label>
                  <input id="cli-documento" type="text" value="${escaparHTML(c?.documento || '')}" placeholder="000.000.000-00" />
                </div>
                <div class="form-grupo">
                  <label for="cli-telefone">Telefone</label>
                  <input id="cli-telefone" type="text" value="${escaparHTML(c?.telefone || '')}" placeholder="(00) 0000-0000" />
                </div>
                <div class="form-grupo">
                  <label for="cli-whatsapp">WhatsApp</label>
                  <input id="cli-whatsapp" type="text" value="${escaparHTML(c?.whatsapp || '')}" placeholder="(00) 90000-0000" />
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="cli-email">E-mail</label>
                  <input id="cli-email" type="email" value="${escaparHTML(c?.email || '')}" placeholder="cliente@email.com" />
                </div>
                <div class="form-grupo">
                  <label for="cli-instagram">Instagram</label>
                  <input id="cli-instagram" type="text" value="${escaparHTML(c?.instagram || '')}" placeholder="@usuario" />
                </div>
              </div>

              <div class="form-grupo">
                <label for="cli-endereco">Endereço</label>
                <input id="cli-endereco" type="text" value="${escaparHTML(c?.endereco || '')}" placeholder="Rua, número, complemento" />
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="cli-cidade">Cidade</label>
                  <input id="cli-cidade" type="text" value="${escaparHTML(c?.cidade || '')}" />
                </div>
                <div class="form-grupo">
                  <label for="cli-estado">Estado</label>
                  <input id="cli-estado" type="text" value="${escaparHTML(c?.estado || '')}" placeholder="SP" maxlength="2" />
                </div>
                <div class="form-grupo">
                  <label for="cli-pix">Chave Pix</label>
                  <input id="cli-pix" type="text" value="${escaparHTML(c?.chavePix || '')}" />
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="cli-origem">Origem <span class="form-obrigatorio">*</span></label>
                  <select id="cli-origem" required>
                    ${ORIGENS.map(o => `
                      <option value="${o.codigo}" ${(c?.origem || 'outros') === o.codigo ? 'selected' : ''}>${o.nome}</option>
                    `).join('')}
                  </select>
                  <span class="form-ajuda">De onde veio o cliente.</span>
                </div>
                <div class="form-grupo">
                  <label for="cli-status">Status</label>
                  <select id="cli-status">
                    <option value="ativo"   ${(c?.status || 'ativo') === 'ativo' ? 'selected' : ''}>Ativo</option>
                    <option value="inativo" ${c?.status === 'inativo' ? 'selected' : ''}>Inativo</option>
                  </select>
                </div>
              </div>

              <div class="form-grupo">
                <label for="cli-obs">Observações</label>
                <textarea id="cli-obs" placeholder="Anotações sobre o cliente...">${escaparHTML(c?.observacoes || '')}</textarea>
              </div>
            </form>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_CLIENTES.fecharModalCliente()">Cancelar</button>
            <button class="btn btn--primario" onclick="document.getElementById('form-cliente').requestSubmit()">
              ${editando ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-cliente')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('cli-nome')?.focus(), 50);
  }

  function fecharModalCliente() {
    document.getElementById('modal-cliente')?.remove();
    clienteEditandoId = null;
  }

  function salvarCliente(event) {
    event.preventDefault();

    const dados = {
      nome:       document.getElementById('cli-nome').value.trim(),
      documento:  document.getElementById('cli-documento').value.trim(),
      telefone:   document.getElementById('cli-telefone').value.trim(),
      whatsapp:   document.getElementById('cli-whatsapp').value.trim(),
      email:      document.getElementById('cli-email').value.trim(),
      instagram:  document.getElementById('cli-instagram').value.trim(),
      endereco:   document.getElementById('cli-endereco').value.trim(),
      cidade:     document.getElementById('cli-cidade').value.trim(),
      estado:     document.getElementById('cli-estado').value.trim().toUpperCase(),
      chavePix:   document.getElementById('cli-pix').value.trim(),
      origem:     document.getElementById('cli-origem').value,
      status:     document.getElementById('cli-status').value,
      observacoes:document.getElementById('cli-obs').value.trim()
    };

    if (!dados.nome) return alert('Informe o nome do cliente.');

    if (clienteEditandoId) {
      atualizarCliente(clienteEditandoId, dados);
    } else {
      criarCliente(dados);
    }

    fecharModalCliente();
    rerender();
  }

  /* ==========================================================
     11. MODAL — FORNECEDOR
     ========================================================== */

  function abrirNovoFornecedor() {
    fornecedorEditandoId = null;
    abrirModalFornecedor();
  }

  function abrirEdicaoFornecedor(id) {
    fornecedorEditandoId = id;
    abrirModalFornecedor();
  }

  function abrirModalFornecedor() {
    const f = fornecedorEditandoId ? buscarFornecedor(fornecedorEditandoId) : null;
    const editando = !!f;

    const html = `
      <div class="modal-overlay ativo" id="modal-fornecedor">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
            <button class="modal__fechar" onclick="MODULO_CLIENTES.fecharModalFornecedor()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <form id="form-fornecedor" onsubmit="MODULO_CLIENTES.salvarFornecedor(event)">
              <div class="form-grupo">
                <label for="for-nome">Nome <span class="form-obrigatorio">*</span></label>
                <input id="for-nome" type="text" required value="${escaparHTML(f?.nome || '')}" placeholder="Nome ou razão social" />
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="for-documento">CPF / CNPJ</label>
                  <input id="for-documento" type="text" value="${escaparHTML(f?.documento || '')}" />
                </div>
                <div class="form-grupo">
                  <label for="for-telefone">Telefone</label>
                  <input id="for-telefone" type="text" value="${escaparHTML(f?.telefone || '')}" />
                </div>
                <div class="form-grupo">
                  <label for="for-whatsapp">WhatsApp</label>
                  <input id="for-whatsapp" type="text" value="${escaparHTML(f?.whatsapp || '')}" />
                </div>
              </div>

              <div class="form-linha">
                <div class="form-grupo">
                  <label for="for-email">E-mail</label>
                  <input id="for-email" type="email" value="${escaparHTML(f?.email || '')}" />
                </div>
                <div class="form-grupo">
                  <label for="for-status">Status</label>
                  <select id="for-status">
                    <option value="ativo"   ${(f?.status || 'ativo') === 'ativo' ? 'selected' : ''}>Ativo</option>
                    <option value="inativo" ${f?.status === 'inativo' ? 'selected' : ''}>Inativo</option>
                  </select>
                </div>
              </div>

              <div class="form-grupo">
                <label for="for-endereco">Endereço</label>
                <input id="for-endereco" type="text" value="${escaparHTML(f?.endereco || '')}" />
              </div>

              <div class="form-grupo">
                <label for="for-produtos">Produtos fornecidos</label>
                <input id="for-produtos" type="text" value="${escaparHTML(f?.produtosFornecidos || '')}" placeholder="Ex: Papel fotográfico, ímãs, fitas" />
              </div>

              <div class="form-grupo">
                <label for="for-obs">Observações</label>
                <textarea id="for-obs" placeholder="Anotações...">${escaparHTML(f?.observacoes || '')}</textarea>
              </div>
            </form>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_CLIENTES.fecharModalFornecedor()">Cancelar</button>
            <button class="btn btn--primario" onclick="document.getElementById('form-fornecedor').requestSubmit()">
              ${editando ? 'Salvar alterações' : 'Cadastrar fornecedor'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-fornecedor')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('for-nome')?.focus(), 50);
  }

  function fecharModalFornecedor() {
    document.getElementById('modal-fornecedor')?.remove();
    fornecedorEditandoId = null;
  }

  function salvarFornecedor(event) {
    event.preventDefault();

    const dados = {
      nome:      document.getElementById('for-nome').value.trim(),
      documento: document.getElementById('for-documento').value.trim(),
      telefone:  document.getElementById('for-telefone').value.trim(),
      whatsapp:  document.getElementById('for-whatsapp').value.trim(),
      email:     document.getElementById('for-email').value.trim(),
      endereco:  document.getElementById('for-endereco').value.trim(),
      produtosFornecidos: document.getElementById('for-produtos').value.trim(),
      status:    document.getElementById('for-status').value,
      observacoes: document.getElementById('for-obs').value.trim()
    };

    if (!dados.nome) return alert('Informe o nome do fornecedor.');

    if (fornecedorEditandoId) {
      atualizarFornecedor(fornecedorEditandoId, dados);
    } else {
      criarFornecedor(dados);
    }

    fecharModalFornecedor();
    rerender();
  }

  /* ==========================================================
     12. EXCLUSÃO
     ========================================================== */

  function confirmarExclusaoCliente(id) {
    const c = buscarCliente(id);
    if (!c) return;
    const ok = confirm(`Desativar o cliente "${c.nome}"?\n\nEle continuará no histórico.`);
    if (!ok) return;
    excluirCliente(id);
    rerender();
  }

  function confirmarExclusaoFornecedor(id) {
    const f = buscarFornecedor(id);
    if (!f) return;
    const ok = confirm(`Desativar o fornecedor "${f.nome}"?\n\nEle continuará no histórico.`);
    if (!ok) return;
    excluirFornecedor(id);
    rerender();
  }

  /* ==========================================================
     13. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'clientes') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-clientes-wrapper');
    if (wrapper) wrapper.innerHTML = renderTabela();
  }

  /* ==========================================================
     14. API PÚBLICA
     ========================================================== */

  return {
    render,
    abrirNovoCliente,
    abrirEdicaoCliente,
    fecharModalCliente,
    salvarCliente,
    confirmarExclusaoCliente,
    abrirNovoFornecedor,
    abrirEdicaoFornecedor,
    fecharModalFornecedor,
    salvarFornecedor,
    confirmarExclusaoFornecedor,
    alterarAba,
    alterarFiltroBusca,
    alterarFiltroOrigem,
    alterarFiltroStatus,
    _listarClientes: () => [...clientes],
    _listarFornecedores: () => [...fornecedores],
    _buscarCliente: buscarCliente,
    _buscarFornecedor: buscarFornecedor,
    ORIGENS
  };

})();

window.MODULO_CLIENTES = MODULO_CLIENTES;
window.renderClientes = MODULO_CLIENTES.render;
