import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { apiPost } from '@/lib/api-client';
import { getLocale } from '@/paraglide/runtime.js';
import { usePublicConfig } from '@/hooks/use-public-config';
import type { PaymentProvider } from '@/components/payment-provider-modal';

const ALL_PROVIDERS: PaymentProvider[] = [
  'stripe',
  'creem',
  'paypal',
  'alipay',
  'wechat',
];

/**
 * Pay for a directory premium listing or sponsor ad (same picker pattern as
 * guest posts). `resolveId` may create the pending_payment row first.
 */
export function useDirectoryCheckout(opts: {
  kind: 'tool' | 'ad';
  resolveId: () => Promise<string>;
  onError?: (error: Error) => void;
}) {
  const configQuery = usePublicConfig();
  const configs = configQuery.data ?? {};
  const providers = ALL_PROVIDERS.filter(
    (p) => configs[`${p}_enabled`] === 'true'
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [payingWith, setPayingWith] = useState<PaymentProvider | null>(null);

  const checkout = useMutation({
    mutationFn: async (provider: PaymentProvider) => {
      const id = await opts.resolveId();
      const path =
        opts.kind === 'tool'
          ? `/api/directory/tools/${id}/checkout`
          : `/api/directory/ads/${id}/checkout`;
      return apiPost<{ checkout_url?: string }>(path, {
        payment_provider: provider,
        locale: getLocale(),
      });
    },
    onSuccess: (data) => {
      if (data?.checkout_url) window.location.href = data.checkout_url;
      else setPayingWith(null);
    },
    onError: (error: Error) => {
      setPayingWith(null);
      opts.onError?.(error);
    },
  });

  function startPay(provider: PaymentProvider) {
    setPayingWith(provider);
    checkout.mutate(provider);
  }

  function pay() {
    if (configs.select_payment_enabled === 'true' && providers.length > 1) {
      setPickerOpen(true);
      return;
    }
    startPay(
      (configs.default_payment_provider ||
        providers[0] ||
        'stripe') as PaymentProvider
    );
  }

  return {
    pay,
    pending: checkout.isPending,
    pickerProps: {
      open: pickerOpen,
      onOpenChange: (open: boolean) => {
        setPickerOpen(open);
        if (!open) setPayingWith(null);
      },
      providers: providers.length
        ? providers
        : (['stripe'] as PaymentProvider[]),
      loadingProvider: payingWith,
      onSelect: startPay,
    },
  };
}
