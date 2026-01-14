import Database from 'better-sqlite3';

export async function runMigrations(db: Database.Database): Promise<void> {
    // Current migrations are handled in TestDatabase constructor for now
    // This function can be used for future schema updates
    return;
}
