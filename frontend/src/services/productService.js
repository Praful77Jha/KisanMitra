import { mockRequirements, mockOffers, mockOrders } from '../data/mockData';
import { apiGet, apiPost, apiDelete } from './apiClient';
import API_BASE_URL from '../config';

const IMAGE_MAP = {
  'basmati-rice.png': require('../../assets/products/basmati-rice.png'),
  'soybean.png': require('../../assets/products/soybean.png'),
  'red-onion.png': require('../../assets/products/red-onion.png'),
  'wheat.png': require('../../assets/products/wheat.png'),
  'tur-dal.png': require('../../assets/products/tur-dal.png'),
  'kesar-mango.png': require('../../assets/products/kesar-mango.png'),
};

// Central image resolver used by every product surface (Marketplace, Home cards,
// Product Details, Compare Deals, Smart Recommendations). Do not duplicate URL
// building logic in screens.
function attachImage(product) {
  if (product.imageUrl) {
    return { ...product, image: { uri: `${API_BASE_URL}${product.imageUrl}` } };
  }
  if (product.image) return product;
  return { ...product, image: IMAGE_MAP[product.imageFile] || null };
}

function attachImages(products) {
  return products.map(attachImage);
}

// Upload a gallery-picked crop photo (base64) and return the API imageUrl path.
export async function uploadImage({ fileName, base64 }) {
  const response = await apiPost('/upload', { fileName, base64 });
  if (response.success && response.data && response.data.url) {
    return response.data.url;
  }
  throw new Error('Could not upload photo');
}

export async function fetchProducts() {
  const response = await apiGet('/products');
  if (response.success && Array.isArray(response.data)) {
    return attachImages(response.data);
  }
  throw new Error('Could not load products');
}

export async function fetchProductById(productId) {
  const response = await apiGet(`/products/${productId}`);
  if (response.success && response.data) {
    return attachImage(response.data);
  }
  throw new Error('Product not found');
}

export async function createProduct(product) {
  const response = await apiPost('/products', product);
  if (response.success && response.data) {
    return attachImage(response.data);
  }
  throw new Error('Could not post your crop for sale');
}

const offersStore = [...mockOffers];

export async function fetchOffersForProduct(productId) {
  const response = await apiGet(`/products/${productId}/offers`);
  if (response.success && Array.isArray(response.data)) {
    return response.data;
  }
  throw new Error('Could not load offers');
}

export async function createOffer(payload) {
  const response = await apiPost('/offers', payload);
  if (response.success && response.data) {
    offersStore.unshift(response.data);
    return response.data;
  }
  throw new Error('Could not submit your offer');
}

const requirementsStore = [...mockRequirements];

const ordersStore = [...mockOrders];

// Temporary constant mirroring the backend's hardcoded PLATFORM_FEE (50).
// No backend endpoint exposes this yet; keep in sync with orderService.js.
const MOCK_PLATFORM_FEE = 50;

export function getPlatformFee() {
  return MOCK_PLATFORM_FEE;
}

export async function fetchRequirements() {
  const response = await apiGet('/requirements');
  if (response.success && Array.isArray(response.data)) {
    requirementsStore.length = 0;
    requirementsStore.push(...response.data);
    return requirementsStore;
  }
  throw new Error('Could not load your requirements');
}

export async function fetchRequirementById(requirementId) {
  const response = await apiGet(`/requirements/${requirementId}`);
  if (response.success && response.data) {
    const existing = requirementsStore.find((r) => r.id === requirementId);
    if (!existing) requirementsStore.unshift(response.data);
    return response.data;
  }
  throw new Error('Requirement not found');
}

export async function addRequirement(requirement) {
  const response = await apiPost('/requirements', requirement);
  if (response.success && response.data) {
    requirementsStore.unshift(response.data);
    return response.data;
  }
  throw new Error('Could not post your requirement');
}

export async function deleteRequirement(requirementId) {
  const response = await apiDelete(`/requirements/${requirementId}`);
  if (response.success) {
    const index = requirementsStore.findIndex((r) => r.id === requirementId);
    if (index !== -1) requirementsStore.splice(index, 1);
    return response.data;
  }
  throw new Error('Could not delete the requirement');
}

export async function fetchOffersForRequirement(requirementId) {
  const response = await apiGet(`/requirements/${requirementId}/offers`);
  if (response.success && Array.isArray(response.data)) {
    return response.data;
  }
  throw new Error('Could not load offers');
}

// Active requirements a seller may respond to (does not expose the caller's own
// requirements or the owner-protected requirement routes).
export async function fetchAvailableRequirements() {
  const response = await apiGet('/requirements/available');
  if (response.success && Array.isArray(response.data)) {
    return response.data;
  }
  throw new Error('Could not load available requirements');
}

export async function fetchOrders() {
  const response = await apiGet('/orders');
  if (response.success && Array.isArray(response.data)) {
    ordersStore.length = 0;
    ordersStore.push(...response.data);
    return [...ordersStore].sort((a, b) => {
      const aTime = new Date(a.orderDate).getTime();
      const bTime = new Date(b.orderDate).getTime();
      return bTime - aTime;
    });
  }
  throw new Error('Could not load your orders');
}

export async function fetchOrderById(orderId) {
  const response = await apiGet(`/orders/${orderId}`);
  if (response.success && response.data) {
    const existing = ordersStore.find((o) => o.id === orderId);
    if (!existing) ordersStore.unshift(response.data);
    return response.data;
  }
  throw new Error('Order not found');
}

export async function createOrder({ requirementId, offerId }) {
  // Only the identifiers are needed; the server validates that the buyer owns the
  // requirement and the offer belongs to it, then derives all order fields and
  // computes the authoritative totals server-side.
  const response = await apiPost('/orders', {
    requirementId,
    offerId,
    paymentMethod: 'Bank Transfer',
  });
  if (response.success && response.data) {
    ordersStore.unshift(response.data);
    return response.data;
  }
  throw new Error('Could not place your order');
}

export async function cancelOrder(orderId) {
  const response = await apiPost(`/orders/${orderId}/cancel`);
  if (response.success && response.data) {
    const index = ordersStore.findIndex((o) => o.id === orderId);
    if (index !== -1) ordersStore[index] = response.data;
    return response.data;
  }
  throw new Error('Could not cancel your order');
}

export async function estimateLogisticsApi(input) {
  const response = await apiPost('/logistics/estimate', input);
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error('Could not estimate logistics');
}
