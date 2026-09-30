/* ============================================================
   PRAFICAR ERP — MÓDULO RELATÓRIOS
   Arquivo: assets/js/modulos/relatorios.js
   Descrição: agrega dados de Vendas, Encomendas, Produtos,
              Financeiro e Clientes. Apresenta relatórios
              simples com filtros por período.
   ============================================================ */

const MODULO_RELATORIOS = (() => {

  /* ==========================================================
     1. ESTADO
     ========================================================== */

  let periodo = '30';   // hoje | 7 | 30 | 90 | custom
  let dataInicio = '';
  let dataFim = '';

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

  function formatarPercentual(v) {
    const n = Number(v) || 0;
    return `${n.toFixed(1).replace('.', ',')}%`;
  }

  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
  }

  function hojeISO() {
    return new Date().toISOString().split('T')[0];
  }

  function adicionarDias(dataISO, dias) {
    const d = new Date(dataISO + 'T00:00:00');
    d.setDate(d.getDate() + Number(dias || 0));
    return d.toISOString().split('T')[0];
  }

  /* ==========================================================
     3. DEFINIÇÃO DO PERÍODO
     ========================================================== */

  function intervaloAtual() {
    const hoje = hojeISO();

    if (periodo === 'hoje') return { inicio: hoje, fim: hoje };
    if (periodo === 'custom' && dataInicio && dataFim) {
      return { inicio: dataInicio, fim: dataFim };
    }

    const dias = Number(periodo) || 30;
    return { inicio: adicionarDias(hoje, -dias), fim: hoje };
  }

  function alterarPeriodo(valor) {
    periodo = valor;
    rerender();
  }

  function alterarDataInicio(v) { dataInicio = v; periodo = 'custom'; rerender(); }
  function alterarDataFim(v)    { dataFim = v; periodo = 'custom'; rerender(); }

  /* ==========================================================
     4. AGREGAÇÃO DE VENDAS
     ========================================================== */

  function vendasNoPeriodo() {
    const { inicio, fim } = intervaloAtual();
    if (!window.MODULO_VENDAS) return [];

    return (window.MODULO_VENDAS._listar() || []).filter(v => {
      const data = v.criadoEm?.split('T')[0];
      return data >= inicio && data <= fim && v.status !== 'cancelada';
    });
  }

  function kpisVendas() {
    const vendas = vendasNoPeriodo();

    const faturamento = vendas.reduce((a, v) => a + (Number(v.totais?.subtotal) || 0), 0);
    const custo = vendas.reduce((a, v) => a + (Number(v.totais?.custoTotal) || 0), 0);
    const taxas = vendas.reduce((a, v) => a + (Number(v.totais?.taxaCanalValor) || 0) + (Number(v.totais?.taxaFixa) || 0), 0);
    const frete = vendas.reduce((a, v) => a + (Number(v.freteVendedor) || 0), 0);
    const lucro = vendas.reduce((a, v) => a + (Number(v.totais?.lucro) || 0), 0);
    const qtd = vendas.length;
    const ticket = qtd > 0 ? faturamento / qtd : 0;
    const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

    return { faturamento, custo, taxas, frete, lucro, qtd, ticket, margem };
  }

  /* ==========================================================
     5. PRODUTOS MAIS VENDIDOS
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
            faturamento: 0
          };
        }
        mapa[chave].quantidade += Number(item.quantidade) || 0;
        mapa[chave].faturamento += (Number(item.preco) || 0) * (Number(item.quantidade) || 0);
      });
    });

    return Object.values(mapa).sort((a, b) => b.quantidade - a.quantidade);
  }

  /* ==========================================================
     6. LUCRO POR CANAL
     ========================================================== */

  function lucroPorCanal() {
    const vendas = vendasNoPeriodo();
    const mapa = {};

    vendas.forEach(v => {
      const chave = v.canalNome || 'Venda direta';
      if (!mapa[chave]) {
        mapa[chave] = {
          canal: chave,
          faturamento: 0,
          lucro: 0,
          vendas: 0
        };
      }
      mapa[chave].faturamento += Number(v.totais?.subtotal) || 0;
      mapa[chave].lucro += Number(v.totais?.lucro) || 0;
      mapa[chave].vendas += 1;
    });

    Object.values(mapa).forEach(c => {
      c.margem = c.faturamento > 0 ? (c.lucro / c.faturamento) * 100 : 0;
    });

    return Object.values(mapa).sort((a, b) => b.lucro - a.lucro);
  }

  /* ==========================================================
     7. ORIGEM DOS CLIENTES
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

  /* ==========================================================
     8. ESTOQUE BAIXO
     ========================================================== */

  function produtosEstoqueBaixo() {
    if (!window.MODULO_PRODUTOS) return [];
    return (window.MODULO_PRODUTOS._listar() || [])
      .filter(p => p.status === 'ativo' && Number(p.estoqueAtual) <= Number(p.estoqueMinimo))
      .sort((a, b) => a.estoqueAtual - b.estoqueAtual);
  }

  /* ==========================================================
     9. ENCOMENDAS
     ========================================================== */

  function encomendasNoPeriodo() {
    const { inicio, fim } = intervaloAtual();
    if (!window.MODULO_ENCOMENDAS) return [];

    return (window.MODULO_ENCOMENDAS._listar() || []).filter(e => {
      const data = e.criadoEm?.split('T')[0];
      return data >= inicio && data <= fim && e.status !== 'cancelada';
    });
  }

  function kpisEncomendas() {
    const lista = encomendasNoPeriodo();
    const abertas = lista.filter(e => !['entregue', 'cancelada'].includes(e.status)).length;
    const entregues = lista.filter(e => e.status === 'entregue').length;
    const atrasadas = lista.filter(e => {
      if (['entregue', 'cancelada'].includes(e.status)) return false;
      return e.prazo && e.prazo < hojeISO();
    }).length;

    return { total: lista.length, abertas, entregues, atrasadas };
  }

  /* ==========================================================
     10. RENDER
     ========================================================== */

  function render() {
    return `
      <div class="pagina-header">
        <div class="pagina-header__info">
          <h1 class="pagina-header__titulo">Relatórios</h1>
          <p class="pagina-header__subtitulo">
            Vendas, lucro, produtos, estoque, encomendas e clientes.
          </p>
        </div>
      </div>

      <div class="rel-filtros">
        <div class="rel-periodo">
          <button class="rel-periodo__btn ${periodo === 'hoje' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('hoje')">Hoje</button>
          <button class="rel-periodo__btn ${periodo === '7' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('7')">7 dias</button>
          <button class="rel-periodo__btn ${periodo === '30' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('30')">30 dias</button>
          <button class="rel-periodo__btn ${periodo === '90' ? 'rel-periodo__btn--ativo' : ''}" onclick="MODULO_RELATORIOS.alterarPeriodo('90')">90 dias</button>
        </div>

        <div class="rel-custom">
          <input type="date" value="${dataInicio}" onchange="MODULO_RELATORIOS.alterarDataInicio(this.value)" />
          <span class="rel-custom__sep">até</span>
          <input type="date" value="${dataFim}" onchange="MODULO_RELATORIOS.alterarDataFim(this.value)" />
        </div>
      </div>

      ${renderResumoVendas()}
      ${renderProdutosMaisVendidos()}
      ${renderLucroPorCanal()}
      ${renderOrigemClientes()}
      ${renderEstoqueBaixo()}
      ${renderResumoEncomendas()}
    `;
  }

  /* ==========================================================
     11. RESUMO DE VENDAS
     ========================================================== */

  function renderResumoVendas() {
    const k = kpisVendas();

    return `
      <div class="rel-secao">
        <h2 class="rel-secao__titulo">Vendas no período</h2>
        <div class="grid grid--4">
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Faturamento</span>
            </div>
            <div class="kpi__valor">${formatarMoeda(k.faturamento)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">${k.qtd} ${k.qtd === 1 ? 'venda' : 'vendas'}</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Lucro líquido</span>
            </div>
            <div class="kpi__valor text-sucesso">${formatarMoeda(k.lucro)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Margem ${formatarPercentual(k.margem)}</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Ticket médio</span>
            </div>
            <div class="kpi__valor">${formatarMoeda(k.ticket)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Por venda</div>
          </div>

          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Taxas + frete</span>
            </div>
            <div class="kpi__valor text-atencao">${formatarMoeda(k.taxas + k.frete)}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Descontado do lucro</div>
          </div>
        </div>

        <div class="rel-detalhe">
          <div class="rel-detalhe__linha">
            <span>Custo dos produtos</span>
            <span>${formatarMoeda(k.custo)}</span>
          </div>
          <div class="rel-detalhe__linha">
            <span>Taxas dos canais</span>
            <span>${formatarMoeda(k.taxas)}</span>
          </div>
          <div class="rel-detalhe__linha">
            <span>Frete pago por você</span>
            <span>${formatarMoeda(k.frete)}</span>
          </div>
          <div class="rel-detalhe__linha rel-detalhe__linha--destaque">
            <span>Lucro líquido</span>
            <span class="text-sucesso">${formatarMoeda(k.lucro)}</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     12. PRODUTOS MAIS VENDIDOS
     ========================================================== */

  function renderProdutosMaisVendidos() {
    const lista = produtosMaisVendidos().slice(0, 10);

    return `
      <div class="rel-secao">
        <h2 class="rel-secao__titulo">Produtos mais vendidos</h2>

        ${lista.length === 0 ? `
          <div class="card">
            <div class="vazio">
              <div class="vazio__icone">
                <svg viewBox="0 0 24 24"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>
              </div>
              <h3 class="vazio__titulo">Nenhuma venda no período</h3>
              <p class="vazio__descricao">Ajuste o período ou registre novas vendas.</p>
            </div>
          </div>
        ` : `
          <div class="tabela-wrapper">
            <div class="tabela-scroll">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>SKU</th>
                    <th class="tabela__numero">Quantidade</th>
                    <th class="tabela__numero">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  ${lista.map(p => `
                    <tr>
                      <td>${escaparHTML(p.nome)}</td>
                      <td>${p.sku ? `<span class="sku">${escaparHTML(p.sku)}</span>` : '—'}</td>
                      <td class="tabela__numero peso-semibold">${p.quantidade}</td>
                      <td class="tabela__numero">${formatarMoeda(p.faturamento)}</td>
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
     13. LUCRO POR CANAL
     ========================================================== */

  function renderLucroPorCanal() {
    const lista = lucroPorCanal();

    return `
      <div class="rel-secao">
        <h2 class="rel-secao__titulo">Lucro por canal</h2>

        ${lista.length === 0 ? `
          <div class="card">
            <div class="vazio">
              <div class="vazio__icone">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>
              </div>
              <h3 class="vazio__titulo">Sem dados de canal no período</h3>
              <p class="vazio__descricao">Ajuste o período ou registre novas vendas.</p>
            </div>
          </div>
        ` : `
          <div class="tabela-wrapper">
            <div class="tabela-scroll">
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
                  ${lista.map(c => `
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
            </div>
          </div>
        `}
      </div>
    `;
  }

  /* ==========================================================
     14. ORIGEM DOS CLIENTES
     ========================================================== */

  function renderOrigemClientes() {
    const lista = clientesPorOrigem();

    return `
      <div class="rel-secao">
        <h2 class="rel-secao__titulo">Origem dos clientes</h2>

        ${lista.length === 0 ? `
          <div class="card">
            <div class="vazio">
              <div class="vazio__icone">
                <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <h3 class="vazio__titulo">Nenhum cliente cadastrado</h3>
              <p class="vazio__descricao">Cadastre clientes com origem para descobrir de onde vêm suas vendas.</p>
            </div>
          </div>
        ` : `
          <div class="rel-origens">
            ${lista.map(o => `
              <div class="rel-origem">
                <div class="rel-origem__nome">${escaparHTML(o.nome)}</div>
                <div class="rel-origem__total">${o.total}</div>
                <div class="rel-origem__legenda">${o.total === 1 ? 'cliente' : 'clientes'}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  /* ==========================================================
     15. ESTOQUE BAIXO
     ========================================================== */

  function renderEstoqueBaixo() {
    const lista = produtosEstoqueBaixo();

    return `
      <div class="rel-secao">
        <h2 class="rel-secao__titulo">Estoque baixo</h2>

        ${lista.length === 0 ? `
          <div class="card">
            <div class="vazio">
              <div class="vazio__icone">
                <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <h3 class="vazio__titulo">Tudo em ordem</h3>
              <p class="vazio__descricao">Nenhum produto abaixo do estoque mínimo.</p>
            </div>
          </div>
        ` : `
          <div class="tabela-wrapper">
            <div class="tabela-scroll">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Produto</th>
                    <th class="tabela__numero">Estoque</th>
                    <th class="tabela__numero">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  ${lista.map(p => `
                    <tr>
                      <td><span class="sku">${escaparHTML(p.sku)}</span></td>
                      <td>${escaparHTML(p.nome)}</td>
                      <td class="tabela__numero ${p.estoqueAtual === 0 ? 'text-critico peso-semibold' : 'text-atencao peso-semibold'}">
                        ${p.estoqueAtual}
                      </td>
                      <td class="tabela__numero">${p.estoqueMinimo}</td>
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
     16. RESUMO DE ENCOMENDAS
     ========================================================== */

  function renderResumoEncomendas() {
    const k = kpisEncomendas();

    return `
      <div class="rel-secao">
        <h2 class="rel-secao__titulo">Encomendas no período</h2>
        <div class="grid grid--4">
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Total</span>
            </div>
            <div class="kpi__valor">${k.total}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Cadastradas</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Em aberto</span>
            </div>
            <div class="kpi__valor text-atencao">${k.abertas}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Aguardando</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Entregues</span>
            </div>
            <div class="kpi__valor text-sucesso">${k.entregues}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Concluídas</div>
          </div>
          <div class="kpi">
            <div class="kpi__topo">
              <span class="kpi__label">Atrasadas</span>
            </div>
            <div class="kpi__valor ${k.atrasadas > 0 ? 'text-critico' : ''}">${k.atrasadas}</div>
            <div class="kpi__variacao kpi__variacao--neutra">Prazo vencido</div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     17. RERENDER
     ========================================================== */

  function rerender() {
    const container = document.getElementById('conteudo-tela');
    if (container && window.ROUTER_PRAFICAR?.obterRotaAtual() === 'relatorios') {
      container.innerHTML = render();
    }
  }

  /* ==========================================================
     18. API PÚBLICA
     ========================================================== */

  return {
    render,
    alterarPeriodo,
    alterarDataInicio,
    alterarDataFim,
    _kpisVendas: kpisVendas,
    _produtosMaisVendidos: produtosMaisVendidos,
    _lucroPorCanal: lucroPorCanal,
    _clientesPorOrigem: clientesPorOrigem,
    _estoqueBaixo: produtosEstoqueBaixo
  };

})();

window.MODULO_RELATORIOS = MODULO_RELATORIOS;
window.renderRelatorios = MODULO_RELATORIOS.render;
