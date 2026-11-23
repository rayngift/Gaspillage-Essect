/**
 * CampusSave ESSECT — Firestore Security Rules Verification Spec
 * Documents the 12 Dirty Dozen adversarial test cases against firestore.rules.
 */

export interface SecurityTestCase {
  id: string;
  title: string;
  actor: 'anonymous' | 'student' | 'merchant' | 'spoofed_admin';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    title: 'Unauthenticated Offer List',
    actor: 'anonymous',
    operation: 'list',
    path: '/offers',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    title: 'Unauthenticated Shop Read',
    actor: 'anonymous',
    operation: 'get',
    path: '/shops/buvette_essect',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    title: 'Self-Assigned Admin Role on User Create',
    actor: 'student',
    operation: 'create',
    path: '/users/student_1',
    payload: { uid: 'student_1', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    title: 'Role Escalation on User Update',
    actor: 'student',
    operation: 'update',
    path: '/users/student_1',
    payload: { role: 'merchant' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    title: 'Cross-User PII Read',
    actor: 'student',
    operation: 'get',
    path: '/users/student_2',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    title: 'Shadow Ghost Field on Offer Create',
    actor: 'merchant',
    operation: 'create',
    path: '/offers/offer_1',
    payload: { isFeatured: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    title: 'Unverified Email Admin Spoof',
    actor: 'spoofed_admin',
    operation: 'update',
    path: '/shops/shop_1',
    payload: { status: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    title: 'Merchant Self-Approving Shop',
    actor: 'merchant',
    operation: 'create',
    path: '/shops/shop_new',
    payload: { status: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    title: 'Orphan Offer Referencing Missing Shop',
    actor: 'merchant',
    operation: 'create',
    path: '/offers/orphan_1',
    payload: { shopId: 'non_existent_shop' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    title: 'Order Creation Without Atomic Stock Decrement',
    actor: 'student',
    operation: 'create',
    path: '/orders/order_1',
    payload: { offerId: 'offer_1', quantity: 2, status: 'paid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    title: 'Student Self-Validating Pickup Status',
    actor: 'student',
    operation: 'update',
    path: '/orders/order_1',
    payload: { status: 'picked_up' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    title: 'Resource ID Poisoning (>128 chars)',
    actor: 'student',
    operation: 'create',
    path: `/orders/${'a'.repeat(200)}`,
    expected: 'PERMISSION_DENIED',
  },
];
