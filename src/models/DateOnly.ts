// A calendar date with no time or timezone, as 'YYYY-MM-DD'.
//
// node-postgres parses `date` columns into a local-time JS Date, which shifts
// the day depending on the server timezone. Register this once at startup so
// the raw string is kept instead:
//   import { types } from 'pg';
//   types.setTypeParser(1082, (value) => value);
export type DateOnly = string;
