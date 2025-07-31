// Test script to compare original vs enhanced broker cost calculations
console.log('🔍 Comparing Original vs Enhanced Broker Cost Calculations')
console.log('==========================================================\n')

// Test parameters
const initialAmount = 100000
const targetNetProfit = 650
const symbol = 'BTCUSDT'
const entryPrice = 45000
const targetPrice = 46000
const stopPrice = 44500
const tradeDirection = 'long'
const holdingDays = 1

console.log('📊 Test Parameters:')
console.log(`Initial Amount: $${initialAmount.toLocaleString()}`)
console.log(`Target Net Profit: $${targetNetProfit}`)
console.log(`Symbol: ${symbol}`)
console.log(`Entry Price: $${entryPrice}`)
console.log(`Target Price: $${targetPrice}`)
console.log(`Stop Price: $${stopPrice}`)
console.log(`Trade Direction: ${tradeDirection}`)
console.log(`Holding Days: ${holdingDays}`)
console.log('')

// Simulate original broker cost calculation (basic)
function simulateOriginalCosts(nominalAmount, entryPrice, targetPrice) {
  // Original implementation only included:
  const commission = 5 // Fixed $5 commission
  const spreadPips = 3 // 3 pips spread
  const spreadCost = (spreadPips / 10000) * entryPrice * (nominalAmount / entryPrice)
  const swapCost = 0 // No swap for demo
  
  const totalCosts = commission + spreadCost + swapCost
  
  return {
    commission,
    spreadCost,
    swapCost,
    totalCosts,
    missingCosts: []
  }
}

// Simulate enhanced broker cost calculation (comprehensive)
function simulateEnhancedCosts(nominalAmount, entryPrice, targetPrice, tradeDirection, holdingDays) {
  // Enhanced implementation includes ALL costs:
  
  // 1. Primary costs (included in original)
  const commission = 5
  const spreadPips = 3
  const spreadCost = (spreadPips / 10000) * entryPrice * (nominalAmount / entryPrice)
  const swapCost = 0
  
  // 2. Execution costs (MISSING in original)
  const slippagePips = 1
  const slippageCost = (slippagePips / 10000) * entryPrice * (nominalAmount / entryPrice) * 1.1
  const marketImpactCost = nominalAmount * 0.001 // 0.1% market impact
  const executionFee = 0
  const routingFee = 0
  const liquidityFee = 0
  
  // 3. Regulatory costs (MISSING in original)
  const regulatoryFee = nominalAmount * 0.0002 // 0.02%
  const exchangeFee = nominalAmount * 0.0001 // 0.01%
  const clearingFee = nominalAmount * 0.0001 // 0.01%
  
  // 4. Currency costs (MISSING in original)
  const currencyConversionFee = nominalAmount * 0.001 // 0.1%
  const currencySpreadPips = 1
  const currencySpreadCost = (currencySpreadPips / 10000) * entryPrice * (nominalAmount / entryPrice)
  
  // 5. Overnight/Weekend costs (MISSING in original)
  const weekendSwapCost = 0 // No weekend holding in this test
  const holidaySwapCost = 0 // No holiday holding in this test
  
  // 6. Other fees (MISSING in original)
  const accountMaintenanceFee = 0
  
  const totalCosts = commission + spreadCost + swapCost + slippageCost + marketImpactCost + 
                    executionFee + routingFee + liquidityFee + regulatoryFee + exchangeFee + 
                    clearingFee + currencyConversionFee + currencySpreadCost + 
                    weekendSwapCost + holidaySwapCost + accountMaintenanceFee
  
  const missingCosts = [
    { name: 'Slippage Cost', amount: slippageCost, percentage: (slippageCost / nominalAmount * 100).toFixed(3) + '%' },
    { name: 'Market Impact Cost', amount: marketImpactCost, percentage: (marketImpactCost / nominalAmount * 100).toFixed(3) + '%' },
    { name: 'Regulatory Fee', amount: regulatoryFee, percentage: (regulatoryFee / nominalAmount * 100).toFixed(3) + '%' },
    { name: 'Exchange Fee', amount: exchangeFee, percentage: (exchangeFee / nominalAmount * 100).toFixed(3) + '%' },
    { name: 'Clearing Fee', amount: clearingFee, percentage: (clearingFee / nominalAmount * 100).toFixed(3) + '%' },
    { name: 'Currency Conversion Fee', amount: currencyConversionFee, percentage: (currencyConversionFee / nominalAmount * 100).toFixed(3) + '%' },
    { name: 'Currency Spread Cost', amount: currencySpreadCost, percentage: (currencySpreadCost / nominalAmount * 100).toFixed(3) + '%' }
  ]
  
  return {
    commission,
    spreadCost,
    swapCost,
    slippageCost,
    marketImpactCost,
    executionFee,
    routingFee,
    liquidityFee,
    regulatoryFee,
    exchangeFee,
    clearingFee,
    currencyConversionFee,
    currencySpreadCost,
    weekendSwapCost,
    holidaySwapCost,
    accountMaintenanceFee,
    totalCosts,
    missingCosts
  }
}

// Calculate required stake for both scenarios
function calculateAdjustedStake(targetNetProfit, entryPrice, targetPrice, costCalculation) {
  const priceDifference = Math.abs(targetPrice - entryPrice)
  const priceRatio = priceDifference / entryPrice
  
  let adjustedStake = targetNetProfit
  let iterations = 0
  const maxIterations = 10
  const tolerance = 0.01
  
  while (iterations < maxIterations) {
    const costs = costCalculation(adjustedStake, entryPrice, targetPrice)
    const grossProfit = adjustedStake * priceRatio
    const actualNetProfit = grossProfit - costs.totalCosts
    const difference = Math.abs(actualNetProfit - targetNetProfit)
    
    if (difference <= tolerance) {
      break
    }
    
    const adjustmentFactor = targetNetProfit / actualNetProfit
    adjustedStake *= adjustmentFactor
    iterations++
  }
  
  return {
    adjustedStake,
    costs: costCalculation(adjustedStake, entryPrice, targetPrice),
    iterations
  }
}

// Run comparisons
console.log('🧮 Original Cost Calculation (Basic)')
const originalResult = calculateAdjustedStake(targetNetProfit, entryPrice, targetPrice, simulateOriginalCosts)

console.log(`Nominal Amount: $${targetNetProfit}`)
console.log(`Adjusted Stake: $${originalResult.adjustedStake.toFixed(2)}`)
console.log(`Commission: $${originalResult.costs.commission.toFixed(2)}`)
console.log(`Spread Cost: $${originalResult.costs.spreadCost.toFixed(2)}`)
console.log(`Swap Cost: $${originalResult.costs.swapCost.toFixed(2)}`)
console.log(`Total Costs: $${originalResult.costs.totalCosts.toFixed(2)}`)
console.log('')

console.log('🧮 Enhanced Cost Calculation (Comprehensive)')
const enhancedResult = calculateAdjustedStake(targetNetProfit, entryPrice, targetPrice, 
  (amount, entry, target) => simulateEnhancedCosts(amount, entry, target, tradeDirection, holdingDays))

console.log(`Nominal Amount: $${targetNetProfit}`)
console.log(`Adjusted Stake: $${enhancedResult.adjustedStake.toFixed(2)}`)
console.log(`Commission: $${enhancedResult.costs.commission.toFixed(2)}`)
console.log(`Spread Cost: $${enhancedResult.costs.spreadCost.toFixed(2)}`)
console.log(`Swap Cost: $${enhancedResult.costs.swapCost.toFixed(2)}`)
console.log(`Slippage Cost: $${enhancedResult.costs.slippageCost.toFixed(2)}`)
console.log(`Market Impact Cost: $${enhancedResult.costs.marketImpactCost.toFixed(2)}`)
console.log(`Regulatory Fee: $${enhancedResult.costs.regulatoryFee.toFixed(2)}`)
console.log(`Exchange Fee: $${enhancedResult.costs.exchangeFee.toFixed(2)}`)
console.log(`Clearing Fee: $${enhancedResult.costs.clearingFee.toFixed(2)}`)
console.log(`Currency Conversion Fee: $${enhancedResult.costs.currencyConversionFee.toFixed(2)}`)
console.log(`Currency Spread Cost: $${enhancedResult.costs.currencySpreadCost.toFixed(2)}`)
console.log(`Total Costs: $${enhancedResult.costs.totalCosts.toFixed(2)}`)
console.log('')

// Verify results
const priceDifference = Math.abs(targetPrice - entryPrice)
const priceRatio = priceDifference / entryPrice

const originalGrossProfit = originalResult.adjustedStake * priceRatio
const originalActualNetProfit = originalGrossProfit - originalResult.costs.totalCosts

const enhancedGrossProfit = enhancedResult.adjustedStake * priceRatio
const enhancedActualNetProfit = enhancedGrossProfit - enhancedResult.costs.totalCosts

console.log('✅ Verification:')
console.log('Original Calculation:')
console.log(`  Gross Profit: $${originalGrossProfit.toFixed(2)}`)
console.log(`  Total Costs: $${originalResult.costs.totalCosts.toFixed(2)}`)
console.log(`  Actual Net Profit: $${originalActualNetProfit.toFixed(2)}`)
console.log(`  Difference from Target: $${Math.abs(originalActualNetProfit - targetNetProfit).toFixed(2)}`)
console.log('')

console.log('Enhanced Calculation:')
console.log(`  Gross Profit: $${enhancedGrossProfit.toFixed(2)}`)
console.log(`  Total Costs: $${enhancedResult.costs.totalCosts.toFixed(2)}`)
console.log(`  Actual Net Profit: $${enhancedActualNetProfit.toFixed(2)}`)
console.log(`  Difference from Target: $${Math.abs(enhancedActualNetProfit - targetNetProfit).toFixed(2)}`)
console.log('')

// Cost comparison
console.log('📊 Cost Comparison Analysis:')
const costDifference = enhancedResult.costs.totalCosts - originalResult.costs.totalCosts
const costIncreasePercentage = (costDifference / originalResult.costs.totalCosts * 100).toFixed(2)

console.log(`Original Total Costs: $${originalResult.costs.totalCosts.toFixed(2)}`)
console.log(`Enhanced Total Costs: $${enhancedResult.costs.totalCosts.toFixed(2)}`)
console.log(`Cost Increase: $${costDifference.toFixed(2)} (${costIncreasePercentage}%)`)
console.log('')

// Missing costs breakdown
console.log('🚨 Hidden Costs Found (Missing in Original):')
enhancedResult.costs.missingCosts.forEach(cost => {
  console.log(`  ${cost.name}: $${cost.amount.toFixed(2)} (${cost.percentage})`)
})
console.log('')

// Stake comparison
console.log('💰 Stake Comparison:')
const stakeDifference = enhancedResult.adjustedStake - originalResult.adjustedStake
const stakeIncreasePercentage = (stakeDifference / originalResult.adjustedStake * 100).toFixed(2)

console.log(`Original Adjusted Stake: $${originalResult.adjustedStake.toFixed(2)}`)
console.log(`Enhanced Adjusted Stake: $${enhancedResult.adjustedStake.toFixed(2)}`)
console.log(`Stake Increase: $${stakeDifference.toFixed(2)} (${stakeIncreasePercentage}%)`)
console.log('')

// Summary
console.log('📋 Summary:')
console.log('✅ Original calculation includes:')
console.log('   - Commission')
console.log('   - Spread cost')
console.log('   - Basic swap cost')
console.log('')

console.log('❌ Original calculation MISSES:')
console.log('   - Slippage costs')
console.log('   - Market impact costs')
console.log('   - Regulatory fees')
console.log('   - Exchange fees')
console.log('   - Clearing fees')
console.log('   - Currency conversion fees')
console.log('   - Currency spread costs')
console.log('   - Weekend/holiday swap costs')
console.log('   - Account maintenance fees')
console.log('')

console.log('🎯 Impact:')
console.log(`   The enhanced calculation reveals ${costIncreasePercentage}% higher costs`)
console.log(`   This requires ${stakeIncreasePercentage}% larger stake to achieve the same net profit`)
console.log(`   Without these hidden costs, actual net profits would be significantly lower`)
console.log('')

console.log('💡 Recommendation:')
console.log('   Use the enhanced broker cost service to ensure all trading costs are accounted for')
console.log('   This provides more accurate profit calculations and better risk management')
console.log('')

console.log('🎉 Enhanced cost analysis completed!') 