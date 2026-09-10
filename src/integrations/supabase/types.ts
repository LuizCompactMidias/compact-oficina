// Generic Supabase typings for the reusable template.
// After connecting each workshop's Supabase project, regenerate this file with that project's schema.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = any;
export type Tables<T = any> = any;
export type TablesInsert<T = any> = any;
export type TablesUpdate<T = any> = any;
export type Enums<T = any> = any;
export type CompositeTypes<T = any> = any;

export const Constants = { public: { Enums: {} } } as const;
