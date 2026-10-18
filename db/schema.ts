import { sqliteTable,text,integer,primaryKey } from 'drizzle-orm/sqlite-core';
export const instruments=sqliteTable('instruments',{id:text('id').primaryKey(),code:text('code').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),contract:text('contract').notNull().default(''),session:text('session').notNull().default(''),unit:text('unit').notNull(),updatedAt:text('updated_at').notNull()});
export const bars=sqliteTable('bars',{instrument:text('instrument').notNull(),date:text('date').notNull(),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.instrument,t.date]})]);
export const imports=sqliteTable('imports',{id:text('id').primaryKey(),instrument:text('instrument').notNull(),at:text('at').notNull(),count:integer('count').notNull(),source:text('source').notNull(),csv:text('csv')});
export const jobs=sqliteTable('jobs',{id:text('id').primaryKey(),at:text('at').notNull(),status:text('status').notNull(),detail:text('detail').notNull()});
export const notes=sqliteTable('notes',{instrument:text('instrument').primaryKey(),body:text('body').notNull(),updatedAt:text('updated_at').notNull()});
