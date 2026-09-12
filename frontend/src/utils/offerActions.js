export function resolveOfferSelectAction(offer, ownedRequirementIds) {
  if (
    offer &&
    offer.requirementId &&
    ownedRequirementIds &&
    ownedRequirementIds.has(offer.requirementId)
  ) {
    return { type: 'confirm' };
  }
  return { type: 'notice' };
}