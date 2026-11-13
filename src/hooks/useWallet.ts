import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { walletService } from '../services/walletService';
import { WalletBalance, WalletTransactionFilter } from '../types';

export const WALLET_BALANCE_KEY = ['wallet', 'balance'];
export const TRANSACTIONS_KEY = ['wallet', 'transactions'];

let lastReconciliationAt = 0;
let reconciliationInFlight: Promise<WalletBalance> | null = null;

export function useWalletBalance(options: { refetchInterval?: number | false } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...WALLET_BALANCE_KEY, user?.id ?? 'guest'],
    queryFn: () => walletService.getBalance(),
    enabled: Boolean(user),
    staleTime: 1000 * 60,
    refetchInterval: options.refetchInterval,
  });
}

export function useWalletTransactions({ pageSize = 10, filter = 'all' }: { pageSize?: number; filter?: WalletTransactionFilter } = {}) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState(filter);
  const queryPage = activeFilter === filter ? page : 1;

  useEffect(() => {
    if (activeFilter !== filter) {
      setActiveFilter(filter);
      setPage(1);
    }
  }, [activeFilter, filter]);

  const query = useQuery({
    queryKey: [...TRANSACTIONS_KEY, user?.id ?? 'guest', filter, queryPage, pageSize],
    queryFn: () => walletService.getPage(queryPage, pageSize, filter),
    enabled: Boolean(user),
    staleTime: 1000 * 60,
  });

  return { ...query, page: queryPage, pageSize, filter, setPage };
}

export function useDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => walletService.createDeposit(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WALLET_BALANCE_KEY });
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    },
  });
}

export function useReconcileDeposits() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => walletService.reconcileDeposits(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WALLET_BALANCE_KEY });
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'deposit-status'] });
    },
  });

  const reconcileDeposits = useCallback(() => {
    if (reconciliationInFlight) return reconciliationInFlight;
    if (Date.now() - lastReconciliationAt < 20_000) return Promise.resolve(undefined);

    lastReconciliationAt = Date.now();
    reconciliationInFlight = mutation.mutateAsync().finally(() => {
      reconciliationInFlight = null;
    });
    return reconciliationInFlight;
  }, [mutation.mutateAsync]);

  return { reconcileDeposits, isPending: mutation.isPending };
}

export function useDepositStatus(paymentId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['wallet', 'deposit-status', user?.id ?? 'guest', paymentId],
    queryFn: () => walletService.getDepositStatus(paymentId!),
    enabled: Boolean(user && paymentId),
    refetchInterval: (currentQuery) => currentQuery.state.data?.status === 'pending' ? 4000 : false,
  });

  useEffect(() => {
    if (query.data?.status === 'confirmed') {
      queryClient.invalidateQueries({ queryKey: WALLET_BALANCE_KEY });
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    }
  }, [query.data?.status, queryClient]);

  return query;
}

export function useWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, pixKeyType, pixKey }: { amount: number; pixKeyType: string; pixKey: string }) =>
      walletService.createWithdrawal(amount, pixKeyType, pixKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WALLET_BALANCE_KEY });
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    },
  });
}
