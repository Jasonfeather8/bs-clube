DO $$
BEGIN
  -- 1) Libera os gatilhos de imutabilidade apenas durante a limpeza
  ALTER TABLE public.purchased_bets DISABLE TRIGGER purchased_bets_immutable;
  ALTER TABLE public.bet_audit_ledger DISABLE TRIGGER bet_audit_ledger_immutable;

  -- 2) Exclui os dados demonstrativos na ordem exigida pelas chaves estrangeiras
  DELETE FROM public.prize_awards;
  DELETE FROM public.prize_settlements;
  DELETE FROM public.bet_audit_ledger;
  DELETE FROM public.purchased_bets;
  DELETE FROM public.payments;
  DELETE FROM public.withdrawals;
  DELETE FROM public.wallet_ledger;
  DELETE FROM public.pools;
  DELETE FROM public.draws;
  DELETE FROM public.pool_categories;
  DELETE FROM public.quota_catalog;
  DELETE FROM public.payment_webhook_events;

  -- 3) Zera os saldos das carteiras mantendo as contas dos usuários
  UPDATE public.wallet_accounts SET total = 0, withdrawable = 0, bonus = 0;

  -- 4) Restaura a configuração global de percentuais (25% casa / 75% ganhadores)
  UPDATE public.app_settings
     SET house_percentage = 25, winner_percentage = 75, updated_by = NULL, updated_at = now()
   WHERE id = 'global';

  -- 5) Reativa os gatilhos de imutabilidade
  ALTER TABLE public.purchased_bets ENABLE TRIGGER purchased_bets_immutable;
  ALTER TABLE public.bet_audit_ledger ENABLE TRIGGER bet_audit_ledger_immutable;
END $$