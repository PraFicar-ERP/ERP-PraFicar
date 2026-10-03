/* ============================================================
   PRAFICAR ERP — MÓDULO QR CODE (v2)
   Arquivo: assets/js/modulos/qrcode.js
   Descrição: geração de QR Codes diretos (sem redirecionamento)
              com logo PraFicar no centro.
   ============================================================ */

const MODULO_QRCODE = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let qrcodes = [];
  let proximoId = 1;
  let filtroBusca = '';
  let filtroTipo = '';
  let qrcodeEditandoId = null;

  const LOGO_PATH = 'assets/img/Logo.jpeg';

  /* ==========================================================
     2. TIPOS
     ========================================================== */

  const TIPOS = [
    { codigo: 'email',      nome: 'E-mail' },
    { codigo: 'whatsapp',   nome: 'WhatsApp' },
    { codigo: 'instagram',  nome: 'Instagram' },
    { codigo: 'pix',        nome: 'Pix' },
    { codigo: 'telefone',   nome: 'Telefone' },
    { codigo: 'site',       nome: 'Site / link' },
    { codigo: 'produto',    nome: 'Produto' },
    { codigo: 'encomenda',  nome: 'Encomenda' },
    { codigo: 'venda',      nome: 'Venda' },
    { codigo: 'catalogo',   nome: 'Catálogo' },
    { codigo: 'link',       nome: 'Link livre' }
  ];

  function tipoInfo(codigo) {
    return TIPOS.find(t => t.codigo === codigo) || TIPOS[0];
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

  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function gerarId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  /* ==========================================================
     4. MONTAR DESTINO FINAL
     ========================================================== */

  function montarDestinoFinal(q) {
    const destino = String(q.destino || '').trim();

    if (!destino) return '';

    switch (q.tipo) {
      case 'email':
        return destino.startsWith('mailto:') ? destino : 'mailto:' + destino;
      case 'whatsapp':
        // Aceita número com ou sem formatação
        const num = destino.replace(/\D/g, '');
        return 'https://wa.me/' + num;
      case 'instagram':
        if (destino.startsWith('http')) return destino;
        const user = destino.replace('@', '');
        return 'https://instagram.com/' + user;
      case 'telefone':
        return destino.startsWith('tel:') ? destino : 'tel:' + destino.replace(/\D/g, '');
      case 'pix':
        return destino; // chave ou payload Pix
      case 'site':
      case 'produto':
      case 'encomenda':
      case 'venda':
      case 'catalogo':
      case 'link':
        if (destino.startsWith('http')) return destino;
        return 'https://' + destino;
      default:
        return destino;
    }
  }

  /* ==========================================================
     5. CRUD
     ========================================================== */

  function criarQRCode(dados) {
    const q = {
      id: proximoId++,
      codigo: gerarId(),
      titulo: dados.titulo || 'Sem título',
      tipo: dados.tipo || 'link',
      destino: dados.destino || '',
      observacoes: dados.observacoes || '',
      cor: dados.cor || '#1B3A5C',
      comLogo: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    qrcodes.push(q);
    return q;
  }

  function atualizarQRCode(id, dados) {
    const idx = qrcodes.findIndex(q => q.id === id);
    if (idx === -1) return null;
    qrcodes[idx] = {
      ...qrcodes[idx],
      ...dados,
      atualizadoEm: new Date().toISOString()
    };
    return qrcodes[idx];
  }

  function excluirQRCode(id) {
    const idx = qrcodes.findIndex(q => q.id === id);
    if (idx === -1) return false;
    qrcodes.splice(idx, 1);
    return true;
  }

  function buscarQRCode(id) {
    return qrcodes.find(q => q.id === id) || null;
  }

  /* ==========================================================
     6. FILTROS
     ========================================================== */

  function qrcodesFiltrados() {
    return qrcodes.filter(q => {
      if (filtroTipo && q.tipo !== filtroTipo) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${q.titulo} ${q.destino}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarFiltroBusca(v) { filtroBusca = v; rerenderGrade(); }
  function alterarFiltroTipo(v)   { filtroTipo = v; rerender(); }

  /* ==========================================================
     7. GERAÇÃO DO QR CODE COM LOGO
     ========================================================== */

  function gerarSVG(q, tamanho = 220) {
    if (typeof qrcode === 'undefined') {
      return '<div class="qr-erro">Biblioteca QR não carregada.</div>';
    }

    const conteudo = montarDestinoFinal(q);
    if (!conteudo) {
      return '<div class="qr-erro">Destino vazio.</div>';
    }

    // Nível H = 30% de correção (permite logo no centro)
    const qr = qrcode(0, 'H');
    qr.addData(conteudo);
    qr.make();

    const moduloCount = qr.getModuleCount();
    const margem = 2;
    const total = moduloCount + margem * 2;

    const cor = q.cor || '#1B3A5C';

    // Área da logo (20% do total)
    const logoPct = 0.20;
    const logoSize = total * logoPct;
    const logoX = (total - logoSize) / 2;
    const logoY = (total - logoSize) / 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${tamanho}" height="${tamanho}" shape-rendering="crispEdges">`;
    svg += `<rect width="${total}" height="${total}" fill="#FFFFFF"/>`;

    // Módulos do QR
    for (let r = 0; r < moduloCount; r++) {
      for (let c = 0; c < moduloCount; c++) {
        if (qr.isDark(r, c)) {
          svg += `<rect x="${c + margem}" y="${r + margem}" width="1" height="1" fill="${cor}"/>`;
        }
      }
    }

    // Fundo branco atrás da logo (com padding)
    const padding = total * 0.015;
    svg += `<rect x="${logoX - padding}" y="${logoY - padding}" width="${logoSize + padding * 2}" height="${logoSize + padding * 2}" fill="#FFFFFF"/>`;

    // Logo no centro
    svg += `<image href="${LOGO_PATH}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;

    svg += `</svg>`;
    return svg;
  }

  /* ==========================================================
     8. DOWNLOAD PNG
     ========================================================== */

  function baixarPNG(id) {
    const q = buscarQRCode(id);
    if (!q) return;

    const svg = gerarSVG(q, 1024);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0, 1024, 1024);

      canvas.toBlob(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `qrcode-${q.codigo}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
      }, 'image/png');

      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  /* ==========================================================
     9. DOWNLOAD SVG
     ========================================================== */

  function baixarSVG(id) {
    const q = buscarQRCode(id);
    if (!q) return;
    const svg = gerarSVG(q, 1024);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `qrcode-${q.codigo}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ==========================================================
     10. IMPRIMIR
     ========================================================== */

  function imprimir(id) {
    const q = buscarQRCode(id);
    if (!q) return;

    const svg = gerarSVG(q, 400);
    const destino = montarDestinoFinal(q);

    const janela = window.open('', '_blank');
    janela.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code — ${escaparHTML(q.titulo)}</title>
        <style>
          body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px; }
          h1 { font-size: 20px; color: #1B3A5C; margin-bottom: 8px; }
          p { color: #666; font-size: 13px; margin-bottom: 24px; }
          .qr { display: inline-block; padding: 16px; background: #fff; border: 1px solid #ddd; border-radius: 8px; }
          .dest { font-family: monospace; font-size: 11px; color: #888; margin-top: 16px; word-break: break-all; max-width: 400px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>${escaparHTML(q.titulo)}</h1>
        <p>${escaparHTML(tipoInfo(q.tipo).nome)}</p>
        <div class="qr">${svg}</div>
        <div class="dest">${escaparHTML(destino)}</div>
        <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
      </body>
      </html>
    `);
    janela.document.close();
  }

  /* ==========================================================
     11. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">QR Code</h1>
          <p class="pagina-header__subtitulo">
            ${qrcodes.length} ${qrcodes.length === 1 ? 'código gerado' : 'códigos gerados'} ·
            todos levam direto ao destino, com a logo PraFicar no centro
          </p>
        </div>
        <div class="pagina-header__acoes">
          <button class="btn btn--primario" onclick="MODULO_QRCODE.abrirNovo()">
            + Novo QR Code
          </button>
        </div>
      </div>

      <div class="filtros-qrcode">
        <div class="filtros-qrcode__busca">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            placeholder="Buscar por título ou destino..."
            value="${escaparHTML(filtroBusca)}"
            oninput="MODULO_QRCODE.alterarFiltroBusca(this.value)"
          />
        </div>

        <select class="filtros-qrcode__select" onchange="MODULO_QRCODE.alterarFiltroTipo(this.value)">
          <option value="">Todos os tipos</option>
          ${TIPOS.map(t => `
            <option value="${t.codigo}" ${filtroTipo === t.codigo ? 'selected' : ''}>${t.nome}</option>
          `).join('')}
        </select>
      </div>

      <div id="grade-qrcode-wrapper">
        ${renderGrade()}
      </div>
    `;
  }

  /* ==========================================================
     12. RENDER — GRADE
     ========================================================== */

  function renderGrade() {
    const lista = qrcodesFiltrados();

    if (lista.length === 0) {
      return `
        <div class="card">
          <div class="vazio">
            <div class="vazio__icone">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M21 14v3M14 21h3M21 21h.01"/></svg>
            </div>
            <h3 class="vazio__titulo">
              ${qrcodes.length === 0 ? 'Nenhum QR Code gerado' : 'Nenhum resultado para os filtros'}
            </h3>
            <p class="vazio__descricao">
              ${qrcodes.length === 0
                ? 'Gere QR Codes para e-mail, WhatsApp, Instagram, Pix, telefone, site, produto, encomenda e mais.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
            ${qrcodes.length === 0 ? `
              <button class="btn btn--primario" onclick="MODULO_QRCODE.abrirNovo()">
                + Novo QR Code
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="qr-grade">
        ${lista.map(q => renderCard(q)).join('')}
      </div>
    `;
  }

  function renderCard(q) {
    const tipo = tipoInfo(q.tipo);
    const svg = gerarSVG(q, 200);
    const destino = montarDestinoFinal(q);

    return `
      <div class="qr-card">
        <div class="qr-card__preview">
          ${svg}
        </div>

        <div class="qr-card__info">
          <div class="qr-card__titulo">${escaparHTML(q.titulo)}</div>
          <span class="badge badge--info">${escaparHTML(tipo.nome)}</span>
        </div>

        <div class="qr-card__destino">
          <span class="qr-card__destino-label">Destino:</span>
          <span class="qr-card__destino-url">${escaparHTML(destino)}</span>
        </div>

        <div class="qr-card__acoes">
          <button class="btn btn--secundario btn--sm" onclick="MODULO_QRCODE.baixarPNG(${q.id})" title="Baixar PNG">PNG</button>
          <button class="btn btn--secundario btn--sm" onclick="MODULO_QRCODE.baixarSVG(${q.id})" title="Baixar SVG">SVG</button>
          <button class="btn btn--secundario btn--sm" onclick="MODULO_QRCODE.imprimir(${q.id})" title="Imprimir">Imprimir</button>
          <button class="btn-icone" onclick="MODULO_QRCODE.abrirEdicao(${q.id})" title="Editar">
            <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button class="btn-icone btn-icone--perigo" onclick="MODULO_QRCODE.confirmarExclusao(${q.id})" title="Excluir">
            <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }
     /* ==========================================================
     13. MODAL
     ========================================================== */

  function abrirNovo() {
    qrcodeEditandoId = null;
    abrirModal();
  }

  function abrirEdicao(id) {
    qrcodeEditandoId = id;
    abrirModal();
  }

  function abrirModal() {
    const q = qrcodeEditandoId ? buscarQRCode(qrcodeEditandoId) : null;
    const editando = !!q;

    const html = `
      <div class="modal-overlay ativo" id="modal-qrcode">
        <div class="modal modal--grande" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h2 class="modal__titulo">${editando ? 'Editar QR Code' : 'Novo QR Code'}</h2>
            <button class="modal__fechar" onclick="MODULO_QRCODE.fecharModal()" aria-label="Fechar">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="modal__body">
            <div class="form-grupo">
              <label for="qr-titulo">Título <span class="form-obrigatorio">*</span></label>
              <input id="qr-titulo" type="text" required value="${escaparHTML(q?.titulo || '')}" placeholder="Ex: WhatsApp da loja" oninput="MODULO_QRCODE.atualizarPreview()" />
            </div>

            <div class="form-linha">
              <div class="form-grupo">
                <label for="qr-tipo">Tipo <span class="form-obrigatorio">*</span></label>
                <select id="qr-tipo" required onchange="MODULO_QRCODE.aoMudarTipo()">
                  ${TIPOS.map(t => `
                    <option value="${t.codigo}" ${(q?.tipo || 'link') === t.codigo ? 'selected' : ''}>${t.nome}</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-grupo">
                <label for="qr-cor">Cor do QR Code</label>
                <input id="qr-cor" type="color" value="${q?.cor || '#1B3A5C'}" oninput="MODULO_QRCODE.atualizarPreview()" />
              </div>
            </div>

            <div class="form-grupo">
              <label for="qr-destino" id="qr-destino-label">Destino <span class="form-obrigatorio">*</span></label>
              <input id="qr-destino" type="text" value="${escaparHTML(q?.destino || '')}" placeholder="Preencha o destino" oninput="MODULO_QRCODE.atualizarPreview()" />
              <span class="form-ajuda" id="qr-destino-ajuda">URL, texto ou link do destino.</span>
            </div>

            <div class="form-grupo">
              <label for="qr-obs">Observações</label>
              <textarea id="qr-obs" placeholder="Anotações...">${escaparHTML(q?.observacoes || '')}</textarea>
            </div>

            <div class="qr-preview-wrapper">
              <div class="qr-preview-label">Pré-visualização</div>
              <div class="qr-preview" id="qr-preview"></div>
            </div>
          </div>

          <div class="modal__footer">
            <button class="btn btn--secundario" onclick="MODULO_QRCODE.fecharModal()">Cancelar</button>
            <button class="btn btn--primario" onclick="MODULO_QRCODE.salvar()">
              ${editando ? 'Salvar alterações' : 'Gerar QR Code'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-qrcode')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
      aoMudarTipo();
      atualizarPreview();
      document.getElementById('qr-titulo')?.focus();
    }, 60);
  }

  function fecharModal() {
    document.getElementById('modal-qrcode')?.remove();
    qrcodeEditandoId = null;
  }

  /* ==========================================================
     14. AO MUDAR TIPO
     ========================================================== */

  function aoMudarTipo() {
    const tipo = document.getElementById('qr-tipo')?.value;
    const label = document.getElementById('qr-destino-label');
    const ajuda = document.getElementById('qr-destino-ajuda');
    const input = document.getElementById('qr-destino');
    if (!label || !ajuda || !input) return;

    const config = {
      email:     { label: 'E-mail', placeholder: 'cliente@email.com', ajuda: 'Endereço de e-mail do destino.' },
      whatsapp:  { label: 'Número do WhatsApp', placeholder: '5511999999999', ajuda: 'Número com DDD e código do país (55 para Brasil).' },
      instagram: { label: 'Usuário do Instagram', placeholder: '@praficar', ajuda: 'Só o @usuario ou link completo do perfil.' },
      pix:       { label: 'Chave Pix', placeholder: 'email@dominio.com', ajuda: 'Chave Pix (e-mail, telefone, CPF ou chave aleatória).' },
      telefone:  { label: 'Telefone', placeholder: '(11) 99999-9999', ajuda: 'Número de telefone fixo ou celular.' },
      site:      { label: 'URL do site', placeholder: 'https://praficar.com.br', ajuda: 'Endereço completo do site.' },
      produto:   { label: 'Link do produto', placeholder: 'https://...', ajuda: 'Link da página do produto no catálogo.' },
      encomenda: { label: 'Link da encomenda', placeholder: 'https://...', ajuda: 'Link de acompanhamento da encomenda.' },
      venda:     { label: 'Link da venda', placeholder: 'https://...', ajuda: 'Link de acompanhamento da venda.' },
      catalogo:  { label: 'Link do catálogo', placeholder: 'https://...', ajuda: 'Link do catálogo online.' },
      link:      { label: 'Link livre', placeholder: 'https://...', ajuda: 'Qualquer URL ou texto.' }
    };

    const c = config[tipo] || config.link;
    label.innerHTML = c.label + ' <span class="form-obrigatorio">*</span>';
    input.placeholder = c.placeholder;
    ajuda.textContent = c.ajuda;

    atualizarPreview();
  }

  /* ==========================================================
     15. PREVIEW
     ========================================================== */

  function atualizarPreview() {
    const container = document.getElementById('qr-preview');
    if (!container) return;

    const q = {
      titulo: document.getElementById('qr-titulo')?.value || '',
      tipo: document.getElementById('qr-tipo')?.value || 'link',
      destino: document.getElementById('qr-destino')?.value || '',
      cor: document.getElementById('qr-cor')?.value || '#1B3A5C',
      codigo: qrcodeEditandoId ? (buscarQRCode(qrcodeEditandoId)?.codigo || 'preview') : 'preview'
    };

    if (!q.destino) {
      container.innerHTML = '<div class="qr-preview-vazio">Preencha o destino para visualizar.</div>';
      return;
    }

    container.innerHTML = gerarSVG(q, 200);
  }

  /* ==========================================================
     16. SALVAR
     ========================================================== */

  function salvar() {
    const titulo = document.getElementById('qr-titulo').value.trim();
    const tipo = document.getElementById('qr-tipo').value;
    const destino = document.getElementById('qr-destino').value.trim();
    const cor = document.getElementById('qr-cor').value;
    const observacoes = document.getElementById('qr-obs').value.trim();

    if (!titulo) return alert('Informe o título.');
    if (!destino) return alert('Informe o destino.');

    const dados = { titulo, tipo, destino, cor, observacoes };

    if (qrcodeEditandoId) {
      atualizarQRCode(qrcodeEditandoId, dados);
    } else {
      criarQRCode(dados);
    }

    fecharModal();
    rerender();
  }

  /* ==========================================================
     17. EXCLUSÃO
     ========================================================== */

  function confirmarExclusao(id) {
    const q = buscarQRCode(id);
    if (!q) return;
    const ok = confirm(`Excluir o QR Code "${q.titulo}"?`);
    if (!ok) return;
    excluirQRCode(id);
    rerender();
  }

  /* ==========================================================
     18. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'qrcode') {
      container.innerHTML = render();
    }
  }

  function rerenderGrade() {
    const wrapper = document.getElementById('grade-qrcode-wrapper');
    if (wrapper) wrapper.innerHTML = renderGrade();
  }

  /* ==========================================================
     19. API PÚBLICA
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
    atualizarPreview,
    aoMudarTipo,
    baixarPNG,
    baixarSVG,
    imprimir,
    _listar: () => [...qrcodes],
    _buscar: buscarQRCode,
    _montarDestino: montarDestinoFinal,
    TIPOS
  };

})();

window.MODULO_QRCODE = MODULO_QRCODE;
window.renderQRCode = MODULO_QRCODE.render;
