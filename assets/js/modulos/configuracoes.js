/* ============================================================
   PRAFICAR ERP — MÓDULO CONFIGURAÇÕES (v2)
   Arquivo: assets/js/modulos/configuracoes.js
   Descrição: usuários, auditoria, backup, preferências
              (incluindo custos fixos mensais).
   ============================================================ */

const MODULO_CONFIG = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let usuarios = [];
  let logs = [];
  let proximoIdUsuario = 1;
  let proximoIdLog = 1;

  let abaAtiva = 'usuarios';
  let usuarioEditandoId = null;

  // Chave do localStorage para preferências
  const LS_PREFS = 'praficar_preferencias';

  let preferencias = {
    margemPadrao: 40,
    estoqueMinimoPadrao: 5,
    custosFixosMensais: 0
  };

  /* ==========================================================
     2. MÓDULOS E AÇÕES
     ========================================================== */

  const MODULOS_SISTEMA = [
    { chave: 'inicio',      nome: 'Início' },
    { chave: 'vendas',      nome: 'Vendas' },
    { chave: 'encomendas',  nome: 'Encomendas' },
    { chave: 'produtos',    nome: 'Produtos & Estoque' },
    { chave: 'precificar',  nome: 'Precificar' },
    { chave: 'canais',      nome: 'Canais de Venda' },
    { chave: 'financeiro',  nome: 'Financeiro' },
    { chave: 'clientes',    nome: 'Clientes & Fornecedores' },
    { chave: 'relatorios',  nome: 'Relatórios' },
    { chave: 'qrcode',      nome: 'QR Code' },
    { chave: 'config',      nome: 'Configurações' }
  ];

  const ACOES_SENSIVEIS = [
    { chave: 'excluir',              nome: 'Excluir registros' },
    { chave: 'cancelar_venda',       nome: 'Cancelar venda' },
    { chave: 'alterar_preco',        nome: 'Alterar preço' },
    { chave: 'alterar_custo',        nome: 'Alterar custo' },
    { chave: 'alterar_margem',       nome: 'Alterar margem' },
    { chave: 'autorizar_preco_min',  nome: 'Autorizar preço abaixo do mínimo' },
    { chave: 'restaurar_backup',     nome: 'Restaurar backup' },
    { chave: 'exportar_dados',       nome: 'Exportar dados completos' },
    { chave: 'ver_financeiro',       nome: 'Ver relatórios financeiros' }
  ];

  /* ==========================================================
     3. PERSISTÊNCIA DE PREFERÊNCIAS
     ========================================================== */

  function carregarPreferencias() {
    try {
      const raw = localStorage.getItem(LS_PREFS);
      if (raw) {
        const salvas = JSON.parse(raw);
        preferencias = { ...preferencias, ...salvas };
      }
    } catch (e) {
      console.error('[PraFicar] Erro ao carregar preferências:', e);
    }
  }

  function salvarPreferenciasLocalStorage() {
    try {
      localStorage.setItem(LS_PREFS, JSON.stringify(preferencias));
      // Chave específica para o dashboard ler
      localStorage.setItem('praficar_custos_fixos', String(preferencias.custosFixosMensais || 0));
    } catch (e) {
      console.error('[PraFicar] Erro ao salvar preferências:', e);
    }
  }

  function obterPreferencias() {
    return { ...preferencias };
  }

  /* ==========================================================
     4. USUÁRIO PADRÃO
     ========================================================== */

  function inicializarUsuarioPadrao() {
    if (usuarios.length > 0) return;

    usuarios.push({
      id: proximoIdUsuario++,
      nome: 'Administrador',
      email: 'admin@praficar.local',
      status: 'ativo',
      modulos: MODULOS_SISTEMA.map(m => m.chave),
      acoes: ACOES_SENSIVEIS.map(a => a.chave),
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });

    registrarLog('config', 'usuario_padrao_criado', 'Administrador inicial criado.');
  }

  /* ==========================================================
     5. UTILITÁRIOS
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

  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatarMoeda(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function iniciais(nome) {
    if (!nome) return '?';
    const partes = nome.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  /* ==========================================================
     6. USUÁRIOS
     ========================================================== */

  function criarUsuario(dados) {
    const u = {
      id: proximoIdUsuario++,
      nome: dados.nome,
      email: dados.email,
      status: dados.status || 'ativo',
      modulos: dados.modulos || [],
      acoes: dados.acoes || [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    usuarios.push(u);
    registrarLog('config', 'usuario_criado', `${u.nome} (${u.email})`);
    return u;
  }

  function atualizarUsuario(id, dados) {
    const idx = usuarios.findIndex(u => u.id === id);
    if (idx === -1) return null;

    if (
      usuarios[idx].modulos.includes('config') &&
      !dados.modulos.includes('config')
    ) {
      const outros = usuarios.filter(u => u.id !== id && u.status === 'ativo' && u.modulos.includes('config'));
      if (outros.length === 0) {
        alert('Não é possível remover o último usuário com acesso a Configurações.');
        return null;
      }
    }

    usuarios[idx] = {
      ...usuarios[idx],
      ...dados,
      atualizadoEm: new Date().toISOString()
    };
    registrarLog('config', 'usuario_atualizado', `${usuarios[idx].nome}`);
    return usuarios[idx];
  }

  function excluirUsuario(id) {
    const idx = usuarios.findIndex(u => u.id === id);
    if (idx === -1) return false;

    if (usuarios[idx].modulos.includes('config')) {
      const outros = usuarios.filter(u => u.id !== id && u.status === 'ativo' && u.modulos.includes('config'));
      if (outros.length === 0) {
        alert('Não é possível excluir o último usuário com acesso a Configurações.');
        return false;
      }
    }

    const nome = usuarios[idx].nome;
    usuarios.splice(idx, 1);
    registrarLog('config', 'usuario_excluido', nome);
    return true;
  }

  function buscarUsuario(id) {
    return usuarios.find(u => u.id === id) || null;
  }

  /* ==========================================================
     7. LOGS
     ========================================================== */

  function registrarLog(modulo, acao, detalhe = '') {
    logs.unshift({
      id: proximoIdLog++,
      modulo,
      acao,
      detalhe,
      usuario: 'Administrador',
      data: new Date().toISOString()
    });
    if (logs.length > 500) logs.length = 500;
  }

  /* ==========================================================
     8. BACKUP / EXPORTAÇÃO
     ========================================================== */

  function coletarDados() {
    return {
      versao: '1.0',
      exportadoEm: new Date().toISOString(),
      produtos: window.MODULO_PRODUTOS?._listar() || [],
      canais: window.MODULO_CANAIS?._listar() || [],
      precificacoes: window.MODULO_PRECIFICAR?._listar() || [],
      encomendas: window.MODULO_ENCOMENDAS?._listar() || [],
      vendas: window.MODULO_VENDAS?._listar() || [],
      financeiro: window.MODULO_FINANCEIRO?._listar() || [],
      clientes: window.MODULO_CLIENTES?._listarClientes() || [],
      fornecedores: window.MODULO_CLIENTES?._listarFornecedores() || [],
      qrcodes: window.MODULO_QRCODE?._listar() || [],
      usuarios,
      preferencias
    };
  }

  function baixarJSON() {
    const dados = coletarDados();
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `praficar-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    registrarLog('config', 'backup_json', 'Exportação completa em JSON');
    rerender();
  }

  function exportarCSV(entidade) {
    const mapa = {
      produtos: window.MODULO_PRODUTOS?._listar() || [],
      canais: window.MODULO_CANAIS?._listar() || [],
      encomendas: window.MODULO_ENCOMENDAS?._listar() || [],
      vendas: window.MODULO_VENDAS?._listar() || [],
      financeiro: window.MODULO_FINANCEIRO?._listar() || [],
      clientes: window.MODULO_CLIENTES?._listarClientes() || [],
      fornecedores: window.MODULO_CLIENTES?._listarFornecedores() || []
    };

    const lista = mapa[entidade] || [];
    if (lista.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }

    const colunas = Object.keys(lista[0]).filter(k => {
      const v = lista[0][k];
      return v === null || typeof v !== 'object';
    });

    const linhas = [colunas.join(';')];
    lista.forEach(item => {
      linhas.push(colunas.map(c => {
        let v = item[c];
        if (v === null || v === undefined) v = '';
        v = String(v).replace(/;/g, ',').replace(/\n/g, ' ');
        return `"${v}"`;
      }).join(';'));
    });

    const blob = new Blob(['\ufeff' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `praficar-${entidade}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    registrarLog('config', 'exportacao_csv', entidade);
    rerender();
  }

  /* ==========================================================
     9. PREFERÊNCIAS
     ========================================================== */

  function atualizarPreferencias(campo, valor) {
    if (campo === 'custosFixosMensais' || campo === 'margemPadrao' || campo === 'estoqueMinimoPadrao') {
      preferencias[campo] = Number(valor) || 0;
    } else {
      preferencias[campo] = valor;
    }
  }

  function salvarPreferencias() {
    salvarPreferenciasLocalStorage();
    registrarLog('config', 'preferencias_salvas', 'Preferências atualizadas');
    alert('Preferências salvas.');
    rerender();
  }

  /* ==========================================================
     10. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    inicializarUsuarioPadrao();

    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Configurações</h1>
          <p class="pagina-header__subtitulo">Usuários, auditoria, backup e preferências.</p>
        </div>
      </div>

      <div class="cfg-abas">
        <button class="cfg-aba ${abaAtiva === 'usuarios' ? 'cfg-aba--ativa' : ''}" onclick="MODULO_CONFIG.alterarAba('usuarios')">Usuários</button>
        <button class="cfg-aba ${abaAtiva === 'auditoria' ? 'cfg-aba--ativa' : ''}" onclick="MODULO_CONFIG.alterarAba('auditoria')">Auditoria</button>
        <button class="cfg-aba ${abaAtiva === 'backup' ? 'cfg-aba--ativa' : ''}" onclick="MODULO_CONFIG.alterarAba('backup')">Backup</button>
        <button class="cfg-aba ${abaAtiva === 'preferencias' ? 'cfg-aba--ativa' : ''}" onclick="MODULO_CONFIG.alterarAba('preferencias')">Preferências</button>
      </div>

      ${abaAtiva === 'usuarios' ? renderAbaUsuarios() : ''}
      ${abaAtiva === 'auditoria' ? renderAbaAuditoria() : ''}
      ${abaAtiva === 'backup' ? renderAbaBackup() : ''}
      ${abaAtiva === 'preferencias' ? renderAbaPreferencias() : ''}
    `;
  }

  /* ==========================================================
     11. ABA USUÁRIOS
     ========================================================== */

  function renderAbaUsuarios() {
    return `
      <div class="cfg-bloco">
        <div class="cfg-bloco__header">
          <div>
            <h2 class="cfg-bloco__titulo">Usuários</h2>
            <p class="cfg-bloco__subtitulo">Quem acessa e quais módulos cada um vê.</p>
          </div>
          <button class="btn btn--primario" onclick="MODULO_CONFIG.abrirNovoUsuario()">+ Novo usuário</button>
        </div>

        <div class="tabela-wrapper">
          <div class="tabela-scroll">
            <table class="tabela">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th class="tabela__numero">Módulos</th>
                  <th>Status</th>
                  <th class="tabela__acao"></th>
                </tr>
              </thead>
              <tbody>
                ${usuarios.map(u => renderLinhaUsuario(u)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderLinhaUsuario(u) {
    return `
      <tr>
        <td>
          <div class="cfg-usuario">
            <div class="cfg-avatar">${iniciais(u.nome)}</div>
            <div class="cfg-usuario__info">
              <div class="cfg-usuario__nome">${escaparHTML(u.nome)}</div>
              <div class="cfg-usuario__meta">${u.acoes.length} ações sensíveis</div>
            </div>
          </div>
        </td>
        <td>${escaparHTML(u.email)}</td>
        <td class="tabela__numero">${u.modulos.length}</td>
        <td>
          ${u.status === 'ativo'
            ? '<span class="badge badge--sucesso">Ativo</span>'
            : '<span class="badge badge--neutro">Inativo</span>'}
        </td>
        <td class="tabela__acao">
          <div class="acoes-linha">
            <button class="btn-icone" title="Editar" onclick="MODULO_CONFIG.abrirEdicaoUsuario(${u.id})">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icone btn-icone--perigo" title="Excluir" onclick="MODULO_CONFIG.confirmarExclusaoUsuario(${u.id})">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /* ==========================================================
     12. ABA AUDITORIA
     ========================================================== */

  function renderAbaAuditoria() {
    return `
      <div class="cfg-bloco">
        <div class="cfg-bloco__header">
          <div>
            <h2 class="cfg-bloco__titulo">Auditoria</h2>
            <p class="cfg-bloco__subtitulo">Últimas ${logs.length} ações registradas.</p>
          </div>
        </div>

        ${logs.length === 0 ? `
          <div class="vazio">
            <div class="vazio__icone"><svg viewBox="0 0 24 24"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg></div>
            <h3 class="vazio__titulo">Sem registros</h3>
            <p class="vazio__descricao">As ações do sistema aparecerão aqui.</p>
          </div>
        ` : `
          <div class="tabela-wrapper">
            <div class="tabela-scroll">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Módulo</th>
                    <th>Ação</th>
                    <th>Detalhe</th>
                    <th>Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(l => `
                    <tr>
                      <td class="cfg-log-data">${formatarData(l.data)}</td>
                      <td><span class="badge badge--info">${escaparHTML(l.modulo)}</span></td>
                      <td>${escaparHTML(l.acao)}</td>
                      <td class="cfg-log-detalhe">${escaparHTML(l.detalhe || '—')}</td>
                      <td>${escaparHTML(l.usuario)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}
      </div>
    `;
  }

  /* ==========================================================
     13. ABA BACKUP
     ========================================================== */

  function renderAbaBackup() {
    return `
      <div class="cfg-bloco">
        <div class="cfg-bloco__header">
          <div>
            <h2 class="cfg-bloco__titulo">Backup completo</h2>
            <p class="cfg-bloco__subtitulo">Exportação total em JSON (todos os dados).</p>
          </div>
          <button class="btn btn--primario" onclick="MODULO_CONFIG.baixarJSON()">Baixar backup</button>
        </div>

        <div class="alerta alerta--info">
          <span class="alerta__icone"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></span>
          <div class="alerta__conteudo">
            <div class="alerta__titulo">Sobre backup nesta versão</div>
            O PraFicar ainda está em desenvolvimento com dados em memória. O backup do Supabase será ativado quando a integração com banco de dados for concluída.
          </div>
        </div>
      </div>

      <div class="cfg-bloco">
        <div class="cfg-bloco__header">
          <div>
            <h2 class="cfg-bloco__titulo">Exportações individuais (CSV)</h2>
            <p class="cfg-bloco__subtitulo">Ideal para abrir no Excel ou Google Sheets.</p>
          </div>
        </div>

        <div class="cfg-exportacoes">
          ${[
            { chave: 'produtos',     nome: 'Produtos' },
            { chave: 'canais',       nome: 'Canais' },
            { chave: 'encomendas',   nome: 'Encomendas' },
            { chave: 'vendas',       nome: 'Vendas' },
            { chave: 'financeiro',   nome: 'Financeiro' },
            { chave: 'clientes',     nome: 'Clientes' },
            { chave: 'fornecedores', nome: 'Fornecedores' }
          ].map(e => `
            <button class="cfg-exportacao" onclick="MODULO_CONFIG.exportarCSV('${e.chave}')">
              <span class="cfg-exportacao__nome">${e.nome}</span>
              <span class="cfg-exportacao__acao">CSV ↓</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ==========================================================
     14. ABA PREFERÊNCIAS
     ========================================================== */

  function renderAbaPreferencias() {
    return `
      <div class="cfg-bloco">
        <div class="cfg-bloco__header">
          <div>
            <h2 class="cfg-bloco__titulo">Preferências do sistema</h2>
            <p class="cfg-bloco__subtitulo">Valores padrão usados em todo o PraFicar.</p>
          </div>
        </div>

        <div class="form-linha">
          <div class="form-grupo">
            <label for="pref-margem">Margem desejada padrão (%)</label>
            <input id="pref-margem" type="number" min="0" max="95" step="1" value="${preferencias.margemPadrao}" oninput="MODULO_CONFIG.atualizarPreferencias('margemPadrao', this.value)" />
            <span class="form-ajuda">Usada na Precificação quando nenhum valor é informado.</span>
          </div>

          <div class="form-grupo">
            <label for="pref-estoque">Estoque mínimo padrão</label>
            <input id="pref-estoque" type="number" min="0" step="1" value="${preferencias.estoqueMinimoPadrao}" oninput="MODULO_CONFIG.atualizarPreferencias('estoqueMinimoPadrao', this.value)" />
            <span class="form-ajuda">Aplicado em produtos novos.</span>
          </div>
        </div>

        <hr class="divisor" />

        <div class="cfg-bloco__header" style="margin-bottom: var(--esp-4);">
          <div>
            <h3 class="cfg-bloco__titulo">Ponto de equilíbrio</h3>
            <p class="cfg-bloco__subtitulo">Usado no Dashboard para calcular a meta mensal.</p>
          </div>
        </div>

        <div class="form-linha">
          <div class="form-grupo">
            <label for="pref-custos-fixos">Custos fixos mensais (R$)</label>
            <input id="pref-custos-fixos" type="number" min="0" step="0.01" value="${preferencias.custosFixosMensais}" oninput="MODULO_CONFIG.atualizarPreferencias('custosFixosMensais', this.value)" />
            <span class="form-ajuda">
              Soma de aluguel, internet, energia, água, telefone e outros custos fixos. Ex: 1200.
            </span>
          </div>

          <div class="form-grupo">
            <label>Impacto</label>
            <div class="cfg-impacto">
              <span class="cfg-impacto__valor">${formatarMoeda(preferencias.custosFixosMensais)}</span>
              <span class="cfg-impacto__desc">
                com margem de ${preferencias.margemPadrao}% → meta de
                ${formatarMoeda(preferencias.margemPadrao > 0 ? preferencias.custosFixosMensais / (preferencias.margemPadrao / 100) : 0)}
              </span>
            </div>
          </div>
        </div>

        <div class="cfg-acoes">
          <button class="btn btn--primario" onclick="MODULO_CONFIG.salvarPreferencias()">Salvar preferências</button>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     15. MODAL DE USUÁRIO
     ========================================================== */

  function abrirNovoUsuario() {
    usuarioEditandoId = null;
    abrirModalUsuario();
  }

  function abrirEdicaoUsuario(id) {
    usuarioEditandoId = id;
    abrirModalUsuario();
  }

  function abrirModalUsuario() {
    const u = usuarioEditandoId ? buscarUsuario(usuarioEditandoId) : null;
    const editando = !!u;

    const modulosAtivos = u ? u.modulos : MODULOS_SISTEMA.map(m => m.chave);
    const acoesAtivas = u ? u.acoes : [];

    const html = `
      <div class="modal-overlay ativo" id="modal-usuario">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar usuário' : 'Novo usuário'}</h2>
            <button class="modal__fechar" onclick="MODULO_CONFIG.fecharModalUsuario()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <form id="form-usuario" onsubmit="MODULO_CONFIG.salvarUsuario(event)">
              <div class="form-linha">
                <div class="form-grupo">
                  <label for="usr-nome">Nome <span class="form-obrigatorio">*</span></label>
                  <input id="usr-nome" type="text" required value="${escaparHTML(u?.nome || '')}" placeholder="Nome completo" />
                </div>
                <div class="form-grupo">
                  <label for="usr-email">E-mail <span class="form-obrigatorio">*</span></label>
                  <input id="usr-email" type="email" required value="${escaparHTML(u?.email || '')}" placeholder="usuario@praficar.local" />
                </div>
                <div class="form-grupo">
                  <label for="usr-status">Status</label>
                  <select id="usr-status">
                    <option value="ativo"   ${(u?.status || 'ativo') === 'ativo' ? 'selected' : ''}>Ativo</option>
                    <option value="inativo" ${u?.status === 'inativo' ? 'selected' : ''}>Inativo</option>
                  </select>
                </div>
              </div>

              <div class="cfg-secao-form">
                <h3 class="cfg-secao-form__titulo">Módulos liberados</h3>
                <p class="cfg-secao-form__subtitulo">O usuário só vê os módulos marcados abaixo.</p>
                <div class="cfg-checkbox-grid">
                  ${MODULOS_SISTEMA.map(m => `
                    <label class="cfg-check">
                      <input type="checkbox" value="${m.chave}" ${modulosAtivos.includes(m.chave) ? 'checked' : ''} data-grupo="modulos" />
                      <span>${m.nome}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <div class="cfg-secao-form">
                <h3 class="cfg-secao-form__titulo">Ações sensíveis</h3>
                <p class="cfg-secao-form__subtitulo">Ações que exigem autorização explícita.</p>
                <div class="cfg-checkbox-grid">
                  ${ACOES_SENSIVEIS.map(a => `
                    <label class="cfg-check">
                      <input type="checkbox" value="${a.chave}" ${acoesAtivas.includes(a.chave) ? 'checked' : ''} data-grupo="acoes" />
                      <span>${a.nome}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            </form>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_CONFIG.fecharModalUsuario()">Cancelar</button>
            <button class="btn btn--primario" onclick="document.getElementById('form-usuario').requestSubmit()">
              ${editando ? 'Salvar alterações' : 'Cadastrar usuário'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-usuario')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('usr-nome')?.focus(), 50);
  }

  function fecharModalUsuario() {
    document.getElementById('modal-usuario')?.remove();
    usuarioEditandoId = null;
  }

  function salvarUsuario(event) {
    event.preventDefault();

    const nome = document.getElementById('usr-nome').value.trim();
    const email = document.getElementById('usr-email').value.trim();
    const status = document.getElementById('usr-status').value;

    if (!nome) return alert('Informe o nome.');
    if (!email) return alert('Informe o e-mail.');

    const modulos = Array.from(document.querySelectorAll('input[data-grupo="modulos"]:checked')).map(i => i.value);
    const acoes = Array.from(document.querySelectorAll('input[data-grupo="acoes"]:checked')).map(i => i.value);

    if (modulos.length === 0) return alert('Selecione pelo menos um módulo.');

    const dados = { nome, email, status, modulos, acoes };

    if (usuarioEditandoId) {
      const r = atualizarUsuario(usuarioEditandoId, dados);
      if (!r) return;
    } else {
      criarUsuario(dados);
    }

    fecharModalUsuario();
    rerender();
  }

  function confirmarExclusaoUsuario(id) {
    const u = buscarUsuario(id);
    if (!u) return;
    const ok = confirm(`Excluir o usuário "${u.nome}"?\n\nEssa ação não pode ser desfeita.`);
    if (!ok) return;
    const r = excluirUsuario(id);
    if (r) rerender();
  }
     /* ==========================================================
     16. NAVEGAÇÃO DE ABAS
     ========================================================== */

  function alterarAba(aba) {
    abaAtiva = aba;
    rerender();
  }

  /* ==========================================================
     17. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'config') {
      container.innerHTML = render();
    }
  }

  /* ==========================================================
     18. INICIALIZAÇÃO
     ========================================================== */

  function inicializar() {
    carregarPreferencias();
    salvarPreferenciasLocalStorage(); // garante que a chave do dashboard existe
  }

  // Inicializa automaticamente ao carregar
  inicializar();

  /* ==========================================================
     19. API PÚBLICA
     ========================================================== */

  return {
    render,
    alterarAba,
    abrirNovoUsuario,
    abrirEdicaoUsuario,
    fecharModalUsuario,
    salvarUsuario,
    confirmarExclusaoUsuario,
    baixarJSON,
    exportarCSV,
    atualizarPreferencias,
    salvarPreferencias,
    registrarLog,
    obterPreferencias,
    _listarUsuarios: () => [...usuarios],
    _listarLogs: () => [...logs],
    MODULOS_SISTEMA,
    ACOES_SENSIVEIS
  };

})();

window.MODULO_CONFIG = MODULO_CONFIG;
window.renderConfig = MODULO_CONFIG.render;
