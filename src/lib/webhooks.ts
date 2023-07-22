import chalk from 'chalk';
import Stripe from 'stripe';

const fetchWebhooks = async (stripe: Stripe) => {
  const webhookEndpoints = [];

  let startingAfter: Stripe.Product['id'] = '';
  let hasMoreWebhooks: boolean = true;

  while (hasMoreWebhooks) {
    const listParams: Stripe.ProductListParams = { limit: 100 };

    if (startingAfter) {
      listParams.starting_after = startingAfter;
    }

    const response = await stripe.webhookEndpoints.list(listParams);

    if (response.data.length > 0) {
      webhookEndpoints.push(...response.data);
      startingAfter = response.data[response.data.length - 1].id;
    } else {
      hasMoreWebhooks = false;
    }
  }

  return webhookEndpoints;
};

export const migrateWebhooks = async (oldStripe: Stripe, newStripe: Stripe) => {
  const oldWebhooks = await fetchWebhooks(oldStripe);
  const newWebhooks = await fetchWebhooks(newStripe);

  const promises = oldWebhooks.map(async (webhook) => {
    if (
      newWebhooks.find(
        (newWebhook) =>
          newWebhook.url === webhook.url &&
          newWebhook.enabled_events.every((event) =>
            webhook.enabled_events.includes(event)
          )
      )
    ) {
      console.log(
        chalk.blue(
          `Webhook for ${webhook.url} with ${webhook.enabled_events.length} enabled events already exists, skipping...`
        )
      );
      return;
    }

    const newWebhook = await newStripe.webhookEndpoints.create({
      url: webhook.url,
      connect: undefined,
      expand: undefined,
      metadata: webhook.metadata,
      enabled_events: webhook.enabled_events.map(
        (event) => event
      ) as Stripe.WebhookEndpointCreateParams['enabled_events'],
      api_version: webhook.api_version
        ? (webhook.api_version as Stripe.WebhookEndpointCreateParams['api_version'])
        : undefined,
      description: webhook.description ?? undefined,
    });

    console.log(`Created new webhook ${newWebhook.id} (${newWebhook.url})`);

    return newWebhook;
  });

  return Promise.all(promises);
};
