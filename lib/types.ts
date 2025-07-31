export interface DecisionNode {
  value: string
  level: number | string
  win?: string
  loss?: string
  final?: boolean
}

export interface PathValue {
  node: string
  value: number
  action: string
  stakeResult?: number
  timestamp: Date
  note: string
}

export interface SessionData {
  sessionId: string
  sessionName: string
  timestamp: string
  result: string
  initialAmount: number
  finalTotal: number
  sessionNotes: string
  duration: string
  isCompleted: boolean
  currentNode: string
  pathSummary: string
  sessionStartTime: Date
  lastActionTimestamp: Date
  pathValues: PathValue[]
}

export interface SessionStep {
  stepNumber: number
  nodeName: string
  action: string
  stakeValue: number
  stakeResult?: number
  stepTimestamp: Date
  note: string
}

// Trade Signal Types
export interface TradeSignal {
  action: string
  symbol: string
  timeframe: string
  time: string
  entry: string
  target: string
  stop: string
  id: string
  rr: string
  risk: string
}

export interface ProcessedTradeSignal {
  session_id: string
  trade_id: string
  symbol: string
  action: string
  entry: string
  target: string
  stop: string
  trade_amount: number
  current_node: string
  timeframe: string
  time: string
  rr: string
  risk: string
  initial_amount: number
  node_stake_percentage: string
  cost_adjustment?: {
    nominal_amount: number
    total_costs: number
    expected_net_profit: number
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

// Trading Platform Types
export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'PENDING'

export interface TradeExecution {
  trade_id: string
  session_id: string
  status: ExecutionStatus
  platform_order_id: string | null
  actual_entry_price: number | null
  actual_quantity: number | null
  executed_at: Date
  error: string | null
}

export interface TradeResult {
  trade_id: string
  session_id: string
  result: 'win' | 'loss'
  exit_price: number
  profit_loss: number
  exit_reason: 'target_reached' | 'stop_reached' | 'manual_close'
  exited_at: Date
}

// Exception Handling Types
export interface CachedSessionData {
  sessionId: string
  signal: TradeSignal
  currentNode: string
  initialAmount: number
  timestamp: number
  retryCount: number
}

export interface PartialFillResult {
  originalAmount: number
  filledAmount: number
  fillPercentage: number
  remainingAmount: number
}

export interface NodeJumpValidation {
  isValid: boolean
  expectedNode?: string
  actualNode?: string
  requiresRollback: boolean
  rollbackToNode?: string
}

export interface ExceptionHandlingConfig {
  maxRetryCount: number
  cacheTimeoutMs: number
  partialFillThreshold: number
  nodeJumpValidationEnabled: boolean
  rollbackConfirmationRequired: boolean
}

// Broker Cost Types
export interface BrokerCostConfig {
  brokerId: string
  brokerName: string
  platform: 'binance' | 'mt4' | 'mt5' | 'demo'
  commissionType: 'fixed' | 'percentage' | 'per_lot'
  commissionValue: number
  minCommission: number
  maxCommission: number
  defaultSpread: number
  maxAllowedSpread: number
  spreadMultiplier: number
  longSwapRate: number
  shortSwapRate: number
  depositFee: number
  withdrawalFee: number
  inactivityFee: number
  maxSpreadToSL: number
  costValidationEnabled: boolean
  autoAdjustSL: boolean
}

export interface RealTimeCostData {
  symbol: string
  currentSpread: number
  currentCommission: number
  spreadToSL: number
  effectiveSLDistance: number
  timestamp: Date
  isWithinLimits: boolean
  warnings: string[]
}

export interface CostCalculationResult {
  nominalAmount: number
  commission: number
  spreadCost: number
  swapCost: number
  totalCosts: number
  netAmount: number
  costBreakdown: {
    commission: number
    spreadCost: number
    swapCost: number
    otherFees: number
  }
  riskAdjustments: {
    effectiveSLDistance: number
    adjustedStake: number
    maxAllowedStake: number
  }
  validation: {
    isWithinLimits: boolean
    warnings: string[]
    errors: string[]
  }
}

export interface TradeCostRecord {
  id: number
  trade_id: string
  session_id: string
  commission: number
  spread_cost: number
  swap_cost: number
  total_costs: number
  nominal_amount: number
  adjusted_amount: number
  cost_breakdown: any
  created_at: Date
  updated_at: Date
}
