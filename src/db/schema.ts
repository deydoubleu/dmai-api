import { create } from 'domain';
import { pgTable, serial, timestamp, text } from 'drizzle-orm/pg-core';

export const chats = pgTable( 'chats', {
    id: serial( 'id' ).primaryKey(),
    userId: text( 'user_id' ).notNull(),
    message: text( 'message' ).notNull(),
    reply: text( 'reply' ).notNull(),
    createdAt: timestamp( 'created_at' ).notNull().defaultNow(),
});

export const users = pgTable( 'users', {
    userId: text( 'user_id' ).primaryKey(),
    name: text( 'name' ).notNull(),
    email: text( 'email' ).notNull(),
    createdAt: timestamp( 'created_at' ).notNull().defaultNow(),
});

// Typer infierence
export type chatInsert =  typeof chats.$inferInsert;
export type chatSelect = typeof chats.$inferSelect;
export type userInsert =  typeof users.$inferInsert;
export type userSelect = typeof users.$inferSelect;
