// Fake public config so modules that read env can load in tests.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

// Native SQLite storage is not available in Jest.
jest.mock('expo-sqlite/localStorage/install', () => ({}));
