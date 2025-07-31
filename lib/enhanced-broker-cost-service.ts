import { sql } from "./db"
import { alertService } from "./alert-service"
import { exceptionHandler } from "./exception-handler"

// Enhanced broker cost configuration interface
export interface EnhancedBrokerCostConfig {
  brokerId: string
  brokerName: string
  platform: 'binance' | 'mt4' | 'mt5' | 'demo'
  
  // Commission structure
  commissionType: 'fixed' | 'percentage' | 'per_lot'
  commissionValue: number
  minCommission: number
  maxCommission: number
  
  // Spread configuration
  defaultSpread: number // in pips
  maxAllowedSpread: number
  spreadMultiplier: number
  spreadWideningFactor: number // Additional spread during high volatility
  
  // Swap/rollover fees
  longSwapRate: number // per lot per day
  shortSwapRate: number // per lot per day
  swapCalculationMethod: 'daily' | 'hourly' | 'weekly'
  
  // Slippage costs
  defaultSlippage: number // in pips
  maxSlippage: number
  slippageMultiplier: number // Increases with trade size
  
  // Market impact costs
  marketImpactEnabled: boolean
  marketImpactRate: number // % per $10,000 traded
  
  // Execution costs
  executionFee: number // Fixed execution fee
  routingFee: number // ECN routing fee
  liquidityFee: number // Liquidity provider fee
  
  // Regulatory costs
  regulatoryFee: number // Government/regulatory fees
  exchangeFee: number // Exchange-specific fees
  clearingFee: number // Clearing house fees
  
  // Currency conversion costs
  currencyConversionFee: number // If trading in different currency
  currencySpread: number // Additional spread for currency pairs
  
  // Overnight/Weekend costs
  weekendSwapMultiplier: number // Higher swap rates on weekends
  holidaySwapMultiplier: number // Higher swap rates on holidays
  
  // Other fees
  depositFee: number
  withdrawalFee: number
  inactivityFee: number
  accountMaintenanceFee: number
  
  // Risk management
  maxSpreadToSL: number
  costValidationEnabled: boolean
  autoAdjustSL: boolean
  
  // Advanced features
  dynamicPricing: boolean // Real-time pricing adjustments
  volumeDiscounts: boolean // Volume-based commission discounts
  tieredPricing: boolean // Tiered commission structure
}

// Enhanced real-time cost data
export interface EnhancedRealTimeCostData {
  symbol: string
  currentSpread: number
  currentCommission: number
  spreadToSL: number
  effectiveSLDistance: number
  currentSlippage: number
  marketImpact: number
  timestamp: Date
  isWithinLimits: boolean
  warnings: string[]
  marketConditions: {
    volatility: 'low' | 'medium' | 'high'
    liquidity: 'low' | 'medium' | 'high'
    spreadWidening: number
  }
}

// Enhanced cost calculation result
export interface EnhancedCostCalculationResult {
  nominalAmount: number
  
  // Primary costs
  commission: number
  spreadCost: number
  swapCost: number
  
  // Execution costs
  slippageCost: number
  marketImpactCost: number
  executionFee: number
  routingFee: number
  liquidityFee: number
  
  // Regulatory costs
  regulatoryFee: number
  exchangeFee: number
  clearingFee: number
  
  // Currency costs
  currencyConversionFee: number
  currencySpreadCost: number
  
  // Other costs
  weekendSwapCost: number
  holidaySwapCost: number
  accountMaintenanceFee: number
  
  // Totals
  totalCosts: number
  netAmount: number
  
  // Detailed breakdown
  costBreakdown: {
    commission: number
    spreadCost: number
    swapCost: number
    slippageCost: number
    marketImpactCost: number
    executionFee: number
    routingFee: number
    liquidityFee: number
    regulatoryFee: number
    exchangeFee: number
    clearingFee: number
    currencyConversionFee: number
    currencySpreadCost: number
    weekendSwapCost: number
    holidaySwapCost: number
    accountMaintenanceFee: number
    otherFees: number
  }
  
  riskAdjustments: {
    effectiveSLDistance: number
    adjustedStake: number
    maxAllowedStake: number
    totalRiskExposure: number
  }
  
  validation: {
    isWithinLimits: boolean
    warnings: string[]
    errors: string[]
    costEfficiency: 'excellent' | 'good' | 'fair' | 'poor'
  }
}

// Enhanced default broker configurations
const enhancedDefaultBrokerConfigs: Record<string, EnhancedBrokerCostConfig> = {
  demo: {
    brokerId: 'demo',
    brokerName: 'Demo Account',
    platform: 'demo',
    commissionType: 'fixed',
    commissionValue: 5,
    minCommission: 5,
    maxCommission: 5,
    defaultSpread: 3,
    maxAllowedSpread: 10,
    spreadMultiplier: 1.5,
    spreadWideningFactor: 1.2,
    longSwapRate: 0,
    shortSwapRate: 0,
    swapCalculationMethod: 'daily',
    defaultSlippage: 1,
    maxSlippage: 5,
    slippageMultiplier: 1.1,
    marketImpactEnabled: false,
    marketImpactRate: 0,
    executionFee: 0,
    routingFee: 0,
    liquidityFee: 0,
    regulatoryFee: 0,
    exchangeFee: 0,
    clearingFee: 0,
    currencyConversionFee: 0,
    currencySpread: 0,
    weekendSwapMultiplier: 1.5,
    holidaySwapMultiplier: 2.0,
    depositFee: 0,
    withdrawalFee: 0,
    inactivityFee: 0,
    accountMaintenanceFee: 0,
    maxSpreadToSL: 5,
    costValidationEnabled: true,
    autoAdjustSL: true,
    dynamicPricing: false,
    volumeDiscounts: false,
    tieredPricing: false
  },
  binance: {
    brokerId: 'binance',
    brokerName: 'Binance',
    platform: 'binance',
    commissionType: 'percentage',
    commissionValue: 0.1,
    minCommission: 1,
    maxCommission: 1000,
    defaultSpread: 2,
    maxAllowedSpread: 8,
    spreadMultiplier: 2.0,
    spreadWideningFactor: 1.5,
    longSwapRate: -0.01,
    shortSwapRate: 0.01,
    swapCalculationMethod: 'daily',
    defaultSlippage: 0.5,
    maxSlippage: 3,
    slippageMultiplier: 1.2,
    marketImpactEnabled: true,
    marketImpactRate: 0.001, // 0.1% per $10,000
    executionFee: 0,
    routingFee: 0,
    liquidityFee: 0,
    regulatoryFee: 0,
    exchangeFee: 0.0001, // 0.01%
    clearingFee: 0,
    currencyConversionFee: 0.001, // 0.1%
    currencySpread: 1,
    weekendSwapMultiplier: 1.5,
    holidaySwapMultiplier: 2.0,
    depositFee: 0,
    withdrawalFee: 0.0005,
    inactivityFee: 0,
    accountMaintenanceFee: 0,
    maxSpreadToSL: 3,
    costValidationEnabled: true,
    autoAdjustSL: true,
    dynamicPricing: true,
    volumeDiscounts: true,
    tieredPricing: true
  },
  mt5: {
    brokerId: 'mt5',
    brokerName: 'MetaTrader 5',
    platform: 'mt5',
    commissionType: 'per_lot',
    commissionValue: 7,
    minCommission: 7,
    maxCommission: 700,
    defaultSpread: 5,
    maxAllowedSpread: 15,
    spreadMultiplier: 1.8,
    spreadWideningFactor: 1.3,
    longSwapRate: -0.02,
    shortSwapRate: 0.02,
    swapCalculationMethod: 'daily',
    defaultSlippage: 2,
    maxSlippage: 8,
    slippageMultiplier: 1.3,
    marketImpactEnabled: true,
    marketImpactRate: 0.002, // 0.2% per $10,000
    executionFee: 2,
    routingFee: 1,
    liquidityFee: 0.5,
    regulatoryFee: 0.0002, // 0.02%
    exchangeFee: 0.0003, // 0.03%
    clearingFee: 0.0001, // 0.01%
    currencyConversionFee: 0.002, // 0.2%
    currencySpread: 2,
    weekendSwapMultiplier: 2.0,
    holidaySwapMultiplier: 2.5,
    depositFee: 0,
    withdrawalFee: 0.001,
    inactivityFee: 10,
    accountMaintenanceFee: 5,
    maxSpreadToSL: 8,
    costValidationEnabled: true,
    autoAdjustSL: true,
    dynamicPricing: true,
    volumeDiscounts: true,
    tieredPricing: true
  }
}

export class EnhancedBrokerCostService {
  private config: EnhancedBrokerCostConfig
  private costCache: Map<string, EnhancedRealTimeCostData> = new Map()
  private readonly CACHE_DURATION = 30 * 1000 // 30 seconds

  constructor(brokerId: string = 'demo') {
    this.config = enhancedDefaultBrokerConfigs[brokerId] || enhancedDefaultBrokerConfigs.demo
  }

  /**
   * Get enhanced real-time cost data for a symbol
   */
  async getEnhancedRealTimeCostData(symbol: string): Promise<EnhancedRealTimeCostData> {
    try {
      // Check cache first
      const cached = this.costCache.get(symbol)
      if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_DURATION) {
        return cached
      }

      console.log(`Fetching enhanced real-time cost data for ${symbol}...`)

      // Fetch real-time data from trading platform
      const currentSpread = await this.getCurrentSpread(symbol)
      const currentCommission = await this.getCurrentCommission(symbol)
      const spreadToSL = await this.calculateSpreadToSL(symbol)
      const currentSlippage = await this.getCurrentSlippage(symbol)
      const marketImpact = await this.calculateMarketImpact(symbol)

      // Determine market conditions
      const marketConditions = await this.assessMarketConditions(symbol)

      const costData: EnhancedRealTimeCostData = {
        symbol,
        currentSpread,
        currentCommission,
        spreadToSL,
        effectiveSLDistance: spreadToSL,
        currentSlippage,
        marketImpact,
        timestamp: new Date(),
        isWithinLimits: currentSpread <= this.config.maxAllowedSpread,
        warnings: [],
        marketConditions
      }

      // Add warnings for high costs
      if (currentSpread > this.config.defaultSpread * 1.5) {
        costData.warnings.push(`High spread detected: ${currentSpread} pips`)
      }

      if (spreadToSL > this.config.maxSpreadToSL) {
        costData.warnings.push(`Spread to SL exceeds limit: ${spreadToSL} pips`)
      }

      if (currentSlippage > this.config.maxSlippage) {
        costData.warnings.push(`High slippage detected: ${currentSlippage} pips`)
      }

      if (marketConditions.volatility === 'high') {
        costData.warnings.push(`High volatility detected - costs may increase`)
      }

      // Cache the data
      this.costCache.set(symbol, costData)

      return costData

    } catch (error) {
      console.error(`Error fetching enhanced real-time cost data for ${symbol}:`, error)
      
      // Return default data on error
      return {
        symbol,
        currentSpread: this.config.defaultSpread,
        currentCommission: this.config.commissionValue,
        spreadToSL: this.config.defaultSpread,
        effectiveSLDistance: this.config.defaultSpread,
        currentSlippage: this.config.defaultSlippage,
        marketImpact: 0,
        timestamp: new Date(),
        isWithinLimits: true,
        warnings: ['Using default cost data due to API error'],
        marketConditions: {
          volatility: 'medium',
          liquidity: 'medium',
          spreadWidening: 1.0
        }
      }
    }
  }

  /**
   * Calculate comprehensive trade costs including all hidden costs
   */
  async calculateEnhancedTradeCosts(
    symbol: string,
    nominalAmount: number,
    entryPrice: number,
    targetPrice: number,
    stopPrice: number,
    targetNetProfit: number,
    tradeDirection: 'long' | 'short' = 'long',
    holdingDays: number = 1
  ): Promise<EnhancedCostCalculationResult> {
    try {
      console.log(`Calculating enhanced trade costs for ${symbol} with target net profit: $${targetNetProfit}`)

      // Get enhanced real-time cost data
      const costData = await this.getEnhancedRealTimeCostData(symbol)

      // Calculate all cost components
      const commission = this.calculateCommission(nominalAmount, entryPrice)
      const spreadCost = this.calculateSpreadCost(nominalAmount, costData.currentSpread, entryPrice)
      const swapCost = this.calculateSwapCost(nominalAmount, entryPrice, holdingDays, tradeDirection)
      const slippageCost = this.calculateSlippageCost(nominalAmount, costData.currentSlippage, entryPrice)
      const marketImpactCost = this.calculateMarketImpactCost(nominalAmount, costData.marketImpact)
      const executionFee = this.config.executionFee
      const routingFee = this.config.routingFee
      const liquidityFee = this.config.liquidityFee
      const regulatoryFee = this.calculateRegulatoryFee(nominalAmount)
      const exchangeFee = this.calculateExchangeFee(nominalAmount)
      const clearingFee = this.calculateClearingFee(nominalAmount)
      const currencyConversionFee = this.calculateCurrencyConversionFee(nominalAmount, symbol)
      const currencySpreadCost = this.calculateCurrencySpreadCost(nominalAmount, costData.currencySpread, entryPrice)
      const weekendSwapCost = this.calculateWeekendSwapCost(nominalAmount, entryPrice, holdingDays, tradeDirection)
      const holidaySwapCost = this.calculateHolidaySwapCost(nominalAmount, entryPrice, holdingDays, tradeDirection)
      const accountMaintenanceFee = this.config.accountMaintenanceFee

      const totalCosts = commission + spreadCost + swapCost + slippageCost + marketImpactCost + 
                        executionFee + routingFee + liquidityFee + regulatoryFee + exchangeFee + 
                        clearingFee + currencyConversionFee + currencySpreadCost + weekendSwapCost + 
                        holidaySwapCost + accountMaintenanceFee

      // Calculate required gross profit to achieve target net profit
      const requiredGrossProfit = targetNetProfit + totalCosts

      // Calculate required stake to achieve target net profit
      const priceDifference = Math.abs(targetPrice - entryPrice)
      const requiredStake = requiredGrossProfit / (priceDifference / entryPrice)

      // Validate against risk limits
      const maxAllowedStake = this.calculateMaxAllowedStake(nominalAmount, costData)

      // Adjust stake if necessary
      const adjustedStake = Math.min(requiredStake, maxAllowedStake)

      // Recalculate all costs with adjusted stake
      const finalCommission = this.calculateCommission(adjustedStake, entryPrice)
      const finalSpreadCost = this.calculateSpreadCost(adjustedStake, costData.currentSpread, entryPrice)
      const finalSwapCost = this.calculateSwapCost(adjustedStake, entryPrice, holdingDays, tradeDirection)
      const finalSlippageCost = this.calculateSlippageCost(adjustedStake, costData.currentSlippage, entryPrice)
      const finalMarketImpactCost = this.calculateMarketImpactCost(adjustedStake, costData.marketImpact)
      const finalRegulatoryFee = this.calculateRegulatoryFee(adjustedStake)
      const finalExchangeFee = this.calculateExchangeFee(adjustedStake)
      const finalClearingFee = this.calculateClearingFee(adjustedStake)
      const finalCurrencyConversionFee = this.calculateCurrencyConversionFee(adjustedStake, symbol)
      const finalCurrencySpreadCost = this.calculateCurrencySpreadCost(adjustedStake, costData.currencySpread, entryPrice)
      const finalWeekendSwapCost = this.calculateWeekendSwapCost(adjustedStake, entryPrice, holdingDays, tradeDirection)
      const finalHolidaySwapCost = this.calculateHolidaySwapCost(adjustedStake, entryPrice, holdingDays, tradeDirection)

      const finalTotalCosts = finalCommission + finalSpreadCost + finalSwapCost + finalSlippageCost + 
                             finalMarketImpactCost + executionFee + routingFee + liquidityFee + 
                             finalRegulatoryFee + finalExchangeFee + finalClearingFee + 
                             finalCurrencyConversionFee + finalCurrencySpreadCost + 
                             finalWeekendSwapCost + finalHolidaySwapCost + accountMaintenanceFee

      const finalNetProfit = (adjustedStake * (priceDifference / entryPrice)) - finalTotalCosts

      // Calculate cost efficiency
      const costEfficiency = this.calculateCostEfficiency(finalTotalCosts, adjustedStake)

      const result: EnhancedCostCalculationResult = {
        nominalAmount,
        commission: finalCommission,
        spreadCost: finalSpreadCost,
        swapCost: finalSwapCost,
        slippageCost: finalSlippageCost,
        marketImpactCost: finalMarketImpactCost,
        executionFee,
        routingFee,
        liquidityFee,
        regulatoryFee: finalRegulatoryFee,
        exchangeFee: finalExchangeFee,
        clearingFee: finalClearingFee,
        currencyConversionFee: finalCurrencyConversionFee,
        currencySpreadCost: finalCurrencySpreadCost,
        weekendSwapCost: finalWeekendSwapCost,
        holidaySwapCost: finalHolidaySwapCost,
        accountMaintenanceFee,
        totalCosts: finalTotalCosts,
        netAmount: adjustedStake,
        costBreakdown: {
          commission: finalCommission,
          spreadCost: finalSpreadCost,
          swapCost: finalSwapCost,
          slippageCost: finalSlippageCost,
          marketImpactCost: finalMarketImpactCost,
          executionFee,
          routingFee,
          liquidityFee,
          regulatoryFee: finalRegulatoryFee,
          exchangeFee: finalExchangeFee,
          clearingFee: finalClearingFee,
          currencyConversionFee: finalCurrencyConversionFee,
          currencySpreadCost: finalCurrencySpreadCost,
          weekendSwapCost: finalWeekendSwapCost,
          holidaySwapCost: finalHolidaySwapCost,
          accountMaintenanceFee,
          otherFees: 0
        },
        riskAdjustments: {
          effectiveSLDistance: costData.effectiveSLDistance,
          adjustedStake,
          maxAllowedStake,
          totalRiskExposure: adjustedStake * (Math.abs(entryPrice - stopPrice) / entryPrice)
        },
        validation: {
          isWithinLimits: costData.isWithinLimits && adjustedStake <= maxAllowedStake,
          warnings: costData.warnings,
          errors: [],
          costEfficiency
        }
      }

      // Add validation errors
      if (!costData.isWithinLimits) {
        result.validation.errors.push(`Spread exceeds limit: ${costData.currentSpread} > ${this.config.maxAllowedSpread}`)
      }

      if (adjustedStake > maxAllowedStake) {
        result.validation.errors.push(`Required stake exceeds maximum allowed: ${adjustedStake} > ${maxAllowedStake}`)
      }

      // Log comprehensive cost calculation
      console.log(`Enhanced cost calculation result:`, {
        symbol,
        targetNetProfit,
        finalNetProfit,
        totalCosts: finalTotalCosts,
        adjustedStake,
        costEfficiency,
        isWithinLimits: result.validation.isWithinLimits
      })

      return result

    } catch (error) {
      console.error('Error calculating enhanced trade costs:', error)
      throw error
    }
  }

  // Private helper methods for enhanced cost calculations

  private async getCurrentSlippage(symbol: string): Promise<number> {
    // This would fetch from trading platform API
    const baseSlippage = this.config.defaultSlippage
    const variation = (Math.random() - 0.5) * 0.5 // ±25% variation
    return Math.max(0.1, baseSlippage * (1 + variation))
  }

  private async calculateMarketImpact(symbol: string): Promise<number> {
    // This would calculate based on market depth and trade size
    return this.config.marketImpactRate
  }

  private async assessMarketConditions(symbol: string): Promise<{ volatility: 'low' | 'medium' | 'high', liquidity: 'low' | 'medium' | 'high', spreadWidening: number }> {
    // This would assess current market conditions
    const volatility = Math.random() > 0.7 ? 'high' : Math.random() > 0.3 ? 'medium' : 'low'
    const liquidity = Math.random() > 0.7 ? 'high' : Math.random() > 0.3 ? 'medium' : 'low'
    const spreadWidening = volatility === 'high' ? this.config.spreadWideningFactor : 1.0
    
    return { volatility, liquidity, spreadWidening }
  }

  private calculateSlippageCost(amount: number, slippage: number, price: number): number {
    const slippageInPrice = (slippage / 10000) * price
    return amount * (slippageInPrice / price) * this.config.slippageMultiplier
  }

  private calculateMarketImpactCost(amount: number, marketImpact: number): number {
    if (!this.config.marketImpactEnabled) return 0
    return amount * marketImpact
  }

  private calculateRegulatoryFee(amount: number): number {
    return amount * this.config.regulatoryFee
  }

  private calculateExchangeFee(amount: number): number {
    return amount * this.config.exchangeFee
  }

  private calculateClearingFee(amount: number): number {
    return amount * this.config.clearingFee
  }

  private calculateCurrencyConversionFee(amount: number, symbol: string): number {
    // Check if symbol involves currency conversion
    if (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('GBP')) {
      return amount * this.config.currencyConversionFee
    }
    return 0
  }

  private calculateCurrencySpreadCost(amount: number, currencySpread: number, price: number): number {
    if (currencySpread === 0) return 0
    const spreadInPrice = (currencySpread / 10000) * price
    return amount * (spreadInPrice / price)
  }

  private calculateWeekendSwapCost(amount: number, price: number, days: number, direction: 'long' | 'short'): number {
    const weekendDays = Math.floor(days / 7) * 2 // Approximate weekend days
    const swapRate = direction === 'long' ? this.config.longSwapRate : this.config.shortSwapRate
    const lots = amount / (price * 100000)
    return lots * swapRate * weekendDays * this.config.weekendSwapMultiplier
  }

  private calculateHolidaySwapCost(amount: number, price: number, days: number, direction: 'long' | 'short'): number {
    const holidayDays = Math.floor(days / 365) * 10 // Approximate holiday days
    const swapRate = direction === 'long' ? this.config.longSwapRate : this.config.shortSwapRate
    const lots = amount / (price * 100000)
    return lots * swapRate * holidayDays * this.config.holidaySwapMultiplier
  }

  private calculateSwapCost(amount: number, price: number, days: number, direction: 'long' | 'short'): number {
    const swapRate = direction === 'long' ? this.config.longSwapRate : this.config.shortSwapRate
    const lots = amount / (price * 100000)
    return lots * swapRate * days
  }

  private calculateCostEfficiency(totalCosts: number, tradeAmount: number): 'excellent' | 'good' | 'fair' | 'poor' {
    const costPercentage = (totalCosts / tradeAmount) * 100
    if (costPercentage < 0.1) return 'excellent'
    if (costPercentage < 0.3) return 'good'
    if (costPercentage < 0.5) return 'fair'
    return 'poor'
  }

  // Reuse existing methods from original service
  private async getCurrentSpread(symbol: string): Promise<number> {
    const baseSpread = this.config.defaultSpread
    const variation = (Math.random() - 0.5) * 0.5
    return Math.max(0.1, baseSpread * (1 + variation))
  }

  private async getCurrentCommission(symbol: string): Promise<number> {
    return this.config.commissionValue
  }

  private async calculateSpreadToSL(symbol: string): Promise<number> {
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
        const lots = amount / (price * 100000)
        return Math.max(this.config.minCommission, Math.min(this.config.maxCommission, lots * this.config.commissionValue))
      default:
        return 0
    }
  }

  private calculateSpreadCost(amount: number, spread: number, price: number): number {
    const spreadInPrice = (spread / 10000) * price
    return amount * (spreadInPrice / price)
  }

  private calculateMaxAllowedStake(nominalAmount: number, costData: EnhancedRealTimeCostData): number {
    const maxRiskPercentage = 0.01
    const effectiveSLDistance = costData.effectiveSLDistance
    const adjustedSLDistance = effectiveSLDistance + costData.spreadToSL
    const maxStake = nominalAmount * maxRiskPercentage / (adjustedSLDistance / 10000)
    return Math.min(maxStake, nominalAmount * 0.1)
  }

  /**
   * Update broker configuration
   */
  updateConfig(newConfig: Partial<EnhancedBrokerCostConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('Enhanced broker cost configuration updated')
  }

  /**
   * Get current configuration
   */
  getConfig(): EnhancedBrokerCostConfig {
    return this.config
  }
}

// Export default instance
export const enhancedBrokerCostService = new EnhancedBrokerCostService() 