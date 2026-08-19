/**
 * Scheduler - Cron-based mission scheduling
 * 
 * Features:
 * - One-time scheduled missions
 * - Recurring schedules
 * - Time zones
 * - Pause/resume
 * - Misfire handling
 * - Concurrency control
 */

import { CronJob } from 'cron';
import crypto from 'node:crypto';
import { pool, emitEvent } from './db.js';
import { enqueue } from './queue.js';

// Schema for schedule validation
const scheduleSchema = {
  name: { type: 'string', required: true },
  cronExpression: { type: 'string', required: true },
  timezone: { type: 'string', required: false, default: 'UTC' },
  goal: { type: 'string', required: true },
  mode: { type: 'string', enum: ['INSTANT', 'THINK', 'AGENT', 'SWARM', 'AUTO'], default: 'SWARM' },
  projectId: { type: 'string', required: true },
  oneTime: { type: 'boolean', default: false },
  startTime: { type: 'string', required: false }, // ISO date string
  endTime: { type: 'string', required: false }, // ISO date string
  misfirePolicy: { 
    type: 'string', 
    enum: ['FAIL', 'SKIP', 'NOW', 'DELAY'], 
    default: 'SKIP' 
  },
  concurrency: { type: 'number', default: 1, min: 1, max: 10 },
  enabled: { type: 'boolean', default: true }
};

class Scheduler {
  constructor() {
    this.schedules = new Map();
    this.jobs = new Map();
    this.running = false;
    this.cleanupIntervals = [];
  }

  // Start the scheduler
  start() {
    this.running = true;
    this.loadSchedules();
    this.startCleanup();
    console.log('[scheduler] Scheduler started');
  }

  // Stop the scheduler
  stop() {
    this.running = false;
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
    console.log('[scheduler] Scheduler stopped');
  }

  // Load schedules from database
  async loadSchedules() {
    const { rows } = await pool.query(
      `SELECT * FROM schedules WHERE enabled = true AND status = 'ACTIVE'`
    );

    for (const schedule of rows) {
      await this.addSchedule(schedule);
    }

    console.log(`[scheduler] Loaded ${rows.length} schedules`);
  }

  // Add a schedule
  async addSchedule(schedule) {
    this.schedules.set(schedule.id, schedule);

    if (!schedule.enabled || schedule.status !== 'ACTIVE') {
      return;
    }

    const job = new CronJob({
      cronTime: schedule.cron_expression,
      onTick: async () => {
        await this.executeScheduledMission(schedule);
      },
      timeZone: schedule.timezone || 'UTC',
      start: true
    });

    this.jobs.set(schedule.id, job);

    await emitEvent(pool, {
      missionId: null,
      type: 'schedule.activated',
      actor: 'scheduler',
      payload: { scheduleId: schedule.id, cron: schedule.cron_expression }
    });
  }

  // Execute a scheduled mission
  async executeScheduledMission(schedule) {
    const now = new Date();

    // Check if within time window
    if (schedule.start_time && new Date(schedule.start_time) > now) {
      return;
    }

    if (schedule.end_time && new Date(schedule.end_time) < now) {
      await this.deactivateSchedule(schedule.id, 'EndTimePassed');
      return;
    }

    // Check concurrency
    const activeMissions = await pool.query(
      `SELECT COUNT(*) FROM missions WHERE schedule_id = $1 AND status IN ('RUNNING', 'PLANNING', 'QUEUED')`,
      [schedule.id]
    );

    if (activeMissions.rows[0].count >= (schedule.concurrency || 1)) {
      await pool.query(
        `INSERT INTO schedule_events (schedule_id, event_type, payload, created_at)
         VALUES ($1, 'CONCURRENCY_LIMIT', $2, now())`,
        [schedule.id, JSON.stringify({ count: activeMissions.rows[0].count })]
      );
      return;
    }

    // Create mission
    try {
      const mission = await pool.query(
        `INSERT INTO missions (
          id, goal, mode, status, provider_status, organization_id, project_id, created_by, schedule_id
        ) VALUES (
          gen_random_uuid(), $2, $3, 'QUEUED', 'PENDING', $5, $6, $7, $1
        ) RETURNING *`,
        [
          schedule.id,
          schedule.goal,
          schedule.mode,
          schedule.project_id,
          schedule.created_by,
          schedule.goal
        ]
      );

      const missionId = mission.rows[0].id;

      await emitEvent(pool, {
        missionId,
        type: 'mission.scheduled',
        actor: 'scheduler',
        payload: { scheduleId: schedule.id, reason: 'cron_trigger' }
      });

      await enqueue('mission', missionId);

    } catch (error) {
      console.error('[scheduler] Error executing scheduled mission:', error);
      await pool.query(
        `INSERT INTO schedule_events (schedule_id, event_type, payload, created_at, error)
         VALUES ($1, 'EXECUTION_ERROR', $2, now(), $3)`,
        [schedule.id, JSON.stringify({ error: error.message }), error.message]
      );
    }
  }

  // Deactivate a schedule
  async deactivateSchedule(scheduleId, reason) {
    await pool.query(
      `UPDATE schedules SET status = 'INACTIVE', status_reason = $2, deactivated_at = now() WHERE id = $1`,
      [scheduleId, reason]
    );

    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
      this.jobs.delete(scheduleId);
    }

    this.schedules.delete(scheduleId);

    await emitEvent(pool, {
      missionId: null,
      type: 'schedule.deactivated',
      actor: 'scheduler',
      payload: { scheduleId, reason }
    });
  }

  // Pause a schedule
  async pauseSchedule(scheduleId) {
    await pool.query(
      `UPDATE schedules SET enabled = false, paused_at = now() WHERE id = $1`,
      [scheduleId]
    );

    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
    }

    await emitEvent(pool, {
      missionId: null,
      type: 'schedule.paused',
      actor: 'scheduler',
      payload: { scheduleId }
    });
  }

  // Resume a schedule
  async resumeSchedule(scheduleId) {
    const { rows } = await pool.query(
      `SELECT * FROM schedules WHERE id = $1`, [scheduleId]
    );

    if (!rows.length) {
      throw new Error('Schedule not found');
    }

    await pool.query(
      `UPDATE schedules SET enabled = true, resumed_at = now() WHERE id = $1`,
      [scheduleId]
    );

    await this.addSchedule(rows[0]);

    await emitEvent(pool, {
      missionId: null,
      type: 'schedule.resumed',
      actor: 'scheduler',
      payload: { scheduleId }
    });
  }

  // Create a new schedule
  async createSchedule(config) {
    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO schedules (
        id, name, cron_expression, timezone, goal, mode, organization_id, project_id, 
        created_by, one_time, start_time, end_time, misfire_policy, concurrency, enabled, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())`,
      [
        id, config.name, config.cronExpression, config.timezone,
        config.goal, config.mode, config.projectId, config.createdBy || null,
        config.oneTime || false, config.startTime || null, config.endTime || null,
        config.misfirePolicy || 'SKIP', config.concurrency || 1, config.enabled !== false
      ]
    );

    await this.addSchedule({ id, ...config });

    return id;
  }

  // Delete a schedule
  async deleteSchedule(scheduleId) {
    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
      this.jobs.delete(scheduleId);
    }

    await pool.query(`DELETE FROM schedules WHERE id = $1`, [scheduleId]);

    await emitEvent(pool, {
      missionId: null,
      type: 'schedule.deleted',
      actor: 'scheduler',
      payload: { scheduleId }
    });
  }

  // Get schedules for an organization
  async getOrganizationSchedules(orgId) {
    const { rows } = await pool.query(
      `SELECT * FROM schedules WHERE organization_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );
    return rows;
  }

  // Cleanup old events (run periodically)
  startCleanup() {
    const cleanup = async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      await pool.query(
        `DELETE FROM schedule_events WHERE created_at < $1`,
        [cutoff]
      );
    };

    const interval = setInterval(cleanup, 60 * 60 * 1000); // Hourly
    this.cleanupIntervals.push(interval);
  }

  // Health check
  async health() {
    const scheduleCount = await pool.query(`SELECT COUNT(*) FROM schedules WHERE enabled = true`);
    const jobCount = this.jobs.size;

    return {
      schedules: scheduleCount.rows[0].count,
      activeJobs: jobCount,
      running: this.running
    };
  }
}

export const scheduler = new Scheduler();

// Initialize scheduler
export async function initScheduler() {
  scheduler.start();
  return scheduler;
}

// Export for API
export const scheduleApis = {
  create: (config) => scheduler.createSchedule(config),
  list: (orgId) => scheduler.getOrganizationSchedules(orgId),
  pause: (id) => scheduler.pauseSchedule(id),
  resume: (id) => scheduler.resumeSchedule(id),
  delete: (id) => scheduler.deleteSchedule(id),
  health: () => scheduler.health()
};