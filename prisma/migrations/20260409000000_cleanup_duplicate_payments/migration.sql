-- Limpar pagamentos duplicados: manter apenas UM por (appointment_id, barbershop_id)
-- Estratégia: Priorizar status='paid', depois manter o mais recente

WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY appointment_id, barbershop_id 
      ORDER BY 
        CASE WHEN status = 'paid' THEN 0 ELSE 1 END,  -- pagos primeiro
        created_at DESC                                 -- depois mais recentes
    ) as rn
  FROM payment_transactions
  WHERE appointment_id IS NOT NULL
)
DELETE FROM payment_transactions
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Adicionar constraint UNIQUE para garantir apenas 1 pagamento por agendamento
ALTER TABLE payment_transactions 
ADD CONSTRAINT uk_payments_appointment_barbershop UNIQUE (appointment_id, barbershop_id);
