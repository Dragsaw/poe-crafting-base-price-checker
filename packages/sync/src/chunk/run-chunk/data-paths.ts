export const TRACKED_PATH = 'data/tracked.json';
export const PROGRESS_PATH = 'data/sync-progress.json';
/** The published Dataset (AD-19), written under the lock by explicit path, step entries merged. */
export const DATASET_PATH = 'data/dataset.json';
/** The Sync Report (FR-25, AD-12): read under the lock first, written after progress. */
export const REPORT_PATH = 'data/sync-report.json';
