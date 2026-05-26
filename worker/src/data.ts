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
  'ORD-1003': {
    orderId: 'ORD-1003',
    sku: 'CHAIR-VLVT-3344',
    productName: '33" Wide Modern Velvet Upholstered 3-Legs Accent Chair (Set of 2)',
    supplier: 'Mercer41',
    carrier: 'Estes Express',
    carrierType: 'LTL',
    concealedDamageWindowDays: 5,
    proNumber: 'EST-7733411',
    bolNumber: 'BOL-9928143',
    deliveredAt: '2026-05-26T17:45:00Z',
    value: 689.0,
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
  'CHAIR-VLVT-3344': [
    { index: 0, instruction: 'Photograph the velvet seat and backrest of Chair #1.', promptLabel: 'velvet_upholstery_front', type: 'photo', detectionROI: 0.38 },
    { index: 1, instruction: 'Photograph the three legs and floor joints of Chair #1.', promptLabel: 'three_legs', type: 'photo', detectionROI: 0.26 },
    { index: 2, instruction: 'Photograph the seat cushion seam (look for fabric pulls or exposed stuffing).', promptLabel: 'cushion_seam', type: 'photo', detectionROI: 0.22 },
    { index: 3, instruction: 'Did both chairs arrive in the shipment?', type: 'yesno', detectionROI: 0.1 },
    { index: 4, instruction: 'Photograph Chair #2 (front view).', promptLabel: 'second_chair_front', type: 'photo', detectionROI: 0.18 },
    { index: 5, instruction: 'Anything else look wrong? (optional photo)', type: 'photo_optional', detectionROI: 0.08 },
  ],
};
