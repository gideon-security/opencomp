'use server';

// Re-export canonical Fleet helper from shared utils.
// This file is kept for backward compatibility — all implementations live in @gideon-defender/utils/fleet.
export { getFleetInstance } from '@gideon-defender/utils/fleet';
