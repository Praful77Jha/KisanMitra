// Quote comparison helpers. Purely presentational: the requester chooses the
// offer to accept, the backend performs the authoritative accept/reject flow.

export function rankTransportQuotes(quotes) {
  const list = (quotes || []).slice();
  const submitted = list.filter((q) => q.status === 'SUBMITTED');
  const lowest =
    submitted.length > 0
      ? Math.min(...submitted.map((q) => Number(q.quotedAmount)))
      : null;

  const sorted = list.slice().sort((a, b) => {
    const aSubmitted = a.status === 'SUBMITTED' ? 0 : 1;
    const bSubmitted = b.status === 'SUBMITTED' ? 0 : 1;
    if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted;
    return Number(a.quotedAmount) - Number(b.quotedAmount);
  });

  return sorted.map((quote) => ({
    ...quote,
    isBest:
      quote.status === 'SUBMITTED' &&
      lowest !== null &&
      Number(quote.quotedAmount) === lowest,
  }));
}