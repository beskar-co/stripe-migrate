import Stripe from 'stripe';

export const migrateSubscriptions = async (
  oldStripe: Stripe,
  newStripe: Stripe
) => {
  const oldSubscriptions = [];

  let startingAfter: Stripe.Subscription['id'] = '';
  let hasMoreSubscriptions: boolean = true;

  while (hasMoreSubscriptions) {
    const listParams: Stripe.SubscriptionListParams = { limit: 100 };

    if (startingAfter) {
      listParams.starting_after = startingAfter;
    }

    const response = await oldStripe.subscriptions.list(listParams);

    if (response.data.length > 0) {
      oldSubscriptions.push(...response.data);
      startingAfter = response.data[response.data.length - 1].id;
    } else {
      hasMoreSubscriptions = false;
    }
  }

  const promises = oldSubscriptions.map(async (subscription) => {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    const billing_thresholds = subscription.billing_thresholds
      ? {
          amount_gte: subscription.billing_thresholds.amount_gte ?? undefined,
          reset_billing_cycle_anchor:
            subscription.billing_thresholds.reset_billing_cycle_anchor ??
            undefined,
        }
      : undefined;

    const default_payment_method =
      typeof subscription.default_payment_method === 'string'
        ? subscription.default_payment_method
        : subscription.default_payment_method?.id;

    const default_source =
      typeof subscription.default_source === 'string'
        ? subscription.default_source
        : subscription.default_source?.id;

    const application_fee_percent =
      subscription.application_fee_percent ?? undefined;

    const default_tax_rates = subscription.default_tax_rates
      ? subscription.default_tax_rates.map((rate) => rate.id)
      : undefined;

    const items: Stripe.SubscriptionCreateParams.Item[] | undefined =
      subscription.items
        ? subscription.items.data.map((item) => ({
            billing_thresholds: item.billing_thresholds?.usage_gte
              ? {
                  usage_gte: item.billing_thresholds.usage_gte ?? undefined,
                }
              : undefined,
            metadata: item.metadata,
            plan: item.plan.id,
            price: item.price?.id,
            price_data: undefined,
            quantity: item.quantity,
            tax_rates: item.tax_rates
              ? item.tax_rates.map((rate) => rate.id)
              : undefined,
          }))
        : undefined;

    const on_behalf_of =
      typeof subscription.on_behalf_of === 'string'
        ? subscription.on_behalf_of
        : subscription.on_behalf_of?.id;

    const payment_settings:
      | Stripe.SubscriptionCreateParams.PaymentSettings
      | undefined = subscription.payment_settings
      ? {
          payment_method_options: subscription.payment_settings
            .payment_method_options
            ? {
                acss_debit: subscription.payment_settings.payment_method_options
                  .acss_debit
                  ? {
                      mandate_options: subscription.payment_settings
                        .payment_method_options.acss_debit.mandate_options
                        ? {
                            transaction_type:
                              subscription.payment_settings
                                .payment_method_options.acss_debit
                                .mandate_options.transaction_type ?? undefined,
                          }
                        : undefined,
                      verification_method:
                        subscription.payment_settings.payment_method_options
                          .acss_debit.verification_method ?? undefined,
                    }
                  : undefined,
                bancontact:
                  subscription.payment_settings.payment_method_options
                    .bancontact ?? undefined,
                card: subscription.payment_settings.payment_method_options.card
                  ? {
                      mandate_options: subscription.payment_settings
                        .payment_method_options.card.mandate_options
                        ? {
                            amount:
                              subscription.payment_settings
                                .payment_method_options.card.mandate_options
                                .amount ?? undefined,
                            amount_type:
                              subscription.payment_settings
                                .payment_method_options.card.mandate_options
                                .amount_type ?? undefined,
                            description:
                              subscription.payment_settings
                                .payment_method_options.card.mandate_options
                                .description ?? undefined,
                          }
                        : undefined,
                      network:
                        subscription.payment_settings.payment_method_options
                          .card.network ?? undefined,
                      request_three_d_secure:
                        subscription.payment_settings.payment_method_options
                          .card.request_three_d_secure ?? undefined,
                    }
                  : undefined,
                customer_balance: subscription.payment_settings
                  .payment_method_options.customer_balance
                  ? {
                      bank_transfer: subscription.payment_settings
                        .payment_method_options.customer_balance.bank_transfer
                        ? {
                            eu_bank_transfer:
                              subscription.payment_settings
                                .payment_method_options.customer_balance
                                .bank_transfer.eu_bank_transfer ?? undefined,
                            type:
                              subscription.payment_settings
                                .payment_method_options.customer_balance
                                .bank_transfer.type ?? undefined,
                          }
                        : undefined,
                      funding_type:
                        subscription.payment_settings.payment_method_options
                          .customer_balance.funding_type ?? undefined,
                    }
                  : undefined,
                konbini:
                  subscription.payment_settings.payment_method_options
                    .konbini ?? undefined,
                us_bank_account:
                  subscription.payment_settings.payment_method_options
                    .us_bank_account ?? undefined,
              }
            : undefined,
          payment_method_types:
            subscription.payment_settings.payment_method_types,
          save_default_payment_method:
            subscription.payment_settings.save_default_payment_method ??
            undefined,
        }
      : undefined;

    const transfer_data:
      | Stripe.SubscriptionCreateParams.TransferData
      | undefined = subscription.transfer_data
      ? {
          destination:
            typeof subscription.transfer_data.destination === 'string'
              ? subscription.transfer_data.destination
              : subscription.transfer_data.destination?.id,
          amount_percent:
            subscription.transfer_data.amount_percent ?? undefined,
        }
      : undefined;

    // Setting the trial_end to the created date is a workaround
    // for maintaining the same billing period:
    // https://support.stripe.com/questions/recreate-subscriptions-and-plans-after-moving-customer-data-to-a-new-stripe-account
    const trial_end = subscription.trial_end ?? subscription.created;

    const newSubscription = await newStripe.subscriptions.create({
      add_invoice_items: undefined,
      automatic_tax: subscription.automatic_tax,
      backdate_start_date: undefined,
      billing_cycle_anchor: subscription.billing_cycle_anchor,
      cancel_at_period_end: subscription.cancel_at_period_end,
      collection_method: subscription.collection_method,
      coupon: undefined,
      currency: subscription.currency,
      expand: undefined,
      metadata: subscription.metadata,
      off_session: undefined,
      payment_behavior: undefined,
      pending_invoice_item_interval: subscription.pending_invoice_item_interval,
      promotion_code: undefined,
      proration_behavior: undefined,
      trial_from_plan: undefined,
      trial_period_days: undefined,
      customer: customerId,
      application_fee_percent,
      billing_thresholds,
      cancel_at: subscription.cancel_at ?? undefined,
      days_until_due: subscription.days_until_due ?? undefined,
      default_payment_method,
      default_source,
      default_tax_rates,
      description: subscription.description ?? undefined,
      items,
      on_behalf_of,
      payment_settings,
      transfer_data,
      trial_end,
      trial_settings: subscription.trial_settings ?? undefined,
    });

    console.log(
      `Created new subscription ${newSubscription.id} for ${newSubscription.customer}`
    );
  });

  return Promise.all(promises);
};
