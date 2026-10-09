import pool from '../database/db.js';
import { validateTransaction, validateFinancing } from '../validators/financialValidator.js';

export class ValidationError extends Error {
  constructor(errors) {
    super(errors.join(' '));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

const toDateOnly = (value) => String(value).slice(0, 10);
const toMoney = (value) => Math.round(Number(value) * 100) / 100;

async function checkReferences({ category, paymentMethod, type }) {
  const errors = [];

  const { rows: categories } = await pool.query(
    'select tipo, ativo from public.categorias_financeiras where id = $1',
    [category]
  );
  if (!categories[0]) {
    errors.push('Categoria não encontrada.');
  } else if (!categories[0].ativo) {
    errors.push('A categoria selecionada está inativa.');
  } else if (categories[0].tipo !== type) {
    errors.push(
      `Esta categoria é de ${categories[0].tipo} e não pode ser usada em um lançamento do tipo ${type}.`
    );
  }

  const { rows: methods } = await pool.query(
    'select ativo from public.formas_pagamento where id = $1',
    [paymentMethod]
  );
  if (!methods[0]) {
    errors.push('Forma de pagamento não encontrada.');
  } else if (!methods[0].ativo) {
    errors.push('A forma de pagamento selecionada está inativa.');
  }

  if (errors.length > 0) throw new ValidationError(errors);
}

function translateDbError(err) {
  const message = String(err.message || '');
  if (err.code === '23503' || message.includes('foreign key')) {
    return new ValidationError(['Categoria, forma de pagamento, viagem ou usuário não encontrado.']);
  }
  if (err.code === '23514' || message.includes('check constraint')) {
    return new ValidationError(['Algum dado enviado não é aceito pelas regras do banco.']);
  }
  return err;
}

class FinancialService {
  async createTransaction(data, file, userId) {
    const errors = validateTransaction(data);
    if (errors.length > 0) throw new ValidationError(errors);

    await checkReferences({
      category: data.category,
      paymentMethod: data.paymentMethod,
      type: data.type,
    });

    const status = data.status || 'PENDENTE';

    try {
      const { rows } = await pool.query(
        `insert into public.lancamentos_financeiros
           (descricao, valor, tipo, status, data_vencimento, data_pagamento,
            id_categoria, id_forma_pagamento, id_usuario, id_viagem, comprovante_url)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         returning *`,
        [
          data.description.trim(),
          Number(data.amount),
          data.type,
          status,
          toDateOnly(data.dueDate),
          status === 'PAGO' ? toDateOnly(data.paymentDate) : null,
          data.category,
          data.paymentMethod,
          userId,
          data.tripId || null,
          file ? `uploads/${file.filename}` : data.proofUrl || null,
        ]
      );
      return rows[0];
    } catch (err) {
      throw translateDbError(err);
    }
  }

  async createFinancing(data, userId) {
    const errors = validateFinancing(data);
    if (errors.length > 0) throw new ValidationError(errors);

    await checkReferences({
      category: data.category,
      paymentMethod: data.paymentMethod,
      type: 'SAIDA',
    });

    try {
      const { rows } = await pool.query(
        `select public.cadastrar_financiamento_com_parcelas(
           p_descricao => $1::varchar,
           p_valor_parcela => $2::numeric,
           p_quantidade_parcelas => $3::int,
           p_vencimento_inicial => $4::date,
           p_quitacao_antecipada => $5::numeric,
           p_id_categoria => $6::uuid,
           p_id_forma_pagamento => $7::uuid,
           p_id_usuario => $8::uuid
         ) as id`,
        [
          data.description.trim(),
          Number(data.installmentAmount),
          Number(data.totalInstallments),
          toDateOnly(data.firstDueDate),
          Number(data.payoffAmount),
          data.category,
          data.paymentMethod,
          userId,
        ]
      );
      const financingId = rows[0].id;

      const { rows: financings } = await pool.query(
        'select * from public.financiamentos where id = $1',
        [financingId]
      );
      const { rows: installments } = await pool.query(
        `select * from public.lancamentos_financeiros
         where id_financiamento = $1
         order by numero_parcela`,
        [financingId]
      );

      return {
        message: 'Financiamento e parcelas gerados com sucesso.',
        financingId,
        totalInstallments: Number(data.totalInstallments),
        payoffAmount: Number(data.payoffAmount),
        financing: financings[0],
        installments,
      };
    } catch (err) {
      throw translateDbError(err);
    }
  }

  async getSummary() {
    const { rows: balanceRows } = await pool.query(
      `select coalesce(sum(case when tipo = 'ENTRADA' then valor else -valor end), 0) as saldo
       from public.lancamentos_financeiros
       where status = 'PAGO'`
    );

    const { rows: monthRows } = await pool.query(
      `select to_char(data_vencimento, 'YYYY-MM') as month,
              coalesce(sum(case when tipo = 'ENTRADA' then valor else 0 end), 0) as entradas,
              coalesce(sum(case when tipo = 'SAIDA' then valor else 0 end), 0) as saidas
       from public.lancamentos_financeiros
       where status = 'PENDENTE'
       group by 1
       order by 1`
    );

    const currentBalance = toMoney(balanceRows[0].saldo);
    let running = currentBalance;

    const projection = monthRows.map((row) => {
      const expectedIncome = toMoney(row.entradas);
      const expectedExpense = toMoney(row.saidas);
      const projectedChange = toMoney(expectedIncome - expectedExpense);
      running = toMoney(running + projectedChange);
      return {
        month: row.month,
        expectedIncome,
        expectedExpense,
        projectedChange,
        estimatedEndingBalance: running,
      };
    });

    return { currentBalance, projection };
  }
}

export default new FinancialService();