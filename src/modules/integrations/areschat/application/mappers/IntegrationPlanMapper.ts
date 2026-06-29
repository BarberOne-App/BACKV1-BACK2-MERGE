export const mapPlanToIntegrationDto = (plan: any) => ({
  id: plan.id,
  name: plan.name,
  displayName: plan.name,
  displayLabel: plan.name,
  active: plan.active,
  price: Number(plan.price),
  cutsPerMonth: plan.cuts_per_month,
  subtitle: plan.subtitle ?? null,
  color: plan.color ?? null,
  recommended: Boolean(plan.recommended),
  features: Array.isArray(plan.subscription_plan_features)
    ? plan.subscription_plan_features.map((item: any) => item.feature)
    : [],
  subscriptionUrl: null,
  externalPlanId: plan.pagarme_plan_id || null
});
