import type { Order, InspectionStep } from './types';

export const ORDERS: Record<string, Order> = {
  'ORD-1001': {
    orderId: 'ORD-1001',
    sku: 'SECT-9381',
    productName: 'Hartley 4-Piece Sectional',
    supplier: 'Mistana',
    carrier: 'Estes Express',
    carrierType: 'LTL',
    concealedDamageWindowDays: 5,
    proNumber: 'EST-7733410',
    bolNumber: 'BOL-9928141',
    deliveredAt: '2026-05-26T17:45:00Z',
    value: 1849.0,
  },
  'ORD-1002': {
    orderId: 'ORD-1002',
    sku: 'CONSOLE-2244',
    productName: 'Westbrook Console Table',
    supplier: 'Three Posts',
    carrier: 'Wayfair Delivery Network',
    carrierType: 'WDN_FULL_SERVICE',
    concealedDamageWindowDays: 3,
    proNumber: 'WDN-1198223',
    bolNumber: 'BOL-9928142',
    deliveredAt: '2026-05-26T17:45:00Z',
    value: 429.0,
  },
};

export const SCRIPTS: Record<string, InspectionStep[]> = {
  'SECT-9381': [
    { index: 0, instruction: 'Photograph the back-right corner.', promptLabel: 'back_right_corner', type: 'photo', detectionROI: 0.34 },
    { index: 1, instruction: 'Photograph the cushion seam where chaise meets sofa.', promptLabel: 'cushion_seam', type: 'photo', detectionROI: 0.28 },
    { index: 2, instruction: 'Slide the third drawer in and out. Did it stick?', type: 'yesno', detectionROI: 0.12 },
    { index: 3, instruction: 'Photograph the front-left leg.', promptLabel: 'front_left_leg', type: 'photo', detectionROI: 0.18 },
    { index: 4, instruction: 'Anything else look wrong? (optional photo)', type: 'photo_optional', detectionROI: 0.08 },
  ],
  'CONSOLE-2244': [
    { index: 0, instruction: 'Photograph the tabletop edge.', promptLabel: 'tabletop_edge', type: 'photo', detectionROI: 0.42 },
    { index: 1, instruction: 'Photograph the leg joint underneath.', promptLabel: 'leg_joint', type: 'photo', detectionROI: 0.31 },
    { index: 2, instruction: 'Does the drawer slide smoothly?', type: 'yesno', detectionROI: 0.15 },
    { index: 3, instruction: 'Photograph the back panel.', promptLabel: 'back_panel', type: 'photo', detectionROI: 0.12 },
  ],
};
