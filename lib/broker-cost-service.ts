import { sql } from "./db"
import { alertService } from "./alert-service"
import { exceptionHandler } from "./exception-handler"

// Broker cost configuration interface
export interface BrokerCostConfig {
  brokerId: string
  brokerName: string
  platform: 'binance' | 'mt4' | 'mt5' | 'demo'
  
  // Commission structure
  commissionType: 'fixed' | 'percentage' | 'per_lot'
  commissionValue: number // Fixed amount, percentage, or per lot
  minCommission: number
  maxCommission: number
  
  // Spread configuration
  defaultSpread: number // in pips
  maxAllowedSpread: number // maximum spread before trade rejection
  spreadMultiplier: number // multiplier for spread during high volatility
  
  // Swap/rollover fees
  longSwapRate: number // per lot per day
  shortSwapRate: number // per lot per day
  
  // Other fees
  depositFee: number
  withdrawalFee: number
  inactivityFee: number
  
  // Risk management
  maxSpreadToSL: number // maximum spread impact on stop loss
  costValidationEnabled: boolean
  autoAdjustSL: boolean
}

// Real-time cost data
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

// Cost calculation result
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

// Default broker configurations
const defaultBrokerConfigs: Record<string, BrokerCostConfig> = {
  demo: {
    brokerId: 'demo',
    brokerName: 'Demo Account',
    platform: 'demo',
    commissionType: 'fixed',
    commissionValue: 5, // $5 per trade
    minCommission: 5,
    maxCommission: 5,
    defaultSpread: 3, // 3 pips
    maxAllowedSpread: 10, // 10 pips
    spreadMultiplier: 1.5,
    longSwapRate: 0,
    shortSwapRate: 0,
    depositFee: 0,
    withdrawalFee: 0,
    inactivityFee: 0,
    maxSpreadToSL: 5, // 5 pips
    costValidationEnabled: true,
    autoAdjustSL: true
  },
  binance: {
    brokerId: 'binance',
    brokerName: 'Binance',
    platform: 'binance',
    commissionType: 'percentage',
    commissionValue: 0.1, // 0.1%
    minCommission: 1, // $1 minimum
    maxCommission: 1000, // $1000 maximum
    defaultSpread: 2, // 2 pips
    maxAllowedSpread: 8, // 8 pips
    spreadMultiplier: 2.0,
    longSwapRate: -0.01, // -0.01% per day
    shortSwapRate: 0.01, // 0.01% per day
    depositFee: 0,
    withdrawalFee: 0.0005, // 0.05%
    inactivityFee: 0,
    maxSpreadToSL: 3, // 3 pips
    costValidationEnabled: true,
    autoAdjustSL: true
  },
  mt5: {
    brokerId: 'mt5',
    brokerName: 'MetaTrader 5',
    platform: 'mt5',
    commissionType: 'per_lot',
    commissionValue: 7, // $7 per lot
    minCommission: 7,
    maxCommission: 700,
    defaultSpread: 5, // 5 pips
    maxAllowedSpread: 15, // 15 pips
    spreadMultiplier: 1.8,
    longSwapRate: -0.02, // -0.02% per day
    shortSwapRate: 0.02, // 0.02% per day
    depositFee: 0,
    withdrawalFee: 0.001, // 0.1%
    inactivityFee: 10, // $10 per month
    maxSpreadToSL: 8, // 8 pips
    costValidationEnabled: true,
    autoAdjustSL: true
  }
}

export class BrokerCostService {
  private config: BrokerCostConfig
  private costCache: Map<string, RealTimeCostData> = new Map()
  private readonly CACHE_DURATION = 30 * 1000 // 30 seconds

  constructor(brokerId: string = 'demo') {
    this.config = defaultBrokerConfigs[brokerId] || defaultBrokerConfigs.demo
  }

  /**
   * Get real-time cost data for a symbol
   */
  async getRealTimeCostData(symbol: string): Promise<RealTimeCostData> {
    try {
      // Check cache first
      const cached = this.costCache.get(symbol)
      if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_DURATION) {
        return cached
      }

      console.log(`Fetching real-time cost data for ${symbol}...`)

      // Fetch real-time data from trading platform
      const currentSpread = await this.getCurrentSpread(symbol)
      const currentCommission = await this.getCurrentCommission(symbol)
      const spreadToSL = await this.calculateSpreadToSL(symbol)

      const costData: RealTimeCostData = {
        symbol,
        currentSpread,
        currentCommission,
        spreadToSL,
        effectiveSLDistance: spreadToSL,
        timestamp: new Date(),
        isWithinLimits: currentSpread <= this.config.maxAllowedSpread,
        warnings: []
      }

      // Add warnings for high costs
      if (currentSpread > this.config.defaultSpread * 1.5) {
        costData.warnings.push(`High spread detected: ${currentSpread} pips`)
      }

      if (spreadToSL > this.config.maxSpreadToSL) {
        costData.warnings.push(`Spread to SL exceeds limit: ${spreadToSL} pips`)
      }

      // Cache the data
      this.costCache.set(symbol, costData)

      return costData

    } catch (error) {
      console.error(`Error fetching real-time cost data for ${symbol}:`, error)
      
      // Return default data on error
      return {
        symbol,
        currentSpread: this.config.defaultSpread,
        currentCommission: this.config.commissionValue,
        spreadToSL: this.config.defaultSpread,
        effectiveSLDistance: this.config.defaultSpread,
        timestamp: new Date(),
        isWithinLimits: true,
        warnings: ['Using default cost data due to API error']
      }
    }
  }

  /**
   * Calculate trade costs and adjust stake for target net profit
   */
  async calculateTradeCosts(
    symbol: string,
    nominalAmount: number,
    entryPrice: number,
    targetPrice: number,
    stopPrice: number,
    targetNetProfit: number
  ): Promise<CostCalculationResult> {
    try {
      console.log(`Calculating trade costs for ${symbol} with target net profit: $${targetNetProfit}`)

      // Get real-time cost data
      const costData = await this.getRealTimeCostData(symbol)

      // Calculate costs for nominal amount
      const commission = this.calculateCommission(nominalAmount, entryPrice)
      const spreadCost = this.calculateSpreadCost(nominalAmount, costData.currentSpread, entryPrice)
      const swapCost = this.calculateSwapCost(nominalAmount, entryPrice, 1) // 1 day holding

      const totalCosts = commission + spreadCost + swapCost

      // Calculate required gross profit to achieve target net profit
      const requiredGrossProfit = targetNetProfit + totalCosts

      // Calculate required stake to achieve target net profit
      const priceDifference = Math.abs(targetPrice - entryPrice)
      const requiredStake = requiredGrossProfit / (priceDifference / entryPrice)

      // Validate against risk limits
      const maxAllowedStake = this.calculateMaxAllowedStake(nominalAmount, costData)

      // Adjust stake if necessary
      const adjustedStake = Math.min(requiredStake, maxAllowedStake)

      // Recalculate costs with adjusted stake
      const finalCommission = this.calculateCommission(adjustedStake, entryPrice)
      const finalSpreadCost = this.calculateSpreadCost(adjustedStake, costData.currentSpread, entryPrice)
      const finalSwapCost = this.calculateSwapCost(adjustedStake, entryPrice, 1)

      const finalTotalCosts = finalCommission + finalSpreadCost + finalSwapCost
      const finalNetProfit = (adjustedStake * (priceDifference / entryPrice)) - finalTotalCosts

      const result: CostCalculationResult = {
        nominalAmount,
        commission: finalCommission,
        spreadCost: finalSpreadCost,
        swapCost: finalSwapCost,
        totalCosts: finalTotalCosts,
        netAmount: adjustedStake,
        costBreakdown: {
          commission: finalCommission,
          spreadCost: finalSpreadCost,
          swapCost: finalSwapCost,
          otherFees: 0
        },
        riskAdjustments: {
          effectiveSLDistance: costData.effectiveSLDistance,
          adjustedStake,
          maxAllowedStake
        },
        validation: {
          isWithinLimits: costData.isWithinLimits && adjustedStake <= maxAllowedStake,
          warnings: costData.warnings,
          errors: []
        }
      }

      // Add validation errors
      if (!costData.isWithinLimits) {
        result.validation.errors.push(`Spread exceeds limit: ${costData.currentSpread} > ${this.config.maxAllowedSpread}`)
      }

      if (adjustedStake > maxAllowedStake) {
        result.validation.errors.push(`Required stake exceeds maximum allowed: ${adjustedStake} > ${maxAllowedStake}`)
      }

      // Log cost calculation
      console.log(`Cost calculation result:`, {
        symbol,
        targetNetProfit,
        finalNetProfit,
        totalCosts: finalTotalCosts,
        adjustedStake,
        isWithinLimits: result.validation.isWithinLimits
      })

      return result

    } catch (error) {
      console.error('Error calculating trade costs:', error)
      throw error
    }
  }

  /**
   * Adjust stake to achieve target net profit after costs
   */
  async adjustStakeForNetProfit(
    symbol: string,
    targetNetProfit: number,
    entryPrice: number,
    targetPrice: number,
    stopPrice: number,
    maxRiskAmount: number
  ): Promise<{ adjustedStake: number; expectedNetProfit: number; totalCosts: number }> {
    try {
      console.log(`Adjusting stake for target net profit: $${targetNetProfit}`)

      // Start with a reasonable initial stake
      let currentStake = targetNetProfit / 0.01 // Assume 1% return initially
      let iterations = 0
      const maxIterations = 10
      const tolerance = 0.01 // $0.01 tolerance

      while (iterations < maxIterations) {
        const costResult = await this.calculateTradeCosts(
          symbol,
          currentStake,
          entryPrice,
          targetPrice,
          stopPrice,
          targetNetProfit
        )

        const actualNetProfit = costResult.netAmount * (Math.abs(targetPrice - entryPrice) / entryPrice) - costResult.totalCosts
        const difference = Math.abs(actualNetProfit - targetNetProfit)

        if (difference <= tolerance) {
          console.log(`Stake adjustment converged after ${iterations} iterations`)
          return {
            adjustedStake: costResult.netAmount,
            expectedNetProfit: actualNetProfit,
            totalCosts: costResult.totalCosts
          }
        }

        // Adjust stake based on difference
        const adjustmentFactor = targetNetProfit / actualNetProfit
        currentStake *= adjustmentFactor

        // Ensure we don't exceed maximum risk
        if (currentStake > maxRiskAmount) {
          currentStake = maxRiskAmount
          console.log(`Stake capped at maximum risk amount: $${maxRiskAmount}`)
          break
        }

        iterations++
      }

      // Final calculation
      const finalCostResult = await this.calculateTradeCosts(
        symbol,
        currentStake,
        entryPrice,
        targetPrice,
        stopPrice,
        targetNetProfit
      )

      return {
        adjustedStake: finalCostResult.netAmount,
        expectedNetProfit: targetNetProfit,
        totalCosts: finalCostResult.totalCosts
      }

    } catch (error) {
      console.error('Error adjusting stake for net profit:', error)
      throw error
    }
  }

  /**
   * Validate trade execution conditions
   */
  async validateTradeConditions(symbol: string): Promise<{ isValid: boolean; warnings: string[]; errors: string[] }> {
    try {
      const costData = await this.getRealTimeCostData(symbol)
      
      const warnings: string[] = []
      const errors: string[] = []

      // Check spread limits
      if (costData.currentSpread > this.config.maxAllowedSpread) {
        errors.push(`Spread too high: ${costData.currentSpread} > ${this.config.maxAllowedSpread}`)
      } else if (costData.currentSpread > this.config.defaultSpread * 1.5) {
        warnings.push(`Elevated spread: ${costData.currentSpread} pips`)
      }

      // Check spread to SL
      if (costData.spreadToSL > this.config.maxSpreadToSL) {
        errors.push(`Spread to SL too high: ${costData.spreadToSL} > ${this.config.maxSpreadToSL}`)
      }

      // Check if within limits
      const isValid = errors.length === 0

      return { isValid, warnings, errors }

    } catch (error) {
      console.error('Error validating trade conditions:', error)
      return {
        isValid: false,
        warnings: [],
        errors: ['Failed to validate trade conditions']
      }
    }
  }

  /**
   * Record trade costs in database
   */
  async recordTradeCosts(
    tradeId: string,
    sessionId: string,
    costResult: CostCalculationResult
  ): Promise<void> {
    try {
      if (!sql) {
        console.warn('Database not available, skipping cost recording')
        return
      }

      await sql`
        INSERT INTO trade_costs (
          trade_id,
          session_id,
          commission,
          spread_cost,
          swap_cost,
          total_costs,
          nominal_amount,
          adjusted_amount,
          cost_breakdown,
          created_at
        ) VALUES (
          ${tradeId},
          ${sessionId},
          ${costResult.commission},
          ${costResult.spreadCost},
          ${costResult.swapCost},
          ${costResult.totalCosts},
          ${costResult.nominalAmount},
          ${costResult.netAmount},
          ${JSON.stringify(costResult.costBreakdown)},
          CURRENT_TIMESTAMP
        )
      `

      console.log(`Trade costs recorded for trade ${tradeId}`)

    } catch (error) {
      console.error('Error recording trade costs:', error)
      // Don't throw error as this is not critical for trade execution
    }
  }

  // Private helper methods

  private async getCurrentSpread(symbol: string): Promise<number> {
    // This would fetch from trading platform API
    // For now, simulate with some variation
    const baseSpread = this.config.defaultSpread
    const variation = (Math.random() - 0.5) * 0.5 // ±25% variation
    return Math.max(0.1, baseSpread * (1 + variation))
  }

  private async getCurrentCommission(symbol: string): Promise<number> {
    // This would fetch from trading platform API
    return this.config.commissionValue
  }

  private async calculateSpreadToSL(symbol: string): Promise<number> {
    // This would calculate based on current market conditions
    const baseSpread = await this.getCurrentSpread(symbol)
    return baseSpread * this.config.spreadMultiplier
  }

  private calculateCommission(amount: number, price: number): number {
    switch (this.config.commissionType) {
      case 'fixed':
        return Math.max(this.config.minCommission, Math.min(this.config.maxCommission, this.config.commissionValue))
      
      case 'percentage':
        const commission = (amount * this.config.commissionValue) / 100
        return Math.max(this.config.minCommission, Math.min(this.config.maxCommission, commission))
      
      case 'per_lot':
        const lots = amount / (price * 100000) // Assuming standard lot size
        return Math.max(this.config.minCommission, Math.min(this.config.maxCommission, lots * this.config.commissionValue))
      
      default:
        return 0
    }
  }

  private calculateSpreadCost(amount: number, spread: number, price: number): number {
    const spreadInPrice = (spread / 10000) * price // Convert pips to price
    return amount * (spreadInPrice / price)
  }

  private calculateSwapCost(amount: number, price: number, days: number): number {
    const lots = amount / (price * 100000) // Assuming standard lot size
    const swapRate = this.config.longSwapRate // Use long rate for now
    return lots * swapRate * days
  }

  private calculateMaxAllowedStake(nominalAmount: number, costData: RealTimeCostData): number {
    // Calculate maximum stake based on risk management rules
    const maxRiskPercentage = 0.01 // 1% max risk
    const effectiveSLDistance = costData.effectiveSLDistance
    
    // Adjust for spread impact
    const adjustedSLDistance = effectiveSLDistance + costData.spreadToSL
    
    // Calculate maximum stake that keeps risk within limits
    const maxStake = nominalAmount * maxRiskPercentage / (adjustedSLDistance / 10000)
    
    return Math.min(maxStake, nominalAmount * 0.1) // Cap at 10% of account
  }

  /**
   * Update broker configuration
   */
  updateConfig(newConfig: Partial<BrokerCostConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('Broker cost configuration updated')
  }

  /**
   * Get current configuration
   */
  getConfig(): BrokerCostConfig {
    return this.config
  }
}

// Export default instance
export const brokerCostService = new BrokerCostService() 