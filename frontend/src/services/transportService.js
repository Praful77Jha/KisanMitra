// Transport module API wrappers. All endpoints are authenticated; the backend
// resolves the current user and enforces role rules, so the client never sends
// a userId. Errors bubble up as Error objects with the backend's message.

import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './apiClient';

function unwrap(response, fallback) {
  if (!response || response.success !== true) {
    throw new Error((response && response.message) || fallback);
  }
  return response.data;
}

// ---- Transporter profile ----

export async function createTransporterProfile(payload) {
  const response = await apiPost('/transporter/profile', payload);
  return unwrap(response, 'Could not create transporter profile');
}

export async function getMyTransporterProfile() {
  const response = await apiGet('/transporter/profile/me');
  return unwrap(response, 'Could not load transporter profile');
}

export async function updateMyTransporterProfile(payload) {
  const response = await apiPatch('/transporter/profile/me', payload);
  return unwrap(response, 'Could not update transporter profile');
}

// ---- Transport requests ----

export async function createTransportRequest(payload) {
  const response = await apiPost('/transport-requests', payload);
  return unwrap(response, 'Could not create transport request');
}

// FARMER/BUYER: their own requests. TRANSPORTER: the requests relevant to them.
export async function getMyTransportRequests() {
  const response = await apiGet('/transport-requests');
  return unwrap(response, 'Could not load transport requests') ?? [];
}

// TRANSPORTER only: currently OPEN requests available to quote on.
export async function getAvailableTransportRequests() {
  const response = await apiGet('/transport-requests/available');
  return unwrap(response, 'Could not load transport requests') ?? [];
}

export async function getTransportRequest(id) {
  const response = await apiGet(`/transport-requests/${id}`);
  return unwrap(response, 'Could not load transport request');
}

export async function deleteTransportRequest(id) {
  const response = await apiDelete(`/transport-requests/${id}`);
  return unwrap(response, 'Could not delete transport request');
}

// ---- Transport quotes ----

export async function createTransportQuote(requestId, payload) {
  const response = await apiPost(`/transport-requests/${requestId}/quotes`, payload);
  return unwrap(response, 'Could not send transport offer');
}

// Requester only — quote comparison for the request owner.
export async function getTransportQuotes(requestId) {
  const response = await apiGet(`/transport-requests/${requestId}/quotes`);
  return unwrap(response, 'Could not load transport offers') ?? [];
}

// Accepting creates the transport job atomically. Returns { quote, job, request }.
export async function acceptTransportQuote(quoteId) {
  const response = await apiPut(`/transport-quotes/${quoteId}/accept`);
  return unwrap(response, 'Could not accept transport offer');
}

export async function rejectTransportQuote(quoteId) {
  const response = await apiPut(`/transport-quotes/${quoteId}/reject`);
  return unwrap(response, 'Could not reject transport offer');
}

export async function createCounterOffer(offerId, { quotedAmount, notes }) {
  const response = await apiPost(`/transport-quotes/${offerId}/counter`, {
    quotedAmount,
    notes: notes === undefined ? undefined : String(notes).trim() || null,
  });
  return unwrap(response, 'Could not send your counter offer');
}

export async function getNegotiationHistory(offerId) {
  const response = await apiGet(`/transport-quotes/${offerId}/history`);
  return unwrap(response, 'Could not load the negotiation history') ?? [];
}

// ---- Transport jobs ----

// Assigned transporter or requester scope, per the backend endpoint.
export async function getTransportJobs() {
  const response = await apiGet('/transport-jobs');
  return unwrap(response, 'Could not load transport jobs') ?? [];
}

// Terminal jobs only (DELIVERED/CANCELLED).
export async function getTransportJobHistory() {
  const response = await apiGet('/transport-jobs/history');
  return unwrap(response, 'Could not load transport jobs') ?? [];
}

export async function getTransportJob(id) {
  const response = await apiGet(`/transport-jobs/${id}`);
  return unwrap(response, 'Could not load transport job');
}

// Assigned transporter only; the backend validates the transition.
export async function updateTransportJobStatus(jobId, status) {
  const response = await apiPut(`/transport-jobs/${jobId}/status`, { status });
  return unwrap(response, 'Could not update the job status');
}

// ---- Transport reviews ----

// Requester of a DELIVERED job only. Rating is an integer 1-5.
export async function createTransportReview(jobId, { rating, comment }) {
  const response = await apiPost(`/transport-jobs/${jobId}/review`, {
    rating,
    comment: comment === undefined ? undefined : String(comment).trim() || null,
  });
  return unwrap(response, 'Could not submit your rating');
}

// Public ratings for a transporter. Returns { average, count, reviews }.
export async function getTransporterReviews(transporterId) {
  const response = await apiGet(`/transporters/${transporterId}/reviews`);
  return unwrap(response, 'Could not load transporter ratings');
}