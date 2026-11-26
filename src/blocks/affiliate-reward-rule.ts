import type { AffiliateRewardRule } from '@/config/affiliates';
import { m } from '@/paraglide/messages.js';

/**
 * The affiliate reward rule in words, shared by the public /affiliates page
 * and the affiliate dashboard. `commissionPercent` overrides the rule's
 * percent (an affiliate's own rate).
 */

/** The reward, short: "20%". */
export function rewardHeadline(
  rule: AffiliateRewardRule,
  commissionPercent?: number
) {
  return `${commissionPercent ?? rule.percent}%`;
}

/** Which payments earn: the first, the first N, or every one. */
export function rewardScopeText(rule: AffiliateRewardRule) {
  if (rule.scope === 'all') return m['affiliates.rule.scope_all']();
  if (rule.scope === 'first_n')
    return m['affiliates.rule.scope_first_n']({ count: rule.payments });
  return m['affiliates.rule.scope_first']();
}

/** One line under the scope: what happens to renewals and later payments. */
export function rewardScopeNote(rule: AffiliateRewardRule) {
  if (rule.scope === 'all')
    return m['landing.affiliates.earn_scope_note_all']();
  if (rule.scope === 'first_n')
    return m['landing.affiliates.earn_scope_note_first_n']();
  return m['landing.affiliates.earn_scope_note']();
}

/** The "do renewals earn?" answer for the rule. */
export function rewardRenewalsAnswer(rule: AffiliateRewardRule | null) {
  if (rule?.scope === 'all')
    return m['landing.affiliates.faq_renewals_a_all']();
  if (rule?.scope === 'first_n')
    return m['landing.affiliates.faq_renewals_a_first_n']({
      count: rule.payments,
    });
  return m['landing.affiliates.faq_renewals_a']();
}

/** The whole rule in a sentence: "20% of the payment, first payment only". */
export function rewardSummary(
  rule: AffiliateRewardRule,
  commissionPercent?: number
) {
  return m['affiliates.rule.summary']({
    amount: m['affiliates.rule.amount_percent']({
      percent: commissionPercent ?? rule.percent,
    }),
    scope: rewardScopeText(rule),
  });
}
