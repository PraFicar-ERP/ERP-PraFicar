/* ============================================================
   PRAFICAR ERP — ESTILOS DO MÓDULO PRECIFICAR (v2)
   Arquivo: assets/css/modulos/precificar.css
   ============================================================ */

/* ============================================================
   1. LAYOUT EM 2 COLUNAS
   ============================================================ */

.precificar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: var(--esp-5);
  align-items: start;
}

.precificar-form {
  display: flex;
  flex-direction: column;
  gap: var(--esp-4);
  min-width: 0;
}

.precificar-resultado {
  position: sticky;
  top: calc(var(--altura-header) + var(--esp-4));
}

/* ============================================================
   2. LINHAS DE FORMULÁRIO
   ============================================================ */

.form-linha-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--esp-3);
}

.prec-info-calc {
  font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
  font-size: var(--texto-base);
  font-weight: var(--peso-bold);
  color: var(--azul-marinho);
  padding: var(--esp-3) var(--esp-4);
  background-color: var(--azul-suave);
  border-radius: var(--raio-md);
  letter-spacing: 0.02em;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   3. LISTA DE INSUMOS
   ============================================================ */

.insumos-vazio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--esp-3);
  padding: var(--esp-5) var(--esp-4);
  text-align: center;
  color: var(--cor-texto-secundario);
  font-size: var(--texto-sm);
  border: 1px dashed var(--cor-borda-media);
  border-radius: var(--raio-md);
  background-color: var(--cinza-50);
}

.tabela-insumos {
  font-size: var(--texto-sm);
}

.tabela-insumos tfoot td {
  padding-top: var(--esp-3);
  padding-bottom: var(--esp-3);
  border-top: 2px solid var(--cor-borda-suave);
  border-bottom: none;
}

/* ============================================================
   4. IMPRESSORA
   ============================================================ */

.prec-impressora-info {
  font-size: var(--texto-sm);
  color: var(--cor-texto-secundario);
}

.imp-linha {
  margin-bottom: var(--esp-4);
  padding-bottom: var(--esp-4);
  border-bottom: 1px dashed var(--cor-borda-suave);
}

.imp-linha:last-of-type {
  border-bottom: none;
}

.imp-linha__titulo {
  display: flex;
  align-items: center;
  gap: var(--esp-2);
  font-weight: var(--peso-semibold);
  color: var(--cor-texto-principal);
  margin-bottom: var(--esp-3);
}

.imp-cor {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.imp-cor--preto   { background-color: #1F2733; }
.imp-cor--ciano   { background-color: #00B8D4; }
.imp-cor--magenta { background-color: #E91E63; }
.imp-cor--amarelo { background-color: #FFC107; }

.imp-totais {
  display: flex;
  flex-direction: column;
  gap: var(--esp-2);
  padding: var(--esp-4);
  background-color: var(--azul-suave);
  border-radius: var(--raio-md);
  margin-top: var(--esp-4);
}

.imp-totais > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--texto-sm);
}

.imp-totais strong {
  font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
  font-size: var(--texto-base);
  color: var(--azul-marinho);
}

/* ============================================================
   5. SLIDER DE MARGEM
   ============================================================ */

.margem-slider {
  display: flex;
  align-items: center;
  gap: var(--esp-3);
}

.margem-slider__btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--raio-md);
  background-color: var(--cinza-100);
  border: 1px solid var(--cor-borda-suave);
  color: var(--cor-texto-padrao);
  font-size: var(--texto-lg);
  font-weight: var(--peso-bold);
  cursor: pointer;
  transition: background-color var(--transicao-rapida), color var(--transicao-rapida);
}

.margem-slider__btn:hover {
  background-color: var(--azul-suave);
  color: var(--azul-medio);
}

.margem-slider input[type="range"] {
  flex: 1;
  accent-color: var(--azul-medio);
  height: 6px;
}

.margem-slider__valor {
  font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
  font-size: var(--texto-lg);
  font-weight: var(--peso-bold);
  color: var(--azul-marinho);
  min-width: 64px;
  text-align: right;
}

/* ============================================================
   6. CARD DE RESULTADO
   ============================================================ */

.resultado-card {
  background-color: var(--cor-fundo-card);
  border: 1px solid var(--cor-borda-suave);
  border-radius: var(--raio-lg);
  box-shadow: var(--sombra-md);
  overflow: hidden;
}

.resultado-card__header {
  padding: var(--esp-5);
  background-color: var(--cinza-50);
  border-bottom: 1px solid var(--cor-borda-suave);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--esp-1);
}

.resultado-card__label {
  font-size: var(--texto-xs);
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  color: var(--cor-texto-secundario);
}

.resultado-card__valor {
  font-size: var(--texto-2xl);
  font-weight: var(--peso-bold);
  color: var(--cor-texto-principal);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.resultado-card__sub {
  font-size: var(--texto-xs);
  color: var(--cor-texto-secundario);
}

.resultado-card__destaque {
  padding: var(--esp-6) var(--esp-5);
  background: linear-gradient(180deg, var(--azul-marinho) 0%, var(--azul-medio) 100%);
  color: var(--branco);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--esp-2);
}

.resultado-card__destaque .resultado-card__label {
  color: var(--azul-claro);
  opacity: 0.9;
}

.resultado-card__preco {
  font-size: var(--texto-3xl);
  font-weight: var(--peso-bold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.resultado-card__grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 1px solid var(--cor-borda-suave);
}

.resultado-card__item {
  padding: var(--esp-4) var(--esp-3);
  display: flex;
  flex-direction: column;
  gap: var(--esp-1);
  text-align: center;
}

.resultado-card__item + .resultado-card__item {
  border-left: 1px solid var(--cor-borda-suave);
}

.resultado-card__item-label {
  font-size: var(--texto-xs);
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  color: var(--cor-texto-secundario);
}

.resultado-card__item-valor {
  font-size: var(--texto-md);
  font-weight: var(--peso-bold);
  font-variant-numeric: tabular-nums;
  color: var(--cor-texto-principal);
}

.resultado-card__acrescimo {
  padding: var(--esp-3) var(--esp-5);
  text-align: center;
  font-size: var(--texto-sm);
  color: var(--cor-texto-secundario);
  background-color: var(--cinza-50);
}

.resultado-card__acrescimo strong {
  color: var(--cor-texto-principal);
}

/* ============================================================
   7. CARD IMPACTO DAS PERDAS
   ============================================================ */

.card--compacto {
  box-shadow: var(--sombra-xs);
}

.impacto-linha {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--esp-2) 0;
  font-size: var(--texto-sm);
  color: var(--cor-texto-padrao);
  border-bottom: 1px dashed var(--cor-borda-suave);
}

.impacto-linha:last-child {
  border-bottom: none;
}

.impacto-linha strong {
  font-variant-numeric: tabular-nums;
  font-weight: var(--peso-semibold);
}

.impacto-linha--destaque {
  font-weight: var(--peso-semibold);
  color: var(--cor-texto-principal);
  border-bottom: 1px solid var(--cor-borda-media);
  padding-top: var(--esp-3);
}

/* ============================================================
   8. CARD MERCADO
   ============================================================ */

.mercado-faixas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--esp-2);
}

.mercado-faixa {
  padding: var(--esp-3);
  border-radius: var(--raio-md);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--esp-1);
}

.mercado-faixa--eco {
  background-color: var(--verde-suave);
  color: #1E6B3E;
}

.mercado-faixa--mercado {
  background-color: var(--azul-suave);
  color: var(--azul-marinho);
}

.mercado-faixa--premium {
  background-color: var(--ambar-suave);
  color: #8A5D0A;
}

.mercado-faixa__label {
  font-size: 10px;
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  opacity: 0.8;
}

.mercado-faixa__valor {
  font-size: var(--texto-md);
  font-weight: var(--peso-bold);
  font-variant-numeric: tabular-nums;
}

/* ============================================================
   9. DETALHAMENTO
   ============================================================ */

.resultado-detalhes {
  margin-top: var(--esp-3);
  padding: var(--esp-4) var(--esp-5);
  background-color: var(--cinza-50);
  border: 1px solid var(--cor-borda-suave);
  border-radius: var(--raio-lg);
}

.calculo-detalhado__titulo {
  font-size: var(--texto-xs);
  font-weight: var(--peso-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letra-caps);
  color: var(--cor-texto-secundario);
  margin-bottom: var(--esp-3);
}

.calculo-linha {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--esp-2) 0;
  font-size: var(--texto-sm);
  color: var(--cor-texto-padrao);
  border-bottom: 1px dashed var(--cor-borda-suave);
}

.calculo-linha:last-child {
  border-bottom: none;
}

.calculo-linha--destaque {
  font-weight: var(--peso-semibold);
  color: var(--cor-texto-principal);
  border-bottom: 1px solid var(--cor-borda-media);
  padding-top: var(--esp-3);
}

.calculo-linha span:last-child {
  font-variant-numeric: tabular-nums;
}

/* ============================================================
   10. RESPONSIVO
   ============================================================ */

@media (max-width: 1024px) {
  .precificar-layout {
    grid-template-columns: 1fr;
  }

  .precificar-resultado {
    position: static;
    order: -1;
  }
}

@media (max-width: 640px) {
  .resultado-card__grid-3 {
    grid-template-columns: 1fr;
  }

  .resultado-card__item + .resultado-card__item {
    border-left: none;
    border-top: 1px solid var(--cor-borda-suave);
  }

  .mercado-faixas {
    grid-template-columns: 1fr;
  }
}
