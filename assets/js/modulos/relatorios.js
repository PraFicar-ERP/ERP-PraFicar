/* ============================================================
   PRAFICAR ERP — MÓDULO RELATÓRIOS (v2)
   Arquivo: assets/js/modulos/relatorios.js
   Descrição: relatórios gerenciais completos.
              Agrega dados de Vendas, Pedidos, Produtos,
              Estoque, Produção, Financeiro e Clientes.

   v2:
   - Correção: MODULO_VENDAS → MODULO_VENDAS_CORE
   - Correção: MODULO_ENCOMENDAS → MODULO_PEDIDOS
   - Filtro de período completo (hoje / semana / mês / ano / custom)
   - Resumo executivo
   - Relatório de vendas
   - Relatório de pedidos
   - Relatório de produção
   - Relatório de perdas
   - DRE simplificado (lucro x custo)
   - Receitas e despesas
   - Produtos mais/menos vendidos
   - Estoque
   - Clientes
   ============================================================ */

const MODULO_RELATORIOS = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  // Período: hoje | ontem | 7 | 30 | mes | mes_passado | ano | custom
  let periodo = '30';
  let dataInicio = '';
  let dataFim = '';

  // Abas de relatório
  let abaAtiva = 'resumo';

  const ABAS = [
    { codigo: 'resumo',    nome: 'Resumo executivo' },
    { codigo: 'vendas',    nome: 'Vendas' },
    { codigo: 'pedidos',   nome: 'Pedidos' },
    { codigo: 'producao',  nome: 'Produção' },
    { codigo: 'perdas',    nome: 'Perdas' },
    { codigo: 'dre',       nome: 'Lucro x Custo' },
    { codigo: 'receitas',  nome: 'Receitas e Despesas' },
    { codigo: 'produtos',  nome: 'Produtos' },
    { codigo: 'estoque',   nome: 'Estoque' },
    { codigo: 'clientes',  nome: 'Clientes' }
  ];

  /* ==========================================================
     2. UTILITÁRIOS
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

  function formatarMoedaFina(v) {
    const n = Number(v) || 0;
    if (n === 0) return 'R$ 0,00';
    if (n < 0.01) return 'R$ ' + n.toFixed(4).replace('.', ',');
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarPercentual(v) {
    const n = Number(v) || 0;
    return `${n.toFixed(1).replace('.', ',')}%`;
  }

  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
  }

  function formatarDataCurta(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function hojeISO() {
    return new Date().toISOString().split('T')[0];
  }

  function adicionarDias(dataISO, dias) {
    const d = new Date(dataISO + 'T00:00:00');
    d.setDate(d.getDate() + Number(dias || 0));
    return d.toISOString().split('T')[0];
  }

  function inicioDaSemana(dataISO) {
    const d = new Date(dataISO + 'T00:00:00');
    const dia = d.getDay(); // 0 = domingo
    const diff = dia === 0 ? 6 : dia - 1; // segunda = início
    d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
  }

  function primeiroDiaMesAtual() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  }

  function ultimoDiaMesAtual() {
    const hoje = new Date();
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return ultimo.toISOString().split('T')[0];
  }

  function primeiroDiaMesPassado() {
    const hoje = new Date();
    const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return anterior.toISOString().split('T')[0];
  }

  function ultimoDiaMesPassado() {
    const hoje = new Date();
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return ultimo.toISOString().split('T')[0];
  }

  function primeiroDiaAno() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-01-01`;
  }

  /* ==========================================================
     3. DEFINIÇÃO DO PERÍODO
     ========================================================== */

  function intervaloAtual() {
    const hoje = hojeISO();

    if (periodo === 'hoje')  return { inicio: hoje, fim: hoje };
    if (periodo === 'ontem') {
      const ontem = adicionarDias(hoje, -1);
      return { inicio: ontem, fim: ontem };
    }
    if (periodo === 'semana') {
      return { inicio: inicioDaSemana(hoje), fim: hoje };
    }
    if (periodo === 'mes') {
      return { inicio: primeiroDiaMesAtual(), fim: ultimoDiaMesAtual() };
    }
    if (periodo === 'mes_passado') {
      return { inicio: primeiroDiaMesPassado(), fim: ultimoDiaMesPassado() };
    }
    if (periodo === 'ano') {
      return { inicio: primeiroDiaAno(), fim: hoje };
    }
    if (periodo === 'custom' && dataInicio && dataFim) {
      return { inicio: dataInicio, fim: dataFim };
    }

    const dias = Number(periodo) || 30;
    return { inicio: adicionarDias(hoje, -dias), fim: hoje };
  }

  function nomePeriodoAtual() {
    if (periodo === 'hoje')        return 'Hoje';
    if (periodo === 'ontem')       return 'Ontem';
    if (periodo === 'semana')      return 'Esta semana';
    if (periodo === '7')           return 'Últimos 7 dias';
    if (periodo === '30')          return 'Últimos 30 dias';
    if (periodo === '90')          return 'Últimos 90 dias';
    if (periodo === 'mes')         return 'Mês atual';
    if (periodo === 'mes_passado') return 'Mês passado';
    if (periodo === 'ano')         return 'Este ano';
    if (periodo === 'custom' && dataInicio && dataFim)
      return `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
    return 'Período';
  }

  function alterarPeriodo(valor) {
    periodo = valor;
    if (valor !== 'custom') {
      dataInicio = '';
      dataFim = '';
    }
    rerender();
  }

  function alterarDataInicio(v) { dataInicio = v; periodo = 'custom'; rerender(); }
  function alterarDataFim(v)    { dataFim = v; periodo = 'custom'; rerender(); }

  function alterarAba(codigo) {
    if (!ABAS.find(a => a.codigo === codigo)) return;
    abaAtiva = codigo;
    rerender();
  }

  /* ==========================================================
     4. AGREGAÇÃO — VENDAS
     ========================================================== */

  function vendasNoPeriodo() {
    const { inicio, fim } = intervaloAtual();
    if (!window.MODULO_VENDAS_CORE) return [];

    return (window.MODULO_VENDAS_CORE._listar() || []).filter(v => {
      const data = v.criadoEm?.split('T')[0];
      return data >= inicio && data <= fim && v.status !== 'cancelada';
    });
  }

  function kpisVendas() {
    const vendas = vendasNoPeriodo();

    const faturamento = vendas.reduce((a, v) => a + (Number(v.totais?.subtotalPraticado) || 0), 0);
    const custo = vendas.reduce((a, v) => a + (Number(v.totais?.custoTotal) || 0), 0);
    const taxas = vendas.reduce((a, v) => a + (Number(v.totais?.taxaCanalValor) || 0) + (Number(v.totais?.taxaFixa) || 0), 0);
    const frete = vendas.reduce((a, v) => a + (Number(v.freteVendedor) || 0), 0);
    const descontos = vendas.reduce((a, v) => a + (Number(v.totais?.descontoTotal) || 0), 0);
    const bonificacoes = vendas.reduce((a, v) => a + (Number(v.totais?.bonificacoes) || 0), 0);
    const lucro = vendas.reduce((a, v) => a + (Number(v.totais?.lucro) || 0), 0);
    const qtd = vendas.length;
    const itensVendidos = vendas.reduce((a, v) => {
      return a + (v.itens || []).reduce((b, i) => b + (Number(i.quantidade) || 0), 0);
    }, 0);
    const ticket = qtd > 0 ? faturamento / qtd : 0;
    const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

    return { faturamento, custo, taxas, frete, descontos, bonificacoes, lucro, qtd, itensVendidos, ticket, margem };
  }

  function vendasPorDia() {
    const vendas = vendasNoPeriodo();
    const mapa = {};

    vendas.forEach(v => {
      const dia = v.criadoEm?.split('T')[0];
      if (!dia) return;
      if (!mapa[dia]) mapa[dia] = { dia, qtd: 0, faturamento: 0, lucro: 0 };
      mapa[dia].qtd += 1;
      mapa[dia].faturamento += Number(v.totais?.subtotalPraticado) || 0;
      mapa[dia].lucro += Number(v.totais?.lucro) || 0;
    });

    return Object.values(mapa).sort((a, b) => b.dia.localeCompare(a.dia));
  }

  function lucroPorCanal() {
    const vendas = vendasNoPeriodo();
    const mapa = {};

    vendas.forEach(v => {
      const chave = v.canalNome || 'Venda direta';
      if (!mapa[chave]) {
        mapa[chave] = { canal: chave, faturamento: 0, lucro: 0, vendas: 0, itens: 0 };
      }
      mapa[chave].faturamento += Number(v.totais?.subtotalPraticado) || 0;
      mapa[chave].lucro += Number(v.totais?.lucro) || 0;
      mapa[chave].vendas += 1;
      mapa[chave].itens += (v.itens || []).reduce((a, i) => a + (Number(i.quantidade) || 0), 0);
    });

    Object.values(mapa).forEach(c => {
      c.margem = c.faturamento > 0 ? (c.lucro / c.faturamento) * 100 : 0;
      c.ticket = c.vendas > 0 ? c.faturamento / c.vendas : 0;
    });

    return Object.values(mapa).sort((a, b) => b.faturamento - a.faturamento);
  }

  /* ==========================================================
     5. AGREGAÇÃO — PEDIDOS
     ========================================================== */

  function pedidosNoPeriodo() {
    const { inicio, fim } = intervaloAtual();
    if (!window.MODULO_PEDIDOS) return [];

    return (window.MODULO_PEDIDOS._listar() || []).filter(p => {
      const data = p.criadoEm?.split('T')[0];
      return data >= inicio && data <= fim;
    });
  }

  function kpisPedidos() {
    const lista = pedidosNoPeriodo();
    const emAberto = lista.filter(p => !['entregue', 'cancelado'].includes(p.status)).length;
    const entregues = lista.filter(p => p.status === 'entregue').length;
    const atrasados = lista.filter(p => {
      if (['entregue', 'cancelado'].includes(p.status)) return false;
      return p.prazo && p.prazo < hojeISO();
    }).length;
    const cancelados = lista.filter(p => p.status === 'cancelado').length;

    const valorTotal = lista.reduce((a, p) => {
      const subtotal = (p.itens || []).reduce((b, i) => {
        return b + (Number(i.preco) || 0) * (Number(i.quantidade) || 0);
      }, 0);
      return a + subtotal - (Number(p.desconto) || 0) + (Number(p.frete) || 0);
    }, 0);

    return { total: lista.length, emAberto, entregues, atrasados, cancelados, valorTotal };
  }

  function pedidosPorStatus() {
    const lista = pedidosNoPeriodo();
    const mapa = {};

    lista.forEach(p => {
      const status = p.status || 'sem_status';
      if (!mapa[status]) mapa[status] = { status, qtd: 0 };
      mapa[status].qtd += 1;
    });

    const statusInfo = window.MODULO_PEDIDOS?.STATUS || [];
    Object.values(mapa).forEach(s => {
      const info = statusInfo.find(x => x.codigo === s.status);
      s.nome = info ? info.nome : s.status;
      s.cor = info ? info.cor : 'neutro';
    });

    return Object.values(mapa).sort((a, b) => b.qtd - a.qtd);
  }

  /* ==========================================================
     6. AGREGAÇÃO — PRODUÇÃO
     ========================================================== */

  function movimentacoesNoPeriodo() {
    const { inicio, fim } = intervaloAtual();
    if (!window.MODULO_ESTOQUE?._movimentacoes) return [];

    return (window.MODULO_ESTOQUE._movimentacoes() || []).filter(m => {
      const data = m.data?.split('T')[0];
      return data >= inicio && data <= fim;
    });
  }

  function kpisProducao() {
    const movs = movimentacoesNoPeriodo();
    const producoes = movs.filter(m => m.tipo === 'producao_entrada');

    const unidadesProduzidas = producoes.reduce((a, m) => a + (Number(m.quantidadeProduzida) || 0), 0);
    const unidadesBoas = producoes.reduce((a, m) => a + (Number(m.quantidade) || 0), 0);
    const unidadesFalhas = producoes.reduce((a, m) => a + (Number(m.falhas) || 0), 0);
    const lotes = producoes.length;
    const taxaFalha = unidadesProduzidas > 0 ? (unidadesFalhas / unidadesProduzidas) * 100 : 0;

    return { unidadesProduzidas, unidadesBoas, unidadesFalhas, lotes, taxaFalha };
  }

  function producaoPorProduto() {
    const movs = movimentacoesNoPeriodo();
    const mapa = {};

    movs.filter(m => m.tipo === 'producao_entrada').forEach(m => {
      const chave = m.produtoSku || m.produtoNome;
      if (!mapa[chave]) {
        mapa[chave] = {
          sku: m.produtoSku || '',
          nome: m.produtoNome,
          lotes: 0,
          produzidas: 0,
          boas: 0,
          falhas: 0
        };
      }
      mapa[chave].lotes += 1;
      mapa[chave].produzidas += Number(m.quantidadeProduzida) || 0;
      mapa[chave].boas += Number(m.quantidade) || 0;
      mapa[chave].falhas += Number(m.falhas) || 0;
    });

    Object.values(mapa).forEach(p => {
      p.taxaFalha = p.produzidas > 0 ? (p.falhas / p.produzidas) * 100 : 0;
    });

    return Object.values(mapa).sort((a, b) => b.produzidas - a.produzidas);
  }

  /* ==========================================================
     7. AGREGAÇÃO — PERDAS
     ========================================================== */

  function kpisPerdas() {
    const movs = movimentacoesNoPeriodo();

    // Falhas de produção
    const producoes = movs.filter(m => m.tipo === 'producao_entrada');
    const unidadesFalhas = producoes.reduce((a, m) => a + (Number(m.falhas) || 0), 0);

    // Perdas de estoque (saída manual)
    const saidas = movs.filter(m => m.tipo === 'ajuste' && Number(m.quantidade) < 0);
    const unidadesPerdidas = saidas.reduce((a, m) => a + Math.abs(Number(m.quantidade) || 0), 0);

    // Custo das perdas
    let custoFalhas = 0;
    producoes.forEach(m => {
      const produto = window.MODULO_PRODUTOS?._buscar?.(m.produtoId);
      const custo = Number(produto?.custo) || 0;
      custoFalhas += custo * (Number(m.falhas) || 0);
    });

    let custoPerdas = 0;
    saidas.forEach(m => {
      const produto = window.MODULO_PRODUTOS?._buscar?.(m.produtoId);
      const custo = Number(produto?.custo) || 0;
      custoPerdas += custo * Math.abs(Number(m.quantidade) || 0);
    });

    return {
      unidadesFalhas,
      unidadesPerdidas,
      totalUnidades: unidadesFalhas + unidadesPerdidas,
      custoFalhas,
      custoPerdas,
      custoTotal: custoFalhas + custoPerdas
    };
  }

  function perdasDetalhadas() {
    const movs = movimentacoesNoPeriodo();
    const lista = [];

    // Falhas de produção
    movs.filter(m => m.tipo === 'producao_entrada' && Number(m.falhas) > 0).forEach(m => {
      const produto = window.MODULO_PRODUTOS?._buscar?.(m.produtoId);
      const custo = Number(produto?.custo) || 0;
      lista.push({
        data: m.data,
        tipo: 'Falha de produção',
        produto: m.produtoNome,
        sku: m.produtoSku,
        quantidade: Number(m.falhas),
        custo: custo * Number(m.falhas),
        motivo: m.motivo || 'Falha registrada na produção'
      });
    });

    // Perdas de estoque
    movs.filter(m => m.tipo === 'ajuste' && Number(m.quantidade) < 0).forEach(m => {
      const produto = window.MODULO_PRODUTOS?._buscar?.(m.produtoId);
      const custo = Number(produto?.custo) || 0;
      const qtd = Math.abs(Number(m.quantidade));
      lista.push({
        data: m.data,
        tipo: 'Perda de estoque',
        produto: m.produtoNome,
        sku: m.produtoSku,
        quantidade: qtd,
        custo: custo * qtd,
        motivo: m.motivo || '—'
      });
    });

    return lista.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }

  /* ==========================================================
     8. AGREGAÇÃO — DRE SIMPLIFICADO
     ========================================================== */

  function dreSimplificado() {
    const v = kpisVendas();
    const p = kpisPerdas();

    const receitaBruta = v.faturamento;
    const deducoes = v.descontos + v.bonificacoes;
    const receitaLiquida = receitaBruta - deducoes;
    const custoProdutos = v.custo;
    const lucroBruto = receitaLiquida - custoProdutos;
    const taxas = v.taxas;
    const frete = v.frete;
    const perdas = p.custoTotal;
    const lucroOperacional = lucroBruto - taxas - frete - perdas;
    const margemOperacional = receitaLiquida > 0 ? (lucroOperacional / receitaLiquida) * 100 : 0;

    return {
      receitaBruta,
      deducoes,
      receitaLiquida,
      custoProdutos,
      lucroBruto,
      taxas,
      frete,
      perdas,
      lucroOperacional,
      margemOperacional
    };
  }

  /* ==========================================================
     9. AGREGAÇÃO — RECEITAS E DESPESAS
     ========================================================== */

  function receitasEDespesas() {
    const v = kpisVendas();

    // Receitas: vendas no período
    const receitas = v.faturamento;

    // Despesas: custos de produto + taxas + frete + perdas
    const p = kpisPerdas();
    const despesasProduto = v.custo;
    const despesasTaxas = v.taxas;
    const despesasFrete = v.frete;
    const despesasPerdas = p.custoTotal;
    const despesasTotais = despesasProduto + despesasTaxas + despesasFrete + despesasPerdas;
    const saldo = receitas - despesasTotais;

    return {
      receitas,
      despesasProduto,
      despesasTaxas,
      despesasFrete,
      despesasPerdas,
      despesasTotais,
      saldo
    };
  }

  /* ==========================================================
     10. AGREGAÇÃO — PRODUTOS
     ========================================================== */

  function produtosMaisVendidos() {
    const vendas = vendasNoPeriodo();
    const mapa = {};

    vendas.forEach(v => {
      (v.itens || []).forEach(item => {
        const chave = item.sku || item.nome;
        if (!mapa[chave]) {
          mapa[chave] = {
            nome: item.nome,
            sku: item.sku || '',
            quantidade: 0,
            faturamento: 0,
            custo: 0,
            lucro: 0
          };
        }
        const qtd = Number(item.quantidade) || 0;
        const preco = Number(item.preco) || 0;
        const custoItem = Number(item.custo) || 0;
        mapa[chave].quantidade += qtd;
        mapa[chave].faturamento += preco * qtd;
        mapa[chave].custo += custoItem * qtd;
        mapa[chave].lucro += (preco - custoItem) * qtd;
      });
    });

    Object.values(mapa).forEach(p => {
      p.margem = p.faturamento > 0 ? (p.lucro / p.faturamento) * 100 : 0;
    });

    return Object.values(mapa).sort((a, b) => b.faturamento - a.faturamento);
  }

  function produtosMenosVendidos() {
    const mais = produtosMaisVendidos();
    return [...mais].sort((a, b) => a.quantidade - b.quantidade);
  }

  /* ==========================================================
     11. AGREGAÇÃO — ESTOQUE
     ========================================================== */

  function produtosEstoqueBaixo() {
    if (!window.MODULO_PRODUTOS) return [];

    return (window.MODULO_PRODUTOS._listar() || [])
      .filter(p => p.status === 'ativo')
      .map(p => {
        const atual = Number(p.estoqueAtual) || 0;
        const minimo = Number(p.estoqueMinimo) || 0;
        let status = 'ok';
        if (atual === 0) status = 'zerado';
        else if (atual <= minimo) status = 'critico';
        else if (atual <= minimo * 2) status = 'atencao';
        return { ...p, statusEstoque: status };
      })
      .filter(p => p.statusEstoque !== 'ok')
      .sort((a, b) => {
        const ordem = { zerado: 0, critico: 1, atencao: 2 };
        return ordem[a.statusEstoque] - ordem[b.statusEstoque];
      });
  }

  function valorTotalEstoque() {
    if (!window.MODULO_PRODUTOS) return { custo: 0, venda: 0 };

    return (window.MODULO_PRODUTOS._listar() || [])
      .filter(p => p.status === 'ativo')
      .reduce((acc, p) => {
        const qtd = Number(p.estoqueAtual) || 0;
        acc.custo += qtd * (Number(p.custo) || 0);
        acc.venda += qtd * (Number(p.precoVarejo) || 0);
        return acc;
      }, { custo: 0, venda: 0 });
  }

  /* ==========================================================
     12. AGREGAÇÃO — CLIENTES
     ========================================================== */

  function clientesPorOrigem() {
    if (!window.MODULO_CLIENTES) return [];
    const clientes = window.MODULO_CLIENTES._listarClientes() || [];
    const mapa = {};

    clientes.forEach(c => {
      const chave = c.origem || 'outros';
      if (!mapa[chave]) mapa[chave] = { origem: chave, total: 0 };
      mapa[chave].total++;
    });

    const origens = window.MODULO_CLIENTES.ORIGENS || [];
    Object.values(mapa).forEach(o => {
      const info = origens.find(x => x.codigo === o.origem);
      o.nome = info ? info.nome : 'Outros';
    });

    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }

  function topCompradores() {
    const vendas = vendasNoPeriodo();
    const mapa = {};

    vendas.forEach(v => {
      const chave = v.cliente || 'Sem nome';
      if (!mapa[chave]) mapa[chave] = { cliente: chave, qtd: 0, total: 0 };
      mapa[chave].qtd += 1;
      mapa[chave].total += Number(v.totais?.subtotalPraticado) || 0;
    });

    Object.values(mapa).forEach(c => {
      c.ticket = c.qtd > 0 ? c.total / c.qtd : 0;
    });

    return Object.values(mapa).sort((a, b) => b.total - a.total).slice(0, 10);
  }

  /* ==========================================================
     13. RENDER — TELA PRINCIPAL
     ========================================================== */

  function render() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Relatórios</h1>
          <p class="pagina-header__subtitulo">
            Acompanhe o desempenho do seu negócio por período.
          </p>
        </div>
      </div>

      ${renderFiltros()}

      ${renderAbas()}

      <div class="rel-conteudo" id="rel-conteudo">
        ${renderConteudoAba()}
      </div>
    `;
  }

  function renderFiltros() {
    return `
      <div class="rel-filtros">
        <div class="rel-periodo">
          <button class="rel-periodo__btn ${periodo === 'hoje' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('hoje')">Hoje</button>
          <button class="rel-periodo__btn ${periodo === 'ontem' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('ontem')">Ontem</button>
          <button class="rel-periodo__btn ${periodo === 'semana' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('semana')">Semana</button>
          <button class="rel-periodo__btn ${periodo === '7' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('7')">7 dias</button>
          <button class="rel-periodo__btn ${periodo === '30' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('30')">30 dias</button>
          <button class="rel-periodo__btn ${periodo === '90' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('90')">90 dias</button>
          <button class="rel-periodo__btn ${periodo === 'mes' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('mes')">Mês</button>
          <button class="rel-periodo__btn ${periodo === 'mes_passado' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('mes_passado')">Mês passado</button>
          <button class="rel-periodo__btn ${periodo === 'ano' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('ano')">Ano</button>
        </div>

        <div class="rel-custom">
          <input type="date" value="${dataInicio}" onchange="MODULO_RELATORIOS.alterarDataInicio(this.value)" />
          <span class="rel-custom__sep">até</span>
          <input type="date" value="${dataFim}" onchange="MODULO_RELATORIOS.alterarDataFim(this.value)" />
        </div>
      </div>
    `;
  }

  function renderAbas() {
    return `
      <div class="rel-abas" role="tablist">
        ${ABAS.map(a => `
          <button
            type="button"
            role="tab"
            aria-selected="${a.codigo === abaAtiva}"
            class="rel-aba ${a.codigo === abaAtiva ? 'rel-aba--ativa' : ''}"
            onclick="MODULO_RELATORIOS.alterarAba('${a.codigo}')"
          >
            ${a.nome}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderConteudoAba() {
    if (abaAtiva === 'resumo')   return renderAbaResumo();
    if (abaAtiva === 'vendas')   return renderAbaVendas();
    if (abaAtiva === 'pedidos')  return renderAbaPedidos();
    if (abaAtiva === 'producao') return renderAbaProducao();
    if (abaAtiva === 'perdas')   return renderAbaPerdas();
    if (abaAtiva === 'dre')      return renderAbaDRE();
    if (abaAtiva === 'receitas') return renderAbaReceitasDespesas();
    if (abaAtiva === 'produtos') return renderAbaProdutos();
    if (abaAtiva === 'estoque')  return renderAbaEstoque();
    if (abaAtiva === 'clientes') return renderAbaClientes();
    return '';
  }

  /* ==========================================================
     14. ABA — RESUMO EXECUTIVO
     ========================================================== */

  function renderAbaResumo() {
    const v = kpisVendas();
    const p = kpisPedidos();
    const prod = kpisProducao();
    const perdas = kpisPerdas();
    const est = valorTotalEstoque();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Resumo executivo — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">Visão geral de tudo que aconteceu no período.</p>
        </div>

        <div class="grid grid--4">
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Faturamento</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${formatarMoeda(v.faturamento)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${v.qtd} ${v.qtd === 1 ? 'venda' : 'vendas'}</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Lucro líquido</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </span>
            </div>
            <div class="kpi__valor ${v.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(v.lucro)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Margem ${formatarPercentual(v.margem)}</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Ticket médio</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${formatarMoeda(v.ticket)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">por venda</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Itens vendidos</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${v.itensVendidos}</div>
            <div class="kpi__variacao kpi__variacao--neutra">unidades</div>
          </div>
        </div>

        <div class="grid grid--4">
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Pedidos</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${p.total}</div>
            <div class="kpi__variacao ${p.atrasados > 0 ? 'kpi__variacao--negativa' : 'kpi__variacao--neutra'}">
              ${p.atrasados > 0 ? `${p.atrasados} atrasado${p.atrasados > 1 ? 's' : ''}` : 'todos no prazo'}
            </div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Produção</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${prod.unidadesBoas}</div>
            <div class="kpi__variacao kpi__variacao--neutra">unidades boas</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Perdas</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              </span>
            </div>
            <div class="kpi__valor ${perdas.custoTotal > 0 ? 'text-critico' : ''}">${formatarMoeda(perdas.custoTotal)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${perdas.totalUnidades} unidades</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Valor em estoque</span>
              <span class="kpi__icone">
                <svg viewBox="0 0 24 24"><path d="M3 3h18v4H3z"/><path d="M5 7v14h14V7"/><path d="M9 11h6"/><path d="M9 15h6"/></svg>
              </span>
            </div>
            <div class="kpi__valor">${formatarMoeda(est.custo)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">a preço de custo</div>
          </div>
        </div>

        <div class="rel-destaque">
          <div class="rel-destaque__titulo">Resumo do lucro</div>
          <div class="rel-destaque__grid">
            <div class="rel-destaque__item">
              <span>Receita bruta</span>
              <strong>${formatarMoeda(v.faturamento)}</strong>
            </div>
            <div class="rel-destaque__item">
              <span>− Custo dos produtos</span>
              <strong>${formatarMoeda(v.custo)}</strong>
            </div>
            <div class="rel-destaque__item">
              <span>− Taxas e frete</span>
              <strong>${formatarMoeda(v.taxas + v.frete)}</strong>
            </div>
            <div class="rel-destaque__item">
              <span>− Perdas</span>
              <strong>${formatarMoeda(perdas.custoTotal)}</strong>
            </div>
            <div class="rel-destaque__item rel-destaque__item--final">
              <span>= Lucro líquido</span>
              <strong class="${v.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(v.lucro - perdas.custoTotal)}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     15. ABA — VENDAS
     ========================================================== */

  function renderAbaVendas() {
    const k = kpisVendas();
    const porDia = vendasPorDia();
    const porCanal = lucroPorCanal();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Vendas — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">Faturamento, lucro, ticket médio e desempenho por canal.</p>
        </div>

        <div class="grid grid--4">
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Faturamento</span></div>
            <div class="kpi__valor">${formatarMoeda(k.faturamento)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${k.qtd} vendas</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Lucro líquido</span></div>
            <div class="kpi__valor ${k.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(k.lucro)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Margem ${formatarPercentual(k.margem)}</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Ticket médio</span></div>
            <div class="kpi__valor">${formatarMoeda(k.ticket)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">por venda</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Descontos concedidos</span></div>
            <div class="kpi__valor text-atencao">${formatarMoeda(k.descontos)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${k.bonificacoes} bonificações</div>
          </div>
        </div>

        <div class="rel-blocos">
          <div class="rel-bloco">
            <div class="rel-bloco__titulo">Vendas por dia</div>
            ${porDia.length === 0 ? `
              <div class="rel-vazio">Nenhuma venda no período.</div>
            ` : `
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th class="tabela__numero">Vendas</th>
                    <th class="tabela__numero">Faturamento</th>
                    <th class="tabela__numero">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  ${porDia.map(d => `
                    <tr>
                      <td>${formatarData(d.dia)}</td>
                      <td class="tabela__numero">${d.qtd}</td>
                      <td class="tabela__numero peso-semibold">${formatarMoeda(d.faturamento)}</td>
                      <td class="tabela__numero ${d.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(d.lucro)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="rel-bloco">
            <div class="rel-bloco__titulo">Lucro por canal</div>
            ${porCanal.length === 0 ? `
              <div class="rel-vazio">Nenhuma venda no período.</div>
            ` : `
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Canal</th>
                    <th class="tabela__numero">Vendas</th>
                    <th class="tabela__numero">Faturamento</th>
                    <th class="tabela__numero">Lucro</th>
                    <th class="tabela__numero">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  ${porCanal.map(c => `
                    <tr>
                      <td><span class="badge badge--info">${escaparHTML(c.canal)}</span></td>
                      <td class="tabela__numero">${c.vendas}</td>
                      <td class="tabela__numero">${formatarMoeda(c.faturamento)}</td>
                      <td class="tabela__numero peso-semibold ${c.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(c.lucro)}</td>
                      <td class="tabela__numero">${formatarPercentual(c.margem)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     16. ABA — PEDIDOS
     ========================================================== */

  function renderAbaPedidos() {
    const k = kpisPedidos();
    const porStatus = pedidosPorStatus();
    const lista = pedidosNoPeriodo();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Pedidos — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">Acompanhe status, prazos e valores dos pedidos.</p>
        </div>

        <div class="grid grid--4">
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Total</span></div>
            <div class="kpi__valor">${k.total}</div>
            <div class="kpi__variacao kpi__variacao--neutra">pedidos</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Em aberto</span></div>
            <div class="kpi__valor text-atencao">${k.emAberto}</div>
            <div class="kpi__variacao kpi__variacao--neutra">aguardando</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Entregues</span></div>
            <div class="kpi__valor text-sucesso">${k.entregues}</div>
            <div class="kpi__variacao kpi__variacao--neutra">concluídos</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Valor total</span></div>
            <div class="kpi__valor">${formatarMoeda(k.valorTotal)}</div>
            <div class="kpi__variacao ${k.atrasados > 0 ? 'kpi__variacao--negativa' : 'kpi__variacao--neutra'}">
              ${k.atrasados > 0 ? `${k.atrasados} atrasados` : 'todos no prazo'}
            </div>
          </div>
        </div>

        <div class="rel-blocos">
          <div class="rel-bloco">
            <div class="rel-bloco__titulo">Pedidos por status</div>
            ${porStatus.length === 0 ? `
              <div class="rel-vazio">Nenhum pedido no período.</div>
            ` : `
              <div class="rel-status-lista">
                ${porStatus.map(s => `
                  <div class="rel-status-item">
                    <span class="badge badge--${s.cor}">${escaparHTML(s.nome)}</span>
                    <strong>${s.qtd}</strong>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="rel-bloco">
            <div class="rel-bloco__titulo">Últimos pedidos</div>
            ${lista.length === 0 ? `
              <div class="rel-vazio">Nenhum pedido no período.</div>
            ` : `
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th class="tabela__numero">Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${lista.slice(0, 10).map(p => {
                    const subtotal = (p.itens || []).reduce((a, i) => a + (Number(i.preco) || 0) * (Number(i.quantidade) || 0), 0);
                    const total = subtotal - (Number(p.desconto) || 0) + (Number(p.frete) || 0);
                    const status = window.MODULO_PEDIDOS?.STATUS?.find(s => s.codigo === p.status);
                    return `
                      <tr>
                        <td><span class="sku">${escaparHTML(p.numero)}</span></td>
                        <td>${escaparHTML(p.cliente || '—')}</td>
                        <td class="tabela__numero peso-semibold">${formatarMoeda(total)}</td>
                        <td><span class="badge badge--${status?.cor || 'neutro'}">${escaparHTML(status?.nome || p.status)}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     17. ABA — PRODUÇÃO
     ========================================================== */

  function renderAbaProducao() {
    const k = kpisProducao();
    const porProduto = producaoPorProduto();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Produção — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">Quanto foi produzido, com quantas falhas e qual o custo real.</p>
        </div>

        <div class="grid grid--4">
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Lotes produzidos</span></div>
            <div class="kpi__valor">${k.lotes}</div>
            <div class="kpi__variacao kpi__variacao--neutra">operações</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Unidades produzidas</span></div>
            <div class="kpi__valor">${k.unidadesProduzidas}</div>
            <div class="kpi__variacao kpi__variacao--neutra">antes de falhas</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Unidades boas</span></div>
            <div class="kpi__valor text-sucesso">${k.unidadesBoas}</div>
            <div class="kpi__variacao kpi__variacao--neutra">para estoque</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Taxa de falha</span></div>
            <div class="kpi__valor ${k.taxaFalha > 5 ? 'text-critico' : k.taxaFalha > 0 ? 'text-atencao' : ''}">${formatarPercentual(k.taxaFalha)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${k.unidadesFalhas} unidades</div>
          </div>
        </div>

        <div class="rel-bloco">
          <div class="rel-bloco__titulo">Produção por produto</div>
          ${porProduto.length === 0 ? `
            <div class="rel-vazio">Nenhuma produção no período.</div>
          ` : `
            <table class="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th class="tabela__numero">Lotes</th>
                  <th class="tabela__numero">Produzidas</th>
                  <th class="tabela__numero">Boas</th>
                  <th class="tabela__numero">Falhas</th>
                  <th class="tabela__numero">Taxa</th>
                </tr>
              </thead>
              <tbody>
                ${porProduto.map(p => `
                  <tr>
                    <td>
                      <div class="produto-nome">${escaparHTML(p.nome)}</div>
                      ${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : ''}
                    </td>
                    <td class="tabela__numero">${p.lotes}</td>
                    <td class="tabela__numero">${p.produzidas}</td>
                    <td class="tabela__numero text-sucesso peso-semibold">${p.boas}</td>
                    <td class="tabela__numero ${p.falhas > 0 ? 'text-critico peso-semibold' : ''}">${p.falhas}</td>
                    <td class="tabela__numero">${formatarPercentual(p.taxaFalha)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  /* ==========================================================
     18. ABA — PERDAS
     ========================================================== */

  function renderAbaPerdas() {
    const k = kpisPerdas();
    const detalhadas = perdasDetalhadas();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Perdas — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">Falhas de produção e perdas de estoque, com custo real.</p>
        </div>

        <div class="grid grid--4">
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Falhas de produção</span></div>
            <div class="kpi__valor text-critico">${k.unidadesFalhas}</div>
            <div class="kpi__variacao kpi__variacao--neutra">unidades</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Perdas de estoque</span></div>
            <div class="kpi__valor text-critico">${k.unidadesPerdidas}</div>
            <div class="kpi__variacao kpi__variacao--neutra">unidades</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Custo das perdas</span></div>
            <div class="kpi__valor text-critico">${formatarMoeda(k.custoTotal)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">prejuízo real</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Total de unidades</span></div>
            <div class="kpi__valor">${k.totalUnidades}</div>
            <div class="kpi__variacao kpi__variacao--neutra">perdidas</div>
          </div>
        </div>

        <div class="rel-bloco">
          <div class="rel-bloco__titulo">Detalhamento das perdas</div>
          ${detalhadas.length === 0 ? `
            <div class="rel-vazio">Nenhuma perda registrada no período.</div>
          ` : `
            <table class="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Produto</th>
                  <th class="tabela__numero">Qtd</th>
                  <th class="tabela__numero">Custo</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${detalhadas.slice(0, 30).map(p => `
                  <tr>
                    <td>${formatarData(p.data)}</td>
                    <td><span class="badge badge--critico">${escaparHTML(p.tipo)}</span></td>
                    <td>
                      <div class="produto-nome">${escaparHTML(p.produto)}</div>
                      ${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : ''}
                    </td>
                    <td class="tabela__numero">${p.quantidade}</td>
                    <td class="tabela__numero peso-semibold text-critico">${formatarMoeda(p.custo)}</td>
                    <td class="text-secundario">${escaparHTML(p.motivo)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  /* ==========================================================
     19. ABA — DRE SIMPLIFICADO
     ========================================================== */

  function renderAbaDRE() {
    const d = dreSimplificado();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Lucro x Custo (DRE simplificado) — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">Da receita bruta ao lucro operacional, mostrando onde o dinheiro vai.</p>
        </div>

        <div class="dre">
          <div class="dre__linha dre__linha--positiva">
            <span class="dre__label">Receita bruta</span>
            <span class="dre__valor">${formatarMoeda(d.receitaBruta)}</span>
          </div>
          <div class="dre__linha dre__linha--negativa">
            <span class="dre__label">(−) Deduções (descontos + bonificações)</span>
            <span class="dre__valor">${formatarMoeda(d.deducoes)}</span>
          </div>
          <div class="dre__linha dre__linha--subtotal">
            <span class="dre__label">Receita líquida</span>
            <span class="dre__valor">${formatarMoeda(d.receitaLiquida)}</span>
          </div>
          <div class="dre__linha dre__linha--negativa">
            <span class="dre__label">(−) Custo dos produtos vendidos</span>
            <span class="dre__valor">${formatarMoeda(d.custoProdutos)}</span>
          </div>
          <div class="dre__linha dre__linha--subtotal">
            <span class="dre__label">Lucro bruto</span>
            <span class="dre__valor">${formatarMoeda(d.lucroBruto)}</span>
          </div>
          <div class="dre__linha dre__linha--negativa">
            <span class="dre__label">(−) Taxas dos canais</span>
            <span class="dre__valor">${formatarMoeda(d.taxas)}</span>
          </div>
          <div class="dre__linha dre__linha--negativa">
            <span class="dre__label">(−) Frete pago</span>
            <span class="dre__valor">${formatarMoeda(d.frete)}</span>
          </div>
          <div class="dre__linha dre__linha--negativa">
            <span class="dre__label">(−) Perdas (produção + estoque)</span>
            <span class="dre__valor">${formatarMoeda(d.perdas)}</span>
          </div>
          <div class="dre__linha dre__linha--final ${d.lucroOperacional >= 0 ? 'dre__linha--positiva' : 'dre__linha--negativa'}">
            <span class="dre__label">= Lucro operacional</span>
            <span class="dre__valor">${formatarMoeda(d.lucroOperacional)}</span>
          </div>
          <div class="dre__linha dre__linha--info">
            <span class="dre__label">Margem operacional</span>
            <span class="dre__valor">${formatarPercentual(d.margemOperacional)}</span>
          </div>
        </div>

        <div class="rel-info">
          <div class="rel-info__titulo">Como interpretar</div>
          <div class="rel-info__texto">
            <strong>Receita bruta</strong> é tudo que você vendeu. <strong>Deduções</strong> são os descontos e bonificações que você deu.
            <strong>Custo dos produtos</strong> é quanto você gastou para produzir o que foi vendido.
            <strong>Lucro bruto</strong> é o que sobra antes de taxas e frete.
            <strong>Lucro operacional</strong> é o lucro real, depois de todas as despesas.
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     20. ABA — RECEITAS E DESPESAS
     ========================================================== */

  function renderAbaReceitasDespesas() {
    const r = receitasEDespesas();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Receitas e Despesas — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">Quanto entrou, quanto saiu e o saldo final.</p>
        </div>

        <div class="grid grid--3">
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Receitas</span></div>
            <div class="kpi__valor text-sucesso">${formatarMoeda(r.receitas)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">vendas no período</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Despesas</span></div>
            <div class="kpi__valor text-critico">${formatarMoeda(r.despesasTotais)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">custos + taxas + frete + perdas</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Saldo</span></div>
            <div class="kpi__valor ${r.saldo >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(r.saldo)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${r.receitas > 0 ? formatarPercentual((r.saldo / r.receitas) * 100) : '0%'} da receita</div>
          </div>
        </div>

        <div class="rel-blocos">
          <div class="rel-bloco">
            <div class="rel-bloco__titulo">Composição das despesas</div>
            <table class="tabela">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th class="tabela__numero">Valor</th>
                  <th class="tabela__numero">% das despesas</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Custo dos produtos</td>
                  <td class="tabela__numero peso-semibold">${formatarMoeda(r.despesasProduto)}</td>
                  <td class="tabela__numero">${r.despesasTotais > 0 ? formatarPercentual((r.despesasProduto / r.despesasTotais) * 100) : '0%'}</td>
                </tr>
                <tr>
                  <td>Taxas dos canais</td>
                  <td class="tabela__numero peso-semibold">${formatarMoeda(r.despesasTaxas)}</td>
                  <td class="tabela__numero">${r.despesasTotais > 0 ? formatarPercentual((r.despesasTaxas / r.despesasTotais) * 100) : '0%'}</td>
                </tr>
                <tr>
                  <td>Frete pago</td>
                  <td class="tabela__numero peso-semibold">${formatarMoeda(r.despesasFrete)}</td>
                  <td class="tabela__numero">${r.despesasTotais > 0 ? formatarPercentual((r.despesasFrete / r.despesasTotais) * 100) : '0%'}</td>
                </tr>
                <tr>
                  <td>Perdas</td>
                  <td class="tabela__numero peso-semibold text-critico">${formatarMoeda(r.despesasPerdas)}</td>
                  <td class="tabela__numero">${r.despesasTotais > 0 ? formatarPercentual((r.despesasPerdas / r.despesasTotais) * 100) : '0%'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="rel-bloco">
            <div class="rel-bloco__titulo">Resultado do período</div>
            <div class="rel-fluxo">
              <div class="rel-fluxo__item rel-fluxo__item--positivo">
                <span>Entradas</span>
                <strong>${formatarMoeda(r.receitas)}</strong>
              </div>
              <div class="rel-fluxo__item rel-fluxo__item--negativo">
                <span>Saídas</span>
                <strong>${formatarMoeda(r.despesasTotais)}</strong>
              </div>
              <div class="rel-fluxo__item rel-fluxo__item--final ${r.saldo >= 0 ? 'rel-fluxo__item--positivo' : 'rel-fluxo__item--negativo'}">
                <span>Saldo</span>
                <strong>${formatarMoeda(r.saldo)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     21. ABA — PRODUTOS
     ========================================================== */

  function renderAbaProdutos() {
    const mais = produtosMaisVendidos().slice(0, 10);
    const menos = produtosMenosVendidos().slice(0, 10);

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Produtos — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">Mais vendidos, menos vendidos, margem e lucro por produto.</p>
        </div>

        <div class="rel-blocos">
          <div class="rel-bloco">
            <div class="rel-bloco__titulo">🏆 Mais vendidos</div>
            ${mais.length === 0 ? `<div class="rel-vazio">Nenhuma venda no período.</div>` : `
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th class="tabela__numero">Qtd</th>
                    <th class="tabela__numero">Faturamento</th>
                    <th class="tabela__numero">Lucro</th>
                    <th class="tabela__numero">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  ${mais.map(p => `
                    <tr>
                      <td>
                        <div class="produto-nome">${escaparHTML(p.nome)}</div>
                        ${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : ''}
                      </td>
                      <td class="tabela__numero peso-semibold">${p.quantidade}</td>
                      <td class="tabela__numero">${formatarMoeda(p.faturamento)}</td>
                      <td class="tabela__numero ${p.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(p.lucro)}</td>
                      <td class="tabela__numero">${formatarPercentual(p.margem)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="rel-bloco">
            <div class="rel-bloco__titulo">📉 Menos vendidos</div>
            ${menos.length === 0 ? `<div class="rel-vazio">Nenhuma venda no período.</div>` : `
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th class="tabela__numero">Qtd</th>
                    <th class="tabela__numero">Faturamento</th>
                    <th class="tabela__numero">Lucro</th>
                    <th class="tabela__numero">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  ${menos.map(p => `
                    <tr>
                      <td>
                        <div class="produto-nome">${escaparHTML(p.nome)}</div>
                        ${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : ''}
                      </td>
                      <td class="tabela__numero peso-semibold">${p.quantidade}</td>
                      <td class="tabela__numero">${formatarMoeda(p.faturamento)}</td>
                      <td class="tabela__numero ${p.lucro >= 0 ? 'text-sucesso' : 'text-critico'}">${formatarMoeda(p.lucro)}</td>
                      <td class="tabela__numero">${formatarPercentual(p.margem)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     22. ABA — ESTOQUE
     ========================================================== */

  function renderAbaEstoque() {
    const baixo = produtosEstoqueBaixo();
    const valor = valorTotalEstoque();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Estoque</h2>
          <p class="rel-secao__subtitulo">Valor em estoque e produtos que precisam de reposição.</p>
        </div>

        <div class="grid grid--2">
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Valor em estoque (custo)</span></div>
            <div class="kpi__valor">${formatarMoeda(valor.custo)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">quanto você pagou</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo"><span class="kpi__label">Valor em estoque (venda)</span></div>
            <div class="kpi__valor text-sucesso">${formatarMoeda(valor.venda)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">potencial de faturamento</div>
          </div>
        </div>

        <div class="rel-bloco">
          <div class="rel-bloco__titulo">Produtos que precisam de reposição</div>
          ${baixo.length === 0 ? `
            <div class="rel-vazio">Nenhum produto abaixo do mínimo. Estoque em ordem. ✅</div>
          ` : `
            <table class="tabela">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produto</th>
                  <th class="tabela__numero">Atual</th>
                  <th class="tabela__numero">Mínimo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${baixo.map(p => {
                  const cor = p.statusEstoque === 'zerado' || p.statusEstoque === 'critico' ? 'critico' : 'atencao';
                  const nome = p.statusEstoque === 'zerado' ? 'Zerado' : p.statusEstoque === 'critico' ? 'Crítico' : 'Atenção';
                  return `
                    <tr>
                      <td><span class="sku">${escaparHTML(p.sku)}</span></td>
                      <td>${escaparHTML(p.nome)}</td>
                      <td class="tabela__numero peso-semibold text-${cor}">${p.estoqueAtual} ${escaparHTML(p.unidade)}</td>
                      <td class="tabela__numero text-secundario">${p.estoqueMinimo}</td>
                      <td><span class="badge badge--${cor}">${nome}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  /* ==========================================================
     23. ABA — CLIENTES
     ========================================================== */

  function renderAbaClientes() {
    const origens = clientesPorOrigem();
    const top = topCompradores();

    return `
      <div class="rel-secao">
        <div class="rel-secao__header">
          <h2 class="rel-secao__titulo">Clientes — ${escaparHTML(nomePeriodoAtual())}</h2>
          <p class="rel-secao__subtitulo">De onde vêm seus clientes e quem mais compra.</p>
        </div>

        <div class="rel-blocos">
          <div class="rel-bloco">
            <div class="rel-bloco__titulo">Origem dos clientes</div>
            ${origens.length === 0 ? `
              <div class="rel-vazio">Nenhum cliente cadastrado ainda.</div>
            ` : `
              <div class="rel-origens">
                ${origens.map(o => `
                  <div class="rel-origem">
                    <div class="rel-origem__nome">${escaparHTML(o.nome)}</div>
                    <div class="rel-origem__total">${o.total}</div>
                    <div class="rel-origem__legenda">${o.total === 1 ? 'cliente' : 'clientes'}</div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="rel-bloco">
            <div class="rel-bloco__titulo">🏆 Top 10 compradores</div>
            ${top.length === 0 ? `
              <div class="rel-vazio">Nenhuma venda no período.</div>
            ` : `
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th class="tabela__numero">Compras</th>
                    <th class="tabela__numero">Total gasto</th>
                    <th class="tabela__numero">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  ${top.map(c => `
                    <tr>
                      <td>${escaparHTML(c.cliente)}</td>
                      <td class="tabela__numero">${c.qtd}</td>
                      <td class="tabela__numero peso-semibold">${formatarMoeda(c.total)}</td>
                      <td class="tabela__numero">${formatarMoeda(c.ticket)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     24. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'relatorios') {
      container.innerHTML = render();
    }
  }

  /* ==========================================================
     25. API PÚBLICA
     ========================================================== */

  return {
    render,
    alterarPeriodo,
    alterarDataInicio,
    alterarDataFim,
    alterarAba,
    // Expostos para uso externo (dashboard, etc.)
    _kpisVendas: kpisVendas,
    _kpisPedidos: kpisPedidos,
    _kpisProducao: kpisProducao,
    _kpisPerdas: kpisPerdas,
    _dreSimplificado: dreSimplificado,
    _receitasEDespesas: receitasEDespesas,
    _produtosMaisVendidos: produtosMaisVendidos,
    _produtosMenosVendidos: produtosMenosVendidos,
    _lucroPorCanal: lucroPorCanal,
    _clientesPorOrigem: clientesPorOrigem,
    _topCompradores: topCompradores,
    _estoqueBaixo: produtosEstoqueBaixo,
    _valorTotalEstoque: valorTotalEstoque,
    _vendasNoPeriodo: vendasNoPeriodo,
    _pedidosNoPeriodo: pedidosNoPeriodo,
    _movimentacoesNoPeriodo: movimentacoesNoPeriodo
  };

})();

window.MODULO_RELATORIOS = MODULO_RELATORIOS;
window.renderRelatorios = MODULO_RELATORIOS.render;
