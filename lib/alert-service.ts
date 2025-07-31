import { sql } from './db'

export interface AlertConfig {
  emailEnabled: boolean
  smsEnabled: boolean
  signalDelayThreshold: number // seconds
  platformTimeoutThreshold: number // seconds
  stakeCalculationThreshold: number // percentage
  emailRecipients: string[]
  smsRecipients: string[]
}

export interface Alert {
  id: string
  type: 'SIGNAL_DELAY' | 'PLATFORM_UNRESPONSIVE' | 'STAKE_ABNORMAL' | 'SYSTEM_ERROR'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  details: any
  timestamp: Date
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: Date
}

export class AlertService {
  private config: AlertConfig
  private alertQueue: Alert[] = []
  private lastSignalTime: Date | null = null
  private platformHealthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY'
  private stakeCalculationHistory: number[] = []

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = {
      emailEnabled: true,
      smsEnabled: false,
      signalDelayThreshold: 30,
      platformTimeoutThreshold: 60,
      stakeCalculationThreshold: 10,
      emailRecipients: [],
      smsRecipients: [],
      ...config
    }
  }

  /**
   * Monitor signal delay
   */
  monitorSignalDelay(signalTime: Date): void {
    this.lastSignalTime = signalTime
    const now = new Date()
    const delaySeconds = (now.getTime() - signalTime.getTime()) / 1000

    if (delaySeconds > this.config.signalDelayThreshold) {
      this.createAlert({
        type: 'SIGNAL_DELAY',
        severity: 'HIGH',
        message: `Signal delay detected: ${delaySeconds.toFixed(1)} seconds`,
        details: {
          delay_seconds: delaySeconds,
          threshold: this.config.signalDelayThreshold,
          signal_time: signalTime.toISOString(),
          current_time: now.toISOString()
        }
      })
    }
  }

  /**
   * Monitor trading platform responsiveness
   */
  monitorPlatformHealth(isResponsive: boolean, responseTime?: number): void {
    const now = new Date()
    
    if (!isResponsive) {
      this.platformHealthStatus = 'DOWN'
      this.createAlert({
        type: 'PLATFORM_UNRESPONSIVE',
        severity: 'CRITICAL',
        message: 'Trading platform is unresponsive',
        details: {
          status: 'DOWN',
          response_time: responseTime,
          timestamp: now.toISOString()
        }
      })
    } else if (responseTime && responseTime > this.config.platformTimeoutThreshold * 1000) {
      this.platformHealthStatus = 'DEGRADED'
      this.createAlert({
        type: 'PLATFORM_UNRESPONSIVE',
        severity: 'MEDIUM',
        message: `Trading platform response time degraded: ${responseTime}ms`,
        details: {
          status: 'DEGRADED',
          response_time: responseTime,
          threshold: this.config.platformTimeoutThreshold * 1000,
          timestamp: now.toISOString()
        }
      })
    } else {
      this.platformHealthStatus = 'HEALTHY'
    }
  }

  /**
   * Monitor stake calculation abnormalities
   */
  monitorStakeCalculation(stakePercentage: number, expectedPercentage: number): void {
    const deviation = Math.abs(stakePercentage - expectedPercentage)
    const deviationPercentage = (deviation / expectedPercentage) * 100

    this.stakeCalculationHistory.push(deviationPercentage)
    
    // Keep only last 10 calculations
    if (this.stakeCalculationHistory.length > 10) {
      this.stakeCalculationHistory.shift()
    }

    if (deviationPercentage > this.config.stakeCalculationThreshold) {
      this.createAlert({
        type: 'STAKE_ABNORMAL',
        severity: 'MEDIUM',
        message: `Abnormal stake calculation detected: ${deviationPercentage.toFixed(2)}% deviation`,
        details: {
          calculated_stake: stakePercentage,
          expected_stake: expectedPercentage,
          deviation_percentage: deviationPercentage,
          threshold: this.config.stakeCalculationThreshold,
          history: this.stakeCalculationHistory
        }
      })
    }
  }

  /**
   * Create and send alert
   */
  private async createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alertData,
      timestamp: new Date(),
      acknowledged: false
    }

    // Add to queue
    this.alertQueue.push(alert)

    // Save to database
    await this.saveAlert(alert)

    // Send notifications
    await this.sendNotifications(alert)

    console.log(`🚨 Alert created: ${alert.type} - ${alert.message}`)
  }

  /**
   * Save alert to database
   */
  private async saveAlert(alert: Alert): Promise<void> {
    try {
      if (!sql) {
        console.warn('Database not available, alert not saved')
        return
      }

      // Create alerts table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS alerts (
          id VARCHAR(50) PRIMARY KEY,
          type VARCHAR(30) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          details JSONB,
          timestamp TIMESTAMP NOT NULL,
          acknowledged BOOLEAN DEFAULT FALSE,
          acknowledged_by VARCHAR(100),
          acknowledged_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `

      await sql`
        INSERT INTO alerts (
          id, type, severity, message, details, timestamp, acknowledged
        ) VALUES (
          ${alert.id},
          ${alert.type},
          ${alert.severity},
          ${alert.message},
          ${JSON.stringify(alert.details)},
          ${alert.timestamp.toISOString()},
          ${alert.acknowledged}
        )
      `

      console.log(`Alert saved to database: ${alert.id}`)
    } catch (error) {
      console.error('Error saving alert to database:', error)
    }
  }

  /**
   * Send notifications via email/SMS
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    try {
      if (this.config.emailEnabled && this.config.emailRecipients.length > 0) {
        await this.sendEmailAlert(alert)
      }

      if (this.config.smsEnabled && this.config.smsRecipients.length > 0) {
        await this.sendSMSAlert(alert)
      }
    } catch (error) {
      console.error('Error sending notifications:', error)
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    // This is a placeholder for email integration
    // In production, you would use a service like SendGrid, AWS SES, etc.
    console.log(`📧 Email alert would be sent to: ${this.config.emailRecipients.join(', ')}`)
    console.log(`   Subject: [${alert.severity}] ${alert.type} Alert`)
    console.log(`   Message: ${alert.message}`)
    console.log(`   Details: ${JSON.stringify(alert.details, null, 2)}`)
  }

  /**
   * Send SMS alert
   */
  private async sendSMSAlert(alert: Alert): Promise<void> {
    // This is a placeholder for SMS integration
    // In production, you would use a service like Twilio, AWS SNS, etc.
    console.log(`📱 SMS alert would be sent to: ${this.config.smsRecipients.join(', ')}`)
    console.log(`   Message: [${alert.severity}] ${alert.message}`)
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      if (!sql) {
        return this.alertQueue.filter(alert => !alert.acknowledged)
      }

      const result = await sql`
        SELECT * FROM alerts 
        WHERE acknowledged = false 
        ORDER BY timestamp DESC 
        LIMIT 50
      `

      return result.map((row: any) => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        message: row.message,
        details: row.details,
        timestamp: new Date(row.timestamp),
        acknowledged: row.acknowledged,
        acknowledgedBy: row.acknowledged_by,
        acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined
      }))
    } catch (error) {
      console.error('Error fetching active alerts:', error)
      return []
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    try {
      if (!sql) {
        // Update in-memory queue
        const alert = this.alertQueue.find(a => a.id === alertId)
        if (alert) {
          alert.acknowledged = true
          alert.acknowledgedBy = acknowledgedBy
          alert.acknowledgedAt = new Date()
          return true
        }
        return false
      }

      const result = await sql`
        UPDATE alerts 
        SET acknowledged = true,
            acknowledged_by = ${acknowledgedBy},
            acknowledged_at = CURRENT_TIMESTAMP
        WHERE id = ${alertId}
      `

      return result.count > 0
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      return false
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    platformStatus: string
    lastSignalDelay: number | null
    activeAlerts: number
    stakeCalculationTrend: 'STABLE' | 'INCREASING' | 'DECREASING'
  } {
    const lastSignalDelay = this.lastSignalTime ? 
      (Date.now() - this.lastSignalTime.getTime()) / 1000 : null

    const stakeTrend = this.getStakeCalculationTrend()

    return {
      platformStatus: this.platformHealthStatus,
      lastSignalDelay,
      activeAlerts: this.alertQueue.filter(alert => !alert.acknowledged).length,
      stakeCalculationTrend: stakeTrend
    }
  }

  /**
   * Get stake calculation trend
   */
  private getStakeCalculationTrend(): 'STABLE' | 'INCREASING' | 'DECREASING' {
    if (this.stakeCalculationHistory.length < 3) {
      return 'STABLE'
    }

    const recent = this.stakeCalculationHistory.slice(-3)
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    const previous = this.stakeCalculationHistory.slice(-6, -3)
    
    if (previous.length === 0) {
      return 'STABLE'
    }

    const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length
    
    if (avg > prevAvg * 1.1) {
      return 'INCREASING'
    } else if (avg < prevAvg * 0.9) {
      return 'DECREASING'
    }
    
    return 'STABLE'
  }

  /**
   * Configure alert settings
   */
  updateConfig(newConfig: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('Alert configuration updated:', this.config)
  }
}

// Export singleton instance
export const alertService = new AlertService() 