/* ============================================================
   PRAFICAR ERP — PESQUISA DE MERCADO AUTOMÁTICA
   Arquivo: assets/js/modulos/pesquisa-mercado.js
   Descrição: busca preços no Mercado Livre para um termo,
              calcula 3 faixas (Econômico / Mercado / Premium)
              e retorna com cache de 24h.
   ============================================================ */

const PESQUISA_MERCADO = (() => {

  const API_BASE = 'https://api.mercadolibre.com/sites/MLB/search';
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
  const CACHE_PREFIX = 'praficar_pesquisa_';

  /* ==========================================================
     1. CACHE
     ========================================================== */

  function chaveCache(termo) {
    return CACHE_PREFIX + termo.toLowerCase().trim();
  }

  function lerCache(termo) {
    try {
      const raw = localStorage.getItem(chaveCache(termo));
      if (!raw) return null;
      const dados = JSON.parse(raw);
      if (!dados.timestamp || Date.now() - dados.timestamp > CACHE_TTL) {
        localStorage.removeItem(chaveCache(termo));
        return null;
      }
      return dados.resultado;
    } catch (e) {
      return null;
    }
  }

  function gravarCache(termo, resultado) {
    try {
      localStorage.setItem(chaveCache(termo), JSON.stringify({
        timestamp: Date.now(),
        resultado
      }));
    } catch (e) {
      // LocalStorage cheio ou bloqueado — ignora
    }
  }

  function limparCache() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  /* ==========================================================
     2. CONSULTA À API
     ========================================================== */

  async function buscarNoMercadoLivre(termo) {
    const url = `${API_BASE}?q=${encodeURIComponent(termo)}&limit=40`;

    const resposta = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!resposta.ok) {
      throw new Error(`Erro ${resposta.status}`);
    }

    const dados = await resposta.json();
    return dados.results || [];
  }

  /* ==========================================================
     3. CÁLCULO DAS FAIXAS
     ========================================================== */

  function calcularFaixas(resultados) {
    // Filtra apenas com preço válido
    const precos = resultados
      .map(r => Number(r.price))
      .filter(p => p > 0)
      .sort((a, b) => a - b);

    if (precos.length === 0) {
      return null;
    }

    const total = precos.length;

    // Faixa econômica: média dos 25% mais baratos
    const corteEco = Math.max(1, Math.floor(total * 0.25));
    const cortePremium = Math.max(1, Math.floor(total * 0.25));

    const economicos = precos.slice(0, corteEco);
    const premium = precos.slice(-cortePremium);

    // Faixa mercado: pega os 50% centrais
    const inicioMercado = corteEco;
    const fimMercado = total - cortePremium;
    const mercado = precos.slice(inicioMercado, fimMercado);

    const media = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      economico: arredondar(media(economicos)),
      mercado: arredondar(media(mercado.length > 0 ? mercado : precos)),
      premium: arredondar(media(premium)),
      minimo: arredondar(precos[0]),
      maximo: arredondar(precos[precos.length - 1]),
      mediana: arredondar(precos[Math.floor(total / 2)]),
      total
    };
  }

  function arredondar(v) {
    return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  }

  /* ==========================================================
     4. API PÚBLICA
     ========================================================== */

  async function pesquisar(termo, forcarAtualizacao = false) {
    const termoLimpo = String(termo || '').trim();

    if (termoLimpo.length < 3) {
      return {
        ok: false,
        motivo: 'termo-curto',
        mensagem: 'Digite pelo menos 3 caracteres.'
      };
    }

    // Cache
    if (!forcarAtualizacao) {
      const cached = lerCache(termoLimpo);
      if (cached) {
        return { ok: true, resultado: cached, doCache: true };
      }
    }

    try {
      const resultados = await buscarNoMercadoLivre(termoLimpo);
      const faixas = calcularFaixas(resultados);

      if (!faixas) {
        return {
          ok: false,
          motivo: 'sem-resultados',
          mensagem: 'Nenhum produto encontrado no Mercado Livre.'
        };
      }

      const resultado = {
        ...faixas,
        termo: termoLimpo,
        data: new Date().toLocaleString('pt-BR'),
        fonte: 'Mercado Livre'
      };

      gravarCache(termoLimpo, resultado);

      return { ok: true, resultado, doCache: false };

    } catch (e) {
      console.error('[PraFicar] Erro na pesquisa de mercado:', e);

      // Tenta usar cache antigo mesmo expirado
      try {
        const raw = localStorage.getItem(chaveCache(termoLimpo));
        if (raw) {
          const dados = JSON.parse(raw);
          return {
            ok: true,
            resultado: dados.resultado,
            doCache: true,
            aviso: 'Usando cache (API indisponível)'
          };
        }
      } catch (e) {}

      return {
        ok: false,
        motivo: 'erro-api',
        mensagem: 'Não foi possível buscar preços agora. Cadastre manualmente.'
      };
    }
  }

  return {
    pesquisar,
    limparCache
  };

})();

window.PESQUISA_MERCADO = PESQUISA_MERCADO;
