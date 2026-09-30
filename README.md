# PraFicar ERP

> **"Feito pra lembrar, feito pra ficar."**

ERP profissional para pequenos negócios que trabalham com produtos
personalizados, artesanais, presentes, lembranças, papelaria, kits e
produtos sob encomenda.

---

## Filosofia do projeto

**Complexidade por trás. Simplicidade para quem usa.**

- ERP Enterprise por dentro (banco real, RLS, auditoria, backup).
- Simples, bonito e intuitivo por fora.
- O usuário vê apenas o essencial: **custo, preço, lucro, margem**.
- Cálculos complexos acontecem automaticamente nos bastidores.

---

## Escopo desta versão

### Dentro do escopo
- Cadastro de insumos e produtos
- Precificação inteligente (insumo + perdas + mão de obra + energia + embalagem)
- **Preço por canal de venda** (Instagram, Shopee, Mercado Livre, site, WhatsApp, físico)
- **Taxas de plataforma** (percentual + fixa)
- **Frete** por canal (vendedor / cliente / dividido)
- Estoque com reserva, baixa, ajuste e histórico
- Encomendas com fluxo de status e aprovação de arte
- Vendas com lucro líquido real por canal
- **Financeiro simples** (contas a receber, contas a pagar, fluxo de caixa)
- Clientes e fornecedores
- Relatórios e dashboard executivo
- QR Code estático e dinâmico
- Auditoria por usuário
- Backup e exportação
- Controle de acesso **por módulo** e por ação sensível

### Fora do escopo (nesta versão)
- Emissão fiscal (NF-e, NFC-e, SAT, MEI)
- Multi-tenant / multiempresa
- Múltiplos depósitos
- CRM completo
- Automação de marketing

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JavaScript (SPA leve) |
| Banco de dados | Supabase PostgreSQL |
| Autenticação | Supabase Auth |
| Segurança | Row Level Security (RLS) |
| Hospedagem | Vercel |
| Versionamento | GitHub |

> O frontend começa em HTML/CSS/JS puro para entrega rápida.
> A migração para Next.js + TypeScript está prevista para quando
> a integração com Supabase for iniciada.

---

## Estrutura de pastas
ERP-PraFicar/
├── index.html
├── assets/
│ ├── css/
│ │ ├── variables.css
│ │ ├── base.css
│ │ ├── layout.css
│ │ └── components.css
│ ├── js/
│ │ ├── app.js
│ │ └── router.js
│ └── img/
│ └── logo.png
└── README.md

---

## Paleta de cores

Extraída da logo oficial. **Não alterar, deformar ou redesenhar a logo.**

```css
--azul-marinho:   #1B3A5C;
--azul-medio:     #2E6FA8;
--azul-claro:     #A8C8E4;
--branco:         #FFFFFF;
--cinza-tag:      #F0F2F5;

--verde:          #2E9E5B;
--ambar:          #E8A72B;
--vermelho:       #D93A3A;

--cinza-100:      #F7F9FC;
--cinza-200:      #E8EDF3;
--cinza-400:      #9AA7B8;
--cinza-700:      #445060;
--cinza-900:      #1F2733;
