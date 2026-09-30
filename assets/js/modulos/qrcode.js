/* ============================================================
   PRAFICAR ERP — MÓDULO QR CODE
   Arquivo: assets/js/modulos/qrcode.js
   Descrição: geração de QR Codes estáticos e dinâmicos para
              produtos, Pix, WhatsApp, Instagram, catálogo,
              encomendas, vendas e links livres.

   Biblioteca: qrcode-generator (CDN, sem dependências)
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

  /* ==========================================================
     2. TIPOS DE QR CODE
     ========================================================== */

  const TIPOS = [
    { codigo: 'produto',    nome: 'Produto',        icone: 'pacote' },
    { codigo: 'encomenda',  nome: 'Encomenda',      icone: 'encomendas' },
    { codigo: 'venda',      nome: 'Venda',          icone: 'vendas' },
    { codigo: 'pix',        nome: 'Pix',            icone: 'dinheiro' },
    { codigo: 'whatsapp',   nome: 'WhatsApp',       icone: 'user' },
    { codigo: 'instagram',  nome: 'Instagram',      icone: 'canais' },
    { codigo: 'catalogo',   nome: 'Catálogo',       icone: 'produtos' },
    { codigo: 'link',       nome: 'Link livre',     icone: 'raio' }
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

  function gerarSlug() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let slug = '';
    for (let i = 0; i < 8; i++) slug += chars[Math.floor(Math.random() * chars.length)];
    return slug;
  }

  function urlBase() {
    return window.location.origin + window.location.pathname;
  }

  /* ==========================================================
     4. CRUD
     ========================================================== */

  function criarQRCode(dados) {
    const q = {
      id: proximoId++,
      titulo: dados.titulo || 'Sem título',
      tipo: dados.tipo || 'link',
      slug: gerarSlug(),
      destino: dados.destino || '',
      referenciaId: dados.referenciaId || null,
      referenciaNome: dados.referenciaNome || '',
      observacoes: dados.observacoes || '',
      cor: dados.cor || '#1B3A5C',
      comLogo: !!dados.comLogo,
      dinamico: dados.dinamico !== false,
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
     5. FILTROS
     ========================================================== */

  function qrcodesFiltrados() {
    return qrcodes.filter(q => {
      if (filtroTipo && q.tipo !== filtroTipo) return false;
      if (filtroBusca) {
        const t = filtroBusca.toLowerCase();
        const alvo = `${q.titulo} ${q.destino} ${q.referenciaNome}`.toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function alterarFiltroBusca(v) { filtroBusca = v; rerenderTabela(); }
  function alterarFiltroTipo(v)   { filtroTipo = v; rerender(); }

  /* ==========================================================
     6. GERAÇÃO DE QR CODE
     Usa a biblioteca qrcode-generator. Para QR dinâmico, a URL
     é do próprio sistema: #/q/<slug>
     ========================================================== */

  function urlDoQRCode(q) {
    if (q.dinamico) {
      return `${urlBase()}#/q/${q.slug}`;
    }
    return q.destino;
  }

  function gerarSVG(q, tamanho = 220) {
    if (typeof qrcode === 'undefined') {
      return '<div class="qr-erro">Biblioteca QR não carregada.</div>';
    }

    const conteudo = urlDoQRCode(q);
    const qr = qrcode(0, 'M');
    qr.addData(conteudo);
    qr.make();

    const moduloCount = qr.getModuleCount();
    const margem = 2;
    const total = moduloCount + margem * 2;
    const escala = tamanho / total;

    const cor = q.cor || '#1B3A5C';

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${tamanho}" height="${tamanho}" shape-rendering="crispEdges">`;
    svg += `<rect width="${total}" height="${total}" fill="#FFFFFF"/>`;

    for (let r = 0; r < moduloCount; r++) {
      for (let c = 0; c < moduloCount; c++) {
        if (qr.isDark(r, c)) {
          svg += `<rect x="${c + margem}" y="${r + margem}" width="1" height="1" fill="${cor}"/>`;
        }
      }
    }

    svg += `</svg>`;
    return svg;
  }

  function gerarSVGDataURL(q, tamanho = 220) {
    const svg = gerarSVG(q, tamanho);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ==========================================================
     7. DOWNLOAD — PNG
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
        link.download = `qrcode-${q.slug}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
      }, 'image/png');

      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  /* ==========================================================
     8. DOWNLOAD — SVG
     ========================================================== */

  function baixarSVG(id) {
    const q = buscarQRCode(id);
    if (!q) return;

    const svg = gerarSVG(q, 1024);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `qrcode-${q.slug}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ==========================================================
     9. IMPRIMIR
     ========================================================== */

  function imprimir(id) {
    const q = buscarQRCode(id);
    if (!q) return;

    const svg = gerarSVG(q, 400);
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
          .url { font-family: monospace; font-size: 11px; color: #888; margin-top: 16px; word-break: break-all; max-width: 400px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>${escaparHTML(q.titulo)}</h1>
        <p>${escaparHTML(tipoInfo(q.tipo).nome)}</p>
        <div class="qr">${svg}</div>
        <div class="url">${escaparHTML(urlDoQRCode(q))}</div>
        <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
      </body>
      </html>
    `);
    janela.document.close();
  }

  /* ==========================================================
     10. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">QR Code</h1>
          <p class="pagina-header__subtitulo">
            ${qrcodes.length} ${qrcodes.length === 1 ? 'código gerado' : 'códigos gerados'} ·
            dinâmicos continuam funcionando mesmo se o destino mudar
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
            placeholder="Buscar por título, destino ou referência..."
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

      <div id="tabela-qrcode-wrapper">
        ${renderGrade()}
      </div>
    `;
  }

  /* ==========================================================
     11. RENDER — GRADE DE CARDS
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
                ? 'Gere QR Codes para produtos, Pix, WhatsApp, Instagram, catálogo, encomendas e links livres. Baixe em PNG, SVG ou imprima.'
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
    const svg = gerarSVG(q, 180);

    return `
      <div class="qr-card">
        <div class="qr-card__preview">
          ${svg}
        </div>

        <div class="qr-card__info">
          <div class="qr-card__titulo">${escaparHTML(q.titulo)}</div>
          <span class="badge badge--info">${escaparHTML(tipo.nome)}</span>
          ${q.dinamico ? '<span class="badge badge--sucesso">Dinâmico</span>' : '<span class="badge badge--neutro">Estático</span>'}
        </div>

        <div class="qr-card__destino">
          <span class="qr-card__destino-label">Destino:</span>
          <span class="qr-card__destino-url">${escaparHTML(urlDoQRCode(q))}</span>
        </div>

        <div class="qr-card__acoes">
          <button class="btn btn--secundario btn--sm" onclick="MODULO_QRCODE.baixarPNG(${q.id})" title="Baixar PNG">
            PNG
          </button>
          <button class="btn btn--secundario btn--sm" onclick="MODULO_QRCODE.baixarSVG(${q.id})" title="Baixar SVG">
            SVG
          </button>
          <button class="btn btn--secundario btn--sm" onclick="MODULO_QRCODE.imprimir(${q.id})" title="Imprimir">
            Imprimir
          </button>
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
     12. MODAL
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
              <input id="qr-titulo" type="text" required value="${escaparHTML(q?.titulo || '')}" placeholder="Ex: Chaveiro Coração" oninput="MODULO_QRCODE.atualizarPreview()" />
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

            <div class="form-grupo" id="qr-destino-grupo">
              <label for="qr-destino">Destino <span class="form-obrigatorio">*</span></label>
              <input id="qr-destino" type="text" value="${escaparHTML(q?.destino || '')}" placeholder="https://..." oninput="MODULO_QRCODE.atualizarPreview()" />
              <span class="form-ajuda" id="qr-destino-ajuda">URL, texto ou link do destino.</span>
            </div>

            <div class="form-grupo">
              <label>
                <input type="checkbox" id="qr-dinamico" ${q?.dinamico !== false ? 'checked' : ''} onchange="MODULO_QRCODE.atualizarPreview()" />
                QR Code dinâmico
              </label>
              <span class="form-ajuda">Dinâmico continua funcionando mesmo se o destino mudar. Ideal para materiais impressos.</span>
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
      atualizarPreview();
      document.getElementById('qr-titulo')?.focus();
    }, 60);
  }

  function fecharModal() {
    document.getElementById('modal-qrcode')?.remove();
    qrcodeEditandoId = null;
  }

  /* ==========================================================
     13. PREVIEW EM TEMPO REAL
     ========================================================== */

  function atualizarPreview() {
    const container = document.getElementById('qr-preview');
    if (!container) return;

    const q = {
      titulo: document.getElementById('qr-titulo')?.value || '',
      tipo: document.getElementById('qr-tipo')?.value || 'link',
      destino: document.getElementById('qr-destino')?.value || '',
      cor: document.getElementById('qr-cor')?.value || '#1B3A5C',
      dinamico: document.getElementById('qr-dinamico')?.checked ?? true,
      slug: qrcodeEditandoId ? (buscarQRCode(qrcodeEditandoId)?.slug || 'preview') : 'preview'
    };

    if (!q.destino && !q.dinamico) {
      container.innerHTML = '<div class="qr-preview-vazio">Preencha o destino para visualizar.</div>';
      return;
    }

    container.innerHTML = gerarSVG(q, 180);
  }

  function aoMudarTipo() {
    const tipo = document.getElementById('qr-tipo')?.value;
    const label = document.getElementById('qr-destino-ajuda');
    if (!label) return;

    const dicas = {
      produto:   'Link da página do produto.',
      encomenda: 'Link da encomenda no sistema.',
      venda:     'Link da venda no sistema.',
      pix:       'Chave Pix ou payload Pix.',
      whatsapp:  'Número no formato https://wa.me/55...',
      instagram: 'Link do perfil do Instagram.',
      catalogo:  'Link do catálogo online.',
      link:      'Qualquer URL ou texto.'
    };
    label.textContent = dicas[tipo] || 'URL, texto ou link do destino.';

    atualizarPreview();
  }

  /* ==========================================================
     14. SALVAR
     ========================================================== */

  function salvar() {
    const titulo = document.getElementById('qr-titulo').value.trim();
    const tipo = document.getElementById('qr-tipo').value;
    const destino = document.getElementById('qr-destino').value.trim();
    const cor = document.getElementById('qr-cor').value;
    const dinamico = document.getElementById('qr-dinamico').checked;
    const observacoes = document.getElementById('qr-obs').value.trim();

    if (!titulo) return alert('Informe o título.');

    // Se for dinâmico e não tiver destino, cria com destino vazio (pode ser configurado depois)
    // Se for estático, exige destino
    if (!dinamico && !destino) return alert('QR Code estático precisa de um destino.');

    const dados = { titulo, tipo, destino, cor, dinamico, observacoes };

    if (qrcodeEditandoId) {
      atualizarQRCode(qrcodeEditandoId, dados);
    } else {
      criarQRCode(dados);
    }

    fecharModal();
    rerender();
  }

  /* ==========================================================
     15. EXCLUSÃO
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
     16. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'qrcode') {
      container.innerHTML = render();
    }
  }

  function rerenderTabela() {
    const wrapper = document.getElementById('tabela-qrcode-wrapper');
    if (wrapper) wrapper.innerHTML = renderGrade();
  }

  /* ==========================================================
     17. API PÚBLICA
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
    TIPOS
  };

})();

window.MODULO_QRCODE = MODULO_QRCODE;
window.renderQRCode = MODULO_QRCODE.render;
