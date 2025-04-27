import { neon } from "@neondatabase/serverless";
import  { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";

// Load environment variables from .env file
config({ path: ".env" });

if ( !process.env.DATABASE_URL ){
    throw new Error( 'DATABASE_URL not defined' );
}

// Init newon client
const sql = neon( process.env.DATABASE_URL );

// Init drizzle
export const db = drizzle( sql );