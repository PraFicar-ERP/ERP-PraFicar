/* ============================================================
   PRAFICAR ERP — GERADOR DE SKU
   Arquivo: assets/js/sku.js
   Descrição: geração automática de SKU no padrão PraFicar.
              Formato: [CATEGORIA]-PF-[SEQUENCIAL]
   ============================================================ */

const SKU_PRAFICAR = (() => {

  /* ==========================================================
     1. CATEGORIAS OFICIAIS
     ========================================================== */

  const CATEGORIAS = [
    { codigo: 'MP', nome: 'Marca-páginas' },
    { codigo: 'CH', nome: 'Chaveiros' },
    { codigo: 'FI', nome: 'Fotos Imantadas' },
    { codigo: 'FB', nome: 'Fotos em Broches' },
    { codigo: 'BP', nome: 'Broches de Pintar' },
    { codigo: 'IM', nome: 'Ímãs' },
    { codigo: 'CA', nome: 'Cartões' },
    { codigo: 'KI', nome: 'Kits' },
    { codigo: 'EN', nome: 'Envelopes / Embalagens' },
    { codigo: 'ET', nome: 'Etiquetas' },
    { codigo: 'OU', nome: 'Outros' }
  ];

  const PREFIXO_FIXO = 'PF'; // PraFicar — nunca muda

  /* ==========================================================
     2. CONTADOR EM MEMÓRIA
     (será substituído pelo Supabase quando integrarmos)
     ========================================================== */

  // Exemplo: { MP: 3, CH: 12, FI: 8 }
  const contadoresLocais = {};

  // SKUs já gerados (para evitar duplicidade em memória)
  const skusExistentes = new Set();

  /* ==========================================================
     3. API PÚBLICA
     ========================================================== */

  /**
   * Retorna a lista de categorias oficiais.
   */
  function listarCategorias() {
    return [...CATEGORIAS];
  }

  /**
   * Busca uma categoria pelo código.
   * @param {string} codigo - Ex: 'MP'
   * @returns {object|undefined}
   */
  function buscarCategoria(codigo) {
    return CATEGORIAS.find(c => c.codigo === codigo);
  }

  /**
   * Formata o número sequencial em 3 dígitos.
   * @param {number} numero
   * @returns {string} Ex: '001'
   */
  function formatarSequencial(numero) {
    return String(numero).padStart(3, '0');
  }

  /**
   * Gera o próximo SKU para uma categoria.
   * @param {string} codigoCategoria - Ex: 'MP'
   * @returns {string} Ex: 'MP-PF-001'
   */
  function gerarProximo(codigoCategoria) {
    if (!buscarCategoria(codigoCategoria)) {
      throw new Error(`Categoria inválida: ${codigoCategoria}`);
    }

    // Pega o contador atual ou inicia em 0
    let proximo = (contadoresLocais[codigoCategoria] || 0) + 1;

    // Garante que o SKU não exista ainda
    let sku = montar(codigoCategoria, proximo);
    while (skusExistentes.has(sku)) {
      proximo++;
      sku = montar(codigoCategoria, proximo);
    }

    contadoresLocais[codigoCategoria] = proximo;
    skusExistentes.add(sku);

    return sku;
  }

  /**
   * Monta o SKU a partir de partes.
   * @param {string} codigoCategoria
   * @param {number} sequencial
   * @returns {string}
   */
  function montar(codigoCategoria, sequencial) {
    return `${codigoCategoria}-${PREFIXO_FIXO}-${formatarSequencial(sequencial)}`;
  }

  /**
   * Valida se um SKU está no padrão PraFicar.
   * @param {string} sku - Ex: 'MP-PF-001'
   * @returns {boolean}
   */
  function validar(sku) {
    if (typeof sku !== 'string') return false;
    const regex = /^[A-Z]{2}-PF-\d{3}$/;
    return regex.test(sku);
  }

  /**
   * Extrai informações de um SKU.
   * @param {string} sku
   * @returns {object|null}
   */
  function analisar(sku) {
    if (!validar(sku)) return null;
    const [codigo, prefixo, numero] = sku.split('-');
    const categoria = buscarCategoria(codigo);
    return {
      sku,
      codigoCategoria: codigo,
      prefixo,
      sequencial: parseInt(numero, 10),
      nomeCategoria: categoria ? categoria.nome : 'Desconhecida'
    };
  }

  /**
   * Registra um SKU já existente (para sincronizar com banco).
   * @param {string} sku
   */
  function registrarExistente(sku) {
    if (!validar(sku)) return;
    skusExistentes.add(sku);
    const info = analisar(sku);
    if (info) {
      const atual = contadoresLocais[info.codigoCategoria] || 0;
      if (info.sequencial > atual) {
        contadoresLocais[info.codigoCategoria] = info.sequencial;
      }
    }
  }

  /**
   * Sincroniza com uma lista de SKUs existentes.
   * (útil quando os dados vierem do Supabase)
   * @param {string[]} lista
   */
  function sincronizar(lista = []) {
    lista.forEach(registrarExistente);
  }

  /* ==========================================================
     4. EXPORTAÇÃO
     ========================================================== */

  return {
    listarCategorias,
    buscarCategoria,
    gerarProximo,
    montar,
    validar,
    analisar,
    registrarExistente,
    sincronizar,
    PREFIXO_FIXO
  };

})();

// Torna disponível globalmente
window.SKU_PRAFICAR = SKU_PRAFICAR;
