interface DecisionNode {
  value: string
  level: number | string
  win?: string
  loss?: string
  final?: boolean
}

export const decisionTree: Record<string, DecisionNode> = {
  Start: { value: "0.65%", level: 1, win: "1-0", loss: "0-1" },
  "1-0": { value: "0.58%", level: 2, win: "2-0", loss: "1-1" },
  "0-1": { value: "0.73%", level: 2, win: "1-1", loss: "0-2" },
  "2-0": { value: "0.44%", level: 3, win: "3-0", loss: "2-1" },
  "1-1": { value: "0.73%", level: 3, win: "2-1", loss: "1-2" },
  "0-2": { value: "0.73%", level: 3, win: "1-2", loss: "0-3" },
  "3-0": { value: "0.25%", level: 4, win: "4-0", loss: "3-1" },
  "2-1": { value: "0.62%", level: 4, win: "3-1", loss: "2-2" },
  "1-2": { value: "0.83%", level: 4, win: "2-2", loss: "1-3" },
  "0-3": { value: "0.62%", level: 4, win: "1-3", loss: "0-4" },
  "4-0": { value: "0.08%", level: 5, win: "WIN", loss: "4-1" },
  "3-1": { value: "0.41%", level: 5, win: "4-1", loss: "3-2" },
  "2-2": { value: "0.83%", level: 5, win: "3-2", loss: "2-3" },
  "1-3": { value: "0.83%", level: 5, win: "2-3", loss: "1-4" },
  "0-4": { value: "0.41%", level: 5, win: "1-4", loss: "0-5" },
  "4-1": { value: "0.17%", level: 6, win: "WIN", loss: "4-2" },
  "3-2": { value: "0.66%", level: 6, win: "4-2", loss: "3-3" },
  "2-3": { value: "0.99%", level: 6, win: "3-3", loss: "2-4" },
  "1-4": { value: "0.66%", level: 6, win: "2-4", loss: "1-5" },
  "0-5": { value: "0.17%", level: 6, win: "1-5", loss: "LOST" },
  "4-2": { value: "0.33%", level: 7, win: "WIN", loss: "4-3" },
  "3-3": { value: "0.99%", level: 7, win: "4-3", loss: "3-4" },
  "2-4": { value: "0.99%", level: 7, win: "3-4", loss: "2-5" },
  "1-5": { value: "0.33%", level: 7, win: "2-5", loss: "LOST" },
  "4-3": { value: "0.66%", level: 8, win: "WIN", loss: "4-4" },
  "3-4": { value: "1.33%", level: 8, win: "4-4", loss: "3-5" },
  "2-5": { value: "0.66%", level: 8, win: "3-5", loss: "LOST" },
  "4-4": { value: "1.33%", level: 9, win: "WIN", loss: "4-5" },
  "3-5": { value: "1.33%", level: 9, win: "4-5", loss: "LOST" },
  "4-5": { value: "2.65%", level: 10, win: "WIN", loss: "LOST" },
  WIN: { value: "+2.00%", level: "END", final: true },
  LOST: { value: "-3.31%", level: "END", final: true },
}

export function calculateValue(percentage: string, amount: number): number {
  const numericPercentage = Number.parseFloat(percentage.replace("%", "").replace("+", "").replace("-", ""))
  return Math.round((numericPercentage / 100) * amount)
}

/**
 * Calculate value with broker cost adjustment to achieve target net profit
 */
export async function calculateValueWithCostAdjustment(
  percentage: string, 
  amount: number, 
  symbol: string,
  entryPrice: number,
  targetPrice: number,
  stopPrice: number,
  brokerCostService: any
): Promise<{ adjustedAmount: number; totalCosts: number; expectedNetProfit: number }> {
  try {
    // Calculate nominal amount first
    const nominalAmount = calculateValue(percentage, amount)
    
    // Calculate target net profit (this is what we want to achieve)
    const targetNetProfit = nominalAmount
    
    // Adjust stake to achieve target net profit after costs
    const result = await brokerCostService.adjustStakeForNetProfit(
      symbol,
      targetNetProfit,
      entryPrice,
      targetPrice,
      stopPrice,
      amount * 0.1 // Max 10% of account as risk
    )
    
    return {
      adjustedAmount: result.adjustedStake,
      totalCosts: result.totalCosts,
      expectedNetProfit: result.expectedNetProfit
    }
    
  } catch (error) {
    console.error('Error calculating value with cost adjustment:', error)
    
    // Fallback to nominal calculation
    const nominalAmount = calculateValue(percentage, amount)
    return {
      adjustedAmount: nominalAmount,
      totalCosts: 0,
      expectedNetProfit: nominalAmount
    }
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDateTime(date: Date): string {
  const day = date.getDate()
  const month = date.toLocaleString("default", { month: "long" })
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")

  return `${day} ${month}, ${year}, ${hours}:${minutes}`
}

export function calculateDuration(startTime: Date, endTime: Date): string {
  const diffMs = endTime.getTime() - startTime.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffSecs = Math.floor((diffMs % 60000) / 1000)
  return `${diffMins}m ${diffSecs}s`
}
