import { z } from 'zod';

export const OrderSchema = z.object({
  orderId: z.string(),
  sku: z.string(),
  productName: z.string(),
  supplier: z.string(),
  carrier: z.string(),
  carrierType: z.enum(['LTL', 'WDN_FULL_SERVICE', 'PARCEL']),
  concealedDamageWindowDays: z.number(),
  proNumber: z.string(),
  bolNumber: z.string(),
  deliveredAt: z.string(),
  value: z.number(),
});
export type Order = z.infer<typeof OrderSchema>;

export const InspectionStepSchema = z.object({
  index: z.number(),
  instruction: z.string(),
  promptLabel: z.string().optional(),
  type: z.enum(['photo', 'photo_optional', 'yesno']),
  detectionROI: z.number().optional(),
});
export type InspectionStep = z.infer<typeof InspectionStepSchema>;

export const VisionResultSchema = z.object({
  validation: z.object({ matchesPrompt: z.boolean(), confidence: z.number() }),
  damage: z.object({
    detected: z.boolean(),
    severity: z.enum(['none', 'minor', 'moderate', 'severe']).default('none'),
    location: z.string().default(''),
    description: z.string().default(''),
    boundingBox: z.array(z.number()).nullable().optional(),
  }),
});
export type VisionResult = z.infer<typeof VisionResultSchema>;

export const SessionResultSchema = z.object({
  stepIndex: z.number(),
  photoKey: z.string().optional(),
  vision: VisionResultSchema.optional(),
  answer: z.string().optional(),
});
export type SessionResult = z.infer<typeof SessionResultSchema>;

export const SessionStateSchema = z.object({
  sessionId: z.string(),
  order: OrderSchema,
  steps: z.array(InspectionStepSchema),
  results: z.array(SessionResultSchema),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  claim: z.any().optional(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export type AgentEventType =
  | 'session_started'
  | 'step_advanced'
  | 'photo_uploaded'
  | 'vision_called'
  | 'damage_detected'
  | 'claim_drafted'
  | 'session_completed';

export type AgentEvent = {
  ts: string;
  sessionId: string;
  type: AgentEventType;
  payload: any;
};

export type Bindings = {
  SESSIONS: KVNamespace;
  PHOTOS?: R2Bucket;
  BASETEN_LLM_ENDPOINT_URL?: string;
  BASETEN_LLM_API_KEY?: string;
  SUBCONSCIOUS_VISION_URL?: string;
  SUBCONSCIOUS_VISION_API_KEY?: string;
  SUBCONSCIOUS_VISION_MODEL?: string;
  MOCK_VISION?: string;
};
