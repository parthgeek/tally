/**
 * Comprehensive security monitoring and alerting system
 * Real-time threat detection, incident response, and security event correlation
 */

import { captureException, captureMessage } from '@nexus/analytics';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  source: string;
  details: Record<string, any>;
  userId?: string;
  orgId?: string;
  clientIP?: string;
  userAgent?: string;
  requestId?: string;
}

export type SecurityEventType =
  | 'authentication_failure'
  | 'authorization_failure'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'data_access_violation'
  | 'injection_attempt'
  | 'xss_attempt'
  | 'csrf_attempt'
  | 'webhook_verification_failed'
  | 'invalid_input'
  | 'file_upload_threat'
  | 'privilege_escalation'
  | 'anomalous_behavior'
  | 'security_configuration_change';

export interface SecurityAlert {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  events: SecurityEvent[];
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignee?: string;
  tags: string[];
}

export interface ThreatDetectionRule {
  id: string;
  name: string;
  description: string;
  eventTypes: SecurityEventType[];
  conditions: ThreatCondition[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface ThreatCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex' | 'in_range';
  value: any;
  timeWindow?: number; // seconds
}

/**
 * Security monitoring and alerting engine
 */
export class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private alerts: Map<string, SecurityAlert> = new Map();
  private rules: ThreatDetectionRule[] = [];
  private readonly maxEventsInMemory = 10000;

  constructor() {
    this.initializeDefaultRules();
    this.startPeriodicCleanup();
  }

  /**
   * Record a security event
   */
  async recordEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Add to in-memory storage
    this.events.push(securityEvent);

    // Enforce memory limits
    if (this.events.length > this.maxEventsInMemory) {
      this.events = this.events.slice(-this.maxEventsInMemory);
    }

    // Log event for external monitoring
    this.logSecurityEvent(securityEvent);

    // Run threat detection
    await this.runThreatDetection(securityEvent);

    // Send to external monitoring if configured
    await this.sendToExternalMonitoring(securityEvent);
  }

  /**
   * Run threat detection rules against new event
   */
  private async runThreatDetection(newEvent: SecurityEvent): Promise<void> {
    for (const rule of this.rules) {
      if (!rule.enabled || !rule.eventTypes.includes(newEvent.type)) {
        continue;
      }

      if (await this.evaluateRule(rule, newEvent)) {
        await this.createOrUpdateAlert(rule, newEvent);
      }
    }
  }

  /**
   * Evaluate threat detection rule
   */
  private async evaluateRule(rule: ThreatDetectionRule, event: SecurityEvent): Promise<boolean> {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, event)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate individual condition
   */
  private evaluateCondition(condition: ThreatCondition, event: SecurityEvent): boolean {
    let value = this.getFieldValue(event, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'contains':
        return typeof value === 'string' && value.includes(condition.value);

      case 'greater_than':
        return typeof value === 'number' && value > condition.value;

      case 'less_than':
        return typeof value === 'number' && value < condition.value;

      case 'regex':
        return typeof value === 'string' && new RegExp(condition.value).test(value);

      case 'in_range':
        if (condition.timeWindow && typeof value === 'number') {
          const now = Date.now();
          const windowStart = now - (condition.timeWindow * 1000);
          const recentEvents = this.events.filter(e =>
            e.timestamp.getTime() >= windowStart &&
            e.type === event.type &&
            this.getFieldValue(e, condition.field) === value
          );
          return recentEvents.length >= condition.value;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Get field value from event
   */
  private getFieldValue(event: SecurityEvent, field: string): any {
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: any = event;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    }
    return (event as any)[field];
  }

  /**
   * Create or update security alert
   */
  private async createOrUpdateAlert(rule: ThreatDetectionRule, event: SecurityEvent): Promise<void> {
    const alertId = this.generateAlertId(rule, event);
    const existingAlert = this.alerts.get(alertId);

    if (existingAlert) {
      // Update existing alert
      existingAlert.events.push(event);
      existingAlert.lastSeen = event.timestamp;
      existingAlert.count++;

      // Escalate severity if needed
      if (existingAlert.count >= 10 && existingAlert.severity !== 'critical') {
        existingAlert.severity = 'critical';
        await this.sendCriticalAlert(existingAlert);
      }
    } else {
      // Create new alert
      const alert: SecurityAlert = {
        id: alertId,
        type: event.type,
        severity: rule.severity,
        title: this.generateAlertTitle(rule, event),
        description: this.generateAlertDescription(rule, event),
        events: [event],
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        count: 1,
        status: 'open',
        tags: this.generateAlertTags(rule, event),
      };

      this.alerts.set(alertId, alert);
      await this.sendNewAlert(alert);
    }
  }

  /**
   * Initialize default threat detection rules
   */
  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'auth_brute_force',
        name: 'Authentication Brute Force',
        description: 'Multiple failed login attempts from same IP',
        eventTypes: ['authentication_failure'],
        conditions: [
          {
            field: 'clientIP',
            operator: 'in_range',
            value: 5,
            timeWindow: 300, // 5 minutes
          },
        ],
        severity: 'high',
        enabled: true,
      },
      {
        id: 'rate_limit_abuse',
        name: 'Rate Limit Abuse',
        description: 'Excessive rate limit violations',
        eventTypes: ['rate_limit_exceeded'],
        conditions: [
          {
            field: 'clientIP',
            operator: 'in_range',
            value: 10,
            timeWindow: 600, // 10 minutes
          },
        ],
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'injection_attempt',
        name: 'SQL/NoSQL Injection Attempt',
        description: 'Potential injection attack detected',
        eventTypes: ['injection_attempt'],
        conditions: [
          {
            field: 'details.payload',
            operator: 'regex',
            value: '(union|select|insert|update|delete|drop|create|alter|exec|script)',
          },
        ],
        severity: 'high',
        enabled: true,
      },
      {
        id: 'xss_attempt',
        name: 'Cross-Site Scripting Attempt',
        description: 'Potential XSS attack detected',
        eventTypes: ['xss_attempt'],
        conditions: [
          {
            field: 'details.payload',
            operator: 'regex',
            value: '(<script|javascript:|on\\w+\\s*=)',
          },
        ],
        severity: 'high',
        enabled: true,
      },
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation Attempt',
        description: 'User attempting to access restricted resources',
        eventTypes: ['authorization_failure'],
        conditions: [
          {
            field: 'details.attempted_role',
            operator: 'equals',
            value: 'admin',
          },
          {
            field: 'userId',
            operator: 'in_range',
            value: 3,
            timeWindow: 3600, // 1 hour
          },
        ],
        severity: 'critical',
        enabled: true,
      },
      {
        id: 'webhook_compromise',
        name: 'Webhook Verification Failures',
        description: 'Multiple webhook verification failures',
        eventTypes: ['webhook_verification_failed'],
        conditions: [
          {
            field: 'clientIP',
            operator: 'in_range',
            value: 5,
            timeWindow: 900, // 15 minutes
          },
        ],
        severity: 'high',
        enabled: true,
      },
      {
        id: 'anomalous_data_access',
        name: 'Anomalous Data Access Pattern',
        description: 'Unusual data access patterns detected',
        eventTypes: ['data_access_violation'],
        conditions: [
          {
            field: 'details.records_accessed',
            operator: 'greater_than',
            value: 1000,
          },
        ],
        severity: 'medium',
        enabled: true,
      },
    ];
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(rule: ThreatDetectionRule, event: SecurityEvent): string {
    const key = `${rule.id}_${event.clientIP || 'unknown'}_${event.userId || 'anonymous'}`;
    return Buffer.from(key).toString('base64').slice(0, 16);
  }

  /**
   * Generate alert title
   */
  private generateAlertTitle(rule: ThreatDetectionRule, event: SecurityEvent): string {
    const source = event.clientIP ? ` from ${event.clientIP}` : '';
    return `${rule.name}${source}`;
  }

  /**
   * Generate alert description
   */
  private generateAlertDescription(rule: ThreatDetectionRule, event: SecurityEvent): string {
    let description = rule.description;

    if (event.userId) {
      description += ` - User: ${event.userId}`;
    }

    if (event.orgId) {
      description += ` - Organization: ${event.orgId}`;
    }

    return description;
  }

  /**
   * Generate alert tags
   */
  private generateAlertTags(rule: ThreatDetectionRule, event: SecurityEvent): string[] {
    const tags = [event.type, rule.id];

    if (event.source) {
      tags.push(`source:${event.source}`);
    }

    if (event.userId) {
      tags.push('authenticated');
    } else {
      tags.push('anonymous');
    }

    return tags;
  }

  /**
   * Log security event
   */
  private logSecurityEvent(event: SecurityEvent): void {
    const logEntry = {
      security_event: event.type,
      severity: event.severity,
      source: event.source,
      client_ip: event.clientIP,
      user_id: event.userId,
      org_id: event.orgId,
      timestamp: event.timestamp.toISOString(),
      details: event.details,
    };

    console.log('SECURITY_EVENT:', JSON.stringify(logEntry));

    // Send to application monitoring
    captureMessage(
      `Security event: ${event.type}`,
      event.severity === 'critical' ? 'error' : 'warning',
      {
        tags: {
          security_event: event.type,
          severity: event.severity,
        },
        extra: logEntry,
      }
    );
  }

  /**
   * Send new alert notification
   */
  private async sendNewAlert(alert: SecurityAlert): Promise<void> {
    console.warn('NEW_SECURITY_ALERT:', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      count: alert.count,
    });

    // Send to external alerting systems
    await this.sendToSlack(alert);
    await this.sendToEmail(alert);

    // Critical alerts need immediate attention
    if (alert.severity === 'critical') {
      await this.sendCriticalAlert(alert);
    }
  }

  /**
   * Send critical alert with escalation
   */
  private async sendCriticalAlert(alert: SecurityAlert): Promise<void> {
    console.error('CRITICAL_SECURITY_ALERT:', {
      id: alert.id,
      type: alert.type,
      title: alert.title,
      count: alert.count,
      events: alert.events.length,
    });

    // In production, trigger incident response
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with incident response system
      // TODO: Send to PagerDuty/OpsGenie for on-call escalation
    }

    // Capture as exception for immediate visibility
    captureException(new Error(`Critical security alert: ${alert.title}`), {
      tags: {
        alert_id: alert.id,
        alert_type: alert.type,
        severity: alert.severity,
      },
      extra: {
        alert: alert,
        recent_events: alert.events.slice(-5),
      },
    });
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: SecurityAlert): Promise<void> {
    const webhookUrl = process.env.SLACK_SECURITY_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      const payload = {
        text: `🚨 Security Alert: ${alert.title}`,
        attachments: [
          {
            color: this.getSeverityColor(alert.severity),
            fields: [
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
              { title: 'Type', value: alert.type, short: true },
              { title: 'Count', value: alert.count.toString(), short: true },
              { title: 'First Seen', value: alert.firstSeen.toISOString(), short: true },
            ],
            text: alert.description,
          },
        ],
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Send alert to email
   */
  private async sendToEmail(alert: SecurityAlert): Promise<void> {
    // TODO: Implement email alerting
    // This would integrate with your email service (SendGrid, SES, etc.)
    console.log('Email alert would be sent for:', alert.id);
  }

  /**
   * Send to external monitoring systems
   */
  private async sendToExternalMonitoring(event: SecurityEvent): Promise<void> {
    // TODO: Integrate with external SIEM systems
    // Examples: Datadog, Splunk, Elastic Security, etc.

    if (process.env.DATADOG_API_KEY) {
      // TODO: Send to Datadog
    }

    if (process.env.SPLUNK_HEC_URL) {
      // TODO: Send to Splunk
    }
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF8C00';
      case 'medium': return '#FFD700';
      case 'low': return '#32CD32';
      default: return '#808080';
    }
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): {
    eventsLast24h: number;
    alertsOpen: number;
    criticalAlerts: number;
    topEventTypes: Array<{ type: string; count: number }>;
  } {
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp.getTime() >= last24h);

    const openAlerts = Array.from(this.alerts.values()).filter(a => a.status === 'open');
    const criticalAlerts = openAlerts.filter(a => a.severity === 'critical');

    const eventTypeCounts = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEventTypes = Object.entries(eventTypeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      eventsLast24h: recentEvents.length,
      alertsOpen: openAlerts.length,
      criticalAlerts: criticalAlerts.length,
      topEventTypes,
    };
  }

  /**
   * Periodic cleanup of old events
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      this.events = this.events.filter(e => e.timestamp.getTime() >= oneWeekAgo);

      // Clean up resolved alerts older than 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      for (const [id, alert] of this.alerts.entries()) {
        if (alert.status === 'resolved' && alert.lastSeen.getTime() < thirtyDaysAgo) {
          this.alerts.delete(id);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}

// Global security monitor instance
let globalSecurityMonitor: SecurityMonitor | null = null;

export function getSecurityMonitor(): SecurityMonitor {
  if (!globalSecurityMonitor) {
    globalSecurityMonitor = new SecurityMonitor();
  }
  return globalSecurityMonitor;
}

/**
 * Convenience functions for recording common security events
 */
export const SecurityEvents = {
  authenticationFailure: (details: { email?: string; reason: string; clientIP?: string }) =>
    getSecurityMonitor().recordEvent({
      type: 'authentication_failure',
      severity: 'medium',
      source: 'auth_system',
      details,
    }),

  rateLimitExceeded: (details: { endpoint: string; limit: number; clientIP?: string; userId?: string }) =>
    getSecurityMonitor().recordEvent({
      type: 'rate_limit_exceeded',
      severity: 'medium',
      source: 'rate_limiter',
      details,
    }),

  suspiciousActivity: (details: { activity: string; reason: string; clientIP?: string; userId?: string }) =>
    getSecurityMonitor().recordEvent({
      type: 'suspicious_activity',
      severity: 'high',
      source: 'system',
      details,
    }),

  injectionAttempt: (details: { payload: string; endpoint: string; clientIP?: string }) =>
    getSecurityMonitor().recordEvent({
      type: 'injection_attempt',
      severity: 'high',
      source: 'input_validation',
      details,
    }),

  webhookVerificationFailed: (details: { provider: string; reason: string; clientIP?: string }) =>
    getSecurityMonitor().recordEvent({
      type: 'webhook_verification_failed',
      severity: 'medium',
      source: 'webhook_security',
      details,
    }),
};